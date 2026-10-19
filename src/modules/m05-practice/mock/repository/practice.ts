/**
 * The `practice` repositories (owner **M05**; D12, overview §6.7, §6.8; SRS M05 v1.16 §6.14, §7,
 * BR-06/07/09/14/20/30/31/32/34/35). The only doorway to the practice stores:
 *
 * - **`practice`** — primary store the sessions dataset (named queries Q-SESS-*), plus the answer
 *   log and the tables. Domain methods: the write path `startSession` → `checkAnswer` →
 *   `completeSession` (BR-31, one transaction, M14 step 6), the BR-34 direct completion, the hook
 *   writes `addAnswer` / `addSession` (M05-T1 registers the hooks), the reads `session`, `history`,
 *   `historyPage`, `answers`, `sessionAnswers`, `queue`, `queueAll`, `mastery`, `chapterStats`,
 *   `sessionMeanAccuracy`, `distinctUsers`, the seed contributions (`contributeAnswers`,
 *   `contributeSessions`, `contributeMastery`) and the build check.
 * - **`practiceAnswers`** — primary store the answer log (named queries Q-ANS-*).
 *
 * Repository methods are synchronous; writes take `now` (epoch ms, the handler's `ctx.clock.now()`).
 */

import { toIsoMyt } from '@/lib/time'
import { checkNamedQueries, defineNamedQueries } from '@/mock/dataset'
import type { Where } from '@/mock/define'
import type { Contributor } from '@/mock/repository'
import { defineRepository, RepositoryError } from '@/mock/repository'
import type { Prng } from '@/mock/determinism'
import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import type { Question } from '@/modules/m04-question-bank/mock'
import { questions } from '@/modules/m04-question-bank/mock'

import { answersDataset } from '../datasets/answers'
import { PIN_NOW, periodFrom, type Period } from '../datasets/calendar'
import { DESIGNED_MASTERY, DESIGNED_SPM_TARGETS } from '../datasets/canonical'
import { clearDrawCache } from '../datasets/derive'
import { generatedSessionKey } from '../datasets/ids'
import {
  ANSWERS_CORRECT,
  NON_P_TOTAL,
  OTHER_TOTAL,
  P_ANSWERS,
  P_CORRECT,
  SEGMENT_TOTAL,
  SESSIONLESS_TOTAL,
  SESSIONS_TOTAL,
  SESSION_MEAN_ACC_ALL,
} from '../datasets/pins'
import {
  buildPracticePrime,
  practicePrimeOrNull,
  requirePracticePrime,
  resetPracticePrime,
} from '../datasets/prime'
import { SEGMENT_SCHOOLS, M11_WEEKLY, BEFORE_M1 } from '../datasets/m11-cells'
import { sessionsDataset } from '../datasets/sessions'
import type {
  AnswerRow,
  CheckRow,
  PracticeMode,
  SessionRow,
  SpmGrade,
  StructuredAttemptRow,
} from '../datasets/types'
import {
  checksTable,
  masteryTable,
  queueTable,
  spmTargetsTable,
  structuredAttemptsTable,
  subjectUsageTable,
} from '../tables/tables'
import {
  canonicalAnchors,
  completeAnswer,
  completeSession as completeSessionAnchor,
  type AnswerAnchorInput,
  type SessionAnchorInput,
} from './anchors'
import {
  answerFacts,
  questionTallies,
  resetAnswerFacts,
  sessionTotals,
  subjectTotals,
} from './aggregates'
import { class1156Anchors } from './class1156'
import { specFacetsFor } from './facets'
import { weekRank, type WeekRankOptions, type WeekRankRow } from './week-rank'
import {
  byCompletedDesc,
  chapterStats,
  hasStoredQueue,
  practiceReady,
  queueFromAnswers,
  scanSessions,
  userAnswers,
  userHistory,
  userMastery,
  userQueue,
  userQueueAll,
  type AnswerFilter,
  type HistoryFilter,
  type MasteryItem,
  type SessionSummary,
} from './reads'
import {
  MAX_SECONDS_PER_QUESTION,
  MESSAGES,
  MISSION_COINS_PER_CORRECT,
  sessionCoins,
  POINTS_PER_CORRECT,
  PracticeError,
  feedbackText,
  isMode,
} from './rules'
import { nextCacheKey } from './reads'
import { seams, type GamificationResult } from './seams'
import { planStart, type StartPlan, type StartRequest } from './start'

// ---------------------------------------------------------------------------------------------
// Named queries (§6.14.2)
// ---------------------------------------------------------------------------------------------

let boundNow: () => number = () => PIN_NOW

/** Binds the clock the period queries read (every seed; the M05 seed binds `ctx.clock`). */
export function bindPracticeClock(now: () => number): void {
  boundNow = now
}

const since = (period: Period | '' | undefined) =>
  period ? { answeredAtMs: { gte: periodFrom(period, boundNow()) } } : {}
const sinceSession = (period: Period | '' | undefined) =>
  period ? { completedAtMs: { gte: periodFrom(period, boundNow()) } } : {}

const segmentTotals = SEGMENT_SCHOOLS.map((s) => ({
  args: [undefined, s] as unknown[],
  value: (M11_WEEKLY[s] as readonly number[]).reduce((a, b) => a + b, 0) + (BEFORE_M1[s] ?? 0),
}))

