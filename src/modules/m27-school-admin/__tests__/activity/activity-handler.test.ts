/**
 * M27-T1c: `GET /api/admin-sekolah/laporan-aktiviti` (S3; SRS Part B §19 #4, FR-M27-66 to 73, BR-M27-26).
 * The figures are compared with the M17 builder in the school scope (oracle); none is pinned.
 * P2 = school admin 8 of school 900001 (populated); P1 = school admin 3102 of school 900003 (empty).
 */

import { beforeAll, describe, expect, it } from 'vitest'

import type { HttpMethod, TransportResponse } from '@/api/transport'
import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { setUser } from '@/mock/core-data/set-user'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01, { users } from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m05 from '@/modules/m05-practice/mock'
import m07 from '@/modules/m07-pksk/mock'
import m08 from '@/modules/m08-student-performance/mock'
import m09 from '@/modules/m09-content/mock'
import m10 from '@/modules/m10-teacher-class/mock'
import m11 from '@/modules/m11-teacher-analytics/mock'
import m12 from '@/modules/m12-kirkpatrick/mock'
import m14 from '@/modules/m14-gamification/mock'
import m16 from '@/modules/m16-battle-games/mock'
import m17, { buildStatsReport } from '@/modules/m17-admin-dashboard/mock'

import type { SchoolActivityReport } from '../../api/school-admin'
import m27 from '../../mock'

const ADMIN = 1
const PELAJAR = 2
const GURU = 5
const P1 = 3102
const P2 = 8
const S1 = 900001
const S3 = 900003
const URL = '/api/admin-sekolah/laporan-aktiviti'

let runtime: MockRuntime

beforeAll(async () => {
  runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m07, m08, m09, m10, m11, m12, m14, m16, m17, m27],
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
}, 900_000)

async function call(userId: number | null, url: string, method: HttpMethod = 'GET') {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (userId !== null) headers.authorization = `Bearer ${setUser(userId).token}`
  const res: TransportResponse = await runtime.transport.request({ method, url, headers })
  return { status: res.status, body: res.body as { data: SchoolActivityReport } }
}

async function report(userId: number, query = ''): Promise<SchoolActivityReport> {
  const r = await call(userId, `${URL}${query}`)
  expect(r.status).toBe(200)
  return r.body.data
}

describe('P2 school 900001 (populated)', () => {
  it('equals the M17 builder in the school scope for every range', async () => {
    for (const range of [7, 30, 90] as const) {
      const got = await report(P2, `?range=${String(range)}`)
      const oracle = buildStatsReport(range, { schoolId: S1, includeInactive: true })
      expect(got.range).toBe(range)
      expect(got.schoolId).toBe(S1)
      expect(got.overview).toEqual({
        pupils: oracle.overview.pupils,
        pupilsLogged: oracle.overview.pupilsLogged,
        teachers: oracle.overview.teachers,
        teachersLogged: oracle.overview.teachersLogged,
        practised: oracle.overview.practised,
        activity: oracle.overview.activity,
      })
      expect(got.trend).toEqual(oracle.trend)
      expect(got.breakdown).toEqual(oracle.breakdown)
      expect(got.topPupils).toEqual(oracle.topPupils)
      expect(got.teachersNeverLogged).toEqual(oracle.teachersNeverLogged)
      expect(got.tiles).toEqual({ teachers: oracle.tiles.teachers, pupils: oracle.tiles.pupils })
      expect(got.pupils.semua.map((p) => p.userId)).toEqual(
        oracle.pupils.semua.map((p) => p.userId),
      )
      expect(got.pupils.aktif.map((p) => p.userId)).toEqual(
        oracle.pupils.aktif.map((p) => p.userId),
      )
      expect(got.teachers.map((t) => t.userId)).toEqual(oracle.teachers.map((t) => t.userId))
    }
  })

  it('is populated and carries no platform-only figure', async () => {
    const got = await report(P2)
    expect(got.overview.pupils).toBeGreaterThan(0)
    expect(got.overview.teachers).toBeGreaterThan(0)
    const raw = got as unknown as Record<string, unknown>
    expect(raw.schools).toBeUndefined()
    expect(raw.overview).not.toHaveProperty('score')
    expect(raw.overview).not.toHaveProperty('structuredScore')
    expect(raw.tiles).not.toHaveProperty('schools')
    for (const row of [...got.pupils.semua, ...got.teachers]) {
      expect(row).not.toHaveProperty('schoolName')
    }
    expect(JSON.stringify(got)).not.toMatch(/keseluruhan platform|seluruh platform/)
  })

  it('confines every list to the school and ignores a school id in the request', async () => {
    const own = await report(P2)
    const spoofed = await report(P2, `?schoolId=${String(S3)}&range=30`)
    expect(spoofed.schoolId).toBe(S1)
    expect(spoofed.overview).toEqual(own.overview)
    expect(own.pupils.semua.length).toBeLessThanOrEqual(200)
    expect(own.topPupils.length).toBeLessThanOrEqual(10)
    expect(own.teachersNeverLogged.length).toBeLessThanOrEqual(20)
    const oracleIds = new Set(
      buildStatsReport(30, { schoolId: S1, includeInactive: true }).pupils.semua.map(
        (p) => p.userId,
      ),
    )
    for (const p of own.pupils.semua) expect(oracleIds.has(p.userId)).toBe(true)
  })
})

