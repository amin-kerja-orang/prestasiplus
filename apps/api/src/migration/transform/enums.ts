/**
 * Explicit mapping table per enum column (v2-data-migration.md X2, plan T-01 / T-02). The keys are the
 * source values after `enumKey` (lower-case, `_` for spaces and dashes). A value that is not listed
 * goes to `etl_rejects` (UNKNOWN_ENUM); nothing is defaulted or guessed. Extend a table only from the
 * profile report of the real dump (BE-27), never from a hunch.
 */

/**
 * .cloud `users.role` -> v2 role code (T-01, v2-data-migration.md 4.1). The real .cloud roles are pelajar, guru, ibu_bapa,
 * admin_sekolah, agent, penaja, pegawai_ppd, admin and jpn_officer. `agent` is not migrated (`ROLES_NOT_MIGRATED`).
 * v2 has no `jpn_officer` role (D31a: one PPD/JPN role, ck_user_roles_role allows seven), so a JPN officer becomes a
 * `ppd_officer` whose scope is STATE level (`STATE_SCOPE_SOURCE_ROLES`, `transformUser`). Default taken from the pre-G4
 * review; the LEAD confirms it.
 */
export const ROLE_MAP: Readonly<Record<string, string>> = {
  pelajar: 'student',
  guru: 'teacher',
  ibu_bapa: 'parent',
  penaja: 'sponsor',
  admin_sekolah: 'school_admin',
  pegawai_ppd: 'ppd_officer',
  jpn_officer: 'ppd_officer',
  admin: 'admin',
}
export const ROLE_SOURCE_CODES: readonly string[] = Object.keys(ROLE_MAP)

/** Source roles whose `ppd_officer` gets a STATE scope (the school's state) instead of a district scope. */
export const STATE_SCOPE_SOURCE_ROLES: readonly string[] = ['jpn_officer']

/**
 * Known .cloud roles that are deliberately NOT migrated (LEAD, FIT-FIX): the account is rejected and counted by name
 * (`users.role_rejected.<role>` in the report notes), the same way the deferred practice modes are. Their dependent rows
 * (sessions, wallet, ...) then fall out as ORPHAN_PARENT.
 */
export const ROLES_NOT_MIGRATED: readonly string[] = ['agent']

/** .cloud `schools.type` -> v2 `SCHOOL_TYPES`. */
export const SCHOOL_TYPE_MAP: Readonly<Record<string, string>> = {
  sk: 'SK',
  smk: 'SMK',
  sjkc: 'SJK(C)',
  'sjk(c)': 'SJK(C)',
  sjk_c: 'SJK(C)',
  sjkt: 'SJK(T)',
  'sjk(t)': 'SJK(T)',
  sjk_t: 'SJK(T)',
  mrsm: 'MRSM',
  sbp: 'SBP',
}
export const SCHOOL_TYPE_SOURCE_CODES: readonly string[] = Object.keys(SCHOOL_TYPE_MAP)

/** v2 school types by phase, used to read a class label such as `4 Amanah` (T-09 grade derivation). */
export const PRIMARY_SCHOOL_TYPES: ReadonlySet<string> = new Set(['SK', 'SJK(C)', 'SJK(T)'])
export const SECONDARY_SCHOOL_TYPES: ReadonlySet<string> = new Set(['SMK', 'MRSM', 'SBP'])

/** .cloud `education_levels.stage` -> v2 `CurriculumStage` (identity map: a value outside the three is rejected). */
export const STAGE_MAP: Readonly<Record<string, string>> = {
  primary: 'primary',
  lower_secondary: 'lower_secondary',
  upper_secondary: 'upper_secondary',
}
export const STAGE_SOURCE_CODES: readonly string[] = Object.keys(STAGE_MAP)

/** .cloud `school_subscriptions.package` -> v2 `package_tier` (OD-22 / OD-27: unprofiled values are rejected). */
export const SUBSCRIPTION_TIER_MAP: Readonly<Record<string, 'basic' | 'full'>> = {
  asas: 'basic',
  basic: 'basic',
  premium: 'full',
  penuh: 'full',
  full: 'full',
}
export const SUBSCRIPTION_TIER_SOURCE_CODES: readonly string[] = Object.keys(SUBSCRIPTION_TIER_MAP)

/**
 * The v2 `school_packages` code of a subscription, derived from the school type: .cloud stores no form
 * level on a subscription. Working assumption (deviations log): primary schools get D1_D6, secondary
 * schools get T4 (the SPM product). A school without a type cannot be assigned and is rejected.
 */
export function packageCodeFor(schoolType: string | null): string | null {
  if (schoolType !== null && PRIMARY_SCHOOL_TYPES.has(schoolType)) return 'D1_D6'
  if (schoolType !== null && SECONDARY_SCHOOL_TYPES.has(schoolType)) return 'T4'
  return null
}

/** JPN codes (same table as the core schools seed, `prisma/seed/core/schools.ts`), keyed by upper-case state; an unlisted state uses its upper-case name. */
export const JPN_CODES: Readonly<Record<string, string>> = {
  JOHOR: 'JHR',
  KEDAH: 'KDH',
  KELANTAN: 'KTN',
  'KUALA LUMPUR': 'WPKL',
  LABUAN: 'WPL',
  MELAKA: 'MLK',
  'NEGERI SEMBILAN': 'NSN',
  PAHANG: 'PHG',
  PERAK: 'PRK',
  PERLIS: 'PLS',
  'PULAU PINANG': 'PNG',
  PUTRAJAYA: 'WPP',
  SABAH: 'SBH',
  SARAWAK: 'SWK',
  SELANGOR: 'SGR',
  TERENGGANU: 'TRG',
}

/** The shared fallback colour of a migrated subject that has none (NOT NULL in v2). */
export const DEFAULT_SUBJECT_COLOR = '#64748B'
