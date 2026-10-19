// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'

import type { Dashboard, DashboardQuest, PracticeSubject } from '../../api/types'
import { resetFriendForTests, useFriend } from '@/composables/useFriend'

import DashboardPage from '../../pages/DashboardPage.vue'

const api = vi.hoisted(() => ({ fetchDashboard: vi.fn() }))
vi.mock('../../api/practice', () => api)

const subject = (over: Partial<PracticeSubject>): PracticeSubject => ({
  id: 1,
  code: 'BM',
  name: 'Bahasa Melayu',
  nameEn: 'Malay Language',
  icon: 'fa-book-open',
  color: '#3B82F6',
  isCore: true,
  approvedCount: 11688,
  bankCount: 11688,
  ...over,
})

const quest = (i: number, over: Partial<DashboardQuest> = {}): DashboardQuest => ({
  key: String(i),
  emoji: '📝',
  title: `Misi ${i}`,
  difficulty: 'easy',
  description: `Penerangan ${i}`,
  target: 3,
  reward: 15,
  progress: 0,
  completed: false,
  ...over,
})

const BANNERS = [
  { type: 'HERO', title: 'Selamat Datang ke PRESTASIPLUS', body: 'Badan slaid satu.' },
  { type: 'FEATURE', title: 'Slaid dua', body: 'Badan slaid dua.' },
  { type: 'PROMOTIONAL', title: 'Slaid tiga', body: null },
]

function dash(over: Partial<Dashboard> = {}): Dashboard {
  return {
    user: { id: 1, name: 'Admin Demo', role: 'admin' },
    greetingPeriod: 'Petang',
    trial: { active: true, used: 50, limit: 50, remaining: 0 },
    streak: { count: 1, practisedToday: false },
    wallet: { coins: 256, points: 8, level: 2, levelProgressPct: 7 },
    week: { sessions: 0, accuracyPct: 0 },
    banners: BANNERS,
    quests: Array.from({ length: 10 }, (_, i) => quest(i + 1)),
    questsCompleted: 0,
    badges: [],
    revisionTotal: 72,
    articles: [
      {
        slug: 'a-1',
        title: 'Artikel Satu',
        category: 'Tips Belajar',
        publishedAt: '2026-02-01T10:00:00+08:00',
      },
      { slug: 'a-2', title: 'Artikel Dua', category: 'Panduan Ibu Bapa', publishedAt: null },
    ],
    subjects: [
      subject({}),
      subject({
        id: 9,
        code: 'GEO',
        name: 'Geografi',
        nameEn: 'Geography',
        color: '#10B981',
        isCore: false,
        approvedCount: 900,
        bankCount: 910,
      }),
    ],
    stats: {
      totalQuestions: 130152,
      activeSubjects: 31,
      activeLevels: 11,
      approvedQuestions: 129752,
    },
    levelPills: [
      { code: 'D1', name: 'Darjah 1', stage: 'primary', count: 11396 },
      { code: 'T1', name: 'Tingkatan 1', stage: 'lower_secondary', count: 19455 },
      { code: 'T4', name: 'Tingkatan 4', stage: 'upper_secondary', count: 19113 },
    ],
    recentQuestions: [
      {
        id: 7,
        subjectName: 'Geografi',
        difficulty: 3,
        text: 'Soalan terkini satu',
        createdAt: '2026-05-01T10:00:00+08:00',
        levelCode: 'T5',
      },
    ],
    difficultyChart: [
      { level: 1, count: 39694 },
      { level: 2, count: 47138 },
      { level: 3, count: 33720 },
      { level: 4, count: 9600 },
      { level: 5, count: 0 },
    ],
    subjectStats: [
      {
        id: 1,
        name: 'Bahasa Melayu',
        icon: 'fa-book-open',
        color: '#3B82F6',
        bankCount: 11688,
        avgDifficulty: 1.6,
        usedCount: 0,
      },
    ],
    ...over,
  }
}

let wrapper: VueWrapper | null = null

