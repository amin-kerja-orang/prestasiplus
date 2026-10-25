/**
 * Shared lookups and helpers of the M27 user-management screens S6, S7, S9 to S12 (SRS M27 Part B
 * FR-M27-88 to 110, 117 to 120; BR-M27-36). Paths and copy live here once; pages and components import them.
 */

import { isApiError } from '@/api'
import { isHttpMode } from '@/api/mode'
import { diffForHumans } from '@/lib/time'

import type { SchoolInfo } from '../../api/school-admin'

export type SchoolUserRole = 'student' | 'teacher'

export const PUPIL_LIST_PATH = '/admin-sekolah/pelajar'
export const TEACHER_LIST_PATH = '/admin-sekolah/guru'
export const PUPIL_CREATE_PATH = `${PUPIL_LIST_PATH}/baru`
export const TEACHER_CREATE_PATH = `${TEACHER_LIST_PATH}/baru`
export const DASHBOARD_PATH = '/admin-sekolah'

interface RoleConfig {
  listPath: string
  /** Screen title of the list (breadcrumb current item and header). */
  listTitle: string
  /** The single count card label. */
  cardLabel: string
  /** Prefix of the `data-testid`s. */
  testid: string
}

export const ROLE_CONFIG: Record<SchoolUserRole, RoleConfig> = {
  student: {
    listPath: PUPIL_LIST_PATH,
    listTitle: 'Senarai Pelajar',
    cardLabel: 'Pelajar',
    testid: 'sp',
  },
  teacher: {
    listPath: TEACHER_LIST_PATH,
    listTitle: 'Senarai Guru',
    cardLabel: 'Guru',
    testid: 'sg',
  },
}

/** Shown only when the request produced no usable message (as M01/M02; INFERRED copy). */
/** Placeholder of an admin-chosen new password: the mock accepts 6, the real API 8 (contract PASSWORD_MIN_LENGTH). */
export const newPasswordPlaceholder = (): string =>
  isHttpMode() ? 'Minimum 8 aksara' : 'Minimum 6 aksara'

export const GENERIC_ERROR = 'Ralat berlaku. Sila cuba lagi.'

/** The API's generic English defaults (api-error.ts): never shown in the BM UI (SWE). */
const GENERIC_SERVER_TEXTS: readonly string[] = [
  'server error',
  'not found',
  'this action is unauthorized',
  'unauthenticated',
  'conflict',
  'the given data was invalid',
  'payload too large',
]

function isGenericServerText(message: string): boolean {
  return GENERIC_SERVER_TEXTS.includes(message.trim().replace(/\.$/, '').toLowerCase())
}

/** One line per validation error, or the server message (FR-M27-48: no M27 copy of its own). */
export function errorLines(err: unknown): string[] {
  if (!isApiError(err)) return [GENERIC_ERROR]
  if (err.status === 0 || err.code === 'NETWORK_ERROR') return [GENERIC_ERROR]
  const fieldTexts = err.fields ? Object.values(err.fields) : []
  if (fieldTexts.length > 0) return [...new Set(fieldTexts)]
  if (
    err.message === '' ||
    /^HTTP \d+$/.test(err.message) ||
    err.status >= 500 ||
    isGenericServerText(err.message)
  ) {
    return [GENERIC_ERROR]
  }
  return [err.message]
}

function partsIn(iso: string): Record<string, string> | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const out: Record<string, string> = {}
  for (const part of new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)) {
    out[part.type] = part.value
  }
  return out
}

/** BR-M27-39 `dd/mm/yyyy` in Asia/Kuala_Lumpur ("" for an unparsable value). */
export function formatDate(iso: string): string {
  const p = partsIn(iso)
  return p ? `${p.day ?? ''}/${p.month ?? ''}/${p.year ?? ''}` : ''
}

/** `dd/mm/yyyy HH:mm` (24 h) in Asia/Kuala_Lumpur. */
export function formatDateTime(iso: string): string {
  const p = partsIn(iso)
  return p ? `${formatDate(iso)} ${p.hour ?? ''}:${p.minute ?? ''}` : ''
}

/** Counts use the `ms-MY` separator (BR-M27-39). */
export const formatCount = (n: number): string => n.toLocaleString('ms-MY')

/** BR-M27-36 "Login Terakhir": the M17 relative time of `lastLoginAt`, "Belum login" when null. */
export function lastLoginText(iso: string | null): string {
  return iso === null ? 'Belum login' : diffForHumans(iso)
}

/** "{code} · {district} · {state}" with "·" only between the present parts (FR-M27-108, 117). */
export function schoolMeta(school: Pick<SchoolInfo, 'code' | 'district' | 'state'>): string {
  return [school.code, school.district, school.state].filter((v) => v !== null && v !== '').join(' · ')
}

/** Phone cell: "-" when empty (BR-M27-36). */
export const phoneText = (phone: string | null): string =>
  phone === null || phone === '' ? '-' : phone

export const LABEL = 'mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700'
export const BUTTON_BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'
export const BUTTON_PRIMARY = `${BUTTON_BASE} bg-indigo-600 text-white shadow hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50`
export const BUTTON_CANCEL = `${BUTTON_BASE} bg-slate-100 text-slate-600 hover:bg-slate-200`
