/**
 * Read port over practice (owner M05: `practice_sessions`, `practice_answers`; BE-12/13). BE-19 defines no
 * practice tables. The real adapter lives in `modules/practice/reads/performance-practice-read.adapter.ts`
 * and is bound from `PracticeReadsModule.onModuleInit` through `PerformancePorts.providePractice`.
 * `is_test` rows are never returned: the port has no parameter to ask for them. Every method is a fixed
 * number of set-based statements (no per-pupil loop).
 */
export interface PracticeScopeQuery {
  userIds?: readonly string[]
  schoolIds?: readonly string[]
  state?: string
  /** Needs `state` too (a district name is only unique inside its state); a district alone matches nothing. */
  district?: string
  subjectId?: string
  /** 't4' | 't5' (the level is the answer row's own dimension). */
  levelCode?: string
  /** Practice session modes; default: all. */
  modes?: readonly string[]
  /** [from, to) on the session's completion time. */
  from?: Date
  to?: Date
}

/** Per-pupil totals over completed, non-test sessions. */
export interface PracticeUserTotals {
  userId: string
  sessions: number
  questions: number
  correct: number
  coins: number
}

export type RankingQuery = PracticeScopeQuery & {
  /** A pupil is ranked from this many non-test answers. */
  minAnswers: number
  /** Rows returned (the order is applied before the cut). */
  limit: number
}

/** One ranked pupil. `answered` and `correct` count non-test answers. */
export interface RankingFact {
  userId: string
  name: string
  schoolId: string | null
  schoolName: string
  state: string
  correct: number
  answered: number
}

export interface RankingResult {
  /** Ordered correct DESC, accuracy DESC, userId ASC; at most `limit`. */
  rows: RankingFact[]
  /** Ranked pupils in the filtered scope, uncapped. */
  total: number
  /** Distinct states with ranked pupils and how many (the geography filter is ignored). */
  states: { state: string; pupils: number }[]
  /** Ranked pupils in the geographic scope before the subject and level filters. */
  scopePupils: number
}

export interface LeaderboardQuery {
  /** Omitted: all time. */
  from?: Date
  to: Date
  limit: number
  viewerId: string
}

export interface LeaderboardFact {
  userId: string
  name: string
  coins: number
  sessions: number
  /** Mean of correct / question_count x 100 over the pupil's sessions; not rounded. */
  accuracy: number
}

export interface LeaderboardResult {
  /** Ordered coins DESC, accuracy DESC, userId ASC; at most `limit`. */
  rows: LeaderboardFact[]
  /** The viewer's place in the FULL order, or null when the viewer has no counted session. */
  me: (LeaderboardFact & { rank: number }) | null
}

export interface PracticeReadPort {
  userTotals(q: PracticeScopeQuery): Promise<PracticeUserTotals[]>
  /** Distinct MYT days (yyyy-mm-dd) with a completed non-test session, ascending. */
  practiceDays(userId: string): Promise<string[]>
  rankingRows(q: RankingQuery): Promise<RankingResult>
  leaderboard(q: LeaderboardQuery): Promise<LeaderboardResult>
}

export const PRACTICE_READ_PORT = Symbol('PRACTICE_READ_PORT')

/** Default until M05's adapter is registered: nothing practised. */
export class EmptyPracticeRead implements PracticeReadPort {
  async userTotals(): Promise<PracticeUserTotals[]> {
    return []
  }
  async practiceDays(): Promise<string[]> {
    return []
  }
  async rankingRows(): Promise<RankingResult> {
    return { rows: [], total: 0, states: [], scopePupils: 0 }
  }
  async leaderboard(): Promise<LeaderboardResult> {
    return { rows: [], me: null }
  }
}
