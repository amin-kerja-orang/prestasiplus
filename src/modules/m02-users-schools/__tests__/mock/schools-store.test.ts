/**
 * F-23 schools store (owner M02; SRS v1.18 §6.15 A, §7 #38, #40, #41) and its links to the users
 * store: every build-check total and named query, the fixture schools 900001–900004, the M18
 * register pins, the public endpoints, and `/api/me` returning `school`.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { createClock } from '@/lib/time'
import { issueSession } from '@/mock/core-data'
import { checkNamedQueries } from '@/mock/dataset'
import { bootMock, type MockRuntime } from '@/mock/index'
import { repositoryInfo } from '@/mock/repository'
import { users } from '@/modules/m01-authentication/mock'

import plugin, { computeExpiry, FIXTURE_SCHOOL_IDS, schools, type School } from '../../mock'
import { PPD_LIST } from '../../mock/data/geo'
import { SCHOOL_ANCHOR_ROWS } from '../../mock/datasets/schools-anchors'
import { schoolQueries, showPrimarySchools } from '../../mock/repository/schools'

const NOW = '2026-09-25T15:40:00+08:00'

let runtime: MockRuntime

beforeAll(async () => {
  // These tests assert the observed live register; the hiding of primary-type schools (D72) is covered
  // by secondary-only.test.ts.
  showPrimarySchools()
  runtime = await bootMock({
    mode: 'test',
    clock: createClock({ at: NOW }),
    latencyMs: 0,
    onWarn: null,
  })
}, 60_000)

function s(id: number): School {
  const row = schools.get(id)
  if (!row) throw new Error(`no school ${String(id)}`)
  return row
}

async function get(url: string, token?: string) {
  return runtime.transport.request({
    method: 'GET',
    url,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

describe('schools dataset: build check (M02 §6.15 A)', () => {
  it('reproduces every documented figure', () => {
    expect(checkNamedQueries(schoolQueries)).toEqual([])
    expect(schools.count('S-ALL')).toBe(10_220)
    expect(schools.counts()).toEqual({ total: 10_220, active: 10_212, inactive: 8 })
    expect(schools.count('S-TYPE', 'SK')).toBe(7_779)
    expect(schools.count('S-TYPE', 'SMK')).toBe(2_441)
    expect(schools.countWhere({ type: ['SJK(C)', 'SJK(T)', 'MRSM', 'SBP'] })).toBe(0)
    expect(schools.count('S-STATE', 'Perlis')).toBe(104)
    expect(Math.ceil(10_220 / 30)).toBe(341)
  })

  it('pins the M18 register: Johor 1,189 (11 PPD cells), Perak 1,102, KLUANG 118, BATANG PADANG 122', () => {
    expect(schools.count('S-STATE-REGISTER', 'Johor')).toBe(1_189)
    expect(schools.count('S-STATE-REGISTER', 'Perak')).toBe(1_102)
    // v1.21: the fixture schools are outside every count, so the Johor facet is the register.
    expect(schools.count('S-STATE', 'Johor')).toBe(1_189)
    expect(schools.count('S-STATE', 'Perak')).toBe(1_102)
    expect(schools.count('S-DISTRICT', 'PPD KLUANG')).toBe(118)
    expect(schools.count('S-DISTRICT', 'PPD BATANG PADANG')).toBe(122)
    expect(schools.count('S-DISTRICT', 'PPD BATU PAHAT')).toBe(176)
    expect(schools.count('S-DISTRICT', 'PPD TANGKAK')).toBe(81)
    // Every Johor / Perak register school is an anchor (observed id and name).
    const register = SCHOOL_ANCHOR_ROWS.filter(
      (a) => (a.state === 'Johor' || a.state === 'Perak') && a.id < 900_000,
    )
    expect(register).toHaveLength(2_291)
    expect(s(127).name).toBe('SEKOLAH KEBANGSAAN MERU RAYA')
    expect(s(1)).toMatchObject({
      name: 'SEKOLAH KEBANGSAAN TOH TANDEWA SAKTI',
      state: 'Perak',
      district: 'PPD BATANG PADANG',
    })
    expect(s(7780)).toMatchObject({ state: 'Perak', district: 'PPD BATANG PADANG', type: 'SMK' })
  })

  it('has the 8 inactive schools, including the anchors 8277, 8880 and 2710', () => {
    expect(s(8277)).toMatchObject({ name: 'SAM HULU LANGAT', code: 'BFT4001', isActive: false })
    expect(s(8880)).toMatchObject({
      code: 'JEB2037',
      type: 'SMK',
      state: 'Johor',
      district: 'PPD KLUANG',
      isActive: false,
    })
    expect(s(2710)).toMatchObject({ type: 'SK', district: 'PPD KLUANG', isActive: false })
    expect(schools.countWhere({ isActive: false })).toBe(8)
  })

  it('keeps the fixture schools 900001–900004 outside every count, search and option list (v1.21)', () => {
    expect(schools.count('S-ALL')).toBe(10_220)
    expect(schools.countWhere({ id: { gte: 900_001, lte: 900_099 } })).toBe(0)
    expect(schools.options().some((o) => o.id >= 900_001)).toBe(false)
    expect(schools.search({ q: 'SMK DEMO' })).toEqual([])
    expect(schools.list({ search: 'Demo Bestari' }).total).toBe(0)
    expect(schools.getMany([900_001, 8102, 900_004]).map((r) => r.id)).toEqual([
      900_001, 8102, 900_004,
    ])
    expect(schools.summary(900_003)?.name).toBe('SMK Demo Seri Putra')
  })

  it('has the fixture schools 900001–900004 in the reserved range (stored rows)', () => {
    expect(s(FIXTURE_SCHOOL_IDS.smkDemo)).toMatchObject({
      name: 'SMK DEMO',
      code: 'BEA4001',
      type: 'SMK',
      state: 'Selangor',
      district: 'PPD PETALING UTAMA',
      isActive: true,
    })
    expect(s(900_002)).toMatchObject({
      name: 'SK Demo',
      code: '',
      type: 'SK',
      state: 'Johor',
      isActive: true,
    })
    expect(s(900_003)).toMatchObject({
      name: 'SMK Demo Seri Putra',
      code: 'DMO0003',
      district: 'PPD HULU LANGAT',
    })
    expect(s(900_004)).toMatchObject({
      name: 'SK Demo Bestari',
      code: '',
      type: 'SK',
      state: 'Johor',
      isActive: true,
    })
    expect(schools.isFixture(900_004)).toBe(true)
    expect(schools.isFixture(8102)).toBe(false)
  })

  it('has the observed real anchors (S16 school, S14 records, M16 900, ranking districts)', () => {
    expect(s(8102)).toMatchObject({
      name: 'SEKOLAH MENENGAH KEBANGSAAN BANDAR TASIK KESUMA',
      code: 'BEA4628',
      district: 'PPD HULU LANGAT',
    })
    expect(s(8106)).toMatchObject({ code: 'BEA4632', district: 'PPD HULU LANGAT' })
    expect(s(987).name).toBe('SEKOLAH KEBANGSAAN BANDAR BARU BANGI')
    expect(s(900)).toMatchObject({
      type: 'SK',
      state: 'Selangor',
      district: 'PPD KUALA LANGAT',
      isActive: true,
    })
    expect(s(8284).district).toBe('PPD SABAK BERNAM')
    for (const id of [8078, 8080, 8082, 8088, 8090]) expect(s(id).district).toBe('PPD HULU LANGAT')
    expect(s(10_220).name).toBe('SMK Leqoe')
    expect(s(9681).code).toBe('')
    expect(s(9801).code).toBe('')
  })

  it('references only existing schools from the users store, and the fixture admins use their school code', () => {
    for (const id of users.schoolsWithUsers())
      expect(schools.get(id), `school ${String(id)}`).toBeDefined()
    for (const id of [5601, 5602, 5603, 5604, 5605]) {
      const admin = users.get(id)
      const school = schools.get(admin?.schoolId as number)
      expect(admin?.email).toBe(`${school?.code.toLowerCase() ?? ''}@prestasiplus.my`)
    }
  })
})

describe('schools repository: search (#38)', () => {
  it('matches name or code case-insensitively, active schools only, default limit 20', () => {
    const bangi = schools.search({ q: 'bangi' })
    expect(bangi[0]).toMatchObject({
      name: 'SEKOLAH JENIS KEBANGSAAN (TAMIL) BANGI',
      code: 'BBD4051',
      type: 'SK',
    })
    expect(bangi.map((r) => r.id)).toEqual(expect.arrayContaining([987, 8078]))
    expect(schools.search({ q: 'zzz' })).toEqual([])
    expect(schools.search({ q: 'SEKOLAH' })).toHaveLength(20)
    expect(schools.search({ q: 'SEKOLAH', limit: 50 })).toHaveLength(50)
    expect(schools.search({ q: 'bea4628' }).map((r) => r.id)).toEqual([8102])
    // Inactive schools are never returned.
    expect(schools.search({ q: 'SAM HULU LANGAT' })).toEqual([])
    expect(schools.search({ id: 8277 })).toEqual([])
    expect(schools.search({ id: 8102 })).toHaveLength(1)
    // State filter; a state with an empty query lists that state's schools.
    const johor = schools.search({ state: 'Johor', limit: 2000 })
    expect(johor).toHaveLength(1_189 - 2) // 8880 and 2710 are inactive; no fixture school
    expect(johor.every((r) => r.state === 'Johor')).toBe(true)
    expect(schools.search({ q: 'kluang', state: 'Perak' })).toEqual([])
  })

  it('lists every school A→Z for #43 and pages the S9 list', () => {
    const options = schools.options()
    expect(options).toHaveLength(10_220)
    const names = options.map((o) => o.name)
    expect([...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(names)
    expect(schools.list({ state: 'Perlis' }).total).toBe(104)
    expect(schools.list({ type: 'SK' }).total).toBe(7_779)
    expect(schools.list({}).rows).toHaveLength(30)
  })

  it('creates runtime schools from 10,301, skipping the reserved range', () => {
    const created = schools.create(
      {
        name: 'SK UJIAN',
        code: 'TST0001',
        type: 'SK',
        state: 'Selangor',
        district: 'PPD GOMBAK',
        isActive: true,
      },
      Date.parse(NOW),
    )
    expect(created.id).toBeGreaterThanOrEqual(10_301)
    expect(created.id).toBeLessThan(900_001)
    expect(schools.count('S-ALL')).toBe(10_221)
    const toggled = schools.toggleActive(created.id, Date.parse(NOW))
    expect(toggled.isActive).toBe(false)
    expect(schools.search({ q: 'SK UJIAN' })).toEqual([])
  })

  it('is the M02 schools repository exported by the M02 plugin', () => {
    expect(repositoryInfo(schools)).toMatchObject({
      owner: 'M02',
      provisional: false,
      kind: 'virtual',
    })
    // M02-T1 adds `parentLinks` and `schoolAdminPackages` (later tasks add more): the schools repository must stay.
    expect(Object.keys(plugin.repositories)).toContain('schools')
  })
})

describe('public endpoints (#38, #40, #41) and /api/me', () => {
  it('GET /api/schools/search answers guests with {data: SchoolSummary[]}', async () => {
    const res = await get('/api/schools/search?q=bangi&limit=15')
    expect(res.status).toBe(200)
    const data = (res.body as { data: Record<string, unknown>[] }).data
    expect(data[0]).toEqual({
      id: 1003,
      name: 'SEKOLAH JENIS KEBANGSAAN (TAMIL) BANGI',
      code: 'BBD4051',
      type: 'SK',
      state: 'Selangor',
      district: 'PPD HULU LANGAT',
      city: null,
    })
    const none = await get('/api/schools/search?q=zzz')
    expect((none.body as { data: unknown[] }).data).toEqual([])
    // v1.21: fixture schools are outside the search, also by id.
    const byId = await get('/api/schools/search?id=900001')
    expect((byId.body as { data: unknown[] }).data).toEqual([])
    const real = await get('/api/schools/search?id=8102')
    expect((real.body as { data: { name: string }[] }).data.map((d) => d.name)).toEqual([
      'SEKOLAH MENENGAH KEBANGSAAN BANDAR TASIK KESUMA',
    ])
    const dflt = await get('/api/schools/search?q=sekolah')
    expect((dflt.body as { data: unknown[] }).data).toHaveLength(20)
  })

  it('GET /api/jpn lists the 16 JPN; /api/jpn/:id/ppd the PPDs (Selangor 10), 404 when unknown', async () => {
    const jpn = await get('/api/jpn')
    const list = (jpn.body as { data: { id: number; name: string }[] }).data
    expect(list).toHaveLength(16)
    expect(list.map((j) => j.name)).toEqual([
      'Johor',
      'Kedah',
      'Kelantan',
      'Kuala Lumpur',
      'Labuan',
      'Melaka',
      'Negeri Sembilan',
      'Pahang',
      'Perak',
      'Perlis',
      'Pulau Pinang',
      'Putrajaya',
      'Sabah',
      'Sarawak',
      'Selangor',
      'Terengganu',
    ])
    const selangor = list.find((j) => j.name === 'Selangor')
    const ppd = await get(`/api/jpn/${String(selangor?.id)}/ppd`)
    const ppds = (ppd.body as { data: { id: number; code: string; name: string }[] }).data
    expect(ppds.map((p) => p.name)).toEqual([
      'PPD Gombak',
      'PPD Hulu Langat',
      'PPD Hulu Selangor',
      'PPD Klang',
      'PPD Kuala Langat',
      'PPD Kuala Selangor',
      'PPD Petaling Perdana',
      'PPD Petaling Utama',
      'PPD Sabak Bernam',
      'PPD Sepang',
    ])
    expect(ppds.map((p) => p.id)).toEqual([127, 128, 129, 130, 131, 132, 133, 134, 135, 136])
    expect(ppds[1]?.code).toBe('PPD HULU LANGAT')
    expect((await get('/api/jpn/99/ppd')).status).toBe(404)
    // Every JPN has at least one PPD, and PPD ids are unique.
    expect(new Set(PPD_LIST.map((p) => p.id)).size).toBe(PPD_LIST.length)
    for (const j of list) expect(PPD_LIST.some((p) => p.jpnId === j.id)).toBe(true)
  })

  it('GET /api/me returns the school summary of accounts that have one', async () => {
    const at = Date.parse(NOW)
    const student = issueSession(users.get(2) as never, false, at)
    const me = await get('/api/me', student.token)
    expect(me.status).toBe(200)
    expect((me.body as { data: { school: unknown } }).data.school).toEqual({
      id: 900_001,
      name: 'SMK DEMO',
      code: 'BEA4001',
      type: 'SMK',
      state: 'Selangor',
      district: 'PPD PETALING UTAMA',
      city: null,
    })
    const maju = issueSession(users.get(4) as never, false, at)
    const me4 = await get('/api/me', maju.token)
    expect(
      (me4.body as { data: { school: { id: number; name: string } } }).data.school,
    ).toMatchObject({
      id: 900_001,
      name: 'SMK DEMO',
    })
    const admin = issueSession(users.get(1) as never, false, at)
    const me1 = await get('/api/me', admin.token)
    expect((me1.body as { data: { school: unknown } }).data.school).toBeNull() // D72: the central admin has no school
    const noSchool = issueSession(users.get(3) as never, false, at)
    const me3 = await get('/api/me', noSchool.token)
    expect((me3.body as { data: { school: unknown } }).data.school).toBeNull()
  })
})

describe('BR-12 computeExpiry (provisional host of M19 billing.computeExpiry)', () => {
  const at = (iso: string) => Date.parse(iso)
  it('regular_monthly: +1 calendar month at the same MYT time, clamped to the month end', () => {
    expect(computeExpiry('regular_monthly', 'monthly', at('2026-06-15T13:59:00+08:00'))).toBe(
      '2026-07-15T13:59:00+08:00',
    )
    expect(computeExpiry('regular_monthly', 'monthly', at('2026-01-31T10:00:00+08:00'))).toBe(
      '2026-02-28T10:00:00+08:00',
    )
    expect(computeExpiry('regular_monthly', 'monthly', at('2026-12-31T23:30:00+08:00'))).toBe(
      '2027-01-31T23:30:00+08:00',
    )
  })
  it('personal one-time ("Personal Setahun"): the next 10 January 23:59:59 MYT (3318 → 2027-01-10)', () => {
    expect(computeExpiry('personal', 'onetime', at('2026-09-25T15:40:00+08:00'))).toBe(
      '2027-01-10T23:59:59+08:00',
    )
    expect(computeExpiry('personal', 'onetime', at('2026-01-05T08:00:00+08:00'))).toBe(
      '2026-01-10T23:59:59+08:00',
    )
    expect(computeExpiry('personal', 'onetime', at('2026-01-11T00:00:00+08:00'))).toBe(
      '2027-01-10T23:59:59+08:00',
    )
  })
  it('personal monthly ("Personal Bulanan", M19 DV-M19-18): +1 month (5600 → 2026-10-13 12:35)', () => {
    expect(computeExpiry('personal', 'monthly', at('2026-09-13T12:35:00+08:00'))).toBe(
      '2026-10-13T12:35:00+08:00',
    )
    expect(computeExpiry('personal', 'monthly', at('2026-01-31T09:00:00+08:00'))).toBe(
      '2026-02-28T09:00:00+08:00',
    )
  })
  it('none: null', () => {
    expect(computeExpiry('none', 'monthly', at('2026-09-25T15:40:00+08:00'))).toBeNull()
  })
})
