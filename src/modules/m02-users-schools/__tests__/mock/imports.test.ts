/**
 * M02-T2: import, quota and existing-students handlers (SRS v1.28 §7 #12–#15, BR-14…BR-17, BR-24):
 * admin guards, S4 bulk user import and S5 DELIMa import (CSV, paste, multipart file), `ImportResult`
 * with error lines, the quota rules and the observed quota anchors (10220 2 / 1000, 8078 423 / 415).
 *
 * The subscriptions store belongs to M02-T3, so the quota reads them through the
 * `setSubscriptionSource` seam; the test registers the rows it needs (the two observed anchors of
 * E2E-M02-31 and a school without a subscription, 940).
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { users } from '@/modules/m01-authentication/mock'

import type { ExistingStudent, ImportResponse, SchoolQuota } from '../../api/imports'
import { m02Config, setSubscriptionSource, type QuotaSubscription } from '../../mock'
import {
  IMPORT_NO_DATA,
  IMPORT_NO_SUBSCRIPTION,
  IMPORT_QUOTA_SHORT,
} from '../../mock/handlers/imports'
import {
  ADMIN,
  ADMIN_SEKOLAH,
  GURU,
  IBU_BAPA,
  PELAJAR,
  bootM02,
  callAs,
  type ErrorBody,
} from './helpers'

let runtime: MockRuntime
let call: ReturnType<typeof callAs>
let dirty = false

const sub = (
  id: number,
  schoolId: number,
  studentQuota: number,
  status: QuotaSubscription['status'] = 'active',
  startsAt = '2026-01-01T00:00:00+08:00',
): QuotaSubscription => ({ id, schoolId, studentQuota, status, startsAt })

let subscriptions: QuotaSubscription[] = []

beforeAll(async () => {
  runtime = await bootM02()
  call = callAs(runtime)
}, 120_000)

beforeEach(() => {
  subscriptions = [sub(1, 10_220, 1000), sub(2, 8078, 415)]
  setSubscriptionSource((schoolId) => subscriptions.filter((s) => s.schoolId === schoolId))
})

afterEach(async () => {
  if (dirty) await runtime.reset()
  dirty = false
}, 120_000)

afterAll(() => {
  setSubscriptionSource(null)
})

const quota = (schoolId: number, as = ADMIN) =>
  call<{ data: SchoolQuota }>('GET', `/api/admin/schools/${String(schoolId)}/quota`, as)
const bulk = (body: unknown, as = ADMIN) =>
  call<ImportResponse | ErrorBody>('POST', '/api/admin/users/bulk-import', as, body)
const delima = (body: unknown, as = ADMIN) =>
  call<ImportResponse | ErrorBody>('POST', '/api/admin/students/import', as, body)
const fieldsOf = (r: { body: unknown }) => (r.body as ErrorBody).error.fields

describe('admin guards (FR-M02-99)', () => {
  const endpoints: ['GET' | 'POST', string][] = [
    ['POST', '/api/admin/users/bulk-import'],
    ['POST', '/api/admin/students/import'],
    ['GET', '/api/admin/schools/10220/quota'],
    ['GET', '/api/admin/schools/10220/students'],
  ]
  it.each(endpoints)('%s %s: guest 401, other roles 403', async (method, url) => {
    const body = method === 'POST' ? {} : undefined
    expect((await call(method, url, null, body)).status).toBe(401)
    for (const as of [PELAJAR, GURU, IBU_BAPA, ADMIN_SEKOLAH]) {
      const res = await call<ErrorBody>(method, url, as, body)
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('FORBIDDEN')
    }
  })
})

describe('#14 GET /api/admin/schools/:id/quota (BR-16, BR-25)', () => {
  it('subscribed school with quota left: 10220 uses 2 of 1000 (E2E-M02-31)', async () => {
    const res = await quota(10_220)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ hasSubscription: true, quota: 1000, used: 2, remaining: 998 })
  })

  it('full school: 8078 uses 423 of 415, remaining is 0 (never negative)', async () => {
    expect((await quota(8078)).body.data).toEqual({
      hasSubscription: true,
      quota: 415,
      used: 423,
      remaining: 0,
    })
  })

  it('a school without a subscription (940) has no other field', async () => {
    expect((await quota(940)).body.data).toEqual({ hasSubscription: false })
  })

  it('only active and grace subscriptions grant the quota; the latest one wins', async () => {
    subscriptions = [sub(10, 940, 100, 'expired'), sub(11, 940, 100, 'cancelled')]
    expect((await quota(940)).body.data).toEqual({ hasSubscription: false })
    subscriptions = [sub(10, 940, 100, 'expired'), sub(11, 940, 300, 'grace')]
    expect((await quota(940)).body.data).toMatchObject({ hasSubscription: true, quota: 300 })
    subscriptions = [
      sub(20, 940, 100, 'active', '2026-01-01T00:00:00+08:00'),
      sub(21, 940, 250, 'active', '2026-06-01T00:00:00+08:00'),
      sub(22, 940, 50, 'active', '2026-03-01T00:00:00+08:00'),
    ]
    expect((await quota(940)).body.data).toMatchObject({ quota: 250 })
  })

  it('with no source registered nobody has a subscription', async () => {
    setSubscriptionSource(null)
    expect((await quota(10_220)).body.data).toEqual({ hasSubscription: false })
  })

  it('404 for an unknown school', async () => {
    const res = await call<ErrorBody>('GET', '/api/admin/schools/99999/quota', ADMIN)
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})

describe('#15 GET /api/admin/schools/:id/students (BR-17)', () => {
  const students = (schoolId: number, query = '') =>
    call<{ data: ExistingStudent[] }>(
      'GET',
      `/api/admin/schools/${String(schoolId)}/students${query}`,
      ADMIN,
    )

  it('lists the students of the school, name A→Z, active and inactive', async () => {
    const res = await students(10_220)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    const names = res.body.data.map((s) => s.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    for (const s of res.body.data) {
      expect(Object.keys(s).sort()).toEqual([
        'classLevel',
        'email',
        'id',
        'idDelima',
        'isActive',
        'name',
      ])
      expect(users.get(s.id)).toMatchObject({ role: 'student', schoolId: 10_220 })
    }
  })

  it('caps the answer at 200 rows (8078 has 423 students)', async () => {
    const res = await students(8078)
    expect(res.body.data).toHaveLength(200)
    expect(new Set(res.body.data.map((s) => s.id)).size).toBe(200)
  })

  it('filters by class level and by name / e-mail / DELIMa ID text', async () => {
    const all = (await students(8102)).body.data
    const level = all.find((s) => s.classLevel !== null)?.classLevel as string
    const byLevel = await students(8102, `?classLevel=${level}`)
    expect(byLevel.body.data.length).toBeGreaterThan(0)
    expect(byLevel.body.data.every((s) => s.classLevel === level)).toBe(true)
    const first = all[0] as ExistingStudent
    const byName = await students(8102, `?search=${encodeURIComponent(first.name.toUpperCase())}`)
    expect(byName.body.data.map((s) => s.id)).toContain(first.id)
    const byEmail = await students(8102, `?search=${encodeURIComponent(first.email.toLowerCase())}`)
    expect(byEmail.body.data.map((s) => s.id)).toContain(first.id)
    expect((await students(8102, '?search=zzz-nobody')).body.data).toEqual([])
    expect((await students(8102, '?classLevel=T9')).body.data).toEqual([])
  })

  it('matches an imported DELIMa ID and shows it', async () => {
    dirty = true
    const done = await delima({
      schoolId: 10_220,
      classLevel: 'T4',
      importMode: 'paste',
      pasteContent: 'Pelajar Demo Satu\nm-9001@moe-dl.edu.my\nRahsia88',
    })
    expect(done.status).toBe(200)
    const res = await students(10_220, '?search=m-9001')
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]).toMatchObject({
      name: 'Pelajar Demo Satu',
      email: 'm-9001@moe-dl.edu.my',
      idDelima: 'm-9001@moe-dl.edu.my',
      classLevel: 'T4',
      isActive: true,
    })
  })

  it('404 for an unknown school', async () => {
    expect((await students(99_999)).status).toBe(404)
  })
})

describe('#12 POST /api/admin/users/bulk-import (S4, BR-14)', () => {
  it('E2E-M02-29: teacher import with a header, an existing e-mail and a row without password', async () => {
    dirty = true
    const res = await bulk({
      role: 'teacher',
      schoolId: 10_220,
      importMode: 'paste',
      pasteContent: [
        'Nama,Emel,Telefon,Kata Laluan',
        'Guru Satu,guru.satu@contoh.my,0123456789,Rahsia123',
        'Guru Dua,guru.dua@contoh.my',
        'Pelajar Sedia Ada,pelajar@demo.test',
      ].join('\n'),
    })
    expect(res.status).toBe(200)
    const body = res.body as ImportResponse
    expect(body.data).toEqual({ created: 2, skipped: 1, failed: 0, errors: [] })
    expect(body.status).toBe('Import selesai: 2 pengguna didaftarkan, 1 dilangkau, 0 gagal.')

    const one = users.findByEmail('guru.satu@contoh.my')
    const two = users.findByEmail('guru.dua@contoh.my')
    expect(one).toMatchObject({
      name: 'Guru Satu',
      role: 'teacher',
      schoolId: 10_220,
      phone: '0123456789',
      isActive: true,
      createdById: ADMIN,
    })
    expect(one?.id).toBeGreaterThanOrEqual(9_000_001)
    expect(two).toMatchObject({ role: 'teacher', schoolId: 10_220, phone: null })
    // Given password, and the configured default (SEC-M02-03) for the row without one.
    expect(users.verifyPassword((one as { id: number }).id, 'Rahsia123')).toBe(true)
    expect(
      users.verifyPassword((two as { id: number }).id, m02Config().bulkImportDefaultPassword),
    ).toBe(true)
    // The existing account is untouched.
    expect(users.findByEmail('pelajar@demo.test')?.role).toBe('student')
  })

  it('a typed default password wins; a cleared field falls back to the configured default', async () => {
    dirty = true
    await bulk({
      role: 'parent',
      importMode: 'paste',
      pasteContent: 'Ibu Satu,ibu.satu@contoh.my',
      defaultPassword: 'Tersendiri9',
    })
    await bulk({
      role: 'parent',
      importMode: 'paste',
      pasteContent: 'Ibu Dua,ibu.dua@contoh.my',
      defaultPassword: '   ',
    })
    runtime.config.set('bulkImportDefaultPassword', 'Lain12345')
    await bulk({
      role: 'parent',
      importMode: 'paste',
      pasteContent: 'Ibu Tiga,ibu.tiga@contoh.my',
    })
    const id = (email: string) => (users.findByEmail(email) as { id: number }).id
    expect(users.verifyPassword(id('ibu.satu@contoh.my'), 'Tersendiri9')).toBe(true)
    expect(users.verifyPassword(id('ibu.dua@contoh.my'), 'Import2026')).toBe(true)
    expect(users.verifyPassword(id('ibu.tiga@contoh.my'), 'Lain12345')).toBe(true)
    // Parents are created without links and without a school when none is given.
    expect(users.findByEmail('ibu.satu@contoh.my')).toMatchObject({
      role: 'parent',
      schoolId: null,
    })
  })

  it('reports created / skipped / failed and the failed lines (1-based, blank lines counted)', async () => {
    dirty = true
    const res = await bulk({
      role: 'teacher',
      schoolId: 10_220,
      importMode: 'csv',
      csvFile: [
        'name,email',
        'Guru A,a@contoh.my',
        '',
        ',tanpa.nama@contoh.my',
        'Guru B,bukan-emel',
        'Guru A Lagi,A@contoh.my',
        'Guru C,c@contoh.my',
      ].join('\n'),
    })
    expect(res.status).toBe(200)
    expect((res.body as ImportResponse).data).toEqual({
      created: 2,
      skipped: 1,
      failed: 2,
      errors: [
        { line: 4, message: 'Nama diperlukan.' },
        { line: 5, message: 'Emel tidak sah.' },
      ],
    })
    expect((res.body as ImportResponse).status).toBe(
      'Import selesai: 2 pengguna didaftarkan, 1 dilangkau, 2 gagal.',
    )
  })

  it('a school admin import carries the school JPN and PPD (INFERRED, BR-09)', async () => {
    dirty = true
    await bulk({
      role: 'school_admin',
      schoolId: 8078,
      importMode: 'paste',
      pasteContent: 'Admin Baru,admin.baru@contoh.my',
    })
    expect(users.findByEmail('admin.baru@contoh.my')).toMatchObject({
      role: 'school_admin',
      schoolId: 8078,
      ppdState: 'Selangor',
      ppdDistrict: 'PPD HULU LANGAT',
    })
  })

  it('reads an uploaded CSV file (multipart)', async () => {
    dirty = true
    const form = new FormData()
    form.append('role', 'teacher')
    form.append('schoolId', '10220')
    form.append('importMode', 'csv')
    form.append('csvFile', new File(['Guru Fail,guru.fail@contoh.my,,Rahsia123\n'], 'demo.csv'))
    const res = await bulk(form)
    expect(res.status).toBe(200)
    expect((res.body as ImportResponse).data.created).toBe(1)
    expect(users.findByEmail('guru.fail@contoh.my')).toMatchObject({ schoolId: 10_220 })
  })

  it('422 when role, school, mode or data is missing (S4 copy)', async () => {
    const empty = await bulk({})
    expect(empty.status).toBe(422)
    expect(fieldsOf(empty)).toEqual({
      role: 'The role field is required.',
      importMode: 'The import mode field is required.',
    })
    const noSchool = await bulk({ role: 'teacher', importMode: 'paste', pasteContent: 'A,a@x.my' })
    expect(fieldsOf(noSchool)).toEqual({ schoolId: 'The school id field is required.' })
    const noSchoolAdmin = await bulk({
      role: 'school_admin',
      importMode: 'paste',
      pasteContent: 'A,a@x.my',
    })
    expect(fieldsOf(noSchoolAdmin)).toEqual({ schoolId: 'The school id field is required.' })
    const noText = await bulk({ role: 'parent', importMode: 'paste', pasteContent: '  \n ' })
    expect(fieldsOf(noText)).toEqual({ pasteContent: IMPORT_NO_DATA })
    const noFile = await bulk({ role: 'parent', importMode: 'csv' })
    expect(fieldsOf(noFile)).toEqual({ csvFile: IMPORT_NO_DATA })
    const headerOnly = await bulk({ role: 'parent', importMode: 'csv', csvFile: 'name,email' })
    expect(fieldsOf(headerOnly)).toEqual({ csvFile: IMPORT_NO_DATA })
    expect((noSchool.body as ErrorBody).error.message).toBe('The school id field is required.')
  })

  it('422 for an invalid role, mode, school and a too-short default password', async () => {
    const res = await bulk({
      role: 'student',
      schoolId: 99_999,
      importMode: 'zip',
      defaultPassword: 'abc',
    })
    expect(fieldsOf(res)).toEqual({
      role: 'The selected role is invalid.',
      schoolId: 'The selected school id is invalid.',
      defaultPassword: 'The default password field must be at least 6 characters.',
      importMode: 'The selected import mode is invalid.',
    })
    const admin = await bulk({ role: 'admin', importMode: 'paste', pasteContent: 'A,a@x.my' })
    expect(fieldsOf(admin)).toEqual({ role: 'The selected role is invalid.' })
  })

  it('nothing is created by a refused request', async () => {
    const before = users.countWhere({ role: 'teacher' })
    await bulk({ role: 'teacher', importMode: 'paste', pasteContent: 'A,a@x.my' })
    expect(users.countWhere({ role: 'teacher' })).toBe(before)
  })
})

describe('#13 POST /api/admin/students/import (S5, BR-15)', () => {
  const body = (over: Record<string, unknown> = {}) => ({
    schoolId: 10_220,
    classLevel: 'T4',
    importMode: 'paste',
    pasteContent: '',
    ...over,
  })

  it('E2E-M02-35: two records, one existing DELIMa ID → 1 created, 1 skipped, Title Case, logs in', async () => {
    dirty = true
    const res = await delima(
      body({
        pasteContent: [
          'PELAJAR DEMO DUA',
          'pelajar.dua@moe-dl.edu.my',
          'Rahsia8899',
          '',
          'Sudah Ada',
          'pelajar@demo.test',
          'Rahsia8899',
        ].join('\n'),
      }),
    )
    expect(res.status).toBe(200)
    expect((res.body as ImportResponse).data).toEqual({
      created: 1,
      skipped: 1,
      failed: 0,
      errors: [],
    })
    expect((res.body as ImportResponse).status).toBe(
      'Import selesai: 1 pelajar didaftarkan, 1 dilangkau.',
    )
    const made = users.findByEmail('pelajar.dua@moe-dl.edu.my')
    expect(made).toMatchObject({
      name: 'Pelajar Demo Dua',
      role: 'student',
      email: 'pelajar.dua@moe-dl.edu.my',
      idDelima: 'pelajar.dua@moe-dl.edu.my',
      schoolId: 10_220,
      grade: 10,
      classLevel: 'T4',
      isActive: true,
    })
    expect(made?.id).toBeGreaterThanOrEqual(9_000_001)
    expect(users.verifyPassword((made as { id: number }).id, 'Rahsia8899')).toBe(true)
    // The quota panel follows (used 2 → 3).
    expect((await quota(10_220)).body.data).toMatchObject({ used: 3, remaining: 997 })
  })

  it('class levels give the grade: D1 → 1, D6 → 6, T1 → 7, T5 → 11', async () => {
    dirty = true
    let n = 0
    for (const [level, grade] of [
      ['D1', 1],
      ['D6', 6],
      ['T1', 7],
      ['T5', 11],
    ] as const) {
      n++
      const email = `lvl${String(n)}@moe-dl.edu.my`
      const res = await delima(
        body({ classLevel: level, pasteContent: `Murid ${level}\n${email}\nKata12345` }),
      )
      expect(res.status, level).toBe(200)
      expect(users.findByEmail(email)?.grade, level).toBe(grade)
    }
  })

  it('CSV mode: header skipped, optional IC stored (verifiable, never returned), failed lines listed', async () => {
    dirty = true
    const res = await delima(
      body({
        importMode: 'csv',
        csvFile: [
          'Nama,Email DELIMa,Kata Laluan,IC',
          'ali baba,ali@moe-dl.edu.my,Kata1234,990101015555',
          'Tiada Kata,tk@moe-dl.edu.my,',
          'Emel Buruk,buruk,Kata1234',
        ].join('\n'),
        pasteContent: undefined,
      }),
    )
    expect(res.status).toBe(200)
    expect((res.body as ImportResponse).data).toEqual({
      created: 1,
      skipped: 0,
      failed: 2,
      errors: [
        { line: 3, message: 'Kata laluan DELIMa diperlukan.' },
        { line: 4, message: 'Emel DELIMa tidak sah.' },
      ],
    })
    const made = users.findByEmail('ali@moe-dl.edu.my') as { id: number; name: string }
    expect(made.name).toBe('Ali Baba')
    expect(users.verifyIc(made.id, '990101015555')).toBe(true)
    expect(JSON.stringify(res.body)).not.toContain('990101015555')
  })

  it('refuses a school without an active subscription (940) with the observed panel text', async () => {
    const res = await delima(body({ schoolId: 940, pasteContent: 'A\na@moe-dl.edu.my\npw12345' }))
    expect(res.status).toBe(422)
    expect(fieldsOf(res)).toEqual({ schoolId: IMPORT_NO_SUBSCRIPTION })
    expect((res.body as ErrorBody).error.message).toBe(
      'Sekolah ini tiada langganan aktif. Import pelajar tidak dibenarkan.',
    )
    expect(users.findByEmail('a@moe-dl.edu.my')).toBeUndefined()
  })

  it('refuses when the quota is full (8078: 423 / 415)', async () => {
    const res = await delima(
      body({ schoolId: 8078, pasteContent: 'Murid Baru\nbaru8078@moe-dl.edu.my\npw12345' }),
    )
    expect(res.status).toBe(422)
    expect(fieldsOf(res)).toEqual({ schoolId: IMPORT_QUOTA_SHORT })
    expect(users.findByEmail('baru8078@moe-dl.edu.my')).toBeUndefined()
  })

  it('a full school still accepts an import whose records are all skipped (nothing new)', async () => {
    const res = await delima(
      body({ schoolId: 8078, pasteContent: 'Sudah Ada\npelajar@demo.test\npw12345' }),
    )
    expect(res.status).toBe(200)
    expect((res.body as ImportResponse).data).toMatchObject({ created: 0, skipped: 1, failed: 0 })
  })

  it('more new records than the remaining quota refuses the whole import (nothing created)', async () => {
    subscriptions = [sub(1, 10_220, 3)] // used 2, remaining 1
    const res = await delima(
      body({
        pasteContent: 'Satu\nsatu@moe-dl.edu.my\npw12345\n\nDua\ndua@moe-dl.edu.my\npw12345',
      }),
    )
    expect(res.status).toBe(422)
    expect(fieldsOf(res)).toEqual({ schoolId: 'Kuota tidak mencukupi.' })
    expect(users.findByEmail('satu@moe-dl.edu.my')).toBeUndefined()
    expect(users.findByEmail('dua@moe-dl.edu.my')).toBeUndefined()
    dirty = true
    // Exactly the remaining quota is accepted.
    const fits = await delima(body({ pasteContent: 'Satu\nsatu@moe-dl.edu.my\npw12345' }))
    expect(fits.status).toBe(200)
    expect((await quota(10_220)).body.data).toMatchObject({ used: 3, remaining: 0 })
  })

  it('accepts a multipart file upload', async () => {
    dirty = true
    const form = new FormData()
    form.append('schoolId', '10220')
    form.append('classLevel', 'D3')
    form.append('importMode', 'csv')
    form.append('csvFile', new File(['Anak Murid,anak@moe-dl.edu.my,Kata1234\n'], 'delima.csv'))
    const res = await delima(form)
    expect(res.status).toBe(200)
    expect(users.findByEmail('anak@moe-dl.edu.my')).toMatchObject({ grade: 3, classLevel: 'D3' })
  })

  it('422 for missing or invalid school, class level, mode and data', async () => {
    const empty = await delima({})
    expect(fieldsOf(empty)).toEqual({
      schoolId: 'The school id field is required.',
      classLevel: 'The class level field is required.',
      importMode: 'The import mode field is required.',
    })
    const bad = await delima({
      schoolId: 99_999,
      classLevel: 'T6',
      importMode: 'paste',
      pasteContent: 'x',
    })
    expect(fieldsOf(bad)).toEqual({
      schoolId: 'The selected school id is invalid.',
      classLevel: 'The selected class level is invalid.',
    })
    const noData = await delima(body({ pasteContent: '\n\n' }))
    expect(fieldsOf(noData)).toEqual({ pasteContent: IMPORT_NO_DATA })
    const noFile = await delima(body({ importMode: 'csv' }))
    expect(fieldsOf(noFile)).toEqual({ csvFile: IMPORT_NO_DATA })
  })

  it('the configured bulk default is not used for DELIMa students (their own password is required)', async () => {
    const res = await delima(body({ pasteContent: 'Tiada Kata\ntk@moe-dl.edu.my' }))
    expect(res.status).toBe(200)
    expect((res.body as ImportResponse).data).toMatchObject({ created: 0, failed: 1 })
  })
})
