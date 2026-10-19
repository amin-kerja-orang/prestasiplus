/**
 * Distribution spec of the users dataset (M02 SRS v1.23 §6.14, §6.15 B, C, D; M11 §6.7; M17 XR-06;
 * M18 §6.11 B; M19 §6.10). Facets: `role × isActive × isComplimentary × schoolId × grade ×
 * hasLoggedIn × pool`.
 *
 * Every cell is declared below as a block of the §6.15 allocation (anchors included: each anchor
 * claims a slot of its own cell, overview §6.6 step 3). Observed and pinned totals:
 *
 * | Figure | Value | Source |
 * |---|---|---|
 * | users | 5,159 | S1 pagination |
 * | role | student 4,533 · teacher 551 · parent 38 · sponsor 6 · school_admin 16 · ppd 5 · admin 2 · jpn 2 · unmapped 6 | S1 cards; D9 `unmapped` |
 * | isActive | 3,727 / 1,432; **outside the fixture schools 900001–900099** (v1.20, A-01): students 3,152 / 1,371, teachers 502 / 48, other roles 13 inactive; the fixture schools add 10 active students and 1 active teacher | `?is_active=0`; M17 XR-06 |
 * | complimentary | 90 (5901–5990, all active) | S6 |
 * | M11 register | 4,158 T4/T5 students in 33 schools, 1,666 logged in / 2,492 never; 522 teachers in 13 schools, 277 logged in | M11 §6.7 |
 * | M17 logins (outside fixture schools) | active students 1,708; active teachers 269; all teachers 289 (teacher 5 excluded) | M17 XR-06, v1.20 |
 * | per-school pupils (DV-M02-15: all students, active or not) | BR-24 `used`: 8277 150, 8880 59, 8102 776, 8082 549, 10220 2, 8106 562, 8078 423, 8080 185, 8090 386, 8087 312, 8107 675, 8228 13 | M19 discovery; v1.21 |
 * | schools with users | 61 (57 real, each holding a student, + 4 fixtures) | DV-M02-13, v1.22 |
 *
 * Student total (v1.23): 4,158 register + 10 fixture-school + 7 named (3, 11 at 9167, 3105–3109)
 * + 137 `attendanceMirror` + 75 T4 pool + 39 re-homed pool pupils (36 at M18's schools + 3 at
 * filter schools) + 107 G = 4,533.
 *
 * **Designed choices (INFERRED, the SRS leaves them open; each keeps every pinned figure):**
 * - per-school grade × login split: logged-in rows split over T4 / T5 in proportion (8880: the 26
 *   T4 rows are all logged in, M18; 8765: every row never logged in, M11);
 * - the M17 XR-06 inactive pupils kept by v1.21 (8082 1, 8080 1, 8078 4, 8106 1, 8090 1, 8102 3,
 *   8300 1) sit on logged-in grade-11 register rows; **18 further logged-in inactive students at
 *   8090** (login-only rows: M05 must not give them answers) bring "active students logged in" to
 *   1,708; the other **1,340 inactive students** are never-logged-in register rows, in proportion to
 *   each school's free never-logged rows (the "answered without login" rows and the never-logged
 *   anchors stay active). Per-school pupil counts include inactive students (DV-M02-15), so no
 *   school pin constrains where they sit;
 * - teachers: 8277's 2 inactive (4207, 4208) and 8087's 1 are logged in; 17 more logged-in and 28
 *   never-logged inactive teachers are spread over the other register schools in proportion (8080
 *   keeps all 34 active);
 * - login state of the non-register pupils: M18 re-homed and G pupils logged in except 8880's 6
 *   lower-form pupils, 4321, one G pupil each at 3160, 8767, 8772 and two at school 1 (v1.21: 14 /
 *   2); the 8106 pair, 8080's and 8090's extra pupils and 8088's pupil logged in; every student
 *   added or moved in v1.19–v1.23 never logged in (A-02); generated parents, sponsors, officers and
 *   unmapped users never logged in; the 13 inactive users of the other roles are generated parents
 *   (8), a sponsor, two school admins (1518, 8209) and two `unmapped` users;
 * - grades of the lower-level pupils (M18 gives only the level mix; v1.23 moves "grades 7–9").
 */

