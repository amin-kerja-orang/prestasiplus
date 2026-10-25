/**
 * M02 complimentary-student endpoints (SRS v1.28 §7 #16–#23; build-plan M02-T3): S6 list and bulk
 * actions, S7 register, S8 detail and the teacher / classroom pickers of S7. Every call needs an admin
 * session (`AD`). UI tasks read this file and do not change it (build-plan §S.3 rule 5).
 *
 * Mutations resolve to `{data, status}` (`status` = the flash text, UNVERIFIED COPY §8).
 */

import { api, wireId, type EntityId, type ListResult } from '@/api'
import { isHttpMode } from '@/api/mode'

import type { ImportResponse } from './imports'

/** #16 row. `icNumber` is `null` when the student has none ("—"). */
export interface CompStudentListItem {
  id: number
  name: string
  /** "{last 6 IC digits}@prestasiplus.my" (= the login e-mail). */
  username: string
  icNumber: string | null
  schoolName: string | null
  /** The first class the student is enrolled in (S6 "Kelas"); `''` when none. */
  classLabel: string
  /** That class's teacher (S6 "Cikgu"); `''` when none. */
  teacherName: string
  isActive: boolean
  coinsEnabled: boolean
  /** `YYYY-MM-DD`. */
  packageExpiresAt: string
}

/** `meta.counts` of #16: complimentary students with coins OFF, and all of them (FR-M02-65). */
export interface CompStudentCounts extends Record<string, number> {
  coinsOff: number
  total: number
}

export interface CompStudentListMeta {
  counts: CompStudentCounts
}

/** #18: DATA-M02-09 with the user's own fields and the enrolments (S8). */
export interface CompStudentDetail {
  userId: number
  username: string
  name: string
  icNumber: string | null
  /** e.g. "T5". */
  classLevel: string | null
  isActive: boolean
  coinsEnabled: boolean
  /** `YYYY-MM-DD`. */
  packageExpiresAt: string
  /** "Sekolah asal". */
  originalSchoolName: string | null
  classLabel: string
  teacherName: string
  /** Read-only here (M14). */
  syilingBalance: number
  coinBalance: number
  classes: CompStudentClass[]
}

export interface CompStudentClass {
  name: string
  classCode: string
  subjectName: string | null
  teacherName: string
  /** Enrolment status (`active` | `removed`); the screen upper-cases it. */
  status: string
}

/** #19 actions (FR-M02-67). */
export type CompBulkAction = 'coins_off' | 'coins_on' | 'deactivate' | 'activate'

/** #17 body. `students` = one `NAMA, NOKP` per line. `packageExpiresAt` is `YYYY-MM-DD`. */
export interface RegisterCompStudentsInput {
  classroomId: number | null
  packageExpiresAt: string
  students: string
}

/** #22 option. */
export interface TeacherOption {
  id: number
  name: string
  email: string
}

/** #23 option. */
export interface TeacherClassroomOption {
  id: number
  name: string
  classCode: string
}

export interface CompMutation<T> {
  data: T
  status: string
}

const base = '/api/admin/comp-students'
const at = (id: number): string => `${base}/${String(id)}`

/** #16 `GET /api/admin/comp-students`: 50 per page, newest first. */
export function fetchCompStudents(
  query: { page?: number; signal?: AbortSignal } = {},
): Promise<ListResult<CompStudentListItem, CompStudentListMeta>> {
  return api.list<CompStudentListItem, CompStudentListMeta>(base, {
    query: { page: query.page ?? null },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/** #17 `POST /api/admin/comp-students` (201; 422 with `fields`). */
export function registerCompStudents(input: RegisterCompStudentsInput): Promise<ImportResponse> {
  // http mode: ids are strings on the wire. The response has no credential (the contract returns none).
  const body = isHttpMode() && input.classroomId !== null
    ? { ...input, classroomId: String(input.classroomId) }
    : input
  return api.post<ImportResponse>(base, { body, raw: true })
}

/** #18 `GET /api/admin/comp-students/:id` (404 unless the user is a complimentary student). */
export function fetchCompStudent(
  id: number,
  options: { signal?: AbortSignal } = {},
): Promise<CompStudentDetail> {
  return api.get<CompStudentDetail>(at(id), options.signal ? { signal: options.signal } : {})
}

/** #19 `POST …/bulk-action` (422 without ids or an unknown action). */
export function bulkCompAction(
  action: CompBulkAction,
  ids: readonly EntityId[],
): Promise<CompMutation<{ updated: number }>> {
  return api.post<CompMutation<{ updated: number }>>(`${base}/bulk-action`, {
    // Contract `CompBulkActionRequestSchema`: `ids` are strings (SWX-2).
    body: { action, ids: ids.map(wireId) },
    raw: true,
  })
}

/** #20 `POST …/:id/toggle-coins` (404). */
export function toggleCompCoins(id: number): Promise<CompMutation<{ coinsEnabled: boolean }>> {
  return api.post<CompMutation<{ coinsEnabled: boolean }>>(`${at(id)}/toggle-coins`, { raw: true })
}

/** #21 `POST …/:id/toggle-active` (404). */
export function toggleCompActive(id: number): Promise<CompMutation<{ isActive: boolean }>> {
  return api.post<CompMutation<{ isActive: boolean }>>(`${at(id)}/toggle-active`, { raw: true })
}

/** #22 `GET /api/admin/teachers`: every teacher, by name. */
export function fetchTeachers(options: { signal?: AbortSignal } = {}): Promise<TeacherOption[]> {
  return api.get<TeacherOption[]>(
    '/api/admin/teachers',
    options.signal ? { signal: options.signal } : {},
  )
}

/** #23 `GET /api/admin/teachers/:id/classrooms`: the teacher's active classes (`[]` for none). */
export function fetchTeacherClassrooms(
  teacherId: number,
  options: { signal?: AbortSignal } = {},
): Promise<TeacherClassroomOption[]> {
  return api.get<TeacherClassroomOption[]>(
    `/api/admin/teachers/${String(teacherId)}/classrooms`,
    options.signal ? { signal: options.signal } : {},
  )
}
