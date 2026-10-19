import { createHmac, randomInt } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { PASSWORD_ALPHABET, PASSWORD_LENGTH } from './users.constants'

/** A random initial password (D59b): 14 characters from a 54-letter alphabet, about 80 bits. */
export function generatePassword(): string {
  let out = ''
  for (let i = 0; i < PASSWORD_LENGTH; i++) out += PASSWORD_ALPHABET.charAt(randomInt(PASSWORD_ALPHABET.length))
  return out
}

export interface IcParts {
  hash: string
  masked: string
}

/** A MyKad number is 12 digits; `-` and spaces are formatting. */
const IC_PATTERN = /^\d{12}$/

/**
 * The IC is stored as a keyed HMAC-SHA-256 plus a masked value, never in clear (card AC5). The key
 * is `IC_HASH_KEY`, or the session secret when it is not set. A plain hash would be brute-forceable
 * (12 digits), so the key must stay server-side. The reset-ic flow (BE-06) compares with `hash()`.
 */
@Injectable()
export class IcService {
  private readonly key: string

  constructor(@Inject(ConfigService) config: ConfigService) {
    const own = config.get<string>('IC_HASH_KEY')
    // The session-secret fallback is for development and tests only; production needs its own key.
    if (!own && config.get<string>('NODE_ENV') === 'production') throw new Error('IC_HASH_KEY is required in production to hash IC numbers.')
    const key = own || config.get<string>('SESSION_SECRET')
    if (!key) throw new Error('IC_HASH_KEY or SESSION_SECRET is required to hash IC numbers.')
    this.key = key
  }

  /** The 12 digits of an IC as typed, or null when it is not an IC. */
  normalise(raw: string): string | null {
    const digits = raw.replace(/[\s-]/g, '')
    return IC_PATTERN.test(digits) ? digits : null
  }

  hash(digits: string): string {
    return createHmac('sha256', this.key).update(`ic:${digits}`).digest('hex')
  }

  /** `xxxxxx-xx-xx` + the last two digits (the contract `IcMasked`). */
  mask(digits: string): string {
    return `xxxxxx-xx-xx${digits.slice(-2)}`
  }

  /** Hash and mask of an IC as typed; null when it is not a valid IC. */
  parts(raw: string): IcParts | null {
    const digits = this.normalise(raw)
    return digits === null ? null : { hash: this.hash(digits), masked: this.mask(digits) }
  }
}