import { exact, split, type CellSpec } from '@/mock/dataset'

import type { UserFacets, UserPool, UserRole } from './users-types'

// ---------------------------------------------------------------------------------------------
// Observed / pinned figures
// ---------------------------------------------------------------------------------------------

export const USERS_TOTAL = 5_159
export const USERS_BY_ROLE: Readonly<Record<UserRole, number>> = {
  student: 4_533,
  teacher: 551,
  parent: 38,
  sponsor: 6,
  school_admin: 16,
  ppd_officer: 5,
  admin: 2,
  jpn_officer: 2,
  unmapped: 6,
}
export const USERS_INACTIVE = 1_432
/** Pins on M17's populations: accounts outside the fixture schools (v1.20, A-01). */
export const STUDENTS_ACTIVE = 3_152
export const STUDENTS_INACTIVE = 1_371
export const TEACHERS_ACTIVE = 502
export const TEACHERS_INACTIVE = 48
export const OTHER_ROLES_INACTIVE = 13
/** Accounts at the fixture schools (outside the pins): 10 students, 1 teacher, all active. */
export const FIXTURE_SCHOOL_STUDENTS = 10
export const FIXTURE_SCHOOL_TEACHERS = 1
export const COMPLIMENTARY_TOTAL = 90
export const PUPILS_ACTIVE_LOGGED_IN = 1_708
export const TEACHERS_ACTIVE_LOGGED_IN = 269
export const TEACHERS_LOGGED_IN = 289
export const REGISTER_STUDENTS = 4_158
export const REGISTER_LOGGED_IN = 1_666
export const REGISTER_NEVER = 2_492
export const REGISTER_TEACHERS = 522
export const REGISTER_TEACHERS_LOGGED_IN = 277
export const SCHOOLS_WITH_USERS = 61
export const SCHOOLS_WITH_USERS_REAL = 57
export const ATTENDANCE_MIRROR = { total: 137, grade10: 14, grade11: 123 } as const
/** v1.19: 78 − 3 re-homed to filter schools. */
export const T4_POOL = 75
/** v1.19: the 20 rows were re-graded lower and placed at schools (G). */
export const T4_POOL_SWAPPED_OUT = 0
/** 36 at M18's schools + 3 at filter schools (v1.19). */
export const T4_POOL_REHOMED = 39
export const OTHER_STUDENTS_G = 107

/** BR-24 `used` = every student of the school, active or not (DV-M02-15, v1.21). */
export const USED_PUPILS: Readonly<Record<number, number>> = {
  8277: 150,
  8880: 59,
  8102: 776,
  8082: 549,
  10220: 2,
  8106: 562,
  8078: 423,
  8080: 185,
  8090: 386,
  8087: 312,
  8107: 675,
  8228: 13,
}

/**
 * M17 S11 per-school "Murid" totals that hold with the v1.23 placement (§6.15 D, 40 rows beyond
 * the 11 `used` rows). The six short rows (2418, 5441, 3390, 853, 3931, 8030) are pending a D9.
 */
export const S11_PUPILS_HOLDING: Readonly<Record<number, number>> = {
  8300: 1,
  8284: 1,
  8088: 1,
  1014: 6,
  1267: 2,
  9726: 1,
  9924: 1,
  987: 1,
  854: 1,
  4961: 1,
  9681: 1,
  5183: 1,
  995: 1,
  998: 1,
  2710: 4,
  8298: 2,
  3160: 12,
  3582: 1,
  978: 1,
  940: 1,
  5997: 1,
  2700: 14,
  1712: 1,
  1: 16,
  1518: 1,
  8302: 1,
  8965: 17,
  8308: 1,
  8198: 1,
  7780: 17,
  8098: 1,
  8765: 21,
  8209: 1,
  8772: 12,
  8228: 13,
  8767: 13,
  8641: 1,
  9801: 1,
  9167: 18,
  9806: 16,
}
/** The six S11 rows that stay short (live · rebuild), §6.15 D (D9 pending). */
export const S11_PUPILS_SHORT: Readonly<Record<number, readonly [number, number]>> = {
  2418: [5, 4],
  5441: [14, 1],
  3390: [15, 1],
  853: [18, 1],
  3931: [16, 1],
  8030: [18, 8],
}

