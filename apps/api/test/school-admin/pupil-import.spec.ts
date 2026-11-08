import { SchoolAdminPupilImportResultSchema, schoolPupilsImportedText } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { schoolPackagesSeed } from '../../prisma/seed/core/school-packages'
import { addSubscription } from '../subscriptions/sub-helpers'
import { ADMIN, login, SCHOOL_ADMIN, schoolIdOf, STUDENT, TEACHER, userIdOf, type LoggedIn, type SchoolAdminTestApp } from './helpers'
import { auditRows, bootPeopleApp, countOf, errorOf, expectNoCache, insertClass, userRow } from './people-helpers'

const ACTION = 'school_admin.pupil.imported'
const PATH = '/api/admin-sekolah/pelajar/import'

/** S6-T09 (API-AS-06, R1-AS-51): Import Pelajar of the school admin. DB spec. All names and e-mails are fictitious. */
describe('S6-T09 pupil import: POST /admin-sekolah/pelajar/import', () => {
  let t: SchoolAdminTestApp
  let who: LoggedIn
  let s1: string
  let s2: string
  let teacher: string
  let clsAmanah: string
  let clsForeign: string
  let seq = 0

  /** A fresh unique e-mail. */
  const mail = (): string => `murid.${String(++seq)}@contoh.test`
  const csv = (rows: string[], header = 'nama,email,kelas'): string => [header, ...rows].join('\n')
  const post = (text: string | Buffer, opts: { query?: string; level?: string; name?: string; as?: LoggedIn } = {}) => {
    const w = opts.as ?? who
    let req = w.agent.post(`${PATH}${opts.query ?? ''}`).set('X-CSRF-Token', w.csrf)
    if (opts.level !== undefined) req = req.field('level', opts.level)
    return req.attach('csvFile', typeof text === 'string' ? Buffer.from(text) : text, opts.name ?? 'pelajar.csv')
  }
  const studentsOf = (schoolId: string) => countOf(t.db, `select count(*)::text n from users u join user_roles r on r.user_id = u.id and r.role = 'student' where u.school_id = $1::bigint`, [schoolId])
  /** Exactly `remaining` free seats: the school's old subscriptions are cancelled and one new one is inserted. */
  const seats = async (remaining: number): Promise<void> => {
    await t.db.query(`update school_subscriptions set status = 'cancelled' where school_id = $1::bigint`, [s1])
    await addSubscription(t.db, { schoolId: s1, quota: (await studentsOf(s1)) + remaining })
  }
  const jobs = () => countOf(t.db, `select count(*)::text n from import_jobs where kind = 'students'`)

  beforeAll(async () => {
    t = await bootPeopleApp()
    await runSeeds([schoolPackagesSeed], { prisma: t.db.prisma })
    who = await login(t, SCHOOL_ADMIN)
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
    teacher = await userIdOf(t.db, TEACHER)
    clsAmanah = await insertClass(t.db, { name: '4 Amanah', schoolId: s1, teacherId: teacher })
    clsForeign = await insertClass(t.db, { name: '4 Luar', schoolId: s2 })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('dryRun previews the first 10 rows, validates the rest and creates nothing', async () => {
    await seats(50)
    const rows = Array.from({ length: 12 }, (_v, i) => `Murid ${String(i + 1)},${mail()},`)
    rows[3] = `Murid 4,bukan-emel,`
    const before = await studentsOf(s1)
    const res = await post(csv(rows), { query: '?dryRun=true', level: 'T4' })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expectNoCache(res, false)
    const data = SchoolAdminPupilImportResultSchema.parse(res.body.data)
    expect(data).toMatchObject({ dryRun: true, rows: 12, created: 0, skipped: 0 })
    expect(data.preview).toHaveLength(10)
    expect(data.preview?.[0]).toMatchObject({ row: 2, name: 'Murid 1', className: null })
    expect(data.errors).toEqual([{ row: 5, message: 'Format e-mel tidak sah.' }])
    expect(await studentsOf(s1)).toBe(before)
    expect(await auditRows(t.db, ACTION)).toHaveLength(0)
  })

  it('imports the valid rows as PENDING pupils, enrols the named class, and never returns a password', async () => {
    await seats(50)
    const [e1, e2] = [mail(), mail()]
    const res = await post(csv([`ALI BIN ABU,${e1},4 amanah`, `Siti,${e2},`, `Rosak,tak-sah,`, `Tanpa Emel,,`]), { level: 'T4' })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const data = SchoolAdminPupilImportResultSchema.parse(res.body.data)
    expect(data).toMatchObject({ dryRun: false, rows: 4, created: 2, skipped: 0 })
    expect(data.errors).toEqual([
      { row: 4, message: 'Format e-mel tidak sah.' },
      { row: 5, message: 'Format e-mel tidak sah.' },
    ])
    expect(data.preview).toBeUndefined()
    expect(schoolPupilsImportedText(data.created, data.errors.length)).toBe('2 pelajar berjaya diimport, 2 baris gagal.')
    expect(JSON.stringify(res.body)).not.toMatch(/password|passwordHash|kata laluan/i)

    const ali = (await t.db.query<{ id: string }>(`select id::text from users where email = $1`, [e1]))[0]?.id as string
    expect(await userRow(t.db, ali)).toMatchObject({ name: 'Ali Bin Abu', school_id: s1, is_active: false, grade: 10, roles: ['student'], must_reset_password: false })
    expect((await userRow(t.db, ali))?.password_hash).toMatch(/^\$argon2id\$/)
    expect(await countOf(t.db, `select count(*)::text n from enrolments where classroom_id = $1::bigint and student_id = $2::bigint and status = 'active' and source = 'school_admin'`, [clsAmanah, ali])).toBe(1)
    const siti = (await t.db.query<{ id: string }>(`select id::text from users where email = $1`, [e2]))[0]?.id as string
    expect(await countOf(t.db, `select count(*)::text n from enrolments where student_id = $1::bigint`, [siti])).toBe(0)

    // The audit row and the job carry counts and ids only.
    const audit = (await auditRows(t.db, ACTION))[0]
    expect(audit).toMatchObject({ target_type: 'import_job', scope_school_id: s1 })
    expect(audit?.detail).toMatchObject({ rows: 4, created: 2, skipped: 0, failed: 2, level: 'T4', enrolled: 1 })
    expect(JSON.stringify(audit?.detail)).not.toMatch(/@|Ali|Siti/)
    expect(await jobs()).toBeGreaterThan(0)
  })

  it('skips an e-mail that already exists: counted in skipped AND listed as a failed row; the same e-mail twice in the file fails the later row', async () => {
    await seats(50)
    const dup = mail()
    const res = await post(csv([`Pelajar Lama,pelajar@demo.test,`, `Baharu Satu,${dup},`, `Baharu Dua,${dup.toUpperCase()},`]), { level: 'T4' })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ rows: 3, created: 1, skipped: 1 })
    expect(res.body.data.errors).toEqual([
      { row: 2, message: 'E-mel sudah wujud (dilangkau).' },
      { row: 4, message: 'E-mel berulang dalam fail.' },
    ])
    // The existing account is untouched.
    expect(await countOf(t.db, `select count(*)::text n from users where email = 'pelajar@demo.test' and is_active`)).toBe(1)
  })

  it('refuses the WHOLE file over the remaining seats (pending pupils count), creating nothing', async () => {
    await seats(2)
    const before = await studentsOf(s1)
    const jobsBefore = await jobs()
    const res = await post(csv([`A Satu,${mail()},`, `A Dua,${mail()},`, `A Tiga,${mail()},`]), { level: 'T4' })
    errorOf(res, 409, 'QUOTA_FULL', 'Kuota penuh! Sila tingkatkan kuota dahulu.')
    expect(await studentsOf(s1)).toBe(before)
    expect(await jobs()).toBe(jobsBefore)
    // dryRun refuses the same way; two rows fit exactly.
    errorOf(await post(csv([`A Satu,${mail()},`, `A Dua,${mail()},`, `A Tiga,${mail()},`]), { query: '?dryRun=true', level: 'T4' }), 409, 'QUOTA_FULL')
    const ok = await post(csv([`B Satu,${mail()},`, `B Dua,${mail()},`]), { level: 'T4' })
    expect(ok.status).toBe(200)
    expect(ok.body.data.created).toBe(2)
    // The seats are now full: the pending pupils just created count against the quota.
    errorOf(await post(csv([`C Satu,${mail()},`]), { level: 'T4' }), 409, 'QUOTA_FULL')
  })

  it('refuses a school without an active subscription', async () => {
    await t.db.query(`update school_subscriptions set status = 'cancelled' where school_id = $1::bigint`, [s1])
    const before = await studentsOf(s1)
    errorOf(await post(csv([`D Satu,${mail()},`]), { level: 'T4' }), 409, 'NO_SUBSCRIPTION', 'Sekolah ini tiada langganan aktif. Import pelajar tidak dibenarkan.')
    expect(await studentsOf(s1)).toBe(before)
  })

  it('refuses a file of 1001 data rows with "Fail melebihi 1000 baris." and accepts 1000 rows at the row check', async () => {
    await seats(5000)
    const rows = Array.from({ length: 1001 }, (_v, i) => `Murid ${String(i)},m${String(i)}.banyak@contoh.test,`)
    const before = await studentsOf(s1)
    errorOf(await post(csv(rows), { level: 'T4' }), 413, 'PAYLOAD_TOO_LARGE', 'Fail melebihi 1000 baris.')
    expect(await studentsOf(s1)).toBe(before)
    const dry = await post(csv(rows.slice(0, 1000)), { query: '?dryRun=true', level: 'T4' })
    expect(dry.status).toBe(200)
    expect(dry.body.data.rows).toBe(1000)
  })

  it('refuses a file over 2 MB (2,097,152 bytes) and accepts one just under it', async () => {
    await seats(50)
    const header = 'nama,email,kelas\n'
    errorOf(await post(Buffer.alloc(2_097_153, 'a')), 413, 'PAYLOAD_TOO_LARGE', 'Fail atau data terlalu besar. Saiz maksimum ialah 2 MB.')
    const big = Buffer.concat([Buffer.from(`${header}Muat Besar,${mail()},\n`), Buffer.alloc(2_097_152 - 100, 'a')])
    const ok = await post(big, { query: '?dryRun=true', level: 'T4' })
    expect(ok.status, JSON.stringify(ok.body).slice(0, 200)).toBe(200)
  })

  it('maps kelas to a class of THIS school only (case-insensitive); another school class is ignored', async () => {
    await seats(50)
    const [own, foreign, none] = [mail(), mail(), mail()]
    const res = await post(csv([`Murid Sendiri,${own},4 AMANAH`, `Murid Luar,${foreign},4 Luar`, `Murid Tiada,${none},`]))
    // No level: the rows without a class of this school fail with "Kelas tidak dijumpai.".
    expect(res.body.data).toMatchObject({ created: 1 })
    expect(res.body.data.errors).toEqual([
      { row: 3, message: 'Kelas tidak dijumpai.' },
      { row: 4, message: 'Kelas tidak dijumpai.' },
    ])
    const withLevel = await post(csv([`Murid Luar,${foreign},4 Luar`]), { level: 'T3' })
    expect(withLevel.body.data).toMatchObject({ created: 1, errors: [] })
    const foreignId = (await t.db.query<{ id: string }>(`select id::text from users where email = $1`, [foreign]))[0]?.id as string
    expect(await countOf(t.db, `select count(*)::text n from enrolments where classroom_id = $1::bigint`, [clsForeign])).toBe(0)
    expect(await userRow(t.db, foreignId)).toMatchObject({ school_id: s1, grade: 9, is_active: false })
  })

  it('reads a semicolon header, drops a BOM and needs the nama column', async () => {
    await seats(50)
    const ok = await post(`﻿Email;Nama;Kelas\n${mail()};Murid Koma Bertitik;\n`, { level: 'T2', query: '?dryRun=true' })
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
    expect(ok.body.data.preview[0]).toMatchObject({ name: 'Murid Koma Bertitik', className: null })
    const bad = await post('email,kelas\nx@contoh.test,\n', { level: 'T2' })
    errorOf(bad, 422, 'VALIDATION_ERROR')
    expect(bad.body.error.fields.csvFile).toBe('Lajur wajib tiada: nama. Gunakan templat yang disediakan.')
    const empty = await post('nama,email,kelas\n', { level: 'T2' })
    expect(empty.body.error.fields.csvFile).toBe('Tiada data untuk diimport.')
  })

  it('validates the request: wrong file type 415, no file 422, unknown level 422', async () => {
    await seats(50)
    const wrongType = await post('nama,email\nA,a@contoh.test', { name: 'pelajar.xlsx' })
    errorOf(wrongType, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Jenis fail tidak disokong. Format dibenarkan: CSV, TXT.')
    const txt = await post(csv([`Fail Txt,${mail()},`]), { name: 'pelajar.txt', level: 'T1', query: '?dryRun=true' })
    expect(txt.status).toBe(200)
    const none = await who.agent.post(PATH).set('X-CSRF-Token', who.csrf).field('level', 'T1')
    expect(none.status).toBe(422)
    expect(none.body.error.fields.csvFile).toBe('Sila pilih fail.')
    const level = await post(csv([`Aras Salah,${mail()},`]), { level: 'D3' })
    expect(level.status).toBe(422)
    expect(level.body.error.fields.level).toBe('The selected level is invalid.')
  })

  it('takes the school from the session: a schoolId in the body is ignored', async () => {
    await seats(50)
    const email = mail()
    const res = await who.agent.post(PATH).set('X-CSRF-Token', who.csrf).field('level', 'T4').field('schoolId', s2).attach('csvFile', Buffer.from(csv([`Sesi Sahaja,${email},`])), 'p.csv')
    expect(res.status).toBe(200)
    expect((await t.db.query<{ school_id: string }>(`select school_id::text from users where email = $1`, [email]))[0]?.school_id).toBe(s1)
  })

  it('answers 403 to every role except school_admin (the Admin Pusat included) and 401 to a guest', async () => {
    for (const identifier of [TEACHER, STUDENT, ADMIN]) {
      const as = await login(t, identifier)
      const res = await post(csv([`Tidak Dibenarkan,${mail()},`]), { as, level: 'T4' })
      expect(res.status, identifier).toBe(403)
    }
    const guest = await t.http().post(PATH).attach('csvFile', Buffer.from(csv([])), 'p.csv')
    expect(guest.status).toBe(401)
  })
})
