/**
 * M27 Part B read endpoints (M27-T1a): #2, #3, #5, #6, #7, #10, #11, #16, #17, #18, #22 (SRS Part B §19,
 * FR-M27-39…43, 49, 51…65, 81…93, 99…101, 111…116, 119; BR-M27-19…40; SEC-M27-06, 09, 10). The real core with
 * the owners the read models use (M01, M02, M03, M04, M05, M08, M09, M10) and M27, at the project clock.
 * Figures are compared with the owners' own queries (oracle); none is pinned.
 *
 * Personas (URS §10.3): P1 school admin of school 900003 (no pupil, teacher or class), P2 school admin of
 * school 900001 (pupils, teacher 5, classes 2001 and 2002), P3 school admin of school 900002.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import type { HttpMethod, TransportResponse } from '@/api/transport'
import { CLOCK_ANCHOR_ISO, createClock, DAY_MS } from '@/lib/time'
import { setUser } from '@/mock/core-data/set-user'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01, { users } from '@/modules/m01-authentication/mock'
import m02, { m02Config } from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m05, { practice } from '@/modules/m05-practice/mock'
import m08, { spRecords } from '@/modules/m08-student-performance/mock'
import m09 from '@/modules/m09-content/mock'
import m10, { classrooms } from '@/modules/m10-teacher-class/mock'

import type {
  MonthlyReport,
  SchoolClassList,
  SchoolDskpHeatmap,
  SchoolPupilFormOptions,
  SchoolPupilRow,
  SchoolTeacherRow,
  SchoolUsage,
  SchoolUserDetail,
} from '../../api/school-admin'
import m27 from '../../mock'
import { sanitizeCsvCell, csvField, CSV_BOM } from '../../mock/read-models/csv'
import { statusOf } from '../../mock/read-models/dskp-heatmap'
import { parseMonth } from '../../mock/read-models/monthly'
import { gradeLabel, initialsOf } from '../../mock/read-models/school-people'
import { parsePeriod } from '../../mock/read-models/usage'
import { pageOf } from '../../mock/read-models/users-list'

const ADMIN = 1
const PELAJAR = 2
const GURU = 5
const P1 = 3102 // school admin, school 900003 (empty)
const P2 = 8 // school admin, school 900001 (populated)
const P3 = 3104 // school admin, school 900002
const S1 = 900001
const S3 = 900003
const NOW = Date.parse(CLOCK_ANCHOR_ISO)
const BASE = '/api/admin-sekolah'

let runtime: MockRuntime

beforeAll(async () => {
  runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m08, m09, m10, m27],
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
}, 600_000)

async function call<T = unknown>(
  userId: number | null,
  url: string,
  method: HttpMethod = 'GET',
): Promise<{ status: number; body: T; headers: Record<string, string> }> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (userId !== null) headers.authorization = `Bearer ${setUser(userId).token}`
  const res: TransportResponse = await runtime.transport.request({ method, url, headers })
  return { status: res.status, body: res.body as T, headers: res.headers }
}

async function data<T>(userId: number, url: string): Promise<T> {
  const r = await call<{ data: T }>(userId, url)
  expect(r.status, url).toBe(200)
  return r.body.data
}

async function listOf<T>(userId: number, url: string) {
  const r = await call<{
    data: T[]
    meta: {
      page: number
      pageSize: number
      totalItems: number
      totalPages: number
      from: number | null
      to: number | null
      counts?: { total: number; active: number; inactive: number }
      displayed?: number
    }
  }>(userId, url)
  expect(r.status, url).toBe(200)
  return r.body
}

const pupilsOf = (schoolId: number) =>
  users.adminList({ role: 'student', schoolId, pageSize: 100_000 }).rows

describe('pure helpers', () => {
  it('parses period, month and page defensively', () => {
    expect(parsePeriod('today')).toBe('today')
    expect(parsePeriod('7days')).toBe('7days')
    expect(parsePeriod('nonsense')).toBe('30days')
    expect(parsePeriod(undefined)).toBe('30days')
    expect(parseMonth('2026-08', NOW)).toEqual({ year: 2026, month: 8, current: false })
    expect(parseMonth('2026-09', NOW).current).toBe(true)
    expect(parseMonth('2026-10', NOW)).toEqual({ year: 2026, month: 9, current: true })
    expect(parseMonth('2026-13', NOW).month).toBe(9)
    expect(parseMonth('abc', NOW).month).toBe(9)
    const rows = Array.from({ length: 60 }, (_, i) => i)
    expect(pageOf(rows, undefined).meta).toMatchObject({ page: 1, totalPages: 3, from: 1, to: 25 })
    expect(pageOf(rows, '99').meta).toMatchObject({ page: 3, from: 51, to: 60 })
    expect(pageOf(rows, '0').meta.page).toBe(1)
    expect(pageOf([], '1').meta).toMatchObject({ totalPages: 1, from: null, to: null })
  })

  it('labels grades, initials and DSKP status on the shown integer', () => {
    expect(gradeLabel(11)).toBe('Tingkatan 5')
    expect(gradeLabel(7)).toBe('Tingkatan 1')
    expect(gradeLabel(6)).toBe('Darjah 6')
    expect(gradeLabel(null)).toBeNull()
    expect(initialsOf('Aminah binti Ali')).toBe('AB')
    expect(statusOf(null)).toBe('belum')
    expect(statusOf(75)).toBe('mahir')
    expect(statusOf(74)).toBe('sederhana')
    expect(statusOf(50)).toBe('sederhana')
    expect(statusOf(49)).toBe('lemah')
  })

  it('neutralises CSV formula triggers and quotes special cells', () => {
    for (const bad of ['=1+1', '+1', '-1', '@x', '\tx', '\rx']) {
      expect(sanitizeCsvCell(bad)).toBe(`'${bad}`)
    }
    expect(sanitizeCsvCell('Ali')).toBe('Ali')
    expect(csvField('a,b')).toBe('"a,b"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField(null)).toBe('')
    expect(csvField(1)).toBe('1')
  })
})

describe('guard SA on every read endpoint (FR-M27-39 to 41; SEC-M27-06)', () => {
  const urls = [
    `${BASE}/usage`,
    `${BASE}/dskp-heatmap`,
    `${BASE}/laporan-bulanan`,
    `${BASE}/pelajar`,
    `${BASE}/pelajar/3001`,
    `${BASE}/pelajar/form-options`,
    `${BASE}/pelajar/export.csv`,
    `${BASE}/guru`,
    `${BASE}/guru/5`,
    `${BASE}/guru/export.csv`,
    `${BASE}/kelas`,
  ]

  it.each(urls)('answers 401 to a guest on %s', async (url) => {
    expect((await call(null, url)).status).toBe(401)
  })

  it.each(urls)('answers 403 to a platform admin, teacher and pupil on %s', async (url) => {
    for (const id of [ADMIN, GURU, PELAJAR]) expect((await call(id, url)).status).toBe(403)
  })

  it('answers 403 to a school admin without a school, and the body names no school', async () => {
    const orphan = users.create(
      { name: 'Tanpa Sekolah', email: 'tanpa-sekolah-t1a@demo.test', role: 'school_admin' },
      NOW,
    )
    for (const url of urls) {
      const r = await call(orphan.id, url)
      expect(r.status, url).toBe(403)
      expect(JSON.stringify(r.body)).not.toMatch(/SMK|SK |"rows"|"school"/)
    }
  })

  it('answers the guard (not 404) before a malformed id is judged', async () => {
    expect((await call(null, `${BASE}/pelajar/abc`)).status).toBe(401)
    expect((await call(ADMIN, `${BASE}/guru/abc`)).status).toBe(403)
    expect((await call(P2, `${BASE}/pelajar/abc`)).status).toBe(404)
  })
})

describe('#2 usage (S1; BR-M27-21 to 23)', () => {
  it('P1 (empty school) shows zeros, no accuracy and no mode rows', async () => {
    const u = await data<SchoolUsage>(P1, `${BASE}/usage`)
    expect(u.school.id).toBe(S3)
    expect(u.period).toBe('30days')
    expect(u.label).toBe('30 Hari')
    expect(u.tiles).toEqual({
      pupils: 0,
      teachers: 0,
      activePupils: 0,
      participationPct: 0,
      sessions: 0,
      answers: 0,
      accuracy: null,
    })
    expect(u.modes).toEqual([])
  })

  it('P2 equals the M05 per-pupil oracle and the mode rows sum to the sessions tile', async () => {
    const pupils = pupilsOf(S1)
    const from = NOW - 30 * DAY_MS
    let sessions = 0
    let answers = 0
    let active = 0
    for (const p of pupils) {
      sessions += practice.history(p.id, { from, to: NOW + 1 }).length
      const n = practice.answers(p.id, { from, to: NOW + 1 }).length
      answers += n
      if (n > 0) active += 1
    }
    const u = await data<SchoolUsage>(P2, `${BASE}/usage`)
    expect(u.tiles.pupils).toBe(pupils.length)
    expect(u.tiles.teachers).toBe(
      users.adminList({ role: 'teacher', schoolId: S1, pageSize: 1 }).total,
    )
    expect(u.tiles.sessions).toBe(sessions)
    expect(u.tiles.answers).toBe(answers)
    expect(u.tiles.activePupils).toBe(active)
    expect(u.tiles.participationPct).toBe(Math.round((active / pupils.length) * 100))
    expect(u.modes.reduce((a, m) => a + m.sessions, 0)).toBe(sessions)
    const counts = u.modes.map((m) => m.sessions)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
    if (sessions === 0) expect(u.tiles.accuracy).toBeNull()
  })

  it('narrows with the period, falls back to 30 days and ignores a school in the query', async () => {
    const day = await data<SchoolUsage>(P2, `${BASE}/usage?period=today`)
    const week = await data<SchoolUsage>(P2, `${BASE}/usage?period=7days`)
    const month = await data<SchoolUsage>(P2, `${BASE}/usage?period=30days`)
    expect([day.label, week.label, month.label]).toEqual(['Hari Ini', '7 Hari', '30 Hari'])
    expect(day.tiles.sessions).toBeLessThanOrEqual(week.tiles.sessions)
    expect(week.tiles.sessions).toBeLessThanOrEqual(month.tiles.sessions)
    expect(await data(P2, `${BASE}/usage?period=bogus`)).toEqual(month)
    expect(await data(P1, `${BASE}/usage?school_id=${String(S1)}&schoolId=${String(S1)}`)).toEqual(
      await data(P1, `${BASE}/usage`),
    )
  })
})

describe('#3 DSKP heatmap (S2; BR-M27-24, 25)', () => {
  it('P2 pools the school pupils spRecords and the status follows the shown integer', async () => {
    const t5 = await data<SchoolDskpHeatmap>(P2, `${BASE}/dskp-heatmap?tingkatan=T5`)
    expect(t5.school.id).toBe(S1)
    expect(t5.level).toEqual({ code: 't5', name: 'Tingkatan 5' })
    expect(t5.subjects.length).toBeGreaterThan(0)
    expect(t5.caption).toBe(`KSSM ${t5.subject?.name ?? ''} Tingkatan 5`)
    const names = t5.subjects.map((s) => s.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ms-MY')))

    const pupils = pupilsOf(S1)
    const sps = t5.bidang.flatMap((b) => b.sp)
    expect(sps.length).toBeGreaterThan(0)
    for (const sp of sps) {
      let answered = 0
      let correct = 0
      for (const p of pupils) {
        for (const r of spRecords.forUser(p.id)) {
          if (r.dskpSpId === sp.id) {
            answered += r.answered
            correct += r.correct
          }
        }
      }
      expect(sp.answered, sp.code).toBe(answered)
      expect(sp.correct, sp.code).toBe(correct)
      expect(sp.pct, sp.code).toBe(
        answered > 0 ? Math.floor((100 * correct) / answered + 0.5) : null,
      )
      expect(sp.status).toBe(statusOf(sp.pct))
    }
  })

  it('P1 (no pupil) shows every tile "belum" without a percentage', async () => {
    const h = await data<SchoolDskpHeatmap>(P1, `${BASE}/dskp-heatmap`)
    expect(h.school.id).toBe(S3)
    for (const sp of h.bidang.flatMap((b) => b.sp)) {
      expect(sp).toMatchObject({ answered: 0, correct: 0, pct: null, status: 'belum' })
    }
  })

  it('falls back to the default subject and level for unknown values', async () => {
    const base = await data<SchoolDskpHeatmap>(P2, `${BASE}/dskp-heatmap`)
    expect(base.level.code).toBe('t4')
    const odd = await data<SchoolDskpHeatmap>(
      P2,
      `${BASE}/dskp-heatmap?subjectId=999999&tingkatan=X9`,
    )
    expect(odd).toEqual(base)
  })
})

describe('#5 monthly report (S5; BR-M27-28, 29)', () => {
  it('P1 shows the current month with zero cards and no sections', async () => {
    const m = await data<MonthlyReport>(P1, `${BASE}/laporan-bulanan`)
    expect(m.month).toBe('2026-09')
    expect(m.label).toBe('September 2026')
    expect(m.prev).toBe('2026-08')
    expect(m.next).toBeNull()
    expect(m.cards).toEqual({
      participationPct: 0,
      active: 0,
      registered: 0,
      answers: 0,
      perPupil: 0,
      accuracy: null,
      sessions: 0,
    })
    expect(m.months).toEqual([])
    expect(m.total).toBeNull()
    expect(m.subjects).toEqual({ strongest: null, weakest: null, rows: [] })
    expect(m.generatedAt).toBe('2026-09-25T15:40:00+08:00')
  })

  it('P2 cards equal the M05 oracle for the month and the subject boxes are the extremes', async () => {
    const from = Date.parse('2026-09-01T00:00:00+08:00')
    const to = Date.parse('2026-10-01T00:00:00+08:00')
    const pupils = pupilsOf(S1)
    let answers = 0
    let correct = 0
    let sessions = 0
    let active = 0
    for (const p of pupils) {
      const a = practice.answers(p.id, { from, to })
      answers += a.length
      correct += a.filter((x) => x.isCorrect).length
      if (a.length > 0) active += 1
      sessions += practice.history(p.id, { from, to }).length
    }
    const m = await data<MonthlyReport>(P2, `${BASE}/laporan-bulanan?bulan=2026-09`)
    expect(m.cards.registered).toBe(pupils.length)
    expect(m.cards.active).toBe(active)
    expect(m.cards.answers).toBe(answers)
    expect(m.cards.sessions).toBe(sessions)
    expect(m.cards.perPupil).toBe(active > 0 ? Math.round(answers / active) : 0)
    expect(m.cards.accuracy).toBe(answers > 0 ? Math.round((correct / answers) * 1000) / 10 : null)
    if (m.subjects.rows.length > 0) {
      const acc = m.subjects.rows.map((r) => r.accuracy)
      expect(m.subjects.strongest?.accuracy).toBe(Math.max(...acc))
      expect(m.subjects.weakest?.accuracy).toBe(Math.min(...acc))
      expect(acc).toEqual([...acc].sort((a, b) => b - a))
    }
    // The 12 month window ends with the shown month and lists months in ascending order.
    expect(m.months.map((r) => r.month)).toEqual([...m.months.map((r) => r.month)].sort())
    expect(m.months.every((r) => r.month <= '2026-09' && r.month >= '2025-10')).toBe(true)
    if (m.months.length > 1) expect(m.total).not.toBeNull()
    else expect(m.total).toBeNull()
  })

  it('navigates: past month has next, invalid and future values give the current month', async () => {
    const past = await data<MonthlyReport>(P2, `${BASE}/laporan-bulanan?bulan=2026-07`)
    expect(past).toMatchObject({
      month: '2026-07',
      label: 'Julai 2026',
      prev: '2026-06',
      next: '2026-08',
    })
    for (const bad of ['2026-12', 'x', '2026-9', '']) {
      const m = await data<MonthlyReport>(P2, `${BASE}/laporan-bulanan?bulan=${bad}`)
      expect(m.month, bad).toBe('2026-09')
    }
  })
})

describe('#6 and #10 lists (S6, S7; BR-M27-30, 36)', () => {
  it('P1 (empty school) answers an empty page with zero cards', async () => {
    const r = await listOf<SchoolPupilRow>(P1, `${BASE}/pelajar`)
    expect(r.data).toEqual([])
    expect(r.meta).toMatchObject({
      page: 1,
      pageSize: 25,
      totalItems: 0,
      totalPages: 1,
      from: null,
      to: null,
      counts: { total: 0, active: 0, inactive: 0 },
    })
    expect((await listOf<SchoolTeacherRow>(P1, `${BASE}/guru`)).data).toEqual([])
  })

  it('P2 lists only pupils of its school, active first then newest id, with the owner counts', async () => {
    const r = await listOf<SchoolPupilRow>(P2, `${BASE}/pelajar`)
    expect(r.data.length).toBeGreaterThan(0)
    for (const row of r.data) {
      const u = users.get(row.id)
      expect(u?.schoolId).toBe(S1)
      expect(u?.role).toBe('student')
      expect(row.canEdit).toBe(row.isActive)
      expect(row.initials).toBe(initialsOf(row.name))
    }
    const keys = r.data.map((x) => [Number(!x.isActive), -x.id])
    expect(keys).toEqual(
      [...keys].sort(
        (a, b) => (a[0] as number) - (b[0] as number) || (a[1] as number) - (b[1] as number),
      ),
    )
    const total = users.adminList({ role: 'student', schoolId: S1, pageSize: 1 }).total
    const active = users.adminList({
      role: 'student',
      schoolId: S1,
      isActive: true,
      pageSize: 1,
    }).total
    expect(r.meta.counts).toEqual({ total, active, inactive: total - active })
    expect(r.meta.totalItems).toBe(total)
    expect(r.meta.from).toBe(1)
    expect(r.meta.to).toBe(r.data.length)
    expect(r.data.length).toBeLessThanOrEqual(25)
    expect(r.data.some((x) => x.id === 3001)).toBe(true)
  })

  it('ignores school, role and class parameters (FR-M27-42)', async () => {
    const plain = await listOf<SchoolPupilRow>(P2, `${BASE}/pelajar`)
    const forced = await listOf<SchoolPupilRow>(
      P2,
      `${BASE}/pelajar?school=${String(S3)}&school_id=${String(S3)}&role=teacher&kelas=2001`,
    )
    expect(forced).toEqual(plain)
    const p1 = await listOf<SchoolPupilRow>(
      P1,
      `${BASE}/pelajar?school_id=${String(S1)}&role=teacher`,
    )
    expect(p1.data).toEqual([])
  })

  it('filters by status and name or e-mail (case-insensitive) and keeps the card totals', async () => {
    const all = await listOf<SchoolPupilRow>(P2, `${BASE}/pelajar`)
    const ghost = users.create(
      {
        name: 'Murid Tidak Aktif T1a',
        email: 'tidak-aktif-t1a@demo.test',
        role: 'student',
        schoolId: S1,
        grade: 10,
        isActive: false,
      },
      NOW,
    )
    const inactive = await listOf<SchoolPupilRow>(P2, `${BASE}/pelajar?is_active=0`)
    expect(inactive.data.map((x) => x.id)).toContain(ghost.id)
    expect(inactive.data.every((x) => !x.isActive && !x.canEdit)).toBe(true)
    expect(inactive.meta.counts?.total).toBe((all.meta.counts?.total ?? 0) + 1)
    const active = await listOf<SchoolPupilRow>(P2, `${BASE}/pelajar?is_active=1`)
    expect(active.data.every((x) => x.isActive)).toBe(true)
    expect(
      (await listOf<SchoolPupilRow>(P2, `${BASE}/pelajar?is_active=zzz`)).meta.totalItems,
    ).toBe((all.meta.totalItems ?? 0) + 1)
    const hit = await listOf<SchoolPupilRow>(
      P2,
      `${BASE}/pelajar?search=${encodeURIComponent('TIDAK-AKTIF-T1A')}`,
    )
    expect(hit.data.map((x) => x.id)).toEqual([ghost.id])
    expect(hit.meta.counts?.total).toBe(inactive.meta.counts?.total)
    const none = await listOf<SchoolPupilRow>(P2, `${BASE}/pelajar?search=zzzz-no-match`)
    expect(none.data).toEqual([])
    expect(none.meta.from).toBeNull()
    // The inactive pupil comes after every active one.
    const first = (await listOf<SchoolPupilRow>(P2, `${BASE}/pelajar`)).data
    const lastActive = first.map((x) => x.isActive).lastIndexOf(true)
    const firstInactive = first.findIndex((x) => !x.isActive)
    if (firstInactive !== -1) expect(firstInactive).toBeGreaterThan(lastActive)
  })

  it('pages 25 rows, keeps the last page for a page beyond it', async () => {
    const created: number[] = []
    try {
      for (let i = 0; i < 27; i += 1) {
        created.push(
          users.create(
            {
              name: `Murid Halaman ${String(i)}`,
              email: `halaman-${String(i)}-t1a@demo.test`,
              role: 'student',
              schoolId: S3,
              grade: 10,
            },
            NOW + i,
          ).id,
        )
      }
      const one = await listOf<SchoolPupilRow>(P1, `${BASE}/pelajar`)
      expect(one.meta).toMatchObject({ page: 1, totalItems: 27, totalPages: 2, from: 1, to: 25 })
      const two = await listOf<SchoolPupilRow>(P1, `${BASE}/pelajar?page=2`)
      expect(two.data.length).toBe(2)
      expect(two.meta).toMatchObject({ page: 2, from: 26, to: 27 })
      const beyond = await listOf<SchoolPupilRow>(P1, `${BASE}/pelajar?page=99`)
      expect(beyond.meta.page).toBe(2)
      const ids = [...one.data, ...two.data].map((x) => x.id)
      expect(new Set(ids).size).toBe(27)
      // The other schools never see them.
      for (const other of [P2, P3]) {
        const rows = (await listOf<SchoolPupilRow>(other, `${BASE}/pelajar`)).data
        expect(rows.some((x) => ids.includes(x.id))).toBe(false)
      }
    } finally {
      for (const id of created) users.remove(id)
    }
  })

  it('shows the pupil active class names and the teacher active class count', async () => {
    const mine = await listOf<SchoolTeacherRow>(P2, `${BASE}/guru`)
    const t5 = mine.data.find((x) => x.id === GURU)
    expect(t5).toBeDefined()
    expect(t5?.classCount).toBe(classrooms.forTeacher(GURU).filter((c) => c.isActive).length)
    expect(
      mine.data.every(
        (x) => users.get(x.id)?.role === 'teacher' && users.get(x.id)?.schoolId === S1,
      ),
    ).toBe(true)
    expect(mine.meta.counts?.total).toBe(
      users.adminList({ role: 'teacher', schoolId: S1, pageSize: 1 }).total,
    )

    const pupils = await listOf<SchoolPupilRow>(P2, `${BASE}/pelajar`)
    for (const row of pupils.data) {
      const expected = classrooms
        .enrolmentsOf(row.id)
        .filter((e) => e.status === 'active')
        .map((e) => classrooms.get(e.classroomKind, e.classroomId))
        .filter((c) => c?.isActive)
        .map((c) => c?.name)
        .sort()
      expect([...row.classNames].sort()).toEqual(expected)
    }
  })
})

describe('#7 and #11 detail (S9, S10; BR-M27-31; SEC-M27-10)', () => {
  it('returns a pupil and a teacher of the own school with the school block and no IC', async () => {
    const pupil = await data<SchoolUserDetail>(P2, `${BASE}/pelajar/3001`)
    expect(pupil).toMatchObject({ id: 3001, role: 'student', isActive: true })
    expect(pupil.school.id).toBe(S1)
    const teacher = await data<SchoolUserDetail>(P2, `${BASE}/guru/${String(GURU)}`)
    expect(teacher).toMatchObject({ id: GURU, role: 'teacher' })
    expect(JSON.stringify([pupil, teacher])).not.toMatch(/icNumber|icHash|ic_number|passwordHash/i)
  })

  it('answers the same 404 for another school, the other role, an unknown id and a non-numeric id', async () => {
    const bodies = [
      await call(P1, `${BASE}/pelajar/3001`),
      await call(P1, `${BASE}/guru/${String(GURU)}`),
      await call(P2, `${BASE}/pelajar/${String(GURU)}`),
      await call(P2, `${BASE}/guru/3001`),
      await call(P2, `${BASE}/pelajar/99999999`),
      await call(P2, `${BASE}/pelajar/abc`),
      await call(P2, `${BASE}/pelajar/${String(P2)}`),
    ]
    for (const r of bodies) expect(r.status).toBe(404)
    expect(new Set(bodies.map((r) => JSON.stringify(r.body))).size).toBe(1)
  })

  it('answers 403 for an inactive in-school account and 404 for a foreign inactive one', async () => {
    const pupil = users.create(
      {
        name: 'Murid Beku',
        email: 'beku-t1a@demo.test',
        role: 'student',
        schoolId: S1,
        isActive: false,
      },
      NOW,
    )
    const teacher = users.create(
      {
        name: 'Guru Beku',
        email: 'guru-beku-t1a@demo.test',
        role: 'teacher',
        schoolId: S1,
        isActive: false,
      },
      NOW,
    )
    expect((await call(P2, `${BASE}/pelajar/${String(pupil.id)}`)).status).toBe(403)
    expect((await call(P2, `${BASE}/guru/${String(teacher.id)}`)).status).toBe(403)
    expect((await call(P3, `${BASE}/pelajar/${String(pupil.id)}`)).status).toBe(404)
    // The list still shows them (S7 can reactivate) without an edit link.
    const row = (await listOf<SchoolTeacherRow>(P2, `${BASE}/guru?is_active=0`)).data.find(
      (x) => x.id === teacher.id,
    )
    expect(row).toMatchObject({ isActive: false, canEdit: false })
  })
})

describe('#17 and #18 CSV exports (BR-M27-40; SEC-M27-09)', () => {
  async function csv(userId: number, url: string) {
    const r = await call<Blob>(userId, url)
    expect(r.status).toBe(200)
    const buffer = await r.body.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    return {
      r,
      bom: bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf,
      text: new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes),
    }
  }

  it('names the file by role and clock date and starts with the BOM and the header', async () => {
    const pupils = await csv(P2, `${BASE}/pelajar/export.csv`)
    expect(pupils.bom).toBe(true)
    expect(pupils.r.headers['content-type']).toContain('text/csv')
    expect(pupils.r.headers['content-disposition']).toContain('users-pelajar-2026-09-25.csv')
    expect(
      pupils.text.startsWith(`${CSV_BOM}id,name,email,role,sekolah,kelas,is_active,created_at\n`),
    ).toBe(true)
    const teachers = await csv(P2, `${BASE}/guru/export.csv`)
    expect(teachers.r.headers['content-disposition']).toContain('users-guru-2026-09-25.csv')
    expect(teachers.text).toContain(',guru,')
    expect(teachers.text).not.toContain(',pelajar,')
  })

  it('holds the own school only, ordered by id, with no IC and no phone', async () => {
    const { text } = await csv(P2, `${BASE}/pelajar/export.csv?school_id=${String(S3)}`)
    const lines = text.replace(CSV_BOM, '').trim().split('\n').slice(1)
    const ids = lines.map((l) => Number(l.split(',')[0]))
    expect(ids).toEqual([...ids].sort((a, b) => a - b))
    const expected = pupilsOf(S1)
      .map((u) => u.id)
      .sort((a, b) => a - b)
    expect(ids).toEqual(expected)
    for (const id of ids) expect(users.get(id)?.schoolId).toBe(S1)
    for (const u of pupilsOf(S1)) if (u.phone) expect(text).not.toContain(u.phone)
    expect(text).not.toMatch(/\d{6}-\d{2}-\d{4}/)
    const empty = await csv(P1, `${BASE}/pelajar/export.csv`)
    expect(empty.text).toBe(`${CSV_BOM}id,name,email,role,sekolah,kelas,is_active,created_at\n`)
  })

  it('applies the filters of the form and neutralises a formula in a name', async () => {
    users.create(
      {
        name: '=HYPERLINK("http://evil")',
        email: 'formula-t1a@demo.test',
        role: 'teacher',
        schoolId: S1,
        isActive: false,
      },
      NOW,
    )
    const filtered = await csv(P2, `${BASE}/guru/export.csv?is_active=0&search=formula-t1a`)
    const rows = filtered.text.trim().split('\n').slice(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toContain(`"'=HYPERLINK(""http://evil"")"`)
    expect(rows[0]).toMatch(/,guru,.*,,0,/)
    // An unknown is_active value is ignored (all), not rejected.
    const all = await csv(P2, `${BASE}/guru/export.csv?is_active=maybe`)
    expect(all.text.trim().split('\n').length).toBeGreaterThan(rows.length + 1)
  })
})

describe('#16 classes (S8; BR-M27-35)', () => {
  it('P1 (no class) answers an empty list with a zero tile and no levels', async () => {
    const r = await call<SchoolClassList>(P1, `${BASE}/kelas`)
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual([])
    expect(r.body.tiles).toEqual({ activeClasses: 0 })
    expect(r.body.levels).toEqual([])
    expect(r.body.meta).toMatchObject({ displayed: 0, totalItems: 0, from: null })
  })

  it('P2 lists the classroom classes of the school by name with the owner figures', async () => {
    const r = await call<SchoolClassList>(P2, `${BASE}/kelas`)
    expect(r.status).toBe(200)
    const own = classrooms.list({ schoolId: S1, kind: 'classroom' })
    expect(r.body.meta.totalItems).toBe(own.length)
    expect(r.body.meta.displayed).toBe(own.length)
    expect(r.body.tiles.activeClasses).toBe(
      classrooms.list({ isActive: true, schoolId: S1, kind: 'classroom' }).length,
    )
    const names = r.body.data.map((c) => c.name)
    expect(names).toEqual(
      [...names].sort((a, b) => a.localeCompare(b, 'ms-MY', { sensitivity: 'base' })),
    )
    const c2001 = r.body.data.find((c) => c.id === 2001)
    expect(c2001).toBeDefined()
    expect(c2001).toMatchObject({
      key: 'classroom:2001',
      kind: 'classroom',
      link: '/prestasi/kelas/2001',
      members: classrooms.memberCount('classroom', 2001),
      teacherName: users.get(GURU)?.name,
    })
    for (const row of r.body.data) {
      expect(classrooms.get('classroom', row.id)?.schoolId).toBe(S1)
      expect(row.levelLabel).toMatch(/^(Tingkatan|Darjah) \d$/)
    }
  })

  it('filters by a present level and search; an unknown level means all; ignores a school id', async () => {
    const all = await call<SchoolClassList>(P2, `${BASE}/kelas`)
    const level = all.body.levels[0]
    expect(level).toBeDefined()
    const one = await call<SchoolClassList>(P2, `${BASE}/kelas?level=${level?.code ?? ''}`)
    expect(one.body.data.every((c) => c.levelLabel === level?.label)).toBe(true)
    expect((await call<SchoolClassList>(P2, `${BASE}/kelas?level=nope`)).body.meta.totalItems).toBe(
      all.body.meta.totalItems,
    )
    const hit = await call<SchoolClassList>(
      P2,
      `${BASE}/kelas?search=${encodeURIComponent('MARIKH')}`,
    )
    expect(hit.body.data.map((c) => c.id)).toEqual(expect.arrayContaining([2001, 2002]))
    expect(hit.body.meta.displayed).toBe(hit.body.data.length)
    expect(hit.body.tiles).toEqual(all.body.tiles)
    const forced = await call<SchoolClassList>(P1, `${BASE}/kelas?school_id=${String(S1)}`)
    expect(forced.body.data).toEqual([])
  })
})

describe('#22 pupil form options (S12)', () => {
  it('P2 lists the active classroom classes by name and never the literal default password', async () => {
    const o = await data<SchoolPupilFormOptions>(P2, `${BASE}/pelajar/form-options`)
    expect(o.school.id).toBe(S1)
    const expected = classrooms
      .list({ schoolId: S1, kind: 'classroom', isActive: true })
      .map((c) => ({ id: c.classId, name: c.name }))
    expect([...o.classes].sort((a, b) => a.id - b.id)).toEqual(expected.sort((a, b) => a.id - b.id))
    const names = o.classes.map((c) => c.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ms-MY')))
    expect(o.passwordMinLength).toBe(8)
    expect(o.passwordHint).toBe('Biarkan kosong untuk guna kata laluan lalai (minimum 8 aksara).')
    const secret = m02Config().bulkImportDefaultPassword
    expect(o.passwordPlaceholder).toBe('•'.repeat(8))
    expect(JSON.stringify(o)).not.toContain(secret)
  })

  it('offers a newly created class, P1 gets no class, and the literal path beats :id', async () => {
    const created = classrooms.create(
      {
        name: 'KELAS DIBEKUKAN T1A',
        teacherId: GURU,
        schoolId: S1,
        educationLevel: 'tingkatan-4',
      },
      NOW,
    )
    const stored = classrooms.get('classroom', created.classId)
    expect(stored?.isActive).toBe(true)
    const before = await data<SchoolPupilFormOptions>(P2, `${BASE}/pelajar/form-options`)
    expect(before.classes.some((c) => c.id === created.classId)).toBe(true)
    const p1 = await data<SchoolPupilFormOptions>(P1, `${BASE}/pelajar/form-options`)
    expect(p1.school.id).toBe(S3)
    expect(p1.classes).toEqual([])
  })
})
