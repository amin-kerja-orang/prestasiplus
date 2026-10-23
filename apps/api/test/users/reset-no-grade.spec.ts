import { CreatedUserSchema, UpdatedUserSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, apiOf, bootUsersApp, fieldsOf, login, SCHOOL_ADMIN, type Api, type UsersTestApp } from './helpers'

const GRADE_REQUIRED = 'The grade field is required when role is student.'

/**
 * Q13 (R73): a migrated pupil often has no grade and no password hash. The admin reset is the only way to give
 * such an account a password, so a request that only resets the password (or flips the status) must not ask
 * for a grade. Any request that edits the profile still does.
 */
describe('admin PUT /admin/users/{id}: a credential-only change of a grade-less student (Q13, R73)', () => {
  let t: UsersTestApp
  let admin: Api
  let schoolAdmin: Api
  let schoolId: string
  let otherSchoolId: string
  let n = 0

  /** A student in the school of the school admin, as the migration leaves it: no grade, no password hash. */
  async function gradeLessStudent(): Promise<{ id: string; name: string }> {
    const name = `Murid Tanpa Gred ${String(++n)}`
    const res = await admin.post('/admin/users', { roles: ['student'], name, email: `tanpa.gred.${String(n)}@ujian.test`, schoolId, grade: 3 })
    const id = CreatedUserSchema.parse(res.body.data).id
    await t.db.query(`update users set grade = null, password_hash = null, must_reset_password = false where id = $1::bigint`, [id])
    return { id, name }
  }

  beforeAll(async () => {
    t = await bootUsersApp({ env: { THROTTLE_ADMIN_WRITE_PER_MINUTE: '100000', THROTTLE_ADMIN_READ_PER_MINUTE: '100000' } })
    admin = apiOf(await login(t, ADMIN))
    schoolAdmin = apiOf(await login(t, SCHOOL_ADMIN))
    const own = await t.db.query<{ school_id: string }>(`select school_id::text from users where email = $1`, [SCHOOL_ADMIN])
    schoolId = own[0]?.school_id as string
    const other = await t.db.query<{ id: string }>(`select id::text from schools where id <> $1::bigint order by id limit 1`, [schoolId])
    otherSchoolId = other[0]?.id as string
  })
  afterAll(async () => {
    await t.close()
  })

  it('(a) a password-only reset answers 200 with a generated password and mustChangePassword, and the grade stays empty', async () => {
    const s = await gradeLessStudent()
    const res = await admin.put(`/admin/users/${s.id}`, { roles: ['student'], name: s.name, resetPassword: true })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const d = UpdatedUserSchema.parse(res.body.data)
    expect(d.mustChangePassword).toBe(true)
    expect(d.generatedPassword?.length).toBeGreaterThanOrEqual(12)
    expect(d.grade).toBeNull()
    const row = await t.db.query<{ grade: number | null; password_hash: string | null }>(`select grade, password_hash from users where id = $1::bigint`, [s.id])
    expect(row[0]?.grade).toBeNull()
    expect(row[0]?.password_hash).toBeTruthy()
    // The account can now sign in with the generated password.
    const who = await login(t, `tanpa.gred.${String(n)}@ujian.test`, { password: d.generatedPassword as string })
    expect(who.session.user.email).toBe(`tanpa.gred.${String(n)}@ujian.test`)
  })

  it('(a) the form shape (explicit nulls and unchanged values, a status flip) is a credential-only change too', async () => {
    const s = await gradeLessStudent()
    const res = await admin.put(`/admin/users/${s.id}`, {
      roles: ['student'],
      name: s.name,
      grade: null,
      schoolId,
      phone: null,
      icNumber: null,
      isActive: true,
      resetPassword: true,
    })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const off = await admin.put(`/admin/users/${s.id}`, { roles: ['student'], name: s.name, isActive: false })
    expect(off.status, JSON.stringify(off.body)).toBe(200)
    expect(UpdatedUserSchema.parse(off.body.data).isActive).toBe(false)
  })

  it('(b) an edit of the name, the school, the phone or the roles without a grade is still 422 fields.grade', async () => {
    const s = await gradeLessStudent()
    const url = `/admin/users/${s.id}`
    for (const body of [
      { roles: ['student'], name: 'Nama Lain', resetPassword: true },
      { roles: ['student'], name: s.name, schoolId: otherSchoolId, resetPassword: true },
      { roles: ['student'], name: s.name, phone: '0123456789', resetPassword: true },
      { roles: ['student'], name: s.name, icNumber: '010203040506', resetPassword: true },
      { roles: ['student'], name: 'Nama Lain' },
      { roles: ['student'], name: s.name },
      { roles: ['student'], name: s.name, grade: null },
    ]) {
      const res = await admin.put(url, body)
      expect(fieldsOf(res).grade, JSON.stringify(body)).toBe(GRADE_REQUIRED)
    }
    // Nothing was written by the refused requests.
    const row = await t.db.query<{ name: string; password_hash: string | null }>(`select name, password_hash from users where id = $1::bigint`, [s.id])
    expect(row[0]).toEqual({ name: s.name, password_hash: null })
  })

  it('(b) a role change to student, and a student whose grade is cleared, still need a grade, with or without a reset', async () => {
    const teacher = await admin.post('/admin/users', { roles: ['teacher'], name: 'Jadi Murid', email: 'jadi.murid@ujian.test', schoolId })
    const tid = CreatedUserSchema.parse(teacher.body.data).id
    expect(fieldsOf(await admin.put(`/admin/users/${tid}`, { roles: ['student'], name: 'Jadi Murid', resetPassword: true })).grade).toBe(GRADE_REQUIRED)
    const graded = await admin.post('/admin/users', { roles: ['student'], name: 'Bergred', email: 'bergred@ujian.test', schoolId, grade: 4 })
    const gid = CreatedUserSchema.parse(graded.body.data).id
    expect(fieldsOf(await admin.put(`/admin/users/${gid}`, { roles: ['student'], name: 'Bergred', grade: null, resetPassword: true })).grade).toBe(GRADE_REQUIRED)
    expect((await admin.put(`/admin/users/${gid}`, { roles: ['student'], name: 'Bergred', resetPassword: true })).status).toBe(200)
  })

  it('(c) creating a student without a grade is still 422 fields.grade', async () => {
    const res = await admin.post('/admin/users', { roles: ['student'], name: 'Baharu', email: 'baharu.tanpa.gred@ujian.test', schoolId })
    expect(fieldsOf(res).grade).toBe(GRADE_REQUIRED)
  })

  it('(d) a school admin resets the password of a grade-less pupil of its school the same way, and edits still need a grade', async () => {
    const s = await gradeLessStudent()
    const res = await schoolAdmin.put(`/admin/users/${s.id}`, { roles: ['student'], name: s.name, resetPassword: true })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const d = UpdatedUserSchema.parse(res.body.data)
    expect(d.mustChangePassword).toBe(true)
    expect(d.generatedPassword?.length).toBeGreaterThanOrEqual(12)
    expect(fieldsOf(await schoolAdmin.put(`/admin/users/${s.id}`, { roles: ['student'], name: 'Nama Lain', resetPassword: true })).grade).toBe(GRADE_REQUIRED)
  })
})
