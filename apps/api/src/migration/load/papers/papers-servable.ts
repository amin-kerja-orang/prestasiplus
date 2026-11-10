/**
 * The ONE eligibility call of the papers recompute: the shared servability rule of the exam builder (`placementVerdict`, one predicate underneath:
 * `unservableReasonsOf`), in mode `'fixedSet'` (KP-14, KP-15): a V2-published paper is a set a person already chose, so nothing is refused. A held or
 * unresolved-picture question is PLACED and shown with a placeholder; this only reports which ones those are (counted, never dropped).
 * The builder's function takes a Prisma-style handle; `fromExecutor` adapts the migration's batch executor to it.
 */
import type { Prisma } from '../../../db/generated/client'
import { placementVerdict } from '../../../modules/exam/builder/placement-blockers'
import type { UnservableDb } from '../../../modules/questions/questions.repository'
import type { SqlExecutor } from '../../kit/types'

const fromExecutor = (db: SqlExecutor): UnservableDb =>
  ({ $queryRaw: (q: Prisma.Sql) => db.query(q.text, q.values as unknown[]).then((r) => r.rows) }) as unknown as UnservableDb

/** Of these questions, which are placed with a placeholder (held or unresolved picture) and which, if any, must be refused (none in `'fixedSet'`). */
export async function placementOutcome(db: SqlExecutor, questionIds: readonly string[]): Promise<{ refused: string[]; placeholder: string[] }> {
  if (questionIds.length === 0) return { refused: [], placeholder: [] }
  const v = await placementVerdict(fromExecutor(db), questionIds, 'fixedSet')
  return { refused: [...v.refused.keys()], placeholder: [...v.placeholder.keys()] }
}
