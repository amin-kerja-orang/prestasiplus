import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'
import { LEARNER_LEVEL_SQL, NOT_PKSK_SQL } from '../../../questions/learner-visibility'

export interface AnswerFigures {
  answered: number
  correct: number
}

export interface ChapterLatest {
  answered: number
  correct: number
}

export interface ChapterTotals {
  answered: number
  correct: number
  sessions: number
}

/** One cell of the bank matrix: eligible questions (live version published, `is_active`) of a subject, level and TP. */
export interface BankCell {
  subjectId: string | null
  levelId: string | null
  /** Stored TP 1 to 6 (null = untagged). */
  tp: number | null
  /** Type mcq (the only type practice draws, M04 BR-M04-03). */
  mcq: boolean
  n: number
}

const big = (ids: readonly string[]): bigint[] => ids.map((id) => idFromString(id))

/**
 * Reads of the overview screens (BE-13). Every figure of the caller is computed from the DIMENSION columns of
 * `practice_answers` (subject_id, chapter_id, is_correct, ...), never from a join to `questions` (AC2).
 * The few reads of the question bank (chapter question counts, the revision link check) are the exception
 * the card allows (AC3) or that no `QuestionsRepository` method covers yet (`chapter_id` is not a
 * `QuestionFilter` key); each says so. BE-12's tables are only read. `isTest` follows BE-12
 * (`PracticeRepository.chapterProgress`): a caller sees the rows of its own mode, so Mod Pelajar test rows
 * never reach a real figure.
 */
