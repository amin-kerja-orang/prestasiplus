import { ErrorBodySchema } from '@pp/contract'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { ACCOUNT_REGISTRATION_CLOSED_MESSAGE } from '../../src/modules/account/account.constants'
import { schoolIdOf } from '../auth/helpers'
import { ADMIN, teacherBody } from '../users/helpers'
import { type AccountTestApp, bootAccountApp, cookieValue, DEMO_PASSWORD, errorOf, login, post, REGISTER_STUDENT, userRow } from './account-helpers'

const userCount = async (t: AccountTestApp): Promise<number> => Number((await t.db.query<{ n: string }>('select count(*)::text as n from users'))[0]?.n)

describe.each([['false'], ['0']])('REG-CLOSE: REGISTRATION_OPEN=%s closes POST /api/auth/register', (flag) => {
  let t: AccountTestApp | undefined
  let schoolId: string
  const app = (): AccountTestApp => t as AccountTestApp
  const student = (n: number) => ({ ...REGISTER_STUDENT, email: `murid.tutup${n}@ujian.test`, schoolId })
  const teacher = { name: 'Cikgu Tutup', email: 'cikgu.tutup@ujian.test', phone: '0191234567', role: 'teacher', password: 'rahsia1', passwordConfirmation: 'rahsia1' }
  const parent = { name: 'Penjaga Tutup', email: 'penjaga.tutup@ujian.test', phone: '0191234567', role: 'parent', password: 'rahsia1', passwordConfirmation: 'rahsia1' }

  const boot = async () => {
    if (t) return
    t = await bootAccountApp({ env: { REGISTRATION_OPEN: flag } })
    schoolId = await schoolIdOf(t.db, 'DEMO001')
  }
  beforeEach(async () => {
    await boot()
    app().clock.advance(61_000)
  })
  afterAll(async () => {
    await t?.close()
  })

  it('student, teacher and parent: 403 REGISTRATION_CLOSED, BM message, no cookie, no-store, nothing created', async () => {
    const before = await userCount(app())
    for (const body of [student(1), { ...teacher, schoolId }, { ...parent, schoolId }]) {
      const res = await app().http().post('/api/auth/register').send(body)
      const error = errorOf(res, 403, 'REGISTRATION_CLOSED')
      expect(error.message).toBe(ACCOUNT_REGISTRATION_CLOSED_MESSAGE)
      expect(error.message).toBe('Pendaftaran akaun baharu ditutup buat sementara waktu. Sila cuba lagi kemudian.')
      expect(ErrorBodySchema.safeParse(res.body).success).toBe(true)
      expect(cookieValue(res)).toBeUndefined()
      expect(res.headers['cache-control']).toBe('no-store')
      expect(await userRow(app().db, (body as { email: string }).email)).toBeUndefined()
    }
    expect(await userCount(app())).toBe(before)
  })

  it('an invalid or empty body is 403 as well, never 422', async () => {
    for (const body of [{}, { email: 'bukan-emel' }, { ...student(2), password: 'x' }]) {
      const res = await app().http().post('/api/auth/register').send(body)
      errorOf(res, 403, 'REGISTRATION_CLOSED')
    }
    errorOf(await app().http().post('/api/auth/register'), 403, 'REGISTRATION_CLOSED')
  })

  it('login of an existing account and the password reset e-mail route still work', async () => {
    const who = await login(app(), 'pelajar@demo.test', DEMO_PASSWORD)
    expect(who.session.user.email).toBe('pelajar@demo.test')
    const res = await app().http().post('/api/auth/password/email').send({ email: 'pelajar@demo.test' })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(app().mail.sent).toHaveLength(1)
  })

  it('an account created by an Admin Pusat is still possible', async () => {
    const admin = await login(app(), ADMIN)
    const res = await post(admin, '/admin/users', teacherBody(schoolId, { email: 'guru.admin.tutup@ujian.test' }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(await userRow(app().db, 'guru.admin.tutup@ujian.test')).toBeDefined()
  })
})

describe.each([[undefined], ['true'], ['1']])('REG-CLOSE: REGISTRATION_OPEN=%s keeps registration open', (flag) => {
  it('a student registers (201)', async () => {
    const t = await bootAccountApp({ env: { REGISTRATION_OPEN: flag } })
    try {
      const schoolId = await schoolIdOf(t.db, 'DEMO001')
      const res = await t.http().post('/api/auth/register').send({ ...REGISTER_STUDENT, email: 'murid.buka@ujian.test', schoolId })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(await userRow(t.db, 'murid.buka@ujian.test')).toBeDefined()
    } finally {
      await t.close()
    }
  })
})
