/**
 * Shared boot and data helpers of the `migrate:questions` (QLOAD) specs. A private database loaded from the `cloud-tiny`
 * fixture with seeds and `migrate:core` applied (so the curriculum id maps exist); the archive question tables are emptied and
 * each test inserts its own SYNTHETIC questions (fictitious text, no real data).
 *
 * Fixture curriculum (legacy ids): subjects 1, 2; level 1 = Darjah 1 (D1), level 2 is renamed `Tingkatan 4` (T4); chapters
 * 1 and 2 (subject 1, level 1), 3 (subject 2, level 2); topics 1 (chapter 1), 2 (chapter 2), 3 (chapter 3), 4 (chapter 1).
 */
import type pg from 'pg'

import { runCore } from '../../../src/migration/load'
import { runQuestions, type QuestionsRunOptions } from '../../../src/migration/load/questions'
import type { RunReport } from '../../../src/migration/kit/runner'
import { AS_OF, bootActivity, type ActivityHarness } from '../activity/helpers'

export { AS_OF }

export interface QuestionsHarness {
  h: ActivityHarness
  pool: pg.Pool
  runEnv: Record<string, string>
  q<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
  count(table: string, where?: string): Promise<number>
  /** The command's pipeline; `batchSize` 2 by default so a few rows span several batches. */
  run(mode: 'dry-run' | 'apply', extra?: Partial<QuestionsRunOptions>): Promise<{ report: RunReport; notes: ReadonlyMap<string, number> }>
  /** Dry-run, then apply with the same options. Returns the apply report. */
  both(extra?: Partial<QuestionsRunOptions>): Promise<{ dry: RunReport; apply: RunReport; notes: ReadonlyMap<string, number> }>
  /** Removes a previous load (rows, id map entries) and the archive rows so a test starts clean. */
  reset(): Promise<void>
  close(): Promise<void>
}

export interface ArchiveOption {
  label?: string | null
  body?: string | null
  correct?: boolean | string | null
  image?: string | null
}

export interface ArchiveQuestion {
  id: number
  status?: string
  type?: string
  subject?: number | null
  level?: number | null
  chapter?: number | null
  topic?: number | null
  difficulty?: string | null
  body?: string | null
  explanation?: string | null
  image?: string | null
  options?: ArchiveOption[]
  createdAt?: string
}

/** Four plain options A to D, the key at `correctIndex`. */
export const four = (correctIndex = 0): ArchiveOption[] =>
  ['Satu', 'Dua', 'Tiga', 'Empat'].map((body, i) => ({ label: 'ABCD'.charAt(i), body, correct: i === correctIndex }))

export async function bootQuestions(): Promise<QuestionsHarness> {
  const h = await bootActivity({ core: false })
  const pool = h.env.pool
  await pool.query(`update staging_cloud.education_levels set name_bm = 'Tingkatan 4' where id = 2`)
  const base = { pool, env: h.runEnv, source: 'cloud' as const, asOf: AS_OF, batchSize: 2 }
  for (const mode of ['dry-run', 'apply'] as const) {
    const core = await runCore({ ...base, mode })
    if (core.report.status !== 'succeeded') throw new Error(`core ${mode} did not succeed in the questions test boot`)
  }
  await pool.query(`delete from archive_cloud.question_options`)
  await pool.query(`delete from archive_cloud.questions`)

  const q = async <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> =>
    (await pool.query(sql, params)).rows as T[]
  const run: QuestionsHarness['run'] = async (mode, extra = {}) => {
    const r = await runQuestions({ pool, env: h.runEnv, source: 'cloud', asOf: AS_OF, coreAsOf: AS_OF, mode, batchSize: 2, ...extra })
    return { report: r.report, notes: r.questions.notes.counters }
  }
  return {
    h,
    pool,
    runEnv: h.runEnv,
    q,
    count: async (table, where = 'true') => Number((await q<{ n: string }>(`select count(*)::text as n from ${table} t where ${where}`))[0]?.n),
    run,
    async both(extra) {
      const dry = await run('dry-run', extra)
      if (dry.report.status !== 'succeeded') throw new Error(`questions dry-run ${dry.report.status}`)
      const apply = await run('apply', extra)
      return { dry: dry.report, apply: apply.report, notes: apply.notes }
    },
    async reset() {
      await pool.query(`delete from questions where legacy_source = 'cloud'`)
      await pool.query(`delete from etl_id_map where entity = 'questions'`)
      await pool.query(`delete from archive_cloud.question_options`)
      await pool.query(`delete from archive_cloud.questions`)
    },
    close: () => h.close(),
  }
}

/** Inserts synthetic archive rows (defaults: approved MCQ, subject 1, level 1, chapter 1, topic 1, difficulty 3, four options). */
export async function addArchive(pool: pg.Pool, questions: readonly ArchiveQuestion[]): Promise<void> {
  const has = (v: unknown, d: unknown): unknown => (v === undefined ? d : v)
  for (const x of questions) {
    await pool.query(
      `insert into archive_cloud.questions (id, subject_id, education_level_id, chapter_id, topic_id, difficulty_level, type, status, body, explanation, image_path, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamptz, $12::timestamptz)`,
      [
        x.id, has(x.subject, 1), has(x.level, 1), has(x.chapter, 1), has(x.topic, 1), has(x.difficulty, '3'), x.type ?? 'mcq',
        x.status ?? 'diluluskan', has(x.body, `Soalan contoh ${x.id}?`), has(x.explanation, null), has(x.image, null), x.createdAt ?? '2025-03-01T08:00:00Z',
      ],
    )
    for (const [i, o] of (x.options ?? four()).entries()) {
      await pool.query(
        `insert into archive_cloud.question_options (id, question_id, label, body, image_path, is_correct) values ($1, $2, $3, $4, $5, $6)`,
        [x.id * 100 + i, x.id, has(o.label, 'ABCD'.charAt(i)), has(o.body, `Pilihan ${i}`), has(o.image, null), o.correct === undefined || o.correct === null ? '0' : String(o.correct === true ? 1 : o.correct === false ? 0 : o.correct)],
      )
    }
  }
}

/** Rows of every table a loaded question touches, for "nothing changed" comparisons. */
export type QuestionTableCounts = Record<'questions' | 'question_versions' | 'question_parts' | 'part_options' | 'answer_keys' | 'question_tags', number>

export async function questionTableCounts(pool: pg.Pool): Promise<QuestionTableCounts> {
  const out = {} as QuestionTableCounts
  for (const t of ['questions', 'question_versions', 'question_parts', 'part_options', 'answer_keys', 'question_tags'] as const) {
    out[t] = Number((await pool.query<{ n: string }>(`select count(*)::text as n from ${t}`)).rows[0]?.n)
  }
  return out
}
