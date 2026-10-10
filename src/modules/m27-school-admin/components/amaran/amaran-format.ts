/** S4 shared constants and helpers (SRS M27 Part B FR-M27-75, 76, 77). */

import type { LevelFilter, RiskStatus } from '../../api/amaran'

export const AMARAN_PATH = '/amaran/sekolah'
export const TITLE = 'Amaran Awal — Sekolah'

/** `?tingkatan=` accepts `T4` and `T5` only; anything else means all levels. */
export function normaliseLevel(value: unknown): LevelFilter | null {
  const v = Array.isArray(value) ? value[0] : value
  return v === 'T4' || v === 'T5' ? v : null
}

export const LEVEL_PILLS: ReadonlyArray<{ level: LevelFilter | null; label: string }> = [
  { level: null, label: 'Semua Tingkatan' },
  { level: 'T4', label: 'Tingkatan 4' },
  { level: 'T5', label: 'Tingkatan 5' },
]

export const STATUS_LABEL: Readonly<Record<RiskStatus, string>> = {
  on_track: 'On Track',
  watch: 'Perlu Perhatian',
  high: 'Berisiko Tinggi',
}

export const STATUS_BADGE: Readonly<Record<RiskStatus, string>> = {
  on_track: 'bg-emerald-100 text-emerald-700',
  watch: 'bg-amber-100 text-amber-800',
  high: 'bg-red-100 text-red-700',
}

export const BUTTON_CLASS =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors'

export const keberkesananHref = '/amaran/keberkesanan'
export const ringkasanHref = (schoolId: number): string =>
  `/amaran/ringkasan-eksekutif?scope=school&school_id=${String(schoolId)}`
export const csvHref = (schoolId: number): string => `/amaran/export/school/${String(schoolId)}`
