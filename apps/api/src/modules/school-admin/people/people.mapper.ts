import {
  SCHOOL_ADMIN_USER_CSV_COLUMNS,
  type SchoolAdminPupilRow,
  type SchoolAdminSchoolInfo,
  type SchoolAdminTeacherRow,
  type SchoolAdminUserDetail,
  type SchoolAdminUserRole,
} from '@pp/contract'

import { toMytTimestamp } from '../../../common/time/myt'
import type { SchoolRow } from '../../schools'
import type { UserRecord } from '../../users'
import { toCsv } from '../csv'

/** Pure mapping of users to the contract shapes. No IC number, no IC hash, no username and no password ever leaves here. */

/** First letters of the first two words, upper case; "?" for an empty name. */
export const initialsOf = (name: string): string =>
  [
    ...name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => [...w][0]?.toUpperCase() ?? '')
      .join(''),
  ]
    .slice(0, 2)
    .join('') || '?'

/** "Darjah n" (grades 1 to 6), "Tingkatan n" (grades 7 to 11 are Tingkatan 1 to 5), else null. */
export function gradeLabel(grade: number | null): string | null {
  if (grade === null || !Number.isInteger(grade)) return null
  if (grade >= 1 && grade <= 6) return `Darjah ${String(grade)}`
  if (grade >= 7 && grade <= 11) return `Tingkatan ${String(grade - 6)}`
  return null
}

/** The state a school admin sees: a suspended account is shown as inactive (BE-21 OQ-8). */
export const isEffectivelyActive = (u: Pick<UserRecord, 'isActive' | 'isSuspended'>): boolean => u.isActive && !u.isSuspended

export function toSchoolInfo(s: SchoolRow): SchoolAdminSchoolInfo {
  return { id: s.id, name: s.name, code: s.code && s.code.trim() !== '' ? s.code : null, district: s.district, state: s.state ?? '' }
}

export function toTeacherRow(u: UserRecord, classCount: number): SchoolAdminTeacherRow {
  const active = isEffectivelyActive(u)
  return {
    id: u.id,
    name: u.name,
    initials: initialsOf(u.name),
    email: u.email ?? '',
    phone: u.phone,
    classCount,
    lastLoginAt: u.lastLoginAt ? toMytTimestamp(u.lastLoginAt) : null,
    isActive: active,
    createdAt: toMytTimestamp(u.createdAt),
    canEdit: active,
  }
}

export function toPupilRow(u: UserRecord, classNames: readonly string[]): SchoolAdminPupilRow {
  const active = isEffectivelyActive(u)
  return {
    id: u.id,
    name: u.name,
    initials: initialsOf(u.name),
    email: u.email ?? '',
    phone: u.phone,
    gradeLabel: gradeLabel(u.grade),
    classNames: [...classNames],
    isActive: active,
    createdAt: toMytTimestamp(u.createdAt),
    canEdit: active,
  }
}

export function toUserDetail(u: UserRecord, role: SchoolAdminUserRole, school: SchoolRow): SchoolAdminUserDetail {
  return {
    id: u.id,
    name: u.name,
    email: u.email ?? '',
    phone: u.phone,
    isActive: isEffectivelyActive(u),
    createdAt: toMytTimestamp(u.createdAt),
    updatedAt: toMytTimestamp(u.updatedAt),
    role,
    school: toSchoolInfo(school),
  }
}

/** The user export: BOM, LF, the contract header, formula-neutralised cells. No IC and no phone column exists. */
export function usersCsv(rows: readonly UserRecord[], csvRole: 'guru' | 'pelajar', schoolName: string, kelasOf: (u: UserRecord) => string): string {
  return toCsv(
    SCHOOL_ADMIN_USER_CSV_COLUMNS,
    rows.map((u) => [u.id, u.name, u.email ?? '', csvRole, schoolName, kelasOf(u), isEffectivelyActive(u) ? 1 : 0, toMytTimestamp(u.createdAt)]),
    'LF',
  )
}
