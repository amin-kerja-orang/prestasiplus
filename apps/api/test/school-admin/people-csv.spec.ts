import { SCHOOL_ADMIN_USER_CSV_COLUMNS } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { login, SCHOOL_ADMIN, schoolIdOf, STUDENT, TEACHER, userIdOf, type SchoolAdminTestApp } from './helpers'
import { auditRows, bootPeopleApp, enrolIn, expectNoCache, insertClass, insertUser, peopleApiOf, type PeopleApi } from './people-helpers'

/** Minimal RFC 4180 reader (quotes, doubled quotes, CR/LF inside quotes) so the spec checks real cells, not substrings. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i)
    if (quoted) {
      if (ch === '"' && text.charAt(i + 1) === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

const HEADER = SCHOOL_ADMIN_USER_CSV_COLUMNS.join(',')

describe('BE-21 user CSV exports: /admin-sekolah/guru/export.csv and /pelajar/export.csv', () => {
  let t: SchoolAdminTestApp
  let admin: PeopleApi
  let s1: string
  let teacher: string
  let evilPupil: string
  let evilClass: string

  beforeAll(async () => {
    t = await bootPeopleApp()
    admin = peopleApiOf(await login(t, SCHOOL_ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
    teacher = await userIdOf(t.db, TEACHER)
    await t.db.query(`update users set phone = '0198887776', ic_masked = 'xxxxxx-xx-xx99', ic_hash = 'hash-rahsia-ic' where id = $1::bigint`, [teacher])
    // Formula-injection names (fictitious): the exported cell must never start a formula.
    evilPupil = await insertUser(t.db, { name: '=HYPERLINK("http://evil.test","klik")', email: 'evil1@ujian.test', roles: ['student'], schoolId: s1, grade: 10 })
    await insertUser(t.db, { name: '+1+1', email: 'evil2@ujian.test', roles: ['student'], schoolId: s1 })
    await insertUser(t.db, { name: '-2+3', email: 'evil3@ujian.test', roles: ['student'], schoolId: s1 })
    await insertUser(t.db, { name: '@SUM(A1)', email: 'evil4@ujian.test', roles: ['student'], schoolId: s1 })
    await insertUser(t.db, { name: '\tTab Murid', email: 'evil5@ujian.test', roles: ['student'], schoolId: s1 })
    await insertUser(t.db, { name: '\rCR Murid', email: 'evil6@ujian.test', roles: ['student'], schoolId: s1 })
    await insertUser(t.db, { name: 'Murid, "Koma" Uji', email: 'koma@ujian.test', roles: ['student'], schoolId: s1 })
    await insertUser(t.db, { name: 'Murid Baris\nBaru', email: 'baris@ujian.test', roles: ['student'], schoolId: s1 })
    evilClass = await insertClass(t.db, { name: '=SUM(1+1)', schoolId: s1, teacherId: teacher })
    const plain = await insertClass(t.db, { name: '4 Amanah, Bestari', schoolId: s1, teacherId: teacher })
    const inactive = await insertClass(t.db, { name: '4 Lama', schoolId: s1, teacherId: teacher, isActive: false })
    const pupil = await userIdOf(t.db, STUDENT)
    await enrolIn(t.db, evilClass, evilPupil)
    await enrolIn(t.db, plain, pupil)
    await enrolIn(t.db, inactive, pupil)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('teachers: headers, BOM, contract header, LF only, trailing newline, role guru, kelas empty, no phone and no IC', async () => {
    const res = await admin.get('/admin-sekolah/guru/export.csv')
    expect(res.status).toBe(200)
    expectNoCache(res)
    expect(res.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/)
    expect(res.headers['content-disposition']).toBe('attachment; filename="users-guru-2026-10-19.csv"')
    const text = res.text
    expect(text.charCodeAt(0)).toBe(0xfeff)
    expect(text.slice(1).split('\n')[0]).toBe(HEADER)
    expect(text.endsWith('\n')).toBe(true)
    expect(text).not.toContain('\r')
    const rows = parseCsv(text.slice(1))
    expect(rows[0]).toEqual([...SCHOOL_ADMIN_USER_CSV_COLUMNS])
    expect(rows).toHaveLength(2) // the header and guru@demo.test (guruadmin is a school admin too: not listed)
    expect(rows[1]?.slice(0, 7)).toEqual([teacher, 'Guru Demo', 'guru@demo.test', 'guru', 'SMK Demo Satu', '', '1'])
    for (const secret of ['0198887776', 'xxxxxx-xx-xx99', 'hash-rahsia-ic']) expect(text).not.toContain(secret)
    expect(rows[1]?.[7]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+08:00$/)
  })

  it('pupils: kelas lists the ACTIVE classes joined by ", " (quoted), id ascending, 1 / 0 for is_active', async () => {
    const res = await admin.get('/admin-sekolah/pelajar/export.csv')
    expect(res.status).toBe(200)
    expectNoCache(res)
    expect(res.headers['content-disposition']).toBe('attachment; filename="users-pelajar-2026-10-19.csv"')
    expect(res.text).not.toContain('\r\n')
    const rows = parseCsv(res.text.slice(1))
    expect(rows[0]).toEqual([...SCHOOL_ADMIN_USER_CSV_COLUMNS])
    const ids = rows.slice(1).map((r) => BigInt(r[0] ?? '0'))
    expect(ids).toEqual([...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
    const demo = rows.find((r) => r[2] === 'pelajar@demo.test')
    expect(demo?.slice(3, 7)).toEqual(['pelajar', 'SMK Demo Satu', '4 Amanah, Bestari', '1'])
    expect(rows.find((r) => r[2] === 'tidakaktif@demo.test')?.[6]).toBe('0')
    expect(rows.find((r) => r[2] === 'digantung@demo.test')?.[6]).toBe('0') // suspended = inactive
    // The raw line really quotes the cell with the comma.
    expect(res.text).toContain(',"4 Amanah, Bestari",1,')
    expect(res.text).not.toContain('4 Lama')
  })

  it('formula injection: a pupil named =HYPERLINK(...) and every = + - @ TAB CR cell is prefixed with an apostrophe', async () => {
    const res = await admin.get('/admin-sekolah/pelajar/export.csv')
    const rows = parseCsv(res.text.slice(1)).slice(1)
    const nameOf = (email: string) => rows.find((r) => r[2] === email)?.[1]
    expect(nameOf('evil1@ujian.test')).toBe(`'=HYPERLINK("http://evil.test","klik")`)
    expect(nameOf('evil2@ujian.test')).toBe("'+1+1")
    expect(nameOf('evil3@ujian.test')).toBe("'-2+3")
    expect(nameOf('evil4@ujian.test')).toBe("'@SUM(A1)")
    expect(nameOf('evil5@ujian.test')).toBe("'\tTab Murid")
    expect(nameOf('evil6@ujian.test')).toBe("'\rCR Murid")
    // The class cell is neutralised too.
    expect(rows.find((r) => r[2] === 'evil1@ujian.test')?.[5]).toBe("'=SUM(1+1)")
    // No cell of the whole file starts with a formula character.
    for (const row of rows) for (const cell of row) expect(cell, JSON.stringify(row)).not.toMatch(/^[=+\-@\t\r]/)
    // The raw dangerous text only ever appears after the apostrophe.
    expect(res.text).toContain(`"'=HYPERLINK(""http://evil.test"",""klik"")"`)
    expect(res.text).not.toMatch(/(^|[,\n])=HYPERLINK/)
  })

  it('RFC 4180: commas, quotes and line breaks are quoted; the rows read back unchanged', async () => {
    const rows = parseCsv((await admin.get('/admin-sekolah/pelajar/export.csv')).text.slice(1)).slice(1)
    expect(rows.find((r) => r[2] === 'koma@ujian.test')?.[1]).toBe('Murid, "Koma" Uji')
    expect(rows.find((r) => r[2] === 'baris@ujian.test')?.[1]).toBe('Murid Baris\nBaru')
    for (const row of rows) expect(row).toHaveLength(SCHOOL_ADMIN_USER_CSV_COLUMNS.length)
  })

  it('the same filters as the list (is_active, search), no paging: more than 25 rows come out', async () => {
    for (let i = 0; i < 30; i++) await insertUser(t.db, { name: `Murid Pukal ${String(i)}`, email: `pukalcsv${String(i)}@ujian.test`, roles: ['student'], schoolId: s1 })
    const all = parseCsv((await admin.get('/admin-sekolah/pelajar/export.csv')).text.slice(1)).slice(1)
    expect(all.length).toBeGreaterThan(30)
    const list = (await admin.get('/admin-sekolah/pelajar')).body
    expect(all.length).toBe(list.meta.counts.total)
    const inactive = parseCsv((await admin.get('/admin-sekolah/pelajar/export.csv?is_active=0')).text.slice(1)).slice(1)
    expect(inactive.map((r) => r[2]).sort()).toEqual(['digantung@demo.test', 'tidakaktif@demo.test'])
    const found = parseCsv((await admin.get('/admin-sekolah/pelajar/export.csv?search=PUKALCSV1')).text.slice(1)).slice(1)
    expect(found.length).toBe(11) // pukalcsv1 and pukalcsv10..19
    expect(found.every((r) => (r[2] ?? '').startsWith('pukalcsv1'))).toBe(true)
    const none = (await admin.get('/admin-sekolah/pelajar/export.csv?search=%25')).text
    expect(none).toBe(`﻿${HEADER}\n`)
  })

  it('every export writes one audit row: file name, row count and flags, never the content, the search text or a name', async () => {
    const before = (await auditRows(t.db, 'school_admin.pupil.exported')).length
    const res = await admin.get('/admin-sekolah/pelajar/export.csv?search=Murid&is_active=1')
    const rows = parseCsv(res.text.slice(1)).slice(1)
    const audit = await auditRows(t.db, 'school_admin.pupil.exported')
    expect(audit).toHaveLength(before + 1)
    expect(audit[0]).toMatchObject({ actor_role: 'school_admin', scope_school_id: s1, target_type: 'school', target_id: s1, is_test: false })
    expect(audit[0]?.detail).toEqual(expect.objectContaining({ fileName: 'users-pelajar-2026-10-19.csv', rowCount: rows.length, isActiveFilter: 1, searched: true }))
    const text = JSON.stringify(audit[0]?.detail)
    for (const leak of ['HYPERLINK', 'evil', '@', 'Murid Pukal', '"Murid"']) expect(text).not.toContain(leak)
    // The teacher export has its own action.
    await admin.get('/admin-sekolah/guru/export.csv')
    expect((await auditRows(t.db, 'school_admin.teacher.exported'))[0]?.detail).toMatchObject({ fileName: 'users-guru-2026-10-19.csv', rowCount: 1, isActiveFilter: null, searched: false })
  })

  it('a formula-looking e-mail is neutralised in the e-mail cell as well', async () => {
    await insertUser(t.db, { name: 'Murid Emel Aneh', email: '+aneh@ujian.test', roles: ['student'], schoolId: s1 })
    const rows = parseCsv((await admin.get('/admin-sekolah/pelajar/export.csv')).text.slice(1)).slice(1)
    expect(rows.find((r) => r[1] === 'Murid Emel Aneh')?.[2]).toBe("'+aneh@ujian.test")
  })

  it('the file name carries the Malaysia date of the request', async () => {
    t.clock.advance(15 * 3600 * 1000) // 2026-10-20 00:00 MYT
    const later = peopleApiOf(await login(t, SCHOOL_ADMIN)) // a fresh session at the new time
    const res = await later.get('/admin-sekolah/guru/export.csv')
    expect(res.headers['content-disposition']).toBe('attachment; filename="users-guru-2026-10-20.csv"')
  })
})
