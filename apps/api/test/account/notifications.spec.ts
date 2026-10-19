import {
  NOTIFICATIONS_PAGE_SIZE,
  NotificationItemSchema,
  NotificationListResponseSchema,
  NotificationReadAllResultSchema,
  NotificationSuccessSchema,
  NotificationUnreadCountSchema,
} from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  ADMIN,
  STUDENT,
  TEACHER,
  apiOf,
  bootNotificationsApp,
  expectError,
  login,
  userIdOf,
  type Api,
  type NotificationsTestApp,
} from './notifications-helpers'

describe('notifications inbox (BE-06 part B)', () => {
  let t: NotificationsTestApp
  let me: Api
  let other: Api
  let meId: string
  let otherId: string

  const seed = async (userId: string, n: number, over: { category?: string | null; read?: boolean; at?: string } = {}): Promise<string[]> => {
    const ids: string[] = []
    for (let i = 0; i < n; i++) {
      const rows = await t.db.query<{ id: string }>(
        `insert into notifications (user_id, type, category, title, body, read_at, created_at)
         values ($1, 'spaced_review', $2, $3, 'Isi', $4, $5) returning id::text`,
        [userId, over.category === undefined ? 'system' : over.category, `T${String(i)}`, over.read ? '2026-10-19T00:00:00Z' : null, over.at ?? '2026-10-19T01:00:00Z'],
      )
      ids.push(rows[0]!.id)
    }
    return ids
  }

  beforeAll(async () => {
    t = await bootNotificationsApp()
    me = apiOf(await login(t, STUDENT))
    other = apiOf(await login(t, TEACHER))
    meId = await userIdOf(t.db, STUDENT)
    otherId = await userIdOf(t.db, TEACHER)
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await t.db.query('delete from notifications')
  })

  it('401 without a session', async () => {
    expectError(await t.http().get('/api/me/notifications'), 'UNAUTHORIZED')
    expectError(await t.http().get('/api/me/notifications/unread-count'), 'UNAUTHORIZED')
  })

  it('lists newest first (created_at desc, id desc), 20 per page, with unfiltered counts; no-store', async () => {
    await seed(meId, 3, { at: '2026-10-19T01:00:00Z' })
    const [newest] = await seed(meId, 1, { at: '2026-10-19T05:00:00Z' })
    await seed(meId, 1, { read: true, at: '2026-10-19T02:00:00Z', category: 'milestone' })
    await seed(otherId, 2)
    const res = await me.get('/me/notifications')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.headers['cache-control']).toMatch(/no-store/)
    const body = NotificationListResponseSchema.parse(res.body)
    expect(body.data).toHaveLength(5)
    expect(body.data[0]?.id).toBe(newest)
    expect(body.data.every((n) => n.userId === meId)).toBe(true)
    const ids = body.data.slice(2, 5).map((n) => BigInt(n.id))
    expect(ids[0]! > ids[1]! && ids[1]! > ids[2]!).toBe(true) // ties by higher id first
    expect(body.meta).toMatchObject({ page: 1, pageSize: NOTIFICATIONS_PAGE_SIZE, totalItems: 5, totalPages: 1, counts: { all: 5, unread: 4 } })
    expect(body.data[0]?.readAt).toBeNull()
    expect(body.data[0]?.createdAt).toMatch(/\+08:00$/)
  })

  it('paginates: page 2 holds the rest, an out-of-range page is empty, an invalid page means 1', async () => {
    await seed(meId, 25)
    const p1 = NotificationListResponseSchema.parse((await me.get('/me/notifications')).body)
    const p2 = NotificationListResponseSchema.parse((await me.get('/me/notifications?page=2')).body)
    const p9 = NotificationListResponseSchema.parse((await me.get('/me/notifications?page=9')).body)
    const bad = NotificationListResponseSchema.parse((await me.get('/me/notifications?page=abc')).body)
    expect(p1.data).toHaveLength(20)
    expect(p2.data).toHaveLength(5)
    expect(p2.meta).toMatchObject({ page: 2, totalItems: 25, totalPages: 2, from: 21, to: 25 })
    expect(p9.data).toEqual([])
    expect(p9.meta.page).toBe(9)
    expect(bad.meta.page).toBe(1)
  })

  it('filters by status and category (AND); unknown values are ignored; counts ignore filters', async () => {
    await seed(meId, 2, { category: 'system' })
    await seed(meId, 1, { category: 'system', read: true })
    await seed(meId, 1, { category: 'reminder' })
    await seed(meId, 1, { category: null })
    const get = async (q: string) => NotificationListResponseSchema.parse((await me.get(`/me/notifications${q}`)).body)
    expect((await get('?filter=unread')).meta.totalItems).toBe(4)
    expect((await get('?filter=read')).meta.totalItems).toBe(1)
    expect((await get('?type=system')).meta.totalItems).toBe(3)
    expect((await get('?type=system&filter=unread')).meta.totalItems).toBe(2)
    expect((await get('?type=bogus&filter=nope')).meta.totalItems).toBe(5)
    expect((await get('?type=reminder')).meta.counts).toEqual({ all: 5, unread: 4 })
  })

  it('unread-count counts only own unread items', async () => {
    await seed(meId, 2)
    await seed(meId, 1, { read: true })
    await seed(otherId, 4)
    const res = await me.get('/me/notifications/unread-count')
    expect(NotificationUnreadCountSchema.parse(res.body.data)).toEqual({ count: 2 })
    expect(res.headers['cache-control']).toMatch(/no-store/)
  })

  it('read-all marks only own unread items and reports how many; a second call gives 0', async () => {
    await seed(meId, 3)
    await seed(meId, 1, { read: true })
    const [foreign] = await seed(otherId, 1)
    const res = await me.post('/me/notifications/read-all')
    expect(res.status).toBe(200)
    expect(NotificationReadAllResultSchema.parse(res.body.data)).toEqual({ updated: 3 })
    expect(NotificationReadAllResultSchema.parse((await me.post('/me/notifications/read-all')).body.data)).toEqual({ updated: 0 })
    const row = await t.db.query<{ read_at: Date | null }>('select read_at from notifications where id = $1', [foreign])
    expect(row[0]?.read_at).toBeNull()
  })

  it(':id/read marks one item, keeps the first read_at on a second call', async () => {
    const [id] = await seed(meId, 1)
    expect(NotificationSuccessSchema.parse((await me.post(`/me/notifications/${id}/read`)).body.data)).toEqual({ success: true })
    const first = (await t.db.query<{ read_at: Date }>('select read_at from notifications where id = $1', [id]))[0]!.read_at
    t.clock.advance(3_600_000)
    expect((await me.post(`/me/notifications/${id}/read`)).status).toBe(200)
    const second = (await t.db.query<{ read_at: Date }>('select read_at from notifications where id = $1', [id]))[0]!.read_at
    expect(second.getTime()).toBe(first.getTime())
  })

  it('AC7: another user id is 404 on :id/read and DELETE and the row is untouched; unknown and malformed ids are 404 too', async () => {
    const [foreign] = await seed(otherId, 1)
    expectError(await me.post(`/me/notifications/${foreign}/read`), 'NOT_FOUND', 'Not Found.')
    expectError(await me.del(`/me/notifications/${foreign}`), 'NOT_FOUND', 'Not Found.')
    expectError(await me.post('/me/notifications/999999999/read'), 'NOT_FOUND')
    expectError(await me.del('/me/notifications/abc'), 'NOT_FOUND')
    const row = await t.db.query<{ read_at: Date | null }>('select read_at from notifications where id = $1', [foreign])
    expect(row).toHaveLength(1)
    expect(row[0]?.read_at).toBeNull()
    // the owner can
    expect((await other.post(`/me/notifications/${foreign}/read`)).status).toBe(200)
    expect((await other.del(`/me/notifications/${foreign}`)).status).toBe(200)
  })

  it('DELETE removes an own item with 200 { success: true } (not 204)', async () => {
    const [id] = await seed(meId, 1)
    const res = await me.del(`/me/notifications/${id}`)
    expect(res.status).toBe(200)
    expect(NotificationSuccessSchema.parse(res.body.data)).toEqual({ success: true })
    expect(await t.db.query('select 1 from notifications where id = $1', [id])).toHaveLength(0)
    expectError(await me.del(`/me/notifications/${id}`), 'NOT_FOUND')
  })

  it('AC7: bulk-read silently ignores a foreign id mixed into the list (and unknown ids, duplicates)', async () => {
    const mine = await seed(meId, 2)
    const [foreign] = await seed(otherId, 1)
    const res = await me.post('/me/notifications/bulk-read', { ids: [mine[0], foreign, '999999999', mine[0], 'zz'] })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(NotificationSuccessSchema.parse(res.body.data)).toEqual({ success: true })
    const rows = await t.db.query<{ id: string; read: boolean }>('select id::text, read_at is not null as read from notifications order by id')
    expect(Object.fromEntries(rows.map((r) => [r.id, r.read]))).toEqual({ [mine[0]!]: true, [mine[1]!]: false, [foreign!]: false })
  })

  it('AC7: bulk-delete silently ignores a foreign id mixed into the list', async () => {
    const mine = await seed(meId, 2)
    const [foreign] = await seed(otherId, 1)
    const res = await me.post('/me/notifications/bulk-delete', { ids: [mine[1], foreign] })
    expect(res.status).toBe(200)
    const left = (await t.db.query<{ id: string }>('select id::text from notifications order by id')).map((r) => r.id)
    expect(left).toEqual([mine[0], foreign])
  })

  it('bulk bodies: missing, empty, non-list or over-cap ids are 422 with fields.ids', async () => {
    for (const body of [{}, { ids: [] }, { ids: 'x' }, { ids: null }]) {
      const err = expectError(await me.post('/me/notifications/bulk-read', body), 'VALIDATION_ERROR')
      expect(err.fields?.ids).toBe('The ids field is required.')
    }
    const err = expectError(await me.post('/me/notifications/bulk-delete', { ids: Array.from({ length: 501 }, (_, i) => String(i + 1)) }), 'VALIDATION_ERROR')
    expect(err.fields?.ids).toMatch(/500/)
    const ok500 = await me.post('/me/notifications/bulk-delete', { ids: Array.from({ length: 500 }, (_, i) => String(i + 1)) })
    expect(ok500.status).toBe(200)
  })

  it('writes need the CSRF header (403 CSRF_INVALID)', async () => {
    const who = await login(t, ADMIN)
    const res = await who.agent.post('/api/me/notifications/read-all')
    expectError(res, 'CSRF_INVALID')
  })
})

