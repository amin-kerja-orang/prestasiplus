// @vitest-environment jsdom
// SW8-07b: the v2 reset mail links to `/password/reset#token=...&email=...` (token in the URL
// fragment only). The entry page shows S4 with the token in component state and scrubs the hash.
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, RouterView, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useSessionStore } from '@/stores/session'

import type { ClientSession } from '../../api'
import PasswordForgotPage from '../../pages/PasswordForgotPage.vue'
import PasswordResetEntryPage from '../../pages/PasswordResetEntryPage.vue'
import PasswordResetPage from '../../pages/PasswordResetPage.vue'

const apiMocks = vi.hoisted(() => ({
  sendPasswordResetLink: vi.fn(),
  resetPassword: vi.fn(),
  resetByIc: vi.fn(),
}))
vi.mock('../../api', () => apiMocks)

const TOKEN = 'T0kenFromTheMail_abcdefghijklmnopqrstuvwxyz-0123'
const SESSION = {
  token: 'tok',
  remember: false,
  expiresAt: '2099-01-01T00:00:00+08:00',
  user: { id: 2, role: 'student', landingPath: '/dashboard' },
} as unknown as ClientSession

const blank = { template: '<div />' }
let wrapper: VueWrapper | null = null
let router: Router

/** Mounts a RouterView on the real route table shape, after the first navigation to `path`. */
async function open(path: string): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/password/reset', component: PasswordResetEntryPage },
      { path: '/password/reset/:token', component: PasswordResetPage },
      { path: '/:rest(.*)*', component: blank },
    ],
  })
  // The app's after-each hook sets the route's title.
  router.afterEach(() => {
    document.title = 'Lupa Kata Laluan - PRESTASIPLUS'
  })
  await router.push(path)
  wrapper = mount(RouterView, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

const emailValue = (w: VueWrapper) =>
  (w.get('[data-testid=reset-email]').element as HTMLInputElement).value

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  for (const fn of Object.values(apiMocks)) fn.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('/password/reset#token=... (SW8-07b)', () => {
  const link = `/password/reset#token=${TOKEN}&email=${encodeURIComponent('pelajar+a@demo.test')}`

  it('shows the reset form with the token in state and the e-mail pre-filled', async () => {
    const w = await open(link)
    expect(w.get('h1').text()).toBe('Reset Kata Laluan')
    expect(w.find('[data-testid=forgot-email]').exists()).toBe(false)
    expect(emailValue(w)).toBe('pelajar+a@demo.test')
    expect(w.get('input[name=token]').attributes('value')).toBe(TOKEN)
  })

  it('scrubs the fragment at once and never puts the token in the path or the query', async () => {
    const w = await open(link)
    const current = router.currentRoute.value
    expect(current.hash).toBe('')
    expect(current.path).toBe('/password/reset')
    expect(current.query).toEqual({})
    expect(current.fullPath).toBe('/password/reset')
    expect(current.fullPath).not.toContain(TOKEN)
    // The form survives the scrub (the entry page captured the token once).
    expect(w.get('input[name=token]').attributes('value')).toBe(TOKEN)
    expect(document.title).toBe('Reset Kata Laluan | PRESTASIPLUS')
  })

  it('submits the fragment token to POST /auth/password/reset', async () => {
    apiMocks.resetPassword.mockResolvedValue({ session: SESSION, status: 'Selesai.' })
    const w = await open(link)
    await w.get('[data-testid=reset-password]').setValue('BaruBaru1')
    await w.get('[data-testid=reset-confirm]').setValue('BaruBaru1')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(apiMocks.resetPassword).toHaveBeenCalledWith({
      token: TOKEN,
      email: 'pelajar+a@demo.test',
      password: 'BaruBaru1',
      passwordConfirmation: 'BaruBaru1',
    })
    expect(useSessionStore().isLoggedIn).toBe(true)
  })

  it('keeps the page copy for a bad token: red alert, e-mail kept, passwords cleared', async () => {
    apiMocks.resetPassword.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'This password reset token is invalid.',
        fields: { email: 'This password reset token is invalid.' },
      }),
    )
    const w = await open(link)
    await w.get('[data-testid=reset-password]').setValue('BaruBaru1')
    await w.get('[data-testid=reset-confirm]').setValue('BaruBaru1')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid=reset-alert]').text()).toContain(
      'This password reset token is invalid.',
    )
    expect(emailValue(w)).toBe('pelajar+a@demo.test')
    expect((w.get('[data-testid=reset-password]').element as HTMLInputElement).value).toBe('')
  })

  it('leaves the e-mail empty and editable when the link carries only the token', async () => {
    const w = await open(`/password/reset#token=${TOKEN}`)
    expect(w.get('h1').text()).toBe('Reset Kata Laluan')
    expect(emailValue(w)).toBe('')
    expect(router.currentRoute.value.hash).toBe('')
  })

  it('reads the browser hash raw, so %2B and %26 in the e-mail survive', async () => {
    const raw = `#token=${TOKEN}&email=${encodeURIComponent('a+b&c@demo.test')}`
    window.history.replaceState(null, '', `/password/reset${raw}`)
    try {
      const w = await open('/password/reset')
      expect(emailValue(w)).toBe('a+b&c@demo.test')
      expect(w.get('input[name=token]').attributes('value')).toBe(TOKEN)
    } finally {
      window.history.replaceState(null, '', '/')
    }
  })

  it('falls back to the forgot-password page when the token is missing or empty', async () => {
    for (const path of [
      '/password/reset#token=&email=a%40b.my',
      '/password/reset#token=%20',
      '/password/reset#email=a%40b.my',
    ]) {
      const w = await open(path)
      expect(w.get('h1').text()).toBe('Lupa Kata Laluan?')
      expect(w.find('[data-testid=reset-form]').exists()).toBe(false)
      w.unmount()
    }
  })

  it('scrubs an empty-token fragment too', async () => {
    await open('/password/reset#token=')
    expect(router.currentRoute.value.hash).toBe('')
  })
})

