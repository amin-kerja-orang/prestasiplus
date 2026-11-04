/**
 * The single answer store write path (S5-T15, DM-44, 60 section 2.17.5): `AnswerLogPort.record` is the one writer of
 * `practice_answers` for every R1 activity (the two legacy direct writers in `practice.repository.ts` are the
 * allow-list of `answer-store-writers.spec.ts` until they move here). Idempotency key: (attempt_id, user_id,
 * question_id, coalesce(part_ref, '')), the partial unique index of migration 0181; a second `record` with the same
 * key updates the row and returns `created: false`.
 *
 * The SQL and the validation are exported functions (`validateAnswerEntry`, `upsertAnswerRow`) so the Bijak backfill
 * script reuses the same statement.
 */
import { Inject, Injectable, Logger } from '@nestjs/common'

import type { TxClient } from '../../db/client'
import { idFromString, isIdString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { PracticePorts, type PracticeQuestion, versionKey } from './ports'

/** The 19 values of the registry (OPT-MODE-SESI, check `ck_practice_answers_mode`). */
export const ANSWER_MODES = [
  'random',
  'chapter',
  'revision',
  'past_year',
  'latih_tubi',
  'ramalan',
  'mission',
  'remedial',
  'question_set',
  'pksk',
  'databank',
  'kuiz',
  'simulasi',
  'tracking_a',
  'subjektif',
  'structured',
  'battle',
  'audio_kbat',
  'game',
] as const
export type AnswerMode = (typeof ANSWER_MODES)[number]

const LEGACY_ANSWER_MODES: readonly AnswerMode[] = ['past_year', 'ramalan', 'random']

/** The 16 values an R1 screen may write (the 3 legacy values are read-only, D-T10-2). */
export const WRITABLE_ANSWER_MODES = ANSWER_MODES.filter((m) => !LEGACY_ANSWER_MODES.includes(m)) as unknown as readonly Exclude<
  AnswerMode,
  'past_year' | 'ramalan' | 'random'
>[]
export type WritableAnswerMode = (typeof WRITABLE_ANSWER_MODES)[number]

/** The entry of `record`: exactly the 10 fields of 60 section 2.17.5. */
export interface AnswerLogEntry {
  /** Decimal-string user id. */
  userId: string
  /** uuid of the activity instance (exam attempt, practice session, battle/game uuid). */
  attemptId: string
  /** Decimal-string question id. */
  questionId: string
  /** Leaf path of a structured/subjective part, `<game_key>#<position>` for games, else null. */
  partRef: string | null
  mode: WritableAnswerMode
  isCorrect: boolean
  /** Null while a part awaits self-marking. */
  marksAwarded: number | null
  /** 1 for an MCQ leaf, the leaf marks otherwise. */
  marksMax: number
  answeredAt: Date
  /** True in Mod Pelajar (INV-30); the caller sets it, the port never infers it. */
  isTest: boolean
}

/** A fully resolved row (entry plus the dimensions of the served version) as written. */
export interface AnswerRow {
  userId: string
  attemptId: string
  /** Set when `attemptId` is a practice session id of this user. */
  sessionId: string | null
  questionId: string
  questionVersionNo: number | null
  partRef: string | null
  mode: AnswerMode
  subjectId: string | null
  educationLevelId: string | null
  chapterId: string | null
  topicId: string | null
  difficulty: number | null
  questionType: string | null
  isCorrect: boolean
  marksAwarded: number | null
  marksMax: number | null
  answeredAt: Date
  isTest: boolean
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Throws a clear Error for an entry the port refuses (before any database access). */
export function validateAnswerEntry(entry: AnswerLogEntry): void {
  if (!(WRITABLE_ANSWER_MODES as readonly string[]).includes(entry.mode)) {
    throw new Error(`AnswerLogPort: mode '${String(entry.mode)}' is not writable (legacy or unknown)`)
  }
  if (typeof entry.attemptId !== 'string' || !UUID.test(entry.attemptId)) throw new Error('AnswerLogPort: attemptId must be a uuid')
  if (typeof entry.userId !== 'string' || !isIdString(entry.userId)) throw new Error('AnswerLogPort: userId must be a decimal id')
  if (typeof entry.questionId !== 'string' || !isIdString(entry.questionId)) throw new Error('AnswerLogPort: questionId must be a decimal id')
  if (!Number.isFinite(entry.marksMax) || entry.marksMax <= 0) throw new Error('AnswerLogPort: marksMax must be greater than 0')
  if (entry.marksAwarded !== null) {
    if (!Number.isFinite(entry.marksAwarded) || entry.marksAwarded < 0) throw new Error('AnswerLogPort: marksAwarded must be 0 or more')
    if (entry.marksAwarded > entry.marksMax) throw new Error('AnswerLogPort: marksAwarded is above marksMax')
  }
  // A marked part is correct only when marksAwarded = marksMax; a part still waiting for a mark is not correct.
  const correct = entry.marksAwarded !== null && entry.marksAwarded === entry.marksMax
  if (entry.isCorrect !== correct) throw new Error('AnswerLogPort: isCorrect must be true exactly when marksAwarded equals marksMax (false while marksAwarded is null)')
  if (!(entry.answeredAt instanceof Date) || Number.isNaN(entry.answeredAt.getTime())) throw new Error('AnswerLogPort: answeredAt must be a valid date')
}

/**
 * The one INSERT ... ON CONFLICT statement. `db` is any Prisma client (a transaction client joins the caller's
 * transaction). Returns the row id and whether it was inserted (`xmax = 0`) or updated.
 */
export async function upsertAnswerRow(db: Pick<TxClient, '$queryRaw'>, row: AnswerRow): Promise<{ id: string; created: boolean }> {
  const rows = await db.$queryRaw<{ id: string; created: boolean }[]>`
    INSERT INTO practice_answers (
      session_id, attempt_id, user_id, question_id, question_version_no, part_ref, mode,
      subject_id, education_level_id, chapter_id, topic_id, difficulty, question_type,
      is_correct, marks_awarded, marks_max, answered_at, is_test, historical)
    VALUES (
      ${row.sessionId}::uuid, ${row.attemptId}::uuid, ${idFromString(row.userId)}::bigint, ${idFromString(row.questionId)}::bigint,
      ${row.questionVersionNo}::int, ${row.partRef}::text, ${row.mode}::text,
      ${row.subjectId === null ? null : idFromString(row.subjectId)}::bigint,
      ${row.educationLevelId === null ? null : idFromString(row.educationLevelId)}::bigint,
      ${row.chapterId === null ? null : idFromString(row.chapterId)}::bigint,
      ${row.topicId === null ? null : idFromString(row.topicId)}::bigint,
      ${row.difficulty}::smallint, ${row.questionType}::text,
      ${row.isCorrect}::boolean, ${row.marksAwarded}::numeric, ${row.marksMax}::numeric,
      ${row.answeredAt}::timestamptz, ${row.isTest}::boolean, false)
    ON CONFLICT (attempt_id, user_id, question_id, (coalesce(part_ref, ''))) WHERE attempt_id IS NOT NULL
    DO UPDATE SET
      session_id = coalesce(EXCLUDED.session_id, practice_answers.session_id),
      question_version_no = EXCLUDED.question_version_no,
      mode = EXCLUDED.mode,
      subject_id = EXCLUDED.subject_id,
      education_level_id = EXCLUDED.education_level_id,
      chapter_id = EXCLUDED.chapter_id,
      topic_id = EXCLUDED.topic_id,
      difficulty = EXCLUDED.difficulty,
      question_type = EXCLUDED.question_type,
      is_correct = EXCLUDED.is_correct,
      marks_awarded = EXCLUDED.marks_awarded,
      marks_max = EXCLUDED.marks_max,
      answered_at = EXCLUDED.answered_at,
      is_test = EXCLUDED.is_test
    RETURNING id::text, (xmax = 0) AS created`
  const out = rows[0]
  if (!out) throw new Error('AnswerLogPort: the upsert returned no row')
  return { id: out.id, created: out.created }
}

@Injectable()
export class AnswerLogPort {
  private readonly logger = new Logger(AnswerLogPort.name)

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PracticePorts) private readonly ports: PracticePorts,
  ) {}

  /** Writes or updates the answer row of `entry` (idempotent on the DM-44 key). Joins the caller's transaction. */
  async record(entry: AnswerLogEntry): Promise<{ id: string; created: boolean }> {
    validateAnswerEntry(entry)
    const db = this.prisma.client
    const userId = idFromString(entry.userId)

    // A drill's attempt id is its session id: also fill session_id (only for the pupil's own session).
    const own = await db.$queryRaw<{ id: string }[]>`
      SELECT id::text FROM practice_sessions WHERE id = ${entry.attemptId}::uuid AND user_id = ${userId}::bigint`
    const sessionId = own[0]?.id ?? null

    const served = await this.servedVersion(entry.questionId, sessionId)
    // No question from the bridge: the row is still written, without dimensions. No user id in the log line.
    if (served.question === null) this.logger.warn(`Answer written without question dimensions: question ${entry.questionId}, mode ${entry.mode}`)
    return upsertAnswerRow(db, {
      userId: entry.userId,
      attemptId: entry.attemptId,
      sessionId,
      questionId: entry.questionId,
      questionVersionNo: served.versionNo,
      partRef: entry.partRef === '' ? null : entry.partRef,
      mode: entry.mode,
      subjectId: served.question?.subjectId ?? null,
      educationLevelId: served.question?.educationLevelId ?? null,
      chapterId: served.question?.chapterId ?? null,
      topicId: served.question?.topicId ?? null,
      difficulty: served.question?.difficulty ?? null,
      questionType: served.question?.questionType ?? null,
      isCorrect: entry.isCorrect,
      marksAwarded: entry.marksAwarded,
      marksMax: entry.marksMax,
      answeredAt: entry.answeredAt,
      isTest: entry.isTest,
    })
  }

  /**
   * The version the pupil was served: `versionNo` when the caller knows it, else the one the session served
   * (`practice_session_questions`), else the question's current version. Read through the question bridge.
   * An unknown question (not eligible now, no bridge) gives no dimensions and no version number.
   */
  private async servedVersion(
    questionId: string,
    sessionId: string | null,
    versionNo?: number,
  ): Promise<{ versionNo: number | null; question: PracticeQuestion | null }> {
    let no = versionNo ?? null
    if (no === null && sessionId !== null) {
      const rows = await this.prisma.client.$queryRaw<{ v: number }[]>`
        SELECT question_version_no AS v FROM practice_session_questions
         WHERE session_id = ${sessionId}::uuid AND question_id = ${idFromString(questionId)}::bigint`
      no = rows[0]?.v ?? null
    }
    if (no !== null) {
      const found = await this.ports.questions.versions([{ questionId, versionNo: no }])
      return { versionNo: no, question: found.get(versionKey(questionId, no)) ?? null }
    }
    const live = (await this.ports.questions.live([questionId])).get(questionId) ?? null
    return { versionNo: live?.versionNo ?? null, question: live }
  }
}
