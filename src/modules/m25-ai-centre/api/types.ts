/** M25 API types (SRS M25 v1.2 §6.2, §7). */

export type HeatmapBand = 'red' | 'amber' | 'green'

/** Tile state: a band, or `belum-cuba` (a chapter with no attempt). */
export type HeatmapState = HeatmapBand | 'belum-cuba'

/** API-DSKP-08 tile (mirrors `HeatmapChapter` of `@pp/contract`): one chapter (Bab) of a practised subject. */
export interface HeatmapChapter {
  id: string
  /** Bab number; null for a tile with none (listed after the numbered ones). */
  number: number | null
  name: string
  attempts: number
  correct: number
  /** 100 x correct / attempts to one decimal; null when `attempts` is 0. */
  accuracy: number | null
  state: HeatmapState
}

/** API-DSKP-08 subject block (mirrors `HeatmapSubject`). `code` is the subject code for the tile link (Q-1). */
export interface HeatmapSubject {
  id: string
  code: string
  name: string
  chapters: HeatmapChapter[]
}

/** #1 `GET /api/buku-nota/heatmap`. */
export interface HeatmapResponse {
  subjects: HeatmapSubject[]
}

/** DutaCard (owned by M24; M06 #21 serves it provisionally). */
export interface DutaCard {
  slug: string
  name: string
  initials: string
  tier: 'bintang' | 'inspirasi' | 'tetamu'
  tagline: string
  subject: string
  state: string
  rating: number
  active: boolean
}
