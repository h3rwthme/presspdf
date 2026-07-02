import { useEffect, useState } from 'react'
import { PDFDocument } from 'pdf-lib'

// Load a single PDF file into state together with its page count.
// Returns [file, count, setFile, error]. count is null while loading, 0 on failure.
export function usePdfFile() {
  const [file, setFile] = useState(null)
  const [count, setCount] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!file) { setCount(null); setError(''); return }
    let alive = true
    ;(async () => {
      try {
        const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
        if (alive) { setCount(doc.getPageCount()); setError('') }
      } catch (e) {
        if (alive) { setCount(0); setError(/encrypt|password/i.test(e?.message || '') ? 'PDF terkunci password.' : 'PDF tidak bisa dibaca.') }
      }
    })()
    return () => { alive = false }
  }, [file])

  return [file, count, setFile, error]
}