export const answerQueries = defineNamedQueries(answersDataset, {
  'Q-ANS-ALL': { expected: 478_499, source: 'M05 §6.14.2 (M08 S1 "Soalan Dijawab")' },
  'Q-ANS-CORRECT': {
    where: { isCorrect: true },
    expected: ANSWERS_CORRECT,
    source: 'M05 §6.14.2 (XL3-01 pin)',
  },
  'Q-ANS-NOSESSION': {
    where: { hasSession: false },
    expected: SESSIONLESS_TOTAL,
    source: 'M05 §6.14.2',
  },
  /** (period?, schoolId?, week?): the monitoring segment (M11 BR-M11-10 periods, week Mk). */
  'Q-ANS-SEG': {
    where: (period?: Period | '', schoolId?: number, week?: number): Where<AnswerRow> => ({
      seg: 'mon',
      ...(schoolId !== undefined ? { schoolId } : {}),
      ...(week !== undefined ? { week } : {}),
      ...since(period),
    }),
    expected: [{ args: [], value: SEGMENT_TOTAL }, ...segmentTotals],
    source: 'M05 §6.14.2 (M11 S2–S5 snapshot)',
  },
  'Q-ANS-OTHER': { where: { seg: 'oth' }, expected: OTHER_TOTAL, source: 'M05 §6.14.2' },
  /** (userId, period?): a user's answers (count); `-CORRECT` their correct ones. */
  'Q-ANS-USER': {
    where: (userId: number, period?: Period | ''): Where<AnswerRow> => ({
      userId,
      ...since(period),
    }),
    expected: [
      { args: [1], value: 119 },
      { args: [2], value: 94 },
      { args: [4], value: 37 },
    ],
    source: 'M05 §6.12 (S8 `all`)',
  },
  'Q-ANS-USER-CORRECT': {
    where: (userId: number, period?: Period | ''): Where<AnswerRow> => ({
      userId,
      isCorrect: true,
      ...since(period),
    }),
    expected: [
      { args: [1], value: 46 },
      { args: [2], value: 70 },
      { args: [4], value: 26 },
    ],
    source: 'M05 §6.12',
  },
  /** M17 population P (active students outside the fixture schools), optional period. */
  'Q-ANS-P': {
    where: (period?: Period | ''): Where<AnswerRow> => ({ inP: true, ...since(period) }),
    expected: [{ args: [], value: P_ANSWERS }],
    source: 'M05 §6.14.1 (M17 Q-M17-ANS)',
  },
  'Q-ANS-P-CORRECT': {
    where: (period?: Period | ''): Where<AnswerRow> => ({
      inP: true,
      isCorrect: true,
      ...since(period),
    }),
    expected: [{ args: [], value: P_CORRECT }],
    source: 'M05 §6.14.1 (M17 Q-M17-ACC)',
  },
  'Q-ANS-NON-P': { where: { inP: false }, expected: NON_P_TOTAL, source: 'M05 §6.14.1 (M17 C-02)' },
})

export const sessionQueries = defineNamedQueries(sessionsDataset, {
  'Q-SESS-ALL': {
    where: { status: 'completed' },
    expected: SESSIONS_TOTAL,
    source: 'M05 §6.14.2 (M08 S1 "Sesi Latihan")',
  },
  /** (missionId): sessions linked to an M10 mission (completed and in progress). */
  'Q-SESS-LINK': {
    where: (missionId: number): Where<SessionRow> => ({ missionId }),
    expected: [
      { args: [7103], value: 5 },
      { args: [7104], value: 3 },
    ],
    source: 'M05 §6.14.2 (M10 v1.7)',
  },
  'Q-SESS-LINK-REMEDIAL': {
    where: (remedialTestId: number): Where<SessionRow> => ({ remedialTestId }),
    source: 'M05 §6.14.2 Q-SESS-LINK',
  },
  'Q-SESS-LINK-SET': {
    where: (questionSetId: number): Where<SessionRow> => ({ questionSetId }),
    source: 'M05 §6.14.2 Q-SESS-LINK',
  },
  /** (userId, period?): a user's completed sessions. */
  'Q-SESS-USER': {
    where: (userId: number, period?: Period | ''): Where<SessionRow> => ({
      userId,
      status: 'completed',
      ...sinceSession(period),
    }),
    expected: [
      { args: [1], value: 4 },
      { args: [2], value: 4 },
      { args: [4], value: 4 },
    ],
    source: 'M05 §6.12 (S9)',
  },
  /** M17: completed sessions of P, optional period. */
  'Q-SESS-P': {
    where: (period?: Period | ''): Where<SessionRow> => ({
      inP: true,
      status: 'completed',
      ...sinceSession(period),
    }),
    source: 'M05 §6.14.1 (M17 Q-M17-SESS)',
  },
})

// ---------------------------------------------------------------------------------------------
// Seed-phase contributions
// ---------------------------------------------------------------------------------------------

interface Pending {
  answers: { contributor: string; rows: AnswerAnchorInput[] }[]
  sessions: { contributor: string; rows: SessionAnchorInput[] }[]
  prepared: boolean
}

let pending: Pending = { answers: [], sessions: [], prepared: false }

const who = (c: Contributor) => (typeof c === 'string' ? c : c.module)

function requireSeed(what: string) {
  if (answersDataset.compiled || sessionsDataset.compiled) {
    throw new RepositoryError(
      'PHASE',
      `practice.${what}: seed phase only (the datasets compile at finalise); call it from seed(ctx)`,
    )
  }
}

// ---------------------------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------------------------

export interface StartResult {
  session: SessionRow
  questions: Question[]
  revisionMeta: StartPlan['revisionMeta']
  /** `true` when an in-progress mission session was resumed (BR-32). */
  resumed: boolean
}

export interface CheckResult {
  isCorrect: boolean
  correctOptionId: number
  feedback: string
  explanation: string | null
}

export interface CompleteResult {
  score: number
  total: number
  gamification: GamificationResult
  session: SessionRow
}

/** BR-34 input (M07 `pksk`, and any other mode completed outside the quiz flow). */
export interface DirectCompletion {
  userId: number
  mode: PracticeMode
  pkskDomainId?: number | null
  pkskTargetLevel?: 'T1' | 'T4' | null
  subjectId?: number | null
  answers: readonly { questionId: number; isCorrect: boolean; selected?: number | null }[]
  startedAt: string | number
  completedAt: string | number
}

