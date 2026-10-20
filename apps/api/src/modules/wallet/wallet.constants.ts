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

/** Column limits (the checks of migration 0010). */
export const SOURCE_MAX = 100
export const SOURCE_ID_MAX = 200
export const DESCRIPTION_MAX = 500
/** The largest value of the Postgres `integer` columns that hold balances. */
export const INT_MAX = 2_147_483_647

/** Per signed-in user. The three reads are cheap and own-scope; the ceiling only stops scraping loops. */
export const WALLET_READ_LIMIT = {
  bucket: 'wallet.read',
  env: 'THROTTLE_WALLET_READ_PER_MINUTE',
  default: 600,
  per: 'user',
} as const satisfies RateLimitSpec
