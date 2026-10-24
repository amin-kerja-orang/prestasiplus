/**
 * S1 user list lookups (SRS FR-M02-02, 03, 06; BR-01) and helpers. Full class strings live here as
 * finite lookup maps (overview §8.2 rule 2).
 */

import { isApiError } from '@/api'
import { isHttpMode } from '@/api/mode'

import type { AdminUserRole, RoleCounts } from '../api/users'

export const USERS_LIST_PATH = '/admin/users'

export const USER_ROUTES = { list: 'm02.users.list' } as const

/** S1 role badge and "Peranan" filter labels (BR-01; DV-M02-03 "Pegawai JPN"). */
export const ROLE_LABELS: Record<string, string> = {
  student: 'Pelajar',
  teacher: 'Guru',
  parent: 'Ibu Bapa',
  sponsor: 'Penaja',
  school_admin: 'Admin Sekolah',
  ppd_officer: 'Pegawai PPD',
  jpn_officer: 'Pegawai JPN',
  admin: 'Admin',
}

/** "Peranan" filter options after "Semua Peranan" (FR-M02-03). */
export const ROLE_FILTER_OPTIONS: readonly { value: AdminUserRole; label: string }[] = [
  { value: 'student', label: 'Pelajar' },
  { value: 'teacher', label: 'Guru' },
  { value: 'parent', label: 'Ibu Bapa' },
  { value: 'sponsor', label: 'Penaja' },
  { value: 'school_admin', label: 'Admin Sekolah' },
  { value: 'ppd_officer', label: 'Pegawai PPD' },
  { value: 'jpn_officer', label: 'Pegawai JPN' },
  { value: 'admin', label: 'Admin' },
]

/** "Peranan" filter options for the mode: no "Pegawai JPN" in http mode (DV-M02-23, not a contract role). */
export function roleFilterOptionsFor(
  http: boolean = isHttpMode(),
): readonly { value: AdminUserRole; label: string }[] {
  return http ? ROLE_FILTER_OPTIONS.filter((o) => o.value !== 'jpn_officer') : ROLE_FILTER_OPTIONS
}

/** A role outside the 8 codes (`unmapped`) shows its raw text, as live shows a raw code. */
export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}

export interface StatCardDef {
  role: keyof typeof ROLE_LABELS
  key: keyof RoleCounts
  label: string
  /** Phosphor icon class (staff theme). */
  icon: string
}

/** The 7 stat cards in live order (FR-M02-02). */
export const STAT_CARDS: readonly StatCardDef[] = [
  {
    role: 'student',
    key: 'student',
    label: 'Pelajar',
    icon: 'i-ph-graduation-cap',
  },
  {
    role: 'teacher',
    key: 'teacher',
    label: 'Guru',
    icon: 'i-ph-chalkboard-teacher',
  },
  {
    role: 'parent',
    key: 'parent',
    label: 'Ibu Bapa',
    icon: 'i-ph-users',
  },
  {
    role: 'sponsor',
    key: 'sponsor',
    label: 'Penaja',
    icon: 'i-ph-handshake',
  },
  {
    role: 'school_admin',
    key: 'schoolAdmin',
    label: 'Admin Sekolah',
    icon: 'i-ph-buildings',
  },
  {
    role: 'ppd_officer',
    key: 'ppdOfficer',
    label: 'Pegawai PPD',
    icon: 'i-ph-bank',
  },
  {
    role: 'admin',
    key: 'admin',
    label: 'Admin',
    icon: 'i-ph-shield-check',
  },
]

/** Up to two initials, from the first two words ("Admin PRESTASI+" -> "AP"). */
export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
  const letters = words.slice(0, 2).map((word) => word.charAt(0).toLocaleUpperCase('ms-MY'))
  return letters.join('') || '?'
}

/** ISO 8601 (+08:00) to `dd/mm/yyyy`, read off the string so the viewer's zone never shifts the day. */
export function formatUserDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

/** Shown only when the request produced no usable message. INFERRED copy (as M01/M02 schools). */
export const GENERIC_ERROR = 'Ralat berlaku. Sila cuba lagi.'

export function errorLines(err: unknown): string[] {
  if (!isApiError(err)) return [GENERIC_ERROR]
  if (err.status === 0 || err.code === 'NETWORK_ERROR') return [GENERIC_ERROR]
  const fieldTexts = err.fields ? Object.values(err.fields) : []
  if (fieldTexts.length > 0) return [...new Set(fieldTexts)]
  if (err.message === '' || /^HTTP \d+$/.test(err.message)) return [GENERIC_ERROR]
  return [err.message]
}
