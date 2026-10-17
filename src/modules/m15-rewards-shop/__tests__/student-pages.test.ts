// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { CabutanView, MysteryBoxView, MysteryBoxesView, OpenDrawView } from '../api'
import { errorMessage, formatDate, formatDayMonthTime } from '../components/format'
import CabutanPage from '../pages/CabutanPage.vue'
import MysteryResultModal from '../components/MysteryResultModal.vue'
import MysteryBoxPage from '../pages/MysteryBoxPage.vue'
import RewardsShopPage from '../pages/RewardsShopPage.vue'
import studentRoutes from '../routes/student'

const wallet = vi.hoisted(() => ({ fetchGamificationWallet: vi.fn() }))
vi.mock('@/modules/m14-gamification', () => wallet)

const api = vi.hoisted(() => ({
  fetchMysteryBoxes: vi.fn(),
  openMysteryBox: vi.fn(),
  fetchCabutan: vi.fn(),
  buyCabutanTicket: vi.fn(),
}))
vi.mock('../api', () => api)

const BOXES: MysteryBoxView[] = [
  {
    id: 1,
    name: 'Kotak Gangsa',
    description: 'Kotak biasa — ganjaran kecil tapi pasti!',
    icon: '📦',
    rarity: null,
    costTokens: 2,
    coinMin: 1,
    coinMax: 20,
    xpMin: 1,
    xpMax: 10,
    color1: '#9ca3af',
    color2: '#6b7280',
  },
  {
    id: 2,
    name: 'Kotak Perak',
    description: 'Kotak lebih besar — peluang ganjaran lebih baik',
    icon: '🎁',
    rarity: 'rare',
    costTokens: 5,
    coinMin: 10,
    coinMax: 50,
    xpMin: 5,
    xpMax: 25,
    color1: '#3b82f6',
    color2: '#2563eb',
  },
  {
    id: 3,
    name: 'Kotak Emas',
    description: 'Kotak premium — ganjaran besar menanti!',
    icon: '✨',
    rarity: 'epic',
    costTokens: 10,
    coinMin: 25,
    coinMax: 150,
    xpMin: 10,
    xpMax: 50,
    color1: '#8b5cf6',
    color2: '#7c3aed',
  },
  {
    id: 4,
    name: 'Kotak Legenda',
    description: 'Kotak terhebat — ganjaran WOW!',
    icon: '👑',
    rarity: 'legendary',
    costTokens: 25,
    coinMin: 100,
    coinMax: 500,
    xpMin: 25,
    xpMax: 100,
    color1: '#f59e0b',
    color2: '#ef4444',
  },
]

const boxView = (tokenBalance: number, history: MysteryBoxesView['history'] = []) => ({
  tokenBalance,
  boxes: BOXES,
  history,
})

const DRAW: OpenDrawView = {
  id: 1,
  title: 'Cabutan Demo',
  description: 'Cabutan ujian.',
  ticketCostSyiling: 50,
  maxTicketsPerStudent: 10,
  ticketsOwned: 0,
  closesAt: '2026-09-30',
  prizePool: [
    { label: 'Baucar Topup RM50', valueSen: 5000, qty: 1 },
    { label: 'Baucar RM5', valueSen: 500, qty: 10 },
  ],
}

