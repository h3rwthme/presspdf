import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import Dropzone from '../components/Dropzone'
import Icon from '../components/Icon'
import { openPdf, renderPage, canvasToJpeg } from '../lib/pdfjs'
import { downloadBlob, fmtSize, stripExt } from '../lib/utils'
import { useJob } from '../lib/useJob'

const LEVELS = {
  low:     { scale: 1.6,  quality: 0.82, label: 'Ringan',      sub: 'kualitas terjaga' },
  rec:     { scale: 1.15, quality: 0.62, label: 'Rekomendasi', sub: 'seimbang' },
  extreme: { scale: 0.85, quality: 0.45, label: 'Ekstrem',     sub: 'sekecil mungkin' },
}

export default function Compress({ shell: Shell, tool, onBack }) {
  const [level, setLevel] = useState('rec')
  const [results, setResults] = useState([])
  const job = useJob()

  const compressAll = (files) => job.run(async (progress) => {
    for (const file of files) {
      const opt = LEVELS[level]
      const pdf = await openPdf(await file.arrayBuffer())
      const out = await PDFDocument.create()
      for (let i = 1; i <= pdf.numPages; i++) {
        await progress(`${file.name}: halaman ${i}/${pdf.numPages}…`, Math.round((i / pdf.numPages) * 100))
        const page = await pdf.getPage(i)
        const { width, height } = page.getViewport({ scale: 1 })
        const canvas = await renderPage(page, opt.scale)
        const jpeg = await out.embedJpg(await (await canvasToJpeg(canvas, opt.quality)).arrayBuffer())
        out.addPage([width, height]).drawImage(jpeg, { x: 0, y: 0, width, height })
        page.cleanup(); canvas.width = canvas.height = 0
      }
      const blob = new Blob([await out.save()], { type: 'application/pdf' })
      setResults((r) => [{ name: stripExt(file.name) + '-kompres.pdf', before: file.size, blob }, ...r])
    }
  })

  return (
    <Shell tool={tool} onBack={onBack} {...job}>
      <div className="options">
        <div className="field">
          <label>Tingkat kompresi</label>
          <div className="seg">
            {Object.entries(LEVELS).map(([k, v]) => (
              <label key={k} className={'opt-card' + (level === k ? ' active' : '')}>
                <input type="radio" hidden checked={level === k} onChange={() => setLevel(k)} />
                {v.label}<small>{v.sub}</small>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 18 }}>
        <Dropzone label="Jatuhkan PDF untuk dikompres" hint="bisa beberapa file sekaligus" onFiles={compressAll} />
      </div>

      {results.length > 0 && (
        <div className="results">
          {results.map((r, i) => {
            const pct = Math.round((1 - r.blob.size / r.before) * 100)
            return (
              <div className="result-row" key={i}>
                <span className="f-icon"><Icon name="file" size={20} /></span>
                <span className="file-name">{r.name}</span>
                <span className="mono-s"><del>{fmtSize(r.before)}</del> → <b>{fmtSize(r.blob.size)}</b></span>
                <span className={'badge' + (pct <= 0 ? ' neg' : '')}>{pct > 0 ? `−${pct}%` : `+${-pct}%`}</span>
                <button className="mini" onClick={() => downloadBlob(r.blob, r.name)}><Icon name="download" size={15} /> Unduh</button>
              </div>
            )
          })}
        </div>
      )}
      <div className="note"><Icon name="info" size={16} />
        Halaman di-render ulang sebagai gambar — teks hasil kompresi tidak bisa diseleksi.
      </div>
    </Shell>
  )
}
