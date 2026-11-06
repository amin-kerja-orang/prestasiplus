/**
 * API-GUR-21 `GET /api/guru/weekly-report` (S6-T01): the teacher weekly class report. Own classes
 * only (another teacher's class is 403). The page never sends `week` (tests only) and never calls
 * the legacy `GET /api/weekly-report`.
 */

import type { GuruWeeklyReport } from '@pp/contract'

import { api } from '@/api'

export const fetchGuruWeeklyReport = (
  classroomId: number | string,
  opts: { signal?: AbortSignal } = {},
) =>
  api.get<GuruWeeklyReport>('/api/guru/weekly-report', {
    ...(opts.signal ? { signal: opts.signal } : {}),
    query: { classroomId },
  })