describe('P1 school 900003 (empty)', () => {
  it('answers zeros and empty lists', async () => {
    const got = await report(P1)
    expect(got.schoolId).toBe(S3)
    expect(got.overview).toEqual({
      pupils: 0,
      pupilsLogged: 0,
      teachers: 0,
      teachersLogged: 0,
      practised: 0,
      activity: 0,
    })
    expect(got.breakdown).toEqual({ quiz: 0, structured: 0, battle: 0, game: 0 })
    expect(got.trend.every((p) => p.value === 0)).toBe(true)
    expect(got.topPupils).toEqual([])
    expect(got.teachersNeverLogged).toEqual([])
    expect(got.teachers).toEqual([])
    expect(got.pupils).toEqual({ semua: [], aktif: [], loginSahaja: [], belumLogin: [] })
    expect(got.tiles.teachers).toMatchObject({ total: 0, logged: 0, questions: 0, coins: 0 })
    expect(got.tiles.pupils).toMatchObject({ total: 0, practised: 0, sessions: 0 })
  })
})

describe('range normalisation (FR-M27-66)', () => {
  it('accepts 7, 30, 90 and gives 30 otherwise', async () => {
    expect((await report(P1, '?range=7')).range).toBe(7)
    expect((await report(P1, '?range=90')).range).toBe(90)
    for (const q of ['', '?range=5', '?range=abc', '?range=', '?range=365', '?range=0']) {
      expect((await report(P1, q)).range, q).toBe(30)
    }
    expect((await report(P1, '?range=7')).trend.length).toBeLessThan(
      (await report(P1, '?range=90')).trend.length,
    )
  })
})

describe('guards', () => {
  it('401 for a guest', async () => {
    expect((await call(null, URL)).status).toBe(401)
  })

  it('403 for admin, teacher and pupil', async () => {
    for (const id of [ADMIN, GURU, PELAJAR]) {
      expect((await call(id, URL)).status, String(id)).toBe(403)
    }
  })

  it('403 for a school admin without a school', async () => {
    const orphan = (
      m02.hooks as { seedSchoolAdminWithoutSchool(): { id: number } }
    ).seedSchoolAdminWithoutSchool()
    expect((await call(orphan.id, URL)).status).toBe(403)
  })
})

describe('population counts inactive accounts (BR-M27-26)', () => {
  it('an inactive teacher of 900001 is in the S3 teacher total and equals the S7 total', async () => {
    const before = await report(P2)
    const t = users.create(
      {
        name: 'Guru Tidak Aktif',
        email: 'guru.tidak.aktif@demo.test',
        role: 'teacher',
        schoolId: S1,
      },
      Date.parse(CLOCK_ANCHOR_ISO),
    )
    const after = await report(P2)
    expect(after.overview.teachers).toBe(before.overview.teachers + 1)
    users.update(t.id, { isActive: false }, Date.parse(CLOCK_ANCHOR_ISO))
    const inactive = await report(P2)
    expect(inactive.overview.teachers).toBe(before.overview.teachers + 1)
    const s7 = await call(P2, '/api/admin-sekolah/guru')
    const meta = (s7.body as unknown as { meta: { totalItems: number } }).meta
    expect(inactive.overview.teachers).toBe(meta.totalItems)
    // The platform scope of the M17 builder is unchanged (active only) without the option.
    expect(buildStatsReport(30, { schoolId: S1 }).overview.teachers).toBe(before.overview.teachers)
  })
})
