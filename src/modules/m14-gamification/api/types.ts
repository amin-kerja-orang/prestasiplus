/**
 * M14 API types (SRS M14 v1.8 §7, §6). JSON is camelCase; ids are integers; datetimes are ISO 8601
 * with the fixed `+08:00` offset; local dates are `YYYY-MM-DD`. The screens (S1–S22) read this file
 * and do not change it (build-plan §S.3 rule 5).
 */

export type TierKey = string
export type LedgerType = 'earn' | 'spend' | 'convert' | 'bonus' | 'refund'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type ChallengeType = 'quiz_count' | 'accuracy' | 'topic_variety' | 'streak' | 'time_spent'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export type CashStatus = 'PENDING' | 'APPROVED' | 'PROCESSING' | 'PAID' | 'REJECTED'
export type RedemptionStatus = 'PENDING' | 'PROCESSING' | 'DELIVERED' | 'CANCELLED'
export type TeacherRewardCategory = 'general' | 'digital' | 'physical' | 'voucher'
export type DrawStatus = 'draft' | 'open' | 'closed'
export type SyilingRewardType = 'VOUCHER' | 'PHYSICAL' | 'EXPERIENCE' | 'DIGITAL' | 'SUBSCRIPTION'

/** M14 refusal codes that reach the client (`ApiError.code`). */
export type M14ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CASH_DISABLED'
  | 'INSUFFICIENT_BALANCE'
  | 'OUT_OF_STOCK'
  | 'LIMIT_REACHED'

// --- student (#2–#11) ----------------------------------------------------------------------------

export interface TierView {
  key: TierKey
  labelMs: string
  icon: string
  color: string
  minSyiling: number
  conversionRate: number
}

/** #2 `data` (also `GamificationWallet` inside #3). Defaults for a user without a wallet row (BR-M14-02). */
export interface GamificationWallet {
  userId: number
  currentSyiling: number
  totalSyilingEarned: number
  tokenBalance: number
  xp: number
  level: number
  xpNeeded: number
  levelProgressPct: number
  tier: TierView
  /** `null` at the highest active tier (no block on S11). `pct` has 1 decimal. */
  nextTier: (TierView & { pct: number; need: number }) | null
  title: { name: string; emoji: string }
  /** `null` after the last title. */
  nextTitle: { name: string; emoji: string; threshold: number; need: number } | null
  earnedToday: number
  earnedThisWeek: number
  streak: { current: number; best: number; multiplier: number }
}

/** A row of the student ledger (#3 `recent`, #4). */
export interface LedgerEntry {
  id: number
  type: LedgerType
  amount: number
  balanceAfter: number
  source: string
  description: string
  createdAt: string
}

/** #7 `data[]` (also #3 `challenges`). */
export interface ChallengeProgress {
  id: number
  icon: string
  title: string
  description: string
  difficulty: Difficulty
  rewardSyiling: number
  rewardXp: number
  target: number
  progress: number
  pct: number
  completed: boolean
}

/** #3 `mastery[]` (FN-M14-2.1.8). `accuracy` has up to 2 decimals; `multiplier` > 1 shows " · {m}x bonus". */
export interface DashboardMastery {
  subjectId: number
  subjectName: string
  level: number
  stage: string
  correct: number
  nextTarget: number | null
  accuracy: number
  multiplier: number
}

export interface TierGridItem {
  key: TierKey
  labelMs: string
  icon: string
  color: string
  minSyiling: number
  conversionRate: number
  isMine: boolean
}

/** #3 `data`. */
export interface GamificationDashboard {
  wallet: GamificationWallet
  /** The first 4 active challenges. */
  challenges: ChallengeProgress[]
  /** The latest 6 ledger rows. */
  recent: LedgerEntry[]
  mastery: DashboardMastery[]
  /** Active tiers by `sortOrder`. */
  tiers: TierGridItem[]
}

/** #4 `meta`. */
export interface TransactionsMeta {
  currentSyiling: number
  /** The `type` asked for ('' for none). */
  type: string
}

