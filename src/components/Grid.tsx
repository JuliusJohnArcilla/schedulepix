import { useEffect, useRef, useState, type RefObject } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Deco, Doc, ImgEntry, Item, Placement } from '../types'
import { assignLanes, geometry, itemRect, itemText, textColorFor, type Geo, type Rect } from '../model'
import { drawBackground } from '../render'

interface ItemViewProps {
  item: Item
  rect: Rect
  doc: Doc
  g: Geo
  img?: ImgEntry
  selected: boolean
  onSelect: () => void
  onDur: (dur: number) => void
}

function ItemView({ item, rect, doc, g, img, selected, onSelect, onDur }: ItemViewProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: 'item:' + item.id, data: { type: 'item', itemId: item.id } })
  const { theme: t, settings: s } = doc
  const txt = itemText(item, rect.w, rect.h, t.font, s.use24h)
  const resize = useRef<{ y: number; dur: number } | null>(null)
  const fg = img ? '#fff' : textColorFor(item.color)

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={'item' + (selected ? ' selected' : '') + (isDragging ? ' dragging' : '')}
      style={{
        left: rect.x, top: rect.y, width: rect.w, height: rect.h,
        background: item.color, borderRadius: t.radius, color: fg,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      {img && <img src={img.url} alt="" draggable={false} style={{ objectFit: item.fit }} />}
      {img && txt.stripH > 0 && <div className="strip" style={{ height: txt.stripH }} />}
      {txt.lines.map((l, i) => (
        <div key={i} className="line" style={{ top: l.y, left: 6, font: l.font, lineHeight: txt.lh + 'px', opacity: l.muted ? 0.8 : 1 }}>
          {l.text}
        </div>
      ))}
      <div
        className="resize"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          e.stopPropagation()
          e.currentTarget.setPointerCapture(e.pointerId)
          resize.current = { y: e.clientY, dur: item.dur }
          onSelect()
        }}
        onPointerMove={(e) => {
          const r = resize.current
          if (!r) return
          const raw = r.dur + (e.clientY - r.y) / g.ppm
          const snapped = Math.round(raw / s.slotMinutes) * s.slotMinutes
          const max = s.endHour * 60 - item.start
          onDur(Math.max(s.slotMinutes, Math.min(snapped, max)))
        }}
        onPointerUp={() => (resize.current = null)}
        onPointerCancel={() => (resize.current = null)}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

interface DecoViewProps {
  deco: Deco
  img?: ImgEntry
  selected: boolean
  onSelect: () => void
  onChange: (patch: Partial<Deco>, key: string) => void
}

type DecoOp = { kind: 'resize' | 'rotate'; cx: number; cy: number; d0: number; w: number; h: number; mx: number; my: number }

