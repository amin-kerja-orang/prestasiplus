/** Fixed rules of the session (mock BR-06, BR-02; card BE-03 acceptance criteria 3 and 4). */
export const SESSION_IDLE_MS = 120 * 60_000
/** A sliding session is moved forward at most once per this interval. */
export const SESSION_SLIDE_INTERVAL_MS = 60_000

/** Login throttle window (mock `LOGIN_DECAY_MS`); the limit is `THROTTLE_LOGIN_PER_MINUTE`. */
export const LOGIN_WINDOW_MS = 60_000
export const DEFAULT_LOGIN_LIMIT = 5

export const DEFAULT_COOKIE_NAME = 'pp_session'
export const CSRF_HEADER = 'x-csrf-token'
export const SAFE_METHODS: readonly string[] = ['GET', 'HEAD', 'OPTIONS']

/** Most candidate accounts verified for one username login (bounds the hashing work per request). */
export const MAX_LOGIN_CANDIDATES = 10

/** Global login ceilings (security review M1); failed attempts only, a success never resets them. */
export const IP_FAIL_LIMIT = 20
export const IP_FAIL_WINDOW_MS = 60_000
export const IDENTIFIER_FAIL_LIMIT = 20
export const IDENTIFIER_FAIL_WINDOW_MS = 15 * 60_000

/** Display order of role grants; the first grant is the active role right after login. */
export const ROLE_PRIORITY = [
  'admin',
  'school_admin',
  'ppd_officer',
  'teacher',
  'student',
  'parent',
  'sponsor',
] as const

/** "Ingat saya" defaults in days (LEAD decision 2026-10-19, security review M2); never slides. */
export const DEFAULT_REMEMBER_DAYS = 30
/** Cap for accounts holding admin or school_admin. */
export const DEFAULT_REMEMBER_DAYS_STAFF = 1
/** Cost of the dummy bcrypt hash used when no account or hash is found (Laravel default). */
export const DEFAULT_LEGACY_DUMMY_COST = 12