@Injectable()
export class OverviewRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  /** BR-25: answers of the caller in `[from, to)`, with or without a session. Index: `ix_practice_answers_user_id_subject_id_answered_at`. */
  async answerFigures(userId: string, from: Date, to: Date, isTest: boolean): Promise<AnswerFigures> {
    const rows = await this.db.$queryRaw<{ answered: bigint; correct: bigint }[]>`
      SELECT count(*) AS answered, count(*) FILTER (WHERE is_correct) AS correct
        FROM practice_answers
       WHERE user_id = ${idFromString(userId)}::bigint
         AND answered_at >= ${from}::timestamptz AND answered_at < ${to}::timestamptz
         AND is_test = ${isTest}::boolean`
    const r = rows[0]
    return { answered: Number(r?.answered ?? 0), correct: Number(r?.correct ?? 0) }
  }

  /** BR-25: completed sessions of the caller that finished in `[from, to)`. */
  async completedSessions(userId: string, from: Date, to: Date, isTest: boolean): Promise<number> {
    const rows = await this.db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM practice_sessions
       WHERE user_id = ${idFromString(userId)}::bigint AND status = 'completed'
         AND completed_at >= ${from}::timestamptz AND completed_at < ${to}::timestamptz
         AND is_test = ${isTest}::boolean`
    return Number(rows[0]?.n ?? 0)
  }

  /**
   * BR-14 / AC3: distinct queued questions that still have an active question link (live version published and
   * `is_active`). The only read that looks at the bank, and only at its active flag.
   */
  async revisionTotal(userId: string): Promise<number> {
    const rows = await this.db.$queryRaw<{ n: bigint }[]>`
      SELECT count(DISTINCT r.question_id) AS n
        FROM revision_queue r
        JOIN questions q ON q.id = r.question_id
        JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
       WHERE r.user_id = ${idFromString(userId)}::bigint AND q.is_active AND v.status = 'approved'`
    return Number(rows[0]?.n ?? 0)
  }

  /** S1 "Digunakan": the usage counter per subject id. */
  async subjectUsage(): Promise<Map<string, number>> {
    const rows = await this.db.subjectUsage.findMany()
    return new Map(rows.map((r) => [idToString(r.subjectId), r.usedCount]))
  }

  /**
   * The eligible question counts of the whole bank in ONE grouped pass (Q-ACTIVE, Q-ELIGIBLE, Q-PRACTICE,
   * Q-DIFFICULTY by subject, level and TP). `QuestionsRepository.count` / `groupCount` answer one dimension per
   * statement; the dashboard needs several, and one statement keeps it fast. v2 has no "approved but not
   * published" served state, so Q-ACTIVE and Q-ELIGIBLE are the same set here (deviation).
   * Ungrouped only (`q.group_id IS NULL`, D91): a stimulus-group member is never drawn by practice (the hub / draw rule), so the
   * card, the details and the drawable pool agree. The login count (`QUESTION_COUNT_SQL`) keeps counting group members.
   */
  async bankMatrix(): Promise<BankCell[]> {
    const rows = await this.db.$queryRaw<{ subject_id: bigint | null; level_id: bigint | null; tp: number | null; mcq: boolean; n: number }[]>`
      SELECT v.subject_id, v.education_level_id AS level_id, v.difficulty_tp AS tp, (v.type = 'mcq') AS mcq, count(*)::int AS n
        FROM questions q
        JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
       WHERE q.is_active AND v.status = 'approved' AND q.group_id IS NULL AND ${NOT_PKSK_SQL} AND ${LEARNER_LEVEL_SQL}
       GROUP BY 1, 2, 3, 4`
    return rows.map((r) => ({
      subjectId: r.subject_id === null ? null : idToString(r.subject_id),
      levelId: r.level_id === null ? null : idToString(r.level_id),
      tp: r.tp,
      mcq: r.mcq,
      n: r.n,
    }))
  }

  /**
   * BR-29: ids of the newest active, published objective questions (live version published, `is_active`, type mcq), newest first.
   * `QuestionsRepository.listIds` also computes the total and the per-status counts (two more full scans of
   * the bank), which the dashboard does not need; this reads the primary key backwards and stops at `limit`.
   */
  async newestPublishedMcqIds(limit: number): Promise<string[]> {
    const rows = await this.db.$queryRaw<{ id: bigint }[]>`
      SELECT q.id
        FROM questions q
        JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
       WHERE q.is_active AND v.status = 'approved' AND v.type = 'mcq' AND ${NOT_PKSK_SQL} AND ${LEARNER_LEVEL_SQL}
       ORDER BY q.id DESC
       LIMIT ${limit}`
    return rows.map((r) => idToString(r.id))
  }

  /**
   * Q-CHAPTER (BR-15): eligible objective questions (live version published, `is_active`, type mcq) per chapter.
   * Ungrouped only (`q.group_id IS NULL`, D91), as `bankMatrix`: a stimulus-group member is never drawn, so the Bab card equals the drawable pool.
   * `QuestionsRepository` has no chapter filter yet, so this is one grouped statement on the bank tables.
   */
  async chapterQuestionCounts(chapterIds: readonly string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>()
    if (chapterIds.length === 0) return out
    const rows = await this.db.$queryRaw<{ chapter_id: bigint; n: number }[]>`
      SELECT v.chapter_id, count(*)::int AS n
        FROM questions q
        JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
       WHERE v.chapter_id = ANY(${big(chapterIds)}::bigint[]) AND q.is_active AND v.status = 'approved' AND v.type = 'mcq' AND q.group_id IS NULL AND ${NOT_PKSK_SQL} AND ${LEARNER_LEVEL_SQL}
       GROUP BY v.chapter_id`
    for (const r of rows) out.set(idToString(r.chapter_id), r.n)
    return out
  }

  /**
   * BR-16: per chapter, the questions the caller answered and how many of them the LATEST answer got right
   * (latest by `answered_at`, then `id`, as `PracticeRepository.chapterProgress`). Rows without a question link
   * cannot be told apart per question and are left out, as BE-12 does.
   */
  async chapterLatest(userId: string, chapterIds: readonly string[], isTest: boolean): Promise<Map<string, ChapterLatest>> {
    const out = new Map<string, ChapterLatest>()
    if (chapterIds.length === 0) return out
    const rows = await this.db.$queryRaw<{ chapter_id: bigint; answered: bigint; correct: bigint }[]>`
      SELECT chapter_id, count(*) AS answered, count(*) FILTER (WHERE is_correct) AS correct
        FROM (
          SELECT DISTINCT ON (chapter_id, question_id) chapter_id, question_id, is_correct
            FROM practice_answers
           WHERE user_id = ${idFromString(userId)}::bigint AND chapter_id = ANY(${big(chapterIds)}::bigint[])
             AND question_id IS NOT NULL AND is_test = ${isTest}::boolean
           ORDER BY chapter_id, question_id, answered_at DESC, id DESC
        ) latest
       GROUP BY chapter_id`
    for (const r of rows) out.set(idToString(r.chapter_id), { answered: Number(r.answered), correct: Number(r.correct) })
    return out
  }

  /**
   * M03 BR-19: per chapter, EVERY answer row of the learner (answered, correct, distinct sessions), from the
   * dimension columns only. Mod Pelajar rows never count (a provider gets a user id, not a mode).
   */
  async chapterTotals(userId: string): Promise<Map<string, ChapterTotals>> {
    const rows = await this.db.$queryRaw<{ chapter_id: bigint; answered: bigint; correct: bigint; sessions: bigint }[]>`
      SELECT chapter_id, count(*) AS answered, count(*) FILTER (WHERE is_correct) AS correct,
             count(DISTINCT session_id) AS sessions
        FROM practice_answers
       WHERE user_id = ${idFromString(userId)}::bigint AND chapter_id IS NOT NULL AND NOT is_test
       GROUP BY chapter_id`
    return new Map(rows.map((r) => [idToString(r.chapter_id), { answered: Number(r.answered), correct: Number(r.correct), sessions: Number(r.sessions) }]))
  }
}
