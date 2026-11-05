// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type {
  CabutanView,
  DrawResultView,
  MysteryBoxOpened,
  MysteryBoxView,
  MysteryBoxesView,
  OpenDrawView,
} from '../api'
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
  ticketsSold: 7,
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
    expect(w.get('[data-testid="box-2-ribbon"]').text()).toBe('Rare')
    expect(w.get('[data-testid="box-3-ribbon"]').text()).toBe('Epic')
    expect(w.get('[data-testid="box-4-ribbon"]').text()).toBe('Legendary')
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

describe('MysteryResultModal', () => {
  // The e2e hook sits in the dialog body, because UModal / UDrawer drop attrs given to DsDialog.
  it('carries data-testid="box-result" in the dialog body, only with a result', () => {
    const stubs = { DsDialog: { template: '<section><slot /></section>' } }
    const opened = { boxName: 'Kotak Gangsa', coins: 12, xp: 4 } as MysteryBoxOpened
    const shown = mount(MysteryResultModal, { props: { result: opened }, global: { stubs } })
    expect(shown.get('[data-testid="box-result"]').text()).toContain('Kotak Gangsa')
    expect(shown.element.getAttribute('data-testid')).toBeNull()
    const closed = mount(MysteryResultModal, { props: { result: null }, global: { stubs } })
    expect(closed.find('[data-testid="box-result"]').exists()).toBe(false)
  })
})

