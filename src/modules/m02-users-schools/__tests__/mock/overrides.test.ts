/**
 * M02 test-only reset overrides (SRS §12): `mock.reset({comp: n})` (E2E-M02-38, S6 empty list) and the
 * profile `subscriptions-extra` (E2E-M02-54, the grace row "Tempoh Ihsan").
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createClock } from '@/lib/time'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m10 from '@/modules/m10-teacher-class/mock'

import type { CompStudentCounts, CompStudentListItem } from '../../api/comp-students'
import type {
  SubscriptionCounts,
  SubscriptionDetail,
  SubscriptionListItem,
} from '../../api/subscriptions'
import m02, { schoolSubscriptions } from '../../mock'
import { ADMIN, NOW, callAs, type ListBody } from './helpers'

const boot = () =>
  bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m10],
    clock: createClock({ at: NOW }),
    latencyMs: 0,
    onWarn: null,
  })

let runtime: MockRuntime
let call: ReturnType<typeof callAs>

beforeAll(async () => {
  runtime = await boot()
  call = callAs(runtime)
}, 180_000)

afterAll(async () => {
  await runtime.reset()
})

type CompList = ListBody<CompStudentListItem, { counts: CompStudentCounts }>
const comp = () => call<CompList>('GET', '/api/admin/comp-students', ADMIN)
const subs = () =>
  call<ListBody<SubscriptionListItem, { counts: SubscriptionCounts }>>(
    'GET',
    '/api/admin/school-subscriptions',
    ADMIN,
  )

describe('override `comp` (E2E-M02-38)', () => {
  it('the default seed has all 90', async () => {
    expect((await comp()).body.meta.counts).toEqual({ coinsOff: 90, total: 90 })
  })

  it('reset({comp: 0}) empties S6 (no rows, from null) and hides the detail and actions', async () => {
    await runtime.reset({ comp: 0 })
    const res = await comp()
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
    expect(res.body.meta).toMatchObject({ totalItems: 0, from: null, to: null })
    expect(res.body.meta.counts).toEqual({ coinsOff: 0, total: 0 })
    expect((await call('GET', '/api/admin/comp-students/5901', ADMIN)).status).toBe(404)
    expect((await call('POST', '/api/admin/comp-students/5901/toggle-coins', ADMIN)).status).toBe(
      404,
    )
    const bulk = await call<{ data: { updated: number } }>(
      'POST',
      '/api/admin/comp-students/bulk-action',
      ADMIN,
      {
        action: 'coins_on',
        ids: [5901],
      },
    )
    expect(bulk.body.data.updated).toBe(0)
  })

  it('a student registered afterwards is the only one listed', async () => {
    const res = await call('POST', '/api/admin/comp-students', ADMIN, {
      classroomId: 2011,
      packageExpiresAt: '2026-12-31',
      students: 'PELAJAR DEMO F, 091010101010',
    })
    expect(res.status).toBe(201)
    const list = await comp()
    expect(list.body.meta.counts).toEqual({ coinsOff: 1, total: 1 })
    expect(list.body.data).toHaveLength(1)
  })

  it('reset({comp: 5}) keeps the first five; a later plain reset restores 90', async () => {
    await runtime.reset({ comp: 5 })
    const res = await comp()
    expect(res.body.data.map((r) => r.id).sort()).toEqual([5901, 5902, 5903, 5904, 5905])
    expect(res.body.meta.counts.total).toBe(5)
    expect((await call('GET', '/api/admin/comp-students/5906', ADMIN)).status).toBe(404)
    expect((await call('GET', '/api/admin/comp-students/5905', ADMIN)).status).toBe(200)
    await runtime.reset()
    expect((await comp()).body.meta.counts.total).toBe(90)
  })

  it.each([-1, 91, 1.5, '0', null])('rejects comp = %j', async (value) => {
    await expect(runtime.reset({ comp: value })).rejects.toThrow(/override 'comp'/)
    await runtime.reset()
  })
})

describe("profile 'subscriptions-extra' (E2E-M02-54)", () => {
  it('adds exactly one grace row at 900001; the observed rows stay', async () => {
    await runtime.reset({ profile: 'subscriptions-extra' })
    const res = await subs()
    expect(res.body.data).toHaveLength(15)
    expect(res.body.meta.counts).toEqual({ active: 9, grace: 1, expired: 1, totalQuota: 5738 })
    const row = res.body.data.find((r) => r.status === 'grace')!
    expect(row).toMatchObject({ id: 16, packageTier: 'full', studentQuota: 100, formLevel: 't5' })
    expect(row.school).toMatchObject({ id: 900_001, name: 'SMK DEMO', code: 'BEA4001' })
    expect(schoolSubscriptions.countByStatus()).toEqual({
      active: 9,
      grace: 1,
      expired: 1,
      cancelled: 4,
    })
    const d = await call<{ data: SubscriptionDetail }>(
      'GET',
      '/api/admin/school-subscriptions/16',
      ADMIN,
    )
    expect(d.status).toBe(200)
    expect(d.body.data.status).toBe('grace')
  })

  it('the grace row grants the quota of its school (BR-16 INFERRED)', async () => {
    const q = await call<{ data: unknown }>('GET', '/api/admin/schools/900001/quota', ADMIN)
    expect(q.body.data).toMatchObject({ hasSubscription: true, quota: 100 })
  })

  it('a plain reset removes the profile again', async () => {
    await runtime.reset()
    expect((await subs()).body.data).toHaveLength(14)
    expect(schoolSubscriptions.countByStatus().grace).toBe(0)
  })

  it('rejects an unknown profile; both overrides combine', async () => {
    await expect(runtime.reset({ profile: 'other' })).rejects.toThrow(/override 'profile'/)
    await runtime.reset({ profile: 'subscriptions-extra', comp: 0 })
    expect((await comp()).body.meta.counts.total).toBe(0)
    expect((await subs()).body.meta.counts.grace).toBe(1)
    await runtime.reset()
  })
})
