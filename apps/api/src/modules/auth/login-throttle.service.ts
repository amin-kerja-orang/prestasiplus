import { Inject, Injectable } from '@nestjs/common'

import { PrismaService } from '../../db/prisma.service'
import { AuthConfig } from './auth.config'
import { LOGIN_WINDOW_MS } from './auth.constants'
import { rateLimited } from './auth.errors'
import { hmacHex } from './tokens'

export interface ThrottleKeys {
  identifierHash: string
  ipHash: string
}

/**
 * Login throttle (mock BR-02, card AC 3): at most `THROTTLE_LOGIN_PER_MINUTE` attempts per
 * identifier + client address in a 60 s window, kept as one counter row in `login_attempts`.
 *
 * Every attempt is counted BEFORE the password is checked, in one atomic upsert, so parallel
 * guesses cannot slip past the limit. A success clears the counter and a refusal that is not a
 * credential failure (inactive account, ambiguous username) gives its count back. The attempt over
 * the limit gets 429 even with the correct password. Neither the identifier nor the address is
 * stored, only keyed hashes.
 */
@Injectable()
export class LoginThrottle {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthConfig) private readonly config: AuthConfig,
  ) {}

  keys(identifier: string, ip: string): ThrottleKeys {
    return {
      identifierHash: hmacHex(this.config.secret, 'login-id', identifier.trim().toLowerCase()),
      ipHash: hmacHex(this.config.secret, 'ip', ip),
    }
  }

  /** Counts this attempt; throws 429 `RATE_LIMITED` when the limit is already used up. */
  async begin(keys: ThrottleKeys, now: Date): Promise<void> {
    const windowEnd = new Date(now.getTime() + LOGIN_WINDOW_MS)
    const rows = await this.prisma.client.$queryRaw<{ attempts: number; expires_at: Date }[]>`
      INSERT INTO login_attempts (identifier_hash, ip_hash, attempts, expires_at, created_at, updated_at)
      VALUES (${keys.identifierHash}, ${keys.ipHash}, 1, ${windowEnd}::timestamptz, ${now}::timestamptz, ${now}::timestamptz)
      ON CONFLICT (identifier_hash, ip_hash) DO UPDATE SET
        attempts   = CASE WHEN login_attempts.expires_at <= ${now}::timestamptz THEN 1
                          ELSE login_attempts.attempts + 1 END,
        expires_at = CASE WHEN login_attempts.expires_at <= ${now}::timestamptz THEN ${windowEnd}::timestamptz
                          ELSE login_attempts.expires_at END,
        updated_at = ${now}::timestamptz
      RETURNING attempts, expires_at`
    const row = rows[0]
    if (row && row.attempts > this.config.loginLimit) {
      const seconds = Math.ceil((row.expires_at.getTime() - now.getTime()) / 1000)
      throw rateLimited(Math.min(60, Math.max(1, seconds)))
    }
  }

  /** Gives one attempt back (a refusal that is not a failed credential check). */
  async refund(keys: ThrottleKeys): Promise<void> {
    await this.prisma.client.$executeRaw`
      UPDATE login_attempts SET attempts = GREATEST(attempts - 1, 0)
       WHERE identifier_hash = ${keys.identifierHash} AND ip_hash = ${keys.ipHash}`
  }

  /** A successful login resets the counter. */
  async clear(keys: ThrottleKeys): Promise<void> {
    await this.prisma.client.loginAttempt.deleteMany({
      where: { identifierHash: keys.identifierHash, ipHash: keys.ipHash },
    })
  }
}
