/**
 * M02-T3: school subscriptions, packages and the renewal invoice (SRS v1.28 §7 #29–#37, #42; BR-22…BR-31),
 * the 14 observed rows (§6.14), the totals (DV-08), extend / upgrade / cancel, the per-page behaviour
 * (DV-11) and the quota seam to the T2 rules (XR-M02-T2-01; E2E-M02-31 anchors).
 */

import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'

import type { ImportResponse } from '../../api/imports'
import type {
  RenewalInvoice,
  SchoolPackage,
  SubscriptionDetail,
  SubscriptionListItem,
  SubscriptionCounts,
  SubscriptionStudent,
} from '../../api/subscriptions'
import { schoolSubscriptions } from '../../mock'
import { addMonthsMyt } from '../../mock/repository/subscriptions'
import { IMPORT_NO_SUBSCRIPTION, IMPORT_QUOTA_SHORT } from '../../mock/handlers/imports'
import {
  MSG_ALREADY_CANCELLED,
  MSG_CANCELLED,
  MSG_EXTENDED,
  MSG_NOT_BASIC,
  MSG_QUOTA_UPDATED,
  MSG_SUBSCRIPTION_CREATED,
  MSG_UPGRADED,
} from '../../mock/handlers/subscriptions'
import {
  ADMIN,
  ADMIN_SEKOLAH,
  GURU,
  IBU_BAPA,
  PELAJAR,
  callAs,
  type ErrorBody,
  type ListBody,
} from './helpers'
import { bootM02Full } from './helpers-t3'

let runtime: MockRuntime
let call: ReturnType<typeof callAs>
let dirty = false

beforeAll(async () => {
  runtime = await bootM02Full()
  call = callAs(runtime)
}, 180_000)

afterEach(async () => {
  if (dirty) await runtime.reset()
  dirty = false
})

const BASE = '/api/admin/school-subscriptions'
type Listing = ListBody<SubscriptionListItem, { counts: SubscriptionCounts }>
type Mutation = { data: SubscriptionDetail; status: string }

const list = (query = '') => call<Listing>('GET', `${BASE}${query}`, ADMIN)
const detail = (id: number) =>
  call<{ data: SubscriptionDetail }>('GET', `${BASE}/${String(id)}`, ADMIN)
const fields = (r: { body: unknown }) => (r.body as ErrorBody).error.fields ?? {}

/** The observed `used` of §6.14 / BR-24, by school. */
const OBSERVED_USED: Record<number, number> = {
  8277: 150,
  8880: 59,
  8102: 776,
  8082: 549,
  10220: 2,
  8106: 562,
  8078: 423,
  8080: 185,
  8090: 386,
  8087: 312,
  8107: 675,
  8228: 13,
}

describe('admin guards (FR-M02-99)', () => {
  const endpoints: ['GET' | 'POST' | 'PUT', string][] = [
    ['GET', BASE],
    ['GET', '/api/admin/school-packages'],
    ['POST', BASE],
    ['GET', `${BASE}/10`],
    ['GET', `${BASE}/10/students`],
    ['PUT', `${BASE}/10/quota`],
    ['POST', `${BASE}/10/extend`],
    ['POST', `${BASE}/10/upgrade`],
    ['POST', `${BASE}/10/cancel`],
    ['GET', `${BASE}/10/renewal-invoice`],
  ]
  it.each(endpoints)('%s %s: guest 401, other roles 403', async (method, url) => {
    const body = method === 'GET' ? undefined : {}
    expect((await call(method, url, null, body)).status).toBe(401)
    for (const as of [PELAJAR, GURU, IBU_BAPA, ADMIN_SEKOLAH]) {
      const res = await call<ErrorBody>(method, url, as, body)
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('FORBIDDEN')
    }
  })
})

