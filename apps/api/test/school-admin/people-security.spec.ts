import { ErrorBodySchema, SchoolAdminPupilCreatedResultSchema, SchoolAdminTeacherCreatedResultSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { LogCapture } from '../support/app'
import { ADMIN, login, SCHOOL_ADMIN, schoolIdOf, STUDENT, TEACHER, userIdOf, type SchoolAdminTestApp } from './helpers'
import {
  bootPeopleApp,
  countOf,
  enrolIn,
  errorOf,
  expectNoCache,
  insertClass,
  insertSchoolAdmin,
  insertUser,
  liveSessions,
  loginWith,
  peopleApiOf,
  userRow,
  type PeopleApi,
} from './people-helpers'

type Method = 'get' | 'post' | 'put'
const BODY = { name: 'Nama Uji', email: 'uji@ujian.test', newPassword: 'abcdefgh1', newPasswordConfirmation: 'abcdefgh1' }

/** The 14 routes of Part A; `:id` is a placeholder id. */
const ROUTES: [Method, string][] = [
  ['get', '/admin-sekolah/guru'],
  ['get', '/admin-sekolah/guru/export.csv'],
  ['get', '/admin-sekolah/guru/1'],
  ['post', '/admin-sekolah/guru'],
  ['put', '/admin-sekolah/guru/1'],
  ['post', '/admin-sekolah/guru/1/toggle-active'],
  ['post', '/admin-sekolah/guru/1/reset-password'],
  ['get', '/admin-sekolah/pelajar'],
  ['get', '/admin-sekolah/pelajar/form-options'],
  ['get', '/admin-sekolah/pelajar/export.csv'],
  ['get', '/admin-sekolah/pelajar/1'],
  ['post', '/admin-sekolah/pelajar'],
  ['put', '/admin-sekolah/pelajar/1'],
  ['post', '/admin-sekolah/pelajar/1/reset-password'],
]

/** BE-21 Part A security review: scope, mass assignment, credentials, headers, audit, logs, sessions. DB spec (Testcontainers). */
describe('BE-21 people security', () => {
  let t: SchoolAdminTestApp
  let admin: PeopleApi
  let other: PeopleApi // school admin of the second school
  let s1: string
  let s2: string
  let teacher1: string
  let pupil1: string
  let teacher2: string
  let pupil2: string
  let adminId: string
  const logs = new LogCapture()
  /** Everything typed or generated that must never be found in a log line, an audit row or a response after its own. */
  const secrets: string[] = ['abcdefgh1', 'Penyerang-123', 'Sesi-Baharu-55', 'Sesi-Ketiga-66']
  /** Personal data that must never be found in an audit row. */
  const pii: string[] = ['Zulaikha Ujian', 'zulaikha@ujian.test', '0165554443', 'Rahim Ujian', 'rahim@ujian.test', '010101-01-0101', '010101010101']

  beforeAll(async () => {
    t = await bootPeopleApp({ logs, env: { LOG_LEVEL: 'debug' } })
    admin = peopleApiOf(await login(t, SCHOOL_ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
    adminId = await userIdOf(t.db, SCHOOL_ADMIN)
    await insertSchoolAdmin(t.db, s2, 'admin2@ujian.test')
    other = peopleApiOf(await login(t, 'admin2@ujian.test'))
    teacher1 = await userIdOf(t.db, TEACHER)
    pupil1 = await userIdOf(t.db, STUDENT)
    teacher2 = await insertUser(t.db, { name: 'Guru Sekolah Dua', email: 'guru2@ujian.test', roles: ['teacher'], schoolId: s2 })
    pupil2 = await insertUser(t.db, { name: 'Murid Sekolah Dua', email: 'murid2@ujian.test', roles: ['student'], schoolId: s2, grade: 10 })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  const send = (api: PeopleApi, method: Method, path: string, body: unknown = BODY) => (method === 'get' ? api.get(path) : method === 'post' ? api.post(path, body) : api.put(path, body))

  it('401 without a session; 403 for the teacher, the pupil and Admin Pusat; 403 CSRF_INVALID without the token (all 14 routes)', async () => {
    const before = await countOf(t.db, `select count(*)::text as n from users`)
    for (const [method, path] of ROUTES) {
      const res = await t.http()[method](`/api${path}`).send(method === 'get' ? undefined : BODY)
      expect(res.status, `${method} ${path} anonymous`).toBe(401)
    }
    for (const who of [ADMIN, TEACHER, STUDENT]) {
      const api = peopleApiOf(await login(t, who))
      for (const [method, path] of ROUTES) expect((await send(api, method, path)).status, `${method} ${path} as ${who}`).toBe(403)
    }
    const noCsrf = await login(t, SCHOOL_ADMIN)
    for (const [method, path] of ROUTES.filter(([m]) => m !== 'get')) {
      const res = await noCsrf.agent[method](`/api${path}`).send(BODY)
      expect(res.status, `${method} ${path} no csrf`).toBe(403)
      expect(ErrorBodySchema.parse(res.body).error.code).toBe('CSRF_INVALID')
    }
    expect(await countOf(t.db, `select count(*)::text as n from users`)).toBe(before)
  })

  it('the impersonate routes do not exist (UD-2): 404, nothing changes', async () => {
    errorOf(await admin.post(`/admin-sekolah/users/${pupil1}/impersonate`), 404, 'NOT_FOUND', 'Not Found.')
    errorOf(await admin.post('/admin-sekolah/impersonate/leave'), 404, 'NOT_FOUND', 'Not Found.')
  })

  it('cross-school: school B never sees or changes school A, and the reverse (404 "Not Found.", never 403)', async () => {
    const hashBefore = (await userRow(t.db, teacher1))?.password_hash
    const bodyOk = { name: 'Diubah Orang Luar', email: 'diubah@ujian.test', newPassword: 'Penyerang-123', newPasswordConfirmation: 'Penyerang-123' }
    // B acts on A's ids.
    for (const id of [teacher1]) {
      errorOf(await other.get(`/admin-sekolah/guru/${id}`), 404, 'NOT_FOUND', 'Not Found.')
      errorOf(await other.put(`/admin-sekolah/guru/${id}`, bodyOk), 404, 'NOT_FOUND', 'Not Found.')
      errorOf(await other.post(`/admin-sekolah/guru/${id}/toggle-active`), 404, 'NOT_FOUND', 'Not Found.')
      errorOf(await other.post(`/admin-sekolah/guru/${id}/reset-password`, bodyOk), 404, 'NOT_FOUND', 'Not Found.')
    }
    errorOf(await other.get(`/admin-sekolah/pelajar/${pupil1}`), 404, 'NOT_FOUND', 'Not Found.')
    errorOf(await other.put(`/admin-sekolah/pelajar/${pupil1}`, bodyOk), 404, 'NOT_FOUND', 'Not Found.')
    errorOf(await other.post(`/admin-sekolah/pelajar/${pupil1}/reset-password`, bodyOk), 404, 'NOT_FOUND', 'Not Found.')
    // A acts on B's ids.
    errorOf(await admin.get(`/admin-sekolah/guru/${teacher2}`), 404, 'NOT_FOUND', 'Not Found.')
    errorOf(await admin.post(`/admin-sekolah/guru/${teacher2}/toggle-active`), 404, 'NOT_FOUND')
    errorOf(await admin.get(`/admin-sekolah/pelajar/${pupil2}`), 404, 'NOT_FOUND')
    errorOf(await admin.post(`/admin-sekolah/pelajar/${pupil2}/reset-password`, bodyOk), 404, 'NOT_FOUND')
    // Nothing changed.
    expect((await userRow(t.db, teacher1))).toMatchObject({ name: 'Guru Demo', password_hash: hashBefore, is_active: true })
    expect(await userRow(t.db, pupil1)).toMatchObject({ name: 'Murid Demo', email: 'pelajar@demo.test' })
    // Lists, counts and CSVs are confined too.
    for (const [api, list, mine, theirs] of [
      [other, 'guru', teacher2, teacher1],
      [other, 'pelajar', pupil2, pupil1],
      [admin, 'guru', teacher1, teacher2],
      [admin, 'pelajar', pupil1, pupil2],
    ] as const) {
      const res = await api.get(`/admin-sekolah/${list}?schoolId=${theirs}&school_id=${s1}`)
      const ids = (res.body.data as { id: string }[]).map((r) => r.id)
      expect(ids).toContain(mine)
      expect(ids).not.toContain(theirs)
    }
    expect(((await other.get('/admin-sekolah/guru')).body.meta as { counts: { total: number } }).counts.total).toBe(1)
    const csvB = (await other.get('/admin-sekolah/pelajar/export.csv')).text
    expect(csvB).toContain('Murid Sekolah Dua')
    expect(csvB).not.toContain('Murid Demo')
    expect(csvB).not.toContain('pelajar@demo.test')
  })

  it('a parent, a school admin and a teacher-and-school-admin are not manageable here (404) on either route family', async () => {
    const parent = await insertUser(t.db, { name: 'Ibu Bapa Uji', email: 'ibu@ujian.test', roles: ['parent'], schoolId: s1 })
    const both = await userIdOf(t.db, 'guruadmin@demo.test')
    for (const id of [parent, both, adminId]) {
      for (const prefix of ['guru', 'pelajar']) {
        errorOf(await admin.get(`/admin-sekolah/${prefix}/${id}`), 404, 'NOT_FOUND')
        errorOf(await admin.put(`/admin-sekolah/${prefix}/${id}`, BODY), 404, 'NOT_FOUND')
        errorOf(await admin.post(`/admin-sekolah/${prefix}/${id}/reset-password`, BODY), 404, 'NOT_FOUND')
      }
      errorOf(await admin.post(`/admin-sekolah/guru/${id}/toggle-active`), 404, 'NOT_FOUND')
    }
  })

  it('mass assignment: role, schoolId, isActive, grade, icNumber and password in the body (or schoolId in the query) are ignored on create', async () => {
    const forged = { role: 'admin', roles: ['admin', 'school_admin'], schoolId: s2, school_id: s2, isActive: false, grade: 5, icNumber: '010101-01-0101', icHash: 'x', password: 'Penyerang-123', passwordHash: 'x', createdById: pupil2, mustChangePassword: false }
    const pupil = SchoolAdminPupilCreatedResultSchema.parse((await admin.post(`/admin-sekolah/pelajar?schoolId=${s2}`, { name: 'Zulaikha Ujian', email: 'zulaikha@ujian.test', ...forged })).body)
    const teacher = SchoolAdminTeacherCreatedResultSchema.parse((await admin.post(`/admin-sekolah/guru?schoolId=${s2}`, { name: 'Rahim Ujian', email: 'rahim@ujian.test', phone: '0165554443', ...forged })).body)
    secrets.push(pupil.credential.password, teacher.credential.password)
    for (const [created, role] of [
      [pupil, 'student'],
      [teacher, 'teacher'],
    ] as const) {
      const row = await userRow(t.db, created.data.id)
      expect(row).toMatchObject({ school_id: s1, is_active: true, roles: [role], must_reset_password: true, created_by_id: adminId, grade: null })
      expect(created.data.role).toBe(role)
      expect(await countOf(t.db, `select count(*)::text as n from users where id = $1::bigint and (ic_hash is not null or ic_masked is not null)`, [created.data.id])).toBe(0)
      expect(await countOf(t.db, `select count(*)::text as n from user_scopes where user_id = $1::bigint`, [created.data.id])).toBe(0)
    }
    // The body password is never bound: only the generated credential logs in.
    expect((await t.agent().post('/api/auth/login').send({ identifier: 'zulaikha@ujian.test', password: 'Penyerang-123' })).status).toBe(401)
    expect((await loginWith(t, 'zulaikha@ujian.test', pupil.credential.password)).csrf).toBeTruthy()
  })

  it('mass assignment on update: role, schoolId, isActive, grade, icNumber are ignored', async () => {
    const id = await insertUser(t.db, { name: 'Murid Ubah', email: 'ubah@ujian.test', roles: ['student'], schoolId: s1, grade: 10 })
    const res = await admin.put(`/admin-sekolah/pelajar/${id}`, { name: 'Murid Ubah 2', email: 'ubah@ujian.test', role: 'admin', roles: ['admin'], schoolId: s2, isActive: false, grade: 3, icNumber: '010101010101', password: 'Penyerang-123' })
    expect(res.status).toBe(200)
    expect(await userRow(t.db, id)).toMatchObject({ name: 'Murid Ubah 2', school_id: s1, is_active: true, grade: 10, roles: ['student'], password_hash: null })
    expect(res.body.data).toMatchObject({ role: 'student', isActive: true, school: { id: s1 } })
  })

  it('a classId from another school is 422 and nothing is enrolled; an own active classroom is enrolled', async () => {
    const foreign = await insertClass(t.db, { name: '4 Luar', schoolId: s2 })
    const own = await insertClass(t.db, { name: '4 Sendiri', schoolId: s1 })
    const enrolments = await countOf(t.db, `select count(*)::text as n from enrolments`)
    const users = await countOf(t.db, `select count(*)::text as n from users`)
    const e = errorOf(await admin.post('/admin-sekolah/pelajar', { name: 'Murid Kelas Luar', email: 'kelasluar@ujian.test', classId: foreign }), 422, 'VALIDATION_ERROR', 'The selected class id is invalid.')
    expect(e.fields).toEqual({ classId: 'The selected class id is invalid.' })
    expect(await countOf(t.db, `select count(*)::text as n from enrolments`)).toBe(enrolments)
    expect(await countOf(t.db, `select count(*)::text as n from users`)).toBe(users)
    expect((await admin.post('/admin-sekolah/pelajar', { name: 'Murid Kelas Sendiri', email: 'kelassendiri@ujian.test', classId: own })).status).toBe(201)
    expect(await countOf(t.db, `select count(*)::text as n from enrolments where classroom_id = $1::bigint`, [own])).toBe(1)
  })

  it('suspended accounts: shown inactive, every write is 404 and nothing changes', async () => {
    const id = await userIdOf(t.db, 'digantung@demo.test')
    const hash = (await userRow(t.db, id))?.password_hash
    errorOf(await admin.put(`/admin-sekolah/pelajar/${id}`, BODY), 404, 'NOT_FOUND')
    errorOf(await admin.post(`/admin-sekolah/pelajar/${id}/reset-password`, BODY), 404, 'NOT_FOUND')
    const susp = await insertUser(t.db, { name: 'Guru Digantung', email: 'gantung@ujian.test', roles: ['teacher'], schoolId: s1, isSuspended: true })
    errorOf(await admin.post(`/admin-sekolah/guru/${susp}/toggle-active`), 404, 'NOT_FOUND')
    expect((await userRow(t.db, id))?.password_hash).toBe(hash)
    expect(await countOf(t.db, `select count(*)::text as n from users where id = $1::bigint and is_suspended and is_active`, [susp])).toBe(1)
  })

  it('credential routes send no-store AND Pragma no-cache on success and on every error answer', async () => {
    const reset = { newPassword: 'abcdefgh1', newPasswordConfirmation: 'abcdefgh1' }
    const inactive = await userIdOf(t.db, 'tidakaktif@demo.test')
    const answers = [
      await admin.post('/admin-sekolah/pelajar', { name: 'Murid Header', email: 'header@ujian.test' }), // 201
      await admin.post('/admin-sekolah/pelajar', { name: 'Al', email: 'bukan' }), // 422
      await admin.post('/admin-sekolah/guru', { name: 'Guru Header', email: 'guruheader@ujian.test' }), // 201
      await admin.post('/admin-sekolah/guru', {}), // 422
      await admin.post(`/admin-sekolah/pelajar/${pupil1}/reset-password`, reset), // 200
      await admin.post(`/admin-sekolah/pelajar/${pupil1}/reset-password`, {}), // 422
      await admin.post(`/admin-sekolah/pelajar/${pupil2}/reset-password`, reset), // 404
      await admin.post(`/admin-sekolah/pelajar/${inactive}/reset-password`, reset), // 403
      await admin.post(`/admin-sekolah/guru/${teacher1}/reset-password`, reset), // 200
      await admin.post(`/admin-sekolah/guru/${teacher2}/reset-password`, reset), // 404
      await admin.get('/admin-sekolah/guru/export.csv'), // 200
      await admin.get('/admin-sekolah/pelajar/export.csv'), // 200
    ]
    expect(answers.map((r) => r.status)).toEqual([201, 422, 201, 422, 200, 422, 404, 403, 200, 404, 200, 200])
    for (const res of answers) expectNoCache(res)
    secrets.push(
      SchoolAdminPupilCreatedResultSchema.parse(answers[0]?.body).credential.password,
      SchoolAdminTeacherCreatedResultSchema.parse(answers[2]?.body).credential.password,
    )
    // The other answers are no-store as well.
    for (const res of [await admin.get('/admin-sekolah/guru'), await admin.get('/admin-sekolah/pelajar'), await admin.get(`/admin-sekolah/pelajar/${pupil2}`), await admin.get('/admin-sekolah/pelajar/form-options')]) {
      expect(res.headers['cache-control']).toBe('no-store')
    }
  })

  it('sessions: a new password (reset or update) revokes the target sessions, never the admin session', async () => {
    const created = SchoolAdminPupilCreatedResultSchema.parse((await admin.post('/admin-sekolah/pelajar', { name: 'Murid Sesi', email: 'sesi@ujian.test' })).body)
    const id = created.data.id
    const pupil = await loginWith(t, 'sesi@ujian.test', created.credential.password)
    const second = await loginWith(t, 'sesi@ujian.test', created.credential.password)
    expect(await liveSessions(t.db, id)).toBe(2)
    expect((await pupil.agent.get('/api/session')).status).not.toBe(401)

    // An update WITHOUT a password does not revoke.
    await admin.put(`/admin-sekolah/pelajar/${id}`, { name: 'Murid Sesi', email: 'sesi@ujian.test' })
    expect(await liveSessions(t.db, id)).toBe(2)

    // A reset revokes every session of the target.
    const reset = await admin.post(`/admin-sekolah/pelajar/${id}/reset-password`, { newPassword: 'Sesi-Baharu-55', newPasswordConfirmation: 'Sesi-Baharu-55' })
    expect(reset.status).toBe(200)
    expect(await liveSessions(t.db, id)).toBe(0)
    expect((await pupil.agent.get('/api/session')).status).toBe(401)
    expect((await second.agent.get('/api/session')).status).toBe(401)
    // The admin session survives; the old credential no longer logs in; the new password does.
    expect((await admin.get('/admin-sekolah/pelajar')).status).toBe(200)
    expect((await t.agent().post('/api/auth/login').send({ identifier: 'sesi@ujian.test', password: created.credential.password })).status).toBe(401)
    const again = await loginWith(t, 'sesi@ujian.test', 'Sesi-Baharu-55')
    expect(await liveSessions(t.db, id)).toBe(1)

    // An update WITH a password revokes too.
    const upd = await admin.put(`/admin-sekolah/pelajar/${id}`, { name: 'Murid Sesi', email: 'sesi@ujian.test', newPassword: 'Sesi-Ketiga-66', newPasswordConfirmation: 'Sesi-Ketiga-66' })
    expect(upd.status).toBe(200)
    expect(await liveSessions(t.db, id)).toBe(0)
    expect((await again.agent.get('/api/session')).status).toBe(401)
  })

  it('sessions: deactivating a teacher revokes their sessions and blocks their login; reactivating does not bring them back', async () => {
    const created = SchoolAdminTeacherCreatedResultSchema.parse((await admin.post('/admin-sekolah/guru', { name: 'Guru Sesi', email: 'gurusesi@ujian.test' })).body)
    const id = created.data.id
    const who = await loginWith(t, 'gurusesi@ujian.test', created.credential.password)
    expect(await liveSessions(t.db, id)).toBe(1)
    expect((await admin.post(`/admin-sekolah/guru/${id}/toggle-active`)).body.data).toEqual({ isActive: false })
    expect(await liveSessions(t.db, id)).toBe(0)
    expect((await who.agent.get('/api/session')).status).toBe(401)
    expect((await t.agent().post('/api/auth/login').send({ identifier: 'gurusesi@ujian.test', password: created.credential.password })).status).not.toBe(200)
    await admin.post(`/admin-sekolah/guru/${id}/toggle-active`)
    expect(await liveSessions(t.db, id)).toBe(0)
  })

  it('two parallel creates with the same e-mail: one 201, one 422 "taken", exactly one account', async () => {
    const send1 = () => admin.post('/admin-sekolah/pelajar', { name: 'Murid Serentak', email: 'serentak@ujian.test' })
    const [x, y] = await Promise.all([send1(), send1()])
    expect([x.status, y.status].sort()).toEqual([201, 422])
    const failed = x.status === 422 ? x : y
    errorOf(failed, 422, 'VALIDATION_ERROR', 'The email has already been taken.')
    expect(await countOf(t.db, `select count(*)::text as n from users where lower(email) = 'serentak@ujian.test'`)).toBe(1)
    expect(await countOf(t.db, `select count(*)::text as n from audit_events where action = 'school_admin.pupil.created' and target_id = (select id::text from users where lower(email) = 'serentak@ujian.test')`)).toBe(1)
  })

  it('hostile input: a non-object body, odd query shapes and SQL text are 422 / harmless, never 500', async () => {
    for (const body of [[], null, 'text']) {
      const res = await admin.post('/admin-sekolah/guru', body)
      expect(res.status, JSON.stringify(body)).toBe(422)
    }
    const hostile = "' OR 1=1 --"
    expect((await admin.get(`/admin-sekolah/guru?search=${encodeURIComponent(hostile)}&page[]=2&is_active[]=1`)).status).toBe(200)
    expect((await admin.get(`/admin-sekolah/pelajar?search=${encodeURIComponent(hostile)}`)).body.data).toEqual([])
    errorOf(await admin.get(`/admin-sekolah/pelajar/${encodeURIComponent("1 OR 1=1")}`), 404, 'NOT_FOUND')
    errorOf(await admin.get('/admin-sekolah/guru/99999999999999999999999'), 404, 'NOT_FOUND')
    const sqlName = (await admin.post('/admin-sekolah/pelajar', { name: "Robert'); DROP TABLE users;--", email: 'bobby@ujian.test' })).status
    expect(sqlName).toBe(201)
    expect(await countOf(t.db, `select count(*)::text as n from users`)).toBeGreaterThan(5)
  })

  it('a pending teacher is neither listed nor exported until verified', async () => {
    await t.db.query(`insert into users (name, email, is_active, school_id, pending_school_id, created_at, updated_at) values ('Guru Belum Sah', 'belumsah@ujian.test', false, null, $1::bigint, now(), now())`, [s1])
    const id = (await t.db.query<{ id: string }>(`select id::text from users where email = 'belumsah@ujian.test'`))[0]?.id as string
    await t.db.query(`insert into user_roles (user_id, role, created_at) values ($1::bigint, 'teacher', now())`, [id])
    const list = JSON.stringify((await admin.get('/admin-sekolah/guru?search=belumsah')).body)
    expect(list).not.toContain('belumsah')
    expect((await admin.get('/admin-sekolah/guru/export.csv')).text).not.toContain('belumsah')
    errorOf(await admin.get(`/admin-sekolah/guru/${id}`), 404, 'NOT_FOUND')
  })

  it('enrolment source of a created pupil is school_admin and the rows are real (not test) data', async () => {
    const c = await insertClass(t.db, { name: '4 Sumber', schoolId: s1 })
    await enrolIn(t.db, c, pupil1)
    const created = SchoolAdminPupilCreatedResultSchema.parse((await admin.post('/admin-sekolah/pelajar', { name: 'Murid Sumber', email: 'sumber@ujian.test', classId: c })).body)
    const row = (await t.db.query<{ source: string; is_test: boolean }>(`select source, is_test from enrolments where student_id = $1::bigint`, [created.data.id]))[0]
    expect(row).toEqual({ source: 'school_admin', is_test: false })
  })

  it('the typed passwords and the credentials are in no response after their own, no audit row and no log line', async () => {
    const typed = 'Taip-Kata-Laluan-42'
    secrets.push(typed)
    const created = SchoolAdminPupilCreatedResultSchema.parse((await admin.post('/admin-sekolah/pelajar', { name: 'Murid Log', email: 'log@ujian.test' })).body)
    secrets.push(created.credential.password)
    await admin.put(`/admin-sekolah/pelajar/${created.data.id}`, { name: 'Murid Log', email: 'log@ujian.test', newPassword: typed, newPasswordConfirmation: typed })
    await admin.post(`/admin-sekolah/pelajar/${created.data.id}/reset-password`, { newPassword: typed, newPasswordConfirmation: typed })
    // A later read never serves a credential.
    const detail = JSON.stringify((await admin.get(`/admin-sekolah/pelajar/${created.data.id}`)).body) + JSON.stringify((await admin.get('/admin-sekolah/pelajar')).body)
    for (const s of secrets) expect(detail).not.toContain(s)

    const all = logs.lines.join('\n')
    expect(logs.lines.length).toBeGreaterThan(0) // the capture really saw the requests
    for (const s of secrets) expect(all).not.toContain(s)

    const audit = JSON.stringify(await t.db.query(`select * from audit_events`))
    for (const s of [...secrets, 'password_hash', '$argon2']) expect(audit).not.toContain(s)
    expect(await countOf(t.db, `select count(*)::text as n from users where password_hash like '%' || $1 || '%'`, [typed])).toBe(0)
  })

  it('audit rows: one per write inside the transaction, full actor facts, ids and flags only (no name, e-mail, phone, IC, password)', async () => {
    const rows = (
      await t.db.query<{ action: string; actor_user_id: string; actor_role: string; scope_level: string; scope_school_id: string; target_type: string; target_id: string; request_id: string | null; ip_hash: string | null; is_test: boolean; detail: unknown }>(
        `select action, actor_user_id::text, actor_role, scope_level, scope_school_id::text, target_type, target_id, request_id, ip_hash, is_test, detail from audit_events where action like 'school_admin.%'`,
      )
    )
    expect(rows.length).toBeGreaterThan(5)
    for (const r of rows) {
      expect(r.actor_role).toBe('school_admin')
      expect(r.actor_user_id).toBeTruthy()
      expect(r.scope_level).toBe('school')
      expect(r.scope_school_id).toBe(s1)
      expect(r.target_type).toMatch(/^(user|school)$/)
      expect(r.target_id).toMatch(/^\d+$/)
      expect(r.request_id).toBeTruthy()
      expect(r.ip_hash).toMatch(/^[0-9a-f]{64}$/) // a keyed hash, never the raw address
      expect(r.is_test).toBe(false)
      const text = JSON.stringify(r.detail)
      for (const p of pii) expect(text).not.toContain(p)
      expect(text).not.toMatch(/@/)
    }
    const everything = JSON.stringify(await t.db.query(`select * from audit_events where action like 'school_admin.%'`))
    for (const p of pii) expect(everything).not.toContain(p)
  })

})

describe('BE-21 people security: 429 with Retry-After per bucket', () => {
  let t: SchoolAdminTestApp
  let admin: PeopleApi
  let pupil: string
  let teacher: string

  beforeAll(async () => {
    t = await bootPeopleApp({
      env: {
        THROTTLE_SCHOOL_ADMIN_CREATE_PER_MINUTE: '2',
        THROTTLE_SCHOOL_ADMIN_RESET_PER_MINUTE: '2',
        THROTTLE_SCHOOL_ADMIN_EXPORT_PER_MINUTE: '2',
        THROTTLE_SCHOOL_ADMIN_WRITE_PER_MINUTE: '2',
        THROTTLE_SCHOOL_ADMIN_READ_PER_MINUTE: '3',
      },
    })
    admin = peopleApiOf(await login(t, SCHOOL_ADMIN))
    pupil = await userIdOf(t.db, STUDENT)
    teacher = await userIdOf(t.db, TEACHER)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  const expect429 = (res: Awaited<ReturnType<PeopleApi['get']>>, pragma: boolean) => {
    const e = errorOf(res, 429, 'RATE_LIMITED')
    expect(e.retryAfter).toBeGreaterThanOrEqual(1)
    expect(res.headers['retry-after']).toBe(String(e.retryAfter))
    expectNoCache(res, pragma)
  }

  it('create: the third create in a minute is 429 with Retry-After, both headers, and creates nothing', async () => {
    expect((await admin.post('/admin-sekolah/pelajar', { name: 'Murid Satu', email: 'satu@ujian.test' })).status).toBe(201)
    expect((await admin.post('/admin-sekolah/guru', { name: 'Guru Dua', email: 'dua@ujian.test' })).status).toBe(201)
    const before = await countOf(t.db, `select count(*)::text as n from users`)
    expect429(await admin.post('/admin-sekolah/pelajar', { name: 'Murid Tiga', email: 'tiga@ujian.test' }), true)
    expect429(await admin.post('/admin-sekolah/guru', { name: 'Guru Tiga', email: 'gurutiga@ujian.test' }), true)
    expect(await countOf(t.db, `select count(*)::text as n from users`)).toBe(before)
  })

  it('reset: the third reset is 429 and the password is not changed', async () => {
    const body = { newPassword: 'abcdefgh1', newPasswordConfirmation: 'abcdefgh1' }
    expect((await admin.post(`/admin-sekolah/pelajar/${pupil}/reset-password`, body)).status).toBe(200)
    expect((await admin.post(`/admin-sekolah/guru/${teacher}/reset-password`, body)).status).toBe(200)
    const hash = (await t.db.query<{ h: string }>(`select password_hash as h from users where id = $1::bigint`, [pupil]))[0]?.h
    expect429(await admin.post(`/admin-sekolah/pelajar/${pupil}/reset-password`, { newPassword: 'zzzzzzzz9', newPasswordConfirmation: 'zzzzzzzz9' }), true)
    expect((await t.db.query<{ h: string }>(`select password_hash as h from users where id = $1::bigint`, [pupil]))[0]?.h).toBe(hash)
  })

  it('write: the third update / toggle in a minute is 429', async () => {
    expect((await admin.put(`/admin-sekolah/pelajar/${pupil}`, { name: 'Murid Demo', email: 'pelajar@demo.test' })).status).toBe(200)
    expect((await admin.post(`/admin-sekolah/guru/${teacher}/toggle-active`)).status).toBe(200)
    expect429(await admin.post(`/admin-sekolah/guru/${teacher}/toggle-active`), false)
    expect429(await admin.put(`/admin-sekolah/pelajar/${pupil}`, { name: 'Murid Demo', email: 'pelajar@demo.test' }), false)
  })

  it('export: the third CSV is 429 with both headers and no extra audit row', async () => {
    expect((await admin.get('/admin-sekolah/guru/export.csv')).status).toBe(200)
    expect((await admin.get('/admin-sekolah/pelajar/export.csv')).status).toBe(200)
    expect429(await admin.get('/admin-sekolah/guru/export.csv'), true)
    expect429(await admin.get('/admin-sekolah/pelajar/export.csv'), true)
    expect(await countOf(t.db, `select count(*)::text as n from audit_events where action like 'school_admin.%.exported'`)).toBe(2)
  })

  it('read: the read bucket is separate and also answers 429', async () => {
    t.clock.advance(61_000) // a new window for every bucket
    for (let i = 0; i < 3; i++) expect((await admin.get('/admin-sekolah/guru')).status).toBe(200)
    expect429(await admin.get('/admin-sekolah/guru'), false)
  })
})
