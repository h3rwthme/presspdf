import { useState } from 'react'
import Dropzone from '../components/Dropzone'
import FileRow from '../components/FileRow'
import Icon from '../components/Icon'
import { useJob } from '../lib/useJob'
import { openPdf, renderPage, canvasToJpeg } from '../lib/pdfjs'
import { buildPptx } from '../lib/office'
import { downloadBlob, fmtSize, stripExt } from '../lib/utils'

const MAX_DIM = 1920

export default function PdfToPpt({ shell: Shell, tool, onBack }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const job = useJob()

  const reset = () => { setFile(null); setResult(null) }

  const convert = () => job.run(async (progress) => {
    setResult(null)
    const pdf = await openPdf(await file.arrayBuffer())
    const slides = []

    for (let i = 1; i <= pdf.numPages; i++) {
      await progress(`Merender halaman ${i}/${pdf.numPages}…`, (i / pdf.numPages) * 85)
      const page = await pdf.getPage(i)
      const vp = page.getViewport({ scale: 1 })
      const scale = Math.min(2, MAX_DIM / Math.max(vp.width, vp.height))
      const canvas = await renderPage(page, scale)
      const jpeg = await canvasToJpeg(canvas, 0.88)
      slides.push({ bytes: new Uint8Array(await jpeg.arrayBuffer()), w: canvas.width, h: canvas.height })
      page.cleanup()
      canvas.width = canvas.height = 0
    }

    await progress('Menyusun file PowerPoint…', 95)
    const blob = await buildPptx(slides)
    setResult({ blob, name: stripExt(file.name) + '.pptx', n: slides.length })
  })

  return (
    <Shell tool={tool} onBack={onBack} {...job}>
      {!file
        ? <Dropzone accept="pdf" multiple={false} label="Pilih PDF" hint="Tiap halaman jadi satu slide .pptx" onFiles={([f]) => setFile(f)} />
        : (
          <>
            <div className="file-list"><FileRow file={file} index={0} total={1} onRemove={reset} /></div>
            <div className="options">
              <button className="cta" disabled={job.busy} onClick={convert}>
                <Icon name="ppt" size={18} /> Konversi ke PowerPoint
              </button>
            </div>
            {result && (
              <div className="results">
                <div className="result-row">
                  <span className="f-icon"><Icon name="ppt" size={20} /></span>
                  <span className="file-name">{result.name}<br /><span className="mono-s">{result.n} slide</span></span>
                  <span className="mono-s">{fmtSize(result.blob.size)}</span>
                  <button className="mini" onClick={() => downloadBlob(result.blob, result.name)}>
                    <Icon name="download" size={15} /> Unduh PPTX
                  </button>
                </div>
              </div>
            )}
          </>
        )}
    </Shell>
  )
}
