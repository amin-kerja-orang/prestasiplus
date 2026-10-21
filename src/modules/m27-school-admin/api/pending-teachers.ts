/**
 * M27 S7b client: teachers who registered themselves and wait for the school admin (BE-21 AC 13; contract
 * `packages/contract/src/school-admin/pending-teachers.ts`). School admin only; the school comes from the
 * session. Ids are opaque strings (not the integers of the other M27 endpoints). `GET` is unpaged.
 * Errors: 401, 403, 404 on verify (unknown, other school, not pending, already verified), 429.
 */

import { api, type ListResult } from '@/api'

const BASE = '/api/admin-sekolah/guru'

export interface PendingTeacherRow {
  id: string
  name: string
  /** One or two upper-case letters. */
  initials: string
  email: string | null
  phone: string | null
  /** When the teacher registered (MYT timestamp). */
  requestedAt: string
}

export interface VerifyTeacherResult {
  data: { id: string; isActive: true; schoolId: string }
  /** "Guru berjaya disahkan." */
  status: string
}

/** `GET /admin-sekolah/guru/pending`: every pending teacher of the school, oldest request first. */
export const fetchPendingTeachers = (signal?: AbortSignal) =>
  api.list<PendingTeacherRow>(`${BASE}/pending`, { ...(signal ? { signal } : {}) })

/** `POST /admin-sekolah/guru/{id}/verify` (no body). */
export const verifyPendingTeacher = (id: string) =>
  api.post<VerifyTeacherResult>(`${BASE}/${encodeURIComponent(id)}/verify`, { raw: true })

export type PendingTeacherList = ListResult<PendingTeacherRow>
