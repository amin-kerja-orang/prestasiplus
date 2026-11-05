/**
 * M22 endpoints #1-#4, the `new_ticket` notification, seeds, profiles and hooks (SRS M22 v1.1 §6, §7;
 * AC-M22-01…11). The real core with M01 and M22 at the project clock.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { TransportResponse } from '@/api/transport'
import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { issueSession } from '@/mock/core-data'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01, { notifications, users } from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'

import { TICKET_MESSAGES as MSG } from '../../api/types'
import m22 from '../../mock'
import { m22Hooks } from '../../mock/hooks'
import { NEW_TICKET_NOTIFICATION } from '../../mock/handlers/tickets'

const ADMIN = 1
const PELAJAR = 2
const PELAJAR2 = 3
const PELAJAR3 = 4
const GURU = 5
const SCHOOL_ADMIN = 8
const PPD = 9

let runtime: MockRuntime

beforeAll(async () => {
  runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m22],
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
}, 120_000)

beforeEach(async () => {
  await runtime.reset()
})

interface Answer<T = unknown> {
  status: number
  body: {
    data?: T
    meta?: {
      total: number
      counts?: { status: string; count: number }[]
      page?: number
      perPage?: number
      matched?: number
    }
    error?: { code: string; fields?: Record<string, string> }
  }
}

async function call<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT',
  url: string,
  as: number | null,
  body?: unknown,
): Promise<Answer<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (as !== null) {
    headers.authorization = `Bearer ${issueSession(users.get(as) as never, false, Date.parse(CLOCK_ANCHOR_ISO)).token}`
  }
  const res: TransportResponse = await runtime.transport.request({
    method,
    url,
    headers,
    ...(body === undefined ? {} : { body }),
  })
  return { status: res.status, body: res.body as Answer<T>['body'] }
}

interface TicketDto {
  id: number
  subject: string
  status: string
  statusLabel: string
  adminReply: string | null
}
interface QueueDto {
  id: number
  userName: string | null
  replied: boolean
  status: string
}

describe('seed (DL-M22-11)', () => {
  it('two dibuka tickets of users 3 and 4, in id descending order for each owner', async () => {
    const a = await call<TicketDto[]>('GET', '/api/tiket', PELAJAR2)
    expect(a.body.data?.map((t) => [t.id, t.subject, t.status, t.statusLabel])).toEqual([
      [1, 'Tidak dapat log masuk ke akaun', 'dibuka', 'Dibuka'],
    ])
    expect(a.body.meta).toEqual({ total: 1 })
    const b = await call<TicketDto[]>('GET', '/api/tiket', PELAJAR3)
    expect(b.body.data?.map((t) => t.id)).toEqual([2])
    expect(
      (await call<{ count: number }>('GET', '/api/admin/tiket/open-count', ADMIN)).body.data,
    ).toEqual({
      count: 2,
    })
  })
})

describe('#1 GET /api/tiket (AC-M22-02, 03, 06)', () => {
  it('401 for a guest; own scope only, userId ignored', async () => {
    expect((await call('GET', '/api/tiket', null)).status).toBe(401)
    const r = await call<TicketDto[]>('GET', '/api/tiket?userId=4', PELAJAR2)
    expect(r.body.data?.map((t) => t.id)).toEqual([1])
    const none = await call<TicketDto[]>('GET', '/api/tiket', PELAJAR)
    expect(none.body.data).toEqual([])
    expect(none.body.meta).toEqual({ total: 0 })
  })

  it('a known status filters (count stays), an unknown one means no filter', async () => {
    await runtime.reset({ ticketsProfile: 'tickets-extra' })
    const all = await call<TicketDto[]>('GET', '/api/tiket', PELAJAR)
    expect(all.body.data?.map((t) => t.id)).toEqual([8, 7, 6, 5, 4, 3])
    const done = await call<TicketDto[]>('GET', '/api/tiket?status=selesai', PELAJAR)
    expect(done.body.data?.map((t) => t.id)).toEqual([6])
    expect(done.body.meta).toEqual({ total: 6 })
    expect(done.body.data?.[0]?.adminReply).toBe(
      'Terima kasih. Isu anda telah dibetulkan.\nSila cuba semula.',
    )
    const bogus = await call<TicketDto[]>('GET', '/api/tiket?status=xyz', PELAJAR)
    expect(bogus.body.data).toHaveLength(6)
    expect(
      (await call<TicketDto[]>('GET', '/api/tiket', GURU)).body.data?.map((t) => t.id),
    ).toEqual([9])
  })
})

describe('#2 POST /api/tiket (AC-M22-04)', () => {
  it('creates a dibuka ticket for the session user and ignores forbidden keys', async () => {
    const r = await call<TicketDto & { createdAt: string }>('POST', '/api/tiket', PELAJAR, {
      subject: '  Ujian tiket  ',
      body: ' Butiran ujian ',
      userId: 3,
      status: 'selesai',
      adminReply: 'x',
      id: 77,
      createdAt: '2000-01-01T00:00:00+08:00',
    })
    expect(r.status).toBe(201)
    expect(r.body.data).toMatchObject({
      id: 3,
      subject: 'Ujian tiket',
      status: 'dibuka',
      adminReply: null,
    })
    expect(r.body.data?.createdAt).toBe('2026-09-25T15:40:00+08:00')
    const mine = await call<TicketDto[]>('GET', '/api/tiket', PELAJAR)
    expect(mine.body.data?.map((t) => t.id)).toEqual([3])
    expect((await call<TicketDto[]>('GET', '/api/tiket', PELAJAR2)).body.data).toHaveLength(1)
  })

  it('401 for a guest; 422 per field, trimmed, limits 255 and 5000', async () => {
    expect((await call('POST', '/api/tiket', null, { subject: 'a', body: 'b' })).status).toBe(401)
    const blank = await call('POST', '/api/tiket', PELAJAR, { subject: '   ', body: '' })
    expect(blank.status).toBe(422)
    expect(blank.body.error?.fields).toEqual({
      subject: MSG.subjectRequired,
      body: MSG.bodyRequired,
    })
    const edge = await call('POST', '/api/tiket', PELAJAR, {
      subject: 'a'.repeat(255),
      body: 'b'.repeat(5000),
    })
    expect(edge.status).toBe(201)
    const over = await call('POST', '/api/tiket', PELAJAR, {
      subject: 'a'.repeat(256),
      body: 'b'.repeat(5001),
    })
    expect(over.body.error?.fields).toEqual({
      subject: MSG.subjectTooLong,
      body: MSG.bodyTooLong,
    })
  })
})

describe('#3 and #4 admin queue (AC-M22-07, 08, 09)', () => {
  it('401 guest, 403 every other role, 200 admin', async () => {
    for (const url of ['/api/admin/tiket', '/api/admin/tiket/open-count']) {
      expect((await call('GET', url, null)).status).toBe(401)
      for (const who of [PELAJAR, GURU, SCHOOL_ADMIN, PPD]) {
        expect((await call('GET', url, who)).status).toBe(403)
      }
      expect((await call('GET', url, ADMIN)).status).toBe(200)
    }
  })

  it('rows newest first without body or e-mail, counts over all in vocabulary order', async () => {
    await runtime.reset({ ticketsProfile: 'tickets-extra' })
    const r = await call<QueueDto[]>('GET', '/api/admin/tiket', ADMIN)
    expect(r.body.meta?.total).toBe(9)
    expect(r.body.meta?.counts).toEqual([
      { status: 'dibuka', count: 5 },
      { status: 'dalam_proses', count: 1 },
      { status: 'menunggu_balas', count: 1 },
      { status: 'selesai', count: 1 },
      { status: 'ditutup', count: 1 },
    ])
    expect(r.body.data?.map((t) => t.id)).toEqual([2, 9, 8, 1, 7, 6, 5, 4, 3])
    expect(Object.keys(r.body.data?.[0] ?? {}).sort()).toEqual(
      ['createdAt', 'id', 'replied', 'roleLabel', 'school', 'status', 'subject', 'userName'].sort(),
    )
    expect(r.body.data?.find((t) => t.id === 6)?.replied).toBe(true)
    expect(r.body.data?.find((t) => t.id === 3)?.replied).toBe(false)
    const f = await call<QueueDto[]>('GET', '/api/admin/tiket?status=selesai', ADMIN)
    expect(f.body.data?.map((t) => t.id)).toEqual([6])
    expect(f.body.meta?.total).toBe(9)
    expect((await call<QueueDto[]>('GET', '/api/admin/tiket?status=xyz', ADMIN)).body.data).toEqual(
      [],
    )
  })

  it('tickets-many: 25 rows per page, matched and counts over all 205, all five chips', async () => {
    await runtime.reset({ ticketsProfile: 'tickets-many' })
    const r = await call<QueueDto[]>('GET', '/api/admin/tiket', ADMIN)
    expect(r.body.data).toHaveLength(25)
    expect(r.body.meta).toMatchObject({ total: 205, matched: 205, page: 1, perPage: 25 })
    expect(r.body.meta?.counts).toEqual([
      { status: 'dibuka', count: 205 },
      { status: 'dalam_proses', count: 0 },
      { status: 'menunggu_balas', count: 0 },
      { status: 'selesai', count: 0 },
      { status: 'ditutup', count: 0 },
    ])
    expect(r.body.data?.[0]?.id).toBe(2)
    const second = await call<QueueDto[]>('GET', '/api/admin/tiket?page=2', ADMIN)
    expect(second.body.meta?.page).toBe(2)
    expect(second.body.data?.some((t) => r.body.data?.some((f) => f.id === t.id))).toBe(false)
    expect((await call('GET', '/api/admin/tiket?page=abc', ADMIN)).body.meta?.page).toBe(1)
    expect((await call('GET', '/api/admin/tiket?page=99', ADMIN)).body.data).toEqual([])
  })

  it('the role filter narrows rows, matched, total and chips; an unknown role is ignored', async () => {
    const all = await call<QueueDto[]>('GET', '/api/admin/tiket', ADMIN)
    const teachers = await call<QueueDto[]>('GET', '/api/admin/tiket?role=teacher', ADMIN)
    expect(teachers.body.meta).toMatchObject({ total: 0, matched: 0 })
    expect(teachers.body.data).toEqual([])
    const pupils = await call<QueueDto[]>('GET', '/api/admin/tiket?role=student', ADMIN)
    expect(pupils.body.meta?.total).toBe(all.body.meta?.total)
    expect((await call('GET', '/api/admin/tiket?role=zzz', ADMIN)).body.meta?.total).toBe(all.body.meta?.total)
  })

  it('API-SUP-05: a reply replaces the single reply and keeps the status; the owner sees it', async () => {
    const saved = await call<{ adminReply: string; status: string; repliedAt: string | null }>('PUT', '/api/admin/tiket/1/reply', ADMIN, { text: ' Baik. ' })
    expect(saved.status).toBe(200)
    expect(saved.body.data).toMatchObject({ adminReply: 'Baik.', status: 'dibuka' })
    expect(saved.body.data?.repliedAt).toBeTruthy()
    expect((await call('PUT', '/api/admin/tiket/1/reply', ADMIN, { text: '  ' })).body.error?.fields).toEqual({ text: 'Sila tulis balasan.' })
    expect((await call('PUT', '/api/admin/tiket/1/reply', ADMIN, { text: 'x'.repeat(5001) })).status).toBe(422)
    expect((await call('PUT', '/api/admin/tiket/999/reply', ADMIN, { text: 'x' })).status).toBe(404)
    expect((await call('PUT', '/api/admin/tiket/1/reply', 3, { text: 'x' })).status).toBe(403)
    const queue = await call<QueueDto[]>('GET', '/api/admin/tiket', ADMIN)
    expect(queue.body.data?.find((t) => t.id === 1)?.replied).toBe(true)
  })

  it('API-SUP-05: detail and status, reply untouched; 403, 404 and 422 as on the server', async () => {
    await runtime.reset({ ticketsProfile: 'tickets-extra' })
    const d = await call<{ status: string; body: string; adminReply: string | null }>('GET', '/api/admin/tiket/6', ADMIN)
    expect(d.status).toBe(200)
    expect(d.body.data).toMatchObject({ id: 6, status: 'selesai' })
    expect(Object.keys(d.body.data ?? {})).toEqual(expect.arrayContaining(['roleLabel', 'school', 'repliedAt']))
    const reply = d.body.data?.adminReply
    const moved = await call<{ status: string; adminReply: string | null }>('PATCH', '/api/admin/tiket/6/status', ADMIN, { status: 'ditutup' })
    expect(moved.status).toBe(200)
    expect(moved.body.data).toMatchObject({ status: 'ditutup', adminReply: reply })
    expect((await call('PATCH', '/api/admin/tiket/6/status', ADMIN, { status: 'baru' })).body.error?.fields).toEqual({
      status: 'Data yang dihantar tidak sah. Sila semak dan cuba lagi.',
    })
    expect((await call('GET', '/api/admin/tiket/999', ADMIN)).status).toBe(404)
    expect((await call('PATCH', '/api/admin/tiket/999/status', ADMIN, { status: 'selesai' })).status).toBe(404)
    expect((await call('GET', '/api/admin/tiket/6', 3)).status).toBe(403)
    expect((await call('PATCH', '/api/admin/tiket/6/status', 3, { status: 'dibuka' })).status).toBe(403)
  })

  it('an orphan owner has a null name; an empty store gives zero', async () => {
    m22Hooks.orphanTicketOwner(1)
    const r = await call<QueueDto[]>('GET', '/api/admin/tiket', ADMIN)
    expect(r.body.data?.find((t) => t.id === 1)?.userName).toBeNull()
    expect(r.body.data?.find((t) => t.id === 2)?.userName).toBe(users.get(PELAJAR3)?.name)
    m22Hooks.clearTickets()
    expect(
      (await call<{ count: number }>('GET', '/api/admin/tiket/open-count', ADMIN)).body.data,
    ).toEqual({ count: 0 })
  })
})

describe('new_ticket notification (AC-M22-10)', () => {
  it('one unread item per active admin; nobody else; a refused create notifies nobody', async () => {
    const before = (id: number) => notifications.unreadCount(id)
    const admin0 = before(ADMIN)
    const inactive = m22Hooks.addAdminUser({ isActive: false }) as { id: number }
    const second = m22Hooks.addAdminUser({ isActive: true }) as { id: number }
    const base = { guru: before(GURU), sa: before(SCHOOL_ADMIN), me: before(PELAJAR) }
    await call('POST', '/api/tiket', PELAJAR, { subject: '', body: '' })
    expect(before(ADMIN)).toBe(admin0)
    await call('POST', '/api/tiket', PELAJAR, { subject: 'Ujian', body: 'Isi' })
    expect(before(ADMIN)).toBe(admin0 + 1)
    expect(before(second.id)).toBe(1)
    expect(before(inactive.id)).toBe(0)
    expect(before(GURU)).toBe(base.guru)
    expect(before(SCHOOL_ADMIN)).toBe(base.sa)
    expect(before(PELAJAR)).toBe(base.me)
    expect(NEW_TICKET_NOTIFICATION).toMatchObject({
      type: 'new_ticket',
      title: 'Tiket baru',
      category: null,
    })
  })
})

describe('hooks and overrides', () => {
  it('setTicketState gives a reply or status; bad input throws', async () => {
    m22Hooks.setTicketState(1, { status: 'selesai', adminReply: 'Sudah.' })
    const r = await call<TicketDto[]>('GET', '/api/tiket', PELAJAR2)
    expect(r.body.data?.[0]).toMatchObject({ status: 'selesai', adminReply: 'Sudah.' })
    expect(() => m22Hooks.setTicketState(1, { status: 'nope' as never })).toThrow(RangeError)
    expect(() => m22Hooks.setTicketState(999, {})).toThrow(RangeError)
  })

  it('m22LoadProfile adds the rows at run time; an unknown profile or override is refused', async () => {
    m22Hooks.m22LoadProfile('tickets-extra')
    expect((await call<TicketDto[]>('GET', '/api/tiket', PELAJAR)).body.data).toHaveLength(6)
    expect(() => m22Hooks.m22LoadProfile('x')).toThrow(RangeError)
    await expect(runtime.reset({ ticketsProfile: 'nope' })).rejects.toThrow()
  })
})
