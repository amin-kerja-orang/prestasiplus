/**
 * Practice steps of `migrate:activity` (BE-29): `practice_sessions` and `practice_answers`.
 *
 * Sessions are loaded as `completed` rows (see `transform/practice.ts`). Answers are HISTORICAL SNAPSHOTS
 * (v2-data-migration.md 3.3): each attempt is joined once to its archived question by the snapshot-dims helper and
 * carries its own curriculum dimensions; `question_id` stays null and the question text is never stored or logged
 * (only its content hash). Both steps read `staging_cloud` through the pool and write through the batch client.
 */
import type { AnyEntityStep, BatchContext, BatchResult } from '../../kit/runner'
import type { LegacyRow } from '../../kit/upsert'
import { heldValues } from '../claim'
import { rejectRow, upsertAndMap } from '../helpers'
import { distinctValues, readById, resolveFk, type StagedRow } from '../source'
import { enumKey } from '../../transform/common'
import {
  ANSWER_COLUMNS,
  parseClientUuid,
  SESSION_COLUMNS,
  SESSION_MODES_DEFERRED,
  transformAnswer,
  transformSession,
  type SessionValues,
} from '../../transform/practice'
import { readSnapshotDims, resolveSnapshot, type RawDims } from '../../snapshot-dims'
import type { ActivityContext } from './context'
import { idOf } from './wallet-steps'

// ---------------------------------------------------------------- sessions

export function practiceSessionsStep(a: ActivityContext): AnyEntityStep {
  const entity = 'practice_sessions'
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'practice_sessions', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const users = await ctx.idMap.resolveMany('users', distinctValues(rows, 'user_id'))
      const subjects = await ctx.idMap.resolveMany('subjects', distinctValues(rows, 'subject_id'))
      const items: { legacyId: string; values: SessionValues }[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const key = parseClientUuid(row.client_uuid)
        if (key.invalid) a.notes.count('practice_sessions.client_uuid_invalid')
        const out = transformSession(
          row,
          { userId: resolveFk(row.user_id, users) ?? undefined, subjectId: resolveFk(row.subject_id, subjects) },
          key.value,
        )
        if (!out.ok) {
          rejectRow(ctx, entity, legacyId, out.reject)
          if (out.reject.column === 'mode') {
            // LEAD Q5: spm / battle sessions are counted by name; any other unknown mode is counted together.
            const mode = enumKey(row.mode)
            a.notes.count(`practice_sessions.mode_rejected.${mode !== null && SESSION_MODES_DEFERRED.includes(mode) ? mode : 'other'}`)
          }
        } else items.push({ legacyId, values: out.value })
      }
      await settleClientKeys(a, ctx, items)
      await fillCompletedAt(ctx, items)
      return upsertAndMap(
        ctx, entity, 'practice_sessions', SESSION_COLUMNS,
        items.map((i): LegacyRow => ({ legacyId: i.legacyId, values: i.values as unknown as Record<string, unknown> })),
      )
    },
  }
}

/**
 * v2 keeps `(user_id, client_uuid)` unique. A key already used by another session (in this batch or in the table)
 * is dropped from the later session (the session itself is kept) and counted.
 */
async function settleClientKeys(
  a: ActivityContext,
  ctx: BatchContext,
  items: { legacyId: string; values: SessionValues }[],
): Promise<void> {
  const keyOf = (v: SessionValues): string | null => (v.client_uuid === null ? null : `${v.user_id}:${v.client_uuid}`)
  const seen = new Set<string>()
  for (const i of items) {
    const k = keyOf(i.values)
    if (k === null) continue
    if (seen.has(k)) {
      i.values.client_uuid = null
      a.notes.count('practice_sessions.client_uuid_duplicate')
    } else seen.add(k)
  }
  if (seen.size === 0) return
  const held = await heldValues(ctx.db, { table: 'practice_sessions', expr: `(user_id::text || ':' || client_uuid::text)` }, [...seen])
  for (const i of items) {
    const k = keyOf(i.values)
    if (k === null) continue
    const others = (held.get(k) ?? []).some((h) => !(h.source === ctx.source && h.legacyId === i.legacyId))
    if (others) {
      i.values.client_uuid = null
      a.notes.count('practice_sessions.client_uuid_duplicate')
    }
  }
}

