/**
 * M02-T3: complimentary students and the teacher / classroom pickers (SRS v1.28 §7 #16–#23; BR-18,
 * BR-19; §6.14 "Complimentary"): the 90 seeded students (2 pages at 50, coins OFF, enrolled in teacher
 * 5302's classes), S7 registration, bulk actions, toggles, the detail and the M14 seams.
 */

import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { users } from '@/modules/m01-authentication/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import type {
  CompStudentCounts,
  CompStudentDetail,
  CompStudentListItem,
  TeacherClassroomOption,
  TeacherOption,
} from '../../api/comp-students'
import type { ImportResponse } from '../../api/imports'
import { complimentary, setCompWalletSource } from '../../mock'
import {
  MSG_COMP_ACTION_DONE,
  MSG_COMP_BAD_LINE,
  MSG_COMP_SHORT_IC,
  compCreatedText,
} from '../../mock/handlers/comp-students'
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
import { bootM02Full } from './helpers-t3'

let runtime: MockRuntime
let call: ReturnType<typeof callAs>
let dirty = false

beforeAll(async () => {
  runtime = await bootM02Full()
  call = callAs(runtime)
}, 180_000)

afterEach(async () => {
  setCompWalletSource(null)
  if (dirty) await runtime.reset()
  dirty = false
})

const BASE = '/api/admin/comp-students'
type Listing = ListBody<CompStudentListItem, { counts: CompStudentCounts }>

const list = (query = '') => call<Listing>('GET', `${BASE}${query}`, ADMIN)
const detail = (id: number) =>
  call<{ data: CompStudentDetail }>('GET', `${BASE}/${String(id)}`, ADMIN)
const fields = (r: { body: unknown }) => (r.body as ErrorBody).error.fields ?? {}

