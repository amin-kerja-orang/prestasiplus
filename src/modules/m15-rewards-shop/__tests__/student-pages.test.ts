// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type {
  CabutanView,
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

const PRIZES: MysteryBoxView['prizes'] = [
  { label: '10 syiling', kind: 'syiling', amount: 10, chance: 40 },
  { label: '25 syiling', kind: 'syiling', amount: 25, chance: 25 },
  { label: '60 syiling', kind: 'syiling', amount: 60, chance: 15 },
  { label: '1 token', kind: 'token', amount: 1, chance: 10 },
  { label: '150 syiling', kind: 'syiling', amount: 150, chance: 6 },
  { label: '3 token', kind: 'token', amount: 3, chance: 3 },
  { label: '500 syiling — jackpot!', kind: 'syiling', amount: 500, chance: 1 },
]

const BOX: MysteryBoxView = { id: 5, label: 'Kotak Misteri', costSyiling: 50, prizes: PRIZES }

const boxView = (
  syilingBalance: number,
  over: Partial<MysteryBoxesView> = {},
): MysteryBoxesView => ({
  box: BOX,
  available: true,
  syilingBalance,
  dailyMax: 5,
  openedToday: 0,
  history: [],
  ...over,
})

const OPENED: MysteryBoxOpened = {
  openingId: 9000001,
  boxId: 5,
  boxName: 'Kotak Misteri',
  prize: { label: '25 syiling', kind: 'syiling', amount: 25 },
  tokenBalance: 0,
  syilingBalance: 55,
}

