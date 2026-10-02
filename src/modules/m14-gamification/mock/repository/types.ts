/**
 * Row types of the M14 stores (SRS M14 v1.7 §6.2–§6.8, DATA-M14-01…22). JSON fields are camelCase;
 * datetimes are ISO 8601 with the fixed `+08:00` offset (`toIsoMyt`), local dates are `YYYY-MM-DD`.
 */

/** Tier keys of the seed (DATA-M14-03); a tier created at runtime (#22) adds its own key. */
export type TierKey = 'bronze' | 'silver' | 'gold' | 'platinum' | (string & {})

/** DATA-M14-01 StudentWallet (`wallets`, D11). `id` = `userId` (the M02 user). */
export interface WalletRow {
  id: number
  userId: number
  tierKey: TierKey
  currentSyiling: number
  totalSyilingEarned: number
  /** May be negative in seed data only (DV-M14-10). */
  tokenBalance: number
  xp: number
  level: number
  createdAt: string
}

export type WalletFacetKey = 'tierKey'
export type WalletCheapKey =
  'userId' | 'currentSyiling' | 'totalSyilingEarned' | 'tokenBalance' | 'xp' | 'level' | 'createdAt'

export type LedgerType = 'earn' | 'spend' | 'convert' | 'bonus' | 'refund'

/** DATA-M14-02 CoinTransaction (`coinLedger`, D11). */
export interface LedgerRow {
  id: number
  userId: number
  type: LedgerType
  source: string
  /** Conversion rows only (facet: Q-TOKENS-CONVERTED is a Σ over it). */
  tokens: number | null
  /** Signed: + earn / bonus / refund, − spend / convert. */
  amount: number
  balanceAfter: number
  description: string
  refId: string | null
  createdAt: string
}

export type LedgerFacetKey = 'type' | 'source' | 'tokens'
export type LedgerCheapKey = 'userId' | 'createdAt'

/** DATA-M14-03 Tier. */
export interface Tier {
  id: number
  tierName: TierKey
  labelMs: string
  icon: string
  color: string
  minSyiling: number
  conversionRate: number
  sortOrder: number
  perks: readonly string[]
  quizRewardL1: number
  quizRewardL2: number
  quizRewardL3: number
  quizRewardL4: number
  quizRewardL5: number
  pkskRewardCorrect: number
  boardGameRewardCorrect: number
  boardGameRewardWin: number
  isActive: boolean
}

export type ChallengeType = 'quiz_count' | 'accuracy' | 'topic_variety' | 'streak' | 'time_spent'
/** BR-M14-12 internal metric. */
export type ChallengeMetric =
  | 'sessions'
  | 'correct'
  | 'bestAccuracy'
  | 'bestCorrectInSession'
  | 'chapters'
  | 'minutes'
  | 'streak'
export type Difficulty = 'easy' | 'medium' | 'hard'

/** DATA-M14-04 DailyChallenge. */
export interface DailyChallenge {
  id: number
  title: string
  description: string
  icon: string
  challengeType: ChallengeType
  metric: ChallengeMetric
  targetValue: number
  rewardSyiling: number
  rewardXp: number
  difficulty: Difficulty
  sortOrder: number
  isActive: boolean
}

/** DATA-M14-05 ChallengeCompletion, unique (userId, challengeId, date). */
export interface ChallengeCompletion {
  id: number
  userId: number
  challengeId: number
  /** Local date (Asia/Kuala_Lumpur). */
  date: string
  completedAt: string
}

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
/** BR-M14-16 criterion keys (INFERRED from the descriptions). */
export type AchievementCriterion =
  | { kind: 'practiceSessions'; min: number }
  | { kind: 'streak'; min: number }
  | { kind: 'lifetimeSyiling'; min: number }
  | { kind: 'accurateSessions'; min: number }
  | { kind: 'subjects'; min: number }
  | { kind: 'mysteryOpenings'; min: number }
  | { kind: 'completions'; min: number }
  | { kind: 'mathCorrect'; min: number }
  | { kind: 'scienceCorrect'; min: number }
  | { kind: 'fastAnswers'; min: number }
  | { kind: 'referrals'; min: number }
  | { kind: 'unlocked'; min: number }
  | { kind: 'answersAccuracy'; min: number; accuracy: number }
  | { kind: 'perfectDays'; min: number }

/** DATA-M14-06 Achievement (catalogue, ids 1–25 in live order). */
export interface Achievement {
  id: number
  icon: string
  name: string
  description: string
  rarity: Rarity
  rewardSyiling: number
  rewardXp: number
  criterion: AchievementCriterion
  /** Progress shown only for the 5 "kuiz" badges. */
  progressTarget: number | null
}

/** DATA-M14-07 UserAchievement. */
export interface UserAchievement {
  id: number
  userId: number
  achievementId: number
  unlockedAt: string
}

/** DATA-M14-08 Streak (`id` = `userId`). */
export interface StreakRow {
  id: number
  userId: number
  current: number
  best: number
  lastActivityDate: string | null
  totalDays: number
}

/** DATA-M14-09 ReferralCode (`id` = `userId`). */
export interface ReferralCode {
  id: number
  userId: number
  code: string
}

