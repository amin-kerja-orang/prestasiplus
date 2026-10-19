import { Inject, Injectable } from '@nestjs/common'
import { hash, verify } from '@node-rs/argon2'

import { AuthConfig } from './auth.config'
import { isLegacyBcrypt, LegacyBcryptPool } from './legacy-bcrypt'

/** OWASP argon2id minimum (19 MiB, t=2, p=1); the demo seed uses the same parameters. */
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const
const DUMMY_SALT = 'abcdefghijklmnopqrstuu'

/** Concurrent argon2id operations in the whole process (each needs about 19 MiB and a libuv thread). */
export const ARGON2_SLOTS = 2

/**
 * Process-wide counting semaphore with two FIFO queues: login verification ("high") is served before
 * hashing for bulk work ("low"), so a login never waits behind a 1000-row import for more than the
 * operations already running. `peak` is the highest concurrency seen (tests read it).
 */
export class Argon2Gate {
  private active = 0
  private readonly high: (() => void)[] = []
  private readonly low: (() => void)[] = []
  peak = 0

  constructor(private readonly slots: number) {}

  async run<T>(priority: 'high' | 'low', fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.slots) {
      await new Promise<void>((resolve) => (priority === 'high' ? this.high : this.low).push(resolve))
    } else {
      this.active++
    }
    this.peak = Math.max(this.peak, this.active)
    try {
      return await fn()
    } finally {
      const next = this.high.shift() ?? this.low.shift()
      if (next) next() // the slot passes to the next waiter
      else this.active--
    }
  }
}

/** Shared by every caller of `PasswordService` (login, rehash, admin-created accounts, imports). */
export const argon2Gate = new Argon2Gate(ARGON2_SLOTS)

export interface PasswordCheck {
  ok: boolean
  /** True when the stored hash is a legacy bcrypt hash that should be replaced by argon2id. */
  needsRehash: boolean
}

@Injectable()
export class PasswordService {
  constructor(
    @Inject(LegacyBcryptPool) private readonly legacy: LegacyBcryptPool,
    @Inject(AuthConfig) private readonly config: AuthConfig,
  ) {}

  /** argon2id hash for storing a new password. */
  hash(plain: string): Promise<string> {
    return argon2Gate.run('low', () => hash(plain, ARGON2_OPTIONS))
  }

  /**
   * Checks a password against a stored hash.
   *
   * Timing: most migrated accounts hold a legacy bcrypt hash, so a check that finds no account (or
   * no usable hash) spends the same work as a legacy check, a throw-away bcrypt hash of the
   * configured dummy cost (default 12, the Laravel default). The answer time then does not tell a
   * migrated account from an unknown identifier. (Accounts already on argon2id answer faster; see
   * the deviation log.) Legacy work runs in the worker pool, never on the event loop.
   * Throws `LegacyBcryptBusyError` when the pool queue is full.
   */
  async check(plain: string, stored: string | null): Promise<PasswordCheck> {
    if (stored?.startsWith('$argon2')) {
      const ok = await argon2Gate.run('high', () => verify(stored, plain)).catch(() => false)
      return { ok, needsRehash: false }
    }
    if (stored && isLegacyBcrypt(stored)) {
      // `$2y$` (Laravel) is bcrypt; a successful check is followed by a rehash to argon2id.
      const ok = await this.legacy.verify(plain, stored)
      return { ok, needsRehash: ok }
    }
    // No hash, or a format we do not know: dummy legacy work, never a success.
    await this.legacy.hash('pp-timing-equaliser', DUMMY_SALT, this.config.legacyDummyCost, '2y')
    return { ok: false, needsRehash: false }
  }
}
