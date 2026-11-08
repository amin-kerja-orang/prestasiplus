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
import { isHttpMode } from '@/api/mode'
import { addDays, formatDateKey } from '@/lib/time'

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

/** BE-22 refuses a span over 366 days (422 "Julat tarikh tidak sah."): http mode asks for the last 366 days. */
export const ALL_SESSIONS_MAX_DAYS = 366

/** The range of the "Semua Sesi Latihan" modal: fixed in mock mode, the last year (MYT dates) in http mode. */
export function allSessionsRange(now: number = Date.now()): { start: string; end: string } {
  if (!isHttpMode()) return { ...ALL_SESSIONS_RANGE }
  return {
    start: formatDateKey(addDays(now, -(ALL_SESSIONS_MAX_DAYS - 1))),
    end: formatDateKey(now),
  }
}

/** #6 `GET /api/command-center/school/{id}` (S4). */
export const fetchCcSchool = (schoolId: number | string, o: Signal = {}) =>
  api.get<CcSchool>(`/api/command-center/school/${String(schoolId)}`, withSignal(o))

/** #7 `GET /api/command-center/school/{sid}/teacher/{uid}` (S5). */
export const fetchCcTeacher = (schoolId: number | string, userId: number | string, o: Signal = {}) =>
  api.get<CcTeacher>(
    `/api/command-center/school/${String(schoolId)}/teacher/${String(userId)}`,
    withSignal(o),
  )

/** #8 `GET /api/command-center/classroom/{id}` (S6). */
export const fetchCcClass = (classroomId: number | string, o: Signal = {}) =>
  api.get<CcClass>(`/api/command-center/classroom/${String(classroomId)}`, withSignal(o))

/** #9 `GET /api/command-center/student/{id}` (S7). */
export const fetchCcStudent = (userId: number | string, o: Signal = {}) =>
  api.get<CcStudent>(`/api/command-center/student/${String(userId)}`, withSignal(o))

/** #10 `GET /api/command-center/student/{id}/week?start=&end=` (week and all-sessions modals). */
export const fetchCcStudentWeek = (userId: number | string, start: string, end: string, o: Signal = {}) =>
  api.get<CcSessionList>(`/api/command-center/student/${String(userId)}/week`, {
    ...withSignal(o),
    query: { start, end },
  })

/** #10 with the all-time range: the "Semua Sesi Latihan" modal. */
export const fetchCcStudentAllSessions = (userId: number | string, o: Signal = {}) => {
  const range = allSessionsRange()
  return fetchCcStudentWeek(userId, range.start, range.end, o)
}

/** #11 `GET /api/command-center/student/{id}/subject?code=` (subject modal; `UMUM` = free practice). */
export const fetchCcStudentSubject = (userId: number | string, code: string, o: Signal = {}) =>
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
export const fetchCcHeadcount = (configId: number | string, o: Signal = {}) =>
  api.get<CcHeadcountDetail>(`/api/command-center/headcount/${String(configId)}`, withSignal(o))

// --- Admin Pusat central pages (S6-T11: API-ADM-11, API-ADM-12, API-ADM-13 laporan) ---------------------------

/** API-ADM-11 `GET /api/admin/dashboard` (`AdminDashboard`, PRD-60 2.17.3). Admin only. */
export interface AdminDashboard {
  questions: {
    total: number
    byStatus: { draft: number; review: number; approved: number; archived: number }
    thisWeek: number
  }
  subjects: { total: number; active: number }
  /** Tingkatan only (5); Darjah is never counted. */
  levels: number
  users: { total: number; students: number; teachers: number }
  battles: { total: number; active: number; finished: number }
}

export type AdminRange = '7d' | '30d' | '90d'

/** API-ADM-12 `GET /api/admin/analytics?range` (`AdminAnalytics`). Bank figures are computed, never stored. */
export interface AdminAnalytics {
  range: AdminRange
  platform: {
    schools: number
    activeSubscriptions: number
    students: number
    activeStudents: number
    answered: number
    /** Pooled accuracy, one decimal; `null` when nothing was answered. Shown as a whole number, rounded half up. */
    accuracy: number | null
  }
  trend: { date: string; answered: number }[]
  topSchools: { schoolId: string; school: string; answered: number }[]
  bank: {
    total: number
    bySubject: { id: string; name: string; total: number }[]
    byLevel: { id: string; name: string; total: number }[]
    byStatus: { draft: number; review: number; approved: number; archived: number }
    /** Percent (0 to 100) of the questions that carry a DSKP tag. */
    dskpTaggedShare: number
    chapterCoverage: number
    servability: Record<string, number>
  }
}

export type AdminLaporanRange = '7' | '30' | '90'

/** API-ADM-13 `GET /api/admin/reports/laporan?range=7|30|90` (`AdminLaporan`). */
export interface AdminLaporan {
  range: number
  tiles: {
    schools: number
    teachers: number
    pupils: number
    pupilsAccessed: number
    teachersAccessed: number
    pupilsPractised: number
    activities: number
    /** Average session accuracy, one decimal; `null` when unknown. */
    averageScore: number | null
  }
  /** 14 days, oldest first; `date` is `dd/mm`. */
  trend: { date: string; count: number }[]
  breakdown: {
    type: 'kuiz' | 'struktur' | 'latihTubi' | 'trackingA' | 'battle' | 'permainan'
    label: string
    count: number
  }[]
  mostActive: { id: string; name: string; school: { id: string; name: string } | null; activities: number }[]
  schoolActivity: { schoolId: string; name: string; activities: number; activePupils: number }[]
}

export const fetchAdminDashboard = (o: Signal = {}) =>
  api.get<AdminDashboard>('/api/admin/dashboard', withSignal(o))

export const fetchAdminAnalytics = (range: AdminRange = '30d', o: Signal = {}) =>
  api.get<AdminAnalytics>('/api/admin/analytics', { query: { range }, ...withSignal(o) })

export const fetchAdminLaporan = (range: AdminLaporanRange = '30', o: Signal = {}) =>
  api.get<AdminLaporan>('/api/admin/reports/laporan', { query: { range }, ...withSignal(o) })
