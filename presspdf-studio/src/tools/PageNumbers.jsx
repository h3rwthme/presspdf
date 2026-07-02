import { useState } from 'react'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import Dropzone from '../components/Dropzone'
import FileRow from '../components/FileRow'
import Icon from '../components/Icon'
import { downloadBlob, stripExt } from '../lib/utils'
import { usePdfFile } from '../lib/pdf'
import { useJob } from '../lib/useJob'

const POSITIONS = {
  bc: 'Bawah tengah', br: 'Bawah kanan', bl: 'Bawah kiri',
  tc: 'Atas tengah', tr: 'Atas kanan', tl: 'Atas kiri',
}

export default function PageNumbers({ shell: Shell, tool, onBack }) {
  const [file, count, setFile] = usePdfFile()
  const [fmt, setFmt] = useState('plain')
  const [pos, setPos] = useState('bc')
  const [start, setStart] = useState(1)
  const job = useJob()

  const go = () => job.run(async (progress) => {
    const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const pages = doc.getPages()
    const size = 11, margin = 26
    pages.forEach((page, i) => {
      const n = i + Number(start)
      const label = fmt === 'plain' ? String(n) : `${n} / ${pages.length + Number(start) - 1}`
      const w = font.widthOfTextAtSize(label, size)
      const pw = page.getWidth(), ph = page.getHeight()
      const x = pos.endsWith('c') ? pw / 2 - w / 2 : pos.endsWith('r') ? pw - margin - w : margin
      const y = pos.startsWith('b') ? margin : ph - margin - size
      page.drawText(label, { x, y, size, font, color: rgb(0.25, 0.25, 0.3) })
    })
    await progress('Menyimpan…', 100)
    downloadBlob(new Blob([await doc.save()], { type: 'application/pdf' }), stripExt(file.name) + '-nomor.pdf')
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
                <label>Format</label>
                <div className="seg">
                  {[['plain', '1, 2, 3'], ['of', '1 / 12']].map(([k, l]) => (
                    <label key={k} className={'opt-card' + (fmt === k ? ' active' : '')}>
                      <input type="radio" hidden checked={fmt === k} onChange={() => setFmt(k)} />{l}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Posisi</label>
                <div className="seg">
                  {Object.entries(POSITIONS).map(([k, l]) => (
                    <label key={k} className={'opt-card' + (pos === k ? ' active' : '')} style={{ minWidth: 92 }}>
                      <input type="radio" hidden checked={pos === k} onChange={() => setPos(k)} />{l}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Mulai dari nomor</label>
                <input className="text mono" type="number" min="0" value={start} onChange={(e) => setStart(e.target.value)} style={{ maxWidth: 140 }} />
              </div>
              <button className="cta" disabled={job.busy} onClick={go}><Icon name="numbers" size={18} /> Tambahkan Nomor Halaman</button>
            </div>
          </>
        )}
    </Shell>
  )
}
