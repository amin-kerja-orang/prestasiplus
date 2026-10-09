/**
 * CSV exports of S6 and S7 (SRS BR-M27-40; endpoints #17, #18; SEC-M27-09).
 *
 * Columns `id,name,email,role,sekolah,kelas,is_active,created_at`; the school's users with the page's role
 * that match `is_active` and `search`, ordered by id; UTF-8 with BOM first, comma separator; a cell starting
 * with `=`, `+`, `-`, `@`, tab or carriage return gets a leading `'`. No IC, no phone.
 */

import type { UserRow } from '@/modules/m01-authentication/mock'

import { activeClassNamesOf, type SchoolRole } from './school-people'
import { filteredUsers, type UserListQuery } from './users-list'
import { schoolRowOf, type SchoolViewer } from './school-scope'

export const CSV_BOM = '﻿'
export const CSV_COLUMNS = [
  'id',
  'name',
  'email',
  'role',
  'sekolah',
  'kelas',
  'is_active',
  'created_at',
] as const

/** SEC-M27-09 / M18 SEC-M18-03: a formula trigger is neutralised with a leading apostrophe. */
export function sanitizeCsvCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

/** One CSV field: sanitised, and quoted when it holds a comma, quote or line break. */
export function csvField(value: string | number | boolean | null): string {
  const text = sanitizeCsvCell(value === null ? '' : String(value))
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const ROLE_WORD: Readonly<Record<SchoolRole, string>> = { student: 'pelajar', teacher: 'guru' }

/** The file body (BOM first, CRLF-free `\n` rows, trailing newline). */
export function usersCsv(
  viewer: SchoolViewer,
  role: SchoolRole,
  query: Pick<UserListQuery, 'isActive' | 'search'>,
): string {
  const school = schoolRowOf(viewer).name
  const rows: UserRow[] = filteredUsers(viewer.schoolId, role, query).sort((a, b) => a.id - b.id)
  const lines = [CSV_COLUMNS.join(',')]
  for (const u of rows) {
    lines.push(
      [
        u.id,
        u.name,
        u.email,
        ROLE_WORD[role],
        school,
        role === 'student' ? activeClassNamesOf(u.id).join(', ') : '',
        u.isActive ? 1 : 0,
        u.createdAt,
      ]
        .map(csvField)
        .join(','),
    )
  }
  return `${CSV_BOM}${lines.join('\n')}\n`
}

/** `users-pelajar-{yyyy-mm-dd}.csv` / `users-guru-{yyyy-mm-dd}.csv` (the clock date). */
export const csvFilename = (role: SchoolRole, dateKey: string): string =>
  `users-${ROLE_WORD[role]}-${dateKey}.csv`
