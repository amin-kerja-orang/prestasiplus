/**
 * Anchors of the users dataset: every observed or designed user record other modules refer to
 * (M02 SRS v1.18 §6.14, §6.15 B–D; M01 §6.8 canonical accounts). Each claims a slot of its own
 * cell, so no count changes (overview §6.6 step 3). All people are fictitious (CLAUDE.md §6).
 *
 * | Ids | Owner request | Placement |
 * |---|---|---|
 * | 1–11 | M01 canonical accounts (`src/mock/core-data/accounts.ts`) | as TRACKER; 4 at 900004 |
 * | 2001–2012 | M11 8080 anchors (Student A = 2008) | 8080 T5, logged in; 2012 Teacher T |
 * | 2013–2060 | M17 week / month / class-370 pupils | T5 register rows at 8080 / 8082 / 8106 / 8078 |
 * | 1919 · 4402, 4418 | M17 teachers | no school · 8082 |
 * | 3001–3008 · 3201–3215 | M08 | 900001 T5 · 8880 T4 (class 516) |
 * | 3101–3109 | M09 | 3101 teacher; 3102–3104 school admins at 900003 / 900001 / 900002; 3105–3109 pupils |
 * | 3151–3152 | M15 | no school, Darjah 6 |
 * | 4001–4108 · 4201–4208 | M14 | 8082 (40), 8078 (34), 8106 (34) · 8082 (4201, 4203–4206), 8087 (4202, v1.25), 8277 inactive (4207–4208) |
 * | 4301–4358 \ 4351 · 4401 | M16 | 4301 8106, 4320 8880, 4321 2710, 22 no class, 32 T4 pool · teacher |
 * | 4501–4504 | M04 SQ-7 contributors (M02 v1.18) | teachers at 8087, 8107, 8880 ("Guru Demo KL-01"), 8090 |
 * | 4664, 4644 | M12 | 8080 T5, logged in / never |
 * | 4627 | M18 XR-M18-21 (M02 v1.26) | 8082 T5, active, logged in (class-1156 pupil, MODELLED) |
 * | 5001–5990 | M02 fixtures (§6.14) | see below |
 *
 * INFERRED (unspecified by the SRS): the split of M17's PROPOSED block 2024–2060 (8080 class-370
 * members 2024–2051, then 8078 2052–2054, 8106 2055–2057, 8082 2058–2060), the order of M14's
 * 4001–4108 over their three schools, e-mails and names not given by an SRS, and the generated
 * login times of anchors whose SRS says only "logged in".
 */

import { CANONICAL_ACCOUNTS } from '@/mock/core-data/accounts'

import {
  classLevelOf,
  deriveUserFields,
  generatedLastLoginAt,
  generatedUserCreatedAt,
  generatedUserEmail,
  generatedUserName,
} from './users-derive'
import { M18_ACTIVITY_ANCHORS } from './users-activity'
import { m16MovedGrade, M16_TO_9167, M16_TO_9806 } from './users-spec'
import type { SubscriptionPackage, UserFacets, UserPool, UserRole, UserRow } from './users-types'

interface AnchorInput {
  id: number
  role: UserRole
  schoolId?: number | null
  grade?: number | null
  isActive?: boolean
  isComplimentary?: boolean
  pool?: UserPool | null
  /** `true` = logged in at a generated time; a string = that time; false/undefined = never. */
  login?: boolean | string
  name?: string
  email?: string
  extra?: Partial<Omit<UserRow, 'id' | keyof UserFacets>>
}

function compose(a: AnchorInput): UserRow {
  const facets: UserFacets = {
    role: a.role,
    isActive: a.isActive ?? true,
    isComplimentary: a.isComplimentary ?? false,
    schoolId: a.schoolId ?? null,
    grade: a.grade ?? null,
    hasLoggedIn: a.login !== undefined && a.login !== false,
    pool: a.pool ?? null,
  }
  const lastLoginAt = typeof a.login === 'string' ? a.login : generatedLastLoginAt(a.id, facets)
  const row: UserRow = {
    id: a.id,
    ...facets,
    ...deriveUserFields(a.id, facets),
    name: a.name ?? generatedUserName(a.id, a.role),
    email: a.email ?? generatedUserEmail(a.id, a.role),
    createdAt: generatedUserCreatedAt(a.id),
    lastLoginAt,
    lastActiveAt: a.id in M18_ACTIVITY_ANCHORS ? (M18_ACTIVITY_ANCHORS[a.id] ?? null) : lastLoginAt,
    classLevel: classLevelOf(facets.grade),
    ...a.extra,
  }
  if (row.updatedAt < row.createdAt) row.updatedAt = row.createdAt
  if ((row.lastLoginAt !== null) !== row.hasLoggedIn) {
    throw new Error(`users anchor ${String(a.id)}: lastLoginAt and hasLoggedIn disagree`)
  }
  return Object.freeze(row)
}

