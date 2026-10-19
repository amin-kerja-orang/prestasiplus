/**
 * Test-fixture stores of M05 (SRS M05 v1.17 §6.13): the two hooks whose values the screens read.
 *
 * - `setSubjectiveCounts(code, {levelId: n})` — the S3 "Latihan Subjektif ({n} soalan)" counts
 *   (FR-M05-49, E2E-M05-20 only); the seed has none, as live. Read by #3 `subjectiveCounts`.
 * - `setSpmProgress(userId, subjectId, {answered, correct})` — S15 provisional progress rows
 *   (BR-27, LS-10; the live source is UNVERIFIED). Read by #18 (M05-T2) through `spmProgress.get`.
 *
 * Both are small tables of the M05 plugin, so `mock.reset()` clears them with the rest of the seed.
 */

import { defineTable, maxPlusOne, opaque } from '@/mock/define'

export interface SubjectiveCountsRow {
  /** M03 subject id. */
  id: number
  /** Level id (as text) → number of subjective questions. */
  counts: Record<string, number>
}

export interface SpmProgressRow {
  /** `userId:subjectId`. */
  id: string
  userId: number
  subjectId: number
  answered: number
  correct: number
}

export const subjectiveCountsTable = defineTable<SubjectiveCountsRow>({
  name: 'practice.subjectiveCounts',
  ids: maxPlusOne(),
})

export const spmProgressTable = defineTable<SpmProgressRow>({
  name: 'practice.spmProgress',
  ids: opaque('k_', 'practice:spm-progress', 12),
  indexes: ['userId'],
})

export const FIXTURE_TABLES = {
  subjectiveCounts: subjectiveCountsTable,
  spmProgress: spmProgressTable,
}

/** What #3 and #18 read (call time; never at module load). */
export const fixtures = {
  /** `{levelId: n}` set for a subject, `{}` when none. */
  subjectiveCounts(subjectId: number): Record<string, number> {
    return { ...(subjectiveCountsTable.get(subjectId)?.counts ?? {}) }
  },
  /** The S15 provisional progress of a user's subject, or `undefined` (BR-27: "Belum mula"). */
  spmProgress(userId: number, subjectId: number): SpmProgressRow | undefined {
    return spmProgressTable.get(`${String(userId)}:${String(subjectId)}`)
  },
  /** All rows of a user. */
  spmProgressOf(userId: number): SpmProgressRow[] {
    return spmProgressTable.query({ where: { userId } }).rows
  },
}