/** DATA-M14-09 Referral. */
export interface Referral {
  id: number
  referrerId: number
  refereeId: number
  codeUsed: string
  rewarded: boolean
  createdAt: string
}

/** DATA-M14-10 TeacherWallet (`id` = `userId`). */
export interface TeacherWallet {
  id: number
  userId: number
  balance: number
  totalEarned: number
  questionsCount: number
  createdAt: string
}

/** DATA-M14-11 TeacherCoinTransaction. */
export interface TeacherTransaction {
  id: number
  userId: number
  amount: number
  description: string
  createdAt: string
}

/** DATA-M14-12 TeacherBadge. */
export interface TeacherBadge {
  id: number
  name: string
  /** Font Awesome class, e.g. `fa-seedling`. */
  icon: string
  threshold: number
  bonusCoins: number
  isActive: boolean
}

/** DATA-M14-12 TeacherBadgeAward. */
export interface TeacherBadgeAward {
  id: number
  userId: number
  badgeId: number
  awardedAt: string
}

export type TeacherRewardCategory = 'general' | 'digital' | 'physical' | 'voucher'

/** DATA-M14-13 TeacherReward. */
export interface TeacherReward {
  id: number
  name: string
  category: TeacherRewardCategory
  costCoins: number
  stock: number | null
  maxPerUser: number | null
  maxPerMonth: number | null
  description: string
  imageUrl: string | null
  isActive: boolean
  createdAt: string
}

export type RedemptionStatus = 'PENDING' | 'PROCESSING' | 'DELIVERED' | 'CANCELLED'

/** DATA-M14-14 TeacherRedemption. */
export interface TeacherRedemption {
  id: number
  userId: number
  rewardId: number
  costCoins: number
  status: RedemptionStatus
  createdAt: string
  updatedAt: string
}

export type CashStatus = 'PENDING' | 'APPROVED' | 'PROCESSING' | 'PAID' | 'REJECTED'

/** DATA-M14-15 CashWithdrawal. Bank account and holder are stored; APIs return them masked. */
export interface CashWithdrawal {
  id: number
  userId: number
  coins: number
  cashSen: number
  bankName: string
  bankAccount: string
  accountHolder: string
  status: CashStatus
  adminNote: string | null
  createdAt: string
  /** The PAID debit has been written (BR-M14-26). */
  paidDebited: boolean
}

export type SettingKey =
  | 'coins_per_question'
  | 'cash_rate_coins'
  | 'cash_rate_sen'
  | 'min_cash_withdrawal'
  | 'cash_withdrawal_enabled'
  | 'reward_budget_sen_session'
  | 'reward_budget_sen_month'
  | 'current_session_year'
  | 'flat_quiz_reward'
  | 'games_award_syiling'

/** DATA-M14-16 GamificationSetting (ids 1–10 in the S9 order). */
export interface GamificationSetting {
  id: number
  key: SettingKey
  value: number
  label: string
}

export type SyilingRewardType = 'VOUCHER' | 'PHYSICAL' | 'EXPERIENCE' | 'DIGITAL' | 'SUBSCRIPTION'

/** DATA-M14-17 GamificationReward (the 11-item syiling-priced catalogue). */
export interface SyilingReward {
  id: number
  name: string
  type: SyilingRewardType
  priceSyiling: number
  costValueSen: number
}

/** DATA-M14-17 claims (0 rows in the seed). */
export interface RewardClaim {
  id: number
  userId: number
  rewardId: number
  costValueSen: number
  claimedAt: string
}

export interface PrizeLine {
  label: string
  valueSen: number
  qty: number
}

export type DrawStatus = 'draft' | 'open' | 'closed'

/** DATA-M14-18 Draw. */
export interface Draw {
  id: number
  title: string
  description: string
  ticketCostSyiling: number
  maxTicketsPerStudent: number
  prizePool: readonly PrizeLine[]
  /** Local date or null. */
  closesAt: string | null
  status: DrawStatus
  createdAt: string
}

/** DATA-M14-19 DrawTicket. */
export interface DrawTicket {
  id: number
  drawId: number
  userId: number
  createdAt: string
}

/** DATA-M14-20 LearnerBadge. */
export interface LearnerBadge {
  id: number
  name: string
  icon: string
  rarityLabel: string | null
}

/** DATA-M14-20 LearnerBadgeHolding. */
export interface LearnerBadgeHolding {
  id: number
  userId: number
  badgeId: number
  awardedAt: string
}

/** DATA-M14-21 TokenMovement (internal audit log, no screen). */
export interface TokenMovement {
  id: number
  userId: number
  delta: number
  source: string
  refId: string | null
  createdAt: string
}

/** DATA-M14-22 DailyLoginMark. */
export interface DailyLoginMark {
  id: number
  userId: number
  date: string
}

/** The stored result of one credited session (idempotency of `onSessionCompleted`). */
export interface SessionCredit {
  id: number
  userId: number
  sessionId: string
  coinsEarned: number
  pointsEarned: number
  streakCount: number
  totalBalance: number
  completedAt: string
}
