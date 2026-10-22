/**
 * Question-set step of `migrate:activity` (BE-29): teacher question-set HEADERS as "needs rebuild" (LEAD OD-10 Q4 A,
 * half AZ's AZ-31 / PR #135). Each header is written with no class, `needs_rebuild = true`, status `draft` and the legacy
 * keys (the kit writes `legacy_source` / `legacy_id`; the check needs them). The items are NOT migrated (Q4): the step
 * only counts the staged items of the loaded headers (`question_sets.items_not_migrated`, counts only).
 *
 * A row whose teacher is blank, unmapped or not a teacher in v2 is rejected, never given an invented owner.
 * A header that a teacher already rebuilt in v2 (same legacy key, `needs_rebuild = false`) is left alone and counted
 * `question_sets.already_rebuilt`: a re-run must not put the class back to NULL.
 *
 * `question_sets.items_not_migrated` counts only the headers loaded in THIS run: a rebuilt set is filtered out first, so
 * the counter can drop on a later run (it is not a lifetime total).
 */
import { ARCHIVE_SCHEMA } from '../../ddl/spec'
import type { AnyEntityStep, BatchContext, BatchResult } from '../../kit/runner'
import { assertSurrogateLegacyId, quoteIdent } from '../../kit/sql'
import type { LegacyRow } from '../../kit/upsert'
import { transformQuestionSet } from '../../transform/question-sets'
import { rejectRow, upsertAndMap } from '../helpers'
import { distinctValues, readById, type StagedRow } from '../source'
import { lookup } from './catalogue-steps'
import type { ActivityContext } from './context'

const idOf = (row: StagedRow): string => {
  const id = row.id ?? ''
  assertSurrogateLegacyId(id, 'migrate:activity')
  return id
}

/** The v2 user ids (text) in `userIds` that hold the teacher role. */
async function teacherUsers(ctx: BatchContext, userIds: readonly string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set()
  const res = await ctx.db.query<{ id: string }>(
    `SELECT DISTINCT user_id::text AS id FROM user_roles WHERE role = 'teacher' AND user_id = ANY($1::bigint[])`,
    [[...new Set(userIds)]],
  )
  return new Set(res.rows.map((r) => r.id))
}

export function questionSetsStep(a: ActivityContext): AnyEntityStep {
  const entity = 'question_sets'
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'question_sets', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const users = await ctx.idMap.resolveMany('users', distinctValues(rows, 'teacher_id'))
      const subjects = await ctx.idMap.resolveMany('subjects', distinctValues(rows, 'subject_id'))
      const teachers = await teacherUsers(ctx, [...users.values()])
      let items: LegacyRow[] = []
      let withLevel = 0
      for (const row of rows) {
        const legacyId = idOf(row)
        const teacherId = lookup(users, row.teacher_id)
        const out = transformQuestionSet(row, {
          teacherId,
          teacherIsTeacher: teacherId !== undefined && teachers.has(teacherId),
          subjectId: lookup(subjects, row.subject_id),
        })
        if (!out.ok) {
          rejectRow(ctx, entity, legacyId, out.reject)
          continue
        }
        if ((row.education_level_id ?? '').trim() !== '') withLevel++
        items.push({ legacyId, values: out.value as unknown as Record<string, unknown> })
      }

      // A header rebuilt in v2 since an earlier run keeps its class: it is not written again. The kit upsert has no
      // `needs_rebuild` predicate, so the matching rows are locked (FOR UPDATE, in the batch transaction on `ctx.db`)
      // until the batch commits: a teacher rebuild between this read and the write cannot be reset. The planned runs
      // happen inside the freeze, before teachers reach v2, so the lock is never contended in practice.
      let rebuilt = 0
      if (items.length > 0) {
        // Every matching row is locked (also the ones still `needs_rebuild`), so a rebuild that starts now waits for the commit.
        const found = await ctx.db.query<{ legacy_id: string; needs_rebuild: boolean }>(
          `SELECT legacy_id, needs_rebuild FROM question_sets WHERE legacy_source = $1 AND legacy_id = ANY($2::text[]) ORDER BY id FOR UPDATE`,
          [ctx.source, items.map((i) => i.legacyId)],
        )
        const skip = new Set(found.rows.filter((r) => !r.needs_rebuild).map((r) => r.legacy_id))
        if (skip.size > 0) {
          rebuilt = skip.size
          items = items.filter((i) => !skip.has(i.legacyId))
        }
      }

      if (items.length > 0) {
        const count = await a.pool.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM ${quoteIdent(ARCHIVE_SCHEMA)}.question_set_items WHERE question_set_id = ANY($1::bigint[])`,
          [items.map((i) => i.legacyId)],
        )
        a.notes.count('question_sets.items_not_migrated', Number(count.rows[0]?.n ?? 0))
      }
      a.notes.count('question_sets.education_level_not_stored', withLevel)
      a.notes.count('question_sets.already_rebuilt', rebuilt)

      const res = await upsertAndMap(
        ctx, entity, 'question_sets',
        ['teacher_id', 'classroom_id', 'subject_id', 'title', 'status', 'needs_rebuild', 'created_at', 'updated_at'],
        items,
      )
      return { ...res, unchanged: (res.unchanged ?? 0) + rebuilt }
    },
  }
}