const range = (from: number, to: number, except: readonly number[] = []): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i).filter((n) => !except.includes(n))

// --- canonical accounts 1–11 (M01 §6.8; M05 §6 subscription / trial values) -------------------

function canonical(): AnchorInput[] {
  return CANONICAL_ACCOUNTS.map((c) => {
    const extra: NonNullable<AnchorInput['extra']> = {
      phone: c.phone,
      bio: c.bio,
      avatarUrl: c.avatarUrl,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }
    // M05 §6 accounts: the admin mirrors live "Baki 0 / 50 soalan"; pelajarmaju is subscribed until
    // 2026-12-31 (package INFERRED).
    if (c.id === 1) Object.assign(extra, { trialQuestionsUsed: 50 })
    // Account 2 (Pelajar trial): live "Baki 18 / 50 soalan" = 32 used (M05 SRS §6.12).
    if (c.id === 2) Object.assign(extra, { trialQuestionsUsed: 32 })
    if (c.id === 4) {
      Object.assign(extra, {
        subscriptionPackage: 'personal',
        subscriptionExpiresAt: '2026-12-31T23:59:59+08:00',
      })
    }
    // Officers and the school admin (M02 §6.14: 9 Selangor / PPD HULU LANGAT, 10 Selangor; 8 at
    // 900001 SMK DEMO, Selangor / PPD PETALING UTAMA).
    if (c.id === 8)
      Object.assign(extra, { ppdState: 'Selangor', ppdDistrict: 'PPD PETALING UTAMA' })
    if (c.id === 9) Object.assign(extra, { ppdState: 'Selangor', ppdDistrict: 'PPD HULU LANGAT' })
    if (c.id === 10) Object.assign(extra, { ppdState: 'Selangor', ppdDistrict: null })
    return {
      id: c.id,
      role: c.role,
      schoolId: c.schoolId,
      grade: c.grade,
      isActive: c.isActive,
      login: c.lastLoginAt ?? false,
      name: c.name,
      email: c.email,
      extra,
    }
  })
}

// --- M11 8080 anchors 2001–2012 (M11 §6.7; M02 §6.15 C) ----------------------------------------

const M11_8080: readonly (readonly [number, string, boolean | string])[] = [
  [2001, 'Afiqah Demo', true], // F
  [2002, 'Ahmad Danial Demo', '2026-07-05T05:57:00+08:00'], // Student B
  [2003, 'Aina Sofea Demo', '2026-06-16T02:20:00+08:00'], // D
  [2004, 'Aisyah Demo', true], // G
  [2005, 'Akmal Demo', true], // H ("Login sahaja")
  [2006, 'Alia Natasha Demo', '2026-06-15T18:20:00+08:00'], // E
  [2007, 'Amir Hakimi Demo', true], // I
  [2008, 'Adam Haikal Demo', '2026-06-16T14:11:00+08:00'], // Student A (observed live id)
  [2009, 'Amirah Demo', true], // J
  [2010, 'Nur Qistina Demo', true], // Student C
  [2011, "Nur'ain Demo", true], // apostrophe row (DV-M11-18)
]

// --- M17 pupils 2013–2060 (M17 §6.7 B–C; XR-M17-07) --------------------------------------------

function m17School(id: number): number {
  if ([2013, 2014, 2015, 2016, 2020].includes(id)) return 8082
  if ([2017, 2018, 2019, 2023].includes(id)) return 8106
  if ([2021, 2022].includes(id) || (id >= 2024 && id <= 2051)) return 8080
  if (id >= 2052 && id <= 2054) return 8078
  if (id >= 2055 && id <= 2057) return 8106
  return 8082 // 2058–2060
}

