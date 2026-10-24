// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'
import { useSessionStore } from '@/stores/session'

import type { ClientSession } from '../../api'
import PasswordForgotPage from '../../pages/PasswordForgotPage.vue'
import PasswordResetIcPage from '../../pages/PasswordResetIcPage.vue'
import PasswordResetPage from '../../pages/PasswordResetPage.vue'

const apiMocks = vi.hoisted(() => ({
  sendPasswordResetLink: vi.fn(),
  resetPassword: vi.fn(),
  resetByIc: vi.fn(),
}))
vi.mock('../../api', () => apiMocks)

const SESSION: ClientSession = {
  token: 'tok',
  remember: false,
  expiresAt: '2099-01-01T00:00:00+08:00',
  user: {
    id: 2,
    name: 'Pelajar Demo',
    email: 'pelajar@demo.test',
    phone: null,
    role: 'student',
    grade: 10,
    schoolId: null,
    bio: null,
    avatarUrl: null,
    createdAt: '2026-02-06T09:00:00+08:00',
    updatedAt: '2026-02-06T09:00:00+08:00',
    lastLoginAt: null,
    school: null,
    landingPath: '/dashboard',
  },
}

const blank = { template: '<div />' }
let wrapper: VueWrapper | null = null
let router: Router

async function render(component: object, path: string): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/password/reset', component: PasswordForgotPage },
      { path: '/password/reset-ic', component: PasswordResetIcPage },
      { path: '/password/reset/:token', component: PasswordResetPage },
      { path: '/:rest(.*)*', component: blank },
    ],
  })
  await router.push(path)
  wrapper = mount(component, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

function validationError(message: string): ApiError {
  return new ApiError({
    status: 422,
    code: 'VALIDATION_ERROR',
    message,
    fields: { email: message },
  })
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  for (const fn of Object.values(apiMocks)) fn.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('footer (FR-M01-01)', () => {
  it.each([
    ['S3', PasswordForgotPage, '/password/reset'],
    ['S4', PasswordResetPage, '/password/reset/x'],
    ['S5', PasswordResetIcPage, '/password/reset-ic'],
  ])('%s shows the footer line under the card', async (_name, component, path) => {
    const w = await render(component, path)
    expect(w.get('[data-testid=auth-footer]').text()).toBe(
      '© 2026 PRESTASIPLUS. Platform Pendidikan Malaysia.',
    )
  })
})

describe('PasswordForgotPage (S3)', () => {
  it('renders the live copy, autofocus and no link to the IC reset', async () => {
    const w = await render(PasswordForgotPage, '/password/reset')
    expect(w.get('h1').text()).toBe('Lupa Kata Laluan?')
    expect(w.text()).toContain(
      'Masukkan emel anda dan kami akan menghantar pautan untuk set semula kata laluan.',
    )
    expect(w.get('[data-testid=forgot-email]').attributes()).toMatchObject({
      type: 'email',
      required: '',
      autocomplete: 'email',
      placeholder: 'nama@email.com',
    })
    expect(document.activeElement).toBe(w.get('[data-testid=forgot-email]').element)
    // Grey "@" adornment inside the input, as on S1 (live screenshot); not on S4/S5.
    expect(w.get('[data-testid=forgot-email-at]').text()).toBe('@')
    expect(w.get('[data-testid=forgot-email-at]').attributes('aria-hidden')).toBe('true')
    expect(w.get('[data-testid=forgot-submit]').text()).toBe('Hantar Pautan Set Semula')
    expect(w.findAll('a').map((a) => [a.text(), a.attributes('href')])).toEqual([
      ['Kembali ke Log Masuk', '/login'],
    ])
  })

  it('shows the loading label, then the green status and keeps the email', async () => {
    let resolve!: (text: string) => void
    apiMocks.sendPasswordResetLink.mockReturnValue(new Promise<string>((r) => (resolve = r)))
    const w = await render(PasswordForgotPage, '/password/reset')
    await w.get('[data-testid=forgot-email]').setValue('pelajar@demo.test')
    await w.get('form').trigger('submit')
    const button = w.get('[data-testid=forgot-submit]')
    expect(button.text()).toBe('Menghantar...')
    expect(button.attributes('disabled')).toBeDefined()
    resolve('Kami telah menghantar pautan set semula kata laluan ke emel anda.')
    await flushPromises()
    expect(w.get('[data-testid=forgot-status]').text()).toBe(
      'Kami telah menghantar pautan set semula kata laluan ke emel anda.',
    )
    expect(w.find('[data-testid=forgot-alert]').exists()).toBe(false)
    expect((w.get('[data-testid=forgot-email]').element as HTMLInputElement).value).toBe(
      'pelajar@demo.test',
    )
  })

  it('shows the red alert for an unknown email and for the throttle', async () => {
    apiMocks.sendPasswordResetLink.mockRejectedValueOnce(
      validationError("Kami tidak menemui pengguna dengan alamat emel itu."),
    )
    const w = await render(PasswordForgotPage, '/password/reset')
    await w.get('[data-testid=forgot-email]').setValue('tiada@demo.test')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid=forgot-alert]').text()).toBe(
      "Kami tidak menemui pengguna dengan alamat emel itu.",
    )
    expect((w.get('[data-testid=forgot-email]').element as HTMLInputElement).value).toBe(
      'tiada@demo.test',
    )

    apiMocks.sendPasswordResetLink.mockRejectedValueOnce(
      new ApiError({
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Sila tunggu sebelum mencuba semula.',
        fields: { email: 'Sila tunggu sebelum mencuba semula.' },
        retryAfter: 40,
      }),
    )
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid=forgot-alert]').text()).toBe('Sila tunggu sebelum mencuba semula.')
  })
})