/**
 * M11 §6.7 register: [school, T4, T5, Aktif, Login sahaja, Belum login, answered without login].
 * Logged in = (Aktif − awl) + Login sahaja; never = Belum login + awl (M02 §6.15 C).
 */
export const M11_REGISTER: readonly (readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
])[] = [
  [940, 0, 1, 1, 0, 0, 1],
  [987, 0, 1, 1, 0, 0, 0],
  [995, 0, 1, 1, 0, 0, 0],
  [8098, 0, 1, 1, 0, 0, 1],
  [8284, 0, 1, 1, 0, 0, 0],
  [8080, 0, 184, 174, 4, 6, 2],
  [8078, 0, 423, 345, 40, 38, 11],
  [8082, 0, 549, 393, 67, 89, 5],
  [8880, 26, 27, 31, 14, 8, 0],
  [8106, 7, 553, 306, 69, 185, 22],
  [8298, 0, 2, 1, 0, 1, 1],
  [10220, 0, 2, 1, 1, 0, 0],
  [1014, 0, 5, 2, 0, 3, 1],
  [8765, 12, 4, 1, 0, 15, 1],
  [8090, 1, 384, 134, 56, 195, 10],
  [8087, 1, 311, 46, 14, 252, 5],
  [8102, 0, 776, 17, 4, 755, 4],
  [8107, 0, 675, 1, 0, 674, 0],
  [7780, 3, 3, 0, 0, 6, 0],
  [8030, 4, 4, 0, 0, 8, 0],
  [8198, 0, 1, 0, 0, 1, 0],
  [8228, 2, 3, 0, 0, 5, 0],
  [8277, 0, 150, 0, 2, 148, 0],
  [8300, 0, 1, 0, 1, 0, 0],
  [8302, 1, 0, 0, 0, 1, 0],
  [8308, 0, 1, 0, 0, 1, 0],
  [8767, 3, 5, 0, 0, 8, 0],
  [8772, 3, 4, 0, 0, 7, 0],
  [8965, 3, 4, 0, 0, 7, 0],
  [9167, 4, 4, 0, 0, 8, 0],
  [9681, 1, 0, 0, 1, 0, 0],
  [9801, 1, 0, 0, 0, 1, 0],
  [9806, 3, 3, 0, 0, 6, 0],
]

/** M11 §6.7 teacher table: [school, registered, logged in]. */
export const M11_TEACHERS: readonly (readonly [number, number, number])[] = [
  [8080, 34, 34],
  [8078, 60, 53],
  [8082, 68, 51],
  [8880, 2, 1],
  [8106, 60, 18],
  [10220, 2, 2],
  [8090, 83, 42],
  [8087, 44, 12],
  [8102, 118, 42],
  [8107, 20, 4],
  [8277, 29, 16],
  [8300, 1, 1],
  [5183, 1, 1],
]

/** Logged-in inactive register pupils: the kept M17 XR-06 pins + 18 designed login-only at 8090. */
const REGISTER_INACTIVE_LOGGED: Readonly<Record<number, number>> = {
  8082: 1,
  8080: 1,
  8078: 4,
  8106: 1,
  8090: 1 + 18,
  8102: 3,
  8300: 1,
}
/** Inactive never-logged-in register students (designed, see the header). */
const REGISTER_INACTIVE_NEVER = 1_340
/** Active never-logged anchors inside register cells (they must stay active). */
const REGISTER_NEVER_ACTIVE_ANCHORS: Readonly<Record<number, number>> = {
  // 5001–5210, 5901–5990 (the 90 complimentary are their own cell but share the never rows) and
  // the 30 M19 payers.
  8102: 210 + 90 + 30,
  8080: 1, // 4644
}

