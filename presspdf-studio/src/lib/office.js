// Real Office (OOXML) builders & parsers — .docx / .xlsx / .pptx are ZIP + XML,
// so JSZip + DOMParser cover both directions entirely client-side.
import JSZip from 'jszip'

const XMLH = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const esc = (s) => String(s)
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// pdf-lib's standard fonts use WinAnsi encoding; strip anything it can't encode.
const WIN_OK = new Set('–—‘’“”‚„…•€™†‡‹›«»°±²³µ¶·¹º¼½¾¿ˆ˜'.split(''))
export const sanitizeWin = (s) => String(s)
  .replace(/[\t\u00A0]/g, ' ')
  .replace(/[\u2028\u2029\r]/g, '')
  .split('').map((ch) => (ch.charCodeAt(0) <= 0xFF || WIN_OK.has(ch)) ? ch : '·').join('')

const parseXml = (str) => new DOMParser().parseFromString(str, 'application/xml')
const byTag = (node, tag) => [...node.getElementsByTagNameNS('*', tag)]

/* ============================== DOCX ============================== */

const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

// paragraphs: strings ('' = blank line), { text, bold?, size? (pt), align? },
// or { type:'image', bytes: Uint8Array, ext:'png'|'jpeg', w, h (pt), align? }
export function buildDocx(paragraphs) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', XMLH +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="png" ContentType="image/png"/>' +
    '<Default Extension="jpeg" ContentType="image/jpeg"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file('_rels/.rels', XMLH +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')

  const images = []
  const MAX_W_PT = 481 // A4 content width at 2cm margins
  const body = paragraphs.map((p) => {
    const para = typeof p === 'string' ? { text: p } : p
    const jc = para.align ? `<w:pPr><w:jc w:val="${para.align}"/></w:pPr>` : ''

    if (para.type === 'image') {
      const ext = para.ext === 'jpg' ? 'jpeg' : (para.ext || 'png')
      const n = images.push({ bytes: para.bytes, ext })
      let w = para.w || 300, h = para.h || 200
      if (w > MAX_W_PT) { h *= MAX_W_PT / w; w = MAX_W_PT }
      const cx = Math.max(1, Math.round(w * EMU_PER_PT)), cy = Math.max(1, Math.round(h * EMU_PER_PT))
      return `<w:p>${jc}<w:r><w:drawing>` +
        `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>` +
        `<wp:docPr id="${n}" name="Gambar ${n}"/>` +
        '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
        `<pic:pic><pic:nvPicPr><pic:cNvPr id="${n}" name="Gambar ${n}"/><pic:cNvPicPr/></pic:nvPicPr>` +
        `<pic:blipFill><a:blip r:embed="rIdImg${n}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
        `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>' +
        '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'
    }

    const { text = '', bold = false, size = 0 } = para
    if (!text) return '<w:p/>'
    const rpr = (bold || size)
      ? `<w:rPr>${bold ? '<w:b/>' : ''}${size ? `<w:sz w:val="${Math.round(size * 2)}"/>` : ''}</w:rPr>`
      : ''
    return `<w:p>${jc}<w:r>${rpr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`
  }).join('')

  images.forEach((img, i) => zip.file(`word/media/image${i + 1}.${img.ext}`, img.bytes))
  zip.file('word/_rels/document.xml.rels', XMLH +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    images.map((img, i) =>
      `<Relationship Id="rIdImg${i + 1}" Type="${RNS}/image" Target="media/image${i + 1}.${img.ext}"/>`).join('') +
    '</Relationships>')

  zip.file('word/document.xml', XMLH +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"' +
    ` xmlns:r="${RNS}"` +
    ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"' +
    ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
    ' xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>' + body +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>' +
    '</w:body></w:document>')
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

