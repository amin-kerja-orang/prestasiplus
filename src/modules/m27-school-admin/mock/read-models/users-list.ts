/**
 * Q-M27-USERS and the S9/S10 detail read (SRS §18.3, BR-M27-30, 31, 36; FR-M27-88 to 92, 99 to 101).
 * Read-only; the writes of S9 to S12 are M27-T1b. Role and school are fixed by the caller, never by a
 * request value.
 */

import type { UserRow } from '@/modules/m01-authentication/mock'
import { users } from '@/modules/m01-authentication/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import type {
  SchoolPupilRow,
  SchoolTeacherRow,
  SchoolUserDetail,
  SchoolUserListMeta,
} from '../../api/school-admin'
import {
  activeClassCountOf,
  activeClassNamesOf,
  countOf,
  gradeLabel,
  initialsOf,
  peopleOf,
  type SchoolRole,
} from './school-people'
import { schoolInfoOf } from './school-info'
import type { SchoolViewer } from './school-scope'

/** FR-M27-49: 25 rows a page. */
export const PAGE_SIZE = 25

export interface UserListQuery {
  /** Raw `is_active` value; `'1'` and `'0'` filter, anything else is all (BR-M27-30). */
  isActive?: string | undefined
  search?: string | undefined
  page?: string | undefined
}

export interface PageSlice<T> {
  rows: T[]
  meta: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    from: number | null
    to: number | null
  }
}

/** `page` is an integer of 1 or more; anything else is 1; beyond the last page gives the last page. */
export function pageOf<T>(all: readonly T[], rawPage: string | undefined): PageSlice<T> {
  const totalItems = all.length
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const parsed = rawPage !== undefined && /^\d+$/.test(rawPage.trim()) ? Number(rawPage) : 1
  const page = Math.min(Math.max(1, parsed), totalPages)
  const start = (page - 1) * PAGE_SIZE
  const rows = all.slice(start, start + PAGE_SIZE)
  return {
    rows,
    meta: {
      page,
      pageSize: PAGE_SIZE,
      totalItems,
      totalPages,
      from: rows.length === 0 ? null : start + 1,
      to: rows.length === 0 ? null : start + rows.length,
    },
  }
}

export const parseActive = (raw: string | undefined): boolean | undefined =>
  raw === '1' ? true : raw === '0' ? false : undefined

/** G-6: active first, then id descending (the owner orders by `createdAt`). */
const activeFirstThenNewest = (a: UserRow, b: UserRow): number =>
  Number(b.isActive) - Number(a.isActive) || b.id - a.id

/** The matching users of the school in S6/S7 order, unpaged (also the CSV source, which re-sorts by id). */
export function filteredUsers(
  schoolId: number,
  role: SchoolRole,
  query: Pick<UserListQuery, 'isActive' | 'search'>,
): UserRow[] {
  const isActive = parseActive(query.isActive)
  const search = query.search?.trim()
  return peopleOf(schoolId, role, {
    ...(isActive === undefined ? {} : { isActive }),
    ...(search ? { search } : {}),
  }).sort(activeFirstThenNewest)
}

/** Cards of S6/S7: the school's totals, ignoring the filters (FR-M27-88, 99). */
export function countsOf(schoolId: number, role: SchoolRole): SchoolUserListMeta['counts'] {
  const total = countOf(schoolId, role)
  const active = countOf(schoolId, role, true)
  return { total, active, inactive: total - active }
}

const pupilRow = (u: UserRow): SchoolPupilRow => ({
  id: u.id,
  name: u.name,
  initials: initialsOf(u.name),
  email: u.email,
  phone: u.phone === null || u.phone === '' ? null : u.phone,
  gradeLabel: gradeLabel(u.grade),
  classNames: activeClassNamesOf(u.id),
  isActive: u.isActive,
  createdAt: u.createdAt,
  canEdit: u.isActive,
})

const teacherRow = (u: UserRow): SchoolTeacherRow => ({
  id: u.id,
  name: u.name,
  initials: initialsOf(u.name),
  email: u.email,
  phone: u.phone === null || u.phone === '' ? null : u.phone,
  classCount: activeClassCountOf(u.id),
  lastLoginAt: u.lastLoginAt,
  isActive: u.isActive,
  createdAt: u.createdAt,
  canEdit: u.isActive,
})

/** #6 S6: the school's pupils. */
export function listPupils(viewer: SchoolViewer, query: UserListQuery) {
  const slice = pageOf(filteredUsers(viewer.schoolId, 'student', query), query.page)
  return {
    rows: slice.rows.map(pupilRow),
    meta: { ...slice.meta, counts: countsOf(viewer.schoolId, 'student') },
  }
}

/** #10 S7: the school's teachers. */
export function listTeachers(viewer: SchoolViewer, query: UserListQuery) {
  const slice = pageOf(filteredUsers(viewer.schoolId, 'teacher', query), query.page)
  return {
    rows: slice.rows.map(teacherRow),
    meta: { ...slice.meta, counts: countsOf(viewer.schoolId, 'teacher') },
  }
}

export type UserLookup =
  { kind: 'found'; user: UserRow } | { kind: 'not_found' } | { kind: 'inactive' }

/**
 * BR-M27-31 and the §19 check order: the id must be a digit string naming a user of the viewer's school with
 * the page's role, else 404 (the same for another school, another role and unknown, SEC-M27-10); then 403
 * for an inactive in-school account. `requireActive` is false for the toggle (#14), which is the way back.
 */
export function lookupSchoolUser(
  viewer: SchoolViewer,
  role: SchoolRole,
  rawId: string | number,
  requireActive = true,
): UserLookup {
  if (typeof rawId === 'string' && !/^\d+$/.test(rawId)) return { kind: 'not_found' }
  const user = users.get(Number(rawId))
  if (!user || user.schoolId !== viewer.schoolId || user.role !== role) return { kind: 'not_found' }
  if (requireActive && !user.isActive) return { kind: 'inactive' }
  return { kind: 'found', user }
}

/** `SchoolUserDetail` (#7, #11, and the data of the writes). No IC; contact data of the viewer's school only. */
export function detailOf(user: UserRow, viewer: SchoolViewer): SchoolUserDetail {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone === null || user.phone === '' ? null : user.phone,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    role: user.role as 'student' | 'teacher',
    school: schoolInfoOf(viewer),
  }
}

/** Active `classroom` classes of the school, by name A to Z (S12 select, #22). */
export function activeClassroomOptions(schoolId: number): { id: number; name: string }[] {
  return classrooms
    .list({ schoolId, kind: 'classroom', isActive: true })
    .map((c) => ({ id: c.classId, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ms-MY') || a.id - b.id)
}