// --- M19 payers (M19 SRS §6.10, token order; M02 v1.22 §6.14) ----------------------------------

/**
 * [id, package, expiry (MYT)]. Package and expiry as M19 §6.10 (the owner's values; M02 §6.14
 * gives the same values; 5600 is "Personal Bulanan" (#65 PERSONAL-MON, +1 month) → 2026-10-13 12:35 per
 * M19 v1.2 split personal expiry, DV-M19-18).
 */
export const M19_PAYERS: readonly (readonly [number, SubscriptionPackage, string | null])[] = [
  [5600, 'personal', '2026-10-13T12:35:00+08:00'],
  [3301, 'none', null],
  [3302, 'none', null],
  [3303, 'none', null],
  [3304, 'none', null],
  [3305, 'none', null],
  [3306, 'none', null],
  [3307, 'none', null],
  [3308, 'none', null],
  [3309, 'none', null],
  [3310, 'none', null],
  [3311, 'none', null],
  [5475, 'regular_monthly', '2026-07-15T13:59:00+08:00'],
  [3312, 'none', null],
  [3313, 'none', null],
  [3614, 'regular_monthly', '2026-06-22T09:34:00+08:00'],
  [3314, 'none', null],
  [5451, 'regular_monthly', '2026-06-19T11:04:00+08:00'],
  [5450, 'regular_monthly', '2026-06-19T10:51:00+08:00'],
  [3315, 'none', null],
  [3316, 'none', null],
  [3317, 'none', null],
  [3318, 'personal', '2027-01-10T23:59:59+08:00'],
  [4373, 'regular_monthly', '2026-06-07T12:41:00+08:00'],
  [3319, 'none', null],
  [3320, 'none', null],
  [3321, 'none', null],
  [3322, 'none', null],
  [3323, 'none', null],
  [3324, 'none', null],
]

// --- M02 fixtures 5001–5990 (§6.14) --------------------------------------------------------------

const FIRST_NAMES_F = ['Nur Aina', 'Siti Aisyah', 'Nurul Huda', 'Aina Sofea', 'Puteri Balqis']
const FIRST_NAMES_M = ['Muhammad Hakim', 'Ahmad Irfan', 'Adam Rayyan', 'Amir Danial', 'Haziq Iman']

function fixtureStudentName(id: number): string {
  const i = id % 10
  return i < 5
    ? `${FIRST_NAMES_F[i] as string} Binti Demo ${String(id)}`
    : `${FIRST_NAMES_M[i - 5] as string} Bin Demo ${String(id)}`
}

/** Fictitious IC-shaped numbers of the complimentary fixtures (never a real person's). */
export function complimentaryIc(id: number): string | null {
  // Only the complimentary fixtures 5901–5989 have one; 5990 has none ("—", §6.14).
  if (id < 5901 || id > 5989) return null
  return `0801011400${String(id - 5900).padStart(2, '0')}`
}

/**
 * The school codes of the filter schools held by fixture school admins 5602–5605 (generated by
 * the M02 schools dataset: state letter, "B" for SK, district letter, 5-digit id; checked by the
 * M02 store test against `schools.get(id).code`).
 */
const SCHOOL_ADMIN_FIXTURES: readonly (readonly [number, number, string, string, string])[] = [
  // [user id, school id, login (lower-case code), state, district]
  [5601, 8102, 'bea4628', 'Selangor', 'PPD HULU LANGAT'],
  [5602, 3582, 'kbe03582', 'Kedah', 'PPD KUBANG PASU'],
  [5603, 978, 'bbb00978', 'Selangor', 'PPD HULU LANGAT'],
  [5604, 4961, 'tbd04961', 'Terengganu', 'PPD KEMAMAN'],
  [5605, 998, 'bbb00998', 'Selangor', 'PPD HULU LANGAT'],
]

