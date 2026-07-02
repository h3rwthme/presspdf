import { useState } from 'react'
import JSZip from 'jszip'
import Dropzone from '../components/Dropzone'
import FileRow from '../components/FileRow'
import Icon from '../components/Icon'
import { openPdf, renderPage, canvasToJpeg } from '../lib/pdfjs'
import { downloadBlob, stripExt } from '../lib/utils'
import { useJob } from '../lib/useJob'

const OPTS = {
  normal: { scale: 1.5, q: 0.85, label: 'Normal', sub: '~110 dpi' },
  tinggi: { scale: 2.5, q: 0.92, label: 'Tinggi', sub: '~180 dpi' },
  ultra:  { scale: 3.5, q: 0.95, label: 'Ultra', sub: '~250 dpi' },
}

export default function PdfToJpg({ shell: Shell, tool, onBack }) {
  const [file, setFile] = useState(null)
  const [quality, setQuality] = useState('tinggi')
  const job = useJob()

  const go = () => job.run(async (progress) => {
    const { scale, q } = OPTS[quality]
    const pdf = await openPdf(await file.arrayBuffer())
    const base = stripExt(file.name)
    if (pdf.numPages === 1) {
      const page = await pdf.getPage(1)
      await progress('Merender halaman…', 60)
      downloadBlob(await canvasToJpeg(await renderPage(page, scale), q), `${base}.jpg`)
      return
    }
    const zip = new JSZip()
    for (let i = 1; i <= pdf.numPages; i++) {
      await progress(`Merender halaman ${i}/${pdf.numPages}…`, Math.round((i / pdf.numPages) * 100))
      const page = await pdf.getPage(i)
      const canvas = await renderPage(page, scale)
      zip.file(`${base}-hal-${String(i).padStart(3, '0')}.jpg`, await (await canvasToJpeg(canvas, q)).arrayBuffer())
      page.cleanup(); canvas.width = canvas.height = 0
    }
    await progress('Mengemas ZIP…', 100)
    downloadBlob(await zip.generateAsync({ type: 'blob' }), `${base}-jpg.zip`)
  })

  return (
    <Shell tool={tool} onBack={onBack} {...job}>
      {!file
        ? <Dropzone multiple={false} label="Pilih PDF untuk dijadikan JPG" onFiles={([f]) => setFile(f)} />
        : (
          <>
            <div className="file-list"><FileRow file={file} index={0} total={1} onRemove={() => setFile(null)} /></div>
            <div className="options">
              <div className="field">
                <label>Resolusi</label>
                <div className="seg">
                  {Object.entries(OPTS).map(([k, v]) => (
                    <label key={k} className={'opt-card' + (quality === k ? ' active' : '')}>
                      <input type="radio" hidden checked={quality === k} onChange={() => setQuality(k)} />
                      {v.label}<small>{v.sub}</small>
                    </label>
                  ))}
                </div>
              </div>
              <button className="cta" disabled={job.busy} onClick={go}><Icon name="image" size={18} /> Konversi ke JPG</button>
            </div>
            <div className="note"><Icon name="info" size={16} /> PDF multi-halaman otomatis diunduh sebagai satu file ZIP berisi tiap halaman.</div>
          </>
        )}
    </Shell>
  )
}
