/**
 * Shared pieces of the video screens S17 to S20 (M09-T3; SRS M09 §3 FR-M09-76..92, §4 BR-M09-17/18,
 * §8 copy): exact BM copy, route paths, query helpers, client-side URL detection (BR-M09-17) and
 * error text. Pure, so it is unit-testable.
 */

import { isApiError } from '@/api'

import type { VideoCategory } from '../api/types'

export const VIDEO_PATH = '/video'
export const VIDEO_ADD_PATH = '/video/tambah'
export const videoPath = (id: number): string => `${VIDEO_PATH}/${String(id)}`
export const videoEditPath = (id: number): string => `${VIDEO_PATH}/${String(id)}/edit`

export const VIDEO_ROUTES = {
  list: 'video-list',
  detail: 'video-detail',
  add: 'video-add',
  edit: 'video-edit',
} as const

/** Exact tab titles and shell headers (URS FN-M09-6.1.1, 6.3.1, 6.4.1, 6.5.1). */
export const VIDEO_TITLES = {
  list: 'Video Pembelajaran - PRESTASIPLUS',
  detail: (title: string): string => `${title} - Video PRESTASIPLUS`,
  detailFallback: 'Video PRESTASIPLUS',
  add: 'Tambah Video',
  edit: (title: string): string => `Edit Video - ${title}`,
  editFallback: 'Edit Video',
} as const

export const COPY = {
  listTitle: 'Video Pembelajaran',
  listSubtitle: 'Tonton video motivasi, tutorial dan petua peperiksaan',
  searchPlaceholder: 'Cari video...',
  add: 'Tambah Video',
  all: 'Semua',
  resetSubject: 'Set Semula Subjek',
  emptyTitle: 'Tiada Video Dijumpai',
  emptyBody: 'Cuba ubah carian atau pilih kategori lain.',
  emptyAction: 'Lihat Semua Video',
  views: (n: number): string => `${String(n)} tontonan`,
  guestChip: 'VIDEO PEMBELAJARAN',
  guestHeading: 'Tonton & Fahami',
  guestBody: 'Tutorial, petua SPM, motivasi dan banyak lagi — semua dalam satu platform!',
  detailHeader: 'Video',
  allVideos: 'Semua Video',
  edit: 'Edit',
  remove: 'Padam',
  confirmDelete: 'Padam video ini?',
  related: 'Video Berkaitan',
  addHeaderSubtitle: 'Kongsi video pembelajaran dari YouTube, Vimeo dan lain-lain',
  addH1: 'Tambah Video Baru',
  addSub: 'Tampal sahaja pautan video — kami akan buat selebihnya',
  editHeader: 'Edit Video',
  editSub: 'Kemaskini maklumat video',
  urlLabel: 'URL Video',
  urlPlaceholder: 'https://www.youtube.com/watch?v=...',
  urlHint: 'Sokongan: YouTube, Vimeo, Dailymotion, TikTok, Facebook',
  detected: (label: string): string => `Platform dikesan: ${label}`,
  titleLabel: 'Tajuk Video',
  titlePlaceholder: 'Contoh: Petua Skor A+ Matematik SPM',
  descriptionLabel: 'Penerangan',
  descriptionPlaceholder: 'Terangkan secara ringkas tentang video ini...',
  optional: '(opsional)',
  categoryLabel: 'Kategori',
  categoryPlaceholder: 'Pilih kategori...',
  subjectLabel: 'Subjek',
  subjectNone: 'Tiada subjek khusus',
  visibilityLabel: 'Siapa boleh lihat?',
  visibilityGlobal: 'Semua Pengguna',
  visibilityGlobalHint: 'Boleh dilihat oleh semua',
  visibilitySchool: 'Sekolah Saya',
  visibilityNoSchool: 'Tiada sekolah',
  uploaderNote: 'Nama anda akan dipaparkan bersama video',
  publish: 'Terbitkan Video',
  save: 'Simpan Perubahan',
  cancel: 'Batal',
  genericError: 'Ralat berlaku. Sila cuba lagi.',
} as const

export const CATEGORY_OPTIONS: readonly { value: VideoCategory; label: string }[] = [
  { value: 'motivasi', label: 'Motivasi' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'tips-spm', label: 'Petua SPM' },
  { value: 'ceramah', label: 'Ceramah' },
  { value: 'lain-lain', label: 'Lain-lain' },
]

const CATEGORY_CODES = new Set<string>(CATEGORY_OPTIONS.map((o) => o.value))

