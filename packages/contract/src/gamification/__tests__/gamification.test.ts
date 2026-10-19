import { describe, expect, it } from 'vitest'

import { ErrorBodySchema } from '../../common/error'
import { buildOpenApiDocument } from '../../openapi'
import {
  GamificationAdminAwardRequestSchema,
  GamificationAdminAwardResultSchema,
  GamificationAdminChallengeInputSchema,
  GamificationAdminChallengeSchema,
  GamificationAdminOverviewSchema,
  GamificationAdminStudentsQuerySchema,
  GamificationAdminStudentsResponseSchema,
  GamificationAdminTierCreateSchema,
  GamificationAdminTierSchema,
  GamificationAdminTierUpdateSchema,
  GamificationAdminTransactionsQuerySchema,
  GamificationAdminTransactionsResponseSchema,
  GamificationDeleteResultSchema,
  GamificationDrawCreateRequestSchema,
  GamificationDrawSchema,
  GamificationEconomySettingsUpdateSchema,
  GamificationRewardControlSchema,
  GamificationRewardCostRequestSchema,
  GamificationSettingsListSchema,
  GamificationSettingsUpdateRequestSchema,
  GamificationToggleResultSchema,
  GAMIFICATION_SETTING_KEYS,
} from '../admin'
import { GAMIFICATION_COMPONENT_SCHEMAS } from '../paths'
import {
  GAMIFICATION_AWARD_MAX,
  GAMIFICATION_MESSAGES,
  GamificationAchievementsSchema,
  GamificationAchievementsQuerySchema,
  GamificationChallengesResponseSchema,
  GamificationConvertRequestSchema,
  GamificationConvertResultSchema,
  GamificationConvertViewSchema,
  GamificationDashboardSchema,
  GamificationLeaderboardSchema,
  GamificationReferralSchema,
  GamificationShareCardsSchema,
} from '../schema'

const AT = '2026-10-16T09:30:00+08:00'
const tier = { key: 'gangsa', labelMs: 'Gangsa', icon: '🥉', color: '#cd7f32', minSyiling: 0, conversionRate: 10 }
const streak = { current: 2, best: 5, multiplier: 1 }
const wallet = {
  userId: '12',
  currentSyiling: 120,
  totalSyilingEarned: 340,
  tokenBalance: 3,
  xp: 45,
  level: 2,
  xpNeeded: 110,
  levelProgressPct: 41,
  tier,
  nextTier: { ...tier, key: 'perak', labelMs: 'Perak', minSyiling: 500, pct: 68, need: 160 },
  title: { name: 'Pelajar Baharu', emoji: '🌱' },
  nextTitle: { name: 'Pelajar Rajin', emoji: '📘', threshold: 500, need: 160 },
  earnedToday: 12,
  earnedThisWeek: 40,
  streak,
}
const challenge = {
  id: '3',
  icon: '🎯',
  title: 'Jawab 10 soalan',
  description: 'Jawab 10 soalan hari ini',
  difficulty: 'easy',
  rewardSyiling: 20,
  rewardXp: 10,
  target: 10,
  progress: 4,
  pct: 40,
  completed: false,
}
const entry = { id: '901', type: 'earn', amount: 8, balanceAfter: 120, source: 'practice', description: 'Latihan Matematik', createdAt: AT }
const grid = { ...tier, isMine: true }
const dashboard = {
  wallet,
  challenges: [challenge],
  recent: [entry, { ...entry, id: '902', type: 'convert', amount: -50, balanceAfter: 70 }],
  mastery: [
    { subjectId: '1', subjectName: 'Matematik', level: 2, stage: 'Pelajar', correct: 24, nextTarget: 50, accuracy: 72.55, multiplier: 1 },
  ],
  tiers: [grid, { ...grid, key: 'perak', isMine: false }],
}
const adminTier = {
  id: '1',
  tierName: 'gangsa',
  labelMs: 'Gangsa',
  icon: '🥉',
  color: '#cd7f32',
  minSyiling: 0,
  conversionRate: 10,
  sortOrder: 1,
  perks: ['Lencana Gangsa'],
  quizRewardL1: 1,
  quizRewardL2: 2,
  quizRewardL3: 3,
  quizRewardL4: 4,
  quizRewardL5: 5,
  pkskRewardCorrect: 1,
  boardGameRewardCorrect: 1,
  boardGameRewardWin: 5,
  isActive: true,
}
const { id: _id, tierName: _tn, perks: _perks, isActive: _ia, ...tierFields } = adminTier
const challengeInput = {
  title: 'Jawab 10 soalan',
  description: 'Jawab 10 soalan hari ini',
  icon: '🎯',
  challengeType: 'quiz_count',
  targetValue: 10,
  rewardSyiling: 20,
  rewardXp: 10,
  difficulty: 'easy',
  sortOrder: 1,
}
const meta = { page: 1, pageSize: 20, totalItems: 1, totalPages: 1, from: 1, to: 1 }
const draw = {
  id: '4',
  title: 'Cabutan Hujung Tahun',
  description: '',
  ticketCostSyiling: 50,
  maxTicketsPerStudent: 10,
  prizePool: [{ label: 'Baucar Buku RM10', valueSen: 1000, qty: 3 }],
  closesAt: '2026-12-31',
  status: 'open',
  createdAt: AT,
  ticketsSold: 7,
}

