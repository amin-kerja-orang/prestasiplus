/**
 * The users store row (M01 DATA-M01-01 base fields + M02 DATA-M02-01 admin extensions; SRS M02
 * v1.26 §6.1, §6.15 B). Integer ids (XL-05/06). The password and the IC number are **not** row
 * fields: they live, hashed, in `users.secrets` (overview §7, M01 NFR-M01-03).
 */

import type { MockRole } from '@/mock/define'

/**
 * The 8 live role codes, plus `unmapped` for the 6 live users whose role is outside them (M02
 * §6.15 B D9 value: counted in the total, matched by no role filter).
 */
export type UserRole = MockRole | 'unmapped'

/** M02 DATA-M02-01 `subscriptionPackage`. */
export type SubscriptionPackage = 'none' | 'regular_monthly' | 'personal'

/**
 * Named selections of the users dataset (M02 §6.15 C): explicit id lists compiled with the
 * dataset, not predicates (`users.selection(name)`).
 * - `attendanceMirror` — 137 generated students without a school (grade 10 14, grade 11 123);
 * - `t4Pool` — 78 grade-10 students without a school holding T4-class memberships;
 * - `t4PoolSwappedOut` — 20 grade-10 students without a school, no class (swapped out by M10);
 * - `t4PoolRehomed` — the k = 36 pool pupils re-homed to M18's schools (keep their memberships).
 */
export type UserPool = 'attendanceMirror' | 't4Pool' | 't4PoolSwappedOut' | 't4PoolRehomed'

export interface UserRow {
  id: number
  name: string
  email: string
  phone: string | null
  role: UserRole
  /** 1–6 Darjah, 7–11 Tingkatan; null for non-students (and for students without one). */
  grade: number | null
  schoolId: number | null
  bio: string | null
  avatarUrl: string | null
  /** Inactive → login refused (M01 BR-23, M02 BR-05). */
  isActive: boolean
  /** ISO 8601 (+08:00). */
  createdAt: string
  updatedAt: string
  /** M01 base field (BR-25); null = never logged in. */
  lastLoginAt: string | null
  /**
   * Stored activity date (M02 v1.23 DATA-M02-01, M18 XR-M18-21): seeded for the M18-visible pupils;
   * every other user defaults to `lastLoginAt`. Null = "Tiada aktiviti".
   */
  lastActiveAt: string | null

  // --- M02 admin extensions (DATA-M02-01) ------------------------------------------------------
  /** JPN name (officers, school admins). */
  ppdState: string | null
  /** PPD code (PPD officers) or school district (school admins). */
  ppdDistrict: string | null
  subscriptionPackage: SubscriptionPackage
  subscriptionExpiresAt: string | null
  hasPkskSubscription: boolean
  /** DELIMa e-mail of imported students. */
  idDelima: string | null
  /** Derived from `grade`: 1–6 → D1–D6, 7–11 → T1–T5. */
  classLevel: string | null
  isComplimentary: boolean
  createdById: number | null

  // --- provisional M19 field (overview §6.7 "Trial counter"; M05 BR-07) ---------------------------
  trialQuestionsUsed: number

  // --- facets that keep the M02 §6.15 C allocation exact (not part of any API shape) -----------------
  /** `lastLoginAt !== null` (M11 "Belum login" vs logged in). */
  hasLoggedIn: boolean
  /** Named selection the row belongs to (§6.15 C), or null. */
  pool: UserPool | null
}

/** A user who can hold a session (one of the 8 live roles). */
export type SessionUserRow = UserRow & { role: MockRole }

export function isSessionUser(user: UserRow): user is SessionUserRow {
  return user.role !== 'unmapped'
}

export type UserFacetKey =
  'role' | 'isActive' | 'isComplimentary' | 'schoolId' | 'grade' | 'hasLoggedIn' | 'pool'

export type UserCheapKey =
  'name' | 'email' | 'createdAt' | 'lastLoginAt' | 'lastActiveAt' | 'classLevel'

export type UserFacets = Pick<UserRow, UserFacetKey>

/** `users.secrets` row: salted hashes only, never plaintext (moved unchanged from F-11). */
export interface UserSecretsRow {
  /** = user id. */
  id: number
  passwordHash: string
  icHash: string | null
  /** "xxxxxx-xx-xx" + last 2 digits, or null without an IC. */
  icMasked: string | null
  /** 32 hex characters. */
  salt: string
}
