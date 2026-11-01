/**
 * `GET /api/admin/questions/:id/paper-servability` (REQ-A-018, AC-04.3 / AC-04.4): the published papers that carry a question and
 * whether pupils can open each. Admin Pusat only; 404 for an unknown, PKSK or Darjah question. Same call in mock and http mode
 * (the M04 mock answers the route, `mock/handlers/paper-servability.ts`).
 */
import type { QuestionPaperServabilityRow } from '@pp/contract'

import { api } from '@/api'

export type { QuestionPaperServabilityRow }

export const fetchPaperServability = (id: string | number, signal?: AbortSignal): Promise<QuestionPaperServabilityRow[]> =>
  api.get<QuestionPaperServabilityRow[]>(`/api/admin/questions/${String(id)}/paper-servability`, signal ? { signal } : {})
