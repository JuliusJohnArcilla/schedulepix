import { useCallback, useEffect, useRef, useState } from 'react'
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, type Active } from '@dnd-kit/core'
import type { Deco, Doc, ImgEntry, Item, Placement, Settings, StoredImage, Theme } from './types'
import { defaultDoc, geometry, normalize, TIME_W, uid } from './model'
import { clearAll, delImage, loadDoc, loadImages, makeBackup, parseBackup, processFile, putImage, saveDoc } from './db'
import { useHistory } from './history'
import { Tray } from './components/Tray'
import { Grid } from './components/Grid'
import { Inspector, type Tab } from './components/Inspector'
import { ExportDialog } from './components/ExportDialog'

async function toEntry(si: StoredImage): Promise<ImgEntry> {
  const url = URL.createObjectURL(si.blob)
  const el = new Image()
  el.src = url
  await el.decode().catch(() => undefined)
  return { id: si.id, name: si.name, url, el, w: si.w, h: si.h }
}

function pointerOf(e: Event): { x: number; y: number } {
  if ('touches' in e && (e as TouchEvent).touches.length) {
    const t = (e as TouchEvent).touches[0]
    return { x: t.clientX, y: t.clientY }
  }
  const m = e as MouseEvent
  return { x: m.clientX, y: m.clientY }
}

