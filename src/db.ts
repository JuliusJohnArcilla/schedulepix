import { openDB } from 'idb'
import type { Doc, StoredImage } from './types'
import { defaultDoc, uid } from './model'

const dbp = openDB('schedulepix', 1, {
  upgrade(db) {
    db.createObjectStore('kv')
    db.createObjectStore('images', { keyPath: 'id' })
  },
})

export async function loadDoc(): Promise<Doc | null> {
  const d = (await (await dbp).get('kv', 'doc')) as Doc | undefined
  if (!d) return null
  const def = defaultDoc()
  return { settings: { ...def.settings, ...d.settings }, theme: { ...def.theme, ...d.theme }, items: d.items ?? [], decos: d.decos ?? [] }
}
export const saveDoc = async (doc: Doc) => void (await (await dbp).put('kv', doc, 'doc'))
export const loadImages = async () => (await (await dbp).getAll('images')) as StoredImage[]
export const putImage = async (img: StoredImage) => void (await (await dbp).put('images', img))
export const delImage = async (id: string) => void (await (await dbp).delete('images', id))
export async function clearAll() {
  const db = await dbp
  await db.clear('kv')
  await db.clear('images')
}

const MAX_SIDE = 1600

/** Decode, downscale to MAX_SIDE, re-encode. Keeps memory and storage small. */
export async function processFile(file: File): Promise<StoredImage> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const iw = img.naturalWidth || 800
    const ih = img.naturalHeight || 800
    const k = Math.min(1, MAX_SIDE / Math.max(iw, ih))
    const w = Math.max(1, Math.round(iw * k))
    const h = Math.max(1, Math.round(ih * k))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d')!.drawImage(img, 0, 0, w, h)
    const keepAlpha = /png|gif|svg|webp/.test(file.type)
    const blob = await new Promise<Blob>((res, rej) =>
      c.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), keepAlpha ? 'image/png' : 'image/jpeg', 0.88),
    )
    return { id: uid(), name: file.name.replace(/\.[^.]+$/, ''), blob, w, h }
  } finally {
    URL.revokeObjectURL(url)
  }
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsDataURL(b)
  })

export async function makeBackup(doc: Doc, images: StoredImage[]) {
  const imgs = await Promise.all(images.map(async (i) => ({ id: i.id, name: i.name, w: i.w, h: i.h, data: await blobToDataUrl(i.blob) })))
  return new Blob([JSON.stringify({ app: 'schedulepix', version: 1, doc, images: imgs })], { type: 'application/json' })
}

export async function parseBackup(file: File): Promise<{ doc: Doc; images: StoredImage[] }> {
  const j = JSON.parse(await file.text())
  if (j?.app !== 'schedulepix' || !j.doc) throw new Error('Not a SchedulePix backup file.')
  const def = defaultDoc()
  const doc: Doc = { settings: { ...def.settings, ...j.doc.settings }, theme: { ...def.theme, ...j.doc.theme }, items: j.doc.items ?? [], decos: j.doc.decos ?? [] }
  const images: StoredImage[] = await Promise.all(
    (j.images ?? []).map(async (i: { id: string; name: string; w: number; h: number; data: string }) => ({
      id: i.id, name: i.name, w: i.w, h: i.h, blob: await (await fetch(i.data)).blob(),
    })),
  )
  return { doc, images }
}
