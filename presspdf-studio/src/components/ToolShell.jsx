import Icon from './Icon'
import { catOf } from '../tools/registry'

export default function ToolShell({ tool, onBack, children, busy, msg, err, pct }) {
  const c = catOf(tool.cat) || {}
  return (
    <div className="tool-page">
      <button className="back" onClick={onBack}><Icon name="back" size={17} /> Semua alat</button>

      <div className="tool-hero">
        <span className="chip" style={{ '--chip-fg': c.color, '--chip-bg': c.bg }}>
          <Icon name={tool.icon} size={28} />
        </span>
        <div>
          <h1>{tool.name}</h1>
          <p>{tool.desc}</p>
        </div>
      </div>

      <div className="panel">
        {children}

        {busy && (
          <>
            <div className="status busy"><Icon name="loader" size={17} className="spin" />{msg || 'Memproses…'}</div>
            <div className={'progress' + (pct == null ? ' indet' : '')}>
              <div className="bar" style={{ width: pct == null ? undefined : `${Math.round(pct)}%` }} />
            </div>
          </>
        )}
        {!busy && msg && <div className="status ok"><Icon name="check" size={17} />{msg}</div>}
        {err && <div className="status err"><Icon name="info" size={17} />{err}</div>}
      </div>
    </div>
  )
}
