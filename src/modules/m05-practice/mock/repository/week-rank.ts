/**
 * Q-WEEK-RANK(week) (SRS M05 v1.17 §6.14.2; M16 BR-M16-31, FR-M16-138, XR-M16-03): the weekly ranking
 * of M16 S20 "Pertandingan Mingguan", computed from the practice sessions.
 *
 * - Users with ≥ 1 completed **practice-mode** session in the week (BR-35: `random`, `chapter`,
 *   `revision`, `mission`, `remedial`, `question_set`, `pksk`; the SPM modes `past_year`, `latih_tubi`
 *   and `ramalan` do not count, so a pupil who practises only in SPM modes is not listed);
 * - `sesi` = the user's sessions, `betul` = Σ `correctCount`, `tepat` = the mean of `correctCount ÷
 *   questionCount × 100` over the sessions with a question (1 decimal; INFERRED by M16: Σ betul ÷ Σ
 *   answers cannot give 8 of the 20 observed values);
 * - order `betul` descending, then user id ascending; the top `limit` (20).
 *
 * The week is an M11 week Mk (Monday–Sunday from 2026-02-16, M32 = 21–27 Sep); by default the week of
 * the clock. Sessions after the clock are not counted. Names are not added here (M16 reads them from
 * the users repository).
 */

import { sessionsDataset } from '../datasets/sessions'
import { weekOf, weekStart } from '../datasets/calendar'
import { nextCacheKey, practiceReady } from './reads'
import { PRACTICE_MODES } from './rules'

export interface WeekRankRow {
  rank: number
  userId: number
  /** Completed practice-mode sessions of the week. */
  sesi: number
  /** Σ correct answers of those sessions. */
  betul: number
  /** Mean session accuracy in percent, 1 decimal. */
  tepat: number
}

export interface WeekRankOptions {
  /** M11 week number Mk (1–32 at the clock); default: the week of `now`. */
  week?: number
  /** Rows returned (default 20). */
  limit?: number
}

export function weekRank(options: WeekRankOptions, now: number): WeekRankRow[] {
  if (!practiceReady()) return []
  const week = options.week ?? weekOf(now)
  const from = weekStart(week)
  const to = Math.min(weekStart(week + 1), now + 1)
  if (to <= from) return []
  const modes = new Set<string>(PRACTICE_MODES)
  const by = new Map<number, { sesi: number; betul: number; acc: number; scored: number }>()
  sessionsDataset.count(
    { status: 'completed', completedAtMs: { gte: from, lte: to - 1 } },
    (r) => {
      if (!modes.has(r.mode)) return false
      const u = by.get(r.userId) ?? { sesi: 0, betul: 0, acc: 0, scored: 0 }
      u.sesi++
      u.betul += r.correctCount
      if (r.questionCount > 0) {
        u.acc += (r.correctCount / r.questionCount) * 100
        u.scored++
      }
      by.set(r.userId, u)
      return false
    },
    {
      matchFields: ['userId', 'mode', 'questionCount', 'correctCount'],
      cacheKey: nextCacheKey('m05-weekrank'),
    },
  )
  return [...by.entries()]
    .sort((a, b) => b[1].betul - a[1].betul || a[0] - b[0])
    .slice(0, options.limit ?? 20)
    .map(([userId, u], i) => ({
      rank: i + 1,
      userId,
      sesi: u.sesi,
      betul: u.betul,
      tepat: u.scored === 0 ? 0 : Math.round((u.acc / u.scored) * 10) / 10,
    }))
}
