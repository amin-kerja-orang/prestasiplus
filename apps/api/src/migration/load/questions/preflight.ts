/**
 * Preflight of `migrate:questions`: refuses (dry-run too) unless `migrate:core --apply` succeeded on the staged data now in
 * the database (its id maps give the subject, level, chapter and topic ids) and the archive carries the columns the loader reads.
 */
import type pg from 'pg'

import { ARCHIVE_SCHEMA } from '../../ddl/spec'
import type { LegacySource } from '../../kit/types'
import { assertCorePreflight, PreflightError, RUN_CORE_FIRST } from '../activity/preflight'

const NEEDED: Record<string, readonly string[]> = {
  questions: ['id', 'subject_id', 'education_level_id', 'chapter_id', 'topic_id', 'difficulty_level', 'type', 'status', 'body', 'explanation', 'image_path', 'created_at', 'updated_at'],
  question_options: ['id', 'question_id', 'label', 'body', 'is_correct'],
}

export async function assertQuestionsPreflight(options: {
  pool: Pick<pg.Pool, 'query'>
  env: Readonly<Record<string, string | undefined>>
  source: LegacySource
  asOf: string
  coreAsOf?: string
}): Promise<void> {
  const { pool, source } = options
  await assertCorePreflight({ pool, env: options.env, source, asOf: options.asOf, coreAsOf: options.coreAsOf })
  for (const entity of ['subjects', 'education_levels', 'chapters']) {
    const res = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM etl_id_map WHERE legacy_source = $1 AND entity = $2`, [source, entity])
    if (Number(res.rows[0]?.n ?? 0) === 0) throw new PreflightError(`Preflight failed: no migrated ${entity} in etl_id_map. ${RUN_CORE_FIRST}.`)
  }
  for (const [table, columns] of Object.entries(NEEDED)) {
    const res = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
      [ARCHIVE_SCHEMA, table],
    )
    const have = new Set(res.rows.map((r) => r.column_name))
    if (have.size === 0) throw new PreflightError(`Preflight failed: ${ARCHIVE_SCHEMA}.${table} is not loaded. Run staging:load first.`)
    const missing = columns.filter((c) => !have.has(c))
    if (missing.length > 0) {
      throw new PreflightError(`Preflight failed: ${ARCHIVE_SCHEMA}.${table} lacks column(s) ${missing.join(', ')}: re-stage with the current spec (staging:load).`)
    }
  }
}
