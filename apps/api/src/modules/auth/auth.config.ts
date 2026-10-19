import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { DEFAULT_COOKIE_NAME, DEFAULT_LOGIN_LIMIT } from './auth.constants'

const DEV_SECRET = 'pp-dev-session-secret-not-for-production'
const MIN_SECRET_LENGTH = 16

/**
 * Settings of the auth module, read once at start-up. Keys are plan section 11 / `.env.api.example`:
 * `SESSION_COOKIE_NAME`, `SESSION_SECRET`, `COOKIE_SECURE`, `COOKIE_DOMAIN`,
 * `THROTTLE_LOGIN_PER_MINUTE`. The session lifetimes are fixed by the card (120 minutes sliding,
 * 5 years remembered), not configurable.
 */
@Injectable()
export class AuthConfig {
  readonly cookieName: string
  readonly cookieSecure: boolean
  readonly cookieDomain: string | undefined
  /** Key of every keyed hash (client address, identifier) and of the derived CSRF token. */
  readonly secret: string
  readonly loginLimit: number

  constructor(@Inject(ConfigService) config: ConfigService) {
    const production = config.get<string>('NODE_ENV') === 'production'
    this.cookieName = config.get<string>('SESSION_COOKIE_NAME') || DEFAULT_COOKIE_NAME
    this.cookieSecure = (config.get<string>('COOKIE_SECURE') ?? 'true').toLowerCase() !== 'false'
    this.cookieDomain = config.get<string>('COOKIE_DOMAIN') || undefined

    const secret = config.get<string>('SESSION_SECRET')
    if (production && (!secret || secret.length < MIN_SECRET_LENGTH || secret === 'change-me')) {
      // Fail closed: a guessable key would make the derived CSRF tokens and hashes forgeable.
      throw new Error('SESSION_SECRET must be set to a random value of at least 16 characters in production.')
    }
    this.secret = secret || DEV_SECRET

    const limit = Number.parseInt(config.get<string>('THROTTLE_LOGIN_PER_MINUTE') ?? '', 10)
    this.loginLimit = Number.isInteger(limit) && limit >= 1 ? limit : DEFAULT_LOGIN_LIMIT
  }
}
