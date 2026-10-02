/**
 * The `pupilSubjectAccuracy` repository (owner **M05**; D12; SRS M05 v1.17 §6.14.4, FR-M05-148; M18
 * XR-M18-03 (1), Q-M18-ACCSTU): the only doorway to the PupilSubjectAccuracy set. M18 derives its
 * cells from these rows — "cell = mean over the school's pupils holding a row in the subject",
 * "0%" = a row with 0 correct, "—" = no row (M18 BR-M18-19); the rows carry no school, M18 resolves a
 * school's pupils through the users repository.
 *
 * Reads: `all`, `forUser`, `forUsers`. Write: `seed` (finalise only; M05's own anchors).
 */

import { defineRepository, RepositoryError } from '@/mock/repository'

import { pupilAccuracyTable, type PupilAccuracyRow } from '../tables/pupil-accuracy'

export type { PupilAccuracyRow }

export interface PupilAccuracyInput {
  userId: number
  subjectId: number
  correct: number
  answered: number
}

export const pupilAccuracyRepo = defineRepository({
  name: 'pupilSubjectAccuracy',
  owner: 'M05',
  store: pupilAccuracyTable,
  methods: ({ phase }) => ({
    /** Every stored row, by user then subject. */
    all(): PupilAccuracyRow[] {
      return pupilAccuracyTable
        .query({})
        .rows.sort((a, b) => a.userId - b.userId || a.subjectId - b.subjectId)
    },

    /** The rows of one pupil, by subject id. */
    forUser(userId: number): PupilAccuracyRow[] {
      return pupilAccuracyTable
        .query({ where: { userId } })
        .rows.sort((a, b) => a.subjectId - b.subjectId)
    },

    /** The rows of the given pupils, by user then subject. */
    forUsers(userIds: Iterable<number>): PupilAccuracyRow[] {
      const set = new Set(userIds)
      return pupilAccuracyTable
        .query({ match: (r) => set.has(r.userId) })
        .rows.sort((a, b) => a.userId - b.userId || a.subjectId - b.subjectId)
    },

    /** M05's anchor rows (seed or finalise phase, once per boot). */
    seed(rows: readonly PupilAccuracyInput[]): void {
      if (phase() === 'live') {
        throw new RepositoryError('PHASE', 'pupilSubjectAccuracy.seed: seed or finalise phase only')
      }
      for (const r of rows) {
        if (r.answered <= 0 || r.correct < 0 || r.correct > r.answered) {
          throw new RepositoryError(
            'CONTRACT',
            `pupilSubjectAccuracy.seed: bad row ${String(r.userId)}:${String(r.subjectId)}`,
          )
        }
        const id = `${String(r.userId)}:${String(r.subjectId)}`
        if (pupilAccuracyTable.get(id)) pupilAccuracyTable.update(id, r)
        else pupilAccuracyTable.insert({ id, ...r })
      }
    },
  }),
})