function DecoView({ deco, img, selected, onSelect, onChange }: DecoViewProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: 'deco:' + deco.id, data: { type: 'deco', decoId: deco.id } })
  const box = useRef<HTMLDivElement | null>(null)
  const op = useRef<DecoOp | null>(null)
  const stop = { onMouseDown: (e: React.MouseEvent) => e.stopPropagation(), onTouchStart: (e: React.TouchEvent) => e.stopPropagation() }

  const begin = (kind: 'resize' | 'rotate') => (e: React.PointerEvent) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    // the bounding box of a rotated element is centered on the element's own center
    const r = box.current!.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    op.current = { kind, cx, cy, d0: Math.hypot(e.clientX - cx, e.clientY - cy) || 1, w: deco.w, h: deco.h, mx: deco.x + deco.w / 2, my: deco.y + deco.h / 2 }
  }
  const move = (e: React.PointerEvent) => {
    const o = op.current
    if (!o) return
    if (o.kind === 'resize') {
      const k = Math.max(24 / Math.min(o.w, o.h), Math.hypot(e.clientX - o.cx, e.clientY - o.cy) / o.d0)
      const w = o.w * k
      const h = o.h * k
      onChange({ w, h, x: o.mx - w / 2, y: o.my - h / 2 }, 'resize')
    } else {
      let a = (Math.atan2(e.clientY - o.cy, e.clientX - o.cx) * 180) / Math.PI + 90
      a = ((a % 360) + 360) % 360
      const snap = Math.round(a / 15) * 15
      if (Math.abs(a - snap) < 4) a = snap % 360
      onChange({ rotation: Math.round(a) }, 'rotate')
    }
  }
  const end = () => (op.current = null)
  const handle = (kind: 'resize' | 'rotate') => ({
    ...stop,
    onPointerDown: begin(kind),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
  })

  return (
    <div
      ref={(n) => {
        box.current = n
        setNodeRef(n)
      }}
      {...attributes}
      {...listeners}
      className={'deco' + (selected ? ' selected' : '') + (isDragging ? ' dragging' : '')}
      style={{
        left: deco.x, top: deco.y, width: deco.w, height: deco.h, opacity: deco.opacity,
        transform: `${transform ? `translate3d(${transform.x}px, ${transform.y}px, 0) ` : ''}rotate(${deco.rotation}deg)`,
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      {img && <img src={img.url} alt="" draggable={false} />}
      {selected && (
        <>
          <div className="deco-rotate" title="Rotate" {...handle('rotate')} />
          <div className="deco-resize" title="Resize" {...handle('resize')} />
        </>
      )}
    </div>
  )
}

interface GridProps {
  doc: Doc
  images: Record<string, ImgEntry>
  selectedId: string | null
  preview: Placement | null
  gridRef: RefObject<HTMLDivElement | null>
  wsBg: string
  onSelect: (id: string | null, kind?: 'item' | 'deco') => void
  onDecoChange: (id: string, patch: Partial<Deco>, key: string) => void
  onDur: (id: string, dur: number) => void
  onCreateAt: (day: number, start: number) => void
}

export function Grid({ doc, images, selectedId, preview, gridRef, wsBg, onSelect, onDur, onDecoChange, onCreateAt }: GridProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [fontTick, setFontTick] = useState(0)
  const g = geometry(doc.settings, doc.theme)
  const lanes = assignLanes(doc.items)

  useEffect(() => {
    void document.fonts.ready.then(() => setFontTick((n) => n + 1))
    const on = () => setFontTick((n) => n + 1)
    document.fonts.addEventListener('loadingdone', on)
    return () => document.fonts.removeEventListener('loadingdone', on)
  }, [])

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.ceil(g.width * dpr)
    c.height = Math.ceil(g.height * dpr)
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    drawBackground(ctx, doc, g, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.settings, doc.theme, fontTick])

  const slot = doc.settings.slotMinutes
  const pr = preview ? itemRect(preview.day, preview.start, preview.dur, 0, 1, doc.settings, g) : null

  return (
    <div className="grid-scroll" style={{ background: wsBg }} onClick={() => onSelect(null)}>
      <div
        ref={gridRef}
        className="grid-surface"
        style={{ width: g.width, height: g.height }}
        onDoubleClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const x = e.clientX - r.left - 64
          const y = e.clientY - r.top - g.gridTop
          if (x < 0 || y < 0) return
          const day = Math.min(doc.settings.days.length - 1, Math.floor(x / doc.settings.dayWidth))
          const min = doc.settings.startHour * 60 + Math.floor(y / g.ppm / slot) * slot
          onCreateAt(day, min)
        }}
      >
        <canvas ref={canvas} style={{ width: g.width, height: g.height }} />
        {doc.decos.filter((d) => d.behind).map((d) => (
          <DecoView key={d.id} deco={d} img={images[d.imageId]} selected={d.id === selectedId} onSelect={() => onSelect(d.id, 'deco')} onChange={(p, k) => onDecoChange(d.id, p, k)} />
        ))}
        {doc.items.map((it) => {
          const l = lanes.get(it.id)!
          return (
            <ItemView
              key={it.id}
              item={it}
              rect={itemRect(it.day, it.start, it.dur, l.lane, l.lanes, doc.settings, g)}
              doc={doc}
              g={g}
              img={it.imageId ? images[it.imageId] : undefined}
              selected={it.id === selectedId}
              onSelect={() => onSelect(it.id, 'item')}
              onDur={(d) => onDur(it.id, d)}
            />
          )
        })}
        {doc.decos.filter((d) => !d.behind).map((d) => (
          <DecoView key={d.id} deco={d} img={images[d.imageId]} selected={d.id === selectedId} onSelect={() => onSelect(d.id, 'deco')} onChange={(p, k) => onDecoChange(d.id, p, k)} />
        ))}
        {pr && <div className="ghost" style={{ left: pr.x, top: pr.y, width: pr.w, height: pr.h, borderRadius: doc.theme.radius }} />}
      </div>
    </div>
  )
}
