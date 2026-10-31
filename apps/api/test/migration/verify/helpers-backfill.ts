/**
 * Boot and data helpers of the BE-30 Part C (`linkQuestions`) DB specs. A light boot: a private migrated database
 * plus hand-inserted rows (one subject, one pupil, source papers, questions with versions, parts and options, and
 * `practice_answers`). All values are fictitious.
 */
import { createHash } from 'node:crypto'

import type pg from 'pg'

import { createStagingDb, type StagingDb } from '../staging/helpers'

export interface BackfillHarness {
  env: StagingDb
  pool: pg.Pool
  q<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
  subjectId: string
  userId: string
  addPaper(naturalKey: string | null): Promise<string>
  addQuestion(opts: QuestionOpts): Promise<string>
  addAnswer(opts?: AnswerOpts): Promise<string>
  /** Md5 of every column of every answer EXCEPT `question_id`, ordered by id: proves nothing else changed. */
  protectedFingerprint(): Promise<string>
  /** Map answer id -> question_id (text or null). */
  links(): Promise<Record<string, string | null>>
  close(): Promise<void>
}

export interface QuestionOpts {
  paperId?: string | null
  numberLabel?: string | null
  stem?: string
  options?: string[]
  /** Status of the live version. Default `published`. */
  status?: 'draft' | 'review' | 'approved' | 'approved' | 'archived'
  isActive?: boolean
  /** `questions.live_version_no`. Default 1 (null for a never-published question). */
  liveVersionNo?: number | null
}

export interface AnswerOpts {
  questionId?: string | null
  naturalKey?: string | null
  numberLabel?: string | null
  contentHash?: string | null
  legacySource?: 'cloud' | 'my' | null
  isCorrect?: boolean
}

export async function bootBackfill(): Promise<BackfillHarness> {
  const env = await createStagingDb()
  const pool = env.pool
  const q = async <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> =>
    (await pool.query(sql, params)).rows as T[]

  const subject = await q<{ id: string }>(
    `insert into subjects (code, name, name_en, color) values ('MAT', 'Matematik', 'Mathematics', '#336699') returning id::text as id`,
  )
  const user = await q<{ id: string }>(`insert into users (name) values ('Murid Contoh') returning id::text as id`)
  const subjectId = (subject[0] as { id: string }).id
  const userId = (user[0] as { id: string }).id

  let seq = 0
  return {
    env,
    pool,
    q,
    subjectId,
    userId,
    async addPaper(naturalKey) {
      const rows = await q<{ id: string }>(`insert into source_papers (natural_key) values ($1) returning id::text as id`, [naturalKey])
      return (rows[0] as { id: string }).id
    },
    async addQuestion(o) {
      const status = o.status ?? 'approved'
      const live = o.liveVersionNo === undefined ? 1 : o.liveVersionNo
      const qs = await q<{ id: string }>(
        `insert into questions (live_version_no, is_active) values ($1, $2) returning id::text as id`,
        [live, o.isActive ?? true],
      )
      const id = (qs[0] as { id: string }).id
      const v = await q<{ id: string }>(
        `insert into question_versions (question_id, version_no, status, archive_reason, published_at, type, stem_ms, number_label, source_paper_id)
         values ($1, 1, $2, $3, $4, 'mcq', $5, $6, $7) returning id::text as id`,
        [
          id,
          status,
          status === 'archived' ? 'withdrawn' : null,
          status === 'approved' ? '2026-10-01T00:00:00Z' : null,
          o.stem ?? `Soalan contoh ${(seq += 1)}`,
          o.numberLabel ?? null,
          o.paperId ?? null,
        ],
      )
      const versionId = (v[0] as { id: string }).id
      if (o.options && o.options.length > 0) {
        const part = await q<{ id: string }>(
          `insert into question_parts (question_version_id, position, depth, label, prompt_ms, marks, mode)
           values ($1, 1, 1, 'a', 'Pilih', 1, 'mcq') returning id::text as id`,
          [versionId],
        )
        const partId = (part[0] as { id: string }).id
        for (const [i, body] of o.options.entries()) {
          await q(`insert into part_options (part_id, label, body_ms, position) values ($1, $2, $3, $4)`, [
            partId,
            String.fromCharCode(65 + i),
            body,
            i + 1,
          ])
        }
      }
      return id
    },
    async addAnswer(o = {}) {
      const rows = await q<{ id: string }>(
        `insert into practice_answers
           (user_id, question_id, subject_id, difficulty, question_type, selected_label, is_correct, time_seconds, answered_at,
            historical, legacy_question_ref, legacy_content_hash, source_natural_key, number_label, legacy_source, legacy_id, legacy_hash)
         values ($1, $2, $3, 3, 'objektif', 'B', $4, 42, '2026-03-10T02:00:00Z', true, $5, $6, $7, $8, $9, $10, $11)
         returning id::text as id`,
        [
          userId,
          o.questionId ?? null,
          subjectId,
          o.isCorrect ?? true,
          `L${(seq += 1)}`,
          o.contentHash ?? null,
          o.naturalKey ?? null,
          o.numberLabel ?? null,
          o.legacySource === undefined ? 'cloud' : o.legacySource,
          `a${seq}`,
          `h${seq}`,
        ],
      )
      return (rows[0] as { id: string }).id
    },
    async protectedFingerprint() {
      const cols = await q<{ column_name: string }>(
        `select column_name from information_schema.columns
         where table_name = 'practice_answers' and table_schema = current_schema() and column_name <> 'question_id' order by ordinal_position`,
      )
      const list = cols.map((c) => `"${c.column_name}"`).join(', ')
      const rows = await q<{ r: string }>(`select row(${list})::text as r from practice_answers order by id`)
      return createHash('md5').update(rows.map((r) => r.r).join('\n')).digest('hex')
    },
    async links() {
      const rows = await q<{ id: string; question_id: string | null }>(
        `select id::text as id, question_id::text as question_id from practice_answers order by id`,
      )
      return Object.fromEntries(rows.map((r) => [r.id, r.question_id]))
    },
    close: () => env.close(),
  }
}
