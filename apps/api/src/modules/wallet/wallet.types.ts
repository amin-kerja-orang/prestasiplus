import type { CreditType, DebitType } from './wallet.constants'

/**
 * The idempotency key of a movement. `sourceId` is REQUIRED so a caller decides on purpose:
 * - a string: the natural key (a practice session id for `quiz_practice`, `challenge:5:2026-09-24` for a daily
 *   challenge, `achievement:3`). Together with `userId` and `source` it makes the call idempotent: a second call
 *   with the same key and the same movement returns the first result and writes nothing.
 * - `null` plus `noKeyReason`: the explicit opt-out for a movement that has no natural key (for example a manual
 *   admin award). It is NOT idempotent; a retry writes a second row. `noKeyReason` (1 to 200 characters, not
 *   stored) records in the code why there is no key.
 */
export type MovementKey = { sourceId: string } | { sourceId: null; noKeyReason: string }

/**
 * `WalletService.credit`: adds syiling and one `earn`/`bonus`/`refund` ledger row.
 *
 * PDPA: `description` is shown to the user and kept for good, so it must be a STATIC BM template (for example
 * `Latih Tubi: 12 betul`); it must never hold a name, an IC number, an e-mail, a phone number or another
 * person's identifier.
 */
export type CreditInput = MovementKey & {
  userId: string
  /** Positive integer, at most `MAX_AMOUNT_PER_CALL`. */
  amount: number
  /** What caused it (1 to 100 characters), for example `quiz_practice`, `quiz_spm`, `daily_login`, `admin_award`. */
  source: string
  /** Static BM text shown to the user in the ledger (1 to 500 characters, no personal data). */
  description: string
  /** Default `earn`. */
  type?: CreditType
  /**
   * REQUIRED. True while an admin is in Mod Pelajar (`auth.mode !== null`, see `isTestActor`): the row is
   * stamped `is_test`. There is no default, so every caller decides.
   */
  isTest: boolean
}

/** `WalletService.debit`: removes syiling and writes one `spend` or `convert` row (409 `INSUFFICIENT_BALANCE` when short). */
export type DebitInput = MovementKey & {
  userId: string
  /** Positive integer (the ledger stores it negative), at most `MAX_AMOUNT_PER_CALL`. */
  amount: number
  source: string
  /** Static BM text, no personal data (see `CreditInput.description`). */
  description: string
  /** Default `spend`. */
  type?: DebitType
  /**
   * `convert` only (BR-M14-10): the tokens this conversion pays out. They are added to the token balance in the
   * same step and stored in the ledger row; a conversion writes no `token_movements` row (as the mock).
   * SERVER-SIDE ONLY: the caller computes them from the tier `conversionRate` in the database and never takes
   * them (or the syiling amount) from a request body.
   */
  tokens?: number
  /** REQUIRED (see `CreditInput.isTest`). */
  isTest: boolean
}

export interface LedgerOutcome {
  /**
   * True when the key was already used by the SAME movement: nothing was written and the FIRST entry
   * (`entryId`, `amount`, `balanceAfter`) is returned together with the CURRENT wallet totals below (which
   * may be newer than that entry). The same key with another type, amount or token count is a 409 `CONFLICT`.
   */
  replayed: boolean
  entryId: string
  type: string
  /** Signed, as stored. */
  amount: number
  /** The balance after THIS entry (for a replay: after the first call). */
  balanceAfter: number
  /** The live wallet after the call. */
  currentSyiling: number
  totalSyilingEarned: number
  tokenBalance: number
  /** Key of the wallet's tier (`tiers.tier_name`), null when no tier exists. */
  tierKey: string | null
}

/**
 * Token credit/debit input. `refId` is REQUIRED and is the idempotency key together with `userId` and `source`
 * (unique index on `token_movements`): the same key with the same movement is a replay (nothing written), with
 * another amount or direction a 409 `CONFLICT` (`IDEMPOTENCY_MISMATCH`).
 */
export interface TokenInput {
  userId: string
  /** Positive integer, at most `MAX_AMOUNT_PER_CALL`. */
  amount: number
  /** For example `hadiah_redeem`, `mystery_box`, `hadiah_refund`. */
  source: string
  /** The cause of the movement (1 to 200 characters): a redemption id, a refund id... */
  refId: string
  /** REQUIRED (see `CreditInput.isTest`). */
  isTest: boolean
}

export interface SessionCreditInput {
  /** The practice session (uuid). */
  sessionId: string
  userId: string
  coinsEarned: number
  pointsEarned: number
  streakCount: number
  totalBalance: number
  completedAt: Date
  /** REQUIRED (see `CreditInput.isTest`). */
  isTest: boolean
}

export interface SessionCreditResult {
  sessionId: string
  coinsEarned: number
  pointsEarned: number
  streakCount: number
  totalBalance: number
}

export interface StreakView {
  current: number
  best: number
  lastActivityDate: string | null
  totalDays: number
  multiplier: number
}

/** The `isTest` value for a write made on behalf of a signed-in actor: true while an admin is in Mod Pelajar (`auth.mode !== null`). */
export const isTestActor = (auth: { mode: unknown }): boolean => auth.mode !== null && auth.mode !== undefined