/** #5 `data`. */
export interface ConvertView {
  currentSyiling: number
  tokenBalance: number
  rate: number
  tierLabel: string
  /** `[rate, 5 × rate, currentSyiling]`. */
  quick: [number, number, number]
  tiers: TierGridItem[]
}

/** #6 `data`. */
export interface ConvertResult {
  syilingDebited: number
  tokensCredited: number
  currentSyiling: number
  tokenBalance: number
  transactionId: number
}

/** #7 `meta`. */
export interface ChallengesMeta {
  completed: number
  active: number
}

/** #8 `data.podium[]` (ranks 1–3). */
export interface PodiumEntry {
  rank: number
  userId: number
  name: string
  initials: string
  totalSyilingEarned: number
  tier: { key: TierKey; labelMs: string; icon: string }
}

/** #8 `data.rows[]` (ranks 4–50). */
export interface LeaderboardRow {
  rank: number
  userId: number
  name: string
  initials: string
  title: string
  level: number
  totalSyilingEarned: number
  tierIcon: string
}

export interface Leaderboard {
  podium: PodiumEntry[]
  rows: LeaderboardRow[]
}

/** #9 `data.items[]`. */
export interface AchievementItem {
  id: number
  icon: string
  name: string
  description: string
  rarity: Rarity
  rarityLabel: string
  rarityColor: string
  rewardSyiling: number
  rewardXp: number
  progress: { value: number; target: number } | null
  unlocked: boolean
  unlockedAt: string | null
}

export interface Achievements {
  unlocked: number
  total: number
  streak: { current: number; best: number; multiplier: number }
  items: AchievementItem[]
}

/** #10 `data` (S18 share cards). `accuracy` has 1 decimal. */
export interface ShareCards {
  name: string
  initial: string
  /** DV-M14-02: the viewer's own profile. */
  profileUrl: string
  profile: {
    answered: number
    accuracy: number
    sessions: number
    tierKey: TierKey
    tierIcon: string
    level: number
    currentSyiling: number
  }
  kombo: { current: number; best: number; multiplier: number }
  mastery: {
    subjectName: string
    level: number
    stage: string
    accuracy: number
    correct: number
  }[]
  ranking: { accuracy: number; correct: number; answered: number }
}

/** #11 `data`. */
export interface Referral {
  code: string
  rewardReferrer: number
  rewardReferee: number
  registerUrl: string
  whatsappUrl: string
  telegramUrl: string
  stats: { referrals: number; rewarded: number; syilingEarned: number }
}

// --- teacher (#12–#17) ---------------------------------------------------------------------------

export interface TeacherBadge {
  id: number
  name: string
  /** Font Awesome class, e.g. `fa-seedling`. */
  icon: string
  threshold: number
  bonusCoins: number
  isActive: boolean
}

export interface TeacherReward {
  id: number
  name: string
  category: TeacherRewardCategory
  costCoins: number
  /** `null` = no limit. */
  stock: number | null
  maxPerUser: number | null
  maxPerMonth: number | null
  description: string
  imageUrl: string | null
  isActive: boolean
  createdAt: string
}

/** #12 `data`. */
export interface TeacherDashboard {
  balance: number
  totalEarned: number
  questionsCount: number
  coinsPerQuestion: number
  badges: (TeacherBadge & { earned: boolean })[]
  badgesEarned: number
  badgesActive: number
  nextBadge: (TeacherBadge & { need: number }) | null
  /** Active rewards only. */
  catalogue: TeacherReward[]
  /** Newest first. */
  transactions: { id: number; description: string; amount: number; createdAt: string }[]
}

/** #13 `data`. `banks` = the 25 options, the first is the placeholder "-- Pilih Bank --". */
export interface TeacherCashView {
  balance: number
  available: number
  held: number
  cashValue: number
  minWithdrawal: number
  maxWithdrawal: number
  rateCoins: number
  rateSen: number
  enabled: boolean
  banks: string[]
  history: {
    id: number
    coins: number
    cash: number
    bankName: string
    status: CashStatus
    createdAt: string
  }[]
}

