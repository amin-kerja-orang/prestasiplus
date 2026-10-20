import { AMARAN_CSV_COLUMNS } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, login, SCHOOL_ADMIN, schoolIdOf, TEACHER, type SchoolAdminTestApp } from './helpers'
import { auditRows, bootPeopleApp, enrolIn, errorOf, expectNoCache, insertClass, insertSchoolAdmin, insertUser, peopleApiOf, type PeopleApi } from './people-helpers'
import { addSession } from './reports-fixtures'

const ACTION = 'school_admin.amaran.exported'
const HEADER = AMARAN_CSV_COLUMNS.join(',')

/** Minimal RFC 4180 reader (CRLF line ends) so the spec checks real cells, not substrings. */
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
    } else if (ch === '\r' && text.charAt(i + 1) === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      i++
    } else cell += ch
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

/** BE-21 Part C: the Amaran school CSV. DB spec (Testcontainers). All data is fictitious. */
describe('BE-21 Amaran CSV: GET /amaran/export/school/:id', () => {
  let t: SchoolAdminTestApp
  let schoolAdmin: PeopleApi
  let admin: PeopleApi
  let teacher: PeopleApi
  let s1: string
  let s2: string
  let evilId: string

  beforeAll(async () => {
    t = await bootPeopleApp()
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
    schoolAdmin = peopleApiOf(await login(t, SCHOOL_ADMIN))
    admin = peopleApiOf(await login(t, ADMIN))
    teacher = peopleApiOf(await login(t, TEACHER))
    // Formula-injection names (fictitious), personal data that must stay out, and an accent in a normal name.
    evilId = await insertUser(t.db, { name: '=HYPERLINK("http://evil.test","klik")', email: 'evil1@ujian.test', roles: ['student'], schoolId: s1, grade: 10, phone: '0187776665' })
    await insertUser(t.db, { name: '+1+1', email: 'evil2@ujian.test', roles: ['student'], schoolId: s1, grade: 10 })
    await insertUser(t.db, { name: '-2+3', email: 'evil3@ujian.test', roles: ['student'], schoolId: s1, grade: 10 })
    await insertUser(t.db, { name: '@SUM(A1)', email: 'evil4@ujian.test', roles: ['student'], schoolId: s1, grade: 10 })
    await insertUser(t.db, { name: '\tTab Murid', email: 'evil5@ujian.test', roles: ['student'], schoolId: s1, grade: 10 })
    await insertUser(t.db, { name: 'Murid, "Koma" Uji', email: 'koma@ujian.test', roles: ['student'], schoolId: s1, grade: 10 })
    await insertUser(t.db, { name: 'Murid Sekolah Dua', email: 'dua@ujian.test', roles: ['student'], schoolId: s2, grade: 10 })
    await t.db.query(`update users set ic_masked = 'xxxxxx-xx-xx99', ic_hash = 'hash-rahsia-ic' where id = $1::bigint`, [evilId])
    const cls = await insertClass(t.db, { name: '=SUM(1+1)', schoolId: s1, teacherId: null })
    await enrolIn(t.db, cls, evilId)
    await addSession(t.db, evilId, { mode: 'chapter', questions: 10, correct: 7, completedAt: '2026-10-17T10:00:00+08:00' })
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  it('a school admin gets the CSV: BOM, CRLF with a trailing CRLF, header, MYT file name, headers no-store and Pragma', async () => {
    const res = await schoolAdmin.get(`/amaran/export/school/${s1}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/)
    // The fixed clock is 2026-10-19 09:00 +08:00.
    expect(res.headers['content-disposition']).toBe(`attachment; filename="amaran-sekolah-${s1}-20261019.csv"`)
    expectNoCache(res, true)
    const text = res.text
    expect(text.charCodeAt(0)).toBe(0xfeff)
    expect(text.endsWith('\r\n')).toBe(true)
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    const rows = parseCsv(text.slice(1))
    expect(rows[0]?.join(',')).toBe(HEADER)
    for (const r of rows.slice(1)) expect(r).toHaveLength(8)
    expect(rows.slice(1).map((r) => r[0])).toEqual(rows.slice(1).map((_, i) => String(i + 1)))
  })

  it('MYT date: at 16:30 UTC (00:30 MYT) the file name already carries the next Malaysia day', async () => {
    t.clock.set('2026-10-19T16:30:00Z')
    try {
      const res = await schoolAdmin.get(`/amaran/export/school/${s1}`)
      expect(res.headers['content-disposition']).toContain(`-${s1}-20261020.csv`)
    } finally {
      t.clock.set('2026-10-19T09:00:00+08:00')
    }
  })

  it('CSV injection: names and class labels starting with = + - @ TAB are prefixed with an apostrophe', async () => {
    const rows = parseCsv((await schoolAdmin.get(`/amaran/export/school/${s1}`)).text.slice(1)).slice(1)
    const names = rows.map((r) => r[1])
    expect(names).toContain(`'=HYPERLINK("http://evil.test","klik")`)
    expect(names).toContain(`'+1+1`)
    expect(names).toContain(`'-2+3`)
    expect(names).toContain(`'@SUM(A1)`)
    expect(names).toContain(`'\tTab Murid`)
    expect(names).toContain('Murid, "Koma" Uji')
    for (const r of rows) for (const cell of r) expect(cell, `cell ${cell}`).not.toMatch(/^[=+\-@\t\r]/)
    const evil = rows.find((r) => r[1]?.includes('HYPERLINK'))
    // The label starts with the level, so the formula characters sit mid-cell and stay harmless.
    expect(evil?.[2]).toBe('Tingkatan 4 =SUM(1+1)')
  })

  it('only the school pupils; no IC, e-mail or phone anywhere in the file', async () => {
    const text = (await schoolAdmin.get(`/amaran/export/school/${s1}`)).text
    expect(text).not.toContain('Murid Sekolah Dua')
    expect(text).not.toContain('@ujian.test')
    expect(text).not.toContain('@demo.test')
    expect(text).not.toContain('0187776665')
    expect(text).not.toContain('xxxxxx-xx-xx99')
    expect(text).not.toContain('hash-rahsia-ic')
  })

  it('admin may export any school', async () => {
    const res = await admin.get(`/amaran/export/school/${s2}`)
    expect(res.status).toBe(200)
    expect(parseCsv(res.text.slice(1)).some((r) => r[1] === 'Murid Sekolah Dua')).toBe(true)
  })

  it('every accepted download writes ONE audit row with ids, file name and row count, and nothing personal', async () => {
    const before = (await auditRows(t.db, ACTION)).length
    const res = await schoolAdmin.get(`/amaran/export/school/${s1}`)
    const rows = await auditRows(t.db, ACTION)
    expect(rows.length).toBe(before + 1)
    const row = rows[0]!
    expect(row.actor_role).toBe('school_admin')
    expect(row.scope_school_id).toBe(s1)
    expect(row.target_type).toBe('school')
    expect(row.target_id).toBe(s1)
    expect(row.request_id).toBeTruthy()
    expect(row.ip_hash).toBeTruthy()
    const lines = parseCsv(res.text.slice(1)).length - 1
    expect(row.detail).toMatchObject({ fileName: `amaran-sekolah-${s1}-20261019.csv`, rowCount: lines })
    const dump = JSON.stringify(row)
    for (const secret of ['HYPERLINK', 'Murid', '@ujian.test', '0187776665']) expect(dump).not.toContain(secret)
  })

  it('refusals write no audit row: teacher 403, foreign and unknown school 404, anonymous 401', async () => {
    const before = (await auditRows(t.db, ACTION)).length
    errorOf(await teacher.get(`/amaran/export/school/${s1}`), 403, 'FORBIDDEN')
    errorOf(await schoolAdmin.get(`/amaran/export/school/${s2}`), 404, 'NOT_FOUND')
    errorOf(await schoolAdmin.get('/amaran/export/school/987654321'), 404, 'NOT_FOUND')
    expect((await t.http().get(`/api/amaran/export/school/${s1}`)).status).toBe(401)
    expect((await auditRows(t.db, ACTION)).length).toBe(before)
  })
})

describe('BE-21 Amaran CSV: 429 on the export bucket', () => {
  let t: SchoolAdminTestApp
  let schoolAdmin: PeopleApi
  let s1: string

  beforeAll(async () => {
    t = await bootPeopleApp({ env: { THROTTLE_SCHOOL_ADMIN_EXPORT_PER_MINUTE: '2' } })
    s1 = await schoolIdOf(t.db, 'DEMO001')
    await insertSchoolAdmin(t.db, await schoolIdOf(t.db, 'DEMO002'), 'admin2@ujian.test')
    schoolAdmin = peopleApiOf(await login(t, SCHOOL_ADMIN))
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  it('the third download in a minute is 429 RATE_LIMITED with Retry-After AND both anti-cache headers, and writes no audit row', async () => {
    expect((await schoolAdmin.get(`/amaran/export/school/${s1}`)).status).toBe(200)
    expect((await schoolAdmin.get(`/amaran/export/school/${s1}`)).status).toBe(200)
    const before = (await auditRows(t.db, ACTION)).length
    const res = await schoolAdmin.get(`/amaran/export/school/${s1}`)
    const e = errorOf(res, 429, 'RATE_LIMITED')
    expect(e.retryAfter).toBeGreaterThanOrEqual(1)
    expect(res.headers['retry-after']).toBe(String(e.retryAfter))
    expectNoCache(res, true)
    expect((await auditRows(t.db, ACTION)).length).toBe(before)
    expect(before).toBe(2)
  })

  it('the export bucket is separate from the read bucket: a JSON route still answers', async () => {
    expect((await schoolAdmin.get(`/amaran/schools/${s1}`)).status).toBe(200)
  })
})
