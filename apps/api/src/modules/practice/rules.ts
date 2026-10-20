/**
 * Business rules and fixed values of the M05 write path (SRS M05 v1.16 section 4, 5 and 8.3; M06
 * BR-M06-04 / 07 / 13 for the SPM modes that go through the same start). Values are the mock's
 * (`src/modules/m05-practice/mock/repository/rules.ts`); keys that the mock held as mock ids are keyed
 * by CODE here, because v2 ids come from the identity columns.
 */
import { PRACTICE_COUNT_OPTIONS, PRACTICE_REVISION_LENGTH, type PracticeMode } from '@pp/contract'

import type { RateLimitSpec } from '../../common/throttle'

/** Question counts of random and chapter sessions. */
export const COUNT_OPTIONS: readonly number[] = PRACTICE_COUNT_OPTIONS
/** BR-14: revision length. */
export const REVISION_LENGTH = PRACTICE_REVISION_LENGTH
/** BR-M06-13: `past_year` counts. */
export const PAST_YEAR_COUNTS: readonly number[] = [5, 10, 20]
/** BR-M06-04: Latih Tubi counts of a subject without a target. */
export const LATIH_TUBI_COUNTS: readonly number[] = [5, 10, 20, 30, 40, 50, 60]
/**
 * BR-M06-04: Latih Tubi target size per SUBJECT CODE (the mock keyed them by its subject ids, which are
 * the 1-based position of the subject in `prisma/seed/curriculum-data/subjects.json`).
 */
export const LATIH_TUBI_TARGETS: Readonly<Record<string, number>> = {
  BM: 34,
  BI: 36,
  MATH: 40,
  SCI: 40,
  SEJ: 40,
  GEO: 40,
  BIO: 40,
  CHEM: 40,
  PHY: 40,
  PI: 40,
  PM: 40,
  EKON: 40,
  BA: 40,
  PSI: 40,
  ADDMATH: 20,
}
/** BR-11: the practice levels offered to random sessions are Darjah 1 to 4 (by level code). */
export const OFFERED_LEVEL_CODES: readonly string[] = ['D1', 'D2', 'D3', 'D4']
/** The SPM levels (T4, T5) a Latih Tubi session may name (by level code). */
export const SPM_LEVEL_CODES: readonly string[] = ['T4', 'T5']

/** BR-30: `timeSpent` cap per question. */
export const MAX_SECONDS_PER_QUESTION = 180
/** BR-09. */
export const POINTS_PER_CORRECT = 10
/** BR-09: mission sessions pay 3 coins per correct answer unless the mission says otherwise. */
export const MISSION_COINS_PER_CORRECT = 3
/** BR-16: chapter unlock score (percent). */
export const UNLOCK_SCORE = 70
/** Default page size of the history list. */
export const HISTORY_PAGE_SIZE = 15

/**
 * BR-09 (observed: the coins stored on a session are the correct answers, times the mission rate for a
 * `mission` session). The wallet credit has its own rate and comes back from the reward port.
 */
export function sessionCoins(mode: PracticeMode, correct: number, coinsPerCorrect?: number | null): number {
  return mode === 'mission' ? correct * (coinsPerCorrect || MISSION_COINS_PER_CORRECT) : correct
}

/** S7 (revision, observed) and Q1 / Q2 (proposed) feedback titles. */
export function feedbackText(mode: PracticeMode, isCorrect: boolean): string {
  if (mode === 'revision') return isCorrect ? 'Betul! Kali ini berjaya!' : 'Masih belum tepat'
  return isCorrect ? 'Betul!' : 'Salah'
}

/** Every write is limited per user (checks are frequent in a quiz, so the ceiling is generous). */
export const PRACTICE_LIMITS = {
  write: { bucket: 'practice.write', env: 'THROTTLE_PRACTICE_WRITE_PER_MINUTE', default: 120, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>
