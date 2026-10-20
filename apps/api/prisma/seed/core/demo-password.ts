/**
 * The one place that decides the password hash of every demo account (identity and population seeds).
 *
 * - `SEED_DEMO_PASSWORD_HASH` set and non-empty: that value is used as the hash. It must be an argon2id PHC string
 *   (`$argon2id$v=19$m=...,t=...,p=...$salt$hash`); anything else throws (the message never echoes the value), so a
 *   public staging cannot silently end up with unusable or weak logins.
 * - Otherwise `DEMO_PASSWORD` (the published dev password) is hashed once per process, as before.
 *
 * Nothing here logs the password or the hash. An account that already has a hash keeps it (see the seeds), so a new
 * `SEED_DEMO_PASSWORD_HASH` only applies to accounts created after it is set.
 */
import { hash } from '@node-rs/argon2'

export const DEMO_PASSWORD = 'Demo1234'
export const DEMO_HASH_ENV = 'SEED_DEMO_PASSWORD_HASH'

/** OWASP argon2id minimum (19 MiB, t=2, p=1). The auth module uses the same parameters. */
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const

const PHC_ARGON2ID = /^\$argon2id\$v=19\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/

/** Pure: the hash for the demo accounts given an environment (hashes `DEMO_PASSWORD` when no override is set). */
export async function resolveDemoPasswordHash(env: Record<string, string | undefined> = process.env): Promise<string> {
  const override = env[DEMO_HASH_ENV]
  if (override === undefined || override.trim() === '') return hash(DEMO_PASSWORD, ARGON2_OPTIONS)
  const value = override.trim()
  if (!PHC_ARGON2ID.test(value)) {
    throw new Error(`${DEMO_HASH_ENV} is set but is not an argon2id PHC string ($argon2id$v=19$m=...,t=...,p=...$salt$hash); refusing to seed demo accounts with it.`)
  }
  return value
}

let shared: Promise<string> | undefined

/** Computed ONCE per process and shared by every demo account (all of them use the same password). */
export function demoPasswordHash(): Promise<string> {
  shared ??= resolveDemoPasswordHash()
  return shared
}
