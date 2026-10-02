/**
 * Session start (SRS M05 v1.16 §7 #4; BR-04, BR-07, BR-11, BR-13–BR-17, BR-32; §5; M06 BR-M06-05 /
 * 07 / 13 for the SPM modes). Resolves the questions of a new session, or refuses it with a
 * `PracticeError` the handler turns into the HTTP answer. No write happens here.
 */

import type { Prng } from '@/mock/determinism'
import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import type { Question } from '@/modules/m04-question-bank/mock'
import { questions } from '@/modules/m04-question-bank/mock'

import { mytDateKey } from '../datasets/calendar'
import type { PracticeMode, SessionRow } from '../datasets/types'
import { chapterStats, scanSessions, userAnswers, userQueue, type QueueItem } from './reads'
import {
  COUNT_OPTIONS,
  LATIH_TUBI_COUNTS,
  LATIH_TUBI_TARGETS,
  MESSAGES,
  MISSION_COINS_PER_CORRECT,
  OFFERED_LEVEL_IDS,
  PAST_YEAR_COUNTS,
  PracticeError,
  REVISION_LENGTH,
  SPM_LEVEL_IDS,
  UNLOCK_SCORE,
  isMode,
} from './rules'
import { seams } from './seams'

/** The #4 request body (every mode). */
export interface StartRequest {
  mode: PracticeMode
  subjectCode?: string
  levelId?: number | null
  difficulty?: number | null
  count?: number
  chapterId?: number
  year?: number
  setNo?: number
  targetQuestionId?: number | null
  missionId?: number
  remedialTestId?: number
  questionSetId?: number
}

/** What a start resolves to (before the session row exists). */
export interface StartPlan {
  mode: PracticeMode
  subjectId: number | null
  levelId: number | null
  difficulty: number | null
  chapterId: number | null
  year: number | null
  setNo: number | null
  targetQuestionId: number | null
  missionId: number | null
  remedialTestId: number | null
  questionSetId: number | null
  timeLimitSec: number | null
  questionIds: number[]
  /** Revision (BR-14). */
  revisionMeta: { selected: number; totalWrong: number } | null
  /** Mission coin rate (BR-09). */
  coinsPerCorrect: number | null
  /** An in-progress session to resume (mission, BR-32) instead of a new one. */
  resume: SessionRow['id'] | null
}

const notFound = () => new PracticeError(404, 'NOT_FOUND', 'Rekod tidak dijumpai.')
const invalid = (field: string, message = 'Nilai tidak sah.') =>
  new PracticeError(422, 'VALIDATION_ERROR', message, { [field]: message })
const notEnough = () => new PracticeError(422, 'NOT_ENOUGH_QUESTIONS', MESSAGES.notEnough)

