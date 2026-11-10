/**
 * Steps of the structured and subjective loaders (T-B9-6): `structured_questions` (with sub-questions and rubric points) and
 * the `subjektif` rows of `questions`. One keyset page = one batch = one transaction, like `questionsStep`. The read side takes the
 * children of a page with one `= ANY` query each, so a page never holds more than a few thousand rows.
 * Counts only in the report; a reject carries a reason and a column, never a text.
 */
import type pg from 'pg'

import { ARCHIVE_SCHEMA, columnNames, findTable } from '../../ddl/spec'
import type { AnyEntityStep, BatchContext, BatchResult } from '../../kit/runner'
import { assertSurrogateLegacyId, quoteIdent } from '../../kit/sql'
import { enumKey, type Staged } from '../../transform/common'
import { rejectRow } from '../helpers'
import { insertQuestionTrees, type QuestionTreePlan } from './bank-writer'
import type { QuestionsContext } from './context'
import { transformPksk } from './pksk-plan'
import { transformStructured, transformSubjective, type LegacyRubricPoint, type LegacyStructured, type LegacySubQuestion } from './structured-plan'

const A = quoteIdent(ARCHIVE_SCHEMA)

function selectList(table: string, alias: string): string {
  const spec = findTable(table)
  if (!spec || spec.group !== 'archive') throw new RangeError(`Table "${table}" is not an archive table.`)
  return columnNames(spec).map((c) => `${alias}.${quoteIdent(c)}::text AS ${quoteIdent(c)}`).join(', ')
}

/** Staged V2 user ids that exist as migrated users, for `created_by` (mapped, else NULL). */
async function userMap(ctx: BatchContext, ids: readonly (string | null | undefined)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((x): x is string => typeof x === 'string' && /^\d{1,18}$/.test(x.trim())).map((x) => x.trim()))]
  return wanted.length === 0 ? new Map() : ctx.idMap.resolveMany('users', wanted)
}

// ---------- structured ----------

async function* readStructured(pool: pg.Pool, afterKey: string | null, pageSize: number): AsyncGenerator<LegacyStructured> {
  const parents = `SELECT ${selectList('structured_questions', 'q')} FROM ${A}."structured_questions" q WHERE ($1::bigint IS NULL OR q."id" > $1::bigint) ORDER BY q."id" LIMIT $2`
  const subsSql = `SELECT ${selectList('structured_sub_questions', 's')} FROM ${A}."structured_sub_questions" s WHERE s."structured_question_id" = ANY($1::bigint[]) ORDER BY s."structured_question_id", s."id"`
  const rubricSql = `SELECT ${selectList('structured_rubric_points', 'r')} FROM ${A}."structured_rubric_points" r WHERE r."structured_sub_question_id" = ANY($1::bigint[]) ORDER BY r."structured_sub_question_id", r."position", r."id"`
  let after = afterKey
  for (;;) {
    const page = await pool.query<Record<string, string | null>>(parents, [after, pageSize])
    const ids = page.rows.map((r) => r.id as string)
    const subsBy = new Map<string, Record<string, string | null>[]>()
    const rubricBy = new Map<string, LegacyRubricPoint[]>()
    if (ids.length > 0) {
      const subs = await pool.query<Record<string, string | null>>(subsSql, [ids])
      for (const s of subs.rows) {
        const key = s.structured_question_id as string
        subsBy.set(key, [...(subsBy.get(key) ?? []), s])
      }
      const subIds = subs.rows.map((s) => s.id as string)
      if (subIds.length > 0) {
        const rubric = await pool.query<Record<string, string | null>>(rubricSql, [subIds])
        for (const r of rubric.rows) {
          const key = r.structured_sub_question_id as string
          rubricBy.set(key, [...(rubricBy.get(key) ?? []), r as unknown as LegacyRubricPoint])
        }
      }
    }
    for (const row of page.rows) {
      const subs = (subsBy.get(row.id as string) ?? []).map((s) => ({ ...s, rubric: rubricBy.get(s.id as string) ?? [] }) as unknown as LegacySubQuestion)
      yield { ...row, subs } as unknown as LegacyStructured
    }
    if (page.rows.length < pageSize) return
    after = page.rows[page.rows.length - 1]?.id ?? null
  }
}

