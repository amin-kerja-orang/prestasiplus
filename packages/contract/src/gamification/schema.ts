import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { count, int } from './shared'

/**
 * M14 gamification, student side (BE-23): dashboard, convert, challenges, leaderboard,
 * achievements, share cards, referral.
 *
 * The frontend mock (`src/modules/m14-gamification`) is the wire spec. Ids are opaque strings
 * (`Id`) where the mock uses integers; counts, balances, levels and percentages stay integers.
 * The wallet core (`GET /gamification/wallet`, `GET /gamification/transactions`,
 * `GET /me/gamification-summary`) belongs to BE-11 and is not defined here; the dashboard embeds
 * the same figures, so this folder carries local `GamificationDashboard...` twins of them.
 * Differences from the mock are listed in the BE-23 contract report.
 */

/** Messages the M14 student/admin routes raise (exact BM copy; generic codes are in `ErrorCode`). */
export const GAMIFICATION_MESSAGES = {
  amountInvalid: 'Jumlah syiling tidak sah.',
  userNotFound: 'Pengguna tidak dijumpai.',
  tierNotFound: 'Tier tidak dijumpai.',
  tierExists: 'Nama tier sudah wujud.',
  challengeNotFound: 'Cabaran tidak dijumpai.',
  rewardNotFound: 'Hadiah tidak dijumpai.',
  prizePoolInvalid: 'Format JSON kolam hadiah tidak sah.',
  closeDateInvalid: 'Tarikh tutup tidak sah.',
  required: 'Medan ini diperlukan.',
  invalid: 'Medan ini tidak sah.',
  summary: 'Sila lengkapkan semua medan wajib.',
} as const

/** Largest amount one admin award may grant (`AWARD_MAX`). */
export const GAMIFICATION_AWARD_MAX = 10_000

/** Referral rewards in syiling (mock constants `REFERRAL_REWARD_REFERRER` / `_REFEREE`). */
export const GAMIFICATION_REFERRAL_REWARDS = { referrer: 50, referee: 25 } as const


// ---------------------------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------------------------

export const GAMIFICATION_LEDGER_KINDS = ['earn', 'spend', 'convert', 'bonus', 'refund'] as const
export const GamificationLedgerKindSchema = z
  .enum(GAMIFICATION_LEDGER_KINDS)
  .meta({ id: 'GamificationLedgerKind', description: 'Type of a syiling ledger row.' })
export type GamificationLedgerKind = z.infer<typeof GamificationLedgerKindSchema>

export const GAMIFICATION_DIFFICULTIES = ['easy', 'medium', 'hard'] as const
export const GamificationDifficultySchema = z
  .enum(GAMIFICATION_DIFFICULTIES)
  .meta({ id: 'GamificationDifficulty' })
export type GamificationDifficulty = z.infer<typeof GamificationDifficultySchema>

export const GAMIFICATION_CHALLENGE_TYPES = [
  'quiz_count',
  'accuracy',
  'topic_variety',
  'streak',
  'time_spent',
] as const
export const GamificationChallengeTypeSchema = z
  .enum(GAMIFICATION_CHALLENGE_TYPES)
  .meta({ id: 'GamificationChallengeType' })
export type GamificationChallengeType = z.infer<typeof GamificationChallengeTypeSchema>

export const GAMIFICATION_RARITIES = ['common', 'rare', 'epic', 'legendary'] as const
export const GamificationRaritySchema = z
  .enum(GAMIFICATION_RARITIES)
  .meta({ id: 'GamificationRarity' })
export type GamificationRarity = z.infer<typeof GamificationRaritySchema>

// ---------------------------------------------------------------------------------------------
// Dashboard and the shared wallet figures it embeds (local twins of the BE-11 shapes)
// ---------------------------------------------------------------------------------------------

/** A tier as the student sees it (`tier` / `nextTier` of the wallet figures). */
export const GamificationDashboardTierSchema = z
  .object({
    key: z.string().min(1).meta({ description: 'Tier key (the tier name, lower-case).' }),
    labelMs: z.string(),
    icon: z.string(),
    color: z.string(),
    minSyiling: count,
    conversionRate: z.number().int().min(1).meta({ description: 'Syiling per token.' }),
  })
  .meta({ id: 'GamificationDashboardTier' })
