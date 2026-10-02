/**
 * The answer log (DATA-M05-02 QuizAnswer) as a D11 virtual dataset (SRS M05 v1.16 §6.14; ADR-0013,
 * overview §6.6):
 *
 * - 478,499 rows at the clock (`./spec.ts`): generated ids in 1–478,499 (opaque), anchors in
 *   500,001–999,999 (`./ids.ts`), runtime answers from 9,000,001.
 * - Facets `seg`, `schoolId`, `week`, `band`, `inP`, `isCorrect`, `hasSession`: every §6.14.2
 *   total is a sum of cells.
 * - Cheap fields (from the prime, `./prime.ts`): `userId` (Q-ANS-USER, per-user screens),
 *   `sessionId`, `answeredAtMs` (every window filter), `answeredAt`.
 * - `derive` (question, subject, level, chapter, selected option) reads M04 at call time.
 * - Anchors: the canonical accounts' 250 answers and the other modules' contributions, completed
 *   and added when the dataset compiles (`../repository/anchors.ts`).
 *
 * Bump the M05 plugin `version` whenever this spec, `derive` or a cheap field changes (§6.9).
 */

import { defineVirtualDataset } from '@/mock/dataset'
import { floor } from '@/mock/define'

import { answerCheap, deriveAnswer } from './derive'
import { ANSWER_ANCHOR_RANGE, ANSWER_ID_MAX, ANSWER_RUNTIME_FLOOR } from './ids'
import { ANSWERS_TOTAL } from './pins'
import { answerDistribution } from './spec'
import type { AnswerCheapKey, AnswerFacetKey, AnswerRow } from './types'

export const ANSWER_FACETS: readonly AnswerFacetKey[] = [
  'seg',
  'schoolId',
  'week',
  'band',
  'inP',
  'isCorrect',
  'hasSession',
]

export const answersDataset = defineVirtualDataset<AnswerRow, AnswerFacetKey, AnswerCheapKey>({
  name: 'practice.answers',
  owner: 'M05',
  total: ANSWERS_TOTAL,
  idRange: { min: 1, max: ANSWER_ID_MAX },
  reservedAnchorRanges: [ANSWER_ANCHOR_RANGE],
  runtimeIds: floor({ start: ANSWER_RUNTIME_FLOOR }),
  facets: ANSWER_FACETS,
  distribution: answerDistribution,
  derive: (_id, facets, _rng, ctx) => deriveAnswer(ctx.key, facets.isCorrect),
  fields: {
    userId: (key) => answerCheap.userId(key),
    sessionId: (key) => answerCheap.sessionId(key),
    answeredAtMs: (key) => answerCheap.answeredAtMs(key),
    answeredAt: (key) => answerCheap.answeredAt(key),
  },
  rowCacheSize: 8_192,
})