// -> [{ text, bold, size, align } | { type:'image', bytes, ext, w, h, align }]
export async function parseDocx(file) {
  const zip = await JSZip.loadAsync(file)
  const xml = await zip.file('word/document.xml')?.async('string')
  if (!xml) throw new Error('File .docx tidak valid.')

  const rels = {}
  const relXml = await zip.file('word/_rels/document.xml.rels')?.async('string')
  if (relXml) for (const r of byTag(parseXml(relXml), 'Relationship')) rels[r.getAttribute('Id')] = r.getAttribute('Target')

  const doc = parseXml(xml)
  const body = byTag(doc, 'body')[0] || doc
  const out = []
  for (const p of byTag(body, 'p')) {
    const jcEl = byTag(p, 'jc')[0]
    const align = jcEl?.getAttribute('w:val') || jcEl?.getAttribute('val') || ''

    // inline images inside this paragraph
    for (const blip of byTag(p, 'blip')) {
      const rid = blip.getAttribute('r:embed') || blip.getAttributeNS(RNS, 'embed')
      let target = rels[rid]
      if (!target) continue
      target = target.replace(/^\//, '').replace(/^word\//, '')
      const entry = zip.file('word/' + target)
      if (!entry) continue
      const ext = target.split('.').pop().toLowerCase()
      if (!['png', 'jpg', 'jpeg'].includes(ext)) continue
      const extEl = byTag(p, 'extent')[0]
      out.push({
        type: 'image',
        bytes: await entry.async('uint8array'),
        ext,
        w: extEl ? +extEl.getAttribute('cx') / EMU_PER_PT : 0,
        h: extEl ? +extEl.getAttribute('cy') / EMU_PER_PT : 0,
        align,
      })
    }

    const runs = byTag(p, 'r')
    const text = byTag(p, 't').map((t) => t.textContent).join('')
    if (!text && byTag(p, 'blip').length) continue // image-only paragraph
    const bold = runs.length > 0 && runs.every((r) => byTag(r, 'b').some((b) => b.parentNode.parentNode === r || b.parentNode === r))
    const szEl = byTag(p, 'sz')[0]
    const size = szEl ? (+szEl.getAttribute('w:val') || +szEl.getAttribute('val') || 0) / 2 : 0
    out.push({ text, bold, size, align })
  }
  return out
}

/* ============================== XLSX ============================== */

const colName = (i) => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - 1 - m) / 26 } return s }
const colIndex = (ref) => { let n = 0; for (const ch of ref) { const c = ch.charCodeAt(0); if (c >= 65 && c <= 90) n = n * 26 + (c - 64); else break } return n - 1 }

