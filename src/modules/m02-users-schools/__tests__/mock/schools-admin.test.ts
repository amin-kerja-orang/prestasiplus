/**
 * M02-T2: school administration handlers (SRS v1.28 §7 #24–#28, #40, #41, #43 and the XL-13 alias
 * `GET /api/admin/schools/options`): admin guards, the S9 list against the §6.15 A totals, the
 * observed per-school student counts (BR-24), create / edit / toggle rules and the school options.
 */

import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'

import type { AdminSchool, SchoolListMeta, SchoolOption } from '../../api/schools-admin'
import { schools } from '../../mock'
import {
  ADMIN,
  ADMIN_SEKOLAH,
  GURU,
  IBU_BAPA,
  PELAJAR,
  bootM02,
  callAs,
  type ErrorBody,
  type ListBody,
} from './helpers'

let runtime: MockRuntime
let call: ReturnType<typeof callAs>
let dirty = false

beforeAll(async () => {
  runtime = await bootM02()
  call = callAs(runtime)
}, 120_000)

afterEach(async () => {
  if (dirty) await runtime.reset()
  dirty = false
}, 120_000)

const list = (query = '', as = ADMIN) =>
  call<ListBody<AdminSchool, SchoolListMeta>>('GET', `/api/admin/schools${query}`, as)

const VALID = {
  name: 'SEKOLAH KEBANGSAAN CONTOH BARU',
  code: 'ZZZ9001',
  type: 'SK',
  state: 'Selangor',
  district: 'PPD GOMBAK',
  city: 'GOMBAK',
  isActive: true,
}

