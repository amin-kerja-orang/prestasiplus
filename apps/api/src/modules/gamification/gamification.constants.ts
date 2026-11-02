import type { RateLimitSpec } from '../../common/throttle'

/**
 * Rate limits of M14 beyond the wallet core (BE-23, D57: 429 `RATE_LIMITED` with `retryAfter`). The fixed-window
 * counters are per signed-in user. The read buckets reuse the existing ceilings; the convert ceiling has its own
 * variable (`THROTTLE_GAMIFICATION_CONVERT_PER_MINUTE`, default 30, optional).
 */
export const GAMIFICATION_LIMITS = {
  read: { bucket: 'gamification.read', env: 'THROTTLE_WALLET_READ_PER_MINUTE', default: 240, per: 'user' },
  convert: { bucket: 'gamification.convert', env: 'THROTTLE_GAMIFICATION_CONVERT_PER_MINUTE', default: 30, per: 'user' },
  adminRead: { bucket: 'gamification.admin.read', env: 'THROTTLE_ADMIN_READ_PER_MINUTE', default: 300, per: 'user' },
  adminWrite: { bucket: 'gamification.admin.write', env: 'THROTTLE_ADMIN_WRITE_PER_MINUTE', default: 30, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

/** BR-M14-16: "Tepat Sasaran" counts practice sessions with accuracy of at least this percentage. */
export const ACCURATE_SESSION_PCT = 90
/** BR-M14-16: the curriculum subjects (by name, M03 owner) whose correct answers "Tokoh Matematik" / "Pakar Sains" count. */
export const MATH_SUBJECT_NAME = 'Matematik'
export const SCIENCE_SUBJECT_NAME = 'Sains'

/** Page sizes fixed by the mock (the query `pageSize` is ignored). */
export const STUDENTS_PAGE_SIZE = 20
export const TRANSACTIONS_PAGE_SIZE = 25
/** Leaderboard length (mock `walletRepo.leaderboard(50)`). */
export const LEADERBOARD_SIZE = 50

/** BR-M14-12: the default `metric` of a challenge type (stored snake_case, mock `DEFAULT_METRIC_BY_TYPE`). */
export const DEFAULT_METRIC_BY_TYPE = {
  quiz_count: 'sessions',
  accuracy: 'best_accuracy',
  topic_variety: 'chapters',
  streak: 'streak',
  time_spent: 'minutes',
} as const

export const RARITY_LABELS = { common: 'Biasa', rare: 'Jarang', epic: 'Epik', legendary: 'Legenda' } as const
export const RARITY_COLORS = { common: '#9ca3af', rare: '#3b82f6', epic: '#8b5cf6', legendary: '#f59e0b' } as const

/** Mastery stages (M05 BR-20 scale; mock `data/mastery.ts`). */
export const MASTERY_THRESHOLDS = [0, 10, 25, 50, 100, 200, 350, 550, 800, 1100, 1500] as const
export const MASTERY_LABELS = ['Pemula', 'Mula Belajar', 'Aktif', 'Tekun', 'Mahir', 'Pakar Muda', 'Cemerlang', 'Master', 'Grandmaster', 'Legend', 'Mythical'] as const

/** Stored `syiling_rewards.type` codes (lower case) and their wire form (upper case). */
export const SYILING_REWARD_TYPES = ['voucher', 'physical', 'experience', 'digital', 'subscription'] as const

/** The ten setting keys in the S9 order, and the two that are toggles. */
export const TOGGLE_SETTING_KEYS: readonly string[] = ['cash_withdrawal_enabled', 'games_award_syiling']

/** Economy keys shared by S9 and S10 (camelCase wire name to stored key, BR-M14-32). */
export const ECONOMY_KEYS = {
  rewardBudgetSenSession: 'reward_budget_sen_session',
  rewardBudgetSenMonth: 'reward_budget_sen_month',
  flatQuizReward: 'flat_quiz_reward',
  currentSessionYear: 'current_session_year',
  gamesAwardSyiling: 'games_award_syiling',
} as const

/** Upper bounds of a lucky draw prize pool (the position column is a smallint). */
export const MAX_PRIZE_LINES = 100
export const MAX_PRIZE_QTY = 1_000_000

/** Header a client may send to make a conversion safe against a double submit. */
export const IDEMPOTENCY_HEADER = 'idempotency-key'
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_.:-]{1,100}$/

/** Referral rewards (mock constants, contract `GAMIFICATION_REFERRAL_REWARDS`). */
export const REFERRAL_REWARD_REFERRER = 50
export const REFERRAL_REWARD_REFEREE = 25
/** Follow-up to BR-M14-19: a referrer earns from at most this many referrals in any rolling 24 hours (deviations log). */
export const REFERRAL_MAX_PER_REFERRER_PER_DAY = 10

/** BR-M14-14 / FR-M14-64: the first student password login of a Malaysia day pays this many syiling, with this ledger text. */
export const DAILY_LOGIN_REWARD = 2
export const DAILY_LOGIN_DESCRIPTION = 'Streak activity (daily_login)'

/** 403 message when an admin in Mod Pelajar tries to spend (convert): Mod Pelajar never spends real coins. */
export const MOD_PELAJAR_REFUSAL = 'Tidak dibenarkan dalam Mod Pelajar.'
