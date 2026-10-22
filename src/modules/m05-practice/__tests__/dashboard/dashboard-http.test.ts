// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { resetFriendForTests } from '@/composables/useFriend'

import { fetchDashboard, normaliseDashboard } from '../../api/practice'
import type { Dashboard } from '../../api/types'
import DashboardPage from '../../pages/DashboardPage.vue'

const get = vi.hoisted(() => vi.fn())
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, api: { ...actual.api, get } }
})

/** A `GET /api/dashboard` body as the real API sends it (ids are opaque strings, +08:00 timestamps). */
function wireBody(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    user: { id: '1', name: 'Murid Demo', role: 'student' },
    greetingPeriod: 'Pagi',
    trial: { active: true, used: 0, limit: 50, remaining: 50 },
    streak: { count: 2, practisedToday: false },
    wallet: { coins: 370, points: 916, level: 1, levelProgressPct: 100 },
    week: { sessions: 0, accuracyPct: 0 },
    banners: [{ type: 'HERO', title: 'Contoh: Selamat datang', body: 'Banner contoh.' }],
    quests: [],
    questsCompleted: 0,
    badges: [],
    revisionTotal: 0,
    articles: [
      {
        slug: 'contoh-berita-sekolah',
        title: 'Contoh: Berita sekolah demo',
        category: 'Berita',
        publishedAt: '2026-09-24T15:40:00.000+08:00',
      },
    ],
    subjects: [
      {
        id: '1',
        code: 'BM',
        name: 'Bahasa Melayu',
        nameEn: 'Malay Language',
        icon: 'book-open',
        color: '#3B82F6',
        isCore: true,
        approvedCount: 153,
        bankCount: 153,
      },
    ],
    stats: { totalQuestions: 1268, activeSubjects: 31, activeLevels: 11, approvedQuestions: 1268 },
    levelPills: [{ code: 'D1', name: 'Darjah 1', stage: 'primary', count: 192 }],
    recentQuestions: [
      {
        id: '1271',
        subjectName: 'Pendidikan Seni Visual',
        difficulty: 4,
        text: 'Garisan yang tegak dari atas ke bawah ialah garisan',
        createdAt: '2026-09-25T15:40:00.000+08:00',
        levelCode: 'D4',
      },
    ],
    difficultyChart: [{ level: 1, count: 312 }],
    subjectStats: [
      {
        id: '1',
        name: 'Bahasa Melayu',
        icon: 'book-open',
        color: '#3B82F6',
        bankCount: 153,
        avgDifficulty: 2.58,
        usedCount: 0,
      },
    ],
    ...over,
  }
}

class NoopObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return []
  }
}

let wrapper: VueWrapper | null = null

beforeEach(() => {
  get.mockReset()
  vi.stubEnv('VITE_API_MODE', 'http')
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
  localStorage.clear()
  resetFriendForTests()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

async function render(): Promise<VueWrapper> {
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

describe('fetchDashboard / normaliseDashboard (http mode)', () => {
  it('calls GET /api/dashboard and keeps the opaque string ids as sent (never converted to numbers)', async () => {
    get.mockResolvedValue(wireBody())
    const d = await fetchDashboard()
    expect(get).toHaveBeenCalledWith('/api/dashboard', {})
    expect(d.user).toEqual({ id: '1', name: 'Murid Demo', role: 'student' })
    expect(d.subjects[0]?.id).toBe('1')
    expect(d.recentQuestions[0]?.id).toBe('1271')
    expect(d.subjectStats[0]?.id).toBe('1')
    expect(d.articles[0]?.publishedAt).toBe('2026-09-24T15:40:00.000+08:00')
    expect(d.wallet.coins).toBe(370)
  })

  it('keeps badge and question ids unchanged, numeric-looking or not', () => {
    const d = normaliseDashboard(
      wireBody({
        badges: [
          { id: '12', name: 'Mula', icon: '🏅', rarityLabel: null, awardedAt: '2026-10-01T10:00:00.000+08:00' },
        ],
        recentQuestions: [
          {
            id: 'q-abc',
            subjectName: 'Sains',
            difficulty: 2,
            text: 'x',
            createdAt: '2026-10-01T10:00:00.000+08:00',
            levelCode: 'D1',
          },
        ],
      }) as unknown as Dashboard,
    )
    expect(d.badges[0]?.id).toBe('12')
    expect(d.recentQuestions[0]?.id).toBe('q-abc')
  })

  it('turns empty or omitted list sections into []', () => {
    const body = wireBody({ quests: undefined, banners: null, badges: [] })
    const d = normaliseDashboard(body as unknown as Dashboard)
    expect(d.quests).toEqual([])
    expect(d.banners).toEqual([])
    expect(d.badges).toEqual([])
  })

  it('does not touch the body in mock mode', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    const body = wireBody()
    get.mockResolvedValue(body)
    expect(await fetchDashboard()).toBe(body)
  })
})

describe('DashboardPage on the real API body (http mode)', () => {
  it('renders the greeting and the main sections', async () => {
    get.mockResolvedValue(wireBody())
    const w = await render()
    expect(w.find('[data-testid=dashboard-error]').exists()).toBe(false)
    expect(w.get('[data-testid=dash-hero]').text()).toContain('Selamat Pagi, Murid Demo 👋')
    expect(w.find('[data-testid=dashboard-main]').exists()).toBe(true)
    expect(w.find('[data-testid=dash-recent-item]').exists()).toBe(true)
  })

  it('shows the existing empty states when the server returns empty sections', async () => {
    get.mockResolvedValue(
      wireBody({
        banners: [],
        quests: [],
        badges: [],
        articles: [],
        subjects: [],
        levelPills: [],
        recentQuestions: [],
        difficultyChart: [],
        subjectStats: [],
      }),
    )
    const w = await render()
    expect(w.find('[data-testid=dashboard-error]').exists()).toBe(false)
    expect(w.get('[data-testid=dash-hero]').text()).toContain('Selamat Pagi, Murid Demo 👋')
    expect(w.find('[data-testid=dash-badges-empty]').exists()).toBe(true)
    expect(w.find('[data-testid=dash-quest]').exists()).toBe(false)
  })
})
