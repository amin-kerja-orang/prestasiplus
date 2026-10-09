/** M25 API types (SRS M25 v1.2 §6.2, §7). */

export type HeatmapBand = 'red' | 'amber' | 'green'

/** DATA-M25-01 HeatmapTopic (derived, per request). */
export interface HeatmapTopic {
  chapterId: number
  name: string
  attempts: number
  correct: number
  /** Whole number 0-100, rounded half up (BR-M25-03). */
  percent: number
  band: HeatmapBand
}

/** DATA-M25-02 HeatmapSubject (derived, per request). */
export interface HeatmapSubject {
  subjectId: number
  name: string
  topics: HeatmapTopic[]
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
