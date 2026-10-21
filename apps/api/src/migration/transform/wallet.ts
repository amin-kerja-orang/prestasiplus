/**
 * Wallet and coin-ledger transforms of `migrate:activity` (BE-29; v2-backend-plan.md 14.7, v2-data-migration.md
 * section 5 "ledger integrity"). Pure functions, no I/O.
 *
 * Rules
 *  - A wallet balance is NEVER corrected: `current_syiling` is the .cloud `syiling_balance` as it is. A negative or
 *    non-numeric balance is rejected (INVALID_VALUE), not clamped.
 *  - Only pupils carry a wallet in v2 (D28c): the wallet or ledger row of another role is UNSUPPORTED.
 *  - A ledger row keeps its `balance_after`; its amount must have the sign its type needs
 *    (`ck_coin_ledger_amount_sign`): a wrong sign is INVALID_VALUE and is never flipped.
 *  - The type and source are mapped explicitly; a value outside the map is UNKNOWN_ENUM.
 */
import { enumMapper, invalid, nonNegativeInt, orphan, unsupported } from './activity-common'
import { integer, ok, stamps, type Outcome, type Staged } from './common'

const INT_MAX = 2_147_483_647

/** Non-negative integer that also fits a PostgreSQL `integer`; blank is null, anything else invalid. */
export function boundedCount(value: string | null | undefined): number | null | 'invalid' {
  const n = nonNegativeInt(value)
  if (n === null || n === 'invalid') return n
  return n > INT_MAX ? 'invalid' : n
}

/** A signed integer (text) that fits a PostgreSQL `integer`. */
function signedInt(value: string | null | undefined): number | null | 'invalid' {
  const n = integer(value)
  if (n === null || n === 'invalid') return n
  return Math.abs(n) > INT_MAX ? 'invalid' : n
}

// ---------------------------------------------------------------- wallets

export interface WalletRefs {
  /** The v2 user id, or undefined when the user was not loaded. */
  userId: string | undefined
  /** The v2 user holds the student role. */
  isStudent: boolean
  /**
   * The v2 tier id; null = the wallet has no tier; undefined = a tier is set but was not adopted (no seeded match).
   * Both load the wallet with a null tier (`wallets.tier_id` is nullable; credits work without a tier).
   */
  tierId: string | null | undefined
}

export interface WalletValues {
  user_id: string
  tier_id: string | null
  current_syiling: number
  total_syiling_earned: number
  token_balance: number
  xp: number
  level: number
  created_at: string
  updated_at: string
}

export const WALLET_COLUMNS = [
  'user_id', 'tier_id', 'current_syiling', 'total_syiling_earned', 'token_balance', 'xp', 'level', 'created_at', 'updated_at',
] as const

/**
 * `student_wallets` -> `wallets`. Token balance, xp and level have no .cloud column: 0, 0 and 1 (the column defaults).
 * A blank lifetime total is 0; a blank balance is INVALID_VALUE (the column is the money itself).
 * A tier that is set but unresolved never drops the wallet: it loads with `tier_id = null` (the caller counts it).
 */
export function transformWallet(row: Staged, refs: WalletRefs): Outcome<WalletValues> {
  if (refs.userId === undefined) return orphan('user_id')
  if (!refs.isStudent) return unsupported('user_id')
  const balance = boundedCount(row.syiling_balance)
  if (balance === null || balance === 'invalid') return invalid('syiling_balance')
  const lifetime = boundedCount(row.syiling_lifetime)
  if (lifetime === 'invalid') return invalid('syiling_lifetime')
  return ok({
    user_id: refs.userId,
    tier_id: refs.tierId ?? null,
    current_syiling: balance,
    total_syiling_earned: lifetime ?? 0,
    token_balance: 0,
    xp: 0,
    level: 1,
    ...stamps(row),
  })
}

// ---------------------------------------------------------------- coin ledger

export const LEDGER_TYPE_MAP = {
  earn: 'earn',
  spend: 'spend',
  convert: 'convert',
  bonus: 'bonus',
  refund: 'refund',
} as const

/**
 * `coin_transactions.source` -> the v2 ledger source key. `practice` is the value observed in the BE-35 fixture;
 * the other keys are the v2 source codes named in the data model (docs/architecture/v2-backend-deviations.md).
 * Extend only from the profile of the real dump (Perlu pengesahan).
 */
export const LEDGER_SOURCE_MAP = {
  practice: 'quiz_practice',
  quiz_practice: 'quiz_practice',
  quiz_spm: 'quiz_spm',
  quiz_pksk: 'quiz_pksk',
  daily_login: 'daily_login',
  token_conversion: 'token_conversion',
  admin_award: 'admin_award',
} as const

const mapLedgerType = enumMapper('type', LEDGER_TYPE_MAP)
const mapLedgerSource = enumMapper('source', LEDGER_SOURCE_MAP)

export interface LedgerRefs {
  userId: string | undefined
  isStudent: boolean
}

export interface LedgerValues {
  user_id: string
  type: string
  source: string
  source_id: null
  amount: number
  balance_after: number
  description: string
  created_at: string
}

export const LEDGER_COLUMNS = ['user_id', 'type', 'source', 'source_id', 'amount', 'balance_after', 'description', 'created_at'] as const

/** `ck_coin_ledger_amount_sign`: earn / bonus / refund add syiling (>= 0), spend / convert remove it (<= 0). */
export function ledgerSignOk(type: string, amount: number): boolean {
  if (type === 'earn' || type === 'bonus' || type === 'refund') return amount >= 0
  if (type === 'spend' || type === 'convert') return amount <= 0
  return false
}

export function transformLedger(row: Staged, refs: LedgerRefs): Outcome<LedgerValues> {
  if (refs.userId === undefined) return orphan('user_id')
  if (!refs.isStudent) return unsupported('user_id')
  const type = mapLedgerType(row.type)
  if (!type.ok) return type
  const source = mapLedgerSource(row.source)
  if (!source.ok) return source
  const amount = signedInt(row.amount)
  if (amount === null || amount === 'invalid') return invalid('amount')
  const after = signedInt(row.balance_after)
  if (after === null || after === 'invalid') return invalid('balance_after')
  if (type.value === null || source.value === null) return invalid('type')
  // Never flip a sign: a row that contradicts its own type is rejected and reported.
  if (!ledgerSignOk(type.value, amount)) return invalid('amount')
  return ok({
    user_id: refs.userId,
    type: type.value,
    source: source.value,
    source_id: null,
    amount,
    balance_after: after,
    // .cloud has no description; the v2 column is NOT NULL and holds no free text of the source.
    description: '',
    created_at: stamps(row).created_at,
  })
}

// ---------------------------------------------------------------- wallet vs ledger drift

export interface WalletDriftInput {
  /** The wallet's `current_syiling` (as migrated). */
  current: number
  /** SUM(amount) of the user's migrated ledger rows; null = the user has no ledger rows. */
  ledgerSum: number | null
  /** `balance_after` of the user's latest ledger row; null = no ledger rows. */
  lastBalance: number | null
}

export type WalletDriftKind = 'sum' | 'last_balance'

/**
 * Which independent counters disagree with the wallet. Nothing is corrected: the caller reports the user id.
 * A wallet with a balance but no ledger row at all counts as a `sum` mismatch (the ledger explains none of it).
 */
export function walletDriftKinds(input: WalletDriftInput): WalletDriftKind[] {
  const out: WalletDriftKind[] = []
  if ((input.ledgerSum ?? 0) !== input.current) out.push('sum')
  if (input.lastBalance !== null && input.lastBalance !== input.current) out.push('last_balance')
  return out
}
