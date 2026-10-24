// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'

import GamificationDashboardPage from '../../pages/GamificationDashboardPage.vue'
import { dashboard, wallet } from './fixtures'

const api = vi.hoisted(() => ({ fetchGamificationDashboard: vi.fn() }))
vi.mock('../../api', () => api)

let w: VueWrapper | undefined

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/gamification')
  await router.isReady()
  w = mount(GamificationDashboardPage, { global: { plugins: [router] } })
  await flushPromises()
  return w
}
const t = (id: string) => w!.get(`[data-testid="${id}"]`)
const all = (id: string) => w!.findAll(`[data-testid="${id}"]`)

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchGamificationDashboard.mockResolvedValue(dashboard())
})
afterEach(() => {
  w?.unmount()
  w = undefined
})

describe('S11 dashboard (AC-M14-04, 05)', () => {
  it('hero shows tier, title, level, figures and next-tier progress (AC-04.1, 04.2)', async () => {
    await mountPage()
    expect(t('s11-tier-icon').text()).toBe('🥉')
    expect(t('s11-title-chip').text()).toBe('📚 Permulaan')
    expect(t('s11-tier-name').text()).toBe('Gangsa Tier')
    expect(t('s11-level').text()).toBe('Tahap 2')
    expect(t('s11-hero-syiling').text()).toBe('256')
    expect(t('s11-hero-token').text()).toBe('0')
    expect(t('s11-next-tier').text()).toContain('Naik ke Perak')
    expect(t('s11-next-pct').text()).toBe('51.2%')
    expect(t('s11-next-need').text()).toBe('Perlu 244 syiling lagi')
    expect(t('s11-next-bar').attributes('data-value')).toContain('51.2')
  })

  it('hero buttons target S12, S13 and M15 rewards (AC-04.3)', async () => {
    await mountPage()
    expect(t('s11-btn-convert').attributes('href')).toBe('/gamification/convert')
    expect(t('s11-btn-challenges').attributes('href')).toBe('/gamification/challenges')
    expect(t('s11-btn-rewards').attributes('href')).toBe('/gamification/rewards')
  })

  it('stat cards (AC-04.4)', async () => {
    await mountPage()
    expect(t('s11-stat-syiling').text()).toBe('256')
    expect(t('s11-stat-today').text()).toBe('+0 hari ini')
    expect(t('s11-stat-rate').text()).toBe('50 syiling = 1 token')
    expect(t('s11-stat-level').text()).toBe('2')
    expect(t('s11-stat-xp').text()).toBe('8/110 XP')
    expect(t('s11-xp-bar').attributes('data-value')).toContain('7')
    expect(t('s11-stat-total').text()).toBe('256')
    expect(t('s11-stat-week').text()).toBe('+0 minggu ini')
  })

  it('no next-tier block at the highest tier', async () => {
    api.fetchGamificationDashboard.mockResolvedValue(
      dashboard({ wallet: wallet({ nextTier: null }) }),
    )
    await mountPage()
    expect(w!.find('[data-testid="s11-next-tier"]').exists()).toBe(false)
  })

  it('lists the first 4 challenges and the latest 6 rows (AC-05.1, 05.2)', async () => {
    await mountPage()
    expect(all('s11-challenge')).toHaveLength(4)
    expect(all('s11-challenge-difficulty')[0]!.text()).toBe('Mudah')
    expect(all('s11-challenge-difficulty')[0]!.classes()).toContain('uppercase')
    expect(all('s11-challenge-progress')[0]!.text()).toBe('0/3')
    expect(all('s11-challenge-reward')[0]!.text()).toBe('+15')
    expect(t('s11-challenges-all').attributes('href')).toBe('/gamification/challenges')
    expect(all('s11-recent-row')).toHaveLength(6)
    expect(all('s11-recent-row')[0]!.text()).toContain('Cabaran selesai: Penjelajah Topik')
    expect(all('s11-recent-row')[0]!.text()).toContain('+25')
    expect(all('s11-recent-row')[0]!.text()).toContain('yang lepas')
    expect(t('s11-recent-all').attributes('href')).toBe('/gamification/history')
  })

  it('mastery rows use the 2-decimal accuracy and the bonus suffix (AC-05.3)', async () => {
    await mountPage()
    const acc = all('s11-mastery-accuracy')
    expect(acc[0]!.text().replace(/\s+/g, ' ')).toBe('48.94% tepat · 1.05x bonus')
    expect(acc[1]!.text()).toBe('35% tepat')
    expect(all('s11-mastery-correct')[0]!.text()).toBe('46 betul / 50')
  })

  it('tier system marks only the own tier (AC-05.4)', async () => {
    await mountPage()
    expect(all('s11-tier')).toHaveLength(4)
    expect(all('s11-tier-mine')).toHaveLength(1)
    expect(all('s11-tier')[0]!.text()).toContain('✨ ANDA DI SINI')
    expect(all('s11-tier')[2]!.text()).toContain('2,000+ syiling')
    expect(all('s11-tier')[2]!.text()).toContain('30 syiling = 1 token')
  })

  it('next title and share card (AC-05.5)', async () => {
    await mountPage()
    expect(t('s11-next-title').text()).toContain('Pelajar')
    expect(t('s11-next-title-need').text()).toBe('Perlu 44 syiling lagi untuk gelaran ini')
    expect(t('s11-share-link').attributes('href')).toBe('/gamification/kad-kongsi')
    expect(t('s11-share-link').text()).toContain('Kongsi pencapaian anda di WhatsApp!')
  })

  it('no title block after the last title', async () => {
    api.fetchGamificationDashboard.mockResolvedValue(
      dashboard({ wallet: wallet({ nextTitle: null }) }),
    )
    await mountPage()
    expect(w!.find('[data-testid="s11-next-title"]').exists()).toBe(false)
  })

  it('shows an error box when the API fails', async () => {
    api.fetchGamificationDashboard.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }),
    )
    await mountPage()
    expect(w!.text()).toContain('Ralat berlaku. Sila cuba lagi.')
    expect(w!.find('[data-testid="s11-hero"]').exists()).toBe(false)
  })

  it('shows the spinner while loading', async () => {
    api.fetchGamificationDashboard.mockReturnValue(new Promise(() => undefined))
    await mountPage()
    expect(w!.find('[data-testid="s11-loading"]').exists()).toBe(true)
  })
})
