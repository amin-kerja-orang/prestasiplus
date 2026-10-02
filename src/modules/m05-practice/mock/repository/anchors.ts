/**
 * Anchor records of the M05 datasets (SRS M05 v1.16 §6.12, §6.14.1 "Anchor records (observed
 * records, then designed records) replace generated rows of the same cell").
 *
 * Anchors are added when the datasets compile (the composer compiles M01 and M04 first, so their
 * reads are open): the canonical accounts' records (`../datasets/canonical.ts`, whose SPM questions
 * are drawn from the M04 pool then) and every other module's contributions, queued in its
 * `seed(ctx)` through `practice.contributeAnswers` / `practice.contributeSessions`. Contributors give
 * the observed fields; M05 completes the spec facets from the user and the time (`./facets.ts`) and
 * the question fields from M04. An anchor of an inactive user is refused (M05 does not give
 * answers or sessions to inactive users; M02 v1.23, the 18 login-only pupils of 8090).
 */

import { toIsoMyt } from '@/lib/time'
import { fnv1a32, mulberry32 } from '@/mock/determinism'
import { users } from '@/modules/m01-authentication/mock'
import { questions } from '@/modules/m04-question-bank/mock'

import {
  ADMIN_SESSIONLESS,
  CANONICAL_ANSWER_ID_START,
  DESIGNED_SESSIONS,
  type DesignedQuestion,
} from '../datasets/canonical'
import { isAnchorSessionId } from '../datasets/ids'
import { sessionCoins } from '../datasets/pins'
import type { AnswerRow, PracticeMode, SessionRow } from '../datasets/types'
import { specFacetsFor } from './facets'

/** An answer anchor as a contributor gives it (M05 completes the rest). */
export interface AnswerAnchorInput {
  /** In the anchor range 510,001–999,999 (`../datasets/ids.ts`); it replaces a slot of its cell. */
  id: number
  userId: number
  questionId: number
  isCorrect: boolean
  answeredAt: string
  sessionId?: string | null
  selectedOptionId?: number | null
  /** Kept for orphans (a question M04 no longer has, M18 C9); else taken from M04. */
  subjectId?: number | null
  levelId?: number | null
  chapterId?: number | null
}

/** A session anchor as a contributor gives it. */
export interface SessionAnchorInput {
  /** One or two capital letters and 1–5 digits ("H01"). */
  id: string
  userId: number
  mode: PracticeMode
  completedAt: string
  questionCount: number
  correctCount: number
  subjectId?: number | null
  levelId?: number | null
  timeSpent?: number
  coinsEarned?: number
  pointsEarned?: number
  questionIds?: number[]
  missionId?: number | null
  remedialTestId?: number | null
  questionSetId?: number | null
  chapterId?: number | null
}

function fail(message: string): never {
  throw new Error(`M05 practice anchors: ${message}`)
}

function requireActive(userId: number, what: string): void {
  const u = users.get(userId)
  if (!u) fail(`${what}: unknown user ${String(userId)}`)
  if (!u.isActive) fail(`${what}: user ${String(userId)} is inactive and never practises`)
}

export function completeAnswer(a: AnswerAnchorInput, contributor: string): AnswerRow {
  const [lo, hi] = contributor === 'M05' ? [500_001, 509_999] : [510_001, 999_999]
  if (!Number.isInteger(a.id) || a.id < lo || a.id > hi) {
    fail(`answer ${String(a.id)} (${contributor}): anchor ids are ${String(lo)}–${String(hi)}`)
  }
  requireActive(a.userId, `answer ${String(a.id)} (${contributor})`)
  const ms = Date.parse(a.answeredAt)
  if (!Number.isFinite(ms)) fail(`answer ${String(a.id)}: bad answeredAt ${a.answeredAt}`)
  const q = questions.get(a.questionId)
  const sessionId = a.sessionId ?? null
  const correctKey = q?.correctAnswer ?? null
  return {
    id: a.id,
    ...specFacetsFor(a.userId, ms),
    sessionId,
    hasSession: sessionId !== null,
    userId: a.userId,
    questionId: a.questionId,
    subjectId: a.subjectId !== undefined ? a.subjectId : (q?.subjectId ?? null),
    levelId: a.levelId !== undefined ? a.levelId : (q?.educationLevelId ?? null),
    chapterId: a.chapterId !== undefined ? a.chapterId : (q?.curriculumChapterId ?? null),
    selectedOptionId:
      a.selectedOptionId !== undefined
        ? a.selectedOptionId
        : correctKey === null
          ? null
          : a.isCorrect
            ? correctKey
            : (correctKey + 1) % 4,
    isCorrect: a.isCorrect,
    answeredAt: toIsoMyt(ms),
    answeredAtMs: ms,
  }
}