export function structuredStep(q: QuestionsContext): AnyEntityStep {
  const entity = 'structured_questions'
  return {
    entity,
    source: q.source,
    extract: (after) => readStructured(q.pool, after, q.pageSize),
    keyOf: (r: LegacyStructured) => r.id ?? '',
    async load(rows: LegacyStructured[], ctx: BatchContext): Promise<BatchResult> {
      const cur = await q.curriculum()
      const users = await userMap(ctx, rows.map((r) => r.created_by))
      const plans: QuestionTreePlan[] = []
      for (const row of rows) {
        assertSurrogateLegacyId(row.id ?? '', 'migrate:structured')
        const out = transformStructured(row, cur, users)
        if (!out.ok) rejectRow(ctx, entity, row.id ?? '', out.reject)
        else plans.push(out.value)
      }
      const { fresh } = await insertQuestionTrees(ctx, plans)
      for (const p of fresh) for (const n of p.notes) q.notes.count(`structured.${n}`)
      for (const p of fresh) q.notes.count(`structured.status.${p.status}`)
      return { inserted: fresh.length, unchanged: plans.length - fresh.length }
    },
  }
}

// ---------- subjective ----------

const SUBJECTIVE = new Set(['subjektif', 'subjective'])

async function* readSubjective(pool: pg.Pool, afterKey: string | null, pageSize: number): AsyncGenerator<Staged> {
  const sql = `SELECT ${selectList('questions', 'q')} FROM ${A}."questions" q
    WHERE ($1::bigint IS NULL OR q."id" > $1::bigint) AND lower(btrim(q."type")) = ANY($3::text[]) ORDER BY q."id" LIMIT $2`
  let after = afterKey
  for (;;) {
    const page = await pool.query<Record<string, string | null>>(sql, [after, pageSize, [...SUBJECTIVE]])
    for (const row of page.rows) yield row
    if (page.rows.length < pageSize) return
    after = page.rows[page.rows.length - 1]?.id ?? null
  }
}

export function subjectiveStep(q: QuestionsContext): AnyEntityStep {
  const entity = 'subjective_questions'
  return {
    entity,
    source: q.source,
    extract: (after) => readSubjective(q.pool, after, q.pageSize),
    keyOf: (r: Staged) => r.id ?? '',
    async load(rows: Staged[], ctx: BatchContext): Promise<BatchResult> {
      const cur = await q.curriculum()
      const users = await userMap(ctx, rows.map((r) => r.created_by))
      const plans: QuestionTreePlan[] = []
      for (const row of rows) {
        assertSurrogateLegacyId(row.id ?? '', 'migrate:structured')
        if (!SUBJECTIVE.has(enumKey(row.type) ?? '')) continue
        const out = transformSubjective(row, cur, users)
        if (!out.ok) rejectRow(ctx, entity, row.id ?? '', out.reject)
        else plans.push(out.value)
      }
      const { fresh } = await insertQuestionTrees(ctx, plans)
      for (const p of fresh) for (const n of p.notes) q.notes.count(`subjective.${n}`)
      for (const p of fresh) q.notes.count(`subjective.status.${p.status}`)
      return { inserted: fresh.length, unchanged: plans.length - fresh.length }
    },
  }
}

// ---------- PKSK (OC-4) ----------

async function* readPksk(pool: pg.Pool, afterKey: string | null, pageSize: number): AsyncGenerator<Staged> {
  const sql = `SELECT ${selectList('pksk_questions', 'q')} FROM ${A}."pksk_questions" q WHERE ($1::bigint IS NULL OR q."id" > $1::bigint) ORDER BY q."id" LIMIT $2`
  let after = afterKey
  for (;;) {
    const page = await pool.query<Record<string, string | null>>(sql, [after, pageSize])
    for (const row of page.rows) yield row
    if (page.rows.length < pageSize) return
    after = page.rows[page.rows.length - 1]?.id ?? null
  }
}

/**
 * `pksk_questions` (body only in V2) become DRAFT PKSK questions an admin completes in "Soalan PKSK" (see `pksk-plan.ts`). They have no
 * `questions.legacy_id` (the V2 ids would clash with the MCQ ids): the id-map entity `pksk_questions` is the link.
 */
export function pkskStep(q: QuestionsContext): AnyEntityStep {
  const entity = 'pksk_questions'
  return {
    entity,
    source: q.source,
    extract: (after) => readPksk(q.pool, after, q.pageSize),
    keyOf: (r: Staged) => r.id ?? '',
    async load(rows: Staged[], ctx: BatchContext): Promise<BatchResult> {
      const cur = await q.curriculum()
      const plans: QuestionTreePlan[] = []
      for (const row of rows) {
        assertSurrogateLegacyId(row.id ?? '', 'migrate:structured')
        const out = transformPksk(row, cur)
        if (!out.ok) rejectRow(ctx, entity, row.id ?? '', out.reject)
        else plans.push(out.value)
      }
      const { fresh } = await insertQuestionTrees(ctx, plans)
      for (const p of fresh) for (const n of p.notes) q.notes.count(`pksk.${n}`)
      return { inserted: fresh.length, unchanged: plans.length - fresh.length }
    },
  }
}
