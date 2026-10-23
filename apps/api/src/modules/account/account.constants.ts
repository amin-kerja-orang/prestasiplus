import {
  ACCOUNT_RESET_IC_MAX_ATTEMPTS,
  ACCOUNT_RESET_IC_WINDOW_MINUTES,
  ACCOUNT_RESET_REQUEST_INTERVAL_SECONDS,
  ACCOUNT_RESET_TOKEN_TTL_MINUTES,
  ACCOUNT_THROTTLE,
} from '@pp/contract'

import type { RateLimitSpec } from '../../common/throttle'

/** Audit actions of the account module. `details` carry ids, channels and field names only, never a token, IC, e-mail or password. */
export const ACCOUNT_AUDIT = {
  REGISTERED: 'account.registered',
  RESET_REQUESTED: 'account.password.reset_requested',
  RESET_IC_ISSUED: 'account.password.reset_ic_issued',
  RESET_DONE: 'account.password.reset_done',
  PASSWORD_CHANGED: 'account.password.changed',
  PASSWORD_CHANGE_LOCKED: 'account.password.change_locked',
  PROFILE_UPDATED: 'account.profile.updated',
  PICTURE_UPDATED: 'account.picture.updated',
} as const

/** REG-CLOSE: the 403 code and BM message of a closed self-registration (`REGISTRATION_OPEN=false`). */
export const ACCOUNT_REGISTRATION_CLOSED_CODE = 'REGISTRATION_CLOSED'
export const ACCOUNT_REGISTRATION_CLOSED_MESSAGE = 'Pendaftaran akaun baharu ditutup buat sementara waktu. Sila cuba lagi kemudian.'

/**
 * `PUT /me` school change (SW2-12): the student's username already exists in the chosen school (usernames are unique
 * per school). Replaces the generic English "The username has already been taken." on `schoolId`.
 */
export const ACCOUNT_SCHOOL_USERNAME_TAKEN_MESSAGE =
  'Nama pengguna anda sudah digunakan di sekolah ini. Sila hubungi pentadbir sekolah.'

/** A reset token is 32 random bytes (256 bits, contract minimum 128), base64url. */
export const RESET_TOKEN_BYTES = 32
export const RESET_TOKEN_TTL_MS = ACCOUNT_RESET_TOKEN_TTL_MINUTES * 60_000

/**
 * Counter keys on `login_attempts` (identifier_hash, ip_hash). Every key is a keyed hash with a
 * `reset:` prefix (step 1 design), so a reset counter can never collide with a login counter, and
 * neither an e-mail nor an address is stored.
 */
export const RESET_KEYS = {
  /** Per e-mail, one link request per 60 s (BR-11). Also started by every reset-ic attempt. */
  mailInterval: 'reset:mail',
  /** Link requests per client address (all e-mails). */
  mailIp: 'reset:mail-ip',
  /** reset-ic attempts per account (e-mail, known or not). */
  icAccount: 'reset:ic-account',
  /** reset-ic attempts per client address. */
  icIp: 'reset:ic-ip',
  /** Failed token redemptions per (e-mail, client address). */
  redeemPair: 'reset:redeem',
  /** Failed token redemptions per client address. */
  redeemIp: 'reset:redeem-ip',
  /** Wrong current password on `PUT /me/password`, per user. */
  passwordChange: 'pwchange',
  /** Failed password changes per user over 15 minutes. */
  passwordChangeCeiling: 'pwchange-15',
} as const

export const ANY = 'any'

export const MAIL_INTERVAL_MS = ACCOUNT_RESET_REQUEST_INTERVAL_SECONDS * 1000
export const MAIL_IP_LIMIT = ACCOUNT_THROTTLE.ipCeilingPerWindow
export const MAIL_IP_WINDOW_MS = ACCOUNT_THROTTLE.windowSeconds * 1000
export const IC_LIMIT = ACCOUNT_RESET_IC_MAX_ATTEMPTS
export const IC_WINDOW_MS = ACCOUNT_RESET_IC_WINDOW_MINUTES * 60_000
export const REDEEM_PAIR_LIMIT = ACCOUNT_THROTTLE.failedAttemptsPerWindow
export const REDEEM_IP_LIMIT = ACCOUNT_THROTTLE.ipCeilingPerWindow
export const REDEEM_WINDOW_MS = ACCOUNT_THROTTLE.windowSeconds * 1000
export const PASSWORD_CHANGE_LIMIT = ACCOUNT_THROTTLE.failedAttemptsPerWindow
export const PASSWORD_CHANGE_WINDOW_MS = ACCOUNT_THROTTLE.windowSeconds * 1000
/** On top of the per-minute limit: 20 failed password changes per user per 15 minutes (security review L2). */
export const PASSWORD_CHANGE_CEILING = 20
export const PASSWORD_CHANGE_CEILING_WINDOW_MS = 15 * 60_000

/** The only roles that may set their own school on `PUT /me`; every other role (and any new one) ignores it. */
export const SELF_SCHOOL_ROLES: readonly string[] = ['student', 'parent']

/** Interactive transaction room of the writes that hash nothing but touch several tables. */
export const ACCOUNT_TX = { maxWait: 10_000, timeout: 15_000 } as const

/** Per-user limit of the write routes (D57a). Env `THROTTLE_ACCOUNT_WRITE_PER_MINUTE`, else 30. */
export const ACCOUNT_LIMITS = {
  write: { bucket: 'account.write', env: 'THROTTLE_ACCOUNT_WRITE_PER_MINUTE', default: 30, per: 'user' },
  /** Registration, per client address, every attempt counts. Independent of the login throttle. */
  register: { bucket: 'account.register', env: 'THROTTLE_REGISTER_PER_MINUTE', default: 30, per: 'ip' },
  stats: { bucket: 'account.stats', env: 'THROTTLE_PUBLIC_PER_MINUTE', default: 60, per: 'ip' },
} as const satisfies Record<string, RateLimitSpec>