describe('admin guards (FR-M02-99)', () => {
  const endpoints: ['GET' | 'POST' | 'PUT', string][] = [
    ['GET', '/api/admin/schools'],
    ['GET', '/api/admin/schools/8078'],
    ['POST', '/api/admin/schools'],
    ['PUT', '/api/admin/schools/8078'],
    ['POST', '/api/admin/schools/8078/toggle'],
    ['GET', '/api/admin/schools/options'],
    ['GET', '/api/schools?all=1'],
  ]

  it.each(endpoints)('%s %s: guest 401 UNAUTHORIZED', async (method, url) => {
    const res = await call<ErrorBody>(method, url, null, method === 'GET' ? undefined : VALID)
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it.each(endpoints)(
    '%s %s: student, teacher, parent and school admin get 403',
    async (method, url) => {
      for (const as of [PELAJAR, GURU, IBU_BAPA, ADMIN_SEKOLAH]) {
        const res = await call<ErrorBody>(method, url, as, method === 'GET' ? undefined : VALID)
        expect(res.status).toBe(403)
        expect(res.body.error.code).toBe('FORBIDDEN')
      }
    },
  )
})

describe('#24 GET /api/admin/schools (S9)', () => {
  it('page 1: 30 rows, name A→Z, the §6.15 A totals in meta', async () => {
    const res = await list()
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(30)
    expect(res.body.meta).toMatchObject({
      page: 1,
      pageSize: 30,
      totalItems: 10_220,
      totalPages: 341,
      from: 1,
      to: 30,
      counts: { total: 10_220, active: 10_212, inactive: 8 },
      types: ['SK', 'SMK'],
    })
    const names = res.body.data.map((s) => s.name)
    for (let i = 1; i < names.length; i++) {
      expect((names[i - 1] as string) <= (names[i] as string)).toBe(true)
    }
    expect(res.body.data[0]).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        name: expect.any(String),
        code: expect.any(String),
        type: expect.stringMatching(/^SMK?$/),
        state: expect.any(String),
        isActive: expect.any(Boolean),
        studentCount: expect.any(Number),
        teacherCount: expect.any(Number),
      }),
    )
  })

  it('the last page is 341 with "10201 … 10220" (FR-M02-78)', async () => {
    const res = await list('?page=341')
    expect(res.body.data).toHaveLength(20)
    expect(res.body.meta).toMatchObject({ page: 341, from: 10_201, to: 10_220, totalPages: 341 })
    const beyond = await list('?page=999')
    expect(beyond.status).toBe(200)
    expect(beyond.body.data).toEqual([])
    expect(beyond.body.meta).toMatchObject({ page: 999, from: null, to: null })
  })

  it('filters: state Perlis 104, type SK 7,779, SMK 2,441; counts ignore the filters', async () => {
    const perlis = await list('?state=Perlis')
    expect(perlis.body.meta.totalItems).toBe(104)
    expect(perlis.body.meta.counts.total).toBe(10_220)
    expect(perlis.body.data.every((s) => s.state === 'Perlis')).toBe(true)
    expect((await list('?type=SK')).body.meta.totalItems).toBe(7_779)
    expect((await list('?type=SMK')).body.meta.totalItems).toBe(2_441)
    const both = await list('?state=Perlis&type=SMK')
    expect(both.body.data.every((s) => s.state === 'Perlis' && s.type === 'SMK')).toBe(true)
    expect((await list('?state=Nowhere')).body.meta.totalItems).toBe(0)
  })

  it('search: name or code substring, case-insensitive; the fictitious fixtures are not listed', async () => {
    const one = schools.get(127)
    expect(one?.name).toBe('SEKOLAH KEBANGSAAN MERU RAYA')
    const byName = await list('?search=meru%20raya')
    expect(byName.body.data.map((s) => s.id)).toContain(127)
    const byCode = await list(`?search=${encodeURIComponent((one?.code ?? '').toLowerCase())}`)
    expect(byCode.body.data.map((s) => s.id)).toContain(127)
    expect((await list('?search=zzz-no-such-school')).body.data).toEqual([])
    expect((await list('?search=Demo%20Bestari')).body.meta.totalItems).toBe(0)
  })

  it('"Pelajar" counts are the observed per-school student totals (BR-24, Σ 4,092)', async () => {
    const observed: Record<number, number> = {
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
    let sum = 0
    for (const [id, expected] of Object.entries(observed)) {
      const res = await call<{ data: AdminSchool }>('GET', `/api/admin/schools/${id}`, ADMIN)
      expect(res.body.data.studentCount, `school ${id}`).toBe(expected)
      sum += res.body.data.studentCount
    }
    expect(sum).toBe(4_092)
  })
})

describe('#25 GET /api/admin/schools/:id', () => {
  it('returns the school with its counts, fixture schools included', async () => {
    const res = await call<{ data: AdminSchool }>('GET', '/api/admin/schools/8078', ADMIN)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      id: 8078,
      isActive: expect.any(Boolean),
      studentCount: 423,
      teacherCount: expect.any(Number),
    })
    const fixture = await call<{ data: AdminSchool }>('GET', '/api/admin/schools/900001', ADMIN)
    expect(fixture.status).toBe(200)
    expect(fixture.body.data.name).toBe('SMK DEMO')
  })

  it('404 NOT_FOUND for an unknown school, 404 for a malformed id', async () => {
    const res = await call<ErrorBody>('GET', '/api/admin/schools/99999', ADMIN)
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
    expect((await call('GET', '/api/admin/schools/abc', ADMIN)).status).toBe(404)
  })
})

