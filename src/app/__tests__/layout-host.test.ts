// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FunctionalComponent } from 'vue'
import type { Router } from 'vue-router'

import { api, installTransport } from '@/api'
import { clock } from '@/lib/time'
import { setUnauthorizedRedirect } from '@/stores'

import LayoutHost from '../LayoutHost.vue'
import { resolveShell, setRouteOutcome } from '../router'
import { ADMIN, fakeTransport, logIn, NOW, STUDENT, testRouter } from './router-fixtures'

// The router is tested without the F-18/F-19 shell builds (F13-2): a stub frame stands in for each.
vi.mock('@/shells/user/UserShell.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    __esModule: true,
    default: defineComponent({
      name: 'UserShellStub',
      setup:
        (_props, { slots }) =>
        () =>
          h('div', { 'data-layout': 'user' }, slots.default?.()),
    }),
  }
})
// Same for the F-18 admin shell (lazy entry in layouts.ts).
vi.mock('@/shells/admin/AdminShell.vue', async () => {
  const { h } = await import('vue')
  const stub: FunctionalComponent = (_props, { slots }) =>
    h('div', { 'data-layout': 'admin' }, slots.default?.())
  return { __esModule: true, default: stub }
})
// Same for the v2 frames (Pembelajaran, Pentadbiran), chosen by role in every build.
vi.mock('@/shells/pembelajaran/PembelajaranLayout.vue', async () => {
  const { h } = await import('vue')
  const stub: FunctionalComponent = (_props, { slots }) =>
    h('div', { 'data-layout': 'pembelajaran' }, slots.default?.())
  return { __esModule: true, default: stub }
})
vi.mock('@/shells/pentadbiran/PentadbiranLayout.vue', async () => {
  const { h } = await import('vue')
  const stub: FunctionalComponent = (_props, { slots }) =>
    h('div', { 'data-layout': 'pentadbiran' }, slots.default?.())
  return { __esModule: true, default: stub }
})
// Same for the F-20 public layout (lazy entry in layouts.ts).
vi.mock('@/shells/public/PublicLayout.vue', async () => {
  const { h } = await import('vue')
  const stub: FunctionalComponent = (_props, { slots }) =>
    h('div', { 'data-layout': 'public' }, slots.default?.())
  return { __esModule: true, default: stub }
})

let pinia: Pinia
let router: Router
let wrapper: VueWrapper | null = null

async function open(path: string): Promise<VueWrapper> {
  router = testRouter()
  await router.push(path)
  wrapper = mount(LayoutHost, { global: { plugins: [pinia, router] }, attachTo: document.body })
  await flushPromises()
  await flushPromises()
  return wrapper
}

function layoutOf(w: VueWrapper): string | null {
  const el = w.find('[data-layout]')
  return el.exists() ? (el.attributes('data-layout') ?? null) : null
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: Date.parse(NOW), toFake: ['Date'] })
  clock.reset()
  pinia = createPinia()
  setActivePinia(pinia)
  setRouteOutcome(null)
  installTransport(fakeTransport())
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  clock.reset()
  vi.useRealTimers()
  setUnauthorizedRedirect(null)
  api.configure({ transport: null })
  vi.restoreAllMocks()
})

describe('resolveShell (overview §5.3)', () => {
  const guest = { isLoggedIn: false, role: null }
  const student = { isLoggedIn: true, role: 'student' as const }
  const admin = { isLoggedIn: true, role: 'admin' as const }

  // Vitest runs with VITE_PROTOTYPE_SCOPE=off: the v2 frames are picked all the same.
  it('maps each layout mode', () => {
    expect(resolveShell('admin', student)).toBe('admin')
    expect(resolveShell('user', admin)).toBe('pentadbiran')
    expect(resolveShell('bare', admin)).toBeNull()
  })

  it("'role': Pentadbiran for admin, Pembelajaran for v2 roles, legacy user shell otherwise", () => {
    expect(resolveShell('role', admin)).toBe('pentadbiran')
    for (const role of ['student', 'teacher', 'school_admin'] as const) {
      expect(resolveShell('role', { isLoggedIn: true, role })).toBe('pembelajaran')
    }
    for (const role of ['parent', 'sponsor', 'ppd_officer'] as const) {
      expect(resolveShell('role', { isLoggedIn: true, role })).toBe('user')
    }
  })

  it("'public-or-user': public layout for a guest, the role's user frame when logged in", () => {
    expect(resolveShell('public-or-user', guest)).toBe('public')
    expect(resolveShell('public-or-user', student)).toBe('pembelajaran')
    expect(resolveShell('public-or-user', { isLoggedIn: true, role: 'parent' })).toBe('user')
  })
})

describe('LayoutHost', () => {
  it('wraps a user route in the Pembelajaran frame for a student and renders the page', async () => {
    logIn(STUDENT)
    const w = await open('/dashboard')
    expect(layoutOf(w)).toBe('pembelajaran')
    expect(w.find('[data-layout="pembelajaran"] [data-testid="dashboard"]').exists()).toBe(true)
  })

  it('renders a bare route with no shell', async () => {
    const w = await open('/login')
    expect(layoutOf(w)).toBeNull()
    expect(w.find('[data-testid="login"]').exists()).toBe(true)
  })

  it("'role' layout follows the session role", async () => {
    logIn(ADMIN)
    expect(layoutOf(await open('/tetapan'))).toBe('pentadbiran')
    wrapper?.unmount()
    logIn(STUDENT)
    expect(layoutOf(await open('/tetapan'))).toBe('pembelajaran')
  })

  it("'public-or-user' layout follows the session", async () => {
    expect(layoutOf(await open('/artikel'))).toBe('public')
    wrapper?.unmount()
    logIn(STUDENT)
    expect(layoutOf(await open('/artikel'))).toBe('pembelajaran')
  })

  it('keeps the same shell mounted across routes of the same layout', async () => {
    logIn(STUDENT)
    const w = await open('/dashboard')
    const shellEl = w.find('[data-layout="pembelajaran"]').element
    await router.push('/tetapan')
    await flushPromises()
    await flushPromises()
    expect(w.find('[data-layout="pembelajaran"]').element).toBe(shellEl)
    expect(w.find('[data-testid="tetapan"]').exists()).toBe(true)
  })

  it('renders the 403 page in place, without a shell, for onForbidden 403', async () => {
    logIn(STUDENT)
    const w = await open('/prestasi-sekolah')
    expect(router.currentRoute.value.path).toBe('/prestasi-sekolah')
    expect(w.find('[data-page="forbidden"]').exists()).toBe(true)
    expect(w.find('[data-testid="school-performance"]').exists()).toBe(false)
    expect(layoutOf(w)).toBeNull()
  })

  it('renders the 404 placeholder for an unknown path', async () => {
    const w = await open('/tiada-halaman')
    expect(w.find('[data-page="not-found"]').exists()).toBe(true)
  })
})
