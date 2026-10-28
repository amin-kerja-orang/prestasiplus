// @vitest-environment jsdom
/* eslint-disable vue/one-component-per-file -- tiny stub pages and shells, like layout-host.test.ts */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, type FunctionalComponent } from 'vue'
import { createMemoryHistory, type RouteLocationNormalized } from 'vue-router'

import { api, installTransport } from '@/api'
import { clock } from '@/lib/time'
import { setUnauthorizedRedirect } from '@/stores'

import LayoutHost from '../LayoutHost.vue'
import type { ModuleManifest } from '../modules'
import { createAppRouter, decideAccess, setRouteOutcome, useRouteOutcome } from '../router'
import { ADMIN, fakeTransport, logIn, NOW, STUDENT } from './router-fixtures'

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
vi.mock('@/shells/pembelajaran/PembelajaranLayout.vue', async () => {
  const { h } = await import('vue')
  const stub: FunctionalComponent = (_props, { slots }) =>
    h('div', { 'data-layout': 'pembelajaran' }, slots.default?.())
  return { __esModule: true, default: stub }
})
vi.mock('@/shells/admin/AdminShell.vue', async () => {
  const { h } = await import('vue')
  const stub: FunctionalComponent = (_props, { slots }) =>
    h('div', { 'data-layout': 'admin' }, slots.default?.())
  return { __esModule: true, default: stub }
})
vi.mock('@/shells/public/PublicLayout.vue', async () => {
  const { h } = await import('vue')
  const stub: FunctionalComponent = (_props, { slots }) =>
    h('div', { 'data-layout': 'public' }, slots.default?.())
  return { __esModule: true, default: stub }
})

const page = (id: string) =>
  defineComponent({ name: `P_${id}`, setup: () => () => h('p', { 'data-testid': id }, id) })

const REGISTRY: readonly ModuleManifest[] = [
  {
    id: 'M99',
    slug: 'm99-scope',
    routes: [
      { path: '/login', component: page('login'), meta: { layout: 'bare', access: 'public' } },
      {
        path: '/dashboard',
        component: page('dashboard'),
        meta: { layout: 'user', access: 'auth' },
      },
      { path: '/practice', component: page('practice'), meta: { layout: 'user', access: 'auth' } },
      // Not in the Murid matrix.
      {
        path: '/misi-harian',
        component: page('misi-harian'),
        meta: { layout: 'user', access: 'auth' },
      },
      {
        path: '/pricing',
        component: page('pricing'),
        meta: { layout: 'bare', access: 'auth' },
      },
      {
        path: '/sponsor/register',
        component: page('sponsor-register'),
        meta: { layout: 'bare', access: 'public' },
      },
      {
        path: '/admin/users',
        component: page('admin-users'),
        meta: { layout: 'admin', access: 'auth', roles: ['admin'], onForbidden: '403' },
      },
    ],
  },
]

const fakeRoute = (path: string, name?: string): RouteLocationNormalized =>
  ({ path, name, meta: { access: 'auth' } }) as unknown as RouteLocationNormalized

const session = (role: string | null) =>
  ({ isLoggedIn: role !== null, role, landingPath: '/dashboard' }) as never

describe('decideAccess with the prototype scope on', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("sends an out-of-scope route of a logged-in role to the role's home", () => {
    expect(decideAccess(fakeRoute('/misi-harian', 'm05.missions'), session('student'))).toEqual({
      kind: 'redirect',
      to: '/dashboard',
    })
  })

  it("keeps the in-place 'scope' outcome for a role outside the prototype", () => {
    expect(decideAccess(fakeRoute('/misi-harian', 'x'), session('parent'))).toEqual({
      kind: 'in-place',
      status: 'scope',
    })
  })

  it('lets an in-scope route through', () => {
    expect(decideAccess(fakeRoute('/practice/chapter', 'x'), session('student'))).toEqual({
      kind: 'allow',
    })
    expect(decideAccess(fakeRoute('/guru/kirkpatrick/chain', 'x'), session('teacher'))).toEqual({
      kind: 'allow',
    })
  })

  it('sends a teacher or school admin from the student /dashboard to their own dashboard', () => {
    expect(decideAccess(fakeRoute('/dashboard', 'm05.dashboard'), session('teacher'))).toEqual({
      kind: 'redirect',
      to: '/guru',
    })
    expect(decideAccess(fakeRoute('/dashboard', 'm05.dashboard'), session('school_admin'))).toEqual(
      { kind: 'redirect', to: '/admin-sekolah' },
    )
    expect(decideAccess(fakeRoute('/dashboard', 'm05.dashboard'), session('student'))).toEqual({
      kind: 'allow',
    })
  })

  it('redirects an unbuilt or mistyped path of a logged-in user to their home', () => {
    expect(decideAccess(fakeRoute('/liga', 'core.not-found'), session('teacher'))).toEqual({
      kind: 'redirect',
      to: '/guru',
    })
  })

  it('keeps the plain 404 for a guest, and for an in-scope path no screen exists for', () => {
    // The catch-all 404 route is public.
    const catchAll = { path: '/entah-apa', name: 'core.not-found', meta: { access: 'public' } }
    expect(decideAccess(catchAll as never, session(null))).toEqual({ kind: 'allow' })
    expect(
      decideAccess(fakeRoute('/guru/laporan-mingguan-kelas', 'core.not-found'), session('teacher')),
    ).toEqual({ kind: 'allow' })
  })

  it('still redirects a role the route refuses before it looks at the scope', () => {
    const route = { path: '/guru', name: 'x', meta: { access: 'auth', roles: ['teacher'] } }
    expect(decideAccess(route as never, session('student'))).toEqual({
      kind: 'redirect',
      to: '/dashboard',
    })
  })

  it('does not apply when the switch is off', () => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'off')
    expect(decideAccess(fakeRoute('/misi-harian', 'x'), session('student'))).toEqual({
      kind: 'allow',
    })
  })
})

