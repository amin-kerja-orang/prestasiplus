/**
 * The `users` repository (owner **M01**, with the M02 admin extensions; D12, overview §6.7; M02
 * SRS v1.26 §6.15 B–D). Built by F-23 from the F-11 provisional definition: the store is now the
 * users virtual dataset (5,159 users, the canonical accounts 1–11 and every module's user anchors
 * as literal anchors), and the `users.secrets` store with every secret method moved **unchanged**.
 *
 * **Secrets: salted one-way hashes only** (Delivery Lead decision after review F11-1; overview §7
 * "Passwords"; M01 NFR-M01-03). The password and the IC number are **not** fields of the user row.
 * The persisted store `users.secrets` (keyed by user id) holds `{passwordHash, icHash, icMasked,
 * salt}`: SHA-256 (`@/mock/core-data/sha256`, synchronous) of `salt + kind + value`, with a
 * per-user salt. The plaintext is dropped right after hashing, so no plaintext password or IC is
 * ever in a diff, in IndexedDB or in a cross-tab broadcast.
 *
 * - Seeded salts are derived from the user id (deterministic seeds); runtime salts come from
 *   `crypto.getRandomValues`. A user keeps one salt, so both hashes stay verifiable.
 * - `icMasked` is the live mask "xxxxxx-xx-xx" + the last 2 digits (M18 BR-M18-27, DV-M18-13).
 * - **Privacy deviation for M02 SEC-M02-07** (the admin user detail returns the full IC on live):
 *   `adminIcNumber` returns the plaintext IC only for seeded fixture accounts, whose ICs are
 *   fictitious and held in an in-memory fixture map (never persisted). For an IC set or changed at
 *   runtime it returns `icMasked`, because the plaintext no longer exists.
 * - Users without a secrets row (the generated users) cannot log in with a password; the `setUser`
 *   test hook still opens a session for them.
 *
 * Contract (overview §6.7; `count` / `groupCount` / `query` / `sample` / `where` are the named
 * queries of `userQueries`): `get`, `getMany`, `findByEmail`, `search`, `adminList`, `roleCounts`,
 * `countWhere`, `schoolsWithUsers`, `selection`, `isSubscribed`, `trial`, `incrementTrialUsed`,
 * `create`, `update`, `remove`, `recordLogin`, and the secret methods.
 *
 * Repository methods are synchronous; writes take `now` (epoch ms, `ctx.clock.now()`).
 */

import { toIsoMyt } from '@/lib/time'
import { CANONICAL_ACCOUNTS } from '@/mock/core-data/accounts'
import { sha256Hex } from '@/mock/core-data/sha256'
import { defineNamedQueries } from '@/mock/dataset'
import { defineTable, floor, ID_RANGES, type Where } from '@/mock/define'
import { defineRepository } from '@/mock/repository'

import { assignActivity, setCompiledActivity, type ActivityRow } from '../datasets/users-activity'
import { USER_ANCHOR_ROWS } from '../datasets/users-anchors'
import { classLevelOf } from '../datasets/users-derive'
import {
  ATTENDANCE_MIRROR,
  COMPLIMENTARY_TOTAL,
  FIXTURE_SCHOOL_STUDENTS,
  FIXTURE_SCHOOL_TEACHERS,
  PUPILS_ACTIVE_LOGGED_IN,
  REGISTER_LOGGED_IN,
  REGISTER_NEVER,
  REGISTER_STUDENTS,
  REGISTER_TEACHERS,
  REGISTER_TEACHERS_LOGGED_IN,
  STUDENTS_ACTIVE,
  STUDENTS_INACTIVE,
  T4_POOL,
  T4_POOL_REHOMED,
  T4_POOL_SWAPPED_OUT,
  TEACHERS_ACTIVE,
  TEACHERS_ACTIVE_LOGGED_IN,
  TEACHERS_LOGGED_IN,
  USERS_BY_ROLE,
  USERS_INACTIVE,
  USERS_TOTAL,
} from '../datasets/users-spec'
import { usersDataset } from '../datasets/users'
import type {
  SubscriptionPackage,
  UserPool,
  UserRole,
  UserRow,
  UserSecretsRow,
} from '../datasets/users-types'

export const userSecretsTable = defineTable<UserSecretsRow>({
  name: 'users.secrets',
  ids: floor({ start: ID_RANGES.usersRuntimeFloor }),
})