describe('the seed: 14 observed subscriptions (§6.14)', () => {
  it('has the observed ids (no id 3), tiers, quotas and statuses', () => {
    const rows = schoolSubscriptions.all()
    expect(rows.map((r) => r.id)).toEqual([15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 2, 1])
    const by = (id: number) => rows.find((r) => r.id === id)!
    expect([by(10).schoolId, by(10).packageTier, by(10).studentQuota, by(10).status]).toEqual([
      8106,
      'full',
      500,
      'active',
    ])
    expect(by(10).notes).toBe('[Naik taraf Pemantauan → Penuh pada 08/05/2026 03:09]')
    expect(by(14).notes).toBe(
      'Demo subscription added 2026-05-12 - school had data but no subscription, dashboard hidden',
    )
    expect(by(4).status).toBe('expired')
    expect(by(2).schoolPackageId).toBe(1)
    expect(by(1).schoolPackageId).toBe(1)
    expect(by(15).questionLimit).toBe(500)
    expect(by(12).questionLimit).toBeNull()
  })

  it('reproduces the M19 contract of v1.22: countByStatus 9 · 0 · 1 · 4, activeByPackage', () => {
    expect(schoolSubscriptions.countByStatus()).toEqual({
      active: 9,
      grace: 0,
      expired: 1,
      cancelled: 4,
    })
    expect(schoolSubscriptions.activeByPackage()).toEqual([
      { packageId: 2, name: 'Pakej SPM Tingkatan 5', count: 9 },
    ])
  })
})

describe('#29 GET /api/admin/school-subscriptions (S12)', () => {
  it('lists all 14 rows newest first with the observed stat cards (DV-08 totals)', async () => {
    const res = await list()
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(14)
    expect(res.body.data.map((r) => r.id)).toEqual([15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 2, 1])
    // Not paginated; totalQuota = the 9 ACTIVE rows only (5,738).
    expect(res.body.meta.counts).toEqual({ active: 9, grace: 0, expired: 1, totalQuota: 5738 })
    expect(res.body.meta.totalPages).toBe(1)
    expect(res.body.meta.totalItems).toBe(14)
  })

  it('computes `used` from the students of each school (BR-24): the 12 observed values, Σ 4,092', async () => {
    const res = await list()
    const usedBySchool = new Map<number, number>()
    for (const r of res.body.data) {
      usedBySchool.set(r.school.id, r.used)
      expect(r.used, `school ${String(r.school.id)}`).toBe(OBSERVED_USED[r.school.id])
    }
    expect([...usedBySchool.values()].reduce((a, b) => a + b, 0)).toBe(4092)
  })

  it('shapes a row: school name and code, form level, tier, quota, status, dates', async () => {
    const row = (await list()).body.data.find((r) => r.id === 10)!
    expect(row).toMatchObject({
      id: 10,
      school: { id: 8106, name: 'SEKOLAH MENENGAH KEBANGSAAN BANDAR RINCHING', code: 'BEA4632' },
      formLevel: 't5',
      packageTier: 'full',
      used: 562,
      studentQuota: 500,
      status: 'active',
    })
    expect(row.startsAt).toBe('2026-04-21T09:00:00+08:00')
    expect(row.endsAt).toBe('2027-05-08T03:09:00+08:00')
    expect((await list()).body.data.find((r) => r.id === 1)?.formLevel).toBe('t4')
  })

  it('filters by status, form level and school name / code; the stat cards ignore the filters', async () => {
    const cancelled = await list('?status=cancelled')
    expect(cancelled.body.data.map((r) => r.id)).toEqual([13, 5, 2, 1])
    expect(cancelled.body.meta.counts.active).toBe(9)
    expect((await list('?formLevel=t4')).body.data.map((r) => r.id)).toEqual([2, 1])
    expect((await list('?formLevel=t5')).body.data).toHaveLength(12)
    expect((await list('?search=bandar%20rinching')).body.data.map((r) => r.id)).toEqual([10])
    expect((await list('?search=bea4632')).body.data.map((r) => r.id)).toEqual([10])
    expect((await list('?status=expired&formLevel=t5')).body.data.map((r) => r.id)).toEqual([4])
    expect((await list('?status=grace')).body.data).toEqual([])
    expect((await list('?status=nonsense')).body.data).toEqual([])
    expect((await list('?search=zzz')).body.data).toEqual([])
  })
})

