/**
 * Quarantine of `migrate:questions` (T-B9-2, design 5.1): a row that the repair rules cannot make into a valid question is NOT loaded and NOT lost.
 * `etl_rejects` keeps the row (reason and cause column, as for every entity) and this module writes `rejects-questions-<run>.csv`: ids and enum codes only,
 * never a question text. The rows stay in `archive_cloud`; an admin re-creates one in the Studio from the CSV, or V2 data is fixed upstream and re-run.
 *
 * What is repaired instead of quarantined is in `transform/question-bank.ts` (2 options load, positional relabel, empty stem with an image, any status,
 * two or more correct options as `mcq_multi`); the rajah carrier rows are absorbed by the planner (`plan.ts`).
 */
import type pg from 'pg'

import { ARCHIVE_SCHEMA } from '../../ddl/spec'
import { quoteIdent } from '../../kit/sql'

export interface QuarantineRow {
  id: string
  status: string
  subject: string
  level: string
  reason: string
  column: string
}

const code = (v: string | null): string => (v !== null && /^[a-z0-9_]{1,32}$/i.test(v) ? v.toLowerCase() : v === null ? '' : 'other')
const plain = (v: string | null): string => (v !== null && /^[A-Za-z0-9_.-]{1,24}$/.test(v) ? v : v === null ? '' : 'other')

/** The rejects of one run of the `questions` entity, with the V2 status, the subject code and the level code of the row (all codes, no text). */
export async function quarantineRows(pool: Pick<pg.Pool, 'query'>, runId: string): Promise<QuarantineRow[]> {
  const res = await pool.query<{ id: string; status: string | null; subject: string | null; level: string | null; reason: string; column_name: string | null }>(
    `SELECT r.legacy_id AS id, q."status" AS status, sb.code AS subject, el.code AS level, r.reason, r.column_name
       FROM etl_rejects r
       LEFT JOIN ${quoteIdent(ARCHIVE_SCHEMA)}."questions" q ON q."id"::text = r.legacy_id
       LEFT JOIN etl_id_map sm ON sm.legacy_source = 'cloud' AND sm.entity = 'subjects' AND sm.legacy_id = q."subject_id"::text
       LEFT JOIN subjects sb ON sb.id = sm.new_id::bigint
       LEFT JOIN etl_id_map im ON im.legacy_source = 'cloud' AND im.entity = 'education_levels' AND im.legacy_id = q."education_level_id"::text
       LEFT JOIN education_levels el ON el.id = im.new_id::bigint
      WHERE r.run_id = $1::bigint AND r.entity = 'questions'
      ORDER BY r.id`,
    [runId],
  )
  return res.rows.map((r) => ({ id: r.id ?? '', status: code(r.status), subject: plain(r.subject), level: plain(r.level), reason: r.reason, column: r.column_name ?? '' }))
}

export const QUARANTINE_HEADER = 'v2_question_id,v2_status,subject_code,level_code,reason,cause'

export function quarantineCsv(rows: readonly QuarantineRow[]): string {
  return `${[QUARANTINE_HEADER, ...rows.map((r) => [r.id, r.status, r.subject, r.level, r.reason, r.column].join(','))].join('\n')}\n`
}
