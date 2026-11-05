import type { ReactNode } from 'react'
import type { Deco, Doc, ImgEntry, Item, Settings, Theme } from '../types'
import { FONTS, PALETTES, SWATCHES, formatTime, fromTimeInput, toTimeInput } from '../model'

export type Tab = 'item' | 'deco' | 'schedule' | 'theme'

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="field">
    <span>{label}</span>
    {children}
  </label>
)

interface Props {
  tab: Tab
  setTab: (t: Tab) => void
  doc: Doc
  images: ImgEntry[]
  selected: Item | null
  wsBg: string
  onWsBg: (c: string) => void
  selectedDeco: Deco | null
  onDeco: (patch: Partial<Deco>, key: string) => void
  onDecoAction: (a: 'delete' | 'duplicate' | 'forward' | 'back') => void
  onItem: (patch: Partial<Item>, key: string) => void
  onDeleteItem: () => void
  onDuplicateItem: () => void
  onSettings: (patch: Partial<Settings>, key: string) => void
  onTheme: (patch: Partial<Theme>, key: string) => void
}

export function Inspector(p: Props) {
  const { doc, selected: it } = p
  const s = doc.settings
  const t = doc.theme
  const dc = p.selectedDeco
  const tab: Tab = (p.tab === 'item' && !it) || (p.tab === 'deco' && !dc) ? 'schedule' : p.tab

  return (
    <aside className="inspector">
      <div className="tabs">
        {(['item', 'deco', 'schedule', 'theme'] as Tab[]).map((k) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => p.setTab(k)} disabled={(k === 'item' && !it) || (k === 'deco' && !dc)}>
            {k === 'item' ? 'Event' : k === 'deco' ? 'Image' : k === 'schedule' ? 'Schedule' : 'Theme'}
          </button>
        ))}
      </div>

      {tab === 'item' && it && (
        <div className="panel">
          <Field label="Title">
            <input value={it.title} onChange={(e) => p.onItem({ title: e.target.value }, 'title')} />
          </Field>
          <Field label="Notes">
            <textarea rows={3} value={it.notes} onChange={(e) => p.onItem({ notes: e.target.value }, 'notes')} />
          </Field>
          <Field label="Day">
            <select value={it.day} onChange={(e) => p.onItem({ day: +e.target.value }, 'day')}>
              {s.days.map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          </Field>
          <div className="row">
            <Field label="Start">
              <input
                type="time"
                step={s.slotMinutes * 60}
                value={toTimeInput(it.start)}
                onChange={(e) => {
                  const m = fromTimeInput(e.target.value)
                  if (m !== null) p.onItem({ start: m }, 'start')
                }}
              />
            </Field>
            <Field label="Duration (min)">
              <input type="number" min={s.slotMinutes} step={s.slotMinutes} value={it.dur} onChange={(e) => p.onItem({ dur: +e.target.value || s.slotMinutes }, 'dur')} />
            </Field>
          </div>
          <p className="hint">{formatTime(it.start, s.use24h)} – {formatTime(it.start + it.dur, s.use24h)}</p>
          <Field label="Color">
            <div className="swatches">
              {SWATCHES.map((c) => (
                <button key={c} className={'swatch' + (it.color === c ? ' on' : '')} style={{ background: c }} aria-label={c} onClick={() => p.onItem({ color: c }, 'color')} />
              ))}
              <input type="color" value={it.color} onChange={(e) => p.onItem({ color: e.target.value }, 'color')} />
            </div>
          </Field>
          <Field label="Image">
            <select value={it.imageId ?? ''} onChange={(e) => p.onItem({ imageId: e.target.value || null }, 'image')}>
              <option value="">None</option>
              {p.images.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </Field>
          <div className="row">
            <Field label="Image fit">
              <select value={it.fit} onChange={(e) => p.onItem({ fit: e.target.value as Item['fit'] }, 'fit')}>
                <option value="cover">Fill (crop)</option>
                <option value="contain">Fit (letterbox)</option>
              </select>
            </Field>
            <Field label="Font size">
              <input type="number" min={9} max={40} value={it.fontSize} onChange={(e) => p.onItem({ fontSize: Math.min(40, Math.max(9, +e.target.value || 13)) }, 'fs')} />
            </Field>
          </div>
          <div className="row">
            <button className="btn" onClick={p.onDuplicateItem}>Duplicate</button>
            <button className="btn danger" onClick={p.onDeleteItem}>Delete</button>
          </div>
        </div>
      )}

      {tab === 'deco' && dc && (
        <div className="panel">
          <p className="hint" style={{ marginTop: 0 }}>Drag to move. Use the corner handle to resize and the top handle to rotate.</p>
          <Field label={`Opacity (${Math.round(dc.opacity * 100)}%)`}>
            <input type="range" min={0.05} max={1} step={0.05} value={dc.opacity} onChange={(e) => p.onDeco({ opacity: +e.target.value }, 'opacity')} />
          </Field>
          <Field label={`Rotation (${dc.rotation}°)`}>
            <input type="range" min={0} max={359} value={dc.rotation} onChange={(e) => p.onDeco({ rotation: +e.target.value }, 'rotate')} />
          </Field>
          <div className="row">
            <Field label="Width (px)">
              <input type="number" min={24} value={Math.round(dc.w)} onChange={(e) => {
                const w = Math.max(24, +e.target.value || 24)
                const h = (dc.h / dc.w) * w
                p.onDeco({ w, h, x: dc.x + (dc.w - w) / 2, y: dc.y + (dc.h - h) / 2 }, 'width')
              }} />
            </Field>
            <Field label="Layer">
              <select value={dc.behind ? 'behind' : 'above'} onChange={(e) => p.onDeco({ behind: e.target.value === 'behind' }, 'layer')}>
                <option value="above">Above events</option>
                <option value="behind">Behind events</option>
              </select>
            </Field>
          </div>
          <div className="row">
            <button className="btn" onClick={() => p.onDecoAction('forward')}>Bring forward</button>
            <button className="btn" onClick={() => p.onDecoAction('back')}>Send back</button>
          </div>
          <div className="row">
            <button className="btn" onClick={() => p.onDecoAction('duplicate')}>Duplicate</button>
            <button className="btn danger" onClick={() => p.onDecoAction('delete')}>Delete</button>
          </div>
        </div>
      )}

      {tab === 'schedule' && (
        <div className="panel">
          <Field label="Title">
            <input value={s.title} onChange={(e) => p.onSettings({ title: e.target.value }, 'title')} />
          </Field>
          <Field label="Subtitle">
            <input value={s.subtitle} onChange={(e) => p.onSettings({ subtitle: e.target.value }, 'subtitle')} />
          </Field>
          <div className="row">
            <Field label="Start hour">
              <input type="number" min={0} max={s.endHour - 1} value={s.startHour} onChange={(e) => p.onSettings({ startHour: Math.min(s.endHour - 1, Math.max(0, +e.target.value || 0)) }, 'sh')} />
            </Field>
            <Field label="End hour">
              <input type="number" min={s.startHour + 1} max={24} value={s.endHour} onChange={(e) => p.onSettings({ endHour: Math.min(24, Math.max(s.startHour + 1, +e.target.value || 24)) }, 'eh')} />
            </Field>
          </div>
          <div className="row">
            <Field label="Slot size">
              <select value={s.slotMinutes} onChange={(e) => p.onSettings({ slotMinutes: +e.target.value }, 'slot')}>
                {[10, 15, 30, 60].map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </select>
            </Field>
            <Field label="Clock">
              <select value={s.use24h ? '24' : '12'} onChange={(e) => p.onSettings({ use24h: e.target.value === '24' }, 'clock')}>
                <option value="12">12-hour</option>
                <option value="24">24-hour</option>
              </select>
            </Field>
          </div>
          <Field label={`Row height (${s.hourHeight}px / hour)`}>
            <input type="range" min={40} max={160} value={s.hourHeight} onChange={(e) => p.onSettings({ hourHeight: +e.target.value }, 'hh')} />
          </Field>
          <Field label={`Column width (${s.dayWidth}px)`}>
            <input type="range" min={90} max={320} value={s.dayWidth} onChange={(e) => p.onSettings({ dayWidth: +e.target.value }, 'dw')} />
          </Field>
          <div className="field">
            <span>Days / columns</span>
            {s.days.map((d, i) => (
              <div key={i} className="daylist">
                <input value={d} onChange={(e) => p.onSettings({ days: s.days.map((x, j) => (j === i ? e.target.value : x)) }, 'day' + i)} />
                <button className="btn" aria-label={`Remove ${d}`} disabled={s.days.length <= 1} onClick={() => p.onSettings({ days: s.days.filter((_, j) => j !== i) }, 'rmday')}>×</button>
              </div>
            ))}
            <button className="btn" disabled={s.days.length >= 14} onClick={() => p.onSettings({ days: [...s.days, `Day ${s.days.length + 1}`] }, 'addday')}>+ Add column</button>
          </div>
        </div>
      )}

      {tab === 'theme' && (
        <div className="panel">
          <div className="bgrow">
            <label className="colorpick big">
              <input type="color" value={t.bg} onChange={(e) => p.onTheme({ bg: e.target.value }, 'cbg')} />
              <span>Schedule background</span>
            </label>
            <button className="btn" disabled={t.bg.toLowerCase() === '#ffffff'} onClick={() => p.onTheme({ bg: '#ffffff' }, 'cbg')}>White</button>
          </div>
          <div className="bgrow">
            <label className="colorpick big">
              <input type="color" value={p.wsBg} onChange={(e) => p.onWsBg(e.target.value)} />
              <span>Editor background</span>
            </label>
            <button className="btn" disabled={p.wsBg.toLowerCase() === '#ffffff'} onClick={() => p.onWsBg('#ffffff')}>White</button>
          </div>
          <span className="label">Palette</span>
          <div className="palettes">
            {Object.entries(PALETTES).map(([name, pal]) => (
              <button key={name} className="palette" onClick={() => p.onTheme({ ...pal }, 'palette')} title={name}>
                <i style={{ background: pal.bannerBg }} />
                <i style={{ background: pal.headerBg }} />
                <i style={{ background: pal.bg }} />
                <i style={{ background: pal.accent }} />
                <b>{name}</b>
              </button>
            ))}
          </div>
          <Field label="Font">
            <select value={t.font} onChange={(e) => p.onTheme({ font: e.target.value }, 'font')} style={{ fontFamily: FONTS.find((f) => f.name === t.font)?.css }}>
              {FONTS.map((f) => (
                <option key={f.name} value={f.name}>{f.name}</option>
              ))}
            </select>
          </Field>
          <div className="colors">
            {(
              [['headerBg', 'Header'], ['headerText', 'Header text'], ['bannerBg', 'Banner'], ['bannerText', 'Banner text'], ['gridLine', 'Grid lines'], ['timeText', 'Time labels'], ['accent', 'Accent']] as [keyof Theme, string][]
            ).map(([k, label]) => (
              <label key={k} className="colorpick">
                <input type="color" value={t[k] as string} onChange={(e) => p.onTheme({ [k]: e.target.value }, 'c' + k)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="row">
            <Field label="Grid lines">
              <select value={t.gridStyle} onChange={(e) => p.onTheme({ gridStyle: e.target.value as Theme['gridStyle'] }, 'gs')}>
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="none">None</option>
              </select>
            </Field>
            <Field label="Banner">
              <select value={t.showBanner ? '1' : '0'} onChange={(e) => p.onTheme({ showBanner: e.target.value === '1' }, 'sb')}>
                <option value="1">Show</option>
                <option value="0">Hide</option>
              </select>
            </Field>
          </div>
          <Field label={`Corner radius (${t.radius}px)`}>
            <input type="range" min={0} max={24} value={t.radius} onChange={(e) => p.onTheme({ radius: +e.target.value }, 'radius')} />
          </Field>
        </div>
      )}
    </aside>
  )
}
