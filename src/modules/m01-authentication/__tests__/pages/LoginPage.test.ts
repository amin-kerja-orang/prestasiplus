// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useSessionStore } from '@/stores/session'

import type { ClientSession } from '../../api'
import LoginPage from '../../pages/LoginPage.vue'

const apiMocks = vi.hoisted(() => ({ login: vi.fn(), getPlatformStats: vi.fn() }))
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

let wrapper: VueWrapper | null = null
let router: Router

async function render(): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: LoginPage },
      { path: '/dashboard', component: { template: '<div />' } },
      { path: '/:rest(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push('/login')
  wrapper = mount(LoginPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

async function fillAndSubmit(w: VueWrapper, email: string, password: string): Promise<void> {
  await w.get('[data-testid=login-email]').setValue(email)
  await w.get('[data-testid=login-password]').setValue(password)
  await w.get('form').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  apiMocks.login.mockReset()
  apiMocks.getPlatformStats.mockReset()
  apiMocks.getPlatformStats.mockResolvedValue({
    questionCount: 128989,
    subjectCount: 31,
    levelCount: 11,
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('LoginPage (M01 S1)', () => {
  it('renders the live fields with native validation attributes and no novalidate', async () => {
    const w = await render()
    const email = w.get('[data-testid=login-email]')
    expect(email.attributes()).toMatchObject({
      type: 'email',
      required: '',
      autocomplete: 'email',
      placeholder: 'nama@email.com',
    })
    const password = w.get('[data-testid=login-password]')
    expect(password.attributes()).toMatchObject({
      type: 'password',
      required: '',
      autocomplete: 'current-password',
      placeholder: '••••••••',
    })
    expect(w.get('form').attributes('novalidate')).toBeUndefined()
    expect(w.get('[data-testid=login-remember]').attributes('aria-checked')).toBe('false')
    expect(w.text()).toContain('Alamat Emel')
    expect(w.text()).toContain('Kata Laluan')
    expect(w.text()).toContain('© 2026 PRESTASIPLUS. Platform Pendidikan Malaysia.')
  })

  it('links to reset, register and home, exactly as FR-M01-06', async () => {
    const w = await render()
    const links = w.findAll('form a').map((a) => [a.text(), a.attributes('href')])
    expect(links).toEqual([
      ['Lupa kata laluan?', '/password/reset'],
      ['Set Semula melalui No IC', '/password/reset-ic'],
      ['Belum ada akaun? Daftar Sekarang 🚀', '/register'],
      ['Kembali ke Laman Utama', '/'],
    ])
  })

  it('shows the derived stats in the welcome text and the strip (FR-M01-11)', async () => {
    const w = await render()
    expect(w.get('[data-testid=welcome-question-count]').text()).toBe('128,989')
    expect(
      w
        .findAll('[data-testid=login-stats] li')
        .map((li) => li.text())
        .join(' '),
    ).toBe('128,989+ Soalan 31 Subjek 11 Tahap')
    expect(w.text()).toContain('soalan latihan dalam 31 subjek berbeza!')
  })

  it('toggles the password visibility without submitting (FR-M01-04)', async () => {
    const w = await render()
    const input = w.get('[data-testid=login-password]')
    const toggle = w.get('[data-testid=login-password-toggle]')
    expect(toggle.attributes('type')).toBe('button')
    await toggle.trigger('click')
    expect(input.attributes('type')).toBe('text')
    await toggle.trigger('click')
    expect(input.attributes('type')).toBe('password')
    expect(apiMocks.login).not.toHaveBeenCalled()
  })

  it('keeps the welcome paragraph and stats strip hidden while stats load and when they fail', async () => {
    apiMocks.getPlatformStats.mockReturnValue(new Promise(() => {}))
    const w = await render()
    expect(w.find('[data-testid=login-stats]').exists()).toBe(false)
    expect(w.find('[data-testid=welcome-question-count]').exists()).toBe(false)
    expect(w.text()).not.toContain('Teruskan pembelajaran')
    w.unmount()

    apiMocks.getPlatformStats.mockRejectedValue(new Error('Failed to fetch'))
    const failed = await render()
    expect(failed.find('[data-testid=login-stats]').exists()).toBe(false)
    expect(failed.find('[data-testid=welcome-question-count]').exists()).toBe(false)
    expect(failed.text()).not.toContain('Teruskan pembelajaran')
  })

  it('sends remember: false when "Ingat saya" is not ticked', async () => {
    apiMocks.login.mockResolvedValue(SESSION)
    const w = await render()
    await fillAndSubmit(w, 'pelajar@demo.test', 'Demo1234')
    expect(apiMocks.login).toHaveBeenCalledWith({
      email: 'pelajar@demo.test',
      password: 'Demo1234',
      remember: false,
    })
  })

  it('shows the loading state while the request is pending (FR-M01-07)', async () => {
    let resolve!: (session: ClientSession) => void
    apiMocks.login.mockReturnValue(new Promise<ClientSession>((r) => (resolve = r)))
    const w = await render()
    await fillAndSubmit(w, 'pelajar@demo.test', 'Demo1234')
    const button = w.get('[data-testid=login-submit]')
    expect(button.text()).toBe('Sedang Memasuki...')
    expect(button.attributes('disabled')).toBeDefined()
    resolve(SESSION)
    await flushPromises()
    expect(w.get('[data-testid=login-submit]').text()).toBe('Log Masuk')
  })

  it('stores the session and goes to the landing path with no message', async () => {
    apiMocks.login.mockResolvedValue(SESSION)
    const w = await render()
    await w.get('[data-testid=login-remember]').trigger('click')
    await fillAndSubmit(w, 'pelajar@demo.test', 'Demo1234')
    expect(apiMocks.login).toHaveBeenCalledWith({
      email: 'pelajar@demo.test',
      password: 'Demo1234',
      remember: true,
    })
    expect(useSessionStore().user?.id).toBe(2)
    expect(router.currentRoute.value.fullPath).toBe('/dashboard')
  })

  it('keeps the email, clears the password and shows the server text on failure (FR-M01-09)', async () => {
    apiMocks.login.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Emel atau kata laluan tidak sah.',
        fields: { email: 'Emel atau kata laluan tidak sah.' },
      }),
    )
    const w = await render()
    await fillAndSubmit(w, 'x@demo.test', 'salah')
    expect(w.get('[data-testid=login-alert]').text()).toBe('Emel atau kata laluan tidak sah.')
    expect((w.get('[data-testid=login-email]').element as HTMLInputElement).value).toBe(
      'x@demo.test',
    )
    expect((w.get('[data-testid=login-password]').element as HTMLInputElement).value).toBe('')
    expect(useSessionStore().isLoggedIn).toBe(false)
    expect(router.currentRoute.value.fullPath).toBe('/login')
    expect(w.get('[data-testid=login-submit]').attributes('disabled')).toBeUndefined()
  })

  it('shows the inactive-account and throttle messages in the same alert (FR-M01-10, 68)', async () => {
    apiMocks.login.mockRejectedValueOnce(
      new ApiError({
        status: 403,
        code: 'ACCOUNT_INACTIVE',
        message: 'Akaun anda tidak aktif. Sila hubungi pentadbir.',
      }),
    )
    const w = await render()
    await fillAndSubmit(w, 'tidakaktif@demo.test', 'Demo1234')
    expect(w.get('[data-testid=login-alert]').text()).toBe(
      'Akaun anda tidak aktif. Sila hubungi pentadbir.',
    )

    apiMocks.login.mockRejectedValueOnce(
      new ApiError({
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Too many login attempts. Please try again in 30 seconds.',
        fields: { email: 'Too many login attempts. Please try again in 30 seconds.' },
        retryAfter: 30,
      }),
    )
    await fillAndSubmit(w, 'tidakaktif@demo.test', 'Demo1234')
    expect(w.get('[data-testid=login-alert]').text()).toBe(
      'Too many login attempts. Please try again in 30 seconds.',
    )
  })
})
