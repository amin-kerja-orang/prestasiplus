/**
 * Command Center drill-down client (SRS M17 v1.12 §7 #6–#13; M17-T1a). The S4–S7 pages (M17-T3a) and
 * the M10 `/guru/command-center/…` mount (M10-T4) import these functions and the types; they do not
 * change this file (build-plan §S.3 rule 5).
 *
 * Guard **AT**: an admin sees the platform; a teacher only the schools of the teacher's classes, the
 * teacher's own S5 page, the teacher's classes and their active members (BR-M17-30, FR-M17-60).
 * Failures reject with `ApiError`: 404 `NOT_FOUND` for an unknown id or one outside the viewer's scope
 * (the page renders the M01 global 404, FR-M17-07), 403 `FORBIDDEN` for any other role, 401 without a
 * session, 422 `VALIDATION_ERROR` "Julat tarikh tidak sah." for a bad week range.
 */

import { api } from '@/api'

import type {
  CcClass,
  CcHeadcountDetail,
  CcSchool,
  CcSessionDetail,
  CcSessionList,
  CcStudent,
  CcTeacher,
} from './command-center-types'

export type * from './command-center-types'

interface Signal {
  signal?: AbortSignal
}
const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

/** "Semua Sesi Latihan": the range the page sends (FR-M17-56). */
export const ALL_SESSIONS_RANGE = { start: '2020-01-01', end: '2030-12-31' } as const

/** #6 `GET /api/command-center/school/{id}` (S4). */
export const fetchCcSchool = (schoolId: number, o: Signal = {}) =>
  api.get<CcSchool>(`/api/command-center/school/${String(schoolId)}`, withSignal(o))

/** #7 `GET /api/command-center/school/{sid}/teacher/{uid}` (S5). */
export const fetchCcTeacher = (schoolId: number, userId: number, o: Signal = {}) =>
  api.get<CcTeacher>(
    `/api/command-center/school/${String(schoolId)}/teacher/${String(userId)}`,
    withSignal(o),
  )

/** #8 `GET /api/command-center/classroom/{id}` (S6). */
export const fetchCcClass = (classroomId: number, o: Signal = {}) =>
  api.get<CcClass>(`/api/command-center/classroom/${String(classroomId)}`, withSignal(o))

/** #9 `GET /api/command-center/student/{id}` (S7). */
export const fetchCcStudent = (userId: number, o: Signal = {}) =>
  api.get<CcStudent>(`/api/command-center/student/${String(userId)}`, withSignal(o))

/** #10 `GET /api/command-center/student/{id}/week?start=&end=` (week and all-sessions modals). */
export const fetchCcStudentWeek = (userId: number, start: string, end: string, o: Signal = {}) =>
  api.get<CcSessionList>(`/api/command-center/student/${String(userId)}/week`, {
    ...withSignal(o),
    query: { start, end },
  })

/** #10 with the all-time range: the "Semua Sesi Latihan" modal. */
export const fetchCcStudentAllSessions = (userId: number, o: Signal = {}) =>
  fetchCcStudentWeek(userId, ALL_SESSIONS_RANGE.start, ALL_SESSIONS_RANGE.end, o)

/** #11 `GET /api/command-center/student/{id}/subject?code=` (subject modal; `UMUM` = free practice). */
export const fetchCcStudentSubject = (userId: number, code: string, o: Signal = {}) =>
  api.get<CcSessionList>(`/api/command-center/student/${String(userId)}/subject`, {
    ...withSignal(o),
    query: { code },
  })

/** #12 `GET /api/command-center/session/{sessionId}` (session modal). */
export const fetchCcSession = (sessionId: string, o: Signal = {}) =>
  api.get<CcSessionDetail>(
    `/api/command-center/session/${encodeURIComponent(sessionId)}`,
    withSignal(o),
  )

/** #13 `GET /api/command-center/headcount/{configId}` (headcount modal). */
export const fetchCcHeadcount = (configId: number, o: Signal = {}) =>
  api.get<CcHeadcountDetail>(`/api/command-center/headcount/${String(configId)}`, withSignal(o))
