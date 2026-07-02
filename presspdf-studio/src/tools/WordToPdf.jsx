import { useState } from 'react'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import Dropzone from '../components/Dropzone'
import FileRow from '../components/FileRow'
import Icon from '../components/Icon'
import { useJob } from '../lib/useJob'
import { parseDocx, sanitizeWin } from '../lib/office'
import { downloadBlob, fmtSize, stripExt } from '../lib/utils'

const A4 = [595.28, 841.89]
const MARGIN = 56

export default function WordToPdf({ shell: Shell, tool, onBack }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const job = useJob()

  const reset = () => { setFile(null); setResult(null) }

  const convert = () => job.run(async (progress) => {
    setResult(null)
    await progress('Membaca dokumen…', 15)

    let paragraphs
    if (/\.docx$/i.test(file.name)) {
      paragraphs = await parseDocx(file)
    } else {
      const text = new TextDecoder().decode(await file.arrayBuffer())
      paragraphs = text.split(/\r?\n/).map((t) => ({ text: t, bold: false, size: 0 }))
    }
    if (!paragraphs.some((p) => p.type === 'image' || (p.text || '').trim())) {
      throw new Error('Dokumen ini kosong / tidak berisi konten.')
    }

    await progress('Menyusun halaman PDF…', 45)
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const bold = await doc.embedFont(StandardFonts.HelveticaBold)
    const maxW = A4[0] - MARGIN * 2
    const ink = rgb(0.08, 0.09, 0.11)

    let page = doc.addPage(A4)
    let y = A4[1] - MARGIN

    for (const para of paragraphs) {
      if (para.type === 'image') {
        let img
        try {
          img = para.ext === 'png' ? await doc.embedPng(para.bytes) : await doc.embedJpg(para.bytes)
        } catch {
          try { img = await doc.embedPng(para.bytes) } catch { continue }
        }
        // honour the size stored in the docx; fall back to natural px→pt
        let iw = para.w || img.width * 0.75
        let ih = para.h || img.height * 0.75
        const k = Math.min(1, maxW / iw, (A4[1] - MARGIN * 2) / ih)
        iw *= k; ih *= k
        if (y - ih < MARGIN) { page = doc.addPage(A4); y = A4[1] - MARGIN }
        const x = para.align === 'center' ? (A4[0] - iw) / 2
          : para.align === 'right' ? A4[0] - MARGIN - iw : MARGIN
        page.drawImage(img, { x, y: y - ih, width: iw, height: ih })
        y -= ih + 12
        continue
      }

      const text = sanitizeWin(para.text || '').trim()
      const size = para.size && para.size >= 6 ? Math.min(para.size, 32) : 11
      const lh = size * 1.45
      if (!text) { y -= lh * 0.55; continue }
      const f = para.bold ? bold : font
      for (const line of wrap(text, f, size, maxW)) {
        if (y < MARGIN + lh) { page = doc.addPage(A4); y = A4[1] - MARGIN }
        const lw = f.widthOfTextAtSize(line, size)
        const x = para.align === 'center' ? (A4[0] - lw) / 2
          : para.align === 'right' ? A4[0] - MARGIN - lw : MARGIN
        page.drawText(line, { x, y: y - size, size, font: f, color: ink })
        y -= lh
      }
      y -= lh * 0.25 // paragraph spacing
    }

    await progress('Mengemas PDF…', 90)
    const blob = new Blob([await doc.save()], { type: 'application/pdf' })
    setResult({ blob, name: stripExt(file.name) + '.pdf', n: doc.getPageCount() })
  })

  return (
    <Shell tool={tool} onBack={onBack} {...job}>
      {!file
        ? <Dropzone accept="word" multiple={false} label="Pilih dokumen" hint=".docx atau .txt" onFiles={([f]) => setFile(f)} />
        : (
          <>
            <div className="file-list"><FileRow file={file} index={0} total={1} onRemove={reset} /></div>
            <div className="options">
              <button className="cta" disabled={job.busy} onClick={convert}>
                <Icon name="file" size={18} /> Konversi ke PDF
              </button>
            </div>
            {result && (
              <div className="results">
                <div className="result-row">
                  <span className="f-icon"><Icon name="file" size={20} /></span>
                  <span className="file-name">{result.name}<br /><span className="mono-s">{result.n} halaman</span></span>
                  <span className="mono-s">{fmtSize(result.blob.size)}</span>
                  <button className="mini" onClick={() => downloadBlob(result.blob, result.name)}>
                    <Icon name="download" size={15} /> Unduh PDF
                  </button>
                </div>
              </div>
            )}
          </>
        )}
    </Shell>
  )
}

// Greedy word wrap with hard-break for words wider than the column.
function wrap(text, font, size, maxW) {
  const lines = []
  let cur = ''
  for (const word of text.split(/\s+/)) {
    const cand = cur ? cur + ' ' + word : word
    if (font.widthOfTextAtSize(cand, size) <= maxW) { cur = cand; continue }
    if (cur) lines.push(cur)
    if (font.widthOfTextAtSize(word, size) <= maxW) { cur = word; continue }
    let piece = ''
    for (const ch of word) {
      if (font.widthOfTextAtSize(piece + ch, size) <= maxW) piece += ch
      else { lines.push(piece); piece = ch }
    }
    cur = piece
  }
  if (cur) lines.push(cur)
  return lines
}
