import type { RoleCode } from '@pp/contract'
import type { RateLimitSpec } from '../../common/throttle'

/** Audit actions of the user writes and reads. `details` carry ids, counts and field names only. */
export const USER_AUDIT = {
  CREATED: 'users.created',
  UPDATED: 'users.updated',
  DELETED: 'users.deleted',
  BULK_DELETED: 'users.bulk_deleted',
  TOGGLED: 'users.toggled',
  IMPORTED: 'users.imported',
  READ: 'users.read',
} as const

/** Most ids one `bulk-delete` call accepts (the contract sets none; deviation log 2026-10-19, BE-05). */
export const BULK_DELETE_MAX_IDS = 500

/** The page number is clamped here so `skip` stays inside a 32-bit integer. */
export const PAGE_NUMBER_MAX = 10_000_000

/**
 * Roles a school_admin can see until the parent links table exists (BE-25): a parent is in scope
 * only when ALL linked children are in the caller's school, and that cannot be known yet, so
 * parents stay hidden (fail closed). `MANAGEABLE_TARGET_ROLES.school_admin` already lists `parent`.
 */
export const SCHOOL_ADMIN_VISIBLE_ROLES: readonly RoleCode[] = ['student', 'teacher']

/** Alphabet of generated passwords: no 0/O/1/I/l, so a password read from a screen is not misread. */
export const PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
export const PASSWORD_LENGTH = 14

/** Concurrent argon2id hashes while preparing an import (each one needs about 19 MiB). */
export const IMPORT_HASH_CONCURRENCY = 4

/** Limits of the import transaction (hashing happens before it, so it only inserts). */
export const IMPORT_TX = { maxWait: 20_000, timeout: 60_000 } as const

export const TEACHER_SEARCH_NOTE =
  'A teacher sees only students of its own classes; no classes table exists before BE-17, so the result is empty.'

/** Shared limiter specs (common/throttle). Buckets are this module's own; ceilings come from env, else the default. */
export const USER_LIMITS = {
  read: { bucket: 'users.admin.read', env: 'THROTTLE_ADMIN_READ_PER_MINUTE', default: 300, per: 'user' },
  write: { bucket: 'users.admin.write', env: 'THROTTLE_ADMIN_WRITE_PER_MINUTE', default: 30, per: 'user' },
  import: { bucket: 'users.import', env: 'THROTTLE_IMPORT_PER_HOUR', default: 10, per: 'user', windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitSpec>
