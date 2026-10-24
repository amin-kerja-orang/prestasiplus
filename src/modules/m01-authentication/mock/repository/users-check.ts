/**
 * Build check of the users dataset (M02 SRS v1.23 §6.15 C "The dataset compiler asserts these sums,
 * the M11 per-school rows, 1,666 / 2,492, 522 / 277, 57, the M17 role × isActive pins, the
 * per-school `used` values of BR-24 …"; overview §6.6 step 4). Runs at boot in the M01 plugin's
 * `finalise` (after compilation and `compileActivity`) and in the unit tests. Every figure is a
 * facet count (O(cells)), except the `lastActiveAt` counts, which read the compiled assignment.
 */

import { checkNamedQueries, type DatasetIssue } from '@/mock/dataset'

import { compiledActivityCounts, M18_ACTIVITY_ANCHORS } from '../datasets/users-activity'
import {
  M11_REGISTER,
  M11_TEACHERS,
  OTHER_ROLES_INACTIVE,
  PUPILS_ACTIVE_LOGGED_IN,
  S11_PUPILS_HOLDING,
  SCHOOLS_WITH_USERS,
  SCHOOLS_WITH_USERS_REAL,
  STUDENTS_ACTIVE,
  STUDENTS_INACTIVE,
  TEACHERS_ACTIVE,
  TEACHERS_ACTIVE_LOGGED_IN,
  TEACHERS_INACTIVE,
  TEACHERS_LOGGED_IN,
  USED_PUPILS,
} from '../datasets/users-spec'
import { userQueries, usersRepo } from './users'

/** M18 §6.11 B pupils per school (all levels). */
export const M18_PUPILS_PER_SCHOOL: Readonly<Record<number, number>> = {
  8880: 59,
  8765: 21,
  3160: 12,
  2700: 14,
  2710: 4,
  8772: 12,
  8767: 13,
  7780: 17,
  1: 16,
}

/**
 * Seeded M18 activity dates (M02 v1.26 §6.14): 115 dated / 54 null over 169 pupils, the
 * class-1156 pupil being user 4627 (a literal anchor).
 */
export const M18_ACTIVITY_COUNTS = {
  dated: 115,
  nulls: 54,
  bySchool: {
    7780: [15, 2],
    1: [14, 2],
    8880: [17, 42],
    8765: [19, 2],
    8767: [11, 2],
    8772: [10, 2],
    2700: [12, 2],
    3160: [12, 0],
    2710: [4, 0],
  } as Readonly<Record<number, readonly [number, number]>>,
} as const

/** BATANG PADANG `lastLoginAt` split (v1.21): [logged in, never]. */
export const BATANG_PADANG_LOGINS: Readonly<Record<number, readonly [number, number]>> = {
  7780: [11, 6],
  1: [14, 2],
}

function issue(message: string): DatasetIssue {
  return { code: 'NAMED_QUERY', message }
}