export type GamificationDashboardTier = z.infer<typeof GamificationDashboardTierSchema>

export const GamificationDashboardStreakSchema = z
  .object({ current: count, best: count, multiplier: z.number().min(0) })
  .meta({ id: 'GamificationDashboardStreak' })
export type GamificationDashboardStreak = z.infer<typeof GamificationDashboardStreakSchema>

/**
 * The wallet summary embedded in the dashboard. A user without a wallet row reads the defaults.
 * `nextTier` / `nextTitle` are `null` at the top of the ladder; `nextTier.pct` has 1 decimal.
 */
export const GamificationDashboardWalletSchema = z
  .object({
    userId: IdSchema,
    currentSyiling: count,
    totalSyilingEarned: count,
    tokenBalance: count,
    xp: count,
    level: z.number().int().min(1),
    xpNeeded: count,
    levelProgressPct: z.number().min(0),
    tier: GamificationDashboardTierSchema,
    nextTier: GamificationDashboardTierSchema.extend({ pct: z.number().min(0), need: count }).nullable(),
    title: z.object({ name: z.string(), emoji: z.string() }),
    nextTitle: z.object({ name: z.string(), emoji: z.string(), threshold: count, need: count }).nullable(),
    earnedToday: count,
    earnedThisWeek: count,
    streak: GamificationDashboardStreakSchema,
  })
  .meta({ id: 'GamificationDashboardWallet' })
export type GamificationDashboardWallet = z.infer<typeof GamificationDashboardWalletSchema>

/** A syiling ledger row (`recent` of the dashboard). `amount` is negative for a debit. */
export const GamificationDashboardEntrySchema = z
  .object({
    id: IdSchema,
    type: GamificationLedgerKindSchema,
    amount: int,
    balanceAfter: count,
    source: z.string(),
    description: z.string(),
    createdAt: TimestampSchema,
  })
  .meta({ id: 'GamificationDashboardEntry' })
export type GamificationDashboardEntry = z.infer<typeof GamificationDashboardEntrySchema>

/** A daily challenge with the caller's progress for the current Malaysia day. */
export const GamificationChallengeProgressSchema = z
  .object({
    id: IdSchema,
    icon: z.string(),
    title: z.string(),
    description: z.string(),
    difficulty: GamificationDifficultySchema,
    rewardSyiling: count,
    rewardXp: count,
    target: z.number().int().min(1),
    progress: count.meta({ description: 'Equals target when already completed today.' }),
    pct: count.meta({ description: 'Rounded integer percentage.' }),
    completed: z.boolean(),
  })
  .meta({ id: 'GamificationChallengeProgress' })
export type GamificationChallengeProgress = z.infer<typeof GamificationChallengeProgressSchema>

/** Subject mastery (read from the practice module); only subjects with at least one answer. */
export const GamificationMasteryRowSchema = z
  .object({
    subjectId: IdSchema,
    subjectName: z.string(),
    level: count,
    stage: z.string(),
    correct: count,
    nextTarget: count.nullable(),
    accuracy: z.number().min(0).meta({ description: 'Percentage, up to 2 decimals.' }),
    multiplier: z.number().min(0),
  })
  .meta({ id: 'GamificationMasteryRow' })
export type GamificationMasteryRow = z.infer<typeof GamificationMasteryRowSchema>

/** A tier of the grid (dashboard and convert views); `isMine` marks the caller's tier. */
export const GamificationTierGridItemSchema = GamificationDashboardTierSchema.extend({
  isMine: z.boolean(),
}).meta({ id: 'GamificationTierGridItem' })
export type GamificationTierGridItem = z.infer<typeof GamificationTierGridItemSchema>

