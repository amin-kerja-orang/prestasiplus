// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import GamificationHistoryPage from '../../pages/GamificationHistoryPage.vue'
import { ledgerRow } from './fixtures'

const api = vi.hoisted(() => ({ fetchGamificationTransactions: vi.fn() }))
vi.mock('../../api', () => api)

let w: VueWrapper | undefined

async function mountAt(url: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push(url)
  await router.isReady()
  w = mount(GamificationHistoryPage, { global: { plugins: [router] } })
  await flushPromises()
}
const t = (id: string) => w!.get(`[data-testid="${id}"]`)
const all = (id: string) => w!.findAll(`[data-testid="${id}"]`)

const rows = [
  ledgerRow(3, { amount: 25, balanceAfter: 256, createdAt: '2026-05-19T03:26:00+08:00' }),
  ledgerRow(2, {
    type: 'convert',
    amount: -250,
    balanceAfter: 6,
    description: 'Tukar 250 syiling → 5 token',
  }),
  ledgerRow(1, {
    amount: 4,
    balanceAfter: 4,
    description: 'Cabaran Kilat: 3 betul, combo 2x',
    createdAt: '2026-02-11T05:23:00+08:00',
  }),
]

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchGamificationTransactions.mockResolvedValue({
    data: rows,
    meta: { currentSyiling: 256, type: '' },
  })
})
afterEach(() => {
  w?.unmount()
  w = undefined
})

describe('S17 history (AC-M14-06)', () => {
  it('renders the header, back link and the five pills with Semua active (AC-06.1, FR-24)', async () => {
    await mountAt('/gamification/history')
    expect(w!.get('h1').text()).toBe('📋 Sejarah Transaksi')
    expect(t('s17-balance').text()).toBe('Baki semasa: 256 syiling')
    expect(t('s17-back').text()).toBe('← Dashboard')
    expect(t('s17-back').attributes('href')).toBe('/gamification')
    const pills = all('s17-pill')
    expect(pills.map((p) => p.text())).toEqual([
      'Semua',
      '💰 Dapat',
      '🛍️ Belanja',
      '🔄 Tukar',
      '🎁 Bonus',
    ])
    expect(pills.map((p) => p.attributes('data-active'))).toEqual([
      'true',
      'false',
      'false',
      'false',
      'false',
    ])
    expect(pills[1]!.attributes('href')).toBe('/gamification/history?type=earn')
    expect(api.fetchGamificationTransactions).toHaveBeenCalledWith(
      { type: undefined },
      expect.anything(),
    )
  })

  it('lists every row with date, relative time, signed amount and balance, no pager (AC-06.1)', async () => {
    await mountAt('/gamification/history')
    const r = all('s17-row')
    expect(r).toHaveLength(3)
    expect(r[0]!.get('[data-testid="s17-row-icon"]').text()).toBe('💰')
    expect(r[0]!.get('[data-testid="s17-row-time"]').text()).toMatch(
      /^19\/05\/2026 03:26 · \d+ \S+ yang lepas$/,
    )
    expect(r[0]!.get('[data-testid="s17-row-amount"]').text()).toBe('+25')
    expect(r[0]!.get('[data-testid="s17-row-balance"]').text()).toBe('Baki: 256')
    expect(r[1]!.get('[data-testid="s17-row-icon"]').text()).toBe('🔄')
    expect(r[1]!.get('[data-testid="s17-row-amount"]').text()).toBe('−250')
    expect(r[1]!.get('[data-testid="s17-row-amount"]').classes()).toContain('text-red-500')
    expect(r[1]!.get('[data-testid="s17-row-balance"]').text()).toBe('Baki: 6')
    expect(r[2]!.get('[data-testid="s17-row-desc"]').text()).toBe(
      'Cabaran Kilat: 3 betul, combo 2x',
    )
    expect(w!.find('nav[aria-label="pagination"]').exists()).toBe(false)
  })

  it('?type= is sent to #4 and the pill is active (AC-06.2)', async () => {
    await mountAt('/gamification/history?type=earn')
    expect(api.fetchGamificationTransactions).toHaveBeenCalledWith(
      { type: 'earn' },
      expect.anything(),
    )
    expect(all('s17-pill')[1]!.attributes('data-active')).toBe('true')
    expect(all('s17-pill')[0]!.attributes('data-active')).toBe('false')
  })

  it('refetches when a pill is clicked', async () => {
    await mountAt('/gamification/history')
    api.fetchGamificationTransactions.mockResolvedValue({
      data: [],
      meta: { currentSyiling: 256, type: 'spend' },
    })
    await all('s17-pill')[2]!.trigger('click')
    await flushPromises()
    expect(api.fetchGamificationTransactions).toHaveBeenLastCalledWith(
      { type: 'spend' },
      expect.anything(),
    )
    expect(w!.find('[data-testid="s17-empty"]').exists()).toBe(true)
  })

  it('empty state for no row or an unknown type (AC-06.2, FR-08)', async () => {
    api.fetchGamificationTransactions.mockResolvedValue({
      data: [],
      meta: { currentSyiling: 256, type: 'zzz' },
    })
    await mountAt('/gamification/history?type=zzz')
    expect(t('s17-empty').text()).toContain('📋')
    expect(t('s17-empty').text()).toContain('Belum ada transaksi')
    expect(t('s17-empty').text()).toContain('Mula latih tubi untuk dapatkan syiling!')
    expect(all('s17-pill').every((p) => p.attributes('data-active') === 'false')).toBe(true)
  })

  it('error box when the API fails', async () => {
    api.fetchGamificationTransactions.mockRejectedValue(new Error('boom'))
    await mountAt('/gamification/history')
    expect(w!.text()).toContain('Ralat berlaku. Sila cuba lagi.')
  })
})
