import { Inject, Injectable } from '@nestjs/common'
import {
  type CheckAnswerRequest,
  type CheckAnswerResponse,
  type PracticeMode,
  type SessionListItem,
  type SessionListResponse,
  type StartSessionRequest,
  type StartSessionResponse,
  StartSessionResponseSchema,
  type SubmitSessionResponse,
} from '@pp/contract'

import { CLOCK, type Clock } from '../../db/clock'
import { idFromString, idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { listMeta } from '../../common/http/respond'
import { toMytTimestamp } from '../../common/time/myt'
import { CurriculumRepository } from '../curriculum'
import { SubscriptionService, TRIAL_LIMIT } from '../subscriptions'
import { alreadySubmitted, invalidAnswer, isUniqueViolation, noAttemptsLeft, notFound, remedialDone, trialExhausted } from './errors'
import { type PracticeQuestion, PracticePorts, practiceRewardSource, versionKey } from './ports'
import {
  HISTORY_MAX_ROWS,
  type CompletedSession,
  type GradedAnswer,
  PracticeRepository,
  type ServedRef,
  type SessionRecord,
  type StoredCheck,
} from './practice.repository'
import { HISTORY_PAGE_SIZE, feedbackText } from './rules'
import { PracticeStartPlanner } from './start.planner'

export interface Caller {
  userId: string
  /** True under Mod Pelajar: every row written is stamped `is_test` (AC 8). */
  isTest: boolean
}

export interface HistoryQuery {
  modes: readonly PracticeMode[]
  type: string | null
  page: number | undefined
  pageSize: number | undefined
}

/**
 * The practice write path (ADR-0014 section 2 and amendment 2): start, check, submit and the caller's own
 * history. Orchestrates the planner, the question source (BE-09 port), the subscription service (trial),
 * the reward port (BE-11 / BE-23) and the repository, which is the only code that touches the tables.
 */
@Injectable()
export class PracticeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(PracticeRepository) private readonly repo: PracticeRepository,
    @Inject(PracticePorts) private readonly ports: PracticePorts,
    @Inject(PracticeStartPlanner) private readonly planner: PracticeStartPlanner,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(SubscriptionService) private readonly subscriptions: SubscriptionService,
  ) {}

  // --- start ------------------------------------------------------------------------------------

  async start(caller: Caller, req: StartSessionRequest): Promise<StartSessionResponse> {
    // Idempotent replay: the same (user, clientUuid) is the same session, nothing new is created.
    if (req.clientUuid) {
      const existing = await this.repo.sessionByClientUuid(caller.userId, req.clientUuid)
      if (existing) return this.replay(caller.userId, existing)
    }
    try {
      return await this.createOrResume(caller, req)
    } catch (e) {
      // A concurrent start with the same clientUuid won the unique index: return its session.
      if (req.clientUuid && isUniqueViolation(e)) {
        const winner = await this.repo.sessionByClientUuid(caller.userId, req.clientUuid)
        if (winner) return this.replay(caller.userId, winner)
      }
      throw e
    }
  }

  private async createOrResume(caller: Caller, req: StartSessionRequest): Promise<StartSessionResponse> {
    const run = async (): Promise<StartSessionResponse> => {
      const now = this.clock.now()
      const plan = await this.planner.plan(caller.userId, req, now, caller.isTest)
      if (plan.resume) return this.replay(caller.userId, plan.resume)
      const session = await this.repo.startSession({
        userId: caller.userId,
        clientUuid: req.clientUuid ?? null,
        mode: plan.mode,
        subjectId: plan.subjectId,
        educationLevelId: plan.levelId,
        difficulty: plan.difficulty,
        chapterId: plan.chapterId,
        year: plan.year,
        setNo: plan.setNo,
        targetQuestionId: plan.targetQuestionId,
        missionId: plan.missionId,
        remedialTestId: plan.remedialTestId,
        questionSetId: plan.questionSetId,
        timeLimitSec: plan.timeLimitSec,
        coinsPerCorrect: plan.coinsPerCorrect,
        startedAt: now,
        isTest: caller.isTest,
        served: plan.served.map((q) => ({ questionId: q.id, versionNo: q.versionNo })),
      })
      return this.startResponse(caller.userId, session, plan.served, plan.revisionMeta)
    }
    // BR-32 and the attempt limits: parallel starts of one mission, remedial test or question set are serialized
    // by an advisory lock, and the planner resumes the session the first one created.
    const assigned =
      req.mode === 'mission' && req.missionId !== undefined
        ? ({ kind: 'mission', id: req.missionId } as const)
        : req.mode === 'remedial' && req.remedialTestId !== undefined
          ? ({ kind: 'remedial', id: req.remedialTestId } as const)
          : req.mode === 'question_set' && req.questionSetId !== undefined
            ? ({ kind: 'question_set', id: req.questionSetId } as const)
            : null
    if (assigned) {
      return this.prisma.transaction(async () => {
        await this.repo.lockAssigned(caller.userId, assigned.kind, assigned.id)
        return run()
      })
    }
    return run()
  }

  /** The response of a session that already exists (replay, mission resume): its served versions, not the live ones. */
  private async replay(userId: string, session: SessionRecord): Promise<StartSessionResponse> {
    const served = await this.repo.sessionQuestions(session.id)
    const versions = await this.ports.questions.versions(served.map((s) => ({ questionId: s.questionId, versionNo: s.versionNo })))
    const questions = served
      .map((s) => versions.get(versionKey(s.questionId, s.versionNo)))
      .filter((q): q is PracticeQuestion => q !== undefined)
    let revisionMeta: { selected: number; totalWrong: number } | null = null
    if (session.mode === 'revision' && session.subjectId) {
      const queue = await this.repo.queue(userId, { subjectId: session.subjectId })
      revisionMeta = { selected: questions.length, totalWrong: queue.length }
    }
    return this.startResponse(userId, session, questions, revisionMeta)
  }

  private async startResponse(
    userId: string,
    s: SessionRecord,
    questions: readonly PracticeQuestion[],
    revisionMeta: { selected: number; totalWrong: number } | null,
  ): Promise<StartSessionResponse> {
    const subject = s.subjectId ? await this.curriculum.subject(idFromString(s.subjectId)) : null
    const chapter = s.chapterId ? await this.curriculum.chapter(idFromString(s.chapterId)) : null
    const wrong = new Map((await this.repo.queue(userId)).map((q) => [q.questionId, q.wrongTimes]))
    const body = {
      sessionId: s.id,
      mode: s.mode,
      subject: subject ? { code: subject.code, name: subject.name, color: subject.color } : null,
      ...(chapter ? { chapter: { id: idToString(chapter.id), number: chapter.chapterNumber, name: chapter.name } } : {}),
      // The key and the explanation are never part of a served question (AC 4).
      questions: questions.map((q) => ({
        id: q.id,
        questionText: q.questionText,
        textDirection: q.textDirection,
        scriptType: q.scriptType,
        wrongTimes: wrong.get(q.id) ?? 0,
        hasDskp: q.hasDskp,
        contributor: q.contributor ? { name: q.contributor.name, profileUrl: q.contributor.profileUrl } : null,
        options: q.options.map((o, i) => ({ id: i, label: o.label, text: o.text })),
      })),
      ...(s.mode === 'revision' && revisionMeta ? { revisionMeta } : {}),
      ...(s.mode === 'question_set' ? { timeLimitSec: s.timeLimitSec } : {}),
    }
    // Strict schema: a stray key (a correct answer, an explanation) fails here instead of leaving the server.
    return StartSessionResponseSchema.parse(body)
  }

  // --- check ------------------------------------------------------------------------------------

  async check(caller: Caller, sessionId: string, req: CheckAnswerRequest): Promise<CheckAnswerResponse> {
    const now = this.clock.now()
    return this.prisma.transaction(async () => {
      const session = await this.repo.lockSession(sessionId, caller.userId, 'update')
      if (!session) throw notFound()
      if (session.status !== 'in_progress') throw alreadySubmitted()

      const served = await this.repo.sessionQuestions(session.id)
      const ref = served.find((s) => s.questionId === req.questionId)
      if (!ref) throw invalidAnswer('questionId')
      // Graded against the version this session served, never the live one (AC 11).
      const versions = await this.ports.questions.versions([{ questionId: ref.questionId, versionNo: ref.versionNo }])
      const question = versions.get(versionKey(ref.questionId, ref.versionNo))
      const count = question?.options.length ?? 0
      const chosen = question?.options[req.selectedOptionId]
      if (!question || !chosen) throw invalidAnswer('selectedOptionId')
      const keyIndex = question.options.findIndex((o) => o.label === question.correctLabel)
      if (keyIndex < 0 || count === 0) throw invalidAnswer()

      const result = (isCorrect: boolean): CheckAnswerResponse => ({
        isCorrect,
        correctOptionId: keyIndex,
        feedback: feedbackText(session.mode, isCorrect),
        explanation: question.explanation,
      })

      // One check per question: a repeat returns the stored result and counts nothing.
      const stored = await this.repo.check(session.id, ref.questionId)
      if (stored) return result(stored.isCorrect)

      const isCorrect = chosen.label === question.correctLabel
      const inserted = await this.repo.insertCheck({
        sessionId: session.id,
        userId: caller.userId,
        questionId: ref.questionId,
        questionVersionNo: ref.versionNo,
        selectedLabel: chosen.label,
        isCorrect,
        checkedAt: now,
        isTest: caller.isTest || session.isTest,
      })
      if (!inserted) {
        // A parallel duplicate check won the unique key: report its stored result, count nothing.
        const winner = await this.repo.check(session.id, ref.questionId)
        return result(winner?.isCorrect ?? isCorrect)
      }
      // BR-07: +1 per first check while the user is not subscribed (same transaction as the check row).
      // A first check past the limit is refused and the whole transaction (the check row too) rolls back.
      if (!(await this.subscriptions.isSubscribed(caller.userId, now))) {
        const used = await this.subscriptions.incrementTrialUsed(caller.userId)
        if (used > TRIAL_LIMIT) throw trialExhausted()
      }
      return result(isCorrect)
    })
  }

  // --- submit -----------------------------------------------------------------------------------

  async submit(caller: Caller, sessionId: string, timeSpent: unknown): Promise<SubmitSessionResponse> {
    const now = this.clock.now()
    const { done, result: reward } = await this.repo.completeSession(
      { sessionId, userId: caller.userId, now, timeSpent, isTest: caller.isTest },
      {
        guard: (session) => this.guardSubmit(session),
        regrade: (_session, served, checks) => this.regrade(served, checks),
        completed: async (completed, tx) => {
          const s = completed.session
          const test = caller.isTest || s.isTest
          const credit = await this.ports.reward.onSessionCompleted(
            {
              userId: s.userId,
              sessionId: s.id,
              mode: s.mode,
              source: practiceRewardSource(s.mode),
              correct: completed.correct,
              total: completed.total,
              timeSpent: completed.timeSpentSec,
              completedAt: completed.completedAt,
              pointsEarned: completed.pointsEarned,
              sessionCoins: completed.coinsEarned,
              ...(s.mode === 'mission' && s.coinsPerCorrect !== null ? { coinsPerCorrect: s.coinsPerCorrect } : {}),
              isTest: test,
            },
            tx,
          )
          if (s.mode === 'remedial' && s.remedialTestId !== null) {
            const accuracy = completed.total === 0 ? 0 : (completed.correct / completed.total) * 100
            await this.ports.assignments.remedialCompleted(
              {
                remedialTestId: s.remedialTestId,
                userId: s.userId,
                afterAccuracy: Math.round(accuracy * 10) / 10,
                completedAt: completed.completedAt,
                isTest: test,
              },
              tx,
            )
          }
          return credit
        },
      },
    )
    return this.submitResponse(done, reward)
  }

  /**
   * Inside the locked submit transaction: the one-shot rules of assigned work are enforced again, so parallel
   * starts that slipped past the start checks cannot all complete (remedial: one completion per test;
   * question_set: at most maxAttempts completions).
   */
  private async guardSubmit(session: SessionRecord): Promise<void> {
    if (session.mode === 'remedial' && session.remedialTestId) {
      await this.repo.lockAssigned(session.userId, 'remedial', session.remedialTestId)
      const others = await this.repo.linkedSessions(session.userId, 'remedialTestId', session.remedialTestId)
      if (others.some((s) => s.id !== session.id && s.status === 'completed')) throw remedialDone()
    }
    if (session.mode === 'question_set' && session.questionSetId) {
      await this.repo.lockAssigned(session.userId, 'question_set', session.questionSetId)
      const res = await this.ports.assignments.resolve('question_set', { userId: session.userId, id: session.questionSetId, at: this.clock.now() })
      if (res.status === 'ok' && (res.maxAttempts ?? 0) > 0) {
        const done = (await this.repo.linkedSessions(session.userId, 'questionSetId', session.questionSetId)).filter(
          (s) => s.id !== session.id && s.status === 'completed',
        ).length
        if (done >= (res.maxAttempts ?? 0)) throw noAttemptsLeft()
      }
    }
  }

  private submitResponse(done: CompletedSession, reward: { coinsEarned: number; streakCount: number; totalBalance: number }): SubmitSessionResponse {
    return {
      results: {
        score: done.correct,
        total: done.total,
        gamification: {
          coinsEarned: reward.coinsEarned,
          streakCount: reward.streakCount,
          pointsEarned: done.pointsEarned,
          totalBalance: reward.totalBalance,
        },
      },
    }
  }

  /** Step 1: grades the stored checks against the versions the session served (OD-28), copying the dimensions. */
  private async regrade(served: readonly ServedRef[], checks: readonly StoredCheck[]): Promise<GradedAnswer[]> {
    const versionOf = new Map(served.map((s) => [s.questionId, s.versionNo]))
    const refs = checks.map((c) => ({ questionId: c.questionId, versionNo: versionOf.get(c.questionId) ?? c.questionVersionNo }))
    const versions = refs.length > 0 ? await this.ports.questions.versions(refs) : new Map<string, PracticeQuestion>()
    return checks.map((check, i) => {
      const ref = refs[i]
      const q = ref ? versions.get(versionKey(ref.questionId, ref.versionNo)) : undefined
      return {
        check,
        isCorrect: q?.correctLabel != null ? q.correctLabel === check.selectedLabel : check.isCorrect,
        subjectId: q?.subjectId ?? null,
        educationLevelId: q?.educationLevelId ?? null,
        chapterId: q?.chapterId ?? null,
        topicId: q?.topicId ?? null,
        difficulty: q?.difficulty ?? null,
        questionType: q?.questionType ?? null,
      }
    })
  }

  // --- history ----------------------------------------------------------------------------------

  /** The caller's own completed sessions (the mock `historyPage`); their own Mod Pelajar rows included. */
  async history(caller: Caller, query: HistoryQuery): Promise<SessionListResponse> {
    const modes = query.modes
    const activeType = query.type && (modes as readonly string[]).includes(query.type) ? (query.type as PracticeMode) : null
    const narrowed = activeType ? [activeType] : modes
    const paged = query.page !== undefined || query.pageSize !== undefined
    const stats = await this.repo.historyStats(caller.userId, { modes, includeTest: true })
    const total = activeType ? await this.repo.historyCount(caller.userId, { modes: narrowed, includeTest: true }) : stats.sessions
    const page = paged ? (query.page ?? 1) : 1
    // The unpaged read is capped at HISTORY_MAX_ROWS rows (an account with a very long history is paged by the meta).
    const pageSize = paged ? (query.pageSize ?? HISTORY_PAGE_SIZE) : Math.max(1, Math.min(total, HISTORY_MAX_ROWS))
    const rows = await this.repo.history(caller.userId, {
      modes: narrowed,
      includeTest: true,
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    const subjects = new Map((await this.curriculum.subjects()).map((s) => [idToString(s.id), s.code]))
    const data: SessionListItem[] = rows.map((s) => ({
      id: s.id,
      mode: s.mode,
      subjectId: s.subjectId,
      // "UMUM" for mixed free practice (no subject).
      subjectCode: s.subjectId === null ? 'UMUM' : (subjects.get(s.subjectId) ?? null),
      questionCount: s.questionCount,
      correctCount: s.correctCount,
      percent: s.questionCount === 0 ? 0 : Math.round((s.correctCount / s.questionCount) * 100),
      coinsEarned: s.coinsEarned,
      timeSpent: s.timeSpentSec,
      completedAt: s.completedAt ? toMytTimestamp(s.completedAt) : null,
    }))
    return { data, meta: { ...listMeta(page, pageSize, total), activeType, stats } }
  }
}
