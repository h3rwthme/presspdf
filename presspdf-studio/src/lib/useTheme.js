import { useEffect, useState } from 'react'

// Persisted light/dark theme. Defaults to the OS preference on first visit.
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('pp-theme')
    if (saved) return saved
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('pp-theme', theme)
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}
