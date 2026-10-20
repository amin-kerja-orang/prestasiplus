import { Inject, Injectable } from '@nestjs/common'
import type { PracticeMode } from '@pp/contract'

import type { TxClient } from '../../db/client'
import type { PracticeSession as SessionRow } from '../../db/generated/client'
import { idFromString, idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { alreadySubmitted, notFound } from './errors'
import { MAX_SECONDS_PER_QUESTION, POINTS_PER_CORRECT, sessionCoins } from './rules'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True when `text` is shaped like a uuid (a non-uuid session id is an unknown session, never a 500). */
export const isUuid = (text: string): boolean => UUID.test(text)

const bigOrNull = (id: string | null | undefined): bigint | null => (id == null ? null : idFromString(id))
const strOrNull = (id: bigint | null): string | null => (id === null ? null : idToString(id))

/** A practice session with decimal-string ids (ADR-0014: this repository is the only doorway to the tables). */
export interface SessionRecord {
  id: string
  userId: string
  clientUuid: string | null
  mode: PracticeMode
  subjectId: string | null
  educationLevelId: string | null
  difficulty: number | null
  chapterId: string | null
  year: number | null
  setNo: number | null
  targetQuestionId: string | null
  missionId: string | null
  remedialTestId: string | null
  questionSetId: string | null
  timeLimitSec: number | null
  questionCount: number
  status: 'in_progress' | 'completed'
  correctCount: number
  timeSpentSec: number
  coinsEarned: number
  pointsEarned: number
  coinsPerCorrect: number | null
  startedAt: Date
  completedAt: Date | null
  isTest: boolean
}

function toSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    userId: idToString(row.userId),
    clientUuid: row.clientUuid,
    mode: row.mode as PracticeMode,
    subjectId: strOrNull(row.subjectId),
    educationLevelId: strOrNull(row.educationLevelId),
    difficulty: row.difficulty,
    chapterId: strOrNull(row.chapterId),
    year: row.year,
    setNo: row.setNo,
    targetQuestionId: strOrNull(row.targetQuestionId),
    missionId: strOrNull(row.missionId),
    remedialTestId: strOrNull(row.remedialTestId),
    questionSetId: strOrNull(row.questionSetId),
    timeLimitSec: row.timeLimitSec,
    questionCount: row.questionCount,
    status: row.status as SessionRecord['status'],
    correctCount: row.correctCount,
    timeSpentSec: row.timeSpentSec,
    coinsEarned: row.coinsEarned,
    pointsEarned: row.pointsEarned,
    coinsPerCorrect: row.coinsPerCorrect,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    isTest: row.isTest,
  }
}

/** One served question: its place in the session and the version served (OD-28). */
export interface ServedRef {
  position: number
  questionId: string
  versionNo: number
}

export interface NewSession {
  userId: string
  clientUuid: string | null
  mode: PracticeMode
  subjectId: string | null
  educationLevelId: string | null
  difficulty: number | null
  chapterId: string | null
  year: number | null
  setNo: number | null
  targetQuestionId: string | null
  missionId: string | null
  remedialTestId: string | null
  questionSetId: string | null
  timeLimitSec: number | null
  coinsPerCorrect: number | null
  startedAt: Date
  isTest: boolean
  /** In served order; `position` is the index. */
  served: readonly { questionId: string; versionNo: number }[]
}

/** One checked question of an in-progress session. */
export interface StoredCheck {
  questionId: string
  questionVersionNo: number
  selectedLabel: string
  isCorrect: boolean
  checkedAt: Date
  seq: number
}

export interface NewCheck {
  sessionId: string
  userId: string
  questionId: string
  questionVersionNo: number
  selectedLabel: string
  isCorrect: boolean
  checkedAt: Date
  isTest: boolean
}

/** A check after the regrade against the served version, with the dimensions copied onto the answer row (AC 6). */
export interface GradedAnswer {
  check: StoredCheck
  isCorrect: boolean
  subjectId: string | null
  educationLevelId: string | null
  chapterId: string | null
  topicId: string | null
  difficulty: number | null
  questionType: string | null
}

export interface CompletedSession {
  session: SessionRecord
  correct: number
  total: number
  timeSpentSec: number
  coinsEarned: number
  pointsEarned: number
  completedAt: Date
  answers: readonly GradedAnswer[]
}

