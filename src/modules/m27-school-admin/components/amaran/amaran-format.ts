/** S4 shared constants and helpers (SRS M27 Part B FR-M27-75, 76, 77). */

import { isApiError, RATE_LIMITED_MESSAGE_BM } from '@/api'

import type { LevelFilter, RiskStatus } from '../../api/amaran'

export const AMARAN_PATH = '/amaran/sekolah'
export const TITLE = 'Amaran Awal — Sekolah'

/** `?tingkatan=` accepts `T1` to `T5` (D101); anything else means all levels. */
export function normaliseLevel(value: unknown): LevelFilter | null {
  const v = Array.isArray(value) ? value[0] : value
  return typeof v === 'string' && /^T[1-5]$/.test(v) ? (v as LevelFilter) : null
}

/** "Semua Tingkatan" then one "Tingkatan n" per Tingkatan that has pupils (`levels` from the API, FR-AS-49). */
export function levelPills(levels: readonly number[]): ReadonlyArray<{ level: LevelFilter | null; label: string }> {
  return [
    { level: null, label: 'Semua Tingkatan' },
    ...[...new Set(levels)]
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5)
      .sort((a, b) => a - b)
      .map((n) => ({ level: `T${String(n)}` as LevelFilter, label: `Tingkatan ${String(n)}` })),
  ]
}

/** The cell text of a pupil with no practice data (FR-X4-3). */
export const NO_VALUE = '—'

/** "{n} pelajar belum mula (tiada data latihan)", the line under the tiles. */
export const notStartedLine = (n: number): string => `${String(n)} pelajar belum mula (tiada data latihan)`

export const STATUS_LABEL: Readonly<Record<RiskStatus, string>> = {
  on_track: 'On Track',
  watch: 'Perlu Perhatian',
  high: 'Berisiko Tinggi',
  not_started: 'Belum Bermula',
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
 *
 * Why the rest passes through: 403 renders the global page in place, and a 404, 409 or other business status carries
 * the API's own message, which the user can act on. It can still be English; that is accepted (DV-M27-26).
 */
export function loadErrorMessage(error: { message: string } | null | undefined): string {
  if (!isApiError(error)) return GENERIC_LOAD_ERROR
  const { status, message } = error
  if (status === 429) return RATE_LIMITED_MESSAGE_BM
  if (status === 0 || status >= 500 || status === 400 || status === 422) return GENERIC_LOAD_ERROR
  if (message === '' || /^HTTP \d+$/.test(message)) return GENERIC_LOAD_ERROR
  return message
}
