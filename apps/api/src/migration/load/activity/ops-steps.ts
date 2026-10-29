/**
 * Operations group of `migrate:activity` (BE-29 Part B): support tickets, timeline posts and feedback.
 *
 * Free text (ticket subject and reply, timeline title and story, feedback comment) is moved from the staging table to
 * the v2 table inside the database and is never logged: rejects and notes carry reason codes, column names and
 * surrogate ids only.
 */
import type pg from 'pg'

import { STAGING_SCHEMA } from '../../ddl/spec'
import type { AnyEntityStep, BatchContext, BatchResult } from '../../kit/runner'
import { assertSurrogateLegacyId } from '../../kit/sql'
import type { LegacyRow } from '../../kit/upsert'
import { klDateSql } from '../../transform/activity-common'
import { transformFeedback, transformTicket, transformTimeline } from '../../transform/support'
import { dropConflicts } from '../claim'
import { rejectRow, upsertAndMap } from '../helpers'
import { distinctValues, readById, type StagedRow } from '../source'
import { lookup } from './catalogue-steps'
import type { ActivityContext } from './context'

const idOf = (row: StagedRow): string => {
  const id = row.id ?? ''
  assertSurrogateLegacyId(id, 'migrate:activity')
  return id
}

const toRow = (legacyId: string, values: object): LegacyRow => ({ legacyId, values: values as unknown as Record<string, unknown> })

// ---------------------------------------------------------------- support tickets

/**
 * `support_tickets`: the status is mapped onto the five BM codes. The v2 ticket needs a message body that the staged
 * table does not carry (LEAD Q6; Perlu pengesahan), so each ticket is rejected INVALID_VALUE (`body`) until the staging
 * spec has the column. A subject over 255 characters is rejected, not cut.
 */
export function ticketsStep(a: ActivityContext): AnyEntityStep {
  const entity = 'support_tickets'
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'support_tickets', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const users = await ctx.idMap.resolveMany('users', distinctValues(rows, 'user_id'))
      const items: LegacyRow[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const out = transformTicket(row, { userId: lookup(users, row.user_id) })
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push(toRow(legacyId, out.value))
      }
      return upsertAndMap(
        ctx, entity, 'support_tickets',
        ['user_id', 'subject', 'body', 'status', 'admin_reply', 'is_test', 'created_at', 'updated_at'],
        items, { register: false },
      )
    },
  }
}

// ---------------------------------------------------------------- timeline

/** `timeline_entries` -> `timeline_posts` (body to story, happened_on to event_date, category fixed `lain`, T-02). */
export function timelineStep(a: ActivityContext): AnyEntityStep {
  const entity = 'timeline_posts'
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'timeline_entries', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const users = await ctx.idMap.resolveMany('users', distinctValues(rows, 'user_id'))
      const items: LegacyRow[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const out = transformTimeline(row, { userId: lookup(users, row.user_id) })
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push(toRow(legacyId, out.value))
      }
      return upsertAndMap(
        ctx, entity, 'timeline_posts',
        ['user_id', 'title', 'category', 'event_date', 'story', 'is_test', 'created_at', 'updated_at'],
        items, { register: false },
      )
    },
  }
}

// ---------------------------------------------------------------- feedback

const FEEDBACK_MONTH = `date_trunc('month', ${klDateSql('created_at')})::date`

interface MonthInfo {
  month: string | null
  newest: boolean
}

/**
 * For the rows of a batch: the Malaysia month of `created_at` (first day, SQL) and whether the row is the newest VALID
 * row of its (user, month) in the whole staged table (not only in this batch). Newest = latest `created_at`, then the
 * highest id; a row the transform rejects for its scores never wins (satisfaction, usability, relevance outside 1 to 5,
 * or `score` outside 0 to 10; D4: a `score` of 0 or 6 to 10 is valid and becomes `nps`).
 */
