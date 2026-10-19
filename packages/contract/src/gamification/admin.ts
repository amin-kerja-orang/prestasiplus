import { z } from '../zod'
import { ListMetaSchema } from '../common/envelope'
import { DateOnlySchema, TimestampSchema } from '../common/time'
import { IdSchema } from '../common/ids'
import {
  GamificationChallengeTypeSchema,
  GamificationDifficultySchema,
  GamificationLedgerKindSchema,
  GAMIFICATION_AWARD_MAX,
} from './schema'
import { count, int, nonBlank } from './shared'

/**
 * M14 gamification, admin side (BE-23): economy (overview, tiers, challenges, students, award,
 * transactions) and operations (settings, reward control, lucky draws). Role `admin` only.
 * The 7 teacher-economy routes (`/admin/gamification/guru*`) are not in B1 and have no schema.
 *
 * Request bodies describe the canonical JSON form. The mock also tolerates numeric strings and
 * "on"/"1" booleans (multipart forms of the live pages); that is a transport tolerance listed in
 * the BE-23 report, not part of the schemas.
 */

const FIELD = (description: string) => ({ description })

// ---------------------------------------------------------------------------------------------
// Overview (S1)
// ---------------------------------------------------------------------------------------------

export const GamificationAdminOverviewSchema = z
  .object({
    cards: z.object({
      activeStudents: count,
      syilingGenerated: count,
      tokensConverted: count,
      conversions: count,
      activeChallenges: count,
      completedToday: count,
    }),
    tierDistribution: z
      .array(
        z.object({
          key: z.string(),
          count,
          pct: count.meta(FIELD('Rounded integer label.')),
          widthPct: z.number().min(0).meta(FIELD('Bar width, 2 decimals.')),
          color: z.string(),
        }),
      )
      .meta(FIELD('By tier key ascending.')),
    top10: z.array(
      z.object({
        rank: z.number().int().min(1).max(10),
        name: z.string(),
        tierKey: z.string(),
        level: z.number().int().min(1),
        totalSyilingEarned: count,
      }),
    ),
    recent: z
      .array(
        z.object({
          name: z.string(),
          type: GamificationLedgerKindSchema,
          amount: int,
          source: z.string(),
          createdAt: TimestampSchema,
        }),
      )
      .max(10),
  })
  .meta({ id: 'GamificationAdminOverview' })
export type GamificationAdminOverview = z.infer<typeof GamificationAdminOverviewSchema>

// ---------------------------------------------------------------------------------------------
// Tiers (S2)
// ---------------------------------------------------------------------------------------------

/** A tier of the admin list (inactive tiers included). */
export const GamificationAdminTierSchema = z
  .object({
    id: IdSchema,
    tierName: z.string().min(1).meta(FIELD('Unique key, lower-case; cannot change.')),
    labelMs: z.string(),
    icon: z.string(),
    color: z.string(),
    minSyiling: count,
    conversionRate: z.number().int().min(1),
    sortOrder: count,
    perks: z.array(z.string()),
    quizRewardL1: count,
    quizRewardL2: count,
    quizRewardL3: count,
    quizRewardL4: count,
    quizRewardL5: count,
    pkskRewardCorrect: count,
    boardGameRewardCorrect: count,
    boardGameRewardWin: count,
    isActive: z.boolean(),
  })
  .meta({ id: 'GamificationAdminTier' })
export type GamificationAdminTier = z.infer<typeof GamificationAdminTierSchema>

/** Default colour of a new tier when `color` is absent. */
export const GAMIFICATION_DEFAULT_TIER_COLOR = '#3b82f6'

const tierInputShape = {
  labelMs: nonBlank(60),
  icon: nonBlank(16),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().meta(FIELD('#rrggbb; a new tier defaults to #3b82f6.')),
  minSyiling: count,
  conversionRate: z.number().int().min(1),
  sortOrder: count,
  quizRewardL1: count,
  quizRewardL2: count,
  quizRewardL3: count,
  quizRewardL4: count,
  quizRewardL5: count,
  pkskRewardCorrect: count,
  boardGameRewardCorrect: count,
  boardGameRewardWin: count,
  perks: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .meta(FIELD('A list, a JSON-array text or one text. Absent keeps the stored list (create: empty list).')),
}

/** `PUT /admin/gamification/tiers/{id}` body. `tierName` is not accepted for change (extra keys are ignored). */
export const GamificationAdminTierUpdateSchema = z
  .object(tierInputShape)
  .meta({ id: 'GamificationAdminTierUpdate' })
export type GamificationAdminTierUpdate = z.infer<typeof GamificationAdminTierUpdateSchema>

/** `POST /admin/gamification/tiers` body: the update fields plus the unique `tierName` (stored lower-case). */
export const GamificationAdminTierCreateSchema = z
  .object({ tierName: z.string().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/), ...tierInputShape })
  .meta({ id: 'GamificationAdminTierCreate' })
