/**
 * Cross-store reads of M08, through the owners' public entries only (D12): per-user session and answer
 * totals from M05, class and level members from M10, users and schools from M01 / M02.
 *
 * Performance (overview §6.6): the per-user session totals come from one scan of the session log
 * (M05 `practice.sessionTotals()`, XR-M08-M05-01), memoised until the log changes (stamp = session count +
 * answer count); answer-level reads use `practice.answerFacts` (XR-M08-M05-02), never one scan per user.
 *
 * INFERRED (unspecified): the memo stamp; the concentration of one pupil (5782, 1,510 sessions) is
 * harmless here because every output is an aggregate or a capped list (top 10 / 15 / 50, 90 heatmap days).
 */

import { practice, practiceAnswers, PRACTICE_MODES, SPM_MODES } from '@/modules/m05-practice/mock'
import { classrooms, type ClassroomRow } from '@/modules/m10-teacher-class/mock'

export const PRACTICE_MODE_SET: ReadonlySet<string> = new Set(PRACTICE_MODES)
/**
 * The modes Prestasi 360 (S6) counts for one student: the practice modes and, since D54 (v2 is
 * Tingkatan 4-5 / SPM only; DV-M08-40), the SPM modes. The class views keep PRACTICE_MODE_SET.
 */
export const STUDENT_MODE_SET: ReadonlySet<string> = new Set([...PRACTICE_MODES, ...SPM_MODES])

/**
 * The modes counted on a user's own S6 / S18 figures: learner accounts count the SPM modes too
 * (D54), any other account (the admin) keeps the OBSERVED practice-modes-only figures (DV-20).
 */
export const modesOfUser = (role: string): ReadonlySet<string> =>
  role === 'student' ? STUDENT_MODE_SET : PRACTICE_MODE_SET

export interface Totals {
  sessions: number
  questions: number
  correct: number
  seconds: number
  /** Σ of `correct ÷ questions` over sessions with questions (for the session mean). */
  accSum: number
  accN: number
  lastAtMs: number
}

const zero = (): Totals => ({
  sessions: 0,
  questions: 0,
  correct: 0,
  seconds: 0,
  accSum: 0,
  accN: 0,
  lastAtMs: 0,
})

export interface UserTotals {
  all: Totals
  practice: Totals
}

let stamp = ''

/** Memo of the class item analyses (`item-analysis.ts`), cleared with the totals. */
export const classAnalysisMemo = new Map<string, unknown>()

/** Memo of `schoolPerformance` (S1; key = arguments, value = owner data stamp + result), cleared with the totals. */
export const performanceMemo = new Map<string, { stamp: string; value: unknown }>()

/** Forgets the memo (every boot and `mock.reset()` runs the M08 seed, which calls this). */
export function resetReadCache(): void {
  allTotals = null
  classAnalysisMemo.clear()
  performanceMemo.clear()
  stamp = ''
}

/** Clears the memos when the log changed since they were filled. */
export function checkStamp(): void {
  const s = `${String(practice.count('Q-SESS-ALL'))}:${String(practiceAnswers.count('Q-ANS-ALL'))}`
  if (s !== stamp) {
    allTotals = null
    classAnalysisMemo.clear()
    performanceMemo.clear()
    stamp = s
  }
}

let allTotals: Map<number, UserTotals> | null = null

/** One scan of the session log for every user (M05 `practice.sessionTotals`), memoised per log stamp. */
function totalsMap(): Map<number, UserTotals> {
  checkStamp()
  if (allTotals === null) {
    allTotals = new Map<number, UserTotals>()
    for (const [id, t] of practice.sessionTotals())
      allTotals.set(id, { all: t.all, practice: t.practice })
  }
  return allTotals
}

const EMPTY: UserTotals = { all: zero(), practice: zero() }

/** A user's completed-session totals, all modes and practice modes (BR-M08-11); zeros for a user without sessions. */
export function totalsOf(userId: number): UserTotals {
  return totalsMap().get(userId) ?? EMPTY
}

/** Q-ANS-USER and its correct count for one user (all answers, with or without a session). */
export function answerTotalsOf(userId: number): { answered: number; correct: number } {
  return {
    answered: practiceAnswers.count('Q-ANS-USER', userId),
    correct: practiceAnswers.count('Q-ANS-USER-CORRECT', userId),
  }
}

/** Sums the totals of a set of users. */
export function sumTotals(userIds: Iterable<number>, which: keyof UserTotals = 'all'): Totals {
  const out = zero()
  for (const id of userIds) {
    const t = totalsOf(id)[which]
    out.sessions += t.sessions
    out.questions += t.questions
    out.correct += t.correct
    out.seconds += t.seconds
    out.accSum += t.accSum
    out.accN += t.accN
    if (t.lastAtMs > out.lastAtMs) out.lastAtMs = t.lastAtMs
  }
  return out
}

/** Q-SESS-MEAN-ACC of a set of users in percent (mean of the session accuracies). */
export const meanAccuracy = (t: Totals): number => (t.accN === 0 ? 0 : (t.accSum / t.accN) * 100)

// ---------------------------------------------------------------------------------------------
// Classes and levels (M10)
// ---------------------------------------------------------------------------------------------

export const LEVEL_SLUG: Readonly<Record<'t4' | 't5', 'tingkatan-4' | 'tingkatan-5'>> = {
  t4: 'tingkatan-4',
  t5: 'tingkatan-5',
}

/** Distinct active members of every class of a level slug. */
export function levelStudentIds(slug: 'tingkatan-4' | 'tingkatan-5'): number[] {
  const set = new Set<number>()
  for (const c of classrooms.list({ educationLevel: slug })) {
    for (const id of classrooms.memberIds(c.kind, c.classId)) set.add(id)
  }
  return [...set].sort((a, b) => a - b)
}

export type { ClassroomRow }

/** Distinct students actively enrolled in a set of classes. */
export function studentsOfClasses(list: readonly ClassroomRow[]): number[] {
  const set = new Set<number>()
  for (const c of list) for (const id of classrooms.memberIds(c.kind, c.classId)) set.add(id)
  return [...set].sort((a, b) => a - b)
}
