import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'
import Dropzone from '../components/Dropzone'
import FileRow from '../components/FileRow'
import Icon from '../components/Icon'
import { downloadBlob, parseRanges, stripExt } from '../lib/utils'
import { usePdfFile } from '../lib/pdf'
import { useJob } from '../lib/useJob'

export default function Split({ shell: Shell, tool, onBack }) {
  const [file, count, setFile] = usePdfFile()
  const [mode, setMode] = useState('range')
  const [range, setRange] = useState('')
  const job = useJob()

  const go = () => job.run(async (progress) => {
    const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
    const total = src.getPageCount()
    const base = stripExt(file.name)

    if (mode === 'range') {
      const pages = parseRanges(range, total)
      const out = await PDFDocument.create()
      const copied = await out.copyPages(src, pages.map((p) => p - 1))
      copied.forEach((p) => out.addPage(p))
      await progress(`Menyimpan ${pages.length} halaman…`, 100)
      downloadBlob(new Blob([await out.save()], { type: 'application/pdf' }), `${base}-hal-${range || 'semua'}.pdf`)
    } else {
      const zip = new JSZip()
      for (let i = 0; i < total; i++) {
        await progress(`Memisahkan halaman ${i + 1}/${total}…`, Math.round((i / total) * 100))
        const out = await PDFDocument.create()
        const [p] = await out.copyPages(src, [i])
        out.addPage(p)
        zip.file(`${base}-hal-${String(i + 1).padStart(3, '0')}.pdf`, await out.save())
      }
      await progress('Mengemas ZIP…', 100)
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `${base}-terpisah.zip`)
    }
  })

  return (
    <Shell tool={tool} onBack={onBack} {...job}>
      {!file
        ? <Dropzone multiple={false} label="Pilih PDF yang mau dipisah" onFiles={([f]) => setFile(f)} />
        : (
          <>
            <div className="file-list"><FileRow file={file} index={0} total={1} onRemove={() => setFile(null)} /></div>
            {count > 0 && <div className="note"><Icon name="file" size={16} /> Dokumen ini punya <b>{count}</b> halaman.</div>}
            <div className="options">
              <label className="opt-radio">
                <input type="radio" checked={mode === 'range'} onChange={() => setMode('range')} />
                <span><b>Ambil rentang halaman</b> jadi satu PDF baru</span>
              </label>
              {mode === 'range' && (
                <input className="text mono" placeholder="contoh: 1-3, 5, 8" value={range} onChange={(e) => setRange(e.target.value)} />
              )}
              <label className="opt-radio">
                <input type="radio" checked={mode === 'each'} onChange={() => setMode('each')} />
                <span><b>Pisahkan tiap halaman</b> jadi file terpisah (hasil: ZIP)</span>
              </label>
              <button className="cta" disabled={job.busy || (mode === 'range' && !range.trim())} onClick={go}>
                <Icon name="split" size={18} /> Pisahkan PDF
              </button>
            </div>
          </>
        )}
    </Shell>
  )
}