function m02Fixtures(): AnchorInput[] {
  const out: AnchorInput[] = []
  for (const id of range(5001, 5210)) {
    out.push({
      id,
      role: 'student',
      schoolId: 8102,
      grade: 11,
      name: fixtureStudentName(id),
      email: `murid${String(id)}@demo.test`,
      extra: { idDelima: `m-demo${String(id)}@moe-dl.edu.my` },
    })
  }
  out.push({ id: 5301, role: 'teacher', name: 'Guru Dua Demo', email: 'guru2@demo.test' })
  for (const id of range(5302, 5305)) out.push({ id, role: 'teacher', schoolId: 8102 })
  // 5306–5315 logged in (5315 since v1.20, designed); 5316–5329 never.
  for (const id of range(5306, 5315))
    out.push({ id, role: 'teacher', login: '2026-08-01T20:00:00+08:00' })
  for (const id of range(5316, 5329)) out.push({ id, role: 'teacher' })
  out.push({ id: 5401, role: 'parent', name: 'Ibu Bapa Dua Demo', email: 'ibubapa2@demo.test' })
  for (const id of range(5402, 5411)) out.push({ id, role: 'parent' })
  for (const id of range(5501, 5502)) out.push({ id, role: 'sponsor' })
  for (const [id, schoolId, login, state, district] of SCHOOL_ADMIN_FIXTURES) {
    out.push({
      id,
      role: 'school_admin',
      schoolId,
      name: `Pentadbir Sekolah Demo ${String(id)}`,
      email: `${login}@prestasiplus.my`,
      extra: { ppdState: state, ppdDistrict: district },
    })
  }
  const ppdDistricts = ['PPD GOMBAK', 'PPD KLANG', 'PPD SEPANG']
  for (const id of range(5701, 5703)) {
    out.push({
      id,
      role: 'ppd_officer',
      extra: { ppdState: 'Selangor', ppdDistrict: ppdDistricts[id - 5701] ?? null },
    })
  }
  out.push({ id: 5711, role: 'jpn_officer', extra: { ppdState: 'Johor', ppdDistrict: null } })
  out.push({ id: 5801, role: 'admin' })
  for (const id of range(5901, 5990)) {
    const ic = complimentaryIc(id)
    out.push({
      id,
      role: 'student',
      schoolId: 8102,
      grade: 11,
      isComplimentary: true,
      // All 90 are active (v1.19: live S6 shows only "AKTIF"; BR-24 used 776 at 8102).
      name: fixtureStudentName(id),
      email:
        ic === null ? `komplimen${String(id)}@prestasiplus.my` : `${ic.slice(-6)}@prestasiplus.my`,
      // INFERRED (M02 BR-18, T3 G4): the SRS records no observed package for them; "full package until
      // packageExpiresAt" = `personal` until 31 Dec 2026 23:59:59 MYT (the S7 default end date).
      extra: {
        subscriptionPackage: 'personal',
        subscriptionExpiresAt: '2026-12-31T23:59:59+08:00',
      },
    })
  }
  return out
}