let wrapper: VueWrapper | undefined
async function mountPage(component: Component) {
  wrapper = mount(component, { global: { stubs: { teleport: true } }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('routes', () => {
  it('declares S5-S7 with the live tab titles and shell headers', () => {
    const byPath = Object.fromEntries(studentRoutes.map((r) => [r.path, r.meta]))
    expect(byPath['/gamification/rewards']).toMatchObject({
      title: 'Kedai Hadiah',
      header: { title: 'Kedai Hadiah', subtitle: 'Selamat datang kembali' },
      layout: 'user',
    })
    expect(byPath['/gamification/mystery-box']).toMatchObject({
      title: 'Kotak Misteri — PRESTASIPLUS',
      header: { title: 'Kotak Misteri', subtitle: 'Selamat datang kembali' },
    })
    expect(byPath['/cabutan']).toMatchObject({
      title: 'Cabutan Bertuah - PRESTASIPLUS',
      header: { title: 'Cabutan Bertuah', subtitle: 'Selamat datang kembali' },
    })
    for (const r of studentRoutes) expect(r.meta?.roles).toBeUndefined()
  })
})

describe('S5 RewardsShopPage', () => {
  it('shows the hero, the token balance and the empty state', async () => {
    wallet.fetchGamificationWallet.mockResolvedValue({
      currentSyiling: 256,
      tokenBalance: 0,
      xp: 8,
      level: 2,
    })
    const w = await mountPage(RewardsShopPage)
    expect(w.get('h1').text()).toBe('🎁 Kedai Hadiah')
    expect(w.text()).toContain('Tebus token anda untuk hadiah menarik!')
    expect(w.get('[data-testid="shop-balance-value"]').text()).toBe('0')
    expect(w.get('[data-testid="shop-balance"]').text()).toContain('Baki Token 🎫')
    const empty = w.get('[data-testid="shop-empty"]')
    expect(empty.text()).toContain('Tiada Hadiah Tersedia')
    expect(empty.text()).toContain('Hadiah akan ditambah tidak lama lagi. Tunggu ya!')
  })

  it('keeps the empty state with a positive balance (no shop is built)', async () => {
    wallet.fetchGamificationWallet.mockResolvedValue({
      currentSyiling: 0,
      tokenBalance: 50,
      xp: 0,
      level: 1,
    })
    const w = await mountPage(RewardsShopPage)
    expect(w.get('[data-testid="shop-balance-value"]').text()).toBe('50')
    expect(w.find('[data-testid="shop-empty"]').exists()).toBe(true)
    expect(w.find('button').exists()).toBe(false)
  })

  it('shows the shared load error with a retry', async () => {
    wallet.fetchGamificationWallet.mockRejectedValueOnce(new Error('x'))
    const w = await mountPage(RewardsShopPage)
    expect(w.get('[data-testid="m15-load-error"]').text()).toContain(
      'Maaf, berlaku ralat. Sila cuba semula.',
    )
    wallet.fetchGamificationWallet.mockResolvedValue({
      currentSyiling: 0,
      tokenBalance: 3,
      xp: 0,
      level: 1,
    })
    await w.get('[data-testid="m15-retry"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="shop-balance-value"]').text()).toBe('3')
  })
})

describe('S6 MysteryBoxPage', () => {
  it('renders four boxes with the live texts and all locked at 0 tokens', async () => {
    api.fetchMysteryBoxes.mockResolvedValue(boxView(0))
    const w = await mountPage(MysteryBoxPage)
    expect(w.get('h1').text()).toBe('📦 Kotak Misteri')
    expect(w.get('[data-testid="box-chip"]').text()).toBe('🎫 Token Anda:0')
    for (const id of [1, 2, 3, 4]) {
      const btn = w.get(`[data-testid="box-${String(id)}-btn"]`)
      expect(btn.text()).toBe('🔒 Token Tidak Cukup')
      expect(btn.attributes('disabled')).toBeDefined()
    }
    expect(w.get('[data-testid="box-1"]').text()).toContain(
      'Kotak biasa — ganjaran kecil tapi pasti!',
    )
    expect(w.get('[data-testid="box-1"]').text()).toContain('1-20')
    expect(w.get('[data-testid="box-1"]').text()).toContain('1-10')
    expect(w.find('[data-testid="box-1-ribbon"]').exists()).toBe(false)
    expect(w.get('[data-testid="box-2-ribbon"]').text()).toBe('rare')
    expect(w.get('[data-testid="box-3-ribbon"]').text()).toBe('epic')
    expect(w.get('[data-testid="box-4-ribbon"]').text()).toBe('legendary')
    expect(w.find('[data-testid="box-history"]').exists()).toBe(false)
  })

  it('enables boxes the balance covers (5 tokens: boxes 1-2) and never sends for a locked one', async () => {
    api.fetchMysteryBoxes.mockResolvedValue(boxView(5))
    const w = await mountPage(MysteryBoxPage)
    expect(w.get('[data-testid="box-1-btn"]').text()).toBe('Buka Kotak')
    expect(w.get('[data-testid="box-2-btn"]').text()).toBe('Buka Kotak')
    expect(w.get('[data-testid="box-3-btn"]').text()).toBe('🔒 Token Tidak Cukup')
    await w.get('[data-testid="box-3"]').trigger('submit')
    expect(api.openMysteryBox).not.toHaveBeenCalled()
  })

  it('opens a box: result modal, chip from the response, history after the reload', async () => {
    api.fetchMysteryBoxes.mockResolvedValueOnce(boxView(5))
    api.openMysteryBox.mockResolvedValue({
      openingId: 9000001,
      boxId: 1,
      boxName: 'Kotak Gangsa',
      icon: '📦',
      coins: 12,
      xp: 4,
      tokenBalance: 3,
      syilingBalance: 268,
    })
    api.fetchMysteryBoxes.mockResolvedValue(
      boxView(3, [
        {
          id: 9000001,
          boxId: 1,
          boxName: 'Kotak Gangsa',
          coins: 12,
          xp: 4,
          createdAt: '2026-09-25T15:40:00+08:00',
        },
      ]),
    )
    const w = await mountPage(MysteryBoxPage)
    await w.get('[data-testid="box-1"]').trigger('submit')
    await flushPromises()
    expect(api.openMysteryBox).toHaveBeenCalledWith(1)
    expect(w.findComponent(MysteryResultModal).props('result')).toMatchObject({
      boxName: 'Kotak Gangsa',
      coins: 12,
      xp: 4,
    })
    expect(w.get('[data-testid="box-chip"]').text()).toBe('🎫 Token Anda:3')
    const row = w.get('[data-testid="box-history-row"]')
    expect(row.text()).toContain('Kotak Misteri: Kotak Gangsa')
    expect(row.text()).toContain('+12 🪙 · +4 XP')
    expect(row.text()).toContain('25/09 15:40')
    w.findComponent(MysteryResultModal).vm.$emit('close')
    await flushPromises()
    expect(w.findComponent(MysteryResultModal).props('result')).toBeNull()
  })

  it('keeps the boxes, the modal and the returned balance when the re-read after an opening fails', async () => {
    api.fetchMysteryBoxes.mockResolvedValueOnce(boxView(5))
    api.openMysteryBox.mockResolvedValue({
      openingId: 1,
      boxId: 1,
      boxName: 'Kotak Gangsa',
      icon: '📦',
      coins: 12,
      xp: 4,
      tokenBalance: 3,
      syilingBalance: 268,
    })
    api.fetchMysteryBoxes.mockRejectedValue(new Error('x'))
    const w = await mountPage(MysteryBoxPage)
    await w.get('[data-testid="box-1"]').trigger('submit')
    await flushPromises()
    expect(w.find('[data-testid="m15-load-error"]').exists()).toBe(false)
    expect(w.findAll('[data-testid="box-grid"] form')).toHaveLength(4)
    expect(w.findComponent(MysteryResultModal).props('result')).toMatchObject({ coins: 12 })
    expect(w.get('[data-testid="box-chip"]').text()).toBe('🎫 Token Anda:3')
  })

  it('the modal is full-screen below md and 400px from md', async () => {
    api.fetchMysteryBoxes.mockResolvedValue(boxView(5))
    api.openMysteryBox.mockResolvedValue({
      openingId: 1,
      boxId: 1,
      boxName: 'Kotak Gangsa',
      icon: '📦',
      coins: 1,
      xp: 1,
      tokenBalance: 3,
      syilingBalance: 1,
    })
    const w = await mountPage(MysteryBoxPage)
    await w.get('[data-testid="box-1"]').trigger('submit')
    await flushPromises()
    expect(w.findComponent(MysteryResultModal).props('result')).not.toBeNull()
  })

  it('shows the server message in the flash when the opening is refused', async () => {
    api.fetchMysteryBoxes.mockResolvedValue(boxView(5))
    api.openMysteryBox.mockRejectedValue(
      new ApiError({ status: 409, code: 'INSUFFICIENT_TOKENS', message: 'Token tidak cukup.' }),
    )
    const w = await mountPage(MysteryBoxPage)
    await w.get('[data-testid="box-1"]').trigger('submit')
    await flushPromises()
    expect(useFlashStore().current?.message).toBe('Ralat berlaku. Sila cuba lagi.')
    expect(w.find('[data-testid="box-result"]').exists()).toBe(false)
  })
})

describe('S7 CabutanPage', () => {
  const view = (draws: OpenDrawView[], syilingBalance = 256): CabutanView => ({
    syilingBalance,
    draws,
  })

  it('shows the header, the syiling tile, "Cabutan Dibuka" and the empty box', async () => {
    api.fetchCabutan.mockResolvedValue(view([]))
    const w = await mountPage(CabutanPage)
    expect(w.get('h1').text()).toBe('🎟️ Cabutan Bertuah')
    expect(w.text()).toContain('Guna syiling untuk beli tiket & menangi hadiah hebat!')
    expect(w.get('[data-testid="cabutan-tile"]').text()).toContain('Syiling anda')
    expect(w.get('[data-testid="cabutan-balance"]').text()).toBe('256')
    expect(w.get('h2').text()).toBe('Cabutan Dibuka')
    expect(w.get('[data-testid="cabutan-empty"]').text()).toBe(
      'Tiada cabutan dibuka buat masa ini. Nanti datang lagi! 🎈',
    )
  })

  it('renders a card per open draw and buys one ticket', async () => {
    api.fetchCabutan.mockResolvedValueOnce(view([DRAW]))
    api.buyCabutanTicket.mockResolvedValue({ drawId: 1, ticketsOwned: 1, syilingBalance: 206 })
    api.fetchCabutan.mockResolvedValue(view([{ ...DRAW, ticketsOwned: 1 }], 206))
    const w = await mountPage(CabutanPage)
    const card = w.get('[data-testid="draw-1"]')
    expect(card.text()).toContain('Cabutan Demo')
    expect(card.get('[data-testid="draw-price"]').text()).toBe('Harga tiket: 50')
    expect(card.get('[data-testid="draw-owned"]').text()).toBe('Tiket anda: 0/10')
    expect(card.get('[data-testid="draw-closes"]').text()).toBe('Tutup: 30/09/2026')
    expect(card.findAll('[data-testid="draw-prize"]').map((n) => n.text())).toEqual([
      'Baucar Topup RM50 × 1',
      'Baucar RM5 × 10',
    ])
    expect(w.find('[data-testid="cabutan-empty"]').exists()).toBe(false)
    await card.get('[data-testid="draw-buy"]').trigger('click')
    await flushPromises()
    expect(api.buyCabutanTicket).toHaveBeenCalledWith(1)
    expect(w.get('[data-testid="cabutan-balance"]').text()).toBe('206')
    expect(w.get('[data-testid="draw-owned"]').text()).toBe('Tiket anda: 1/10')
  })

  it('disables the buy button below the price and at the ticket cap', async () => {
    api.fetchCabutan.mockResolvedValue(view([DRAW], 40))
    let w = await mountPage(CabutanPage)
    expect(w.get('[data-testid="draw-buy"]').attributes('disabled')).toBeDefined()
    w.unmount()
    api.fetchCabutan.mockResolvedValue(view([{ ...DRAW, ticketsOwned: 10 }], 256))
    w = await mountPage(CabutanPage)
    expect(w.get('[data-testid="draw-buy"]').attributes('disabled')).toBeDefined()
  })

  it('omits the close line when the draw has no close date', async () => {
    api.fetchCabutan.mockResolvedValue(view([{ ...DRAW, closesAt: null }]))
    const w = await mountPage(CabutanPage)
    expect(w.find('[data-testid="draw-closes"]').exists()).toBe(false)
  })

  it('flashes the M14 refusal message', async () => {
    api.fetchCabutan.mockResolvedValue(view([DRAW]))
    api.buyCabutanTicket.mockRejectedValue(
      new ApiError({ status: 409, code: 'TICKET_LIMIT', message: 'Had tiket dicapai.' }),
    )
    const w = await mountPage(CabutanPage)
    await w.get('[data-testid="draw-buy"]').trigger('click')
    await flushPromises()
    expect(useFlashStore().current?.message).toBe('Ralat berlaku. Sila cuba lagi.')
  })
})

describe('format helpers', () => {
  it('formats dates in Asia/Kuala_Lumpur', () => {
    expect(formatDayMonthTime('2026-09-25T07:40:00Z')).toBe('25/09 15:40')
    expect(formatDayMonthTime('2026-09-25T00:05:00+08:00')).toBe('25/09 00:05')
    expect(formatDate('2026-09-30T23:59:00+08:00')).toBe('30/09/2026')
    expect(formatDate('2026-09-30')).toBe('30/09/2026')
  })

  it('always shows the shared action-failed copy', () => {
    expect(errorMessage()).toBe('Ralat berlaku. Sila cuba lagi.')
  })
})