/** Fixture school range 900001–900099 (excluded from the monitoring rollups, M11 BR-M11-34). */
const FIXTURE_SCHOOLS = { min: 900_001, max: 900_099 } as const
/** Every non-fixture school id is below the reserved range (runtime schools start at 10,301). */
const REAL_SCHOOL = { gte: 1, lte: FIXTURE_SCHOOLS.min - 1 } as const
const AT_FIXTURE_SCHOOL = { gte: FIXTURE_SCHOOLS.min, lte: FIXTURE_SCHOOLS.max } as const
const ANCHOR_IDS = new Set(USER_ANCHOR_ROWS.map((a) => a.id))
/** The schools whose pupils carry seeded M18 activity dates. */
const M18_ACTIVITY_SCHOOLS = [7780, 1, 8880, 8765, 8767, 8772, 2700, 3160, 2710]

/**
 * Fictitious fixture ICs of the seeded accounts (in memory only, never persisted), for
 * `adminIcNumber` (see the file header). Seeded with the canonical accounts; fixture seeds add
 * theirs through `seedFixtureSecrets`.
 */
const FIXTURE_ICS = new Map<number, string>(
  CANONICAL_ACCOUNTS.flatMap((a) => (a.icNumber ? [[a.id, a.icNumber] as const] : [])),
)

/** E-mail comparison key: trimmed, lower case (Laravel trims input; MySQL `_ci` collation). */
export function emailKey(email: string): string {
  return email.trim().toLowerCase()
}

/** Live IC mask (M18 BR-M18-27): literal "xxxxxx-xx-xx" + the last 2 digits. */
export function maskIc(icNumber: string): string {
  return `xxxxxx-xx-xx${icNumber.trim().slice(-2)}`
}

export function hashSecret(salt: string, kind: 'password' | 'ic', value: string): string {
  return sha256Hex(`${salt}:${kind}:${value}`)
}

/** Deterministic salt of a seeded account. */
export function seedSalt(userId: number): string {
  return sha256Hex(`pp-seed-salt:${String(userId)}`).slice(0, 32)
}

/** Random salt for secrets created at runtime. */
export function randomSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function normaliseIc(icNumber: string | null): string | null {
  const ic = icNumber?.trim() ?? ''
  return ic === '' ? null : ic
}

/**
 * MOCK ONLY: the salted SHA-256 hash of an IC number has low entropy (about 10^12 candidates), so it
 * is trivially reversible. Do not copy this scheme to the real backend.
 */
function secretsRow(
  userId: number,
  salt: string,
  password: string,
  icNumber: string | null,
): UserSecretsRow {
  const ic = normaliseIc(icNumber)
  return {
    id: userId,
    salt,
    passwordHash: hashSecret(salt, 'password', password),
    icHash: ic === null ? null : hashSecret(salt, 'ic', ic),
    icMasked: ic === null ? null : maskIc(ic),
  }
}

/** Students of the M11 register: grade 10/11 at a non-fixture school (Q-M11-T45). */
const T45 = { role: 'student', grade: [10, 11], schoolId: REAL_SCHOOL } as const

/**
 * Named user figures (D11: every displayed count is a named query). Documented values are checked
 * at boot by the M01 build check (`checkNamedQueries`).
 */
