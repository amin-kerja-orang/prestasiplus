/**
 * M27 S0 handler tests (SRS M27 v1.3 §7 #1, FR-M27-05…11, 13…15, 24, 30…37, BR-M27-01, 02, 12…18; AC-M27-03,
 * 06.2/06.3, 07.x, 10.x, 11.3). The real core with the owners the dashboard reads (M01, M02, M03, M04, M05,
 * M08, M09, M10) and M27, at the project clock. Figures are compared with the owners' own queries (oracle);
 * none is pinned.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import type { HttpMethod, TransportResponse } from '@/api/transport'
import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { setUser } from '@/mock/core-data/set-user'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01, { users } from '@/modules/m01-authentication/mock'
import m02, { schoolPackages, schools, schoolSubscriptions } from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m05 from '@/modules/m05-practice/mock'
import m08, { schoolPerformance } from '@/modules/m08-student-performance/mock'
import m09, { perutusan } from '@/modules/m09-content/mock'
import m10, { classrooms } from '@/modules/m10-teacher-class/mock'
import m18, { risk } from '@/modules/m18-ppd-jpn/mock'

import type { SchoolDashboard } from '../../api/dashboard'
import m27 from '../../mock'
import {
  currentSubscriptionStatus,
  gradeAtGps,
  riskTally,
  SUBSCRIPTION_LABEL,
} from '../../mock/handlers/dashboard'

const ADMIN = 1
const PELAJAR = 2
const GURU = 5
const ADMIN_SEKOLAH = 8
const AZLAN = 3102
const SUHAIMI = 3104
const URL = '/api/admin-sekolah/dashboard'
const NOW = Date.parse(CLOCK_ANCHOR_ISO)

let runtime: MockRuntime

beforeAll(async () => {
  runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m08, m09, m10, m18, m27],
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
}, 600_000)

async function call<T = unknown>(
  userId: number | null,
  url: string = URL,
  method: HttpMethod = 'GET',
): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (userId !== null) headers.authorization = `Bearer ${setUser(userId).token}`
  const res: TransportResponse = await runtime.transport.request({ method, url, headers })
  return { status: res.status, body: res.body as T }
}

async function dashboard(userId: number, url: string = URL): Promise<SchoolDashboard> {
  const r = await call<{ data: SchoolDashboard }>(userId, url)
  expect(r.status).toBe(200)
  return r.body.data
}

describe('guard SA (FR-M27-06, 07, 08, 11)', () => {
  it('answers 401 to a guest', async () => {
    expect((await call(null)).status).toBe(401)
  })

  it.each([
    ['platform admin', ADMIN],
    ['teacher', GURU],
    ['student', PELAJAR],
  ])('answers 403 to the %s', async (_name, id) => {
    expect((await call(id)).status).toBe(403)
  })

  it('answers 403 to a school admin without a school, with no school data in the body', async () => {
    const orphan = users.create(
      {
        name: 'Tanpa Sekolah',
        email: 'tanpa-sekolah@demo.test',
        role: 'school_admin',
        schoolId: null,
      },
      NOW,
    )
    const r = await call(orphan.id)
    expect(r.status).toBe(403)
    expect(JSON.stringify(r.body)).not.toMatch(/SMK|"school"|perutusan/)
  })
})

describe('scope (FR-M27-09, BR-M27-01, SEC-M27-02)', () => {
  it('uses the session school and ignores school_id in the query', async () => {
    const plain = await dashboard(AZLAN)
    const forced = await dashboard(AZLAN, `${URL}?school_id=900001&schoolId=900002`)
    expect(plain.school.id).toBe(900003)
    expect(forced).toEqual(plain)
  })

  it('answers each school admin with its own school and different figures', async () => {
    const a = await dashboard(AZLAN)
    const b = await dashboard(ADMIN_SEKOLAH)
    const c = await dashboard(SUHAIMI)
    expect([a.school.id, b.school.id, c.school.id]).toEqual([900003, 900001, 900002])
    expect(JSON.stringify(a)).not.toContain(b.school.name)
  })
})

describe('banner (FR-M27-19…21, BR-M27-03)', () => {
  it('maps name, state, PPD, code from the M02 school (stored case kept)', async () => {
    const d = await dashboard(AZLAN)
    const s = schools.get(900003)
    expect(d.roleLabel).toBe('Admin Sekolah')
    expect(d.school).toEqual({
      id: 900003,
      name: s?.name,
      state: s?.state,
      ppd: s?.district,
      code: s?.code,
    })
    expect(d.school.ppd).toMatch(/^PPD /)
  })

  it('gives null for an empty PPD and an empty code', async () => {
    const d = await dashboard(SUHAIMI)
    expect(d.school.state).toBeTruthy()
    expect(d.school.ppd).toBeNull()
    expect(d.school.code).toBeNull()
  })
})

describe('perutusan (FR-M27-13…15, BR-M27-04, 05)', () => {
  it('returns the first three visible posts of the viewer in M09 order', async () => {
    for (const [uid, schoolId] of [
      [AZLAN, 900003],
      [ADMIN_SEKOLAH, 900001],
      [SUHAIMI, 900002],
    ] as const) {
      const d = await dashboard(uid)
      const oracle = perutusan.list({ id: uid, role: 'school_admin', schoolId }).slice(0, 3)
      expect(d.perutusan.map((p) => p.id)).toEqual(oracle.map((p) => p.id))
      expect(d.perutusan.length).toBeLessThanOrEqual(3)
      for (const row of d.perutusan) {
        expect(row.author.initials).toMatch(/^[A-Z]{1,2}$/)
        expect(row.author.roleLabel).toBeTruthy()
        expect(Object.keys(row).sort()).toEqual(['author', 'createdAt', 'id', 'title'])
      }
    }
  })

  it('carries no post the viewer may not see', async () => {
    const d = await dashboard(AZLAN)
    const visible = new Set(
      perutusan.list({ id: AZLAN, role: 'school_admin', schoolId: 900003 }).map((p) => p.id),
    )
    for (const row of d.perutusan) expect(visible.has(row.id)).toBe(true)
    const b = await dashboard(ADMIN_SEKOLAH)
    const own = new Set(d.perutusan.map((p) => p.id))
    const school900001Only = b.perutusan.filter((p) => !visible.has(p.id))
    for (const row of school900001Only) expect(own.has(row.id)).toBe(false)
  })
})

describe('cards (FR-M27-24, BR-M27-12, 13)', () => {
  it.each([
    [AZLAN, 900003],
    [ADMIN_SEKOLAH, 900001],
    [SUHAIMI, 900002],
  ])('equal the owners counts for school %#', async (uid, schoolId) => {
    const d = await dashboard(uid)
    expect(d.cards.pupils).toBe(users.adminList({ role: 'student', schoolId, pageSize: 1 }).total)
    expect(d.cards.teachers).toBe(users.adminList({ role: 'teacher', schoolId, pageSize: 1 }).total)
    expect(d.cards.activeClasses).toBe(classrooms.list({ isActive: true, schoolId }).length)
  })
})

describe('LANGGANAN (FR-M27-30, BR-M27-14)', () => {
  it('reads "Belum Ada" under the default seed for the fixture schools', async () => {
    for (const uid of [AZLAN, ADMIN_SEKOLAH, SUHAIMI]) {
      const d = await dashboard(uid)
      expect(d.cards.subscription).toEqual({ status: 'none', label: 'Belum Ada' })
    }
  })

  it('has the M02 BR-23 labels', () => {
    expect(SUBSCRIPTION_LABEL).toEqual({
      none: 'Belum Ada',
      active: 'Aktif',
      grace: 'Tempoh Ihsan',
      expired: 'Tamat',
    })
  })

  it('reads "Aktif" once the school has an active subscription in its period', async () => {
    expect(currentSubscriptionStatus(900003, NOW)).toBe('none')
    const pkg = schoolPackages.all()
    const template = pkg[0]
    if (!template) throw new Error('no M02 package seeded')
    schoolSubscriptions.create(
      {
        schoolId: 900003,
        schoolPackageId: template.id,
        packageTier: 'full',
        studentQuota: 10,
        paymentReference: null,
        paymentNotes: null,
      },
      NOW,
    )
    expect(currentSubscriptionStatus(900003, NOW)).toBe('active')
    const d = await dashboard(AZLAN)
    expect(d.cards.subscription).toEqual({ status: 'active', label: 'Aktif' })
    // an active row whose period has lapsed is not current: it reads "Tamat" (BR-M27-14, DL decision)
    expect(currentSubscriptionStatus(900003, NOW + 3 * 366 * 86_400_000)).toBe('expired')
  })

  it('reads "Belum Ada" for a school with only a cancelled row (anchor 8228)', () => {
    expect(schoolSubscriptions.forSchool(8228).map((r) => r.status)).toEqual(['cancelled'])
    expect(currentSubscriptionStatus(8228, NOW)).toBe('none')
  })

  it('reads "Tamat" for a school whose row is expired (anchor 8107)', () => {
    expect(schoolSubscriptions.forSchool(8107).some((r) => r.status === 'expired')).toBe(true)
    expect(currentSubscriptionStatus(8107, NOW)).toBe('expired')
  })
})

describe('performance (FR-M27-32…37, BR-M27-15…18)', () => {
  it.each([
    [AZLAN, 900003],
    [SUHAIMI, 900002],
  ])('equals M08 schoolPerformance for school %#', async (uid, schoolId) => {
    const d = await dashboard(uid)
    const perf = schoolPerformance({ kind: 'school', schoolId }, 2026)
    const p = d.performance
    expect(p.gps.value).toBe(perf.gps.value)
    expect(p.gps.band).toBe(perf.gps.band)
    expect(p.gps.entries).toBe(perf.gps.entries)
    expect(p.practice.sessions).toBe(perf.stats.sessions)
    expect(p.practice.questions).toBe(perf.stats.answered)
    expect(p.practice.accuracy).toBe(perf.stats.sessions === 0 ? null : perf.stats.accuracy)
    expect(p.levels.map((l) => [l.code, l.name, l.accuracy])).toEqual(
      perf.levels.map((l) => [l.code, l.code === 't4' ? 'Tingkatan 4' : 'Tingkatan 5', l.accuracy]),
    )
    expect(p.distribution.map((g) => g.grade)).toEqual([
      'A+',
      'A',
      'A-',
      'B+',
      'B',
      'C+',
      'C',
      'D',
      'E',
      'G',
    ])
    expect(p.distribution).toEqual(
      perf.distribution.map((g) => ({ grade: g.grade, count: g.count, pct: g.pct })),
    )
    expect(p.total).toBe(perf.distribution.reduce((s, g) => s + g.count, 0))
  })

  it('shows no-data states for a school without headcount or sessions (BR-M27-18)', async () => {
    const d = await dashboard(AZLAN)
    const p = d.performance
    if (p.gps.entries === 0) {
      expect(p.gps).toEqual({ value: null, grade: null, band: null, entries: 0 })
      expect(p.total).toBe(0)
    }
    if (p.practice.sessions === 0) expect(p.practice.accuracy).toBeNull()
    expect(p.levels).toHaveLength(2)
    expect(p.distribution).toHaveLength(10)
  })

  it('hides the panel (risk null) when no M18 read is given', () => {
    expect(riskTally(undefined, 900003, NOW)).toBeNull()
  })

  it.each([
    [AZLAN, 900003],
    [1214, 8078],
  ])(
    'equals the M18 risk read for school %#',
    async (uid, schoolId) => {
      const d = await dashboard(uid)
      const owner = risk.forSchool(schoolId, { now: NOW })
      expect(d.performance.risk).toEqual({
        safe: owner.onTrack,
        watch: owner.watch,
        high: owner.high,
        total: owner.total,
      })
      const r = d.performance.risk
      expect(r && r.safe + r.watch + r.high).toBe(r?.total)
    },
    300_000,
  )

  it('maps the M18 tally explicitly: onTrack is "Selamat", the tally equals total (XR-M27-08)', () => {
    const calls: unknown[][] = []
    const stub = {
      forSchool: (...args: unknown[]) => {
        calls.push(args)
        return { total: 14, onTrack: 7, watch: 5, high: 2 }
      },
    }
    const tally = riskTally(stub, 900003, NOW)
    expect(tally).toEqual({ safe: 7, watch: 5, high: 2, total: 14 })
    expect(tally && tally.safe + tally.watch + tally.high).toBe(tally?.total)
    expect(calls).toEqual([[900003, { now: NOW }]])
  })

  it('derives the GPS grade at round(GPS) half up (BR-M08-04)', () => {
    expect(gradeAtGps(3.17)).toBe('B+')
    expect(gradeAtGps(0)).toBe('A+')
    expect(gradeAtGps(0.49)).toBe('A+')
    expect(gradeAtGps(0.5)).toBe('A')
    expect(gradeAtGps(2.5)).toBe('B+')
    expect(gradeAtGps(6.5)).toBe('D')
    expect(gradeAtGps(9)).toBe('G')
    expect(gradeAtGps(12)).toBe('G')
  })
})

describe('populated school (NFR-M27-01)', () => {
  it('answers for a school with sessions and headcount entries (anchor 8078)', async () => {
    const t0 = performance.now()
    const d = await dashboard(1214)
    const took = performance.now() - t0
    console.log(`M27 S0 8078 took ${took.toFixed(0)} ms`)
    expect(d.school.id).toBe(8078)
    expect(d.performance.practice.sessions).toBeGreaterThan(0)
    expect(d.performance.practice.accuracy).not.toBeNull()
    expect(d.performance.total).toBe(d.performance.gps.entries)
    // the time is the M08 `schoolPerformance` owner computation for ~thousands of pupils (reported, not asserted)
  }, 300_000)
})
