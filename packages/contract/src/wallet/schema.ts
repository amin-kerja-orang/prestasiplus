import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'

/**
 * M14 wallet, ledger and streak read model (BE-11).
 *
 * The frontend mock (`src/modules/m14-gamification`, wire types `api/types.ts`) is the wire spec.
 * Differences from the mock: ids are decimal-string `Id`s (D53 UD-1), where the mock has numbers
 * (`userId`, ledger `id`). Everything else keeps the mock's field names.
 *
 * Reusable by BE-23 (dashboard, convert, tier CRUD, challenges...): `WalletTierRef`,
 * `WalletLedgerEntry`, `WalletStreakSummary`, `WalletSummary`.
 */

/** Ledger row types (SRS M14 DATA-M14-02). Amounts are signed: + earn/bonus/refund, - spend/convert. */
export const WALLET_LEDGER_TYPES = ['earn', 'spend', 'convert', 'bonus', 'refund'] as const
export const WalletLedgerTypeSchema = z.enum(WALLET_LEDGER_TYPES).meta({ id: 'WalletLedgerType' })
export type WalletLedgerType = z.infer<typeof WalletLedgerTypeSchema>

/**
 * Module codes the wallet owner raises when a debit is refused (mock `M14Error`). No route of this
 * card returns it (the three reads answer 401 only); BE-23 routes (convert, shop) and the wallet
 * service use it. Refusals answer 409 and write nothing.
 */
export const WALLET_ERROR_CODES = ['INSUFFICIENT_BALANCE'] as const
export const WalletErrorCodeSchema = z.enum(WALLET_ERROR_CODES).meta({ id: 'WalletErrorCode' })
export type WalletErrorCode = z.infer<typeof WalletErrorCodeSchema>

/** Exact HTTP status and BM messages (syiling debit and token debit) per module code. */
export const WALLET_ERRORS = {
  INSUFFICIENT_BALANCE: {
    status: 409,
    messages: ['Baki syiling tidak mencukupi.', 'Baki token tidak mencukupi.'],
  },
} as const satisfies Record<WalletErrorCode, { status: number; messages: readonly string[] }>

/**
 * Tier reference (mock `TierView`): the read model of the `tiers` table that BE-11 owns (a wallet
 * carries its tier). `key` is the tier name; admin can add tiers (BE-23), so it is not an enum.
 * Admin tier CRUD is BE-23.
 */
export const WalletTierRefSchema = z
  .strictObject({
    key: z.string().min(1),
    labelMs: z.string().min(1),
    icon: z.string(),
    color: z.string().min(1),
    minSyiling: z.number().int().min(0),
    conversionRate: z.number().int().min(0),
  })
  .meta({ id: 'WalletTierRef' })
export type WalletTierRef = z.infer<typeof WalletTierRefSchema>

/** The next tier above the current one, with progress (BR-M14-06: `pct` has 1 decimal, capped at 100). */
export const WalletNextTierSchema = WalletTierRefSchema.extend({
  pct: z.number().min(0).max(100),
  need: z.number().int().min(0),
}).meta({ id: 'WalletNextTier' })
export type WalletNextTier = z.infer<typeof WalletNextTierSchema>

/** Title (gelaran) of a lifetime total (BR-M14-09). `emoji` is an empty string for the unobserved ones. */
export const WalletTitleSchema = z
  .strictObject({ name: z.string().min(1), emoji: z.string() })
  .meta({ id: 'WalletTitle' })
export type WalletTitle = z.infer<typeof WalletTitleSchema>

export const WalletNextTitleSchema = WalletTitleSchema.extend({
  threshold: z.number().int().min(0),
  need: z.number().int().min(0),
}).meta({ id: 'WalletNextTitle' })
export type WalletNextTitle = z.infer<typeof WalletNextTitleSchema>

/**
 * Streak summary (mock `streak`): by Malaysia day (BR-M14-14). `multiplier` is fixed at 1
 * (BR-M14-15, the only observed step). A user without a streak row reads 0 / 0 / 1.
 */
export const WalletStreakSummarySchema = z
  .strictObject({
    current: z.number().int().min(0),
    best: z.number().int().min(0),
    multiplier: z.number().min(0),
  })
  .meta({ id: 'WalletStreakSummary' })