export interface CompleteInput {
  sessionId: string
  userId: string
  now: Date
  /** The client value as sent (never rejected; coerced here). */
  timeSpent: unknown
  isTest: boolean
}

export interface CompleteHooks<T> {
  /** Runs first inside the transaction, session row locked and still open: a throw refuses the submit (assigned-work races). */
  guard?(session: SessionRecord): Promise<void>
  /** Step 1: regrade the stored checks against the versions the session served (called inside the transaction, session row locked). */
  regrade(session: SessionRecord, served: readonly ServedRef[], checks: readonly StoredCheck[]): Promise<GradedAnswer[]>
  /** Steps 6 and 7: reward and assigned-work hooks. Runs in the same transaction; a throw rolls everything back. */
  completed(done: CompletedSession, tx: TxClient): Promise<T>
}

export interface HistoryOptions {
  modes: readonly string[]
  /** Other modules pass false (default): rows written under Mod Pelajar are excluded (AC-18.3). */
  includeTest?: boolean
  skip?: number
  take?: number
}

/** Hard cap of one history read (the unpaged list never returns more rows than this). */
export const HISTORY_MAX_ROWS = 1000

export interface HistoryStats {
  sessions: number
  avgAccuracyPct: number
  coins: number
  answered: number
}

export interface AnswerRecord {
  id: string
  sessionId: string | null
  questionId: string | null
  subjectId: string | null
  educationLevelId: string | null
  chapterId: string | null
  topicId: string | null
  difficulty: number | null
  questionType: string | null
  selectedLabel: string | null
  isCorrect: boolean
  answeredAt: Date
  historical: boolean
  isTest: boolean
}

export interface AnswerFilter {
  sessionId?: string
  subjectId?: string
  chapterId?: string
  /** Inclusive lower bound of `answeredAt`. */
  from?: Date
  /** Exclusive upper bound of `answeredAt`. */
  to?: Date
  includeTest?: boolean
}

export interface QueueRecord {
  questionId: string
  subjectId: string
  wrongTimes: number
  lastWrongAt: Date
}

export interface MasteryRecord {
  subjectId: string
  correct: number
  answered: number
  lastAnsweredAt: Date | null
}

/** BR-14 order: wrongTimes descending, then the latest wrong answer first, then the question id. */
export function queueOrder(a: QueueRecord, b: QueueRecord): number {
  return (
    b.wrongTimes - a.wrongTimes ||
    b.lastWrongAt.getTime() - a.lastWrongAt.getTime() ||
    (BigInt(a.questionId) < BigInt(b.questionId) ? -1 : BigInt(a.questionId) > BigInt(b.questionId) ? 1 : 0)
  )
}

/**
 * The only doorway to the practice tables (ADR-0014, data model 3.6): `practice_sessions`,
 * `practice_session_questions`, `practice_checks`, `practice_answers`, `revision_queue`, `mastery`.
 * Every method uses `prisma.client`, so it joins the transaction a service opened with
 * `prisma.transaction(...)`. Reads meant for other modules (`history`, `answers`) leave out rows written
 * under Mod Pelajar unless `includeTest` is set (AC-18.3, G-07).
 */
