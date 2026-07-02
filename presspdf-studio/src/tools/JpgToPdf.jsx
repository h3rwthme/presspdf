import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import Dropzone from '../components/Dropzone'
import FileRow from '../components/FileRow'
import Icon from '../components/Icon'
import { loadImage, toCanvas, canvasToBlob } from '../lib/image'
import { downloadBlob } from '../lib/utils'
import { useJob } from '../lib/useJob'

const A4 = [595.28, 841.89]

export default function JpgToPdf({ shell: Shell, tool, onBack }) {
  const [files, setFiles] = useState([])
  const [pageMode, setPageMode] = useState('image')
  const [orient, setOrient] = useState('auto')
  const job = useJob()

  const move = (i, d) => setFiles((f) => {
    const c = [...f]; const [x] = c.splice(i, 1); c.splice(i + d, 0, x); return c
  })

  const embed = async (out, file) => {
    if (file.type === 'image/jpeg') return out.embedJpg(await file.arrayBuffer())
    if (file.type === 'image/png') return out.embedPng(await file.arrayBuffer())
    // webp/bmp: transcode to PNG via canvas first
    const canvas = toCanvas(await loadImage(file))
    return out.embedPng(await (await canvasToBlob(canvas, 'image/png')).arrayBuffer())
  }

  const go = () => job.run(async (progress) => {
    const out = await PDFDocument.create()
    for (let i = 0; i < files.length; i++) {
      await progress(`Menambahkan ${files[i].name} (${i + 1}/${files.length})…`, Math.round((i / files.length) * 100))
      const img = await embed(out, files[i])
      if (pageMode === 'image') {
        const [w, h] = [img.width * 0.75, img.height * 0.75] // 96dpi px -> pt
        out.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h })
      } else {
        const landscape = orient === 'landscape' || (orient === 'auto' && img.width > img.height)
        const size = landscape ? [A4[1], A4[0]] : A4
        const page = out.addPage(size)
        const m = 28
        const s = Math.min((size[0] - m * 2) / img.width, (size[1] - m * 2) / img.height)
        const [w, h] = [img.width * s, img.height * s]
        page.drawImage(img, { x: (size[0] - w) / 2, y: (size[1] - h) / 2, width: w, height: h })
      }
    }
    await progress('Menyimpan PDF…', 100)
    downloadBlob(new Blob([await out.save()], { type: 'application/pdf' }), 'foto-ke-pdf.pdf')
  })

  return (
    <Shell tool={tool} onBack={onBack} {...job}>
      <Dropzone accept="image" label="Tambahkan gambar JPG / PNG / WebP" onFiles={(f) => setFiles((x) => [...x, ...f])} />
      {files.length > 0 && (
        <>
          <div className="file-list">
            {files.map((f, i) => (
              <FileRow key={i} file={f} index={i} total={files.length} preview
                onUp={() => move(i, -1)} onDown={() => move(i, 1)}
                onRemove={() => setFiles((x) => x.filter((_, j) => j !== i))} />
            ))}
          </div>
          <div className="options">
            <div className="field">
              <label>Ukuran halaman</label>
              <div className="seg">
                {[['image', 'Sesuai gambar', 'tanpa margin'], ['a4', 'A4', 'diberi margin']].map(([k, l, s]) => (
                  <label key={k} className={'opt-card' + (pageMode === k ? ' active' : '')}>
                    <input type="radio" hidden checked={pageMode === k} onChange={() => setPageMode(k)} />
                    {l}<small>{s}</small>
                  </label>
                ))}
              </div>
            </div>
            {pageMode === 'a4' && (
              <div className="field">
                <label>Orientasi</label>
                <div className="seg">
                  {[['auto', 'Otomatis'], ['portrait', 'Potret'], ['landscape', 'Lanskap']].map(([k, l]) => (
                    <label key={k} className={'opt-card' + (orient === k ? ' active' : '')} style={{ minWidth: 84 }}>
                      <input type="radio" hidden checked={orient === k} onChange={() => setOrient(k)} />
                      {l}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <button className="cta" disabled={job.busy} onClick={go}><Icon name="file" size={18} /> Buat PDF ({files.length} gambar)</button>
          </div>
        </>
      )}
    </Shell>
  )
}
