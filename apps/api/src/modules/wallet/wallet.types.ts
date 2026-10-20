import type { CreditType, DebitType } from './wallet.constants'

/**
 * `WalletService.credit`: adds syiling and one `earn`/`bonus`/`refund` ledger row.
 *
 * `sourceId` is the idempotency key together with `userId` and `source`: a second call with the same key
 * returns the first result and writes nothing. Leave it null only for a movement that has no natural key
 * (it is then NOT idempotent). Examples: a practice session id for `quiz_practice`, `challenge:5:2026-09-24`
 * for a daily challenge (one per challenge per Malaysia day), `achievement:3`.
 */
export interface CreditInput {
  userId: string
  /** Positive integer. */
  amount: number
  /** What caused it (1 to 100 characters), for example `quiz_practice`, `quiz_spm`, `daily_login`, `admin_award`. */
  source: string
  sourceId?: string | null
  /** BM text shown to the user in the ledger (1 to 500 characters). */
  description: string
  /** Default `earn`. */
  type?: CreditType
  /** True while an admin is in Mod Pelajar (`auth.mode !== null`): the row is stamped `is_test`. */
  isTest?: boolean
}

/** `WalletService.debit`: removes syiling and writes one `spend` or `convert` row (409 `INSUFFICIENT_BALANCE` when short). */
export interface DebitInput {
  userId: string
  /** Positive integer (the ledger stores it negative). */
  amount: number
  source: string
  sourceId?: string | null
  description: string
  /** Default `spend`. */
  type?: DebitType
  /**
   * `convert` only (BR-M14-10): the tokens this conversion pays out. They are added to the token balance in the
   * same step and stored in the ledger row; a conversion writes no `token_movements` row (as the mock).
   */
  tokens?: number
  isTest?: boolean
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

export interface TokenInput {
  userId: string
  /** Positive integer. */
  amount: number
  /** For example `hadiah_redeem`, `mystery_box`, `hadiah_refund`. */
  source: string
  refId?: string | null
  isTest?: boolean
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
  isTest?: boolean
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