/** A dialog that renders its body and footer inline while open (the real one teleports and traps focus). */
const DialogStub = {
  props: ['open', 'title'],
  template: '<section v-if="open" :data-title="title"><slot /><slot name="footer" /></section>',
}

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
  const mountBox = async () => {
    const stub = { template: '<div />' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: stub },
        { path: '/practice', component: stub },
      ],
    })
    await router.push('/')
    wrapper = mount(MysteryBoxPage, {
      global: { plugins: [router], stubs: { teleport: true, DsDialog: DialogStub } },
      attachTo: document.body,
    })
    await flushPromises()
    return wrapper
  }

  it('renders one card: cost, balance, the odds table with seven rows and the disclaimer', async () => {
    api.fetchMysteryBoxes.mockResolvedValue(boxView(80))
    const w = await mountBox()
    expect(w.get('h1').text()).toBe('📦 Kotak Misteri')
    expect(w.findAll('[data-testid="box-hero"]')).toHaveLength(1)
    expect(w.get('[data-testid="box-cost"]').text()).toBe('Kos satu kotak 50 syiling')
    expect(w.get('[data-testid="box-chip"]').text()).toBe('Baki syiling anda:80')
    expect(w.get('h2').text()).toBe('Peluang ganjaran')
    const rows = w.findAll('[data-testid="box-odds-table"] tbody tr')
    expect(rows).toHaveLength(7)
    expect(rows[0]?.text()).toBe('10 syiling40%')
    expect(rows[6]?.text()).toBe('500 syiling — jackpot!1%')
    expect(w.get('[data-testid="box-disclaimer"]').text()).toBe(
      'Purata ganjaran lebih rendah daripada kos kotak — main untuk keseronokan, bukan untuk mengumpul syiling.',
    )
    expect(w.get('[data-testid="box-btn"]').text()).toBe('Buka Kotak')
    expect(w.get('[data-testid="box-btn"]').attributes('disabled')).toBeUndefined()
    // AC-GM-23.7: the table scrolls inside its own container.
    const scroll = w.get('[data-testid="box-odds-scroll"]')
    expect(scroll.classes()).toContain('overflow-x-auto')
    expect(scroll.find('[data-testid="box-odds-table"] thead').text()).toBe('GanjaranPeluang')
  })

  it('AC-GM-23.4: at 40 syiling it says how many more are needed, offers Kumpul syiling and disables the open button', async () => {
    api.fetchMysteryBoxes.mockResolvedValue(boxView(40))
    const w = await mountBox()
    expect(w.get('[data-testid="box-short"]').text()).toBe(
      'Anda perlu 10 syiling lagi untuk membuka kotak.',
    )
    expect(w.get('[data-testid="box-collect"]').text()).toBe('Kumpul syiling')
    expect(w.get('[data-testid="box-collect"]').attributes('href')).toBe('/practice')
    const btn = w.get('[data-testid="box-btn"]')
    expect(btn.text()).toBe('Syiling Tidak Cukup')
    expect(btn.attributes('disabled')).toBeDefined()
    await w.get('[data-testid="box-card"] form').trigger('submit')
    expect(w.find('[data-testid="box-confirm-ok"]').exists()).toBe(false)
    expect(api.openMysteryBox).not.toHaveBeenCalled()
  })

  it('AC-GM-23.3: at the daily limit it shows the limit text and the button is disabled', async () => {
    api.fetchMysteryBoxes.mockResolvedValue(boxView(200, { openedToday: 5 }))
    const w = await mountBox()
    expect(w.get('[data-testid="box-daily"]').text()).toBe(
      'Had kotak hari ini telah dicapai. Cuba lagi esok.',
    )
    expect(w.get('[data-testid="box-btn"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-testid="box-short"]').exists()).toBe(false)
  })

  it('N5: no prize can be won - the notice shows, the table and disclaimer stay, the button is disabled', async () => {
    api.fetchMysteryBoxes.mockResolvedValue(
      boxView(80, { available: false, box: { ...BOX, prizes: [] } }),
    )
    const w = await mountBox()
    expect(w.get('[data-testid="box-unavailable"]').text()).toBe(
      'Kotak tidak tersedia buat masa ini.',
    )
    expect(w.get('[data-testid="box-btn"]').attributes('disabled')).toBeDefined()
    expect(w.get('h2').text()).toBe('Peluang ganjaran')
    expect(w.find('[data-testid="box-disclaimer"]').exists()).toBe(true)
  })

  it('N5: no active box (box null) shows the same notice with a disabled button', async () => {
    api.fetchMysteryBoxes.mockResolvedValue(boxView(80, { box: null, available: false }))
    const w = await mountBox()
    expect(w.find('[data-testid="box-unavailable"]').exists()).toBe(true)
    expect(w.find('[data-testid="box-cost"]').exists()).toBe(false)
    expect(w.get('[data-testid="box-btn"]').attributes('disabled')).toBeDefined()
  })

  it('shows the history block with its empty text when nothing was opened', async () => {
    api.fetchMysteryBoxes.mockResolvedValue(boxView(80))
    const w = await mountBox()
    expect(w.get('[data-testid="box-history"] h2').text()).toBe('Kotak yang telah dibuka')
    expect(w.get('[data-testid="box-history-empty"]').text()).toBe('Anda belum membuka sebarang kotak.')
    expect(w.find('[data-testid="box-history-row"]').exists()).toBe(false)
  })

  it('B-056f: the open button asks first; Batal has the focus and sends nothing', async () => {
    api.fetchMysteryBoxes.mockResolvedValue(boxView(80))
    const w = await mountBox()
    await w.get('[data-testid="box-card"] form').trigger('submit')
    await flushPromises()
    await new Promise((r) => setTimeout(r, 10))
    expect(w.get('[data-testid="box-confirm-body"]').text()).toBe(
      '50 syiling akan ditolak daripada baki anda (80 syiling).',
    )
    expect(w.get('[data-title]').attributes('data-title')).toBe('Buka kotak?')
    const cancel = w.get('[data-testid="box-confirm-cancel"]')
    expect(cancel.text()).toBe('Batal')
    expect(document.activeElement).toBe(cancel.element)
    expect(w.get('[data-testid="box-confirm-ok"]').text()).toBe('Buka Kotak')
    await cancel.trigger('click')
    expect(api.openMysteryBox).not.toHaveBeenCalled()
    expect(w.find('[data-testid="box-confirm-ok"]').exists()).toBe(false)
  })

  it('confirming sends {boxId, clientUuid} once, shows the prize and re-reads the history', async () => {
    api.fetchMysteryBoxes.mockResolvedValueOnce(boxView(80))
    api.openMysteryBox.mockResolvedValue(OPENED)
    api.fetchMysteryBoxes.mockResolvedValue(
      boxView(55, {
        openedToday: 1,
        history: [
          {
            id: 9000001,
            boxId: 5,
            boxName: 'Kotak Misteri',
            prizeLabel: '25 syiling',
            prizeKind: 'syiling',
            prizeAmount: 25,
            createdAt: '2026-09-25T15:40:00+08:00',
          },
        ],
      }),
    )
    const w = await mountBox()
    await w.get('[data-testid="box-card"] form').trigger('submit')
    await flushPromises()
    await w.get('[data-testid="box-confirm-ok"]').trigger('click')
    await flushPromises()
    expect(api.openMysteryBox).toHaveBeenCalledTimes(1)
    const [boxId, key] = api.openMysteryBox.mock.calls[0] as [number, string]
    expect(boxId).toBe(5)
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(w.findComponent(MysteryResultModal).props('result')).toMatchObject({
      prize: { label: '25 syiling' },
    })
    expect(w.get('[data-testid="box-chip"]').text()).toBe('Baki syiling anda:55')
    const row = w.get('[data-testid="box-history-row"]')
    expect(row.text()).toContain('Kotak Misteri: 25 syiling')
    expect(row.text()).toContain('25/09 15:40')
    w.findComponent(MysteryResultModal).vm.$emit('close')
    await flushPromises()
    expect(w.findComponent(MysteryResultModal).props('result')).toBeNull()
  })

  it('AC-MUR-35-5: a second submit while the first request runs sends nothing', async () => {
    api.fetchMysteryBoxes.mockResolvedValue(boxView(200))
    let release: (v: MysteryBoxOpened) => void = () => undefined
    api.openMysteryBox.mockReturnValue(new Promise<MysteryBoxOpened>((r) => (release = r)))
    const w = await mountBox()
    await w.get('[data-testid="box-card"] form').trigger('submit')
    await flushPromises()
    await w.get('[data-testid="box-confirm-ok"]').trigger('click')
    await w.get('[data-testid="box-card"] form').trigger('submit')
    await flushPromises()
    expect(w.find('[data-testid="box-confirm-ok"]').exists()).toBe(false)
    expect(api.openMysteryBox).toHaveBeenCalledTimes(1)
    release(OPENED)
    await flushPromises()
  })

  it('keeps the same clientUuid for a retry after a network failure, and a new one after the server answered', async () => {
    api.fetchMysteryBoxes.mockResolvedValue(boxView(200))
    api.openMysteryBox
      .mockRejectedValueOnce(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'x' }))
      .mockRejectedValueOnce(
        new ApiError({ status: 429, code: 'MYSTERY_DAILY_LIMIT', message: 'Had.' }),
      )
      .mockResolvedValue(OPENED)
    const w = await mountBox()
    const press = async () => {
      await w.get('[data-testid="box-card"] form').trigger('submit')
      await flushPromises()
      await w.get('[data-testid="box-confirm-ok"]').trigger('click')
      await flushPromises()
    }
    await press()
    await press()
    await press()
    const keys = api.openMysteryBox.mock.calls.map((c) => c[1] as string)
    expect(keys[1]).toBe(keys[0])
    expect(keys[2]).not.toBe(keys[1])
  })

  it('shows the server message in the flash when the opening is refused', async () => {
    api.fetchMysteryBoxes.mockResolvedValue(boxView(80))
    api.openMysteryBox.mockRejectedValue(
      new ApiError({
        status: 429,
        code: 'MYSTERY_DAILY_LIMIT',
        message: 'Had kotak hari ini telah dicapai. Cuba lagi esok.',
      }),
    )
    const w = await mountBox()
    await w.get('[data-testid="box-card"] form').trigger('submit')
    await flushPromises()
    await w.get('[data-testid="box-confirm-ok"]').trigger('click')
    await flushPromises()
    expect(useFlashStore().current?.message).toBe('Had kotak hari ini telah dicapai. Cuba lagi esok.')
    expect(w.findComponent(MysteryResultModal).props('result')).toBeNull()
  })

  it('shows the generic message for a network failure', async () => {
    api.fetchMysteryBoxes.mockResolvedValue(boxView(80))
    api.openMysteryBox.mockRejectedValue(new Error('x'))
    const w = await mountBox()
    await w.get('[data-testid="box-card"] form').trigger('submit')
    await flushPromises()
    await w.get('[data-testid="box-confirm-ok"]').trigger('click')
    await flushPromises()
    expect(useFlashStore().current?.message).toBe('Ralat berlaku. Sila cuba lagi.')
  })

  it('keeps the card and the prize when the re-read after an opening fails', async () => {
    api.fetchMysteryBoxes.mockResolvedValueOnce(boxView(80))
    api.openMysteryBox.mockResolvedValue(OPENED)
    api.fetchMysteryBoxes.mockRejectedValue(new Error('x'))
    const w = await mountBox()
    await w.get('[data-testid="box-card"] form').trigger('submit')
    await flushPromises()
    await w.get('[data-testid="box-confirm-ok"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="m15-load-error"]').exists()).toBe(false)
    expect(w.find('[data-testid="box-card"]').exists()).toBe(true)
    expect(w.findComponent(MysteryResultModal).props('result')).toMatchObject({ openingId: 9000001 })
  })
})

describe('MysteryResultModal', () => {
  // The e2e hook sits in the dialog body, because UModal / UDrawer drop attrs given to DsDialog.
  it('carries data-testid="box-result" in the dialog body, only with a result', () => {
    const stubs = { DsDialog: { template: '<section><slot /></section>' } }
    const shown = mount(MysteryResultModal, { props: { result: OPENED }, global: { stubs } })
    expect(shown.get('[data-testid="box-result"]').text()).toContain('Tahniah! Anda dapat 25 syiling.')
    expect(shown.get('[data-testid="box-result-reward"]').text()).toBe('+25 🪙')
    expect(shown.element.getAttribute('data-testid')).toBeNull()
    const token = mount(MysteryResultModal, {
      props: { result: { ...OPENED, prize: { label: '3 token', kind: 'token', amount: 3 } } },
      global: { stubs },
    })
    expect(token.get('[data-testid="box-result-reward"]').text()).toBe('+3 token')
    const closed = mount(MysteryResultModal, { props: { result: null }, global: { stubs } })
    expect(closed.find('[data-testid="box-result"]').exists()).toBe(false)
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
