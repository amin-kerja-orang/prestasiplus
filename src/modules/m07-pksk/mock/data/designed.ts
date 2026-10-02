/**
 * Seeded access grants, exam attempts and mastery (SRS M07 v1.7 §6.8; fictitious users = the M01
 * canonical accounts).
 */

import type { PkskAccessRow, PkskExamAttemptRow, PkskMasteryRow } from '../repository/types'

/**
 * Default access rows = the 3 live rows (OBSERVED: ids 1-3, dates 28/02/2026 and 22/04/2026, all
 * Kombo, no granter, no expiry, active), mapped to canonical accounts 2, 6 and 4. The time of day is
 * not observed (00:00 MYT chosen).
 */
export const SEED_ACCESS: readonly PkskAccessRow[] = [
  {
    id: 1,
    userId: 2,
    packageId: 3,
    grantedById: null,
    grantedAt: '2026-02-28T00:00:00+08:00',
    expiresAt: null,
    status: 'active',
    revokedAt: null,
  },
  {
    id: 2,
    userId: 6,
    packageId: 3,
    grantedById: null,
    grantedAt: '2026-02-28T00:00:00+08:00',
    expiresAt: null,
    status: 'active',
    revokedAt: null,
  },
  {
    id: 3,
    userId: 4,
    packageId: 3,
    grantedById: null,
    grantedAt: '2026-04-22T00:00:00+08:00',
    expiresAt: null,
    status: 'active',
    revokedAt: null,
  },
]

/**
 * Provisional scenario fixture `seedPkskAccessEdgeCases()` (§6.8; only E2E-M07-39; labels and whether
 * live lists such rows are UNVERIFIED, L-7): an expired T1 grant and a revoked T4 grant of
 * Pelajar Dua Demo (3), granted by Admin Demo (1).
 */
export const EDGE_CASE_ACCESS: readonly PkskAccessRow[] = [
  {
    id: 4,
    userId: 3,
    packageId: 1,
    grantedById: 1,
    grantedAt: '2026-01-05T00:00:00+08:00',
    expiresAt: '2026-06-30',
    status: 'active',
    revokedAt: null,
  },
  {
    id: 5,
    userId: 3,
    packageId: 2,
    grantedById: 1,
    grantedAt: '2026-03-10T00:00:00+08:00',
    expiresAt: null,
    status: 'revoked',
    revokedAt: '2026-05-02T00:00:00+08:00',
  },
]

/**
 * Pelajar Demo (2), T1: two exams (OBSERVED figures: score 46.0 / 64.0, Bahagian B 52.4 / 67.0,
 * grades D / C -> dashboard "55%" C, "2", "59.7%"). The Bahagian A and C percentages are
 * DESIGNED so that 0.2 A + 0.7 B + 0.1 C reproduces the score (BR-M07-09).
 */
export const SEED_ATTEMPTS: readonly PkskExamAttemptRow[] = [
  {
    id: 1,
    userId: 2,
    level: 'T1',
    completedAt: '2026-09-10T20:00:00+08:00',
    scorePct: 46.0,
    bahagianAPct: 46.6,
    bahagianBPct: 52.4,
    bahagianCPct: 0,
    grade: 'D',
  },
  {
    id: 2,
    userId: 2,
    level: 'T1',
    completedAt: '2026-09-20T20:00:00+08:00',
    scorePct: 64.0,
    bahagianAPct: 80,
    bahagianBPct: 67.0,
    bahagianCPct: 11,
    grade: 'C',
  },
]

/** Pelajar Demo (2), T1 mastery (§6.8); every other domain is 0 (absent). */
export const SEED_MASTERY_T1_USER2: readonly (readonly [number, number])[] = [
  [1, 60],
  [2, 70],
  [3, 55],
  [4, 80],
  [5, 40],
  [6, 65],
  [15, 50],
]

export const SEED_MASTERY: readonly PkskMasteryRow[] = SEED_MASTERY_T1_USER2.map(
  ([domainId, masteryPct], i) => ({
    id: i + 1,
    userId: 2,
    level: 'T1' as const,
    domainId,
    masteryPct,
  }),
)
