/**
 * M27-T0d: the pure builder `buildStatsReport(range, { schoolId })` (M17 S11 `StatsReport`, XR-M27-15).
 *
 * Platform scope reproduces the observed S11 figures that the owners' datasets reproduce (pupils, logins,
 * teachers, Q-TEACHER-CONTRIB, teacher wallets, battles, games, the last trend point). Figures the SRS pins
 * but the owners do not reproduce yet (practised 1,642, activity 423 / 1,431 / 5,931, structured 3 / 13 / 954,
 * "Pelajar Paling Aktif") are NOT asserted here; they are reported as gaps. School scope is checked against
 * independent reads of the owners (users, M05 session totals).
 */

import { mkdirSync, writeFileSync } from 'node:fs'

import { beforeAll, describe, expect, it } from 'vitest'

import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { listDisplayConstants } from '@/mock/dataset'
import { bootMock } from '@/mock/index'
import { users } from '@/modules/m01-authentication/mock'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m05, { practice } from '@/modules/m05-practice/mock'
import m07 from '@/modules/m07-pksk/mock'
import m08 from '@/modules/m08-student-performance/mock'
import m10 from '@/modules/m10-teacher-class/mock'
import m11 from '@/modules/m11-teacher-analytics/mock'
import m12 from '@/modules/m12-kirkpatrick/mock'
import m14 from '@/modules/m14-gamification/mock'
import m16 from '@/modules/m16-battle-games/mock'

import m17, { buildStatsReport, normaliseRange, type StatsReport } from '../../mock'

const DUMP_DIR = process.env.M27_T0D_DUMP

let platform: StatsReport
let platformMs = 0

beforeAll(async () => {
  await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m07, m08, m10, m11, m12, m14, m16, m17],
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
  buildStatsReport(30) // warm-up (answer index, facts)
  const t = performance.now()
  platform = buildStatsReport(30)
  platformMs = performance.now() - t
}, 900_000)

const sum = (r: StatsReport): number => r.trend.reduce((a, p) => a + p.value, 0)

describe('range handling (FR-M17-87)', () => {
  it('accepts 7, 30, 90 and falls back to 30', () => {
    expect([7, 30, 90, '7', '90'].map(normaliseRange)).toEqual([7, 30, 90, 7, 90])
    expect([0, 14, 'abc', undefined, null, 365].map(normaliseRange)).toEqual([30, 30, 30, 30, 30, 30])
  })
})