export function checkUsersDataset(): DatasetIssue[] {
  const issues: DatasetIssue[] = [...checkNamedQueries(userQueries)]
  const n = (where: Parameters<typeof usersRepo.countWhere>[0]) => usersRepo.countWhere(where)
  const out = (where: Parameters<typeof usersRepo.countWhere>[0]) =>
    usersRepo.outsideFixtureSchools(where)
  const expect = (label: string, actual: number, expected: number) => {
    if (actual !== expected) {
      issues.push(issue(`${label} = ${String(actual)}, documented ${String(expected)}`))
    }
  }

  // M17 pins on the populations outside the fixture schools (v1.20, A-01).
  expect('students active (P)', out({ role: 'student', isActive: true }), STUDENTS_ACTIVE)
  expect('students inactive', out({ role: 'student', isActive: false }), STUDENTS_INACTIVE)
  expect('teachers active (T)', out({ role: 'teacher', isActive: true }), TEACHERS_ACTIVE)
  expect('teachers inactive', out({ role: 'teacher', isActive: false }), TEACHERS_INACTIVE)
  expect(
    'other roles inactive',
    out({
      role: [
        'parent',
        'sponsor',
        'school_admin',
        'ppd_officer',
        'jpn_officer',
        'admin',
        'unmapped',
      ],
      isActive: false,
    }),
    OTHER_ROLES_INACTIVE,
  )
  expect(
    'active students logged in',
    out({ role: 'student', isActive: true, hasLoggedIn: true }),
    PUPILS_ACTIVE_LOGGED_IN,
  )
  expect(
    'active teachers logged in',
    out({ role: 'teacher', isActive: true, hasLoggedIn: true }),
    TEACHERS_ACTIVE_LOGGED_IN,
  )
  expect('teachers logged in', out({ role: 'teacher', hasLoggedIn: true }), TEACHERS_LOGGED_IN)

  // M11 register per school (§6.15 C; M11 §6.7).
  for (const [school, t4, t5, aktif, loginOnly, belum, awl] of M11_REGISTER) {
    const base = { role: 'student', schoolId: school } as const
    expect(`M11 ${String(school)} T4`, n({ ...base, grade: 10 }), t4)
    expect(`M11 ${String(school)} T5`, n({ ...base, grade: 11 }), t5)
    expect(
      `M11 ${String(school)} logged in`,
      n({ ...base, grade: [10, 11], hasLoggedIn: true }),
      aktif - awl + loginOnly,
    )
    expect(
      `M11 ${String(school)} never`,
      n({ ...base, grade: [10, 11], hasLoggedIn: false }),
      belum + awl,
    )
  }
  for (const [school, t, tl] of M11_TEACHERS) {
    expect(`M11 ${String(school)} teachers`, n({ role: 'teacher', schoolId: school }), t)
    expect(
      `M11 ${String(school)} teachers logged in`,
      n({ role: 'teacher', schoolId: school, hasLoggedIn: true }),
      tl,
    )
  }

  // Fixture school 900001 holds exactly 10 students (M08 "9 murid", XL2-35, plus pelajarmaju, who
  // moved from SK Demo Bestari 900004 on D54, 2026-10-24); 900002 and 900004 none.
  expect('900001 students', n({ role: 'student', schoolId: 900_001 }), 10)
  expect('900004 students', n({ role: 'student', schoolId: 900_004 }), 0)
  expect('900002 students', n({ role: 'student', schoolId: 900_002 }), 0)
  expect('987 users', n({ schoolId: 987 }), 2)

  // M18 pupils per school, and the BATANG PADANG login split (v1.21).
  for (const [school, pupils] of Object.entries(M18_PUPILS_PER_SCHOOL)) {
    expect(`M18 ${school} pupils`, n({ role: 'student', schoolId: Number(school) }), pupils)
  }
  for (const [school, [logged, never]] of Object.entries(BATANG_PADANG_LOGINS)) {
    const base = { role: 'student', schoolId: Number(school) } as const
    expect(`${school} logged in`, n({ ...base, hasLoggedIn: true }), logged)
    expect(`${school} never logged in`, n({ ...base, hasLoggedIn: false }), never)
  }

  // BR-24 `used` = every student of the school (DV-M02-15, v1.21): all 12 observed values.
  for (const [school, used] of Object.entries(USED_PUPILS)) {
    expect(`BR-24 used ${school}`, n({ role: 'student', schoolId: Number(school) }), used)
  }
  // M17 S11 "Murid" totals that hold (v1.23, 40 rows).
  for (const [school, pupils] of Object.entries(S11_PUPILS_HOLDING)) {
    expect(`S11 Murid ${school}`, n({ role: 'student', schoolId: Number(school) }), pupils)
  }

  // Every real school with users holds a student (M17 BR-M17-03, v1.19/v1.22).
  for (const school of usersRepo.schoolsWithUsers({ excludeFixtures: true })) {
    if (n({ role: 'student', schoolId: school }) < 1) {
      issues.push(issue(`school ${String(school)} has users but no pupil`))
    }
  }
  // The live teacher-only filter schools hold no user (v1.22).
  for (const school of [8100, 977, 1275])
    expect(`users at ${String(school)}`, n({ schoolId: school }), 0)

  // Schools with users (DV-M02-13).
  expect('schools with users', usersRepo.schoolsWithUsers().length, SCHOOLS_WITH_USERS)
  expect(
    'schools with users (without fixtures)',
    usersRepo.schoolsWithUsers({ excludeFixtures: true }).length,
    SCHOOLS_WITH_USERS_REAL,
  )

  // Seeded M18 activity dates (v1.23): generated pupils (compiled) + anchors (literal).
  const compiled = compiledActivityCounts()
  const anchorValues = Object.values(M18_ACTIVITY_ANCHORS)
  const anchorsDated = anchorValues.filter((v) => v !== null).length
  const anchorsNull = anchorValues.length - anchorsDated
  expect('lastActiveAt dated', compiled.dated + anchorsDated, M18_ACTIVITY_COUNTS.dated)
  expect('lastActiveAt null', compiled.nulls + anchorsNull, M18_ACTIVITY_COUNTS.nulls)
  // The same figures read straight from the store: the 9 M18 schools plus pupil 4627 (v1.26).
  const m18 = {
    role: 'student',
    schoolId: Object.keys(M18_ACTIVITY_COUNTS.bySchool).map(Number),
  } as const
  const pupil = usersRepo.get(4627)?.lastActiveAt ?? null
  expect(
    'lastActiveAt dated (store)',
    n({ ...m18, lastActiveAt: { isNull: false } }) + (pupil === null ? 0 : 1),
    M18_ACTIVITY_COUNTS.dated,
  )
  expect(
    'lastActiveAt null (store)',
    n({ ...m18, lastActiveAt: { isNull: true } }) + (pupil === null ? 1 : 0),
    M18_ACTIVITY_COUNTS.nulls,
  )
  return issues
}
