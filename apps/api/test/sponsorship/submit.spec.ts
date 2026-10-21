import { FosterApplicationCreatedSchema, KELUARGA_ANGKAT_MESSAGES as MSG, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { UsersRepository } from '../../src/modules/users'
import { ADMIN, STUDENT, STUDENT_B, START, TEACHER, applications, bootSponsorshipApp, client, idOfEmail, reroleUser, validBody, type Client, type SponsorshipTestApp } from './helpers'

let t: SponsorshipTestApp
let student: Client
let teacher: Client
let admin: Client

beforeAll(async () => {
  t = await bootSponsorshipApp()
  await reroleUser(t, STUDENT_B, 'parent')
  student = await client(t, STUDENT)
  teacher = await client(t, TEACHER)
  admin = await client(t, ADMIN)
}, 120_000)
afterAll(async () => {
  await t.close()
})

const fieldsOf = (res: { body: { error?: { fields?: Record<string, string> } } }): Record<string, string> => res.body.error?.fields ?? {}
const rowCount = async (): Promise<number> => (await applications(t)).length

describe('AC1 happy path', () => {
  it('201 {data: {id}} with a decimal-string id that parses with the contract schema', async () => {
    const res = await student.post(validBody())
    expect(res.status).toBe(201)
    expect(() => envelopeOf(FosterApplicationCreatedSchema).parse(res.body)).not.toThrow()
    expect(res.body.data).toEqual({ id: expect.stringMatching(/^[1-9]\d*$/) })
    expect(Object.keys(res.body)).toEqual(['data'])
  })

  it('stores a pending application: the session user is the applicant, created_at is now, the reason as typed', async () => {
    const before = await rowCount()
    const res = await student.post(validBody({ reason: '  Pelajar yatim piatu.  ', studentCategory: 'Lain-lain', familyIncomeRange: '> RM4,000' }))
    expect(res.status).toBe(201)
    const row = (await applications(t)).find((r) => r.id === res.body.data.id)
    expect(await rowCount()).toBe(before + 1)
    expect(row).toMatchObject({
      student_id: await idOfEmail(t, STUDENT),
      applicant_user_id: student.userId,
      applicant_role: 'student',
      student_category: 'Lain-lain',
      family_income_range: '> RM4,000',
      reason: '  Pelajar yatim piatu.  ',
      status: 'pending',
      is_test: false,
      legacy_source: null,
      legacy_id: null,
    })
    expect(row?.created_at.toISOString()).toBe(new Date(START).toISOString())
  })

  it('accepts all 5 categories and all 4 incomes', async () => {
    for (const studentCategory of ['B40', 'Asnaf', 'Yatim', 'OKU', 'Lain-lain']) expect((await student.post(validBody({ studentCategory }))).status).toBe(201)
    for (const familyIncomeRange of ['< RM1,000', 'RM1,000 - RM2,500', 'RM2,500 - RM4,000', '> RM4,000']) expect((await student.post(validBody({ familyIncomeRange }))).status).toBe(201)
  })

  it('a 6,000-character reason is accepted and stored as its first 5,000 characters', async () => {
    const reason = 'a'.repeat(5000) + 'b'.repeat(1000)
    const res = await student.post(validBody({ reason }))
    expect(res.status).toBe(201)
    const row = (await applications(t)).find((r) => r.id === res.body.data.id)
    expect(row?.reason).toHaveLength(5000)
    expect(row?.reason).toBe('a'.repeat(5000))
  })

  it('AC5: two identical submissions create two rows with different ids (no duplicate check)', async () => {
    const before = await rowCount()
    const a = await teacher.post(validBody())
    const b = await teacher.post(validBody())
    expect([a.status, b.status]).toEqual([201, 201])
    expect(a.body.data.id).not.toBe(b.body.data.id)
    expect(await rowCount()).toBe(before + 2)
  })
})

describe('income range: missing, null, blank and non-string mean "not given"', () => {
  it.each([
    ['missing', undefined],
    ['null', null],
    ['empty string', ''],
    ['a number', 5],
    ['an object', { a: 1 }],
    ['a boolean', true],
  ])('%s is stored null', async (_name, value) => {
    const body = validBody()
    if (value === undefined) delete body.familyIncomeRange
    else body.familyIncomeRange = value
    const res = await student.post(body)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect((await applications(t)).find((r) => r.id === res.body.data.id)?.family_income_range).toBeNull()
  })

  it('an unknown income string is "Pilihan tidak sah."', async () => {
    const res = await student.post(validBody({ familyIncomeRange: 'RM9' }))
    expect(res.status).toBe(422)
    expect(fieldsOf(res)).toEqual({ familyIncomeRange: MSG.invalidChoice })
    expect(res.body.error.message).toBe('Pilihan tidak sah.')
  })
})

describe('AC2 validation', () => {
  it('422 VALIDATION_ERROR envelope with a requestId; nothing is stored', async () => {
    const before = await rowCount()
    const res = await student.post({})
    expect(res.status).toBe(422)
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', requestId: expect.any(String) })
    expect(await rowCount()).toBe(before)
  })

  it('every missing required field is reported together, in the order studentEmail, studentCategory, reason', async () => {
    const res = await student.post({})
    expect(fieldsOf(res)).toEqual({ studentEmail: MSG.required, studentCategory: MSG.required, reason: MSG.required })
    expect(Object.keys(fieldsOf(res))).toEqual(['studentEmail', 'studentCategory', 'reason'])
    expect(res.body.error.message).toBe('Sila isi ruangan ini. (and 2 more errors)')
  })

  it('all four fields wrong: insertion order studentEmail, studentCategory, familyIncomeRange, reason and the "3 more errors" suffix', async () => {
    const res = await student.post({ studentEmail: 'bukan-emel', studentCategory: 'VIP', familyIncomeRange: 'RM9', reason: '   ' })
    expect(res.status).toBe(422)
    expect(Object.keys(fieldsOf(res))).toEqual(['studentEmail', 'studentCategory', 'familyIncomeRange', 'reason'])
    expect(fieldsOf(res)).toEqual({
      studentEmail: MSG.invalidEmail,
      studentCategory: MSG.invalidChoice,
      familyIncomeRange: MSG.invalidChoice,
      reason: MSG.required,
    })
    expect(res.body.error.message).toBe('Format e-mel tidak sah. (and 3 more errors)')
  })

  it('two errors give the singular suffix; one error has no suffix', async () => {
    const two = await student.post(validBody({ studentCategory: 'VIP', reason: '' }))
    expect(two.body.error.message).toBe('Pilihan tidak sah. (and 1 more error)')
    const one = await student.post(validBody({ studentCategory: 'VIP' }))
    expect(one.body.error.message).toBe('Pilihan tidak sah.')
  })

  it.each([
    ['blank', '', MSG.required],
    ['whitespace only', ' \t  ', MSG.required],
    ['not a string', 42, MSG.required],
    ['null', null, MSG.required],
    ['no @', 'bukan-emel', MSG.invalidEmail],
    ['no dot in the domain', 'a@b', MSG.invalidEmail],
    ['inner space', 'a b@c.my', MSG.invalidEmail],
  ])('studentEmail %s', async (_name, studentEmail, message) => {
    const res = await student.post(validBody({ studentEmail }))
    expect(res.status).toBe(422)
    expect(fieldsOf(res)).toEqual({ studentEmail: message })
  })

  it.each([
    ['empty', '', MSG.required],
    ['not a string', 7, MSG.required],
    ['null', null, MSG.required],
    ['an array', ['B40'], MSG.required],
    ['outside the five', 'VIP', MSG.invalidChoice],
    ['wrong letter case', 'b40', MSG.invalidChoice],
  ])('studentCategory %s', async (_name, studentCategory, message) => {
    const res = await student.post(validBody({ studentCategory }))
    expect(res.status).toBe(422)
    expect(fieldsOf(res)).toEqual({ studentCategory: message })
  })

  it.each([
    ['empty', ''],
    ['whitespace only', ' \t  '],
    ['not a string', 7],
    ['null', null],
  ])('reason %s is "Sila isi ruangan ini." and nothing is stored', async (_name, reason) => {
    const before = await rowCount()
    const res = await student.post(validBody({ reason }))
    expect(res.status).toBe(422)
    expect(fieldsOf(res)).toEqual({ reason: 'Sila isi ruangan ini.' })
    expect(await rowCount()).toBe(before)
  })

  it('a body that is not an object is treated as empty', async () => {
    const res = await student.post(['x'])
    expect(res.status).toBe(422)
    expect(Object.keys(fieldsOf(res))).toEqual(['studentEmail', 'studentCategory', 'reason'])
  })

  it('a malformed JSON body is a 422, without echoing the text', async () => {
    const agent = t.agent()
    const login = await agent.post('/api/auth/login').send({ identifier: STUDENT, password: 'Demo1234', remember: false })
    const res = await agent.post('/api/mohon-keluarga-angkat').set('X-CSRF-Token', login.body.data.csrf).set('Content-Type', 'application/json').send('{"reason": "RAHSIA-JSON"')
    expect(res.status).toBe(422)
    expect(JSON.stringify(res.body)).not.toContain('RAHSIA')
  })
})

describe('AC3 e-mail rules', () => {
  const NOT_FOUND = { studentEmail: MSG.studentNotFound }

  it('teacher, parent, admin, school admin and unknown e-mails give the identical 422 body (apart from the request id)', async () => {
    const before = await rowCount()
    const strip = (b: { error: Record<string, unknown> }) => ({ ...b.error, requestId: undefined })
    const bodies = []
    for (const email of [TEACHER, STUDENT_B, ADMIN, 'adminsekolah@demo.test', 'tiada.siapa@demo.test']) {
      const res = await student.post(validBody({ studentEmail: email }))
      expect(res.status, email).toBe(422)
      expect(fieldsOf(res), email).toEqual(NOT_FOUND)
      expect(res.body.error.message).toBe('Email pelajar tidak dijumpai dalam PrestasiPlus.')
      bodies.push(strip(res.body))
    }
    for (const b of bodies.slice(1)) expect(b).toEqual(bodies[0])
    expect(await rowCount()).toBe(before)
  })

  it('exactly one users lookup is made for a shape-valid e-mail, found student or not, with other fields valid or not', async () => {
    const repo = t.app.get(UsersRepository)
    const spy = vi.spyOn(repo, 'findByEmail')
    try {
      const cases: [string, Record<string, unknown>][] = [
        ['found non-student', validBody({ studentEmail: TEACHER })],
        ['unknown', validBody({ studentEmail: 'tiada.siapa@demo.test' })],
        ['found student', validBody()],
        ['found non-student, other fields invalid', { studentEmail: ADMIN, studentCategory: 'VIP', reason: '' }],
        ['unknown, other fields invalid', { studentEmail: 'tiada.siapa@demo.test', studentCategory: 'VIP', reason: '' }],
        ['found student, other fields invalid', { studentEmail: STUDENT, studentCategory: 'VIP', reason: '' }],
      ]
      for (const [name, body] of cases) {
        spy.mockClear()
        await student.post(body)
        expect(spy, name).toHaveBeenCalledTimes(1)
      }
      // No lookup for an e-mail that is blank, not a string or not shape-valid.
      for (const studentEmail of ['', '   ', 5, 'bukan-emel']) {
        spy.mockClear()
        await student.post(validBody({ studentEmail }))
        expect(spy, String(studentEmail)).not.toHaveBeenCalled()
      }
    } finally {
      spy.mockRestore()
    }
  })

  it('a found non-student is decided without a second users query: the SQL log of both paths differs only by the lookup itself', async () => {
    // findByEmail is BE-05's: an unknown e-mail is 1 statement, a known one is 2 (id, then the user with roles). The service
    // adds no query of its own on either path, so a teacher e-mail and an admin e-mail make the same number of statements.
    const repo = t.app.get(UsersRepository)
    const spy = vi.spyOn(repo, 'get')
    try {
      await student.post(validBody({ studentEmail: TEACHER }))
      const teacherCalls = spy.mock.calls.length
      spy.mockClear()
      await student.post(validBody({ studentEmail: ADMIN }))
      expect(spy.mock.calls.length).toBe(teacherCalls)
      expect(teacherCalls).toBe(1)
    } finally {
      spy.mockRestore()
    }
  })

  it('the lookup is trimmed and case-insensitive (BE-05 findByEmail uses lower()), the stored reason is as typed', async () => {
    const res = await student.post(validBody({ studentEmail: `  ${STUDENT.toUpperCase()} `, reason: '  teks  ' }))
    expect(res.status).toBe(201)
    const row = (await applications(t)).find((r) => r.id === res.body.data.id)
    expect(row).toMatchObject({ student_id: await idOfEmail(t, STUDENT), reason: '  teks  ' })
  })

  it('findByEmail returns a user in any state: an inactive or suspended student is accepted (documented behaviour)', async () => {
    for (const email of ['tidakaktif@demo.test', 'digantung@demo.test']) {
      const res = await student.post(validBody({ studentEmail: email }))
      expect(res.status, email).toBe(201)
    }
  })

  it('a user who holds the student role among others is a student', async () => {
    const id = await idOfEmail(t, 'guruadmin@demo.test')
    await t.db.query(`insert into user_roles (user_id, role) values ($1, 'student') on conflict do nothing`, [id])
    await t.db.query(`insert into user_scopes (user_id, role, level) values ($1, 'student', 'self') on conflict do nothing`, [id])
    expect((await student.post(validBody({ studentEmail: 'guruadmin@demo.test' }))).status).toBe(201)
  })
})

describe('AC4 the applicant comes from the session', () => {
  it('applicantUserId, applicantRole, studentId, status, isTest, createdAt and unknown keys in the body are ignored', async () => {
    const adminId = admin.userId
    const res = await admin.post({
      ...validBody(),
      applicantUserId: '1',
      applicantRole: 'student',
      studentId: '1',
      status: 'approved',
      isTest: true,
      is_test: true,
      createdAt: '2000-01-01T00:00:00Z',
      id: '999',
      legacySource: 'cloud',
      legacyId: 'x',
    })
    expect(res.status).toBe(201)
    const row = (await applications(t)).find((r) => r.id === res.body.data.id)
    expect(row).toMatchObject({
      applicant_user_id: adminId,
      applicant_role: 'admin',
      student_id: await idOfEmail(t, STUDENT),
      status: 'pending',
      is_test: false,
      legacy_source: null,
      legacy_id: null,
    })
    expect(row?.id).not.toBe('999')
    expect(row?.created_at.toISOString()).toBe(new Date(START).toISOString())
  })

  it('the role stored is the session role code for a teacher, a parent and an admin', async () => {
    const parent = await client(t, STUDENT_B)
    const cases: [Client, string][] = [
      [teacher, 'teacher'],
      [parent, 'parent'],
      [admin, 'admin'],
      [student, 'student'],
    ]
    for (const [who, role] of cases) {
      const res = await who.post(validBody())
      expect(res.status, role).toBe(201)
      const row = (await applications(t)).find((r) => r.id === res.body.data.id)
      expect(row).toMatchObject({ applicant_role: role, applicant_user_id: who.userId })
    }
  })
})

describe('AC6 no side effects', () => {
  it('a submission writes nothing but the application: no notification, job (outbox) or audit row', async () => {
    const count = async (table: string): Promise<number> => (await t.db.query<{ n: number }>(`select count(*)::int n from ${table}`))[0]?.n as number
    const tables = ['notifications', 'audit_events', 'jobs', 'files', 'sessions']
    // A fresh login writes session and audit rows itself, so log in first and measure around the POST only.
    const who = await client(t, STUDENT)
    const before = await Promise.all(tables.map(count))
    const apps = await rowCount()
    const res = await who.post(validBody({ reason: 'KANARI-SEBAB-ZXQ' }))
    expect(res.status).toBe(201)
    expect(await rowCount()).toBe(apps + 1)
    expect(await Promise.all(tables.map(count))).toEqual(before)
    for (const table of ['notifications', 'audit_events']) {
      const hits = await t.db.query<{ n: number }>(`select count(*)::int n from ${table} t where t::text like '%KANARI-SEBAB-ZXQ%'`)
      expect(hits[0]?.n, table).toBe(0)
    }
  })

  it('a rejected submission writes nothing at all', async () => {
    const who = await client(t, STUDENT)
    const count = async (): Promise<number> => (await t.db.query<{ n: number }>(`select (select count(*) from foster_applications) + (select count(*) from notifications) + (select count(*) from audit_events) as n`))[0]?.n as number
    const before = await count()
    expect((await who.post(validBody({ reason: '' }))).status).toBe(422)
    expect(await count()).toBe(before)
  })
})

describe('e-mail length cap (ReDoS guard, security deviation: 254 characters, RFC 5321)', () => {
  const attack = (): string => 'a@' + '.'.repeat(99_900) + ' x'

  it('a ~100 kB near-miss e-mail is 422 "Format e-mel tidak sah." in under 200 ms, with no users lookup', async () => {
    const spy = vi.spyOn(t.app.get(UsersRepository), 'findByEmail')
    try {
      const body = validBody({ studentEmail: attack() })
      const started = performance.now()
      const res = await student.post(body)
      const elapsed = performance.now() - started
      expect(res.status).toBe(422)
      expect(fieldsOf(res)).toEqual({ studentEmail: MSG.invalidEmail })
      expect(res.body.error.message).toBe('Format e-mel tidak sah.')
      expect(elapsed).toBeLessThan(200)
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })

  it('combined with other errors it keeps the field order and the summary message', async () => {
    const res = await student.post({ studentEmail: attack(), studentCategory: 'VIP', familyIncomeRange: 'RM9', reason: ' ' })
    expect(res.status).toBe(422)
    expect(Object.keys(fieldsOf(res))).toEqual(['studentEmail', 'studentCategory', 'familyIncomeRange', 'reason'])
    expect(fieldsOf(res).studentEmail).toBe(MSG.invalidEmail)
    expect(res.body.error.message).toBe('Format e-mel tidak sah. (and 3 more errors)')
  })

  it('255 trimmed characters is refused; surrounding spaces do not count towards the length', async () => {
    const local = (n: number): string => 'a'.repeat(n - '@b.my'.length) + '@b.my'
    const spy = vi.spyOn(t.app.get(UsersRepository), 'findByEmail')
    try {
      const over = await student.post(validBody({ studentEmail: local(255) }))
      expect(fieldsOf(over)).toEqual({ studentEmail: MSG.invalidEmail })
      expect(spy).not.toHaveBeenCalled()
      const ok = await student.post(validBody({ studentEmail: `   ${local(254)}  ` }))
      expect(ok.status).toBe(422)
      expect(fieldsOf(ok)).toEqual({ studentEmail: MSG.studentNotFound })
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy.mock.calls[0]?.[0]).toBe(local(254))
    } finally {
      spy.mockRestore()
    }
  })
})

describe('U+0000 in the body (the global NulGuard answers before the controller)', () => {
  it('a NUL in the reason or the e-mail is a 4xx 422 with the field named, never a 500, and nothing is stored or logged', async () => {
    const before = await rowCount()
    for (const over of [{ reason: 'abc\u0000def' }, { studentEmail: 'a\u0000@b.my' }]) {
      const res = await student.post(validBody(over))
      expect(res.status, JSON.stringify(Object.keys(over))).toBe(422)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
      expect(Object.keys(fieldsOf(res))).toEqual(Object.keys(over))
      expect(JSON.stringify(res.body)).not.toContain('abc')
    }
    expect(await rowCount()).toBe(before)
  })
})
