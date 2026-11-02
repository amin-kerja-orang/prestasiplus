/**
 * Deterministic papers for the mock `GET /api/admin/questions/:id/paper-servability` (REQ-A-018, AC-04.3). The mock has no paper
 * store of its own (papers belong to the Bijak store), so the published papers that "place" a question are derived from the id:
 * `id % 3` = 0 none, 1 one paper, 2 two papers; every seventh question also sits on a paper with a dangling placement
 * (`question_missing`). A paper is open when the question is approved and active; otherwise the reason is the question's own.
 * Reason sentences are the contract's. Pure (no mock-core imports) so a unit test can load it alone.
 */
import { servabilityReasonMs, type QuestionPaperServabilityRow, type ServabilityReason } from '@pp/contract'

import type { Question } from '../repository/types'

/** Placed question id of the dangling placement (no such question in the bank). */
const MISSING_ID = '999999999'

function ownReason(q: Pick<Question, 'id' | 'status' | 'isActive'>): ServabilityReason[] {
  if (q.status === 'approved' && q.isActive) return []
  const code = q.status === 'archived' ? 'archived' : q.isActive ? 'not_approved' : 'withdrawn'
  return [{ code, message: servabilityReasonMs(code, 'simulasi_paper'), detail: String(q.id) }]
}

export function paperServabilityRows(q: Pick<Question, 'id' | 'subjectId' | 'status' | 'isActive'>, subjectName: string): QuestionPaperServabilityRow[] {
  const rows: QuestionPaperServabilityRow[] = []
  const own = ownReason(q)
  const count = q.id % 3
  for (let i = 1; i <= count; i += 1) {
    rows.push({
      paperId: `${String(q.subjectId ?? 0)}0${String(i)}`,
      title: `Kertas Percubaan SPM ${subjectName} Set ${String(i)}`,
      served: own.length === 0,
      reasons: own,
    })
  }
  if (q.id % 7 === 0) {
    const missing: ServabilityReason = {
      code: 'question_missing',
      message: servabilityReasonMs('question_missing', 'simulasi_paper'),
      detail: MISSING_ID,
    }
    rows.push({
      paperId: `${String(q.subjectId ?? 0)}09`,
      title: `Kertas Percubaan SPM ${subjectName} Set 9`,
      served: false,
      reasons: [missing, ...own],
    })
  }
  return rows
}