function subjectOf(code: unknown) {
  if (typeof code !== 'string' || code === '') throw notFound()
  const s = curriculum.subjectByCode(code)
  if (!s || !s.isActive) throw notFound()
  return s
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

function optionalInt(v: unknown, field: string, allowed: (n: number) => boolean): number | null {
  if (v === undefined || v === null) return null
  if (!isInt(v) || !allowed(v)) throw invalid(field)
  return v
}

function countIn(v: unknown, options: readonly number[]): number {
  if (!isInt(v) || !options.includes(v)) throw invalid('count')
  return v
}

const blank = (mode: PracticeMode): StartPlan => ({
  mode,
  subjectId: null,
  levelId: null,
  difficulty: null,
  chapterId: null,
  year: null,
  setNo: null,
  targetQuestionId: null,
  missionId: null,
  remedialTestId: null,
  questionSetId: null,
  timeLimitSec: null,
  questionIds: [],
  revisionMeta: null,
  coinsPerCorrect: null,
  resume: null,
})

/** BR-15: the chapters of a pair that have ≥ 1 chapter question, in `chapterNumber` order. */
function practiceChapters(subjectId: number, levelId: number) {
  return curriculum
    .chapters(subjectId, levelId)
    .filter((c) => c.isActive && questions.count('Q-CHAPTER', c.id) > 0)
}

/** BR-16: chapter 1 is open; chapter k needs chapter k − 1 complete with a score ≥ 70. */
export function chapterOpen(userId: number, chapterId: number): boolean {
  const ch = curriculum.chapter(chapterId)
  if (!ch || ch.educationLevelId === null) return false
  const list = practiceChapters(ch.subjectId, ch.educationLevelId)
  const i = list.findIndex((c) => c.id === chapterId)
  if (i <= 0) return i === 0
  const prev = chapterStats(userId, (list[i - 1] as { id: number }).id)
  return prev.complete && prev.scorePct >= UNLOCK_SCORE
}

/** BR-17: unanswered questions first (stored order), then the answered ones by oldest last answer. */
function chapterQuestions(userId: number, chapterId: number, count: number): number[] {
  const all = questions.query('Q-CHAPTER', { sort: 'id' }, chapterId).rows.map((q) => q.id)
  const last = new Map<number, number>()
  for (const a of userAnswers(userId, { chapterId })) last.set(a.questionId, a.answeredAtMs)
  const fresh = all.filter((id) => !last.has(id))
  const seen = all
    .filter((id) => last.has(id))
    .sort((a, b) => (last.get(a) as number) - (last.get(b) as number) || a - b)
  return [...fresh, ...seen].slice(0, count)
}

/** Completed / in-progress sessions of a user linked to an M10 record (Q-SESS-LINK). */
function linked(
  userId: number,
  field: 'missionId' | 'remedialTestId' | 'questionSetId',
  id: number,
) {
  return scanSessions({ userId }, (s) => s[field] === id)
}

/**
 * Resolves a start. `sessionSeed` keys the random draws (the session id, BR-13); `now` is the mock
 * clock (epoch ms).
 */
export function planStart(
  userId: number,
  req: StartRequest,
  now: number,
  sessionSeed: string,
  rng: Prng,
): StartPlan {
  if (!isMode(req.mode) || req.mode === 'pksk') throw invalid('mode')
  const plan = blank(req.mode)

  // BR-07: a user without a subscription and no trial left cannot start (402, LS-8 provisional).
  const trial = users.trial(userId, now)
  if (trial.active && trial.remaining === 0) {
    throw new PracticeError(402, 'TRIAL_EXHAUSTED', MESSAGES.trialExhausted)
  }

  switch (req.mode) {
    case 'random': {
      const s = subjectOf(req.subjectCode)
      const offered = s.educationLevelIds.filter((l) =>
        (OFFERED_LEVEL_IDS as readonly number[]).includes(l),
      )
      const levelId = optionalInt(req.levelId, 'levelId', (l) => offered.includes(l))
      const difficulty = optionalInt(req.difficulty, 'difficulty', (d) => d >= 1 && d <= 5)
      const count = countIn(req.count, COUNT_OPTIONS)
      const levels = levelId !== null ? [levelId] : offered
      if (levels.length === 0) throw notEnough()
      const rows = questions.practiceQuery({
        subjectId: s.id,
        educationLevelIds: levels,
        ...(difficulty !== null ? { difficultyLevel: difficulty } : {}),
        limit: count,
        seed: sessionSeed,
      })
      if (rows.length < count) throw notEnough()
      Object.assign(plan, {
        subjectId: s.id,
        levelId,
        difficulty,
        questionIds: rows.map((q) => q.id),
      })
      return plan
    }
    case 'chapter': {
      if (!isInt(req.chapterId)) throw notFound()
      const ch = curriculum.chapter(req.chapterId)
      if (!ch || !ch.isActive || ch.educationLevelId === null) throw notFound()
      const count = countIn(req.count, COUNT_OPTIONS)
      if (questions.count('Q-CHAPTER', ch.id) === 0) throw notEnough()
      if (!chapterOpen(userId, ch.id)) {
        throw new PracticeError(409, 'CHAPTER_LOCKED', MESSAGES.chapterLocked)
      }
      Object.assign(plan, {
        subjectId: ch.subjectId,
        levelId: ch.educationLevelId,
        chapterId: ch.id,
        questionIds: chapterQuestions(userId, ch.id, count),
      })
      return plan
    }
    case 'revision': {
      const s = subjectOf(req.subjectCode)
      if (req.count !== undefined && req.count !== REVISION_LENGTH) throw invalid('count')
      const queue: QueueItem[] = userQueue(userId, s.id)
      if (queue.length === 0) {
        throw new PracticeError(422, 'NO_WRONG_QUESTIONS', MESSAGES.revisionFailed)
      }
      const picked = queue.slice(0, REVISION_LENGTH)
      Object.assign(plan, {
        subjectId: s.id,
        questionIds: picked.map((q) => q.questionId),
        revisionMeta: { selected: picked.length, totalWrong: queue.length },
      })
      return plan
    }
    case 'past_year': {
      const s = subjectOf(req.subjectCode)
      const count = countIn(req.count, PAST_YEAR_COUNTS)
      const rows = questions.spmPool({ subjectId: s.id }).sample(count, rng)
      if (rows.length === 0) throw notEnough()
      Object.assign(plan, { subjectId: s.id, questionIds: rows.map((q) => q.id) })
      return plan
    }
    case 'latih_tubi': {
      const s = subjectOf(req.subjectCode)
      const levelId = optionalInt(req.levelId, 'levelId', (l) =>
        (SPM_LEVEL_IDS as readonly number[]).includes(l),
      )
      const difficulty = optionalInt(req.difficulty, 'difficulty', (d) => d >= 2 && d <= 5)
      if (req.targetQuestionId !== undefined && req.targetQuestionId !== null) {
        // M04 BR-M04-17 "Buka Soalan Sama": one eligible SPM-pool question of the subject.
        if (req.count !== 1) throw invalid('count')
        const q: Question | null = isInt(req.targetQuestionId)
          ? questions.getEligible(req.targetQuestionId)
          : null
        if (!q || !q.spmPool || q.subjectId !== s.id) throw invalid('targetQuestionId')
        Object.assign(plan, {
          subjectId: s.id,
          targetQuestionId: q.id,
          questionIds: [q.id],
        })
        return plan
      }
      const target = LATIH_TUBI_TARGETS[s.id]
      const count =
        target !== undefined ? countIn(req.count, [target]) : countIn(req.count, LATIH_TUBI_COUNTS)
      const rows = questions
        .spmPool({
          subjectId: s.id,
          ...(levelId !== null ? { educationLevelIds: [levelId] } : {}),
          ...(difficulty !== null ? { difficultyLevel: difficulty } : {}),
        })
        .sample(count, rng)
      if (rows.length === 0) throw notEnough()
      Object.assign(plan, {
        subjectId: s.id,
        levelId,
        difficulty,
        questionIds: rows.map((q) => q.id),
      })
      return plan
    }
    case 'ramalan': {
      const s = subjectOf(req.subjectCode)
      if (!isInt(req.year) || !isInt(req.setNo)) throw notFound()
      const ids = seams().ramalanQuestions(s.id, req.year, req.setNo)
      if (ids === null) throw notFound()
      if (ids.length === 0) throw new PracticeError(422, 'SET_NOT_READY', MESSAGES.notEnough)
      Object.assign(plan, { subjectId: s.id, year: req.year, setNo: req.setNo, questionIds: ids })
      return plan
    }
    case 'mission': {
      if (!isInt(req.missionId)) throw notFound()
      const today = mytDateKey(now)
      const mission = seams()
        .missionsForStudent(userId, today)
        .find((m) => m.id === req.missionId)
      if (!mission) throw notFound()
      const sessions = linked(userId, 'missionId', mission.id)
      if (sessions.some((x) => x.status === 'completed')) {
        throw new PracticeError(409, 'ALREADY_COMPLETED', MESSAGES.missionDone)
      }
      const open = sessions.find((x) => x.status === 'in_progress')
      if (open) return { ...plan, missionId: mission.id, resume: open.id }
      const ids = seams().missionQuestionIds(mission.id, userId)
      if (ids.length === 0) throw notEnough()
      Object.assign(plan, {
        subjectId: mission.subjectId,
        missionId: mission.id,
        questionIds: ids,
        coinsPerCorrect: mission.coinsPerCorrect || MISSION_COINS_PER_CORRECT,
      })
      return plan
    }
    case 'remedial': {
      if (!isInt(req.remedialTestId)) throw notFound()
      const id = req.remedialTestId
      const test = seams()
        .remedialTestsForStudent(userId)
        .find((t) => t.id === id)
      if (!test || test.studentId !== userId || test.status === 'cancelled') throw notFound()
      if (test.status === 'completed') {
        throw new PracticeError(409, 'ALREADY_COMPLETED', MESSAGES.remedialDone)
      }
      if (test.questionIds.length === 0) throw notEnough()
      Object.assign(plan, {
        subjectId: test.subjectId,
        remedialTestId: test.id,
        questionIds: test.questionIds,
      })
      return plan
    }
    case 'question_set': {
      if (!isInt(req.questionSetId)) throw notFound()
      const set = seams()
        .questionSetsVisible(userId)
        .find((x) => x.id === req.questionSetId)
      if (!set) throw notFound()
      const done = linked(userId, 'questionSetId', set.id).filter((x) => x.status === 'completed')
      if (set.maxAttempts > 0 && done.length >= set.maxAttempts) {
        throw new PracticeError(409, 'NO_ATTEMPTS_LEFT', MESSAGES.noAttempts)
      }
      if (set.questionIds.length === 0) throw notEnough()
      const first = questions.get(set.questionIds[0] as number)
      Object.assign(plan, {
        subjectId: set.subjectId ?? first?.subjectId ?? null,
        questionSetId: set.id,
        questionIds: set.questionIds,
        timeLimitSec: set.timeLimitMinutes !== null ? set.timeLimitMinutes * 60 : null,
      })
      return plan
    }
    default:
      throw invalid('mode')
  }
}
