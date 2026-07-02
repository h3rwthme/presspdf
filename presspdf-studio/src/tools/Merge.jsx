import { useMemo, useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import Dropzone from '../components/Dropzone'
import FileRow from '../components/FileRow'
import Icon from '../components/Icon'
import { downloadBlob, fmtSize } from '../lib/utils'
import { useJob } from '../lib/useJob'

export default function Merge({ shell: Shell, tool, onBack }) {
  const [files, setFiles] = useState([])
  const job = useJob()
  const total = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files])

  const move = (i, d) => setFiles((f) => {
    const c = [...f]; const [x] = c.splice(i, 1); c.splice(i + d, 0, x); return c
  })

  const merge = () => job.run(async (progress) => {
    const out = await PDFDocument.create()
    let pages = 0
    for (let i = 0; i < files.length; i++) {
      await progress(`Menggabungkan ${files[i].name} (${i + 1}/${files.length})…`, Math.round((i / files.length) * 100))
      const src = await PDFDocument.load(await files[i].arrayBuffer(), { ignoreEncryption: true })
      const copied = await out.copyPages(src, src.getPageIndices())
      copied.forEach((p) => out.addPage(p))
      pages += copied.length
    }
    out.setTitle('Gabungan PDF — PressPDF Studio')
    await progress(`Menyimpan ${pages} halaman…`, 100)
    downloadBlob(new Blob([await out.save()], { type: 'application/pdf' }), 'gabungan.pdf')
  })

  return (
    <Shell tool={tool} onBack={onBack} {...job}>
      <Dropzone label="Tambahkan PDF" hint="seret beberapa PDF, atur urutannya di bawah" onFiles={(f) => setFiles((x) => [...x, ...f])} />
      {files.length > 0 && (
        <>
          <div className="file-list">
            {files.map((f, i) => (
              <FileRow key={i} file={f} index={i} total={files.length}
                onUp={() => move(i, -1)} onDown={() => move(i, 1)}
                onRemove={() => setFiles((x) => x.filter((_, j) => j !== i))} />
            ))}
          </div>
          <div className="options">
            <div className="seg" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="mono-s">{files.length} berkas · {fmtSize(total)}</span>
              {files.length >= 2
                ? <button className="cta" disabled={job.busy} onClick={merge}><Icon name="merge" size={18} /> Gabungkan {files.length} PDF</button>
                : <span className="mono-s">Tambah minimal 1 PDF lagi</span>}
            </div>
          </div>
        </>
      )}
    </Shell>
  )
}
