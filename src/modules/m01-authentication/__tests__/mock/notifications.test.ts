/**
 * M01-T2: notifications mock (SRS M01 v1.12 §7 #13–#19, §6.8 seeds, BR-19, hook `pushNotification`).
 */

import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import type { TransportResponse } from '@/api/transport'
import { CLOCK_ANCHOR_MS, createClock } from '@/lib/time'
import { defineMockCore } from '@/mock/define'
import { bootMock, type MockRuntime } from '@/mock/index'

import m01 from '../../mock'
import { pushNotification } from '../../mock/hooks/notifications'
import {
  ADMIN_NEWEST_ID,
  SEED_SPAN_MS,
  buildNotificationSeed,
} from '../../mock/seeds/notifications'
import { NOTIFICATION_PUSH_EVENT } from '../../api/notifications'

const ROLES: Record<number, 'admin' | 'student' | 'teacher' | 'parent'> = {
  1: 'admin',
  2: 'student',
  3: 'student',
  4: 'student',
  5: 'teacher',
  6: 'parent',
}

let runtime: MockRuntime
const clock = createClock({ at: CLOCK_ANCHOR_MS })

function call(
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  as: number | null,
  body?: unknown,
): Promise<TransportResponse> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (as !== null) headers.authorization = `Bearer tok-${String(as)}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  return runtime.transport.request({
    method,
    url,
    headers,
    ...(body !== undefined ? { body } : {}),
  })
}

interface ListBody {
  data: {
    id: number
    userId: number
    type: string
    category: string | null
    readAt: string | null
    createdAt: string
  }[]
  meta: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    from: number | null
    to: number | null
    counts: { all: number; unread: number }
  }
}

const list = async (as: number, query = ''): Promise<ListBody> => {
  const res = await call('GET', `/api/me/notifications${query}`, as)
  expect(res.status).toBe(200)
  return res.body as ListBody
}
const unreadCount = async (as: number): Promise<number> => {
  const res = await call('GET', '/api/me/notifications/unread-count', as)
  return (res.body as { data: { count: number } }).data.count
}

let dirty = false
beforeAll(async () => {
  runtime = await bootMock({
    mode: 'test',
    plugins: [m01],
    core: defineMockCore({
      resolveSession: (token) => {
        const id = /^tok-(\d+)$/.exec(token)?.[1]
        const userId = id ? Number(id) : 0
        return userId > 0 ? { token, userId, role: ROLES[userId] ?? 'student' } : null
      },
    }),
    clock,
    latencyMs: 0,
    onWarn: null,
  })
}, 60_000)

afterEach(async () => {
  if (dirty) await runtime.reset()
  dirty = false
}, 60_000)

describe('seeds (SRS §6.8)', () => {
  it.each([
    [1, 167, 166],
    [2, 45, 12],
    [3, 3, 0],
    [4, 5, 2],
    [5, 5, 2],
    [6, 0, 0],
    [7, 1, 1],
    [8, 1, 1],
    [9, 1, 1],
    [10, 1, 1],
  ])('account %i has %i notifications, %i unread', async (id, all, unread) => {
    const body = await list(id)
    expect(body.meta.counts).toEqual({ all, unread })
    expect(body.meta.totalItems).toBe(all)
    expect(await unreadCount(id)).toBe(unread)
  })

  it('admin: newest id is 180915, no categories, the three live types, page 9 has 7 items', async () => {
    const body = await list(1)
    expect(body.data[0]!.id).toBe(ADMIN_NEWEST_ID)
    expect(body.meta).toMatchObject({ page: 1, pageSize: 20, totalPages: 9, from: 1, to: 20 })
    const all = buildNotificationSeed().filter((r) => r.userId === 1)
    expect(new Set(all.map((r) => r.type))).toEqual(
      new Set(['chatbot_new_conversation', 'new_ticket', 'spaced_review']),
    )
    expect(all.every((r) => r.category === null)).toBe(true)
    const last = await list(1, '?page=9')
    expect(last.data).toHaveLength(7)
    expect(last.meta).toMatchObject({ from: 161, to: 167 })
  })

  it('pelajar has all three categories; admin has none for ?type=system (empty list, counts kept)', async () => {
    const seed = buildNotificationSeed().filter((r) => r.userId === 2)
    expect(new Set(seed.map((r) => r.category))).toEqual(
      new Set(['system', 'reminder', 'milestone']),
    )
    const empty = await list(1, '?type=system')
    expect(empty.data).toEqual([])
    expect(empty.meta).toMatchObject({ totalItems: 0, totalPages: 1, from: null, to: null })
    expect(empty.meta.counts).toEqual({ all: 167, unread: 166 })
  })

  it('ids are unique, fixed, and increase with recency; times are within 90 days of the anchor', () => {
    const rows = buildNotificationSeed()
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length)
    for (const userId of [1, 2, 3, 4, 5]) {
      const mine = rows.filter((r) => r.userId === userId)
      for (let i = 1; i < mine.length; i++) {
        expect(mine[i]!.id).toBe(mine[i - 1]!.id + 1)
        expect(Date.parse(mine[i]!.createdAt)).toBeGreaterThan(Date.parse(mine[i - 1]!.createdAt))
      }
    }
    for (const r of rows) {
      const age = CLOCK_ANCHOR_MS - Date.parse(r.createdAt)
      expect(age).toBeGreaterThan(0)
      expect(age).toBeLessThanOrEqual(SEED_SPAN_MS + 2 * 60 * 60_000)
      if (r.readAt !== null) expect(Date.parse(r.readAt)).toBeGreaterThan(Date.parse(r.createdAt))
    }
  })

  it('uses the SRS templates', () => {
    const rows = buildNotificationSeed()
    const chat = rows.find((r) => r.type === 'chatbot_new_conversation')!
    expect(chat.title).toBe('Chatbot: Perbualan Baru')
    expect(chat.body).toMatch(/^.+ memulakan perbualan dari \/\S+$/)
    const review = rows.find((r) => r.userId === 2 && r.type === 'spaced_review')!
    expect(review.title).toBe('📚 Nota menunggu kamu, Pelajar Demo')
    expect(review.body).toMatch(
      /^Hai Pelajar Demo! Cikgu Alesa ada 9 nota ringkas tunggu kamu ulangkaji \(.+\)\. Klik buka — 5 minit sahaja\.$/,
    )
    expect(rows.find((r) => r.type === 'new_ticket')!.title).toBe('Tiket baru')
  })
})

describe('#13 GET /api/me/notifications', () => {
  it('requires a session', async () => {
    const res = await call('GET', '/api/me/notifications', null)
    expect(res.status).toBe(401)
  })

  it("lists only the caller's items, newest first, 20 per page", async () => {
    const body = await list(2)
    expect(body.data).toHaveLength(20)
    expect(body.data.every((n) => n.userId === 2)).toBe(true)
    const times = body.data.map((n) => Date.parse(n.createdAt))
    expect([...times].sort((a, b) => b - a)).toEqual(times)
    expect(body.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: 45, totalPages: 3 })
    const p3 = await list(2, '?page=3')
    expect(p3.data).toHaveLength(5)
    expect(p3.meta).toMatchObject({ from: 41, to: 45 })
    const beyond = await list(2, '?page=4')
    expect(beyond.data).toEqual([])
    expect(beyond.meta.page).toBe(4)
  })

  it('filter=unread / read', async () => {
    const unread = await list(2, '?filter=unread')
    expect(unread.meta.totalItems).toBe(12)
    expect(unread.data.every((n) => n.readAt === null)).toBe(true)
    const read = await list(2, '?filter=read')
    expect(read.meta.totalItems).toBe(33)
    expect(read.data.every((n) => n.readAt !== null)).toBe(true)
    // counts ignore the filters
    expect(unread.meta.counts).toEqual({ all: 45, unread: 12 })
    expect(read.meta.counts).toEqual({ all: 45, unread: 12 })
  })

  it('type=system|reminder|milestone; the three categories cover the 45 items', async () => {
    let total = 0
    for (const type of ['system', 'reminder', 'milestone']) {
      const body = await list(2, `?type=${type}`)
      expect(body.meta.totalItems).toBeGreaterThan(0)
      expect(body.data.every((n) => n.category === type)).toBe(true)
      total += body.meta.totalItems
    }
    expect(total).toBe(45)
  })

  it('the pelajar2 "0 unread" and the ibubapa empty inbox', async () => {
    expect((await list(3, '?filter=unread')).data).toEqual([])
    const empty = await list(6)
    expect(empty.data).toEqual([])
    expect(empty.meta).toMatchObject({ totalItems: 0, totalPages: 1, from: null, to: null })
    expect(empty.meta.counts).toEqual({ all: 0, unread: 0 })
    expect(await unreadCount(6)).toBe(0)
  })

  it('ignores unknown filter and type values', async () => {
    const body = await list(2, '?filter=zzz&type=zzz')
    expect(body.meta.totalItems).toBe(45)
  })
})

describe('#15 read-all', () => {
  it("marks the caller's items read, reports how many, and leaves others alone", async () => {
    dirty = true
    const res = await call('POST', '/api/me/notifications/read-all', 2)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { updated: 12 } })
    expect(await unreadCount(2)).toBe(0)
    expect(await unreadCount(1)).toBe(166)
    const again = await call('POST', '/api/me/notifications/read-all', 2)
    expect(again.body).toEqual({ data: { updated: 0 } })
    const body = await list(2)
    expect(body.meta.counts).toEqual({ all: 45, unread: 0 })
  })

  it('requires a session', async () => {
    expect((await call('POST', '/api/me/notifications/read-all', null)).status).toBe(401)
  })
})

describe('#16 mark one read', () => {
  it('reads an unread item, keeps the first readAt when repeated', async () => {
    dirty = true
    const target = (await list(2, '?filter=unread')).data[0]!
    const res = await call('POST', `/api/me/notifications/${String(target.id)}/read`, 2)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { success: true } })
    expect(await unreadCount(2)).toBe(11)
    const first = (await list(2, '?filter=read')).data.find((n) => n.id === target.id)!.readAt
    expect(first).not.toBeNull()
    clock.advance(5_000)
    await call('POST', `/api/me/notifications/${String(target.id)}/read`, 2)
    expect((await list(2, '?filter=read')).data.find((n) => n.id === target.id)!.readAt).toBe(first)
    expect(await unreadCount(2)).toBe(11)
  })

  it("404 for an unknown id or another user's item", async () => {
    const foreign = (await list(1)).data[0]!.id
    expect((await call('POST', `/api/me/notifications/${String(foreign)}/read`, 2)).status).toBe(
      404,
    )
    expect((await call('POST', '/api/me/notifications/999/read', 2)).status).toBe(404)
    expect(await unreadCount(1)).toBe(166)
  })
})

describe('#17 bulk-read', () => {
  it('marks the listed items read and ignores foreign or unknown ids', async () => {
    dirty = true
    const ids = (await list(2, '?filter=unread')).data.slice(0, 3).map((n) => n.id)
    const foreign = (await list(1)).data[0]!.id
    const res = await call('POST', '/api/me/notifications/bulk-read', 2, {
      ids: [...ids, foreign, 12345678],
    })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { success: true } })
    expect(await unreadCount(2)).toBe(9)
    expect(await unreadCount(1)).toBe(166)
  })

  it.each([
    [{}],
    [{ ids: [] }],
    [{ ids: 'x' }],
    [{ ids: [1, 'a'] }],
    [{ ids: [1.5] }],
    [{ ids: [2, 0.1] }],
    [{ ids: [null] }],
    [undefined],
  ])('422 for %j', async (body) => {
    const res = await call('POST', '/api/me/notifications/bulk-read', 2, body)
    expect(res.status).toBe(422)
    expect(
      (res.body as { error: { code: string; fields: Record<string, string> } }).error,
    ).toMatchObject({
      code: 'VALIDATION_ERROR',
    })
    expect(Object.keys((res.body as { error: { fields: object } }).error.fields)).toEqual(['ids'])
  })

  it('requires a session', async () => {
    expect((await call('POST', '/api/me/notifications/bulk-read', null, { ids: [1] })).status).toBe(
      401,
    )
  })
})

describe('#18 delete one', () => {
  it('deletes permanently and updates the counts', async () => {
    dirty = true
    const target = (await list(2, '?filter=unread')).data[0]!
    const res = await call('DELETE', `/api/me/notifications/${String(target.id)}`, 2)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { success: true } })
    const body = await list(2)
    expect(body.meta.counts).toEqual({ all: 44, unread: 11 })
    expect(body.data.some((n) => n.id === target.id)).toBe(false)
    expect((await call('DELETE', `/api/me/notifications/${String(target.id)}`, 2)).status).toBe(404)
  })

  it("404 for another user's item; nothing is deleted", async () => {
    const foreign = (await list(1)).data[0]!.id
    expect((await call('DELETE', `/api/me/notifications/${String(foreign)}`, 2)).status).toBe(404)
    expect((await list(1)).meta.counts.all).toBe(167)
  })
})

describe('#19 bulk-delete', () => {
  it("deletes the caller's listed items only", async () => {
    dirty = true
    const ids = (await list(2)).data.slice(0, 2).map((n) => n.id)
    const foreign = (await list(1)).data[0]!.id
    const res = await call('POST', '/api/me/notifications/bulk-delete', 2, {
      ids: [...ids, foreign],
    })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { success: true } })
    expect((await list(2)).meta.counts.all).toBe(43)
    expect((await list(1)).meta.counts.all).toBe(167)
  })

  it.each([[{ ids: [1.5] }], [{ ids: ['1'] }], [{ ids: [1, 2.5] }], [{ ids: 7 }], [undefined]])(
    '422 for non-integer ids %j',
    async (body) => {
      const res = await call('POST', '/api/me/notifications/bulk-delete', 2, body)
      expect(res.status).toBe(422)
    },
  )

  it('422 without ids', async () => {
    expect((await call('POST', '/api/me/notifications/bulk-delete', 2, { ids: [] })).status).toBe(
      422,
    )
  })
})

describe('hook pushNotification', () => {
  it('is registered by M01', () => {
    expect(Object.keys(m01.hooks)).toContain('pushNotification')
  })

  it('creates an unread item (badge +1) and dispatches the push event on window', async () => {
    dirty = true
    const seen: unknown[] = []
    const listener = (e: Event) => seen.push((e as CustomEvent).detail)
    const g = globalThis as unknown as { window?: EventTarget }
    const hadWindow = g.window !== undefined
    g.window ??= new EventTarget()
    g.window.addEventListener(NOTIFICATION_PUSH_EVENT, listener)
    try {
      const before = await unreadCount(2)
      const row = pushNotification(2, { title: 'Ujian', body: 'Push' }, undefined, clock)
      expect(row).toMatchObject({ userId: 2, readAt: null, category: 'system', title: 'Ujian' })
      expect(await unreadCount(2)).toBe(before + 1)
      const top = (await list(2)).data[0]!
      expect(top.id).toBe(row.id)
      expect(seen).toHaveLength(1)
      expect(seen[0]).toMatchObject({ userId: 2, notification: { id: row.id } })

      pushNotification(2, { title: 'Senyap', body: 'Tanpa push' }, { push: false }, clock)
      expect(seen).toHaveLength(1)
      expect(await unreadCount(2)).toBe(before + 2)
      // Runtime ids come after every seeded id.
      expect(row.id).toBeGreaterThan(Math.max(...buildNotificationSeed().map((r) => r.id)))
    } finally {
      g.window.removeEventListener(NOTIFICATION_PUSH_EVENT, listener)
      if (!hadWindow) delete g.window
    }
  })

  it('rejects a bad user id or category', () => {
    expect(() => pushNotification(0, { title: 'a', body: 'b' })).toThrow(RangeError)
    expect(() => pushNotification(2, { title: 'a', body: 'b', category: 'x' as never })).toThrow(
      RangeError,
    )
  })
})