/** `GET /gamification/dashboard` data: first 4 challenges, latest 6 ledger rows, active tiers by sortOrder. */
export const GamificationDashboardSchema = z
  .object({
    wallet: GamificationDashboardWalletSchema,
    challenges: z.array(GamificationChallengeProgressSchema).max(4),
    recent: z.array(GamificationDashboardEntrySchema).max(6),
    mastery: z.array(GamificationMasteryRowSchema),
    tiers: z.array(GamificationTierGridItemSchema),
  })
  .meta({ id: 'GamificationDashboard' })
export type GamificationDashboard = z.infer<typeof GamificationDashboardSchema>

// ---------------------------------------------------------------------------------------------
// Convert
// ---------------------------------------------------------------------------------------------

/** `GET /gamification/convert` data: the caller's tier rate and the quick amounts. */
export const GamificationConvertViewSchema = z
  .object({
    currentSyiling: count,
    tokenBalance: count,
    rate: z.number().int().min(1).meta({ description: 'Syiling per token of the caller tier.' }),
    tierLabel: z.string(),
    quick: z
      .tuple([int, int, int])
      .meta({ description: '[rate, 5 x rate, currentSyiling].' }),
    tiers: z.array(GamificationTierGridItemSchema),
  })
  .meta({ id: 'GamificationConvertView' })
export type GamificationConvertView = z.infer<typeof GamificationConvertViewSchema>

/**
 * `POST /gamification/convert` body. A non-integer, an amount below the tier rate or above the
 * balance all answer 422 `VALIDATION_ERROR` "Jumlah syiling tidak sah." with `fields.syilingAmount`.
 */
export const GamificationConvertRequestSchema = z
  .object({ syilingAmount: int })
  .meta({ id: 'GamificationConvertRequest' })
export type GamificationConvertRequest = z.infer<typeof GamificationConvertRequestSchema>

export const GamificationConvertResultSchema = z
  .object({
    syilingDebited: z.number().int().min(1),
    tokensCredited: z.number().int().min(1).meta({ description: 'floor(syilingDebited / rate).' }),
    currentSyiling: count,
    tokenBalance: count,
    transactionId: IdSchema,
  })
  .meta({ id: 'GamificationConvertResult' })
export type GamificationConvertResult = z.infer<typeof GamificationConvertResultSchema>

// ---------------------------------------------------------------------------------------------
// Challenges
// ---------------------------------------------------------------------------------------------

/** `meta` of `GET /gamification/challenges`: NOT the standard list meta. */
export const GamificationChallengesMetaSchema = z
  .object({ completed: count, active: count })
  .meta({ id: 'GamificationChallengesMeta' })
export type GamificationChallengesMeta = z.infer<typeof GamificationChallengesMetaSchema>

export const GamificationChallengesResponseSchema = z
  .object({
    data: z.array(GamificationChallengeProgressSchema),
    meta: GamificationChallengesMetaSchema,
  })
  .meta({ id: 'GamificationChallengesResponse' })
export type GamificationChallengesResponse = z.infer<typeof GamificationChallengesResponseSchema>

// ---------------------------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------------------------

/**
 * Ranks 1 to 3. `name` is the student's display name. Children's names rule (LEAD 2026-10-21, #76): outside the
 * viewer's `canSeeName` scope (and not the viewer's own row) `name` is first name + initial and `userId` is null.
 */
export const GamificationPodiumEntrySchema = z
  .object({
    rank: z.number().int().min(1).max(3),
    userId: IdSchema.nullable(),
    name: z.string(),
    initials: z.string(),
    totalSyilingEarned: count,
    tier: z.object({ key: z.string(), labelMs: z.string(), icon: z.string() }),
  })
  .meta({ id: 'GamificationPodiumEntry' })
export type GamificationPodiumEntry = z.infer<typeof GamificationPodiumEntrySchema>

/** Ranks 4 to 50. Same children's names rule as the podium: `userId` is null outside the viewer's scope. */
export const GamificationLeaderboardRowSchema = z
  .object({
    rank: z.number().int().min(4).max(50),
    userId: IdSchema.nullable(),
    name: z.string(),
    initials: z.string(),
    title: z.string(),
    level: z.number().int().min(1),
    totalSyilingEarned: count,
    tierIcon: z.string(),
  })
  .meta({ id: 'GamificationLeaderboardRow' })
