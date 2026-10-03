// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { activeChipKey, DIGITAL_CHIPS } from '../components/digital-chips'
import DigitalShopPage from '../pages/DigitalShopPage.vue'
import MyRedemptionsPage from '../pages/MyRedemptionsPage.vue'
import digitalRoutes from '../routes/digital'

const wallet = vi.hoisted(() => ({ fetchGamificationWallet: vi.fn() }))
vi.mock('@/modules/m14-gamification', () => wallet)

const api = vi.hoisted(() => ({
  fetchDigitalItems: vi.fn(),
  fetchDigitalRedemptions: vi.fn(),
}))
vi.mock('../api', () => api)

const WALLET = {
  currentSyiling: 256,
  tokenBalance: 0,
  xp: 8,
  level: 2,
  tier: { conversionRate: 50 },
}

let router: Router
let wrapper: VueWrapper | undefined

async function mountAt(component: Component, url: string) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/cikgu/hadiah', component },
      { path: '/cikgu/hadiah/saya', component },
    ],
  })
  await router.push(url)
  await router.isReady()
  wrapper = mount(component, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  wallet.fetchGamificationWallet.mockResolvedValue(WALLET)
  api.fetchDigitalItems.mockResolvedValue({ data: [], meta: { activeCat: 'all', totalItems: 0 } })
  api.fetchDigitalRedemptions.mockResolvedValue({ data: [], meta: { totalItems: 0 } })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('routes', () => {
  it('declares S10 and S11 with the live tab titles and shell headers, for every role', () => {
    const byPath = Object.fromEntries(digitalRoutes.map((r) => [r.path, r.meta]))
    expect(byPath['/cikgu/hadiah']).toMatchObject({
      layout: 'user',
      title: 'Kedai Hadiah Digital',
      header: { title: 'Kedai Hadiah Digital', subtitle: 'Selamat datang kembali' },
    })
    expect(byPath['/cikgu/hadiah/saya']).toMatchObject({
      title: 'Tebusan Saya',
      header: { title: 'Tebusan Saya', subtitle: 'Selamat datang kembali' },
    })
    for (const r of digitalRoutes) expect(r.meta?.roles).toBeUndefined()
    expect(digitalRoutes.map((r) => r.path)).not.toContain('/cikgu/hadiah/:id')
  })
})

describe('activeChipKey (BR-M15-27)', () => {
  it('maps absent / all / known / unknown / repeated values', () => {
    expect(activeChipKey(undefined)).toBe('all')
    expect(activeChipKey('all')).toBe('all')
    expect(activeChipKey('flagship')).toBe('flagship')
    expect(activeChipKey('bogus')).toBeNull()
    expect(activeChipKey('')).toBeNull()
    expect(activeChipKey(['gaming', 'telco'])).toBeNull()
  })
})

describe('S10 DigitalShopPage', () => {
  it('shows the title, the balance card, ten chips and the empty line', async () => {
    const w = await mountAt(DigitalShopPage, '/cikgu/hadiah')
    expect(w.get('h1').text()).toBe('🎁 Kedai Hadiah Digital')
    expect(w.text()).toContain('Tukar token kepada hadiah digital — terus dihantar, tanpa pos.')
    expect(w.get('[data-testid="digital-token-label"]').text()).toBe('Token Anda')
    expect(w.get('[data-testid="digital-token-label"]').classes()).toContain('uppercase')
    expect(w.get('[data-testid="digital-token"]').text()).toBe('0')
    expect(w.get('[data-testid="digital-syiling-label"]').text()).toBe('Syiling')
    expect(w.get('[data-testid="digital-syiling-label"]').classes()).toContain('uppercase')
    expect(w.get('[data-testid="digital-syiling"]').text()).toBe('256')
    expect(w.get('[data-testid="digital-caption"]').text()).toBe('50 syiling = 1 token')
    const link = w.get('[data-testid="digital-my-redemptions"]')
    expect(link.text()).toBe('Tebusan Saya')
    expect(link.attributes('href')).toBe('/cikgu/hadiah/saya')
    expect(w.get('[data-testid="digital-empty"]').text()).toBe('Tiada hadiah dalam kategori ini.')
    expect(w.text()).not.toContain('Tebus ')
  })

  it('lists the chips in order with the live labels and ?cat= hrefs; Semua alone is active', async () => {
    const w = await mountAt(DigitalShopPage, '/cikgu/hadiah')
    const chips = w.findAll('[data-testid="digital-chips"] a')
    expect(chips.map((c) => c.text())).toEqual([
      '🌟 Semua',
      '🏆 Mahkota',
      '💳 E-Wallet',
      '📱 Telco',
      '🎮 Gaming',
      '🎬 Streaming',
      '🍔 Makan & Minum',
      '🛒 Shopping',
      '📚 Pembelajaran',
      '🎭 Hiburan',
    ])
    expect(chips.map((c) => c.attributes('href'))).toEqual(
      DIGITAL_CHIPS.map((c) => `/cikgu/hadiah?cat=${c.key}`),
    )
    expect(
      chips.filter((c) => c.attributes('data-active') === 'true').map((c) => c.text()),
    ).toEqual(['🌟 Semua'])
  })

  it('makes the followed chip the only active one and sends cat to #19', async () => {
    const w = await mountAt(DigitalShopPage, '/cikgu/hadiah?cat=flagship')
    const active = w.findAll('[data-testid="digital-chips"] a[data-active="true"]')
    expect(active.map((c) => c.text())).toEqual(['🏆 Mahkota'])
    expect(api.fetchDigitalItems).toHaveBeenCalledWith(expect.objectContaining({ cat: 'flagship' }))
    expect(w.find('[data-testid="digital-empty"]').exists()).toBe(true)
  })

  it('an unknown cat keeps the page and the empty copy with no chip active', async () => {
    const w = await mountAt(DigitalShopPage, '/cikgu/hadiah?cat=bogus')
    expect(w.findAll('[data-testid="digital-chips"] a[data-active="true"]')).toHaveLength(0)
    expect(w.get('[data-testid="digital-empty"]').text()).toBe('Tiada hadiah dalam kategori ini.')
  })

  it('uses the viewer tier rate and balances from the wallet read', async () => {
    wallet.fetchGamificationWallet.mockResolvedValue({
      ...WALLET,
      tokenBalance: 20,
      currentSyiling: 300,
      tier: { conversionRate: 40 },
    })
    const w = await mountAt(DigitalShopPage, '/cikgu/hadiah')
    expect(w.get('[data-testid="digital-token"]').text()).toBe('20')
    expect(w.get('[data-testid="digital-syiling"]').text()).toBe('300')
    expect(w.get('[data-testid="digital-caption"]').text()).toBe('40 syiling = 1 token')
    expect(w.text()).not.toContain('100 syiling')
  })

  it('shows the shared load error with a retry when the wallet read fails', async () => {
    wallet.fetchGamificationWallet.mockRejectedValueOnce(new Error('x'))
    const w = await mountAt(DigitalShopPage, '/cikgu/hadiah')
    expect(w.get('[data-testid="m15-load-error"]').text()).toContain(
      'Maaf, berlaku ralat. Sila cuba semula.',
    )
    expect(w.find('[data-testid="digital-empty"]').exists()).toBe(false)
    await w.get('[data-testid="m15-retry"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="digital-empty"]').exists()).toBe(true)
  })

  it('keeps the live control height (about 32px) on the chips and the S11 link', async () => {
    const w = await mountAt(DigitalShopPage, '/cikgu/hadiah')
    expect(w.get('[data-testid="digital-chip-all"]').classes()).toContain('min-h-8')
    expect(w.get('[data-testid="digital-chip-all"]').classes()).not.toContain('min-h-11')
  })
})

