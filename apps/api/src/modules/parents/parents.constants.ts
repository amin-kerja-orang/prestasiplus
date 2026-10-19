import type { RateLimitSpec } from '../../common/throttle'

/** Audit actions of the parent invites. `details` carry ids and flags only, never a token or its hash. */
export const PARENT_AUDIT = {
  INVITE_ISSUED: 'parents.invite.issued',
  INVITE_ACCEPTED: 'parents.invite.accepted',
  LINK_REMOVED: 'parents.link.removed',
} as const

/** Token size: 32 random bytes = 256 bits, written as 64 lowercase hex characters (contract `ParentInviteToken`). */
export const PARENT_INVITE_TOKEN_BYTES = 32

/** Domain label of the keyed token hash (one secret serves several purposes, see `hmacHex`). */
export const PARENT_INVITE_HASH_LABEL = 'parent-invite'

/** Shown for a parent without an e-mail: the contract requires a masked shape (`x***@domain`). */
export const NO_EMAIL_MASK = '-***@-'

/**
 * Limiter specs (common/throttle). The preview is public, so it is counted per client address; the
 * others per signed-in user. Ceilings come from env, else the default.
 */
export const PARENT_LIMITS = {
  preview: { bucket: 'parents.invite.preview', env: 'THROTTLE_PARENT_INVITE_PREVIEW_PER_MINUTE', default: 30, per: 'ip' },
  read: { bucket: 'parents.invite.read', env: 'THROTTLE_PARENT_INVITE_READ_PER_MINUTE', default: 120, per: 'user' },
  issue: { bucket: 'parents.invite.issue', env: 'THROTTLE_PARENT_INVITE_ISSUE_PER_HOUR', default: 10, per: 'user', windowSeconds: 3600 },
  unlink: { bucket: 'parents.link.write', env: 'THROTTLE_PARENT_LINK_WRITE_PER_MINUTE', default: 30, per: 'user' },
  accept: { bucket: 'parents.invite.accept', env: 'THROTTLE_PARENT_INVITE_ACCEPT_PER_HOUR', default: 30, per: 'user', windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitSpec>

export const WRITE_TX = { maxWait: 10_000, timeout: 15_000 } as const