export type GamificationAdminTierCreate = z.infer<typeof GamificationAdminTierCreateSchema>

/** `{ data }` of the two toggle routes. */
export const GamificationToggleResultSchema = z
  .object({ isActive: z.boolean() })
  .meta({ id: 'GamificationToggleResult' })
export type GamificationToggleResult = z.infer<typeof GamificationToggleResultSchema>

// ---------------------------------------------------------------------------------------------
// Challenges (S3)
// ---------------------------------------------------------------------------------------------

/** A challenge of the admin list (the internal `metric` is never exposed). */
export const GamificationAdminChallengeSchema = z
  .object({
    id: IdSchema,
    title: z.string(),
    description: z.string(),
    icon: z.string(),
    challengeType: GamificationChallengeTypeSchema,
    targetValue: z.number().int().min(1),
    rewardSyiling: count,
    rewardXp: count,
    difficulty: GamificationDifficultySchema,
    sortOrder: count,
    isActive: z.boolean(),
  })
  .meta({ id: 'GamificationAdminChallenge' })
export type GamificationAdminChallenge = z.infer<typeof GamificationAdminChallengeSchema>

/** Body of create (201, `isActive` true) and update (full replace): every field is required. */
export const GamificationAdminChallengeInputSchema = z
  .object({
    title: nonBlank(120),
    description: nonBlank(255),
    icon: nonBlank(16),
    challengeType: GamificationChallengeTypeSchema,
    targetValue: z.number().int().min(1),
    rewardSyiling: count,
    rewardXp: count,
    difficulty: GamificationDifficultySchema,
    sortOrder: count,
  })
  .meta({ id: 'GamificationAdminChallengeInput' })
export type GamificationAdminChallengeInput = z.infer<typeof GamificationAdminChallengeInputSchema>

/** `{ data }` of `DELETE /admin/gamification/challenges/{id}` (status 200, not 204). */
export const GamificationDeleteResultSchema = z
  .object({ deleted: z.literal(1) })
  .meta({ id: 'GamificationDeleteResult' })
export type GamificationDeleteResult = z.infer<typeof GamificationDeleteResultSchema>

// ---------------------------------------------------------------------------------------------
// Students and award (S4), transactions (S5)
// ---------------------------------------------------------------------------------------------

export const GAMIFICATION_STUDENT_SORTS = ['total_syiling_earned', 'current_syiling', 'token_balance', 'level'] as const

/** Query of `GET /admin/gamification/students`; the page size is fixed at 20 (`pageSize` is ignored). */
export const GamificationAdminStudentsQuerySchema = z
  .object({
    search: z.string().optional().meta(FIELD('Name or e-mail contains.')),
    tier: z.string().optional().meta(FIELD('Tier key.')),
    sort: z.string().optional().meta(FIELD(`One of ${GAMIFICATION_STUDENT_SORTS.join(', ')}; any other value is ignored.`)),
    page: z.coerce.number().int().min(1).optional().meta(FIELD('An invalid page reads as 1; an out-of-range page is an empty list.')),
  })
  .meta({ id: 'GamificationAdminStudentsQuery' })
export type GamificationAdminStudentsQuery = z.infer<typeof GamificationAdminStudentsQuerySchema>

export const GamificationAdminStudentRowSchema = z
  .object({
    userId: IdSchema,
    name: z.string(),
    email: z.string(),
    tierKey: z.string(),
    tierColor: z.string(),
    level: z.number().int().min(1),
    currentSyiling: count,
    tokenBalance: count,
    totalSyilingEarned: count,
    xp: count,
  })
  .meta({ id: 'GamificationAdminStudentRow' })
export type GamificationAdminStudentRow = z.infer<typeof GamificationAdminStudentRowSchema>

export const GamificationAdminStudentsResponseSchema = z
  .object({ data: z.array(GamificationAdminStudentRowSchema), meta: ListMetaSchema })
  .meta({ id: 'GamificationAdminStudentsResponse' })

/** `POST /admin/gamification/award` body: creates a `bonus` / `admin_award` ledger row. */
export const GamificationAdminAwardRequestSchema = z
  .object({
    userId: IdSchema,
    amount: z.number().int().min(1).max(GAMIFICATION_AWARD_MAX),
    reason: nonBlank(255).meta(FIELD('Stored as the ledger description.')),
  })
  .meta({ id: 'GamificationAdminAwardRequest' })
export type GamificationAdminAwardRequest = z.infer<typeof GamificationAdminAwardRequestSchema>

export const GamificationAdminAwardResultSchema = z
  .object({ userId: IdSchema, currentSyiling: count, transactionId: IdSchema })
  .meta({ id: 'GamificationAdminAwardResult' })