export type GamificationLeaderboardRow = z.infer<typeof GamificationLeaderboardRowSchema>

/** Top 50 wallets by lifetime syiling; global, no query parameters. */
export const GamificationLeaderboardSchema = z
  .object({
    podium: z.array(GamificationPodiumEntrySchema).max(3),
    rows: z.array(GamificationLeaderboardRowSchema).max(47),
  })
  .meta({ id: 'GamificationLeaderboard' })
export type GamificationLeaderboard = z.infer<typeof GamificationLeaderboardSchema>

// ---------------------------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------------------------

/** `rarity` is free text on the wire: an unknown value answers `items: []` (not an error). */
export const GamificationAchievementsQuerySchema = z
  .object({
    rarity: z.string().optional().meta({ description: 'common | rare | epic | legendary; any other value gives no items.' }),
  })
  .meta({ id: 'GamificationAchievementsQuery' })
export type GamificationAchievementsQuery = z.infer<typeof GamificationAchievementsQuerySchema>

export const GamificationAchievementItemSchema = z
  .object({
    id: IdSchema,
    icon: z.string(),
    name: z.string(),
    description: z.string(),
    rarity: GamificationRaritySchema,
    rarityLabel: z.string(),
    rarityColor: z.string(),
    rewardSyiling: count,
    rewardXp: count,
    progress: z
      .object({ value: count, target: z.number().int().min(1) })
      .nullable()
      .meta({ description: 'Only the 5 "kuiz" badges carry progress; others are null.' }),
    unlocked: z.boolean(),
    unlockedAt: TimestampSchema.nullable(),
  })
  .meta({ id: 'GamificationAchievementItem' })
export type GamificationAchievementItem = z.infer<typeof GamificationAchievementItemSchema>

export const GamificationAchievementsSchema = z
  .object({
    unlocked: count,
    total: count.meta({ description: 'Size of the whole catalogue, regardless of the rarity filter.' }),
    streak: GamificationDashboardStreakSchema,
    items: z.array(GamificationAchievementItemSchema),
  })
  .meta({ id: 'GamificationAchievements' })
export type GamificationAchievements = z.infer<typeof GamificationAchievementsSchema>

// ---------------------------------------------------------------------------------------------
// Share cards and referral
// ---------------------------------------------------------------------------------------------

/** `GET /gamification/share-cards` data (the caller's own profile; accuracies have 1 decimal). */
export const GamificationShareCardsSchema = z
  .object({
    name: z.string(),
    initial: z.string(),
    profileUrl: z.string().min(1).meta({ description: 'Link to the caller own profile (host is a mock constant).' }),
    profile: z.object({
      answered: count,
      accuracy: z.number().min(0),
      sessions: count,
      tierKey: z.string(),
      tierIcon: z.string(),
      level: z.number().int().min(1),
      currentSyiling: count,
    }),
    kombo: GamificationDashboardStreakSchema,
    mastery: z.array(
      z.object({
        subjectName: z.string(),
        level: count,
        stage: z.string(),
        accuracy: z.number().min(0),
        correct: count,
      }),
    ),
    ranking: z.object({ accuracy: z.number().min(0), correct: count, answered: count }),
  })
  .meta({ id: 'GamificationShareCards' })
export type GamificationShareCards = z.infer<typeof GamificationShareCardsSchema>

/**
 * `GET /gamification/referral` data. The first read creates the caller's code (a write on a GET).
 * Only spaces are percent-encoded in `whatsappUrl` / `telegramUrl` (as on the live site).
 */
export const GamificationReferralSchema = z
  .object({
    code: z.string().min(1),
    rewardReferrer: count,
    rewardReferee: count,
    registerUrl: z.string().min(1),
    whatsappUrl: z.string().min(1),
    telegramUrl: z.string().min(1),
    stats: z.object({ referrals: count, rewarded: count, syilingEarned: count }),
  })
  .meta({ id: 'GamificationReferral' })
export type GamificationReferral = z.infer<typeof GamificationReferralSchema>
