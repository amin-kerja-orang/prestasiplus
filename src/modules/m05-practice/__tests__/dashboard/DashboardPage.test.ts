// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'

import type { Dashboard, DashboardQuest, PracticeSubject } from '../../api/types'
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
const all = (w: VueWrapper, id: string) => w.findAll(`[data-testid=${id}]`)

beforeEach(() => {
  api.fetchDashboard.mockReset()
  vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

describe('S1 DashboardPage', () => {
  it('shows the hero greeting, the trial card and the cap only from md (FR-M05-02, 03)', async () => {
    const w = await render()
    expect(t(w, 'dash-greeting').text()).toBe('Selamat Petang, Admin Demo 👋')
    expect(t(w, 'dash-greeting-line').text()).toBe('Jom teruskan latihan hari ini! 🚀')
    expect(t(w, 'dash-hero-cap').classes()).toEqual(expect.arrayContaining(['hidden', 'md:block']))
    expect(t(w, 'dash-trial-remaining').text()).toBe('Baki 0 / 50 soalan')
    expect(t(w, 'dash-trial').text()).toContain('Percubaan Percuma')
    expect(t(w, 'dash-trial-link').attributes('href')).toBe('/pricing')
  })

  it('hides the trial card for a subscriber (FR-M05-03)', async () => {
    const w = await render(dash({ trial: { active: false, used: 0, limit: 50, remaining: 50 } }))
    expect(w.find('[data-testid=dash-trial]').exists()).toBe(false)
  })

  it('shows the Kombo banner only for a streak without practice today (FR-M05-09)', async () => {
    const w = await render()
    expect(t(w, 'dash-kombo').text()).toContain('Kombo 1 hari akan putus!')
    expect(t(w, 'dash-kombo').text()).toContain(
      'Jangan lepaskan! Buat sekurang-kurangnya 1 latihan hari ini.',
    )
    expect(t(w, 'dash-kombo-link').attributes('href')).toBe('/practice')
    w.unmount()
    const w2 = await render(dash({ streak: { count: 3, practisedToday: true } }))
    expect(w2.find('[data-testid=dash-kombo]').exists()).toBe(false)
  })

  it('counts every stat up from 0 with the live delays (FR-M05-10, 11)', async () => {
    const w = await render()
    const values = () => all(w, 'dash-stat-value').map((v) => v.text())
    expect(values()).toEqual(['0', '0', '0', '0', '0%'])
    await vi.advanceTimersByTimeAsync(4000)
    expect(values()).toEqual(['256', '8', '1', '0', '0%'])
    expect(t(w, 'dash-stat-points').text()).toContain('Mata (Lvl 2)')
    expect(t(w, 'dash-level-bar').attributes('style')).toContain('width: 7%')
    expect(all(w, 'dash-platform-value').map((v) => v.text())).toEqual([
      '130152',
      '31',
      '11',
      '129752',
    ])
  })

  it('rotates the carousel by arrows, dots, autoplay and pause (FR-M05-04…08)', async () => {
    const w = await render()
    const counter = () => t(w, 'dash-counter').text()
    expect(counter()).toBe('1 / 3')
    expect(t(w, 'dash-slide-0').isVisible()).toBe(true)
    expect(t(w, 'dash-slide-1').isVisible()).toBe(false)
    expect(w.findAll('[data-testid=dash-slide-badge]')[0]?.text()).toBe('HERO')

    await t(w, 'dash-slide-0').get('[data-testid=dash-next]').trigger('click')
    expect(counter()).toBe('2 / 3')
    await t(w, 'dash-slide-1').get('[data-testid=dash-prev]').trigger('click')
    await t(w, 'dash-slide-0').get('[data-testid=dash-prev]').trigger('click')
    expect(counter()).toBe('3 / 3')
    await t(w, 'dash-dot-1').trigger('click')
    expect(counter()).toBe('2 / 3')
    expect(t(w, 'dash-dot-1').attributes('data-active')).toBe('true')

    await vi.advanceTimersByTimeAsync(5000)
    expect(counter()).toBe('3 / 3')
    await t(w, 'dash-carousel').trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(10000)
    expect(counter()).toBe('3 / 3')
    await t(w, 'dash-carousel').trigger('mouseleave')
    await vi.advanceTimersByTimeAsync(5000)
    expect(counter()).toBe('1 / 3')
  })

  it('toggles each slide body on its own (FR-M05-05)', async () => {
    const w = await render()
    const toggle0 = t(w, 'dash-slide-0').get('[data-testid=dash-slide-toggle]')
    const body0 = () => t(w, 'dash-slide-0').get('[data-testid=dash-slide-body]')
    expect(toggle0.text()).toBe('Baca Selanjutnya')
    expect(body0().classes()).toContain('line-clamp-2')
    await toggle0.trigger('click')
    expect(toggle0.text()).toBe('Tutup')
    expect(body0().classes()).not.toContain('line-clamp-2')
    expect(t(w, 'dash-slide-1').get('[data-testid=dash-slide-body]').classes()).toContain(
      'line-clamp-2',
    )
    await toggle0.trigger('click')
    expect(body0().classes()).toContain('line-clamp-2')
  })

  it('lists the 10 quests, the chest and the progress (FR-M05-12…15)', async () => {
    const w = await render()
    expect(all(w, 'dash-quest')).toHaveLength(10)
    expect(t(w, 'dash-quest-done').text()).toBe('0')
    expect(t(w, 'dash-quests').text()).toContain('Selesaikan semua misi → buka Peti Harian! 🎁')
    expect(all(w, 'dash-quest-chip')[0]?.text()).toBe('Mudah')
    expect(all(w, 'dash-quest-chip')[0]?.classes()).toContain('uppercase')
    expect(all(w, 'dash-quest-reward')[0]?.text()).toBe('+15')
    expect(t(w, 'dash-chest').text()).toContain('Selesaikan 10 lagi misi untuk buka peti! 🔒')
    expect(w.findAll('[data-testid=dash-chest-dots] > div[data-done=false]')).toHaveLength(10)
  })

  it('draws completed quests full and fills the chest dots (FR-M05-14, 15)', async () => {
    const quests = Array.from({ length: 10 }, (_, i) =>
      i < 4 ? quest(i + 1, { progress: 3, completed: true }) : quest(i + 1, { progress: 1 }),
    )
    const w = await render(dash({ quests, questsCompleted: 4 }))
    expect(t(w, 'dash-quest-done').text()).toBe('4')
    expect(t(w, 'dash-chest').text()).toContain('Selesaikan 6 lagi misi untuk buka peti! 🔒')
    expect(w.findAll('[data-testid=dash-chest-dots] > div[data-done=true]')).toHaveLength(4)
    expect(all(w, 'dash-quest-bar')[0]?.attributes('style')).toContain('width: 100%')
    expect(all(w, 'dash-quest-bar')[5]?.attributes('style')).toContain('width: 33.3')
    expect(all(w, 'dash-quest')[0]?.attributes('data-state')).toBe('completed')
  })

  it('shows the open chest at 10 / 10 (placeholder, FR-M05-15)', async () => {
    const quests = Array.from({ length: 10 }, (_, i) =>
      quest(i + 1, { progress: 3, completed: true }),
    )
    const w = await render(dash({ quests, questsCompleted: 10 }))
    expect(t(w, 'dash-chest').attributes('data-state')).toBe('open')
    expect(t(w, 'dash-chest').text()).toContain('Peti Harian dibuka! 🎉')
  })

  it('shows the empty badge shelf copy (FR-M05-16)', async () => {
    const w = await render()
    expect(t(w, 'dash-badges-empty').text()).toContain('Belum Ada Lencana Lagi!')
    expect(t(w, 'dash-badges-empty').text()).toContain(
      'Jom kumpul lencana pertama dengan menjawab soalan! 🚀',
    )
  })

  it('shows badges when the learner has some (placeholder layout)', async () => {
    const w = await render(
      dash({
        badges: [
          {
            id: 1,
            name: 'Juara Awal',
            icon: '🏅',
            rarityLabel: null,
            awardedAt: '2026-09-01T10:00:00+08:00',
          },
        ],
      }),
    )
    expect(all(w, 'dash-badge')).toHaveLength(1)
    expect(w.find('[data-testid=dash-badges-empty]').exists()).toBe(false)
  })

  it('renders the quick actions with their hrefs and the revision badge (FR-M05-17, 18)', async () => {
    const w = await render()
    const href = (id: string) => t(w, id).attributes('href')
    expect(href('dash-quick-practice')).toBe('/practice')
    expect(href('dash-quick-revision')).toBe('/practice/revision')
    expect(href('dash-quick-progress')).toBe('/practice/progress')
    expect(href('dash-quick-history')).toBe('/practice/history')
    expect(href('dash-quick-leaderboard')).toBe('/leaderboard')
    expect(t(w, 'dash-revision-badge').text()).toBe('72')
    expect(t(w, 'dash-quick').classes()).toEqual(
      expect.arrayContaining(['grid-cols-2', 'md:grid-cols-5']),
    )
  })

  it('shows "Panel Admin" for the admin role only and no badge for 0 (FR-M05-18, 19)', async () => {
    const w = await render()
    expect(t(w, 'dash-quick-admin').attributes('href')).toBe('/admin')
    expect(t(w, 'dash-quick-admin').text()).toContain('Panel Admin')
    w.unmount()
    const w2 = await render(
      dash({ user: { id: 2, name: 'Murid Demo', role: 'student' }, revisionTotal: 0 }),
    )
    expect(w2.find('[data-testid=dash-quick-admin]').exists()).toBe(false)
    expect(w2.find('[data-testid=dash-revision-badge]').exists()).toBe(false)
  })

  it('lists the articles in the strip and in the aside (FR-M05-21, 22)', async () => {
    const w = await render()
    expect(all(w, 'dash-article-card').map((a) => a.attributes('href'))).toEqual([
      '/artikel/a-1',
      '/artikel/a-2',
    ])
    expect(all(w, 'dash-article-chip')[0]?.classes()).toContain('uppercase')
    expect(t(w, 'dash-articles-all').attributes('href')).toBe('/artikel')
    expect(t(w, 'dashboard-aside').classes()).toEqual(
      expect.arrayContaining(['hidden', 'lg:block']),
    )
    expect(all(w, 'dash-aside-article')).toHaveLength(2)
    expect(t(w, 'dash-aside-all').text()).toContain('Lihat Semua Artikel')
    expect(t(w, 'dash-aside-all').attributes('href')).toBe('/artikel')
  })

  it('lists the subject cards with plain counts, the core badge and the start links (FR-M05-23)', async () => {
    const w = await render()
    expect(t(w, 'dash-subjects-count').text()).toBe('2 subjek')
    expect(t(w, 'dash-subject-BM').get('[data-testid=dash-subject-count]').text()).toBe(
      '11688 soalan',
    )
    expect(t(w, 'dash-subject-BM').find('[data-testid=dash-subject-core]').exists()).toBe(true)
    expect(t(w, 'dash-subject-GEO').find('[data-testid=dash-subject-core]').exists()).toBe(false)
    expect(
      t(w, 'dash-subject-GEO').get('[data-testid=dash-subject-start]').attributes('href'),
    ).toBe('/practice?subject=GEO')
    expect(t(w, 'dash-subject-GEO').get('[data-testid=dash-subject-start]').text()).toBe(
      'Mula Latihan 🚀',
    )
  })

  it('groups the level pills "{name} ({count})" with their hrefs (FR-M05-25)', async () => {
    const w = await render()
    const pills = all(w, 'dash-level-pill')
    expect(pills.map((p) => p.text().replace(/\s+/g, ' '))).toEqual([
      'Darjah 1 (11396)',
      'Tingkatan 1 (19455)',
      'Tingkatan 4 (19113)',
    ])
    expect(pills[0]?.attributes('href')).toBe('/practice?level=D1')
    expect(t(w, 'dash-level-group-primary').text()).toContain('🏫')
    expect(t(w, 'dash-level-group-upper_secondary').text()).toContain(
      'Sekolah Menengah Atas (KSSM)',
    )
  })

  it('shows the recent questions with stars, the subject-coloured level chip, not as links (FR-M05-26)', async () => {
    const w = await render()
    const item = t(w, 'dash-recent-item')
    expect(item.text()).toContain('Geografi')
    expect(item.text()).toContain('Soalan terkini satu')
    expect(item.findAll('[data-testid=dash-recent-stars] [data-on=true]')).toHaveLength(3)
    expect(item.findAll('[data-testid=dash-recent-stars] [data-on=false]')).toHaveLength(2)
    expect(t(w, 'dash-recent-level').text()).toBe('T5')
    expect(t(w, 'dash-recent-level').attributes('style')).toContain('rgb(16, 185, 129)')
    expect(item.find('a').exists()).toBe(false)
  })

  it('grows the difficulty bars after 150 / 300 / 450 / 600 / 750 ms (FR-M05-27)', async () => {
    const w = await render()
    const bars = () => all(w, 'dash-difficulty-bar').map((b) => b.attributes('style') ?? '')
    expect(bars().every((s) => s.includes('width: 0%'))).toBe(true)
    await vi.advanceTimersByTimeAsync(150)
    expect(bars()[0]).toContain('width: 84.2')
    expect(bars()[1]).toContain('width: 0%')
    await vi.advanceTimersByTimeAsync(150)
    expect(bars()[1]).toContain('width: 100%')
    await vi.advanceTimersByTimeAsync(600)
    expect(bars()[4]).toContain('width: 0%')
    expect(all(w, 'dash-difficulty-count').map((c) => c.text())).toEqual([
      '39694',
      '47138',
      '33720',
      '9600',
      '0',
    ])
    expect(all(w, 'dash-difficulty-star')).toHaveLength(15)
    expect(t(w, 'dash-difficulty-total').text()).toBe('130152')
    expect(t(w, 'dash-difficulty').text()).toContain('Jumlah Keseluruhan')
  })

  it('lists the subject statistics (FR-M05-28)', async () => {
    const w = await render()
    const card = t(w, 'dash-subject-stat')
    expect(card.get('[data-testid=dash-stat-bank]').text()).toBe('11688 soalan')
    expect(card.findAll('[data-testid=dash-stat-stars] [data-on=true]')).toHaveLength(2)
    expect(card.get('[data-testid=dash-stat-used]').text()).toBe('0x')
  })

  it('renders none of the unobserved conditional sections (FR-M05-20)', async () => {
    const w = await render()
    const text = w.text()
    for (const absent of ['Battle', 'Tugasan', 'Set Soalan', 'Ganjaran Baru', 'Sasaran Harian']) {
      expect(text).not.toContain(absent)
    }
  })

  it('shows an error with a retry that reloads the data', async () => {
    api.fetchDashboard.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }),
    )
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/dashboard', component: DashboardPage }],
    })
    await router.push('/dashboard')
    wrapper = mount(DashboardPage, { global: { plugins: [router] } })
    await flushPromises()
    expect(wrapper.find('[data-testid=dashboard-error]').exists()).toBe(true)
    expect(wrapper.find('[data-testid=dashboard-main]').exists()).toBe(false)
    api.fetchDashboard.mockResolvedValue(dash())
    await wrapper.get('[data-testid=dashboard-retry]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid=dashboard-main]').exists()).toBe(true)
  })
})
