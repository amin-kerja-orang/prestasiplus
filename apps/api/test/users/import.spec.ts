import { IMPORT_MAX_CHARS, ImportResultSchema, USER_MESSAGES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { csvRecords, isEmail, parseCsvLine, pasteBlocks, planUserImport, textLines, toTitleCase, userImportRecords, withoutHeader } from '../../src/modules/users/import'
import { ADMIN, apiOf, bootUsersApp, fieldsOf, login, schoolIdOf, type Api, type UsersTestApp } from './helpers'

describe('import text and plan (pure, mock BR-14)', () => {
  const taken = new Set(['sedia@ada.my'])
  const exists = (e: string) => taken.has(e.toLowerCase())

  it('splits LF, CRLF and CR lines and drops a BOM; parses quotes', () => {
    expect(textLines('﻿a\r\nb\rc\nd')).toEqual(['a', 'b', 'c', 'd'])
    expect(parseCsvLine(' Ali , ali@x.my ,, pw ')).toEqual(['Ali', 'ali@x.my', '', 'pw'])
    expect(parseCsvLine('"Tan, Ah Kow",a@b.my')).toEqual(['Tan, Ah Kow', 'a@b.my'])
    expect(parseCsvLine('"say ""hi""",x')).toEqual(['say "hi"', 'x'])
  })

  it('csvRecords keeps original line numbers; pasteBlocks numbers by first line; header rule', () => {
    expect(csvRecords('name,email\n\nAli,ali@x.my\r\n   \nSiti,siti@x.my').map((r) => r.line)).toEqual([1, 3, 5])
    expect(pasteBlocks('Ali\nali@x.my\n\n\nSiti\nsiti@x.my\n')).toEqual([
      { line: 1, cells: ['Ali', 'ali@x.my'] },
      { line: 5, cells: ['Siti', 'siti@x.my'] },
    ])
    expect(withoutHeader(csvRecords('Nama,Emel\nAli,ali@x.my'))).toHaveLength(1)
    expect(withoutHeader(csvRecords('Ali,ali@x.my\nSiti,siti@x.my'))).toHaveLength(2)
    expect(isEmail('a@b')).toBe(true)
    expect(isEmail('a b@c.my')).toBe(false)
    expect(toTitleCase('  PELAJAR   DEMO bin sAtU ')).toBe('Pelajar Demo Bin Satu')
  })

  it('plans, skips and fails per line with the original line numbers; extra columns are ignored', () => {
    const text = [
      'Nama,Emel,Telefon,Kata Laluan', // 1 header
      'Ali,ali@x.my,0123456789,rahsia1', // 2 planned (password column ignored)
      '', // 3
      'Siti,SITI@x.my', // 4 planned
      'Dup,sedia@ada.my', // 5 skipped: exists
      'Ali Dua,ALI@x.my', // 6 skipped: repeats line 2
      ',nama@x.my', // 7 failed
      'Bad,bukan-emel', // 8 failed
      'Tel,tel@x.my,012345678901234', // 9 failed
    ].join('\r\n')
    const plan = planUserImport(userImportRecords(text), exists)
    expect(plan.planned).toEqual([
      { line: 2, name: 'Ali', email: 'ali@x.my', phone: '0123456789' },
      { line: 4, name: 'Siti', email: 'SITI@x.my', phone: null },
    ])
    expect(plan.skipped).toBe(2)
    expect(plan.failed).toBe(3)
    expect(plan.errors).toEqual([
      { line: 7, message: 'Nama diperlukan.' },
      { line: 8, message: 'Emel tidak sah.' },
      { line: 9, message: 'Nombor telefon tidak boleh melebihi 14 aksara.' },
    ])
  })

  it('a failed record is not counted as a repeat of a later one; long names fail', () => {
    const plan = planUserImport(userImportRecords('X,dup@x.my,0123456789012345\nY,dup@x.my'), () => false)
    expect(plan.failed).toBe(1)
    expect(plan.planned.map((p) => p.name)).toEqual(['Y'])
    expect(planUserImport(userImportRecords(`${'n'.repeat(256)},a@x.my`), () => false).errors[0]?.message).toBe('Nama tidak boleh melebihi 255 aksara.')
  })

  it('counts data records without the header', () => {
    expect(userImportRecords('')).toHaveLength(0)
    expect(userImportRecords('name,email')).toHaveLength(0)
    expect(userImportRecords('Ali,ali@x.my')).toHaveLength(1)
  })
})

describe('POST /admin/users/bulk-import (AC 6)', () => {
  let t: UsersTestApp
  let admin: Api
  let s1: string

  beforeAll(async () => {
    t = await bootUsersApp({ env: { THROTTLE_ADMIN_WRITE_PER_MINUTE: '100000', THROTTLE_ADMIN_READ_PER_MINUTE: '100000', THROTTLE_IMPORT_PER_HOUR: '100000' } })
    admin = apiOf(await login(t, ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
  })
  afterAll(async () => {
    await t.close()
  })

  const imp = (over: Record<string, unknown>) => admin.post('/admin/users/bulk-import', { role: 'teacher', schoolId: s1, importMode: 'paste', ...over })

  it('E2E: header, an existing e-mail, a failed line; credentials once per created account; job persisted', async () => {
    const text = ['Nama,Emel,Telefon', 'Guru Satu,guru1@import.test,0123456789', 'Guru Dua,GURU2@import.test', 'Ada,pelajar@demo.test', 'Rosak,bukan-emel', ',tanpa@import.test'].join('\n')
    const res = await imp({ pasteContent: text })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.body.status).toBe('Import selesai: 2 pengguna didaftarkan, 1 dilangkau, 2 gagal.')
    const data = ImportResultSchema.parse(res.body.data)
    expect(data.created).toBe(2)
    expect(data.skipped).toBe(1)
    expect(data.failed).toBe(2)
    expect(data.errors).toEqual([
      { line: 5, message: 'Emel tidak sah.' },
      { line: 6, message: 'Nama diperlukan.' },
    ])
    expect(data.credentials.map((c) => [c.line, c.email])).toEqual([[2, 'guru1@import.test'], [3, 'GURU2@import.test']])
    expect(new Set(data.credentials.map((c) => c.generatedPassword)).size).toBe(2)
    // The created accounts hold the role, school and must-change flag, and the generated password logs in.
    const row = (await t.db.query<{ school_id: string; must: boolean; role: string }>(
      `select u.school_id::text, u.must_reset_password must, r.role from users u join user_roles r on r.user_id = u.id where lower(u.email) = 'guru1@import.test'`,
    ))[0]
    expect(row).toEqual({ school_id: s1, must: true, role: 'teacher' })
    const s = await login(t, 'guru1@import.test', { password: data.credentials[0]?.generatedPassword as string })
    expect(s.session.user.email).toBe('guru1@import.test')
    // import_jobs holds the run with per-row failures and no passwords.
    const job = (await t.db.query<{ kind: string; mode: string; total_rows: number; imported_count: number; failed_count: number; failures: unknown; school_id: string }>(
      `select kind, mode, total_rows, imported_count, failed_count, failures, school_id::text from import_jobs`,
    ))[0]
    expect(job).toEqual({
      kind: 'users',
      mode: 'paste',
      total_rows: 5,
      imported_count: 2,
      failed_count: 2,
      failures: [{ row: 5, message: 'Emel tidak sah.' }, { row: 6, message: 'Nama diperlukan.' }],
      school_id: s1,
    })
    expect(JSON.stringify(await t.db.query(`select * from import_jobs`))).not.toContain(data.credentials[0]?.generatedPassword)
  })

  it('a second run with the same file creates nothing (all skipped)', async () => {
    const res = await imp({ pasteContent: 'Guru Satu,guru1@import.test' })
    expect(ImportResultSchema.parse(res.body.data)).toMatchObject({ created: 0, skipped: 1, failed: 0, credentials: [] })
  })

  it('an empty file or header-only text is 422 "Tiada data untuk diimport."', async () => {
    expect(fieldsOf(await imp({ pasteContent: '  \n ' })).pasteContent).toBe(USER_MESSAGES.noData)
    expect(fieldsOf(await imp({ importMode: 'csv' })).csvFile).toBe('Tiada data untuk diimport.')
    expect(fieldsOf(await imp({ importMode: 'csv', csvFile: 'name,email' })).csvFile).toBe('Tiada data untuk diimport.')
    expect(fieldsOf(await imp({ pasteContent: 'name,email' })).pasteContent).toBe('Tiada data untuk diimport.')
  })

  it('422 for a missing or invalid role, mode, school; student and admin are not importable', async () => {
    expect(Object.keys(fieldsOf(await admin.post('/admin/users/bulk-import', {})))).toEqual(expect.arrayContaining(['role', 'importMode']))
    expect(fieldsOf(await imp({ role: 'student', pasteContent: 'A,a@x.my' })).role).toBe('The selected role is invalid.')
    expect(fieldsOf(await imp({ role: 'admin', pasteContent: 'A,a@x.my' })).role).toBe('The selected role is invalid.')
    expect(fieldsOf(await imp({ importMode: 'zip', pasteContent: 'A,a@x.my' })).importMode).toBe('The selected import mode is invalid.')
    expect(fieldsOf(await imp({ schoolId: '999999', pasteContent: 'A,a@x.my' })).schoolId).toBe('The selected school id is invalid.')
    expect(fieldsOf(await admin.post('/admin/users/bulk-import', { role: 'teacher', importMode: 'paste', pasteContent: 'A,a@x.my' })).schoolId).toBe(
      'The school id field is required.',
    )
    // The old default-password field is gone (strict body).
    expect((await imp({ pasteContent: 'A,a@x.my', defaultPassword: 'abcdef' })).status).toBe(422)
  })

  it('a parent import needs no school; a school_admin import needs one', async () => {
    const parent = await admin.post('/admin/users/bulk-import', { role: 'parent', importMode: 'paste', pasteContent: 'Ibu Satu,ibu1@import.test' })
    expect(parent.body.data.created).toBe(1)
    const noSchool = await admin.post('/admin/users/bulk-import', { role: 'school_admin', importMode: 'paste', pasteContent: 'A,a@x.my' })
    expect(fieldsOf(noSchool).schoolId).toBe('The school id field is required.')
    const sa = await imp({ role: 'school_admin', pasteContent: 'Admin Import,adminimport@import.test' })
    expect(sa.body.data.created).toBe(1)
  })

  it('a refused request creates nothing and stores no job', async () => {
    const users = (await t.db.query<{ n: number }>(`select count(*)::int n from users`))[0]?.n
    const jobs = (await t.db.query<{ n: number }>(`select count(*)::int n from import_jobs`))[0]?.n
    await imp({ role: 'student', pasteContent: 'A,zz@x.my' })
    expect((await t.db.query<{ n: number }>(`select count(*)::int n from users`))[0]?.n).toBe(users)
    expect((await t.db.query<{ n: number }>(`select count(*)::int n from import_jobs`))[0]?.n).toBe(jobs)
  })

  it('caps: more than 1000 rows and more than 1 MB are 422 with the pinned copy', async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => `N${i},cap${i}@import.test`).join('\n')
    expect(fieldsOf(await imp({ pasteContent: rows })).pasteContent).toBe('Data import melebihi had 1000 baris.')
    const big = `A,a@x.my\n${'x'.repeat(IMPORT_MAX_CHARS)}`
    expect(fieldsOf(await imp({ pasteContent: big })).pasteContent).toBe('Data import melebihi had 1 MB.')
    expect((await t.db.query(`select 1 from users where email like 'cap%@import.test'`)).length).toBe(0)
  })

  it('accepts exactly 1000 rows (one transaction, hashed before it opens)', async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => `Guru ${i},seribu${i}@import.test`).join('\n')
    const res = await imp({ pasteContent: rows })
    expect(res.status, JSON.stringify(res.body).slice(0, 300)).toBe(200)
    expect(res.body.data.created).toBe(1000)
    expect(res.body.data.credentials).toHaveLength(1000)
  }, 180_000)

  it('reads an uploaded CSV file (multipart); a file over 1 MB is 413', async () => {
    const who = await login(t, ADMIN)
    const res = await who.agent
      .post('/api/admin/users/bulk-import')
      .set('X-CSRF-Token', who.csrf)
      .field('role', 'teacher')
      .field('schoolId', s1)
      .field('importMode', 'csv')
      .attach('csvFile', Buffer.from('Nama,Emel\nGuru Fail,fail@import.test\n'), 'guru.csv')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.created).toBe(1)
    const big = await who.agent
      .post('/api/admin/users/bulk-import')
      .set('X-CSRF-Token', who.csrf)
      .field('role', 'teacher')
      .field('schoolId', s1)
      .field('importMode', 'csv')
      .attach('csvFile', Buffer.from(`A,a@x.my\n${'x'.repeat(IMPORT_MAX_CHARS + 10)}`), 'besar.csv')
    expect(big.body.error).toMatchObject({ code: 'PAYLOAD_TOO_LARGE', message: 'Data import melebihi had 1 MB.' })
    expect(big.status).toBe(413)
  })
})
