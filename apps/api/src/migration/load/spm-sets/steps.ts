/**
 * `spm_sets` (60) and `spm_set_question` (1,744) -> `spm_tracking_sets` / `spm_tracking_set_questions` (T-B10-1, design 10.2, INV-26).
 *
 *  - subject through the `subjects` id map (missing: ORPHAN_PARENT); only `ramalan` and `past_year` sets load (a blank kind is V2's default
 *    `ramalan`; any other kind is left out and counted);
 *  - natural key `(subject, year, set_no)`: an existing V3 set is "unchanged" (members are added only when it has none);
 *    a second V2 set with the same natural key (another kind) is a DUPLICATE_KEY reject;
 *  - members through the `questions` id map; an unmapped member, a member whose subject differs from the set's, and a member already in
 *    another set of the same subject and year (INV-26) are dropped and counted; positions are renumbered 1..n in V2 order
 *    (`position`, NULL last, then question id);
 *  - `kind`, `target_count` and `notes` have no V3 column (counted / dropped); `dskp_tagged` stays 0 (computed on read).
 */
import type pg from 'pg'

import { ARCHIVE_SCHEMA } from '../../ddl/spec'
import type { AnyEntityStep, BatchContext, BatchResult } from '../../kit/runner'
import { assertSurrogateLegacyId, quoteIdent } from '../../kit/sql'
import { enumKey, ok, reject, text, type Outcome, type Staged } from '../../transform/common'
import { rejectRow } from '../helpers'
import { distinctValues } from '../source'
import { readArchiveById, type ArchiveRow } from '../papers/archive-source'
import type { QuestionsContext } from '../questions/context'


export const LOADED_KINDS: ReadonlySet<string> = new Set(['ramalan', 'past_year'])

export interface SetMember {
  question_id: string | null
  position: string | null
}
export interface SetPlan {
  legacyId: string
  subject_id: string
  year: number
  set_no: number
}

const intOf = (v: string | null | undefined, min: number): number | null => {
  const t = text(v)
  if (t === null || !/^\d{1,6}$/.test(t)) return null
  const n = Number(t)
  return n >= min ? n : null
}

/** The set row as a plan, or the reject; `kind` is checked by the caller (an excluded kind is not a reject). */
export function planSet(row: Staged, subjects: ReadonlyMap<string, string>): Outcome<SetPlan> {
  const subjectRef = text(row.subject_id)
  const subject = subjectRef === null ? undefined : subjects.get(subjectRef)
  if (subject === undefined) return reject('ORPHAN_PARENT', 'subject_id')
  const year = intOf(row.year, 1)
  if (year === null) return reject('INVALID_VALUE', 'year')
  const setNo = intOf(row.set_number, 1)
  if (setNo === null) return reject('INVALID_VALUE', 'set_number')
  return ok({ legacyId: (row.id ?? '').trim(), subject_id: subject, year, set_no: setNo })
}

/** Members in V2 order: `position` ascending (NULL last), then the question id. */
export function orderedMembers(members: readonly SetMember[]): SetMember[] {
  return [...members].sort((a, b) => {
    const pa = intOf(a.position, 0)
    const pb = intOf(b.position, 0)
    if (pa !== pb) return pa === null ? 1 : pb === null ? -1 : pa - pb
    return Number(a.question_id) - Number(b.question_id)
  })
}

const A = quoteIdent(ARCHIVE_SCHEMA)

async function membersOf(pool: pg.Pool, setIds: readonly string[]): Promise<Map<string, SetMember[]>> {
  const by = new Map<string, SetMember[]>()
  if (setIds.length === 0) return by
  const res = await pool.query<{ spm_set_id: string; question_id: string | null; position: string | null }>(
    `SELECT "spm_set_id"::text AS spm_set_id, "question_id"::text AS question_id, "position"::text AS position FROM ${A}."spm_set_question" WHERE "spm_set_id" = ANY($1::bigint[])`,
    [setIds],
  )
  for (const r of res.rows) by.set(r.spm_set_id, [...(by.get(r.spm_set_id) ?? []), { question_id: r.question_id, position: r.position }])
  return by
}