describe('#30 GET /api/admin/school-packages', () => {
  it('returns the 4 packages of BR-22', async () => {
    const res = await call<{ data: SchoolPackage[] }>('GET', '/api/admin/school-packages', ADMIN)
    expect(res.status).toBe(200)
    expect(res.body.data.map((p) => [p.id, p.code, p.name, p.maxRenewals, p.priceAnnual])).toEqual([
      [1, 'T4', 'Pakej SPM Tingkatan 4', 1, '30.00'],
      [2, 'T5', 'Pakej SPM Tingkatan 5', 0, '30.00'],
      [3, 'D1_D6', 'Pakej Rendah (Darjah 1-6)', 5, '30.00'],
      [4, 'T1_T3', 'Pakej Menengah Rendah (Tingkatan 1-3)', 2, '30.00'],
    ])
    expect(res.body.data[0]).toMatchObject({
      slug: 'spm-t4',
      educationLevel: 'spm',
      formLevel: 't4',
      isActive: true,
    })
  })
})

describe('#31 POST /api/admin/school-subscriptions (S13, BR-31)', () => {
  const body = (over: Record<string, unknown> = {}) => ({
    schoolId: 987,
    packageTier: 'full',
    schoolPackageId: 3,
    studentQuota: 100,
    ...over,
  })
  const create = (b: unknown, as = ADMIN) => call<Mutation | ErrorBody>('POST', BASE, as, b)

  it('creates a full subscription: active, starts now, ends in 1 year, unlimited questions', async () => {
    dirty = true
    const res = await create(body({ paymentReference: ' TT-1 ', paymentNotes: 'Bank transfer' }))
    expect(res.status).toBe(201)
    const { data, status } = res.body as Mutation
    expect(status).toBe(MSG_SUBSCRIPTION_CREATED)
    expect(data.id).toBeGreaterThanOrEqual(1000)
    expect(data).toMatchObject({
      schoolId: 987,
      schoolPackageId: 3,
      packageTier: 'full',
      studentQuota: 100,
      status: 'active',
      startsAt: '2026-09-25T15:40:00+08:00',
      endsAt: '2027-09-25T15:40:00+08:00',
      questionLimit: null,
      paymentReference: 'TT-1',
      paymentNotes: 'Bank transfer',
      notes: null,
      formLevel: 'd1_d6',
    })
    expect(data.school.name).toBe('SEKOLAH KEBANGSAAN BANDAR BARU BANGI')
    expect(data.package.code).toBe('D1_D6')
    // It appears in S12 with the totals moved (DV-08): 10 active, 5,738 + 100.
    const after = await list()
    expect(after.body.data[0]?.id).toBe(data.id)
    expect(after.body.meta.counts).toEqual({ active: 10, grace: 0, expired: 1, totalQuota: 5838 })
    // The runtime row is the next id from 1000 and never collides with the observed ones.
    expect((await detail(data.id)).status).toBe(200)
  })

  it('creates a basic subscription: ends in 1 month, 500 questions per month (DV-M02-08)', async () => {
    dirty = true
    const res = await create(
      body({ packageTier: 'basic', schoolPackageId: '2', schoolId: '987', studentQuota: '50' }),
    )
    expect(res.status).toBe(201)
    expect((res.body as Mutation).data).toMatchObject({
      packageTier: 'basic',
      studentQuota: 50,
      endsAt: '2026-10-25T15:40:00+08:00',
      questionLimit: 500,
    })
  })

  it('ends the term on the last day of a shorter month', () => {
    // The calendar helper, checked with a 31 January and a 29 February start.
    const jan31 = Date.parse('2027-01-31T10:00:00+08:00')
    expect(new Date(addMonthsMyt(jan31, 1)).toISOString()).toBe('2027-02-28T02:00:00.000Z')
    expect(new Date(addMonthsMyt(Date.parse('2028-02-29T10:00:00+08:00'), 12)).toISOString()).toBe(
      '2029-02-28T02:00:00.000Z',
    )
  })

  it('422 without the required fields', async () => {
    const res = await create({})
    expect(res.status).toBe(422)
    expect(Object.keys(fields(res)).sort()).toEqual(
      ['packageTier', 'schoolId', 'schoolPackageId', 'studentQuota'].sort(),
    )
  })

  it.each([
    ['school does not exist', { schoolId: 99_999_999 }, 'schoolId'],
    ['school is inactive (8277)', { schoolId: 8277 }, 'schoolId'],
    ['unknown tier', { packageTier: 'gold' }, 'packageTier'],
    ['unknown package', { schoolPackageId: 99 }, 'schoolPackageId'],
    ['quota 0', { studentQuota: 0 }, 'studentQuota'],
    ['quota 2001 (DV-M02-07)', { studentQuota: 2001 }, 'studentQuota'],
    ['quota not a number', { studentQuota: 'abc' }, 'studentQuota'],
    ['quota fractional', { studentQuota: 10.5 }, 'studentQuota'],
  ])('422 when %s', async (_label, over, field) => {
    const res = await create(body(over))
    expect(res.status).toBe(422)
    expect(Object.keys(fields(res))).toContain(field)
    expect(schoolSubscriptions.all()).toHaveLength(14)
  })

  it('accepts the quota limits 1 and 2000', async () => {
    dirty = true
    expect((await create(body({ studentQuota: 1 }))).status).toBe(201)
    expect((await create(body({ studentQuota: 2000 }))).status).toBe(201)
  })
})

