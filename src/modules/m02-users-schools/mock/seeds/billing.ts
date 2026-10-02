/**
 * M02-T3 seeds (SRS v1.28 §6.14 "Packages", "Subscriptions", "Complimentary"):
 *
 * | Table | Rows |
 * |---|---|
 * | `schools.packages` | the 4 packages of BR-22 (OBSERVED ids 1–4, RM30.00 per student per year) |
 * | `schools.subscriptions` | **the 14 live rows**, every attribute OBSERVED (M19 discovery §5.3 C1); no id 3, as live |
 * | `users.complimentaryProfiles` | 90 rows for the users 5901–5990: coins OFF (as live), package end 2026-12-31 |
 *
 * INFERRED (the SRS gives dates only, never times or creation stamps): every start / end is 09:00 MYT of
 * the observed date; `createdAt` = `startsAt`; `updatedAt` = `startsAt`. Subscription 10 was upgraded at
 * 08/05/2026 03:09 (its observed note), so its end and `updatedAt` are that instant (+1 year). The
 * complimentary package end is the S7 default (31 December of the clock's year); "Sekolah asal" is derived
 * from the user's school when the profile holds none.
 *
 * `used` is never seeded: it is computed from the users store (BR-24; §6.15 C reproduces the observed
 * 150, 59, 776, 549, 2, 562, 423, 185, 386, 312, 13, 675 …). Bump the M02 plugin `version` when these change.
 */

import { users } from '@/modules/m01-authentication/mock'

import {
  complimentaryRepo,
  setHiddenComp,
  DEFAULT_PACKAGE_EXPIRES_AT,
  type ComplimentaryProfileRow,
} from '../repository/complimentary'
import {
  BASIC_QUESTION_LIMIT,
  schoolPackagesRepo,
  schoolSubscriptionsRepo,
  type SchoolPackageRow,
  type SchoolSubscriptionRow,
} from '../repository/subscriptions'
import type { PackageTier, SubscriptionStatus } from '../../api/subscriptions'

export const SEED_PACKAGES: readonly SchoolPackageRow[] = Object.freeze([
  {
    id: 1,
    code: 'T4',
    name: 'Pakej SPM Tingkatan 4',
    slug: 'spm-t4',
    educationLevel: 'spm',
    formLevel: 't4',
    priceAnnual: '30.00',
    maxRenewals: 1,
    isActive: true,
  },
  {
    id: 2,
    code: 'T5',
    name: 'Pakej SPM Tingkatan 5',
    slug: 'spm-t5',
    educationLevel: 'spm',
    formLevel: 't5',
    priceAnnual: '30.00',
    maxRenewals: 0,
    isActive: true,
  },
  {
    id: 3,
    code: 'D1_D6',
    name: 'Pakej Rendah (Darjah 1-6)',
    slug: 'primary-d1-d6',
    educationLevel: 'primary',
    formLevel: 'd1_d6',
    priceAnnual: '30.00',
    maxRenewals: 5,
    isActive: true,
  },
  {
    id: 4,
    code: 'T1_T3',
    name: 'Pakej Menengah Rendah (Tingkatan 1-3)',
    slug: 'lower-sec-t1-t3',
    educationLevel: 'lower_secondary',
    formLevel: 't1_t3',
    priceAnnual: '30.00',
    maxRenewals: 2,
    isActive: true,
  },
])

const at = (date: string, time = '09:00:00'): string => `${date}T${time}+08:00`

/** [id, school, package (1 = T4, 2 = T5), tier, quota, status, start, end, notes]. */
type Observed = readonly [
  number,
  number,
  number,
  PackageTier,
  number,
  SubscriptionStatus,
  string,
  string,
  string | null,
]

const OBSERVED: readonly Observed[] = [
  [1, 8228, 1, 'basic', 150, 'cancelled', '2026-02-20', '2027-02-20', null],
  [2, 8880, 1, 'basic', 120, 'cancelled', '2026-02-20', '2027-02-20', null],
  [4, 8107, 2, 'basic', 675, 'expired', '2026-03-03', '2026-05-22', null],
  [5, 8277, 2, 'basic', 150, 'cancelled', '2026-03-03', '2026-04-03', null],
  [6, 8087, 2, 'full', 305, 'active', '2026-03-07', '2027-04-19', null],
  [7, 8090, 2, 'full', 354, 'active', '2026-03-08', '2027-05-08', null],
  [8, 8080, 2, 'full', 164, 'active', '2026-03-11', '2027-05-12', null],
  [9, 8078, 2, 'full', 415, 'active', '2026-04-13', '2027-05-12', null],
  [
    10,
    8106,
    2,
    'full',
    500,
    'active',
    '2026-04-21',
    '2027-05-08',
    '[Naik taraf Pemantauan → Penuh pada 08/05/2026 03:09]',
  ],
  [11, 10220, 2, 'basic', 1000, 'active', '2026-05-11', '2027-05-11', null],
  [12, 8082, 2, 'full', 1000, 'active', '2026-05-12', '2027-05-12', null],
  [13, 8102, 2, 'full', 1000, 'cancelled', '2026-05-12', '2027-05-12', null],
  [
    14,
    8277,
    2,
    'basic',
    1000,
    'active',
    '2026-05-12',
    '2027-05-12',
    'Demo subscription added 2026-05-12 - school had data but no subscription, dashboard hidden',
  ],
  [15, 8880, 2, 'basic', 1000, 'active', '2026-05-12', '2027-05-12', null],
]

/** Subscription 10 was upgraded at this instant (its observed note); its end is one year later. */
const UPGRADED_AT = at('2026-05-08', '03:09:00')

