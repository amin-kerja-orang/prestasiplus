// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { api, ApiError } from '@/api'
import { isPathInScope, PROTOTYPE_ROLES } from '@/app/prototype-scope'
import { useFlashStore } from '@/stores/flash'
import { useNotificationBadgeStore } from '@/stores/notification-badge'
import { useSessionStore } from '@/stores/session'

import type { ClientSession } from '../../api'
import PasswordChangeRequiredPage from '../../pages/PasswordChangeRequiredPage.vue'
import routes from '../../routes/password'

const apiMocks = vi.hoisted(() => ({ changePassword: vi.fn(), getSession: vi.fn() }))
vi.mock('../../api', () => apiMocks)

const user = {
  id: 2,
  name: 'Pelajar Demo',
  email: 'pelajar@demo.test',
  phone: null,
  role: 'student' as const,
  grade: 10,
  schoolId: null,
  bio: null,
  avatarUrl: null,
  createdAt: '2026-02-06T09:00:00+08:00',
  updatedAt: '2026-02-06T09:00:00+08:00',
  lastLoginAt: null,
  school: null,
  landingPath: '/dashboard',
}

/** The session the user holds while flagged. */
const OLD: ClientSession = {
  token: 'csrf-old',
  csrf: 'csrf-old',
  remember: false,
  expiresAt: '2099-01-01T00:00:00+08:00',
  user,
}