/** Teachers: inactive logged-in / never-logged rows (designed, see the header). */
const TEACHER_INACTIVE_LOGGED_FIXED: Readonly<Record<number, number>> = { 8277: 2, 8087: 1 }
const TEACHER_INACTIVE_LOGGED_SPREAD = 17
const TEACHER_INACTIVE_NEVER_SPREAD = 28
const TEACHER_SPREAD_EXCLUDED = new Set([8277, 8087, 8080])
/**
 * Teacher anchors per register school and login state (they are active except 4207/4208).
 * Deliberately unchanged at v1.26: v1.25 moves 4202 from 8082 to 8087 (8082 7, 8087 2), but the
 * spread of the inactive teachers reads these weights and "no count moves", so the placement of the
 * generated inactive teachers stays as designed in v1.23.
 */
const TEACHER_ANCHORS_LOGGED: Readonly<Record<number, number>> = {
  8080: 1,
  8082: 8,
  8277: 2,
  8087: 1,
  8107: 1,
  8880: 1,
  8090: 1,
}
const TEACHER_ANCHORS_NEVER: Readonly<Record<number, number>> = { 8102: 4 }

// ---------------------------------------------------------------------------------------------
// Block builder
// ---------------------------------------------------------------------------------------------

interface BlockFacets {
  role: UserRole
  schoolId?: number | null
  grade?: number | null
  isActive?: boolean
  hasLoggedIn?: boolean
  isComplimentary?: boolean
  pool?: UserPool | null
}

function facetsOf(b: BlockFacets): UserFacets {
  return {
    role: b.role,
    isActive: b.isActive ?? true,
    isComplimentary: b.isComplimentary ?? false,
    schoolId: b.schoolId ?? null,
    grade: b.grade ?? null,
    hasLoggedIn: b.hasLoggedIn ?? false,
    pool: b.pool ?? null,
  }
}

export function userCellKey(f: UserFacets): string {
  return JSON.stringify([
    f.role,
    f.isActive,
    f.isComplimentary,
    f.schoolId,
    f.grade,
    f.hasLoggedIn,
    f.pool,
  ])
}

class Blocks {
  readonly cells = new Map<string, CellSpec<UserFacets>>()
  add(b: BlockFacets, count: number): void {
    if (count < 0) throw new Error(`users spec: negative block ${JSON.stringify(b)}`)
    if (count === 0) return
    const facets = facetsOf(b)
    const key = userCellKey(facets)
    const cell = this.cells.get(key)
    if (cell) cell.count += count
    else this.cells.set(key, { facets, count })
  }
  /** One block per grade in `grades` (count 1 each). */
  grades(b: Omit<BlockFacets, 'grade'>, grades: readonly number[]): void {
    for (const g of grades) this.add({ ...b, grade: g }, 1)
  }
}

/** Largest remainder of `total` over `weights` (ids → weight). */
function spread(
  total: number,
  weights: readonly (readonly [number, number])[],
): Map<number, number> {
  return new Map(split(total, weights))
}

// ---------------------------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------------------------

export interface RegisterSplit {
  school: number
  l4: number
  l5: number
  n4: number
  n5: number
  awl: number
}

/** Grade × login split of every register school (designed, see the header). */
export function registerSplits(): RegisterSplit[] {
  return M11_REGISTER.map(([school, t4, t5, aktif, loginOnly, belum, awl]) => {
    const logged = aktif - awl + loginOnly
    const never = belum + awl
    if (logged + never !== t4 + t5)
      throw new Error(`users spec: register ${String(school)} does not add up`)
    let l4: number
    if (school === 8880) l4 = t4
    else l4 = t4 + t5 === 0 ? 0 : Math.round((t4 * logged) / (t4 + t5))
    l4 = Math.min(t4, logged, Math.max(l4, t4 - never, 0))
    return { school, l4, l5: logged - l4, n4: t4 - l4, n5: never - (t4 - l4), awl }
  })
}

