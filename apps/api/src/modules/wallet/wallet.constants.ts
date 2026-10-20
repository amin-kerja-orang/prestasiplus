import type { RateLimitSpec } from '../../common/throttle'

/** Ledger row types (SRS M14 DATA-M14-02, `E-ledger_type`). Same codes as `@pp/contract` WALLET_LEDGER_TYPES. */
export const CREDIT_TYPES = ['earn', 'bonus', 'refund'] as const
export const DEBIT_TYPES = ['spend', 'convert'] as const
export type CreditType = (typeof CREDIT_TYPES)[number]
export type DebitType = (typeof DEBIT_TYPES)[number]

/** BR-M14-15: the only observed streak multiplier step. It multiplies nothing. */
export const STREAK_MULTIPLIER = 1

/** BR-M14-09 titles by lifetime syiling (the emojis of the last four were not observed, so they are empty). */
export const TITLES: readonly { name: string; emoji: string; threshold: number }[] = [
  { name: 'Permulaan', emoji: '📚', threshold: 0 },
  { name: 'Pelajar', emoji: '🎓', threshold: 300 },
  { name: 'Master', emoji: '', threshold: 2000 },
  { name: 'Grandmaster', emoji: '', threshold: 3500 },
  { name: 'Legenda', emoji: '', threshold: 5000 },
  { name: 'Mitos', emoji: '', threshold: 10000 },
]

/** Exact BM copy of the mock `M14Error('INSUFFICIENT_BALANCE', ...)`. */
export const INSUFFICIENT_SYILING = 'Baki syiling tidak mencukupi.'
export const INSUFFICIENT_TOKENS = 'Baki token tidak mencukupi.'

/**
 * Canonical row-lock order when ONE transaction needs both rows of a user: the streak first, then the wallet.
 * `StreakService` locks only `streaks`, `WalletService` only `wallets`; a caller (practice completion, login,
 * missions...) calls them in this order, so no two transactions can wait on each other in a cycle.
 */
export const LOCK_ORDER = ['streaks', 'wallets'] as const

/** Column limits (the checks of migration 0010). */
export const SOURCE_MAX = 100
export const SOURCE_ID_MAX = 200
export const DESCRIPTION_MAX = 500
/** The largest value of the Postgres `integer` columns that hold balances. */
export const INT_MAX = 2_147_483_647

/**
 * Per-call ceiling for ONE movement (syiling credit/debit, convert tokens, token credit/debit, XP). A real
 * movement is a few hundred at most (the biggest observed reward is 25 syiling); the ceiling stops a caller bug
 * or an unvalidated admin input from minting or draining a wallet in one call. Raising it is a reviewed code change.
 * A call above it is refused with 422 `VALIDATION_ERROR` (`details.reason = AMOUNT_CEILING`) and writes nothing.
 */
export const MAX_AMOUNT_PER_CALL = 100_000

/** `GET /gamification/transactions` returns at most this many rows, newest first (an unpaginated route stays bounded). */
export const TRANSACTIONS_MAX_ROWS = 500

/** A caller `at` for a streak may be at most this far ahead of the server clock (clock skew between nodes). */
export const STREAK_FUTURE_SKEW_MS = 5 * 60_000

/** Per signed-in user. The three reads are own-scope and the ledger read is the heavy one; the ceiling stops scraping loops. */
export const WALLET_READ_LIMIT = {
  bucket: 'wallet.read',
  env: 'THROTTLE_WALLET_READ_PER_MINUTE',
  default: 240,
  per: 'user',
} as const satisfies RateLimitSpec