describe('PasswordResetPage (S4)', () => {
  it('renders for any token and pre-fills the email from ?email=', async () => {
    const w = await render(PasswordResetPage, '/password/reset/apa-apa?email=pelajar@demo.test')
    expect(w.get('h1').text()).toBe('Set Semula Kata Laluan')
    expect(w.text()).toContain('Masukkan kata laluan baru anda.')
    expect((w.get('[data-testid=reset-email]').element as HTMLInputElement).value).toBe(
      'pelajar@demo.test',
    )
    expect(w.get('input[name=token]').attributes('value')).toBe('apa-apa')
    expect(w.get('[data-testid=reset-password]').attributes()).toMatchObject({
      autocomplete: 'new-password',
      placeholder: 'Minimum 6 aksara',
      required: '',
    })
    expect(w.get('[data-testid=reset-confirm]').attributes()).toMatchObject({
      autocomplete: 'new-password',
      placeholder: 'Taip semula kata laluan',
    })
    expect(w.get('[data-testid=reset-submit]').text()).toBe('Tukar Kata Laluan')
    expect(w.findAll('a').map((a) => a.attributes('href'))).toEqual(['/login'])
  })

  it('leaves the email empty and editable without ?email=', async () => {
    const w = await render(PasswordResetPage, '/password/reset/apa-apa')
    const email = w.get('[data-testid=reset-email]')
    expect((email.element as HTMLInputElement).value).toBe('')
    expect(email.attributes('readonly')).toBeUndefined()
  })

  it('toggles both password fields independently', async () => {
    const w = await render(PasswordResetPage, '/password/reset/apa-apa')
    await w.get('[data-testid=reset-password-toggle]').trigger('click')
    expect(w.get('[data-testid=reset-password]').attributes('type')).toBe('text')
    expect(w.get('[data-testid=reset-confirm]').attributes('type')).toBe('password')
  })

  it('stores the session, queues the flash and goes to the landing page', async () => {
    apiMocks.resetPassword.mockResolvedValue({
      session: SESSION,
      status: 'Kata laluan anda telah ditetapkan semula.',
    })
    const w = await render(
      PasswordResetPage,
      '/password/reset/demo-reset-token?email=pelajar@demo.test',
    )
    await w.get('[data-testid=reset-password]').setValue('BaruBaru1')
    await w.get('[data-testid=reset-confirm]').setValue('BaruBaru1')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(apiMocks.resetPassword).toHaveBeenCalledWith({
      token: 'demo-reset-token',
      email: 'pelajar@demo.test',
      password: 'BaruBaru1',
      passwordConfirmation: 'BaruBaru1',
    })
    expect(useSessionStore().user?.id).toBe(2)
    expect(useFlashStore().pending).toEqual({
      type: 'success',
      message: 'Kata laluan anda telah ditetapkan semula.',
    })
    expect(router.currentRoute.value.fullPath).toBe('/dashboard')
  })

  it('shows the invalid-token alert, keeps the email and clears the passwords', async () => {
    apiMocks.resetPassword.mockRejectedValue(
      validationError('Token set semula kata laluan ini tidak sah.'),
    )
    const w = await render(
      PasswordResetPage,
      '/password/reset/demo-expired-token?email=pelajar@demo.test',
    )
    await w.get('[data-testid=reset-password]').setValue('BaruBaru1')
    await w.get('[data-testid=reset-confirm]').setValue('BaruBaru1')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid=reset-alert]').text()).toBe('Token set semula kata laluan ini tidak sah.')
    expect((w.get('[data-testid=reset-email]').element as HTMLInputElement).value).toBe(
      'pelajar@demo.test',
    )
    expect((w.get('[data-testid=reset-password]').element as HTMLInputElement).value).toBe('')
    expect(useSessionStore().isLoggedIn).toBe(false)
    expect(w.get('[data-testid=reset-submit]').attributes('disabled')).toBeUndefined()
  })

  it('shows the loading label "Menukar..." while pending', async () => {
    apiMocks.resetPassword.mockReturnValue(new Promise(() => undefined))
    const w = await render(PasswordResetPage, '/password/reset/x?email=a@b.my')
    await w.get('[data-testid=reset-password]').setValue('BaruBaru1')
    await w.get('form').trigger('submit')
    expect(w.get('[data-testid=reset-submit]').text()).toBe('Menukar...')
  })
})