function addStudents(b: Blocks): void {
  const splits = registerSplits()

  // Inactive never-logged register rows, in proportion to each school's free never-logged rows:
  // never − "answered without login" (they stay active) − the active never-logged anchors.
  const capacity = splits.map((s) => {
    const free = s.n4 + s.n5 - s.awl - (REGISTER_NEVER_ACTIVE_ANCHORS[s.school] ?? 0)
    return [s.school, Math.max(0, free)] as const
  })
  const inactiveNever = spread(REGISTER_INACTIVE_NEVER, capacity)

  for (const s of splits) {
    const school = s.school
    // Logged in (grade 10 / 11); the inactive rows sit on grade-11 (or grade-10) rows.
    const pinned = REGISTER_INACTIVE_LOGGED[school] ?? 0
    const pin5 = Math.min(pinned, s.l5)
    const pin4 = pinned - pin5
    b.add({ role: 'student', schoolId: school, grade: 10, hasLoggedIn: true }, s.l4 - pin4)
    b.add(
      { role: 'student', schoolId: school, grade: 10, hasLoggedIn: true, isActive: false },
      pin4,
    )
    b.add({ role: 'student', schoolId: school, grade: 11, hasLoggedIn: true }, s.l5 - pin5)
    b.add(
      { role: 'student', schoolId: school, grade: 11, hasLoggedIn: true, isActive: false },
      pin5,
    )

    // Never logged in.
    const inactive = inactiveNever.get(school) ?? 0
    const in4 = s.n4 + s.n5 === 0 ? 0 : Math.round((inactive * s.n4) / (s.n4 + s.n5))
    const in5 = inactive - in4
    b.add({ role: 'student', schoolId: school, grade: 10 }, s.n4 - in4)
    b.add({ role: 'student', schoolId: school, grade: 10, isActive: false }, in4)
    if (school === 8102) {
      // 5901–5990: 90 complimentary students, all active (v1.19), never logged in (§6.14).
      b.add(
        { role: 'student', schoolId: school, grade: 11, isComplimentary: true },
        COMPLIMENTARY_TOTAL,
      )
      b.add({ role: 'student', schoolId: school, grade: 11 }, s.n5 - in5 - COMPLIMENTARY_TOTAL)
    } else {
      b.add({ role: 'student', schoolId: school, grade: 11 }, s.n5 - in5)
    }
    b.add({ role: 'student', schoolId: school, grade: 11, isActive: false }, in5)
  }

  // Fixture-school students (outside every pin): 9 at 900001 + canonical 4 at 900004, logged in.
  b.add({ role: 'student', schoolId: 900_001, grade: 10, hasLoggedIn: true }, 1)
  b.add({ role: 'student', schoolId: 900_001, grade: 11, hasLoggedIn: true }, 8)
  b.add({ role: 'student', schoolId: 900_004, grade: 1, hasLoggedIn: true }, 1)

  // Named students: canonical 3 (no school, grade 5, logged in); canonical 11 (9167, grade 7,
  // inactive, v1.23); M09 3105–3109 (no school, grade 6).
  b.add({ role: 'student', grade: 5, hasLoggedIn: true }, 1)
  b.add({ role: 'student', schoolId: 9167, grade: 7, isActive: false }, 1)
  b.add({ role: 'student', grade: 6 }, 5)

  // Pools without a school (§6.15 C).
  b.add({ role: 'student', grade: 10, pool: 'attendanceMirror' }, ATTENDANCE_MIRROR.grade10)
  b.add({ role: 'student', grade: 11, pool: 'attendanceMirror' }, ATTENDANCE_MIRROR.grade11)
  b.add({ role: 'student', grade: 10, pool: 't4Pool' }, T4_POOL)

  // M18 pupils outside the register: re-homed pool pupils (k = 36) and G pupils (42).
  for (const m of M18_LOWER) {
    m.grades.forEach((grade, i) => {
      const rehomed = i < m.rehomed
      const never = m.never.includes(i)
      b.add(
        {
          role: 'student',
          schoolId: m.school,
          grade,
          hasLoggedIn: !never,
          pool: rehomed ? 't4PoolRehomed' : null,
        },
        1,
      )
    })
  }
  // The 3 re-homed T4-pool pupils at filter schools (v1.19; never logged in, v1.20).
  for (const [school, grade] of REHOMED_AT_FILTER_SCHOOLS) {
    b.add({ role: 'student', schoolId: school, grade, pool: 't4PoolRehomed' }, 1)
  }

  // G at monitoring schools (v1.21): 8106 pair, 8080 1, 8090 1 (logged in, active); 8228 8 and 5183 1
  // (never logged in).
  b.grades({ role: 'student', schoolId: 8106, hasLoggedIn: true }, [8, 9])
  b.add({ role: 'student', schoolId: 8080, grade: 9, hasLoggedIn: true }, 1)
  b.add({ role: 'student', schoolId: 8090, grade: 9, hasLoggedIn: true }, 1)
  b.grades({ role: 'student', schoolId: 8228 }, [7, 7, 8, 8, 8, 9, 9, 9])
  b.add({ role: 'student', schoolId: 5183, grade: 3 }, 1)
  // The 16 G students of the other filter schools (v1.22 set; only 8088's pupil logged in).
  for (const [school, grade] of FILTER_SCHOOL_PUPILS) {
    b.add({ role: 'student', schoolId: school, grade, hasLoggedIn: school === 8088 }, 1)
  }
  // The 12 v1.21-withdrawn extras placed in v1.22: 1014 1, 1267 1, 8965 10 (never logged in).
  b.add({ role: 'student', schoolId: 1014, grade: 3 }, 1)
  b.add({ role: 'student', schoolId: 1267, grade: 2 }, 1)
  b.grades({ role: 'student', schoolId: 8965 }, [7, 7, 7, 8, 8, 8, 9, 9, 9, 7])
  // M15 3151–3152 and M16 4325 at 2418 (Darjah 6), M16 4302–4310 at 9167 and 4311–4315, 4318, 4319,
  // 4322–4324 at 9806 (grades 7–9), M16 4316–4317 without a school (grade 10) — v1.23.
  b.add({ role: 'student', schoolId: 2418, grade: 6 }, 3)
  b.grades({ role: 'student', schoolId: 9167 }, M16_GRADES_9167)
  b.grades({ role: 'student', schoolId: 9806 }, M16_GRADES_9806)
  b.add({ role: 'student', grade: 10 }, 2)
}

