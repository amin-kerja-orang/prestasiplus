import { Inject, Injectable } from '@nestjs/common'
import type { PracticeMode } from '@pp/contract'

import { idFromString, idToString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'

export interface SubjectRow {
  id: string
  code: string
  name: string
  nameEn: string
  icon: string | null
  color: string
  isActive: boolean
}

export interface SessionRow {
  id: string
  mode: PracticeMode
  completedAt: Date
  questionCount: number
  correctCount: number
  timeSpentSec: number
  coinsEarned: number
}

export interface HistoryTotals {
  sessions: number
  answered: number
  avgAccuracyPct: number
  coins: number
}

/** Answers grouped by Malaysia-time day and subject (subject null = an answer without a subject). */
export interface DayGroup {
  day: string
  subjectId: string | null
  n: number
  c: number
}

export interface CorrectionRun {
  subjectId: string
  firstAt: Date
  firstCorrect: boolean
  laterCorrect: boolean
}

export interface MasteryRow {
  subjectId: string
  correct: number
  answered: number
  lastAnsweredAt: Date | null
}

export interface ChapterAnswerCount {
  chapterId: string
  attempts: number
  correct: number
}

const num = (v: bigint | number | null | undefined): number => Number(v ?? 0)

/**
 * Read-only queries of the analytics views (BE-13). Every figure comes from the answer rows' own
 * dimension columns (`subject_id`, `chapter_id`, ...), never from a join to `questions` (AC2); the one
 * exception is the revision queue, which keeps only entries whose question is still eligible (AC3).
 * `is_test` rows (written under Mod Pelajar) are left out everywhere except the caller's own history.
 */
@Injectable()
export class PracticeAnalyticsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  /** M03 subjects in BR-08 order. */
  async subjects(): Promise<SubjectRow[]> {
    const rows = await this.db.$queryRaw<
      { id: bigint; code: string; name: string; name_en: string; icon: string | null; color: string; is_active: boolean }[]
    >`SELECT id, code, name, name_en, icon, color, is_active FROM subjects ORDER BY sort_order, id`
    return rows.map((r) => ({
      id: idToString(r.id),
      code: r.code,
      name: r.name,
      nameEn: r.name_en,
      icon: r.icon,
      color: r.color,
      isActive: r.is_active,
    }))
  }

  /**
   * BR-14 / AC3: the user's queued questions per subject, only those whose question link is still
   * active (live version published and the question active). Returns the subject id of each queue row.
   */
  async eligibleQueueBySubject(userId: string): Promise<Map<string, number>> {
    const rows = await this.db.$queryRaw<{ subject_id: bigint; n: bigint }[]>`
      SELECT rq.subject_id, count(*) AS n
        FROM revision_queue rq
       WHERE rq.user_id = ${idFromString(userId)}::bigint
         AND EXISTS (
           SELECT 1 FROM questions q
             JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
            WHERE q.id = rq.question_id AND q.is_active AND v.status = 'approved')
       GROUP BY rq.subject_id`
    return new Map(rows.map((r) => [idToString(r.subject_id), num(r.n)]))
  }

  /** Answers of the user per Malaysia-time day and subject in `[from, to)` (open ended when null). */
  async answerDays(userId: string, from: Date | null, to: Date | null): Promise<DayGroup[]> {
    const rows = await this.db.$queryRaw<{ day: string; subject_id: bigint | null; n: bigint; c: bigint }[]>`
      SELECT to_char(answered_at AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYY-MM-DD') AS day,
             subject_id, count(*) AS n, count(*) FILTER (WHERE is_correct) AS c
        FROM practice_answers
       WHERE user_id = ${idFromString(userId)}::bigint AND NOT is_test
         AND (${from}::timestamptz IS NULL OR answered_at >= ${from}::timestamptz)
         AND (${to}::timestamptz IS NULL OR answered_at < ${to}::timestamptz)
       GROUP BY 1, 2
       ORDER BY 1`
    return rows.map((r) => ({ day: r.day, subjectId: r.subject_id === null ? null : idToString(r.subject_id), n: num(r.n), c: num(r.c) }))
  }

  /** Completed, non-test sessions completed in the window: count and total seconds. */
  async sessionTotals(userId: string, from: Date | null, to: Date | null): Promise<{ sessions: number; seconds: number }> {
    const rows = await this.db.$queryRaw<{ n: bigint; s: bigint | null }[]>`
      SELECT count(*) AS n, sum(time_spent_sec) AS s
        FROM practice_sessions
       WHERE user_id = ${idFromString(userId)}::bigint AND status = 'completed' AND NOT is_test
         AND (${from}::timestamptz IS NULL OR completed_at >= ${from}::timestamptz)
         AND (${to}::timestamptz IS NULL OR completed_at < ${to}::timestamptz)`
    return { sessions: num(rows[0]?.n), seconds: num(rows[0]?.s) }
  }

  /** The caller's own completed sessions, newest first. Test sessions count: it is the caller's own history. */
  async historyPage(userId: string, from: Date | null, to: Date | null, limit: number, offset: number): Promise<SessionRow[]> {
    const rows = await this.db.$queryRaw<
      { id: string; mode: string; completed_at: Date; question_count: number; correct_count: number; time_spent_sec: number; coins_earned: number }[]
    >`
      SELECT id::text AS id, mode, completed_at, question_count, correct_count, time_spent_sec, coins_earned
        FROM practice_sessions
       WHERE user_id = ${idFromString(userId)}::bigint AND status = 'completed' AND completed_at IS NOT NULL
         AND (${from}::timestamptz IS NULL OR completed_at >= ${from}::timestamptz)
         AND (${to}::timestamptz IS NULL OR completed_at < ${to}::timestamptz)
       ORDER BY completed_at DESC, id DESC
       LIMIT ${limit}::bigint OFFSET ${offset}::bigint`
    return rows.map((r) => ({
      id: r.id,
      mode: r.mode as PracticeMode,
      completedAt: r.completed_at,
      questionCount: r.question_count,
      correctCount: r.correct_count,
      timeSpentSec: r.time_spent_sec,
      coinsEarned: r.coins_earned,
    }))
  }

  async historyCount(userId: string, from: Date | null, to: Date | null): Promise<number> {
    const rows = await this.db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM practice_sessions
       WHERE user_id = ${idFromString(userId)}::bigint AND status = 'completed' AND completed_at IS NOT NULL
         AND (${from}::timestamptz IS NULL OR completed_at >= ${from}::timestamptz)
         AND (${to}::timestamptz IS NULL OR completed_at < ${to}::timestamptz)`
    return num(rows[0]?.n)
  }

  /** All-time totals (BR-21), never filtered by period; sessions with no question add no accuracy. */
  async historyTotals(userId: string): Promise<HistoryTotals> {
    const rows = await this.db.$queryRaw<{ sessions: bigint; answered: bigint | null; coins: bigint | null; avg: string | null }[]>`
      SELECT count(*) AS sessions, sum(question_count) AS answered, sum(coins_earned) AS coins,
             (avg(correct_count::numeric / question_count * 100) FILTER (WHERE question_count > 0))::text AS avg
        FROM practice_sessions
       WHERE user_id = ${idFromString(userId)}::bigint AND status = 'completed' AND completed_at IS NOT NULL`
    const r = rows[0]
    const avg = r?.avg == null ? 0 : Number(r.avg)
    return {
      sessions: num(r?.sessions),
      answered: num(r?.answered),
      avgAccuracyPct: Math.round((avg + Number.EPSILON) * 10) / 10,
      coins: num(r?.coins),
    }
  }

  /**
   * BR-18: per question, the first answer (non-test, with a question and a subject, not from a
   * `past_year` session) and whether a later answer was right; first answers inside `[from, to)` only.
   */
  async correctionRuns(userId: string, from: Date, to: Date): Promise<CorrectionRun[]> {
    const rows = await this.db.$queryRaw<{ subject_id: bigint; answered_at: Date; is_correct: boolean; later: boolean }[]>`
      WITH a AS (
        SELECT pa.question_id, pa.subject_id, pa.is_correct, pa.answered_at,
               row_number() OVER (PARTITION BY pa.question_id ORDER BY pa.answered_at, pa.id) AS rn
          FROM practice_answers pa
          LEFT JOIN practice_sessions s ON s.id = pa.session_id
         WHERE pa.user_id = ${idFromString(userId)}::bigint AND NOT pa.is_test
           AND pa.question_id IS NOT NULL AND pa.subject_id IS NOT NULL
           AND (pa.session_id IS NULL OR s.mode IS DISTINCT FROM 'past_year'))
      SELECT f.subject_id, f.answered_at, f.is_correct,
             EXISTS (SELECT 1 FROM a b WHERE b.question_id = f.question_id AND b.rn > 1 AND b.is_correct) AS later
        FROM a f
       WHERE f.rn = 1 AND f.answered_at >= ${from}::timestamptz AND f.answered_at < ${to}::timestamptz`
    return rows.map((r) => ({ subjectId: idToString(r.subject_id), firstAt: r.answered_at, firstCorrect: r.is_correct, laterCorrect: r.later }))
  }

  /** BR-20: the stored counters when the user has any, else the aggregate of the answer log. */
  async mastery(userId: string): Promise<MasteryRow[]> {
    const uid = idFromString(userId)
    const stored = await this.db.$queryRaw<{ subject_id: bigint; correct: number; answered: number; last: Date | null }[]>`
      SELECT subject_id, correct, answered, last_answered_at AS last FROM mastery WHERE user_id = ${uid}::bigint ORDER BY subject_id`
    if (stored.length > 0) {
      return stored.map((r) => ({ subjectId: idToString(r.subject_id), correct: r.correct, answered: r.answered, lastAnsweredAt: r.last }))
    }
    const log = await this.db.$queryRaw<{ subject_id: bigint; correct: bigint; answered: bigint; last: Date | null }[]>`
      SELECT subject_id, count(*) FILTER (WHERE is_correct) AS correct, count(*) AS answered, max(answered_at) AS last
        FROM practice_answers
       WHERE user_id = ${uid}::bigint AND subject_id IS NOT NULL AND NOT is_test
       GROUP BY subject_id ORDER BY subject_id`
    return log.map((r) => ({ subjectId: idToString(r.subject_id), correct: num(r.correct), answered: num(r.answered), lastAnsweredAt: r.last }))
  }

  /**
   * Read method for BE-48: attempts and right answers per chapter, grouped on the answer rows'
   * `chapter_id` (no question join), non-test rows only, chapters with at least `minAttempts` attempts.
   */
  async chapterAnswerCounts(userId: string, minAttempts: number): Promise<ChapterAnswerCount[]> {
    const min = Math.max(1, Math.trunc(minAttempts))
    const rows = await this.db.$queryRaw<{ chapter_id: bigint; attempts: bigint; correct: bigint }[]>`
      SELECT chapter_id, count(*) AS attempts, count(*) FILTER (WHERE is_correct) AS correct
        FROM practice_answers
       WHERE user_id = ${idFromString(userId)}::bigint AND chapter_id IS NOT NULL AND NOT is_test
       GROUP BY chapter_id
      HAVING count(*) >= ${min}::bigint
       ORDER BY chapter_id`
    return rows.map((r) => ({ chapterId: idToString(r.chapter_id), attempts: num(r.attempts), correct: num(r.correct) }))
  }
}