describe('student: dashboard and convert', () => {
  it('parses the dashboard, with and without next tier and title', () => {
    expect(GamificationDashboardSchema.safeParse(dashboard).success).toBe(true)
    const top = { ...dashboard, wallet: { ...wallet, nextTier: null, nextTitle: null } }
    expect(GamificationDashboardSchema.safeParse(top).success).toBe(true)
  })

  it('rejects numeric ids, a UTC timestamp and more than 4 challenges', () => {
    expect(GamificationDashboardSchema.safeParse({ ...dashboard, wallet: { ...wallet, userId: 12 } }).success).toBe(false)
    expect(
      GamificationDashboardSchema.safeParse({ ...dashboard, recent: [{ ...entry, createdAt: '2026-10-16T01:30:00Z' }] }).success,
    ).toBe(false)
    expect(GamificationDashboardSchema.safeParse({ ...dashboard, challenges: Array(5).fill(challenge) }).success).toBe(false)
    expect(GamificationDashboardSchema.safeParse({ ...dashboard, recent: [{ ...entry, type: 'gift' }] }).success).toBe(false)
  })

  it('parses the convert view with the three quick amounts', () => {
    const view = { currentSyiling: 120, tokenBalance: 3, rate: 10, tierLabel: 'Gangsa', quick: [10, 50, 120], tiers: [grid] }
    expect(GamificationConvertViewSchema.safeParse(view).success).toBe(true)
    expect(GamificationConvertViewSchema.safeParse({ ...view, quick: [10, 50] }).success).toBe(false)
  })

  it('accepts an integer syilingAmount only', () => {
    expect(GamificationConvertRequestSchema.safeParse({ syilingAmount: 50 }).success).toBe(true)
    expect(GamificationConvertRequestSchema.safeParse({ syilingAmount: 5.5 }).success).toBe(false)
    expect(GamificationConvertRequestSchema.safeParse({ syilingAmount: '50' }).success).toBe(false)
    expect(GamificationConvertRequestSchema.safeParse({}).success).toBe(false)
  })

  it('parses the convert result', () => {
    const result = { syilingDebited: 50, tokensCredited: 5, currentSyiling: 70, tokenBalance: 8, transactionId: '902' }
    expect(GamificationConvertResultSchema.safeParse(result).success).toBe(true)
    expect(GamificationConvertResultSchema.safeParse({ ...result, transactionId: 902 }).success).toBe(false)
  })

  it('carries the VALIDATION_ERROR body of an invalid amount', () => {
    const body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: GAMIFICATION_MESSAGES.amountInvalid,
        fields: { syilingAmount: GAMIFICATION_MESSAGES.amountInvalid },
      },
    }
    expect(ErrorBodySchema.safeParse(body).success).toBe(true)
    expect(GAMIFICATION_MESSAGES.amountInvalid).toBe('Jumlah syiling tidak sah.')
  })
})

