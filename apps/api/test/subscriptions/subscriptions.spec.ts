import {
  ErrorBodySchema,
  ListMetaSchema,
  SchoolPackageSchema,
  SubscriptionDetailSchema,
  SubscriptionListItemSchema,
  SubscriptionListMetaSchema,
  SubscriptionRenewalInvoiceSchema,
  SubscriptionStudentSchema,
  SUBSCRIPTION_MESSAGES,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { addMonthsDay, addDaysDay, formatMytDateTime, mytDay } from '../../src/modules/subscriptions/dates'
import { fromCents, toCents } from '../../src/modules/subscriptions/subscriptions.service'
import { usedPercent } from '../../src/modules/subscriptions/subscriptions.mapper'
import { SchoolSubscriptionsService } from '../../src/modules/subscriptions/subscriptions.service'
import type { Caller } from '../../src/modules/users/caller'
import {
  ADMIN,
  SCHOOL_ADMIN,
  STUDENT,
  TEACHER,
  addStudents,
  addSubscription,
  apiOf,
  bootSubApp,
  expectError,
  fieldsOf,
  login,
  schoolIdOf,
  type Api,
  type SubTestApp,
} from './sub-helpers'

describe('date helpers (pure)', () => {
  it('adds calendar months and clamps to the last day of a shorter month', () => {
    expect(addMonthsDay('2027-01-31', 1)).toBe('2027-02-28')
    expect(addMonthsDay('2028-02-29', 12)).toBe('2029-02-28')
    expect(addMonthsDay('2026-10-19', 1)).toBe('2026-11-19')
    expect(addMonthsDay('2026-12-15', 1)).toBe('2027-01-15')
    expect(addMonthsDay('2026-10-19', 12)).toBe('2027-10-19')
    expect(addDaysDay('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('works in Malaysia time (UTC+8)', () => {
    expect(mytDay(new Date('2026-10-18T16:30:00Z'))).toBe('2026-10-19')
    expect(formatMytDateTime(new Date('2026-09-25T07:40:00Z'))).toBe('25/09/2026 15:40')
  })
  it('money is computed in integer cents and the percent is clamped', () => {
    expect(toCents('30.00')).toBe(3000)
    expect(fromCents(562 * toCents('30.00'))).toBe('16860.00')
    expect(fromCents(5)).toBe('0.05')
    expect(usedPercent(562, 500)).toBe(100)
    expect(usedPercent(150, 1000)).toBe(15)
    expect(usedPercent(1, 0)).toBe(0)
  })
})

describe('school subscriptions (AC 1, AC 6)', () => {
  let t: SubTestApp
  let admin: Api
  let s1: string
  let s2: string
  let s3: string
  let packageId: Record<string, string>

  beforeAll(async () => {
    t = await bootSubApp()
    admin = apiOf(await login(t, ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
    s3 = await schoolIdOf(t.db, 'DEMO003')
    packageId = Object.fromEntries((await t.db.query<{ code: string; id: string }>(`select code, id::text from school_packages`)).map((r) => [r.code, r.id]))
  })
  afterAll(async () => {
    await t.close()
  })

  const body = (over: Record<string, unknown> = {}) => ({ schoolId: s3, packageTier: 'full', schoolPackageId: packageId.D1_D6, studentQuota: 100, ...over })
  const create = (over: Record<string, unknown> = {}) => admin.post('/admin/school-subscriptions', body(over))
  const detail = async (id: string) => SubscriptionDetailSchema.parse((await admin.get(`/admin/school-subscriptions/${id}`)).body.data)
  const stored = async (id: string) =>
    (await t.db.query<{ status: string; ends_on: string; starts_on: string; notes: string | null; student_quota: number }>(
      `select status, ends_on::text, starts_on::text, notes, student_quota from school_subscriptions where id = $1`,
      [id],
    ))[0]

  describe('guards (AC 6)', () => {
    const endpoints: ['get' | 'post' | 'put', string][] = [
      ['get', '/admin/school-packages'],
      ['get', '/admin/school-subscriptions'],
      ['post', '/admin/school-subscriptions'],
      ['get', '/admin/school-subscriptions/1'],
      ['get', '/admin/school-subscriptions/1/students'],
      ['get', '/admin/school-subscriptions/1/renewal-invoice'],
      ['put', '/admin/school-subscriptions/1/quota'],
      ['post', '/admin/school-subscriptions/1/extend'],
      ['post', '/admin/school-subscriptions/1/upgrade'],
      ['post', '/admin/school-subscriptions/1/cancel'],
      ['get', '/admin/schools/1/quota'],
      ['post', '/admin/students/import'],
      ['get', '/admin/users/1/packages'],
      ['post', '/admin/users/1/packages'],
      ['get', '/admin/comp-students'],
      ['get', '/admin/comp-students/1'],
      ['post', '/admin/comp-students'],
      ['post', '/admin/comp-students/bulk-action'],
      ['post', '/admin/comp-students/1/toggle-active'],
      ['post', '/admin/comp-students/1/toggle-coins'],
    ]

    it.each(endpoints)('%s %s: no session is 401', async (method, url) => {
      const res = await t.http()[method](`/api${url}`).send(method === 'get' ? undefined : {})
      expectError(res, 'UNAUTHORIZED')
    })

    it.each(endpoints)('%s %s: school_admin, teacher and student are 403', async (method, url) => {
      for (const who of [SCHOOL_ADMIN, TEACHER, STUDENT]) {
        const api = apiOf(await login(t, who))
        const res = method === 'get' ? await api.get(url) : method === 'post' ? await api.post(url, {}) : await api.put(url, {})
        expectError(res, 'FORBIDDEN')
      }
    })

    it.each(endpoints.filter(([m]) => m !== 'get'))('%s %s: a missing CSRF token is 403 CSRF_INVALID', async (method, url) => {
      const who = await login(t, ADMIN)
      const res = await who.agent[method](`/api${url}`).send({})
      expect(res.status).toBe(403)
      expect(ErrorBodySchema.parse(res.body).error.code).toBe('CSRF_INVALID')
    })

    it('a school-scoped caller sees only its own school subscription; another school is 404, an admin sees all', async () => {
      const own = await addSubscription(t.db, { schoolId: s1, quota: 50 })
      const other = await addSubscription(t.db, { schoolId: s2, quota: 60 })
      const service = t.get(SchoolSubscriptionsService)
      const ctx = await login(t, SCHOOL_ADMIN)
      // The routes are admin only (403 above); the repository still scopes by the caller, so this holds if the role list is widened.
      const caller = {
        auth: { userId: ctx.session.user.id, sessionRowId: '0', roles: [], capabilities: [], mode: null, active: { role: 'school_admin', scope: { level: 'school', schoolId: s1 } } },
        userId: ctx.session.user.id,
        role: 'school_admin',
        schoolId: s1,
        isAdmin: false,
        requestId: null,
        ip: null,
      } as unknown as Caller
      expect((await service.detail(caller, own)).schoolId).toBe(s1)
      await expect(service.detail(caller, other)).rejects.toMatchObject({ code: 'NOT_FOUND' })
      const list = await service.list(caller, {})
      expect(list.data.map((r) => r.school.id)).toEqual([s1])
      expect(list.meta.counts).toMatchObject({ active: 1, totalQuota: 50 })
      expect((await detail(other)).schoolId).toBe(s2)
    })
  })

  describe('reads', () => {
    it('lists the 4 packages with money as a decimal string', async () => {
      const res = await admin.get('/admin/school-packages')
      expect(res.status).toBe(200)
      const rows = (res.body.data as unknown[]).map((r) => SchoolPackageSchema.parse(r))
      expect(rows.map((p) => [p.code, p.name, p.maxRenewals, p.priceAnnual])).toEqual([
        ['T4', 'Pakej SPM Tingkatan 4', 1, '30.00'],
        ['T5', 'Pakej SPM Tingkatan 5', 0, '30.00'],
        ['D1_D6', 'Pakej Rendah (Darjah 1-6)', 5, '30.00'],
        ['T1_T3', 'Pakej Menengah Rendah (Tingkatan 1-3)', 2, '30.00'],
      ])
      expect(res.headers['cache-control']).toBe('no-store')
    })

    it('lists newest first with the stat cards over all rows; filters never change them; totalQuota is active rows only', async () => {
      const a = await addSubscription(t.db, { schoolId: s1, quota: 40, status: 'active', packageId: packageId.T4 })
      const b = await addSubscription(t.db, { schoolId: s2, quota: 70, status: 'expired' })
      const c = await addSubscription(t.db, { schoolId: s2, quota: 25, status: 'cancelled' })
      const all = await admin.get('/admin/school-subscriptions')
      expect(all.status).toBe(200)
      const rows = (all.body.data as unknown[]).map((r) => SubscriptionListItemSchema.parse(r))
      const ids = rows.map((r) => r.id)
      expect(ids).toEqual([...ids].sort((x, y) => Number(y) - Number(x)))
      expect(ids.slice(0, 3)).toEqual([c, b, a])
      const meta = SubscriptionListMetaSchema.parse(all.body.meta)
      expect(ListMetaSchema.parse(meta)).toBeTruthy()
      expect(meta.totalPages).toBe(1)
      expect(meta.totalItems).toBe(rows.length)
      const activeQuota = (await t.db.query<{ s: string }>(`select coalesce(sum(student_quota),0)::text s from school_subscriptions where status = 'active'`))[0]?.s
      expect(meta.counts).toMatchObject({ totalQuota: Number(activeQuota) })
      const total = meta.counts
      const q = async (query: string) => admin.get(`/admin/school-subscriptions${query}`)
      expect(((await q('?status=expired')).body.data as { id: string }[]).map((r) => r.id)).toContain(b)
      expect(((await q('?status=expired')).body.data as { status: string }[]).every((r) => r.status === 'expired')).toBe(true)
      expect(((await q('?formLevel=t4')).body.data as { id: string }[]).map((r) => r.id)).toEqual([a])
      expect(((await q('?search=demo%20satu')).body.data as { school: { id: string } }[]).every((r) => r.school.id === s1)).toBe(true)
      expect(((await q('?search=DEMO002')).body.data as { school: { id: string } }[]).every((r) => r.school.id === s2)).toBe(true)
      expect((await q('?status=nonsense')).body.data).toEqual([])
      expect((await q('?search=zzz')).body.data).toEqual([])
      expect((await q('?status=nonsense')).body.meta.counts).toEqual(total)
      // LIKE wildcards in the search match literally.
      expect((await q('?search=%25')).body.data).toEqual([])
    })

    it('computes used from the students of the school, active and inactive (BR-24, BR-25)', async () => {
      const school = (await t.db.query<{ id: string }>(`insert into schools (name, code) values ('SK Kuota', 'KUOTA1') returning id::text`))[0]?.id as string
      await addStudents(t.db, school, 3)
      await addStudents(t.db, school, 1, { active: false })
      const id = await addSubscription(t.db, { schoolId: school, quota: 5 })
      const d = await detail(id)
      expect(d).toMatchObject({ used: 4, remaining: 1, usedPercent: 80, studentQuota: 5, formLevel: 't5', packageTier: 'full' })
      expect(d.package).toMatchObject({ code: 'T5', priceAnnual: '30.00' })
      expect(d.school).toMatchObject({ id: school, name: 'SK Kuota', code: 'KUOTA1' })
      await t.db.query(`update school_subscriptions set student_quota = 3 where id = $1`, [id])
      expect(await detail(id)).toMatchObject({ used: 4, remaining: 0, usedPercent: 100 })
    })

    it('404 for an unknown or malformed id', async () => {
      for (const id of ['999999', 'abc', '0']) {
        expectError(await admin.get(`/admin/school-subscriptions/${id}`), 'NOT_FOUND')
      }
    })

    it('pages the students 50 by default and honours 25, 50, 100, 200; other perPage values answer 50 (DV-M02-11)', async () => {
      const school = (await t.db.query<{ id: string }>(`insert into schools (name, code) values ('SK Ramai', 'RAMAI1') returning id::text`))[0]?.id as string
      await addStudents(t.db, school, 120)
      const id = await addSubscription(t.db, { schoolId: school, quota: 500 })
      const get = async (query: string) => admin.get(`/admin/school-subscriptions/${id}/students${query}`)
      const first = await get('')
      expect(first.status).toBe(200)
      expect(first.headers['cache-control']).toBe('no-store')
      expect(first.body.meta).toMatchObject({ page: 1, pageSize: 50, totalItems: 120, totalPages: 3, from: 1, to: 50 })
      expect(SubscriptionStudentSchema.parse(first.body.data[0])).toMatchObject({ classLevel: 'T4' })
      expect(Object.keys(first.body.data[0]).sort()).toEqual(['classLevel', 'id', 'idDelima', 'name'])
      for (const n of [25, 50, 100]) expect((await get(`?perPage=${String(n)}`)).body.meta.pageSize).toBe(n)
      expect((await get('?perPage=200')).body.data).toHaveLength(120)
      for (const bad of ['30', 'abc', '500', '']) expect((await get(`?perPage=${bad}`)).body.meta.pageSize).toBe(50)
      const last = await get('?page=3')
      expect(last.body.meta).toMatchObject({ page: 3, from: 101, to: 120 })
      expect(last.body.data).toHaveLength(20)
      const beyond = await get('?page=9')
      expect(beyond.body.data).toEqual([])
      expect(beyond.body.meta.from).toBeNull()
      for (const bad of ['0', '-2', 'x']) expect((await get(`?page=${bad}`)).body.meta.page).toBe(1)
      const names = ((await get('?perPage=200')).body.data as { name: string }[]).map((s) => s.name)
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ms')))
      expectError(await admin.get('/admin/school-subscriptions/999999/students'), 'NOT_FOUND')
    })

    it('builds the renewal invoice from the enrolled students, not the quota, in integer cents (BR-30)', async () => {
      const school = (await t.db.query<{ id: string }>(`insert into schools (name, code, type, state) values ('SK Invois', 'INV01', 'SK', 'Selangor') returning id::text`))[0]?.id as string
      await addStudents(t.db, school, 7)
      const id = await addSubscription(t.db, { schoolId: school, quota: 3, starts: '2026-04-21', ends: '2027-05-08' })
      const res = await admin.get(`/admin/school-subscriptions/${id}/renewal-invoice`)
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      const inv = SubscriptionRenewalInvoiceSchema.parse(res.body.data)
      expect(inv.ref).toBe(`INV-${id}-20261019`)
      expect(inv.date).toBe('2026-10-19T09:00:00.000+08:00')
      expect(inv.packageName).toBe('Pakej SPM Tingkatan 5')
      expect(inv.currentPeriod).toEqual({ start: '2026-04-21T00:00:00+08:00', end: '2027-05-08T00:00:00+08:00' })
      expect(inv.renewalPeriod).toEqual({ start: '2027-05-08T00:00:00+08:00', end: '2028-05-08T00:00:00+08:00' })
      expect(inv.studentCount).toBe(7)
      expect(inv.pricePerStudent).toBe('30.00')
      expect(inv.total).toBe('210.00')
      // M02 BUG-01: the S15 table lists every enrolled student (FR-M02-97, BR-24), unpaginated, numbered from 1.
      // The field is not in SubscriptionRenewalInvoiceSchema yet (contract patch pending), so assert on the wire body.
      const students = res.body.data.students as { no: number; name: string; classLevel: string | null }[]
      expect(students).toHaveLength(7)
      expect(students.map((s) => s.no)).toEqual([1, 2, 3, 4, 5, 6, 7])
      expect(students.map((s) => s.name)).toEqual([...students.map((s) => s.name)].sort((a, b) => a.localeCompare(b, 'ms')))
      for (const s of students) expect(Object.keys(s).sort()).toEqual(['classLevel', 'name', 'no'])
      expect(students[0]).toMatchObject({ classLevel: 'T4' })
      // Minors' personal data: no idDelima, IC or e-mail on the invoice (BE-25 privacy default).
      for (const key of ['idDelima', 'icNumber', 'ic', 'email', 'id']) expect(students[0]).not.toHaveProperty(key)
      expect(students.length).toBe(inv.studentCount)
      expectError(await admin.get('/admin/school-subscriptions/999999/renewal-invoice'), 'NOT_FOUND')
    })
  })

  describe('create (BR-31)', () => {
    it('a full subscription: active from today, ends in 12 months, no question limit, audited', async () => {
      const res = await create({ paymentReference: ' TT-1 ', paymentNotes: 'Bank transfer' })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.body.status).toBe(SUBSCRIPTION_MESSAGES.created)
      const d = SubscriptionDetailSchema.parse(res.body.data)
      expect(d).toMatchObject({
        schoolId: s3,
        packageTier: 'full',
        studentQuota: 100,
        status: 'active',
        startsAt: '2026-10-19T00:00:00+08:00',
        endsAt: '2027-10-19T00:00:00+08:00',
        questionLimit: null,
        paymentReference: 'TT-1',
        paymentNotes: 'Bank transfer',
        notes: null,
        formLevel: 'd1_d6',
        used: 0,
        remaining: 100,
        usedPercent: 0,
      })
      const audit = await t.db.query<{ action: string; actor_user_id: string; target_id: string; scope_school_id: string }>(
        `select action, actor_user_id::text, target_id, scope_school_id::text from audit_events where action = 'subscriptions.created' and target_id = $1`,
        [d.id],
      )
      expect(audit).toHaveLength(1)
      expect(audit[0]?.scope_school_id).toBe(s3)
      expect(audit[0]?.actor_user_id).toBeTruthy()
    })

    it('a basic subscription: ends in one month, 500 questions', async () => {
      const res = await create({ packageTier: 'basic', studentQuota: '50' })
      expect(res.status).toBe(201)
      expect(SubscriptionDetailSchema.parse(res.body.data)).toMatchObject({ packageTier: 'basic', studentQuota: 50, endsAt: '2026-11-19T00:00:00+08:00', questionLimit: 500 })
    })

    it('accepts the quota limits 1 and 2000', async () => {
      expect((await create({ studentQuota: 1 })).status).toBe(201)
      expect((await create({ studentQuota: 2000 })).status).toBe(201)
    })

    it('422 lists every missing field', async () => {
      const res = await admin.post('/admin/school-subscriptions', {})
      expect(Object.keys(fieldsOf(res)).sort()).toEqual(['packageTier', 'schoolId', 'schoolPackageId', 'studentQuota'])
      expect(fieldsOf(res).studentQuota).toBe('The student quota field is required.')
    })

    const inactive = { code: 'INACT1' }
    it.each([
      ['unknown school', { schoolId: '99999999' }, 'schoolId', 'The selected school id is invalid.'],
      ['unknown package', { schoolPackageId: '99999' }, 'schoolPackageId', 'The selected school package id is invalid.'],
      ['unknown tier', { packageTier: 'gold' }, 'packageTier', 'The selected package tier is invalid.'],
      ['quota 0', { studentQuota: 0 }, 'studentQuota', 'The student quota field must be at least 1.'],
      ['quota 2001', { studentQuota: 2001 }, 'studentQuota', 'The student quota field must not be greater than 2000.'],
      ['quota not a number', { studentQuota: 'abc' }, 'studentQuota', 'The student quota field must be an integer.'],
      ['quota fractional', { studentQuota: 10.5 }, 'studentQuota', 'The student quota field must be an integer.'],
      ['unknown key', { role: 'admin' }, 'role', 'The role field is not allowed.'],
    ])('422 when %s', async (_label, over, field, message) => {
      const res = await create(over)
      expect(fieldsOf(res)[field]).toBe(message)
    })

    it('422 for an inactive school', async () => {
      const id = (await t.db.query<{ id: string }>(`insert into schools (name, code, is_active) values ('SK Tutup', $1, false) returning id::text`, [inactive.code]))[0]?.id
      expect(fieldsOf(await create({ schoolId: id }))).toEqual({ schoolId: 'The selected school id is invalid.' })
    })
  })

  describe('quota, extend, upgrade, cancel (AC 1, table driven from the mock tests)', () => {
    it('changes the quota on any status and appends the reason only when given (BR-26)', async () => {
      const id = await addSubscription(t.db, { schoolId: s1, quota: 1000, notes: 'Demo subscription' })
      const res = await admin.put(`/admin/school-subscriptions/${id}/quota`, { studentQuota: 1200, notes: 'Tambahan pelajar' })
      expect(res.status).toBe(200)
      expect(res.body.status).toBe(SUBSCRIPTION_MESSAGES.quotaUpdated)
      const d = SubscriptionDetailSchema.parse(res.body.data)
      expect(d.studentQuota).toBe(1200)
      expect(d.notes).toBe('Demo subscription\n[Kuota 1000 → 1200 pada 19/10/2026 09:00] Tambahan pelajar')
      expect(d.updatedAt).toBe('2026-10-19T09:00:00.000+08:00')
      const again = await admin.put(`/admin/school-subscriptions/${id}/quota`, { studentQuota: '1300' })
      expect(again.body.data.notes).toBe(d.notes)
      expect((await stored(id))?.student_quota).toBe(1300)
      for (const status of ['cancelled', 'expired', 'grace'] as const) {
        const other = await addSubscription(t.db, { schoolId: s1, status })
        expect((await admin.put(`/admin/school-subscriptions/${other}/quota`, { studentQuota: 2000 })).status).toBe(200)
      }
    })

    it.each([0, 2001, -5, 'abc', 12.5, null])('quota 422 for %s', async (q) => {
      const id = await addSubscription(t.db, { schoolId: s1 })
      const res = await admin.put(`/admin/school-subscriptions/${id}/quota`, { studentQuota: q })
      expect(Object.keys(fieldsOf(res))).toEqual(['studentQuota'])
      expect((await stored(id))?.student_quota).toBe(100)
    })

    it('extends by days: the end moves by whole days, an active row stays active, the line is written only with a reason (BR-28)', async () => {
      const id = await addSubscription(t.db, { schoolId: s1, ends: '2027-05-12' })
      const res = await admin.post(`/admin/school-subscriptions/${id}/extend`, { days: 30, reason: 'Kelewatan bayaran' })
      expect(res.status).toBe(200)
      expect(res.body.status).toBe(SUBSCRIPTION_MESSAGES.extended)
      const d = SubscriptionDetailSchema.parse(res.body.data)
      expect(d.endsAt).toBe('2027-06-11T00:00:00+08:00')
      expect(d.status).toBe('active')
      expect(d.notes).toBe('[Dilanjutkan 30 hari pada 19/10/2026 09:00] Kelewatan bayaran')
      let expected = '2027-06-11'
      for (const days of [7, 14, 60, 90, 180, 365]) {
        const r = await admin.post(`/admin/school-subscriptions/${id}/extend`, { days })
        expected = addDaysDay(expected, days)
        expect(r.body.data.endsAt).toBe(`${expected}T00:00:00+08:00`)
      }
      expect((await stored(id))?.notes).toBe(d.notes)
    })

    it.each([0, 366, -1, 'abc', 1.5, null])('extend 422 for days %s', async (days) => {
      const id = await addSubscription(t.db, { schoolId: s1 })
      expect(Object.keys(fieldsOf(await admin.post(`/admin/school-subscriptions/${id}/extend`, { days })))).toEqual(['days'])
    })

    it('re-activates an expired or grace row only when the new end is after today; never a cancelled one', async () => {
      const expired = await addSubscription(t.db, { schoolId: s1, status: 'expired', starts: '2026-01-01', ends: '2026-05-22' })
      const short = await admin.post(`/admin/school-subscriptions/${expired}/extend`, { days: 30 })
      expect(short.body.data.status).toBe('expired')
      const long = await admin.post(`/admin/school-subscriptions/${expired}/extend`, { days: 365 })
      expect(long.body.data.status).toBe('active')
      const grace = await addSubscription(t.db, { schoolId: s1, status: 'grace', starts: '2026-01-01', ends: '2026-05-22' })
      expect((await admin.post(`/admin/school-subscriptions/${grace}/extend`, { days: 365 })).body.data.status).toBe('active')
      const cancelled = await addSubscription(t.db, { schoolId: s1, status: 'cancelled', ends: '2027-01-01' })
      expect((await admin.post(`/admin/school-subscriptions/${cancelled}/extend`, { days: 365 })).body.data.status).toBe('cancelled')
      // A new end that is today itself is not "in the future".
      const edge = await addSubscription(t.db, { schoolId: s1, status: 'expired', starts: '2026-01-01', ends: '2026-10-18' })
      expect((await admin.post(`/admin/school-subscriptions/${edge}/extend`, { days: 1 })).body.data.status).toBe('expired')
      expect((await admin.post(`/admin/school-subscriptions/${edge}/extend`, { days: 1 })).body.data.status).toBe('active')
    })

    it('upgrades a basic row to full: unlimited, 12 months from today, payment stored, upgrade line appended (BR-27)', async () => {
      const id = await addSubscription(t.db, { schoolId: s1, tier: 'basic', questionLimit: 500, ends: '2026-11-01', notes: 'Demo' })
      const res = await admin.post(`/admin/school-subscriptions/${id}/upgrade`, { paymentReference: 'TT-9', paymentNotes: 'Tunai' })
      expect(res.status).toBe(200)
      expect(res.body.status).toBe(SUBSCRIPTION_MESSAGES.upgraded)
      expect(SubscriptionDetailSchema.parse(res.body.data)).toMatchObject({
        packageTier: 'full',
        questionLimit: null,
        status: 'active',
        endsAt: '2027-10-19T00:00:00+08:00',
        paymentReference: 'TT-9',
        paymentNotes: 'Tunai',
        notes: 'Demo\n[Naik taraf Pemantauan → Penuh pada 19/10/2026 09:00]',
      })
      const twice = await admin.post(`/admin/school-subscriptions/${id}/upgrade`, {})
      expect(fieldsOf(twice).packageTier).toBe(SUBSCRIPTION_MESSAGES.notBasic)
    })

    it('upgrade needs no body and makes an expired or cancelled basic row active', async () => {
      for (const status of ['expired', 'cancelled'] as const) {
        const id = await addSubscription(t.db, { schoolId: s1, tier: 'basic', status })
        const ok = await admin.post(`/admin/school-subscriptions/${id}/upgrade`)
        expect(ok.status).toBe(200)
        expect(ok.body.data.status).toBe('active')
        expect(ok.body.data.paymentReference).toBeNull()
      }
    })

    it('upgrading a full row is 422 on packageTier', async () => {
      const id = await addSubscription(t.db, { schoolId: s1, tier: 'full' })
      const res = await admin.post(`/admin/school-subscriptions/${id}/upgrade`, {})
      expect(res.status).toBe(422)
      expect(ErrorBodySchema.parse(res.body).error).toMatchObject({ code: 'VALIDATION_ERROR', message: SUBSCRIPTION_MESSAGES.notBasic, fields: { packageTier: SUBSCRIPTION_MESSAGES.notBasic } })
    })

    it('cancels and changes nothing else; a second cancel is 422 on status (BR-29)', async () => {
      const id = await addSubscription(t.db, { schoolId: s1, quota: 77 })
      const before = await detail(id)
      const res = await admin.post(`/admin/school-subscriptions/${id}/cancel`)
      expect(res.status).toBe(200)
      expect(res.body.status).toBe(SUBSCRIPTION_MESSAGES.cancelled)
      const d = SubscriptionDetailSchema.parse(res.body.data)
      expect(d.status).toBe('cancelled')
      expect({ ...d, status: 'active', updatedAt: before.updatedAt }).toEqual(before)
      const again = await admin.post(`/admin/school-subscriptions/${id}/cancel`)
      expect(ErrorBodySchema.parse(again.body).error).toMatchObject({ message: SUBSCRIPTION_MESSAGES.alreadyCancelled, fields: { status: SUBSCRIPTION_MESSAGES.alreadyCancelled } })
      expect(again.status).toBe(422)
    })

    it('404 for an unknown id on every write', async () => {
      expectError(await admin.put('/admin/school-subscriptions/999999/quota', { studentQuota: 10 }), 'NOT_FOUND')
      expectError(await admin.post('/admin/school-subscriptions/999999/extend', { days: 5 }), 'NOT_FOUND')
      expectError(await admin.post('/admin/school-subscriptions/999999/upgrade', {}), 'NOT_FOUND')
      expectError(await admin.post('/admin/school-subscriptions/999999/cancel'), 'NOT_FOUND')
    })

    it('every write is audited in the same transaction, with the actor and no personal data', async () => {
      const id = await addSubscription(t.db, { schoolId: s1, tier: 'basic' })
      await admin.put(`/admin/school-subscriptions/${id}/quota`, { studentQuota: 11 })
      await admin.post(`/admin/school-subscriptions/${id}/extend`, { days: 5 })
      await admin.post(`/admin/school-subscriptions/${id}/upgrade`)
      await admin.post(`/admin/school-subscriptions/${id}/cancel`)
      const rows = await t.db.query<{ action: string; actor_role: string }>(`select action, actor_role from audit_events where target_id = $1 order by id`, [id])
      expect(rows.map((r) => r.action)).toEqual(['subscriptions.quota_changed', 'subscriptions.extended', 'subscriptions.upgraded', 'subscriptions.cancelled'])
      expect(new Set(rows.map((r) => r.actor_role))).toEqual(new Set(['admin']))
    })

    it('a refused write leaves no audit row (rolled back with the change)', async () => {
      const id = await addSubscription(t.db, { schoolId: s1, status: 'cancelled' })
      await admin.post(`/admin/school-subscriptions/${id}/cancel`)
      expect(await t.db.query(`select 1 from audit_events where target_id = $1`, [id])).toHaveLength(0)
    })
  })
})

describe('write rate limit (D57a)', () => {
  let t: SubTestApp
  beforeAll(async () => {
    t = await bootSubApp({ env: { THROTTLE_ADMIN_WRITE_PER_MINUTE: '2' } })
  })
  afterAll(async () => {
    await t.close()
  })

  it('answers 429 RATE_LIMITED with retryAfter and the Retry-After header after the ceiling', async () => {
    const admin = apiOf(await login(t, ADMIN))
    expect((await admin.post('/admin/school-subscriptions/999999/cancel')).status).toBe(404)
    expect((await admin.post('/admin/school-subscriptions/999999/cancel')).status).toBe(404)
    const res = await admin.post('/admin/school-subscriptions/999999/cancel')
    expect(res.status).toBe(429)
    expect(ErrorBodySchema.parse(res.body).error.code).toBe('RATE_LIMITED')
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
    expect(res.body.error.retryAfter).toBe(Number(res.headers['retry-after']))
  })
})
