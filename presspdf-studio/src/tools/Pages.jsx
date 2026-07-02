import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import Dropzone from '../components/Dropzone'
import FileRow from '../components/FileRow'
import Icon from '../components/Icon'
import { downloadBlob, parseRanges, stripExt } from '../lib/utils'
import { usePdfFile } from '../lib/pdf'
import { useJob } from '../lib/useJob'

// One component, two tools: mode 'delete' (drop pages) & 'extract' (keep pages).
export default function Pages({ shell: Shell, tool, onBack, mode }) {
  const [file, count, setFile] = usePdfFile()
  const [range, setRange] = useState('')
  const job = useJob()

  const go = () => job.run(async (progress) => {
    const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
    const total = src.getPageCount()
    const sel = new Set(parseRanges(range, total))
    const keep = []
    for (let i = 1; i <= total; i++) {
      const inSel = sel.has(i)
      if ((mode === 'extract' && inSel) || (mode === 'delete' && !inSel)) keep.push(i - 1)
    }
    if (!keep.length) throw new Error('Hasilnya nol halaman — periksa lagi rentangnya.')
    await progress(`Menyusun ${keep.length} halaman…`, 100)
    const out = await PDFDocument.create()
    const copied = await out.copyPages(src, keep)
    copied.forEach((p) => out.addPage(p))
    const suffix = mode === 'delete' ? '-tanpa-' : '-ambil-'
    downloadBlob(new Blob([await out.save()], { type: 'application/pdf' }),
      stripExt(file.name) + suffix + range.replaceAll(' ', '') + '.pdf')
  })

  return (
    <Shell tool={tool} onBack={onBack} {...job}>
      {!file
        ? <Dropzone multiple={false} label="Pilih PDF" onFiles={([f]) => setFile(f)} />
        : (
          <>
            <div className="file-list"><FileRow file={file} index={0} total={1} onRemove={() => setFile(null)} /></div>
            {count > 0 && <div className="note"><Icon name="file" size={16} /> Dokumen ini punya <b>{count}</b> halaman (1–{count}).</div>}
            <div className="options">
              <div className="field">
                <label>{mode === 'delete' ? 'Halaman yang dibuang' : 'Halaman yang diambil'}</label>
                <input className="text mono" autoFocus value={range} onChange={(e) => setRange(e.target.value)}
                  placeholder={mode === 'delete' ? 'mis. 2, 5-7' : 'mis. 1-3, 9'} />
              </div>
              <button className="cta" disabled={job.busy || !range.trim()} onClick={go}>
                <Icon name={mode === 'delete' ? 'delete-page' : 'extract'} size={18} />
                {mode === 'delete' ? 'Hapus Halaman' : 'Ekstrak Halaman'}
              </button>
            </div>
          </>
        )}
    </Shell>
  )
}
