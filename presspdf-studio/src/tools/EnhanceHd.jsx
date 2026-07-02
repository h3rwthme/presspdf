import { useRef, useState } from 'react'
import Dropzone from '../components/Dropzone'
import FileRow from '../components/FileRow'
import Icon from '../components/Icon'
import { useJob } from '../lib/useJob'
import { loadImage, toCanvas, resizeCanvas, adjust, sharpen, denoise, autoLevels, canvasToBlob } from '../lib/image'
import { downloadBlob, stripExt } from '../lib/utils'

const MAX_OUT = 4200

export default function EnhanceHd({ shell: Shell, tool, onBack }) {
  const [file, setFile] = useState(null)
  const [scale, setScale] = useState(2)
  const [sharpAmt, setSharpAmt] = useState(0.8)
  const [denoiseAmt, setDenoiseAmt] = useState(0.15)
  const [autoFix, setAutoFix] = useState(true)
  const [done, setDone] = useState(null) // { blob, url, w, h, beforeUrl }
  const [split, setSplit] = useState(50)
  const stageRef = useRef(null)
  const draggingRef = useRef(false)
  const job = useJob()

  const reset = () => { setFile(null); setDone(null) }

  const process = () => job.run(async (progress) => {
    setDone(null)
    await progress('Membaca foto…', 8)
    const img = await loadImage(file)
    const base = toCanvas(img)
    let tw = base.width * scale, th = base.height * scale
    if (Math.max(tw, th) > MAX_OUT) { const k = MAX_OUT / Math.max(tw, th); tw *= k; th *= k }

    await progress(`Memperbesar ke ${Math.round(tw)}×${Math.round(th)}…`, 30)
    const canvas = resizeCanvas(base, Math.round(tw), Math.round(th))
    if (denoiseAmt > 0) { await progress('Meredam noise…', 50); denoise(canvas, denoiseAmt) }
    if (autoFix) {
      await progress('Menyeimbangkan cahaya & warna…', 65)
      autoLevels(canvas, 0.005, 0.9)
      adjust(canvas, { saturation: 1.12, contrast: 1.05 })
    }
    if (sharpAmt > 0) { await progress('Mempertajam detail…', 85); sharpen(canvas, sharpAmt) }

    await progress('Menyusun hasil…', 95)
    const blob = await canvasToBlob(canvas, 'image/png')
    setDone({
      blob,
      url: URL.createObjectURL(blob),
      beforeUrl: URL.createObjectURL(file),
      w: canvas.width, h: canvas.height,
    })
    setSplit(50)
  })

  // draggable before/after divider
  const dragTo = (clientX) => {
    const r = stageRef.current.getBoundingClientRect()
    setSplit(Math.max(2, Math.min(98, ((clientX - r.left) / r.width) * 100)))
  }
  const onDown = (e) => { draggingRef.current = true; dragTo(e.clientX) }
  const onMove = (e) => { if (draggingRef.current) { e.preventDefault(); dragTo(e.clientX) } }
  const onUp = () => { draggingRef.current = false }

  return (
    <Shell tool={tool} onBack={onBack} {...job}>
      {!file
        ? <Dropzone accept="image" multiple={false} label="Pilih foto" hint="Diperbesar, dipertajam, dan diperbaiki otomatis" onFiles={([f]) => { reset(); setFile(f) }} />
        : (
          <>
            <div className="file-list"><FileRow file={file} index={0} total={1} preview onRemove={reset} /></div>

            <div className="options">
              <div className="field">
                <label>Perbesaran</label>
                <div className="seg">
                  {[[1, '1×'], [2, '2×'], [4, '4×']].map(([v, l]) => (
                    <label key={v} className={'opt-card' + (scale === v ? ' active' : '')} style={{ minWidth: 72 }}>
                      <input type="radio" hidden checked={scale === v} onChange={() => setScale(v)} />{l}
                    </label>
                  ))}
                  <label className={'opt-card' + (autoFix ? ' active' : '')} style={{ minWidth: 120 }}>
                    <input type="checkbox" hidden checked={autoFix} onChange={() => setAutoFix(!autoFix)} />
                    Perbaiki otomatis<small>cahaya &amp; warna</small>
                  </label>
                </div>
              </div>
              <Range label="Ketajaman" value={sharpAmt} min={0} max={1.4} step={0.05} onChange={setSharpAmt} fmt={(v) => Math.round(v * 100) + '%'} />
              <Range label="Redam noise" value={denoiseAmt} min={0} max={0.6} step={0.05} onChange={setDenoiseAmt} fmt={(v) => Math.round(v * 100) + '%'} />
              <button className="cta" disabled={job.busy} onClick={process}><Icon name="enhance" size={18} /> Perjelas Foto</button>
            </div>

            {done && (
              <>
                <div
                  className="stage compare-stage" ref={stageRef}
                  onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                >
                  <img src={done.url} alt="Hasil" style={{ maxWidth: '100%', height: 'auto', display: 'block' }} />
                  <img
                    src={done.beforeUrl} alt="Asli"
                    style={{
                      position: 'absolute', inset: 0, width: '100%', height: '100%',
                      objectFit: 'fill', clipPath: `inset(0 ${100 - split}% 0 0)`,
                    }}
                  />
                  <div className="divider" style={{ left: `${split}%` }}>
                    <span className="knob"><Icon name="split" size={13} /></span>
                  </div>
                  <span className="cmp-label" style={{ left: 10 }}>Asli</span>
                  <span className="cmp-label" style={{ right: 10 }}>Hasil</span>
                </div>

                <div className="toolbar">
                  <div className="grp"><Icon name="image" size={16} /> {done.w}×{done.h}px</div>
                  <button className="mini" style={{ marginLeft: 'auto' }} onClick={() => downloadBlob(done.blob, stripExt(file.name) + `-hd.png`)}>
                    <Icon name="download" size={15} /> Unduh PNG
                  </button>
                </div>
              </>
            )}
          </>
        )}
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
