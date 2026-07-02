import { useState } from 'react'
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import Dropzone from '../components/Dropzone'
import FileRow from '../components/FileRow'
import Icon from '../components/Icon'
import { downloadBlob, stripExt } from '../lib/utils'
import { usePdfFile } from '../lib/pdf'
import { useJob } from '../lib/useJob'

const COLORS = { grey: [0.4, 0.4, 0.45], red: [0.8, 0.16, 0.24], blue: [0.15, 0.32, 0.75] }

export default function Watermark({ shell: Shell, tool, onBack }) {
  const [file, count, setFile] = usePdfFile()
  const [text, setText] = useState('RAHASIA')
  const [opacity, setOpacity] = useState(0.22)
  const [color, setColor] = useState('grey')
  const [layout, setLayout] = useState('diagonal') // diagonal | tile
  const job = useJob()

  const go = () => job.run(async (progress) => {
    const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
    const font = await doc.embedFont(StandardFonts.HelveticaBold)
    const [r, g, b] = COLORS[color]
    const pages = doc.getPages()
    pages.forEach((page, idx) => {
      const { width, height } = page.getSize()
      if (layout === 'diagonal') {
        const size = Math.min(96, (width * 1.15) / Math.max(text.length, 4))
        page.drawText(text, {
          x: width * 0.12, y: height * 0.30, size, font,
          rotate: degrees(38), color: rgb(r, g, b), opacity: Number(opacity),
        })
      } else {
        const size = 22
        const stepX = size * text.length * 0.75 + 60
        const stepY = 90
        for (let y = 20; y < height; y += stepY) {
          for (let x = -20; x < width; x += stepX) {
            page.drawText(text, { x, y, size, font, rotate: degrees(30), color: rgb(r, g, b), opacity: Number(opacity) })
          }
        }
      }
      if (idx % 5 === 0) progress(`Menandai halaman ${idx + 1}/${pages.length}…`, Math.round((idx / pages.length) * 100))
    })
    await progress('Menyimpan…', 100)
    downloadBlob(new Blob([await doc.save()], { type: 'application/pdf' }), stripExt(file.name) + '-watermark.pdf')
  })

  return (
    <Shell tool={tool} onBack={onBack} {...job}>
      {!file
        ? <Dropzone multiple={false} label="Pilih PDF" onFiles={([f]) => setFile(f)} />
        : (
          <>
            <div className="file-list"><FileRow file={file} index={0} total={1} onRemove={() => setFile(null)} /></div>
            <div className="options">
              <div className="field">
                <label>Teks tanda air</label>
                <input className="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="mis. RAHASIA, DRAF, COPY" />
              </div>
              <div className="field">
                <label>Pola</label>
                <div className="seg">
                  {[['diagonal', 'Diagonal', 'satu per halaman'], ['tile', 'Ubin penuh', 'berulang menutup']].map(([k, l, s]) => (
                    <label key={k} className={'opt-card' + (layout === k ? ' active' : '')}>
                      <input type="radio" hidden checked={layout === k} onChange={() => setLayout(k)} />
                      {l}<small>{s}</small>
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Warna</label>
                <div className="seg">
                  {Object.keys(COLORS).map((k) => (
                    <label key={k} className={'opt-card' + (color === k ? ' active' : '')} style={{ minWidth: 78, textTransform: 'capitalize' }}>
                      <input type="radio" hidden checked={color === k} onChange={() => setColor(k)} />
                      {k === 'grey' ? 'Abu' : k === 'red' ? 'Merah' : 'Biru'}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field"><div className="slider">
                <div className="row"><span>Transparansi</span><span className="val">{Math.round(opacity * 100)}%</span></div>
                <input type="range" min="0.06" max="0.6" step="0.02" value={opacity} onChange={(e) => setOpacity(+e.target.value)} />
              </div></div>
              <button className="cta" disabled={job.busy || !text.trim()} onClick={go}><Icon name="watermark" size={18} /> Tambahkan Tanda Air</button>
            </div>
          </>
        )}
    </Shell>
  )
}
