/**
 * M11 teacher client functions (SRS M11 v1.10 §7 #1 and #8; build-plan M11-T1). UI tasks import these
 * and do not change this file (build-plan §S.3 rule 5).
 *
 * Failures reject with `ApiError`: 401 without a session, 403 for a role outside the M10 §7 **T**
 * guard (teacher, admin). Invalid filter values are tolerated, not rejected (SRS §5).
 */

import { api } from '@/api'

import type { ItemAnalysis, TeacherReport } from './types'

interface Signal {
  signal?: AbortSignal
}
const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

export interface TeacherReportQuery {
  /** 7, 30 or 90; anything else is 30. */
  range?: number
  classroomId?: number
}

/** #1 `GET /api/teacher/report` (S1). */
export const fetchTeacherReport = (query: TeacherReportQuery = {}, o: Signal = {}) => {
  const q: Record<string, string | number> = {}
  if (query.range !== undefined) q.range = query.range
  if (query.classroomId !== undefined) q.classroomId = query.classroomId
  return api.get<TeacherReport>('/api/teacher/report', { ...withSignal(o), query: q })
}

export interface ItemAnalysisQuery {
  subjectId?: number
  classroomId?: number
}

/** #8 `GET /api/teacher/item-analysis` (S6); rows are `[]` for the admin. */
export const fetchItemAnalysis = (query: ItemAnalysisQuery = {}, o: Signal = {}) => {
  const q: Record<string, string | number> = {}
  if (query.subjectId !== undefined) q.subjectId = query.subjectId
  if (query.classroomId !== undefined) q.classroomId = query.classroomId
  return api.get<ItemAnalysis>('/api/teacher/item-analysis', { ...withSignal(o), query: q })
}
