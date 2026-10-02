/**
 * Generated (non-observed) user fields: pure functions of the id and the facets, so most of them
 * are cheap fields of the users dataset (overview §6.6). Every generated person is fictitious
 * (CLAUDE.md §6): "Pelajar Demo 000123" / `pelajar000123@demo.test`, "Guru Demo 0456" /
 * `guru0456@demo.test` (M11 §6.5 naming), and so on per role.
 */

import { toIsoMyt } from '@/lib/time'
import { hashKey } from '@/mock/dataset'

import { SCHOOL_ADMIN_LOGINS } from './users-spec'
import type { UserFacets, UserRole, UserRow } from './users-types'

const pad = (n: number, width: number) => String(n).padStart(width, '0')

const NAME_EMAIL: Readonly<Record<UserRole, (id: number) => [name: string, email: string]>> = {
  student: (id) => [`Pelajar Demo ${pad(id, 6)}`, `pelajar${pad(id, 6)}@demo.test`],
  teacher: (id) => [`Guru Demo ${pad(id, 4)}`, `guru${pad(id, 4)}@demo.test`],
  parent: (id) => [`Ibu Bapa Demo ${pad(id, 4)}`, `ibubapa${pad(id, 4)}@demo.test`],
  sponsor: (id) => [`Penaja Demo ${pad(id, 4)}`, `penaja${pad(id, 4)}@demo.test`],
  school_admin: (id) => [
    `Pentadbir Sekolah Demo ${pad(id, 4)}`,
    `adminsekolah${pad(id, 4)}@demo.test`,
  ],
  ppd_officer: (id) => [`Pegawai PPD Demo ${pad(id, 4)}`, `ppd${pad(id, 4)}@demo.test`],
  jpn_officer: (id) => [`Pegawai JPN Demo ${pad(id, 4)}`, `jpn${pad(id, 4)}@demo.test`],
  admin: (id) => [`Admin Demo ${pad(id, 4)}`, `admin${pad(id, 4)}@demo.test`],
  unmapped: (id) => [`Pengguna Demo ${pad(id, 4)}`, `pengguna${pad(id, 4)}@demo.test`],
}

export function generatedUserName(id: number, role: UserRole): string {
  return NAME_EMAIL[role](id)[0]
}

export function generatedUserEmail(id: number, role: UserRole): string {
  return NAME_EMAIL[role](id)[1]
}

/** Designed creation time of generated users: increasing with id (live auto-increment). */
const CREATED_BASE_MS = Date.parse('2025-03-01T08:00:00+08:00')
const CREATED_STEP_MS = 2 * 3_600_000

export function generatedUserCreatedAtMs(id: number): number {
  return CREATED_BASE_MS + id * CREATED_STEP_MS
}

export function generatedUserCreatedAt(id: number): string {
  return toIsoMyt(generatedUserCreatedAtMs(id))
}

/**
 * Login windows of generated logged-in users (designed; M02 §6.15 C gives only logged in / never).
 * Generated logins stay before 2026-08-21, so the M17 login windows (today / week / month at the
 * project clock) hold only the designed anchors' logins.
 * - M18 PPD BATANG PADANG pupils (7780, 1): 2026-02-26 … 2026-02-28 (M18 §6.11 B).
 */
const WINDOW_DEFAULT: readonly [string, string] = [
  '2026-01-05T07:00:00+08:00',
  '2026-08-20T22:00:00+08:00',
]
const WINDOW_BY_SCHOOL: Readonly<Record<number, readonly [string, string]>> = {
  7780: ['2026-02-26T08:00:00+08:00', '2026-02-28T22:00:00+08:00'],
  1: ['2026-02-26T08:00:00+08:00', '2026-02-28T22:00:00+08:00'],
}

export function generatedLastLoginAt(id: number, facets: Readonly<UserFacets>): string | null {
  if (!facets.hasLoggedIn) return null
  // The generated school admins of 8090 / 8078: M17's latest logins, re-dated to 25 Sep (v1.21).
  const pinned =
    facets.role === 'school_admin' && facets.schoolId !== null
      ? SCHOOL_ADMIN_LOGINS[facets.schoolId]
      : undefined
  if (pinned !== undefined) return pinned
  const [fromIso, toIso] =
    (facets.schoolId === null ? undefined : WINDOW_BY_SCHOOL[facets.schoolId]) ?? WINDOW_DEFAULT
  const from = Math.max(Date.parse(fromIso), generatedUserCreatedAtMs(id) + 3_600_000)
  const to = Math.max(Date.parse(toIso), from)
  const minutes = Math.floor((to - from) / 60_000)
  const offset = minutes > 0 ? hashKey(id, 7) % minutes : 0
  return toIsoMyt(from + offset * 60_000)
}

/** M02 DATA-M02-01 `classLevel` from `grade` (1–6 → D1–D6, 7–11 → T1–T5). */
export function classLevelOf(grade: number | null): string | null {
  if (grade === null || !Number.isInteger(grade)) return null
  if (grade >= 1 && grade <= 6) return `D${String(grade)}`
  if (grade >= 7 && grade <= 11) return `T${String(grade - 6)}`
  return null
}

/** Non-cheap generated fields (`derive`). */
export function deriveUserFields(
  id: number,
  facets: Readonly<UserFacets>,
): Omit<
  UserRow,
  | 'id'
  | keyof UserFacets
  | 'name'
  | 'email'
  | 'createdAt'
  | 'lastLoginAt'
  | 'lastActiveAt'
  | 'classLevel'
> {
  const officer = facets.role === 'ppd_officer' || facets.role === 'jpn_officer'
  return {
    phone: hashKey(id, 3) % 5 < 2 ? null : `012${pad(id, 7)}`,
    bio: null,
    avatarUrl: null,
    updatedAt: generatedUserCreatedAt(id),
    // Generated officers: INFERRED Selangor / PPD HULU LANGAT (as the canonical PPD officer).
    ppdState: officer ? 'Selangor' : null,
    ppdDistrict: facets.role === 'ppd_officer' ? 'PPD HULU LANGAT' : null,
    subscriptionPackage: 'none',
    subscriptionExpiresAt: null,
    hasPkskSubscription: false,
    idDelima: null,
    createdById: null,
    trialQuestionsUsed: 0,
  }
}
