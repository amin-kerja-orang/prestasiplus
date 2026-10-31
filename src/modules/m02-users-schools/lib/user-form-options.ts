/**
 * S2 create user / S3 edit user lookups and helpers (SRS FR-M02-20…46; BR-01, BR-09; §6.13).
 * Full class strings live in the components (overview §8.2 rule 2); this file holds the finite lookups.
 */

import { isHttpMode } from '@/api/mode'
import type { Role } from '@/modules/m01-authentication'

import type { SubscriptionPackage } from '../api/users'

/** Re-exported for the M02 pages that already import it from here (defined once in `user-list.ts`). */
export { USERS_LIST_PATH } from './user-list'

export const USER_FORM_ROUTES = {
  create: 'm02.users.create',
  edit: 'm02.users.edit',
} as const

/** The 8 live roles, in the live select order (BR-01; "Pegawai JPN" is DV-M02-03 and also on S3). */
export const ROLE_OPTIONS: readonly { value: Role; label: string }[] = [
  { value: 'student', label: 'Pelajar' },
  { value: 'teacher', label: 'Guru' },
  { value: 'parent', label: 'Ibu Bapa' },
  { value: 'sponsor', label: 'Penaja' },
  { value: 'school_admin', label: 'Admin Sekolah' },
  { value: 'ppd_officer', label: 'Pegawai PPD' },
  { value: 'jpn_officer', label: 'Pegawai JPN' },
  { value: 'admin', label: 'Admin' },
]

/**
 * http mode (DV-M02-23): `jpn_officer` is not a role of the API contract (a "Pegawai JPN" is a `ppd_officer`
 * with a JPN scope), so create / update would answer 422. Mock mode keeps the live 8-role select.
 */
export function roleOptionsFor<T extends { value: string }>(
  options: readonly T[],
  http: boolean = isHttpMode(),
): readonly T[] {
  return http ? options.filter((o) => o.value !== 'jpn_officer') : options
}

/** BR-01: standard roles share the FR-M02-22 field set. */
const STANDARD_ROLES: readonly string[] = ['student', 'teacher', 'parent', 'sponsor', 'admin']

export function isStandardRole(role: string): role is Role {
  return STANDARD_ROLES.includes(role)
}

export function isOfficerRole(role: string): role is 'ppd_officer' | 'jpn_officer' {
  return role === 'ppd_officer' || role === 'jpn_officer'
}

export interface GradeOption {
  value: number
  label: string
}

/** FR-M02-23: Ting. 1-5 = grade 7-11. */
export const SECONDARY_GRADES: readonly GradeOption[] = [7, 8, 9, 10, 11].map((n) => ({
  value: n,
  label: `Ting. ${String(n - 6)}`,
}))

/** S3 school picker state select (§6.13 short labels); the value is the full state name the API filters by. */
export const STATE_FILTER_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '', label: 'Semua Negeri' },
  { value: 'Johor', label: 'Johor' },
  { value: 'Kedah', label: 'Kedah' },
  { value: 'Kelantan', label: 'Kelantan' },
  { value: 'Kuala Lumpur', label: 'KL' },
  { value: 'Labuan', label: 'Labuan' },
  { value: 'Melaka', label: 'Melaka' },
  { value: 'Negeri Sembilan', label: 'N. Sembilan' },
  { value: 'Pahang', label: 'Pahang' },
  { value: 'Perak', label: 'Perak' },
  { value: 'Perlis', label: 'Perlis' },
  { value: 'Pulau Pinang', label: 'P. Pinang' },
  { value: 'Putrajaya', label: 'Putrajaya' },
  { value: 'Sabah', label: 'Sabah' },
  { value: 'Sarawak', label: 'Sarawak' },
  { value: 'Selangor', label: 'Selangor' },
  { value: 'Terengganu', label: 'Terengganu' },
]

/** FR-M02-40 "Pakej Soalan" (DV-M02-14: `personal` is RM200). */
export const PACKAGE_OPTIONS: readonly { value: SubscriptionPackage; label: string }[] = [
  { value: 'none', label: 'Tiada (Percuma / Trial)' },
  { value: 'regular_monthly', label: 'Regular Bulanan — RM10/bulan (1 bulan)' },
  { value: 'personal', label: 'Personal Per Sesi — RM200 (hingga 10 Jan)' },
]

/** S3 "Nota Keselamatan" lines (§8). */
export const SECURITY_NOTES: readonly string[] = [
  'Pengguna akan menerima notifikasi jika maklumat akaun diubah',
  'Kata laluan boleh ditukar melalui bahagian "Tukar Kata Laluan"',
  'Perubahan peranan akan berkuat kuasa serta-merta',
  'Pengguna tidak aktif tidak boleh log masuk ke sistem',
]

/** Minimum characters that trigger a student / school search (FR-M02-25, 26, 27, 41, 42). */
export const SEARCH_MIN_CHARS = 2

/**
 * http mode (DV-M02-24): `GET /api/admin/students/search` answers `[]` below 3 characters (contract
 * `STUDENT_SEARCH_MIN_CHARS`), so the parent-student linker waits for 3. The school endpoints have no minimum.
 */
export const STUDENT_SEARCH_MIN_CHARS_HTTP = 3

export function studentSearchMinChars(http: boolean = isHttpMode()): number {
  return http ? STUDENT_SEARCH_MIN_CHARS_HTTP : SEARCH_MIN_CHARS
}

/**
 * BR-09 (INFERRED): lower-case the name, then upper-case every letter that starts the text or follows a
 * non-letter (space, bracket, hyphen, apostrophe, digit), so "(CINA)" becomes "(Cina)".
 */
export function titleCase(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(
      /(^|[^\p{L}])(\p{L})/gu,
      (_m, boundary: string, letter: string) => boundary + letter.toUpperCase(),
    )
}

/** BR-09 generator output: "Pentadbir " + the school name in Title Case. */
export function generatedAdminName(schoolName: string): string {
  return `Pentadbir ${titleCase(schoolName)}`
}

/** BR-09 generator output: lower-case school code + "@prestasiplus.my". */
export function generatedAdminEmail(code: string): string {
  return `${code.trim().toLowerCase()}@prestasiplus.my`
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

/** BR-33 `dd/mm/yyyy` in Asia/Kuala_Lumpur ("" for an unparsable value). */
export function formatDate(iso: string): string {
  const p = partsIn(iso)
  return p ? `${p.day ?? ''}/${p.month ?? ''}/${p.year ?? ''}` : ''
}

/** BR-33 `dd/mm/yyyy HH:mm` (24 h) in Asia/Kuala_Lumpur. */
export function formatDateTime(iso: string): string {
  const p = partsIn(iso)
  return p ? `${formatDate(iso)} ${p.hour ?? ''}:${p.minute ?? ''}` : ''
}

/** "{type} · {state} · {district}" with "·" only between the present values (FR-M02-41). */
export function schoolMeta(school: {
  type: string
  state: string
  district: string | null
}): string {
  return [school.type, school.state, school.district]
    .filter((v) => v !== null && v !== '')
    .join(' · ')
}