function allAnchors(): AnchorInput[] {
  const out: AnchorInput[] = [...canonical()]
  // M11 (8080).
  for (const [id, name, login] of M11_8080) {
    out.push({
      id,
      role: 'student',
      schoolId: 8080,
      grade: 11,
      login,
      name,
      email: `murid${String(id)}@demo.test`,
    })
  }
  out.push({
    id: 2012,
    role: 'teacher',
    schoolId: 8080,
    login: '2026-06-15T12:37:00+08:00',
    name: 'Cikgu Rahimah Demo',
    email: 'cikgu2012@demo.test',
  })
  // M17.
  for (const id of range(2013, 2060)) {
    out.push({
      id,
      role: 'student',
      schoolId: m17School(id),
      grade: 11,
      login: true,
      name: `Murid Demo ${String(id)}`,
      email: `murid${String(id)}@demo.test`,
    })
  }
  out.push({
    id: 1919,
    role: 'teacher',
    login: true,
    name: 'Cikgu Demo 1919',
    email: 'cikgu1919@demo.test',
  })
  for (const id of [4402, 4418]) {
    out.push({ id, role: 'teacher', schoolId: 8082, login: true, name: `Cikgu Demo ${String(id)}` })
  }
  // M08.
  const m08Logins: Readonly<Record<number, string>> = {
    3001: '2026-09-24T20:00:00+08:00',
    3002: '2026-09-24T20:00:00+08:00',
    3003: '2026-09-18T20:00:00+08:00',
    3004: '2026-09-15T20:00:00+08:00',
    3005: '2026-09-22T20:00:00+08:00',
    3006: '2026-09-22T20:00:00+08:00',
    3007: '2026-09-24T20:00:00+08:00',
    3008: '2026-09-22T20:00:00+08:00',
  }
  for (const id of range(3001, 3008)) {
    out.push({
      id,
      role: 'student',
      schoolId: 900_001,
      grade: 11,
      login: m08Logins[id],
      name: `Murid Demo ${String(id - 3000).padStart(2, '0')}`,
      email: `murid${String(id)}@demo.test`,
    })
  }
  for (const id of range(3201, 3215)) {
    out.push({
      id,
      role: 'student',
      schoolId: 8880,
      grade: 10,
      login: '2026-03-10T20:00:00+08:00',
      name: `Murid Simulasi ${String(id - 3200).padStart(2, '0')}`,
      email: `murid${String(id)}@demo.test`,
    })
  }
  // M09.
  out.push({ id: 3101, role: 'teacher', name: 'Cikgu Demo 01', email: 'cikgudemo01@demo.test' })
  out.push({
    id: 3102,
    role: 'school_admin',
    schoolId: 900_003,
    name: 'Azlan Demo',
    email: 'azlan@demo.test',
    extra: { ppdState: 'Selangor', ppdDistrict: 'PPD HULU LANGAT' },
  })
  out.push({
    id: 3103,
    role: 'school_admin',
    schoolId: 900_001,
    name: 'Salina Aziz Demo',
    email: 'salina@demo.test',
    extra: { ppdState: 'Selangor', ppdDistrict: 'PPD PETALING UTAMA' },
  })
  out.push({
    id: 3104,
    role: 'school_admin',
    schoolId: 900_002,
    name: 'Suhaimi Mat Demo',
    email: 'suhaimi@demo.test',
    extra: { ppdState: 'Johor', ppdDistrict: null },
  })
  for (const id of range(3105, 3109)) {
    out.push({
      id,
      role: 'student',
      grade: 6,
      name: `Pelajar Reaksi ${String(id - 3104)}`,
      email: `reaksi${String(id - 3104)}@demo.test`,
    })
  }
  // M15: at 2418 SEKOLAH KEBANGSAAN JELI (1), Darjah 6 (v1.23, XR-M02-02).
  for (const id of [3151, 3152]) {
    out.push({
      id,
      role: 'student',
      schoolId: 2418,
      grade: 6,
      name: `Pelajar Demo Hadiah ${String(id - 3150)}`,
      email: `hadiah${String(id - 3150)}@demo.test`,
    })
  }
  // M14.
  for (const id of range(4001, 4108)) {
    const schoolId = id <= 4040 ? 8082 : id <= 4074 ? 8078 : 8106
    out.push({
      id,
      role: 'student',
      schoolId,
      grade: 11,
      login: true,
      name: `Murid Demo ${String(id)}`,
      email: `murid${String(id)}@demo.test`,
    })
  }
  // 4202 is at 8087 since v1.25 (the observed M17 row <teacher:137>, login 04/06/2026 05:47 MYT):
  // it swaps with one generated 8087 teacher, which takes 4202's former 8082 slot (compile).
  for (const id of range(4201, 4206)) {
    out.push({
      id,
      role: 'teacher',
      schoolId: id === 4202 ? 8087 : 8082,
      login: id === 4202 ? '2026-06-04T05:47:00+08:00' : true,
      name: `Cikgu Demo ${String(id)}`,
      email: `cikgu${String(id)}@demo.test`,
    })
  }
  for (const id of [4207, 4208]) {
    out.push({
      id,
      role: 'teacher',
      schoolId: 8277,
      login: true,
      isActive: false,
      name: `Cikgu Demo ${String(id)}`,
      email: `cikgu${String(id)}@demo.test`,
    })
  }
  // M16.
  const longName = new Set([4352, 4353, 4354, 4356, 4357, 4358])
  const m16 = (id: number) =>
    longName.has(id) ? `Murid Demo Panjang ${String(id)}` : `Murid Demo ${String(id)}`
  out.push({
    id: 4301,
    role: 'student',
    schoolId: 8106,
    grade: 11,
    login: true,
    name: m16(4301),
    email: 'murid4301@demo.test',
  })
  out.push({
    id: 4320,
    role: 'student',
    schoolId: 8880,
    grade: 11,
    login: true,
    name: m16(4320),
    email: 'murid4320@demo.test',
  })
  out.push({
    id: 4321,
    role: 'student',
    schoolId: 2710,
    grade: 6,
    name: m16(4321),
    email: 'murid4321@demo.test',
  })
  // No-class players (v1.23, XR-M02-01): 4302–4310 at 9167 and 4311–4315, 4318, 4319, 4322–4324 at
  // 9806 (grades 7–9 in id order), 4325 at 2418 (Darjah 6); 4316, 4317 stay without a school (grade 10).
  const moved = new Map<number, [number, number]>([
    ...M16_TO_9167.map((id, i) => [id, [9167, m16MovedGrade(i)]] as [number, [number, number]]),
    ...M16_TO_9806.map((id, i) => [id, [9806, m16MovedGrade(i)]] as [number, [number, number]]),
    [4325, [2418, 6]],
  ])
  for (const id of [...range(4302, 4319), ...range(4322, 4325)]) {
    const [schoolId, grade] = moved.get(id) ?? [null, 10]
    out.push({
      id,
      role: 'student',
      schoolId,
      grade,
      name: m16(id),
      email: `murid${String(id)}@demo.test`,
    })
  }
  for (const id of range(4326, 4358, [4351])) {
    out.push({
      id,
      role: 'student',
      grade: 10,
      pool: 't4Pool',
      name: m16(id),
      email: `murid${String(id)}@demo.test`,
    })
  }
  out.push({
    id: 4401,
    role: 'teacher',
    login: true,
    name: 'Cikgu Demo 4401',
    email: 'cikgu4401@demo.test',
  })
  // M04 contributors (M02 v1.18).
  for (const [id, schoolId, name] of [
    [4501, 8087, 'Cikgu Demo 4501'],
    [4502, 8107, 'Cikgu Demo 4502'],
    [4503, 8880, 'Guru Demo KL-01'],
    [4504, 8090, 'Cikgu Demo 4504'],
  ] as const) {
    out.push({
      id,
      role: 'teacher',
      schoolId,
      login: true,
      name,
      email: `cikgu${String(id)}@demo.test`,
    })
  }
  // M12.
  out.push({ id: 4664, role: 'student', schoolId: 8080, grade: 11, login: true })
  out.push({ id: 4644, role: 'student', schoolId: 8080, grade: 11 })
  // M18 XR-M18-21 (M02 v1.26): the class-1156 pupil keeps its live id. It takes the slot of a
  // generated, active, logged-in 8082 grade-11 register row (the compiler removes the slot of that
  // cell nearest to the id); `lastActiveAt` 2026-09-15 12:00 is in M18_ACTIVITY_ANCHORS.
  out.push({
    id: 4627,
    role: 'student',
    schoolId: 8082,
    grade: 11,
    login: true,
    name: 'Murid Demo 4627',
    email: 'murid4627@demo.test',
  })
  // M19 payers (v1.22, XR-M19-02): 8102, grade 11, active, never logged in.
  M19_PAYERS.forEach(([id, pkg, expiresAt], i) => {
    const n = String(i + 1).padStart(2, '0')
    out.push({
      id,
      role: 'student',
      schoolId: 8102,
      grade: 11,
      name: `Pembayar Demo ${n}`,
      email: `pembayar${n}@demo.test`,
      extra: { subscriptionPackage: pkg, subscriptionExpiresAt: expiresAt },
    })
  })
  // M02 fixtures.
  out.push(...m02Fixtures())
  return out
}

/** Every literal anchor row, in id order. */
export const USER_ANCHOR_ROWS: readonly UserRow[] = Object.freeze(
  allAnchors()
    .map(compose)
    .sort((a, b) => a.id - b.id),
)

/** Anchor ids per requesting module (for the placement tests and reviews). */
export const USER_ANCHOR_BLOCKS = {
  canonical: range(1, 11),
  m11: range(2001, 2012),
  m17: [...range(2013, 2060), 1919, 4402, 4418],
  m08: [...range(3001, 3008), ...range(3201, 3215)],
  m09: range(3101, 3109),
  m15: [3151, 3152],
  m14: [...range(4001, 4108), ...range(4201, 4208)],
  m16: [...range(4301, 4358, [4351]), 4401],
  m04: range(4501, 4504),
  m12: [4664, 4644],
  m19: M19_PAYERS.map(([id]) => id),
} as const

export { SCHOOL_ADMIN_FIXTURES }
