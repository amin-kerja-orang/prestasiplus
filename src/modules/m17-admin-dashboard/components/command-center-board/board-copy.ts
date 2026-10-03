/**
 * Copy, paths and class strings shared by the Command Center board S2 and the daily-activity board S3
 * (M17-T3b; SRS M17 §3 FR-M17-20..47, §3.2 FR-M17-101..118, §8). Exact BM copy of live S2 / S3; the school
 * view's copy is the SERVER-defined one (FR-M17-106, 116).
 */

import type { CcMood } from '../../api/command-center-board-types'

export const S2_COPY = {
  title: 'PrestasiPlus Command Center',
  back: '← Dashboard',
  daily: '📊 Aktiviti Harian',
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
  noSchools: '😴 Tiada aktiviti',
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
  { period: 'today', label: '📅 Hari Ini' },
  { period: 'week', label: '📆 Minggu Ini' },
  { period: 'month', label: '🗓️ Bulan Ini' },
] as const

/** Poll intervals (FR-M17-21, FR-M17-36). */
export const S2_POLL_MS = 10_000
export const S3_POLL_MS = 30_000
/** A live-data request still running after this is aborted so the board keeps polling. */
export const S2_REQUEST_TIMEOUT_MS = 15_000
/** The counter animation (FR-M17-21). */
export const COUNT_UP_MS = 800

export const MOODS: readonly { key: CcMood; emoji: string; label: string }[] = [
  { key: 'happy', emoji: '😊', label: 'Gembira' },
  { key: 'okay', emoji: '😐', label: 'OK' },
  { key: 'sad', emoji: '😢', label: 'Sedih' },
  { key: 'stressed', emoji: '😩', label: 'Tekanan' },
]

export interface BoardPaths {
  /** S2 of the scope. */
  board: string
  /** S3 of the scope. */
  daily: string
  /** "← Dashboard". */
  dashboard: string
  /** S3 "Laporan Eksekutif" (S8, admin only: absent in the alias). */
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
    report: alias ? null : '/admin/laporan-eksekutif',
    basePath,
  }
}

export type BoardAccent = 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'violet'

export const ACCENT_EDGE: Record<BoardAccent, string> = {
  indigo: 'border-t-indigo-500',
  emerald: 'border-t-emerald-500',
  amber: 'border-t-amber-500',
  rose: 'border-t-rose-500',
  cyan: 'border-t-cyan-500',
  violet: 'border-t-violet-500',
}
export const ACCENT_TEXT: Record<BoardAccent, string> = {
  indigo: 'text-indigo-300',
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  rose: 'text-rose-400',
  cyan: 'text-cyan-400',
  violet: 'text-violet-400',
}

/** Rank badge classes (top schools r1-r5, top pupils rank-1..3 then rank-n). */
export const RANK_BADGE: readonly string[] = [
  'bg-amber-400 text-slate-900',
  'bg-slate-300 text-slate-900',
  'bg-amber-600 text-white',
  'bg-slate-700 text-slate-200',
  'bg-slate-700 text-slate-200',
]

export const MEDALS: readonly string[] = ['🥇', '🥈', '🥉']