/** M16 players moved in v1.23: grades 7–9 in generator (id) order. */
export const M16_TO_9167: readonly number[] = [4302, 4303, 4304, 4305, 4306, 4307, 4308, 4309, 4310]
export const M16_TO_9806: readonly number[] = [
  4311, 4312, 4313, 4314, 4315, 4318, 4319, 4322, 4323, 4324,
]
export function m16MovedGrade(index: number): number {
  return 7 + (index % 3)
}
const M16_GRADES_9167 = M16_TO_9167.map((_, i) => m16MovedGrade(i))
const M16_GRADES_9806 = M16_TO_9806.map((_, i) => m16MovedGrade(i))

/**
 * M18 §6.11 B pupils outside the register: per school the grades (the first `rehomed` are the
 * re-homed pool pupils) and the indexes of the pupils that never logged in.
 */
export const M18_LOWER: readonly {
  school: number
  grades: readonly number[]
  rehomed: number
  never: readonly number[]
}[] = [
  // 8880: the 6 lower-form pupils (D6 and T1–T3; M18 lastActiveAt dates D6, T1, T2, T2), never.
  { school: 8880, grades: [6, 7, 8, 8, 9, 9], rehomed: 0, never: [0, 1, 2, 3, 4, 5] },
  { school: 8765, grades: [7, 7, 8, 8, 9], rehomed: 0, never: [] },
  { school: 8767, grades: [7, 7, 8, 8, 9], rehomed: 0, never: [4] },
  { school: 8772, grades: [7, 7, 8, 8, 9], rehomed: 1, never: [4] },
  // 7780: the 11 lower-form pupils are logged in (v1.21: 11 / 6 with the register's 6 never).
  { school: 7780, grades: [7, 7, 7, 7, 8, 8, 8, 9, 9, 9, 9], rehomed: 5, never: [] },
  // School 1: 14 logged in / 2 never (v1.21).
  {
    school: 1,
    grades: [1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 6, 6, 6],
    rehomed: 9,
    never: [14, 15],
  },
  { school: 3160, grades: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6], rehomed: 9, never: [11] },
  { school: 2700, grades: [1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 6], rehomed: 10, never: [] },
  // 2710: index 2 is M16's 4321 (Darjah 6, never logged in).
  { school: 2710, grades: [3, 5, 6, 6], rehomed: 2, never: [2] },
]

