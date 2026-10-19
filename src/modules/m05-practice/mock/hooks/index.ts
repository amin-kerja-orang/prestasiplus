/**
 * M05 test hooks (`window.__mock`, dev and e2e builds; SRS M05 v1.17 §6.13, FR-M05-146, FR-M05-150;
 * overview §6.13). Hook names are global, so they are the ones the SRSs name:
 *
 * | Hook | Effect |
 * |---|---|
 * | `addSession(userId, {mode, correct, total, timeSpentSec, at})` | one completed session without answers (M14 XR-M14-01 e; the pager test calls it n times) |
 * | `addAnswer({userId, questionId, isCorrect, answeredAt?})` | one answer without a session, plus the revision queue and the mastery counters (BR-31 steps 3–4); no wallet, streak or trial change (XR-M13-03b) |
 * | `setSubjectiveCounts(code, {levelId: n})` | the S3 "Latihan Subjektif" counts (E2E-M05-20) |
 * | `setSpmProgress(userId, subjectId, {answered, correct})` | S15 provisional progress (BR-27) |
 * | `answerChapter(userId, chapterId, {correctPct})` | answers every question of a chapter, `correctPct` % of them correctly (unlock tests) |
 *
 * Each validates its input and throws a `RangeError` / `TypeError` (the hook promise rejects), so a
 * typo in a test fails at the call. The default time is the shared mock clock.
 */

import { clock } from '@/lib/time'
import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions } from '@/modules/m04-question-bank/mock'

import type { SessionRow } from '../datasets/types'
import { practiceRepo } from '../repository/practice'
import { isMode } from '../repository/rules'
import { spmProgressTable, subjectiveCountsTable } from './fixtures'

export { FIXTURE_TABLES, fixtures } from './fixtures'
export type { SpmProgressRow, SubjectiveCountsRow } from './fixtures'

const isId = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

/** Every hook that names a user refuses one the M01 store does not know. */
function requireUser(userId: number, what: string): void {
  if (!isId(userId)) throw new RangeError(`${what}: invalid userId ${String(userId)}`)
  if (!users.get(userId)) throw new RangeError(`${what}: unknown user ${String(userId)}`)
}

function timeOf(value: unknown, what: string): number {
  const ms =
    typeof value === 'string' || typeof value === 'number' ? new Date(value).getTime() : NaN
  if (!Number.isFinite(ms)) throw new RangeError(`${what}: invalid time ${String(value)}`)
  return ms
}

export interface AddSessionInput {
  mode: SessionRow['mode']
  correct: number
  total: number
  timeSpentSec: number
  /** ISO time (or epoch ms) of completion. */
  at: string | number
}

/** `mock.addSession` (FR-M05-150). Returns the stored session. */
export function addSession(userId: number, input: AddSessionInput): SessionRow {
  requireUser(userId, 'addSession')
  if (typeof input !== 'object' || input === null) {
    throw new TypeError('addSession: expected {mode, correct, total, timeSpentSec, at}')
  }
  if (!isMode(input.mode)) throw new RangeError(`addSession: unknown mode ${String(input.mode)}`)
  if (!isCount(input.correct) || !isCount(input.total) || input.correct > input.total) {
    throw new RangeError('addSession: need integers with 0 ≤ correct ≤ total')
  }
  if (!isCount(input.timeSpentSec)) throw new RangeError('addSession: invalid timeSpentSec')
  // A numeric `at` (epoch ms) is accepted; the repository reads an ISO string.
  const at = new Date(timeOf(input.at, 'addSession')).toISOString()
  return practiceRepo.addSession(userId, {
    mode: input.mode,
    correct: input.correct,
    total: input.total,
    timeSpentSec: input.timeSpentSec,
    at,
  })
}

export interface AddAnswerInput {
  userId: number
  questionId: number
  isCorrect: boolean
  /** ISO time; default the mock clock. */
  answeredAt?: string
}

