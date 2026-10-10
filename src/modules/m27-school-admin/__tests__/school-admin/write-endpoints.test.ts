/**
 * M27 Part B write endpoints (M27-T1b): #8, #9, #12, #13, #14, #15, #19 (SRS Part B §19, BR-M27-31…34, 41,
 * SEC-M27-06, 09, 10; G1-1, G1-2, G1-9). Real core with the owners (M01, M02, M10, ...) at the project clock.
 * Every test creates the users it changes, so the seeded anchors stay as they are.
 *
 * Personas (URS §10.3): P1 school admin of school 900003 (empty), P2 school admin of school 900001 (populated),
 * P3 school admin of school 900002.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import type { HttpMethod, TransportResponse } from '@/api/transport'
import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { setUser } from '@/mock/core-data/set-user'
import { runAsOwner } from '@/mock/repository/guard'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01, { users } from '@/modules/m01-authentication/mock'
import m02, { MSG_USER_CREATED, MSG_USER_UPDATED, m02Config } from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m05 from '@/modules/m05-practice/mock'
import m08 from '@/modules/m08-student-performance/mock'
import m09 from '@/modules/m09-content/mock'
import m10, { classrooms } from '@/modules/m10-teacher-class/mock'

import type {
  CreatePupilResult,
  SchoolPupilFormOptions,
  SchoolPupilRow,
  SchoolTeacherRow,
  SchoolUserDetail,
} from '../../api/school-admin'
import m27 from '../../mock'
import { MSG_STATUS_TOGGLED } from '../../mock/handlers/users-write'

const ADMIN = 1
const PELAJAR = 2
const GURU = 5
const P1 = 3102
const P2 = 8
const P3 = 3104
const S1 = 900001
const S2 = 900002
const S3 = 900003
const NOW = Date.parse(CLOCK_ANCHOR_ISO)
const BASE = '/api/admin-sekolah'

let runtime: MockRuntime
let seq = 0
const uniq = (label: string) => `${label}-t1b-${String(++seq)}@demo.test`

beforeAll(async () => {
  runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m08, m09, m10, m27],
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
}, 600_000)

async function call<T = unknown>(
  userId: number | null,
  url: string,
  method: HttpMethod = 'GET',
  body?: unknown,
): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (userId !== null) headers.authorization = `Bearer ${setUser(userId).token}`
  const res: TransportResponse = await runtime.transport.request({
    method,
    url,
    headers,
    ...(body === undefined ? {} : { body }),
  })
  return { status: res.status, body: res.body as T }
}

interface ErrBody {
  error: { code: string; message: string; fields?: Record<string, string> }
}
const errCode = (r: { body: unknown }) => (r.body as ErrBody).error.code

const makeUser = (
  role: 'student' | 'teacher',
  schoolId: number,
  over: { isActive?: boolean; password?: string } = {},
) => {
  const u = users.create(
    {
      name: `Contoh ${role} ${String(++seq)}`,
      email: uniq(role),
      role,
      schoolId,
      isActive: over.isActive ?? true,
    },
    NOW,
  )
  users.setPassword(u.id, over.password ?? 'Asal12345')
  return u
}

const login = (email: string, password: string) =>
  call(null, '/api/auth/login', 'POST', { email, password })

const roster = async (url: string, uid = P2) => {
  const r = await call<{ data: (SchoolPupilRow | SchoolTeacherRow)[]; meta: { totalItems: number } }>(
    uid,
    `${url}?search=t1b&page=1`,
  )
  return r.body
}

describe('guard SA on every write endpoint', () => {
  const pupil = () => makeUser('student', S1).id
  const teacher = () => makeUser('teacher', S1).id
  const cases = (): [HttpMethod, string, unknown][] => [
    ['PUT', `${BASE}/pelajar/${String(pupil())}`, { name: 'Abc', email: uniq('g') }],
    ['POST', `${BASE}/pelajar/${String(pupil())}/reset-password`, {}],
    ['POST', `${BASE}/guru`, {}],
    ['PUT', `${BASE}/guru/${String(teacher())}`, { name: 'Abc', email: uniq('g') }],
    ['POST', `${BASE}/guru/${String(teacher())}/toggle-active`, undefined],
    ['POST', `${BASE}/guru/${String(teacher())}/reset-password`, {}],
    ['POST', `${BASE}/pelajar`, {}],
  ]

  it('answers 401 to a guest', async () => {
    for (const [m, url, body] of cases()) expect((await call(null, url, m, body)).status, url).toBe(401)
  })

  it('answers 403 to a platform admin, teacher and pupil', async () => {
    for (const [m, url, body] of cases()) {
      for (const id of [ADMIN, GURU, PELAJAR]) {
        expect((await call(id, url, m, body)).status, `${m} ${url} ${String(id)}`).toBe(403)
      }
    }
  })

  it('answers 403 to a school admin without a school and writes nothing', async () => {
    const orphan = users.create(
      { name: 'Tanpa Sekolah', email: uniq('orphan'), role: 'school_admin' },
      NOW,
    )
    const prepared = cases()
    const before = users.adminList({ pageSize: 100_000 }).rows.length
    for (const [m, url, body] of prepared) {
      expect((await call(orphan.id, url, m, body)).status).toBe(403)
    }
    expect(users.adminList({ pageSize: 100_000 }).rows.length).toBe(before)
  })
})

describe('#8 PUT /pelajar/:id and #13 PUT /guru/:id', () => {
  it('updates name, e-mail and phone of a pupil of the own school; role, school, status are ignored', async () => {
    const u = makeUser('student', S1)
    const email = uniq('edit')
    const r = await call<{ data: SchoolUserDetail; status: string }>(
      P2,
      `${BASE}/pelajar/${String(u.id)}`,
      'PUT',
      {
        name: '  Nama Baharu  ',
        email,
        phone: '0123456789',
        role: 'teacher',
        schoolId: S3,
        isActive: false,
        grade: 3,
        icNumber: '010101-01-0101',
      },
    )
    expect(r.status).toBe(200)
    expect(r.body.status).toBe(MSG_USER_UPDATED)
    expect(r.body.data).toMatchObject({
      id: u.id,
      name: 'Nama Baharu',
      email,
      phone: '0123456789',
      isActive: true,
      role: 'student',
    })
    expect(r.body.data.school.id).toBe(S1)
    const saved = users.get(u.id)
    expect(saved).toMatchObject({ role: 'student', schoolId: S1, isActive: true })
    expect(saved?.grade).toBe(u.grade)
  })

  it('updates a teacher through #13 and keeps the phone when it is not sent', async () => {
    const t = makeUser('teacher', S1)
    users.update(t.id, { phone: '0111111111' }, NOW)
    const r = await call<{ data: SchoolUserDetail }>(P2, `${BASE}/guru/${String(t.id)}`, 'PUT', {
      name: 'Guru Baharu',
      email: t.email,
    })
    expect(r.status).toBe(200)
    expect(r.body.data).toMatchObject({ name: 'Guru Baharu', role: 'teacher', phone: '0111111111' })
  })

  it('applies the optional password pair in the same request (one transaction)', async () => {
    const t = makeUser('teacher', S1)
    const url = `${BASE}/guru/${String(t.id)}`
    // A short password is a 422 and nothing else of the request is saved.
    const bad = await call(P2, url, 'PUT', {
      name: 'Nama Tidak Disimpan',
      email: t.email,
      newPassword: 'abc',
      newPasswordConfirmation: 'abc',
    })
    expect(bad.status).toBe(422)
    expect(users.get(t.id)?.name).toBe(t.name)
    // A mismatching confirmation is a 422 too.
    const mismatch = await call(P2, url, 'PUT', {
      name: 'Nama Tidak Disimpan',
      email: t.email,
      newPassword: 'baharu123',
      newPasswordConfirmation: 'lain1234',
    })
    expect(mismatch.status).toBe(422)
    expect(users.get(t.id)?.name).toBe(t.name)
    // A valid pair saves the name and the password together.
    const good = await call(P2, `${BASE}/pelajar/${String(makeUser('student', S1).id)}`, 'PUT', {
      name: 'Nama Disimpan',
      email: uniq('pw'),
      newPassword: 'baharu123',
      newPasswordConfirmation: 'baharu123',
    })
    expect(good.status).toBe(200)
    const ok = await call(P2, url, 'PUT', {
      name: 'Guru Disimpan',
      email: t.email,
      newPassword: 'baharu123',
      newPasswordConfirmation: 'baharu123',
    })
    expect(ok.status).toBe(200)
    expect(users.get(t.id)?.name).toBe('Guru Disimpan')
    expect(users.verifyPassword(t.id, 'baharu123')).toBe(true)
  })

  it('answers 404 for a foreign school, the other role, and an unknown or malformed id', async () => {
    const foreign = makeUser('student', S2)
    const teacher = makeUser('teacher', S1)
    const pupil = makeUser('student', S1)
    const body = { name: 'Abc Def', email: uniq('x') }
    for (const url of [
      `${BASE}/pelajar/${String(foreign.id)}`,
      `${BASE}/pelajar/${String(teacher.id)}`,
      `${BASE}/pelajar/999999999`,
      `${BASE}/pelajar/abc`,
      `${BASE}/guru/${String(pupil.id)}`,
    ]) {
      const r = await call(P2, url, 'PUT', body)
      expect(r.status, url).toBe(404)
      expect(errCode(r)).toBe('NOT_FOUND')
    }
    expect(users.get(foreign.id)?.name).toBe(foreign.name)
  })

  it('answers 403 for an inactive in-school account, and 404 (not 403) for a foreign inactive one', async () => {
    const inactive = makeUser('student', S1, { isActive: false })
    const foreignInactive = makeUser('student', S2, { isActive: false })
    const body = { name: 'Abc Def', email: uniq('x') }
    expect((await call(P2, `${BASE}/pelajar/${String(inactive.id)}`, 'PUT', body)).status).toBe(403)
    expect((await call(P2, `${BASE}/pelajar/${String(foreignInactive.id)}`, 'PUT', body)).status).toBe(404)
    const t = makeUser('teacher', S1, { isActive: false })
    expect((await call(P2, `${BASE}/guru/${String(t.id)}`, 'PUT', body)).status).toBe(403)
    expect(users.get(inactive.id)?.name).toBe(inactive.name)
  })

  it('answers 422 VALIDATION_ERROR with fields and changes nothing (rollback)', async () => {
    const a = makeUser('student', S1)
    const b = makeUser('student', S1)
    const url = `${BASE}/pelajar/${String(a.id)}`
    const missing = await call<ErrBody>(P2, url, 'PUT', { name: '', email: '' })
    expect(missing.status).toBe(422)
    expect(errCode(missing)).toBe('VALIDATION_ERROR')
    expect(Object.keys(missing.body.error.fields ?? {})).toEqual(expect.arrayContaining(['name', 'email']))
    const dup = await call<ErrBody>(P2, url, 'PUT', { name: 'Nama Sah', email: b.email })
    expect(dup.status).toBe(422)
    expect(dup.body.error.fields).toHaveProperty('email')
    const bad = await call<ErrBody>(P2, url, 'PUT', { name: 'Nama Sah', email: 'bukan-emel' })
    expect(bad.body.error.fields).toHaveProperty('email')
    const longPhone = await call<ErrBody>(P2, url, 'PUT', {
      name: 'Nama Sah',
      email: uniq('p'),
      phone: '1'.repeat(15),
    })
    expect(longPhone.body.error.fields).toHaveProperty('phone')
    expect(users.get(a.id)?.name).toBe(a.name)
    expect(users.get(a.id)?.email).toBe(a.email)
  })
})

describe('#9 and #15 reset-password', () => {
  it('replaces the hash at once: the old password stops working, the new one logs in (XR-M27-18)', async () => {
    const p = makeUser('student', S1, { password: 'Lama12345' })
    const t = makeUser('teacher', S1, { password: 'Lama12345' })
    expect((await login(p.email, 'Lama12345')).status).toBe(200)
    for (const [url, u] of [
      [`${BASE}/pelajar/${String(p.id)}/reset-password`, p],
      [`${BASE}/guru/${String(t.id)}/reset-password`, t],
    ] as const) {
      const r = await call<{ data: { reset: boolean }; status: string }>(P2, url, 'POST', {
        newPassword: 'Baharu123',
        newPasswordConfirmation: 'Baharu123',
        role: 'admin',
      })
      expect(r.status, url).toBe(200)
      expect(r.body.data).toEqual({ reset: true })
      expect(r.body.status).toBe(MSG_USER_UPDATED)
      expect(JSON.stringify(r.body)).not.toContain('Baharu123')
      expect((await login(u.email, 'Lama12345')).status).toBe(422)
      expect((await login(u.email, 'Baharu123')).status).toBe(200)
      expect(users.get(u.id)?.role).toBe(u.role)
    }
  })

  it('refuses a short, unconfirmed or missing password with 422 and keeps the old one', async () => {
    const p = makeUser('student', S1, { password: 'Lama12345' })
    const url = `${BASE}/pelajar/${String(p.id)}/reset-password`
    const short = await call<ErrBody>(P2, url, 'POST', { newPassword: '12345', newPasswordConfirmation: '12345' })
    expect(short.status).toBe(422)
    expect(short.body.error.fields).toHaveProperty('newPassword')
    const mismatch = await call<ErrBody>(P2, url, 'POST', {
      newPassword: 'Baharu123',
      newPasswordConfirmation: 'Lain12345',
    })
    expect(mismatch.status).toBe(422)
    const none = await call<ErrBody>(P2, url, 'POST', {})
    expect(none.status).toBe(422)
    expect((await login(p.email, 'Lama12345')).status).toBe(200)
  })

  it('answers 404 for foreign or other-role ids and 403 for an inactive account', async () => {
    const body = { newPassword: 'Baharu123', newPasswordConfirmation: 'Baharu123' }
    const foreign = makeUser('student', S2)
    const teacher = makeUser('teacher', S1)
    const inactiveT = makeUser('teacher', S1, { isActive: false })
    const inactiveP = makeUser('student', S1, { isActive: false })
    expect((await call(P2, `${BASE}/pelajar/${String(foreign.id)}/reset-password`, 'POST', body)).status).toBe(404)
    expect((await call(P2, `${BASE}/pelajar/${String(teacher.id)}/reset-password`, 'POST', body)).status).toBe(404)
    expect((await call(P2, `${BASE}/guru/${String(foreign.id)}/reset-password`, 'POST', body)).status).toBe(404)
    expect((await call(P2, `${BASE}/guru/${String(inactiveT.id)}/reset-password`, 'POST', body)).status).toBe(403)
    expect((await call(P2, `${BASE}/pelajar/${String(inactiveP.id)}/reset-password`, 'POST', body)).status).toBe(403)
  })
})

describe('#12 POST /guru', () => {
  it('creates an active teacher of the own school, 201, listed by #10, able to sign in', async () => {
    const email = uniq('newteacher')
    const r = await call<{ data: SchoolUserDetail; status: string }>(P2, `${BASE}/guru`, 'POST', {
      name: ' Guru Baru ',
      email,
      phone: '0123456789',
      password: 'Rahsia123',
      passwordConfirmation: 'Rahsia123',
      role: 'student',
      schoolId: S3,
      isActive: false,
    })
    expect(r.status).toBe(201)
    expect(r.body.status).toBe(MSG_USER_CREATED)
    expect(r.body.data).toMatchObject({
      name: 'Guru Baru',
      email,
      phone: '0123456789',
      role: 'teacher',
      isActive: true,
    })
    expect(r.body.data.school.id).toBe(S1)
    expect(users.get(r.body.data.id)).toMatchObject({ schoolId: S1, createdById: P2, isActive: true })
    expect(JSON.stringify(r.body)).not.toContain('Rahsia123')
    const listed = await roster(`${BASE}/guru`)
    expect(listed.data.some((x) => x.id === r.body.data.id && x.isActive)).toBe(true)
    expect((await login(email, 'Rahsia123')).status).toBe(200)
  })

  it('refuses invalid input with 422 and creates nothing', async () => {
    const before = users.adminList({ role: 'teacher', schoolId: S1, pageSize: 100_000 }).rows.length
    const taken = makeUser('teacher', S1)
    const cases: Record<string, unknown>[] = [
      { name: '', email: uniq('a'), password: 'Rahsia123', passwordConfirmation: 'Rahsia123' },
      { name: 'Guru', email: taken.email, password: 'Rahsia123', passwordConfirmation: 'Rahsia123' },
      { name: 'Guru', email: uniq('a'), password: '12345', passwordConfirmation: '12345' },
      { name: 'Guru', email: uniq('a'), password: 'Rahsia123', passwordConfirmation: 'Lain12345' },
      { name: 'Guru', email: 'salah', password: 'Rahsia123', passwordConfirmation: 'Rahsia123' },
    ]
    for (const body of cases) {
      const r = await call<ErrBody>(P2, `${BASE}/guru`, 'POST', body)
      expect(r.status, JSON.stringify(body)).toBe(422)
      expect(errCode(r)).toBe('VALIDATION_ERROR')
      expect(Object.keys(r.body.error.fields ?? {}).length).toBeGreaterThan(0)
    }
    expect(users.adminList({ role: 'teacher', schoolId: S1, pageSize: 100_000 }).rows.length).toBe(before + 1)
  })

  it('places the teacher in the session school of each admin', async () => {
    const r = await call<{ data: SchoolUserDetail }>(P3, `${BASE}/guru`, 'POST', {
      name: 'Guru Tiga',
      email: uniq('s2'),
      password: 'Rahsia123',
      passwordConfirmation: 'Rahsia123',
      schoolId: S1,
    })
    expect(r.status).toBe(201)
    expect(users.get(r.body.data.id)?.schoolId).toBe(S2)
  })
})

describe('#14 POST /guru/:id/toggle-active (G1-1)', () => {
  it('switches a teacher off and on again, and the next login follows', async () => {
    const t = makeUser('teacher', S1, { password: 'Asal12345' })
    const url = `${BASE}/guru/${String(t.id)}/toggle-active`
    const off = await call<{ data: { isActive: boolean }; status: string }>(P2, url, 'POST')
    expect(off.status).toBe(200)
    expect(off.body.data).toEqual({ isActive: false })
    expect(off.body.status).toBe(MSG_STATUS_TOGGLED)
    expect((await login(t.email, 'Asal12345')).status).not.toBe(200)
    const on = await call<{ data: { isActive: boolean } }>(P2, url, 'POST')
    expect(on.body.data).toEqual({ isActive: true })
    expect((await login(t.email, 'Asal12345')).status).toBe(200)
  })

  it('works on an inactive teacher (the way back) and shows in the #10 counts', async () => {
    const t = makeUser('teacher', S1, { isActive: false })
    const before = await roster(`${BASE}/guru`)
    const row = before.data.find((x) => x.id === t.id)
    expect(row?.isActive).toBe(false)
    const r = await call(P2, `${BASE}/guru/${String(t.id)}/toggle-active`, 'POST')
    expect(r.status).toBe(200)
    const after = await roster(`${BASE}/guru`)
    expect(after.data.find((x) => x.id === t.id)?.isActive).toBe(true)
  })

  it('refuses pupils (read-only status): the pupil id on the teacher route is 404 and status never changes', async () => {
    const p = makeUser('student', S1)
    const r = await call(P2, `${BASE}/guru/${String(p.id)}/toggle-active`, 'POST')
    expect(r.status).toBe(404)
    expect(users.get(p.id)?.isActive).toBe(true)
    expect((await call(P2, `${BASE}/pelajar/${String(p.id)}/toggle-active`, 'POST')).status).toBe(404)
    expect(users.get(p.id)?.isActive).toBe(true)
  })

  it('answers 404 for a teacher of another school, an unknown and a malformed id', async () => {
    const foreign = makeUser('teacher', S2)
    for (const id of [String(foreign.id), '999999999', 'abc']) {
      expect((await call(P2, `${BASE}/guru/${id}/toggle-active`, 'POST')).status, id).toBe(404)
    }
    expect(users.get(foreign.id)?.isActive).toBe(true)
  })
})

describe('#19 POST /pelajar and #22 (G1-2, G1-9, BR-M27-41)', () => {
  it('creates an active pupil with a typed password, enrolled in the chosen class, with the one-time credential', async () => {
    const email = uniq('pupil')
    const r = await call<CreatePupilResult>(P2, `${BASE}/pelajar`, 'POST', {
      name: ' Pelajar Baharu ',
      email,
      password: 'Rahsia1234',
      classId: 2001,
      role: 'teacher',
      schoolId: S3,
      isActive: false,
    })
    expect(r.status).toBe(201)
    expect(r.body.status).toBe('Pelajar "Pelajar Baharu" berjaya dicipta.')
    expect(r.body.data).toMatchObject({ name: 'Pelajar Baharu', email, role: 'student', isActive: true })
    expect(r.body.data.school.id).toBe(S1)
    expect(r.body.credential).toEqual({
      name: 'Pelajar Baharu',
      school: r.body.data.school.name,
      email,
      password: 'Rahsia1234',
    })
    expect(JSON.stringify(r.body.data)).not.toContain('Rahsia1234')
    const id = r.body.data.id
    expect(users.get(id)).toMatchObject({ role: 'student', schoolId: S1, isActive: true, createdById: P2 })
    expect(classrooms.get('classroom', 2001)).toBeDefined()
    const list = await roster(`${BASE}/pelajar`)
    const row = (list.data as SchoolPupilRow[]).find((x) => x.id === id)
    expect(row?.isActive).toBe(true)
    expect(row?.classNames.length).toBeGreaterThan(0)
    expect((await login(email, 'Rahsia1234')).status).toBe(200)
  })

  it('accepts the class id sent as a digit string', async () => {
    const r = await call<CreatePupilResult>(P2, `${BASE}/pelajar`, 'POST', {
      name: 'Pelajar Rentetan',
      email: uniq('str'),
      classId: '2001',
    })
    expect(r.status).toBe(201)
    const list = await roster(`${BASE}/pelajar`)
    const row = (list.data as SchoolPupilRow[]).find((x) => x.id === r.body.data.id)
    expect(row?.classNames.length).toBeGreaterThan(0)
  })

  it('uses the M02 default password when empty or absent, and honours a mock.config override', async () => {
    const e1 = uniq('def')
    const r1 = await call<CreatePupilResult>(P2, `${BASE}/pelajar`, 'POST', {
      name: 'Pelajar Lalai',
      email: e1,
      password: '',
      classId: null,
    })
    expect(r1.status).toBe(201)
    expect(r1.body.credential.password).toBe(m02Config().bulkImportDefaultPassword)
    expect((await login(e1, m02Config().bulkImportDefaultPassword)).status).toBe(200)

    runtime.config.set('bulkImportDefaultPassword', 'Konfig2026')
    try {
      const e2 = uniq('cfg')
      const r2 = await call<CreatePupilResult>(P2, `${BASE}/pelajar`, 'POST', {
        name: 'Pelajar Konfig',
        email: e2,
      })
      expect(r2.status).toBe(201)
      expect(r2.body.credential.password).toBe('Konfig2026')
      expect((await login(e2, 'Konfig2026')).status).toBe(200)
    } finally {
      runtime.config.set('bulkImportDefaultPassword', m02Config().bulkImportDefaultPassword)
    }
  })

  it('never exposes the literal password in #22 or in any later read', async () => {
    const created = await call<CreatePupilResult>(P2, `${BASE}/pelajar`, 'POST', {
      name: 'Pelajar Rahsia',
      email: uniq('secret'),
      password: 'UnikRahsia987',
    })
    expect(created.status).toBe(201)
    const secret = m02Config().bulkImportDefaultPassword
    const opts = await call<{ data: SchoolPupilFormOptions }>(P2, `${BASE}/pelajar/form-options`)
    expect(opts.status).toBe(200)
    const optsText = JSON.stringify(opts.body)
    expect(optsText).not.toContain(secret)
    expect(optsText).not.toContain('UnikRahsia987')
    expect(opts.body.data.passwordPlaceholder).toBe('•'.repeat(8))
    const id = created.body.data.id
    for (const url of [`${BASE}/pelajar?search=Rahsia`, `${BASE}/pelajar/${String(id)}`]) {
      const t = JSON.stringify((await call(P2, url)).body)
      expect(t).not.toContain('UnikRahsia987')
    }
    const csv = await call(P2, `${BASE}/pelajar/export.csv`)
    expect(JSON.stringify(csv.body)).not.toContain('UnikRahsia987')
  })

  it('refuses invalid input with 422 and creates nothing', async () => {
    const count = () => users.adminList({ role: 'student', schoolId: S1, pageSize: 100_000 }).rows.length
    const before = count()
    const taken = makeUser('student', S1)
    const foreignClass = classrooms.list({ schoolId: S2, kind: 'classroom' })[0]
    const bodies: Record<string, unknown>[] = [
      { name: 'Ab', email: uniq('a') },
      { name: '', email: uniq('a') },
      { name: 'Pelajar Sah', email: '' },
      { name: 'Pelajar Sah', email: 'salah' },
      { name: 'Pelajar Sah', email: taken.email },
      { name: 'Pelajar Sah', email: uniq('a'), password: '1234567' },
      { name: 'Pelajar Sah', email: uniq('a'), password: 'x'.repeat(256) },
      { name: 'Pelajar Sah', email: uniq('a'), classId: 999999999 },
      { name: 'Pelajar Sah', email: uniq('a'), classId: 'abc' },
      ...(foreignClass ? [{ name: 'Pelajar Sah', email: uniq('a'), classId: foreignClass.classId }] : []),
    ]
    for (const body of bodies) {
      const r = await call<ErrBody>(P2, `${BASE}/pelajar`, 'POST', body)
      expect(r.status, JSON.stringify(body)).toBe(422)
      expect(errCode(r)).toBe('VALIDATION_ERROR')
      expect(Object.keys(r.body.error.fields ?? {}).length).toBeGreaterThan(0)
    }
    expect(count()).toBe(before + 1)
  })

  it('accepts an 8 character password (the G1-9 minimum) and an inactive class is refused', async () => {
    const ok8 = await call(P2, `${BASE}/pelajar`, 'POST', {
      name: 'Pelajar Lapan',
      email: uniq('eight'),
      password: '12345678',
    })
    expect(ok8.status).toBe(201)
    // Arranged here, not found: a fresh classroom of S1 is switched off through the M10 table.
    const teacherOfS1 = makeUser('teacher', S1)
    const room = classrooms.create(
      { name: 'Kelas Tidak Aktif', teacherId: teacherOfS1.id, schoolId: S1, educationLevel: 'tahun-1' },
      NOW,
    )
    const table = runtime.db.store('m10.classrooms') as unknown as {
      update(id: string, patch: { isActive: boolean }): unknown
    }
    // Test arrangement only: the M10 repository has no deactivate method yet, so write as its owner.
    runAsOwner('M10', () => runtime.db.transaction(() => table.update(room.id, { isActive: false })))
    expect(classrooms.get('classroom', room.classId)?.isActive).toBe(false)
    const r = await call(P2, `${BASE}/pelajar`, 'POST', {
      name: 'Pelajar Kelas',
      email: uniq('inact'),
      classId: room.classId,
    })
    expect(r.status).toBe(422)
    expect(Object.keys((r.body as ErrBody).error.fields ?? {})).toContain('classId')
  })

  it('places the pupil in the session school of each admin (P1 empty school)', async () => {
    const r = await call<CreatePupilResult>(P1, `${BASE}/pelajar`, 'POST', {
      name: 'Pelajar Tiga',
      email: uniq('s3'),
      schoolId: S1,
    })
    expect(r.status).toBe(201)
    expect(users.get(r.body.data.id)?.schoolId).toBe(S3)
    expect(r.body.credential.school).toBe(r.body.data.school.name)
  })
})