async function monthInfo(pool: pg.Pool, rows: readonly StagedRow[]): Promise<Map<string, MonthInfo>> {
  const userIds = distinctValues(rows, 'user_id').filter((u) => /^\d{1,18}$/.test(u))
  const ids = rows.map((r) => idOf(r))
  const out = new Map<string, MonthInfo>()
  if (userIds.length === 0) return out
  const res = await pool.query<{ id: string; month: string | null; newest: boolean }>(
    `WITH b AS (
       SELECT id, user_id, created_at, ${FEEDBACK_MONTH} AS m,
              coalesce(satisfaction BETWEEN 1 AND 5
                AND (usability IS NULL OR usability BETWEEN 1 AND 5)
                AND (relevance IS NULL OR relevance BETWEEN 1 AND 5)
                AND (score IS NULL OR score BETWEEN 0 AND 10), false) AS valid
       FROM "${STAGING_SCHEMA}"."feedback" WHERE user_id = ANY($1::bigint[])
     ), w AS (
       SELECT DISTINCT ON (user_id, m) id FROM b WHERE m IS NOT NULL AND valid
       ORDER BY user_id, m, created_at DESC, id DESC
     )
     SELECT b.id::text AS id, b.m::text AS month, (w.id IS NOT NULL) AS newest
     FROM b LEFT JOIN w ON w.id = b.id WHERE b.id = ANY($2::bigint[])`,
    [userIds, ids],
  )
  for (const r of res.rows) out.set(r.id, { month: r.month, newest: r.newest })
  return out
}

/**
 * `feedback`: the four scores are kept, the month is the first day of the Malaysia month of `created_at` (SQL), role and
 * school come from the user. Satisfaction, usability and relevance must be 1 to 5; a `score` of 0 or 6 to 10 goes to
 * `nps` with `score` null (D4, LEAD 29 Oct; counted as `feedback.score_to_nps`). With more than one row for a
 * (user, month) the newest stays and the rest are DUPLICATE_KEY.
 */
export function feedbackStep(a: ActivityContext): AnyEntityStep {
  const entity = 'feedback'
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'feedback', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const userKeys = distinctValues(rows, 'user_id')
      const users = await ctx.idMap.resolveMany('users', userKeys)
      const info = await monthInfo(a.pool, rows)
      const roles = new Map<string, string | null>()
      const numeric = userKeys.filter((u) => /^\d{1,18}$/.test(u))
      if (numeric.length > 0) {
        const res = await a.pool.query<{ id: string; role: string | null }>(
          `SELECT id::text AS id, role FROM "${STAGING_SCHEMA}"."users" WHERE id = ANY($1::bigint[])`,
          [numeric],
        )
        for (const r of res.rows) roles.set(r.id, r.role)
      }
      const schools = new Map<string, string | null>()
      if (users.size > 0) {
        const res = await ctx.db.query<{ id: string; school_id: string | null }>(
          `SELECT id::text AS id, school_id::text AS school_id FROM users WHERE id = ANY($1::bigint[])`,
          [[...users.values()]],
        )
        for (const r of res.rows) schools.set(r.id, r.school_id)
      }
      const items: LegacyRow[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const userKey = row.user_id?.trim() ?? null
        // A user that is no longer staged (deleted at the source, delta run: staging has no cascade) is an orphan even
        // when the id map still knows it, the same as on a first load; checked before the role is evaluated.
        const userId = userKey === null || !roles.has(userKey) ? undefined : users.get(userKey)
        const m = info.get(legacyId)
        const out = transformFeedback(row, {
          userId,
          role: userKey === null ? null : roles.get(userKey),
          schoolId: userId === undefined ? null : (schools.get(userId) ?? null),
          month: m?.month ?? null,
          newest: m?.newest ?? false,
        })
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push(toRow(legacyId, out.value))
      }
      // A v2-born feedback row (no legacy pair) for the same (user, month, is_test) wins: the legacy row is rejected
      // DUPLICATE_KEY (month) instead of the unique violation aborting the batch (and the required dry-run).
      const keyOf = (i: LegacyRow): string => `${String(i.values.user_id)}|${String(i.values.month)}|${String(i.values.is_test)}`
      const kept = await dropConflicts(ctx.db, items, {
        entity, table: 'feedback', column: 'month', expr: `user_id::text || '|' || month::text || '|' || is_test::text`,
        source: ctx.source, rejects: ctx.rejects, legacyIdOf: (i) => i.legacyId, valueOf: keyOf,
      })
      // D4 (LEAD 29 Oct): loaded rows whose score went to nps (counted after the duplicate and conflict drops).
      a.notes.count('feedback.score_to_nps', kept.filter((i) => i.values.nps !== null && i.values.nps !== undefined).length)
      return upsertAndMap(
        ctx, entity, 'feedback',
        ['user_id', 'role', 'school_id', 'month', 'nps', 'satisfaction', 'usability', 'relevance', 'score', 'comment', 'is_test', 'created_at', 'updated_at'],
        kept, { register: false },
      )
    },
  }
}