/** #14 body. */
export interface TeacherCashRequest {
  coinsAmount: number
  /** One of `TeacherCashView.banks` except the placeholder. */
  bankName: string
  bankAccount: string
  accountHolder: string
}

/** #14 `data` (201). The account is returned masked. */
export interface TeacherCashCreated {
  id: number
  coins: number
  cash: number
  bankName: string
  bankAccountMasked: string
  status: 'PENDING'
  createdAt: string
}

/** #15 `data`. */
export interface TeacherShop {
  balance: number
  available: number
  rewards: TeacherReward[]
}

/** #16 `data` (201), #34 rows, #35 `data`. `userName` and `rewardName` are the names the S7 row shows. */
export interface TeacherRedemption {
  id: number
  userId: number
  rewardId: number
  costCoins: number
  status: RedemptionStatus
  createdAt: string
  updatedAt: string
  userName: string
  rewardName: string
}

export type TeacherLeaderboardTab = 'sekolah' | 'global'

/** #17 `data`. `schoolName` is present on the `global` tab only. */
export interface TeacherLeaderboard {
  tab: TeacherLeaderboardTab
  rows: {
    rank: number
    userId: number
    name: string
    schoolName?: string | null
    questions: number
    syiling: number
  }[]
}

// --- admin (#18–#43) -----------------------------------------------------------------------------

/** #18 `data`. */
export interface AdminOverview {
  cards: {
    activeStudents: number
    syilingGenerated: number
    tokensConverted: number
    conversions: number
    activeChallenges: number
    completedToday: number
  }
  /** By tier key ascending. `pct` is the rounded integer label, `widthPct` the bar width (2 decimals). */
  tierDistribution: { key: TierKey; count: number; pct: number; widthPct: number; color: string }[]
  top10: {
    rank: number
    name: string
    tierKey: TierKey
    level: number
    totalSyilingEarned: number
  }[]
  recent: { name: string; type: LedgerType; amount: number; source: string; createdAt: string }[]
}

