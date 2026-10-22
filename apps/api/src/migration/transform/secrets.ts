/**
 * Password and IC handling of the user transform (plan T-03, T-04; card AC2, AC3).
 * Pure functions. Nothing here logs, and a clear IC or a plaintext password never leaves this file.
 */
import { createHmac } from 'node:crypto'

/** `$2a$ $2b$ $2x$ $2y$`, a cost and 53 characters of salt and hash (the shape `legacy-bcrypt.ts` verifies). */
const BCRYPT = /^\$2([abxy])\$(\d{2})\$([./A-Za-z0-9]{22})([./A-Za-z0-9]{31})$/
/** Costs outside this range are not verified by the v2 login (CPU-exhaustion guard), so they are not copied. */
const MIN_COST = 4
const MAX_COST = 13
const ARGON2ID = /^\$argon2id\$v=\d+\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/

export type ResetReason = 'none' | 'non_bcrypt' | 'shared_default' | 'roster_account'

export interface PasswordDecision {
  /** The hash to store, or null when nothing usable exists (never plaintext or a malformed value). */
  passwordHash: string | null
  mustResetPassword: boolean
  /** Why a reset is forced (for the report counts only). */
  reasons: readonly ResetReason[]
}

/**
 * - bcrypt (`$2y$` etc.): copied as is, the v2 login verifies it and rehashes on success;
 * - `$argon2id$`: copied (the v2 verifier handles it) but flagged for reset (not the Laravel bcrypt contract);
 * - anything else (plaintext, other algorithms, empty): stored as null and flagged;
 * - a hash in `defaultHashes` (the shared roster default, passed at run time): flagged;
 * - a roster account (a username and no e-mail) is flagged whatever its hash (risk table, section 5).
 */
export function decidePassword(
  raw: string | null | undefined,
  opts: { defaultHashes: ReadonlySet<string>; rosterAccount: boolean },
): PasswordDecision {
  const value = raw === null || raw === undefined ? '' : raw.trim()
  const reasons: ResetReason[] = []
  let passwordHash: string | null = null
  const bcrypt = BCRYPT.exec(value)
  if (bcrypt) {
    const cost = Number(bcrypt[2])
    if (cost >= MIN_COST && cost <= MAX_COST) passwordHash = value
    else reasons.push('non_bcrypt')
  } else if (ARGON2ID.test(value)) {
    passwordHash = value
    reasons.push('non_bcrypt')
  } else {
    reasons.push('non_bcrypt')
  }
  if (value !== '' && opts.defaultHashes.has(value)) reasons.push('shared_default')
  if (opts.rosterAccount) reasons.push('roster_account')
  return {
    passwordHash,
    mustResetPassword: reasons.length > 0,
    reasons: reasons.length > 0 ? reasons : ['none'],
  }
}

/** Parses the lead's run-time list of shared default hashes (comma or whitespace separated). Never log the result. */
export function parseDefaultHashes(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(/[\s,]+/)
      .map((h) => h.trim())
      .filter((h) => h !== ''),
  )
}

export interface IcParts {
  hash: string
  masked: string
}

/**
 * The same keyed HMAC and mask as `IcService` (users/credentials.ts), so a migrated `ic_hash` matches the
 * hash of the same IC typed at the reset-ic flow. The key is `IC_HASH_KEY`, else `SESSION_SECRET` (never in
 * production). A test asserts the equality with `IcService`.
 */
export class IcHasher {
  private readonly key: string

  constructor(env: Readonly<Record<string, string | undefined>>) {
    const own = env.IC_HASH_KEY
    const prod = /^\s*prod(uction)?\s*$/i.test(env.NODE_ENV ?? '')
    if (!own && prod) throw new Error('IC_HASH_KEY is required in production to hash IC numbers.')
    const key = own || env.SESSION_SECRET
    if (!key) throw new Error('IC_HASH_KEY or SESSION_SECRET is required to hash IC numbers.')
    this.key = key
  }

  /** Hash and mask of an IC as stored in .cloud; null when it is not 12 digits (`-` and spaces are formatting). */
  parts(raw: string | null | undefined): IcParts | null {
    if (raw === null || raw === undefined) return null
    const digits = raw.replace(/[\s-]/g, '')
    if (!/^\d{12}$/.test(digits)) return null
    return {
      hash: createHmac('sha256', this.key).update(`ic:${digits}`).digest('hex'),
      masked: `xxxxxx-xx-xx${digits.slice(-2)}`,
    }
  }
}
