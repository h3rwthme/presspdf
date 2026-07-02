import { useState } from 'react'
import Dropzone from '../components/Dropzone'
import Icon from '../components/Icon'
import { useJob } from '../lib/useJob'
import { loadImage, toCanvas, resizeCanvas, canvasToBlob } from '../lib/image'
import { downloadBlob, fmtSize, stripExt } from '../lib/utils'

const FORMATS = {
  jpeg: { mime: 'image/jpeg', ext: 'jpg', label: 'JPG', sub: 'foto, kecil' },
  webp: { mime: 'image/webp', ext: 'webp', label: 'WebP', sub: 'paling kecil' },
  png:  { mime: 'image/png',  ext: 'png', label: 'PNG', sub: 'tanpa rugi' },
}

export default function CompressPhoto({ shell: Shell, tool, onBack }) {
  const [fmt, setFmt] = useState('jpeg')
  const [quality, setQuality] = useState(0.72)
  const [maxDim, setMaxDim] = useState(0) // 0 = keep original size
  const [results, setResults] = useState([])
  const job = useJob()

  const compressAll = (files) => job.run(async (progress) => {
    const f = FORMATS[fmt]
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      await progress(`Mengompres ${file.name} (${i + 1}/${files.length})…`, Math.round((i / files.length) * 100))
      const img = await loadImage(file)
      let canvas = toCanvas(img)
      if (maxDim && Math.max(canvas.width, canvas.height) > maxDim) {
        const k = maxDim / Math.max(canvas.width, canvas.height)
        canvas = resizeCanvas(canvas, canvas.width * k, canvas.height * k)
      }
      const blob = await canvasToBlob(canvas, f.mime, fmt === 'png' ? undefined : quality)
      setResults((r) => [{
        name: stripExt(file.name) + '-kompres.' + f.ext,
        before: file.size, blob, url: URL.createObjectURL(blob),
        w: canvas.width, h: canvas.height,
      }, ...r])
    }
    await progress('Selesai', 100)
  })

  return (
    <Shell tool={tool} onBack={onBack} {...job}>
      <div className="options">
        <div className="field">
          <label>Format keluaran</label>
          <div className="seg">
            {Object.entries(FORMATS).map(([k, v]) => (
              <label key={k} className={'opt-card' + (fmt === k ? ' active' : '')}>
                <input type="radio" hidden checked={fmt === k} onChange={() => setFmt(k)} />
                {v.label}<small>{v.sub}</small>
              </label>
            ))}
          </div>
        </div>

        {fmt !== 'png' && (
          <div className="field">
            <div className="slider">
              <div className="row"><span>Kualitas</span><span className="val">{Math.round(quality * 100)}%</span></div>
              <input type="range" min="0.3" max="0.95" step="0.01" value={quality} onChange={(e) => setQuality(+e.target.value)} />
            </div>
          </div>
        )}

        <div className="field">
          <label>Batas ukuran (sisi terpanjang)</label>
          <div className="seg">
            {[[0, 'Asli'], [1920, '1920px'], [1280, '1280px'], [800, '800px']].map(([v, l]) => (
              <label key={v} className={'opt-card' + (maxDim === v ? ' active' : '')} style={{ minWidth: 76 }}>
                <input type="radio" hidden checked={maxDim === v} onChange={() => setMaxDim(v)} />
                {l}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <Dropzone accept="image" label="Jatuhkan foto untuk dikompres" hint="JPG · PNG · WebP — bisa banyak sekaligus" onFiles={compressAll} />
      </div>

      {results.length > 0 && (
        <div className="results">
          {results.map((r, i) => {
            const pct = Math.round((1 - r.blob.size / r.before) * 100)
            return (
              <div className="result-row" key={i}>
                <img className="thumb" src={r.url} alt="" />
                <span className="file-name">{r.name}<br /><span className="mono-s">{r.w}×{r.h}px</span></span>
                <span className="mono-s"><del>{fmtSize(r.before)}</del> → <b>{fmtSize(r.blob.size)}</b></span>
                <span className={'badge' + (pct <= 0 ? ' neg' : '')}>{pct > 0 ? `−${pct}%` : `+${-pct}%`}</span>
                <button className="mini" onClick={() => downloadBlob(r.blob, r.name)}><Icon name="download" size={15} /> Unduh</button>
              </div>
            )
          })}
        </div>
      )}

      <div className="note"><Icon name="info" size={16} />
        WebP biasanya paling hemat untuk foto web. PNG dipertahankan tanpa kompresi lossy, jadi cocok untuk gambar dengan transparansi atau garis tajam.
      </div>
    </Shell>
  )
}
