import type { Doc, Item, Settings, Theme } from './types'

export const TIME_W = 64
export const HEADER_H = 40
export const BANNER_H = 88
export const ITEM_PAD = 6

export const FONTS = [
  { name: 'Inter', css: '"Inter", system-ui, sans-serif' },
  { name: 'Poppins', css: '"Poppins", system-ui, sans-serif' },
  { name: 'Playfair Display', css: '"Playfair Display", Georgia, serif' },
  { name: 'Caveat', css: '"Caveat", cursive' },
  { name: 'Roboto Mono', css: '"Roboto Mono", monospace' },
  { name: 'Georgia', css: 'Georgia, serif' },
]
export const fontCss = (name: string) => (FONTS.find((f) => f.name === name) ?? FONTS[0]).css

export const PALETTES: Record<string, Omit<Theme, 'font' | 'showBanner' | 'gridStyle' | 'radius' | 'borderWidth' | 'borderColor'>> = {
  Clean: { bg: '#ffffff', headerBg: '#f1f5f9', headerText: '#0f172a', bannerBg: '#1e293b', bannerText: '#ffffff', gridLine: '#cbd5e1', timeText: '#64748b', accent: '#3b82f6' },
  Dark: { bg: '#111827', headerBg: '#1f2937', headerText: '#f9fafb', bannerBg: '#030712', bannerText: '#f9fafb', gridLine: '#374151', timeText: '#9ca3af', accent: '#8b5cf6' },
  Pastel: { bg: '#fffaf5', headerBg: '#fde7ef', headerText: '#5b3a4a', bannerBg: '#f9c6d8', bannerText: '#5b3a4a', gridLine: '#f0d9e0', timeText: '#a07d8b', accent: '#f4a6c0' },
  Warm: { bg: '#fdf6e3', headerBg: '#eee0bd', headerText: '#4a3b1e', bannerBg: '#b45309', bannerText: '#fffbeb', gridLine: '#e2d3a8', timeText: '#7c6a3c', accent: '#d97706' },
  Forest: { bg: '#f4faf5', headerBg: '#d9eddc', headerText: '#14351c', bannerBg: '#14532d', bannerText: '#f0fdf4', gridLine: '#bcd9c2', timeText: '#4b7556', accent: '#16a34a' },
}

export const SWATCHES = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b']

export function defaultDoc(): Doc {
  return {
    settings: {
      title: 'My Schedule',
      subtitle: '',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      startHour: 8,
      endHour: 18,
      slotMinutes: 30,
      hourHeight: 64,
      dayWidth: 170,
      use24h: false,
    },
    theme: { ...PALETTES.Clean, font: 'Inter', showBanner: true, gridStyle: 'solid', radius: 8, borderWidth: 0, borderColor: '#334155' },
    items: [],
    decos: [],
  }
}

export const uid = () => crypto.randomUUID()

export function geometry(s: Settings, t: Theme) {
  const bannerH = t.showBanner ? BANNER_H : 0
  const gridTop = bannerH + HEADER_H
  const ppm = s.hourHeight / 60
  const width = TIME_W + s.days.length * s.dayWidth
  const height = gridTop + (s.endHour - s.startHour) * s.hourHeight
  return { bannerH, gridTop, ppm, width, height }
}
export type Geo = ReturnType<typeof geometry>

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function itemRect(day: number, start: number, dur: number, lane: number, lanes: number, s: Settings, g: Geo): Rect {
  const colW = s.dayWidth / lanes
  return {
    x: TIME_W + day * s.dayWidth + lane * colW + 2,
    y: g.gridTop + (start - s.startHour * 60) * g.ppm + 1,
    w: colW - 4,
    h: dur * g.ppm - 2,
  }
}

