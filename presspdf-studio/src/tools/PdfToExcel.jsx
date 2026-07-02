import { useState } from 'react'
import Dropzone from '../components/Dropzone'
import FileRow from '../components/FileRow'
import Icon from '../components/Icon'
import { useJob } from '../lib/useJob'
import { openPdf, extractLines } from '../lib/pdfjs'
import { buildXlsx } from '../lib/office'
import { downloadBlob, fmtSize, stripExt } from '../lib/utils'

export default function PdfToExcel({ shell: Shell, tool, onBack }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const job = useJob()

  const reset = () => { setFile(null); setResult(null) }

  const convert = () => job.run(async (progress) => {
    setResult(null)
    const pdf = await openPdf(await file.arrayBuffer())
    const rows = []

    for (let i = 1; i <= pdf.numPages; i++) {
      await progress(`Membaca halaman ${i}/${pdf.numPages}…`, (i / pdf.numPages) * 85)
      const page = await pdf.getPage(i)
      const lines = await extractLines(page)

      for (const line of lines) {
        // split a text line into cells wherever the horizontal gap between
        // items is clearly wider than normal word spacing
        const cells = []
        let cur = ''
        let prevEnd = null
        for (const it of line.items) {
          const gap = prevEnd == null ? 0 : it.x - prevEnd
          if (prevEnd != null && gap > Math.max(8, it.h * 0.9)) {
            cells.push(cur.trim()); cur = it.s
          } else {
            cur = cur ? cur + ' ' + it.s : it.s
          }
          prevEnd = it.x + it.w
        }
        if (cur.trim()) cells.push(cur.trim())
        if (cells.length) rows.push(cells)
      }
      if (i < pdf.numPages && rows.length) rows.push([])
    }

    if (!rows.some((r) => r.some(Boolean))) {
      throw new Error('PDF ini tidak mengandung teks (kemungkinan hasil scan). Gunakan PDF dengan teks asli.')
    }

    await progress('Menyusun spreadsheet…', 95)
    const blob = await buildXlsx(rows)
    setResult({ blob, name: stripExt(file.name) + '.xlsx', n: rows.length })
  })

  return (
    <Shell tool={tool} onBack={onBack} {...job}>
      {!file
        ? <Dropzone accept="pdf" multiple={false} label="Pilih PDF" hint="Tabel & angka diekstrak ke .xlsx" onFiles={([f]) => setFile(f)} />
        : (
          <>
            <div className="file-list"><FileRow file={file} index={0} total={1} onRemove={reset} /></div>
            <div className="options">
              <button className="cta" disabled={job.busy} onClick={convert}>
                <Icon name="excel" size={18} /> Konversi ke Excel
              </button>
            </div>
            {result && (
              <div className="results">
                <div className="result-row">
                  <span className="f-icon"><Icon name="excel" size={20} /></span>
                  <span className="file-name">{result.name}<br /><span className="mono-s">{result.n} baris</span></span>
                  <span className="mono-s">{fmtSize(result.blob.size)}</span>
                  <button className="mini" onClick={() => downloadBlob(result.blob, result.name)}>
                    <Icon name="download" size={15} /> Unduh XLSX
                  </button>
                </div>
              </div>
            )}
          </>
        )}
    </Shell>
  )
}
