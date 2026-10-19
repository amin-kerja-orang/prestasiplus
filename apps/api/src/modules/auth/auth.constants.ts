/** Fixed rules of the session (mock BR-06, BR-02; card BE-03 acceptance criteria 3 and 4). */
export const SESSION_IDLE_MS = 120 * 60_000
/** A sliding session is moved forward at most once per this interval. */
export const SESSION_SLIDE_INTERVAL_MS = 60_000
/** "Ingat saya": calendar years after creation (mock DATA-M01-02); never slides. */
export const REMEMBER_YEARS = 5

/** Login throttle window (mock `LOGIN_DECAY_MS`); the limit is `THROTTLE_LOGIN_PER_MINUTE`. */
export const LOGIN_WINDOW_MS = 60_000
export const DEFAULT_LOGIN_LIMIT = 5

export const DEFAULT_COOKIE_NAME = 'pp_session'
export const CSRF_HEADER = 'x-csrf-token'
export const SAFE_METHODS: readonly string[] = ['GET', 'HEAD', 'OPTIONS']

/** Most candidate accounts verified for one username login (bounds the hashing work per request). */
export const MAX_LOGIN_CANDIDATES = 20

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