@Injectable()
export class PracticeRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  // --- sessions ---------------------------------------------------------------------------------

  /** The caller's own session; `null` for an unknown id, a non-uuid id or somebody else's session. */
  async session(id: string, userId: string): Promise<SessionRecord | null> {
    if (!isUuid(id)) return null
    const row = await this.db.practiceSession.findFirst({ where: { id, userId: idFromString(userId) } })
    return row ? toSession(row) : null
  }

  /** The caller's own session by its client idempotency key. */
  async sessionByClientUuid(userId: string, clientUuid: string): Promise<SessionRecord | null> {
    const row = await this.db.practiceSession.findFirst({ where: { userId: idFromString(userId), clientUuid } })
    return row ? toSession(row) : null
  }

  /** How many sessions the user has started (a deterministic seed component for the draw). */
  countSessions(userId: string): Promise<number> {
    return this.db.practiceSession.count({ where: { userId: idFromString(userId) } })
  }

  /** Sessions of a user linked to one assigned item (BR-32), oldest first. */
  async linkedSessions(
    userId: string,
    field: 'missionId' | 'remedialTestId' | 'questionSetId',
    id: string,
  ): Promise<SessionRecord[]> {
    const rows = await this.db.practiceSession.findMany({
      where: { userId: idFromString(userId), [field]: idFromString(id) },
      orderBy: [{ startedAt: 'asc' }, { createdAt: 'asc' }],
    })
    return rows.map(toSession)
  }

  /**
   * Serializes the starts (and the submits) of one user on one assigned item (mission BR-32, remedial,
   * question_set attempts): a transaction-scoped advisory lock keyed by kind, user and item.
   */
  async lockAssigned(userId: string, kind: 'mission' | 'remedial' | 'question_set', itemId: string): Promise<void> {
    await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`practice:${kind}:${userId}:${itemId}`}, 0))`
  }

  /**
   * Creates the session and its served list (position 0 to n-1, the version served) in ONE
   * transaction. A repeated (user, clientUuid) raises a unique violation; the caller replays.
   */
  startSession(input: NewSession): Promise<SessionRecord> {
    return this.prisma.transaction(async () => {
      const row = await this.db.practiceSession.create({
        data: {
          userId: idFromString(input.userId),
          clientUuid: input.clientUuid,
          mode: input.mode,
          subjectId: bigOrNull(input.subjectId),
          educationLevelId: bigOrNull(input.educationLevelId),
          difficulty: input.difficulty,
          chapterId: bigOrNull(input.chapterId),
          year: input.year,
          setNo: input.setNo,
          targetQuestionId: bigOrNull(input.targetQuestionId),
          missionId: bigOrNull(input.missionId),
          remedialTestId: bigOrNull(input.remedialTestId),
          questionSetId: bigOrNull(input.questionSetId),
          timeLimitSec: input.timeLimitSec,
          questionCount: input.served.length,
          coinsPerCorrect: input.coinsPerCorrect,
          startedAt: input.startedAt,
          isTest: input.isTest,
        },
      })
      await this.db.practiceSessionQuestion.createMany({
        data: input.served.map((s, position) => ({
          sessionId: row.id,
          position,
          questionId: idFromString(s.questionId),
          questionVersionNo: s.versionNo,
          isTest: input.isTest,
        })),
      })
      return toSession(row)
    })
  }

  /** The served list in order, with the version served (OD-28). */
  async sessionQuestions(sessionId: string): Promise<ServedRef[]> {
    const rows = await this.db.practiceSessionQuestion.findMany({ where: { sessionId }, orderBy: { position: 'asc' } })
    return rows.map((r) => ({ position: r.position, questionId: idToString(r.questionId), versionNo: r.questionVersionNo }))
  }

  /**
   * Locks the session row of the caller (`FOR UPDATE` for a submit, `FOR SHARE` for a check) for the rest
   * of the transaction and returns it fresh; `null` when it is not theirs. A check waits for a running
   * submit and then sees `completed`, so no check row is written after the session closed.
   */
  async lockSession(id: string, userId: string, mode: 'update' | 'share'): Promise<SessionRecord | null> {
    if (!isUuid(id)) return null
    const uid = idFromString(userId)
    const rows =
      mode === 'update'
        ? await this.db.$queryRaw<{ id: string }[]>`SELECT id::text AS id FROM practice_sessions WHERE id = ${id}::uuid AND user_id = ${uid}::bigint FOR UPDATE`
        : await this.db.$queryRaw<{ id: string }[]>`SELECT id::text AS id FROM practice_sessions WHERE id = ${id}::uuid AND user_id = ${uid}::bigint FOR SHARE`
    if (rows.length === 0) return null
    return this.session(id, userId)
  }

  // --- checks (BR-30) ---------------------------------------------------------------------------

  async checks(sessionId: string): Promise<StoredCheck[]> {
    const rows = await this.db.practiceCheck.findMany({ where: { sessionId }, orderBy: [{ seq: 'asc' }, { id: 'asc' }] })
    return rows.map((r) => ({
      questionId: idToString(r.questionId),
      questionVersionNo: r.questionVersionNo,
      selectedLabel: r.selectedLabel,
      isCorrect: r.isCorrect,
      checkedAt: r.checkedAt,
      seq: r.seq,
    }))
  }

  async check(sessionId: string, questionId: string): Promise<StoredCheck | null> {
    const r = await this.db.practiceCheck.findUnique({
      where: { sessionId_questionId: { sessionId, questionId: idFromString(questionId) } },
    })
    return r
      ? {
          questionId: idToString(r.questionId),
          questionVersionNo: r.questionVersionNo,
          selectedLabel: r.selectedLabel,
          isCorrect: r.isCorrect,
          checkedAt: r.checkedAt,
          seq: r.seq,
        }
      : null
  }

  /**
   * Stores the first check of a question. Returns false when a check already exists (a concurrent
   * duplicate: `ON CONFLICT DO NOTHING` on the unique key), so only the winner counts the trial use.
   */
  async insertCheck(input: NewCheck): Promise<boolean> {
    const seq = (await this.db.practiceCheck.count({ where: { sessionId: input.sessionId } })) + 1
    const created = await this.db.practiceCheck.createMany({
      skipDuplicates: true,
      data: [
        {
          sessionId: input.sessionId,
          userId: idFromString(input.userId),
          questionId: idFromString(input.questionId),
          questionVersionNo: input.questionVersionNo,
          selectedLabel: input.selectedLabel,
          isCorrect: input.isCorrect,
          checkedAt: input.checkedAt,
          seq,
          isTest: input.isTest,
        },
      ],
    })
    return created.count === 1
  }

  // --- completion (ADR-0014 section 2 and amendment 2) -------------------------------------------

  /**
   * Completes a session in ONE transaction, in the ADR order: (1) regrade, (2) answer rows with the
   * dimensions copied, the checks removed, (3) the session totals, (4) the revision queue (BR-14), (5) the
   * mastery counters (BR-20), then the caller's `completed` hook (reward, remedial test). A throw anywhere,
   * the hook included, rolls all of it back. The session row is locked (`FOR UPDATE`), so two parallel
   * submits give one success and one 409 `ALREADY_SUBMITTED`.
   */
  completeSession<T>(input: CompleteInput, hooks: CompleteHooks<T>): Promise<{ done: CompletedSession; result: T }> {
    return this.prisma.transaction(async (tx) => {
      const locked = await this.lockSession(input.sessionId, input.userId, 'update')
      if (!locked) throw notFound()
      if (locked.status !== 'in_progress') throw alreadySubmitted()
      if (hooks.guard) await hooks.guard(locked)

      const served = await this.sessionQuestions(locked.id)
      const checks = await this.checks(locked.id)
      const graded = await hooks.regrade(locked, served, checks)

      const correct = graded.filter((g) => g.isCorrect).length
      const cap = MAX_SECONDS_PER_QUESTION * locked.questionCount
      const raw = typeof input.timeSpent === 'number' && Number.isFinite(input.timeSpent) ? input.timeSpent : 0
      const spent = Math.max(0, Math.min(cap, Math.round(raw)))
      const test = input.isTest || locked.isTest
      const userId = idFromString(locked.userId)

      // (2) answer rows, then the checks they replace.
      if (graded.length > 0) {
        await this.db.practiceAnswer.createMany({
          data: graded.map((g) => ({
            sessionId: locked.id,
            userId,
            questionId: idFromString(g.check.questionId),
            questionVersionNo: g.check.questionVersionNo,
            subjectId: bigOrNull(g.subjectId),
            educationLevelId: bigOrNull(g.educationLevelId),
            chapterId: bigOrNull(g.chapterId),
            topicId: bigOrNull(g.topicId),
            difficulty: g.difficulty,
            questionType: g.questionType,
            selectedLabel: g.check.selectedLabel,
            isCorrect: g.isCorrect,
            answeredAt: g.check.checkedAt,
            historical: false,
            clientUuid: locked.clientUuid,
            isTest: test,
          })),
        })
      }
      await this.db.practiceCheck.deleteMany({ where: { sessionId: locked.id } })

      // (3) the session.
      const coins = sessionCoins(locked.mode, correct, locked.coinsPerCorrect)
      const points = POINTS_PER_CORRECT * correct
      const row = await this.db.practiceSession.update({
        where: { id: locked.id },
        data: {
          status: 'completed',
          completedAt: input.now,
          correctCount: correct,
          timeSpentSec: spent,
          pointsEarned: points,
          coinsEarned: coins,
          updatedAt: input.now,
        },
      })

      // (4) the revision queue, (5) the mastery counters.
      await this.writeQueue(userId, graded, input.now)
      await this.writeMastery(userId, graded, test, input.now)

      const done: CompletedSession = {
        session: toSession(row),
        correct,
        total: locked.questionCount,
        timeSpentSec: spent,
        coinsEarned: coins,
        pointsEarned: points,
        completedAt: input.now,
        answers: graded,
      }
      const result = await hooks.completed(done, tx)
      return { done, result }
    })
  }

  /** BR-14: a wrong answer adds one to `wrong_times` (or queues the question), a right answer removes it. */
  private async writeQueue(userId: bigint, graded: readonly GradedAnswer[], at: Date): Promise<void> {
    for (const g of graded) {
      if (g.subjectId === null) continue
      const questionId = idFromString(g.check.questionId)
      if (g.isCorrect) {
        await this.db.revisionQueue.deleteMany({ where: { userId, questionId } })
      } else {
        await this.db.revisionQueue.upsert({
          where: { userId_questionId: { userId, questionId } },
          create: { userId, questionId, subjectId: idFromString(g.subjectId), wrongTimes: 1, lastWrongAt: g.check.checkedAt },
          update: { wrongTimes: { increment: 1 }, lastWrongAt: g.check.checkedAt, updatedAt: at },
        })
      }
    }
  }

  /**
   * BR-20: adds the session's answers to the stored counters, per subject, in one statement per subject.
   * A user without counters for the subject starts from the answer log so far (the new answers are
   * already in it), like the mock.
   */
  private async writeMastery(userId: bigint, graded: readonly GradedAnswer[], isTest: boolean, at: Date): Promise<void> {
    const bySubject = new Map<string, { answered: number; correct: number; last: Date }>()
    for (const g of graded) {
      if (g.subjectId === null) continue
      const cur = bySubject.get(g.subjectId)
      const when = g.check.checkedAt
      if (cur) {
        cur.answered += 1
        cur.correct += g.isCorrect ? 1 : 0
        if (when > cur.last) cur.last = when
      } else {
        bySubject.set(g.subjectId, { answered: 1, correct: g.isCorrect ? 1 : 0, last: when })
      }
    }
    for (const [subjectKey, d] of [...bySubject.entries()].sort((a, b) => (BigInt(a[0]) < BigInt(b[0]) ? -1 : 1))) {
      const subjectId = idFromString(subjectKey)
      await this.db.$executeRaw`
        INSERT INTO mastery (user_id, subject_id, correct, answered, last_answered_at)
        SELECT ${userId}::bigint, ${subjectId}::bigint, count(*) FILTER (WHERE is_correct), count(*), max(answered_at)
          FROM practice_answers
         WHERE user_id = ${userId}::bigint AND subject_id = ${subjectId}::bigint AND is_test = ${isTest}::boolean
        ON CONFLICT (user_id, subject_id) DO UPDATE SET
          correct = mastery.correct + ${d.correct}::int,
          answered = mastery.answered + ${d.answered}::int,
          last_answered_at = GREATEST(mastery.last_answered_at, ${d.last}::timestamptz),
          updated_at = ${at}::timestamptz`
    }
  }

  // --- reads ------------------------------------------------------------------------------------

  /**
   * Completed sessions of a user in `modes`, newest first (completed_at desc, then id desc). Other modules
   * leave `includeTest` unset: rows written under Mod Pelajar are excluded.
   */
  async history(userId: string, options: HistoryOptions): Promise<SessionRecord[]> {
    const rows = await this.db.practiceSession.findMany({
      where: {
        userId: idFromString(userId),
        status: 'completed',
        mode: { in: [...options.modes] },
        ...(options.includeTest ? {} : { isTest: false }),
      },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      ...(options.skip !== undefined ? { skip: options.skip } : {}),
      ...(options.take !== undefined ? { take: options.take } : {}),
    })
    return rows.map(toSession)
  }

  async historyCount(userId: string, options: Pick<HistoryOptions, 'modes' | 'includeTest'>): Promise<number> {
    return this.db.practiceSession.count({
      where: {
        userId: idFromString(userId),
        status: 'completed',
        mode: { in: [...options.modes] },
        ...(options.includeTest ? {} : { isTest: false }),
      },
    })
  }

  /** Counts and sums over EVERY completed session of `modes` (not only one page or one `type`). */
  async historyStats(userId: string, options: Pick<HistoryOptions, 'modes' | 'includeTest'>): Promise<HistoryStats> {
    const modes = [...options.modes]
    const includeTest = options.includeTest === true
    const rows = await this.db.$queryRaw<
      { sessions: bigint; coins: bigint | null; answered: bigint | null; avg: string | null }[]
    >`
      SELECT count(*) AS sessions,
             sum(coins_earned) AS coins,
             sum(question_count) AS answered,
             (avg(correct_count::numeric / question_count * 100) FILTER (WHERE question_count > 0))::text AS avg
        FROM practice_sessions
       WHERE user_id = ${idFromString(userId)}::bigint AND status = 'completed'
         AND mode = ANY(${modes}::text[]) AND (${includeTest}::boolean OR NOT is_test)`
    const r = rows[0]
    const avg = r?.avg == null ? 0 : Number(r.avg)
    return {
      sessions: Number(r?.sessions ?? 0),
      avgAccuracyPct: Math.round(avg * 10) / 10,
      coins: Number(r?.coins ?? 0),
      answered: Number(r?.answered ?? 0),
    }
  }

  /** A user's answer log, oldest first. */
  async answers(userId: string, filter: AnswerFilter = {}): Promise<AnswerRecord[]> {
    const rows = await this.db.practiceAnswer.findMany({
      where: {
        userId: idFromString(userId),
        ...(filter.sessionId ? { sessionId: filter.sessionId } : {}),
        ...(filter.subjectId ? { subjectId: idFromString(filter.subjectId) } : {}),
        ...(filter.chapterId ? { chapterId: idFromString(filter.chapterId) } : {}),
        ...(filter.from || filter.to ? { answeredAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lt: filter.to } : {}) } } : {}),
        ...(filter.includeTest ? {} : { isTest: false }),
      },
      orderBy: [{ answeredAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((r) => ({
      id: idToString(r.id),
      sessionId: r.sessionId,
      questionId: strOrNull(r.questionId),
      subjectId: strOrNull(r.subjectId),
      educationLevelId: strOrNull(r.educationLevelId),
      chapterId: strOrNull(r.chapterId),
      topicId: strOrNull(r.topicId),
      difficulty: r.difficulty,
      questionType: r.questionType,
      selectedLabel: r.selectedLabel,
      isCorrect: r.isCorrect,
      answeredAt: r.answeredAt,
      historical: r.historical,
      isTest: r.isTest,
    }))
  }

  /** The wrong-answer queue of a user in BR-14 order, optionally for one subject. */
  async queue(userId: string, filter: { subjectId?: string } = {}): Promise<QueueRecord[]> {
    const rows = await this.db.revisionQueue.findMany({
      where: { userId: idFromString(userId), ...(filter.subjectId ? { subjectId: idFromString(filter.subjectId) } : {}) },
    })
    return rows
      .map((r) => ({
        questionId: idToString(r.questionId),
        subjectId: idToString(r.subjectId),
        wrongTimes: r.wrongTimes,
        lastWrongAt: r.lastWrongAt,
      }))
      .sort(queueOrder)
  }

  /** The stored mastery counters of a user, by subject id. */
  async mastery(userId: string): Promise<MasteryRecord[]> {
    const rows = await this.db.mastery.findMany({ where: { userId: idFromString(userId) }, orderBy: { subjectId: 'asc' } })
    return rows.map((r) => ({
      subjectId: idToString(r.subjectId),
      correct: r.correct,
      answered: r.answered,
      lastAnsweredAt: r.lastAnsweredAt,
    }))
  }

  /**
   * What the user answered in one chapter (BR-16, BR-17): per question, the time of the latest answer and
   * whether that latest answer was right. Rows of the caller's own mode only (`isTest`).
   */
  async chapterProgress(
    userId: string,
    chapterId: string,
    isTest: boolean,
  ): Promise<Map<string, { lastAt: Date; correct: boolean }>> {
    const rows = await this.db.practiceAnswer.findMany({
      where: { userId: idFromString(userId), chapterId: idFromString(chapterId), questionId: { not: null }, isTest },
      select: { questionId: true, isCorrect: true, answeredAt: true },
      orderBy: [{ answeredAt: 'asc' }, { id: 'asc' }],
    })
    const map = new Map<string, { lastAt: Date; correct: boolean }>()
    for (const r of rows) {
      if (r.questionId !== null) map.set(idToString(r.questionId), { lastAt: r.answeredAt, correct: r.isCorrect })
    }
    return map
  }
}
