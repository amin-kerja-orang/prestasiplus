// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'

import type { Dashboard, DashboardQuest, PracticeSubject } from '../../api/types'
import { resetFriendForTests, useFriend } from '@/composables/useFriend'

import DashboardPage from '../../pages/DashboardPage.vue'

const api = vi.hoisted(() => ({
  fetchDashboard: vi.fn(),
  fetchChallengesToday: vi.fn(),
}))
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
    accuracyPct: null,
    package: null,
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

async function render(data: Dashboard = dash(), pricingRouted = true): Promise<VueWrapper> {
  api.fetchDashboard.mockResolvedValue(data)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dashboard', component: DashboardPage },
      ...(pricingRouted ? [{ path: '/pricing', component: { template: '<div />' } }] : []),
      { path: '/:rest(.*)*', name: pricingRouted ? undefined : 'core.not-found', component: { template: '<div />' } },
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
  api.fetchChallengesToday.mockReset()
  api.fetchChallengesToday.mockResolvedValue([])
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

  it('shows the "Langgan Sekarang" CTA only when /pricing is routed (D9 dead link)', async () => {
    const w = await render()
    expect(t(w, 'dash-trial').get('[data-ds=card-cta]').text()).toContain('Langgan Sekarang')
    w.unmount()
    const w2 = await render(dash(), false)
    expect(has(w2, 'dash-trial')).toBe(true)
    expect(t(w2, 'dash-trial').find('[data-ds=card-cta]').exists()).toBe(false)
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
    expect(t(w, 'dash-stat-accuracy').text()).toContain('—')
    // DS stat tiles format numbers with a thousands separator (src/ds/format.ts).
    expect(t(w, 'dash-platform-total').text()).toContain('130,152')
    expect(t(w, 'dash-platform-approved').text()).toContain('129,752')
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
    // FR-MUR-2-11: Darjah (D1) is filtered out; T1 and T4 are listed.
    const pills = w.findAll('[data-testid=dash-level-pill]')
    expect(pills).toHaveLength(2)
    expect(pills[0]?.text()).toContain('Tingkatan 1')
    expect(pills[1]?.text()).toContain('Tingkatan 4')
    expect(w.find('[data-testid=dash-level-group-primary]').exists()).toBe(false)
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
  it('Ketepatan shows "—" for null accuracy, without a count-up (AC-MUR-2-9)', async () => {
    const w = await render(dash({ accuracyPct: null }))
    expect(t(w, 'dash-stat-accuracy').text()).toContain('—')
    await vi.advanceTimersByTimeAsync(4000)
    expect(t(w, 'dash-stat-accuracy').text()).toContain('—')
    expect(t(w, 'dash-stat-accuracy').text()).not.toContain('%')
  })

  it('Ketepatan rounds 66.5 half up to 67%', async () => {
    const w = await render(dash({ accuracyPct: 66.5 }))
    await vi.advanceTimersByTimeAsync(4000)
    expect(t(w, 'dash-stat-accuracy').text()).toContain('67%')
  })

  it('Ketepatan rounds 66.4 down to 66%', async () => {
    const w = await render(dash({ accuracyPct: 66.4 }))
    await vi.advanceTimersByTimeAsync(4000)
    expect(t(w, 'dash-stat-accuracy').text()).toContain('66%')
  })

  it('Ketepatan reads the top-level field, not week.accuracyPct', async () => {
    const w = await render(dash({ accuracyPct: 80, week: { sessions: 1, accuracyPct: 10 } }))
    await vi.advanceTimersByTimeAsync(4000)
    expect(t(w, 'dash-stat-accuracy').text()).toContain('80%')
  })

  it('lists T1..T5 and never D1 in Tahap Pendidikan (FR-MUR-2-11)', async () => {
    const codes = ['D1', 'T1', 'T2', 'T3', 'T4', 'T5']
    const stage = (c: string) =>
      c === 'D1' ? 'primary' : c === 'T4' || c === 'T5' ? 'upper_secondary' : 'lower_secondary'
    const w = await render(
      dash({
        levelPills: codes.map((c) => ({ code: c, name: c === 'D1' ? 'Darjah 1' : `Tingkatan ${c[1]}`, stage: stage(c), count: 5 })),
      }),
    )
    const texts = w.findAll('[data-testid=dash-level-pill]').map((p) => p.text())
    expect(texts).toHaveLength(5)
    expect(texts.join('|')).not.toContain('Darjah')
    for (const n of [1, 2, 3, 4, 5]) expect(texts.join('|')).toContain(`Tingkatan ${n}`)
  })

  it('shows HomePakej for a package and hides it for null (FR-MUR-2-4)', async () => {
    const w = await render(
      dash({ package: { name: 'Pakej SPM Premium', validUntil: '2027-11-03' }, trial: { active: false, used: 0, limit: 50, remaining: 50 } }),
    )
    expect(has(w, 'dash-pakej')).toBe(true)
    expect(t(w, 'dash-pakej').text()).toContain('Pakej SPM Aktif')
    expect(t(w, 'dash-pakej').text()).toContain('Pakej SPM Premium')
    expect(t(w, 'dash-pakej-badge').text()).toBe('Aktif')
    w.unmount()
    const w2 = await render(dash({ package: null, trial: { active: false, used: 0, limit: 50, remaining: 50 } }))
    expect(has(w2, 'dash-pakej')).toBe(false)
  })

  it('shows HomeTrial when the package is null and the trial is active', async () => {
    const w = await render(dash({ package: null }))
    expect(has(w, 'dash-pakej')).toBe(false)
    expect(has(w, 'dash-trial')).toBe(true)
  })

  it('shows the package instead of the trial when both are set', async () => {
    const w = await render(dash({ package: { name: 'Pakej Percuma', validUntil: '2027-11-03' } }))
    expect(has(w, 'dash-pakej')).toBe(true)
    expect(has(w, 'dash-trial')).toBe(false)
  })

  it('Pakej prints "Sah sehingga 3 Nov 2027"', async () => {
    const w = await render(dash({ package: { name: 'Pakej Percuma', validUntil: '2027-11-03' } }))
    expect(t(w, 'dash-pakej-valid').text()).toBe('Sah sehingga 3 Nov 2027')
  })

  it('Cabaran Kilat shows 3 of 4 rows with chips, progress and the link', async () => {
    const row = (i: number, difficulty: 'easy' | 'medium' | 'hard') => ({
      id: i, icon: '🎯', title: `Cabaran ${i}`, description: 'x', difficulty,
      rewardSyiling: 10 * i, target: 5, progress: i, completed: false,
    })
    api.fetchChallengesToday.mockResolvedValue([row(1, 'easy'), row(2, 'medium'), row(3, 'hard'), row(4, 'easy')])
    const w = await render()
    expect(t(w, 'dash-cabaran').text()).toContain('⚡ Cabaran Kilat')
    const rows = w.findAll('[data-testid=dash-cabaran-row]')
    expect(rows).toHaveLength(3)
    expect(w.findAll('[data-testid=dash-cabaran-chip]').map((c) => c.text())).toEqual(['Mudah', 'Sederhana', 'Sukar'])
    expect(w.findAll('[data-testid=dash-cabaran-progress]').map((c) => c.text())).toEqual(['1/5', '2/5', '3/5'])
    expect(w.findAll('[data-testid=dash-cabaran-reward]').map((c) => c.text())).toEqual(['+10', '+20', '+30'])
    expect(t(w, 'dash-cabaran-link').attributes('href')).toBe('/gamification/challenges')
    expect(t(w, 'dash-cabaran-link').text()).toBe('Lihat Semua →')
  })

  it('hides Cabaran Kilat on an empty list', async () => {
    api.fetchChallengesToday.mockResolvedValue([])
    const w = await render()
    expect(has(w, 'dash-cabaran')).toBe(false)
  })

  it('hides Cabaran Kilat on an error and still renders the dashboard', async () => {
    api.fetchChallengesToday.mockRejectedValue(
      new ApiError({ status: 500, code: 'INTERNAL_ERROR', message: 'Ralat' }),
    )
    const w = await render()
    expect(has(w, 'dash-cabaran')).toBe(false)
    expect(has(w, 'dashboard-main')).toBe(true)
    expect(has(w, 'dash-stats')).toBe(true)
  })

  it('shows the Kombo warning and "Mula Latihan" for streak 1 without practice today (AC-MUR-2-1)', async () => {
    const w = await render(dash({ streak: { count: 1, practisedToday: false } }))
    expect(t(w, 'dash-kombo').text()).toContain('Kombo 1 hari akan putus!')
    expect(t(w, 'dash-kombo').text()).toContain('Mula Latihan')
  })

  it('lays the stat tiles out in 2 columns at 375 px (AC-MUR-2-5)', async () => {
    const w = await render()
    const grid = t(w, 'dash-stats')
    expect(grid.classes()).toContain('grid-cols-2')
    expect(grid.classes()).not.toContain('grid-cols-3')
  })
})
