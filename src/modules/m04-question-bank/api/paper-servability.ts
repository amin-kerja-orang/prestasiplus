/**
 * `GET /api/admin/questions/:id/paper-servability` (REQ-A-018, AC-04.3 / AC-04.4): the published papers that carry a question and
 * whether pupils can open each. Admin Pusat only; 404 for an unknown, PKSK or Darjah question.
 * The body is `{ data, meta: { total, truncated } }` (admin papers only, at most 200); the client resolves that object, not an array.
 * Same call in mock and http mode (the M04 mock answers the route, `mock/handlers/paper-servability.ts`).
 */
import type { QuestionPaperServabilityResponse, QuestionPaperServabilityRow } from '@pp/contract'

import { api } from '@/api'

export type { QuestionPaperServabilityResponse, QuestionPaperServabilityRow }

export const fetchPaperServability = (id: string | number, signal?: AbortSignal): Promise<QuestionPaperServabilityResponse> =>
  api.get<QuestionPaperServabilityResponse>(`/api/admin/questions/${String(id)}/paper-servability`, signal ? { signal } : {})