export function assignLanes(items: Item[]) {
  const out = new Map<string, { lane: number; lanes: number }>()
  const byDay = new Map<number, Item[]>()
  for (const it of items) {
    const list = byDay.get(it.day) ?? []
    list.push(it)
    byDay.set(it.day, list)
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.start - b.start || b.dur - a.dur)
    let cluster: Item[] = []
    let laneEnds: number[] = []
    let clusterEnd = -1
    const flush = () => {
      for (const c of cluster) out.get(c.id)!.lanes = laneEnds.length
      cluster = []
      laneEnds = []
    }
    for (const it of list) {
      if (cluster.length && it.start >= clusterEnd) flush()
      let lane = laneEnds.findIndex((e) => e <= it.start)
      if (lane < 0) {
        lane = laneEnds.length
        laneEnds.push(0)
      }
      laneEnds[lane] = it.start + it.dur
      clusterEnd = Math.max(cluster.length ? clusterEnd : -1, it.start + it.dur)
      out.set(it.id, { lane, lanes: 1 })
      cluster.push(it)
    }
    flush()
  }
  return out
}

export function formatTime(min: number, use24h: boolean) {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  if (use24h) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`
}

export const toTimeInput = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
export const fromTimeInput = (v: string) => {
  const [h, m] = v.split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null
}

export function textColorFor(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return '#000'
  const n = parseInt(m[1], 16)
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.6 ? '#111827' : '#ffffff'
}

/** Clamp every item into the valid grid range (after settings change). */
export function normalize(doc: Doc): Doc {
  const s = doc.settings
  const lo = s.startHour * 60
  const hi = s.endHour * 60
  const maxDay = s.days.length - 1
  return {
    ...doc,
    items: doc.items.map((it) => {
      const dur = Math.min(Math.max(it.dur, s.slotMinutes), hi - lo)
      const start = Math.min(Math.max(it.start, lo), hi - dur)
      const day = Math.min(Math.max(it.day, 0), maxDay)
      return dur === it.dur && start === it.start && day === it.day ? it : { ...it, dur, start, day }
    }),
  }
}

// ---- Shared text layout (DOM + canvas render the same lines) ----
let mctx: CanvasRenderingContext2D | null = null
const measure = () => (mctx ??= document.createElement('canvas').getContext('2d')!)

export interface TextLine {
  text: string
  y: number
  font: string
  muted: boolean
}

function wrap(ctx: CanvasRenderingContext2D, text: string, font: string, maxW: number): string[] {
  ctx.font = font
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? line + ' ' + word : word
      if (line && ctx.measureText(test).width > maxW) {
        out.push(line)
        line = word
      } else line = test
    }
    out.push(line)
  }
  return out.filter((l, i) => l || i < out.length - 1)
}

export function itemText(it: Item, w: number, h: number, fontName: string, use24h: boolean) {
  const ctx = measure()
  const fam = fontCss(fontName)
  const fs = it.fontSize
  const lh = Math.round(fs * 1.25)
  const maxW = w - ITEM_PAD * 2
  const lines: TextLine[] = []
  let y = ITEM_PAD
  const push = (text: string, font: string, muted: boolean) => {
    if (y + lh > h - 2) return
    lines.push({ text, y, font, muted })
    y += lh
  }
  const timeText = `${formatTime(it.start, use24h)} – ${formatTime(it.start + it.dur, use24h)}`
  const timeFont = `400 ${Math.max(9, fs - 2)}px ${fam}`
  ctx.font = timeFont
  if (h >= 44 && ctx.measureText(timeText).width <= maxW) push(timeText, timeFont, true)
  const tf = `600 ${fs}px ${fam}`
  if (it.title) for (const l of wrap(ctx, it.title, tf, maxW)) push(l, tf, false)
  const nf = `400 ${Math.max(9, fs - 1)}px ${fam}`
  if (it.notes) for (const l of wrap(ctx, it.notes, nf, maxW)) push(l, nf, true)
  return { lines, lh, stripH: lines.length ? y + 2 : 0 }
}