// jsdom has no matchMedia (embla carousel and the reduced-motion checks read it).
class NoopObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return []
  }
}

function stubMatchMedia(): void {
  vi.stubGlobal('IntersectionObserver', NoopObserver)
  vi.stubGlobal('ResizeObserver', NoopObserver)
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    })),
  )
}

async function render(data: Dashboard = dash()): Promise<VueWrapper> {
  api.fetchDashboard.mockResolvedValue(data)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dashboard', component: DashboardPage },
      { path: '/:rest(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push('/dashboard')
  wrapper = mount(DashboardPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)
const has = (w: VueWrapper, id: string) => w.find(`[data-testid=${id}]`).exists()

beforeEach(() => {
  api.fetchDashboard.mockReset()
  stubMatchMedia()
  localStorage.clear()
  resetFriendForTests()
  vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

describe('S1 DashboardPage (v2 Murid Home)', () => {
  it('shows the greeting card with the friend bubble and the trial card (FR-M05-02, 03)', async () => {
    const w = await render()
    expect(t(w, 'dash-hero').text()).toContain('Selamat Petang, Admin Demo 👋')
    expect(t(w, 'dash-hero').text()).toContain('Jom teruskan latihan hari ini! 🚀')
    expect(t(w, 'dash-friend-bubble').text()).toContain('Aiman')
    expect(t(w, 'dash-trial-remaining').text()).toBe('Baki 0 / 50 soalan')
    expect(t(w, 'dash-trial').text()).toContain('Percubaan Percuma')
  })

  it('hides the trial card for a subscriber (FR-M05-03)', async () => {
    const w = await render(dash({ trial: { active: false, used: 0, limit: 50, remaining: 50 } }))
    expect(has(w, 'dash-trial')).toBe(false)
  })

  it('shows the Kombo card only for a streak without practice today (FR-M05-09)', async () => {
    const w = await render()
    expect(t(w, 'dash-kombo').text()).toContain('Kombo 1 hari akan putus!')
    expect(t(w, 'dash-kombo').text()).toContain(
      'Jangan lepaskan! Buat sekurang-kurangnya 1 latihan hari ini.',
    )
    w.unmount()
    const w2 = await render(dash({ streak: { count: 3, practisedToday: true } }))
    expect(has(w2, 'dash-kombo')).toBe(false)
  })

  it('counts the stat cards up from 0 (FR-M05-10, 11)', async () => {
    const w = await render()
    expect(t(w, 'dash-stat-coins').text()).toContain('0')
    await vi.advanceTimersByTimeAsync(4000)
    expect(t(w, 'dash-stat-coins').text()).toContain('256')
    expect(t(w, 'dash-stat-points').text()).toContain('Mata (Lvl 2)')
    expect(t(w, 'dash-stat-points').text()).toContain('8')
    expect(t(w, 'dash-stat-streak').text()).toContain('Hari Berturut')
    expect(t(w, 'dash-stat-accuracy').text()).toContain('0%')
    expect(t(w, 'dash-platform-total').text()).toContain('130152')
    expect(t(w, 'dash-platform-approved').text()).toContain('129752')
  })

  it('renders the three reward tiles and the "Sambung latihan" hero', async () => {
    const w = await render()
    await vi.advanceTimersByTimeAsync(4000)
    expect(t(w, 'dash-reward-coins').text()).toContain('256')
    expect(t(w, 'dash-continue').text()).toContain('Sambung latihan')
    expect(t(w, 'dash-continue').text()).toContain('0 daripada 10 misi harian')
  })

  it('shows every carousel slide with the per-slide read-more toggle (FR-M05-04…08)', async () => {
    const w = await render()
    expect(t(w, 'dash-slide-0').text()).toContain('Selamat Datang ke PRESTASIPLUS')
    expect(t(w, 'dash-slide-0').text()).toContain('Baca Selanjutnya')
    await t(w, 'dash-slide-0').get('[data-testid=dash-slide-toggle]').trigger('click')
    expect(t(w, 'dash-slide-0').text()).toContain('Tutup')
    expect(t(w, 'dash-slide-2').text()).not.toContain('Baca Selanjutnya')
  })

  it('lists the quests, the chest and the empty badge shelf (FR-M05-12…17)', async () => {
    const w = await render()
    expect(w.findAll('[data-testid=dash-quest]')).toHaveLength(10)
    expect(t(w, 'dash-quest-done').text()).toBe('0')
    expect(t(w, 'dash-chest').text()).toContain('Selesaikan 10 lagi misi untuk buka peti! 🔒')
    expect(t(w, 'dash-badges-empty').text()).toContain('Belum Ada Lencana Lagi!')
    w.unmount()
    const w2 = await render(
      dash({
        questsCompleted: 10,
        badges: [{ id: 1, name: 'Mula', icon: '🏅', rarityLabel: null, awardedAt: '' }],
      }),
    )
    expect(t(w2, 'dash-chest').text()).toContain('Peti Harian dibuka! 🎉')
    expect(w2.findAll('[data-testid=dash-badge]')).toHaveLength(1)
  })

  it('links the quick actions and shows the revision badge (FR-M05-18, 19)', async () => {
    const w = await render()
    expect(t(w, 'dash-quick-practice').attributes('href')).toBe('/practice')
    expect(t(w, 'dash-quick-revision').attributes('href')).toBe('/practice/revision')
    expect(t(w, 'dash-revision-badge').text()).toBe('72')
    expect(t(w, 'dash-quick-progress').attributes('href')).toBe('/practice/progress')
    expect(t(w, 'dash-quick-history').attributes('href')).toBe('/practice/history')
    expect(t(w, 'dash-quick-leaderboard').attributes('href')).toBe('/leaderboard')
    expect(has(w, 'dash-quick-admin')).toBe(true)
  })

  it('renders articles, subjects, levels, recent questions, difficulty and subject stats', async () => {
    const w = await render()
    expect(w.findAll('[data-testid=dash-article-card]')).toHaveLength(2)
    expect(t(w, 'dash-subjects-count').text()).toBe('2 subjek')
    expect(t(w, 'dash-subject-BM').text()).toContain('11688 soalan')
    expect(t(w, 'dash-subject-BM').text()).toContain('Subjek Teras')
    expect(t(w, 'dash-subject-GEO').text()).not.toContain('Subjek Teras')
    expect(w.findAll('[data-testid=dash-level-pill]')).toHaveLength(3)
    expect(t(w, 'dash-recent').text()).toContain('Soalan terkini satu')
    expect(w.findAll('[data-testid=dash-difficulty-row]')).toHaveLength(5)
    expect(t(w, 'dash-difficulty-total').text()).toBe('130152')
    expect(t(w, 'dash-subject-stats').text()).toContain('Bahasa Melayu')
  })

  it('offers the friend picker on the first visit of a student only', async () => {
    await render(dash({ user: { id: 1, name: 'Aina', role: 'student' } }))
    // First run now raises a non-modal prompt instead of opening the modal sheet.
    expect(useFriend().promptOpen.value).toBe(true)
  })

  it('does not offer the picker to other roles', async () => {
    await render()
    expect(useFriend().pickerOpen.value).toBe(false)
  })

  it('shows an error with a retry that reloads the data', async () => {
    api.fetchDashboard.mockRejectedValue(
      new ApiError({ status: 500, code: 'INTERNAL_ERROR', message: 'Ralat' }),
    )
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:rest(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/dashboard')
    wrapper = mount(DashboardPage, { global: { plugins: [router] } })
    await flushPromises()
    expect(has(wrapper, 'dashboard-error')).toBe(true)
    expect(has(wrapper, 'dashboard-main')).toBe(false)
    api.fetchDashboard.mockResolvedValue(dash())
    await t(wrapper, 'dashboard-retry').trigger('click')
    await flushPromises()
    expect(has(wrapper, 'dashboard-main')).toBe(true)
  })
})
