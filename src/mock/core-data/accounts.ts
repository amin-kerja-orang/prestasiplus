/**
 * Canonical demo accounts 1–11 (TRACKER "Canonical seed accounts"; M01 SRS §6.8, DATA-M01-01;
 * overview §7). Every module uses these ids; they are never renumbered.
 *
 * This file has **no imports**, so the Playwright code (`e2e/**`, `tsconfig.e2e.json`, no `@/`
 * alias) can import it by relative path: it is the single source of the demo accounts for the mock
 * seed and for E2E (overview §7).
 *
 * Privacy: every name is fictitious (CLAUDE.md §6). The password is demo-only and fictitious
 * (Delivery Lead decision 2026-09-26: it may be documented in README for stakeholder demos).
 *
 * Value sources:
 * - id, email, role, name, grade, IC, school, `isActive`: M01 SRS §6.8 table (TRACKER).
 * - `lastLoginAt`: M01 SRS §6.8 "lastLoginAt seed values" (BR-25; designed except the admin date).
 * - `createdAt`: the admin's "Ahli sejak 6 Februari 2026" is OBSERVED on `/profile` (M01 S7-007);
 *   the time of day and the other accounts' dates are **designed** (not observed on live; M01 SRS
 *   gives no value). All canonical accounts use the same designed creation time. `updatedAt`
 *   equals `createdAt`.
 * - `phone`, `bio`, `avatarUrl`: not given by the SRS → null (initials avatar, BR-15).
 */

/** Demo password of every canonical account (M01 §6.8, ≥ 6 characters). */
export const DEMO_PASSWORD = 'Demo1234'

/** The M02 schools the canonical accounts reference (records are M02 dataset anchors, built in F-23). */
export const CANONICAL_SCHOOL_IDS = {
  /** 900001 "SMK DEMO" (BEA4001, Selangor, PPD PETALING UTAMA): accounts 2, 4, 5, 8. */
  smkDemo: 900_001,
  /** 900002 "SK Demo" (Johor): account 1. */
  skDemo: 900_002,
  /**
   * 900004 "SK Demo Bestari" (fixture, Johor): no canonical account since D54 (2026-10-24: account
   * 4 became a Tingkatan 4 pupil at SMK DEMO; before that it was moved here from 900002 on
   * 2026-09-27, XR-M08-01; XL3 R2-01, M01 v1.11 / M02 v1.16).
   */
  skDemoBestari: 900_004,
} as const

export type CanonicalRole =
  | 'student'
  | 'teacher'
  | 'parent'
  | 'sponsor'
  | 'school_admin'
  | 'ppd_officer'
  | 'jpn_officer'
  | 'admin'

/** One canonical account: the base User fields of DATA-M01-01 plus the demo password. */
export interface CanonicalAccount {
  readonly id: number
  readonly email: string
  readonly password: string
  readonly role: CanonicalRole
  readonly name: string
  /** 1–6 Darjah, 7–11 Tingkatan; null for non-students. */
  readonly grade: number | null
  readonly icNumber: string | null
  readonly schoolId: number | null
  readonly phone: string | null
  readonly bio: string | null
  readonly avatarUrl: string | null
  readonly isActive: boolean
  /** ISO 8601, +08:00. */
  readonly createdAt: string
  readonly updatedAt: string
  readonly lastLoginAt: string | null
}

/** Designed creation time (date observed for the admin only, see the file header). */
const CREATED_AT = '2026-02-06T09:00:00+08:00'

type AccountInput = Omit<
  CanonicalAccount,
  'password' | 'phone' | 'bio' | 'avatarUrl' | 'createdAt' | 'updatedAt' | 'isActive'
> & { isActive?: boolean }

function account(input: AccountInput): CanonicalAccount {
  return Object.freeze({
    password: DEMO_PASSWORD,
    phone: null,
    bio: null,
    avatarUrl: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...input,
    isActive: input.isActive ?? true,
  })
}

