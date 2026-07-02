export const fmtSize = (b) =>
  b < 1024 * 1024 ? (b / 1024).toFixed(1) + ' KB' : (b / (1024 * 1024)).toFixed(2) + ' MB'

// "1-3,5,8-10" -> [1,3,5,8,9,10] (1-based, unik, terurut, di-clamp ke total)
export function parseRanges(str, total) {
  const out = new Set()
  if (!str || !str.trim()) {
    for (let i = 1; i <= total; i++) out.add(i)
  } else {
    for (const tok of str.split(',')) {
      const t = tok.trim()
      if (!t) continue
      const m = t.match(/^(\d+)\s*-\s*(\d+)$/)
      if (m) {
        let [a, b] = [+m[1], +m[2]]
        if (a > b) [a, b] = [b, a]
        for (let i = a; i <= b; i++) if (i >= 1 && i <= total) out.add(i)
      } else if (/^\d+$/.test(t)) {
        const n = +t
        if (n >= 1 && n <= total) out.add(n)
      } else {
        throw new Error(`Format rentang tidak dikenali: "${t}". Contoh: 1-3,5,8`)
      }
    }
  }
  if (!out.size) throw new Error('Rentang halaman kosong / di luar jumlah halaman.')
  return [...out].sort((a, b) => a - b)
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export const stripExt = (n) => n.replace(/\.[^.]+$/, '')