/** `mock.addAnswer` (FR-M05-146). Returns the stored answer (id ≥ 9,000,001). */
export function addAnswer(input: AddAnswerInput) {
  if (typeof input !== 'object' || input === null) {
    throw new TypeError('addAnswer: expected {userId, questionId, isCorrect, answeredAt?}')
  }
  requireUser(input.userId, 'addAnswer')
  if (!isId(input.questionId) || !questions.exists(input.questionId)) {
    throw new RangeError(`addAnswer: unknown question ${String(input.questionId)}`)
  }
  if (typeof input.isCorrect !== 'boolean') throw new TypeError('addAnswer: isCorrect is a boolean')
  if (input.answeredAt !== undefined) timeOf(input.answeredAt, 'addAnswer')
  return practiceRepo.addAnswer(
    {
      userId: input.userId,
      questionId: input.questionId,
      isCorrect: input.isCorrect,
      ...(input.answeredAt !== undefined ? { answeredAt: input.answeredAt } : {}),
    },
    clock.now(),
  )
}

/** `mock.setSubjectiveCounts(code, {levelId: n})` — replaces the subject's counts. */
export function setSubjectiveCounts(
  code: string,
  counts: Record<string, number>,
): Record<string, number> {
  const subject = typeof code === 'string' ? curriculum.subjectByCode(code) : undefined
  if (!subject) throw new RangeError(`setSubjectiveCounts: unknown subject ${String(code)}`)
  const clean: Record<string, number> = {}
  for (const [level, n] of Object.entries(counts ?? {})) {
    if (!/^\d+$/.test(level) || !isCount(n)) {
      throw new RangeError(`setSubjectiveCounts: invalid entry ${level}: ${String(n)}`)
    }
    clean[level] = n
  }
  if (subjectiveCountsTable.get(subject.id)) {
    subjectiveCountsTable.update(subject.id, { counts: clean })
  } else {
    subjectiveCountsTable.insert({ id: subject.id, counts: clean })
  }
  return clean
}

/** `mock.setSpmProgress(userId, subjectId, {answered, correct})` (BR-27). */
export function setSpmProgress(
  userId: number,
  subjectId: number,
  progress: { answered: number; correct: number },
): { answered: number; correct: number } {
  requireUser(userId, 'setSpmProgress')
  if (!isId(subjectId) || !curriculum.subject(subjectId)) {
    throw new RangeError(`setSpmProgress: unknown subject ${String(subjectId)}`)
  }
  if (
    typeof progress !== 'object' ||
    progress === null ||
    !isCount(progress.answered) ||
    !isCount(progress.correct) ||
    progress.correct > progress.answered
  ) {
    throw new RangeError('setSpmProgress: need integers with 0 ≤ correct ≤ answered')
  }
  const id = `${String(userId)}:${String(subjectId)}`
  const row = { answered: progress.answered, correct: progress.correct }
  if (spmProgressTable.get(id)) spmProgressTable.update(id, row)
  else spmProgressTable.insert({ id, userId, subjectId, ...row })
  return row
}

/**
 * `mock.answerChapter(userId, chapterId, {correctPct})`: one answer per question of the chapter
 * (id order), the first `round(n × correctPct ÷ 100)` correct. Returns `{answered, correct}`.
 */
export function answerChapter(
  userId: number,
  chapterId: number,
  options: { correctPct: number },
): { answered: number; correct: number } {
  requireUser(userId, 'answerChapter')
  const pct = options?.correctPct
  if (typeof pct !== 'number' || !Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new RangeError('answerChapter: correctPct is a number from 0 to 100')
  }
  if (!isId(chapterId) || !curriculum.chapter(chapterId)) {
    throw new RangeError(`answerChapter: unknown chapter ${String(chapterId)}`)
  }
  const ids = questions.query('Q-CHAPTER', { sort: 'id' }, chapterId).rows.map((q) => q.id)
  const correct = Math.round((ids.length * pct) / 100)
  const now = clock.now()
  ids.forEach((questionId, i) => {
    practiceRepo.addAnswer({ userId, questionId, isCorrect: i < correct }, now)
  })
  return { answered: ids.length, correct }
}

/** The plugin's `hooks` field. */
export const m05Hooks = {
  addSession,
  addAnswer,
  setSubjectiveCounts,
  setSpmProgress,
  answerChapter,
}
