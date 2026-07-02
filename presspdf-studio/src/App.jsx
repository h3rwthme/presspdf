import { useMemo, useState } from 'react'
import { TOOLS, CATS } from './tools/registry'
import ToolShell from './components/ToolShell'
import Icon from './components/Icon'
import { useTheme } from './lib/useTheme'

export default function App() {
  const [toolId, setToolId] = useState(null)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('all')
  const [theme, toggleTheme] = useTheme()

  const tool = TOOLS.find((t) => t.id === toolId)
  const open = (id) => { setToolId(id); window.scrollTo({ top: 0 }) }

  return (
    <>
      <Header
        theme={theme} toggleTheme={toggleTheme}
        query={query} setQuery={setQuery}
        onHome={() => setToolId(null)} showSearch={!tool}
      />
      {tool
        ? <div className="wrap"><ToolView tool={tool} onBack={() => setToolId(null)} /></div>
        : <Home query={query} setQuery={setQuery} cat={cat} setCat={setCat} onOpen={open} />}
      <SiteFooter />
    </>
  )
}

function Header({ theme, toggleTheme, query, setQuery, onHome, showSearch }) {
  return (
    <header className="app-header">
      <div className="bar">
        <button className="logo" onClick={onHome} aria-label="Beranda">
          <span className="mark"><Icon name="logo" size={20} strokeWidth={2.2} /></span>
          <span className="name">PressPDF <em>Studio</em></span>
        </button>
        {showSearch && (
          <label className="header-search">
            <Icon name="search" size={17} />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari alat… (mis. kompres, hapus latar)" aria-label="Cari alat"
            />
            {query && <button className="icon-btn" style={{ width: 22, height: 22, border: 'none', background: 'none' }} onClick={() => setQuery('')}><Icon name="x" size={15} /></button>}
          </label>
        )}
        <button className="icon-btn" onClick={toggleTheme} aria-label="Ganti tema" title="Terang / Gelap">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>
        <a className="icon-btn ghlink" href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub" title="Kode sumber">
          <Icon name="github" size={18} />
        </a>
      </div>
    </header>
  )
}

function Home({ query, setQuery, cat, setCat, onOpen }) {
  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => TOOLS.filter((t) => {
    const inCat = cat === 'all' || t.cat === cat
    const inQ = !q || (t.name + ' ' + t.desc).toLowerCase().includes(q)
    return inCat && inQ
  }), [q, cat])

  const shownCats = CATS.filter((c) => filtered.some((t) => t.cat === c.id))

  return (
    <main className="wrap">
      <section className="hero">
        <span className="eyebrow"><Icon name="shield" size={14} /> 100% diproses di perangkatmu</span>
        <h1>Semua alat <span className="grad">PDF &amp; Foto</span><br />dalam satu studio.</h1>
        <p>
          Gabung, kompres, konversi, hingga hapus latar dan watermark — cepat, privat, tanpa upload.
          Tidak ada server, tidak ada antrean, tetap jalan saat offline.
        </p>
        <div className="trust">
          <span><Icon name="wifi" size={15} /> Jalan offline</span>
          <span><Icon name="zap" size={15} /> Tanpa antrean</span>
          <span><Icon name="check" size={15} /> Tanpa watermark hasil</span>
        </div>
      </section>

      <nav className="filters" aria-label="Filter kategori">
        <button className={'pill' + (cat === 'all' ? ' active' : '')} onClick={() => setCat('all')}>
          <Icon name="grid" size={16} /> Semua <span className="count">{TOOLS.length}</span>
        </button>
        {CATS.map((c) => (
          <button key={c.id} className={'pill' + (cat === c.id ? ' active' : '')} onClick={() => setCat(c.id)}>
            <Icon name={c.icon} size={16} /> {c.label}
            <span className="count">{TOOLS.filter((t) => t.cat === c.id).length}</span>
          </button>
        ))}
      </nav>

      {shownCats.length === 0 && (
        <div className="empty">
          <Icon name="search" size={40} strokeWidth={1.4} />
          <p>Tidak ada alat yang cocok dengan “{query}”.</p>
          <button className="cta ghost" style={{ marginTop: 14 }} onClick={() => { setQuery(''); setCat('all') }}>Reset pencarian</button>
        </div>
      )}

      {shownCats.map((c) => {
        const items = filtered.filter((t) => t.cat === c.id)
        return (
          <section key={c.id} className="cat-block" style={{ '--cat-color': c.color }}>
            <div className="cat-head">
              <Icon name={c.icon} size={18} />
              <h2>{c.label}</h2>
              <span className="rule" />
            </div>
            <div className="grid">
              {items.map((t, i) => (
                <button
                  key={t.id} className="tool-card" onClick={() => onOpen(t.id)}
                  style={{ '--chip-fg': c.color, '--chip-bg': c.bg, animationDelay: `${i * 45}ms` }}
                >
                  <span className="chip"><Icon name={t.icon} size={24} /></span>
                  <span className="t-name">{t.name}</span>
                  <span className="t-desc">{t.desc}</span>
                  <span className="go">Buka alat <Icon name="chevron" size={15} /></span>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </main>
  )
}

function ToolView({ tool, onBack }) {
  const Comp = tool.comp
  return <Comp shell={ToolShell} tool={tool} onBack={onBack} />
}

function SiteFooter() {
  const items = [
    { icon: 'shield', h: 'Privat by design', p: 'File diproses di memori browser dan hilang begitu tab ditutup. Tidak ada yang dikirim ke server.' },
    { icon: 'wifi', h: 'Siap offline', p: 'Setelah dimuat, seluruh alat bisa dipakai tanpa internet — cocok dijadikan aplikasi (Add to Home Screen).' },
    { icon: 'zap', h: 'Ringan & cepat', p: 'Dibangun dengan React + Vite, pdf-lib, dan pdf.js. Bisa dibungkus jadi app desktop lewat Tauri.' },
  ]
  return (
    <footer className="site-foot">
      <div className="foot-grid">
        {items.map((it) => (
          <div className="foot-card" key={it.h}>
            <Icon name={it.icon} size={20} />
            <div><h4>{it.h}</h4><p>{it.p}</p></div>
          </div>
        ))}
      </div>
      <div className="foot-legal">© {new Date().getFullYear()} PressPDF Studio — alat PDF &amp; foto yang menghormati privasimu.</div>
    </footer>
  )
}
