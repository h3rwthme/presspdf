import { useEffect, useRef, useState } from 'react'
import Dropzone from '../components/Dropzone'
import FileRow from '../components/FileRow'
import Icon from '../components/Icon'
import { useJob } from '../lib/useJob'
import { loadImage, toCanvas, newCanvas, removeBackground, canvasToBlob, flatten } from '../lib/image'
import { downloadBlob, stripExt } from '../lib/utils'

const WORK_MAX = 1600 // cap working resolution for snappy editing

export default function RemoveBg({ shell: Shell, tool, onBack }) {
  const [file, setFile] = useState(null)
  const [tol, setTol] = useState(0.14)
  const [feather, setFeather] = useState(2)
  const [brush, setBrush] = useState(28)
  const [mode, setMode] = useState('erase') // erase | restore
  const [bg, setBg] = useState('transparent')
  const [hasResult, setHasResult] = useState(false)
  const [ready, setReady] = useState(false) // src canvas loaded (drives button enable)
  const dispRef = useRef(null)
  const srcRef = useRef(null)   // untouched resized original
  const drawing = useRef(false)
  const job = useJob()

  // load image -> prepare source + display canvases
  useEffect(() => {
    if (!file) return
    let alive = true
    setReady(false)
    ;(async () => {
      const img = await loadImage(file)
      if (!alive) return
      const src = toCanvas(img, WORK_MAX)
      srcRef.current = src
      const disp = dispRef.current
      disp.width = src.width; disp.height = src.height
      disp.getContext('2d').drawImage(src, 0, 0)
      setHasResult(false)
      setReady(true)
    })()
    return () => { alive = false }
  }, [file])

  const reset = () => { setFile(null); setHasResult(false); setReady(false); srcRef.current = null }

  const autoRemove = () => job.run(async (progress) => {
    await progress('Menganalisis latar…', 30)
    const work = newCanvas(srcRef.current.width, srcRef.current.height)
    work.getContext('2d').drawImage(srcRef.current, 0, 0)
    await progress('Menghapus latar…', 65)
    removeBackground(work, { tolerance: tol, feather })
    const disp = dispRef.current
    disp.getContext('2d').clearRect(0, 0, disp.width, disp.height)
    disp.getContext('2d').drawImage(work, 0, 0)
    setHasResult(true)
    await progress('Latar dihapus — rapikan dengan kuas bila perlu.', 100)
  })

  // --- manual brush (works on mouse + touch via pointer events) ---
  const pos = (e) => {
    const c = dispRef.current, r = c.getBoundingClientRect()
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }
  }
  const paint = (e) => {
    const c = dispRef.current, ctx = c.getContext('2d')
    const { x, y } = pos(e)
    const r = brush * (c.width / c.getBoundingClientRect().width)
    ctx.save()
    if (mode === 'erase') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    } else {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip()
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(srcRef.current, 0, 0)
    }
    ctx.restore()
    setHasResult(true)
  }
  const onDown = (e) => { e.preventDefault(); drawing.current = true; paint(e) }
  const onMove = (e) => { if (drawing.current) { e.preventDefault(); paint(e) } }
  const onUp = () => { drawing.current = false }

  const save = async () => {
    let out = dispRef.current
    let ext = 'png'
    if (bg !== 'transparent') { out = flatten(out, bg) }
    const blob = await canvasToBlob(out, 'image/png')
    downloadBlob(blob, stripExt(file.name) + '-tanpa-latar.' + ext)
  }

  return (
    <Shell tool={tool} onBack={onBack} {...job}>
      {!file
        ? <Dropzone accept="image" multiple={false} label="Pilih foto untuk dihapus latarnya" hint="Paling baik untuk latar polos / warna rata" onFiles={([f]) => setFile(f)} />
        : (
          <>
            <div className="file-list"><FileRow file={file} index={0} total={1} preview onRemove={reset} /></div>

            <div className="options">
              <Range label="Toleransi warna latar" value={tol} min={0.04} max={0.4} step={0.01} onChange={setTol} fmt={(v) => Math.round(v * 100) + '%'} />
              <Range label="Kehalusan tepi" value={feather} min={0} max={5} step={1} onChange={setFeather} fmt={(v) => v + 'px'} />
              <button className="cta" disabled={job.busy || !ready} onClick={autoRemove}>
                <Icon name="remove-bg" size={18} /> Hapus Latar Otomatis
              </button>
            </div>

            <div className="stage">
              <canvas
                ref={dispRef}
                onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
              />
            </div>

            <div className="toolbar">
              <div className="grp"><Icon name="cursor" size={16} /> Kuas manual</div>
              <div className="chiprow">
                <button className={'chiptoggle' + (mode === 'erase' ? ' active' : '')} onClick={() => setMode('erase')}>Hapus</button>
                <button className={'chiptoggle' + (mode === 'restore' ? ' active' : '')} onClick={() => setMode('restore')}>Kembalikan</button>
              </div>
              <div className="grp" style={{ flex: 1, minWidth: 160 }}>
                Ukuran
                <input type="range" min="8" max="80" step="2" value={brush} onChange={(e) => setBrush(+e.target.value)} style={{ flex: 1 }} />
                <span className="mono-s">{brush}px</span>
              </div>
            </div>

            <div className="toolbar">
              <div className="grp"><Icon name="image" size={16} /> Latar hasil</div>
              <div className="chiprow">
                <button className={'chiptoggle' + (bg === 'transparent' ? ' active' : '')} onClick={() => setBg('transparent')}>Transparan</button>
                {['#FFFFFF', '#111318', '#2F6BFF', '#12805C'].map((c) => (
                  <button key={c} className={'chiptoggle' + (bg === c ? ' active' : '')} onClick={() => setBg(c)}
                    style={{ background: c, width: 30, padding: 0, height: 30, borderRadius: '50%' }} aria-label={c} />
                ))}
              </div>
              <button className="mini" style={{ marginLeft: 'auto' }} disabled={!hasResult} onClick={save}>
                <Icon name="download" size={15} /> Unduh PNG
              </button>
            </div>
          </>
        )}

      <div className="note"><Icon name="info" size={16} />
        Penghapusan bekerja dari tepi gambar, jadi paling akurat untuk objek di atas latar polos. Untuk latar rumit, naikkan toleransi lalu rapikan sisa dengan kuas <b>Hapus</b>, dan kembalikan bagian yang keikut pakai <b>Kembalikan</b>.
      </div>
    </Shell>
  )
}

function Range({ label, value, min, max, step, onChange, fmt }) {
  return (
    <div className="field"><div className="slider">
      <div className="row"><span>{label}</span><span className="val">{fmt(value)}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </div></div>
  )
}