describe('#26 POST /api/admin/schools (S10)', () => {
  it('creates a runtime school (id from 10,301) and moves the stat cards', async () => {
    dirty = true
    const res = await call<{ data: AdminSchool; status: string }>(
      'POST',
      '/api/admin/schools',
      ADMIN,
      VALID,
    )
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('Sekolah berjaya disimpan.')
    expect(res.body.data).toMatchObject({
      ...VALID,
      studentCount: 0,
      teacherCount: 0,
    })
    expect(res.body.data.id).toBeGreaterThanOrEqual(10_301)
    const after = await list()
    expect(after.body.meta.counts).toEqual({ total: 10_221, active: 10_213, inactive: 8 })
    const found = await call<{ data: AdminSchool }>(
      'GET',
      `/api/admin/schools/${String(res.body.data.id)}`,
      ADMIN,
    )
    expect(found.body.data.code).toBe('ZZZ9001')
    // The new school is searchable through the public search (active) and listed in the options.
    const search = await call<{ data: { id: number }[] }>(
      'GET',
      '/api/schools/search?q=contoh%20baru',
      null,
    )
    expect(search.body.data.map((s) => s.id)).toContain(res.body.data.id)
  })

  it('isActive defaults to true when absent; blank district / city are stored as null', async () => {
    dirty = true
    const rest = { ...VALID, isActive: undefined }
    const res = await call<{ data: AdminSchool }>('POST', '/api/admin/schools', ADMIN, {
      ...rest,
      district: '',
      city: '  ',
    })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({ isActive: true, district: null, city: null })
    const off = await call<{ data: AdminSchool }>('POST', '/api/admin/schools', ADMIN, {
      ...VALID,
      code: 'ZZZ9002',
      isActive: '0',
    })
    expect(off.body.data.isActive).toBe(false)
  })

  it('422 with fields: required, type, state, lengths, boolean (Laravel copy)', async () => {
    const empty = await call<ErrorBody>('POST', '/api/admin/schools', ADMIN, {})
    expect(empty.status).toBe(422)
    expect(empty.body.error.code).toBe('VALIDATION_ERROR')
    expect(empty.body.error.fields).toEqual({
      name: 'The name field is required.',
      code: 'The code field is required.',
      type: 'The type field is required.',
      state: 'The state field is required.',
    })
    const bad = await call<ErrorBody>('POST', '/api/admin/schools', ADMIN, {
      ...VALID,
      name: 'x'.repeat(256),
      code: 'y'.repeat(21),
      type: 'SRK',
      state: 'Atlantis',
      isActive: 'maybe',
    })
    expect(bad.body.error.fields).toEqual({
      name: 'The name field must not be greater than 255 characters.',
      code: 'The code field must not be greater than 20 characters.',
      type: 'The selected type is invalid.',
      state: 'The selected state is invalid.',
      isActive: 'The is active field must be true or false.',
    })
  })

  it('accepts every BR-21 type and all 16 states', async () => {
    dirty = true
    let n = 0
    for (const type of ['SK', 'SMK', 'SJK(C)', 'SJK(T)', 'MRSM', 'SBP']) {
      n++
      const res = await call('POST', '/api/admin/schools', ADMIN, {
        ...VALID,
        code: `TYP${String(n)}`,
        type,
      })
      expect(res.status, type).toBe(201)
    }
    const types = (await list()).body.meta.types
    expect(types).toEqual(['MRSM', 'SBP', 'SJK(C)', 'SJK(T)', 'SK', 'SMK'])
    for (const state of ['Kuala Lumpur', 'Pulau Pinang', 'Negeri Sembilan', 'Labuan']) {
      n++
      expect(
        (
          await call('POST', '/api/admin/schools', ADMIN, {
            ...VALID,
            code: `ST${String(n)}`,
            state,
          })
        ).status,
        state,
      ).toBe(201)
    }
  })

  it('code is unique, case-insensitive, also against the register and the fixtures (BR-20)', async () => {
    const register = schools.get(127)?.code ?? ''
    expect(register).not.toBe('')
    for (const code of [register, register.toLowerCase(), ' BEA4001 ']) {
      const res = await call<ErrorBody>('POST', '/api/admin/schools', ADMIN, { ...VALID, code })
      expect(res.status, code).toBe(422)
      expect(res.body.error.fields).toEqual({ code: 'The code has already been taken.' })
    }
  })
})

