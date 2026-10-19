import { ErrorBodySchema, QuotaSchema, STUDENT_IMPORT_MESSAGES, StudentImportResultSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { planStudentImport, studentRecords } from '../../src/modules/subscriptions/student-import.plan'
import {
  ADMIN,
  addStudents,
  addSubscription,
  apiOf,
  bootSubApp,
  expectError,
  fieldsOf,
  login,
  schoolIdOf,
  type Api,
  type LoggedIn,
  type SubTestApp,
} from './sub-helpers'

describe('student import text and plan (pure, mock BR-15)', () => {
  const taken = new Set(['sedia@moe-dl.edu.my'])
  const exists = (e: string) => taken.has(e.toLowerCase())

  it('csv: header dropped, Title Case, extra columns, per-line errors with original line numbers', () => {
    const text = [
      'Nama,Emel,Kata Laluan,IC', // 1 header
      'ALI BIN ABU,ali@moe-dl.edu.my,rahsia1,070101-01-0101', // 2 planned
      '', // 3
      'Siti,SITI@moe-dl.edu.my,rahsia2', // 4 planned
      'Dup,sedia@moe-dl.edu.my,x', // 5 skipped: exists
      'Ali Dua,ALI@moe-dl.edu.my,x', // 6 skipped: repeats line 2
      ',nama@moe-dl.edu.my,x', // 7 failed
      'Bad,bukan-emel,x', // 8 failed
      'Tiada,tiada@moe-dl.edu.my,', // 9 failed
      'Panjang,panjang@moe-dl.edu.my,x,123456789012345', // 10 failed
    ].join('\r\n')
    const plan = planStudentImport(studentRecords(text, 'csv'), exists)
    expect(plan.planned.map((p) => [p.line, p.name, p.email, p.ic])).toEqual([
      [2, 'Ali Bin Abu', 'ali@moe-dl.edu.my', '070101-01-0101'],
      [4, 'Siti', 'SITI@moe-dl.edu.my', null],
    ])
    expect(plan.skipped).toBe(2)
    expect(plan.failed).toBe(4)
    expect(plan.errors).toEqual([
      { line: 7, message: STUDENT_IMPORT_MESSAGES.noName },
      { line: 8, message: STUDENT_IMPORT_MESSAGES.badDelimaEmail },
      { line: 9, message: STUDENT_IMPORT_MESSAGES.noDelimaPassword },
      { line: 10, message: STUDENT_IMPORT_MESSAGES.icLong },
    ])
    expect(plan.errors[1]?.message).toBe('Emel DELIMa tidak sah.')
    expect(plan.errors[2]?.message).toBe('Kata laluan DELIMa diperlukan.')
    expect(plan.errors[3]?.message).toBe('Nombor IC tidak boleh melebihi 14 aksara.')
  })

  it('paste: blocks of 3 to 4 lines separated by blank lines, numbered by their first line', () => {
    const text = 'Ali\nali@moe-dl.edu.my\nkata1\n\n\nSiti\nsiti@moe-dl.edu.my\nkata2\n070101-01-0101\n'
    const plan = planStudentImport(studentRecords(text, 'paste'), () => false)
    expect(plan.planned.map((p) => [p.line, p.name, p.password, p.ic])).toEqual([
      [1, 'Ali', 'kata1', null],
      [6, 'Siti', 'kata2', '070101-01-0101'],
    ])
  })

  it('counts data records without the header; a long name fails', () => {
    expect(studentRecords('', 'csv')).toHaveLength(0)
    expect(studentRecords('name,email', 'csv')).toHaveLength(0)
    expect(planStudentImport(studentRecords(`${'n'.repeat(256)},a@x.my,p`, 'csv'), () => false).errors[0]?.message).toBe('Nama tidak boleh melebihi 255 aksara.')
  })
})

describe('school quota and student import (AC 2)', () => {
  let t: SubTestApp
  let who: LoggedIn
  let admin: Api
  let s1: string
  let s2: string
  let s3: string

  beforeAll(async () => {
    t = await bootSubApp()
    who = await login(t, ADMIN)
    admin = apiOf(who)
    s1 = await schoolIdOf(t.db, 'DEMO001') // 5 students (one inactive, one suspended)
    s2 = await schoolIdOf(t.db, 'DEMO002') // 1 student
    s3 = await schoolIdOf(t.db, 'DEMO003')
  })
  afterAll(async () => {
    await t.close()
  })

  const quota = async (id: string) => QuotaSchema.parse((await admin.get(`/admin/schools/${id}/quota`)).body.data)
  const imp = (over: Record<string, unknown> = {}) =>
    admin.post('/admin/students/import', { schoolId: s3, classLevel: 'T4', importMode: 'paste', pasteContent: block('Pelajar Satu', 'satu'), ...over })
  const block = (name: string, local: string, password = 'katalaluan123', ic = '') =>
    `${name}\n${local}@moe-dl.edu.my\n${password}${ic ? `\n${ic}` : ''}`
  const count = async (id: string) =>
    Number((await t.db.query<{ n: string }>(`select count(*)::text n from users u join user_roles r on r.user_id = u.id and r.role = 'student' where u.school_id = $1`, [id]))[0]?.n)

  describe('GET /admin/schools/:id/quota', () => {
    it('is hasSubscription false without a granting subscription (none, cancelled, expired)', async () => {
      expect(await quota(s3)).toEqual({ hasSubscription: false })
      await addSubscription(t.db, { schoolId: s3, status: 'cancelled', quota: 10 })
      await addSubscription(t.db, { schoolId: s3, status: 'expired', quota: 10 })
      expect(await quota(s3)).toEqual({ hasSubscription: false })
    })

    it('quota of the latest active subscription by starts_on then id; used counts active and inactive students', async () => {
      await addSubscription(t.db, { schoolId: s1, quota: 3, starts: '2026-01-01' })
      await addSubscription(t.db, { schoolId: s1, quota: 400, starts: '2026-06-01' })
      const later = await addSubscription(t.db, { schoolId: s1, quota: 9, starts: '2026-03-01', status: 'cancelled' })
      expect(later).toBeTruthy()
      // Latest ACTIVE start wins (2026-06-01); the cancelled row never grants.
      expect(await quota(s1)).toEqual({ hasSubscription: true, quota: 400, used: 5, remaining: 395 })
      // The same start day: the higher id wins.
      await addSubscription(t.db, { schoolId: s1, quota: 6, starts: '2026-06-01' })
      expect(await quota(s1)).toEqual({ hasSubscription: true, quota: 6, used: 5, remaining: 1 })
    })

    it('a grace subscription grants the quota; remaining is never negative', async () => {
      await addSubscription(t.db, { schoolId: s2, quota: 1, status: 'grace' })
      expect(await quota(s2)).toEqual({ hasSubscription: true, quota: 1, used: 1, remaining: 0 })
      await addStudents(t.db, s2, 2)
      expect(await quota(s2)).toEqual({ hasSubscription: true, quota: 1, used: 3, remaining: 0 })
    })

    it('404 for an unknown or malformed school', async () => {
      expectError(await admin.get('/admin/schools/999999/quota'), 'NOT_FOUND')
      expectError(await admin.get('/admin/schools/abc/quota'), 'NOT_FOUND')
    })
  })

  describe('POST /admin/students/import refusals', () => {
    it('a school with no active subscription is refused with the exact message on schoolId; nothing is created', async () => {
      const school = (await t.db.query<{ id: string }>(`insert into schools (name, code) values ('SK Tanpa', 'NOSUB1') returning id::text`))[0]?.id as string
      const res = await imp({ schoolId: school })
      expect(res.status).toBe(422)
      expect(ErrorBodySchema.parse(res.body).error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Sekolah ini tiada langganan aktif. Import pelajar tidak dibenarkan.',
        fields: { schoolId: 'Sekolah ini tiada langganan aktif. Import pelajar tidak dibenarkan.' },
      })
      expect(await count(school)).toBe(0)
    })

    it('an import that exceeds the remaining quota is refused as a whole: "Kuota tidak mencukupi."', async () => {
      const school = (await t.db.query<{ id: string }>(`insert into schools (name, code) values ('SK Penuh', 'FULL01') returning id::text`))[0]?.id as string
      await addStudents(t.db, school, 2)
      await addSubscription(t.db, { schoolId: school, quota: 3 })
      const two = `${block('Satu', 'q1')}\n\n${block('Dua', 'q2')}`
      const res = await imp({ schoolId: school, pasteContent: two })
      expect(res.status).toBe(422)
      expect(fieldsOf(res).schoolId).toBe('Kuota tidak mencukupi.')
      expect(await count(school)).toBe(2)
      // Exactly the remaining quota is accepted.
      expect((await imp({ schoolId: school, pasteContent: block('Satu', 'q1') })).status).toBe(200)
      expect(await count(school)).toBe(3)
      // Skipped duplicates do not count against the quota: nothing new, nothing refused.
      const again = await imp({ schoolId: school, pasteContent: block('Satu', 'q1') })
      expect(again.status).toBe(200)
      expect(again.body.data).toMatchObject({ created: 0, skipped: 1 })
    })

    it('an empty text is "Tiada data untuk diimport." on the field of the mode', async () => {
      await addSubscription(t.db, { schoolId: s3, quota: 1000 })
      expect(fieldsOf(await imp({ pasteContent: '  \n\n' })).pasteContent).toBe('Tiada data untuk diimport.')
      expect(fieldsOf(await imp({ importMode: 'csv', csvFile: 'Nama,Emel,Kata Laluan\n' })).csvFile).toBe('Tiada data untuk diimport.')
      expect(fieldsOf(await imp({ importMode: 'csv', csvFile: null })).csvFile).toBe('Tiada data untuk diimport.')
    })

    it('reports every field error together with the mock English templates', async () => {
      const res = await admin.post('/admin/students/import', { schoolId: '99999', classLevel: 'X9', importMode: 'zip' })
      expect(fieldsOf(res)).toEqual({
        schoolId: 'The selected school id is invalid.',
        classLevel: 'The selected class level is invalid.',
        importMode: 'The selected import mode is invalid.',
      })
      expect(fieldsOf(await admin.post('/admin/students/import', {}))).toMatchObject({
        schoolId: 'The school id field is required.',
        classLevel: 'The class level field is required.',
        importMode: 'The import mode field is required.',
      })
    })

    it('rejects unknown keys (strict body)', async () => {
      expect(fieldsOf(await imp({ role: 'admin' })).role).toBe('The role field is not allowed.')
    })

    it('413 PAYLOAD_TOO_LARGE for more than 1000 rows', async () => {
      const rows = Array.from({ length: 1001 }, (_v, i) => `N${String(i)},m${String(i)}@moe-dl.edu.my,p`).join('\n')
      const res = await imp({ importMode: 'csv', csvFile: rows })
      expect(res.status).toBe(413)
      expect(ErrorBodySchema.parse(res.body).error).toMatchObject({ code: 'PAYLOAD_TOO_LARGE', message: 'Fail import melebihi had yang dibenarkan.' })
    })

    it('413 for a multipart file over 1 MB', async () => {
      const big = Buffer.alloc(1_100_000, 'a')
      const res = await who.agent
        .post('/api/admin/students/import')
        .set('X-CSRF-Token', who.csrf)
        .field('schoolId', s3)
        .field('classLevel', 'T4')
        .field('importMode', 'csv')
        .attach('csvFile', big, 'besar.csv')
      expect(res.status).toBe(413)
      expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE')
    })

    it('accepts a JSON import of about 1 MB (large-JSON parser on this path)', async () => {
      const school = (await t.db.query<{ id: string }>(`insert into schools (name, code) values ('SK Besar', 'BESAR1') returning id::text`))[0]?.id as string
      await addSubscription(t.db, { schoolId: school, quota: 5 })
      const pasteContent = `${block('Besar', 'besar.1')}${'\n'.repeat(450_000)}`
      expect(Buffer.byteLength(JSON.stringify({ pasteContent }))).toBeGreaterThan(900_000)
      const res = await imp({ schoolId: school, pasteContent })
      expect(res.status, JSON.stringify(res.body).slice(0, 200)).toBe(200)
      expect(res.body.data).toMatchObject({ created: 1 })
    })

    it('413 for a JSON text over 1 MB (bytes), even before other checks', async () => {
      const res = await imp({ importMode: 'paste', pasteContent: 'a'.repeat(1_000_001) })
      expect(res.status).toBe(413)
    })
  })

  describe('POST /admin/students/import success', () => {
    it('imports a pasted block and a CSV: Title Case, DELIMa id, hashed password, masked IC, flagged for password change', async () => {
      const school = (await t.db.query<{ id: string }>(`insert into schools (name, code) values ('SK Impor', 'IMPOR1') returning id::text`))[0]?.id as string
      await addSubscription(t.db, { schoolId: school, quota: 50 })
      const text = ['Nama,Emel,Kata Laluan,IC', 'ALI BIN ABU,ali.abu@moe-dl.edu.my,Rahsia-Ali-1,070101-01-0101', 'Siti,siti@moe-dl.edu.my,Rahsia-Siti-2', 'Dup,pelajar@demo.test,x', 'Rosak,bukan-emel,x'].join('\n')
      const res = await imp({ schoolId: school, importMode: 'csv', csvFile: text, classLevel: 'T5' })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      expect(res.body.status).toBe('Import selesai: 2 pelajar didaftarkan, 1 dilangkau.')
      const data = StudentImportResultSchema.parse(res.body.data)
      expect(data).toEqual({ created: 2, skipped: 1, failed: 1, errors: [{ line: 5, message: 'Emel DELIMa tidak sah.' }] })
      expect(JSON.stringify(res.body)).not.toContain('Rahsia')

      const rows = await t.db.query<{ name: string; email: string; id_delima: string; grade: number; must: boolean; ic_hash: string | null; ic_masked: string | null; hash: string; is_active: boolean }>(
        `select name, email, id_delima, grade, must_reset_password must, ic_hash, ic_masked, password_hash hash, is_active from users where school_id = $1 order by id`,
        [school],
      )
      expect(rows.map((r) => [r.name, r.email, r.id_delima, r.grade, r.must, r.is_active])).toEqual([
        ['Ali Bin Abu', 'ali.abu@moe-dl.edu.my', 'ali.abu@moe-dl.edu.my', 11, true, true],
        ['Siti', 'siti@moe-dl.edu.my', 'siti@moe-dl.edu.my', 11, true, true],
      ])
      expect(rows[0]?.ic_masked).toBe('xxxxxx-xx-xx01')
      expect(rows[0]?.ic_hash).toMatch(/^[0-9a-f]{64}$/)
      expect(rows[0]?.ic_hash).not.toContain('070101')
      expect(rows[1]?.ic_hash).toBeNull()
      expect(rows[0]?.hash.startsWith('$argon2id$')).toBe(true)
      expect(rows[0]?.hash).not.toContain('Rahsia')
      const roles = await t.db.query<{ role: string }>(`select r.role from user_roles r join users u on u.id = r.user_id where u.school_id = $1`, [school])
      expect(roles.map((r) => r.role)).toEqual(['student', 'student'])
      // The DELIMa password (a pupil's own) logs in.
      const ok = await t.agent().post('/api/auth/login').send({ identifier: 'ali.abu@moe-dl.edu.my', password: 'Rahsia-Ali-1', remember: false })
      expect(ok.status, JSON.stringify(ok.body)).toBe(200)

      // import_jobs: one row, failures with line and message only, no password or IC.
      const jobs = await t.db.query<{ kind: string; mode: string; total_rows: number; imported_count: number; failed_count: number; failures: unknown; school_id: string }>(
        `select kind, mode, total_rows, imported_count, failed_count, failures, school_id::text from import_jobs where school_id = $1`,
        [school],
      )
      expect(jobs).toEqual([{ kind: 'students', mode: 'csv', total_rows: 4, imported_count: 2, failed_count: 1, failures: [{ row: 5, message: 'Emel DELIMa tidak sah.' }], school_id: school }])
      const audit = await t.db.query<{ action: string; detail: unknown }>(`select action, detail from audit_events where action = 'students.imported' and scope_school_id = $1`, [school])
      expect(audit).toHaveLength(1)
      expect(JSON.stringify(audit[0]?.detail)).not.toMatch(/Rahsia|070101|ali\.abu/)
    })

    it('accepts multipart/form-data with the file in csvFile', async () => {
      const school = (await t.db.query<{ id: string }>(`insert into schools (name, code) values ('SK Fail', 'FAIL01') returning id::text`))[0]?.id as string
      await addSubscription(t.db, { schoolId: school, quota: 5 })
      const res = await who.agent
        .post('/api/admin/students/import')
        .set('X-CSRF-Token', who.csrf)
        .field('schoolId', school)
        .field('classLevel', 'D3')
        .field('importMode', 'csv')
        .attach('csvFile', Buffer.from('Nama,Emel,Kata Laluan\nAmin,amin@moe-dl.edu.my,kata123\n'), 'murid.csv')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data).toMatchObject({ created: 1, skipped: 0, failed: 0 })
      expect((await t.db.query<{ grade: number }>(`select grade from users where school_id = $1`, [school]))[0]?.grade).toBe(3)
    })

    it('two parallel imports cannot overshoot the quota: one wins, the other is refused (lock)', async () => {
      const school = (await t.db.query<{ id: string }>(`insert into schools (name, code) values ('SK Lumba', 'LUMBA1') returning id::text`))[0]?.id as string
      await addSubscription(t.db, { schoolId: school, quota: 1 })
      const [a, b] = await Promise.all([
        imp({ schoolId: school, pasteContent: block('A', 'lumba.a') }),
        imp({ schoolId: school, pasteContent: block('B', 'lumba.b') }),
      ])
      expect([a.status, b.status].sort()).toEqual([200, 422])
      expect(await count(school)).toBe(1)
      const refused = a.status === 422 ? a : b
      expect(fieldsOf(refused).schoolId).toBe('Kuota tidak mencukupi.')
    })

    it('a failed import rolls back everything (no students, no job, no audit)', async () => {
      const school = (await t.db.query<{ id: string }>(`insert into schools (name, code) values ('SK Batal', 'BATAL1') returning id::text`))[0]?.id as string
      await addSubscription(t.db, { schoolId: school, quota: 1 })
      await imp({ schoolId: school, pasteContent: `${block('A', 'batal.a')}\n\n${block('B', 'batal.b')}` })
      expect(await count(school)).toBe(0)
      expect(await t.db.query(`select 1 from import_jobs where school_id = $1`, [school])).toHaveLength(0)
      expect(await t.db.query(`select 1 from audit_events where scope_school_id = $1`, [school])).toHaveLength(0)
    })
  })
})

describe('student import rate limit (bulk account creation, D57a)', () => {
  let t: SubTestApp
  beforeAll(async () => {
    t = await bootSubApp({ env: { THROTTLE_IMPORT_PER_HOUR: '2' } })
  })
  afterAll(async () => {
    await t.close()
  })

  it('answers 429 after the hourly ceiling', async () => {
    const admin = apiOf(await login(t, ADMIN))
    for (let i = 0; i < 2; i++) expect((await admin.post('/admin/students/import', {})).status).toBe(422)
    const res = await admin.post('/admin/students/import', {})
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMITED')
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
  })
})
