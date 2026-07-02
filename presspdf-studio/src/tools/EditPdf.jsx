import { useEffect, useRef, useState } from 'react'
import { PDFDocument, StandardFonts, rgb, LineCapStyle } from 'pdf-lib'
import Dropzone from '../components/Dropzone'
import FileRow from '../components/FileRow'
import Icon from '../components/Icon'
import { useJob } from '../lib/useJob'
import { openPdf } from '../lib/pdfjs'
import { sanitizeWin } from '../lib/office'
import { downloadBlob, stripExt } from '../lib/utils'

const COLORS = ['#111318', '#D6336C', '#2F6BFF', '#12805C', '#C4741A']
const HL = '#FFD43B'

// All annotations are stored in PDF points with a top-down y axis, so the
// on-screen preview and the saved PDF are guaranteed to match exactly.
export default function EditPdf({ shell: Shell, tool, onBack }) {
  const [file, setFile] = useState(null)
  const [numPages, setNumPages] = useState(0)
  const [pageIdx, setPageIdx] = useState(0)
  const [mode, setMode] = useState('pen') // pen | hl | text | rect
  const [color, setColor] = useState(COLORS[1])
  const [stroke, setStroke] = useState(3)
  const [textVal, setTextVal] = useState('')
  const [textSize, setTextSize] = useState(16)
  const [rev, setRev] = useState(0) // bumps to trigger redraw / undo state

  const pdfRef = useRef(null)     // pdfjs document
  const baseRef = useRef(null)    // rendered page canvas
  const overRef = useRef(null)    // annotation overlay canvas
  const stageRef = useRef(null)
  const scaleRef = useRef(1)      // canvas px per PDF pt for current page
  const objsRef = useRef(new Map()) // pageIdx -> [{type,...} in pt-space]
  const draftRef = useRef(null)
  const job = useJob()

  const objs = () => objsRef.current.get(pageIdx) || []
  const setObjs = (list) => { objsRef.current.set(pageIdx, list); setRev((r) => r + 1) }

  const reset = () => {
    setFile(null); setNumPages(0); setPageIdx(0)
    pdfRef.current = null; objsRef.current = new Map(); draftRef.current = null
  }

  // open document
  useEffect(() => {
    if (!file) return
    let alive = true
    ;(async () => {
      try {
        const pdf = await openPdf(await file.arrayBuffer())
        if (!alive) return
        pdfRef.current = pdf
        objsRef.current = new Map()
        setPageIdx(0)
        setNumPages(pdf.numPages)
      } catch {
        if (alive) { job.run(async () => { throw new Error('PDF tidak bisa dibuka.') }); setFile(null) }
      }
    })()
    return () => { alive = false }
  }, [file])

  // render current page
  useEffect(() => {
    const pdf = pdfRef.current
    if (!pdf || !numPages) return
    let alive = true
    ;(async () => {
      const page = await pdf.getPage(pageIdx + 1)
      const vp1 = page.getViewport({ scale: 1 })
      const hostW = Math.min(920, (stageRef.current?.clientWidth || 920))
      const scale = Math.min(hostW / vp1.width, 2) * (window.devicePixelRatio > 1 ? 1.5 : 1)
      scaleRef.current = scale
      const vp = page.getViewport({ scale })
      const base = baseRef.current, over = overRef.current
      if (!base || !over || !alive) return
      base.width = over.width = Math.ceil(vp.width)
      base.height = over.height = Math.ceil(vp.height)
      const ctx = base.getContext('2d')
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, base.width, base.height)
      await page.render({ canvasContext: ctx, viewport: vp }).promise
      if (alive) redraw()
    })()
    return () => { alive = false }
  }, [pageIdx, numPages])

  useEffect(() => { redraw() }, [rev])

  function redraw() {
    const over = overRef.current
    if (!over) return
    const ctx = over.getContext('2d')
    ctx.clearRect(0, 0, over.width, over.height)
    const s = scaleRef.current
    for (const o of [...objs(), ...(draftRef.current ? [draftRef.current] : [])]) {
      ctx.globalAlpha = o.alpha ?? 1
      ctx.strokeStyle = o.color
      ctx.fillStyle = o.color
      if (o.type === 'pen') {
        ctx.lineWidth = o.width * s
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'
        ctx.beginPath()
        o.pts.forEach((p, i) => i ? ctx.lineTo(p.x * s, p.y * s) : ctx.moveTo(p.x * s, p.y * s))
        if (o.pts.length === 1) ctx.lineTo(o.pts[0].x * s + 0.01, o.pts[0].y * s)
        ctx.stroke()
      } else if (o.type === 'rect') {
        ctx.lineWidth = o.width * s
        ctx.strokeRect(o.x * s, o.y * s, o.w * s, o.h * s)
      } else if (o.type === 'text') {
        ctx.font = `600 ${o.size * s}px Helvetica, Arial, sans-serif`
        ctx.fillText(o.text, o.x * s, o.y * s)
      }
    }
    ctx.globalAlpha = 1
  }

  // pointer position in PDF points (top-down)
  const toPt = (e) => {
    const c = overRef.current
    const r = c.getBoundingClientRect()
    const s = scaleRef.current
    return {
      x: (e.clientX - r.left) * (c.width / r.width) / s,
      y: (e.clientY - r.top) * (c.height / r.height) / s,
    }
  }

  const onDown = (e) => {
    e.preventDefault()
    try { overRef.current.setPointerCapture(e.pointerId) } catch { /* synthetic events */ }
    const p = toPt(e)
    if (mode === 'text') {
      const text = textVal.trim()
      if (!text) return
      setObjs([...objs(), { type: 'text', x: p.x, y: p.y, text, size: textSize, color }])
      return
    }
    if (mode === 'rect') draftRef.current = { type: 'rect', x: p.x, y: p.y, w: 0, h: 0, color, width: stroke, _ax: p.x, _ay: p.y }
    else draftRef.current = {
      type: 'pen', pts: [p],
      color: mode === 'hl' ? HL : color,
      width: mode === 'hl' ? stroke * 5 : stroke,
      alpha: mode === 'hl' ? 0.4 : 1,
    }
    redraw()
  }
  const onMove = (e) => {
    const d = draftRef.current
    if (!d) return
    e.preventDefault()
    const p = toPt(e)
    if (d.type === 'pen') d.pts.push(p)
    else {
      d.x = Math.min(d._ax, p.x); d.y = Math.min(d._ay, p.y)
      d.w = Math.abs(p.x - d._ax); d.h = Math.abs(p.y - d._ay)
    }
    redraw()
  }
  const onUp = () => {
    const d = draftRef.current
    if (!d) return
    draftRef.current = null
    if (d.type === 'rect' && (d.w < 2 || d.h < 2)) { redraw(); return }
    delete d._ax; delete d._ay
    setObjs([...objs(), d])
  }

  const undo = () => setObjs(objs().slice(0, -1))
  const clearPage = () => setObjs([])
  const annotated = [...objsRef.current.values()].reduce((n, l) => n + l.length, 0)

  const save = () => job.run(async (progress) => {
    await progress('Menerapkan anotasi…', 30)
    const doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption: true })
    const font = await doc.embedFont(StandardFonts.HelveticaBold)
    const pages = doc.getPages()

    for (const [idx, list] of objsRef.current) {
      const page = pages[idx]
      if (!page || !list.length) continue
      const H = page.getHeight()
      for (const o of list) {
        const col = hexRgb(o.color)
        if (o.type === 'pen') {
          for (let i = 1; i < Math.max(o.pts.length, 2); i++) {
            const a = o.pts[i - 1], b = o.pts[Math.min(i, o.pts.length - 1)]
            page.drawLine({
              start: { x: a.x, y: H - a.y }, end: { x: b.x + (a === b ? 0.01 : 0), y: H - b.y },
              thickness: o.width, color: col, opacity: o.alpha ?? 1, lineCap: LineCapStyle.Round,
            })
          }
        } else if (o.type === 'rect') {
          page.drawRectangle({
            x: o.x, y: H - o.y - o.h, width: o.w, height: o.h,
            borderColor: col, borderWidth: o.width,
          })
        } else if (o.type === 'text') {
          page.drawText(sanitizeWin(o.text), { x: o.x, y: H - o.y, size: o.size, font, color: col })
        }
      }
    }

    await progress('Mengemas PDF…', 85)
    const blob = new Blob([await doc.save()], { type: 'application/pdf' })
    downloadBlob(blob, stripExt(file.name) + '-edit.pdf')
  })

  return (
    <Shell tool={tool} onBack={onBack} {...job}>
      {!file
        ? <Dropzone accept="pdf" multiple={false} label="Pilih PDF" hint="Coret, stabilo, teks, dan kotak langsung di halaman" onFiles={([f]) => setFile(f)} />
        : (
          <>
            <div className="file-list"><FileRow file={file} index={0} total={1} onRemove={reset} /></div>

            {numPages > 0 && (
              <>
                <div className="toolbar">
                  <div className="chiprow">
                    {[['pen', 'edit', 'Pena'], ['hl', 'watermark', 'Stabilo'], ['text', 'numbers', 'Teks'], ['rect', 'extract', 'Kotak']].map(([m, ic, l]) => (
                      <button key={m} className={'chiptoggle' + (mode === m ? ' active' : '')} onClick={() => setMode(m)}>
                        <Icon name={ic} size={14} /> {l}
                      </button>
                    ))}
                  </div>
                  <div className="grp" style={{ gap: 5 }}>
                    {COLORS.map((c) => (
                      <button key={c} onClick={() => setColor(c)} aria-label={c}
                        className={'swatch' + (color === c ? ' active' : '')} style={{ background: c }} />
                    ))}
                  </div>
                  {mode !== 'text' && (
                    <div className="grp" style={{ minWidth: 120 }}>
                      <span>Tebal</span>
                      <input type="range" min="1" max="10" step="1" value={stroke} onChange={(e) => setStroke(+e.target.value)} style={{ flex: 1 }} />
                    </div>
                  )}
                  {mode === 'text' && (
                    <>
                      <input className="text" style={{ flex: 1, minWidth: 130, maxWidth: 220, padding: '8px 12px' }}
                        value={textVal} onChange={(e) => setTextVal(e.target.value)} placeholder="Ketik, lalu klik halaman" />
                      <div className="grp" style={{ minWidth: 110 }}>
                        <input type="range" min="8" max="42" value={textSize} onChange={(e) => setTextSize(+e.target.value)} style={{ flex: 1 }} />
                        <span className="mono-s">{textSize}</span>
                      </div>
                    </>
                  )}
                  <div className="grp" style={{ marginLeft: 'auto' }}>
                    <button className="chiptoggle" disabled={!objs().length} onClick={undo}><Icon name="undo" size={14} /> Urungkan</button>
                    <button className="chiptoggle" disabled={!objs().length} onClick={clearPage}><Icon name="trash" size={14} /> Bersihkan</button>
                  </div>
                </div>

                <div className="stage" ref={stageRef} style={{ background: 'var(--bg-2)' }}>
                  <div style={{ position: 'relative', lineHeight: 0, maxWidth: '100%' }}>
                    <canvas ref={baseRef} style={{ maxWidth: '100%', height: 'auto', display: 'block', boxShadow: 'var(--shadow-2)' }} />
                    <canvas
                      ref={overRef}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' }}
                      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                    />
                  </div>
                </div>

                <div className="toolbar">
                  {numPages > 1 && (
                    <div className="grp">
                      <button className="chiptoggle" disabled={pageIdx === 0} onClick={() => setPageIdx((p) => p - 1)}><Icon name="back" size={14} /></button>
                      <span className="mono-s">{pageIdx + 1} / {numPages}</span>
                      <button className="chiptoggle" disabled={pageIdx >= numPages - 1} onClick={() => setPageIdx((p) => p + 1)}><Icon name="chevron" size={14} /></button>
                    </div>
                  )}
                  <button className="cta" style={{ marginLeft: 'auto' }} disabled={job.busy || !annotated} onClick={save}>
                    <Icon name="download" size={17} /> Simpan PDF
                  </button>
                </div>
              </>
            )}
          </>
        )}
    </Shell>
  )
}

function hexRgb(hex) {
  return rgb(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  )
}