/** The 3 re-homed T4-pool pupils at filter schools: [school, grade]. */
export const REHOMED_AT_FILTER_SCHOOLS: readonly (readonly [number, number])[] = [
  [9924, 8],
  [9726, 9],
  [8641, 7],
]

/**
 * The 16 lower-level G students of the other filter schools (v1.22 set, §6.15 B/D): [school,
 * grade]. 8088's pupil is the only logged-in one (the M18 ranking pupil).
 */
export const FILTER_SCHOOL_PUPILS: readonly (readonly [number, number])[] = [
  [5441, 4],
  [8088, 9],
  [2418, 5],
  [3390, 3],
  [3931, 6],
  [5997, 2],
  [1712, 1],
  [3582, 4],
  [978, 2],
  [4961, 5],
  [998, 6],
  [1518, 4],
  [8209, 8],
  [853, 3],
  [854, 1],
  [1267, 1],
]

/** School admins at schools (§6.15 D, v1.21/v1.22): generated ones at these schools. */
export const GENERATED_SCHOOL_ADMIN_SCHOOLS: readonly number[] = [
  1518, 8209, 9924, 854, 8090, 8078, 987,
]
/** Of them, the 2 inactive (designed: part of the other roles' 13 inactive). */
const INACTIVE_SCHOOL_ADMIN_SCHOOLS = new Set([1518, 8209])
/** Generated school admins whose login is pinned (M17 latest logins, re-dated to 25 Sep). */
export const SCHOOL_ADMIN_LOGINS: Readonly<Record<number, string>> = {
  8090: '2026-09-25T13:36:00+08:00',
  8078: '2026-09-25T13:03:00+08:00',
}
export const FILTER_SCHOOL_PARENTS: readonly number[] = [9726, 8641]

// ---------------------------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------------------------

function addTeachers(b: Blocks): void {
  const eligible = M11_TEACHERS.filter(([s]) => !TEACHER_SPREAD_EXCLUDED.has(s))
  const loggedWeights = eligible.map(
    ([s, , tl]) => [s, tl - (TEACHER_ANCHORS_LOGGED[s] ?? 0)] as const,
  )
  const neverWeights = eligible.map(
    ([s, t, tl]) => [s, t - tl - (TEACHER_ANCHORS_NEVER[s] ?? 0)] as const,
  )
  const inactiveLogged = spread(TEACHER_INACTIVE_LOGGED_SPREAD, loggedWeights)
  const inactiveNever = spread(TEACHER_INACTIVE_NEVER_SPREAD, neverWeights)
  for (const [school, t, tl] of M11_TEACHERS) {
    const il = (TEACHER_INACTIVE_LOGGED_FIXED[school] ?? 0) + (inactiveLogged.get(school) ?? 0)
    const inv = inactiveNever.get(school) ?? 0
    b.add({ role: 'teacher', schoolId: school, hasLoggedIn: true }, tl - il)
    b.add({ role: 'teacher', schoolId: school, hasLoggedIn: true, isActive: false }, il)
    b.add({ role: 'teacher', schoolId: school }, t - tl - inv)
    b.add({ role: 'teacher', schoolId: school, isActive: false }, inv)
  }
  // Outside the register (29): canonical 5 (900001, logged in; outside the pins); 1919, 4401,
  // 5306–5315 logged in without a school (12, v1.20); 3101, 5301, 5316–5329 never (16).
  b.add({ role: 'teacher', schoolId: 900_001, hasLoggedIn: true }, 1)
  b.add({ role: 'teacher', hasLoggedIn: true }, 12)
  b.add({ role: 'teacher' }, 16)
}

// ---------------------------------------------------------------------------------------------
// Other roles (13 inactive, v1.20)
// ---------------------------------------------------------------------------------------------