export type GamificationAdminAwardResult = z.infer<typeof GamificationAdminAwardResultSchema>

/** Query of `GET /admin/gamification/transactions`; the page size is fixed at 25, newest first. */
export const GamificationAdminTransactionsQuerySchema = z
  .object({
    type: z.string().optional().meta(FIELD('earn | spend | convert | bonus | refund; any other value gives an empty result.')),
    dateFrom: z.string().optional().meta(FIELD('YYYY-MM-DD, inclusive; a malformed value is ignored.')),
    dateTo: z.string().optional().meta(FIELD('YYYY-MM-DD, inclusive; a malformed value is ignored.')),
    page: z.coerce.number().int().min(1).optional().meta(FIELD('An invalid page reads as 1.')),
  })
  .meta({ id: 'GamificationAdminTransactionsQuery' })
export type GamificationAdminTransactionsQuery = z.infer<typeof GamificationAdminTransactionsQuerySchema>

export const GamificationAdminTransactionRowSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    name: z.string(),
    type: GamificationLedgerKindSchema,
    amount: int,
    balanceAfter: count,
    source: z.string(),
    description: z.string(),
    createdAt: TimestampSchema,
  })
  .meta({ id: 'GamificationAdminTransactionRow' })
export type GamificationAdminTransactionRow = z.infer<typeof GamificationAdminTransactionRowSchema>

export const GamificationAdminTransactionsResponseSchema = z
  .object({ data: z.array(GamificationAdminTransactionRowSchema), meta: ListMetaSchema })
  .meta({ id: 'GamificationAdminTransactionsResponse' })

// ---------------------------------------------------------------------------------------------
// Settings (S9)
// ---------------------------------------------------------------------------------------------

/** The ten setting keys, in the S9 order. */
export const GAMIFICATION_SETTING_KEYS = [
  'coins_per_question',
  'cash_rate_coins',
  'cash_rate_sen',
  'min_cash_withdrawal',
  'cash_withdrawal_enabled',
  'reward_budget_sen_session',
  'reward_budget_sen_month',
  'current_session_year',
  'flat_quiz_reward',
  'games_award_syiling',
] as const
export const GamificationSettingKeySchema = z
  .enum(GAMIFICATION_SETTING_KEYS)
  .meta({ id: 'GamificationSettingKey' })
export type GamificationSettingKey = z.infer<typeof GamificationSettingKeySchema>

/** Keys shown as an Aktif / Tidak Aktif select (`kind: 'toggle'`, value 0 or 1). */
export const GAMIFICATION_TOGGLE_SETTING_KEYS = ['cash_withdrawal_enabled', 'games_award_syiling'] as const

export const GamificationSettingSchema = z
  .object({
    key: GamificationSettingKeySchema,
    label: z.string(),
    value: count,
    kind: z.enum(['number', 'toggle']),
  })
  .meta({ id: 'GamificationSetting' })
export type GamificationSetting = z.infer<typeof GamificationSettingSchema>

/** `{ data }` of the list and of the save: always all ten rows. */
export const GamificationSettingsListSchema = z
  .array(GamificationSettingSchema)
  .meta({ id: 'GamificationSettingsList' })

/**
 * `PUT /admin/gamification/settings` body: only the posted keys change. A key must exist and the
 * value must be an integer >= 0 (a toggle: 0 or 1); otherwise 422 with `fields.settings`.
 */
export const GamificationSettingsUpdateRequestSchema = z
  .object({
    settings: z
      .array(z.object({ key: z.string().min(1), value: int.min(0) }))
      .min(1),
  })
  .meta({ id: 'GamificationSettingsUpdateRequest' })
export type GamificationSettingsUpdateRequest = z.infer<typeof GamificationSettingsUpdateRequestSchema>

/** The five settings S9 and S10 share, with camelCase names. */
export const GamificationEconomySettingsSchema = z
  .object({
    rewardBudgetSenSession: count,
    rewardBudgetSenMonth: count,
    flatQuizReward: count,
    currentSessionYear: count,
    gamesAwardSyiling: count,
  })
  .meta({ id: 'GamificationEconomySettings' })
export type GamificationEconomySettings = z.infer<typeof GamificationEconomySettingsSchema>

/**
 * `PUT /admin/reward-control/settings` body: any non-empty subset of the five keys.
 * The mock also accepts the snake_case names (`reward_budget_sen_session`, ...); not part of this schema.
 */
export const GamificationEconomySettingsUpdateSchema = GamificationEconomySettingsSchema.partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'At least one setting is required.',
  })
  .meta({ id: 'GamificationEconomySettingsUpdate' })
export type GamificationEconomySettingsUpdate = z.infer<typeof GamificationEconomySettingsUpdateSchema>

// ---------------------------------------------------------------------------------------------
// Reward control (S10) and lucky draws
// ---------------------------------------------------------------------------------------------

