import { useState } from 'react'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import Dropzone from '../components/Dropzone'
import FileRow from '../components/FileRow'
import Icon from '../components/Icon'
import { useJob } from '../lib/useJob'
import { parsePptx, sanitizeWin } from '../lib/office'
import { downloadBlob, fmtSize, stripExt } from '../lib/utils'

export default function PptToPdf({ shell: Shell, tool, onBack }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const job = useJob()

  const reset = () => { setFile(null); setResult(null) }

  const convert = () => job.run(async (progress) => {
    setResult(null)
    await progress('Membaca presentasi…', 10)
    const { w, h, slides } = await parsePptx(file)

    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const bold = await doc.embedFont(StandardFonts.HelveticaBold)
    const ink = rgb(0.08, 0.09, 0.11)

    for (let i = 0; i < slides.length; i++) {
      await progress(`Menyusun slide ${i + 1}/${slides.length}…`, 10 + (i / slides.length) * 80)
      const page = doc.addPage([w, h])
      let flowY = h - 60 // fallback stack position for shapes without coordinates

      for (const shape of slides[i].shapes) {
        if (shape.type === 'image') {
          let img
          try {
            img = shape.ext === 'png' ? await doc.embedPng(shape.bytes) : await doc.embedJpg(shape.bytes)
          } catch { continue }
          const box = shape.box || fitBox(img.width, img.height, w, h)
          page.drawImage(img, { x: box.x, y: h - box.y - box.h, width: box.w, height: box.h })
          if (!shape.box) flowY = Math.min(flowY, h - box.y - box.h - 20)
        } else {
          const box = shape.box
          let ty = box ? h - box.y : flowY
          const tx = box ? box.x + 6 : 48
          const maxW = (box ? box.w - 12 : w - 96)
          for (const para of shape.paras) {
            const size = Math.min(para.size || 18, 54)
            const f = para.bold ? bold : font
            for (const line of wrap(sanitizeWin(para.text), f, size, maxW)) {
              ty -= size * 1.3
              if (ty < 8) break
              page.drawText(line, { x: tx, y: ty, size, font: f, color: ink })
            }
            ty -= size * 0.35
          }
          if (!box) flowY = ty - 12
        }
      }
    }

    await progress('Mengemas PDF…', 95)
    const blob = new Blob([await doc.save()], { type: 'application/pdf' })
    setResult({ blob, name: stripExt(file.name) + '.pdf', n: slides.length })
  })

  return (
    <Shell tool={tool} onBack={onBack} {...job}>
      {!file
        ? <Dropzone accept="ppt" multiple={false} label="Pilih presentasi" hint="File .pptx — teks & gambar slide dipertahankan" onFiles={([f]) => setFile(f)} />
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
                  <span className="file-name">{result.name}<br /><span className="mono-s">{result.n} slide</span></span>
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

function fitBox(iw, ih, w, h) {
  const k = Math.min((w * 0.8) / iw, (h * 0.8) / ih)
  const bw = iw * k, bh = ih * k
  return { x: (w - bw) / 2, y: (h - bh) / 2, w: bw, h: bh }
}

function wrap(text, font, size, maxW) {
  const lines = []
  let cur = ''
  for (const word of String(text).split(/\s+/)) {
    const cand = cur ? cur + ' ' + word : word
    if (font.widthOfTextAtSize(cand, size) <= maxW) { cur = cand; continue }
    if (cur) lines.push(cur)
    cur = word
  }
  if (cur) lines.push(cur)
  return lines
}
