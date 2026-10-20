import { ErrorBodySchema, SchoolAdminPendingTeacherListResponseSchema, SchoolAdminVerifyTeacherResultSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ADMIN,
  apiOf,
  bootSchoolAdminApp,
  insertPendingTeacher,
  login,
  SCHOOL_ADMIN,
  schoolIdOf,
  STUDENT,
  TEACHER,
  type Api,
  type SchoolAdminTestApp,
} from './helpers'

describe('BE-21 AC13: pending teachers and verification', () => {
  let t: SchoolAdminTestApp
  let admin: Api
  let s1: string
  let s2: string

  beforeAll(async () => {
    t = await bootSchoolAdminApp()
    admin = apiOf(await login(t, SCHOOL_ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
  })
  afterAll(async () => {
    await t.close()
  })

  const row = async (id: string) =>
    (await t.db.query<{ is_active: boolean; school_id: string | null; pending: string | null }>(
      `select is_active, school_id::text, pending_school_id::text as pending from users where id = $1::bigint`,
      [id],
    ))[0]

  it('lists only the teachers pending for the own school (parsed with the contract, no-store)', async () => {
    const mine = await insertPendingTeacher(t.db, 'p1@ujian.test', s1, 'Guru Satu')
    const foreign = await insertPendingTeacher(t.db, 'p2@ujian.test', s2, 'Guru Dua')
    const res = await admin.get('/admin-sekolah/guru/pending')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const body = SchoolAdminPendingTeacherListResponseSchema.parse(res.body)
    const ids = body.data.map((r) => r.id)
    expect(ids).toContain(mine)
    expect(ids).not.toContain(foreign)
    const first = body.data.find((r) => r.id === mine)
    expect(first).toMatchObject({ name: 'Guru Satu', initials: 'GS', email: 'p1@ujian.test' })
    // A schoolId in the query cannot widen the school.
    const forged = SchoolAdminPendingTeacherListResponseSchema.parse((await admin.get(`/admin-sekolah/guru/pending?schoolId=${s2}`)).body)
    expect(forged.data.map((r) => r.id)).not.toContain(foreign)
  })

  it('a pending teacher is locked out; after verify it has the admin school, is active and is notified; audit has ids only', async () => {
    const id = await insertPendingTeacher(t.db, 'p3@ujian.test', s1, 'Guru Tiga')
    const before = await row(id)
    expect(before).toMatchObject({ is_active: false, school_id: null, pending: s1 })

    const res = await admin.post(`/admin-sekolah/guru/${id}/verify`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const body = SchoolAdminVerifyTeacherResultSchema.parse(res.body)
    expect(body).toEqual({ data: { id, isActive: true, schoolId: s1 }, status: 'Guru berjaya disahkan.' })
    expect(await row(id)).toMatchObject({ is_active: true, school_id: s1, pending: null })

    const roles = await t.db.query<{ role: string }>(`select role from user_roles where user_id = $1::bigint`, [id])
    expect(roles.map((r) => r.role)).toEqual(['teacher'])

    const notices = await t.db.query<{ type: string; category: string }>(`select type, category from notifications where user_id = $1::bigint`, [id])
    expect(notices).toEqual([{ type: 'teacher_verified', category: 'system' }])

    const audit = await t.db.query<{ actor: string; school: string; target: string; detail: Record<string, unknown> }>(
      `select actor_user_id::text as actor, scope_school_id::text as school, target_id as target, detail
         from audit_events where action = 'school_admin.teacher.verified' and target_id = $1`,
      [id],
    )
    expect(audit).toHaveLength(1)
    expect(audit[0]?.school).toBe(s1)
    expect(Object.keys(audit[0]?.detail ?? {}).sort()).toEqual(['schoolId', 'sessionRowId', 'teacherId'])
    expect(JSON.stringify(audit[0])).not.toMatch(/Guru Tiga|p3@ujian/)

    // No longer in the pending list.
    const list = SchoolAdminPendingTeacherListResponseSchema.parse((await admin.get('/admin-sekolah/guru/pending')).body)
    expect(list.data.map((r) => r.id)).not.toContain(id)
  })

  it('the verified teacher can now log in with the school scope', async () => {
    const id = await insertPendingTeacher(t.db, 'p4@ujian.test', s1)
    await t.db.query(`update users set password_hash = (select password_hash from users where email = $1) where id = $2::bigint`, [TEACHER, id])
    const blocked = await t.http().post('/api/auth/login').send({ identifier: 'p4@ujian.test', password: 'Demo1234' })
    expect(blocked.status).toBe(403)
    expect((await admin.post(`/admin-sekolah/guru/${id}/verify`)).status).toBe(200)
    const who = await login(t, 'p4@ujian.test')
    expect(who.session.active.role).toBe('teacher')
    expect(who.session.active.scope).toMatchObject({ level: 'school', schoolId: s1 })
  })

  it('a teacher pending for another school is 404, and nothing changes (no enumeration)', async () => {
    const foreign = await insertPendingTeacher(t.db, 'p5@ujian.test', s2)
    const res = await admin.post(`/admin-sekolah/guru/${foreign}/verify`)
    expect(res.status).toBe(404)
    expect(ErrorBodySchema.parse(res.body).error.code).toBe('NOT_FOUND')
    expect(await row(foreign)).toMatchObject({ is_active: false, school_id: null, pending: s2 })
    const unknown = await admin.post('/admin-sekolah/guru/999999999/verify')
    expect(unknown.status).toBe(404)
    expect(unknown.body.error.message).toBe(res.body.error.message)
    expect((await admin.post('/admin-sekolah/guru/abc/verify')).status).toBe(404)
  })

  it('an already verified teacher (and a non-pending one) is 404 on a repeat call, idempotently', async () => {
    const id = await insertPendingTeacher(t.db, 'p6@ujian.test', s1)
    expect((await admin.post(`/admin-sekolah/guru/${id}/verify`)).status).toBe(200)
    const again = await admin.post(`/admin-sekolah/guru/${id}/verify`)
    expect(again.status).toBe(404)
    // A normal teacher of the school (never pending) is the same 404.
    const demo = (await t.db.query<{ id: string }>(`select id::text from users where email = $1`, [TEACHER]))[0]?.id as string
    expect((await admin.post(`/admin-sekolah/guru/${demo}/verify`)).status).toBe(404)
    const audits = await t.db.query<{ n: string }>(`select count(*)::text as n from audit_events where action = 'school_admin.teacher.verified' and target_id = $1`, [id])
    expect(audits[0]?.n).toBe('1')
  })

  it('two concurrent verifies: exactly one succeeds, one audit row, one notice', async () => {
    const id = await insertPendingTeacher(t.db, 'p7@ujian.test', s1)
    const [a, b] = await Promise.all([admin.post(`/admin-sekolah/guru/${id}/verify`), admin.post(`/admin-sekolah/guru/${id}/verify`)])
    expect([a.status, b.status].sort()).toEqual([200, 404])
    const n = await t.db.query<{ n: string }>(`select count(*)::text as n from notifications where user_id = $1::bigint`, [id])
    expect(n[0]?.n).toBe('1')
  })

  it('a suspended pending teacher cannot be verified (404)', async () => {
    const id = await insertPendingTeacher(t.db, 'p8@ujian.test', s1)
    await t.db.query(`update users set is_suspended = true where id = $1::bigint`, [id])
    expect((await admin.post(`/admin-sekolah/guru/${id}/verify`)).status).toBe(404)
    expect(await row(id)).toMatchObject({ is_active: false, school_id: null })
  })

  it('a suspended pending teacher is not listed either (the list matches verify)', async () => {
    const id = await insertPendingTeacher(t.db, 'p8b@ujian.test', s1)
    await t.db.query('update users set is_suspended = true where id = $1::bigint', [id])
    const list = SchoolAdminPendingTeacherListResponseSchema.parse((await admin.get('/admin-sekolah/guru/pending')).body)
    expect(list.data.map((r) => r.id)).not.toContain(id)
  })

  it('a school admin cannot verify themselves (404, nothing changes)', async () => {
    const me = (await t.db.query<{ id: string }>('select id::text from users where email = $1', [SCHOOL_ADMIN]))[0]?.id as string
    const res = await admin.post(`/admin-sekolah/guru/${me}/verify`)
    expect(res.status).toBe(404)
    expect(await row(me)).toMatchObject({ is_active: true, school_id: s1, pending: null })
  })

  it('a pending STUDENT-role row is not verifiable (the guarded update needs the teacher role)', async () => {
    const id = await insertPendingTeacher(t.db, 'p9@ujian.test', s1)
    await t.db.query(`update user_roles set role = 'student' where user_id = $1::bigint`, [id])
    expect((await admin.post(`/admin-sekolah/guru/${id}/verify`)).status).toBe(404)
    expect((await row(id))?.is_active).toBe(false)
  })

  it('401 without a session, 403 for every other role, 403 CSRF_INVALID without the token', async () => {
    const id = await insertPendingTeacher(t.db, 'p10@ujian.test', s1)
    expect((await t.http().get('/api/admin-sekolah/guru/pending')).status).toBe(401)
    expect((await t.http().post(`/api/admin-sekolah/guru/${id}/verify`)).status).toBe(401)
    for (const who of [ADMIN, TEACHER, STUDENT]) {
      const other = apiOf(await login(t, who))
      expect((await other.get('/admin-sekolah/guru/pending')).status, who).toBe(403)
      expect((await other.post(`/admin-sekolah/guru/${id}/verify`)).status, who).toBe(403)
    }
    const noCsrf = await login(t, SCHOOL_ADMIN)
    const res = await noCsrf.agent.post(`/api/admin-sekolah/guru/${id}/verify`)
    expect(res.status).toBe(403)
    expect(ErrorBodySchema.parse(res.body).error.code).toBe('CSRF_INVALID')
    expect((await row(id))?.is_active).toBe(false)
  })
})

describe('BE-21 AC13: 429 on the write', () => {
  let t: SchoolAdminTestApp
  beforeAll(async () => {
    t = await bootSchoolAdminApp({ env: { THROTTLE_SCHOOL_ADMIN_WRITE_PER_MINUTE: '2' } })
  })
  afterAll(async () => {
    await t.close()
  })

  it('the third verify within the window is 429 RATE_LIMITED', async () => {
    const admin = apiOf(await login(t, SCHOOL_ADMIN))
    const s1 = await schoolIdOf(t.db, 'DEMO001')
    const ids = [await insertPendingTeacher(t.db, 'q1@ujian.test', s1), await insertPendingTeacher(t.db, 'q2@ujian.test', s1), await insertPendingTeacher(t.db, 'q3@ujian.test', s1)]
    const statuses: number[] = []
    for (const id of ids) statuses.push((await admin.post(`/admin-sekolah/guru/${id}/verify`)).status)
    expect(statuses).toEqual([200, 200, 429])
  })
})

// DB spec: the static guru/pending segment must never be read as a future guru/:id.
describe('BE-21 routing: guru/pending stays ahead of guru/:id', () => {
  let t: SchoolAdminTestApp
  let admin: Api
  beforeAll(async () => {
    t = await bootSchoolAdminApp()
    admin = apiOf(await login(t, SCHOOL_ADMIN))
  })
  afterAll(async () => {
    await t.close()
  })
  it('GET /admin-sekolah/guru/pending still returns the pending list', async () => {
    const res = await admin.get('/admin-sekolah/guru/pending')
    expect(res.status).toBe(200)
    SchoolAdminPendingTeacherListResponseSchema.parse(res.body)
  })
})
