import { Injectable } from '@nestjs/common'
import { hash, verify } from '@node-rs/argon2'

import { isLegacyBcrypt, verifyLegacyBcrypt } from './legacy-bcrypt'

/** OWASP argon2id minimum (19 MiB, t=2, p=1); the demo seed uses the same parameters. */
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const

export interface PasswordCheck {
  ok: boolean
  /** True when the stored hash is a legacy bcrypt hash that should be replaced by argon2id. */
  needsRehash: boolean
}

@Injectable()
export class PasswordService {
  private dummy: Promise<string> | undefined

  /** argon2id hash for storing a new password. */
  hash(plain: string): Promise<string> {
    return hash(plain, ARGON2_OPTIONS)
  }

  /**
   * Checks a password against a stored hash. A missing hash (user cannot log in) still spends the
   * same work as a real check against a throw-away hash, so timing does not tell the cases apart.
   */
  async check(plain: string, stored: string | null): Promise<PasswordCheck> {
    if (!stored) {
      await verify(await this.dummyHash(), plain).catch(() => false)
      return { ok: false, needsRehash: false }
    }
    if (stored.startsWith('$argon2')) {
      const ok = await verify(stored, plain).catch(() => false)
      return { ok, needsRehash: false }
    }
    if (isLegacyBcrypt(stored)) {
      // `$2y$` (Laravel) is bcrypt; a successful check is followed by a rehash to argon2id.
      const ok = verifyLegacyBcrypt(plain, stored)
      return { ok, needsRehash: ok }
    }
    return { ok: false, needsRehash: false }
  }

  private dummyHash(): Promise<string> {
    this.dummy ??= hash('pp-timing-equaliser', ARGON2_OPTIONS)
    return this.dummy
  }
}
