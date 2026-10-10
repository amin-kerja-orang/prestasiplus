// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'
import { useSessionStore, type UserMe } from '@/stores'

import { navFor } from '../nav/user-nav'
import ImpersonationBanner from '../user/ImpersonationBanner.vue'

const leave = vi.hoisted(() => vi.fn())
vi.mock('@/modules/m27-school-admin', () => ({ leaveImpersonation: leave }))

const user = (over: Partial<UserMe>): UserMe => ({
  id: 3001,
  name: 'Murid Contoh Satu',
  email: 'murid1@demo.test',
  phone: null,
  role: 'student',
  grade: 5,
  schoolId: 900001,
  bio: null,
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00+08:00',
  updatedAt: '2026-01-01T00:00:00+08:00',
  lastLoginAt: null,
  school: null,
  landingPath: '/dashboard',
  ...over,
})

const FUTURE = '2099-01-01T00:00:00+08:00'

let pinia: Pinia
let router: Router
let wrapper: VueWrapper | null = null

async function mountBanner(): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/dashboard')
  await router.isReady()
  wrapper = mount(ImpersonationBanner, { global: { plugins: [pinia, router] } })
  return wrapper
}

function impersonate(): void {
  useSessionStore().setSession({
    token: 'pupil-token',
    remember: false,
    expiresAt: FUTURE,
    user: user({}),
    impersonator: { id: 8, name: 'Admin Contoh', returnTo: '/admin-sekolah/pelajar' },
  })
}

beforeEach(() => {
  localStorage.clear()
  pinia = createPinia()
  setActivePinia(pinia)
  leave.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('ImpersonationBanner', () => {
  it('renders nothing for an ordinary session', async () => {
    useSessionStore().setSession({ token: 't', remember: false, expiresAt: FUTURE, user: user({}) })
    const w = await mountBanner()
    expect(w.find('[data-testid="impersonation-banner"]').exists()).toBe(false)
  })

  it('shows the target name and "Kembali ke Admin" while impersonating, with no dismiss control', async () => {
    impersonate()
    const w = await mountBanner()
    expect(w.get('[data-testid="impersonation-text"]').text()).toBe(
      'Mod menyamar — anda melihat sebagai Murid Contoh Satu',
    )
    const buttons = w.findAll('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]?.text()).toBe('Kembali ke Admin')
  })

  it('leave restores the admin session, flashes the status and opens returnTo', async () => {
    impersonate()
    leave.mockResolvedValue({
      data: {
        token: 'admin-token',
        expiresAt: FUTURE,
        user: user({
          id: 8,
          name: 'Admin Contoh',
          role: 'school_admin',
          landingPath: '/admin-sekolah',
        }),
        returnTo: '/admin-sekolah/pelajar',
      },
      status: 'Anda telah kembali ke akaun pentadbir.',
    })
    const w = await mountBanner()
    await w.get('[data-testid="impersonation-leave"]').trigger('click')
    await flushPromises()
    const session = useSessionStore()
    expect(session.token).toBe('admin-token')
    expect(session.role).toBe('school_admin')
    expect(session.impersonator).toBeNull()
    expect(router.currentRoute.value.path).toBe('/admin-sekolah/pelajar')
    expect(useFlashStore().pending).toEqual({
      type: 'success',
      message: 'Anda telah kembali ke akaun pentadbir.',
    })
    expect(w.find('[data-testid="impersonation-banner"]').exists()).toBe(false)
  })

  it('a 403 clears the session and opens /login', async () => {
    impersonate()
    leave.mockRejectedValue(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Tiada akses.' }),
    )
    const w = await mountBanner()
    await w.get('[data-testid="impersonation-leave"]').trigger('click')
    await flushPromises()
    expect(useSessionStore().isLoggedIn).toBe(false)
    expect(router.currentRoute.value.path).toBe('/login')
  })
})

describe('school admin sidebar (XR-M27-11)', () => {
  it('"Amaran Awal" points at /amaran/sekolah', () => {
    const entry = navFor('school_admin', 'sidebar').find((e) => e.id === 'sa-amaran-awal')
    expect(entry).toMatchObject({ to: '/amaran/sekolah' })
  })
})
