import { Injectable, Module } from '@nestjs/common'
import type { RoleCode } from '@pp/contract'

import type { TxClient } from '../../db/client'

/**
 * What the self-registration tells other modules once the user row, its role and the session are written (M01
 * FR-M01-70, M14 XR-M14-02(b) / BR-M14-19).
 */
export interface RegisteredEvent {
  /** Decimal-string id of the new user. */
  userId: string
  role: RoleCode
  /** True for a teacher: the account is created inactive until it is verified (no session). */
  pending: boolean
  /** The `referralCode` of the request, trimmed; `null` when none was sent. Unvalidated: the hook decides what it is worth. */
  referralCode: string | null
  /** The registration time (the clock value written to `created_at`). */
  at: Date
  /** The registration transaction: the hook writes through it, so a rollback of the registration undoes the hook too. */
  tx: TxClient
}

export interface RegistrationHook {
  onRegistered(event: RegisteredEvent): Promise<void>
}

/**
 * The registration hook as one injectable holder, so M14 can plug in without account importing it (the `AuthPorts`
 * and `CurriculumPorts` pattern): the gamification module calls `ports.provideRegistrationHook(...)` from its own
 * `onModuleInit`. Until then registration does nothing extra. Registering twice is a wiring error and throws.
 *
 * Unlike the login hook the registration hook runs INSIDE the registration transaction (the referral rows and the two
 * wallet credits commit or roll back with the new user). The hook MUST NOT throw: it treats an unknown, own, empty or
 * already-used code as a no-op, and the plugged-in M14 hook guards itself with a SAVEPOINT, so a failure skips the
 * referral and never the registration. `RegistrationService` does not catch for it.
 */
@Injectable()
export class AccountPorts {
  private hook: RegistrationHook | null = null

  get registrationHook(): RegistrationHook | null {
    return this.hook
  }

  provideRegistrationHook(hook: RegistrationHook): void {
    if (this.hook) throw new Error('AccountPorts: the registration hook is already set')
    this.hook = hook
  }

  /** Test seam: replaces (or, with `null`, removes) the plugged hook. Never called by application code. */
  overrideRegistrationHook(hook: RegistrationHook | null): void {
    this.hook = hook
  }
}

/**
 * Holds `AccountPorts` only. It is a module of its own so a module that plugs in (M14) does not import `AccountModule`,
 * which would add the account routes to every app that loads that module.
 */
@Module({ providers: [AccountPorts], exports: [AccountPorts] })
export class AccountPortsModule {}