export const isVideoCategory = (value: string): value is VideoCategory => CATEGORY_CODES.has(value)

/** First value of a vue-router query entry, or `''`. */
export function queryText(value: unknown): string {
  const first = Array.isArray(value) ? (value[0] as unknown) : value
  return typeof first === 'string' ? first : ''
}

/** `page` query: a positive integer, else 1. */
export function queryPage(value: unknown): number {
  const n = Number.parseInt(queryText(value), 10)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

/** `subject` query: a positive integer id, else `undefined`. */
export function querySubject(value: unknown): number | undefined {
  const text = queryText(value)
  if (!/^\d+$/.test(text)) return undefined
  const n = Number(text)
  return n >= 1 ? n : undefined
}

export interface VideoFilter {
  search: string
  category: VideoCategory | ''
  subject: number | undefined
}

/**
 * The pill and pager links (FR-M09-77/78/80). Orders are OBSERVED: category pills with an active
 * subject are `?subject=&category=`, subject pills with an active category are
 * `?category=&subject=`; `search` is kept last.
 */
export function listQuery(
  parts: { subject?: number | undefined; category?: string; search?: string },
  order: 'subject-first' | 'category-first',
): Record<string, string> {
  const subject = parts.subject === undefined ? '' : String(parts.subject)
  const category = parts.category ?? ''
  const out: Record<string, string> = {}
  const add = (key: string, value: string) => {
    if (value !== '') out[key] = value
  }
  if (order === 'subject-first') {
    add('subject', subject)
    add('category', category)
  } else {
    add('category', category)
    add('subject', subject)
  }
  add('search', parts.search?.trim() ?? '')
  return out
}

export function toSearchString(query: Record<string, string>): string {
  const text = new URLSearchParams(query).toString()
  return text === '' ? VIDEO_PATH : `${VIDEO_PATH}?${text}`
}

// --- URL detection (BR-M09-17, client side; the server derives the stored values itself) -------------

export interface DetectedPlatform {
  /** Chip / preview label ("YouTube"). */
  label: string
  thumbnailUrl: string | null
}

const YOUTUBE_PATTERNS = [
  /(?:^|\/\/)(?:www\.|m\.)?youtube\.com\/watch\?(?:[^#]*&)?v=([A-Za-z0-9_-]{11})/,
  /(?:^|\/\/)(?:www\.|m\.)?youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
  /(?:^|\/\/)(?:www\.|m\.)?youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  /(?:^|\/\/)youtu\.be\/([A-Za-z0-9_-]{11})/,
]

/** Platform detection of the S19/S20 preview; `null` for an unsupported URL (nothing is shown). */
export function detectPlatform(url: string): DetectedPlatform | null {
  const text = url.trim()
  for (const re of YOUTUBE_PATTERNS) {
    const id = re.exec(text)?.[1]
    if (id) {
      return { label: 'YouTube', thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg` }
    }
  }
  if (/vimeo\.com\/\d+/.test(text)) return { label: 'Vimeo', thumbnailUrl: null }
  const daily = /(?:dailymotion\.com\/video\/|dai\.ly\/)([A-Za-z0-9]+)/.exec(text)?.[1]
  if (daily) {
    return {
      label: 'Dailymotion',
      thumbnailUrl: `https://www.dailymotion.com/thumbnail/video/${daily}`,
    }
  }
  if (/tiktok\.com/.test(text)) return { label: 'TikTok', thumbnailUrl: null }
  if (/facebook\.com/.test(text) && /video/.test(text))
    return { label: 'Facebook', thumbnailUrl: null }
  return null
}

// --- errors ------------------------------------------------------------------------------------------

/** Red-alert lines of a failed call: field messages, else the API message, else the generic copy. */
export function errorLines(err: unknown): string[] {
  if (!isApiError(err) || err.status === 0 || err.code === 'NETWORK_ERROR') {
    return [COPY.genericError]
  }
  const fieldTexts = err.fields ? Object.values(err.fields) : []
  if (fieldTexts.length > 0) return [...new Set(fieldTexts)]
  if (err.message === '' || /^HTTP \d+$/.test(err.message)) return [COPY.genericError]
  return [err.message]
}

export function isStatus(err: unknown, status: number): boolean {
  return isApiError(err) && err.status === status
}

/** Server field messages by field name (empty when the error carries none). */
export function fieldErrors(err: unknown): Record<string, string> {
  return isApiError(err) && err.fields ? { ...err.fields } : {}
}
