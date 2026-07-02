import { useRef, useState } from 'react'
import Icon from './Icon'

// accept: 'pdf' | 'image' | raw mime string. Filters dropped/selected files accordingly.
const MATCHERS = {
  pdf: (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name),
  image: (f) => /^image\/(jpeg|png|webp|bmp)$/.test(f.type) || /\.(jpe?g|png|webp|bmp)$/i.test(f.name),
}

export default function Dropzone({ onFiles, multiple = true, accept = 'pdf', label, hint }) {
  const inputRef = useRef(null)
  const [over, setOver] = useState(false)
  const match = MATCHERS[accept] || (() => true)
  const acceptAttr = accept === 'pdf' ? 'application/pdf' : accept === 'image' ? 'image/*' : accept

  const pick = (list) => {
    const files = [...list].filter(match)
    if (files.length) onFiles(multiple ? files : files.slice(0, 1))
  }

  return (
    <div
      className={'dropzone' + (over ? ' over' : '')}
      role="button" tabIndex={0} aria-label={label}
      onClick={() => inputRef.current.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), inputRef.current.click())}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragEnter={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={(e) => { e.preventDefault(); setOver(false) }}
      onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files) }}
    >
      <div className="dz-icon"><Icon name="upload" size={26} /></div>
      <h3>{label}</h3>
      <p>{hint || (multiple ? 'seret & jatuhkan beberapa file sekaligus' : 'seret & jatuhkan satu file')}</p>
      <span className="pick">atau pilih dari perangkat</span>
      <input
        ref={inputRef} type="file" hidden multiple={multiple} accept={acceptAttr}
        onChange={(e) => { pick(e.target.files); e.target.value = '' }}
      />
    </div>
  )
}
