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
