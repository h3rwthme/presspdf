import { useRef, useState } from 'react'
import Icon from './Icon'

// accept: named type set — each entry defines both the file filter and the
// native <input accept> attribute, so drop & picker behave identically.
const TYPES = {
  pdf:   { test: (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name), attr: 'application/pdf,.pdf' },
  image: { test: (f) => /^image\/(jpeg|png|webp|bmp)$/.test(f.type) || /\.(jpe?g|png|webp|bmp)$/i.test(f.name), attr: 'image/*' },
  word:  { test: (f) => /\.(docx|txt)$/i.test(f.name), attr: '.docx,.txt' },
  sheet: { test: (f) => /\.(xlsx|csv|tsv)$/i.test(f.name), attr: '.xlsx,.csv,.tsv' },
  ppt:   { test: (f) => /\.pptx$/i.test(f.name), attr: '.pptx' },
}

export default function Dropzone({ onFiles, multiple = true, accept = 'pdf', label, hint }) {
  const inputRef = useRef(null)
  const [over, setOver] = useState(false)
  const type = TYPES[accept] || { test: () => true, attr: undefined }
  const match = type.test
  const acceptAttr = type.attr

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
