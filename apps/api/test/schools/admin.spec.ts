import { treatDemoAsSecondary } from '../support/secondary'
import {
  AdminSchoolSchema,
  SchoolListMetaSchema,
  SchoolOptionSchema,
  statusEnvelopeOf,
  SchoolToggleResultSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { vi } from 'vitest'

import { SchoolsRepository } from '../../src/modules/schools'

import {
  bootSchoolsApp,
  expectError,
  insertFillerSchools,
  loginAs,
  schoolIdOf,
  type LoggedIn,
  type SchoolsTestApp,
} from './helpers'

const VALID = {
  name: 'SK Contoh Baru',
  code: 'ZZZ9001',
  type: 'SMK',
  state: 'Selangor',
  district: 'PPD Gombak',
  city: 'GOMBAK',
  isActive: true,
}

const ListBody = z.object({ data: z.array(AdminSchoolSchema), meta: SchoolListMetaSchema })
const OneBody = z.object({ data: AdminSchoolSchema })
const SavedBody = statusEnvelopeOf(AdminSchoolSchema)
const ToggleBody = statusEnvelopeOf(SchoolToggleResultSchema)

describe('admin school routes (AC 1, AC 8)', () => {
  let t: SchoolsTestApp
  let admin: LoggedIn

  beforeAll(async () => {
    t = await bootSchoolsApp({ env: { THROTTLE_ADMIN_WRITE_PER_MINUTE: '1000', THROTTLE_ADMIN_READ_PER_MINUTE: '1000' } })
    await treatDemoAsSecondary(t.db)
    await insertFillerSchools(t.db, 66, 'SMK') // 4 seeded + 66 = 70 schools: three pages of 30
    admin = await loginAs(t, 'admin@demo.test')
  })
  afterAll(async () => {
    await t.close()
  })

  const list = (query = '') => admin.agent.get(`/api/admin/schools${query}`)
  const post = (body: unknown) => admin.agent.post('/api/admin/schools').set('X-CSRF-Token', admin.csrf).send(body as object)
  const put = (id: string, body: unknown) =>
    admin.agent.put(`/api/admin/schools/${id}`).set('X-CSRF-Token', admin.csrf).send(body as object)
  const toggle = (id: string) => admin.agent.post(`/api/admin/schools/${id}/toggle`).set('X-CSRF-Token', admin.csrf)

  describe('GET /api/admin/schools', () => {
    it('page 1: 30 rows, name A to Z, meta recomputed from the table, no-store', async () => {
      const res = await list()
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      const body = ListBody.parse(res.body)
      const [row] = await t.db.query<{ total: number; active: number }>(
        `select count(*)::int as total, count(*) filter (where is_active)::int as active from schools`,
      )
      const { total, active } = row as { total: number; active: number }
      expect(body.data).toHaveLength(30)
      expect(body.meta).toMatchObject({
        page: 1,
        pageSize: 30,
        totalItems: total,
        totalPages: Math.ceil(total / 30),
        from: 1,
        to: 30,
        counts: { total, active, inactive: total - active },
      })
      expect(total).toBe(70)
      const types = await t.db.query<{ type: string }>(`select distinct type from schools where type is not null`)
      expect(body.meta.types).toEqual(types.map((r) => r.type).sort())
      const names = body.data.map((s) => s.name)
      expect(names).toEqual([...names].sort())
      for (const s of body.data) expect(s.createdAt).toMatch(/\+08:00$/)
    })

    it('the last page, a page beyond it, and a bad page value', async () => {
      const last = ListBody.parse((await list('?page=3')).body)
      expect(last.data).toHaveLength(10)
      expect(last.meta).toMatchObject({ page: 3, from: 61, to: 70, totalPages: 3 })
      const beyond = ListBody.parse((await list('?page=999')).body)
      expect(beyond.data).toEqual([])
      expect(beyond.meta).toMatchObject({ page: 999, from: null, to: null })
      for (const bad of ['abc', '0', '-2', '2.5', '']) {
        expect(ListBody.parse((await list(`?page=${bad}`)).body).meta.page, bad).toBe(1)
      }
    })

    it('pages do not overlap and cover every school once', async () => {
      const ids: string[] = []
      for (const p of [1, 2, 3]) ids.push(...ListBody.parse((await list(`?page=${String(p)}`)).body).data.map((s) => s.id))
      expect(new Set(ids).size).toBe(70)
    })

    it('filters by state, type and text; counts ignore the filters', async () => {
      const perak = ListBody.parse((await list('?state=Perak')).body)
      expect(perak.meta.totalItems).toBe(66)
      expect(perak.meta.counts.total).toBe(70)
      expect(perak.data.every((s) => s.state === 'Perak')).toBe(true)
      expect(ListBody.parse((await list('?type=SMK')).body).meta.totalItems).toBe(70)
      expect(ListBody.parse((await list('?type=Nowhere')).body).meta.totalItems).toBe(0)
      const both = ListBody.parse((await list('?state=Selangor&type=SMK')).body)
      expect(both.data.map((s) => s.code)).toEqual(['DEMO002', 'DEMO001'])
      // name or code substring, case-insensitive
      expect(ListBody.parse((await list('?search=demo%20satu')).body).data.map((s) => s.code)).toEqual(['DEMO001'])
      expect(ListBody.parse((await list('?search=cth007')).body).data.map((s) => s.code)).toEqual(['CTH007'])
      expect(ListBody.parse((await list('?search=zzz-no-such')).body).data).toEqual([])
      // LIKE wildcards in the search text are literal
      expect(ListBody.parse((await list('?search=%25')).body).data).toEqual([])
      expect(ListBody.parse((await list('?search=_')).body).data).toEqual([])
    })

    it('studentCount and teacherCount are derived from the users of the school', async () => {
      const body = ListBody.parse((await list('?search=DEMO')).body)
      const byCode = Object.fromEntries(body.data.map((s) => [s.code, [s.studentCount, s.teacherCount]]))
      expect(byCode).toEqual({ DEMO001: [5, 2], DEMO002: [1, 0], DEMO003: [0, 0], DEMO004: [0, 0] })
    })

    it('the response carries the join code of the admin view and opaque string ids', async () => {
      const body = ListBody.parse((await list('?search=DEMO001')).body)
      expect(body.data[0]).toMatchObject({ code: 'DEMO001', joinCode: 'DEMO0001', type: 'SMK', state: 'Selangor' })
      expect(typeof body.data[0]?.id).toBe('string')
    })
  })

  describe('GET /api/admin/schools/:id and the options', () => {
    it('returns one school with its counts and no-store', async () => {
      const id = await schoolIdOf(t.db, 'DEMO001')
      const res = await admin.agent.get(`/api/admin/schools/${id}`)
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      expect(OneBody.parse(res.body).data).toMatchObject({ id, studentCount: 5, teacherCount: 2, isActive: true })
    })

    it('options and the all=1 list are the same: every school, active or not, name A to Z', async () => {
      await t.db.query(`update schools set is_active = false where code = 'CTH010'`)
      const a = await admin.agent.get('/api/admin/schools/options')
      const b = await admin.agent.get('/api/schools?all=1')
      expect(a.status).toBe(200)
      const options = z.object({ data: z.array(SchoolOptionSchema) }).parse(a.body).data
      expect(b.body).toEqual(a.body)
      expect(options).toHaveLength(70)
      expect(Object.keys(options[0] as object).sort()).toEqual(['id', 'name'])
      const names = options.map((o) => o.name)
      expect(names).toEqual([...names].sort())
      const inactive = await schoolIdOf(t.db, 'CTH010')
      expect(options.map((o) => o.id)).toContain(inactive)
    })

    it('secondary-only: a primary-type school is out of the list, the options and the detail (404)', async () => {
      const id = await schoolIdOf(t.db, 'CTH011')
      await t.db.query(`update schools set type = 'SK' where id = $1`, [id])
      try {
        expect((await admin.agent.get(`/api/admin/schools/${id}`)).status).toBe(404)
        expect(ListBody.parse((await list('?search=cth011')).body).data).toEqual([])
        expect(JSON.stringify((await admin.agent.get('/api/admin/schools/options')).body)).not.toContain(`"${id}"`)
      } finally {
        await t.db.query(`update schools set type = 'SMK' where id = $1`, [id])
      }
    })

    it('all=1 is required: 422 with fields.all', async () => {
      for (const q of ['', '?all=0', '?all=true']) {
        const err = expectError(await admin.agent.get(`/api/schools${q}`), 'VALIDATION_ERROR')
        expect(err.fields).toEqual({ all: 'The all field is required.' })
      }
    })
  })

  describe('POST /api/admin/schools', () => {
    it('creates a school: 201, flash text, generated join code, audit row, counts move', async () => {
      const before = ListBody.parse((await list()).body).meta.counts
      const res = await post(VALID)
      expect(res.status).toBe(201)
      expect(res.headers['cache-control']).toBe('no-store')
      const body = SavedBody.parse(res.body)
      expect(body.status).toBe('Sekolah berjaya disimpan.')
      expect(body.data).toMatchObject({ ...VALID, studentCount: 0, teacherCount: 0 })
      expect(body.data.joinCode).toMatch(/^[A-HJKMNP-Z2-9]{8}$/)
      const after = ListBody.parse((await list()).body).meta.counts
      expect(after).toEqual({ total: before.total + 1, active: before.active + 1, inactive: before.inactive })
      const found = OneBody.parse((await admin.agent.get(`/api/admin/schools/${body.data.id}`)).body)
      expect(found.data.code).toBe('ZZZ9001')

      const audit = await t.db.query<{ action: string; actor_user_id: string; target_id: string; detail: object }>(
        `select action, actor_user_id::text, target_id, detail from audit_events where action = 'school.created'`,
      )
      expect(audit).toHaveLength(1)
      expect(audit[0]).toMatchObject({ target_id: body.data.id, actor_user_id: admin.session.user.id })
      expect(JSON.stringify(audit[0]?.detail)).not.toContain(body.data.joinCode as string)
    })

    it('isActive defaults to true; blank district and city are stored as null; "0" means false', async () => {
      const res = await post({ ...VALID, code: 'ZZZ9002', isActive: undefined, district: '', city: '  ' })
      expect(res.status).toBe(201)
      expect(SavedBody.parse(res.body).data).toMatchObject({ isActive: true, district: null, city: null })
      const off = await post({ ...VALID, code: 'ZZZ9003', isActive: '0' })
      expect(SavedBody.parse(off.body).data.isActive).toBe(false)
    })

    it('trims the text fields', async () => {
      const res = await post({ ...VALID, code: ' ZZZ9004 ', name: '  SK Dipangkas  ' })
      expect(SavedBody.parse(res.body).data).toMatchObject({ code: 'ZZZ9004', name: 'SK Dipangkas' })
    })

    it('accepts every school type and links the JPN and PPD of the state and district', async () => {
      let n = 0
      for (const type of ['SK', 'SMK', 'SJK(C)', 'SJK(T)', 'MRSM', 'SBP']) {
        n++
        expect((await post({ ...VALID, code: `TYP${String(n)}`, type })).status, type).toBe(201)
      }
      const created = await t.db.query<{ jpn: string | null; ppd: string | null }>(
        `select j.code as jpn, p.code as ppd from schools s
           left join jpns j on j.id = s.jpn_id left join ppds p on p.id = s.ppd_id where s.code = 'TYP1'`,
      )
      // The seed has JPN Selangor, but "PPD Gombak" is not a known PPD code (the seed uses "Gombak").
      expect(created[0]).toEqual({ jpn: 'SGR', ppd: null })
      await post({ ...VALID, code: 'TYPG', district: 'Gombak' })
      const gombak = await t.db.query<{ ppd: string | null }>(
        `select p.code as ppd from schools s left join ppds p on p.id = s.ppd_id where s.code = 'TYPG'`,
      )
      expect(gombak[0]?.ppd).toBe('Gombak')
    })

    it('422 with the mock copy for missing, too long and invalid fields', async () => {
      const empty = expectError(await post({}), 'VALIDATION_ERROR')
      expect(empty.message).toBe('The given data was invalid.')
      expect(empty.fields).toEqual({
        name: 'The name field is required.',
        code: 'The code field is required.',
        type: 'The type field is required.',
        state: 'The state field is required.',
      })
      const bad = expectError(
        await post({ ...VALID, name: 'x'.repeat(256), code: 'y'.repeat(21), type: 'SRK', state: 'Atlantis', isActive: 'maybe' }),
        'VALIDATION_ERROR',
      )
      expect(bad.fields).toEqual({
        name: 'The name field must not be greater than 255 characters.',
        code: 'The code field must not be greater than 20 characters.',
        type: 'The selected type is invalid.',
        state: 'The selected state is invalid.',
        isActive: 'The is active field must be true or false.',
      })
      expect(Object.keys(bad.fields as object)).toEqual(['name', 'code', 'type', 'state', 'isActive'])
    })

    it('a body that is not an object reports the required fields, like the mock', async () => {
      const err = expectError(await post([1, 2]), 'VALIDATION_ERROR')
      expect(Object.keys(err.fields as object)).toEqual(['name', 'code', 'type', 'state'])
    })

    it('the code is unique and case-insensitive, trimmed; the error and a bad field are reported together', async () => {
      for (const code of ['ZZZ9001', 'zzz9001', ' ZzZ9001 ', 'demo001']) {
        const err = expectError(await post({ ...VALID, code }), 'VALIDATION_ERROR')
        expect(err.fields, code).toEqual({ code: 'The code has already been taken.' })
      }
      const both = expectError(await post({ ...VALID, code: 'demo001', state: 'Atlantis' }), 'VALIDATION_ERROR')
      expect(both.fields).toEqual({ code: 'The code has already been taken.', state: 'The selected state is invalid.' })
    })

    it('LIKE wildcards in a code are literal: "DEMO_01" and "%" do not collide with DEMO001', async () => {
      expect((await post({ ...VALID, code: 'DEMO_01' })).status).toBe(201)
      expect((await post({ ...VALID, code: '%' })).status).toBe(201)
    })

    it('two parallel creates of the same code in different case: exactly one 201, one 422', async () => {
      const [x, y] = await Promise.all([post({ ...VALID, code: 'RACE001' }), post({ ...VALID, code: 'race001' })])
      expect([x.status, y.status].sort()).toEqual([201, 422])
      const loser = x.status === 422 ? x : y
      expect(expectError(loser, 'VALIDATION_ERROR').fields).toEqual({ code: 'The code has already been taken.' })
      const rows = await t.db.query(`select 1 from schools where lower(code) = 'race001'`)
      expect(rows).toHaveLength(1)
    })

    it('the database refuses a second code that differs only in case (unique index on lower(code))', async () => {
      await expect(t.db.query(`insert into schools (name, code) values ('X', 'demo001')`)).rejects.toThrow(/uq_schools_code_lower/)
    })

    it('type is trimmed before the enum check, as the mock does', async () => {
      const res = await post({ ...VALID, code: 'TRIM001', type: '  SMK  ' })
      expect(res.status).toBe(201)
      expect(SavedBody.parse(res.body).data.type).toBe('SMK')
    })

    it('a strict-body 422 still carries Cache-Control: no-store', async () => {
      const res = await post({ ...VALID, code: 'NOSTORE1', joinCode: 'X' })
      expectError(res, 'VALIDATION_ERROR')
      expect(res.headers['cache-control']).toBe('no-store')
    })

    it('rejects unknown keys (joinCode, id, legacy columns) with 422 and writes nothing', async () => {
      const before = await t.db.query<{ n: number }>(`select count(*)::int as n from schools`)
      for (const extra of [{ joinCode: 'HACKED01' }, { id: '1' }, { legacyId: 'x' }, { studentCount: 9 }]) {
        const res = await post({ ...VALID, code: 'ZZZ7777', ...extra })
        const err = expectError(res, 'VALIDATION_ERROR')
        expect(Object.keys(err.fields as object)).toEqual(Object.keys(extra))
      }
      expect(await t.db.query<{ n: number }>(`select count(*)::int as n from schools`)).toEqual(before)
    })

    it('a failed validation writes no audit row', async () => {
      const [{ n: before }] = await t.db.query<{ n: number }>(`select count(*)::int as n from audit_events where action like 'school.%'`) as [{ n: number }]
      await post({})
      const [{ n: after }] = await t.db.query<{ n: number }>(`select count(*)::int as n from audit_events where action like 'school.%'`) as [{ n: number }]
      expect(after).toBe(before)
    })
  })

  describe('PUT /api/admin/schools/:id', () => {
    it('updates every field, keeps the id and the join code, sets updatedAt, lets a school keep its own code', async () => {
      const id = await schoolIdOf(t.db, 'DEMO003')
      t.clock.advance(60_000)
      const res = await put(id, { name: 'SK Demo Tiga (Baru)', code: 'DEMO003', type: 'MRSM', state: 'Perak', district: 'PPD KINTA', city: 'Ipoh', isActive: false })
      expect(res.status).toBe(200)
      const body = SavedBody.parse(res.body)
      expect(body.status).toBe('Sekolah berjaya disimpan.')
      expect(body.data).toMatchObject({ id, name: 'SK Demo Tiga (Baru)', code: 'DEMO003', type: 'MRSM', state: 'Perak', district: 'PPD KINTA', city: 'Ipoh', isActive: false, joinCode: 'DEMO0003' })
      expect(body.data.updatedAt).toMatch(/^2026-10-19T09:01:00(\.000)?\+08:00$/)
      expect(body.data.createdAt).not.toBe(body.data.updatedAt)
      const audit = await t.db.query<{ detail: { changed: string[] } }>(`select detail from audit_events where action = 'school.updated' and target_id = $1`, [id])
      expect(audit[0]?.detail.changed).toEqual(['name', 'type', 'state', 'district', 'city', 'isActive'])
    })

    it('an absent isActive keeps the stored value', async () => {
      const id = await schoolIdOf(t.db, 'DEMO003') // inactive after the test above
      const rest = Object.fromEntries(Object.entries(VALID).filter(([k]) => k !== 'isActive'))
      const res = await put(id, { ...rest, code: 'DEMO003' })
      expect(SavedBody.parse(res.body).data.isActive).toBe(false)
    })

    it('a PUT without isActive keeps a toggle made between its read and its write', async () => {
      const id = await schoolIdOf(t.db, 'DEMO004')
      const rowBefore = await t.db.query<{ is_active: boolean }>(`select is_active from schools where id = $1`, [id])
      const before = rowBefore[0]?.is_active as boolean
      const repo = t.app.get(SchoolsRepository)
      const original = repo.get.bind(repo)
      const spy = vi.spyOn(repo, 'get').mockImplementationOnce(async (sid: string) => {
        const row = await original(sid)
        await t.db.query(`update schools set is_active = not is_active where id = $1`, [sid])
        return row
      })
      const rest = Object.fromEntries(Object.entries(VALID).filter(([k]) => k !== 'isActive'))
      const res = await put(id, { ...rest, code: 'DEMO004' })
      spy.mockRestore()
      expect(res.status).toBe(200)
      expect(SavedBody.parse(res.body).data.isActive).toBe(!before)
      const rowAfter = await t.db.query<{ is_active: boolean }>(`select is_active from schools where id = $1`, [id])
      expect(rowAfter[0]?.is_active).toBe(!before)
      await t.db.query(`update schools set is_active = true where id = $1`, [id])
    })

    it('another school code is 422 (case-insensitive); a missing field is 422; 404 for an unknown school', async () => {
      const id = await schoolIdOf(t.db, 'DEMO003')
      const dup = expectError(await put(id, { ...VALID, code: 'demo004' }), 'VALIDATION_ERROR')
      expect(dup.fields).toEqual({ code: 'The code has already been taken.' })
      const missing = expectError(await put(id, { name: 'x' }), 'VALIDATION_ERROR')
      expect(Object.keys(missing.fields as object)).toEqual(['code', 'type', 'state'])
      expectError(await put('99999999', VALID), 'NOT_FOUND', 'Not Found.')
      expectError(await put('abc', VALID), 'NOT_FOUND')
      // 404 is decided before validation, as in the mock
      expectError(await put('99999999', {}), 'NOT_FOUND')
    })

    it('rejects unknown keys and leaves the row unchanged', async () => {
      const id = await schoolIdOf(t.db, 'DEMO004')
      const before = await t.db.query(`select name, join_code from schools where id = $1`, [id])
      expectError(await put(id, { ...VALID, code: 'DEMO004', joinCode: 'HACKED01' }), 'VALIDATION_ERROR')
      expect(await t.db.query(`select name, join_code from schools where id = $1`, [id])).toEqual(before)
    })
  })

  describe('POST /api/admin/schools/:id/toggle', () => {
    it('flips isActive, keeps the stat cards in step, audits, and flips back', async () => {
      const id = await schoolIdOf(t.db, 'DEMO004')
      const before = ListBody.parse((await list()).body).meta.counts
      const off = await toggle(id)
      expect(off.status).toBe(200)
      expect(ToggleBody.parse(off.body)).toEqual({ data: { isActive: false }, status: 'Status sekolah berjaya dikemaskini.' })
      expect(ListBody.parse((await list()).body).meta.counts).toEqual({ total: before.total, active: before.active - 1, inactive: before.inactive + 1 })
      const hidden = await t.http().get(`/api/schools/search?id=${id}`)
      expect(hidden.body.data).toEqual([])
      const on = await toggle(id)
      expect(on.body.data).toEqual({ isActive: true })
      expect(ListBody.parse((await list()).body).meta.counts).toEqual(before)
      const audit = await t.db.query<{ detail: { isActive: boolean } }>(`select detail from audit_events where action = 'school.toggled' and target_id = $1 order by id`, [id])
      expect(audit.map((a) => a.detail.isActive)).toEqual([false, true])
    })

    it('404 for an unknown or malformed id, and no audit row for it', async () => {
      const before = await t.db.query<{ n: number }>(`select count(*)::int as n from audit_events where action = 'school.toggled'`)
      expectError(await toggle('99999999'), 'NOT_FOUND')
      expectError(await toggle('abc'), 'NOT_FOUND')
      expect(await t.db.query<{ n: number }>(`select count(*)::int as n from audit_events where action = 'school.toggled'`)).toEqual(before)
    })
  })

  it('a school is never deleted: there is no DELETE route', async () => {
    const id = await schoolIdOf(t.db, 'DEMO001')
    const res = await admin.agent.delete(`/api/admin/schools/${id}`).set('X-CSRF-Token', admin.csrf)
    expect(res.status).toBe(404)
  })
})
