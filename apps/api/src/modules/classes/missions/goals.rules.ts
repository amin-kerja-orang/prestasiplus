import type { MissionGoalKind } from '@pp/contract'

import { startOfMytDay } from '../../../db/clock'

/**
 * Pure rules of a Global (platform) mission goal (S6-T07, PO decision on #483). A Global mission is an achievement goal measured from
 * the pupil's practice activity on one Malaysia day; the target is the mission's `question_count` in the unit of its goal kind.
 */

/** A completed practice session of the day. */
export interface GoalSession {
  correct: number
  total: number
  timeSpentSec: number
}

/** One practice answer of the day (all modes, the pupil's own, matching Mod Pelajar). */
export interface GoalAnswer {
  isCorrect: boolean
  topicId: string | null
}

export interface GoalFacts {
  /** Sessions COMPLETED on the day (`completed_at` inside the Malaysia day). */
  sessions: readonly GoalSession[]
  /** Answers given on the day (`answered_at` inside the Malaysia day). */
  answers: readonly GoalAnswer[]
  /** The pupil's stored current streak (kombo) in days. */
  streak: number
}

/** `[from, to)` of a Malaysia day `YYYY-MM-DD`: 00:00 +08:00 up to, not including, the next 00:00 +08:00. */
export function mytDayWindow(day: string): { from: Date; to: Date } {
  const from = startOfMytDay(new Date(`${day}T12:00:00+08:00`))
  return { from, to: new Date(from.getTime() + 24 * 3600_000) }
}

/**
 * Progress towards the target, a whole number in the unit of the kind (the goal is met at `progress >= target`):
 * - `sessions_per_day`: completed sessions of the day;
 * - `correct_per_day`: correct answers of the day;
 * - `correct_in_session`: the most correct answers in one completed session of the day;
 * - `accuracy_in_session`: the best accuracy percent of one completed session of the day, rounded DOWN (79.9 is 79, never 80);
 * - `minutes_per_day`: whole minutes practised (sum of the completed sessions' time spent, rounded down: 599 s is 9);
 * - `topics_per_day`: distinct topics among the day's answers (an answer without a topic counts for none);
 * - `streak_days`: the stored current streak.
 */
export function goalProgress(kind: MissionGoalKind, f: GoalFacts): number {
  switch (kind) {
    case 'sessions_per_day':
      return f.sessions.length
    case 'correct_per_day':
      return f.answers.filter((a) => a.isCorrect).length
    case 'correct_in_session':
      return f.sessions.reduce((best, s) => Math.max(best, s.correct), 0)
    case 'accuracy_in_session':
      return f.sessions.reduce((best, s) => (s.total > 0 ? Math.max(best, Math.floor((s.correct * 100) / s.total)) : best), 0)
    case 'minutes_per_day':
      return Math.floor(f.sessions.reduce((sum, s) => sum + Math.max(0, s.timeSpentSec), 0) / 60)
    case 'topics_per_day':
      return new Set(f.answers.flatMap((a) => (a.topicId === null ? [] : [a.topicId]))).size
    case 'streak_days':
      return Math.max(0, f.streak)
  }
}

export const goalMet = (progress: number, target: number): boolean => target > 0 && progress >= target