export function spmSetsStep(c: QuestionsContext): AnyEntityStep {
  const entity = 'spm_sets'
  return {
    entity,
    source: c.source,
    extract: (after) => readArchiveById(c.pool, 'spm_sets', after, c.pageSize),
    keyOf: (r: ArchiveRow) => r.id ?? '',
    async load(rows: ArchiveRow[], ctx: BatchContext): Promise<BatchResult> {
      const subjects = await ctx.idMap.resolveMany('subjects', distinctValues(rows, 'subject_id'))
      const members = await membersOf(c.pool, rows.map((r) => r.id ?? ''))
      let inserted = 0
      let unchanged = 0
      let excluded = 0
      for (const row of rows) {
        const legacyId = row.id ?? ''
        assertSurrogateLegacyId(legacyId, 'migrate:papers')
        const kind = enumKey(row.kind) ?? 'ramalan'
        if (!LOADED_KINDS.has(kind)) {
          excluded += 1
          c.notes.count(`spm_sets.kind_not_loaded.${/^[a-z_]{1,24}$/.test(kind) ? kind : 'other'}`)
          continue
        }
        const out = planSet(row, subjects)
        if (!out.ok) {
          rejectRow(ctx, entity, legacyId, out.reject)
          continue
        }
        const plan = out.value
        // Natural-key upsert: a conflict is the same set when this V2 id (or no V2 id) owns it, a DUPLICATE_KEY when another V2 id does.
        const made = await ctx.db.query<{ id: string }>(
          `INSERT INTO spm_tracking_sets (subject_id, year, set_no, dskp_tagged) VALUES ($1::bigint, $2, $3, 0)
           ON CONFLICT (subject_id, year, set_no) DO NOTHING RETURNING id::text AS id`,
          [plan.subject_id, plan.year, plan.set_no],
        )
        let setId = made.rows[0]?.id
        const isNew = setId !== undefined
        if (setId === undefined) {
          const have = await ctx.db.query<{ id: string }>(`SELECT id::text AS id FROM spm_tracking_sets WHERE subject_id = $1::bigint AND year = $2 AND set_no = $3`, [plan.subject_id, plan.year, plan.set_no])
          setId = have.rows[0]?.id as string
          const owner = await ctx.db.query<{ legacy_id: string }>(
            `SELECT legacy_id FROM etl_id_map WHERE legacy_source = $1 AND entity = $2 AND new_id = $3`,
            [ctx.source, entity, setId],
          )
          if (owner.rows.length > 0 && !owner.rows.some((o) => o.legacy_id === legacyId)) {
            rejectRow(ctx, entity, legacyId, { reason: 'DUPLICATE_KEY', column: 'set_number' })
            c.notes.count('spm_sets.duplicate_natural_key')
            continue
          }
        }
        await ctx.idMap.register(entity, legacyId, setId)
        if (isNew) inserted += 1
        else unchanged += 1
        const existing = await ctx.db.query<{ n: string }>(`SELECT count(*)::text AS n FROM spm_tracking_set_questions WHERE set_id = $1::bigint`, [setId])
        if (Number(existing.rows[0]?.n ?? 0) > 0) continue
        await writeMembers(c, ctx, setId, plan, orderedMembers(members.get(legacyId) ?? []))
      }
      return { inserted, unchanged, excluded }
    },
  }
}

async function writeMembers(c: QuestionsContext, ctx: BatchContext, setId: string, plan: SetPlan, ordered: readonly SetMember[]): Promise<void> {
  const mapped = await ctx.idMap.resolveMany('questions', ordered.map((m) => m.question_id ?? ''))
  const subjectOf = new Map<string, string | null>()
  const ids = [...mapped.values()]
  if (ids.length > 0) {
    const res = await ctx.db.query<{ id: string; subject_id: string | null }>(
      `SELECT q.id::text AS id, v.subject_id::text AS subject_id FROM questions q
         JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no WHERE q.id = ANY($1::bigint[])`,
      [ids],
    )
    for (const r of res.rows) subjectOf.set(r.id, r.subject_id)
  }
  const taken = new Set<string>()
  if (ids.length > 0) {
    const res = await ctx.db.query<{ question_id: string }>(
      `SELECT question_id::text AS question_id FROM spm_tracking_set_questions WHERE subject_id = $1::bigint AND year = $2 AND question_id = ANY($3::bigint[])`,
      [plan.subject_id, plan.year, ids],
    )
    for (const r of res.rows) taken.add(r.question_id)
  }
  const rows: { question_id: string; position: number }[] = []
  const seen = new Set<string>()
  for (const m of ordered) {
    const v3 = m.question_id === null ? undefined : mapped.get(m.question_id)
    if (v3 === undefined) {
      c.notes.count('spm_sets.member_unmapped')
      continue
    }
    if (subjectOf.get(v3) !== plan.subject_id) {
      c.notes.count('spm_sets.member_subject_mismatch')
      continue
    }
    if (taken.has(v3) || seen.has(v3)) {
      c.notes.count('spm_sets.member_inv26_duplicate')
      continue
    }
    seen.add(v3)
    rows.push({ question_id: v3, position: rows.length + 1 })
  }
  if (rows.length === 0) return
  await ctx.db.query(
    `INSERT INTO spm_tracking_set_questions (set_id, question_id, position, subject_id, year)
     SELECT $1::bigint, x.question_id, x.position, $2::bigint, $3 FROM jsonb_to_recordset($4::jsonb) AS x(question_id bigint, position int)`,
    [setId, plan.subject_id, plan.year, JSON.stringify(rows)],
  )
  c.notes.count('spm_sets.members_loaded', rows.length)
}