/** The 14 observed rows (no id 3), by id. */
export const SEED_SUBSCRIPTIONS: readonly SchoolSubscriptionRow[] = Object.freeze(
  OBSERVED.map(
    ([id, schoolId, schoolPackageId, packageTier, studentQuota, status, from, to, notes]) => {
      const startsAt = at(from)
      const upgraded = id === 10
      return {
        id,
        schoolId,
        schoolPackageId,
        packageTier,
        studentQuota,
        status,
        startsAt,
        endsAt: upgraded ? at(to, '03:09:00') : at(to),
        questionLimit: packageTier === 'basic' ? BASIC_QUESTION_LIMIT : null,
        paymentReference: null,
        paymentNotes: null,
        notes,
        createdAt: startsAt,
        updatedAt: upgraded ? UPGRADED_AT : startsAt,
      }
    },
  ),
)

/** The 90 complimentary students (§6.14: user ids 5901–5990). */
export const COMPLIMENTARY_FIXTURE_IDS: readonly number[] = Object.freeze(
  Array.from({ length: 90 }, (_, i) => 5901 + i),
)

export const SEED_COMPLIMENTARY_PROFILES: readonly ComplimentaryProfileRow[] = Object.freeze(
  COMPLIMENTARY_FIXTURE_IDS.map((id) => ({
    id,
    coinsEnabled: false,
    packageExpiresAt: DEFAULT_PACKAGE_EXPIRES_AT,
    originalSchoolName: null,
  })),
)

/** Reset override keys of M02 (SRS §12): `mock.reset({comp: n, profile: 'subscriptions-extra'})`. */
export const OVERRIDE_COMP = 'comp'
export const OVERRIDE_PROFILE = 'profile'
export const PROFILE_SUBSCRIPTIONS_EXTRA = 'subscriptions-extra'
export const M02_OVERRIDES: readonly string[] = [OVERRIDE_COMP, OVERRIDE_PROFILE]

/**
 * The test-only profile `subscriptions-extra` (§6.14; never loaded with observed-figure checks): one grace
 * row at the fixture school 900001 "SMK DEMO". Designed values: id 16 (the next after the observed 15),
 * T5 full, quota 100, start 2026-03-01, end 2026-09-20 (just lapsed, so "Tempoh Ihsan").
 */
export const SUBSCRIPTIONS_EXTRA_ROW: SchoolSubscriptionRow = Object.freeze({
  id: 16,
  schoolId: 900_001,
  schoolPackageId: 2,
  packageTier: 'full',
  studentQuota: 100,
  status: 'grace',
  startsAt: at('2026-03-01'),
  endsAt: at('2026-09-20'),
  questionLimit: null,
  paymentReference: null,
  paymentNotes: null,
  notes: null,
  createdAt: at('2026-03-01'),
  updatedAt: at('2026-03-01'),
})

type Overrides = Readonly<Record<string, unknown>>

function compCount(overrides: Overrides): number {
  const v = overrides[OVERRIDE_COMP]
  if (v === undefined) return COMPLIMENTARY_FIXTURE_IDS.length
  if (
    typeof v !== 'number' ||
    !Number.isInteger(v) ||
    v < 0 ||
    v > COMPLIMENTARY_FIXTURE_IDS.length
  )
    throw new Error(
      `M02 override 'comp' must be an integer 0–${String(COMPLIMENTARY_FIXTURE_IDS.length)}, got ${JSON.stringify(v)}`,
    )
  return v
}

function profileOf(overrides: Overrides): string | null {
  const v = overrides[OVERRIDE_PROFILE]
  if (v === undefined) return null
  if (v !== PROFILE_SUBSCRIPTIONS_EXTRA)
    throw new Error(
      `M02 override 'profile' must be '${PROFILE_SUBSCRIPTIONS_EXTRA}', got ${JSON.stringify(v)}`,
    )
  return v
}

/** Seed phase. */
export function seedBilling(overrides: Overrides = {}): void {
  const keep = compCount(overrides)
  const profile = profileOf(overrides)
  schoolPackagesRepo.seedRows(SEED_PACKAGES)
  schoolSubscriptionsRepo.seedRows(
    profile === null ? SEED_SUBSCRIPTIONS : [...SEED_SUBSCRIPTIONS, SUBSCRIPTIONS_EXTRA_ROW],
  )
  complimentaryRepo.seedRows(SEED_COMPLIMENTARY_PROFILES.slice(0, keep))
  setHiddenComp(COMPLIMENTARY_FIXTURE_IDS.slice(keep))
}

/** Finalise phase: the seeded rows point at users and packages of the right kind (returns the problems). */
export function checkBilling(overrides: Overrides = {}): string[] {
  const issues: string[] = []
  for (const row of schoolSubscriptionsRepo.all()) {
    if (!schoolPackagesRepo.get(row.schoolPackageId))
      issues.push(
        `subscription ${String(row.id)}: package ${String(row.schoolPackageId)} does not exist`,
      )
    if (row.studentQuota < 1 || row.studentQuota > 2000)
      issues.push(`subscription ${String(row.id)}: quota out of range`)
  }
  const counts = schoolSubscriptionsRepo.countByStatus()
  const grace = profileOf(overrides) === null ? 0 : 1
  if (
    counts.active !== 9 ||
    counts.grace !== grace ||
    counts.expired !== 1 ||
    counts.cancelled !== 4
  )
    issues.push(
      `subscription status counts differ from the observed 9 · ${String(grace)} · 1 · 4: ${JSON.stringify(counts)}`,
    )
  for (const profile of complimentaryRepo.all()) {
    const user = users.get(profile.id)
    if (user?.role !== 'student' || !user.isComplimentary)
      issues.push(`complimentary profile ${String(profile.id)}: not a complimentary student`)
  }
  return issues
}
