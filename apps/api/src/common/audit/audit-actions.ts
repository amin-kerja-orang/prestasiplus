/** Action names written to `audit_events.action` by the auth and session endpoints (BE-03). */
export const AUDIT_ACTIONS = {
  LOGIN_FAILED: 'auth.login.failed',
  LOGIN_SUCCEEDED: 'auth.login.succeeded',
  LOGOUT: 'auth.logout',
  ROLE_SWITCHED: 'session.role.switched',
  MODE_ENTERED: 'session.mode.entered',
  MODE_EXITED: 'session.mode.exited',
} as const
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]

export const AUDIT_LOGIN_FAILED = AUDIT_ACTIONS.LOGIN_FAILED
export const AUDIT_LOGIN_SUCCEEDED = AUDIT_ACTIONS.LOGIN_SUCCEEDED
export const AUDIT_LOGOUT = AUDIT_ACTIONS.LOGOUT
export const AUDIT_ROLE_SWITCHED = AUDIT_ACTIONS.ROLE_SWITCHED
export const AUDIT_MODE_ENTERED = AUDIT_ACTIONS.MODE_ENTERED
export const AUDIT_MODE_EXITED = AUDIT_ACTIONS.MODE_EXITED