describe('platform scope: observed figures reproduced from the datasets', () => {
  it('overview populations and logins (Q-M17-PUPILS, TEACHERS, *-LOGGED)', () => {
    expect(platform.range).toBe(30)
    expect(platform.schoolId).toBeNull()
    expect(platform.overview).toMatchObject({
      pupils: 3152,
      pupilsLogged: 1708,
      teachers: 502,
      teachersLogged: 269,
      score: 44.6,
      structuredScore: 6.7,
    })
  })

  it('teacher tiles: Q-TEACHER-CONTRIB 11,414 and the teacher wallet sum 63,459', () => {
    expect(platform.tiles.teachers).toEqual({
      total: 502,
      logged: 269,
      questions: 11414,
      coins: 63459,
    })
    expect(platform.teachers).toHaveLength(502)
    expect(platform.teachersNeverLogged).toHaveLength(20)
  })

  it('breakdown, trend and total are one definition (DV-M17-16)', () => {
    const b = platform.breakdown
    expect(platform.overview.activity).toBe(b.quiz + b.structured + b.battle + b.game)
    expect(sum(platform)).toBe(platform.overview.activity)
    expect(platform.trend).toHaveLength(30)
    expect(platform.trend[29]?.label).toBe('25/09')
    expect(platform.trend[29]?.value).toBe(17)
    expect(platform.trend[0]?.label).toBe('27/08')
  })

  it('battles and games of the ranges (Q-M17-BATTLES) and the trend lengths', () => {
    const r7 = buildStatsReport(7)
    const r90 = buildStatsReport(90)
    expect([r7.trend.length, r90.trend.length]).toEqual([7, 90])
    expect([platform.breakdown.battle, platform.breakdown.game]).toEqual([4, 5])
    expect([r90.breakdown.battle, r90.breakdown.game]).toEqual([23, 47])
    expect(r7.breakdown.battle + r7.breakdown.game).toBe(0)
    for (const r of [r7, platform, r90]) expect(sum(r)).toBe(r.overview.activity)
    // Wider windows never lose activity.
    expect(r7.overview.activity).toBeLessThanOrEqual(platform.overview.activity)
    expect(platform.overview.activity).toBeLessThanOrEqual(r90.overview.activity)
  })

  it('lists obey their limits and orders (BR-M17-22)', () => {
    expect(platform.topPupils.length).toBeLessThanOrEqual(10)
    const acts = platform.topPupils.map((p) => p.activities)
    expect(acts).toEqual([...acts].sort((a, b) => b - a))
    const names = platform.teachersNeverLogged.map((t) => t.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    for (const t of platform.teachersNeverLogged) {
      expect(users.get(t.userId)?.lastLoginAt).toBeNull()
    }
    const { aktif, loginSahaja, belumLogin, semua } = platform.pupils
    for (const list of [aktif, loginSahaja, belumLogin, semua]) {
      expect(list.length).toBeLessThanOrEqual(200)
    }
    const sessions = aktif.map((p) => p.sessions)
    expect(sessions).toEqual([...sessions].sort((a, b) => b - a))
    expect(aktif.every((p) => p.sessions > 0)).toBe(true)
    expect(loginSahaja.every((p) => p.lastLoginAt !== null && p.sessions === 0)).toBe(true)
    expect(belumLogin.every((p) => p.lastLoginAt === null && p.sessions === 0)).toBe(true)
    for (const p of [...aktif, ...loginSahaja, ...belumLogin]) {
      expect(p.accuracy).toBeLessThanOrEqual(100)
    }
  })

  it('pupil tiles are computed over the Aktif rows (FR-M17-95)', () => {
    const t = platform.tiles.pupils
    expect(t.total).toBe(3152)
    expect(t.practised).toBe(platform.pupils.aktif.length)
    expect(t.sessions).toBe(platform.pupils.aktif.reduce((a, p) => a + p.sessions, 0))
    expect(t.accuracy).toBeGreaterThan(0)
    expect(t.accuracy).toBeLessThanOrEqual(100)
  })

  it('Sekolah tab: fixture schools out, order Aktif first, tiles equal the rows', () => {
    const rows = platform.schools
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((s) => s.schoolId < 900001 || s.schoolId > 900099)).toBe(true)
    const firstOther = rows.findIndex((s) => s.status !== 'aktif')
    expect(rows.slice(0, firstOther === -1 ? rows.length : firstOther).every((s) => s.status === 'aktif')).toBe(true)
    const count = (k: string): number => rows.filter((s) => s.status === k).length
    expect(platform.tiles.schools).toEqual({ aktif: count('aktif'), kurang: count('kurang'), tidak: count('tidak') })
    for (const s of rows) {
      expect(s.questions.total).toBe(s.questions.mcq + s.questions.structured)
      expect(s.teachersLogged).toBeLessThanOrEqual(s.teachers)
    }
  })

  it('DC-M17-06 is registered as a display constant', () => {
    const c = listDisplayConstants().find((x) => x.module === 'M17' && x.name === 'statsScore')
    expect(c?.value).toBe('44.6|6.7')
  })

  it('performance budget: a warm platform build is well under 10 s', () => {
    expect(platformMs).toBeLessThan(10_000)
  })
})

