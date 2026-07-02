import { useEffect, useRef, useState } from 'react'
import Dropzone from '../components/Dropzone'
import FileRow from '../components/FileRow'
import Icon from '../components/Icon'
import { useJob } from '../lib/useJob'
import { loadImage, toCanvas, newCanvas, removeBackground, floodErase, canvasToBlob, flatten } from '../lib/image'
import { downloadBlob, stripExt } from '../lib/utils'

const WORK_MAX = 1600
const MAX_UNDO = 10

export default function RemoveBg({ shell: Shell, tool, onBack }) {
  const [file, setFile] = useState(null)
  const [tol, setTol] = useState(0.16)
  const [brush, setBrush] = useState(26)
  const [mode, setMode] = useState('wand') // wand | erase | restore
  const [bg, setBg] = useState('transparent')
  const [ready, setReady] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const dispRef = useRef(null)
  const srcRef = useRef(null)
  const drawing = useRef(false)
  const undoRef = useRef([])
  const job = useJob()

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
      undoRef.current = []
      setCanUndo(false)
      setReady(true)
    })()
    return () => { alive = false }
  }, [file])

  const reset = () => { setFile(null); setReady(false); srcRef.current = null; undoRef.current = [] }

  const snapshot = () => {
    const c = dispRef.current
    undoRef.current.push(c.getContext('2d').getImageData(0, 0, c.width, c.height))
    if (undoRef.current.length > MAX_UNDO) undoRef.current.shift()
    setCanUndo(true)
  }
  const undo = () => {
    const im = undoRef.current.pop()
    if (!im) return
    dispRef.current.getContext('2d').putImageData(im, 0, 0)
    setCanUndo(undoRef.current.length > 0)
  }

  const autoRemove = () => job.run(async (progress) => {
    snapshot()
    await progress('Menganalisis latar…', 35)
    const work = newCanvas(srcRef.current.width, srcRef.current.height)
    work.getContext('2d').drawImage(dispRef.current, 0, 0)
    removeBackground(work, { tolerance: tol, feather: 2 })
    await progress('Menghaluskan tepi…', 80)
    const disp = dispRef.current
    const ctx = disp.getContext('2d')
    ctx.clearRect(0, 0, disp.width, disp.height)
    ctx.drawImage(work, 0, 0)
    await progress('Latar dihapus. Klik area yang tersisa untuk merapikan.', 100)
  })

  const pos = (e) => {
    const c = dispRef.current
    const r = c.getBoundingClientRect()
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }
  }
  const paintBrush = (e) => {
    const c = dispRef.current
    const ctx = c.getContext('2d')
    const { x, y } = pos(e)
    const r = brush * (c.width / c.getBoundingClientRect().width)
    ctx.save()
    if (mode === 'erase') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    } else {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip()
      ctx.drawImage(srcRef.current, 0, 0)
    }
    ctx.restore()
  }
  const onDown = (e) => {
    e.preventDefault()
    try { dispRef.current.setPointerCapture(e.pointerId) } catch { /* synthetic events */ }
    snapshot()
    if (mode === 'wand') {
      const { x, y } = pos(e)
      floodErase(dispRef.current, x, y, tol)
      return
    }
    drawing.current = true
    paintBrush(e)
  }
  const onMove = (e) => { if (drawing.current) { e.preventDefault(); paintBrush(e) } }
  const onUp = () => { drawing.current = false }

  const save = async () => {
    let out = dispRef.current
    if (bg !== 'transparent') out = flatten(out, bg)
    downloadBlob(await canvasToBlob(out, 'image/png'), stripExt(file.name) + '-tanpa-latar.png')
  }

  return (
    <Shell tool={tool} onBack={onBack} {...job}>
      {!file
        ? <Dropzone accept="image" multiple={false} label="Pilih foto" hint="Klik area latar untuk menghapusnya" onFiles={([f]) => setFile(f)} />
        : (
          <>
            <div className="file-list"><FileRow file={file} index={0} total={1} preview onRemove={reset} /></div>

            <div className="toolbar">
              <button className="mini" disabled={job.busy || !ready} onClick={autoRemove}>
                <Icon name="enhance" size={15} /> Otomatis
              </button>
              <div className="chiprow">
                <button className={'chiptoggle' + (mode === 'wand' ? ' active' : '')} onClick={() => setMode('wand')}>
                  <Icon name="wand" size={14} /> Klik area
                </button>
                <button className={'chiptoggle' + (mode === 'erase' ? ' active' : '')} onClick={() => setMode('erase')}>
                  <Icon name="remove-bg" size={14} /> Kuas
                </button>
                <button className={'chiptoggle' + (mode === 'restore' ? ' active' : '')} onClick={() => setMode('restore')}>
                  <Icon name="undo" size={14} /> Kembalikan
                </button>
              </div>
              <div className="grp" style={{ flex: 1, minWidth: 140 }}>
                <span>{mode === 'wand' ? 'Sensitivitas' : 'Ukuran'}</span>
                {mode === 'wand'
                  ? <input type="range" min="0.05" max="0.4" step="0.01" value={tol} onChange={(e) => setTol(+e.target.value)} style={{ flex: 1 }} />
                  : <input type="range" min="8" max="80" step="2" value={brush} onChange={(e) => setBrush(+e.target.value)} style={{ flex: 1 }} />}
              </div>
              <button className="chiptoggle" disabled={!canUndo} onClick={undo}>
                <Icon name="undo" size={14} /> Urungkan
              </button>
            </div>

            <div className="stage">
              <canvas
                ref={dispRef}
                style={{ cursor: 'crosshair', touchAction: 'none' }}
                onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              />
            </div>

            <div className="toolbar">
              <div className="grp"><Icon name="image" size={16} /> Latar</div>
              <div className="chiprow">
                <button className={'chiptoggle' + (bg === 'transparent' ? ' active' : '')} onClick={() => setBg('transparent')}>Transparan</button>
                {['#FFFFFF', '#111318', '#2F6BFF'].map((c) => (
                  <button key={c} onClick={() => setBg(c)} aria-label={c}
                    className={'swatch' + (bg === c ? ' active' : '')} style={{ background: c }} />
                ))}
              </div>
              <button className="mini" style={{ marginLeft: 'auto' }} disabled={!ready} onClick={save}>
                <Icon name="download" size={15} /> Unduh PNG
              </button>
            </div>
          </>
        )}
    </Shell>
  )
}
