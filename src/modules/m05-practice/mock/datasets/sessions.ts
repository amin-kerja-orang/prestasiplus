/**
 * Practice sessions (DATA-M05-01) as a D11 virtual dataset (SRS M05 v1.16 §6.14; ADR-0013):
 *
 * - 32,122 completed sessions at the clock (`./spec.ts`); generated ids `g1…` (opaque, X-12),
 *   anchors ("A2", "P1", "M4", "H01", …) in a reserved key range, runtime ids `s_…` (opaque).
 * - Facets `seg`, `schoolId`, `week`, `band`, `inP` (the answer buckets), `missionId` (Q-SESS-LINK),
 *   `status` (`in_progress` rows exist only at runtime).
 * - Cheap fields from the prime: `userId`, `mode`, `subjectId`, `questionCount`, `correctCount`,
 *   `timeSpent`, `coinsEarned`, `pointsEarned`, `completedAt(Ms)`, `remedialTestId`,
 *   `questionSetId` (history lists, Q-SESS-USER, Q-SESS-MEAN-ACC, Q-WEEK-RANK read only these).
 *
 * Bump the M05 plugin `version` whenever this spec, `derive` or a cheap field changes (§6.9).
 */

import { defineVirtualDataset } from '@/mock/dataset'
import { opaque } from '@/mock/define'

import { deriveSession, sessionCheap } from './derive'
import { SESSION_ANCHOR_RANGE, SESSION_KEY_MAX, sessionIdCodec } from './ids'
import { SESSIONS_TOTAL } from './pins'
import { sessionDistribution } from './spec'
import type { SessionCheapKey, SessionFacetKey, SessionRow } from './types'

export const SESSION_FACETS: readonly SessionFacetKey[] = [
  'seg',
  'schoolId',
  'week',
  'band',
  'inP',
  'missionId',
  'status',
]

export const sessionsDataset = defineVirtualDataset<SessionRow, SessionFacetKey, SessionCheapKey>({
  name: 'practice.sessions',
  owner: 'M05',
  total: SESSIONS_TOTAL,
  idRange: { min: 1, max: SESSION_KEY_MAX },
  reservedAnchorRanges: [SESSION_ANCHOR_RANGE],
  runtimeIds: opaque('s_', 'practice:sessions', 12),
  idCodec: sessionIdCodec,
  facets: SESSION_FACETS,
  distribution: sessionDistribution,
  derive: (_id, _facets, _rng, ctx) => deriveSession(ctx.key),
  fields: {
    userId: (key) => sessionCheap.userId(key),
    mode: (key) => sessionCheap.mode(key),
    subjectId: (key) => sessionCheap.subjectId(key),
    questionCount: (key) => sessionCheap.questionCount(key),
    correctCount: (key) => sessionCheap.correctCount(key),
    timeSpent: (key) => sessionCheap.timeSpent(key),
    coinsEarned: (key) => sessionCheap.coinsEarned(key),
    pointsEarned: (key) => sessionCheap.pointsEarned(key),
    completedAtMs: (key) => sessionCheap.completedAtMs(key),
    completedAt: (key) => sessionCheap.completedAt(key),
    remedialTestId: () => null,
    questionSetId: () => null,
  },
})