describe('S7 CabutanPage', () => {
  const view = (draws: OpenDrawView[], syilingBalance = 256, results: DrawResultView[] = []): CabutanView => ({
    syilingBalance,
    draws,
    results,
  })

  /** The real DsDialog teleports into a modal; the stub renders its slots in place while open. */
  const DIALOG_STUB = {
    props: ['open', 'title', 'loading'],
    template: '<section v-if="open" data-testid="dialog" :data-title="title"><slot /><footer><slot name="footer" /></footer></section>',
  }
  async function mountCabutan() {
    wrapper = mount(CabutanPage, { global: { stubs: { teleport: true, DsDialog: DIALOG_STUB } }, attachTo: document.body })
    await flushPromises()
    return wrapper
  }

  it('shows the header, the syiling tile, "Cabutan Dibuka" and the empty box', async () => {
    api.fetchCabutan.mockResolvedValue(view([]))
    const w = await mountCabutan()
    expect(w.get('h1').text()).toBe('🎟️ Cabutan Bertuah')
    expect(w.text()).toContain('Guna syiling untuk beli tiket & menangi hadiah hebat!')
    expect(w.get('[data-testid="cabutan-tile"]').text()).toContain('Syiling anda')
    expect(w.get('[data-testid="cabutan-balance"]').text()).toBe('256')
    expect(w.get('h2').text()).toBe('Cabutan Dibuka')
    expect(w.get('[data-testid="cabutan-empty"]').text()).toBe(
      'Tiada cabutan dibuka buat masa ini. Nanti datang lagi! 🎈',
    )
    expect(w.find('[data-testid="cabutan-results"]').exists()).toBe(false)
  })

  it('renders a card per open draw with the fairness lines, then confirms and buys one ticket with one key', async () => {
    api.fetchCabutan.mockResolvedValueOnce(view([DRAW]))
    api.buyCabutanTicket.mockResolvedValue({ drawId: 1, ticketsOwned: 1, syilingBalance: 206 })
    api.fetchCabutan.mockResolvedValue(view([{ ...DRAW, ticketsOwned: 1, ticketsSold: 8 }], 206))
    const w = await mountCabutan()
    const card = w.get('[data-testid="draw-1"]')
    expect(card.text()).toContain('Cabutan Demo')
    expect(card.get('[data-testid="draw-price"]').text()).toBe('Harga tiket: 50')
    expect(card.get('[data-testid="draw-owned"]').text()).toBe('Tiket anda: 0/10')
    expect(card.get('[data-testid="draw-closes"]').text()).toBe('Tutup: 30/09/2026')
    expect(card.get('[data-testid="draw-fair-equal"]').text()).toBe('Setiap tiket mempunyai peluang yang sama.')
    expect(card.get('[data-testid="draw-sold"]').text()).toBe('Jumlah tiket terjual: 7')
    expect(card.get('[data-testid="draw-coin-note"]').text()).toBe('Tiket dibeli dengan syiling yang anda kumpul, bukan wang.')
    expect(card.findAll('[data-testid="draw-prize"]').map((n) => n.text())).toEqual([
      'Baucar Topup RM50 × 1',
      'Baucar RM5 × 10',
    ])
    expect(w.find('[data-testid="cabutan-empty"]').exists()).toBe(false)
    // B-056a: the press asks first; nothing is bought yet.
    expect(w.find('[data-testid="dialog"]').exists()).toBe(false)
    await card.get('[data-testid="draw-buy"]').trigger('click')
    await flushPromises()
    expect(api.buyCabutanTicket).not.toHaveBeenCalled()
    expect(w.get('[data-testid="dialog"]').attributes('data-title')).toBe('Beli tiket cabutan?')
    expect(w.get('[data-testid="draw-confirm-body"]').text()).toBe('50 syiling akan ditolak daripada baki anda (256 syiling).')
    expect(w.get('[data-testid="draw-confirm-cancel"]').text()).toBe('Batal')
    expect(w.get('[data-testid="draw-confirm-buy"]').text()).toBe('Beli Tiket')
    await w.get('[data-testid="draw-confirm-buy"]').trigger('click')
    await flushPromises()
    expect(api.buyCabutanTicket).toHaveBeenCalledTimes(1)
    expect(api.buyCabutanTicket).toHaveBeenCalledWith(1, expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/))
    expect(w.find('[data-testid="dialog"]').exists()).toBe(false)
    expect(w.get('[data-testid="cabutan-balance"]').text()).toBe('206')
    expect(w.get('[data-testid="draw-owned"]').text()).toBe('Tiket anda: 1/10')
    expect(w.get('[data-testid="draw-sold"]').text()).toBe('Jumlah tiket terjual: 8')
  })

  it('"Batal" closes the dialog and buys nothing; each press gets its own key', async () => {
    api.fetchCabutan.mockResolvedValue(view([DRAW]))
    api.buyCabutanTicket.mockResolvedValue({ drawId: 1, ticketsOwned: 1, syilingBalance: 206 })
    const w = await mountCabutan()
    await w.get('[data-testid="draw-buy"]').trigger('click')
    // B-056a: the safe button has the default focus.
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(document.activeElement).toBe(w.get('[data-testid="draw-confirm-cancel"]').element)
    await w.get('[data-testid="draw-confirm-cancel"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="dialog"]').exists()).toBe(false)
    expect(api.buyCabutanTicket).not.toHaveBeenCalled()
    for (let i = 0; i < 2; i++) {
      await w.get('[data-testid="draw-buy"]').trigger('click')
      await w.get('[data-testid="draw-confirm-buy"]').trigger('click')
      await flushPromises()
    }
    const keys = api.buyCabutanTicket.mock.calls.map((c) => c[1])
    expect(keys).toHaveLength(2)
    expect(keys[0]).not.toBe(keys[1])
  })

  it('a double click on the confirm button buys one ticket (AC-GM-22.7, AC-MUR-22-3)', async () => {
    api.fetchCabutan.mockResolvedValue(view([DRAW]))
    let release: (v: { drawId: number; ticketsOwned: number; syilingBalance: number }) => void = () => undefined
    api.buyCabutanTicket.mockReturnValue(new Promise((r) => (release = r)))
    const w = await mountCabutan()
    await w.get('[data-testid="draw-buy"]').trigger('click')
    const confirm = w.get('[data-testid="draw-confirm-buy"]')
    await confirm.trigger('click')
    await confirm.trigger('click')
    release({ drawId: 1, ticketsOwned: 1, syilingBalance: 206 })
    await flushPromises()
    expect(api.buyCabutanTicket).toHaveBeenCalledTimes(1)
  })

  it('lists "Keputusan Cabutan" with winners by first name and "Anda menang!" for the pupil', async () => {
    api.fetchCabutan.mockResolvedValue(
      view([], 256, [
        {
          id: 9,
          title: 'Cabutan Merdeka',
          winners: [
            { prize: 'Hadiah Utama', name: 'Zahra', isYou: false },
            { prize: 'Hadiah Saguhati', name: 'Aiman', isYou: true },
          ],
        },
      ]),
    )
    const w = await mountCabutan()
    const section = w.get('[data-testid="cabutan-results"]')
    expect(section.get('h2').text()).toBe('Keputusan Cabutan')
    const card = section.get('[data-testid="result-9"]')
    expect(card.get('h3').text()).toBe('Cabutan Merdeka')
    const rows = card.findAll('[data-testid="result-winner"]').map((n) => n.text())
    expect(rows).toEqual(['Hadiah Utama: Zahra', 'Hadiah Saguhati: Anda menang!'])
    expect(card.text()).not.toContain('Aiman')
  })

  it('disables the buy button below the price and at the ticket cap', async () => {
    api.fetchCabutan.mockResolvedValue(view([DRAW], 40))
    let w = await mountCabutan()
    expect(w.get('[data-testid="draw-buy"]').attributes('disabled')).toBeDefined()
    w.unmount()
    api.fetchCabutan.mockResolvedValue(view([{ ...DRAW, ticketsOwned: 10 }], 256))
    w = await mountCabutan()
    expect(w.get('[data-testid="draw-buy"]').attributes('disabled')).toBeDefined()
  })

  it('omits the close line when the draw has no close date', async () => {
    api.fetchCabutan.mockResolvedValue(view([{ ...DRAW, closesAt: null }]))
    const w = await mountCabutan()
    expect(w.find('[data-testid="draw-closes"]').exists()).toBe(false)
  })

  it.each([
    ['TICKET_LIMIT', 'Had tiket dicapai.'],
    ['DRAW_CLOSED', 'Cabutan ditutup.'],
    ['INSUFFICIENT_BALANCE', 'Baki syiling tidak mencukupi.'],
  ])('flashes the server message of a %s refusal (AC-GM-22.2, AC-GM-22.3, AC-MUR-22-2)', async (code, message) => {
    api.fetchCabutan.mockResolvedValue(view([DRAW]))
    api.buyCabutanTicket.mockRejectedValue(new ApiError({ status: 409, code, message }))
    const w = await mountCabutan()
    await w.get('[data-testid="draw-buy"]').trigger('click')
    await w.get('[data-testid="draw-confirm-buy"]').trigger('click')
    await flushPromises()
    expect(useFlashStore().current?.message).toBe(message)
    expect(w.find('[data-testid="dialog"]').exists()).toBe(false)
  })

  it('keeps the shared copy for an error that is not a refusal', async () => {
    api.fetchCabutan.mockResolvedValue(view([DRAW]))
    api.buyCabutanTicket.mockRejectedValue(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'boom' }))
    const w = await mountCabutan()
    await w.get('[data-testid="draw-buy"]').trigger('click')
    await w.get('[data-testid="draw-confirm-buy"]').trigger('click')
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