export function completeSession(s: SessionAnchorInput, contributor: string): SessionRow {
  if (!isAnchorSessionId(s.id)) fail(`session '${s.id}' (${contributor}): id must look like "H01"`)
  requireActive(s.userId, `session ${s.id} (${contributor})`)
  const ms = Date.parse(s.completedAt)
  if (!Number.isFinite(ms)) fail(`session ${s.id}: bad completedAt ${s.completedAt}`)
  const time = s.timeSpent ?? 0
  const coins = s.coinsEarned ?? sessionCoins(s.mode, s.correctCount)
  return {
    id: s.id,
    ...specFacetsFor(s.userId, ms),
    userId: s.userId,
    mode: s.mode,
    subjectId: s.subjectId ?? null,
    levelId: s.levelId ?? null,
    difficulty: null,
    chapterId: s.chapterId ?? null,
    year: null,
    setNo: null,
    targetQuestionId: null,
    missionId: s.missionId ?? null,
    remedialTestId: s.remedialTestId ?? null,
    questionSetId: s.questionSetId ?? null,
    timeLimitSec: null,
    pkskDomainId: null,
    pkskTargetLevel: null,
    questionIds: s.questionIds ?? [],
    questionCount: s.questionCount,
    status: 'completed',
    correctCount: s.correctCount,
    timeSpent: time,
    coinsEarned: coins,
    pointsEarned: s.pointsEarned ?? 10 * s.correctCount,
    startedAt: toIsoMyt(ms - time * 1_000),
    completedAt: toIsoMyt(ms),
    completedAtMs: ms,
  }
}

// ---------------------------------------------------------------------------------------------
// The canonical accounts (§6.12)
// ---------------------------------------------------------------------------------------------

/** SPM pool draws per pool key (signed subject id; `../datasets/canonical.ts`). */
function poolDraws(): Map<number, number[]> {
  const need = new Map<number, number>()
  const note = (q: DesignedQuestion) => {
    if ('pool' in q) need.set(q.pool, Math.max(need.get(q.pool) ?? 0, q.draw + 1))
  }
  for (const s of DESIGNED_SESSIONS) for (const a of s.answers) note(a.question)
  const out = new Map<number, number[]>()
  for (const [pool, n] of need) {
    const subjectId = Math.abs(pool)
    const rng = mulberry32(fnv1a32(`m05:canonical-spm:${String(pool)}`))
    const rows = questions.spmPool({ subjectId }).sample(n, rng)
    if (rows.length < n)
      fail(
        `SPM pool of subject ${String(subjectId)} has ${String(rows.length)} < ${String(n)} rows`,
      )
    out.set(
      pool,
      rows.map((r) => r.id),
    )
  }
  return out
}

export interface CanonicalAnchors {
  answers: AnswerRow[]
  sessions: SessionRow[]
}

/** The canonical accounts' anchors (answers 500,001–500,250; sessions A2–A5, P1–P4, M1–M4). */
export function canonicalAnchors(): CanonicalAnchors {
  const draws = poolDraws()
  const qid = (q: DesignedQuestion): number =>
    'questionId' in q ? q.questionId : ((draws.get(q.pool) as number[])[q.draw] as number)
  let nextId = CANONICAL_ANSWER_ID_START
  const answers: AnswerRow[] = []
  const t0 = Date.parse(ADMIN_SESSIONLESS.from)
  ADMIN_SESSIONLESS.answers.forEach((a, i) => {
    answers.push(
      completeAnswer(
        {
          id: nextId++,
          userId: ADMIN_SESSIONLESS.userId,
          questionId: qid(a.question),
          isCorrect: a.isCorrect,
          answeredAt: toIsoMyt(t0 + i * 60_000),
          sessionId: null,
        },
        'M05',
      ),
    )
  })
  const sessions: SessionRow[] = []
  const ordered = [...DESIGNED_SESSIONS].sort(
    (a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt),
  )
  for (const s of ordered) {
    const end = Date.parse(s.completedAt)
    const start = end - s.timeSpent * 1_000
    const n = s.answers.length
    const questionIds = s.answers.map((a) => qid(a.question))
    s.answers.forEach((a, i) => {
      const at = start + Math.round(((i + 1) * s.timeSpent * 1_000) / n / 1_000) * 1_000
      answers.push(
        completeAnswer(
          {
            id: nextId++,
            userId: s.userId,
            questionId: questionIds[i] as number,
            isCorrect: a.isCorrect,
            answeredAt: toIsoMyt(Math.min(at, end)),
            sessionId: s.id,
          },
          'M05',
        ),
      )
    })
    const correct = s.answers.filter((a) => a.isCorrect).length
    const row = completeSession(
      {
        id: s.id,
        userId: s.userId,
        mode: s.mode,
        completedAt: s.completedAt,
        questionCount: n,
        correctCount: correct,
        subjectId: s.subjectId,
        levelId: s.levelId,
        chapterId: s.chapterId,
        timeSpent: s.timeSpent,
        questionIds,
      },
      'M05',
    )
    sessions.push({ ...row, year: s.year, setNo: s.setNo })
  }
  return { answers, sessions }
}
