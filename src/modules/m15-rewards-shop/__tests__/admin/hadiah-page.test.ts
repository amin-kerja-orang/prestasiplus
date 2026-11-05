// @vitest-environment jsdom
/**
 * R1-ADM-P2-07 `/admin/hadiah` against a mocked client (S7-T11; 30 P2-07, P07-01 and P07-15): the four tiles, the
 * category pills, the table, 50 a page with an out-of-range page sent to the last, the bulk toolbar with its seven
 * actions, `Padam` keeping a reward that has a redemption, the "Tebusan Queue" card and the three routes.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import AdminHadiahPage from '../../pages/AdminHadiahPage.vue'
import AdminRedemptionsPage from '../../pages/AdminRedemptionsPage.vue'
import routes from '../../routes/admin'
import { DsDialogStub, hadiahRow, listBody, queueBody, redemptionRow, routerAt } from './support'

const api = vi.hoisted(() => ({
  fetchHadiahList: vi.fn(),
  fetchHadiah: vi.fn(),
  createHadiah: vi.fn(),
  updateHadiah: vi.fn(),
  bulkHadiah: vi.fn(),
  fetchRedemptions: vi.fn(),
  deliverRedemption: vi.fn(),
  cancelRedemption: vi.fn(),
}))
vi.mock('../../api/admin', () => api)

const ROWS = [
  hadiahRow(),
  hadiahRow({ id: '2', title: 'TnG eWallet RM10', vendor: 'Touch n Go', category: 'ewallet', iconEmoji: '💳', isActive: true, stockQuantity: 5, redemptionCount: 0 }),
  hadiahRow({ id: '3', title: 'Telco RM5', vendor: 'Hotlink', category: 'telco', iconEmoji: '📱', denominationRm: 5.5, tokenCost: 1500, redemptionCount: 0 }),
]

async function open(at = '/admin/hadiah', props: Record<string, unknown> = {}): Promise<{ w: VueWrapper; router: ReturnType<typeof routerAt> }> {
  const router = routerAt()
  await router.push(at)
  await router.isReady()
  const w = mount(AdminHadiahPage, {
    props,
    global: { plugins: [router], stubs: { DsDialog: DsDialogStub } },
    attachTo: document.body,
  })
  await flushPromises()
  return { w, router }
}

const tid = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`)
const flash = () => useFlashStore().current
const listCalls = () => api.fetchHadiahList.mock.calls.map((c) => c[0])

async function select(w: VueWrapper, ...ids: string[]) {
  const boxes = w.get('[data-testid="hadiah-table"]').findAll('input[type="checkbox"], button[role="checkbox"]')
  // [0] is "select all"; the rows follow in order.
  for (const id of ids) {
    const index = ROWS.findIndex((r) => r.id === id) + 1
    await boxes[index]!.trigger('click')
  }
  await flushPromises()
}

beforeEach(() => {
  document.body.innerHTML = ''
  setActivePinia(createPinia())
  for (const f of Object.values(api)) f.mockReset()
  api.fetchHadiahList.mockResolvedValue(listBody(ROWS))
  api.fetchRedemptions.mockResolvedValue(queueBody([redemptionRow()]))
})

describe('routes', () => {
  it('has the three catalogue routes and the queue, in the admin shell, admin only', () => {
    expect(routes.map((r) => r.path)).toEqual([
      '/admin/hadiah',
      '/admin/hadiah/baharu',
      '/admin/hadiah/tebusan',
      '/admin/hadiah/:id(\\d+)/edit',
    ])
    for (const r of routes) {
      expect(r.meta).toMatchObject({ layout: 'admin', access: 'auth', roles: ['admin'], module: 'M15' })
    }
    expect(routes[0]!.meta).toMatchObject({
      header: { title: '🎁 Kedai Hadiah Digital', subtitle: 'Urus catalog hadiah + proses tebusan pelajar' },
    })
  })

  it('hands the mode and the id to the page', () => {
    expect(routes[0]!.props).toEqual({ mode: 'list' })
    expect(routes[1]!.props).toEqual({ mode: 'create' })
    const edit = routes[3]!.props as (r: { params: Record<string, string> }) => unknown
    expect(edit({ params: { id: '17' } })).toEqual({ mode: 'edit', id: '17' })
  })
})

describe('the tiles (30 P2-07)', () => {
  it('shows the four tiles from meta.cards, in order, with their labels', async () => {
    const { w } = await open()
    for (const [key, label, value] of [
      ['total', 'Total Hadiah', '59'],
      ['active', 'Aktif', '2'],
      ['month', 'Tebusan Bulan Ini', '4'],
      ['pending', 'Pending Proses', '3'],
    ] as const) {
      const text = tid(w, `hadiah-tile-${key}`).text()
      expect(text).toContain(label)
      expect(text).toContain(value)
    }
  })
})

describe('the category pills (P07-01)', () => {
  it('has Semua, then the nine OPT words with their emoji, and Semua active by default', async () => {
    const { w } = await open()
    const nav = w.get('nav[aria-label="Kategori hadiah"]')
    expect(nav.findAll('a').map((a) => a.text())).toEqual([
      'Semua',
      '🏆 Mahkota',
      '💳 E-Wallet',
      '📱 Telco',
      '🎮 Gaming',
      '🎬 Streaming',
      '🍔 F&B',
      '🛒 E-Commerce',
      '📚 Pembelajaran',
      '🎭 Hiburan',
    ])
    expect(tid(w, 'hadiah-pill-all').attributes('data-active')).toBe('true')
    expect(listCalls()[0]).toMatchObject({ cat: 'all', page: 1 })
  })

  it('a pill is a link that keeps the filter in the URL and reads that category', async () => {
    const { w, router } = await open()
    api.fetchHadiahList.mockResolvedValue(listBody([ROWS[2]!], { activeCat: 'telco' }))
    await tid(w, 'hadiah-pill-telco').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/admin/hadiah?cat=telco')
    expect(listCalls().at(-1)).toMatchObject({ cat: 'telco', page: 1 })
    expect(tid(w, 'hadiah-pill-telco').attributes('data-active')).toBe('true')
  })

  it('uses the same words in the table, not the long table label of the server', async () => {
    const { w } = await open()
    const cells = w.findAll('tbody tr').map((r) => r.text())
    expect(cells[2]).toContain('📱 Telco')
    expect(cells[2]).not.toContain('Telco Topup')
    api.fetchHadiahList.mockResolvedValue(listBody([hadiahRow({ id: '9', category: 'food_beverage', categoryLabel: '🍔 Makanan & Minuman' })]))
    const next = await open('/admin/hadiah?cat=food_beverage')
    expect(next.w.text()).toContain('🍔 F&B')
    expect(next.w.text()).not.toContain('Makanan & Minuman')
  })
})

describe('the table', () => {
  it('has the eight columns, ∞ for no stock limit, On / Off, and an Edit link to the form', async () => {
    const { w } = await open()
    expect(tid(w, 'hadiah-table').findAll('th').map((h) => h.text()).slice(1)).toEqual([
      'Hadiah',
      'Kategori',
      'RM',
      'Token',
      'Stok',
      'Tebusan',
      'Status',
      'Tindakan',
    ])
    const first = w.findAll('tbody tr')[0]!.text()
    expect(first).toContain('Roblox Gift Card RM10')
    expect(first).toContain('∞')
    expect(first).toContain('Off')
    expect(tid(w, 'hadiah-status-2').text()).toBe('On')
    expect(w.findAll('tbody tr')[1]!.text()).toContain('5')
    expect(tid(w, 'hadiah-edit-3').attributes('href')).toBe('/admin/hadiah/3/edit')
  })

  it('shows RM with its cents only when it has them, and the token with a thousands comma', async () => {
    const { w } = await open()
    const third = w.findAll('tbody tr')[2]!.text()
    expect(third).toContain('5.50')
    expect(third).toContain('1,500')
    expect(w.findAll('tbody tr')[0]!.text()).not.toContain('10.00')
  })

  it('links Tebusan Queue and Tambah Hadiah in the page header', async () => {
    const { w } = await open()
    expect(tid(w, 'hadiah-queue-link').attributes('href')).toBe('/admin/hadiah/tebusan')
    expect(tid(w, 'hadiah-queue-link').text()).toBe('Tebusan Queue')
    expect(tid(w, 'hadiah-add').attributes('href')).toBe('/admin/hadiah/baharu')
    expect(tid(w, 'hadiah-add').text()).toBe('Tambah Hadiah')
  })
})

describe('empty and error states (FR-ADM-P2-07.2)', () => {
  it('says "Tiada hadiah dalam kategori ini." for a category filter only', async () => {
    api.fetchHadiahList.mockResolvedValue(listBody([], { activeCat: 'entertainment' }))
    const { w } = await open('/admin/hadiah?cat=entertainment')
    expect(w.get('[data-testid="hadiah-table"]').text()).toContain('Tiada hadiah dalam kategori ini.')
    const all = await open('/admin/hadiah')
    expect(all.w.get('[data-testid="hadiah-table"]').text()).not.toContain('Tiada hadiah dalam kategori ini.')
  })

  it('goes back to the last page when the page asked for is past it', async () => {
    api.fetchHadiahList.mockImplementation(({ page }: { page: number }) =>
      Promise.resolve(
        page > 2
          ? listBody([], { page, totalPages: 2, totalItems: 59 })
          : listBody(ROWS, { page, totalPages: 2, totalItems: 59 }),
      ),
    )
    const { router } = await open('/admin/hadiah?cat=gaming&page=9')
    expect(router.currentRoute.value.fullPath).toBe('/admin/hadiah?cat=gaming&page=2')
    expect(listCalls().map((c) => c.page)).toEqual([9, 2])
  })

  it('a page past the last of a single page goes to a clean URL', async () => {
    api.fetchHadiahList.mockImplementation(({ page }: { page: number }) =>
      Promise.resolve(page > 1 ? listBody([], { page, totalPages: 1 }) : listBody(ROWS)),
    )
    const { router } = await open('/admin/hadiah?page=4')
    expect(router.currentRoute.value.fullPath).toBe('/admin/hadiah')
  })

  it('moves the page of the table into the URL, 50 a page', async () => {
    api.fetchHadiahList.mockResolvedValue(listBody(ROWS, { totalItems: 59, totalPages: 2 }))
    const { w, router } = await open()
    expect(w.text()).toContain('Menunjukkan 1-50 daripada 59 hasil')
    await w.findComponent({ name: 'DsDataTable' }).vm.$emit('update:page', 2)
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/admin/hadiah?page=2')
    expect(listCalls().at(-1)).toMatchObject({ page: 2 })
  })

  it('shows the common load error with a retry', async () => {
    api.fetchHadiahList.mockRejectedValueOnce(new Error('down'))
    const { w } = await open()
    expect(w.text()).toContain('Maaf, berlaku ralat. Sila cuba semula.')
    await w.findAll('button').find((b) => b.text() === 'Cuba Semula')!.trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Roblox Gift Card RM10')
  })
})

describe('the bulk toolbar (P07-15, AC-ADM-P2-07.4)', () => {
  it('is absent until a row is ticked, then says "{n} hadiah dipilih" with the seven actions', async () => {
    const { w } = await open()
    expect(tid(w, 'hadiah-bulk').exists()).toBe(false)
    await select(w, '1', '2')
    expect(tid(w, 'hadiah-selected').text()).toBe('2 hadiah dipilih')
    const bar = tid(w, 'hadiah-bulk')
    expect(bar.findAll('button').map((b) => b.text())).toEqual([
      'Aktifkan',
      'Nyahaktifkan',
      'Set Stok',
      'Had/Bulan',
      'Pelaras Token',
      'Padam',
      'Batal',
    ])
  })

  it('Batal clears the selection and sends nothing', async () => {
    const { w } = await open()
    await select(w, '1')
    await tid(w, 'hadiah-bulk-clear').trigger('click')
    expect(tid(w, 'hadiah-bulk').exists()).toBe(false)
    expect(api.bulkHadiah).not.toHaveBeenCalled()
  })

  it('Aktifkan and Nyahaktifkan send the selected ids, then read the list again', async () => {
    api.bulkHadiah.mockResolvedValue({ affected: 2 })
    const { w } = await open()
    await select(w, '1', '3')
    await tid(w, 'hadiah-bulk-activate').trigger('click')
    await flushPromises()
    expect(api.bulkHadiah).toHaveBeenLastCalledWith({ action: 'activate', ids: ['1', '3'] })
    expect(flash()?.type).toBe('success')
    expect(tid(w, 'hadiah-bulk').exists()).toBe(false)
    expect(api.fetchHadiahList).toHaveBeenCalledTimes(2)
    await select(w, '2')
    await tid(w, 'hadiah-bulk-deactivate').trigger('click')
    await flushPromises()
    expect(api.bulkHadiah).toHaveBeenLastCalledWith({ action: 'deactivate', ids: ['2'] })
  })

  it.each([
    ['stock', 'Set Stok', 'set_stock', 'stockValue', '7'],
    ['max', 'Had/Bulan', 'set_max_per_month', 'maxPerMonthValue', '5'],
    ['cost', 'Pelaras Token', 'set_token_cost', 'tokenCostDeltaPct', '+10'],
  ] as const)('%s opens a value dialog and sends the raw text as %s', async (button, title, action, key, text) => {
    api.bulkHadiah.mockResolvedValue({ affected: 1 })
    const { w } = await open()
    await select(w, '1')
    await tid(w, `hadiah-bulk-${button}`).trigger('click')
    expect(w.get('[role="dialog"]').attributes('data-dialog')).toBe(title)
    await tid(w, 'hadiah-prompt-value').setValue(text)
    await tid(w, 'hadiah-prompt-form').trigger('submit')
    await flushPromises()
    expect(api.bulkHadiah).toHaveBeenCalledWith({ action, ids: ['1'], [key]: text })
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it('a blank Set Stok is sent as it is (the server reads it as unlimited)', async () => {
    api.bulkHadiah.mockResolvedValue({ affected: 1 })
    const { w } = await open()
    await select(w, '1')
    await tid(w, 'hadiah-bulk-stock').trigger('click')
    await tid(w, 'hadiah-prompt-form').trigger('submit')
    await flushPromises()
    expect(api.bulkHadiah).toHaveBeenCalledWith({ action: 'set_stock', ids: ['1'], stockValue: '' })
  })

  it('shows the server message at the value field and keeps the dialog and the selection', async () => {
    api.bulkHadiah.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { tokenCostDeltaPct: 'Pelaras Token mesti antara -90 dan 500.' },
      }),
    )
    const { w } = await open()
    await select(w, '1')
    await tid(w, 'hadiah-bulk-cost').trigger('click')
    await tid(w, 'hadiah-prompt-value').setValue('900')
    await tid(w, 'hadiah-prompt-form').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid="field-error"]').text()).toContain('Pelaras Token mesti antara -90 dan 500.')
    expect(w.find('[role="dialog"]').exists()).toBe(true)
    expect(tid(w, 'hadiah-bulk').exists()).toBe(true)
  })

  it('Padam confirms first, then deletes and says how many', async () => {
    api.bulkHadiah.mockResolvedValue({ affected: 1, keptIds: [] })
    const { w } = await open()
    await select(w, '3')
    await tid(w, 'hadiah-bulk-delete').trigger('click')
    expect(tid(w, 'hadiah-delete-body').text()).toContain('1 hadiah akan dipadam.')
    expect(api.bulkHadiah).not.toHaveBeenCalled()
    await tid(w, 'hadiah-delete-go').trigger('click')
    await flushPromises()
    expect(api.bulkHadiah).toHaveBeenCalledWith({ action: 'delete', ids: ['3'] })
    expect(flash()).toEqual({ type: 'success', message: '1 hadiah dipadam.' })
  })

  it('Padam keeps a reward that has a redemption and says "Hadiah ini mempunyai tebusan. Nyahaktifkan sahaja." (FR-ADM-P2-07.4)', async () => {
    api.bulkHadiah.mockResolvedValue({ affected: 1, keptIds: ['1'] })
    const { w } = await open()
    await select(w, '1', '3')
    await tid(w, 'hadiah-bulk-delete').trigger('click')
    await tid(w, 'hadiah-delete-go').trigger('click')
    await flushPromises()
    expect(flash()).toEqual({
      type: 'error',
      message: 'Hadiah ini mempunyai tebusan. Nyahaktifkan sahaja.',
    })
    // The kept reward stays selected, so Nyahaktifkan is one click away.
    expect(tid(w, 'hadiah-selected').text()).toBe('1 hadiah dipilih')
  })

  it('Padam cancelled in the dialog sends nothing', async () => {
    const { w } = await open()
    await select(w, '1')
    await tid(w, 'hadiah-bulk-delete').trigger('click')
    await tid(w, 'hadiah-delete-keep').trigger('click')
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(api.bulkHadiah).not.toHaveBeenCalled()
  })

  it('shows a refused bulk write above the table', async () => {
    api.bulkHadiah.mockRejectedValue(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Maaf, ralat pelayan.' }))
    const { w } = await open()
    await select(w, '1')
    await tid(w, 'hadiah-bulk-activate').trigger('click')
    await flushPromises()
    expect(tid(w, 'hadiah-bulk-failure').text()).toContain('Maaf, ralat pelayan.')
  })

  it('drops the selection when the category changes', async () => {
    const { w } = await open()
    await select(w, '1')
    expect(tid(w, 'hadiah-bulk').exists()).toBe(true)
    await tid(w, 'hadiah-pill-telco').trigger('click')
    await flushPromises()
    expect(tid(w, 'hadiah-bulk').exists()).toBe(false)
  })
})

describe('the Tebusan Queue card (decision 4)', () => {
  it('sits on the page with its own pills and rows', async () => {
    const { w } = await open()
    expect(tid(w, 'tebusan-card-title').text()).toBe('Tebusan Queue')
    expect(tid(w, 'tebusan-reward-15101').text()).toContain('TnG eWallet RM10')
    expect(tid(w, 'tebusan-deliver-15101').exists()).toBe(true)
  })

  it('a deliver or cancel in the card reads the tiles and the catalogue again', async () => {
    const { w } = await open()
    api.fetchHadiahList.mockClear()
    w.findComponent(AdminRedemptionsPage).vm.$emit('changed')
    await flushPromises()
    expect(api.fetchHadiahList).toHaveBeenCalledOnce()
  })
})

describe('the form modes', () => {
  it('renders the form, not the list, for /baharu and sends nothing to the list API', async () => {
    const { w } = await open('/admin/hadiah/baharu', { mode: 'create' })
    expect(tid(w, 'hadiah-form').exists()).toBe(true)
    expect(tid(w, 'hadiah-table').exists()).toBe(false)
    expect(api.fetchHadiahList).not.toHaveBeenCalled()
    expect(api.fetchHadiah).not.toHaveBeenCalled()
  })

  it('goes back to the list with the flash after a save', async () => {
    api.createHadiah.mockResolvedValue({ id: '60' })
    const { w, router } = await open('/admin/hadiah/baharu', { mode: 'create' })
    await w.getComponent({ name: 'AdminHadiahForm' }).vm.$emit('saved', { id: '60' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/admin/hadiah')
    expect(useFlashStore().current ?? useFlashStore().pending).toEqual({ type: 'success', message: 'Hadiah ditambah.' })
  })
})