describe('findByCode: exact, case-insensitive, no cap on substring hits', () => {
  it('finds a short code that is a substring of more than 200 other codes', async () => {
    dirty = true
    expect(schools.list({ search: 'k', pageSize: 1 }).total).toBeGreaterThan(200)
    const made = await call<{ data: AdminSchool }>('POST', '/api/admin/schools', ADMIN, {
      ...VALID,
      code: 'K',
    })
    expect(made.status).toBe(201)
    expect(schools.findByCode('k')?.id).toBe(made.body.data.id)
    expect(schools.findByCode(' K ')?.id).toBe(made.body.data.id)
    const dup = await call<ErrorBody>('POST', '/api/admin/schools', ADMIN, { ...VALID, code: 'k' })
    expect(dup.status).toBe(422)
    expect(dup.body.error.fields).toEqual({ code: 'The code has already been taken.' })
    // A substring of other codes is not a match.
    expect(schools.findByCode('KZ')).toBeUndefined()
    expect(schools.findByCode('')).toBeUndefined()
  })
})

describe('#27 PUT /api/admin/schools/:id (S11)', () => {
  it('updates every field, keeps the id, sets updatedAt, and lets a school keep its own code', async () => {
    dirty = true
    const before = schools.get(127)
    const res = await call<{ data: AdminSchool; status: string }>(
      'PUT',
      '/api/admin/schools/127',
      ADMIN,
      {
        name: 'SEKOLAH KEBANGSAAN MERU RAYA (BARU)',
        code: before?.code,
        type: 'SMK',
        state: 'Perak',
        district: 'PPD KINTA UTARA',
        city: 'IPOH',
        isActive: false,
      },
    )
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('Sekolah berjaya disimpan.')
    expect(res.body.data).toMatchObject({
      id: 127,
      name: 'SEKOLAH KEBANGSAAN MERU RAYA (BARU)',
      code: before?.code,
      type: 'SMK',
      state: 'Perak',
      district: 'PPD KINTA UTARA',
      city: 'IPOH',
      isActive: false,
    })
    expect(res.body.data.updatedAt).toBe('2026-09-25T15:40:00+08:00')
    const stats = (await list()).body.meta.counts
    expect(stats).toEqual({ total: 10_220, active: 10_211, inactive: 9 })
  })

  it('isActive absent keeps the stored value', async () => {
    dirty = true
    const rest = { ...VALID, isActive: undefined }
    const created = await call<{ data: AdminSchool }>('POST', '/api/admin/schools', ADMIN, {
      ...VALID,
      isActive: false,
    })
    const res = await call<{ data: AdminSchool }>(
      'PUT',
      `/api/admin/schools/${String(created.body.data.id)}`,
      ADMIN,
      rest,
    )
    expect(res.body.data.isActive).toBe(false)
  })

  it("422 for another school's code and for missing fields; 404 for an unknown school", async () => {
    const other = schools.get(128)?.code ?? ''
    const dup = await call<ErrorBody>('PUT', '/api/admin/schools/127', ADMIN, {
      ...VALID,
      code: other,
    })
    expect(dup.status).toBe(422)
    expect(dup.body.error.fields).toEqual({ code: 'The code has already been taken.' })
    const missing = await call<ErrorBody>('PUT', '/api/admin/schools/127', ADMIN, { name: 'x' })
    expect(missing.status).toBe(422)
    expect(Object.keys(missing.body.error.fields ?? {})).toEqual(['code', 'type', 'state'])
    expect((await call('PUT', '/api/admin/schools/99999', ADMIN, VALID)).status).toBe(404)
  })
})

