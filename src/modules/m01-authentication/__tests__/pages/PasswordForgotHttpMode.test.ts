// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import PasswordForgotPage from '../../pages/PasswordForgotPage.vue'

const apiMocks = vi.hoisted(() => ({ sendPasswordResetLink: vi.fn() }))
vi.mock('../../api', () => apiMocks)

const NOTICE =
  'Pautan reset melalui e-mel belum tersedia. Guna Reset Melalui No IC, atau minta guru / admin sekolah anda menetapkan semula kata laluan.'

let wrapper: VueWrapper | null = null

async function render(): Promise<VueWrapper> {
  const blank = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:rest(.*)*', component: blank }],
  })
  await router.push('/password/reset')
  wrapper = mount(PasswordForgotPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => apiMocks.sendPasswordResetLink.mockReset())
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllEnvs()
})

describe('PasswordForgotPage in http mode (AM-18)', () => {
  it('shows the notice and a link to the IC reset, without the e-mail form', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    const w = await render()
    expect(w.get('[data-testid=forgot-http-alert]').text()).toBe(NOTICE)
    expect(w.find('form').exists()).toBe(false)
    expect(w.find('[data-testid=forgot-email]').exists()).toBe(false)
    expect(w.find('[data-testid=forgot-submit]').exists()).toBe(false)
    expect(w.findAll('a').map((a) => [a.text(), a.attributes('href')])).toEqual([
      ['Reset Melalui No IC', '/password/reset-ic'],
      ['Kembali ke Log Masuk', '/login'],
    ])
    expect(w.text()).not.toMatch(/telah dihantar|emailed|kami akan hantar/i)
    expect(apiMocks.sendPasswordResetLink).not.toHaveBeenCalled()
  })

  it('keeps the e-mail form in mock mode', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    const w = await render()
    expect(w.find('[data-testid=forgot-form]').exists()).toBe(true)
    expect(w.find('[data-testid=forgot-http-notice]').exists()).toBe(false)
    expect(w.text()).toContain(
      'Masukkan email anda dan kami akan hantar pautan untuk reset kata laluan.',
    )
  })
})
