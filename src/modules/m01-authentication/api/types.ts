/**
 * M01 API types (SRS M01 v1.12 §6, §7). The contract shared by the mock handlers and the UI tasks
 * (build-plan §S.3 rule 5: the module's mock task owns `api/`; UI tasks read it).
 *
 * `UserMe`, `SchoolSummary`, `Role` and `ClientSession` are also declared in
 * `src/stores/session-types.ts` (F-12), because UI code cannot import from `mock/`. A unit test in
 * `__tests__/mock` keeps the two structurally equal. A small F-12 follow-up can make the store file
 * re-export these.
 */

/** The 8 role codes (DATA-M01-01). */
export type Role =
  | 'student'
  | 'teacher'
  | 'parent'
  | 'sponsor'
  | 'school_admin'
  | 'ppd_officer'
  | 'jpn_officer'
  | 'admin'

/** DATA-M01-06 (M02 DATA-M02-03 projection). */
export interface SchoolSummary {
  id: number
  name: string
  code: string
  type: string
  state: string
  district: string | null
  city: string | null
}

/** DATA-M01-01 `UserMe`: every user field except password, IC, remember token and `isActive`. */
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
  /** BR-07, computed by the server. */
  landingPath: string
}

/** DATA-M01-02, as stored in `localStorage['pp.auth']`. */
export interface ClientSession {
  token: string
  remember: boolean
  expiresAt: string
  user: UserMe
}

/** The server part of a session response (#1, #2, #4): `remember` is added by the client call. */
export interface SessionPayload {
  token: string
  expiresAt: string
  user: UserMe
}

/** DATA-M01-03. */
export type Faith = 'muslim' | 'hindu' | 'buddhist' | 'christian' | 'none'

export interface UserSettings {
  spiritualMode: boolean
  showBismillahSplash: boolean
  subuhPushEnabled: boolean
  /** `HH:mm`. */
  subuhPushTime: string
  ramadanModeEnabled: boolean
  /** `HH:mm`. */
  sahurPushTime: string
  faith: Faith | null
}

/** DATA-M01-07. */
export interface PlatformStats {
  questionCount: number
  subjectCount: number
  levelCount: number
}

// --- Requests ---------------------------------------------------------------------------------

/** #1. */
export interface LoginRequest {
  email: string
  password: string
  remember: boolean
}

/** #2. `role` is `student` (default), `teacher` or `parent`. */
export interface RegisterRequest {
  name: string
  email: string
  phone?: string | null
  role: 'student' | 'teacher' | 'parent'
  /** Student only (1–11). */
  grade?: number | null
  /** Student only. */
  icNumber?: string | null
  schoolId?: number | null
  password: string
  passwordConfirmation: string
  /** FR-M01-70 (provisional, M14 referral). */
  referralCode?: string | null
}

/** #4. */
export interface ResetPasswordRequest {
  token: string
  email: string
  password: string
  passwordConfirmation: string
}

/** #8. */
export interface UpdateProfileRequest {
  name: string
  phone?: string | null
  bio?: string | null
  grade?: number | null
  schoolId?: number | null
}

/** #10. */
export interface ChangePasswordRequest {
  currentPassword: string
  password: string
  passwordConfirmation: string
}

// --- Responses --------------------------------------------------------------------------------

/** #3 and #10: `{data: {status}}`. */
export interface StatusPayload {
  status: string
}

/** #4: a session plus the flash text for the landing page. */
export interface ResetPasswordPayload extends SessionPayload {
  status: string
}

/** #5. */
export interface ResetByIcPayload {
  token: string
  email: string
}

/** #9. */
export interface PicturePayload {
  avatarUrl: string
}

/** #8 and #12 also carry `status` next to `data` (envelope extra). */
export interface WithStatus<T> {
  data: T
  status: string
}
