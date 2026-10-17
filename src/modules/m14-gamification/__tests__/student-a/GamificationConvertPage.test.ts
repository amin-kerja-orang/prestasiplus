// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'

import GamificationConvertPage from '../../pages/GamificationConvertPage.vue'
import { convertInfo } from './fixtures'

const api = vi.hoisted(() => ({ fetchConvertView: vi.fn(), convertSyiling: vi.fn() }))
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

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchConvertView.mockResolvedValue(convertInfo())
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
    expect(t('s12-rate-line').text()).toBe('Kadar: 50 syiling = 1 token (Gangsa)')
    expect(submit().attributes('disabled')).toBeUndefined()
  })

  it('quick buttons set the amount and the clicked one is active (AC-07.2)', async () => {
    await mountPage()
    expect(t('s12-quick-rate').text()).toBe('50 syiling')
    expect(t('s12-quick-five').text()).toBe('250 syiling')
    expect(t('s12-quick-all').text()).toBe('Semua (256)')
    await t('s12-quick-five').trigger('click')
    expect((input().element as HTMLInputElement).value).toBe('250')
    expect(t('s12-preview-tokens').text()).toBe('5')
    expect(t('s12-quick-five').attributes('data-active')).toBe('true')
    expect(t('s12-quick-all').attributes('data-active')).toBe('false')
    await t('s12-quick-all').trigger('click')
    expect((input().element as HTMLInputElement).value).toBe('256')
    expect(t('s12-preview-tokens').text()).toBe('5')
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

  it('posts #6 with the typed amount and re-renders with the new balances (AC-08.2)', async () => {
    api.convertSyiling.mockResolvedValue({
      syilingDebited: 250,
      tokensCredited: 5,
      currentSyiling: 6,
      tokenBalance: 5,
      transactionId: 53679,
    })
    await mountPage()
    await t('s12-quick-five').trigger('click')
    await t('s12-form').trigger('submit')
    await flushPromises()
    expect(api.convertSyiling).toHaveBeenCalledWith(250)
    expect(t('s12-balance-syiling').text()).toBe('6')
    expect(t('s12-balance-token').text()).toBe('5')
    expect(w!.text()).toContain('Berjaya! 250 syiling ditukar kepada 5 token.')
    expect(input().attributes('max')).toBe('6')
    expect(submit().attributes('disabled')).toBeDefined()
  })

  it('does not post an invalid amount', async () => {
    await mountPage()
    await input().setValue('30')
    await t('s12-form').trigger('submit')
    expect(api.convertSyiling).not.toHaveBeenCalled()
  })

  it('shows the refusal message on 422 and changes nothing (AC-08.3)', async () => {
    api.convertSyiling.mockRejectedValue(
      new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'x' }),
    )
    await mountPage()
    await t('s12-form').trigger('submit')
    await flushPromises()
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