describe('PasswordResetIcPage (S5)', () => {
  it('renders the live copy, the IC hint and maxlength 14 (DV-04)', async () => {
    const w = await render(PasswordResetIcPage, '/password/reset-ic')
    expect(w.get('h1').text()).toBe('Set Semula Melalui No IC')
    expect(w.text()).toContain(
      'Masukkan emel dan No Kad Pengenalan yang didaftarkan dalam profil anda.',
    )
    const ic = w.get('[data-testid=ic-number]')
    expect(ic.attributes()).toMatchObject({
      type: 'text',
      name: 'ic_number',
      required: '',
      maxlength: '14',
      placeholder: '000101010000',
    })
    expect(ic.attributes('inputmode')).toBeUndefined()
    expect(w.text()).toContain('Tanpa tanda sempang (-). Contoh: 000101010000')
    expect(w.get('[data-testid=ic-submit]').text()).toBe('Set Semula Kata Laluan')
    expect(document.activeElement).toBe(w.get('[data-testid=ic-email]').element)
  })

  it('goes to S4 pre-filled on a match, showing "Memproses..." meanwhile', async () => {
    let resolve!: (v: { token: string; email: string }) => void
    apiMocks.resetByIc.mockReturnValue(new Promise((r) => (resolve = r)))
    const w = await render(PasswordResetIcPage, '/password/reset-ic')
    await w.get('[data-testid=ic-email]').setValue('pelajar@demo.test')
    await w.get('[data-testid=ic-number]').setValue('100101140001')
    await w.get('form').trigger('submit')
    expect(w.get('[data-testid=ic-submit]').text()).toBe('Memproses...')
    resolve({ token: 'tok123', email: 'pelajar@demo.test' })
    await flushPromises()
    expect(apiMocks.resetByIc).toHaveBeenCalledWith('pelajar@demo.test', '100101140001')
    expect(router.currentRoute.value.path).toBe('/password/reset/tok123')
    expect(router.currentRoute.value.query.email).toBe('pelajar@demo.test')
  })

  it('shows the mismatch alert and keeps both values', async () => {
    apiMocks.resetByIc.mockRejectedValue(
      validationError('Emel atau No Kad Pengenalan tidak sepadan.'),
    )
    const w = await render(PasswordResetIcPage, '/password/reset-ic')
    await w.get('[data-testid=ic-email]').setValue('pelajar@demo.test')
    await w.get('[data-testid=ic-number]').setValue('000000000000')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid=ic-alert]').text()).toBe(
      'Emel atau No Kad Pengenalan tidak sepadan.',
    )
    expect((w.get('[data-testid=ic-email]').element as HTMLInputElement).value).toBe(
      'pelajar@demo.test',
    )
    expect((w.get('[data-testid=ic-number]').element as HTMLInputElement).value).toBe(
      '000000000000',
    )
    expect(router.currentRoute.value.path).toBe('/password/reset-ic')
  })
})
