import { useState } from 'react'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import Dropzone from '../components/Dropzone'
import FileRow from '../components/FileRow'
import Icon from '../components/Icon'
import { useJob } from '../lib/useJob'
import { parseXlsx, parseCsv, sanitizeWin } from '../lib/office'
import { downloadBlob, fmtSize, stripExt } from '../lib/utils'

export default function ExcelToPdf({ shell: Shell, tool, onBack }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const job = useJob()

  const reset = () => { setFile(null); setResult(null) }

  const convert = () => job.run(async (progress) => {
    setResult(null)
    await progress('Membaca data…', 10)

    let sheets
    if (/\.xlsx$/i.test(file.name)) {
      sheets = await parseXlsx(file)
    } else {
      sheets = [{ name: stripExt(file.name), rows: parseCsv(await file.text()) }]
    }
    sheets = sheets.filter((s) => s.rows.some((r) => r.some((c) => String(c).trim())))
    if (!sheets.length) throw new Error('Tidak ada data pada file ini.')

    await progress('Menyusun tabel…', 40)
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const bold = await doc.embedFont(StandardFonts.HelveticaBold)

    let totalRows = 0
    for (const sheet of sheets) {
      drawSheet(doc, sheet, font, bold)
      totalRows += sheet.rows.length
    }

    await progress('Mengemas PDF…', 90)
    const blob = new Blob([await doc.save()], { type: 'application/pdf' })
    setResult({ blob, name: stripExt(file.name) + '.pdf', n: totalRows })
  })

  return (
    <Shell tool={tool} onBack={onBack} {...job}>
      {!file
        ? <Dropzone accept="sheet" multiple={false} label="Pilih spreadsheet" hint=".xlsx, .csv, atau .tsv" onFiles={([f]) => setFile(f)} />
        : (
          <>
            <div className="file-list"><FileRow file={file} index={0} total={1} onRemove={reset} /></div>
            <div className="options">
              <button className="cta" disabled={job.busy} onClick={convert}>
                <Icon name="file" size={18} /> Konversi ke PDF
              </button>
            </div>
            {result && (
              <div className="results">
                <div className="result-row">
                  <span className="f-icon"><Icon name="file" size={20} /></span>
                  <span className="file-name">{result.name}<br /><span className="mono-s">{result.n} baris</span></span>
                  <span className="mono-s">{fmtSize(result.blob.size)}</span>
                  <button className="mini" onClick={() => downloadBlob(result.blob, result.name)}>
                    <Icon name="download" size={15} /> Unduh PDF
                  </button>
                </div>
              </div>
            )}
          </>
        )}
    </Shell>
  )
}

const SIZE = 8.5
const ROW_H = 16
const MARGIN = 36

function drawSheet(doc, { name, rows }, font, bold) {
  const cols = rows.reduce((m, r) => Math.max(m, r.length), 0)
  // column widths from content (clamped), scaled to fit the page
  const want = Array.from({ length: cols }, (_, c) =>
    Math.min(30, Math.max(5, rows.reduce((m, r) => Math.max(m, String(r[c] ?? '').length), 0))) * 4.6 + 10)
  const wantTotal = want.reduce((a, b) => a + b, 0)
  const landscape = wantTotal > 523 || cols > 6
  const [pw, ph] = landscape ? [841.89, 595.28] : [595.28, 841.89]
  const availW = pw - MARGIN * 2
  const k = Math.min(1, availW / wantTotal)
  const widths = want.map((w) => w * k)

  const ink = rgb(0.08, 0.09, 0.11)
  const faint = rgb(0.55, 0.57, 0.62)
  const lineC = rgb(0.85, 0.85, 0.87)
  const headBg = rgb(0.945, 0.945, 0.955)

  let page = doc.addPage([pw, ph])
  let y = ph - MARGIN
  page.drawText(sanitizeWin(name).slice(0, 80), { x: MARGIN, y: y - 10, size: 11, font: bold, color: ink })
  y -= 26

  rows.forEach((row, ri) => {
    if (y < MARGIN + ROW_H) { page = doc.addPage([pw, ph]); y = ph - MARGIN }
    const isHead = ri === 0
    if (isHead) {
      page.drawRectangle({ x: MARGIN, y: y - ROW_H + 4, width: widths.reduce((a, b) => a + b, 0), height: ROW_H, color: headBg })
    }
    let x = MARGIN
    for (let c = 0; c < cols; c++) {
      const f = isHead ? bold : font
      let text = sanitizeWin(String(row[c] ?? ''))
      while (text && f.widthOfTextAtSize(text, SIZE) > widths[c] - 6) text = text.slice(0, -1)
      if (text) page.drawText(text, { x: x + 3, y: y - 8, size: SIZE, font: f, color: isHead ? ink : rgb(0.15, 0.16, 0.19) })
      x += widths[c]
    }
    page.drawLine({ start: { x: MARGIN, y: y - ROW_H + 4 }, end: { x: MARGIN + widths.reduce((a, b) => a + b, 0), y: y - ROW_H + 4 }, thickness: 0.4, color: lineC })
    y -= ROW_H
  })

  // footer count on last page of the sheet
  page.drawText(`${rows.length} baris`, { x: MARGIN, y: MARGIN - 18, size: 7.5, font, color: faint })
}
