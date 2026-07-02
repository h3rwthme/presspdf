import { useState } from 'react'
import { PDFDocument, degrees } from 'pdf-lib'
import Dropzone from '../components/Dropzone'
import FileRow from '../components/FileRow'
import Icon from '../components/Icon'
import { downloadBlob, parseRanges, stripExt } from '../lib/utils'
import { usePdfFile } from '../lib/pdf'
import { useJob } from '../lib/useJob'

const ANGLES = [[90, 'Kanan 90°'], [180, 'Balik 180°'], [270, 'Kiri 90°']]

export default function Rotate({ shell: Shell, tool, onBack }) {
  const [file, count, setFile] = usePdfFile()
  const [angle, setAngle] = useState(90)
  const [range, setRange] = useState('')
  const job = useJob()

  const go = () => job.run(async (progress) => {
    const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
    const pages = doc.getPages()
    const targets = new Set(parseRanges(range, pages.length))
    pages.forEach((p, i) => {
      if (targets.has(i + 1)) p.setRotation(degrees(((p.getRotation().angle + angle) % 360 + 360) % 360))
    })
    await progress('Menyimpan…', 100)
    downloadBlob(new Blob([await doc.save()], { type: 'application/pdf' }), stripExt(file.name) + '-putar.pdf')
  })

  return (
    <Shell tool={tool} onBack={onBack} {...job}>
      {!file
        ? <Dropzone multiple={false} label="Pilih PDF yang mau diputar" onFiles={([f]) => setFile(f)} />
        : (
          <>
            <div className="file-list"><FileRow file={file} index={0} total={1} onRemove={() => setFile(null)} /></div>
            <div className="options">
              <div className="field">
                <label>Arah putaran</label>
                <div className="seg">
                  {ANGLES.map(([a, l]) => (
                    <label key={a} className={'opt-card' + (angle === a ? ' active' : '')}>
                      <input type="radio" hidden checked={angle === a} onChange={() => setAngle(a)} />
                      {l}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Halaman {count > 0 && <span className="mono-s">(1–{count})</span>}</label>
                <input className="text mono" placeholder="kosongkan = semua halaman, mis. 2-4" value={range} onChange={(e) => setRange(e.target.value)} />
              </div>
              <button className="cta" disabled={job.busy} onClick={go}><Icon name="rotate" size={18} /> Putar PDF</button>
            </div>
          </>
        )}
    </Shell>
  )
}