describe('student: challenges, leaderboard, achievements, share cards, referral', () => {
  it('uses the {completed, active} meta, not the list meta', () => {
    const ok = { data: [challenge], meta: { completed: 0, active: 1 } }
    expect(GamificationChallengesResponseSchema.safeParse(ok).success).toBe(true)
    expect(GamificationChallengesResponseSchema.safeParse({ data: [challenge], meta }).success).toBe(false)
    expect(GamificationChallengesResponseSchema.safeParse({ data: [{ ...challenge, difficulty: 'expert' }], meta: ok.meta }).success).toBe(false)
  })

  it('parses the leaderboard podium and rows with fictitious names', () => {
    const board = {
      podium: [
        { rank: 1, userId: '21', name: 'Aina Contoh', initials: 'AC', totalSyilingEarned: 900, tier: { key: 'emas', labelMs: 'Emas', icon: '🥇' } },
      ],
      rows: [
        { rank: 4, userId: '24', name: 'Budi Ujian', initials: 'BU', title: 'Pelajar Rajin', level: 4, totalSyilingEarned: 410, tierIcon: '🥈' },
      ],
    }
    expect(GamificationLeaderboardSchema.safeParse(board).success).toBe(true)
    expect(GamificationLeaderboardSchema.safeParse({ ...board, podium: [{ ...board.podium[0], rank: 4 }] }).success).toBe(false)
    expect(GamificationLeaderboardSchema.safeParse({ ...board, rows: [{ ...board.rows[0], rank: 3 }] }).success).toBe(false)
  })

  it('parses achievements with and without progress, and the free-text rarity query', () => {
    const item = {
      id: '1',
      icon: '🏅',
      name: 'Langkah Pertama',
      description: 'Selesaikan satu sesi',
      rarity: 'common',
      rarityLabel: 'Biasa',
      rarityColor: '#9ca3af',
      rewardSyiling: 10,
      rewardXp: 5,
      progress: null,
      unlocked: false,
      unlockedAt: null,
    }
    const data = { unlocked: 1, total: 25, streak, items: [item, { ...item, id: '2', progress: { value: 3, target: 10 }, unlocked: true, unlockedAt: AT }] }
    expect(GamificationAchievementsSchema.safeParse(data).success).toBe(true)
    expect(GamificationAchievementsSchema.safeParse({ ...data, items: [{ ...item, rarity: 'mythic' }] }).success).toBe(false)
    expect(GamificationAchievementsQuerySchema.safeParse({ rarity: 'nonsense' }).success).toBe(true)
    expect(GamificationAchievementsQuerySchema.safeParse({}).success).toBe(true)
  })

  it('parses share cards and the referral', () => {
    const cards = {
      name: 'Aina Contoh',
      initial: 'A',
      profileUrl: 'https://prestasiplus.my/pelajar/12',
      profile: { answered: 119, accuracy: 38.7, sessions: 4, tierKey: 'gangsa', tierIcon: '🥉', level: 2, currentSyiling: 120 },
      kombo: streak,
      mastery: [{ subjectName: 'Matematik', level: 2, stage: 'Pelajar', accuracy: 38.7, correct: 46 }],
      ranking: { accuracy: 38.7, correct: 46, answered: 119 },
    }
    expect(GamificationShareCardsSchema.safeParse(cards).success).toBe(true)
    expect(GamificationShareCardsSchema.safeParse({ ...cards, ranking: { accuracy: 38.7 } }).success).toBe(false)
    const referral = {
      code: 'AINA1234',
      rewardReferrer: 50,
      rewardReferee: 25,
      registerUrl: 'https://prestasiplus.my/register?ref=AINA1234',
      whatsappUrl: 'https://wa.me/?text=Jom%20belajar',
      telegramUrl: 'https://t.me/share/url?url=x&text=Jom%20belajar',
      stats: { referrals: 2, rewarded: 1, syilingEarned: 50 },
    }
    expect(GamificationReferralSchema.safeParse(referral).success).toBe(true)
    expect(GamificationReferralSchema.safeParse({ ...referral, code: '' }).success).toBe(false)
  })
})