/** Accounts 1–11 in id order. */
export const CANONICAL_ACCOUNTS: readonly CanonicalAccount[] = Object.freeze([
  account({
    id: 1,
    email: 'admin@demo.test',
    role: 'admin',
    name: 'Admin Demo',
    grade: 4,
    icNumber: null,
    schoolId: CANONICAL_SCHOOL_IDS.skDemo,
    lastLoginAt: '2026-09-25T09:00:00+08:00',
  }),
  account({
    id: 2,
    email: 'pelajar@demo.test',
    role: 'student',
    name: 'Pelajar Demo',
    grade: 10,
    icNumber: '100101140001',
    schoolId: CANONICAL_SCHOOL_IDS.smkDemo,
    lastLoginAt: '2026-09-24T20:15:00+08:00',
  }),
  account({
    id: 3,
    email: 'pelajar2@demo.test',
    role: 'student',
    name: 'Pelajar Dua Demo',
    grade: 5,
    icNumber: null,
    schoolId: null,
    lastLoginAt: '2026-09-20T19:30:00+08:00',
  }),
  account({
    id: 4,
    email: 'pelajarmaju@demo.test',
    role: 'student',
    name: 'Pelajar Maju Demo',
    grade: 10,
    icNumber: null,
    schoolId: CANONICAL_SCHOOL_IDS.smkDemo,
    lastLoginAt: '2026-09-24T18:00:00+08:00',
  }),
  account({
    id: 5,
    email: 'guru@demo.test',
    role: 'teacher',
    name: 'Guru Demo',
    grade: null,
    icNumber: null,
    schoolId: CANONICAL_SCHOOL_IDS.smkDemo,
    lastLoginAt: '2026-09-24T21:00:00+08:00',
  }),
  account({
    id: 6,
    email: 'ibubapa@demo.test',
    role: 'parent',
    name: 'Ibu Bapa Demo',
    grade: null,
    icNumber: null,
    schoolId: null,
    lastLoginAt: '2026-09-10T21:00:00+08:00',
  }),
  account({
    id: 7,
    email: 'penaja@demo.test',
    role: 'sponsor',
    name: 'Penaja Demo',
    grade: null,
    icNumber: null,
    schoolId: null,
    lastLoginAt: null,
  }),
  account({
    id: 8,
    email: 'adminsekolah@demo.test',
    role: 'school_admin',
    name: 'Pentadbir Sekolah Demo',
    grade: null,
    icNumber: null,
    schoolId: CANONICAL_SCHOOL_IDS.smkDemo,
    lastLoginAt: '2026-09-20T10:00:00+08:00',
  }),
  account({
    id: 9,
    email: 'ppd@demo.test',
    role: 'ppd_officer',
    name: 'Pegawai PPD Demo',
    grade: null,
    icNumber: null,
    schoolId: null,
    lastLoginAt: '2026-09-19T09:30:00+08:00',
  }),
  account({
    id: 10,
    email: 'jpn@demo.test',
    role: 'jpn_officer',
    name: 'Pegawai JPN Demo',
    grade: null,
    icNumber: null,
    schoolId: null,
    lastLoginAt: '2026-09-19T10:00:00+08:00',
  }),
  account({
    id: 11,
    email: 'tidakaktif@demo.test',
    role: 'student',
    name: 'Pelajar Tidak Aktif Demo',
    grade: 7,
    icNumber: null,
    // 9167 SMK GHAFAR BABA (Melaka) since M01 v1.12 / M02 v1.23 (XR-M02-03).
    schoolId: 9167,
    isActive: false,
    lastLoginAt: null,
  }),
])

/** Canonical account by e-mail (exact, lower case), for E2E helpers. */
export function canonicalAccount(emailOrId: string | number): CanonicalAccount | undefined {
  return CANONICAL_ACCOUNTS.find((a) =>
    typeof emailOrId === 'number' ? a.id === emailOrId : a.email === emailOrId.toLowerCase(),
  )
}
