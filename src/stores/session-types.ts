/**
 * Client-side types of the session (M01 DATA-M01-01 `UserMe`, DATA-M01-02 `ClientSession`).
 *
 * UI code may not import `@/mock` (overview §3 rule 1), so the `pp.auth` key and shape written by
 * the mock core (`src/mock/core-data/client-session.ts`, F-11) are re-declared here. Both sides
 * follow the same SRS tables; a unit test in `src/stores/__tests__` keeps them structurally equal.
 *
 * **M01-T1 hand-over:** `UserMe`, `SchoolSummary` and `Role` belong in
 * `src/modules/m01-authentication/api/types.ts`, which M01-T1 creates. Until then they live here
 * (F-12 owns `src/stores/**`). Once M01-T1 exports them, a small F-12 follow-up makes this file
 * re-export the M01 types instead of declaring them.
 */

/** The `localStorage` key of the client session (M01 DATA-M01-02). */
export const PP_AUTH_STORAGE_KEY = 'pp.auth'

/** The 8 role codes of M01 DATA-M01-01 (`users.role`). */
export type Role =
  | 'student'
  | 'teacher'
  | 'parent'
  | 'sponsor'
  | 'school_admin'
  | 'ppd_officer'
  | 'jpn_officer'
  | 'admin'

/** M01 DATA-M01-06 (= M02 DATA-M02-03 projection). */
export interface SchoolSummary {
  id: number
  name: string
  code: string
  type: string
  state: string
  district: string | null
  city: string | null
}

/** M01 DATA-M01-01 API shape (`GET /api/me`, login/register/reset responses). */
export interface UserMe {
  id: number
  name: string
  email: string
  phone: string | null
  role: Role
  grade: number | null
  schoolId: number | null
  bio: string | null
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
  school: SchoolSummary | null
  /** Role landing path (BR-07), computed by the server; the client never computes it. */
  landingPath: string
}

/** M01 DATA-M01-02, as stored in `localStorage['pp.auth']`. */
export interface ClientSession {
  token: string
  /** "Ingat saya". */
  remember: boolean
  /** ISO 8601 (+08:00). Remember: +5 years; otherwise +120 min, sliding on each request (BR-06). */
  expiresAt: string
  user: UserMe
  /** Only on an impersonated session (XR-M27-21): the actor and the path "Kembali ke Admin" uses. */
  impersonator?: { id: number; name: string; returnTo: string }
  /** Only in Mod Pelajar (v2-portals US-07): the admin session parked while the student view is open. */
  mode?: ModPelajarMode
}

/** The session parked by "Masuk Mod Pelajar"; "Keluar Mod Pelajar" restores it (contract `Session.mode`). */
export interface ModPelajarMode {
  kind: 'mod_pelajar'
  returnRole: Role
  /** ISO 8601 (+08:00). */
  since: string
  /** Where "Keluar Mod Pelajar" lands. */
  returnTo: string
  parent: { token: string; remember: boolean; expiresAt: string; user: UserMe }
}
