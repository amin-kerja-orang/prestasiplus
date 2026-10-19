/**
 * The `schoolEngagementScores` repository (owner **M12**; SRS M12 v1.6 §6.4 DATA-M12-03). Live computes the S4
 * "Skor" / S5 "Engagement" and the S3 "Subjek" count server-side with unobservable formulas, so the values are
 * stored (33 rows, one per table school; Q-M12-3).
 */

import { defineRepository } from '@/mock/repository'

import { schoolScoresTable } from '../tables/tables'
import type { SchoolScoreRow } from '../types'

export const schoolScoresRepo = defineRepository({
  owner: 'M12',
  name: 'schoolEngagementScores',
  store: schoolScoresTable,
  methods: ({ store, transaction }) => ({
    /** Seed: `[schoolId, score, subjectCount, observed]` rows (the school id is the row id). */
    seed(rows: readonly (readonly [number, number, number, boolean])[]): void {
      transaction(() => {
        for (const [id, score, subjectCount, observed] of rows) {
          store.insert({ id, score, subjectCount, observed })
        }
      })
    },

    /** The stored row of a school, or `undefined` (score 0 / subjects 0 are then shown). */
    get(schoolId: number): SchoolScoreRow | undefined {
      return store.get(schoolId)
    },

    all(): SchoolScoreRow[] {
      return store.query({ sort: [{ field: 'id' }] }).rows
    },
  }),
})
