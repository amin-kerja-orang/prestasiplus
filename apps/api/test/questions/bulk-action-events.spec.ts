/**
 * BE-33 AC4 follow-up: the `question_status_events` rows written by `POST /api/questions/bulk-action`.
 * One row per question that really changed status (via `QuestionsService.setStatus(..., { event })`), carrying only
 * ids, statuses, the active role code and the request id. A skipped id (unknown, refused transition, failed
 * publish gate) and `delete` write no row.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, type Refs } from './http-helpers'

interface EventRow {
  question_id: string
  version_no: number
  from_status: string | null
  to_status: string
  actor_user_id: string | null
  actor_role: string | null
  reason: string | null
  request_id: string | null
}

const UNKNOWN_ID = '999999999'

describe('BE-33 AC4: bulk-action status events', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs

  beforeAll(async () => {
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
  })
  afterAll(async () => {
    await t.close()
  })

  const create = async (): Promise<string> => {
    const res = await admin.post('/api/questions', mcqBody(refs))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return (res.body as { data: { id: string } }).data.id
  }
  const bulk = (body: unknown, requestId: string) => admin.post('/api/questions/bulk-action', body).set('X-Request-Id', requestId)
  const eventsOf = (ids: string[]) =>
    t.db.query<EventRow>(
      `select question_id::text, version_no, from_status, to_status, actor_user_id::text, actor_role, reason, request_id
         from question_status_events where question_id = any($1::bigint[]) order by id`,
      [ids],
    )
  const statusOf = async (id: string): Promise<string> => {
    const res = await admin.get(`/api/questions/${id}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return (res.body as { data: { status: string } }).data.status
  }
  const latestVersionOf = async (id: string): Promise<number> =>
    Number((await t.db.query<{ n: number }>('select max(version_no) as n from question_versions where question_id = $1::bigint', [id]))[0]?.n)

  it('writes one event per changed question with version, statuses, actor, role and request id (reason null)', async () => {
    const [a, b, c] = [await create(), await create(), await create()] as [string, string, string]
    const requestId = 'be33-bulk-review-1'
    const res = await bulk({ action: 'review', ids: [a, b, UNKNOWN_ID] }, requestId)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data).toEqual({ affected: 2 })

    const events = await eventsOf([a, b, c])
    expect(events.map((e) => e.question_id)).toEqual([a, b])
    for (const e of events) {
      expect(e.version_no).toBe(await latestVersionOf(e.question_id))
      expect(e.from_status).toBe('draft')
      expect(e.to_status).toBe('review')
      expect(e.actor_user_id).toBe(admin.userId)
      expect(e.actor_role).toBe('admin')
      expect(e.request_id).toBe(requestId)
      expect(e.reason).toBeNull()
    }
    expect(await statusOf(a)).toBe('review')
    expect(await statusOf(b)).toBe('review')
    expect(await statusOf(c)).toBe('draft')
    // The unknown id wrote nothing (no FK on question_id, so count by id).
    expect((await eventsOf([UNKNOWN_ID])).length).toBe(0)
  })

  it('a refused transition writes no event and keeps the status, while another id in the request still gets its event', async () => {
    const refused = await create() // draft -> approved is not allowed
    const allowed = await create()
    await bulk({ action: 'review', ids: [allowed] }, 'be33-bulk-prep-1') // draft -> review
    const before = (await eventsOf([refused, allowed])).length

    const requestId = 'be33-bulk-refused-1'
    const res = await bulk({ action: 'approved', ids: [refused, allowed] }, requestId)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data).toEqual({ affected: 1 })

    expect(await statusOf(refused)).toBe('draft')
    expect(await statusOf(allowed)).toBe('approved')
    expect((await eventsOf([refused])).length).toBe(0)
    const events = (await eventsOf([refused, allowed])).filter((e) => e.request_id === requestId)
    expect(events.length).toBe(1)
    expect(events[0]).toMatchObject({ question_id: allowed, from_status: 'review', to_status: 'approved', actor_user_id: admin.userId, actor_role: 'admin', reason: null })
    expect((await eventsOf([refused, allowed])).length).toBe(before + 1)
  })

  it('a publish that fails the tag gate writes no event (rolled back) and keeps the status', async () => {
    const bare = await create() // no curriculum tag
    await bulk({ action: 'review', ids: [bare] }, 'be33-bulk-prep-2')
    await bulk({ action: 'approved', ids: [bare] }, 'be33-bulk-prep-3')
    const before = await eventsOf([bare])
    expect(before.map((e) => e.to_status)).toEqual(['review', 'approved'])

    const requestId = 'be33-bulk-publish-1'
    const res = await bulk({ action: 'published', ids: [bare, UNKNOWN_ID] }, requestId)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data).toEqual({ affected: 0 })

    expect(await statusOf(bare)).toBe('approved')
    const after = await eventsOf([bare])
    expect(after.length).toBe(before.length)
    expect(after.filter((e) => e.request_id === requestId)).toEqual([])
  })

  it('delete writes no status event', async () => {
    const a = await create()
    const res = await bulk({ action: 'delete', ids: [a] }, 'be33-bulk-delete-1')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data).toEqual({ affected: 1 })
    expect(await eventsOf([a])).toEqual([])
    const [row] = await t.db.query<{ n: string }>(`select count(*)::text as n from question_status_events where request_id = 'be33-bulk-delete-1'`)
    expect(row?.n).toBe('0')
  })

  it('the event rows hold only ids, statuses, role and request id (no personal content)', async () => {
    const a = await create()
    await bulk({ action: 'review', ids: [a] }, 'be33-bulk-columns-1')
    const rows = await t.db.query<Record<string, unknown>>('select * from question_status_events where question_id = $1::bigint', [a])
    expect(rows.length).toBe(1)
    const nonNull = Object.entries(rows[0]!)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k]) => k)
      .sort()
    expect(nonNull).toEqual(['actor_role', 'actor_user_id', 'answer_changed', 'created_at', 'from_status', 'id', 'question_id', 'request_id', 'to_status', 'version_no'])
    expect(rows[0]!.reason).toBeNull()
    expect(rows[0]!.ai_run_id).toBeNull()
    expect(rows[0]!.answer_changed).toBe(false)
  })
})
