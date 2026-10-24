import { Injectable, Module } from '@nestjs/common'
import type { RoleCode } from '@pp/contract'

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
 * The hook is best effort: `AuthService` calls it AFTER the login committed, bounds its wait and swallows its
 * errors, so a failing or slow hook never fails or delays a login.
 */
@Injectable()
export class AuthPorts {
  private hook: LoginHook | null = null

  get loginHook(): LoginHook | null {
    return this.hook
  }

  provideLoginHook(hook: LoginHook): void {
    if (this.hook) throw new Error('AuthPorts: the login hook is already set')
    this.hook = hook
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