export const GAMIFICATION_SYILING_REWARD_TYPES = ['VOUCHER', 'PHYSICAL', 'EXPERIENCE', 'DIGITAL', 'SUBSCRIPTION'] as const

/** A syiling-priced reward of the Kawalan Reward screen. `costRm` = `costValueSen / 100` (RM number). */
export const GamificationSyilingRewardSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    type: z.enum(GAMIFICATION_SYILING_REWARD_TYPES),
    priceSyiling: count,
    costValueSen: count.meta(FIELD('Integer sen.')),
    costRm: z.number().min(0),
  })
  .meta({ id: 'GamificationSyilingReward' })
export type GamificationSyilingReward = z.infer<typeof GamificationSyilingRewardSchema>

/** `PUT /admin/reward-control/rewards/{id}/cost` body. */
export const GamificationRewardCostRequestSchema = z
  .object({ costValueSen: count })
  .meta({ id: 'GamificationRewardCostRequest' })
export type GamificationRewardCostRequest = z.infer<typeof GamificationRewardCostRequestSchema>

/** One prize line of a draw (response form). `valueSen` is integer sen. */
export const GamificationDrawPrizeSchema = z
  .object({ label: z.string(), valueSen: int, qty: int })
  .meta({ id: 'GamificationDrawPrize' })
export type GamificationDrawPrize = z.infer<typeof GamificationDrawPrizeSchema>

/** One prize line in a create body: `valueSen` or its snake_case twin `value_sen` must be present. */
export const GamificationDrawPrizeInputSchema = z
  .object({
    label: z.string(),
    valueSen: int.optional(),
    value_sen: int.optional().meta(FIELD('Alias of valueSen (the live form posts this name).')),
    qty: int,
  })
  .refine((p) => p.valueSen !== undefined || p.value_sen !== undefined, {
    message: 'valueSen is required.',
  })
  .meta({ id: 'GamificationDrawPrizeInput' })
export type GamificationDrawPrizeInput = z.infer<typeof GamificationDrawPrizeInputSchema>

export const GAMIFICATION_DRAW_STATUSES = ['draft', 'open', 'closed'] as const
export const GamificationDrawStatusSchema = z
  .enum(GAMIFICATION_DRAW_STATUSES)
  .meta({ id: 'GamificationDrawStatus' })
export type GamificationDrawStatus = z.infer<typeof GamificationDrawStatusSchema>

/** A lucky draw (Cabutan Bertuah) as the admin sees it, newest first in the reward-control list. */
export const GamificationDrawSchema = z
  .object({
    id: IdSchema,
    title: z.string(),
    description: z.string(),
    ticketCostSyiling: count,
    maxTicketsPerStudent: z.number().int().min(1),
    prizePool: z.array(GamificationDrawPrizeSchema),
    closesAt: DateOnlySchema.nullable(),
    status: GamificationDrawStatusSchema,
    createdAt: TimestampSchema,
    ticketsSold: count,
  })
  .meta({ id: 'GamificationDraw' })
export type GamificationDraw = z.infer<typeof GamificationDrawSchema>

/**
 * `POST /admin/reward-control/draws` body. `status` of the result is `open` when `openNow` is true,
 * else `draft`. `prizePool` is an array of lines or the JSON text of `[{label, value_sen, qty}]`
 * (the live form); anything else is 422 "Format JSON kolam hadiah tidak sah." with `fields.prizePool`.
 */
export const GamificationDrawCreateRequestSchema = z
  .object({
    title: nonBlank(150),
    description: z.string().max(1000).optional(),
    ticketCostSyiling: z.number().int().min(1),
    maxTicketsPerStudent: z.number().int().min(1),
    closesAt: DateOnlySchema.optional().meta(FIELD('YYYY-MM-DD, a real calendar date.')),
    openNow: z.boolean().optional().meta(FIELD('"Buka serta-merta": create as open instead of draft.')),
    prizePool: z.union([z.array(GamificationDrawPrizeInputSchema), z.string()]).optional(),
  })
  .meta({ id: 'GamificationDrawCreateRequest' })
export type GamificationDrawCreateRequest = z.infer<typeof GamificationDrawCreateRequestSchema>

/** `GET /admin/reward-control` data. */
export const GamificationRewardControlSchema = z
  .object({
    tiles: z.object({
      sessionYear: count,
      liabilityRm: z.number().min(0).meta(FIELD('Sum of costValueSen of the claims in the session year / 100.')),
      students: count,
      claims: count,
    }),
    settings: GamificationEconomySettingsSchema,
    rewards: z.array(GamificationSyilingRewardSchema),
    draws: z.array(GamificationDrawSchema),
  })
  .meta({ id: 'GamificationRewardControl' })
export type GamificationRewardControl = z.infer<typeof GamificationRewardControlSchema>
