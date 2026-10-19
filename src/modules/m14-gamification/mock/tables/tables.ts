/**
 * Materialised M14 tables (SRS M14 v1.7 §6.11.1 "every other store"). Runtime ids continue after
 * the highest seeded id (`maxPlusOne`): tiers from 5, challenges from 11, cash requests from 3,
 * draws, teacher rewards and redemptions from 1. Tables keyed by user id (streaks, referral codes,
 * teacher wallets) always insert with the user id.
 */

import { defineTable, maxPlusOne } from '@/mock/define'

import type {
  Achievement,
  CashWithdrawal,
  ChallengeCompletion,
  DailyChallenge,
  DailyLoginMark,
  Draw,
  DrawTicket,
  GamificationSetting,
  LearnerBadge,
  LearnerBadgeHolding,
  Referral,
  ReferralCode,
  SessionCredit,
  RewardClaim,
  StreakRow,
  SyilingReward,
  TeacherBadge,
  TeacherBadgeAward,
  TeacherRedemption,
  TeacherReward,
  TeacherTransaction,
  TeacherWallet,
  Tier,
  TokenMovement,
  UserAchievement,
} from '../repository/types'

export const tiersTable = defineTable<Tier>({ name: 'gamification.tiers', ids: maxPlusOne() })
export const challengesTable = defineTable<DailyChallenge>({
  name: 'gamification.challenges',
  ids: maxPlusOne(),
})
export const completionsTable = defineTable<ChallengeCompletion>({
  name: 'gamification.challengeCompletions',
  ids: maxPlusOne(),
  indexes: ['userId', 'date'],
})
export const achievementsTable = defineTable<Achievement>({
  name: 'gamification.achievements',
  ids: maxPlusOne(),
})
export const userAchievementsTable = defineTable<UserAchievement>({
  name: 'gamification.userAchievements',
  ids: maxPlusOne(),
  indexes: ['userId'],
})
export const streaksTable = defineTable<StreakRow>({
  name: 'gamification.streaks',
  ids: maxPlusOne(),
})
export const referralCodesTable = defineTable<ReferralCode>({
  name: 'gamification.referralCodes',
  ids: maxPlusOne(),
  indexes: ['code'],
})
export const referralsTable = defineTable<Referral>({
  name: 'gamification.referrals',
  ids: maxPlusOne(),
  indexes: ['referrerId', 'refereeId'],
})
export const teacherWalletsTable = defineTable<TeacherWallet>({
  name: 'gamification.teacherWallets',
  ids: maxPlusOne(),
})
export const teacherLedgerTable = defineTable<TeacherTransaction>({
  name: 'gamification.teacherLedger',
  ids: maxPlusOne(),
  indexes: ['userId'],
})
export const teacherBadgesTable = defineTable<TeacherBadge>({
  name: 'gamification.teacherBadges',
  ids: maxPlusOne(),
})
export const teacherBadgeAwardsTable = defineTable<TeacherBadgeAward>({
  name: 'gamification.teacherBadgeAwards',
  ids: maxPlusOne(),
  indexes: ['userId'],
})
export const teacherRewardsTable = defineTable<TeacherReward>({
  name: 'gamification.teacherRewards',
  ids: maxPlusOne(),
})
export const teacherRedemptionsTable = defineTable<TeacherRedemption>({
  name: 'gamification.teacherRedemptions',
  ids: maxPlusOne(),
  indexes: ['userId', 'status'],
})
export const cashWithdrawalsTable = defineTable<CashWithdrawal>({
  name: 'gamification.cashWithdrawals',
  ids: maxPlusOne(),
  indexes: ['userId', 'status'],
})
export const settingsTable = defineTable<GamificationSetting>({
  name: 'gamification.settings',
  ids: maxPlusOne(),
  indexes: ['key'],
})
export const syilingRewardsTable = defineTable<SyilingReward>({
  name: 'gamification.syilingRewards',
  ids: maxPlusOne(),
})
export const rewardClaimsTable = defineTable<RewardClaim>({
  name: 'gamification.rewardClaims',
  ids: maxPlusOne(),
})
export const drawsTable = defineTable<Draw>({ name: 'gamification.draws', ids: maxPlusOne() })
export const drawTicketsTable = defineTable<DrawTicket>({
  name: 'gamification.drawTickets',
  ids: maxPlusOne(),
  indexes: ['drawId', 'userId'],
})
export const learnerBadgesTable = defineTable<LearnerBadge>({
  name: 'gamification.learnerBadges',
  ids: maxPlusOne(),
})
export const learnerBadgeHoldingsTable = defineTable<LearnerBadgeHolding>({
  name: 'gamification.learnerBadgeHoldings',
  ids: maxPlusOne(),
  indexes: ['userId'],
})
export const tokenMovementsTable = defineTable<TokenMovement>({
  name: 'gamification.tokenMovements',
  ids: maxPlusOne(),
  indexes: ['userId'],
})
export const dailyLoginMarksTable = defineTable<DailyLoginMark>({
  name: 'gamification.dailyLoginMarks',
  ids: maxPlusOne(),
  indexes: ['userId'],
})

/** One row per credited session (`onSessionCompleted` is idempotent per `sessionId`). */
export const sessionCreditsTable = defineTable<SessionCredit>({
  name: 'gamification.sessionCredits',
  ids: maxPlusOne(),
  indexes: ['sessionId'],
})

/** Every M14 table, for the plugin's `tables`. */
export const M14_TABLES = {
  tiers: tiersTable,
  challenges: challengesTable,
  challengeCompletions: completionsTable,
  achievements: achievementsTable,
  userAchievements: userAchievementsTable,
  streaks: streaksTable,
  referralCodes: referralCodesTable,
  referrals: referralsTable,
  teacherWallets: teacherWalletsTable,
  teacherLedger: teacherLedgerTable,
  teacherBadges: teacherBadgesTable,
  teacherBadgeAwards: teacherBadgeAwardsTable,
  teacherRewards: teacherRewardsTable,
  teacherRedemptions: teacherRedemptionsTable,
  cashWithdrawals: cashWithdrawalsTable,
  settings: settingsTable,
  syilingRewards: syilingRewardsTable,
  rewardClaims: rewardClaimsTable,
  draws: drawsTable,
  drawTickets: drawTicketsTable,
  learnerBadges: learnerBadgesTable,
  learnerBadgeHoldings: learnerBadgeHoldingsTable,
  tokenMovements: tokenMovementsTable,
  dailyLoginMarks: dailyLoginMarksTable,
  sessionCredits: sessionCreditsTable,
} as const
