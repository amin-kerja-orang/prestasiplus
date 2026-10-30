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
 * `coin_transactions.source` -> the v2 ledger source key. v2 `coin_ledger.source` is free text (1 to 100 characters,
 * `ck_coin_ledger_source`), so a .cloud value is kept as it is unless BE-11 writes another name for the same event.
 *  - `practice` is the value of the BE-35 fixture; BE-11 writes `quiz_practice`.
 *  - `quiz_spm`, `quiz_pksk`, `daily_login`, `token_conversion`, `admin_award` are the BE-11 names (`practiceRewardSource`).
 *  - `daily_challenge` (challenge completion), `mystery_box` and `hadiah_redeem` (shop `SOURCES`) are the names
 *    BE-11 / the shop write for the same event: identical to .cloud.
 *  - `spm` (first SPM session of the day, +7), `streak_bonus` (historical kombo bonus) and `reward_claim` (legacy
 *    syiling reward claim, spend) are the M14 URS values (FN-M14-8.1.4, 8.1.5, 8.3.6): history only, BE-11 writes no
 *    new row of these, so the .cloud value is kept as is.
 *  - A1-FIX (LEAD decision, A1 reject analysis): the codes of the anonymised A1 dump are mapped. v2 has no source enum
 *    (free text; `ck_coin_ledger_source` is a length check), so no enum value and no migration is added. Four codes are
 *    aliases of the name v2 writes for the same event: `token_convert` and `tukar_token` (`tukar-token`) are
 *    `token_conversion`, `cabaran_harian` (`cabaran-harian`) is `daily_challenge`, `kotak_misteri` (`kotak-misteri`) is
 *    `mystery_box` (keys are `enumKey` forms: a dash becomes `_`). The game codes v2 itself writes (`papan_bijak`,
 *    `benteng_*`, `perang_fakta_win`, `mathrace_play`, `jutawan_ilmu`, `betul_salah`) and the M14-listed history codes
 *    (`quiz_complete`, `structured_question`) are kept. The rest have no v2 writer (retired activities): their history
 *    keeps the .cloud value as it is (like `spm` and `streak_bonus`), so nothing is collapsed into a generic `legacy`
 *    value and no ledger amount changes. The sign of a row is still decided by its type (debit-only sources: see below).
 * An unlisted source stays UNKNOWN_ENUM.
 */
export const LEDGER_SOURCE_MAP = {
  practice: 'quiz_practice',
  quiz_practice: 'quiz_practice',
  quiz_spm: 'quiz_spm',
  quiz_pksk: 'quiz_pksk',
  daily_login: 'daily_login',
  token_conversion: 'token_conversion',
  admin_award: 'admin_award',
  daily_challenge: 'daily_challenge',
  spm: 'spm',
  streak_bonus: 'streak_bonus',
  reward_claim: 'reward_claim',
  mystery_box: 'mystery_box',
  hadiah_redeem: 'hadiah_redeem',
  // ---- A1-FIX: aliases of the v2 name for the same event
  token_convert: 'token_conversion',
  tukar_token: 'token_conversion',
  cabaran_harian: 'daily_challenge',
  kotak_misteri: 'mystery_box',
  // ---- A1-FIX: names v2 writes for the game rewards, kept
  jutawan_ilmu: 'jutawan_ilmu',
  papan_bijak: 'papan_bijak',
  papan_bijak_win: 'papan_bijak_win',
  betul_salah: 'betul_salah',
  perang_fakta_win: 'perang_fakta_win',
  mathrace_play: 'mathrace_play',
  benteng_play: 'benteng_play',
  benteng_win: 'benteng_win',
  // ---- A1-FIX: names listed by M14 (history), kept
  quiz_complete: 'quiz_complete',
  structured_question: 'structured_question',
  // ---- A1-FIX: retired activities with no v2 writer: history keeps the .cloud value
  latihan: 'latihan',
  memory_game: 'memory_game',
  daily_spin: 'daily_spin',
  perang_fakta_play: 'perang_fakta_play',
  remedial_quiz: 'remedial_quiz',
  quiz: 'quiz',
  mathrace_win: 'mathrace_win',
  susun_jawapan: 'susun_jawapan',
  crossword_play: 'crossword_play',
  crossword_win: 'crossword_win',
  homework_chapter: 'homework_chapter',
  sambung_kata: 'sambung_kata',
  notes_mastery: 'notes_mastery',
  tembak_jawapan: 'tembak_jawapan',
  speed_challenge: 'speed_challenge',
  kuizrelay_play: 'kuizrelay_play',
  data_sync: 'data_sync',
} as const

/**
 * Sources that only ever remove syiling (never a positive amount, except a refund): M14 URS FN-M14-8.3.6 "Tuntut"
 * spend row and DV-M14-12 "Tukar N syiling" convert rows. `hadiah_redeem` is not listed: it is a token movement and the URS gives no syiling sign
 * for its ledger row, so only its type decides (Perlu pengesahan, OD-2); the earning sources are decided by their type.
 */
const DEBIT_ONLY_SOURCES: ReadonlySet<string> = new Set(['reward_claim', 'token_conversion'])

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

/**
 * The source decides the direction for the two debit-only sources: they must not add syiling, whatever the type says
 * (a refund of an earlier claim carries the original source, so a `refund` is decided by its type alone). Any other
 * source is decided by its type (`ledgerSignOk`): the URS names no row of an earning source with a debit.
 */
export function ledgerSourceSignOk(source: string, type: string, amount: number): boolean {
  if (type === 'refund' || !DEBIT_ONLY_SOURCES.has(source)) return true
  return amount <= 0
}

export function transformLedger(row: Staged, refs: LedgerRefs): Outcome<LedgerValues> {
  if (refs.userId === undefined) return orphan('user_id')
  if (!refs.isStudent) return unsupported('user_id')
  const type = mapLedgerType(row.type)
  if (!type.ok) return type
  const source = mapLedgerSource(row.source)
  if (!source.ok) return source
  const amount = signedInt(row.amount)
  // A blank or unparseable amount gets its own column label (D6, 29 Oct): `amount` is kept for the contradicting sign below,
  // the one ledger reject the cutover smoke check classes as expected (docs/ops/sql/smoke-readonly.sql X4.*).
  if (amount === null || amount === 'invalid') return invalid('amount_unparseable')
  const after = signedInt(row.balance_after)
  if (after === null || after === 'invalid' || after < 0) return invalid('balance_after')
  if (type.value === null || source.value === null) return invalid('type')
  // Never flip a sign: a row that contradicts its own type is rejected and reported.
  if (!ledgerSignOk(type.value, amount)) return invalid('amount')
  if (!ledgerSourceSignOk(source.value, type.value, amount)) return invalid('amount')
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
