/**
 * S1 user list lookups (SRS FR-M02-02, 03, 06; BR-01) and helpers. Full class strings live here as
 * finite lookup maps (overview §8.2 rule 2).
 */

import {
  Landmark,
  GraduationCap,
  HeartHandshake,
  Presentation,
  School,
  ShieldCheck,
  Users,
} from '@lucide/vue'
import type { Component } from 'vue'

import { isApiError } from '@/api'

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

const BADGE_BASE = 'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap'

const ROLE_BADGE: Record<string, string> = {
  student: 'bg-blue-100 text-blue-700',
  teacher: 'bg-purple-100 text-purple-700',
  parent: 'bg-amber-100 text-amber-700',
  sponsor: 'bg-emerald-100 text-emerald-700',
  school_admin: 'bg-teal-100 text-teal-700',
  ppd_officer: 'bg-cyan-100 text-cyan-700',
  admin: 'bg-red-100 text-red-700',
  jpn_officer: 'bg-slate-100 text-slate-700',
}

export function roleBadgeClass(role: string): string {
  return `${BADGE_BASE} ${ROLE_BADGE[role] ?? ROLE_BADGE.jpn_officer}`
}

/** A role outside the 8 codes (`unmapped`) shows its raw text, as live shows a raw code. */
export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}

export interface StatCardDef {
  role: keyof typeof ROLE_LABELS
  key: keyof RoleCounts
  label: string
  icon: Component
  tone: string
}

/** The 7 stat cards in live order (FR-M02-02). */
export const STAT_CARDS: readonly StatCardDef[] = [
  {
    role: 'student',
    key: 'student',
    label: 'Pelajar',
    icon: GraduationCap,
    tone: 'bg-blue-100 text-blue-600',
  },
  {
    role: 'teacher',
    key: 'teacher',
    label: 'Guru',
    icon: Presentation,
    tone: 'bg-purple-100 text-purple-600',
  },
  {
    role: 'parent',
    key: 'parent',
    label: 'Ibu Bapa',
    icon: Users,
    tone: 'bg-amber-100 text-amber-600',
  },
  {
    role: 'sponsor',
    key: 'sponsor',
    label: 'Penaja',
    icon: HeartHandshake,
    tone: 'bg-emerald-100 text-emerald-600',
  },
  {
    role: 'school_admin',
    key: 'schoolAdmin',
    label: 'Admin Sekolah',
    icon: School,
    tone: 'bg-teal-100 text-teal-600',
  },
  {
    role: 'ppd_officer',
    key: 'ppdOfficer',
    label: 'Pegawai PPD',
    icon: Landmark,
    tone: 'bg-cyan-100 text-cyan-600',
  },
  {
    role: 'admin',
    key: 'admin',
    label: 'Admin',
    icon: ShieldCheck,
    tone: 'bg-red-100 text-red-600',
  },
]

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
