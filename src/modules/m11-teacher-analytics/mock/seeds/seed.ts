/**
 * M11 seed (SRS M11 v1.10 §6.2, §6.7; overview §6.9), written through the M11 repository (§3 rule 3a).
 *
 * - `seedM11(ctx)` (seed phase): forgets the memoised queries and contributes the S4 anchors of the three
 *   observed pupils of 8080 (Students A, B and C) to M04 and M05 (`./anchors.ts`).
 * - `finaliseM11()` (after every dataset has compiled): the DATA-M11-01 flags. Which pupils carry a flag is
 *   not observable (Q-M11-4), so the flags go, per school, to answering pupils chosen by a stable hash
 *   (INFERRED); the per-school counts are the observed ones (`FLAG_COUNTS`: 52 `review` + 35 `excluded`).
 *   Flagged pupils always answer, so the S2 figures (flags included) and the S3 figures (excluded removed)
 *   follow BR-M11-09 exactly.
 *
 * Nothing else is stored: every figure on S1–S6 is computed from the owners' datasets (D11).
 */

import { toIsoMyt } from '@/lib/time'
import { fnv1a32 } from '@/mock/determinism'
import type { SeedContext } from '@/mock/define'

import { FLAG_COUNTS } from '../data/settings'
import { monitoringRepo } from '../repository'
import { answerCountsAll, resetSegmentCaches, studentsOf } from '../repository/segment'
import type { MonitoringFlagRow } from '../tables/tables'
import { contributeAnchors, RESERVED_PUPILS } from './anchors'

/** INFERRED: the flags were raised the morning after the latest observed flagged activity (20/09/2026). */
const FLAGGED_AT = toIsoMyt(Date.parse('2026-09-21T02:30:00+08:00'))

export function seedM11(ctx: SeedContext): void {
  resetSegmentCaches()
  contributeAnchors(ctx)
}

/** The flag rows of every flagged school (BR-M11-17, §6.7), deterministic. */
export function buildFlags(): MonitoringFlagRow[] {
  const counts = answerCountsAll()
  const rows: MonitoringFlagRow[] = []
  for (const [schoolId, [review, excluded]] of Object.entries(FLAG_COUNTS).map(
    ([id, c]) => [Number(id), c] as const,
  )) {
    const candidates = studentsOf(schoolId)
      .filter(
        (p) => (counts.get(p.id) ?? 0) > 0 && p.lastLoginAt !== null && !RESERVED_PUPILS.has(p.id),
      )
      .sort(
        (a, b) =>
          fnv1a32(`m11:flag:${String(a.id)}`) - fnv1a32(`m11:flag:${String(b.id)}`) || a.id - b.id,
      )
    if (candidates.length < review + excluded) {
      throw new Error(
        `M11 flags: school ${String(schoolId)} has ${String(candidates.length)} answering pupils, needs ${String(review + excluded)}`,
      )
    }
    candidates.slice(0, review).forEach((p) => {
      rows.push({ id: p.id, userId: p.id, level: 'review', flaggedAt: FLAGGED_AT })
    })
    candidates.slice(review, review + excluded).forEach((p) => {
      rows.push({ id: p.id, userId: p.id, level: 'excluded', flaggedAt: FLAGGED_AT })
    })
  }
  return rows
}

export function finaliseM11(): void {
  resetSegmentCaches()
  monitoringRepo.seedFlags(buildFlags())
}