/** The session `GET /api/session` returns after the change (rotated CSRF). */
const FRESH: ClientSession = {
  ...OLD,
  token: 'csrf-new',
  csrf: 'csrf-new',
  user: { ...user, landingPath: '/guru' },
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/password/change', component: PasswordChangeRequiredPage },
      { path: '/:rest(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push('/password/change')
  wrapper = mount(PasswordChangeRequiredPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

async function fillAndSubmit(
  w: VueWrapper,
  current = 'lama123',
  next = 'baru123',
  again = next,
): Promise<void> {
  await w.get('[data-testid=change-current]').setValue(current)
  await w.get('[data-testid=change-new]').setValue(next)
  await w.get('[data-testid=change-confirm]').setValue(again)
  await w.get('form').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  useSessionStore().setSession(OLD)
  apiMocks.changePassword.mockReset()
  apiMocks.getSession.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.restoreAllMocks()
})

describe('PasswordChangeRequiredPage (AM2-A1)', () => {
  it('renders the heading, the server notice, three password fields and a logout link', async () => {
    const w = await render()
    expect(w.get('h1').text()).toBe('Tukar Kata Laluan')
    expect(w.text()).toContain('Sila tukar kata laluan anda sebelum meneruskan.')
    expect(w.get('[data-testid=change-current]').attributes()).toMatchObject({
      type: 'password',
      autocomplete: 'current-password',
    })
    expect(w.get('[data-testid=change-new]').attributes('autocomplete')).toBe('new-password')
    expect(w.get('[data-testid=change-confirm]').attributes('autocomplete')).toBe('new-password')
    expect(w.get('[data-testid=change-logout]').attributes('href')).toBe('/logout')
  })

  it('on success reads the session again, stores it and goes to its landing path', async () => {
    apiMocks.changePassword.mockResolvedValue('Kata laluan berjaya ditukar.')
    apiMocks.getSession.mockResolvedValue(FRESH)
    const w = await render()
    await fillAndSubmit(w)

    expect(apiMocks.changePassword).toHaveBeenCalledWith({
      currentPassword: 'lama123',
      password: 'baru123',
      passwordConfirmation: 'baru123',
    })
    expect(apiMocks.getSession).toHaveBeenCalledWith(false)
    const session = useSessionStore()
    expect(session.token).toBe('csrf-new')
    expect(session.landingPath).toBe('/guru')
    expect(router.currentRoute.value.path).toBe('/guru')
    expect(useFlashStore().pending?.message).toBe('Kata laluan berjaya ditukar.')
  })

  it('keeps the current session when there is nothing to refresh (mock mode)', async () => {
    apiMocks.changePassword.mockResolvedValue('Kata laluan berjaya ditukar.')
    apiMocks.getSession.mockResolvedValue(null)
    const w = await render()
    await fillAndSubmit(w)
    expect(useSessionStore().token).toBe('csrf-old')
    expect(router.currentRoute.value.path).toBe('/dashboard')
  })

  it('shows the server field errors, clears the new passwords and stays on the page', async () => {
    apiMocks.changePassword.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Kata laluan semasa tidak betul.',
        fields: {
          currentPassword: 'Kata laluan semasa tidak betul.',
          password: 'Kata laluan mesti sekurang-kurangnya 6 aksara.',
        },
      }),
    )
    const w = await render()
    await fillAndSubmit(w, 'salah', 'abc')

    const alert = w.get('[data-testid=change-alert]')
    expect(alert.text()).toContain('Kata laluan semasa tidak betul.')
    expect(alert.text()).toContain('Kata laluan mesti sekurang-kurangnya 6 aksara.')
    expect(apiMocks.getSession).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/password/change')
    expect(useSessionStore().token).toBe('csrf-old')
    expect((w.get('[data-testid=change-new]').element as HTMLInputElement).value).toBe('')
  })

  it('signs out (server best effort, local always) and goes to /login when the session cannot be read', async () => {
    apiMocks.changePassword.mockResolvedValue('Kata laluan berjaya ditukar.')
    apiMocks.getSession.mockRejectedValue(new Error('offline'))
    // The server logout answers 403 here (stale CSRF): the local session is cleared anyway.
    const post = vi.spyOn(api, 'post').mockRejectedValue(new Error('403'))
    useNotificationBadgeStore().set(5)
    const w = await render()
    await fillAndSubmit(w)
    expect(post).toHaveBeenCalledWith('/api/auth/logout')
    expect(useSessionStore().isLoggedIn).toBe(false)
    expect(useNotificationBadgeStore().count).toBe(0)
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('keeps the remember flag of the signed-in session when it reads the new one', async () => {
    useSessionStore().setSession({ ...OLD, remember: true })
    apiMocks.changePassword.mockResolvedValue('Kata laluan berjaya ditukar.')
    apiMocks.getSession.mockResolvedValue({ ...FRESH, remember: true })
    const w = await render()
    await fillAndSubmit(w)
    expect(apiMocks.getSession).toHaveBeenCalledWith(true)
    expect(useSessionStore().remember).toBe(true)
    expect(useSessionStore().token).toBe('csrf-new')
  })

  it('shows the server throttle text on a 429 and stays on the page', async () => {
    apiMocks.changePassword.mockRejectedValue(
      new ApiError({
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Terlalu banyak percubaan. Sila cuba lagi sebentar.',
        retryAfter: 60,
      }),
    )
    const w = await render()
    await fillAndSubmit(w)
    expect(w.get('[data-testid=change-alert]').text()).toContain(
      'Terlalu banyak percubaan. Sila cuba lagi sebentar.',
    )
    expect(apiMocks.getSession).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/password/change')
  })

  it('never calls any other API than the password change and the session read', async () => {
    apiMocks.changePassword.mockResolvedValue('Kata laluan berjaya ditukar.')
    apiMocks.getSession.mockResolvedValue(FRESH)
    const spies = (['get', 'post', 'put', 'patch', 'delete'] as const).map((m) =>
      vi.spyOn(api, m).mockRejectedValue(new Error(`unexpected api.${m}`)),
    )
    const w = await render()
    await fillAndSubmit(w)
    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
    expect(apiMocks.changePassword).toHaveBeenCalledTimes(1)
    expect(apiMocks.getSession).toHaveBeenCalledTimes(1)
  })
})

describe('route /password/change', () => {
  it('needs a session (any role), draws its own screen and is in every prototype scope', () => {
    const route = routes.find((r) => r.path === '/password/change')
    expect(route?.meta).toMatchObject({ layout: 'bare', access: 'auth', module: 'M01' })
    expect(route?.meta?.roles).toBeUndefined()
    for (const role of PROTOTYPE_ROLES) expect(isPathInScope(role, '/password/change')).toBe(true)
  })
})
