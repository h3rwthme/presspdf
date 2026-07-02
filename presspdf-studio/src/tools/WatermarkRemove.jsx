import { useEffect, useRef, useState } from 'react'
import Dropzone from '../components/Dropzone'
import FileRow from '../components/FileRow'
import Icon from '../components/Icon'
import { useJob } from '../lib/useJob'
import { loadImage, toCanvas, canvasToBlob, inpaint } from '../lib/image'
import { downloadBlob, stripExt } from '../lib/utils'

const WORK_MAX = 1600

export default function WatermarkRemove({ shell: Shell, tool, onBack }) {
  const [file, setFile] = useState(null)
  const [brush, setBrush] = useState(26)
  const [mode, setMode] = useState('mark') // mark | unmark
  const [hasMask, setHasMask] = useState(false)
  const baseRef = useRef(null)
  const maskRef = useRef(null)
  const drawing = useRef(false)
  const history = useRef([]) // imageData snapshots for undo
  const [canUndo, setCanUndo] = useState(false)
  const job = useJob()

  useEffect(() => {
    if (!file) return
    let alive = true
    ;(async () => {
      const img = await loadImage(file)
      if (!alive) return
      const src = toCanvas(img, WORK_MAX)
      const base = baseRef.current, mask = maskRef.current
      base.width = mask.width = src.width
      base.height = mask.height = src.height
      base.getContext('2d').drawImage(src, 0, 0)
      mask.getContext('2d').clearRect(0, 0, mask.width, mask.height)
      history.current = []; setCanUndo(false); setHasMask(false)
    })()
    return () => { alive = false }
  }, [file])

  const reset = () => { setFile(null); history.current = []; setCanUndo(false) }

  const pos = (e) => {
    const c = maskRef.current, r = c.getBoundingClientRect()
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height), scale: c.width / r.width }
  }
  const paint = (e) => {
    const ctx = maskRef.current.getContext('2d')
    const { x, y, scale } = pos(e)
    const r = brush * scale
    ctx.save()
    if (mode === 'mark') {
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = 'rgba(214,51,108,.55)'
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    } else {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
    setHasMask(true)
  }
  const onDown = (e) => { e.preventDefault(); drawing.current = true; paint(e) }
  const onMove = (e) => { if (drawing.current) { e.preventDefault(); paint(e) } }
  const onUp = () => { drawing.current = false }

  const clearMask = () => {
    const m = maskRef.current
    m.getContext('2d').clearRect(0, 0, m.width, m.height)
    setHasMask(false)
  }

  const run = () => job.run(async (progress) => {
    const base = baseRef.current, mask = maskRef.current
    const w = base.width, h = base.height
    const md = mask.getContext('2d').getImageData(0, 0, w, h).data
    const flags = new Uint8Array(w * h)
    let count = 0
    for (let i = 0; i < w * h; i++) if (md[i * 4 + 3] > 10) { flags[i] = 1; count++ }
    if (!count) throw new Error('Tandai dulu area watermark dengan kuas.')

    // snapshot for undo
    history.current.push(base.getContext('2d').getImageData(0, 0, w, h))
    setCanUndo(true)

    await progress('Mengisi ulang area watermark…', 40)
    inpaint(base, flags, count > 40000 ? 120 : 80)
    await progress('Menghaluskan sambungan…', 85)
    clearMask()
    await progress('Watermark dihilangkan.', 100)
  })

  const undo = () => {
    const h = history.current.pop()
    if (!h) return
    baseRef.current.getContext('2d').putImageData(h, 0, 0)
    setCanUndo(history.current.length > 0)
  }

  const save = async () => {
    const blob = await canvasToBlob(baseRef.current, 'image/png')
    downloadBlob(blob, stripExt(file.name) + '-tanpa-watermark.png')
  }

  return (
    <Shell tool={tool} onBack={onBack} {...job}>
      {!file
        ? <Dropzone accept="image" multiple={false} label="Pilih foto berwatermark" hint="Sapu watermark/logo, lalu isi otomatis" onFiles={([f]) => setFile(f)} />
        : (
          <>
            <div className="file-list"><FileRow file={file} index={0} total={1} preview onRemove={reset} /></div>

            <div className="stage">
              <div style={{ position: 'relative', lineHeight: 0, maxWidth: '100%' }}>
                <canvas ref={baseRef} style={{ maxWidth: '100%', height: 'auto', display: 'block' }} />
                <canvas
                  ref={maskRef}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none' }}
                  onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
                />
              </div>
            </div>

            <div className="toolbar">
              <div className="chiprow">
                <button className={'chiptoggle' + (mode === 'mark' ? ' active' : '')} onClick={() => setMode('mark')}>Tandai</button>
                <button className={'chiptoggle' + (mode === 'unmark' ? ' active' : '')} onClick={() => setMode('unmark')}>Hapus tanda</button>
              </div>
              <div className="grp" style={{ flex: 1, minWidth: 150 }}>
                Kuas
                <input type="range" min="8" max="70" step="2" value={brush} onChange={(e) => setBrush(+e.target.value)} style={{ flex: 1 }} />
                <span className="mono-s">{brush}px</span>
              </div>
              <button className="chiptoggle" onClick={clearMask} disabled={!hasMask}>Bersihkan tanda</button>
            </div>

            <div className="options">
              <div className="seg" style={{ alignItems: 'center' }}>
                <button className="cta" disabled={job.busy || !hasMask} onClick={run}><Icon name="watermark-off" size={18} /> Hilangkan Watermark</button>
                <button className="cta ghost" disabled={!canUndo} onClick={undo}><Icon name="rotate" size={16} /> Urungkan</button>
                <button className="mini" onClick={save}><Icon name="download" size={15} /> Unduh PNG</button>
              </div>
            </div>
          </>
        )}

      <div className="note"><Icon name="info" size={16} />
        Tandai persis di atas watermark, lalu tekan <b>Hilangkan</b>. Area ditutup dengan menyalin tekstur sekitarnya — hasil terbaik untuk watermark tipis di atas latar yang cukup seragam. Ulangi beberapa kali untuk watermark tebal.
      </div>
    </Shell>
  )
}
