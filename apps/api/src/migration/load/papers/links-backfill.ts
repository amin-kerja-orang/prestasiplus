/**
 * T-B9-G link backfills (design section 12), run AFTER the question and paper loaders, through `etl_id_map`:
 *  - `exam_attempts.paper_id`: set where the V2 attempt's paper is now a loaded V3 paper and the link is still NULL (the title snapshot stays);
 *  - `question_set_items`: the items of the teacher set headers loaded as "needs rebuild" (Q4 A kept only the headers), for the questions that
 *    are now in the bank (`etl_id_map('questions')`), position by V2 `sort_order`; a set that already has items is left alone.
 * `practice_answers.question_id` is linked by `migrate:link-questions` (exact match through `etl_id_map('questions')`), not repeated here.
 * Not done: `structured_attempts` (13 rows) needs the V2 table staged first (it is not in the staging spec); `review_schedules` and open
 * `question_reports` stay out of scope (design 12). One transaction; dry-run rolls it back. Counts only.
 */
import type pg from 'pg'

import type { LegacySource, RunMode } from '../../kit/types'

export interface LinksReport {
  mode: RunMode
  examAttemptsLinked: number
  examAttemptsNoPaper: number
  setItemsInserted: number
  setsFilled: number
  itemsUnmapped: number
}

export async function backfillLinks(pool: pg.Pool, source: LegacySource, mode: RunMode): Promise<LinksReport> {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const attempts = await db.query<{ n: string }>(
      `WITH upd AS (
         UPDATE exam_attempts a SET paper_id = m.new_id::bigint
           FROM staging_cloud.exam_attempts s
           JOIN etl_id_map m ON m.legacy_source = $1 AND m.entity = 'exam_papers' AND m.legacy_id = s.exam_paper_id::text
           JOIN papers p ON p.id = m.new_id::bigint
          WHERE a.legacy_source = $1 AND a.legacy_id = s.id::text AND a.paper_id IS NULL
         RETURNING 1)
       SELECT count(*)::text AS n FROM upd`,
      [source],
    )
    const without = await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM exam_attempts WHERE legacy_source = $1 AND paper_id IS NULL`, [source])

    const sets = await db.query<{ set_id: string; v2_set: string }>(
      `SELECT m.new_id AS set_id, m.legacy_id AS v2_set FROM etl_id_map m
         JOIN question_sets s ON s.id = m.new_id::bigint
        WHERE m.legacy_source = $1 AND m.entity = 'question_sets' AND NOT EXISTS (SELECT 1 FROM question_set_items i WHERE i.question_set_id = s.id)`,
      [source],
    )
    let inserted = 0
    let filled = 0
    let unmapped = 0
    for (const s of sets.rows) {
      const items = await db.query<{ question_id: string; sort_order: string | null }>(
        `SELECT question_id::text AS question_id, sort_order::text AS sort_order FROM archive_cloud.question_set_items WHERE question_set_id = $1::bigint ORDER BY sort_order NULLS LAST, id`,
        [s.v2_set],
      )
      const mapped = await db.query<{ legacy_id: string; new_id: string }>(
        `SELECT m.legacy_id, m.new_id FROM etl_id_map m JOIN questions q ON q.id = m.new_id::bigint WHERE m.legacy_source = $1 AND m.entity = 'questions' AND m.legacy_id = ANY($2::text[])`,
        [source, items.rows.map((i) => i.question_id)],
      )
      const v3 = new Map(mapped.rows.map((r) => [r.legacy_id, r.new_id]))
      const seen = new Set<string>()
      const rows: { question_id: string; position: number }[] = []
      for (const i of items.rows) {
        const q = v3.get(i.question_id)
        if (q === undefined) {
          unmapped += 1
          continue
        }
        if (seen.has(q)) continue
        seen.add(q)
        rows.push({ question_id: q, position: rows.length + 1 })
      }
      if (rows.length === 0) continue
      await db.query(
        `INSERT INTO question_set_items (question_set_id, position, question_id, question_version_no)
         SELECT $1::bigint, x.position, x.question_id, 1 FROM jsonb_to_recordset($2::jsonb) AS x(position int, question_id bigint)`,
        [s.set_id, JSON.stringify(rows)],
      )
      inserted += rows.length
      filled += 1
    }
    await db.query(mode === 'apply' ? 'COMMIT' : 'ROLLBACK')
    return { mode, examAttemptsLinked: Number(attempts.rows[0]?.n ?? 0), examAttemptsNoPaper: Number(without.rows[0]?.n ?? 0), setItemsInserted: inserted, setsFilled: filled, itemsUnmapped: unmapped }
  } catch (e) {
    await db.query('ROLLBACK').catch(() => undefined)
    throw e
  } finally {
    db.release()
  }
}
