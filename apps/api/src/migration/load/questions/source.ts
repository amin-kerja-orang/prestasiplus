/**
 * Read side of `migrate:questions`: keyset pages over `archive_cloud.questions` and, per page, ONE options query with
 * `= ANY` for the in-scope questions. Never a whole subject in memory: one page at a time. Read through the pool (the
 * archive is immutable), every column as text like `load/source.ts`.
 */
import type pg from 'pg'

import { ARCHIVE_SCHEMA, columnNames, findTable } from '../../ddl/spec'
import { quoteIdent } from '../../kit/sql'
import { exclusionOf, type LegacyOption, type LegacyQuestion } from '../../transform/question-bank'

const A = quoteIdent(ARCHIVE_SCHEMA)

function selectList(table: string, alias: string): string {
  const spec = findTable(table)
  if (!spec || spec.group !== 'archive') throw new RangeError(`Table "${table}" is not an archive table.`)
  return columnNames(spec).map((c) => `${alias}.${quoteIdent(c)}::text AS ${quoteIdent(c)}`).join(', ')
}

const QUESTIONS_SQL = `SELECT ${selectList('questions', 'q')} FROM ${A}."questions" q
  WHERE ($1::bigint IS NULL OR q."id" > $1::bigint) ORDER BY q."id" LIMIT $2`

const OPTIONS_SQL = `SELECT o."id"::text AS id, o."question_id"::text AS question_id, o."label"::text AS label, o."body"::text AS body,
  o."is_correct"::text AS is_correct
  FROM ${A}."question_options" o WHERE o."question_id" = ANY($1::bigint[]) ORDER BY o."question_id", o."id"`

export async function* readQuestions(pool: pg.Pool, afterKey: string | null, pageSize: number): AsyncGenerator<LegacyQuestion> {
  let after = afterKey
  for (;;) {
    const page = await pool.query<Record<string, string | null>>(QUESTIONS_SQL, [after, pageSize])
    const wanted = page.rows.filter((r) => exclusionOf(r) === null).map((r) => r.id as string)
    const byQuestion = new Map<string, LegacyOption[]>()
    if (wanted.length > 0) {
      const res = await pool.query<LegacyOption & { question_id: string }>(OPTIONS_SQL, [wanted])
      for (const o of res.rows) {
        const list = byQuestion.get(o.question_id)
        if (list) list.push(o)
        else byQuestion.set(o.question_id, [o])
      }
    }
    for (const row of page.rows) yield { ...row, options: byQuestion.get(row.id as string) ?? [] } as unknown as LegacyQuestion
    if (page.rows.length < pageSize) return
    after = page.rows[page.rows.length - 1]?.id ?? null
  }
}
