import { useEffect, useState } from 'react'
import { fmtSize } from '../lib/utils'
import Icon from './Icon'

export default function FileRow({ file, onRemove, onUp, onDown, index, total, preview }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!preview || !file?.type?.startsWith('image/')) return
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file, preview])

  return (
    <div className="file-row">
      {typeof index === 'number' && total > 1 && <span className="file-idx">{index + 1}</span>}
      {url
        ? <img className="thumb" src={url} alt="" />
        : <span className="f-icon"><Icon name={file?.type?.startsWith('image/') ? 'image' : 'file'} size={20} /></span>}
      <span className="file-name">{file.name}</span>
      <span className="file-size">{fmtSize(file.size)}</span>
      <span className="file-btns">
        {onUp && <button title="Naikkan" disabled={index === 0} onClick={onUp}><Icon name="up" size={15} /></button>}
        {onDown && <button title="Turunkan" disabled={index === total - 1} onClick={onDown}><Icon name="down" size={15} /></button>}
        <button className="danger" title="Hapus" onClick={onRemove}><Icon name="x" size={15} /></button>
      </span>
    </div>
  )
}
