import { useRef, useState } from 'react'
import Dropzone from '../components/Dropzone'
import FileRow from '../components/FileRow'
import Icon from '../components/Icon'
import { useJob } from '../lib/useJob'
import { loadImage, toCanvas, resizeCanvas, adjust, sharpen, denoise, canvasToBlob } from '../lib/image'
import { downloadBlob, stripExt } from '../lib/utils'

const MAX_OUT = 4200 // guard against runaway upscales

export default function EnhanceHd({ shell: Shell, tool, onBack }) {
  const [file, setFile] = useState(null)
  const [scale, setScale] = useState(2)
  const [sharpAmt, setSharpAmt] = useState(0.55)
  const [denoiseAmt, setDenoiseAmt] = useState(0.2)
  const [sat, setSat] = useState(1.08)
  const [done, setDone] = useState(null) // { blob, url, w, h }
  const [showBefore, setShowBefore] = useState(false)
  const stageRef = useRef(null)
  const job = useJob()

  const reset = () => { setFile(null); setDone(null) }

  const process = () => job.run(async (progress) => {
    setDone(null)
    await progress('Membaca foto…', 8)
    const img = await loadImage(file)
    let base = toCanvas(img)
    let tw = base.width * scale, th = base.height * scale
    if (Math.max(tw, th) > MAX_OUT) { const k = MAX_OUT / Math.max(tw, th); tw *= k; th *= k }

    await progress(`Memperbesar ke ${Math.round(tw)}×${Math.round(th)}…`, 35)
    let canvas = resizeCanvas(base, tw, th)
    if (denoiseAmt > 0) { await progress('Meredam noise…', 55); denoise(canvas, denoiseAmt) }
    if (sat !== 1) { await progress('Menyeimbangkan warna…', 70); adjust(canvas, { saturation: sat, contrast: 1.04 }) }
    if (sharpAmt > 0) { await progress('Mempertajam detail…', 85); sharpen(canvas, sharpAmt) }

    await progress('Menyusun hasil…', 95)
    const blob = await canvasToBlob(canvas, 'image/png')
    const url = URL.createObjectURL(blob)
    // paint into the visible stage
    const host = stageRef.current
    if (host) { host.innerHTML = ''; canvas.style.maxWidth = '100%'; canvas.style.height = 'auto'; host.appendChild(canvas) }
    setDone({ blob, url, w: canvas.width, h: canvas.height })
    setShowBefore(false)
    await progress('Foto siap dalam kualitas HD.', 100)
  })

  return (
    <Shell tool={tool} onBack={onBack} {...job}>
      {!file
        ? <Dropzone accept="image" multiple={false} label="Pilih foto untuk diperjelas" hint="JPG · PNG · WebP — satu foto" onFiles={([f]) => { reset(); setFile(f) }} />
        : (
          <>
            <div className="file-list"><FileRow file={file} index={0} total={1} preview onRemove={reset} /></div>

            <div className="options">
              <div className="field">
                <label>Perbesaran</label>
                <div className="seg">
                  {[[1, '1×', 'perbaiki saja'], [2, '2×', 'seimbang'], [4, '4×', 'maksimal']].map(([v, l, s]) => (
                    <label key={v} className={'opt-card' + (scale === v ? ' active' : '')}>
                      <input type="radio" hidden checked={scale === v} onChange={() => setScale(v)} />
                      {l}<small>{s}</small>
                    </label>
                  ))}
                </div>
              </div>
              <Range label="Ketajaman" value={sharpAmt} min={0} max={1.4} step={0.05} onChange={setSharpAmt} fmt={(v) => Math.round(v * 100) + '%'} />
              <Range label="Redam noise" value={denoiseAmt} min={0} max={0.7} step={0.05} onChange={setDenoiseAmt} fmt={(v) => Math.round(v * 100) + '%'} />
              <Range label="Kepekatan warna" value={sat} min={0.7} max={1.5} step={0.02} onChange={setSat} fmt={(v) => Math.round(v * 100) + '%'} />
              <button className="cta" disabled={job.busy} onClick={process}><Icon name="enhance" size={18} /> Perjelas Sekarang</button>
            </div>

            <div className="stage" style={{ display: done || job.busy ? 'grid' : 'none' }} ref={stageRef} />

            {done && (
              <>
                <div className="toolbar">
                  <div className="grp"><Icon name="image" size={16} /> Hasil {done.w}×{done.h}px (PNG)</div>
                  <button
                    className={'chiptoggle' + (showBefore ? ' active' : '')}
                    onMouseDown={() => toggleBefore(stageRef, file, setShowBefore, true)}
                    onMouseUp={() => toggleBefore(stageRef, file, setShowBefore, false, done)}
                    onMouseLeave={() => showBefore && toggleBefore(stageRef, file, setShowBefore, false, done)}
                    onTouchStart={() => toggleBefore(stageRef, file, setShowBefore, true)}
                    onTouchEnd={() => toggleBefore(stageRef, file, setShowBefore, false, done)}
                  >Tahan: lihat asli</button>
                  <button className="mini" style={{ marginLeft: 'auto' }} onClick={() => downloadBlob(done.blob, stripExt(file.name) + `-hd-${scale}x.png`)}>
                    <Icon name="download" size={15} /> Unduh PNG
                  </button>
                </div>
              </>
            )}
          </>
        )}

      <div className="note"><Icon name="info" size={16} />
        Peningkatan berbasis penskalaan bertingkat + unsharp mask (tanpa server/AI berat), jadi cepat dan privat. Untuk foto sangat kecil, 2× memberi hasil paling natural.
      </div>
    </Shell>
  )
}

// press-and-hold "before" peek: swap the stage canvas for the original image
async function toggleBefore(ref, file, setShow, on, done) {
  const host = ref.current
  if (!host) return
  if (on) {
    setShow(true)
    const img = await loadImage(file)
    host.innerHTML = ''
    img.style.maxWidth = '100%'; img.style.height = 'auto'
    host.appendChild(img)
  } else if (done) {
    setShow(false)
    host.innerHTML = ''
    const im = new Image()
    im.src = done.url; im.style.maxWidth = '100%'; im.style.height = 'auto'
    host.appendChild(im)
  }
}

function Range({ label, value, min, max, step, onChange, fmt }) {
  return (
    <div className="field"><div className="slider">
      <div className="row"><span>{label}</span><span className="val">{fmt(value)}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </div></div>
  )
}
