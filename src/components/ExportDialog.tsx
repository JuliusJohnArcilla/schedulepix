import { useState } from 'react'
import type { Doc, ImgEntry } from '../types'
import { geometry } from '../model'
import { effectiveScale, exportImage } from '../render'

export function ExportDialog({ doc, images, onClose }: { doc: Doc; images: Record<string, ImgEntry>; onClose: () => void }) {
  const [format, setFormat] = useState<'png' | 'jpeg'>('png')
  const [scale, setScale] = useState(2)
  const [transparent, setTransparent] = useState(false)
  const [quality, setQuality] = useState(0.92)
  const [name, setName] = useState((doc.settings.title || 'schedule').replace(/[^\w\- ]+/g, '').trim() || 'schedule')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const g = geometry(doc.settings, doc.theme)
  const eff = effectiveScale(g, scale)
  const w = Math.floor(g.width * eff)
  const h = Math.floor(g.height * eff)

  async function run() {
    setBusy(true)
    setError('')
    try {
      const blob = await exportImage(doc, images, { format, scale, transparent, quality })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${name || 'schedule'}.${format === 'jpeg' ? 'jpg' : 'png'}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Export" onClick={(e) => e.stopPropagation()}>
        <h2>Export image</h2>
        <label className="field">
          <span>File name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="row">
          <label className="field">
            <span>Format</span>
            <select value={format} onChange={(e) => setFormat(e.target.value as 'png' | 'jpeg')}>
              <option value="png">PNG</option>
              <option value="jpeg">JPG</option>
            </select>
          </label>
          <label className="field">
            <span>Scale</span>
            <select value={scale} onChange={(e) => setScale(+e.target.value)}>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={3}>3x</option>
            </select>
          </label>
        </div>
        {format === 'png' ? (
          <label className="check">
            <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />
            Transparent background (grid area)
          </label>
        ) : (
          <label className="field">
            <span>Quality ({Math.round(quality * 100)}%)</span>
            <input type="range" min={0.5} max={1} step={0.01} value={quality} onChange={(e) => setQuality(+e.target.value)} />
          </label>
        )}
        <p className="hint">
          Output: {w} × {h} px{eff < scale ? ' (scale reduced to fit browser limits)' : ''}
          {format === 'jpeg' ? '. JPG has no transparency, so the theme background is used.' : ''}
        </p>
        {error && <p className="error">{error}</p>}
        <div className="row end">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={run} disabled={busy}>{busy ? 'Exporting…' : 'Export'}</button>
        </div>
      </div>
    </div>
  )
}