describe('a token link pasted while the page is already open (B1x4)', () => {
  const later = `#token=${TOKEN}&email=${encodeURIComponent('murid@demo.test')}`

  it('switches S3 to S4 with the new token and e-mail, then scrubs the hash once', async () => {
    const w = await open('/password/reset')
    expect(w.get('h1').text()).toBe('Lupa Kata Laluan?')
    const replace = vi.spyOn(router, 'replace')
    await router.push(`/password/reset${later}`)
    await flushPromises()
    expect(w.get('h1').text()).toBe('Reset Kata Laluan')
    expect(emailValue(w)).toBe('murid@demo.test')
    expect(w.get('input[name=token]').attributes('value')).toBe(TOKEN)
    expect(router.currentRoute.value.fullPath).toBe('/password/reset')
    expect(replace).toHaveBeenCalledTimes(1)
    expect(document.title).toBe('Reset Kata Laluan | PRESTASIPLUS')
  })

  it('keeps S4 after the scrub (the empty hash does not flip back to S3)', async () => {
    const w = await open('/password/reset')
    await router.push(`/password/reset${later}`)
    await flushPromises()
    await router.replace({ path: '/password/reset', hash: '' })
    await flushPromises()
    expect(w.find('[data-testid=reset-form]').exists()).toBe(true)
    expect(w.find('[data-testid=forgot-email]').exists()).toBe(false)
    expect(emailValue(w)).toBe('murid@demo.test')
  })

  it('takes a second token link over the first one', async () => {
    const w = await open(`/password/reset#token=${TOKEN}&email=a%40b.my`)
    await router.push('/password/reset#token=SecondToken_0123456789&email=c%40d.my')
    await flushPromises()
    expect(w.get('input[name=token]').attributes('value')).toBe('SecondToken_0123456789')
    expect(emailValue(w)).toBe('c@d.my')
    expect(router.currentRoute.value.hash).toBe('')
  })

  it('scrubs an empty-token hash and leaves S3 as it is', async () => {
    const w = await open('/password/reset')
    await router.push('/password/reset#token=&email=a%40b.my')
    await flushPromises()
    expect(w.get('h1').text()).toBe('Lupa Kata Laluan?')
    expect(router.currentRoute.value.hash).toBe('')
  })
})

describe('/password/reset without a fragment and the path route (unchanged)', () => {
  it('renders S3 as before and does not navigate', async () => {
    const w = await open('/password/reset')
    expect(w.findComponent(PasswordForgotPage).exists()).toBe(true)
    expect(w.get('h1').text()).toBe('Lupa Kata Laluan?')
    expect(router.currentRoute.value.fullPath).toBe('/password/reset')
  })

  it('keeps /password/reset/:token with ?email= working (token from the path)', async () => {
    const w = await open('/password/reset/path-token?email=pelajar@demo.test')
    expect(w.get('h1').text()).toBe('Reset Kata Laluan')
    expect(w.get('input[name=token]').attributes('value')).toBe('path-token')
    expect(emailValue(w)).toBe('pelajar@demo.test')
    expect(router.currentRoute.value.fullPath).toBe(
      '/password/reset/path-token?email=pelajar@demo.test',
    )
  })
})