export type WalletStreakSummary = z.infer<typeof WalletStreakSummarySchema>

/**
 * `GET /api/gamification/wallet` data (mock `GamificationWallet`). A user without a wallet row reads
 * the BR-M14-02 defaults (no row is created by a read). `tokenBalance` has no lower bound: seed data
 * may hold a negative balance (DV-M14-10).
 */
export const WalletSummarySchema = z
  .strictObject({
    userId: IdSchema,
    currentSyiling: z.number().int().min(0),
    totalSyilingEarned: z.number().int().min(0),
    tokenBalance: z.number().int(),
    xp: z.number().int().min(0),
    level: z.number().int().min(1),
    xpNeeded: z.number().int().min(1),
    levelProgressPct: z.number().int().min(0).max(100),
    tier: WalletTierRefSchema,
    nextTier: WalletNextTierSchema.nullable().meta({ description: 'null at the highest active tier.' }),
    title: WalletTitleSchema,
    nextTitle: WalletNextTitleSchema.nullable().meta({ description: 'null after the last title.' }),
    earnedToday: z.number().int().min(0),
    earnedThisWeek: z.number().int().min(0),
    streak: WalletStreakSummarySchema,
  })
  .meta({ id: 'WalletSummary' })
export type WalletSummary = z.infer<typeof WalletSummarySchema>

/**
 * A row of the signed-in user's ledger (mock `LedgerEntry`, also `recent` of the dashboard).
 * `source` is a free module string (for example quiz_practice, quiz_spm, daily_login,
 * token_conversion, referral, admin_award); it is not an enum because other cards add sources.
 * The internal idempotency key `(source, source_id)` and `legacy_*` columns are not on the wire.
 */
export const WalletLedgerEntrySchema = z
  .strictObject({
    id: IdSchema,
    type: WalletLedgerTypeSchema,
    amount: z.number().int().meta({ description: 'Signed: positive for earn/bonus/refund, negative for spend/convert.' }),
    balanceAfter: z.number().int().min(0).meta({ description: 'Syiling balance after this movement.' }),
    source: z.string().min(1),
    description: z.string(),
    createdAt: TimestampSchema,
  })
  .meta({ id: 'WalletLedgerEntry' })
export type WalletLedgerEntry = z.infer<typeof WalletLedgerEntrySchema>

/**
 * Query of `GET /api/gamification/transactions`. `type` is optional; an empty value means all; any
 * value outside `WalletLedgerType` is not an error and returns zero rows (FR-M14-08). The route is
 * NOT paginated in the mock (OQ-API-B4-2: keep as coded).
 */
export const WalletTransactionsQuerySchema = z
  .object({
    type: z.string().optional().meta({ description: 'earn | spend | convert | bonus | refund. Empty = all; anything else = no rows.' }),
  })
  .meta({ id: 'WalletTransactionsQuery' })
export type WalletTransactionsQuery = z.infer<typeof WalletTransactionsQuerySchema>

/** `meta` of the transactions list: NOT `ListMeta` (no page keys). `type` echoes the query ('' when absent). */
export const WalletTransactionsMetaSchema = z
  .strictObject({ currentSyiling: z.number().int().min(0), type: z.string() })
  .meta({ id: 'WalletTransactionsMeta' })
export type WalletTransactionsMeta = z.infer<typeof WalletTransactionsMetaSchema>

/** Body of `GET /api/gamification/transactions`: every row, newest first. */
export const WalletTransactionsResponseSchema = z
  .strictObject({ data: z.array(WalletLedgerEntrySchema), meta: WalletTransactionsMetaSchema })
  .meta({ id: 'WalletTransactionsResponse' })
export type WalletTransactionsResponse = z.infer<typeof WalletTransactionsResponseSchema>

/**
 * `GET /api/me/gamification-summary` data (app shell chips): coins = currentSyiling, points = xp,
 * streakDays = streak.current. A user without wallet or streak rows reads 0 / 0 / 0.
 */
export const WalletGamificationSummarySchema = z
  .strictObject({
    coins: z.number().int().min(0),
    points: z.number().int().min(0),
    streakDays: z.number().int().min(0),
  })
  .meta({ id: 'WalletGamificationSummary' })
export type WalletGamificationSummary = z.infer<typeof WalletGamificationSummarySchema>