describe('admin: overview, tiers, challenges', () => {
  it('parses the overview', () => {
    const overview = {
      cards: { activeStudents: 10, syilingGenerated: 5000, tokensConverted: 40, conversions: 6, activeChallenges: 5, completedToday: 2 },
      tierDistribution: [{ key: 'gangsa', count: 7, pct: 70, widthPct: 70, color: '#cd7f32' }],
      top10: [{ rank: 1, name: 'Aina Contoh', tierKey: 'emas', level: 7, totalSyilingEarned: 900 }],
      recent: [{ name: 'Budi Ujian', type: 'bonus', amount: 100, source: 'admin_award', createdAt: AT }],
    }
    expect(GamificationAdminOverviewSchema.safeParse(overview).success).toBe(true)
    expect(GamificationAdminOverviewSchema.safeParse({ ...overview, recent: Array(11).fill(overview.recent[0]) }).success).toBe(false)
  })

  it('parses a tier and the update and create bodies', () => {
    expect(GamificationAdminTierSchema.safeParse(adminTier).success).toBe(true)
    expect(GamificationAdminTierSchema.safeParse({ ...adminTier, id: 1 }).success).toBe(false)
    expect(GamificationAdminTierUpdateSchema.safeParse(tierFields).success).toBe(true)
    expect(GamificationAdminTierUpdateSchema.safeParse({ ...tierFields, perks: '["a","b"]', color: '#112233' }).success).toBe(true)
    expect(GamificationAdminTierUpdateSchema.safeParse({ ...tierFields, perks: ['a'] }).success).toBe(true)
    // tierName is ignored on update (cannot change)
    expect(GamificationAdminTierUpdateSchema.parse({ ...tierFields, tierName: 'x' })).not.toHaveProperty('tierName')
  })

  it('rejects an invalid tier body', () => {
    expect(GamificationAdminTierUpdateSchema.safeParse({ ...tierFields, conversionRate: 0 }).success).toBe(false)
    expect(GamificationAdminTierUpdateSchema.safeParse({ ...tierFields, minSyiling: -1 }).success).toBe(false)
    expect(GamificationAdminTierUpdateSchema.safeParse({ ...tierFields, color: 'red' }).success).toBe(false)
    expect(GamificationAdminTierUpdateSchema.safeParse({ ...tierFields, labelMs: 'x'.repeat(61) }).success).toBe(false)
    expect(GamificationAdminTierUpdateSchema.safeParse({ ...tierFields, icon: '   ' }).success).toBe(false)
    const { quizRewardL3: _q, ...missing } = tierFields
    expect(GamificationAdminTierUpdateSchema.safeParse(missing).success).toBe(false)
  })

  it('requires a tierName of letters, digits, underscore or dash on create', () => {
    expect(GamificationAdminTierCreateSchema.safeParse({ ...tierFields, tierName: 'platinum_2' }).success).toBe(true)
    expect(GamificationAdminTierCreateSchema.safeParse({ ...tierFields, tierName: 'platinum 2' }).success).toBe(false)
    expect(GamificationAdminTierCreateSchema.safeParse({ ...tierFields, tierName: 'a'.repeat(41) }).success).toBe(false)
    expect(GamificationAdminTierCreateSchema.safeParse(tierFields).success).toBe(false)
  })

  it('parses toggle and delete results', () => {
    expect(GamificationToggleResultSchema.safeParse({ isActive: false }).success).toBe(true)
    expect(GamificationDeleteResultSchema.safeParse({ deleted: 1 }).success).toBe(true)
    expect(GamificationDeleteResultSchema.safeParse({ deleted: 2 }).success).toBe(false)
  })

  it('parses a challenge and requires every input field', () => {
    expect(GamificationAdminChallengeSchema.safeParse({ ...challengeInput, id: '3', isActive: true }).success).toBe(true)
    expect(GamificationAdminChallengeInputSchema.safeParse(challengeInput).success).toBe(true)
    expect(GamificationAdminChallengeInputSchema.safeParse({ ...challengeInput, challengeType: 'speed' }).success).toBe(false)
    expect(GamificationAdminChallengeInputSchema.safeParse({ ...challengeInput, difficulty: 'expert' }).success).toBe(false)
    expect(GamificationAdminChallengeInputSchema.safeParse({ ...challengeInput, targetValue: 0 }).success).toBe(false)
    expect(GamificationAdminChallengeInputSchema.safeParse({ ...challengeInput, title: 'x'.repeat(121) }).success).toBe(false)
    expect(GamificationAdminChallengeInputSchema.safeParse({ ...challengeInput, description: 'x'.repeat(256) }).success).toBe(false)
    const { sortOrder: _s, ...missing } = challengeInput
    expect(GamificationAdminChallengeInputSchema.safeParse(missing).success).toBe(false)
  })
})

