/**
 * M11 monitoring client functions (SRS M11 v1.10 §7 #3–#7; build-plan M11-T1). The same functions
 * serve `/guru/monitoring*` here and `/admin/monitoring*` in M17 (one component set, FR-M11-52).
 *
 * Failures reject with `ApiError`: 401 without a session; 403 for a role outside admin, teacher and
 * school admin, or for a school admin asking about another school (INFERRED, the alias scope);
 * 404 for an unknown school, student or teacher.
 */

import { api } from '@/api'

import type {
  ExportFormat,
  MonitoringExport,
  MonitoringOverview,
  SchoolDetail,
  StudentDetail,
  TeacherDetail,
} from './types'

interface Signal {
  signal?: AbortSignal
}
const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

export interface MonitoringQuery {
  /** '' | '7d' | '30d' | '3m' (anything else is all time). */
  period?: string
  state?: string
  tahap?: string
}

const filterQuery = (query: MonitoringQuery): Record<string, string> => {
  const q: Record<string, string> = {}
  if (query.period) q.period = query.period
  if (query.state) q.state = query.state
  if (query.tahap) q.tahap = query.tahap
  return q
}

/** #3 `GET /api/monitoring/overview` (S2). */
export const fetchMonitoringOverview = (query: MonitoringQuery = {}, o: Signal = {}) =>
  api.get<MonitoringOverview>('/api/monitoring/overview', {
    ...withSignal(o),
    query: filterQuery(query),
  })

/** #4 `GET /api/monitoring/schools/:schoolId` (S3). */
export const fetchSchoolDetail = (schoolId: number, o: Signal = {}) =>
  api.get<SchoolDetail>(`/api/monitoring/schools/${String(schoolId)}`, withSignal(o))

/** #5 `GET /api/monitoring/schools/:schoolId/students/:userId` (S4; the school is not checked, BR-M11-29). */
export const fetchStudentDetail = (schoolId: number, userId: number, o: Signal = {}) =>
  api.get<StudentDetail>(
    `/api/monitoring/schools/${String(schoolId)}/students/${String(userId)}`,
    withSignal(o),
  )

/** #6 `GET /api/monitoring/schools/:schoolId/teachers/:userId` (S5). */
export const fetchTeacherDetail = (schoolId: number, userId: number, o: Signal = {}) =>
  api.get<TeacherDetail>(
    `/api/monitoring/schools/${String(schoolId)}/teachers/${String(userId)}`,
    withSignal(o),
  )

/** #7 `GET /api/monitoring/export` (PROPOSED): the rows behind the PDF / CSV links; 422 for another format. */
export const fetchMonitoringExport = (
  format: ExportFormat,
  query: MonitoringQuery = {},
  o: Signal = {},
) =>
  api.get<MonitoringExport>('/api/monitoring/export', {
    ...withSignal(o),
    query: { format, ...filterQuery(query) },
  })