export const userQueries = defineNamedQueries(usersDataset, {
  'U-ALL': { expected: USERS_TOTAL, source: 'M02 §6.15 B (S1 "of 5159 results")' },
  'U-ROLE': {
    where: (role: UserRole) => ({ role }),
    expected: Object.entries(USERS_BY_ROLE).map(([role, value]) => ({ args: [role], value })),
    source: 'M02 §6.15 B (S1 cards; D9 unmapped)',
  },
  'U-ACTIVE': {
    where: { isActive: true },
    expected: USERS_TOTAL - USERS_INACTIVE,
    source: 'M02 §6.15 B',
  },
  'U-INACTIVE': {
    where: { isActive: false },
    expected: USERS_INACTIVE,
    source: 'M02 §6.15 B (?is_active=0)',
  },
  // All accounts (the M17 pins exclude the fixture schools: `outsideFixtureSchools`, v1.20).
  'U-ROLE-ACTIVE': {
    where: (role: UserRole, isActive: boolean) => ({ role, isActive }),
    expected: [
      { args: ['student', true], value: STUDENTS_ACTIVE + FIXTURE_SCHOOL_STUDENTS },
      { args: ['student', false], value: STUDENTS_INACTIVE },
      { args: ['teacher', true], value: TEACHERS_ACTIVE + FIXTURE_SCHOOL_TEACHERS },
      {
        args: ['teacher', false],
        value: USERS_BY_ROLE.teacher - TEACHERS_ACTIVE - FIXTURE_SCHOOL_TEACHERS,
      },
    ],
    source: 'M02 §6.15 B v1.20 (all students 3,162 / 1,371, all teachers 503 / 48)',
  },
  'U-FIXTURE-SCHOOLS': {
    where: (role: UserRole) => ({ role, schoolId: AT_FIXTURE_SCHOOL }),
    expected: [
      { args: ['student'], value: FIXTURE_SCHOOL_STUDENTS },
      { args: ['teacher'], value: FIXTURE_SCHOOL_TEACHERS },
    ],
    source: 'M02 §6.15 B v1.20 (2, 3001–3008, 4; teacher 5)',
  },
  'U-COMP': {
    where: { role: 'student', isComplimentary: true },
    expected: COMPLIMENTARY_TOTAL,
    source: 'M02 §6.15 B (S6 "of 90 results")',
  },
  'U-SCHOOL': { where: (schoolId: number) => ({ schoolId }), source: 'M02 S1 ?school=' },
  // All accounts; the fixture schools add 10 logged-in students and teacher 5 (the M17 figures
  // 1,708 / 269 / 289 exclude them, `outsideFixtureSchools`).
  'U-ACTIVE-LOGGED': {
    where: (role: UserRole) => ({ role, isActive: true, hasLoggedIn: true }),
    expected: [
      { args: ['student'], value: PUPILS_ACTIVE_LOGGED_IN + FIXTURE_SCHOOL_STUDENTS },
      { args: ['teacher'], value: TEACHERS_ACTIVE_LOGGED_IN + FIXTURE_SCHOOL_TEACHERS },
    ],
    source: 'M17 §6.4 + the fixture schools (v1.20)',
  },
  'U-TEACHERS-LOGGED': {
    where: { role: 'teacher', hasLoggedIn: true },
    expected: TEACHERS_LOGGED_IN + FIXTURE_SCHOOL_TEACHERS,
    source: 'M17 XR-06 (289, teacher 5 excluded) + teacher 5',
  },
  'Q-M11-T45': {
    where: (schoolId?: number) => (schoolId === undefined ? T45 : { ...T45, schoolId }),
    expected: REGISTER_STUDENTS,
    source: 'M11 §6.5.1 (4,158)',
  },
  'Q-M11-T45-LOGGED': {
    where: (hasLoggedIn: boolean) => ({ ...T45, hasLoggedIn }),
    expected: [
      { args: [true], value: REGISTER_LOGGED_IN },
      { args: [false], value: REGISTER_NEVER },
    ],
    source: 'M02 §6.15 C (1,666 / 2,492)',
  },
  'Q-M11-TEACHERS': {
    where: (schoolId?: number) =>
      schoolId === undefined
        ? { role: 'teacher', schoolId: REAL_SCHOOL }
        : { role: 'teacher', schoolId },
    expected: REGISTER_TEACHERS,
    source: 'M11 §6.5.1 (522)',
  },
  'Q-M11-TEACHERS-LOGGED': {
    where: { role: 'teacher', schoolId: REAL_SCHOOL, hasLoggedIn: true },
    expected: REGISTER_TEACHERS_LOGGED_IN,
    source: 'M11 §6.7 (277)',
  },
  'U-POOL': {
    where: (pool: UserPool) => ({ pool }),
    expected: [
      { args: ['attendanceMirror'], value: ATTENDANCE_MIRROR.total },
      { args: ['t4Pool'], value: T4_POOL },
      { args: ['t4PoolSwappedOut'], value: T4_POOL_SWAPPED_OUT },
      { args: ['t4PoolRehomed'], value: T4_POOL_REHOMED },
    ],
    source: 'M02 §6.15 C',
  },
})

/** Role cards of S1 (`meta.roleCounts`, M02 §7 #1). */
export interface RoleCounts {
  student: number
  teacher: number
  parent: number
  sponsor: number
  schoolAdmin: number
  ppdOfficer: number
  admin: number
}

