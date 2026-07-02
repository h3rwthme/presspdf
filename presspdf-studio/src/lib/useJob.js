import { useState, useCallback } from 'react'

// Shared async state for every tool: busy flag, progress message + %, error.
// Usage: job.run(async (progress) => { progress('doing X', 40) ... })
export function useJob() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [pct, setPct] = useState(null)

  const run = useCallback(async (fn) => {
    setBusy(true); setErr(''); setMsg('Menyiapkan…'); setPct(null)
    const progress = (m, p) => {
      if (m != null) setMsg(m)
      if (p != null) setPct(p)
      // yield to the browser so the UI can paint between heavy steps
      return new Promise((r) => requestAnimationFrame(() => r()))
    }
    try {
      await fn(progress)
      setMsg('Selesai — hasil sudah siap.'); setPct(null)
    } catch (e) {
      console.error(e)
      setErr(
        /encrypt|password/i.test(e?.message || '')
          ? 'PDF ini terkunci password — buka proteksinya dulu (mis. qpdf --decrypt).'
          : e?.message || String(e)
      )
      setMsg(''); setPct(null)
    } finally {
      setBusy(false)
    }
  }, [])

  return { busy, msg, err, pct, run }
}
