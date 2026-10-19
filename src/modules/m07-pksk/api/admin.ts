/**
 * M07 admin client functions (SRS M07 v1.7 §7 #7-#18; build-plan M07-T3 / M07-T4). Every call
 * needs an admin session (guest 401, other roles 403). Errors look like
 * `{error:{code,message,fields?}}` (`ApiError`): 404 for an unknown question, 409 for a revoke of a
 * row that is not active, 422 with `fields` for invalid input.
 *
 * Mutations resolve to `{data, status}` where `status` is the flash text (SRS §8.2, UNVERIFIED
 * COPY). The row delete (#12) answers 204 and so resolves to nothing.
 */

import { api, type ListResult } from '@/api'

import type { Bahagian, PkskLevel } from './types'

export type QuestionStatus = 'pending' | 'approved' | 'rejected'

export interface MutationResult<T> {
  data: T
  status: string
}

/** #7 row (`PkskQuestionListItem`). */
export interface PkskQuestionListItem {
  id: number
  questionText: string
  bahagian: Bahagian
  domain: { id: number; code: string; name: string; icon: string; color: string }
  targetLevel: PkskLevel
  status: QuestionStatus
}

/** #8. */
export interface PkskQuestionStats {
  total: number
  approved: number
  pending: number
  t1: number
  t4: number
}

export interface PkskOptionInput {
  text: string
  isCorrect: boolean
}

/** #9 (`PkskQuestionDetail`). */
export interface PkskQuestionDetail {
  id: number
  bahagian: Bahagian
  pkskDomainId: number
  pkskTargetLevel: PkskLevel
  status: QuestionStatus
  questionText: string
  difficultyLevel: number | null
  explanation: string | null
  options: PkskOptionInput[]
}

/** #10 body (no `options` for Bahagian C). */
export interface PkskQuestionCreateBody {
  bahagian: Bahagian
  pkskDomainId: number
  pkskTargetLevel: PkskLevel
  questionText: string
  difficultyLevel: number
  explanation?: string
  options?: PkskOptionInput[]
}

/** #11 body. */
export interface PkskQuestionUpdateBody {
  pkskDomainId: number
  pkskTargetLevel: PkskLevel
  status: QuestionStatus
  questionText: string
  difficultyLevel?: number
  explanation?: string
  options?: PkskOptionInput[]
}

export type BulkAction = 'approve' | 'reject' | 'delete'

export interface PkskQuestionListQuery {
  bahagian?: string
  level?: string
  status?: string
  search?: string
  page?: number
}

/** #14 row (`PkskAccessItem`). */
export interface PkskAccessItem {
  id: number
  user: { id: number; name: string; email: string }
  package: { id: number; name: string; level: 'T1' | 'T4' | 'ALL' }
  grantedBy: { id: number; name: string } | null
  grantedAt: string
  expiresAt: string | null
  status: 'active' | 'revoked'
  displayStatus: 'active' | 'expired' | 'revoked'
}

/** #15. */
export interface PkskAccessStats {
  activeTotal: number
  t1: number
  t4: number
}

/** #18. */
export interface PkskPackage {
  id: number
  name: string
  level: 'T1' | 'T4' | 'ALL'
}

export interface PkskAccessGrantBody {
  userId: number
  packageId: number
  expiresAt: string | null
}

interface Signal {
  signal?: AbortSignal
}

const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

const QUESTIONS = '/api/admin/pksk-questions'
const ACCESS = '/api/admin/pksk-access'

/** #7 `GET /api/admin/pksk-questions` (20 per page; an empty filter value is dropped). */
export function fetchPkskQuestions(
  query: PkskQuestionListQuery = {},
  options: Signal = {},
): Promise<ListResult<PkskQuestionListItem>> {
  return api.list<PkskQuestionListItem>(QUESTIONS, {
    query: {
      bahagian: query.bahagian || undefined,
      level: query.level || undefined,
      status: query.status || undefined,
      search: query.search || undefined,
      page: query.page && query.page > 1 ? query.page : undefined,
    },
    ...withSignal(options),
  })
}

