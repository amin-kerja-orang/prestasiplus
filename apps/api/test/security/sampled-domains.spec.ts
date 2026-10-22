import { ErrorBodySchema } from '@pp/contract'
import type { Response } from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { makePng } from '../files/fixtures'
import { bootSecurityApp, call, count, loginAs, type Login, type SecurityApp } from './helpers'

/**
 * BE-33 AC1 b to e on one sampled route per domain, against the whole API on a seeded database:
 *
 *  b. a cross-user or cross-school id is 404 (not 403, not 200)
 *  c. an extra, unknown field in a body is 422 VALIDATION_ERROR (the strict schemas of BE-NFR-05)
 *  d. an oversized body is 413 PAYLOAD_TOO_LARGE (100 kb on a normal route, 2200 kb on the import route)
 *  e. SQL-injection strings in the search filters of users, schools, questions and articles give a
 *     normal 200 envelope and change no row count (parameterised queries)
 */

function expectError(res: Response, status: number, code: string): void {
  expect(res.status, JSON.stringify(res.body)).toBe(status)
  expect(ErrorBodySchema.parse(res.body).error.code).toBe(code)
}

describe('BE-33 AC1 b to e: sampled routes of every domain', () => {
  let t: SecurityApp
  let admin: Login
  let schoolAdmin: Login
  let teacher: Login
  let teacher2: Login
  let student: Login
  let student2: Login
  const ip = (n: number) => `10.50.0.${String(n)}`
  let school1: string
  let school2: string
  let subjectId: string
  let levelId: string

  beforeAll(async () => {
    t = await bootSecurityApp()
    admin = await loginAs(t, 'admin@demo.test', { ip: ip(1) })
    schoolAdmin = await loginAs(t, 'adminsekolah@demo.test', { ip: ip(2) })
    teacher = await loginAs(t, 'guru@demo.test', { ip: ip(3) })
    // The second teacher is the dual-role account, switched to its teacher role.
    const dual = await loginAs(t, 'guruadmin@demo.test', { ip: ip(4) })
    if (dual.session.active.role !== 'teacher') {
      const sw = await dual.agent.post('/api/session/role').set('X-CSRF-Token', dual.csrf).send({ role: 'teacher' })
      expect(sw.status).toBe(200)
      dual.csrf = sw.body.data.csrf
    }
    teacher2 = dual
    student = await loginAs(t, 'pelajar@demo.test', { ip: ip(5) })
    student2 = await loginAs(t, 'pelajar2@demo.test', { ip: ip(6) })
    school1 = (await t.db.query<{ id: string }>(`select id::text from schools where code = 'DEMO001'`))[0]!.id
    school2 = (await t.db.query<{ id: string }>(`select id::text from schools where code = 'DEMO002'`))[0]!.id
    const [seed] = await t.db.query<{ subject_id: string; education_level_id: string }>(
      `select v.subject_id::text, v.education_level_id::text from question_versions v where v.number_label = 'SEED-MCQ-MATH-T4'`,
    )
    subjectId = seed!.subject_id
    levelId = seed!.education_level_id
  })
  afterAll(async () => {
    await t.close()
  })

  // --- b. cross-user / cross-school ids are 404 ------------------------------------------------

  describe('b. a cross-user or cross-school id is 404 (never 403, never 200)', () => {
    it('users: a school admin reads a user of another school', async () => {
      const other = (await t.db.query<{ id: string }>(`select id::text from users where school_id = $1::bigint limit 1`, [school2]))[0]!.id
      expectError(await call(schoolAdmin, 'get', `/admin/users/${other}`), 404, 'NOT_FOUND')
      expectError(await call(schoolAdmin, 'put', `/admin/users/${other}`, { roles: ['student'], name: 'Nama Baharu', grade: 4 }), 404, 'NOT_FOUND')
      expectError(await call(schoolAdmin, 'post', `/admin/users/${other}/toggle-active`), 404, 'NOT_FOUND')
      expectError(await call(schoolAdmin, 'delete', `/admin/users/${other}`), 404, 'NOT_FOUND')
      // Sanity: the same id is reachable by the admin of all schools.
      expect((await call(admin, 'get', `/admin/users/${other}`)).status).toBe(200)
    })

    it('school admin people: a school admin reads and resets a pupil of another school', async () => {
      const pupil = (await t.db.query<{ id: string }>(`select id::text from users where school_id = $1::bigint limit 1`, [school2]))[0]!.id
      expectError(await call(schoolAdmin, 'get', `/admin-sekolah/pelajar/${pupil}`), 404, 'NOT_FOUND')
      expectError(await call(schoolAdmin, 'post', `/admin-sekolah/pelajar/${pupil}/reset-password`, {}), 404, 'NOT_FOUND')
    })

    it('files: another user cannot read or delete a file', async () => {
      const up = await student.agent
        .post('/api/files?purpose=avatar')
        .set('X-CSRF-Token', student.csrf)
        .attach('file', makePng(), { filename: 'gambar.png', contentType: 'image/png' })
      expect(up.status).toBe(201)
      const id = up.body.data.id as string
      expectError(await call(student2, 'get', `/files/${id}`), 404, 'NOT_FOUND')
      expectError(await call(student2, 'delete', `/files/${id}`), 404, 'NOT_FOUND')
      expect((await call(student, 'get', `/files/${id}`)).status).toBe(200)
    })

    it('notifications: another user cannot read or delete an inbox item', async () => {
      const owner = student.session.user.id
      const [row] = await t.db.query<{ id: string }>(
        `insert into notifications (user_id, type, title, body) values ($1::bigint, 'system', 'Ujian', 'Ujian') returning id::text`,
        [owner],
      )
      expectError(await call(student2, 'post', `/me/notifications/${row!.id}/read`), 404, 'NOT_FOUND')
      expectError(await call(student2, 'delete', `/me/notifications/${row!.id}`), 404, 'NOT_FOUND')
      expect((await call(student, 'post', `/me/notifications/${row!.id}/read`)).status).toBe(200)
    })

    it('classes: another teacher cannot read the QR data of a class', async () => {
      const created = await call(teacher, 'post', '/guru/classes', { name: 'Kelas Keselamatan', subjectId, educationLevel: 'tingkatan-4' })
      expect(created.status, JSON.stringify(created.body)).toBe(201)
      const id = created.body.data.id as string
      expectError(await call(teacher2, 'get', `/guru/classes/${id}/qr-data`), 404, 'NOT_FOUND')
      expect((await call(teacher, 'get', `/guru/classes/${id}/qr-data`)).status).toBe(200)
    })

    it('questions: another teacher cannot read, edit or delete a Guru question', async () => {
      const created = await call(teacher, 'post', '/guru/questions', {
        questionType: 'mcq',
        difficultyLevel: 3,
        questionText: 'Soalan keselamatan: yang manakah benar?',
        options: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
        correctAnswer: 1,
        subjectId,
        educationLevelId: levelId,
      })
      expect(created.status, JSON.stringify(created.body)).toBe(201)
      const id = created.body.data.id as string
      expectError(await call(teacher2, 'get', `/guru/questions/${id}`), 404, 'NOT_FOUND')
      expectError(await call(teacher2, 'put', `/guru/questions/${id}`, { questionText: 'Teks pengganti yang sah.' }), 404, 'NOT_FOUND')
      expectError(await call(teacher2, 'delete', `/guru/questions/${id}`), 404, 'NOT_FOUND')
      expect((await call(teacher, 'get', `/guru/questions/${id}`)).status).toBe(200)
    })

    it('practice: another student cannot submit or check a practice session', async () => {
      // A session owned by the first student (written directly: the seed has too few questions to start one).
      const [row] = await t.db.query<{ id: string }>(
        `insert into practice_sessions (user_id, mode, subject_id, question_count, started_at) values ($1::bigint, 'random', $2::bigint, 5, now()) returning id::text`,
        [student.session.user.id, subjectId],
      )
      const id = row!.id
      expectError(await call(student2, 'post', `/practice/sessions/${id}/submit`, { timeSpent: 10 }), 404, 'NOT_FOUND')
      expectError(await call(student2, 'post', `/practice/sessions/${id}/check-answer`, { questionId: '1', selectedOptionId: 0 }), 404, 'NOT_FOUND')
    })
  })

  // --- c. mass assignment: an unknown field is 422 ---------------------------------------------

  describe('c. an extra field in the body is 422 VALIDATION_ERROR', () => {
    const cases: [string, () => Promise<Response>, () => Promise<number>, string][] = [
      [
        'users: POST /admin/users with isAdmin',
        () => call(admin, 'post', '/admin/users', { roles: ['teacher'], name: 'Guru Lebih', email: 'guru.lebih@ujian.test', schoolId: school1, isAdmin: true }),
        () => count(t.db, 'users'),
        'isAdmin',
      ],
      [
        'schools: POST /admin/schools with ownerId',
        () => call(admin, 'post', '/admin/schools', { name: 'SMK Lebih', code: 'LEBIH01', type: 'SMK', state: 'Selangor', district: 'Gombak', city: 'Gombak', isActive: true, ownerId: '1' }),
        () => count(t.db, 'schools'),
        'ownerId',
      ],
      [
        'classes: POST /guru/classes with ownerId',
        () => call(teacher, 'post', '/guru/classes', { name: 'Kelas Lebih', subjectId, educationLevel: 'tingkatan-4', ownerId: '1' }),
        () => count(t.db, 'classrooms'),
        'ownerId',
      ],
      [
        // #100 (BE-12): the start body is strict; the forged owner is refused before any session row is written.
        'practice: POST /practice/sessions with ownerId',
        () => call(student, 'post', '/practice/sessions', { mode: 'random', subjectCode: 'MATH', count: 5, ownerId: '1' }),
        () => count(t.db, 'practice_sessions'),
        'ownerId',
      ],
      [
        'subscriptions: POST /admin/school-subscriptions with status',
        () => call(admin, 'post', '/admin/school-subscriptions', { schoolId: school2, packageTier: 'full', schoolPackageId: '1', studentQuota: 10, status: 'active' }),
        () => count(t.db, 'school_subscriptions'),
        'status',
      ],
      // STRICT-1 (#97, #98, #99; LEAD decision 22 Oct): these five bodies were the AC1c known gap (it.fails) until now.
      [
        'school admin people (BE-21): POST /admin-sekolah/guru with isAdmin',
        () => call(schoolAdmin, 'post', '/admin-sekolah/guru', { name: 'Guru Jurang', email: 'guru.jurang@ujian.test', isAdmin: true }),
        () => count(t.db, 'users'),
        'isAdmin',
      ],
      [
        'articles (BE-24): POST /admin/articles with views',
        () => call(admin, 'post', '/admin/articles', { title: 'Artikel jurang', content: '<p>Isi</p>', category: 'UMUM', isPublished: false, views: 5 }),
        () => count(t.db, 'articles'),
        'views',
      ],
      [
        'support tickets (BE-24): POST /tiket with status',
        () => call(student, 'post', '/tiket', { subject: 'Jurang', body: 'Ujian medan lebih.', status: 'closed' }),
        () => count(t.db, 'support_tickets'),
        'status',
      ],
      [
        'notifications (BE-06): POST /me/notifications/bulk-read with userId',
        async () => {
          const [own] = await t.db.query<{ id: string }>(
            `insert into notifications (user_id, type, title, body) values ($1::bigint, 'system', 'Ujian', 'Ujian') returning id::text`,
            [student.session.user.id],
          )
          return call(student, 'post', '/me/notifications/bulk-read', { ids: [own!.id], userId: '1' })
        },
        // Rows marked read: the refused call marks none, not even the caller's own unread item.
        async () => Number((await t.db.query<{ n: string }>(`select count(*)::text as n from notifications where read_at is not null`))[0]!.n),
        'userId',
      ],
      [
        // A body that is valid apart from the unknown key: the refusal is the key itself, and no account is written.
        'registration (BE-06): POST /auth/register with isAdmin',
        () =>
          t
            .http()
            .post('/api/auth/register')
            .set('X-Forwarded-For', ip(90))
            .send({ name: 'Ibu Jurang', email: 'ibu.jurang@ujian.test', role: 'parent', password: 'Rahsia123', passwordConfirmation: 'Rahsia123', isAdmin: true }),
        () => count(t.db, 'users'),
        'isAdmin',
      ],
    ]
    it.each(cases)('%s', async (_name, send, rows, field) => {
      const before = await rows()
      const res = await send()
      expectError(res, 422, 'VALIDATION_ERROR')
      // The refusal names the unknown field itself (not some other validation problem).
      expect(JSON.stringify(ErrorBodySchema.parse(res.body).error.fields ?? {}), JSON.stringify(res.body)).toContain(field)
      expect(await rows()).toBe(before)
    })

    // STRICT-1: the routes that used to ignore an unknown field now refuse it; the forged value still has no effect.
    describe('the former ignore-routes refuse the forged field and it has no effect', () => {
      it('school admin people: POST /admin-sekolah/guru with role=admin is 422 and creates no account', async () => {
        const res = await call(schoolAdmin, 'post', '/admin-sekolah/guru', { name: 'Guru Lebih Dua', email: 'guru.lebih2@ujian.test', role: 'admin', roles: ['admin'], isActive: false })
        expectError(res, 422, 'VALIDATION_ERROR')
        expect(Object.keys(ErrorBodySchema.parse(res.body).error.fields ?? {}).sort()).toEqual(['isActive', 'role', 'roles'])
        expect(await t.db.query(`select 1 from users where email = 'guru.lebih2@ujian.test'`)).toHaveLength(0)
      })

      it('articles: POST /admin/articles with viewCount and views is 422 naming both and writes no article', async () => {
        const before = await count(t.db, 'articles')
        const res = await call(admin, 'post', '/admin/articles', { title: 'Artikel lebih', content: '<p>Isi</p>', category: 'UMUM', isPublished: true, viewCount: 99999, views: 99999 })
        expectError(res, 422, 'VALIDATION_ERROR')
        expect(Object.keys(ErrorBodySchema.parse(res.body).error.fields ?? {}).sort()).toEqual(['viewCount', 'views'])
        expect(await count(t.db, 'articles')).toBe(before)
      })

      it('notifications: POST /me/notifications/bulk-read with a forged userId is 422 and touches no item', async () => {
        const [foreign] = await t.db.query<{ id: string }>(
          `insert into notifications (user_id, type, title, body) values ($1::bigint, 'system', 'Ujian', 'Ujian') returning id::text`,
          [student2.session.user.id],
        )
        const res = await call(student, 'post', '/me/notifications/bulk-read', { ids: [foreign!.id], userId: student2.session.user.id })
        expectError(res, 422, 'VALIDATION_ERROR')
        expect(ErrorBodySchema.parse(res.body).error.fields).toHaveProperty('userId')
        const rows = await t.db.query<{ read_at: Date | null }>(`select read_at from notifications where id = $1::bigint`, [foreign!.id])
        expect(rows[0]?.read_at).toBeNull()
      })

      it('registration: an unknown key is listed next to the missing fields, not instead of them', async () => {
        const res = await t.http().post('/api/auth/register').set('X-Forwarded-For', ip(91)).send({ isAdmin: true })
        expectError(res, 422, 'VALIDATION_ERROR')
        const fields = ErrorBodySchema.parse(res.body).error.fields ?? {}
        expect(fields).toHaveProperty('isAdmin', 'The isAdmin field is not allowed.')
        expect(fields).toHaveProperty('name')
        expect(fields).toHaveProperty('email')
      })

      it('the same bodies without the unknown key are still accepted', async () => {
        expect((await call(schoolAdmin, 'post', '/admin-sekolah/guru', { name: 'Guru Sah', email: 'guru.sah@ujian.test', phone: '0123456789' })).status).toBe(201)
        expect((await call(admin, 'post', '/admin/articles', { title: 'Artikel sah', content: '<p>Isi</p>', category: 'UMUM', isPublished: false })).status).toBe(201)
        expect((await call(student, 'post', '/tiket', { subject: 'Sah', body: 'Tiket sah.' })).status).toBe(201)
        expect((await call(student, 'post', '/me/notifications/bulk-read', { ids: ['999999999'] })).status).toBe(200)
        const reg = await t.http().post('/api/auth/register').set('X-Forwarded-For', ip(92)).send({ name: 'Ibu Sah', email: 'ibu.sah@ujian.test', role: 'parent', password: 'Rahsia123', passwordConfirmation: 'Rahsia123' })
        expect(reg.status, JSON.stringify(reg.body)).toBe(201)
      })
    })
  })

  // --- d. oversized bodies are 413 -------------------------------------------------------------

  describe('d. an oversized body is 413 PAYLOAD_TOO_LARGE', () => {
    it('a normal route refuses a JSON body over 100 kb, signed in or not', async () => {
      const big = { subject: 'x', body: 'y'.repeat(150_000) }
      expectError(await call(student, 'post', '/tiket', big), 413, 'PAYLOAD_TOO_LARGE')
      expectError(await t.http().post('/api/auth/login').send({ identifier: 'x'.repeat(150_000), password: 'x' }), 413, 'PAYLOAD_TOO_LARGE')
      expectError(await call(admin, 'post', '/admin/schools', { name: 'z'.repeat(150_000) }), 413, 'PAYLOAD_TOO_LARGE')
    })

    it('the user import route accepts 1 MB and refuses a JSON body over 2200 kb', async () => {
      const ok = await call(admin, 'post', '/admin/users/bulk-import', { role: 'teacher', schoolId: school1, importMode: 'paste', pasteContent: `${'x'.repeat(1_000_000)},a@b.my` })
      expect(ok.status, JSON.stringify(ok.body).slice(0, 200)).toBe(200)
      const big = await call(admin, 'post', '/admin/users/bulk-import', { role: 'teacher', schoolId: school1, importMode: 'paste', pasteContent: 'x'.repeat(2_400_000) })
      expectError(big, 413, 'PAYLOAD_TOO_LARGE')
      // Over the import limit the route is no more generous than a normal one for another route.
      expectError(await call(admin, 'post', '/admin/users', { name: 'x'.repeat(2_400_000) }), 413, 'PAYLOAD_TOO_LARGE')
    })
  })

  // --- e. SQL injection in the search filters --------------------------------------------------

  describe('e. SQL-injection strings in search filters change nothing and give a normal envelope', () => {
    const PAYLOADS = [`' OR 1=1 --`, `'; DROP TABLE users; --`, `%' UNION SELECT id, email, password_hash FROM users --`, '\\', `" OR ""="`, `') OR ('1'='1`]
    const TABLES = ['users', 'schools', 'questions', 'articles'] as const

    const endpoints: [string, (q: string) => () => Promise<Response>][] = [
      ['users: GET /admin/users?search=', (q) => () => call(admin, 'get', `/admin/users?search=${encodeURIComponent(q)}`)],
      ['school admin users: GET /admin-sekolah/pelajar?search=', (q) => () => call(schoolAdmin, 'get', `/admin-sekolah/pelajar?search=${encodeURIComponent(q)}`)],
      ['schools: GET /admin/schools?search=', (q) => () => call(admin, 'get', `/admin/schools?search=${encodeURIComponent(q)}`)],
      ['schools: GET /schools/search?q= (public)', (q) => () => t.http().get(`/api/schools/search?q=${encodeURIComponent(q)}`)],
      ['questions: GET /questions?search=', (q) => () => call(admin, 'get', `/questions?search=${encodeURIComponent(q)}`)],
      ['articles: GET /articles?search= (public)', (q) => () => t.http().get(`/api/articles?search=${encodeURIComponent(q)}`)],
      ['articles: GET /admin/articles?search=', (q) => () => call(admin, 'get', `/admin/articles?search=${encodeURIComponent(q)}`)],
    ]

    it.each(endpoints)('%s', async (_name, build) => {
      const before = Object.fromEntries(await Promise.all(TABLES.map(async (tb) => [tb, await count(t.db, tb)] as const)))
      for (const payload of PAYLOADS) {
        const res = await build(payload)()
        expect(res.status, `${payload} -> ${JSON.stringify(res.body).slice(0, 200)}`).toBe(200)
        expect(res.body.error).toBeUndefined()
        expect(Array.isArray(res.body.data), `data of ${payload}`).toBe(true)
        // A literal string that matches nothing: the injection did not turn the filter into "everything".
        expect(res.body.data, `rows for ${payload}`).toHaveLength(0)
      }
      const after = Object.fromEntries(await Promise.all(TABLES.map(async (tb) => [tb, await count(t.db, tb)] as const)))
      expect(after).toEqual(before)
    })

    it('the tables are intact after every payload and a normal search still finds rows', async () => {
      const users = await call(admin, 'get', `/admin/users?search=${encodeURIComponent('Murid Demo')}`)
      expect(users.status).toBe(200)
      expect(users.body.data.length).toBeGreaterThan(0)
      const schools = await t.http().get(`/api/schools/search?q=${encodeURIComponent('Demo')}`)
      expect(schools.status).toBe(200)
      expect(schools.body.data.length).toBeGreaterThan(0)
      expect(await count(t.db, 'users')).toBeGreaterThan(0)
    })
  })

})