/** #19, #20, #22 `data`. */
export interface Tier {
  id: number
  tierName: TierKey
  labelMs: string
  icon: string
  color: string
  minSyiling: number
  conversionRate: number
  sortOrder: number
  perks: string[]
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

/** #20 body (every field but `color` and `perks` is required; `perks` absent keeps the stored list). */
export interface TierUpdate {
  labelMs: string
  icon: string
  color?: string
  minSyiling: number
  conversionRate: number
  sortOrder: number
  quizRewardL1: number
  quizRewardL2: number
  quizRewardL3: number
  quizRewardL4: number
  quizRewardL5: number
  pkskRewardCorrect: number
  boardGameRewardCorrect: number
  boardGameRewardWin: number
  /** A list, or a JSON array text (the hidden field of S2). */
  perks?: string[] | string
}

/** #22 body: `tierName` is unique (case-insensitive, stored lower-case); `perks` is one text or a list. */
export interface TierCreate extends TierUpdate {
  tierName: string
}

/** #23, #24, #27 `data`. */
export interface DailyChallenge {
  id: number
  title: string
  description: string
  icon: string
  challengeType: ChallengeType
  targetValue: number
  rewardSyiling: number
  rewardXp: number
  difficulty: Difficulty
  sortOrder: number
  isActive: boolean
}

/** #24, #27 body (every field required). */
export interface DailyChallengeInput {
  title: string
  description: string
  icon: string
  challengeType: ChallengeType
  targetValue: number
  rewardSyiling: number
  rewardXp: number
  difficulty: Difficulty
  sortOrder: number
}

export type StudentSort = 'total_syiling_earned' | 'current_syiling' | 'token_balance' | 'level'

export interface AdminStudentsQuery {
  search?: string
  tier?: string
  sort?: StudentSort
  page?: number
  signal?: AbortSignal
}

/** #28 `data[]`. */
export interface AdminStudentRow {
  userId: number
  name: string
  email: string
  tierKey: TierKey
  tierColor: string
  level: number
  currentSyiling: number
  tokenBalance: number
  totalSyilingEarned: number
  xp: number
}

/** #29 body. */
export interface AwardRequest {
  /** 1 ≤ amount ≤ 10,000. */
  userId: number
  amount: number
  reason: string
}

/** #29 `data`. */
export interface AwardResult {
  userId: number
  currentSyiling: number
  transactionId: number
}

export interface AdminTransactionsQuery {
  type?: LedgerType | ''
  /** `YYYY-MM-DD`, inclusive. */
  dateFrom?: string
  dateTo?: string
  page?: number
  signal?: AbortSignal
}

/** #30 `data[]`. */
export interface AdminTransactionRow extends LedgerEntry {
  userId: number
  name: string
}

/** #31 `data`. */
export interface AdminTeacherGamification {
  cards: { rewards: number; activeRewards: number; badges: number; pendingRedemptions: number }
  /** PENDING cash requests (the badge on "Tebus Tunai"). */
  pendingCash: number
  badges: TeacherBadge[]
  rewards: TeacherReward[]
}

/** #32 body. */
export interface TeacherBadgeUpdate {
  name: string
  icon?: string
  threshold: number
  bonusCoins: number
  isActive?: boolean
}

/** #33 fields (sent as multipart; `image` is an image file). */
export interface TeacherRewardCreate {
  name: string
  category: TeacherRewardCategory
  costCoins: number
  stock?: number | null
  maxPerUser?: number | null
  maxPerMonth?: number | null
  description?: string
  image?: File | Blob | null
  /** Default true. */
  isActive?: boolean
}

export type RedemptionStatusFilter = RedemptionStatus | 'all'
export type CashStatusFilter = CashStatus | 'all'

/** #36 `data.rows[]`, #37 `data`. Bank account and holder are masked. */
export interface AdminCashRow {
  id: number
  userId: number
  name: string
  coins: number
  cash: number
  bankName: string
  bankAccountMasked: string
  accountHolderMasked: string
  status: CashStatus
  adminNote: string | null
  createdAt: string
}

/** #36 `data`. */
export interface AdminCashList {
  cards: { pending: number; approved: number; paid: number; paidTotal: number }
  rows: AdminCashRow[]
}

/** #37 body. An absent `adminNote` keeps it; a blank one clears it. */
export interface AdminCashUpdate {
  status: CashStatus
  adminNote?: string
}

/** #38 `data[]` (the 10 rows in the S9 order), #39 `data[]`. */
export interface GamificationSetting {
  key: string
  label: string
  value: number
  kind: 'number' | 'toggle'
}

/** #39 body. */
export interface SettingValue {
  key: string
  value: number
}

/** #40 `data.settings`, #41 body (any subset) and `data`. */
export interface EconomySettings {
  rewardBudgetSenSession: number
  rewardBudgetSenMonth: number
  flatQuizReward: number
  currentSessionYear: number
  gamesAwardSyiling: number
}

export interface SyilingReward {
  id: number
  name: string
  type: SyilingRewardType
  priceSyiling: number
  costValueSen: number
  /** `costValueSen ÷ 100`. */
  costRm: number
}

export interface PrizeLine {
  label: string
  valueSen: number
  qty: number
}

/** #40 `data.draws[]`, #43 `data`. */
export interface Draw {
  id: number
  title: string
  description: string
  ticketCostSyiling: number
  maxTicketsPerStudent: number
  prizePool: PrizeLine[]
  closesAt: string | null
  status: DrawStatus
  createdAt: string
  ticketsSold: number
}

/** #40 `data`. */
export interface RewardControl {
  tiles: { sessionYear: number; liabilityRm: number; students: number; claims: number }
  settings: EconomySettings
  rewards: SyilingReward[]
  draws: Draw[]
}

/** #43 body. */
export interface DrawCreate {
  title: string
  description?: string
  ticketCostSyiling: number
  maxTicketsPerStudent: number
  /** A JSON text of `[{label, value_sen, qty}]`, or a list; empty = no pool. */
  prizePool?: string | PrizeLine[]
  /** `YYYY-MM-DD`. */
  closesAt?: string
  /** "Buka serta-merta": `open` instead of `draft`. */
  openNow?: boolean
}
