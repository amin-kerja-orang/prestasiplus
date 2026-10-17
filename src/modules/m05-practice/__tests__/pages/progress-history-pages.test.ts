// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { HistoryItem, Progress } from '../../api/types'
import HistoryPage from '../../pages/HistoryPage.vue'
import ProgressPage from '../../pages/ProgressPage.vue'
import progressRoutes from '../../routes/progress'

const api = vi.hoisted(() => ({ fetchProgress: vi.fn(), fetchHistory: vi.fn() }))
vi.mock('../../api/practice', () => api)
vi.mock('@/ds', async () => {
  const { defineComponent, h } = await import('vue')
  const stub = (name: string, slots: string[] = []) =>
    defineComponent({
      name,
      inheritAttrs: false,
      props: { value: { type: null, default: null }, unit: { type: String, default: '' }, title: { type: String, default: '' } },
      setup: (p, { slots: s, attrs }) => () =>
        h('div', { ...attrs, 'data-stub': name }, [p.title, String(p.value ?? ''), p.unit, ...slots.map((n) => s[n]?.())])
    })
  return {
    DsChart: stub('DsChart'),
    DsEmptyState: stub('DsEmptyState', ['actions']),
    DsStatTile: stub('DsStatTile'),
  }
})

const stubs = {
  UButton: { template: '<a data-testid="btn"><slot /></a>' },
  UCard: { template: '<div><slot /></div>' },
  UIcon: true,
  UBadge: { template: '<span><slot /></span>' },
  UProgress: true,
  UPagination: { template: '<div data-testid="pagination" />' },
  UAlert: true,
}

const progress = (over: Partial<Progress> = {}): Progress => ({
  period: '30',
  answered: 0,
  accuracyPct: null,
  sessions: 0,
  minutes: 0,
  chart: { labels: [], accuracy: [], counts: [] },
  weakSubjects: [],
  subjects: [],
  ...over,
})

async function open(component: object, path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/practice/progress', component },
      { path: '/practice/history', component },
      { path: '/practice', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  const w = mount(component, { global: { plugins: [router], stubs } })
  await flushPromises()
  return w
}

beforeEach(() => vi.clearAllMocks())

describe('M05 progress and history routes', () => {
  it('registers /practice/progress and /practice/history as v2 pages', () => {
    const byPath = Object.fromEntries(progressRoutes.map((r) => [r.path, r]))
    expect(byPath['/practice/progress']?.meta?.v2).toBe(true)
    expect(byPath['/practice/history']?.meta?.v2).toBe(true)
  })
})

describe('ProgressPage (S8)', () => {
  it('defaults to 30 days and shows the empty state without answers', async () => {
    api.fetchProgress.mockResolvedValue(progress())
    const w = await open(ProgressPage, '/practice/progress')
    expect(api.fetchProgress).toHaveBeenCalledWith('30', expect.anything())
    expect(w.text()).toContain('Kemajuan Saya')
    expect(w.text()).toContain('Belum Ada Data')
    expect(w.find('[data-testid="progress-trend"]').exists()).toBe(false)
    const active = w.findAll('[data-testid="progress-period"][data-active="true"]')
    expect(active).toHaveLength(1)
  })

  it('shows trend, weak subjects and subject cards with data', async () => {
    api.fetchProgress.mockResolvedValue(
      progress({
        period: 'all',
        answered: 119,
        accuracyPct: 38.7,
        sessions: 4,
        minutes: 4,
        chart: { labels: ['19/02'], accuracy: [40], counts: [3] },
        weakSubjects: [{ code: 'BM', name: 'Bahasa Melayu', color: '', answered: 10, accuracyPct: 30 }],
        subjects: [
          { code: 'BM', name: 'Bahasa Melayu', color: '', answered: 10, correct: 3, wrong: 7, accuracyPct: 30, trend: [10, 30] },
        ],
      }),
    )
    const w = await open(ProgressPage, '/practice/progress?period=all')
    expect(api.fetchProgress).toHaveBeenCalledWith('all', expect.anything())
    expect(w.find('[data-testid="progress-trend"]').exists()).toBe(true)
    expect(w.text()).toContain('Topik Perlu Perhatian')
    expect(w.text()).toContain('Ulang Kaji')
    expect(w.text()).toContain('3 betul · 7 salah')
    expect(w.text()).toContain('▲')
    expect(w.find('[data-testid="progress-empty"]').exists()).toBe(false)
  })

  it('shows a retry on error', async () => {
    api.fetchProgress.mockRejectedValue(new Error('x'))
    const w = await open(ProgressPage, '/practice/progress')
    expect(w.find('[data-testid="progress-retry"]').exists()).toBe(true)
  })
})

const session = (over: Partial<HistoryItem> = {}): HistoryItem => ({
  id: 's1',
  mode: 'random',
  badge: { label: 'Latihan', icon: 'fa-book', color: '#6B7280' },
  completedAt: '2026-05-19T03:49:00',
  questionCount: 10,
  correctCount: 2,
  wrongCount: 8,
  accuracyPct: 20,
  timeSpent: 125,
  coinsEarned: 6,
  ...over,
})
const totals = { sessions: 4, answered: 84, avgAccuracyPct: 21.8, coins: 26 }

describe('HistoryPage (S9)', () => {
  it('lists sessions with totals and Cuba Lagi grade', async () => {
    api.fetchHistory.mockResolvedValue({
      data: [session()],
      meta: { page: 1, pageSize: 15, totalItems: 1, totalPages: 1, totals },
    })
    const w = await open(HistoryPage, '/practice/history')
    expect(api.fetchHistory).toHaveBeenCalledWith({ period: null, page: 1 }, expect.anything())
    expect(w.text()).toContain('Sejarah Latihan')
    expect(w.text()).toContain('Jumlah Sesi')
    expect(w.text()).toContain('19 May 2026, 03:49')
    expect(w.text()).toContain('02:05')
    expect(w.text()).toContain('2 / 10')
    expect(w.text()).toContain('Cuba Lagi')
    expect(w.text()).toContain('Ketepatan: 20%')
    expect(w.find('[data-testid="history-pager"]').exists()).toBe(false)
  })

  it('shows the empty state and passes the period', async () => {
    api.fetchHistory.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 15, totalItems: 0, totalPages: 1, totals: { ...totals, sessions: 0 } },
    })
    const w = await open(HistoryPage, '/practice/history?period=week')
    expect(api.fetchHistory).toHaveBeenCalledWith({ period: 'week', page: 1 }, expect.anything())
    expect(w.text()).toContain('Belum Ada Rekod Latihan')
  })

  it('shows the pager when there is more than one page', async () => {
    api.fetchHistory.mockResolvedValue({
      data: [session()],
      meta: { page: 1, pageSize: 15, totalItems: 40, totalPages: 3, totals },
    })
    const w = await open(HistoryPage, '/practice/history')
    expect(w.find('[data-testid="history-pager"]').exists()).toBe(true)
  })
})
