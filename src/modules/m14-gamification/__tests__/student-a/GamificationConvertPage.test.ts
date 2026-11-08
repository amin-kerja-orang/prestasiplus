// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'

import GamificationConvertPage from '../../pages/GamificationConvertPage.vue'
import { convertInfo, ledgerRow } from './fixtures'

const api = vi.hoisted(() => ({
  fetchConvertView: vi.fn(),
  convertSyiling: vi.fn(),
  fetchGamificationTransactions: vi.fn(),
}))
vi.mock('../../api', () => api)

let w: VueWrapper | undefined

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/gamification/convert')
  await router.isReady()
  w = mount(GamificationConvertPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return w
}
const t = (id: string) => w!.get(`[data-testid="${id}"]`)
const input = () => t('s12-input')
const submit = () => t('s12-submit')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
/** The dialog is teleported to the body. */
const dialog = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)
async function press(): Promise<void> {
  await t('s12-form').trigger('submit')
  await flushPromises()
}
async function confirmTukar(): Promise<void> {
  dialog('s12-confirm-ok')!.click()
  await flushPromises()
}
const result = (over: Record<string, unknown> = {}) => ({
  syilingDebited: 250,
  tokensCredited: 5,
  currentSyiling: 6,
  tokenBalance: 5,
  transactionId: 53679,
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchConvertView.mockResolvedValue(convertInfo())
  api.fetchGamificationTransactions.mockResolvedValue({
    data: [],
    meta: { currentSyiling: 256, type: 'convert' },
  })
})
afterEach(() => {
  w?.unmount()
  w = undefined
})