describe('#32 GET /api/admin/school-subscriptions/:id (S14)', () => {
  it('returns subscription 10 with its school, package and the usage figures (BR-25)', async () => {
    const res = await detail(10)
    expect(res.status).toBe(200)
    const d = res.body.data
    expect(d).toMatchObject({
      id: 10,
      schoolId: 8106,
      used: 562,
      studentQuota: 500,
      remaining: 0,
      usedPercent: 100,
      packageTier: 'full',
      questionLimit: null,
      formLevel: 't5',
    })
    expect(d.school).toMatchObject({ id: 8106, code: 'BEA4632' })
    expect(d.package).toMatchObject({ id: 2, name: 'Pakej SPM Tingkatan 5', priceAnnual: '30.00' })
  })

  it('reproduces the observed 15% and 100% bars and Baki', async () => {
    // 8880: 59 / 1000 = 6%; 8277: 150 / 1000 = 15% (observed), 150 / 150 = 100% (sub 5, remaining 0).
    expect((await detail(14)).body.data).toMatchObject({
      used: 150,
      usedPercent: 15,
      remaining: 850,
    })
    expect((await detail(5)).body.data).toMatchObject({ used: 150, usedPercent: 100, remaining: 0 })
    expect((await detail(9)).body.data).toMatchObject({ used: 423, usedPercent: 100, remaining: 0 })
  })

  it('serves cancelled, expired and basic variants (FR-M02-91)', async () => {
    expect((await detail(13)).body.data.status).toBe('cancelled')
    expect((await detail(4)).body.data.status).toBe('expired')
    expect((await detail(15)).body.data).toMatchObject({ packageTier: 'basic', questionLimit: 500 })
  })

  it('404 for id 3 (no such row, as live) and unknown ids', async () => {
    expect((await detail(3)).status).toBe(404)
    expect((await detail(99_999)).status).toBe(404)
  })
})