function addOtherRoles(b: Blocks): void {
  // parent 38: canonical 6 (logged in), 5401–5411, 2 at filter schools, 24 generated (8 inactive).
  b.add({ role: 'parent', hasLoggedIn: true }, 1)
  for (const school of FILTER_SCHOOL_PARENTS) b.add({ role: 'parent', schoolId: school }, 1)
  const generatedParents = USERS_BY_ROLE.parent - 1 - 11 - FILTER_SCHOOL_PARENTS.length
  b.add({ role: 'parent' }, 11 + generatedParents - INACTIVE_OTHER.parent)
  b.add({ role: 'parent', isActive: false }, INACTIVE_OTHER.parent)
  // sponsor 6: canonical 7, 5501–5502, 3 generated (1 inactive); none logged in.
  b.add({ role: 'sponsor' }, USERS_BY_ROLE.sponsor - INACTIVE_OTHER.sponsor)
  b.add({ role: 'sponsor', isActive: false }, INACTIVE_OTHER.sponsor)
  // school_admin 16: canonical 8 (900001, logged in), 3103 (900001), 3102 (900003), 3104
  // (900002), 5601 (8102), 5602–5605 (3582, 978, 4961, 998), 7 generated (4 filter schools, 8090,
  // 8078 — logged in on 25 Sep —, 987).
  b.add({ role: 'school_admin', schoolId: 900_001, hasLoggedIn: true }, 1)
  b.add({ role: 'school_admin', schoolId: 900_001 }, 1)
  b.add({ role: 'school_admin', schoolId: 900_003 }, 1)
  b.add({ role: 'school_admin', schoolId: 900_002 }, 1)
  for (const [, school] of SCHOOL_ADMIN_FIXTURE_SCHOOLS)
    b.add({ role: 'school_admin', schoolId: school }, 1)
  for (const school of GENERATED_SCHOOL_ADMIN_SCHOOLS) {
    b.add(
      {
        role: 'school_admin',
        schoolId: school,
        hasLoggedIn: SCHOOL_ADMIN_LOGINS[school] !== undefined,
        isActive: !INACTIVE_SCHOOL_ADMIN_SCHOOLS.has(school),
      },
      1,
    )
  }
  // ppd_officer 5: canonical 9 (logged in), 5701–5703, 1 generated.
  b.add({ role: 'ppd_officer', hasLoggedIn: true }, 1)
  b.add({ role: 'ppd_officer' }, USERS_BY_ROLE.ppd_officer - 1)
  // jpn_officer 2: canonical 10 (logged in), 5711.
  b.add({ role: 'jpn_officer', hasLoggedIn: true }, 1)
  b.add({ role: 'jpn_officer' }, 1)
  // admin 2: canonical 1 (900002, grade 4 as live, logged in), 5801.
  b.add({ role: 'admin', schoolId: 900_002, grade: 4, hasLoggedIn: true }, 1)
  b.add({ role: 'admin' }, 1)
  // unmapped 6 (D9): generated, 2 inactive.
  b.add({ role: 'unmapped' }, USERS_BY_ROLE.unmapped - INACTIVE_OTHER.unmapped)
  b.add({ role: 'unmapped', isActive: false }, INACTIVE_OTHER.unmapped)
}

/** M02 fixture school admins 5601–5605: [user, school] (§6.14; 5605 at 998 since v1.22). */
export const SCHOOL_ADMIN_FIXTURE_SCHOOLS: readonly (readonly [number, number])[] = [
  [5601, 8102],
  [5602, 3582],
  [5603, 978],
  [5604, 4961],
  [5605, 998],
]

/**
 * The 13 inactive users of the other roles (v1.20), spread by share over the generated rows
 * (INFERRED): parents 8, sponsor 1, school admins 2 (at 1518, 8209), unmapped 2.
 */
const INACTIVE_OTHER = { parent: 8, sponsor: 1, school_admin: 2, unmapped: 2 } as const

let cached: CellSpec<UserFacets>[] | null = null

/** The compiled cell list (pure; memoised). */
export function usersDistribution(): CellSpec<UserFacets>[] {
  if (!cached) {
    const b = new Blocks()
    addStudents(b)
    addTeachers(b)
    addOtherRoles(b)
    cached = exact([...b.cells.values()])
  }
  return cached.map((c) => ({ facets: { ...c.facets }, count: c.count }))
}