/** S1 / #1 filters. */
/**
 * Secondary-only (D72): a row filter for the admin reads. `key` identifies the predicate for the
 * dataset's slow-path cache (it must change whenever the predicate's behaviour changes).
 */
export interface UserVisibility {
  key: string
  visible: (row: { role: UserRole; schoolId: number | null; grade: number | null }) => boolean
}
const VISIBILITY_FIELDS = ['role', 'schoolId', 'grade'] as const

export interface AdminUserFilter {
  /** Hide rows the predicate refuses (primary-school people, Darjah pupils); the rows stay stored. */
  visibility?: UserVisibility
  role?: UserRole | ''
  schoolId?: number
  isActive?: boolean
  /** Name or e-mail substring (case-insensitive). */
  search?: string
  page?: number
  /** Default 25 (§7 #1). */
  pageSize?: number
}

/** Fields of a runtime-created user (M01 register, M02 S2 / S4 / S5 / S7). */
export interface UserInput {
  name: string
  email: string
  role: UserRole
  phone?: string | null
  grade?: number | null
  schoolId?: number | null
  isActive?: boolean
  bio?: string | null
  avatarUrl?: string | null
  ppdState?: string | null
  ppdDistrict?: string | null
  subscriptionPackage?: SubscriptionPackage
  subscriptionExpiresAt?: string | null
  hasPkskSubscription?: boolean
  idDelima?: string | null
  isComplimentary?: boolean
  createdById?: number | null
}

export type UserPatch = Partial<Omit<UserInput, 'email'>> & { email?: string }

/** M05 BR-07 trial status. */
export interface TrialStatus {
  active: boolean
  used: number
  limit: number
  remaining: number
}

/** M05 BR-07: free-trial question limit. */
export const TRIAL_LIMIT = 50

/** Fixture secrets of a seeded user (password and optional fictitious IC). */
export interface FixtureSecret {
  id: number
  password: string
  icNumber?: string | null
}