describe('admin guards (FR-M02-99)', () => {
  const endpoints: ['GET' | 'POST', string][] = [
    ['GET', BASE],
    ['POST', BASE],
    ['GET', `${BASE}/5901`],
    ['POST', `${BASE}/bulk-action`],
    ['POST', `${BASE}/5901/toggle-coins`],
    ['POST', `${BASE}/5901/toggle-active`],
    ['GET', '/api/admin/teachers'],
    ['GET', '/api/admin/teachers/5302/classrooms'],
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

describe('#16 GET /api/admin/comp-students (S6)', () => {
  it('shows the 90 seeded students, 50 per page, all coins OFF (§6.14)', async () => {
    const p1 = await list()
    expect(p1.status).toBe(200)
    expect(p1.body.meta).toMatchObject({
      page: 1,
      pageSize: 50,
      totalItems: 90,
      totalPages: 2,
      from: 1,
      to: 50,
    })
    expect(p1.body.meta.counts).toEqual({ coinsOff: 90, total: 90 })
    expect(p1.body.data).toHaveLength(50)
    const p2 = await list('?page=2')
    expect(p2.body.meta).toMatchObject({ page: 2, from: 51, to: 90 })
    expect(p2.body.data).toHaveLength(40)
    const ids = [...p1.body.data, ...p2.body.data].map((r) => r.id)
    expect(new Set(ids).size).toBe(90)
    expect(Math.min(...ids)).toBe(5901)
    expect(Math.max(...ids)).toBe(5990)
    // "Tiada pelajar komplimen lagi." page: beyond the last page.
    const beyond = await list('?page=3')
    expect(beyond.body.data).toEqual([])
    expect(beyond.body.meta.from).toBeNull()
    expect(beyond.body.meta.counts.total).toBe(90)
  })

  it('every seeded student is active, unspoken for coins, at school 8102 with a class and teacher', async () => {
    const rows = [...(await list()).body.data, ...(await list('?page=2')).body.data]
    for (const r of rows) {
      expect(r.isActive).toBe(true)
      expect(r.coinsEnabled).toBe(false)
      expect(r.schoolName).toBe('SEKOLAH MENENGAH KEBANGSAAN BANDAR TASIK KESUMA')
      expect(r.classLabel).not.toBe('')
      expect(r.teacherName).toBe(users.get(5302)?.name)
      expect(r.packageExpiresAt).toBe('2026-12-31')
    }
  })

  it('shapes a row: username = last 6 IC digits @prestasiplus.my, the IC, the first class', async () => {
    const all = [...(await list()).body.data, ...(await list('?page=2')).body.data]
    const by = (id: number) => all.find((r) => r.id === id)!
    expect(by(5901)).toMatchObject({
      username: '140001@prestasiplus.my',
      icNumber: '080101140001',
      classLabel: '5 BESTARI',
    })
    expect(by(5931).classLabel).toBe('5 CEMERLANG')
    expect(by(5961).classLabel).toBe('5 GEMILANG')
    // 5990 has no IC ("—").
    expect(by(5990).icNumber).toBeNull()
    expect(by(5990).username).toBe('komplimen5990@prestasiplus.my')
  })
})

describe('#18 GET /api/admin/comp-students/:id (S8)', () => {
  it('returns the profile and the classes; 5901 is enrolled in all 3 of teacher 5302 (§6.14)', async () => {
    const res = await detail(5901)
    expect(res.status).toBe(200)
    const d = res.body.data
    expect(d).toMatchObject({
      userId: 5901,
      username: '140001@prestasiplus.my',
      icNumber: '080101140001',
      classLevel: 'T5',
      isActive: true,
      coinsEnabled: false,
      packageExpiresAt: '2026-12-31',
      originalSchoolName: 'SEKOLAH MENENGAH KEBANGSAAN BANDAR TASIK KESUMA',
      classLabel: '5 BESTARI',
      syilingBalance: 0,
      coinBalance: 0,
    })
    expect(d.classes.map((c) => [c.name, c.classCode, c.subjectName, c.status])).toEqual([
      ['5 BESTARI', 'DMO201', null, 'active'],
      ['5 CEMERLANG', 'DMO202', null, 'active'],
      ['5 GEMILANG', 'DMO203', null, 'active'],
    ])
    expect(d.classes[0]?.teacherName).toBe(users.get(5302)?.name)
  })

  it('a student of one class has one row', async () => {
    expect((await detail(5931)).body.data.classes.map((c) => c.classCode)).toEqual(['DMO202'])
  })

  it('reads the M14 balances through the seam (0 / 0 until M14 registers)', async () => {
    setCompWalletSource((id) => ({ syiling: id === 5901 ? 12 : 0, coins: id === 5901 ? 3 : 0 }))
    expect((await detail(5901)).body.data).toMatchObject({ syilingBalance: 12, coinBalance: 3 })
    setCompWalletSource(null)
    expect((await detail(5901)).body.data).toMatchObject({ syilingBalance: 0, coinBalance: 0 })
  })

  it('404 for a student who is not complimentary, another role, or an unknown id', async () => {
    expect((await detail(PELAJAR)).status).toBe(404)
    expect((await detail(GURU)).status).toBe(404)
    expect((await detail(99_999_999)).status).toBe(404)
  })
})

describe('#17 POST /api/admin/comp-students (S7, BR-18)', () => {
  const register = (b: unknown, as = ADMIN) => call<ImportResponse | ErrorBody>('POST', BASE, as, b)
  const body = (over: Record<string, unknown> = {}) => ({
    classroomId: 2011,
    packageExpiresAt: '2026-12-31',
    students: 'PELAJAR DEMO SATU BIN DEMO, 090101101234\nPELAJAR DEMO DUA BINTI DEMO, 090202102345',
    ...over,
  })

  it('registers each line: username, fixed password, coins OFF, class enrolment, school and grade', async () => {
    dirty = true
    const res = await register(body())
    expect(res.status).toBe(201)
    const { data, status } = res.body as ImportResponse
    expect(status).toBe(compCreatedText(2))
    expect(data).toEqual({ created: 2, skipped: 0, failed: 0, errors: [] })

    const user = users.findByEmail('101234@prestasiplus.my')
    expect(user).toMatchObject({
      name: 'PELAJAR DEMO SATU BIN DEMO',
      role: 'student',
      isComplimentary: true,
      isActive: true,
      schoolId: 8102,
      grade: 11,
      classLevel: 'T5',
      createdById: ADMIN,
    })
    expect(user!.id).toBeGreaterThanOrEqual(9_000_001)
    expect(
      users.verifyPassword(user!.id, runtime.config.get('compStudentDefaultPassword') ?? ''),
    ).toBe(true)
    expect(users.verifyIc(user!.id, '090101101234')).toBe(true)
    expect(classrooms.memberIds('classroom', 2011)).toContain(user!.id)
    expect(
      classrooms.enrolmentsOf(user!.id).map((e) => [e.classroomId, e.status, e.source]),
    ).toEqual([[2011, 'active', 'complimentary']])

    // S6: newest first; the summary counts them; coins OFF.
    const after = await list()
    expect(after.body.meta.counts).toEqual({ coinsOff: 92, total: 92 })
    expect(
      after.body.data
        .slice(0, 2)
        .map((r) => r.id)
        .sort(),
    ).toEqual([user!.id, users.findByEmail('102345@prestasiplus.my')!.id].sort())
    expect(after.body.data[0]).toMatchObject({
      coinsEnabled: false,
      packageExpiresAt: '2026-12-31',
      classLabel: '5 BESTARI',
    })
    const d = (await detail(user!.id)).body.data
    expect(d).toMatchObject({
      name: 'PELAJAR DEMO SATU BIN DEMO',
      // The runtime IC is shown masked (privacy, DV-M02-16).
      icNumber: 'xxxxxx-xx-xx34',
      originalSchoolName: 'SEKOLAH MENENGAH KEBANGSAAN BANDAR TASIK KESUMA',
    })
    expect(d.classes).toHaveLength(1)
  })

  it('skips a username that exists or repeats, and fails short / malformed lines with their line numbers', async () => {
    dirty = true
    const res = await register(
      body({
        students: [
          'PELAJAR DEMO TIGA BIN DEMO, 090101140001', // 1: username 140001 belongs to 5901 → skipped
          '', // 2: blank, ignored
          'ONLY A NAME', // 3: no comma → failed
          ', 090101111111', // 4: no name → failed
          'PELAJAR DEMO EMPAT BIN DEMO, 12345', // 5: fewer than 6 digits → failed
          'PELAJAR DEMO ENAM, 090303-10-3333', // 6: created (digits only)
          'PELAJAR DEMO LIMA, 990303103333', // 7: same last 6 digits → skipped
        ].join('\r\n'),
      }),
    )
    expect(res.status).toBe(201)
    expect((res.body as ImportResponse).data).toEqual({
      created: 1,
      skipped: 2,
      failed: 3,
      errors: [
        { line: 3, message: MSG_COMP_BAD_LINE },
        { line: 4, message: MSG_COMP_BAD_LINE },
        { line: 5, message: MSG_COMP_SHORT_IC },
      ],
    })
    expect(users.findByEmail('103333@prestasiplus.my')?.name).toBe('PELAJAR DEMO ENAM')
  })

  it('takes the name up to the last comma', async () => {
    dirty = true
    await register(body({ students: 'DEMO, PELAJAR BIN DEMO, 090404104444' }))
    expect(users.findByEmail('104444@prestasiplus.my')?.name).toBe('DEMO, PELAJAR BIN DEMO')
  })

  it('uses the configured complimentary password (SEC-M02-02)', async () => {
    dirty = true
    const res = await register(body({ students: 'PELAJAR DEMO A, 090505105555' }))
    expect((res.body as ImportResponse).data.created).toBe(1)
    const user = users.findByEmail('105555@prestasiplus.my')!
    expect(users.verifyPassword(user.id, '20262026')).toBe(true)
    expect(users.verifyPassword(user.id, 'salah')).toBe(false)
  })

  it('takes a configured password (mock.config) and returns to the default after a reset', async () => {
    dirty = true
    runtime.config.set('compStudentDefaultPassword', 'Konfig2026')
    await register(body({ students: 'PELAJAR DEMO C, 090707107777' }))
    const user = users.findByEmail('107777@prestasiplus.my')!
    expect(users.verifyPassword(user.id, 'Konfig2026')).toBe(true)
    // The built-in default no longer applies while a configured value is set.
    expect(users.verifyPassword(user.id, '20262026')).toBe(false)
    await runtime.reset()
    await register(body({ students: 'PELAJAR DEMO D, 090808108888' }))
    const after = users.findByEmail('108888@prestasiplus.my')!
    expect(
      users.verifyPassword(after.id, runtime.config.get('compStudentDefaultPassword') ?? ''),
    ).toBe(true)
  })

  it('422 without the required fields', async () => {
    const res = await register({})
    expect(res.status).toBe(422)
    expect(Object.keys(fields(res)).sort()).toEqual(['classroomId', 'packageExpiresAt', 'students'])
  })

  it.each([
    ['unknown classroom', { classroomId: 99_999_999 }, 'classroomId'],
    ['non-numeric classroom', { classroomId: 'abc' }, 'classroomId'],
    ['bad date', { packageExpiresAt: '31/12/2026' }, 'packageExpiresAt'],
    ['impossible date', { packageExpiresAt: '2026-02-30' }, 'packageExpiresAt'],
    ['blank list', { students: '   ' }, 'students'],
  ])('422 for %s', async (_label, over, field) => {
    const before = users.countWhere({ isComplimentary: true })
    const res = await register(body(over))
    expect(res.status).toBe(422)
    expect(Object.keys(fields(res))).toContain(field)
    expect(users.countWhere({ isComplimentary: true })).toBe(before)
  })

  it('accepts a numeric string classroom id', async () => {
    dirty = true
    expect(
      (await register(body({ classroomId: '2012', students: 'PELAJAR DEMO B, 090606106666' })))
        .status,
    ).toBe(201)
    expect(classrooms.memberIds('classroom', 2012)).toContain(
      users.findByEmail('106666@prestasiplus.my')!.id,
    )
  })
})

describe('#19 POST …/bulk-action (BR-19)', () => {
  const bulk = (b: unknown) =>
    call<{ data: { updated: number }; status: string } | ErrorBody>(
      'POST',
      `${BASE}/bulk-action`,
      ADMIN,
      b,
    )

  it('turns coins on and off for the selected ids; the summary follows', async () => {
    dirty = true
    const on = await bulk({ action: 'coins_on', ids: [5901, 5902, 5903] })
    expect(on.status).toBe(200)
    expect(on.body).toEqual({ data: { updated: 3 }, status: MSG_COMP_ACTION_DONE })
    expect((await list()).body.meta.counts).toEqual({ coinsOff: 87, total: 90 })
    expect((await detail(5902)).body.data.coinsEnabled).toBe(true)
    expect(complimentary.coinsEnabled(5902)).toBe(true)
    await bulk({ action: 'coins_off', ids: [5901, 5902] })
    expect((await list()).body.meta.counts.coinsOff).toBe(89)
  })

  it('deactivates and activates accounts', async () => {
    dirty = true
    expect(
      (
        (await bulk({ action: 'deactivate', ids: [5901, 5902] })).body as {
          data: { updated: number }
        }
      ).data.updated,
    ).toBe(2)
    expect(users.get(5901)?.isActive).toBe(false)
    expect((await detail(5902)).body.data.isActive).toBe(false)
    await bulk({ action: 'activate', ids: [5901, 5902] })
    expect(users.get(5901)?.isActive).toBe(true)
  })

  it('ignores ids that are not complimentary students and counts only the ones applied', async () => {
    dirty = true
    const res = await bulk({ action: 'deactivate', ids: [PELAJAR, GURU, 99_999_999, 5910] })
    expect((res.body as { data: { updated: number } }).data.updated).toBe(1)
    expect(users.get(PELAJAR)?.isActive).toBe(true)
    expect(users.get(GURU)?.isActive).toBe(true)
  })

  it('422 for an unknown action, missing or empty ids', async () => {
    expect(Object.keys(fields(await bulk({ action: 'delete', ids: [5901] })))).toContain('action')
    expect(Object.keys(fields(await bulk({ action: 'coins_on', ids: [] })))).toContain('ids')
    expect(Object.keys(fields(await bulk({ action: 'coins_on' })))).toContain('ids')
    expect(Object.keys(fields(await bulk({ ids: [5901] })))).toContain('action')
    expect(Object.keys(fields(await bulk({ action: 'coins_on', ids: 'x' })))).toContain('ids')
  })
})

describe('#20, #21 toggles', () => {
  it('toggle-coins flips the flag and back', async () => {
    dirty = true
    const on = await call<{ data: { coinsEnabled: boolean }; status: string }>(
      'POST',
      `${BASE}/5901/toggle-coins`,
      ADMIN,
    )
    expect(on.status).toBe(200)
    expect(on.body).toEqual({ data: { coinsEnabled: true }, status: MSG_COMP_ACTION_DONE })
    expect((await list()).body.meta.counts.coinsOff).toBe(89)
    const off = await call<{ data: { coinsEnabled: boolean } }>(
      'POST',
      `${BASE}/5901/toggle-coins`,
      ADMIN,
    )
    expect(off.body.data.coinsEnabled).toBe(false)
  })

  it('toggle-active flips the account and back', async () => {
    dirty = true
    const off = await call<{ data: { isActive: boolean } }>(
      'POST',
      `${BASE}/5901/toggle-active`,
      ADMIN,
    )
    expect(off.body.data.isActive).toBe(false)
    expect(users.get(5901)?.isActive).toBe(false)
    const on = await call<{ data: { isActive: boolean } }>(
      'POST',
      `${BASE}/5901/toggle-active`,
      ADMIN,
    )
    expect(on.body.data.isActive).toBe(true)
  })

  it.each(['toggle-coins', 'toggle-active'])(
    '%s: 404 for a non-complimentary or unknown user',
    async (action) => {
      expect((await call('POST', `${BASE}/${String(PELAJAR)}/${action}`, ADMIN)).status).toBe(404)
      expect((await call('POST', `${BASE}/99999999/${action}`, ADMIN)).status).toBe(404)
    },
  )
})

describe('the M14 seam `complimentary.coinsEnabled` (BR-18)', () => {
  it('a complimentary student is OFF, everyone else ON', () => {
    expect(complimentary.coinsEnabled(5901)).toBe(false)
    expect(complimentary.coinsEnabled(PELAJAR)).toBe(true)
    expect(complimentary.coinsEnabled(GURU)).toBe(true)
    expect(complimentary.get(5901)).toMatchObject({ id: 5901, coinsEnabled: false })
    expect(complimentary.get(PELAJAR)).toBeUndefined()
  })
})

describe('#22 GET /api/admin/teachers', () => {
  it('lists every teacher by name with id, name and e-mail', async () => {
    const res = await call<{ data: TeacherOption[] }>('GET', '/api/admin/teachers', ADMIN)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(users.roleCounts().teacher)
    expect(res.body.data.find((t) => t.id === 5302)).toEqual({
      id: 5302,
      name: users.get(5302)?.name,
      email: users.get(5302)?.email,
    })
    expect(res.body.data.some((t) => t.id === 5 || t.id === 5301)).toBe(true)
    const names = res.body.data.map((t) => t.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    // No student or parent slips in.
    expect(res.body.data.every((t) => users.get(t.id)?.role === 'teacher')).toBe(true)
  })
})

describe('#23 GET /api/admin/teachers/:id/classrooms', () => {
  const classesOf = (id: number) =>
    call<{ data: TeacherClassroomOption[] }>(
      'GET',
      `/api/admin/teachers/${String(id)}/classrooms`,
      ADMIN,
    )

  it('teacher 5302 owns the three complimentary classes (M10 2011–2013)', async () => {
    const res = await classesOf(5302)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([
      { id: 2011, name: '5 BESTARI', classCode: 'DMO201' },
      { id: 2012, name: '5 CEMERLANG', classCode: 'DMO202' },
      { id: 2013, name: '5 GEMILANG', classCode: 'DMO203' },
    ])
  })

  it('teacher 5 owns exactly the two demo classes; no complimentary student is in them', async () => {
    const res = await classesOf(GURU)
    expect(res.body.data).toEqual([
      { id: 2001, name: '5 MARIKH - Kimia', classCode: 'DMO101' },
      { id: 2002, name: '5 MARIKH - Sejarah', classCode: 'DMO102' },
    ])
  })

  it('a teacher without classes (5301) or an unknown teacher gets an empty list', async () => {
    expect((await classesOf(5301)).body.data).toEqual([])
    expect((await classesOf(99_999_999)).body.data).toEqual([])
  })
})

describe('BR-18 full package until the given date (INFERRED mapping: personal, 23:59:59 MYT)', () => {
  const NOW_MS = Date.parse('2026-09-25T15:40:00+08:00')

  it('the seeded 5901–5990 are subscribed at the clock time and expire on 2026-12-31 23:59:59 (INFERRED)', () => {
    for (let id = 5901; id <= 5990; id++) {
      const u = users.get(id)
      expect(u?.subscriptionPackage, String(id)).toBe('personal')
      expect(u?.subscriptionExpiresAt, String(id)).toBe('2026-12-31T23:59:59+08:00')
      expect(users.isSubscribed(id, NOW_MS), String(id)).toBe(true)
    }
    expect(users.isSubscribed(5901, Date.parse('2027-01-01T00:00:00+08:00'))).toBe(false)
  })

  it('a registered student is subscribed until packageExpiresAt', async () => {
    dirty = true
    await call('POST', BASE, ADMIN, {
      classroomId: 2011,
      packageExpiresAt: '2026-12-31',
      students: 'PELAJAR DEMO E, 090909109999',
    })
    const user = users.findByEmail('109999@prestasiplus.my')!
    expect(user.subscriptionPackage).toBe('personal')
    expect(user.subscriptionExpiresAt).toBe('2026-12-31T23:59:59+08:00')
    expect(users.isSubscribed(user.id, NOW_MS)).toBe(true)
    expect(users.isSubscribed(user.id, Date.parse('2027-01-01T00:00:00+08:00'))).toBe(false)
  })
})

describe('deleting a complimentary student (BR-06)', () => {
  it('removes its profile with the user', async () => {
    dirty = true
    expect(complimentary.get(5901)).toBeDefined()
    expect((await call('DELETE', '/api/admin/users/5901', ADMIN)).status).toBe(200)
    expect(complimentary.get(5901)).toBeUndefined()
    expect((await list()).body.meta.counts.total).toBe(89)
  })
})

describe('bulk-action ids and the wallet seam', () => {
  it('duplicate ids count once', async () => {
    dirty = true
    const res = await call<{ data: { updated: number } }>('POST', `${BASE}/bulk-action`, ADMIN, {
      action: 'coins_on',
      ids: [5901, 5901, '5901', 5902],
    })
    expect(res.body.data.updated).toBe(2)
  })

  it('a registered wallet source is cleared by a reset', async () => {
    dirty = true
    setCompWalletSource(() => ({ syiling: 9, coins: 9 }))
    await runtime.reset()
    expect((await detail(5901)).body.data.syilingBalance).toBe(0)
  })
})

describe('M02 booted without M10', () => {
  it('answers a clear 500 instead of a TypeError', async () => {
    const bare = await bootM02()
    const bareCall = callAs(bare)
    for (const url of [BASE, `${BASE}/5901`, '/api/admin/teachers/5302/classrooms']) {
      const res = await bareCall<ErrorBody>('GET', url, ADMIN)
      expect(res.status).toBe(500)
      expect(res.body.error.message).toContain('M10')
    }
    // Restore the full runtime for the tests that follow (the plugins share module state).
    runtime = await bootM02Full()
    call = callAs(runtime)
  }, 180_000)
})