describe('admin: students, award, transactions', () => {
  it('parses the students page and the query', () => {
    const row = {
      userId: '12',
      name: 'Aina Contoh',
      email: 'aina@contoh.test',
      tierKey: 'gangsa',
      tierColor: '#cd7f32',
      level: 2,
      currentSyiling: 120,
      tokenBalance: 3,
      totalSyilingEarned: 340,
      xp: 45,
    }
    expect(GamificationAdminStudentsResponseSchema.safeParse({ data: [row], meta }).success).toBe(true)
    expect(GamificationAdminStudentsQuerySchema.parse({ search: 'ain', sort: 'level', page: '2' })).toEqual({ search: 'ain', sort: 'level', page: 2 })
    expect(GamificationAdminStudentsQuerySchema.safeParse({ page: '0' }).success).toBe(false)
  })

  it('validates the award body (1..10,000, id as string, non-blank reason)', () => {
    const body = { userId: '12', amount: 100, reason: 'Hadiah ujian' }
    expect(GamificationAdminAwardRequestSchema.safeParse(body).success).toBe(true)
    expect(GamificationAdminAwardRequestSchema.safeParse({ ...body, amount: GAMIFICATION_AWARD_MAX }).success).toBe(true)
    expect(GamificationAdminAwardRequestSchema.safeParse({ ...body, amount: GAMIFICATION_AWARD_MAX + 1 }).success).toBe(false)
    expect(GamificationAdminAwardRequestSchema.safeParse({ ...body, amount: 0 }).success).toBe(false)
    expect(GamificationAdminAwardRequestSchema.safeParse({ ...body, reason: '   ' }).success).toBe(false)
    expect(GamificationAdminAwardRequestSchema.safeParse({ ...body, reason: 'x'.repeat(256) }).success).toBe(false)
    expect(GamificationAdminAwardRequestSchema.safeParse({ ...body, userId: 12 }).success).toBe(false)
    expect(GamificationAdminAwardResultSchema.safeParse({ userId: '12', currentSyiling: 220, transactionId: '903' }).success).toBe(true)
  })

  it('parses the transactions page; filters are free text', () => {
    const row = { id: '901', userId: '12', name: 'Aina Contoh', type: 'bonus', amount: 100, balanceAfter: 220, source: 'admin_award', description: 'Hadiah ujian', createdAt: AT }
    expect(GamificationAdminTransactionsResponseSchema.safeParse({ data: [row], meta }).success).toBe(true)
    expect(GamificationAdminTransactionsResponseSchema.safeParse({ data: [{ ...row, type: 'gift' }], meta }).success).toBe(false)
    expect(GamificationAdminTransactionsQuerySchema.safeParse({ type: 'whatever', dateFrom: 'not-a-date' }).success).toBe(true)
  })
})