/** #8 `GET /api/admin/pksk-questions/stats` (global, never filtered). */
export function fetchPkskQuestionStats(options: Signal = {}): Promise<PkskQuestionStats> {
  return api.get<PkskQuestionStats>(`${QUESTIONS}/stats`, withSignal(options))
}

/** #9 `GET /api/admin/pksk-questions/:id` (404 for an unknown or non-PKSK id). */
export function fetchPkskQuestion(id: number, options: Signal = {}): Promise<PkskQuestionDetail> {
  return api.get<PkskQuestionDetail>(`${QUESTIONS}/${String(id)}`, withSignal(options))
}

/** #10 `POST /api/admin/pksk-questions` (201; 422 with `fields`). */
export function createPkskQuestion(
  body: PkskQuestionCreateBody,
): Promise<MutationResult<PkskQuestionDetail>> {
  return api.post<MutationResult<PkskQuestionDetail>>(QUESTIONS, { body, raw: true })
}

/** #11 `PUT /api/admin/pksk-questions/:id` (404; 422). */
export function updatePkskQuestion(
  id: number,
  body: PkskQuestionUpdateBody,
): Promise<MutationResult<PkskQuestionDetail>> {
  return api.put<MutationResult<PkskQuestionDetail>>(`${QUESTIONS}/${String(id)}`, {
    body,
    raw: true,
  })
}

/** #12 `DELETE /api/admin/pksk-questions/:id` (204; 404). */
export function deletePkskQuestion(id: number): Promise<void> {
  return api.delete<void>(`${QUESTIONS}/${String(id)}`)
}

/** #13 `POST /api/admin/pksk-questions/bulk` (422 for empty ids, a bad action or a non-PKSK id). */
export function bulkPkskQuestions(
  action: BulkAction,
  ids: number[],
): Promise<MutationResult<{ affected: number }>> {
  return api.post<MutationResult<{ affected: number }>>(`${QUESTIONS}/bulk`, {
    body: { action, ids },
    raw: true,
  })
}

/** #14 `GET /api/admin/pksk-access` (`grantedAt` desc then `id` desc, 20 per page). */
export function fetchPkskAccessList(
  query: { search?: string; page?: number } = {},
  options: Signal = {},
): Promise<ListResult<PkskAccessItem>> {
  return api.list<PkskAccessItem>(ACCESS, {
    query: {
      search: query.search || undefined,
      page: query.page && query.page > 1 ? query.page : undefined,
    },
    ...withSignal(options),
  })
}

/** #15 `GET /api/admin/pksk-access/stats` (global, active rows only). */
export function fetchPkskAccessStats(options: Signal = {}): Promise<PkskAccessStats> {
  return api.get<PkskAccessStats>(`${ACCESS}/stats`, withSignal(options))
}

/** #16 `POST /api/admin/pksk-access` (201; 422 `fields.userId` for an unknown user). */
export function grantPkskAccess(
  body: PkskAccessGrantBody,
): Promise<MutationResult<PkskAccessItem>> {
  return api.post<MutationResult<PkskAccessItem>>(ACCESS, { body, raw: true })
}

/** #17 `POST /api/admin/pksk-access/:id/revoke` (404; 409 when the row is not active). */
export function revokePkskAccess(id: number): Promise<MutationResult<PkskAccessItem>> {
  return api.post<MutationResult<PkskAccessItem>>(`${ACCESS}/${String(id)}/revoke`, {
    raw: true,
  })
}

/** #18 `GET /api/pksk-packages` (the 3 packages). */
export function fetchPkskPackages(options: Signal = {}): Promise<PkskPackage[]> {
  return api.get<PkskPackage[]>('/api/pksk-packages', withSignal(options))
}