export const usersRepo = defineRepository({
  owner: 'M01',
  name: 'users',
  store: usersDataset,
  stores: { secrets: userSecretsTable },
  queries: userQueries,
  validateAnchor: (row) => {
    const r = row as Partial<UserRow>
    if (typeof r.role !== 'string') return 'role is required'
    if (typeof r.email !== 'string' || r.email === '') return 'email is required'
    if ((r.lastLoginAt !== null) !== r.hasLoggedIn) return 'hasLoggedIn must match lastLoginAt'
    return undefined
  },
  methods: ({ store, stores, transaction }) => {
    /** Compiled selections, cleared by the M01 seed on every boot / reset. */
    const selections = new Map<string, readonly number[]>()

    return {
      /**
       * Seed phase (core seed, overview §6.9 phase 1): the hashed secrets of the canonical accounts
       * 1–11. Their user rows are literal anchors of the dataset.
       */
      seedCanonical(): void {
        transaction(() => {
          for (const { id, password, icNumber } of CANONICAL_ACCOUNTS) {
            stores.secrets.insert(secretsRow(id, seedSalt(id), password, icNumber))
          }
        })
      },

      /**
       * Seed phase: hashed secrets of fixture users (e.g. the M02 fixtures 5001–5990) and their
       * fictitious ICs for `adminIcNumber` (in memory only).
       */
      seedFixtureSecrets(entries: readonly FixtureSecret[]): void {
        transaction(() => {
          for (const { id, password, icNumber } of entries) {
            const ic = normaliseIc(icNumber ?? null)
            if (ic !== null) FIXTURE_ICS.set(id, ic)
            stores.secrets.insert(secretsRow(id, seedSalt(id), password, ic))
          }
        })
      },

      get(id: number): UserRow | undefined {
        return store.get(id)
      },

      getMany(ids: readonly number[]): UserRow[] {
        return store.getMany([...ids])
      },

      /** Case-insensitive, trimmed e-mail lookup (one account per e-mail). Cheap-field search. */
      findByEmail(email: string): UserRow | undefined {
        const key = emailKey(email)
        if (key === '') return undefined
        const { rows } = store.query({ search: { term: key, fields: ['email'] } })
        return rows.find((u) => emailKey(u.email) === key)
      },

      /** Users whose name or e-mail contains `q` (case-insensitive), newest first. */
      search(q: string, options: { role?: UserRole; limit?: number } = {}): UserRow[] {
        const term = q.trim()
        return store.query({
          ...(options.role ? { where: { role: options.role } } : {}),
          ...(term === '' ? {} : { search: { term, fields: ['name', 'email'] } }),
          sort: [
            { field: 'createdAt', dir: 'desc' },
            { field: 'id', dir: 'desc' },
          ],
          page: 1,
          pageSize: options.limit ?? 15,
        }).rows
      },

      /** S1 list (§7 #1): filters, name / e-mail search, newest first, 25 per page. */
      adminList(filter: AdminUserFilter = {}): { rows: UserRow[]; total: number } {
        const where: Where<UserRow> = {}
        if (filter.role) where.role = filter.role
        if (filter.schoolId !== undefined) where.schoolId = filter.schoolId
        if (filter.isActive !== undefined) where.isActive = filter.isActive
        const term = filter.search?.trim() ?? ''
        const vis = filter.visibility
        return store.query({
          where,
          ...(term === '' ? {} : { search: { term, fields: ['name', 'email'] } }),
          ...(vis
            ? {
                match: (r: Pick<UserRow, 'role' | 'schoolId' | 'grade'>) => vis.visible(r),
                matchFields: VISIBILITY_FIELDS,
                cacheKey: `m01-users-visibility:${vis.key}`,
              }
            : {}),
          sort: [
            { field: 'createdAt', dir: 'desc' },
            { field: 'id', dir: 'desc' },
          ],
          page: filter.page ?? 1,
          pageSize: filter.pageSize ?? 25,
        })
      },

      /** S1 role cards (named query U-ROLE per role; `unmapped` has no card). */
      roleCounts(vis?: UserVisibility): RoleCounts {
        const n = (role: UserRole) =>
          vis
            ? store.count({ role }, (r) => vis.visible(r), {
                matchFields: VISIBILITY_FIELDS,
                cacheKey: `m01-users-visibility-count:${vis.key}`,
              })
            : store.count({ role })
        return {
          student: n('student'),
          teacher: n('teacher'),
          parent: n('parent'),
          sponsor: n('sponsor'),
          schoolAdmin: n('school_admin'),
          ppdOfficer: n('ppd_officer'),
          admin: n('admin'),
        }
      },

      /** Ad-hoc filter count (overview §6.7: `count` is reserved for named queries). */
      countWhere(where: Where<UserRow> = {}): number {
        return store.count(where)
      },

      /**
       * Ids of the schools with ≥ 1 user (S1 "Sekolah" filter: 61 = 57 real + 4 fixtures,
       * DV-M02-13); `excludeFixtures` drops 900001–900099 (M11 BR-M11-34, M17 "57").
       */
      schoolsWithUsers(options: { excludeFixtures?: boolean } = {}): number[] {
        const ids = [...store.groupCount('schoolId').keys()].filter(
          (id): id is number => typeof id === 'number',
        )
        return ids
          .filter(
            (id) =>
              !options.excludeFixtures || id < FIXTURE_SCHOOLS.min || id > FIXTURE_SCHOOLS.max,
          )
          .sort((a, b) => a - b)
      },

      /**
       * A named selection of M02 §6.15 C (`attendanceMirror`, `t4Pool`, `t4PoolSwappedOut`,
       * `t4PoolRehomed`): the explicit id list compiled with the dataset (baseline rows), not a
       * predicate, so later edits never move a user in or out.
       */
      selection(name: UserPool): readonly number[] {
        if (!selections.has(name)) {
          const ids = store.query({ where: { pool: name }, sort: 'id' }).rows.map((u) => u.id)
          selections.set(name, Object.freeze(ids))
        }
        return selections.get(name) as readonly number[]
      },

      /**
       * Count of `where` over M17's populations: accounts **outside** the fixture schools
       * 900001–900099 (v1.20, A-01), e.g. `outsideFixtureSchools({role: 'student', isActive: true})`
       * = Q-M17-PUPILS 3,152.
       */
      outsideFixtureSchools(where: Where<UserRow> = {}): number {
        if (where.schoolId !== undefined) {
          throw new Error('users.outsideFixtureSchools: where.schoolId is not allowed')
        }
        return store.count(where) - store.count({ ...where, schoolId: AT_FIXTURE_SCHOOL })
      },

      /**
       * Finalise phase: assigns the seeded M18 activity dates (`lastActiveAt`, v1.23) to the
       * generated pupils of the M18 schools (`users-activity.ts`). Reads facets only (no row is
       * derived, so no cached row holds a stale value). Returns the problems found.
       */
      compileActivity(): string[] {
        const rows: ActivityRow[] = []
        store.count(
          { role: 'student', schoolId: M18_ACTIVITY_SCHOOLS },
          (r) => {
            if (!ANCHOR_IDS.has(r.id)) {
              rows.push({
                id: r.id,
                schoolId: r.schoolId,
                grade: r.grade,
                hasLoggedIn: r.hasLoggedIn,
              })
            }
            return false
          },
          { matchFields: ['id', 'schoolId', 'grade', 'hasLoggedIn'] },
        )
        const { values, issues } = assignActivity(rows)
        setCompiledActivity(values)
        return issues
      },

      /**
       * M02 BR-12 / M19 BR-M19-14 (XR-M19-04): writes the individual package and its expiry (the
       * caller computes the expiry, e.g. with `computeExpiry`).
       */
      setSubscription(
        userId: number,
        value: { package: SubscriptionPackage; expiresAt: string | null },
      ): UserRow {
        if (!store.get(userId)) throw new Error(`users.setSubscription: no user ${String(userId)}`)
        return transaction(() =>
          store.update(userId, {
            subscriptionPackage: value.package,
            subscriptionExpiresAt: value.expiresAt,
          }),
        )
      },

      /** Clears the compiled selections (called by the M01 seed on every boot / reset). */
      resetSelections(): void {
        selections.clear()
      },

      /** M05 BR-07: subscribed = `subscriptionExpiresAt` set and after `at` (epoch ms). */
      isSubscribed(userId: number, at: number): boolean {
        const exp = store.get(userId)?.subscriptionExpiresAt ?? null
        return exp !== null && Date.parse(exp) > at
      },

      /** M05 BR-07 trial status (provisional M19 rule, overview §6.7). */
      trial(userId: number, at: number): TrialStatus {
        const u = store.get(userId)
        const used = u?.trialQuestionsUsed ?? 0
        const subscribed =
          u?.subscriptionExpiresAt != null && Date.parse(u.subscriptionExpiresAt) > at
        return {
          active: !subscribed,
          used,
          limit: TRIAL_LIMIT,
          remaining: Math.max(0, TRIAL_LIMIT - used),
        }
      },

      /** M05 BR-07: +1 per answer checked while not subscribed. */
      incrementTrialUsed(userId: number): number {
        const u = store.get(userId)
        if (!u) throw new Error(`users.incrementTrialUsed: no user ${String(userId)}`)
        const used = u.trialQuestionsUsed + 1
        transaction(() => store.update(userId, { trialQuestionsUsed: used }))
        return used
      },

      /** A runtime user (id ≥ 9,000,001, M02 X-9). Validation stays in the handler. */
      create(input: UserInput, now: number): UserRow {
        const at = toIsoMyt(now)
        const grade = input.grade ?? null
        return transaction(() =>
          store.insert({
            name: input.name,
            email: input.email.trim(),
            phone: input.phone ?? null,
            role: input.role,
            grade,
            schoolId: input.schoolId ?? null,
            bio: input.bio ?? null,
            avatarUrl: input.avatarUrl ?? null,
            isActive: input.isActive ?? true,
            createdAt: at,
            updatedAt: at,
            lastLoginAt: null,
            lastActiveAt: null,
            ppdState: input.ppdState ?? null,
            ppdDistrict: input.ppdDistrict ?? null,
            subscriptionPackage: input.subscriptionPackage ?? 'none',
            subscriptionExpiresAt: input.subscriptionExpiresAt ?? null,
            hasPkskSubscription: input.hasPkskSubscription ?? false,
            idDelima: input.idDelima ?? null,
            classLevel: classLevelOf(grade),
            isComplimentary: input.isComplimentary ?? false,
            createdById: input.createdById ?? null,
            trialQuestionsUsed: 0,
            hasLoggedIn: false,
            pool: null,
          }),
        )
      },

      /** Profile / admin edit. `updatedAt` = now; `classLevel` follows `grade`. */
      update(id: number, patch: UserPatch, now: number): UserRow {
        if (!store.get(id)) throw new Error(`users.update: no user ${String(id)}`)
        const next: Partial<UserRow> = { ...patch, updatedAt: toIsoMyt(now) }
        if (patch.email !== undefined) next.email = patch.email.trim()
        if (patch.grade !== undefined) next.classLevel = classLevelOf(patch.grade)
        return transaction(() => store.update(id, next))
      },

      /** Permanent delete (M02 #6 / #7) with the user's secrets. */
      remove(id: number): void {
        if (!store.get(id)) throw new Error(`users.remove: no user ${String(id)}`)
        transaction(() => {
          store.remove(id)
          if (stores.secrets.get(id)) stores.secrets.remove(id)
        })
      },

      /** `true` when `password` is the user's password (M01 BR-01). Compares hashes. */
      verifyPassword(userId: number, password: string): boolean {
        const s = stores.secrets.get(userId)
        return s !== undefined && hashSecret(s.salt, 'password', password) === s.passwordHash
      },

      /**
       * M01 BR-12 (IC reset): `true` only when the user has a stored IC equal to the input, compared
       * as entered after trimming. A user without an IC never matches.
       */
      verifyIc(userId: number, icNumber: string): boolean {
        const s = stores.secrets.get(userId)
        const ic = normaliseIc(icNumber)
        if (!s || s.icHash === null || ic === null) return false
        return hashSecret(s.salt, 'ic', ic) === s.icHash
      },

      /** The masked IC ("xxxxxx-xx-xx" + last 2 digits), or null. */
      icMasked(userId: number): string | null {
        return stores.secrets.get(userId)?.icMasked ?? null
      },

      /**
       * The IC for the M02 admin user detail only (SEC-M02-07). The fictitious fixture IC of a seeded
       * account while it is unchanged; otherwise the mask (privacy deviation, see the file header).
       */
      adminIcNumber(userId: number): string | null {
        const s = stores.secrets.get(userId)
        if (!s || s.icHash === null) return null
        const fixture = FIXTURE_ICS.get(userId)
        if (fixture !== undefined && hashSecret(s.salt, 'ic', fixture) === s.icHash) return fixture
        return s.icMasked
      },

      /**
       * Sets a user's password (M01 change password, token reset, register). Persists the hash only;
       * rolls back with the transaction. A user without a secrets row gets one with a random salt.
       */
      setPassword(userId: number, password: string): void {
        if (!store.get(userId)) throw new Error(`users.setPassword: no user ${String(userId)}`)
        transaction(() => {
          const s = stores.secrets.get(userId)
          if (!s) {
            stores.secrets.insert(secretsRow(userId, randomSalt(), password, null))
            return
          }
          stores.secrets.update(userId, { passwordHash: hashSecret(s.salt, 'password', password) })
        })
      },

      /**
       * Sets or clears a user's IC (M01 register, M02 admin edit). Persists the hash and mask only.
       * A user without a secrets row (every generated user) gets one whose password hash is an
       * unusable random value, so the user still cannot log in with a password (as `setPassword`).
       */
      setIcNumber(userId: number, icNumber: string | null): void {
        if (!store.get(userId)) throw new Error(`users.setIcNumber: no user ${String(userId)}`)
        const ic = normaliseIc(icNumber)
        transaction(() => {
          const s = stores.secrets.get(userId)
          if (!s) {
            const salt = randomSalt()
            stores.secrets.insert({
              id: userId,
              salt,
              // Random preimage nobody knows: no password verifies against it.
              passwordHash: hashSecret(salt, 'password', randomSalt() + randomSalt()),
              icHash: ic === null ? null : hashSecret(salt, 'ic', ic),
              icMasked: ic === null ? null : maskIc(ic),
            })
            return
          }
          stores.secrets.update(userId, {
            icHash: ic === null ? null : hashSecret(s.salt, 'ic', ic),
            icMasked: ic === null ? null : maskIc(ic),
          })
        })
      },

      /**
       * BR-25: a successful login (and registration or a reset that logs in) sets `lastLoginAt` to
       * the mock clock's now. Callers invoke it only on success; failed, throttled and inactive
       * attempts never call it. `updatedAt` is not changed (a login is not a profile update).
       */
      recordLogin(userId: number, now: number): UserRow {
        return transaction(() =>
          // A login is activity: `lastActiveAt` follows it (v1.23: default = lastLoginAt).
          store.update(userId, {
            lastLoginAt: toIsoMyt(now),
            lastActiveAt: toIsoMyt(now),
            hasLoggedIn: true,
          }),
        )
      },
    }
  },
})

export type UsersRepository = typeof usersRepo