describe('admin: settings, reward control, draws', () => {
  const settings = GAMIFICATION_SETTING_KEYS.map((key) => ({
    key,
    label: key,
    value: key === 'cash_withdrawal_enabled' ? 1 : 10,
    kind: key === 'cash_withdrawal_enabled' || key === 'games_award_syiling' ? 'toggle' : 'number',
  }))

  it('lists the ten setting keys in the S9 order', () => {
    expect(GAMIFICATION_SETTING_KEYS).toHaveLength(10)
    expect(GAMIFICATION_SETTING_KEYS[0]).toBe('coins_per_question')
    expect(GamificationSettingsListSchema.safeParse(settings).success).toBe(true)
    expect(GamificationSettingsListSchema.safeParse([{ ...settings[0], key: 'unknown_key' }]).success).toBe(false)
  })

  it('validates the settings save body', () => {
    expect(GamificationSettingsUpdateRequestSchema.safeParse({ settings: [{ key: 'flat_quiz_reward', value: 2 }] }).success).toBe(true)
    expect(GamificationSettingsUpdateRequestSchema.safeParse({ settings: [] }).success).toBe(false)
    expect(GamificationSettingsUpdateRequestSchema.safeParse({}).success).toBe(false)
    expect(GamificationSettingsUpdateRequestSchema.safeParse({ settings: [{ key: 'flat_quiz_reward', value: -1 }] }).success).toBe(false)
    expect(GamificationSettingsUpdateRequestSchema.safeParse({ settings: [{ key: 'flat_quiz_reward', value: 1.5 }] }).success).toBe(false)
  })

  it('needs at least one of the five economy settings', () => {
    expect(GamificationEconomySettingsUpdateSchema.safeParse({ flatQuizReward: 2 }).success).toBe(true)
    expect(GamificationEconomySettingsUpdateSchema.safeParse({}).success).toBe(false)
    expect(GamificationEconomySettingsUpdateSchema.safeParse({ currentSessionYear: 2026.5 }).success).toBe(false)
  })

  it('parses reward control with its draws and prize pool', () => {
    const control = {
      tiles: { sessionYear: 2026, liabilityRm: 12.5, students: 3, claims: 4 },
      settings: { rewardBudgetSenSession: 1000, rewardBudgetSenMonth: 300, flatQuizReward: 1, currentSessionYear: 2026, gamesAwardSyiling: 0 },
      rewards: [{ id: '1', name: 'Baucar Buku RM10', type: 'VOUCHER', priceSyiling: 500, costValueSen: 1000, costRm: 10 }],
      draws: [draw],
    }
    expect(GamificationRewardControlSchema.safeParse(control).success).toBe(true)
    expect(GamificationDrawSchema.safeParse({ ...draw, status: 'finished' }).success).toBe(false)
    expect(GamificationDrawSchema.safeParse({ ...draw, closesAt: null }).success).toBe(true)
    expect(GamificationDrawSchema.safeParse({ ...draw, closesAt: '2026-12-31T00:00:00+08:00' }).success).toBe(false)
    expect(GamificationRewardCostRequestSchema.safeParse({ costValueSen: 0 }).success).toBe(true)
    expect(GamificationRewardCostRequestSchema.safeParse({ costValueSen: -1 }).success).toBe(false)
  })

  it('validates the draw create body for each prize pool form', () => {
    const base = { title: 'Cabutan Hujung Tahun', ticketCostSyiling: 50, maxTicketsPerStudent: 10 }
    expect(GamificationDrawCreateRequestSchema.safeParse(base).success).toBe(true)
    expect(
      GamificationDrawCreateRequestSchema.safeParse({
        ...base,
        closesAt: '2026-12-31',
        openNow: true,
        prizePool: [{ label: 'Baucar', valueSen: 1000, qty: 2 }, { label: 'Pen', value_sen: 500, qty: 1 }],
      }).success,
    ).toBe(true)
    expect(GamificationDrawCreateRequestSchema.safeParse({ ...base, prizePool: '[{"label":"A","value_sen":100,"qty":1}]' }).success).toBe(true)
    // a line without valueSen or value_sen, a fake date, zero cost
    expect(GamificationDrawCreateRequestSchema.safeParse({ ...base, prizePool: [{ label: 'Baucar', qty: 2 }] }).success).toBe(false)
    expect(GamificationDrawCreateRequestSchema.safeParse({ ...base, closesAt: '2026-02-31' }).success).toBe(false)
    expect(GamificationDrawCreateRequestSchema.safeParse({ ...base, ticketCostSyiling: 0 }).success).toBe(false)
    expect(GamificationDrawCreateRequestSchema.safeParse({ ...base, title: ' ' }).success).toBe(false)
    expect(GamificationDrawCreateRequestSchema.safeParse({ ...base, title: 'x'.repeat(151) }).success).toBe(false)
  })
})

