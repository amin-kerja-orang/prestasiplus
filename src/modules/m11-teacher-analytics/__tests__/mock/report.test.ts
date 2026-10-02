/**
 * M11-T1 endpoints #1 (S1 teacher report) and #8 (S6 item analysis) over the real owners (SRS M11 v1.10
 * §6.8, §7, §9): the designed teacher view of account 5 (classes 2001 and 2002, pupils 3001–3008),
 * the admin's empty population, the BR-M11-01…07 rules, the M16 port (0 for the observed and designed
 * views, wired when M16 registers), S6 against the M08 anchors Q1–Q8, and the T guard (the school admin
 * is 403 here, unlike on the monitoring endpoints).
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { users } from '@/modules/m01-authentication/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import type { ItemAnalysis, TeacherReport } from '../../api/types'
import { registerM16Reads, resetM16Reads } from '../../mock'
import { bandOf } from '../../mock/repository/item-analysis'
import { ADMIN, ADMIN_SEKOLAH, GURU, MemoryStorage, PELAJAR, bootM11, dataAs, getAs } from './boot'

let runtime: MockRuntime

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootM11()).runtime
}, 300_000)

afterEach(resetM16Reads)

afterAll(() => {
  vi.unstubAllGlobals()
})

const report = (query = '', as: number | null = GURU) =>
  dataAs<TeacherReport>(runtime, as, `/api/teacher/report${query}`)
const items = (query = '', as: number | null = GURU) =>
  dataAs<ItemAnalysis>(runtime, as, `/api/teacher/item-analysis${query}`)

const KIMIA = 10

describe('S1 teacher report: account 5 (§6.8; E2E-M11-10/12/14/16)', () => {
  it('30 days: 100% 8 / 8, 100% 8 / 8, 14 activities, 46%', async () => {
    const r = await report()
    expect(r.range).toBe(30)
    expect(r.classroomId).toBeNull()
    expect(r.population).toEqual({ total: 8, loggedIn: 8, practised: 8 })
    expect(r.activity.total).toBe(14)
    expect(r.activity.byType).toEqual({
      kuiz: 14,
      struktur: 0,
      latihTubi: 0,
      trackingA: 0,
      battle: 0,
      permainan: 0,
    })
    expect(r.score.overall).toBe(46)
    expect(r.score.byType).toEqual({
      kuiz: 46,
      struktur: null,
      latihTubi: null,
      trackingA: null,
      battle: null,
    })
  })

  it('the options are the own classes (M10 #12 fields id and name)', async () => {
    const r = await report()
    expect(r.options.classes).toEqual([
      { id: 2001, name: '5 MARIKH - Kimia' },
      { id: 2002, name: '5 MARIKH - Sejarah' },
    ])
  })

  it('trend: 15/09 4, 18/09 3, 22/09 4, 24/09 3, zero elsewhere; one point per day ending today', async () => {
    const r = await report()
    expect(r.trend).toHaveLength(30)
    expect(r.trend[0]?.date).toBe('27/08')
    expect(r.trend[29]?.date).toBe('25/09')
    expect(r.trend.filter((t) => t.count > 0)).toEqual([
      { date: '15/09', count: 4 },
      { date: '18/09', count: 3 },
      { date: '22/09', count: 4 },
      { date: '24/09', count: 3 },
    ])
    expect(r.trend.reduce((a, t) => a + t.count, 0)).toBe(r.activity.total)
  })

  it('7 days: 7 activities; 90 days: the same 14', async () => {
    const d7 = await report('?range=7')
    expect(d7.range).toBe(7)
    expect(d7.activity.total).toBe(7)
    expect(d7.trend).toHaveLength(7)
    expect(d7.trend.filter((t) => t.count > 0)).toEqual([
      { date: '22/09', count: 4 },
      { date: '24/09', count: 3 },
    ])
    const d90 = await report('?range=90')
    expect(d90.trend).toHaveLength(90)
    expect(d90.activity.total).toBe(14)
  })

  it('an invalid range is 30 (BR-M11-06)', async () => {
    for (const q of ['?range=999', '?range=abc', '?range=0']) {
      const r = await report(q)
      expect(r.range).toBe(30)
      expect(r.trend).toHaveLength(30)
    }
  })

  it('class 2001 and 2002 give the same figures (the same 8 members, S1 is not subject scoped)', async () => {
    const all = await report()
    for (const id of [2001, 2002]) {
      const r = await report(`?classroomId=${String(id)}`)
      expect(r.classroomId).toBe(id)
      expect(r.population).toEqual(all.population)
      expect(r.activity).toEqual(all.activity)
      expect(r.score).toEqual(all.score)
      expect(r.trend).toEqual(all.trend)
    }
  })

  it('a classroomId that is not an own class is ignored (INFERRED)', async () => {
    const all = await report()
    for (const q of ['?classroomId=228', '?classroomId=abc', '?classroomId=999999']) {
      const r = await report(q)
      expect(r.classroomId).toBeNull()
      expect(r.population).toEqual(all.population)
    }
  })

  it('lists: nobody is missing a login or a session; "Paling Aktif" has 8 rows', async () => {
    const r = await report()
    expect(r.notLoggedIn).toEqual([])
    expect(r.notPractised).toEqual([])
    expect(r.notPractisedAll).toEqual([])
    expect(r.mostActive.map((m) => [m.name, m.activities])).toEqual([
      ['Murid Demo 01', 3],
      ['Murid Demo 02', 3],
      ['Murid Demo 03', 2],
      ['Murid Demo 07', 2],
      ['Murid Demo 04', 1],
      ['Murid Demo 05', 1],
      ['Murid Demo 06', 1],
      ['Murid Demo 08', 1],
    ])
    expect(r.mostActive[0]).toMatchObject({ neverLoggedIn: false })
  })
})

describe('S1 teacher report: the admin has no class (DV-M11-01; E2E-M11-09/11/13)', () => {
  it('an empty population, zero activity, "-%", and 30 zero days', async () => {
    const r = await report('', ADMIN)
    expect(r.options.classes).toEqual([])
    expect(r.population).toEqual({ total: 0, loggedIn: 0, practised: 0 })
    expect(r.activity.total).toBe(0)
    expect(r.score.overall).toBeNull()
    expect(Object.values(r.score.byType).every((v) => v === null)).toBe(true)
    expect(r.trend).toHaveLength(30)
    expect(r.trend[0]?.date).toBe('27/08')
    expect(r.trend.every((t) => t.count === 0)).toBe(true)
    expect([r.notLoggedIn, r.notPractised, r.mostActive]).toEqual([[], [], []])
  })

  it('a class filter is ignored for the admin', async () => {
    const r = await report('?classroomId=228', ADMIN)
    expect(r.classroomId).toBeNull()
    expect(r.population.total).toBe(0)
  })
})

describe('S1 lists and the M16 port (BR-M11-04/05/07, §6.1)', () => {
  it('a pupil who never logged in or practised is listed (a fixture pupil is enrolled, then removed)', async () => {
    const t = runtime.clock.now()
    const pupil = users.create(
      {
        name: 'Murid Baharu Demo',
        email: 'murid-baharu@demo.test',
        role: 'student',
        grade: 11,
        schoolId: 900001,
      },
      t,
    )
    classrooms.enrol(
      { kind: 'classroom', classId: 2001, studentId: pupil.id, source: 'teacher' },
      t,
    )
    try {
      const r = await report()
      expect(r.population).toEqual({ total: 9, loggedIn: 8, practised: 8 })
      expect(r.notLoggedIn.map((s) => s.name)).toEqual(['Murid Baharu Demo'])
      expect(r.notLoggedIn[0]).toMatchObject({ id: pupil.id, neverLoggedIn: true })
      expect(r.notPractised.map((s) => s.id)).toEqual([pupil.id])
      expect(r.notPractisedAll.map((s) => s.id)).toEqual([pupil.id])
      // The designed figures are untouched by a pupil with no activity.
      expect(r.activity.total).toBe(14)
    } finally {
      classrooms.unenrol('classroom', 2001, pupil.id)
    }
    expect((await report()).population.total).toBe(8)
  })

  it('M16 not built: Battle and Permainan are 0 and so are their score bars', async () => {
    const r = await report()
    expect([r.activity.byType.battle, r.activity.byType.permainan]).toEqual([0, 0])
    expect(r.score.byType.battle).toBeNull()
  })

  it('battle players in no M10 class never reach S1 (SRS §6.1: the seed battle players are outside)', async () => {
    const asked: number[][] = []
    registerM16Reads({
      battles: {
        countFor: (ids) => {
          asked.push([...ids])
          // Only users who are in no class have battles.
          return new Map(
            ids.includes(9_999_999) ? [[9_999_999, { count: 7, correct: 5, answered: 9 }]] : [],
          )
        },
      },
      gameResults: {
        countFor: (ids) => new Map(ids.includes(9_999_999) ? [[9_999_999, { count: 4 }]] : []),
      },
    })
    const r = await report()
    expect(r.activity.byType.battle).toBe(0)
    expect(r.activity.byType.permainan).toBe(0)
    expect(r.score.overall).toBe(46)
    expect(asked.length).toBeGreaterThan(0)
    expect(asked.every((ids) => ids.every((id) => id >= 3001 && id <= 3008))).toBe(true)
  })

  it('once M16 registers, Battle, Permainan, the Battle bar, the trend and "Paling Aktif" follow', async () => {
    // 2 battles on 24/09 for pupil 3001 (3 correct of 5), nothing else.
    const at = Date.parse('2026-09-24T12:00:00+08:00')
    registerM16Reads({
      battles: {
        countFor: (ids, range) =>
          new Map(
            ids.includes(3001) && range.from <= at && at < range.to
              ? [[3001, { count: 2, correct: 3, answered: 5 }]]
              : [],
          ),
      },
      gameResults: { countFor: () => new Map() },
    })
    const r = await report('?classroomId=2001')
    expect(r.activity.byType.battle).toBe(2)
    expect(r.score.byType.battle).toBe(60)
    expect(r.activity.total).toBe(16)
    expect(r.score.overall).toBe(Math.round(((38 + 3) / (83 + 5)) * 100))
    expect(r.trend.find((t) => t.date === '24/09')?.count).toBe(5)
    expect(r.mostActive[0]).toMatchObject({ id: 3001, activities: 5 })
  })
})

describe('S6 item analysis: class 2001 (BR-M11-28; E2E-M11-43/44)', () => {
  it('the 8 M08 anchors Q1–Q8: % betul ascending, bands and discrimination', async () => {
    const r = await items('?classroomId=2001')
    expect(r.rows.map((x) => [x.questionId, x.attempts, x.pct, x.band, x.discrimination])).toEqual([
      [700005, 8, 12.5, 'sukar', -0.5],
      [700006, 8, 12.5, 'sukar', 0.5],
      [700004, 8, 25, 'sukar', 0],
      [700002, 10, 50, 'sederhana', 0.333],
      [700007, 8, 50, 'sederhana', 1],
      [700008, 8, 50, 'sederhana', 1],
      [700003, 10, 60, 'sederhana', 0.25],
      [700001, 8, 75, 'mudah', 1],
    ])
    expect(r.rows.every((x) => x.subjectName === 'Kimia' && x.textPlain !== '')).toBe(true)
  })

  it('a selected class scopes the answers to its subject; an explicit subject wins', async () => {
    const byClass = await items('?classroomId=2001')
    const explicit = await items(`?classroomId=2001&subjectId=${String(KIMIA)}`)
    expect(explicit.rows).toEqual(byClass.rows)
    const sejarah = await items('?classroomId=2002')
    expect(sejarah.rows.map((x) => x.questionId)).toEqual([700205, 700204, 700203, 700201, 700202])
    expect(sejarah.rows.every((x) => x.subjectName === 'Sejarah')).toBe(true)
    // Three pupils attempted them: not enough for a discrimination index (BR-M08-19, N ≥ 4).
    expect(sejarah.rows.every((x) => x.discrimination === null)).toBe(true)
    const kimiaFor2002 = await items(`?classroomId=2002&subjectId=${String(KIMIA)}`)
    expect(kimiaFor2002.rows).toEqual(byClass.rows)
  })

  it('"Semua Kelas" and "Semua Subjek" keep every answer of the own pupils', async () => {
    const all = await items()
    expect(all.rows).toHaveLength(13)
    expect(new Set(all.rows.map((x) => x.subjectName))).toEqual(new Set(['Kimia', 'Sejarah']))
  })

  it('filters: the 31 subjects A→Z and the own classes', async () => {
    const r = await items()
    expect(r.options.subjects).toHaveLength(31)
    const names = r.options.subjects.map((s) => s.name)
    expect(names).toEqual(
      [...names].sort((a, b) => a.localeCompare(b, 'ms', { sensitivity: 'base' })),
    )
    expect(r.options.classes.map((c) => c.id)).toEqual([2001, 2002])
  })

  it('a class that is not an own class gives no rows (FR-M11-79)', async () => {
    expect((await items('?classroomId=228')).rows).toEqual([])
    expect((await items('?classroomId=999999')).rows).toEqual([])
  })

  it('the admin has no class: no rows, no class options, the subjects are still offered', async () => {
    for (const q of ['', '?subjectId=1&classroomId=4', '?classroomId=228']) {
      const r = await items(q, ADMIN)
      expect(r.rows).toEqual([])
      expect(r.options.classes).toEqual([])
      expect(r.options.subjects).toHaveLength(31)
    }
  })

  it('bands: > 70 mudah, 40–70 sederhana, < 40 sukar', () => {
    expect([100, 70.1, 70, 40, 39.9, 0].map(bandOf)).toEqual([
      'mudah',
      'mudah',
      'sederhana',
      'sederhana',
      'sukar',
      'sukar',
    ])
  })
})

describe('the T guard (§9, M10 §7)', () => {
  const status = async (as: number | null, url: string) => (await getAs(runtime, as, url)).status

  it.each(['/api/teacher/report', '/api/teacher/item-analysis'])(
    '%s: 401 for a guest, 403 for a pupil and for the school admin, 200 for teacher and admin',
    async (url) => {
      expect(await status(null, url)).toBe(401)
      expect(await status(PELAJAR, url)).toBe(403)
      expect(await status(ADMIN_SEKOLAH, url)).toBe(403)
      expect(await status(GURU, url)).toBe(200)
      expect(await status(ADMIN, url)).toBe(200)
    },
  )
})
