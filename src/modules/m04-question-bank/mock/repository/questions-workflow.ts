/**
 * Question-store methods of the M04-T2 workflow endpoints (S6 quality dashboard, #12–#13). They are
 * spread into `questionsRepo` (the repository is the only doorway to the store, D12) and kept in
 * their own file so the F-25 repository stays small.
 *
 * - `scoredWithLowScore()`: every scored row of the bucket `le50` (S6 "Soalan Untuk Semakan Aktif" and
 *   the Skor ≤ 50 / Lemah / Kritikal counts), id descending.
 * - `auditRuntimeRows(now)`: BR-M04-22 "Jalankan Audit Semula". INFERRED scope: the generated and
 *   anchor rows already carry the scores of the last audit (S6 observed values, pinned anchors), so a
 *   re-audit leaves them as they are; it scores the rows created or imported at runtime (ids ≥
 *   9,000,001, "not scored until the next audit", BR-M04-09) with the §6.12 `score(q)` function.
 */

import type { questionsDataset } from '../datasets/questions'
import { bucketOfScore, RUNTIME_ID_FLOOR, scoreQuestion } from './quality-rules'
import type { Question } from './types'

interface WorkflowContext {
  store: typeof questionsDataset
  transaction: <T>(fn: () => T) => T
}

export function workflowMethods({ store, transaction }: WorkflowContext) {
  return {
    /** Scored rows with a score ≤ 50 (bucket `le50`), any source, newest id first. */
    scoredWithLowScore: (): Question[] =>
      store.query({
        where: { pkskDomainId: null, qualityBucket: 'le50' },
        sort: { field: 'id', dir: 'desc' },
      }).rows,
    /** BR-M04-22 (INFERRED scope, see the file comment). Returns the number of rows scored. */
    auditRuntimeRows: (): number =>
      transaction(() => {
        const rows = store.query({
          where: { pkskDomainId: null, id: { gte: RUNTIME_ID_FLOOR } },
        }).rows
        let n = 0
        for (const r of rows) {
          const score = scoreQuestion(r)
          const bucket = bucketOfScore(score)
          if (r.qualityScore !== score || r.qualityBucket !== bucket) {
            store.update(r.id, { qualityScore: score, qualityBucket: bucket })
            n++
          }
        }
        return n
      }),
  }
}
