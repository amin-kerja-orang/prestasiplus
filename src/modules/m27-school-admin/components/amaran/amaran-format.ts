/** S4 shared constants and helpers (SRS M27 Part B FR-M27-75, 76, 77). */

import { isApiError, RATE_LIMITED_MESSAGE_BM } from '@/api'

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

export const keberkesananHref = '/amaran/keberkesanan'
export const ringkasanHref = (schoolId: number): string =>
  `/amaran/ringkasan-eksekutif?scope=school&school_id=${String(schoolId)}`
export const csvHref = (schoolId: number): string => `/amaran/export/school/${String(schoolId)}`

export const GENERIC_LOAD_ERROR = 'Ralat berlaku. Sila cuba lagi.'

/**
 * The line a failed S4 load shows next to "Cuba Semula" (SW11-08, DV-M27-26), the same rule as M18's
 * `loadErrorMessage`: chosen by status, never by the server's text, which can be English or raw ("Internal server
 * error", "Failed to fetch", "HTTP 503"). A network failure (status 0 or a plain `Error`), a 5xx and a 400 / 422
 * show the generic BM line; a 429 the BM rate-limit line; another status keeps the server's message unless it is
 * empty or the bare "HTTP {status}".
 */
export function loadErrorMessage(error: { message: string } | null | undefined): string {
  if (!isApiError(error)) return GENERIC_LOAD_ERROR
  const { status, message } = error
  if (status === 429) return RATE_LIMITED_MESSAGE_BM
  if (status === 0 || status >= 500 || status === 400 || status === 422) return GENERIC_LOAD_ERROR
  if (message === '' || /^HTTP \d+$/.test(message)) return GENERIC_LOAD_ERROR
  return message
}