describe('v2 staff home from /dashboard, scope on or off (UAT runs with it off)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const HOMES = [
    ['teacher', '/guru'],
    ['school_admin', '/admin-sekolah'],
    ['admin', '/admin/command-center'],
  ] as const

  it.each(['on', 'off'])('scope %s: a v2 staff role leaves /dashboard for its own home', (scope) => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', scope)
    for (const [role, home] of HOMES) {
      expect(decideAccess(fakeRoute('/dashboard', 'm05.dashboard'), session(role)), role).toEqual({
        kind: 'redirect',
        to: home,
      })
      // No loop: the home itself is let through (it never leads back to /dashboard).
      expect(decideAccess(fakeRoute(home, 'x'), session(role)), `${role} ${home}`).toEqual({
        kind: 'allow',
      })
    }
    // The student keeps /dashboard; a role outside v2 and a guest are not redirected there.
    expect(decideAccess(fakeRoute('/dashboard', 'm05.dashboard'), session('student'))).toEqual({
      kind: 'allow',
    })
    if (scope === 'off') {
      expect(decideAccess(fakeRoute('/dashboard', 'm05.dashboard'), session('parent'))).toEqual({
        kind: 'allow',
      })
    }
    expect(decideAccess(fakeRoute('/dashboard', 'm05.dashboard'), session(null))).toEqual({
      kind: 'redirect',
      to: '/login',
    })
  })
})

describe('LayoutHost: "Belum tersedia dalam prototaip"', () => {
  let wrapper: VueWrapper | null = null

  async function open(path: string): Promise<VueWrapper> {
    const router = createAppRouter({ history: createMemoryHistory(), registry: REGISTRY })
    await router.push(path)
    wrapper = mount(LayoutHost, {
      global: { plugins: [createPinia(), router] },
      attachTo: document.body,
    })
    await flushPromises()
    await flushPromises()
    return wrapper
  }

  beforeEach(() => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
    localStorage.clear()
    vi.useFakeTimers({ now: Date.parse(NOW), toFake: ['Date'] })
    clock.reset()
    setActivePinia(createPinia())
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
    vi.unstubAllEnvs()
  })

  it('redirects a typed out-of-scope URL to the role home instead of the friendly page', async () => {
    logIn(STUDENT)
    const w = await open('/misi-harian')
    expect(useRouteOutcome().value).toBeNull()
    expect(w.find('[data-testid="prototype-unavailable"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Belum tersedia dalam prototaip')
    expect(w.find('[data-testid="misi-harian"]').exists()).toBe(false)
  })

  it('redirects a blocked bare page the same way', async () => {
    logIn(STUDENT)
    const w = await open('/pricing')
    expect(w.find('[data-testid="prototype-unavailable"]').exists()).toBe(false)
  })

  it('renders an in-scope route normally and clears the outcome', async () => {
    logIn(STUDENT)
    const w = await open('/practice')
    expect(useRouteOutcome().value).toBeNull()
    expect(w.find('[data-testid="practice"]').exists()).toBe(true)
    expect(w.find('[data-testid="prototype-unavailable"]').exists()).toBe(false)
  })

  it('a role outside the prototype restored from storage gets a "Log Keluar" button, not /login', async () => {
    logIn({ ...ADMIN, role: 'parent' })
    const w = await open('/misi-harian')
    const home = w.find('[data-testid="prototype-unavailable-home"]')
    expect(home.attributes('href')).toBe('/logout')
    expect(home.text()).toBe('Log Keluar')
  })

  it('shows it on its own (no shell) for a guest on a public page outside the scope', async () => {
    const w = await open('/sponsor/register')
    expect(w.find('[data-layout]').exists()).toBe(false)
    expect(w.find('[data-testid="prototype-unavailable"]').exists()).toBe(true)
    expect(w.find('[data-testid="prototype-unavailable-home"]').attributes('href')).toBe('/login')
  })

  it('still sends a guest on a protected route to /login', async () => {
    const w = await open('/misi-harian')
    expect(w.find('[data-testid="login"]').exists()).toBe(true)
  })

  it('a Murid on an admin route keeps the 403 page, not the scope page', async () => {
    logIn(STUDENT)
    const w = await open('/admin/users')
    expect(useRouteOutcome().value).toBe(403)
    expect(w.find('[data-testid="prototype-unavailable"]').exists()).toBe(false)
  })
})