describe('S11 MyRedemptionsPage', () => {
  it('shows the title row, the back link and the empty card with its link', async () => {
    const w = await mountAt(MyRedemptionsPage, '/cikgu/hadiah/saya')
    expect(w.get('h1').text()).toBe('📋 Tebusan Saya')
    const back = w.get('[data-testid="redemptions-to-shop"]')
    expect(back.text()).toBe('🎁 Kedai Hadiah')
    expect(back.attributes('href')).toBe('/cikgu/hadiah')
    const card = w.get('[data-testid="redemptions-empty"]')
    expect(card.get('[data-testid="redemptions-icon"]').text()).toBe('🎁')
    expect(card.get('[data-testid="redemptions-icon"]').classes()).toContain('text-5xl')
    expect(card.text()).toContain(
      'Belum ada tebusan. Kumpul syiling dulu, lepas tukar token dan tebus hadiah.',
    )
    const browse = w.get('[data-testid="redemptions-browse"]')
    expect(browse.text()).toBe('Layari Kedai Hadiah')
    expect(browse.attributes('href')).toBe('/cikgu/hadiah')
    expect(w.findAll('li, table, select')).toHaveLength(0)
  })

  it('builds no populated list: the empty state shows even if the read returned rows', async () => {
    api.fetchDigitalRedemptions.mockResolvedValue({ data: [{ id: 1 }], meta: { totalItems: 1 } })
    const w = await mountAt(MyRedemptionsPage, '/cikgu/hadiah/saya')
    expect(api.fetchDigitalRedemptions).toHaveBeenCalledTimes(1)
    expect(w.find('[data-testid="redemptions-empty"]').exists()).toBe(true)
  })

  it('shows the shared load error when #20 fails', async () => {
    api.fetchDigitalRedemptions.mockRejectedValueOnce(new Error('x'))
    const w = await mountAt(MyRedemptionsPage, '/cikgu/hadiah/saya')
    expect(w.find('[data-testid="m15-load-error"]').exists()).toBe(true)
    expect(w.find('[data-testid="redemptions-empty"]').exists()).toBe(false)
  })
})