// rows: string[][]
export function buildXlsx(rows) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', XMLH +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')
  zip.file('_rels/.rels', XMLH +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
  zip.file('xl/workbook.xml', XMLH +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>')
  zip.file('xl/_rels/workbook.xml.rels', XMLH +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')

  const data = rows.map((r, ri) =>
    `<row r="${ri + 1}">` + r.map((cell, ci) => {
      const v = cell == null ? '' : String(cell)
      if (!v) return ''
      const ref = colName(ci) + (ri + 1)
      // real numbers become numeric cells so Excel can compute on them
      if (/^-?\d+([.,]\d+)?$/.test(v.trim()) && v.trim().length < 15) {
        return `<c r="${ref}"><v>${v.trim().replace(',', '.')}</v></c>`
      }
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`
    }).join('') + '</row>'
  ).join('')

  zip.file('xl/worksheets/sheet1.xml', XMLH +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + data + '</sheetData></worksheet>')
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// -> [{ name, rows: string[][] }]
export async function parseXlsx(file) {
  const zip = await JSZip.loadAsync(file)
  const shared = []
  const ss = await zip.file('xl/sharedStrings.xml')?.async('string')
  if (ss) for (const si of byTag(parseXml(ss), 'si')) shared.push(byTag(si, 't').map((t) => t.textContent).join(''))

  // sheet name ↔ file mapping via workbook rels (fallback: numeric order)
  let entries = []
  const wb = await zip.file('xl/workbook.xml')?.async('string')
  const rels = await zip.file('xl/_rels/workbook.xml.rels')?.async('string')
  if (wb && rels) {
    const relMap = {}
    for (const r of byTag(parseXml(rels), 'Relationship')) relMap[r.getAttribute('Id')] = r.getAttribute('Target')
    for (const s of byTag(parseXml(wb), 'sheet')) {
      const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
      let target = relMap[rid]
      if (!target) continue
      if (!target.startsWith('xl/')) target = 'xl/' + target.replace(/^\//, '')
      entries.push({ name: s.getAttribute('name') || 'Sheet', path: target })
    }
  }
  if (!entries.length) {
    entries = Object.keys(zip.files)
      .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
      .sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0])
      .map((path, i) => ({ name: `Sheet${i + 1}`, path }))
  }
  if (!entries.length) throw new Error('File .xlsx tidak valid.')

  const sheets = []
  for (const { name, path } of entries) {
    const xml = await zip.file(path)?.async('string')
    if (!xml) continue
    const rows = []
    for (const row of byTag(parseXml(xml), 'row')) {
      const cells = []
      for (const c of byTag(row, 'c')) {
        const ref = c.getAttribute('r') || ''
        const idx = ref ? colIndex(ref) : cells.length
        const t = c.getAttribute('t')
        let val = ''
        if (t === 's') val = shared[+(byTag(c, 'v')[0]?.textContent ?? -1)] ?? ''
        else if (t === 'inlineStr') val = byTag(c, 't').map((x) => x.textContent).join('')
        else val = byTag(c, 'v')[0]?.textContent ?? ''
        cells[idx] = val
      }
      rows.push([...cells].map((v) => v ?? ''))
    }
    sheets.push({ name, rows })
  }
  return sheets
}

/* ============================== CSV ============================== */

// Quote-aware CSV/TSV parser with delimiter sniffing.
export function parseCsv(text) {
  text = text.replace(/^﻿/, '')
  const head = text.slice(0, 2000)
  const counts = [',', ';', '\t'].map((d) => (head.match(new RegExp(d === '\t' ? '\t' : '\\' + d, 'g')) || []).length)
  const delim = ['\t', ';', ','][[2, 1, 0].reduce((best, i) => counts[i] > counts[best] ? i : best, 0)] || ','
  const rows = [[]]
  let cell = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else inQ = false }
      else cell += ch
    } else if (ch === '"') inQ = true
    else if (ch === delim) { rows[rows.length - 1].push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      rows[rows.length - 1].push(cell); cell = ''; rows.push([])
    } else cell += ch
  }
  rows[rows.length - 1].push(cell)
  while (rows.length && rows[rows.length - 1].every((c) => !c.trim())) rows.pop()
  return rows
}

/* ============================== PPTX ============================== */

const EMU_PER_PT = 12700
const SLIDE_CX = 12192000, SLIDE_CY = 6858000 // 16:9

// slides: [{ bytes: Uint8Array (JPEG), w, h }] -> real .pptx, one full-bleed picture per slide
export function buildPptx(slides) {
  const zip = new JSZip()
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'

  const overrides = slides.map((_, i) =>
    `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')
  zip.file('[Content_Types].xml', XMLH +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="jpeg" ContentType="image/jpeg"/>' +
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
    '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
    '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
    overrides + '</Types>')

  zip.file('_rels/.rels', XMLH +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`)

  const sldIds = slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('')
  zip.file('ppt/presentation.xml', XMLH +
    `<p:presentation xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}">` +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
    `<p:sldIdLst>${sldIds}</p:sldIdLst>` +
    `<p:sldSz cx="${SLIDE_CX}" cy="${SLIDE_CY}"/><p:notesSz cx="${SLIDE_CY}" cy="${SLIDE_CX}"/></p:presentation>`)

  const presRels = slides.map((_, i) =>
    `<Relationship Id="rId${i + 2}" Type="${R}/slide" Target="slides/slide${i + 1}.xml"/>`).join('')
  zip.file('ppt/_rels/presentation.xml.rels', XMLH +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="${R}/slideMaster" Target="slideMasters/slideMaster1.xml"/>` + presRels + '</Relationships>')

  const emptyTree = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree>'

  zip.file('ppt/slideMasters/slideMaster1.xml', XMLH +
    `<p:sldMaster xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}">` +
    `<p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="lt1"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>${emptyTree}</p:cSld>` +
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>')
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', XMLH +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="${R}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
    `<Relationship Id="rId2" Type="${R}/theme" Target="../theme/theme1.xml"/></Relationships>`)

  zip.file('ppt/slideLayouts/slideLayout1.xml', XMLH +
    `<p:sldLayout xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}" type="blank" preserve="1">` +
    `<p:cSld name="Blank">${emptyTree}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`)
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', XMLH +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="${R}/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`)

  const accents = ['4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47']
  zip.file('ppt/theme/theme1.xml', XMLH +
    `<a:theme xmlns:a="${A}" name="Minimal"><a:themeElements><a:clrScheme name="M">` +
    '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
    '<a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>' +
    accents.map((c, i) => `<a:accent${i + 1}><a:srgbClr val="${c}"/></a:accent${i + 1}>`).join('') +
    '<a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme>' +
    '<a:fontScheme name="M"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
    '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
    '<a:fmtScheme name="M"><a:fillStyleLst>' + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3) + '</a:fillStyleLst>' +
    '<a:lnStyleLst>' + '<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'.repeat(3) + '</a:lnStyleLst>' +
    '<a:effectStyleLst>' + '<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3) + '</a:effectStyleLst>' +
    '<a:bgFillStyleLst>' + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3) + '</a:bgFillStyleLst>' +
    '</a:fmtScheme></a:themeElements></a:theme>')

  slides.forEach((s, i) => {
    const k = Math.min(SLIDE_CX / s.w, SLIDE_CY / s.h)
    const cw = Math.round(s.w * k), ch = Math.round(s.h * k)
    const ox = Math.round((SLIDE_CX - cw) / 2), oy = Math.round((SLIDE_CY - ch) / 2)
    zip.file(`ppt/media/image${i + 1}.jpeg`, s.bytes)
    zip.file(`ppt/slides/slide${i + 1}.xml`, XMLH +
      `<p:sld xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:cSld><p:spTree>` +
      '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' +
      `<p:pic><p:nvPicPr><p:cNvPr id="2" name="Halaman ${i + 1}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
      '<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>' +
      `<p:spPr><a:xfrm><a:off x="${ox}" y="${oy}"/><a:ext cx="${cw}" cy="${ch}"/></a:xfrm>` +
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>' +
      '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>')
    zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, XMLH +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      `<Relationship Id="rId1" Type="${R}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
      `<Relationship Id="rId2" Type="${R}/image" Target="../media/image${i + 1}.jpeg"/></Relationships>`)
  })

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  })
}

