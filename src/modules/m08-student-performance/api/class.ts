/**
 * M08-T7 client functions (SRS M08 v1.13 §7 #5 and #8). The T1 client (`./performance`) keeps #1–#4,
 * #6, #7, #9–#11, #18–#23; the response types `ClassDashboard` and `ClassAnalytics` are T1's (`./types`).
 */

import { api } from '@/api'

import type { ClassAnalytics, ClassDashboard, RiskLevel } from './types'

interface Signal {
  signal?: AbortSignal
}
const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

export interface ClassAnalyticsQuery {
  classroomId?: number
  subjectId?: number
  riskLevel?: RiskLevel | ''
}

/** #5 `GET /api/performance/classes/:id` (S5); 404 for an unknown class or one the viewer may not open. */
export const fetchClassDashboard = (id: number, o: Signal = {}) =>
  api.get<ClassDashboard>(`/api/performance/classes/${String(id)}`, withSignal(o))

/** #8 `GET /api/analytics/classes` (S8); 403 for a class the viewer may not open. */
export const fetchClassAnalytics = (query: ClassAnalyticsQuery = {}, o: Signal = {}) => {
  const q: Record<string, string | number> = {}
  if (query.classroomId !== undefined) q.classroomId = query.classroomId
  if (query.subjectId !== undefined) q.subjectId = query.subjectId
  if (query.riskLevel) q.riskLevel = query.riskLevel
  return api.get<ClassAnalytics>('/api/analytics/classes', { ...withSignal(o), query: q })
}
