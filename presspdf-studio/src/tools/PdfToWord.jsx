import { useState } from 'react'
import Dropzone from '../components/Dropzone'
import FileRow from '../components/FileRow'
import Icon from '../components/Icon'
import { useJob } from '../lib/useJob'
import { openPdf, extractLines, extractImages } from '../lib/pdfjs'
import { buildDocx } from '../lib/office'
import { downloadBlob, fmtSize, stripExt } from '../lib/utils'

export default function PdfToWord({ shell: Shell, tool, onBack }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const job = useJob()

  const reset = () => { setFile(null); setResult(null) }

  const convert = () => job.run(async (progress) => {
    setResult(null)
    const pdf = await openPdf(await file.arrayBuffer())
    const paragraphs = []
    let chars = 0, imgCount = 0

    for (let i = 1; i <= pdf.numPages; i++) {
      await progress(`Membaca halaman ${i}/${pdf.numPages}…`, (i / pdf.numPages) * 80)
      const page = await pdf.getPage(i)
      const pageW = page.getViewport({ scale: 1 }).width
      const lines = await extractLines(page)
      const images = await extractImages(page)
      imgCount += images.length
      const bodySize = median(lines.flatMap((l) => l.items.map((it) => it.h))) || 11

      // interleave text lines and images by vertical position (top first)
      const items = [
        ...lines.map((l) => ({ kind: 'line', y: l.y, line: l })),
        ...images.map((im) => ({ kind: 'image', y: im.top, im })),
      ].sort((a, b) => b.y - a.y)

      // merge consecutive lines into real paragraphs so Word doesn't get a
      // hard break on every visual line
      let cur = null
      const flush = () => { if (cur) { paragraphs.push(cur); chars += cur.text.length; cur = null } }

      for (const it of items) {
        if (it.kind === 'image') {
          flush()
          paragraphs.push({
            type: 'image', bytes: it.im.bytes, ext: 'png',
            w: it.im.w, h: it.im.h,
            align: isCentered(it.im.x, it.im.w, pageW) ? 'center' : '',
          })
          continue
        }
        const { line } = it
        const text = line.items.map((x) => x.s).join(' ').replace(/\s+/g, ' ').trim()
        if (!text) continue
        const size = Math.max(...line.items.map((x) => x.h))
        const x0 = line.items[0].x
        const x1 = line.items[line.items.length - 1].x + line.items[line.items.length - 1].w
        const heading = size > bodySize * 1.28
        const centered = isCentered(x0, x1 - x0, pageW)

        const sameBlock = cur && !cur._heading && !heading &&
          Math.abs(cur._size - size) < 1.5 &&           // same type size
          (cur._y - line.y) < size * 1.65 &&            // normal leading, not a gap
          Math.abs(cur._x0 - x0) < size * 1.2 &&        // same left edge (no indent)
          !centered

        if (sameBlock) {
          cur.text += ' ' + text
          cur._y = line.y
        } else {
          flush()
          cur = {
            text,
            bold: heading,
            size: heading ? Math.round(size) : 0,
            align: centered && x1 - x0 < pageW * 0.72 ? 'center' : '',
            _y: line.y, _size: size, _x0: x0, _heading: heading,
          }
        }
      }
      flush()
      if (i < pdf.numPages) paragraphs.push('')
    }

    if (!chars && !imgCount) throw new Error('PDF ini tidak mengandung teks maupun gambar yang bisa diekstrak.')

    await progress('Menyusun dokumen Word…', 92)
    const clean = paragraphs.map((p) => {
      if (typeof p === 'string' || p.type === 'image') return p
      const { _y, _size, _x0, _heading, ...rest } = p
      return rest
    })
    const blob = await buildDocx(clean)
    setResult({ blob, name: stripExt(file.name) + '.docx', imgCount })
  })

  return (
    <Shell tool={tool} onBack={onBack} {...job}>
      {!file
        ? <Dropzone accept="pdf" multiple={false} label="Pilih PDF" hint="Teks & judul diekstrak ke .docx" onFiles={([f]) => setFile(f)} />
        : (
          <>
            <div className="file-list"><FileRow file={file} index={0} total={1} onRemove={reset} /></div>
            <div className="options">
              <button className="cta" disabled={job.busy} onClick={convert}>
                <Icon name="word" size={18} /> Konversi ke Word
              </button>
            </div>
            {result && (
              <div className="results">
                <div className="result-row">
                  <span className="f-icon"><Icon name="word" size={20} /></span>
                  <span className="file-name">{result.name}{result.imgCount > 0 && <><br /><span className="mono-s">{result.imgCount} gambar ikut</span></>}</span>
                  <span className="mono-s">{fmtSize(result.blob.size)}</span>
                  <button className="mini" onClick={() => downloadBlob(result.blob, result.name)}>
                    <Icon name="download" size={15} /> Unduh DOCX
                  </button>
                </div>
              </div>
            )}
          </>
        )}
    </Shell>
  )
}

function median(arr) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  return s[s.length >> 1]
}

// element horizontally centered on the page (within 5% of centre)?
function isCentered(x, w, pageW) {
  return Math.abs((x + w / 2) - pageW / 2) < pageW * 0.05
}