describe('S12 convert (AC-M14-07, 08)', () => {
  it('renders header, balances, input attributes and preview (AC-07.1)', async () => {
    await mountPage()
    expect(t('s12-hero').text()).toContain('Tukar Syiling → Token')
    expect(t('s12-hero').text()).toContain('Tukar syiling anda kepada token untuk tebus hadiah')
    expect(t('s12-balance-syiling').text()).toBe('256')
    expect(t('s12-balance-token').text()).toBe('0')
    expect(input().attributes('min')).toBe('50')
    expect(input().attributes('max')).toBe('256')
    expect(input().attributes('placeholder')).toBe('0')
    expect(input().attributes('required')).toBeDefined()
    expect((input().element as HTMLInputElement).value).toBe('50')
    expect(t('s12-preview-tokens').text()).toBe('1')
    // FR-MUR-29-1: the exact sentence and the tier chip.
    expect(t('s12-rate-line').text()).toBe('Kadar tahap anda: 50 syiling = 1 token')
    expect(t('s12-tier-chip').text()).toBe('🥉 Gangsa')
    expect(submit().attributes('disabled')).toBeUndefined()
  })

  // FR-GM-18.2, FR-MUR-29-4, ruling on defect 14 (#500): fixed 50, 250, Semua.
  it('quick buttons set the amount and the clicked one is active; Semua is the largest multiple of the rate (AC-07.2, AC-MUR-29-4)', async () => {
    await mountPage()
    expect(t('s12-quick-50').text()).toBe('50')
    expect(t('s12-quick-250').text()).toBe('250')
    expect(t('s12-quick-all').text()).toBe('Semua')
    await t('s12-quick-250').trigger('click')
    expect((input().element as HTMLInputElement).value).toBe('250')
    expect(t('s12-preview-tokens').text()).toBe('5')
    expect(t('s12-quick-250').attributes('data-active')).toBe('true')
    expect(t('s12-quick-all').attributes('data-active')).toBe('false')
    await t('s12-quick-all').trigger('click')
    expect((input().element as HTMLInputElement).value).toBe('250')
    expect(t('s12-preview-tokens').text()).toBe('5')
  })

  it('a choice is disabled when unaffordable, and at another rate the choices stay 50 and 250', async () => {
    api.fetchConvertView.mockResolvedValue(convertInfo({ currentSyiling: 120 }))
    await mountPage()
    expect(t('s12-quick-50').attributes('disabled')).toBeUndefined()
    expect(t('s12-quick-250').attributes('disabled')).toBeDefined()
    expect(t('s12-quick-all').attributes('disabled')).toBeUndefined()
    w!.unmount()
    api.fetchConvertView.mockResolvedValue(convertInfo({ currentSyiling: 500, rate: 40 }))
    await mountPage()
    expect(t('s12-quick-50').text()).toBe('50')
    await t('s12-quick-50').trigger('click')
    expect(t('s12-preview-tokens').text()).toBe('1')
    await t('s12-quick-all').trigger('click')
    expect((input().element as HTMLInputElement).value).toBe('480')
  })

  it('AC-GM-18.2: at 49 syiling every choice and the submit are disabled and the card links to Latih Tubi', async () => {
    api.fetchConvertView.mockResolvedValue(convertInfo({ currentSyiling: 49 }))
    await mountPage()
    for (const id of ['s12-quick-50', 's12-quick-250', 's12-quick-all', 's12-submit']) {
      expect(t(id).attributes('disabled'), id).toBeDefined()
    }
    expect(t('s12-short').findAll('p').map((line) => line.text())).toEqual([
      'Anda perlu sekurang-kurangnya 50 syiling',
      'untuk menukar 1 token. Teruskan berlatih untuk mengumpul syiling.',
    ])
    expect(t('s12-short-practice').text()).toBe('Mula Latih Tubi')
    expect(t('s12-short-practice').attributes('href')).toBe('/practice')
  })

  it('no short card when one token is affordable', async () => {
    await mountPage()
    expect(w!.find('[data-testid="s12-short"]').exists()).toBe(false)
  })

  it('disables the button below the rate and above the balance (AC-08.1)', async () => {
    await mountPage()
    await input().setValue('30')
    expect(t('s12-preview-tokens').text()).toBe('0')
    expect(submit().attributes('disabled')).toBeDefined()
    await input().setValue('300')
    expect(t('s12-preview-tokens').text()).toBe('6')
    expect(submit().attributes('disabled')).toBeDefined()
    await input().setValue('50')
    expect(submit().attributes('disabled')).toBeUndefined()
    await input().setValue('')
    expect(submit().attributes('disabled')).toBeDefined()
  })

  it('tier grid marks the viewer tier and shows the tip (AC-07.3)', async () => {
    await mountPage()
    const tiers = w!.findAll('[data-testid="s12-tier"]')
    expect(tiers).toHaveLength(4)
    expect(w!.findAll('[data-testid="s12-tier-mine"]')).toHaveLength(1)
    expect(tiers[0]!.text()).toContain('ANDA')
    expect(tiers[1]!.text()).toContain('500+ syiling')
    expect(tiers[1]!.text()).toContain('syiling/token')
    expect(t('s12-tip').text().replace(/\s+/g, ' ')).toContain(
      'Tips: Naik tier untuk dapatkan kadar penukaran yang lebih baik!',
    )
  })

  it('AC-GM-18.1: the dialog shows the real debit and Tukar posts #6 with one key; the balances and history follow', async () => {
    api.convertSyiling.mockResolvedValue(result({ syilingDebited: 100, tokensCredited: 2, currentSyiling: 20, tokenBalance: 2 }))
    api.fetchConvertView.mockResolvedValue(convertInfo({ currentSyiling: 120 }))
    await mountPage()
    await t('s12-quick-all').trigger('click')
    await press()
    expect(dialog('s12-confirm-text')!.textContent.trim()).toBe('Tukar 100 syiling kepada 2 token?')
    expect(document.body.textContent).toContain('Tukar syiling kepada token?')
    expect(dialog('s12-confirm-cancel')!.textContent.trim()).toBe('Batal')
    expect(dialog('s12-confirm-ok')!.textContent.trim()).toBe('Tukar')
    expect(api.convertSyiling).not.toHaveBeenCalled()
    api.fetchGamificationTransactions.mockResolvedValue({
      data: [ledgerRow(1, { type: 'convert', description: 'Tukar 100 syiling → 2 token', amount: -100 })],
      meta: { currentSyiling: 20, type: 'convert' },
    })
    await confirmTukar()
    expect(api.convertSyiling).toHaveBeenCalledWith(100, expect.stringMatching(UUID))
    expect(t('s12-balance-syiling').text()).toBe('20')
    expect(t('s12-balance-token').text()).toBe('2')
    expect(w!.text()).toContain('Berjaya menukar 100 syiling kepada 2 token.')
    expect(t('s12-history-row').text()).toContain('Tukar 100 syiling → 2 token')
    expect(input().attributes('max')).toBe('20')
    expect(submit().attributes('disabled')).toBeDefined()
  })

  it('ruling on defect 14: the typed amount follows the same debit rule in the dialog', async () => {
    api.fetchConvertView.mockResolvedValue(convertInfo({ currentSyiling: 120 }))
    await mountPage()
    await input().setValue('120')
    await press()
    expect(dialog('s12-confirm-text')!.textContent.trim()).toBe('Tukar 100 syiling kepada 2 token?')
  })

  it('Batal closes the dialog and posts nothing', async () => {
    await mountPage()
    await press()
    dialog('s12-confirm-cancel')!.click()
    await flushPromises()
    expect(api.convertSyiling).not.toHaveBeenCalled()
  })

  it('AC-GM-18.3: a double click on Tukar posts once', async () => {
    let settle!: (value: unknown) => void
    api.convertSyiling.mockReturnValue(new Promise((resolve) => (settle = resolve)))
    await mountPage()
    await press()
    const ok = dialog('s12-confirm-ok')!
    ok.click()
    ok.click()
    await flushPromises()
    expect(api.convertSyiling).toHaveBeenCalledTimes(1)
    settle(result({ syilingDebited: 50, tokensCredited: 1, currentSyiling: 206, tokenBalance: 1 }))
    await flushPromises()
    expect(t('s12-balance-syiling').text()).toBe('206')
  })

  it('FR-ERR-9: a retry after an unknown outcome reuses the key, and the next press gets a new one', async () => {
    api.convertSyiling.mockRejectedValueOnce(new TypeError('network'))
    api.convertSyiling.mockRejectedValueOnce(new ApiError({ status: 503, code: 'SERVER_ERROR', message: 'x' }))
    api.convertSyiling.mockResolvedValue(result({ syilingDebited: 50, tokensCredited: 1, currentSyiling: 206, tokenBalance: 1 }))
    await mountPage()
    for (let i = 0; i < 3; i++) {
      await press()
      await confirmTukar()
    }
    const keys = api.convertSyiling.mock.calls.map((c) => c[1] as string)
    expect(keys[0]).toMatch(UUID)
    expect(new Set(keys).size).toBe(1)
    await press()
    await confirmTukar()
    expect(api.convertSyiling.mock.calls[3]![1]).not.toBe(keys[0])
  })

  it('a refusal ends the key: the next press is a new request, and so is a retry with another amount', async () => {
    api.convertSyiling.mockRejectedValueOnce(new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'x' }))
    api.convertSyiling.mockRejectedValueOnce(new TypeError('network'))
    api.convertSyiling.mockResolvedValue(result())
    await mountPage()
    await press()
    await confirmTukar()
    await press()
    await confirmTukar()
    await t('s12-quick-250').trigger('click')
    await press()
    await confirmTukar()
    const keys = api.convertSyiling.mock.calls.map((c) => c[1] as string)
    expect(new Set(keys).size).toBe(3)
  })

  it('FR-MUR-29-3: "Sejarah penukaran" reads the own convert rows; empty and error states', async () => {
    await mountPage()
    expect(api.fetchGamificationTransactions).toHaveBeenCalledWith(
      { type: 'convert' },
      expect.anything(),
    )
    expect(t('s12-history').text()).toContain('Sejarah penukaran')
    expect(t('s12-history-empty').text()).toBe('Belum ada penukaran.')
    w!.unmount()
    api.fetchGamificationTransactions.mockResolvedValue({
      data: [
        ledgerRow(2, { type: 'convert', description: 'Tukar 250 syiling → 5 token', amount: -250 }),
        ledgerRow(1, { type: 'convert', description: 'Tukar 50 syiling → 1 token', amount: -50 }),
      ],
      meta: { currentSyiling: 6, type: 'convert' },
    })
    await mountPage()
    const rows = w!.findAll('[data-testid="s12-history-row"]')
    expect(rows.map((r) => r.find('p').text())).toEqual([
      'Tukar 250 syiling → 5 token',
      'Tukar 50 syiling → 1 token',
    ])
    w!.unmount()
    api.fetchGamificationTransactions.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }),
    )
    await mountPage()
    expect(t('s12-history').text()).toContain('Ralat berlaku. Sila cuba lagi.')
  })

  it('does not post an invalid amount', async () => {
    await mountPage()
    await input().setValue('30')
    await press()
    expect(dialog('s12-confirm-ok')).toBeNull()
    expect(api.convertSyiling).not.toHaveBeenCalled()
  })

  it('shows the refusal message on 422 and changes nothing (AC-08.3)', async () => {
    api.convertSyiling.mockRejectedValue(
      new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'x' }),
    )
    await mountPage()
    await press()
    await confirmTukar()
    expect(w!.text()).toContain('Jumlah syiling tidak sah.')
    expect(t('s12-balance-syiling').text()).toBe('256')
  })

  it('shows an error box when #5 fails', async () => {
    api.fetchConvertView.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }),
    )
    await mountPage()
    expect(w!.text()).toContain('Ralat berlaku. Sila cuba lagi.')
  })
})
