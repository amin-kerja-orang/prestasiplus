import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import {
  DEFAULT_COOKIE_NAME,
  DEFAULT_LEGACY_DUMMY_COST,
  DEFAULT_LOGIN_LIMIT,
  DEFAULT_REMEMBER_DAYS,
  DEFAULT_REMEMBER_DAYS_STAFF,
} from './auth.constants'
import { MAX_LEGACY_COST, MIN_LEGACY_COST } from './legacy-bcrypt'

function intOr(value: unknown, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER): number {
  const n = Number.parseInt(String(value ?? ''), 10)
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback
}

/**
 * Settings of the auth module, read once at start-up through the config service. Keys are plan
 * section 11 / `.env.api.example`: `SESSION_COOKIE_NAME`, `SESSION_SECRET` (validated and defaulted
 * by the env loader: required in production), `COOKIE_SECURE`, `COOKIE_DOMAIN`,
 * `THROTTLE_LOGIN_PER_MINUTE`, `SESSION_REMEMBER_DAYS`, `SESSION_REMEMBER_DAYS_STAFF` and
 * `LEGACY_BCRYPT_DUMMY_COST`. The idle lifetime (120 minutes, sliding) is fixed by the card.
 */
@Injectable()
export class AuthConfig {
  readonly cookieName: string
  readonly cookieSecure: boolean
  readonly cookieDomain: string | undefined
  /** Key of every keyed hash (client address, identifier) and of the derived CSRF token. */
  readonly secret: string
  readonly loginLimit: number
  /** "Remember me" lifetime in days for learner roles. */
  readonly rememberDays: number
  /** "Remember me" lifetime in days for accounts holding admin or school_admin; never above `rememberDays`. */
  readonly rememberDaysStaff: number
  /** Cost of the throw-away bcrypt hash that equalises timing for unknown accounts. */
  readonly legacyDummyCost: number

  /** Remember lifetime for an account: the staff cap applies when it holds admin or school_admin. */
  rememberDaysFor(roles: readonly string[]): number {
    return roles.includes('admin') || roles.includes('school_admin') ? this.rememberDaysStaff : this.rememberDays
  }

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.cookieName = config.get<string>('SESSION_COOKIE_NAME') || DEFAULT_COOKIE_NAME
    this.cookieSecure = (config.get<string>('COOKIE_SECURE') ?? 'true').toLowerCase() !== 'false'
    this.cookieDomain = config.get<string>('COOKIE_DOMAIN') || undefined

    const secret = config.get<string>('SESSION_SECRET')
    if (!secret) throw new Error('SESSION_SECRET is missing from the validated configuration.')
    this.secret = secret

    this.loginLimit = intOr(config.get('THROTTLE_LOGIN_PER_MINUTE'), DEFAULT_LOGIN_LIMIT, 1)
    this.rememberDays = intOr(config.get('SESSION_REMEMBER_DAYS'), DEFAULT_REMEMBER_DAYS, 1)
    this.rememberDaysStaff = Math.min(
      this.rememberDays,
      intOr(config.get('SESSION_REMEMBER_DAYS_STAFF'), DEFAULT_REMEMBER_DAYS_STAFF, 1),
    )
    this.legacyDummyCost = intOr(
      config.get('LEGACY_BCRYPT_DUMMY_COST'),
      DEFAULT_LEGACY_DUMMY_COST,
      MIN_LEGACY_COST,
      MAX_LEGACY_COST,
    )
  }
}