describe('notification write throttle (D57a)', () => {
  let t: NotificationsTestApp
  beforeAll(async () => {
    t = await bootNotificationsApp({ THROTTLE_NOTIFICATION_WRITE_PER_MINUTE: '3', THROTTLE_NOTIFICATION_READ_PER_MINUTE: '2' })
  })
  afterAll(async () => {
    await t.close()
  })

  it('writes are 429 RATE_LIMITED with Retry-After after the ceiling; reads have their own counter', async () => {
    const me = apiOf(await login(t, STUDENT))
    for (let i = 0; i < 3; i++) expect((await me.post('/me/notifications/read-all')).status).toBe(200)
    const res = await me.post('/me/notifications/read-all')
    const err = expectError(res, 'RATE_LIMITED', 'Too Many Attempts.')
    expect(err.retryAfter).toBeGreaterThan(0)
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
    expect((await me.get('/me/notifications')).status).toBe(200)
    expect((await me.get('/me/notifications/unread-count')).status).toBe(200)
    expectError(await me.get('/me/notifications'), 'RATE_LIMITED', 'Too Many Attempts.')
  })
})

describe('NotificationsService.push', () => {
  let t: NotificationsTestApp
  let meId: string
  beforeAll(async () => {
    t = await bootNotificationsApp()
    meId = await userIdOf(t.db, STUDENT)
  })
  afterAll(async () => {
    await t.close()
  })

  it('creates an unread notification visible in the owner inbox; category defaults to null', async () => {
    const item = await t.service.push(meId, { type: 'new_ticket', category: 'system', title: 'Tajuk', body: 'Isi' })
    expect(NotificationItemSchema.parse(item)).toMatchObject({ userId: meId, type: 'new_ticket', category: 'system', readAt: null })
    const none = await t.service.push(meId, { type: 'x', title: 'a', body: 'b' }, { push: true })
    expect(none.category).toBeNull()
    const who = apiOf(await login(t, STUDENT))
    const list = NotificationListResponseSchema.parse((await who.get('/me/notifications')).body)
    expect(list.data.map((n) => n.id).sort()).toEqual([item.id, none.id].sort())
    const rows = await t.db.query('select 1 from notifications where user_id = $1', [meId])
    expect(rows).toHaveLength(2) // the push option created nothing extra
  })

  it('rejects a category outside the contract enum, empty or over-long text, and a bad user id', async () => {
    await expect(t.service.push(meId, { type: 'x', category: 'bogus' as never, title: 'a', body: 'b' })).rejects.toThrow()
    await expect(t.service.push(meId, { type: 'x', title: '', body: 'b' })).rejects.toThrow()
    await expect(t.service.push(meId, { type: 'x', title: 'a'.repeat(201), body: 'b' })).rejects.toThrow(/too long/)
    await expect(t.service.push(meId, { type: 'x', title: 'a', body: 'b'.repeat(2001) })).rejects.toThrow(/too long/)
    await expect(t.service.push(meId, { type: 't'.repeat(65), title: 'a', body: 'b' })).rejects.toThrow(/too long/)
    await expect(t.service.push('abc', { type: 'x', title: 'a', body: 'b' })).rejects.toThrow()
  })
})
