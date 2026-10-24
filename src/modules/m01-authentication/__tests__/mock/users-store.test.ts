/**
 * F-23 users store (owner M01; M02 SRS v1.23 §6.14, §6.15 B–D): every build-check total and named
 * query, the M17 pins outside the fixture schools, every anchor at its placement (incl. the v1.22
 * M19 payers and the v1.23 moves), the pools, the per-school pupil counts (DV-M02-15), the seeded
 * `lastActiveAt` dates, the canonical accounts, the secrets (never in the persisted diff) and the
 * repository contract.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { createClock } from '@/lib/time'
import { CANONICAL_ACCOUNTS } from '@/mock/core-data/accounts'
import { checkNamedQueries } from '@/mock/dataset'
import { bootMock, type MockRuntime } from '@/mock/index'
import { repositoryInfo } from '@/mock/repository'

import plugin, { users, type UserRow } from '../../mock'
import { M19_PAYERS, USER_ANCHOR_BLOCKS, USER_ANCHOR_ROWS } from '../../mock/datasets/users-anchors'
import {
  M11_REGISTER,
  M11_TEACHERS,
  S11_PUPILS_HOLDING,
  S11_PUPILS_SHORT,
  USED_PUPILS,
  USERS_BY_ROLE,
} from '../../mock/datasets/users-spec'
import { userQueries } from '../../mock/repository/users'
import {
  BATANG_PADANG_LOGINS,
  checkUsersDataset,
  M18_ACTIVITY_COUNTS,
  M18_PUPILS_PER_SCHOOL,
} from '../../mock/repository/users-check'

const NOW = '2026-09-25T15:40:00+08:00'
const OTHER_ROLES = [
  'parent',
  'sponsor',
  'school_admin',
  'ppd_officer',
  'jpn_officer',
  'admin',
  'unmapped',
] as const

let runtime: MockRuntime

beforeAll(async () => {
  runtime = await bootMock({
    mode: 'test',
    clock: createClock({ at: NOW }),
    latencyMs: 0,
    onWarn: null,
  })
}, 60_000)

function u(id: number): UserRow {
  const row = users.get(id)
  if (!row) throw new Error(`no user ${String(id)}`)
  return row
}

const count = (where: Parameters<typeof users.countWhere>[0]) => users.countWhere(where)
const outside = (where: Parameters<typeof users.countWhere>[0]) =>
  users.outsideFixtureSchools(where)

describe('users dataset: build check (M02 §6.15, v1.23)', () => {
  it('passes the boot build check with no issue', () => {
    expect(checkUsersDataset()).toEqual([])
    expect(checkNamedQueries(userQueries)).toEqual([])
  })

  it('reports the live totals by role, activity and complimentary flag', () => {
    expect(users.count('U-ALL')).toBe(5159)
    for (const [role, n] of Object.entries(USERS_BY_ROLE)) {
      expect(users.count('U-ROLE', role as never), role).toBe(n)
    }
    expect(users.count('U-INACTIVE')).toBe(1432)
    expect(users.count('U-ACTIVE')).toBe(3727)
    // All accounts (v1.20): students 3,162 / 1,371, teachers 503 / 48.
    expect(users.count('U-ROLE-ACTIVE', 'student', true)).toBe(3162)
    expect(users.count('U-ROLE-ACTIVE', 'student', false)).toBe(1371)
    expect(users.count('U-ROLE-ACTIVE', 'teacher', true)).toBe(503)
    expect(users.count('U-ROLE-ACTIVE', 'teacher', false)).toBe(48)
    expect(users.count('U-FIXTURE-SCHOOLS', 'student')).toBe(10)
    expect(users.count('U-FIXTURE-SCHOOLS', 'teacher')).toBe(1)
    expect(users.count('U-COMP')).toBe(90)
    expect(users.roleCounts()).toEqual({
      student: 4533,
      teacher: 551,
      parent: 38,
      sponsor: 6,
      schoolAdmin: 16,
      ppdOfficer: 5,
      admin: 2,
    })
    // The 6 unmapped users count in the total but match no role filter (D9).
    const sumOfRoleCards = Object.values(users.roleCounts()).reduce((a, b) => a + b, 0)
    expect(sumOfRoleCards + count({ role: 'jpn_officer' })).toBe(5153)
  })

  it('holds the M17 pins on the populations outside the fixture schools (v1.20)', () => {
    expect(outside({ role: 'student', isActive: true })).toBe(3152)
    expect(outside({ role: 'student', isActive: false })).toBe(1371)
    expect(outside({ role: 'teacher', isActive: true })).toBe(502)
    expect(outside({ role: 'teacher', isActive: false })).toBe(48)
    expect(outside({ role: [...OTHER_ROLES], isActive: false })).toBe(13)
    expect(outside({ role: [...OTHER_ROLES], isActive: true })).toBe(
      count({ role: [...OTHER_ROLES], isActive: true }) -
        count({ role: [...OTHER_ROLES], schoolId: { gte: 900_001, lte: 900_099 } }),
    )
    expect(outside({ role: 'student', isActive: true, hasLoggedIn: true })).toBe(1708)
    expect(outside({ role: 'teacher', isActive: true, hasLoggedIn: true })).toBe(269)
    // 289 = 277 register + 12 without a school (1919, 4401, 5306–5315); teacher 5 excluded.
    expect(outside({ role: 'teacher', hasLoggedIn: true })).toBe(289)
    expect(count({ role: 'teacher', hasLoggedIn: true, schoolId: { isNull: true } })).toBe(12)
    expect(count({ role: 'teacher', schoolId: [null, 900_001] })).toBe(29)
  })

  it('reproduces the M11 register (4,158 · 1,666 / 2,492 · 522 / 277) per school', () => {
    expect(users.count('Q-M11-T45')).toBe(4158)
    expect(users.count('Q-M11-T45-LOGGED', true)).toBe(1666)
    expect(users.count('Q-M11-T45-LOGGED', false)).toBe(2492)
    expect(users.count('Q-M11-TEACHERS')).toBe(522)
    expect(users.count('Q-M11-TEACHERS-LOGGED')).toBe(277)
    for (const [school, t4, t5, aktif, loginOnly, , awl] of M11_REGISTER) {
      expect(count({ role: 'student', schoolId: school, grade: 10 }), `${school} T4`).toBe(t4)
      expect(count({ role: 'student', schoolId: school, grade: 11 }), `${school} T5`).toBe(t5)
      expect(
        count({ role: 'student', schoolId: school, grade: [10, 11], hasLoggedIn: true }),
        `${school} logged in`,
      ).toBe(aktif - awl + loginOnly)
      expect(users.count('Q-M11-T45', school)).toBe(t4 + t5)
    }
    for (const [school, t, tl] of M11_TEACHERS) {
      expect(users.count('Q-M11-TEACHERS', school), `${school} teachers`).toBe(t)
      expect(count({ role: 'teacher', schoolId: school, hasLoggedIn: true })).toBe(tl)
    }
  })

  it('counts every pupil of a school, active or not (DV-M02-15): the 12 BR-24 used values', () => {
    for (const [school, used] of Object.entries(USED_PUPILS)) {
      expect(count({ role: 'student', schoolId: Number(school) }), `used ${school}`).toBe(used)
    }
  })

  it('reproduces the M17 S11 "Murid" rows that hold (v1.23) and documents the six short ones', () => {
    for (const [school, pupils] of Object.entries(S11_PUPILS_HOLDING)) {
      expect(count({ role: 'student', schoolId: Number(school) }), `S11 ${school}`).toBe(pupils)
    }
    let shortBy = 0
    for (const [school, [live, rebuild]] of Object.entries(S11_PUPILS_SHORT)) {
      expect(count({ role: 'student', schoolId: Number(school) }), `short ${school}`).toBe(rebuild)
      shortBy += live - rebuild
    }
    expect(shortBy).toBe(70)
  })

  it('places the students of §6.15 C (4,533) and the M18 pupils per school', () => {
    // 900001 = canonical 2 and 4 (D54) + 3001–3008; 900002 and 900004 hold no pupil.
    expect(count({ role: 'student', schoolId: 900_001 })).toBe(10)
    expect(count({ role: 'student', schoolId: 900_002 })).toBe(0)
    expect(count({ role: 'student', schoolId: 900_004 })).toBe(0)
    expect(count({ schoolId: 987 })).toBe(2)
    for (const [school, n] of Object.entries(M18_PUPILS_PER_SCHOOL)) {
      expect(count({ role: 'student', schoolId: Number(school) }), `M18 ${school}`).toBe(n)
    }
    for (const [school, [logged, never]] of Object.entries(BATANG_PADANG_LOGINS)) {
      expect(count({ role: 'student', schoolId: Number(school), hasLoggedIn: true })).toBe(logged)
      expect(count({ role: 'student', schoolId: Number(school), hasLoggedIn: false })).toBe(never)
    }
    // No school (v1.23): 3, 3105–3109 (6) + mirror 137 + pool 75 + M16 4316, 4317 = 220.
    expect(count({ role: 'student', schoolId: { isNull: true } })).toBe(220)
    // v1.19–v1.22 students.
    expect(count({ role: 'student', schoolId: 8228 })).toBe(13)
    expect(count({ role: 'student', schoolId: 5183 })).toBe(1)
    expect(count({ role: 'student', schoolId: 8965 })).toBe(17)
    for (const school of [8100, 977, 1275]) expect(count({ schoolId: school }), `${school}`).toBe(0)
    for (const school of users.schoolsWithUsers({ excludeFixtures: true })) {
      expect(
        count({ role: 'student', schoolId: school }),
        `pupil at ${school}`,
      ).toBeGreaterThanOrEqual(1)
    }
    // Generated school admins with the M17 25-Sep logins (v1.21).
    const admin8090 = users.adminList({ role: 'school_admin', schoolId: 8090 }).rows
    expect(admin8090.map((r) => r.lastLoginAt)).toEqual(['2026-09-25T13:36:00+08:00'])
    const admin8078 = users.adminList({ role: 'school_admin', schoolId: 8078 }).rows
    expect(admin8078.map((r) => r.lastLoginAt)).toEqual(['2026-09-25T13:03:00+08:00'])
  })

  it('has 60 schools with users (57 real, the live S11 pupil schools, + 3 fixtures; DV-M02-13, D54)', () => {
    const all = users.schoolsWithUsers()
    expect(all).toHaveLength(60)
    expect(users.schoolsWithUsers({ excludeFixtures: true })).toHaveLength(57)
    expect(all).toEqual(
      expect.arrayContaining([900_001, 900_002, 900_003, 5441, 8088, 1, 5183, 853, 854, 1267]),
    )
    // D54: SK Demo Bestari (900004) lost its only user when pelajarmaju moved to SMK DEMO.
    expect(all).not.toContain(900_004)
    for (const id of [8100, 977, 1275]) expect(all).not.toContain(id)
  })
})

describe('users dataset: pools (named selections)', () => {
  it('compiles the selections as explicit id lists of the documented sizes', () => {
    const mirror = users.selection('attendanceMirror')
    expect(mirror).toHaveLength(137)
    const mirrorRows = users.getMany(mirror)
    expect(mirrorRows.filter((r) => r.grade === 10)).toHaveLength(14)
    expect(mirrorRows.filter((r) => r.grade === 11)).toHaveLength(123)
    expect(mirrorRows.every((r) => r.role === 'student' && r.schoolId === null)).toBe(true)

    const pool = users.getMany(users.selection('t4Pool'))
    expect(pool).toHaveLength(75)
    expect(pool.every((r) => r.grade === 10 && r.schoolId === null)).toBe(true)
    const anchorsInPool = pool.filter((r) => r.id >= 4326 && r.id <= 4358)
    expect(anchorsInPool.map((r) => r.id)).toEqual(
      Array.from({ length: 33 }, (_, i) => 4326 + i).filter((id) => id !== 4351),
    )
    expect(users.selection('t4PoolSwappedOut')).toEqual([])

    const rehomed = users.getMany(users.selection('t4PoolRehomed'))
    expect(rehomed).toHaveLength(39)
    const bySchool = new Map<number, number>()
    for (const r of rehomed) {
      bySchool.set(r.schoolId as number, (bySchool.get(r.schoolId as number) ?? 0) + 1)
    }
    expect(Object.fromEntries(bySchool)).toEqual({
      7780: 5,
      1: 9,
      3160: 9,
      2700: 10,
      2710: 2,
      8772: 1,
      9924: 1,
      9726: 1,
      8641: 1,
    })
    // M08 T4 card 149 = pool 75 + 38 re-homed with T4 memberships + 21 joiners + 15 (3201–3215).
    expect(75 + (rehomed.length - 1) + 21 + 15).toBe(149)
  })

  it('keeps a selection fixed when a member is edited later (not a predicate)', () => {
    const [first] = users.selection('attendanceMirror')
    users.update(first as number, { schoolId: 8082 }, Date.parse(NOW))
    expect(users.selection('attendanceMirror')).toContain(first)
    users.update(first as number, { schoolId: null }, Date.parse(NOW))
  })
})

describe('users dataset: lastActiveAt (v1.23, M18 XR-M18-21)', () => {
  it('seeds the M18-visible pupils per school (dated / null) and defaults everyone else to lastLoginAt', () => {
    for (const [school, [dated, nulls]] of Object.entries(M18_ACTIVITY_COUNTS.bySchool)) {
      const base = { role: 'student', schoolId: Number(school) } as const
      expect(count({ ...base, lastActiveAt: { isNull: true } }), `${school} null`).toBe(nulls)
      expect(count({ ...base, lastActiveAt: { isNull: false } }), `${school} dated`).toBe(dated)
    }
    // BATANG PADANG: 29 dated / 4 null on lastActiveAt, while lastLoginAt stays 25 / 8.
    const bp = { role: 'student', schoolId: [7780, 1] } as const
    expect(count({ ...bp, lastActiveAt: { isNull: false } })).toBe(29)
    expect(count({ ...bp, hasLoggedIn: true })).toBe(25)
    // Every seeded date is at 12:00 MYT in 2026.
    const dated = users
      .adminList({ role: 'student', schoolId: 7780, pageSize: 50 })
      .rows.map((r) => r.lastActiveAt)
      .filter((d): d is string => d !== null)
    expect(dated.every((d) => /^2026-0[2-5]-\d\dT12:00:00\+08:00$/.test(d))).toBe(true)
    // v1.26: 169 pupils carry a seeded date, 115 dated / 54 null (the 9 M18 schools + 4627).
    const m18Schools = Object.keys(M18_ACTIVITY_COUNTS.bySchool).map(Number)
    const inSchools = { role: 'student', schoolId: m18Schools } as const
    const m18Dated =
      count({ ...inSchools, lastActiveAt: { isNull: false } }) + (u(4627).lastActiveAt ? 1 : 0)
    const m18Null = count({ ...inSchools, lastActiveAt: { isNull: true } })
    expect(m18Dated + m18Null).toBe(169)
    expect(m18Dated).toBe(M18_ACTIVITY_COUNTS.dated)
    expect(m18Dated).toBe(115)
    expect(m18Null).toBe(M18_ACTIVITY_COUNTS.nulls)
    expect(m18Null).toBe(54)
    // The class-1156 pupil 4627 (v1.26): 8082, grade 11, T5, active, logged in; 2026-09-15 12:00.
    expect(u(4627)).toMatchObject({
      role: 'student',
      schoolId: 8082,
      grade: 11,
      classLevel: 'T5',
      isActive: true,
      hasLoggedIn: true,
      lastActiveAt: '2026-09-15T12:00:00+08:00',
    })
    // Generated from its own id (SRS note pending): before 2026-08-21 and after creation.
    const login4627 = u(4627).lastLoginAt as string
    expect(login4627 < '2026-08-21').toBe(true)
    expect(Date.parse(login4627)).toBeGreaterThan(Date.parse(u(4627).createdAt))
    // Anchors: 3201–3215 and 4320 null, 4321 2026-02-27.
    expect(u(3205).lastActiveAt).toBeNull()
    expect(u(4320).lastActiveAt).toBeNull()
    expect(u(4321).lastActiveAt).toBe('2026-02-27T12:00:00+08:00')
    // Default = lastLoginAt.
    expect(u(2008).lastActiveAt).toBe(u(2008).lastLoginAt)
    const generated = users.adminList({ role: 'student', schoolId: 8082, pageSize: 5 }).rows
    for (const r of generated) expect(r.lastActiveAt).toBe(r.lastLoginAt)
  })
})

describe('users.setIcNumber on a user without a secrets row', () => {
  it('creates an unusable-password secrets row for a generated user, and rejects an unknown id', () => {
    const id = 1234
    expect(users.get(id)).toBeDefined()
    expect(users.icMasked(id)).toBeNull()
    users.setIcNumber(id, '010203-04-5678')
    expect(users.icMasked(id)).toBe('xxxxxx-xx-xx78')
    expect(users.verifyIc(id, '010203-04-5678')).toBe(true)
    expect(users.verifyIc(id, '010203-04-5679')).toBe(false)
    for (const pw of ['', 'password', 'Password123!', '010203-04-5678'])
      expect(users.verifyPassword(id, pw)).toBe(false)
    users.setIcNumber(id, null)
    expect(users.icMasked(id)).toBeNull()
    expect(users.verifyIc(id, '010203-04-5678')).toBe(false)
    expect(() => users.setIcNumber(8_999_999, '010203-04-5678')).toThrow(/no user/)
  })

  it('outsideFixtureSchools rejects a where.schoolId', () => {
    expect(() => users.outsideFixtureSchools({ role: 'student', schoolId: 8082 })).toThrow(
      /schoolId/,
    )
  })
})

describe('users dataset: v1.25 swap of 4202 and v1.26 pupil 4627', () => {
  it('keeps the M11 / M17 teacher figures when 4202 moves from 8082 to 8087', () => {
    expect(count({ role: 'teacher', schoolId: 8087 })).toBe(44)
    expect(count({ role: 'teacher', schoolId: 8087, hasLoggedIn: true })).toBe(12)
    expect(count({ role: 'teacher', schoolId: 8082 })).toBe(68)
    expect(count({ role: 'teacher', schoolId: 8082, hasLoggedIn: true })).toBe(51)
    expect(count({ role: 'teacher', schoolId: { gte: 1, lte: 900_000 } })).toBe(522)
    expect(count({ role: 'teacher', schoolId: { gte: 1, lte: 900_000 }, hasLoggedIn: true })).toBe(
      277,
    )
    // 4202's login is before every M17 window and its generated replacement at 8082 is older than
    // 2026-08-26 (generated logins end 2026-08-20).
    const gen8082 = users
      .adminList({ role: 'teacher', schoolId: 8082, pageSize: 100 })
      .rows.filter((r) => r.hasLoggedIn && !USER_ANCHOR_ROWS.some((a) => a.id === r.id))
    expect(gen8082.length).toBeGreaterThan(0)
    expect(gen8082.every((r) => (r.lastLoginAt as string) < '2026-08-26')).toBe(true)
  })

  it('keeps 4627 out of the M14 generated-wallet pool (not the generated e-mail pattern)', () => {
    expect(u(4627).email).toBe('murid4627@demo.test')
    expect(u(4627).email).not.toBe('pelajar004627@demo.test')
    expect(USER_ANCHOR_ROWS.some((a) => a.id === 4627)).toBe(true)
  })
})

describe('users dataset: anchors at their placements', () => {
  it('has the canonical accounts 1–11 as in the TRACKER (4 at 900001, 11 at 9167)', () => {
    for (const a of CANONICAL_ACCOUNTS) {
      expect(u(a.id)).toMatchObject({
        email: a.email,
        role: a.role,
        name: a.name,
        grade: a.grade,
        schoolId: a.schoolId,
        isActive: a.isActive,
        lastLoginAt: a.lastLoginAt,
        createdAt: a.createdAt,
      })
    }
    expect(u(4).schoolId).toBe(900_001)
    expect(u(1).schoolId).toBe(900_002)
    expect(u(11)).toMatchObject({ schoolId: 9167, grade: 7, isActive: false, lastLoginAt: null })
    expect(u(1).trialQuestionsUsed).toBe(50)
    // Pelajar trial (account 2): M05 §6.12 "Baki 18 / 50 soalan" = 32 used.
    expect(u(2).trialQuestionsUsed).toBe(32)
    expect(users.trial(2, Date.parse(NOW))).toMatchObject({ used: 32, limit: 50, remaining: 18 })
    expect(users.isSubscribed(4, Date.parse(NOW))).toBe(true)
    expect(users.trial(1, Date.parse(NOW))).toEqual({
      active: true,
      used: 50,
      limit: 50,
      remaining: 0,
    })
  })

  it('places every module anchor as §6.15 D says', () => {
    const at = (id: number) => {
      const r = u(id)
      return [r.role, r.schoolId, r.grade, r.isActive, r.hasLoggedIn]
    }
    // M11 8080 anchors + Teacher T.
    expect(u(2008)).toMatchObject({
      name: 'Adam Haikal Demo',
      schoolId: 8080,
      grade: 11,
      lastLoginAt: '2026-06-16T14:11:00+08:00',
    })
    for (const id of USER_ANCHOR_BLOCKS.m11.filter((i) => i !== 2012)) {
      expect(at(id)).toEqual(['student', 8080, 11, true, true])
    }
    expect(at(2012)).toEqual(['teacher', 8080, null, true, true])
    // M12.
    expect(at(4664)).toEqual(['student', 8080, 11, true, true])
    expect(at(4644)).toEqual(['student', 8080, 11, true, false])
    // M14.
    for (let id = 4001; id <= 4040; id++) expect(at(id)).toEqual(['student', 8082, 11, true, true])
    for (let id = 4041; id <= 4074; id++) expect(at(id)).toEqual(['student', 8078, 11, true, true])
    for (let id = 4075; id <= 4108; id++) expect(at(id)).toEqual(['student', 8106, 11, true, true])
    // 4202 is at 8087 since v1.25 (the observed M17 row <teacher:137>).
    for (const id of [4201, 4203, 4204, 4205, 4206])
      expect(at(id)).toEqual(['teacher', 8082, null, true, true])
    expect(at(4202)).toEqual(['teacher', 8087, null, true, true])
    expect(u(4202).lastLoginAt).toBe('2026-06-04T05:47:00+08:00')
    expect(at(4207)).toEqual(['teacher', 8277, null, false, true])
    expect(at(4208)).toEqual(['teacher', 8277, null, false, true])
    // M15 (v1.23: at 2418).
    expect(at(3151)).toEqual(['student', 2418, 6, true, false])
    expect(at(3152)).toEqual(['student', 2418, 6, true, false])
    // M16 (v1.23 moves).
    expect(at(4301)).toEqual(['student', 8106, 11, true, true])
    expect(at(4320)).toEqual(['student', 8880, 11, true, true])
    expect(at(4321)).toEqual(['student', 2710, 6, true, false])
    for (let id = 4302; id <= 4310; id++) {
      expect(u(id).schoolId).toBe(9167)
      expect([7, 8, 9]).toContain(u(id).grade)
    }
    for (const id of [4311, 4312, 4313, 4314, 4315, 4318, 4319, 4322, 4323, 4324]) {
      expect(u(id).schoolId).toBe(9806)
      expect([7, 8, 9]).toContain(u(id).grade)
    }
    expect(at(4325)).toEqual(['student', 2418, 6, true, false])
    expect(at(4316)).toEqual(['student', null, 10, true, false])
    expect(at(4317)).toEqual(['student', null, 10, true, false])
    expect(USER_ANCHOR_ROWS.some((a) => a.id === 4351)).toBe(false) // token 51 = the admin
    expect(u(4352).name.length).toBeGreaterThan(15)
    expect(at(4401)).toEqual(['teacher', null, null, true, true])
    // M17.
    expect(at(2022)).toEqual(['student', 8080, 11, true, true])
    for (const id of [2013, 2014, 2015, 2016, 2020]) expect(u(id).schoolId).toBe(8082)
    for (const id of [2017, 2018, 2019, 2023]) expect(u(id).schoolId).toBe(8106)
    expect(at(1919)).toEqual(['teacher', null, null, true, true])
    expect(at(4402)).toEqual(['teacher', 8082, null, true, true])
    expect(at(4418)).toEqual(['teacher', 8082, null, true, true])
    // M04 contributors (M02 v1.18).
    expect(at(4501)).toEqual(['teacher', 8087, null, true, true])
    expect(at(4502)).toEqual(['teacher', 8107, null, true, true])
    expect(at(4503)).toEqual(['teacher', 8880, null, true, true])
    expect(u(4503).name).toBe('Guru Demo KL-01')
    expect(at(4504)).toEqual(['teacher', 8090, null, true, true])
    // M08.
    for (let id = 3001; id <= 3008; id++)
      expect(at(id)).toEqual(['student', 900_001, 11, true, true])
    for (let id = 3201; id <= 3215; id++) {
      expect(at(id)).toEqual(['student', 8880, 10, true, true])
      expect(u(id).lastLoginAt).toBe('2026-03-10T20:00:00+08:00')
    }
    // M09.
    expect(at(3101)).toEqual(['teacher', null, null, true, false])
    expect(at(3102)).toEqual(['school_admin', 900_003, null, true, false])
    expect(at(3103)).toEqual(['school_admin', 900_001, null, true, false])
    expect(at(3104)).toEqual(['school_admin', 900_002, null, true, false])
    for (let id = 3105; id <= 3109; id++) expect(at(id)).toEqual(['student', null, 6, true, false])
  })

  it('places the 30 M19 payers at 8102 (v1.22) with the M19 §6.10 packages', () => {
    expect(M19_PAYERS).toHaveLength(30)
    M19_PAYERS.forEach(([id, pkg, expiresAt], i) => {
      const n = String(i + 1).padStart(2, '0')
      expect(u(id)).toMatchObject({
        role: 'student',
        schoolId: 8102,
        grade: 11,
        isActive: true,
        lastLoginAt: null,
        isComplimentary: false,
        idDelima: null,
        hasPkskSubscription: false,
        name: `Pembayar Demo ${n}`,
        email: `pembayar${n}@demo.test`,
        subscriptionPackage: pkg,
        subscriptionExpiresAt: expiresAt,
      })
    })
    const at = Date.parse(NOW)
    // Literal M19 §6.10 values (not derived from the seed constant).
    expect(u(3318)).toMatchObject({
      subscriptionPackage: 'personal',
      subscriptionExpiresAt: '2027-01-10T23:59:59+08:00',
    })
    expect(u(5600)).toMatchObject({
      subscriptionPackage: 'personal',
      subscriptionExpiresAt: '2026-10-13T12:35:00+08:00',
    })
    const entitled = M19_PAYERS.filter(([id]) => users.isSubscribed(id, at)).map(([id]) => id)
    expect(entitled.sort((a, b) => a - b)).toEqual([3318, 5600])
  })

  it('places the M02 fixtures 5001–5990 (§6.14)', () => {
    for (let id = 5001; id <= 5210; id++) {
      expect([u(id).role, u(id).schoolId, u(id).grade, u(id).hasLoggedIn]).toEqual([
        'student',
        8102,
        11,
        false,
      ])
      expect(u(id).idDelima).toMatch(/^m-demo\d+@moe-dl\.edu\.my$/)
    }
    expect(u(5301)).toMatchObject({ role: 'teacher', schoolId: null, email: 'guru2@demo.test' })
    for (let id = 5302; id <= 5305; id++)
      expect([u(id).schoolId, u(id).lastLoginAt]).toEqual([8102, null])
    for (let id = 5306; id <= 5315; id++)
      expect(u(id).lastLoginAt).toBe('2026-08-01T20:00:00+08:00')
    for (let id = 5316; id <= 5329; id++) expect(u(id).lastLoginAt).toBeNull()
    // v1.24: 5316 = the observed M17 row <teacher:101> (active, no school, never logged in, outside
    // the M11 register); M14 reads it at finalise.
    expect(u(5316)).toMatchObject({
      role: 'teacher',
      isActive: true,
      schoolId: null,
      lastLoginAt: null,
      hasLoggedIn: false,
    })
    expect(u(5401).email).toBe('ibubapa2@demo.test')
    expect(u(5601)).toMatchObject({
      role: 'school_admin',
      schoolId: 8102,
      email: 'bea4628@prestasiplus.my',
    })
    expect(u(5605)).toMatchObject({ schoolId: 998, email: 'bbb00998@prestasiplus.my' })
    expect(u(5711).role).toBe('jpn_officer')
    expect(u(5801).role).toBe('admin')
    const comp = users.getMany(Array.from({ length: 90 }, (_, i) => 5901 + i))
    expect(comp).toHaveLength(90)
    expect(
      comp.every(
        (r) => r.isComplimentary && r.schoolId === 8102 && r.grade === 11 && !r.hasLoggedIn,
      ),
    ).toBe(true)
    expect(comp.filter((r) => !r.isActive)).toHaveLength(0)
    expect(u(5901).email).toBe('140001@prestasiplus.my')
  })

  it('keeps every anchor inside the generated id range, with fictitious e-mails', () => {
    for (const a of USER_ANCHOR_ROWS) {
      expect(a.id).toBeGreaterThanOrEqual(1)
      expect(a.id).toBeLessThanOrEqual(6000)
      expect(a.email).toMatch(/@(demo\.test|prestasiplus\.my)$/)
      expect(users.get(a.id)).toEqual(a)
    }
    // Anchors per role cell (build check of §6.15 B, v1.26): students 591, teachers ≥ 48.
    expect(USER_ANCHOR_ROWS.filter((a) => a.role === 'student')).toHaveLength(591)
    expect(USER_ANCHOR_ROWS.filter((a) => a.role === 'teacher').length).toBeGreaterThanOrEqual(48)
  })
})

describe('users repository contract', () => {
  it('is the M01 users repository, no longer provisional, exported by the M01 plugin', () => {
    expect(repositoryInfo(users)).toMatchObject({
      owner: 'M01',
      provisional: false,
      kind: 'virtual',
    })
    // M01-T1/T2 add their own repositories (settings, password resets, throttle, notifications).
    expect(Object.keys(plugin.repositories)).toContain('users')
    expect(Object.keys(runtime.core.repositories)).toEqual(['sessions'])
  })

  it('finds users by e-mail (trimmed, case-insensitive) through the cheap e-mail field', () => {
    expect(users.findByEmail('  Pelajar@Demo.Test ')?.id).toBe(2)
    const generated = users
      .adminList({ role: 'student' })
      .rows.find((r) => r.email.startsWith('pelajar0'))
    expect(generated).toBeDefined()
    expect(users.findByEmail(generated?.email.toUpperCase() ?? '')?.id).toBe(generated?.id)
    expect(users.findByEmail('nobody@demo.test')).toBeUndefined()
    expect(users.findByEmail('')).toBeUndefined()
  })

  it('lists and searches users for S1 (filters, name / e-mail search, 25 per page)', () => {
    const page = users.adminList({})
    expect(page.total).toBe(5159)
    expect(page.rows).toHaveLength(25)
    expect(users.adminList({ role: 'student' }).total).toBe(4533)
    expect(users.adminList({ isActive: false }).total).toBe(1432)
    expect(Math.ceil(users.adminList({ isActive: false }).total / 25)).toBe(58)
    expect(users.adminList({ schoolId: 987 }).total).toBe(2)
    expect(users.adminList({ role: 'parent' }).total).toBe(38)
    expect(users.adminList({ search: 'Adam Haikal' }).rows.map((r) => r.id)).toEqual([2008])
    expect(users.adminList({ search: 'zzz-none' }).total).toBe(0)
    expect(Math.ceil(page.total / 25)).toBe(207)
  })

  it('creates runtime users from 9,000,001 and records logins (lastActiveAt follows)', () => {
    const now = Date.parse(NOW)
    const created = users.create(
      { name: 'Baru Demo', email: 'baru@demo.test', role: 'student', grade: 7 },
      now,
    )
    expect(created.id).toBeGreaterThanOrEqual(9_000_001)
    expect(created.classLevel).toBe('T1')
    expect(created.lastActiveAt).toBeNull()
    expect(users.count('U-ALL')).toBe(5160)
    const logged = users.recordLogin(created.id, now)
    expect(logged).toMatchObject({ hasLoggedIn: true, lastLoginAt: NOW, lastActiveAt: NOW })
    users.remove(created.id)
    expect(users.get(created.id)).toBeUndefined()
  })

  it('writes the individual package with setSubscription (BR-12, XR-M19-04)', () => {
    const now = Date.parse(NOW)
    expect(users.isSubscribed(3, now)).toBe(false)
    users.setSubscription(3, { package: 'personal', expiresAt: '2027-01-10T23:59:59+08:00' })
    expect(u(3)).toMatchObject({
      subscriptionPackage: 'personal',
      subscriptionExpiresAt: '2027-01-10T23:59:59+08:00',
    })
    expect(users.isSubscribed(3, now)).toBe(true)
    users.setSubscription(3, { package: 'none', expiresAt: null })
    expect(users.isSubscribed(3, now)).toBe(false)
    expect(() => users.setSubscription(7000, { package: 'none', expiresAt: null })).toThrow(
      'no user 7000',
    )
  })

  it('counts the trial per checked answer (provisional M19 rule)', () => {
    const before = u(3).trialQuestionsUsed
    expect(users.incrementTrialUsed(3)).toBe(before + 1)
    expect(users.trial(3, Date.parse(NOW)).remaining).toBe(50 - before - 1)
  })
})

describe('users.secrets', () => {
  it('holds hashes for the canonical accounts and the M02 fixtures, never plaintext', () => {
    expect(users.verifyPassword(2, 'Demo1234')).toBe(true)
    expect(users.verifyPassword(2, 'demo1234')).toBe(false)
    expect(users.verifyPassword(5001, 'Demo1234')).toBe(true)
    expect(users.verifyPassword(123, 'Demo1234')).toBe(false) // generated user: no secrets
    expect(users.adminIcNumber(5901)).toBe('080101140001')
    expect(users.icMasked(5901)).toBe('xxxxxx-xx-xx01')
    expect(users.adminIcNumber(5990)).toBeNull()
    const row = u(2) as unknown as Record<string, unknown>
    for (const key of ['password', 'passwordHash', 'icNumber', 'icHash', 'salt']) {
      expect(row).not.toHaveProperty(key)
    }
  })

  it('never puts a plaintext password or IC in the persisted diff', () => {
    users.setPassword(5, 'RahsiaBaru99')
    users.setIcNumber(5, '991231145678')
    users.update(5, { name: 'Guru Demo Dikemas Kini' }, Date.parse(NOW))
    const text = JSON.stringify(runtime.db.diff())
    expect(text).not.toContain('RahsiaBaru99')
    expect(text).not.toContain('991231145678')
    expect(text).not.toContain('Demo1234')
    expect(text).toContain('Guru Demo Dikemas Kini')
    expect(users.verifyPassword(5, 'RahsiaBaru99')).toBe(true)
    expect(users.verifyIc(5, '991231145678')).toBe(true)
  })
})