export default function App() {
  const h = useHistory()
  const doc = h.doc
  const [images, setImages] = useState<Record<string, ImgEntry>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('schedule')
  const [preview, setPreview] = useState<Placement | null>(null)
  const [activeImg, setActiveImg] = useState<ImgEntry | null>(null)
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState('')
  const gridRef = useRef<HTMLDivElement>(null)
  const loaded = useRef(false)
  const backupInput = useRef<HTMLInputElement>(null)
  const shiftRef = useRef(false)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  )

  const flash = useCallback((m: string) => {
    setNotice(m)
    setTimeout(() => setNotice((n) => (n === m ? '' : n)), 4000)
  }, [])

  // ---- load ----
  useEffect(() => {
    void (async () => {
      try {
        const [d, imgs] = await Promise.all([loadDoc(), loadImages()])
        const entries = await Promise.all(imgs.map(toEntry))
        setImages(Object.fromEntries(entries.map((e) => [e.id, e])))
        h.reset(d ?? defaultDoc())
      } catch {
        h.reset(defaultDoc())
        flash('Could not read saved data; starting fresh.')
      }
      loaded.current = true
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- autosave ----
  useEffect(() => {
    if (!doc || !loaded.current) return
    const t = setTimeout(() => void saveDoc(doc).catch(() => flash('Auto-save failed. Use Backup to keep your work.')), 400)
    return () => clearTimeout(t)
  }, [doc, flash])

  // ---- keyboard ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (typing && el.tagName !== 'SELECT') return
        e.preventDefault()
        if (e.shiftKey) h.redo()
        else h.undo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (typing) return
        e.preventDefault()
        h.redo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !typing) {
        e.preventDefault()
        if (doc?.decos.some((d) => d.id === selectedId)) removeDeco(selectedId)
        else removeItem(selectedId)
      }
    }
    const onShift = (e: KeyboardEvent) => (shiftRef.current = e.shiftKey)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keydown', onShift)
    window.addEventListener('keyup', onShift)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keydown', onShift)
      window.removeEventListener('keyup', onShift)
    }
  })

  if (!doc) return <div className="loading">Loading…</div>

  const g = geometry(doc.settings, doc.theme)
  const slot = doc.settings.slotMinutes
  const selected = doc.items.find((i) => i.id === selectedId) ?? null
  const selectedDeco = doc.decos.find((d) => d.id === selectedId) ?? null

  // ---- mutations ----
  function select(id: string | null, kind: 'item' | 'deco' = 'item') {
    setSelectedId(id)
    if (id) setTab(kind)
    else if (tab === 'item' || tab === 'deco') setTab('schedule')
  }
  const updateItem = (id: string, patch: Partial<Item>, key: string) =>
    h.commit((d) => normalize({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }), `item:${id}:${key}`)
  function removeItem(id: string) {
    h.commit((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }))
    setSelectedId(null)
    setTab('schedule')
  }
  function addItem(partial: Partial<Item> & Pick<Item, 'day' | 'start'>) {
    const it: Item = {
      dur: Math.max(slot, 60), title: 'New event', notes: '', color: doc!.theme.accent,
      imageId: null, fit: 'cover', fontSize: 13, ...partial, id: uid(),
    }
    h.commit((d) => normalize({ ...d, items: [...d.items, it] }))
    select(it.id)
  }
  const updateDeco = (id: string, patch: Partial<Deco>, key: string) =>
    h.commit((d) => ({ ...d, decos: d.decos.map((x) => (x.id === id ? { ...x, ...patch } : x)) }), `deco:${id}:${key}`)
  function removeDeco(id: string) {
    h.commit((d) => ({ ...d, decos: d.decos.filter((x) => x.id !== id) }))
    setSelectedId(null)
    setTab('schedule')
  }
  function addDeco(imageId: string, cx: number, cy: number) {
    const img = images[imageId]
    if (!img) return
    const w = Math.min(160, Math.max(48, img.w))
    const hh = w * (img.h / img.w)
    const dc: Deco = {
      id: uid(), imageId, w, h: hh,
      x: Math.min(Math.max(cx - w / 2, -w / 2), g.width - w / 2),
      y: Math.min(Math.max(cy - hh / 2, -hh / 2), g.height - hh / 2),
      rotation: 0, opacity: 1, behind: false,
    }
    h.commit((d) => ({ ...d, decos: [...d.decos, dc] }))
    select(dc.id, 'deco')
  }
  function decoAction(a: 'delete' | 'duplicate' | 'forward' | 'back') {
    const dc = selectedDeco
    if (!dc) return
    if (a === 'delete') return removeDeco(dc.id)
    if (a === 'duplicate') {
      const copy = { ...dc, id: uid(), x: dc.x + 20, y: dc.y + 20 }
      h.commit((d) => ({ ...d, decos: [...d.decos, copy] }))
      return select(copy.id, 'deco')
    }
    h.commit((d) => {
      const arr = [...d.decos]
      const i = arr.findIndex((x) => x.id === dc.id)
      const j = a === 'forward' ? i + 1 : i - 1
      if (j < 0 || j >= arr.length) return d
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return { ...d, decos: arr }
    })
  }
  const updateSettings = (patch: Partial<Settings>, key: string) =>
    h.commit((d) => normalize({ ...d, settings: { ...d.settings, ...patch } }), 'settings:' + key)
  const updateTheme = (patch: Partial<Theme>, key: string) => h.commit((d) => ({ ...d, theme: { ...d.theme, ...patch } }), 'theme:' + key)

  // ---- images ----
  async function addFiles(files: File[]) {
    const ok = files.filter((f) => f.type.startsWith('image/'))
    if (ok.length < files.length) flash('Some files were skipped (not images).')
    for (const f of ok) {
      try {
        const si = await processFile(f)
        await putImage(si)
        const e = await toEntry(si)
        setImages((m) => ({ ...m, [e.id]: e }))
      } catch {
        flash(`Could not read "${f.name}".`)
      }
    }
  }
  async function deleteImage(id: string) {
    const used = doc!.items.some((i) => i.imageId === id) || doc!.decos.some((x) => x.imageId === id)
    if (used && !confirm('This image is used on the schedule. Delete it and remove it from there?')) return
    await delImage(id)
    URL.revokeObjectURL(images[id]?.url)
    setImages((m) => {
      const { [id]: _gone, ...rest } = m
      return rest
    })
    h.commit((d) => ({ ...d, decos: d.decos.filter((x) => x.imageId !== id), items: d.items.map((i) => (i.imageId === id ? { ...i, imageId: null } : i)) }))
  }

  // ---- drag & drop ----
  function placementFor(e: { active: Active; delta: { x: number; y: number }; activatorEvent: Event }): Placement | null {
    const grid = gridRef.current
    const data = e.active.data.current as { type: 'image' | 'item' | 'deco'; itemId?: string } | undefined
    if (!grid || !data || data.type === 'deco') return null
    const s = doc!.settings
    const maxStart = (dur: number) => s.endHour * 60 - dur
    const snap = (m: number) => Math.round(m / slot) * slot
    if (data.type === 'item') {
      const it = doc!.items.find((i) => i.id === data.itemId)
      if (!it) return null
      const day = Math.min(s.days.length - 1, Math.max(0, it.day + Math.round(e.delta.x / s.dayWidth)))
      const start = Math.min(maxStart(it.dur), Math.max(s.startHour * 60, it.start + snap(e.delta.y / g.ppm)))
      return { day, start, dur: it.dur }
    }
    if (!shiftRef.current) return null // plain image drops become free decorations, not grid events
    const p0 = pointerOf(e.activatorEvent)
    const px = p0.x + e.delta.x
    const py = p0.y + e.delta.y
    const r = grid.getBoundingClientRect()
    const x = px - r.left - TIME_W
    const y = py - r.top - g.gridTop
    if (x < 0 || y < 0 || px > r.right || py > r.bottom) return null
    const dur = Math.min(Math.max(slot, 60), (s.endHour - s.startHour) * 60)
    const day = Math.min(s.days.length - 1, Math.floor(x / s.dayWidth))
    const start = Math.min(maxStart(dur), s.startHour * 60 + Math.floor(y / g.ppm / slot) * slot)
    return { day, start, dur }
  }

  const dragProps = {
    sensors,
    autoScroll: false,
    onDragStart: (e: { active: Active }) => {
      const d = e.active.data.current as { type: string; imageId?: string; itemId?: string }
      if (d.type === 'image') setActiveImg(images[d.imageId!] ?? null)
      else if (d.type === 'deco') select((d as { decoId?: string }).decoId!, 'deco')
      else if (d.itemId) select(d.itemId)
    },
    onDragMove: (e: Parameters<typeof placementFor>[0]) => setPreview(placementFor(e)),
    onDragCancel: () => {
      setPreview(null)
      setActiveImg(null)
    },
    onDragEnd: (e: Parameters<typeof placementFor>[0]) => {
      const d = e.active.data.current as { type: string; imageId?: string; itemId?: string; decoId?: string }
      const pl = placementFor(e)
      setPreview(null)
      setActiveImg(null)
      if (d.type === 'deco') {
        const dc = doc!.decos.find((x) => x.id === d.decoId)
        if (dc) {
          const nx = Math.min(Math.max(dc.x + e.delta.x, -dc.w / 2), g.width - dc.w / 2)
          const ny = Math.min(Math.max(dc.y + e.delta.y, -dc.h / 2), g.height - dc.h / 2)
          updateDeco(dc.id, { x: nx, y: ny }, 'move')
        }
        return
      }
      if (d.type === 'image' && !shiftRef.current) {
        const r = gridRef.current?.getBoundingClientRect()
        const p0 = pointerOf(e.activatorEvent)
        const px = p0.x + e.delta.x
        const py = p0.y + e.delta.y
        if (r && px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) addDeco(d.imageId!, px - r.left, py - r.top)
        return
      }
      if (!pl) return
      if (d.type === 'item') updateItem(d.itemId!, { day: pl.day, start: pl.start }, 'move')
      else {
        const img = images[d.imageId!]
        addItem({ day: pl.day, start: pl.start, dur: pl.dur, imageId: d.imageId!, title: img?.name ?? 'Event', color: doc!.theme.accent })
      }
    },
  }

  // ---- file ops ----
  async function backup() {
    const stored = await loadImages()
    const blob = await makeBackup(doc!, stored)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${doc!.settings.title || 'schedule'}-backup.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }
  async function restore(file: File) {
    try {
      const { doc: d, images: imgs } = await parseBackup(file)
      await clearAll()
      for (const i of imgs) await putImage(i)
      Object.values(images).forEach((i) => URL.revokeObjectURL(i.url))
      const entries = await Promise.all(imgs.map(toEntry))
      setImages(Object.fromEntries(entries.map((e) => [e.id, e])))
      h.reset(normalize(d))
      setSelectedId(null)
      flash('Backup loaded.')
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not load backup.')
    }
  }
  async function startNew() {
    if (!confirm('Start a new schedule? This clears the current schedule and all uploaded images (make a backup first if you want to keep them).')) return
    await clearAll()
    Object.values(images).forEach((i) => URL.revokeObjectURL(i.url))
    setImages({})
    h.reset(defaultDoc())
    setSelectedId(null)
  }

  return (
    <div className="app">
      <header className="topbar">
        <strong className="brand">SchedulePix</strong>
        <div className="spacer" />
        <button className="btn" onClick={h.undo} disabled={!h.canUndo} title="Undo (Ctrl+Z)">↶ Undo</button>
        <button className="btn" onClick={h.redo} disabled={!h.canRedo} title="Redo (Ctrl+Y)">↷ Redo</button>
        <button className="btn" onClick={() => addItem({ day: 0, start: doc.settings.startHour * 60 })}>+ Event</button>
        <button className="btn" onClick={() => void backup()}>Backup</button>
        <button className="btn" onClick={() => backupInput.current?.click()}>Load</button>
        <button className="btn" onClick={() => void startNew()}>New</button>
        <input
          ref={backupInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void restore(f)
            e.target.value = ''
          }}
        />
        <button className="btn primary" onClick={() => setExporting(true)}>Export…</button>
      </header>
      {notice && <div className="notice" role="status">{notice}</div>}
      <DndContext {...dragProps}>
        <main className="workspace">
          <Tray images={Object.values(images)} onAdd={(f) => void addFiles(f)} onDelete={(id) => void deleteImage(id)} onEvent={(id) => addItem({ day: 0, start: doc.settings.startHour * 60, imageId: id, title: images[id]?.name ?? 'Event' })} />
          <Grid
            doc={doc}
            images={images}
            selectedId={selectedId}
            preview={preview}
            gridRef={gridRef}
            onSelect={select}
            onDur={(id, dur) => updateItem(id, { dur }, 'resize')}
            onDecoChange={updateDeco}
            onCreateAt={(day, start) => addItem({ day, start })}
          />
          <Inspector
            tab={tab}
            setTab={setTab}
            doc={doc}
            images={Object.values(images)}
            selected={selected}
            selectedDeco={selectedDeco}
            onDeco={(patch, key) => selectedDeco && updateDeco(selectedDeco.id, patch, key)}
            onDecoAction={decoAction}
            onItem={(patch, key) => selected && updateItem(selected.id, patch, key)}
            onDeleteItem={() => selected && removeItem(selected.id)}
            onDuplicateItem={() => selected && addItem({ ...selected, start: Math.min(selected.start + selected.dur, doc.settings.endHour * 60 - selected.dur) })}
            onSettings={updateSettings}
            onTheme={updateTheme}
          />
        </main>
        <DragOverlay dropAnimation={null}>{activeImg && <img className="drag-img" src={activeImg.url} alt="" />}</DragOverlay>
      </DndContext>
      {exporting && <ExportDialog doc={doc as Doc} images={images} onClose={() => setExporting(false)} />}
    </div>
  )
}
