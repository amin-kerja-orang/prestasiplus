import { Injectable, Logger, Module } from '@nestjs/common'
import type { RoleCode } from '@pp/contract'

import { LOGIN_HOOK_TIMEOUT_MS } from './auth.constants'

/**
 * What the login tells other modules after a PASSWORD login succeeded (M01 FR-M01-69, BR-26; M14 XR-M14-02(a)).
 * `at` is the login time (the clock value written to `last_login_at`). `role` is the role the session opened as.
 */
export interface PasswordLoginEvent {
  /** Decimal-string user id. */
  userId: string
  role: RoleCode
  at: Date
}

export interface LoginHook {
  onPasswordLogin(event: PasswordLoginEvent): Promise<void>
}

/**
 * The login hook as one injectable holder, so M14 can plug in without auth importing it (the `CurriculumPorts`
 * pattern): the gamification module calls `ports.provideLoginHook(...)` from its own `onModuleInit`. Until then
 * the login does nothing extra. Registering twice is a wiring error and throws.
 *
 * The hook is best effort: every caller (`AuthService` form login, and the registration and password reset
 * auto-login of the account module) calls `fireLoginHook` AFTER its transaction committed, so the wait is bounded
 * and the errors are swallowed: a failing or slow hook never fails or delays the login, the registration or the reset.
 */
@Injectable()
export class AuthPorts {
  private readonly logger = new Logger(AuthPorts.name)
  private hook: LoginHook | null = null

  get loginHook(): LoginHook | null {
    return this.hook
  }

  provideLoginHook(hook: LoginHook): void {
    if (this.hook) throw new Error('AuthPorts: the login hook is already set')
    this.hook = hook
  }

  /**
   * FR-M01-69 / BR-26: tells the plugged-in hook once (M14 `onLogin`). Call it only after the transaction that issued the
   * session committed (never inside it) and only when a session was actually issued. Never throws and never waits longer
   * than `LOGIN_HOOK_TIMEOUT_MS`: the caller already succeeded and must not fail or stall because of it.
   * The refreshed session endpoints (`/session/role`, `/session/mode`) are not logins and never call it.
   */
  async fireLoginHook(event: PasswordLoginEvent, requestId: string | null): Promise<void> {
    const hook = this.hook
    if (!hook) return
    let timer: NodeJS.Timeout | undefined
    try {
      const run = hook.onPasswordLogin(event)
      run.catch(() => undefined) // a late rejection after the timeout is already accounted for below
      await Promise.race([
        run,
        new Promise<void>((resolve) => {
          timer = setTimeout(() => {
            this.logger.warn(`login hook timed out (requestId=${requestId ?? '-'})`)
            resolve()
          }, LOGIN_HOOK_TIMEOUT_MS)
        }),
      ])
    } catch {
      this.logger.warn(`login hook failed (requestId=${requestId ?? '-'})`)
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  /** Test seam: replaces (or, with `null`, removes) the plugged login hook, like the `setUser` fast login that calls none. Never called by application code. */
  overrideLoginHook(hook: LoginHook | null): void {
    this.hook = hook
  }
}

/**
 * Holds `AuthPorts` only. It is a module of its own so a module that plugs in (M14) does not import `AuthModule`,
 * which would install the global guards in every app that loads that module.
 */
@Module({ providers: [AuthPorts], exports: [AuthPorts] })
export class AuthPortsModule {}