/** #6 input. */
export interface SubmitCompletion {
  sessionId: string
  userId: number
  /** Client time in seconds (capped, BR-30). */
  timeSpent: number
  now: number
}

const msOf = (v: string | number) => (typeof v === 'number' ? v : Date.parse(v))

// ---------------------------------------------------------------------------------------------
// The repositories
// ---------------------------------------------------------------------------------------------

export const practiceAnswersRepo = defineRepository({
  name: 'practiceAnswers',
  owner: 'M05',
  store: answersDataset,
  queries: answerQueries,
  validateAnchor: (row) =>
    typeof row.seg === 'string' && typeof row.inP === 'boolean'
      ? undefined
      : 'spec facets missing: contribute answers with practice.contributeAnswers(ctx, rows)',
  methods: () => ({
    /** Whether the answer log is compiled and primed in this runtime. */
    ready: (): boolean => practiceReady(),
  }),
})

export const practiceRepo = defineRepository({
  name: 'practice',
  owner: 'M05',
  store: sessionsDataset,
  stores: {
    answers: answersDataset,
    queue: queueTable,
    mastery: masteryTable,
    spmTargets: spmTargetsTable,
    structuredAttempts: structuredAttemptsTable,
    checks: checksTable,
    subjectUsage: subjectUsageTable,
  },
  queries: sessionQueries,
  validateAnchor: (row) =>
    typeof row.seg === 'string' && typeof row.inP === 'boolean'
      ? undefined
      : 'spec facets missing: contribute sessions with practice.contributeSessions(ctx, rows)',
  methods: ({ transaction }) => {
    // --- queue and mastery writes (BR-14, BR-20) ------------------------------------------------

    const queueWrite = (
      a: Pick<AnswerRow, 'userId' | 'questionId' | 'subjectId' | 'isCorrect' | 'answeredAt'>,
    ) => {
      if (a.subjectId === null || !hasStoredQueue(a.userId)) return
      const id = `${String(a.userId)}:${String(a.questionId)}`
      const cur = queueTable.get(id)
      if (a.isCorrect) {
        if (cur) queueTable.remove(id)
      } else if (cur) {
        queueTable.update(id, { wrongTimes: cur.wrongTimes + 1, lastWrongAt: a.answeredAt })
      } else {
        queueTable.insert({
          id,
          userId: a.userId,
          questionId: a.questionId,
          subjectId: a.subjectId,
          wrongTimes: 1,
          lastWrongAt: a.answeredAt,
        })
      }
    }

    /** BR-20: adds answers to the stored counters (users without rows keep reading their log). */
    const masteryWrite = (userId: number, rows: readonly AnswerRow[]) => {
      if (!hasStoredQueue(userId)) return
      const stored = masteryTable.query({ where: { userId } }).rows
      if (stored.length === 0) {
        // First counters of this user: the log so far (the new answers are already in it).
        for (const m of userMastery(userId)) {
          masteryTable.insert({ id: `${String(userId)}:${String(m.subjectId)}`, userId, ...m })
        }
        return
      }
      for (const a of rows) {
        if (a.subjectId === null) continue
        const id = `${String(userId)}:${String(a.subjectId)}`
        const cur = masteryTable.get(id)
        if (cur) {
          masteryTable.update(id, {
            answered: cur.answered + 1,
            correct: cur.correct + (a.isCorrect ? 1 : 0),
            lastAnsweredAt:
              cur.lastAnsweredAt === null || a.answeredAt > cur.lastAnsweredAt
                ? a.answeredAt
                : cur.lastAnsweredAt,
          })
        } else {
          masteryTable.insert({
            id,
            userId,
            subjectId: a.subjectId,
            answered: 1,
            correct: a.isCorrect ? 1 : 0,
            lastAnsweredAt: a.answeredAt,
          })
        }
      }
    }

    const insertAnswer = (
      a: Omit<
        AnswerRow,
        'id' | 'seg' | 'schoolId' | 'week' | 'band' | 'inP' | 'hasSession' | 'answeredAt'
      >,
    ): AnswerRow =>
      answersDataset.insert({
        ...a,
        ...specFacetsFor(a.userId, a.answeredAtMs),
        hasSession: a.sessionId !== null,
        answeredAt: toIsoMyt(a.answeredAtMs),
      })

    const questionFields = (questionId: number) => {
      const q = questions.get(questionId)
      return {
        subjectId: q?.subjectId ?? null,
        levelId: q?.educationLevelId ?? null,
        chapterId: q?.curriculumChapterId ?? null,
      }
    }

    const requireSession = (sessionId: string, userId: number): SessionRow => {
      const s = sessionsDataset.get(sessionId)
      if (!s) throw new PracticeError(404, 'NOT_FOUND', 'Rekod tidak dijumpai.')
      if (s.userId !== userId) throw new PracticeError(403, 'FORBIDDEN', 'Akses ditolak.')
      return s
    }

    /** BR-31 step 6 (M14), or the BR-09 rate when M14 is not booted. */
    const gamify = (s: SessionRow, correct: number, completedAt: string): GamificationResult => {
      const pointsEarned = POINTS_PER_CORRECT * correct
      const coinsPerCorrect = s.mode === 'mission' ? MISSION_COINS_PER_CORRECT : undefined
      const result = seams().onSessionCompleted({
        userId: s.userId,
        sessionId: s.id,
        mode: s.mode,
        correct,
        total: s.questionCount,
        timeSpent: s.timeSpent,
        completedAt,
        pointsEarned,
        ...(coinsPerCorrect !== undefined ? { coinsPerCorrect } : {}),
      })
      return (
        result ?? {
          coinsEarned: sessionCoins(s.mode, correct),
          pointsEarned,
          streakCount: 0,
          totalBalance: 0,
        }
      )
    }

    return {
      // --- seed phase --------------------------------------------------------------------------

      /**
       * Seed phase: another module's answer anchors (observed or designed). M05 completes the spec
       * facets and the question fields when the log compiles; an inactive user is refused.
       */
      contributeAnswers(contributor: Contributor, rows: readonly AnswerAnchorInput[]): void {
        requireSeed('contributeAnswers')
        pending.answers.push({ contributor: who(contributor), rows: [...rows] })
      },

      /** Seed phase: another module's session anchors ("H01", …). */
      contributeSessions(contributor: Contributor, rows: readonly SessionAnchorInput[]): void {
        requireSeed('contributeSessions')
        pending.sessions.push({ contributor: who(contributor), rows: [...rows] })
      },

      /** Seed phase: stored SubjectMastery counters of anchor users (M18 KLUANG rows). */
      contributeMastery(
        _contributor: Contributor,
        rows: readonly {
          userId: number
          subjectId: number
          correct: number
          answered: number
          lastAnsweredAt: string | null
        }[],
      ): void {
        requireSeed('contributeMastery')
        for (const r of rows) {
          masteryTable.insert({ id: `${String(r.userId)}:${String(r.subjectId)}`, ...r })
        }
      },

      /** M05 seed: fresh contribution queue, clock, stored canonical rows (seed phase). */
      beginSeed(now: () => number): void {
        pending = { answers: [], sessions: [], prepared: false }
        resetPracticePrime()
        clearDrawCache()
        resetAnswerFacts()
        bindPracticeClock(now)
        for (const [userId, subjectId, correct, answered, lastAnsweredAt] of DESIGNED_MASTERY) {
          masteryTable.insert({
            id: `${String(userId)}:${String(subjectId)}`,
            userId,
            subjectId,
            correct,
            answered,
            lastAnsweredAt,
          })
        }
        const at = toIsoMyt(PIN_NOW)
        for (const [userId, subjectId, grade] of DESIGNED_SPM_TARGETS) {
          spmTargetsTable.insert({
            id: `${String(userId)}:${String(subjectId)}`,
            userId,
            subjectId,
            targetGrade: grade as SpmGrade,
            updatedAt: at,
          })
        }
        for (const s of curriculum.subjects()) subjectUsageTable.insert({ id: s.id, usedCount: 0 })
      },

      /**
       * Framework use (the datasets' compile hook): adds the canonical anchors and every queued
       * contribution, completed, once per seed. M01 and M04 have compiled by then.
       */
      prepareAnchors(): void {
        if (pending.prepared) return
        pending.prepared = true
        const canonical = canonicalAnchors()
        answersDataset.addAnchors(canonical.answers, 'M05')
        sessionsDataset.addAnchors(canonical.sessions, 'M05')
        // The class-1156 pupil (user 4627; F-26c, XR-M02-06): sessions K01–K03 and their answers.
        const c1156 = class1156Anchors()
        answersDataset.addAnchors(c1156.answers, 'M05')
        sessionsDataset.addAnchors(c1156.sessions, 'M05')
        for (const { contributor, rows } of pending.answers) {
          answersDataset.addAnchors(
            rows.map((r) => completeAnswer(r, contributor)),
            contributor,
          )
        }
        for (const { contributor, rows } of pending.sessions) {
          sessionsDataset.addAnchors(
            rows.map((r) => completeSessionAnchor(r, contributor)),
            contributor,
          )
        }
      },

      /**
       * Finalise: primes the generated rows, stores the queues of the non-generated users (their
       * anchors, BR-14), and returns the build-check issues (named queries, Q-SESS-MEAN-ACC, the
       * generation pins).
       */
      finaliseSeed(): string[] {
        const anchorIds = (ds: {
          contributions(): ReadonlyMap<string, readonly (string | number)[]>
        }) => {
          const set = new Set<string | number>()
          for (const ids of ds.contributions().values()) for (const id of ids) set.add(id)
          return set
        }
        const aAnchors = anchorIds(answersDataset) as Set<number>
        const sAnchors = anchorIds(sessionsDataset) as Set<string>
        const prime = buildPracticePrime({
          answerSlots(visit) {
            answersDataset.count(
              {},
              (row) => {
                if (!aAnchors.has(row.id)) visit(row.id, row)
                return false
              },
              {
                matchFields: [
                  'id',
                  'seg',
                  'schoolId',
                  'week',
                  'band',
                  'inP',
                  'isCorrect',
                  'hasSession',
                ],
                cacheKey: nextCacheKey('m05-prime-a'),
              },
            )
          },
          sessionSlots(visit) {
            sessionsDataset.count(
              {},
              (row) => {
                if (!sAnchors.has(row.id)) {
                  const key = generatedSessionKey(row.id)
                  if (key !== null) visit(key, row)
                }
                return false
              },
              {
                matchFields: ['id', 'seg', 'schoolId', 'week', 'band', 'inP', 'missionId'],
                cacheKey: nextCacheKey('m05-prime-s'),
              },
            )
          },
          anchorAnswers: () => answersDataset.getMany([...aAnchors]),
          anchorSessions: () => sessionsDataset.getMany([...sAnchors]),
          // F-26c: the M10 class placement (T4 / T5 members, holders, leavers, class 228).
          placement: seams().classPlacement(),
        })
        // Stored queues of the anchor users (BR-14 over their anchor answers).
        const byUser = new Map<number, AnswerRow[]>()
        for (const a of answersDataset.getMany([...aAnchors])) {
          const list = byUser.get(a.userId) ?? []
          list.push(a)
          byUser.set(a.userId, list)
        }
        for (const [userId, list] of byUser) {
          list.sort((x, y) => x.answeredAtMs - y.answeredAtMs || x.id - y.id)
          for (const q of queueFromAnswers(list)) {
            queueTable.insert({ id: `${String(userId)}:${String(q.questionId)}`, userId, ...q })
          }
        }
        const issues = [...prime.issues]
        for (const i of [...checkNamedQueries(answerQueries), ...checkNamedQueries(sessionQueries)])
          issues.push(i.message)
        const mean = meanAccuracy()
        if (Math.round(mean * 10) / 10 !== SESSION_MEAN_ACC_ALL)
          issues.push(`Q-SESS-MEAN-ACC ${mean.toFixed(3)} % ≠ ${String(SESSION_MEAN_ACC_ALL)} %`)
        return issues
      },

      /** Whether the practice stores are booted in this runtime (other modules' reads). */
      ready: (): boolean => practiceReady(),

      // --- write path (§7 #4–#6, BR-31) ----------------------------------------------------------

      /** §7 #4: starts a session (or resumes an in-progress mission session, BR-32). */
      startSession(userId: number, req: StartRequest, now: number, rng: Prng): StartResult {
        const seed = `practice:${String(userId)}:${String(now)}:${String(rng.next())}`
        const plan = planStart(userId, req, now, seed, rng)
        if (plan.resume !== null) {
          const s = sessionsDataset.get(plan.resume) as SessionRow
          return {
            session: s,
            questions: questions.getMany(s.questionIds),
            revisionMeta: null,
            resumed: true,
          }
        }
        const at = toIsoMyt(now)
        const session = transaction(() =>
          sessionsDataset.insert({
            ...specFacetsFor(userId, now),
            userId,
            mode: plan.mode,
            subjectId: plan.subjectId,
            levelId: plan.levelId,
            difficulty: plan.difficulty,
            chapterId: plan.chapterId,
            year: plan.year,
            setNo: plan.setNo,
            targetQuestionId: plan.targetQuestionId,
            missionId: plan.missionId,
            remedialTestId: plan.remedialTestId,
            questionSetId: plan.questionSetId,
            timeLimitSec: plan.timeLimitSec,
            pkskDomainId: null,
            pkskTargetLevel: null,
            questionIds: plan.questionIds,
            questionCount: plan.questionIds.length,
            status: 'in_progress',
            correctCount: 0,
            timeSpent: 0,
            coinsEarned: 0,
            pointsEarned: 0,
            startedAt: at,
            completedAt: null,
            completedAtMs: 0,
          }),
        )
        return {
          session,
          questions: questions.getMany(plan.questionIds),
          revisionMeta: plan.revisionMeta,
          resumed: false,
        }
      },

      /**
       * §7 #5 (BR-30, BR-07): one check per question per session (a second check returns the stored
       * result); +1 on the trial counter per check while the user is not subscribed.
       */
      checkAnswer(
        userId: number,
        sessionId: string,
        questionId: number,
        selectedOptionId: number,
        now: number,
      ): CheckResult {
        const s = requireSession(sessionId, userId)
        if (s.status !== 'in_progress') {
          throw new PracticeError(409, 'ALREADY_SUBMITTED', 'Sesi ini sudah dihantar.')
        }
        if (!s.questionIds.includes(questionId)) {
          throw new PracticeError(422, 'VALIDATION_ERROR', MESSAGES.invalidAnswer, {
            questionId: MESSAGES.invalidAnswer,
          })
        }
        const q = questions.get(questionId)
        const count = q?.options?.length ?? 4
        if (
          !Number.isInteger(selectedOptionId) ||
          selectedOptionId < 0 ||
          selectedOptionId >= count
        ) {
          throw new PracticeError(422, 'VALIDATION_ERROR', MESSAGES.invalidAnswer, {
            selectedOptionId: MESSAGES.invalidAnswer,
          })
        }
        const id = `${sessionId}:${String(questionId)}`
        const stored = checksTable.get(id)
        const grade = questions.gradeAnswer(
          questionId,
          stored?.selectedOptionId ?? selectedOptionId,
        )
        if (!grade) {
          throw new PracticeError(422, 'VALIDATION_ERROR', MESSAGES.invalidAnswer)
        }
        const result = (isCorrect: boolean): CheckResult => ({
          isCorrect,
          correctOptionId: grade.correctOptionId,
          feedback: feedbackText(s.mode, isCorrect),
          explanation: grade.explanation,
        })
        if (stored) return result(stored.isCorrect)
        return transaction(() => {
          const seq = checksTable.count({ sessionId }) + 1
          const row: CheckRow = {
            id,
            sessionId,
            userId,
            questionId,
            selectedOptionId,
            isCorrect: grade.isCorrect,
            checkedAt: toIsoMyt(now),
            checkedAtMs: now,
            seq,
          }
          checksTable.insert(row)
          if (!users.isSubscribed(userId, now)) users.incrementTrialUsed(userId)
          return result(grade.isCorrect)
        })
      },

      /**
       * §7 #6 and BR-31 (one transaction, all or nothing; a throwing M14 call rolls it all back):
       * (1) session totals, (2) one QuizAnswer per checked question, (3) revision queue, (4)
       * mastery counters, (5) no trial change, (6) M14 `gamification.onSessionCompleted` (its
       * `coinsEarned` is returned in the result; the session keeps the BR-09 coins), (8) a `remedial` session completes its M10 test. Also BR-34: the
       * direct form (`answers` given, no session id) creates a completed session and applies steps
       * (1), (2), (6) only (M07 `pksk`).
       */
      completeSession(input: SubmitCompletion | DirectCompletion): CompleteResult {
        if ('sessionId' in input) {
          const s = requireSession(input.sessionId, input.userId)
          if (s.status !== 'in_progress') {
            throw new PracticeError(409, 'ALREADY_SUBMITTED', 'Sesi ini sudah dihantar.')
          }
          const checks = checksTable
            .query({ where: { sessionId: s.id } })
            .rows.sort((a, b) => a.seq - b.seq)
          const now = input.now
          const at = toIsoMyt(now)
          const cap = MAX_SECONDS_PER_QUESTION * s.questionCount
          const spent = Math.max(0, Math.min(cap, Math.round(Number(input.timeSpent) || 0)))
          const correct = checks.filter((c) => c.isCorrect).length
          return transaction(() => {
            const answers: AnswerRow[] = []
            for (const c of checks) {
              const a = insertAnswer({
                sessionId: s.id,
                userId: s.userId,
                questionId: c.questionId,
                ...questionFields(c.questionId),
                selectedOptionId: c.selectedOptionId,
                isCorrect: c.isCorrect,
                answeredAtMs: c.checkedAtMs,
              })
              answers.push(a)
              queueWrite(a)
              checksTable.remove(c.id)
            }
            masteryWrite(s.userId, answers)
            const row = sessionsDataset.update(s.id, {
              ...specFacetsFor(s.userId, now),
              status: 'completed',
              completedAt: at,
              completedAtMs: now,
              correctCount: correct,
              timeSpent: spent,
              pointsEarned: POINTS_PER_CORRECT * correct,
              coinsEarned: sessionCoins(s.mode, correct),
            })
            // BR-09: the session keeps its own coins; M14's credited coins go back in the response only.
            const g = gamify(row, correct, at)
            if (row.mode === 'remedial' && row.remedialTestId !== null) {
              const acc = row.questionCount === 0 ? 0 : (correct / row.questionCount) * 100
              seams().remedialComplete(row.remedialTestId, {
                afterAccuracy: Math.round(acc * 10) / 10,
                completedAt: at,
              })
            }
            return { score: correct, total: row.questionCount, gamification: g, session: row }
          })
        }
        // BR-34 direct completion.
        const d = input
        if (!isMode(d.mode)) throw new PracticeError(422, 'VALIDATION_ERROR', 'Mod tidak sah.')
        const start = msOf(d.startedAt)
        const end = msOf(d.completedAt)
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
          throw new PracticeError(422, 'VALIDATION_ERROR', 'Masa tidak sah.')
        }
        const correct = d.answers.filter((a) => a.isCorrect).length
        const at = toIsoMyt(end)
        const pksk = d.mode === 'pksk'
        return transaction(() => {
          const created = sessionsDataset.insert({
            ...specFacetsFor(d.userId, end),
            userId: d.userId,
            mode: d.mode,
            subjectId: pksk ? null : (d.subjectId ?? null),
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
            pkskDomainId: d.pkskDomainId ?? null,
            pkskTargetLevel: d.pkskTargetLevel ?? null,
            questionIds: d.answers.map((a) => a.questionId),
            questionCount: d.answers.length,
            status: 'completed',
            correctCount: correct,
            timeSpent: Math.round((end - start) / 1_000),
            coinsEarned: sessionCoins(d.mode, correct),
            pointsEarned: POINTS_PER_CORRECT * correct,
            startedAt: toIsoMyt(start),
            completedAt: at,
            completedAtMs: end,
          })
          const n = d.answers.length
          d.answers.forEach((a, i) => {
            const fields = pksk
              ? { subjectId: null, levelId: null, chapterId: null }
              : questionFields(a.questionId)
            insertAnswer({
              sessionId: created.id,
              userId: d.userId,
              questionId: a.questionId,
              ...fields,
              selectedOptionId: a.selected ?? null,
              isCorrect: a.isCorrect,
              answeredAtMs: n === 0 ? end : start + Math.round(((i + 1) * (end - start)) / n),
            })
          })
          const g = gamify(created, correct, at)
          return { score: correct, total: n, gamification: g, session: created }
        })
      },

      /**
       * Hook write `mock.addAnswer({userId, questionId, isCorrect, answeredAt?})` (§6.13,
       * XR-M13-03b): one answer without a session, with the revision queue and the counters
       * (BR-31 steps 3–4); no wallet, streak or trial change.
       */
      addAnswer(
        input: { userId: number; questionId: number; isCorrect: boolean; answeredAt?: string },
        now: number,
      ): AnswerRow {
        const ms = input.answeredAt !== undefined ? Date.parse(input.answeredAt) : now
        if (!Number.isFinite(ms)) {
          throw new PracticeError(422, 'VALIDATION_ERROR', 'Masa tidak sah.', {
            answeredAt: 'Masa tidak sah.',
          })
        }
        const q = questions.get(input.questionId)
        return transaction(() => {
          const a = insertAnswer({
            sessionId: null,
            userId: input.userId,
            questionId: input.questionId,
            ...questionFields(input.questionId),
            selectedOptionId:
              q?.correctAnswer === null || q?.correctAnswer === undefined
                ? null
                : input.isCorrect
                  ? q.correctAnswer
                  : (q.correctAnswer + 1) % 4,
            isCorrect: input.isCorrect,
            answeredAtMs: ms,
          })
          queueWrite(a)
          masteryWrite(input.userId, [a])
          return a
        })
      },

      /**
       * Hook write `mock.addSession(userId, {mode, correct, total, timeSpentSec, at})` (§6.13, M14
       * XR-M14-01 e): one completed session without answers (the pager tests call it n times).
       */
      addSession(
        userId: number,
        input: {
          mode: PracticeMode
          correct: number
          total: number
          timeSpentSec: number
          at: string
        },
      ): SessionRow {
        const end = Date.parse(input.at)
        return transaction(() =>
          sessionsDataset.insert({
            ...specFacetsFor(userId, end),
            userId,
            mode: input.mode,
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
            pkskDomainId: null,
            pkskTargetLevel: null,
            questionIds: [],
            questionCount: input.total,
            status: 'completed',
            correctCount: input.correct,
            timeSpent: input.timeSpentSec,
            coinsEarned: sessionCoins(input.mode, input.correct),
            pointsEarned: POINTS_PER_CORRECT * input.correct,
            startedAt: toIsoMyt(end - input.timeSpentSec * 1_000),
            completedAt: toIsoMyt(end),
            completedAtMs: end,
          }),
        )
      },

      // --- reads ---------------------------------------------------------------------------------

      /** One session (all DATA-M05-01 fields, incl. `questionIds`), or undefined. */
      session: (id: string): SessionRow | undefined =>
        practiceReady() ? sessionsDataset.get(id) : undefined,

      /**
       * A user's completed sessions, newest first, unpaged (the M14 read contract): `date`
       * (`YYYY-MM-DD`, MYT day of `completedAt`) and/or `modes`. Rows: every DATA-M05-01 field
       * except `questionIds`, plus `correct` / `total`.
       */
      history: (userId: number, filter: HistoryFilter = {}): SessionSummary[] =>
        userHistory(userId, filter),

      /**
       * §7 #23 / #12 page: completed sessions of `modes` (`type` narrows to one mode; absent or not
       * in `modes` → all rows), newest first; unpaged when `page` is absent. `stats` cover every row
       * of `modes` (filter-independent, as live S10): sessions, mean of session accuracies (1
       * decimal), coins, answered (Σ question counts).
       */
      historyPage(
        userId: number,
        options: {
          modes: readonly string[]
          type?: string | null
          page?: number
          pageSize?: number
          from?: number
          to?: number
        },
      ) {
        const all = userHistory(userId, {
          modes: options.modes,
          ...(options.from !== undefined ? { from: options.from } : {}),
          ...(options.to !== undefined ? { to: options.to } : {}),
        })
        const activeType =
          options.type && options.modes.includes(options.type)
            ? (options.type as PracticeMode)
            : null
        const rows = activeType ? all.filter((s) => s.mode === activeType) : all
        const accs = all
          .filter((s) => s.questionCount > 0)
          .map((s) => (s.correctCount / s.questionCount) * 100)
        const stats = {
          sessions: all.length,
          avgAccuracyPct:
            accs.length === 0
              ? 0
              : Math.round((accs.reduce((a, b) => a + b, 0) / accs.length) * 10) / 10,
          coins: all.reduce((a, s) => a + s.coinsEarned, 0),
          answered: all.reduce((a, s) => a + s.questionCount, 0),
        }
        const pageSize =
          options.page !== undefined ? (options.pageSize ?? 15) : Math.max(1, rows.length)
        const page = options.page ?? 1
        const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
        return {
          rows: rows.slice((page - 1) * pageSize, page * pageSize),
          total: rows.length,
          page,
          pageSize,
          totalPages,
          activeType,
          stats,
        }
      },

      /** A user's answers (DATA-M05-02 rows, oldest first): `date`, window, subject, chapter, session. */
      answers: (userId: number, filter: AnswerFilter = {}): AnswerRow[] =>
        userAnswers(userId, filter),

      /** The answers of one session, in answer order. */
      sessionAnswers(sessionId: string): AnswerRow[] {
        if (!practiceReady()) return []
        const key = generatedSessionKey(sessionId)
        const p = practicePrimeOrNull()
        if (key !== null && p && !sessionsDataset.isAnchor(sessionId)) {
          const from = p.sAnsStart[key] as number
          const to = p.sAnsStart[key + 1] as number
          return answersDataset.getMany(Array.from(p.sAnsKeys.subarray(from, to)))
        }
        const s = sessionsDataset.get(sessionId)
        return s ? userAnswers(s.userId, { sessionId }) : []
      },

      /** BR-14 queue served by revision and counted by S6 / S1 (eligible questions only, XL-19). */
      queue: (userId: number, subjectId?: number) => userQueue(userId, subjectId),
      /** The whole queue (ineligible questions stay queued, XL-19). */
      queueAll: (userId: number, subjectId?: number) => userQueueAll(userId, subjectId),

      /** BR-20 counters per subject: `{subjectId, correct, answered, lastAnsweredAt}`. */
      mastery: (userId: number) => userMastery(userId),

      /**
       * Bulk read of the STORED BR-20 counters (the rows `mastery` returns when a user has stored rows),
       * without scanning the answer log. Users without stored rows map to an empty list (the caller
       * falls back to `subjectTotals` / `mastery`, exactly as `mastery` does per user).
       */
      storedMastery: (userIds: readonly number[]): Map<number, MasteryItem[]> => {
        const out = new Map<number, MasteryItem[]>()
        if (!practiceReady()) return out
        for (const userId of userIds) {
          const rows = masteryTable.query({ where: { userId } }).rows
          out.set(
            userId,
            rows
              .map((m) => ({
                subjectId: m.subjectId,
                correct: m.correct,
                answered: m.answered,
                lastAnsweredAt: m.lastAnsweredAt,
              }))
              .sort((x, y) => x.subjectId - y.subjectId),
          )
        }
        return out
      },

      /** BR-16 per chapter: total, answered, correct (latest answer), score, remaining, complete. */
      chapterStats: (userId: number, chapterId: number) => chapterStats(userId, chapterId),

      /** SPM targets of a user (DATA-M05-04). */
      spmTargets: (userId: number) => spmTargetsTable.query({ where: { userId } }).rows,

      /**
       * #19 / BR-26: replaces the user's targets in one step. `grades` holds one entry per SPM
       * subject: a grade sets (or replaces) the target, `null` removes it.
       */
      saveSpmTargets: (
        userId: number,
        grades: ReadonlyMap<number, SpmGrade | null>,
        now: number,
      ): void => {
        transaction(() => {
          const at = toIsoMyt(now)
          for (const [subjectId, grade] of grades) {
            const id = `${String(userId)}:${String(subjectId)}`
            const cur = spmTargetsTable.get(id)
            if (grade === null) {
              if (cur) spmTargetsTable.remove(id)
            } else if (cur) {
              spmTargetsTable.update(id, { targetGrade: grade, updatedAt: at })
            } else {
              spmTargetsTable.insert({ id, userId, subjectId, targetGrade: grade, updatedAt: at })
            }
          }
        })
      },

      /** #17 (LS-7): stores one structured attempt (DATA-M05-06) and returns it. */
      addStructuredAttempt: (row: Omit<StructuredAttemptRow, 'id'>): StructuredAttemptRow =>
        transaction(() => structuredAttemptsTable.insert(row)),

      /** The structured attempts of a user, oldest first (M06 S8 reads the `scope = spm` ones). */
      structuredAttempts: (userId: number): StructuredAttemptRow[] =>
        structuredAttemptsTable.query({ where: { userId } }).rows,

      /** S1 "Digunakan" (seed 0 for every subject, URS OQ-12). */
      subjectUsage: (subjectId: number): number => subjectUsageTable.get(subjectId)?.usedCount ?? 0,

      /**
       * Q-SESS-MEAN-ACC (percent, unrounded): mean over completed sessions of
       * `correctCount ÷ questionCount × 100` (sessions with `questionCount` 0 skipped). Scope:
       * every session, or the sessions of `userIds` (M08 level cards pass the M10 class members).
       */
      sessionMeanAccuracy: (
        scope: { userIds?: Iterable<number>; modes?: readonly string[] } = {},
      ): number => meanAccuracy(scope),

      /**
       * Distinct users with ≥ 1 answer (`by: 'answers'`) or completed session (`'sessions'`) in
       * `[from, to)`, optionally restricted to P or to one monitoring school (M11 Aktif, M17
       * engaged, M08 week participants).
       */
      distinctUsers(options: {
        by: 'answers' | 'sessions'
        from?: number
        to?: number
        population?: 'P' | 'segment' | 'all'
        schoolId?: number
      }): number {
        if (!practiceReady()) return 0
        const set = new Set<number>()
        const range =
          options.from !== undefined || options.to !== undefined
            ? { gte: options.from ?? 0, lte: (options.to ?? Number.MAX_SAFE_INTEGER) - 1 }
            : undefined
        const pop =
          options.population === 'P'
            ? { inP: true }
            : options.population === 'segment'
              ? { seg: 'mon' as const }
              : {}
        const school = options.schoolId !== undefined ? { schoolId: options.schoolId } : {}
        if (options.by === 'answers') {
          answersDataset.count(
            { ...pop, ...school, ...(range ? { answeredAtMs: range } : {}) },
            (r) => {
              set.add(r.userId)
              return false
            },
            {
              matchFields: ['userId'],
              cacheKey: nextCacheKey('m05-users'),
            },
          )
        } else {
          sessionsDataset.count(
            { ...pop, ...school, status: 'completed', ...(range ? { completedAtMs: range } : {}) },
            (r) => {
              set.add(r.userId)
              return false
            },
            {
              matchFields: ['userId'],
              cacheKey: nextCacheKey('m05-users'),
            },
          )
        }
        return set.size
      },

      /**
       * Bulk reads over a set of users (XR-M08-M05-01/-02; see `./aggregates.ts`): `sessionTotals` (one
       * scan of the sessions), `answerFacts`, `subjectTotals`, `questionTallies` (one pass over the log for
       * the users not yet cached).
       */
      sessionTotals,
      answerFacts,
      subjectTotals,
      questionTallies,

      /**
       * Q-WEEK-RANK(week) (M16 S20): users with ≥ 1 completed practice-mode session in the M11 week
       * `week` (default: the week of the clock), by correct answers then user id, top 20 (see
       * `./week-rank.ts`).
       */
      weekRank: (options: WeekRankOptions = {}): WeekRankRow[] => weekRank(options, boundNow()),

      /**
       * Finalise (owner only): stores SubjectMastery counters of anchor users whose ids are known only
       * once the users are readable (the KLUANG pupils of M18, F-26c).
       */
      storeMastery(
        rows: readonly {
          userId: number
          subjectId: number
          correct: number
          answered: number
          lastAnsweredAt: string | null
        }[],
      ): void {
        for (const r of rows) {
          masteryTable.insert({ id: `${String(r.userId)}:${String(r.subjectId)}`, ...r })
        }
      },

      /** Issues of the last prime (empty when every generation pin holds). */
      primeIssues: (): readonly string[] => practicePrimeOrNull()?.issues ?? [],
      /** The fitted λ and the resulting mean (diagnostics). */
      primeFit: () => {
        const p = requirePracticePrime()
        return { lambda: p.lambda, meanAccuracy: p.meanAccuracy }
      },
    }
  },
})

/** Q-SESS-MEAN-ACC over the sessions dataset (see `sessionMeanAccuracy`). */
function meanAccuracy(
  scope: { userIds?: Iterable<number>; modes?: readonly string[] } = {},
): number {
  if (!practiceReady()) return 0
  const ids = scope.userIds ? new Set(scope.userIds) : null
  const modes = scope.modes ? new Set(scope.modes) : null
  let sum = 0
  let n = 0
  sessionsDataset.count(
    { status: 'completed' },
    (r) => {
      if (r.questionCount <= 0) return false
      if (ids && !ids.has(r.userId)) return false
      if (modes && !modes.has(r.mode)) return false
      sum += r.correctCount / r.questionCount
      n++
      return false
    },
    {
      matchFields: ['userId', 'mode', 'questionCount', 'correctCount'],
      cacheKey: nextCacheKey('m05-mean'),
    },
  )
  return n === 0 ? 0 : (sum / n) * 100
}

export { byCompletedDesc, scanSessions }