// -> { w, h (pt), slides: [{ shapes: [...] }] } — shapes keep xfrm position when present
export async function parsePptx(file) {
  const zip = await JSZip.loadAsync(file)
  let w = SLIDE_CX / EMU_PER_PT, h = SLIDE_CY / EMU_PER_PT
  const pres = await zip.file('ppt/presentation.xml')?.async('string')
  if (pres) {
    const sz = byTag(parseXml(pres), 'sldSz')[0]
    if (sz) { w = +sz.getAttribute('cx') / EMU_PER_PT; h = +sz.getAttribute('cy') / EMU_PER_PT }
  }

  const names = Object.keys(zip.files)
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
    .sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0])
  if (!names.length) throw new Error('File .pptx tidak valid — tidak ada slide.')

  const slides = []
  for (const name of names) {
    const xml = await zip.file(name).async('string')
    const doc = parseXml(xml)
    // relationship map for this slide (images)
    const relMap = {}
    const relXml = await zip.file(name.replace('slides/', 'slides/_rels/') + '.rels')?.async('string')
    if (relXml) for (const r of byTag(parseXml(relXml), 'Relationship')) relMap[r.getAttribute('Id')] = r.getAttribute('Target')

    const readXfrm = (el) => {
      const xfrm = byTag(el, 'xfrm')[0]
      if (!xfrm) return null
      const off = byTag(xfrm, 'off')[0], ext = byTag(xfrm, 'ext')[0]
      if (!off || !ext) return null
      return {
        x: +off.getAttribute('x') / EMU_PER_PT, y: +off.getAttribute('y') / EMU_PER_PT,
        w: +ext.getAttribute('cx') / EMU_PER_PT, h: +ext.getAttribute('cy') / EMU_PER_PT,
      }
    }

    const shapes = []
    for (const sp of byTag(doc, 'sp')) {
      const paras = byTag(sp, 'p').filter((p) => p.namespaceURI.includes('drawingml')).map((p) => {
        const text = byTag(p, 't').map((t) => t.textContent).join('')
        const rPr = byTag(p, 'rPr')[0]
        return {
          text,
          size: rPr?.getAttribute('sz') ? +rPr.getAttribute('sz') / 100 : 0,
          bold: rPr?.getAttribute('b') === '1',
        }
      }).filter((p) => p.text.trim())
      if (paras.length) shapes.push({ type: 'text', box: readXfrm(sp), paras })
    }
    for (const pic of byTag(doc, 'pic')) {
      const blip = byTag(pic, 'blip')[0]
      const rid = blip?.getAttribute('r:embed') || blip?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed')
      let target = relMap[rid]
      if (!target) continue
      target = target.replace(/^(\.\.\/)+/, 'ppt/')
      const entry = zip.file(target)
      if (!entry) continue
      const ext = target.split('.').pop().toLowerCase()
      if (!['png', 'jpg', 'jpeg'].includes(ext)) continue
      shapes.push({ type: 'image', box: readXfrm(pic), bytes: await entry.async('uint8array'), ext })
    }
    slides.push({ shapes })
  }
  return { w, h, slides }
}
