/**
 * Copy and paths shared by the Command Center board S2 and the daily-activity board S3
 * (M17-T3b; SRS M17 §3 FR-M17-20..47, §3.2 FR-M17-101..118, §8). Exact BM copy of live S2 / S3; the school
 * view's copy is the SERVER-defined one (FR-M17-106, 116).
 */

import type { CcMood } from '../../api/command-center-board-types'

export const S2_COPY = {
  /** http mode, live-data not built yet (404): the demo has no live figures. */
  unavailable: 'Fungsi ini belum tersedia dalam demo',
  title: 'PrestasiPlus Command Center',
  back: '← Dashboard',
  daily: 'Aktiviti Harian',
  live: 'LIVE',
  tz: 'MYT',
  /** School view only (FR-M17-106 a). */
  schoolSub: 'Pemantauan langsung sekolah anda',
  footer:
    'Powered by ALESA AI · PrestasiPlus © 2026 · Dijana automatik · Data dikemaskini setiap 10 saat',
  loading: 'Memuatkan...',
  insightLoading: 'Memuatkan wawasan...',
  noData: 'Tiada data',
  noFeed: 'Tiada aktiviti terkini',
  placeholder: '--',
} as const

export const S3_COPY = {
  back: '◀ Command Center',
  report: 'Laporan Eksekutif',
  noData: 'Tiada data',
  noActivity: 'Tiada aktiviti',
  noSchools: 'Tiada aktiviti',
  noLogins: 'Tiada login',
  noBadges: 'Tiada badge baru',
  noDrill: 'Tiada data terperinci',
  loadFailed: 'Gagal memuatkan',
  drillFailed: 'Gagal',
  outsider: 'Pelajar Luar',
  seeAll: 'Lihat penuh →',
  empty: '-',
} as const

export const S3_TABS = [
  { period: 'today', label: 'Hari Ini', icon: 'i-ph-calendar-blank' },
  { period: 'week', label: 'Minggu Ini', icon: 'i-ph-calendar-dots' },
  { period: 'month', label: 'Bulan Ini', icon: 'i-ph-calendar' },
] as const

/** Poll intervals (FR-M17-21, FR-M17-36). */
export const S2_POLL_MS = 10_000
export const S3_POLL_MS = 30_000
/** A live-data request still running after this is aborted so the board keeps polling. */
export const S2_REQUEST_TIMEOUT_MS = 15_000
/** The counter animation (FR-M17-21). */
export const COUNT_UP_MS = 800

export const MOODS: readonly { key: CcMood; icon: string; label: string }[] = [
  { key: 'happy', icon: 'i-ph-smiley', label: 'Gembira' },
  { key: 'okay', icon: 'i-ph-smiley-meh', label: 'OK' },
  { key: 'sad', icon: 'i-ph-smiley-sad', label: 'Sedih' },
  { key: 'stressed', icon: 'i-ph-smiley-nervous', label: 'Tekanan' },
]

export interface BoardPaths {
  /** S2 of the scope. */
  board: string
  /** S3 of the scope. */
  daily: string
  /** "← Dashboard". */
  dashboard: string
  /**
   * S3 "Laporan Eksekutif" (S8, admin only). `null` until S8 is built: the link is not rendered
   * (SWEEP-23OCT D4, D9: it would be a dead link; DV-M17-45).
   */
  report: string | null
  /** Prefix of the drill-down S4-S7. */
  basePath: string
}

/** The links of the board pages for the admin (`alias` false) or the Admin Sekolah alias (FR-M17-112, 114). */
export function boardPaths(alias: boolean): BoardPaths {
  const basePath = alias ? '/admin-sekolah/command-center' : '/admin/command-center'
  return {
    board: basePath,
    daily: `${basePath}/daily-activity`,
    dashboard: alias ? '/admin-sekolah' : '/admin',
    report: null,
    basePath,
  }
}

/** Colour of a rank badge (top schools and pupils): the podium is primary, the rest neutral. */
export const rankColor = (index: number): 'primary' | 'neutral' =>
  index < 3 ? 'primary' : 'neutral'
