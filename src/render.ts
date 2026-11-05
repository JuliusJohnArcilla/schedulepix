import type { Deco, Doc, ImgEntry, Item } from './types'
import {
  HEADER_H, ITEM_PAD, TIME_W, assignLanes, fontCss, formatTime, geometry, itemRect, itemText, textColorFor,
  type Geo, type Rect,
} from './model'

/** Draws everything except items: background, banner, header, grid, time labels. */
export function drawBackground(ctx: CanvasRenderingContext2D, doc: Doc, g: Geo, fillBg: boolean) {
  const { settings: s, theme: t } = doc
  const fam = fontCss(t.font)
  ctx.textBaseline = 'middle'
  if (fillBg) {
    ctx.fillStyle = t.bg
    ctx.fillRect(0, 0, g.width, g.height)
  }
  if (t.showBanner) {
    ctx.fillStyle = t.bannerBg
    ctx.fillRect(0, 0, g.width, g.bannerH)
    ctx.fillStyle = t.bannerText
    ctx.textAlign = 'left'
    ctx.font = `700 30px ${fam}`
    ctx.fillText(s.title, 24, g.bannerH / 2 - (s.subtitle ? 12 : 0), g.width - 48)
    if (s.subtitle) {
      ctx.globalAlpha = 0.8
      ctx.font = `400 15px ${fam}`
      ctx.fillText(s.subtitle, 24, g.bannerH / 2 + 18, g.width - 48)
      ctx.globalAlpha = 1
    }
  }
  // header row
  ctx.fillStyle = t.headerBg
  ctx.fillRect(0, g.bannerH, g.width, HEADER_H)
  ctx.fillStyle = t.headerText
  ctx.textAlign = 'center'
  ctx.font = `600 14px ${fam}`
  s.days.forEach((d, i) => ctx.fillText(d, TIME_W + i * s.dayWidth + s.dayWidth / 2, g.bannerH + HEADER_H / 2, s.dayWidth - 8))
  // grid lines
  const rows = ((s.endHour - s.startHour) * 60) / s.slotMinutes
  const slotH = s.slotMinutes * g.ppm
  ctx.strokeStyle = t.gridLine
  ctx.lineWidth = 1
  ctx.setLineDash(t.gridStyle === 'dashed' ? [5, 4] : [])
  if (t.gridStyle !== 'none') {
    for (let r = 0; r <= rows; r++) {
      const y = Math.round(g.gridTop + r * slotH) + 0.5
      ctx.globalAlpha = (r * s.slotMinutes) % 60 === 0 ? 1 : 0.4
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(g.width, y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    for (let d = 0; d <= s.days.length; d++) {
      const x = Math.round(TIME_W + d * s.dayWidth) + 0.5
      ctx.beginPath()
      ctx.moveTo(x, g.gridTop)
      ctx.lineTo(x, g.height)
      ctx.stroke()
    }
  }
  ctx.setLineDash([])
  // time labels
  ctx.fillStyle = t.timeText
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.font = `500 12px ${fam}`
  for (let h = s.startHour; h < s.endHour; h++) {
    ctx.fillText(formatTime(h * 60, s.use24h), TIME_W - 8, g.gridTop + (h - s.startHour) * s.hourHeight + 5)
  }
  ctx.textBaseline = 'middle'
}

function drawImageFit(ctx: CanvasRenderingContext2D, img: HTMLImageElement, r: Rect, fit: 'cover' | 'contain') {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (!iw || !ih) return
  const k = fit === 'cover' ? Math.max(r.w / iw, r.h / ih) : Math.min(r.w / iw, r.h / ih)
  const dw = iw * k
  const dh = ih * k
  ctx.drawImage(img, r.x + (r.w - dw) / 2, r.y + (r.h - dh) / 2, dw, dh)
}

export function drawItem(ctx: CanvasRenderingContext2D, it: Item, r: Rect, doc: Doc, images: Record<string, ImgEntry>) {
  const { theme: t, settings: s } = doc
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(r.x, r.y, r.w, r.h, t.radius)
  ctx.clip()
  ctx.fillStyle = it.color
  ctx.fillRect(r.x, r.y, r.w, r.h)
  const img = it.imageId ? images[it.imageId]?.el : undefined
  if (img) drawImageFit(ctx, img, r, it.fit)
  const txt = itemText(it, r.w, r.h, t.font, s.use24h)
  if (img && txt.stripH) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(r.x, r.y, r.w, txt.stripH)
  }
  ctx.fillStyle = img ? '#ffffff' : textColorFor(it.color)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  for (const l of txt.lines) {
    ctx.font = l.font
    ctx.globalAlpha = l.muted ? 0.8 : 1
    // center glyphs in the line box, matching the DOM's line-height layout
    ctx.fillText(l.text, r.x + ITEM_PAD, r.y + l.y + (txt.lh - parseFloat(/(\d+(?:\.\d+)?)px/.exec(l.font)![1])) / 2)
  }
  ctx.restore()
}

export function drawDecos(ctx: CanvasRenderingContext2D, decos: Deco[], images: Record<string, ImgEntry>) {
  for (const d of decos) {
    const img = images[d.imageId]?.el
    if (!img) continue
    ctx.save()
    ctx.globalAlpha = d.opacity
    ctx.translate(d.x + d.w / 2, d.y + d.h / 2)
    ctx.rotate((d.rotation * Math.PI) / 180)
    ctx.drawImage(img, -d.w / 2, -d.h / 2, d.w, d.h)
    ctx.restore()
  }
}

export interface ExportOpts {
  format: 'png' | 'jpeg'
  scale: number
  transparent: boolean
  quality: number
}

const MAX_DIM = 16384
const MAX_AREA = 120_000_000

export function effectiveScale(g: Geo, scale: number) {
  return Math.min(scale, MAX_DIM / g.width, MAX_DIM / g.height, Math.sqrt(MAX_AREA / (g.width * g.height)))
}

export async function exportImage(doc: Doc, images: Record<string, ImgEntry>, o: ExportOpts): Promise<Blob> {
  const css = fontCss(doc.theme.font)
  await Promise.all([`400 16px ${css}`, `500 16px ${css}`, `600 16px ${css}`, `700 16px ${css}`].map((f) => document.fonts.load(f).catch(() => [])))
  const g = geometry(doc.settings, doc.theme)
  const scale = effectiveScale(g, o.scale)
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(g.width * scale)
  canvas.height = Math.floor(g.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  drawBackground(ctx, doc, g, o.format === 'jpeg' || !o.transparent)
  drawDecos(ctx, doc.decos.filter((d) => d.behind), images)
  const lanes = assignLanes(doc.items)
  for (const it of doc.items) {
    const l = lanes.get(it.id)!
    drawItem(ctx, it, itemRect(it.day, it.start, it.dur, l.lane, l.lanes, doc.settings, g), doc, images)
  }
  drawDecos(ctx, doc.decos.filter((d) => !d.behind), images)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image is too large for this browser to export. Try a smaller scale.'))), `image/${o.format}`, o.quality),
  )
}
