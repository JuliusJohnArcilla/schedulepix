export interface Theme {
  bg: string
  headerBg: string
  headerText: string
  bannerBg: string
  bannerText: string
  gridLine: string
  timeText: string
  accent: string
  font: string
  showBanner: boolean
  gridStyle: 'solid' | 'dashed' | 'none'
  radius: number
  borderWidth: number
  borderColor: string
}

export interface Settings {
  title: string
  subtitle: string
  days: string[]
  startHour: number
  endHour: number
  slotMinutes: number
  hourHeight: number
  dayWidth: number
  use24h: boolean
}

export interface Item {
  id: string
  day: number
  start: number // minutes from midnight
  dur: number // minutes
  title: string
  notes: string
  color: string
  imageId: string | null
  fit: 'cover' | 'contain'
  fontSize: number
}

/** Free-floating decorative image (not snapped to the grid). Coordinates are in schedule pixels. */
export interface Deco {
  id: string
  imageId: string
  x: number
  y: number
  w: number
  h: number
  rotation: number // degrees
  opacity: number // 0..1
  behind: boolean // drawn under events
}

export interface Doc {
  settings: Settings
  theme: Theme
  items: Item[]
  decos: Deco[]
}

export interface StoredImage {
  id: string
  name: string
  blob: Blob
  w: number
  h: number
}

export interface ImgEntry {
  id: string
  name: string
  url: string
  el: HTMLImageElement
  w: number
  h: number
}

export interface Placement {
  day: number
  start: number
  dur: number
}
