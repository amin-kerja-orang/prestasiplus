/**
 * `GET /api/admin/questions/:id/paper-servability` (REQ-A-018, AC-04.3). Admin only; 404 for an unknown or PKSK question. The rows
 * are derived by `../data/paper-servability.ts`.
 */
import { int, notFound, ok, requireRole, route, type MockRequest, type MockResponse, type RouteDef } from '@/mock/define'

import { paperServabilityRows } from '../data/paper-servability'
import { questionsRepo as questions } from '../repository/questions'
import { nameMaps } from './question-shape'

const adminOnly = requireRole('admin')

function handler(req: MockRequest): MockResponse {
  const q = questions.get(req.params.id as number)
  if (!q || q.pkskDomainId !== null) return notFound()
  const subject = nameMaps().subject(q.subjectId)?.name ?? 'Umum'
  return ok(paperServabilityRows(q, subject))
}

export const paperServabilityRoutes: RouteDef[] = [
  route('GET', '/api/admin/questions/:id/paper-servability', [adminOnly], handler, { params: { id: int() } }),
]