describe('#28 POST /api/admin/schools/:id/toggle', () => {
  it('flips isActive, moves the stat cards and leaves the search (active only) in step', async () => {
    dirty = true
    const off = await call<{ data: { isActive: boolean }; status: string }>(
      'POST',
      '/api/admin/schools/127/toggle',
      ADMIN,
    )
    expect(off.status).toBe(200)
    expect(off.body).toEqual({
      data: { isActive: false },
      status: 'Status sekolah berjaya dikemaskini.',
    })
    expect((await list()).body.meta.counts).toEqual({ total: 10_220, active: 10_211, inactive: 9 })
    const hidden = await call<{ data: { id: number }[] }>('GET', '/api/schools/search?id=127', null)
    expect(hidden.body.data).toEqual([])

    const on = await call<{ data: { isActive: boolean } }>(
      'POST',
      '/api/admin/schools/127/toggle',
      ADMIN,
    )
    expect(on.body.data.isActive).toBe(true)
    expect((await list()).body.meta.counts.inactive).toBe(8)
  })

  it('an inactive observed school (8277) is re-activated', async () => {
    dirty = true
    expect(schools.get(8277)?.isActive).toBe(false)
    const res = await call<{ data: { isActive: boolean } }>(
      'POST',
      '/api/admin/schools/8277/toggle',
      ADMIN,
    )
    expect(res.body.data.isActive).toBe(true)
  })

  it('404 for an unknown school', async () => {
    expect((await call('POST', '/api/admin/schools/99999/toggle', ADMIN)).status).toBe(404)
  })
})

describe('#43 school options (M04 #31, XL-13)', () => {
  it('GET /api/schools?all=1 returns every school, active and inactive, name A→Z', async () => {
    const res = await call<{ data: SchoolOption[] }>('GET', '/api/schools?all=1', ADMIN)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(10_220)
    expect(Object.keys(res.body.data[0] as object).sort()).toEqual(['id', 'name'])
    expect(res.body.data.map((o) => o.id)).toContain(8277)
    const names = res.body.data.map((o) => o.name)
    for (let i = 1; i < names.length; i++) {
      expect((names[i - 1] as string) <= (names[i] as string)).toBe(true)
    }
    // Fictitious fixture schools are outside the register.
    expect(res.body.data.some((o) => o.id >= 900_001)).toBe(false)
  })

  it('the XL-13 path answers the same list; `all=1` is required on #43', async () => {
    const a = await call<{ data: SchoolOption[] }>('GET', '/api/schools?all=1', ADMIN)
    const b = await call<{ data: SchoolOption[] }>('GET', '/api/admin/schools/options', ADMIN)
    expect(b.status).toBe(200)
    expect(b.body.data).toEqual(a.body.data)
    const none = await call<ErrorBody>('GET', '/api/schools', ADMIN)
    expect(none.status).toBe(422)
    expect(none.body.error.fields).toEqual({ all: 'The all field is required.' })
    expect((await call('GET', '/api/schools?all=0', ADMIN)).status).toBe(422)
  })

  it('a created school appears in the options', async () => {
    dirty = true
    const made = await call<{ data: AdminSchool }>('POST', '/api/admin/schools', ADMIN, VALID)
    const res = await call<{ data: SchoolOption[] }>('GET', '/api/schools?all=1', ADMIN)
    expect(res.body.data).toHaveLength(10_221)
    expect(res.body.data).toContainEqual({ id: made.body.data.id, name: VALID.name })
  })
})

describe('#40 / #41 public lookups (F-23, re-checked)', () => {
  it('GET /api/jpn: 16 JPN for a guest; GET /api/jpn/:id/ppd: PPDs, 404 for an unknown JPN', async () => {
    const jpn = await call<{ data: { id: number; name: string }[] }>('GET', '/api/jpn', null)
    expect(jpn.status).toBe(200)
    expect(jpn.body.data).toHaveLength(16)
    const ppd = await call<{ data: { id: number; jpnId: number }[] }>(
      'GET',
      '/api/jpn/15/ppd',
      null,
    )
    expect(ppd.status).toBe(200)
    expect(ppd.body.data.map((p) => p.id)).toEqual([
      127, 128, 129, 130, 131, 132, 133, 134, 135, 136,
    ])
    expect((await call('GET', '/api/jpn/99/ppd', null)).status).toBe(404)
  })
})