/**
 * `completed_at = started_at + duration_seconds` (.cloud keeps no completion time; Perlu pengesahan). Computed in
 * SQL so no time zone or date arithmetic happens in JavaScript.
 */
async function fillCompletedAt(ctx: BatchContext, items: { legacyId: string; values: SessionValues }[]): Promise<void> {
  if (items.length === 0) return
  const res = await ctx.db.query<{ id: string; t: string }>(
    `SELECT x.id, (x.s::timestamptz + make_interval(secs => x.d))::text AS t
     FROM unnest($1::text[], $2::text[], $3::int[]) AS x(id, s, d)`,
    [items.map((i) => i.legacyId), items.map((i) => i.values.started_at), items.map((i) => i.values.time_spent_sec)],
  )
  const by = new Map(res.rows.map((r) => [r.id, r.t]))
  for (const i of items) i.values.completed_at = by.get(i.legacyId) ?? i.values.started_at
}

// ---------------------------------------------------------------- answers

interface SessionInfo {
  subject_id: string | null
  client_uuid: string | null
  started_at: string
}

export function practiceAnswersStep(a: ActivityContext): AnyEntityStep {
  const entity = 'practice_answers'
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'question_attempts', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const users = await ctx.idMap.resolveMany('users', distinctValues(rows, 'user_id'))
      const sessions = await ctx.idMap.resolveMany('practice_sessions', distinctValues(rows, 'practice_session_id'))
      const info = await sessionInfo(ctx, [...sessions.values()])
      // The snapshot join: question dimensions come from the archive (text is hashed inside the helper).
      const raw = await readSnapshotDims(a.pool, distinctValues(rows, 'question_id'))
      const pickIds = (f: (r: RawDims) => string | null): string[] => [...new Set([...raw.values()].map(f).filter((v): v is string => v !== null))]
      const maps = {
        subjects: await ctx.idMap.resolveMany('subjects', pickIds((r) => r.subjectId)),
        levels: await ctx.idMap.resolveMany('education_levels', pickIds((r) => r.levelId)),
        chapters: await ctx.idMap.resolveMany('chapters', pickIds((r) => r.chapterId)),
        topics: await ctx.idMap.resolveMany('topics', pickIds((r) => r.topicId)),
      }
      const items: LegacyRow[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const sessionId = resolveFk(row.practice_session_id, sessions)
        const session = sessionId ? info.get(sessionId) : undefined
        const questionId = (row.question_id ?? '').trim() === '' ? null : (row.question_id ?? '').trim()
        const dims = resolveSnapshot(questionId === null ? undefined : raw.get(questionId), maps, session?.subject_id ?? null)
        if (dims.ok) for (const n of dims.value.notes) a.notes.count(`practice_answers.${n}`)
        const out = transformAnswer(row, {
          userId: resolveFk(row.user_id, users) ?? undefined,
          sessionId,
          clientUuid: session?.client_uuid ?? null,
          sessionStartedAt: session?.started_at ?? null,
          dims,
        })
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push({ legacyId, values: out.value as unknown as Record<string, unknown> })
      }
      return upsertAndMap(ctx, entity, 'practice_answers', ANSWER_COLUMNS, items, { register: false })
    },
  }
}

/** Subject, client key and start of the v2 sessions (by uuid), for the subject fallback and the copied key. */
async function sessionInfo(ctx: BatchContext, sessionIds: readonly string[]): Promise<Map<string, SessionInfo>> {
  const out = new Map<string, SessionInfo>()
  if (sessionIds.length === 0) return out
  const res = await ctx.db.query<{ id: string } & SessionInfo>(
    `SELECT id::text AS id, subject_id::text AS subject_id, client_uuid::text AS client_uuid, started_at::text AS started_at
     FROM practice_sessions WHERE id = ANY($1::uuid[])`,
    [[...new Set(sessionIds)]],
  )
  for (const r of res.rows) out.set(r.id, { subject_id: r.subject_id, client_uuid: r.client_uuid, started_at: r.started_at })
  return out
}