describe('openapi registration', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, unknown>>
    components: { schemas: Record<string, unknown> }
  }
  const has = (path: string, method: string) => expect(doc.paths[path], path).toHaveProperty(method)

  it('contains the 8 student M14 operations', () => {
    has('/gamification/dashboard', 'get')
    has('/gamification/convert', 'get')
    has('/gamification/convert', 'post')
    has('/gamification/challenges', 'get')
    has('/gamification/leaderboard', 'get')
    has('/gamification/achievements', 'get')
    has('/gamification/share-cards', 'get')
    has('/gamification/referral', 'get')
  })

  it('contains the 13 admin economy and 6 admin operations operations', () => {
    has('/admin/gamification/overview', 'get')
    has('/admin/gamification/tiers', 'get')
    has('/admin/gamification/tiers', 'post')
    has('/admin/gamification/tiers/{id}', 'put')
    has('/admin/gamification/tiers/{id}/toggle', 'post')
    has('/admin/gamification/challenges', 'get')
    has('/admin/gamification/challenges', 'post')
    has('/admin/gamification/challenges/{id}', 'put')
    has('/admin/gamification/challenges/{id}', 'delete')
    has('/admin/gamification/challenges/{id}/toggle', 'post')
    has('/admin/gamification/students', 'get')
    has('/admin/gamification/award', 'post')
    has('/admin/gamification/transactions', 'get')
    has('/admin/gamification/settings', 'get')
    has('/admin/gamification/settings', 'put')
    has('/admin/reward-control', 'get')
    has('/admin/reward-control/settings', 'put')
    has('/admin/reward-control/rewards/{id}/cost', 'put')
    has('/admin/reward-control/draws', 'post')
  })

  it('does not register the BE-11 wallet routes, the teacher economy or the parent approvals', () => {
    expect(doc.paths['/gamification/wallet']).toBeUndefined()
    expect(doc.paths['/gamification/transactions']).toBeUndefined()
    expect(doc.paths['/me/gamification-summary']).toBeUndefined()
    const out = Object.keys(doc.paths).filter(
      (p) => p.startsWith('/guru/gamification') || p.startsWith('/admin/gamification/guru') || p.startsWith('/parent/hadiah-approvals'),
    )
    expect(out).toEqual([])
  })

  it('contains every gamification component, under its own meta id, with a domain prefix', () => {
    for (const [name, schema] of Object.entries(GAMIFICATION_COMPONENT_SCHEMAS)) {
      expect(doc.components.schemas, name).toHaveProperty(name)
      expect((schema as { meta(): { id?: string } }).meta().id, name).toBe(name)
      expect(name, name).toMatch(/^(Gamification|Reward|Shop)[A-Z]/)
    }
  })
})
