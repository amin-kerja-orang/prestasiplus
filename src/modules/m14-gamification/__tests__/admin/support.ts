/** Shared fixtures of the M14 admin page tests: the client module is mocked and rows are built here. */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import type {
  AdminOverview,
  AdminStudentRow,
  AdminTransactionRow,
  DailyChallenge,
  RewardControl,
  Tier,
} from '../../api/types'

export function routerAt(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
}

export async function open(page: Component, at: string): Promise<{ w: VueWrapper; router: Router }> {
  const router = routerAt()
  await router.push(at)
  await router.isReady()
  const w = mount(page, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return { w, router }
}

export const tid = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`)

export const tier = (over: Partial<Tier> = {}): Tier => ({
  id: 1,
  tierName: 'bronze',
  labelMs: 'Gangsa',
  icon: '🥉',
  color: '#cd7f32',
  minSyiling: 0,
  conversionRate: 50,
  sortOrder: 1,
  perks: ['Akses asas hadiah', 'Profil asas'],
  quizRewardL1: 1,
  quizRewardL2: 2,
  quizRewardL3: 3,
  quizRewardL4: 4,
  quizRewardL5: 5,
  pkskRewardCorrect: 5,
  boardGameRewardCorrect: 5,
  boardGameRewardWin: 25,
  isActive: true,
  ...over,
})

export const TIERS: Tier[] = [
  tier(),
  tier({ id: 2, tierName: 'silver', labelMs: 'Perak', icon: '🥈', minSyiling: 500, conversionRate: 40, sortOrder: 2, perks: [] }),
]

export const overview = (over: Partial<AdminOverview> = {}): AdminOverview => ({
  cards: {
    activeStudents: 9,
    syilingGenerated: 1932,
    tokensConverted: 0,
    conversions: 0,
    activeChallenges: 15,
    completedToday: 2,
  },
  tierDistribution: [
    { key: 'bronze', count: 7, pct: 78, widthPct: 77.78, color: '#cd7f32' },
    { key: 'silver', count: 1, pct: 11, widthPct: 11.11, color: '#c0c0c0' },
  ],
  top10: [
    { rank: 1, name: 'Murid Demo', tierKey: 'bronze', level: 1, totalSyilingEarned: 1386 },
    { rank: 2, name: 'Murid Demo Maju', tierKey: 'silver', level: 3, totalSyilingEarned: 270 },
  ],
  recent: [
    { name: 'Murid Demo', type: 'earn', amount: 10, source: 'achievement', createdAt: '2026-11-10T00:00:01.506+08:00' },
    { name: 'Murid Demo Maju', type: 'spend', amount: -5, source: 'shop', createdAt: '2026-11-09T20:58:52.415+08:00' },
  ],
  ...over,
})

export const challenge = (over: Partial<DailyChallenge> = {}): DailyChallenge => ({
  id: 1,
  title: 'Rajin Berlatih',
  description: 'Selesaikan 3 kuiz hari ini',
  icon: '📝',
  challengeType: 'quiz_count',
  targetValue: 3,
  rewardSyiling: 15,
  rewardXp: 10,
  difficulty: 'easy',
  sortOrder: 0,
  isActive: true,
  ...over,
})

export const studentRow = (over: Partial<AdminStudentRow> = {}): AdminStudentRow => ({
  userId: 1,
  name: 'Murid Demo',
  email: 'pelajar@demo.test',
  tierKey: 'bronze',
  tierColor: '#cd7f32',
  level: 2,
  currentSyiling: 1386,
  tokenBalance: 4,
  totalSyilingEarned: 2000,
  xp: 921,
  ...over,
})

export const txnRow = (over: Partial<AdminTransactionRow> = {}): AdminTransactionRow => ({
  id: 68,
  userId: 3,
  name: 'Murid Demo Kosong',
  type: 'earn',
  amount: 2,
  balanceAfter: 1004,
  source: 'daily_login',
  description: 'Streak activity (daily_login)',
  createdAt: '2026-11-10T08:39:08.073+08:00',
  ...over,
})

export const listOf = <T>(rows: T[], over: { page?: number; pageSize?: number; totalItems?: number } = {}) => ({
  data: rows,
  meta: {
    page: over.page ?? 1,
    pageSize: over.pageSize ?? 20,
    totalItems: over.totalItems ?? rows.length,
    totalPages: 1,
    from: rows.length ? 1 : null,
    to: rows.length || null,
  },
})

export const rewardControl = (over: Partial<RewardControl> = {}): RewardControl => ({
  tiles: { sessionYear: 2026, liabilityRm: 1234.5, students: 3, claims: 4 },
  settings: {
    rewardBudgetSenSession: 30000,
    rewardBudgetSenMonth: 30000,
    flatQuizReward: 1,
    currentSessionYear: 2026,
    gamesAwardSyiling: 0,
  },
  rewards: [
    { id: 1, name: 'Baucar Buku RM10', type: 'VOUCHER', priceSyiling: 500, costValueSen: 1000, costRm: 10 },
    { id: 7, name: 'Lencana Eksklusif', type: 'DIGITAL', priceSyiling: 100, costValueSen: 0, costRm: 0 },
  ],
  draws: [
    {
      id: 1,
      title: 'Cabutan Demo',
      description: '',
      ticketCostSyiling: 50,
      maxTicketsPerStudent: 10,
      prizePool: [],
      closesAt: '2026-12-24',
      status: 'open',
      createdAt: '2026-09-25T15:40:00.000+08:00',
      ticketsSold: 0,
      winners: [{ id: 1, prizeLabel: 'Hadiah Demo', name: 'Murid Demo' }],
    },
  ],
  ...over,
})