describe('#33 GET …/:id/students (S14 list, DV-M02-11)', () => {
  const students = (id: number, query = '') =>
    call<ListBody<SubscriptionStudent>>('GET', `${BASE}/${String(id)}/students${query}`, ADMIN)

  it('pages 50 by default and reports the size actually used', async () => {
    const res = await students(13)
    expect(res.status).toBe(200)
    expect(res.body.meta).toMatchObject({
      page: 1,
      pageSize: 50,
      totalItems: 776,
      totalPages: 16,
      from: 1,
      to: 50,
    })
    expect(res.body.data).toHaveLength(50)
    expect(Object.keys(res.body.data[0] as object).sort()).toEqual(
      ['classLevel', 'id', 'idDelima', 'name'].sort(),
    )
  })

  it.each([25, 50, 100, 200])('perPage=%i is honoured', async (n) => {
    const res = await students(13, `?perPage=${String(n)}`)
    expect(res.body.meta.pageSize).toBe(n)
    expect(res.body.data).toHaveLength(n)
  })

  it('an unsupported perPage answers 50', async () => {
    expect((await students(13, '?perPage=30')).body.meta.pageSize).toBe(50)
    expect((await students(13, '?perPage=abc')).body.meta.pageSize).toBe(50)
    expect((await students(13, '?perPage=500')).body.meta.pageSize).toBe(50)
  })

  it('pages: page 2 at 200 starts at 201; the last page holds the rest', async () => {
    const p2 = await students(13, '?perPage=200&page=2')
    expect(p2.body.meta).toMatchObject({ page: 2, from: 201, to: 400 })
    const last = await students(13, '?page=16')
    expect(last.body.meta).toMatchObject({ from: 751, to: 776 })
    expect(last.body.data).toHaveLength(26)
    const beyond = await students(13, '?page=17')
    expect(beyond.body.data).toEqual([])
    expect(beyond.body.meta.from).toBeNull()
  })

  it('lists the students of the subscription school, by name, without duplicates', async () => {
    const all = await students(10, '?perPage=200')
    const names = all.body.data.map((s) => s.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    // 8106 has 562 students (BR-24): ceil(562 / 200) = 3 pages.
    expect(all.body.meta.totalItems).toBe(562)
    expect(all.body.meta.totalPages).toBe(3)
  })

  it('404 for an unknown subscription', async () => {
    expect((await students(3)).status).toBe(404)
  })
})

describe('#34 PUT …/:id/quota (BR-26)', () => {
  const put = (id: number, b: unknown) =>
    call<Mutation | ErrorBody>('PUT', `${BASE}/${String(id)}/quota`, ADMIN, b)

  it('changes the quota and appends the reason to the notes', async () => {
    dirty = true
    const res = await put(12, { studentQuota: 1200, notes: 'Tambahan pelajar' })
    expect(res.status).toBe(200)
    const { data, status } = res.body as Mutation
    expect(status).toBe(MSG_QUOTA_UPDATED)
    expect(data.studentQuota).toBe(1200)
    expect(data.remaining).toBe(1200 - 549)
    expect(data.notes).toBe('[Kuota 1000 → 1200 pada 25/09/2026 15:40] Tambahan pelajar')
    expect(data.updatedAt).toBe('2026-09-25T15:40:00+08:00')
    // Without a reason the notes are left alone.
    const again = await put(12, { studentQuota: 1300 })
    expect((again.body as Mutation).data.notes).toBe(data.notes)
    // The S12 total follows (active rows only).
    expect((await list()).body.meta.counts.totalQuota).toBe(5738 + 300)
  })

  it('appends to existing notes', async () => {
    dirty = true
    const res = await put(14, { studentQuota: 1001, notes: 'x' })
    expect((res.body as Mutation).data.notes?.split('\n')).toEqual([
      'Demo subscription added 2026-05-12 - school had data but no subscription, dashboard hidden',
      '[Kuota 1000 → 1001 pada 25/09/2026 15:40] x',
    ])
  })

  it.each([0, 2001, -5, 'abc', 12.5, null])('422 for quota %s', async (q) => {
    const res = await put(12, { studentQuota: q })
    expect(res.status).toBe(422)
    expect(Object.keys(fields(res))).toContain('studentQuota')
  })

  it('allows the limits 1 and 2000 and works on a cancelled subscription (FR-M02-91)', async () => {
    dirty = true
    expect((await put(13, { studentQuota: 1 })).status).toBe(200)
    expect((await put(13, { studentQuota: 2000 })).status).toBe(200)
  })

  it('404 for an unknown subscription', async () => {
    expect((await put(3, { studentQuota: 10 })).status).toBe(404)
  })
})

describe('#35 POST …/:id/extend (BR-28)', () => {
  const extend = (id: number, b: unknown) =>
    call<Mutation | ErrorBody>('POST', `${BASE}/${String(id)}/extend`, ADMIN, b)

  it('adds the days to the end date and keeps an active subscription active', async () => {
    dirty = true
    const res = await extend(12, { days: 30, reason: 'Kelewatan bayaran' })
    expect(res.status).toBe(200)
    const { data, status } = res.body as Mutation
    expect(status).toBe(MSG_EXTENDED)
    expect(data.endsAt).toBe('2027-06-11T09:00:00+08:00')
    expect(data.status).toBe('active')
    expect(data.notes).toBe('[Dilanjutkan 30 hari pada 25/09/2026 15:40] Kelewatan bayaran')
  })

  it('accepts the presets 7 · 14 · 30 · 60 · 90 · 180 · 365 days', async () => {
    dirty = true
    let expected = Date.parse('2027-05-12T09:00:00+08:00')
    for (const days of [7, 14, 30, 60, 90, 180, 365]) {
      const res = await extend(12, { days })
      expect(res.status).toBe(200)
      expected += days * 86_400_000
      expect(Date.parse((res.body as Mutation).data.endsAt)).toBe(expected)
    }
  })

  it.each([0, 366, -1, 'abc', 1.5, null])('422 for days %s', async (days) => {
    const res = await extend(12, { days })
    expect(res.status).toBe(422)
    expect(Object.keys(fields(res))).toContain('days')
  })

  it('re-activates an expired subscription only when the new end lies in the future', async () => {
    dirty = true
    // Subscription 4 ended 22/05/2026; +30 days is still before "now" (25/09/2026).
    const short = await extend(4, { days: 30 })
    expect((short.body as Mutation).data.status).toBe('expired')
    // +365 days from the new end (21/06/2026) is 21/06/2027: in the future.
    const long = await extend(4, { days: 365 })
    expect((long.body as Mutation).data.status).toBe('active')
    expect((await list()).body.meta.counts).toMatchObject({ active: 10, expired: 0 })
  })

  it('re-activates a grace subscription whose new end is in the future', async () => {
    dirty = true
    schoolSubscriptions.update(4, { status: 'grace' }, Date.parse('2026-09-25T15:40:00+08:00'))
    expect((await list()).body.meta.counts).toMatchObject({ grace: 1, expired: 0 })
    const res = await extend(4, { days: 365 })
    expect((res.body as Mutation).data.status).toBe('active')
  })

  it('does not re-activate a cancelled subscription (INFERRED)', async () => {
    dirty = true
    const res = await extend(13, { days: 365 })
    expect((res.body as Mutation).data.status).toBe('cancelled')
  })

  it('404 for an unknown subscription', async () => {
    expect((await extend(3, { days: 5 })).status).toBe(404)
  })
})

describe('#36 POST …/:id/upgrade (BR-27)', () => {
  const upgrade = (id: number, b: unknown = {}) =>
    call<Mutation | ErrorBody>('POST', `${BASE}/${String(id)}/upgrade`, ADMIN, b)

  it('turns a basic subscription into full: unlimited, one year from now, payment stored', async () => {
    dirty = true
    const res = await upgrade(15, { paymentReference: 'TT-9', paymentNotes: 'Tunai' })
    expect(res.status).toBe(200)
    const { data, status } = res.body as Mutation
    expect(status).toBe(MSG_UPGRADED)
    expect(data).toMatchObject({
      packageTier: 'full',
      questionLimit: null,
      status: 'active',
      endsAt: '2027-09-25T15:40:00+08:00',
      paymentReference: 'TT-9',
      paymentNotes: 'Tunai',
      notes: '[Naik taraf Pemantauan → Penuh pada 25/09/2026 15:40]',
    })
    // A second upgrade is refused: the subscription is no longer basic.
    const twice = await upgrade(15)
    expect(twice.status).toBe(422)
    expect(fields(twice).packageTier).toBe(MSG_NOT_BASIC)
  })

  it('appends the upgrade line to existing notes and needs no body', async () => {
    dirty = true
    const res = await call<Mutation>('POST', `${BASE}/14/upgrade`, ADMIN)
    expect(res.status).toBe(200)
    expect(res.body.data.notes?.split('\n')[1]).toBe(
      '[Naik taraf Pemantauan → Penuh pada 25/09/2026 15:40]',
    )
    expect(res.body.data.paymentReference).toBeNull()
  })

  it('makes an upgraded cancelled / expired subscription active (BR-27)', async () => {
    dirty = true
    expect(((await upgrade(5)).body as Mutation).data.status).toBe('active')
    expect(((await upgrade(4)).body as Mutation).data.status).toBe('active')
  })

  it('422 for a full subscription; 404 for an unknown one', async () => {
    const full = await upgrade(12)
    expect(full.status).toBe(422)
    expect(fields(full).packageTier).toBe(MSG_NOT_BASIC)
    expect((await upgrade(3)).status).toBe(404)
  })
})

describe('#37 POST …/:id/cancel (BR-29)', () => {
  const cancel = (id: number) =>
    call<Mutation | ErrorBody>('POST', `${BASE}/${String(id)}/cancel`, ADMIN)

  it('sets the status to cancelled and changes nothing else', async () => {
    dirty = true
    const before = (await detail(12)).body.data
    const res = await cancel(12)
    expect(res.status).toBe(200)
    const { data, status } = res.body as Mutation
    expect(status).toBe(MSG_CANCELLED)
    expect(data.status).toBe('cancelled')
    expect({ ...data, status: 'active', updatedAt: before.updatedAt }).toEqual(before)
    expect((await list()).body.meta.counts).toEqual({
      active: 8,
      grace: 0,
      expired: 1,
      totalQuota: 4738,
    })
  })

  it('422 when already cancelled; 404 when unknown', async () => {
    const again = await cancel(13)
    expect(again.status).toBe(422)
    expect(fields(again).status).toBe(MSG_ALREADY_CANCELLED)
    expect((await cancel(3)).status).toBe(404)
  })
})

describe('#42 GET …/:id/renewal-invoice (S15, BR-30)', () => {
  const invoice = (id: number) =>
    call<{ data: RenewalInvoice }>('GET', `${BASE}/${String(id)}/renewal-invoice`, ADMIN)

  it('builds the invoice of subscription 10 from the enrolled students, not the quota', async () => {
    const res = await invoice(10)
    expect(res.status).toBe(200)
    const inv = res.body.data
    expect(inv.ref).toBe('INV-10-20260925')
    expect(inv.date).toBe('2026-09-25T15:40:00+08:00')
    expect(inv.school).toMatchObject({ id: 8106, code: 'BEA4632', state: expect.any(String) })
    expect(inv.packageName).toBe('Pakej SPM Tingkatan 5')
    expect(inv.currentPeriod).toEqual({
      start: '2026-04-21T09:00:00+08:00',
      end: '2027-05-08T03:09:00+08:00',
    })
    expect(inv.renewalPeriod).toEqual({
      start: '2027-05-08T03:09:00+08:00',
      end: '2028-05-08T03:09:00+08:00',
    })
    expect(inv.studentCount).toBe(562)
    expect(inv.students).toHaveLength(562)
    expect(inv.students[0]).toMatchObject({ no: 1 })
    expect(inv.students[561]?.no).toBe(562)
    expect(inv.pricePerStudent).toBe('30.00')
    // 562 students × RM30.00, although the quota is 500 (BR-30).
    expect(inv.total).toBe('16860.00')
  })

  it('computes the total in cents for other sizes', async () => {
    const inv = (await invoice(11)).body.data
    expect(inv.studentCount).toBe(2)
    expect(inv.total).toBe('60.00')
    expect(inv.ref).toBe('INV-11-20260925')
  })

  it('serves cancelled and basic subscriptions too; 404 for an unknown one', async () => {
    expect((await invoice(13)).status).toBe(200)
    expect((await invoice(15)).body.data.ref).toBe('INV-15-20260925')
    expect((await invoice(3)).status).toBe(404)
  })
})

describe('the quota seam to the T2 rules (XR-M02-T2-01, E2E-M02-31 anchors)', () => {
  const quota = (schoolId: number) =>
    call<{ data: { hasSubscription: boolean; quota?: number; used?: number; remaining?: number } }>(
      'GET',
      `/api/admin/schools/${String(schoolId)}/quota`,
      ADMIN,
    )
  const delima = (schoolId: number, mail = 'm-t3seam@moe-dl.edu.my') =>
    call<ImportResponse | ErrorBody>('POST', '/api/admin/students/import', ADMIN, {
      schoolId,
      classLevel: 'T4',
      importMode: 'paste',
      pasteContent: `Pelajar Demo Bin Demo\n${mail}\nkatalaluan123`,
    })

  it('T2 anchors hold: 10220 has 2 students of 1000 (998 remaining)', async () => {
    expect((await quota(10_220)).body.data).toEqual({
      hasSubscription: true,
      quota: 1000,
      used: 2,
      remaining: 998,
    })
  })

  it('T2 anchors hold: 8078 has 423 of 415 (0 remaining)', async () => {
    expect((await quota(8078)).body.data).toEqual({
      hasSubscription: true,
      quota: 415,
      used: 423,
      remaining: 0,
    })
  })

  it('T2 anchors hold: school 940 has no subscription', async () => {
    expect((await quota(940)).body.data).toEqual({ hasSubscription: false })
  })

  it('a school with only a cancelled subscription has none (8102); 8277 uses its active row, not the cancelled one', async () => {
    expect((await quota(8102)).body.data).toEqual({ hasSubscription: false })
    expect((await quota(8277)).body.data).toEqual({
      hasSubscription: true,
      quota: 1000,
      used: 150,
      remaining: 850,
    })
    // 8880 holds one active (1000) and one cancelled (120) row.
    expect((await quota(8880)).body.data).toMatchObject({ quota: 1000, used: 59 })
  })

  it('the S5 import is allowed at 10220 and refused at 940 (no subscription) and 8078 (no quota left)', async () => {
    dirty = true
    const ok = await delima(10_220)
    expect(ok.status).toBe(200)
    expect((ok.body as ImportResponse).data.created).toBe(1)
    const none = await delima(940, 'm-t3seam2@moe-dl.edu.my')
    expect(none.status).toBe(422)
    expect(fields(none).schoolId).toBe(IMPORT_NO_SUBSCRIPTION)
    const full = await delima(8078, 'm-t3seam3@moe-dl.edu.my')
    expect(full.status).toBe(422)
    expect(fields(full).schoolId).toBe(IMPORT_QUOTA_SHORT)
  })

  it('follows the T3 writes: cancel removes the quota, a new subscription grants it, extend / upgrade keep it', async () => {
    dirty = true
    await call('POST', `${BASE}/11/cancel`, ADMIN)
    expect((await quota(10_220)).body.data).toEqual({ hasSubscription: false })
    expect((await delima(10_220)).status).toBe(422)

    const created = await call<Mutation>('POST', BASE, ADMIN, {
      schoolId: 940,
      packageTier: 'basic',
      schoolPackageId: 2,
      studentQuota: 30,
    })
    expect(created.status).toBe(201)
    expect((await quota(940)).body.data).toEqual({
      hasSubscription: true,
      quota: 30,
      used: 1,
      remaining: 29,
    })
    expect((await delima(940, 'm-t3seam4@moe-dl.edu.my')).status).toBe(200)

    // The quota change feeds the same rule.
    await call('PUT', `${BASE}/${String(created.body.data.id)}/quota`, ADMIN, { studentQuota: 500 })
    expect((await quota(940)).body.data).toMatchObject({ quota: 500, used: 2, remaining: 498 })

    // The latest active subscription wins (BR-16).
    await call('POST', BASE, ADMIN, {
      schoolId: 940,
      packageTier: 'full',
      schoolPackageId: 2,
      studentQuota: 700,
    })
    expect((await quota(940)).body.data).toMatchObject({ quota: 700 })
  })

  it('seeds the seam again after a reset', async () => {
    dirty = true
    await call('POST', `${BASE}/11/cancel`, ADMIN)
    await runtime.reset()
    expect((await quota(10_220)).body.data).toMatchObject({ hasSubscription: true, quota: 1000 })
  })
})