describe('school scope (XR-M27-15, BR-M27-26)', () => {
  const PUPIL_SCHOOL = 900001 // P2: fixture school with pupils and one teacher
  const EMPTY_SCHOOL = 900003

  const active = (role: 'student' | 'teacher', schoolId: number) =>
    users.adminList({ role, schoolId, isActive: true, page: 1, pageSize: 100_000 }).rows

  it('P2 school 900001: counts equal the users store and M05 session totals', () => {
    const r = buildStatsReport(30, { schoolId: PUPIL_SCHOOL })
    const pupils = active('student', PUPIL_SCHOOL)
    const teachers = active('teacher', PUPIL_SCHOOL)
    expect(r.schoolId).toBe(PUPIL_SCHOOL)
    expect(r.overview.pupils).toBe(pupils.length)
    expect(r.overview.teachers).toBe(teachers.length)
    expect(r.overview.pupilsLogged).toBe(pupils.filter((u) => u.lastLoginAt !== null).length)
    expect(r.overview.teachersLogged).toBe(teachers.filter((u) => u.lastLoginAt !== null).length)
    const totals = practice.sessionTotals(pupils.map((u) => u.id))
    const sessions = pupils.reduce((a, u) => a + (totals.get(u.id)?.all.sessions ?? 0), 0)
    expect(r.tiles.pupils.sessions).toBeLessThanOrEqual(sessions)
    expect(r.overview.practised).toBe(pupils.filter((u) => (totals.get(u.id)?.all.sessions ?? 0) > 0).length)
    expect(r.teachers).toHaveLength(teachers.length)
    expect(r.teachers.every((t) => t.schoolName !== undefined)).toBe(true)
  })

  it('removes the platform-only parts: no schools table, no score, no foreign pupil or teacher', () => {
    const r = buildStatsReport(90, { schoolId: PUPIL_SCHOOL })
    expect(r.schools).toEqual([])
    expect(r.overview.score).toBeNull()
    expect(r.overview.structuredScore).toBeNull()
    const ids = new Set(active('student', PUPIL_SCHOOL).map((u) => u.id))
    const all = [...r.pupils.semua, ...r.pupils.aktif, ...r.pupils.loginSahaja, ...r.pupils.belumLogin]
    expect(all.every((p) => ids.has(p.userId))).toBe(true)
    expect(r.topPupils.every((p) => ids.has(p.userId))).toBe(true)
    const tids = new Set(active('teacher', PUPIL_SCHOOL).map((u) => u.id))
    expect([...r.teachers, ...r.teachersNeverLogged].every((t) => tids.has(t.userId))).toBe(true)
    expect(sum(r)).toBe(r.overview.activity)
    expect(r.trend).toHaveLength(90)
  })

  it('school Jumlah Soalan is school-scoped (M04 teacherContributions(schoolId))', () => {
    const r = buildStatsReport(30, { schoolId: 8087 })
    expect(r.tiles.teachers.questions).toBe(1368 + 1064)
    expect(r.schools).toEqual([])
  })

  it('empty school 900003: zero and empty states, no error', () => {
    const r = buildStatsReport(30, { schoolId: EMPTY_SCHOOL })
    expect(r.overview).toEqual({
      pupils: 0,
      pupilsLogged: 0,
      teachers: 0,
      teachersLogged: 0,
      practised: 0,
      activity: 0,
      score: null,
      structuredScore: null,
    })
    expect(r.breakdown).toEqual({ quiz: 0, structured: 0, battle: 0, game: 0 })
    expect(r.trend).toHaveLength(30)
    expect(r.trend.every((p) => p.value === 0)).toBe(true)
    expect(r.topPupils).toEqual([])
    expect(r.teachersNeverLogged).toEqual([])
    expect(r.teachers).toEqual([])
    expect(r.pupils).toEqual({ semua: [], aktif: [], loginSahaja: [], belumLogin: [] })
    expect(r.tiles.pupils).toEqual({ total: 0, practised: 0, sessions: 0, accuracy: 0 })
    expect(r.tiles.teachers).toEqual({ total: 0, logged: 0, questions: 0, coins: 0 })
  })

  it('an unknown school id behaves as an empty school', () => {
    const r = buildStatsReport(30, { schoolId: 999_999_999 })
    expect(r.overview.pupils).toBe(0)
    expect(r.schools).toEqual([])
  })

  it('a school build is fast (budget 5 s)', () => {
    const t = performance.now()
    buildStatsReport(30, { schoolId: 8080 })
    expect(performance.now() - t).toBeLessThan(5_000)
  })
})

describe('diagnostic dump', () => {
  it.skipIf(!DUMP_DIR)('writes the figures the SRS pins but the owners do not reproduce', () => {
    mkdirSync(DUMP_DIR as string, { recursive: true })
    const r7 = buildStatsReport(7)
    const r90 = buildStatsReport(90)
    writeFileSync(
      `${DUMP_DIR as string}/dump.json`,
      JSON.stringify(
        {
          overview: platform.overview,
          breakdown: { 7: r7.breakdown, 30: platform.breakdown, 90: r90.breakdown },
          totals: { 7: r7.overview.activity, 30: platform.overview.activity, 90: r90.overview.activity },
          tr7: r7.trend.map((p) => p.value),
          top: platform.topPupils.map((p) => p.activities),
          tiles: platform.tiles,
          t5316: platform.teachers.find((t) => t.userId === 5316),
          t4202: platform.teachers.find((t) => t.userId === 4202),
          schools: platform.schools.slice(0, 5),
          pupil: platform.pupils.aktif.slice(0, 2),
          platformMs,
        },
        null,
        1,
      ),
    )
  })
})
