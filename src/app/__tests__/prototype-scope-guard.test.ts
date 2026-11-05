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
import { fakeTransport, logIn, NOW, STUDENT } from './router-fixtures'

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

  it.each([
    ['student', '/misi-harian'],
    ['teacher', '/misi-harian'],
    ['school_admin', '/misi-harian'],
    // A role outside the prototype (parent) has no matrix list at all.
    ['parent', '/misi-harian'],
    ['parent', '/practice'],
  ])('answers an in-place 404, no redirect, for %s on %s (outside the matrix)', (role, path) => {
    expect(decideAccess(fakeRoute(path, 'x'), session(role))).toEqual({
      kind: 'in-place',
      status: 404,
    })
  })

  it('answers an in-place 404 for a guest on a public page outside the matrix', () => {
    const route = { path: '/sponsor/register', name: 'x', meta: { access: 'public' } }
    expect(decideAccess(route as never, session(null))).toEqual({ kind: 'in-place', status: 404 })
  })

  it('lets an in-scope route through', () => {
    expect(decideAccess(fakeRoute('/practice/chapter', 'x'), session('student'))).toEqual({
      kind: 'allow',
    })
    expect(decideAccess(fakeRoute('/guru/kirkpatrick/chain', 'x'), session('teacher'))).toEqual({
      kind: 'allow',
    })
  })

  it.each(['/guru/profil', '/guru/profil/edit', '/guru/profil/123'])(
    'lets a teacher open the profile page %s (A1 covers /guru/profil, not a 404)',
    (path) => {
      expect(decideAccess(fakeRoute(path, 'x'), session('teacher'))).toEqual({ kind: 'allow' })
    },
  )

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

  it('answers 404 in place for an unbuilt or mistyped path of a logged-in user and of a guest', () => {
    expect(decideAccess(fakeRoute('/liga', 'core.not-found'), session('teacher'))).toEqual({
      kind: 'in-place',
      status: 404,
    })
    const catchAll = { path: '/entah-apa', name: 'core.not-found', meta: { access: 'public' } }
    expect(decideAccess(catchAll as never, session(null))).toEqual({
      kind: 'in-place',
      status: 404,
    })
  })

  it('lets a path in the matrix through even when no screen exists for it', () => {
    expect(
      decideAccess(fakeRoute('/guru/laporan-mingguan-kelas', 'core.not-found'), session('teacher')),
    ).toEqual({ kind: 'allow' })
  })

  it('answers 403 in place for a role the route refuses (default onForbidden), before the scope', () => {
    const route = { path: '/guru', name: 'x', meta: { access: 'auth', roles: ['teacher'] } }
    expect(decideAccess(route as never, session('student'))).toEqual({
      kind: 'in-place',
      status: 403,
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

describe('wrong-role URL of a visible module answers the 403 page (AC-MUR-SH-7, AC-SH-6)', () => {
  const router = createAppRouter({ history: createMemoryHistory() })

  beforeEach(() => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    ['student', '/guru/command-center'],
    ['student', '/admin-sekolah/command-center'],
    ['student', '/admin/studio'],
    ['teacher', '/admin-sekolah/command-center'],
    ['school_admin', '/guru/command-center'],
    ['school_admin', '/admin/studio'],
  ])('%s on %s: in-place 403, no redirect', (role, path) => {
    expect(decideAccess(router.resolve(path) as unknown as RouteLocationNormalized, session(role))).toEqual({
      kind: 'in-place',
      status: 403,
    })
  })
})

describe('wrong-role URL of a visible module, fake route (no real route refuses the pupil)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // The real `/prestasi/sekolah` currently lists `student` in its roles (S10-T03 owns m08), so the
  // pupil case of AC-MUR-SH-7 is asserted on a route that excludes the pupil.
  it('student on /prestasi/sekolah (route without student): in-place 403', () => {
    const route = {
      path: '/prestasi/sekolah',
      name: 'x',
      meta: { access: 'auth', roles: ['teacher', 'school_admin', 'admin'] },
    }
    expect(decideAccess(route as never, session('student'))).toEqual({
      kind: 'in-place',
      status: 403,
    })
  })
})

describe('LayoutHost: hidden module answers the standard 404 page', () => {
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

  it('renders NotFoundPage for a typed out-of-scope URL, URL unchanged', async () => {
    logIn(STUDENT)
    const w = await open('/misi-harian')
    expect(useRouteOutcome().value).toBe(404)
    expect(w.find('[data-page="not-found"]').exists()).toBe(true)
    expect(w.find('[data-testid="misi-harian"]').exists()).toBe(false)
  })

  it('renders NotFoundPage for a blocked bare page too', async () => {
    logIn(STUDENT)
    const w = await open('/pricing')
    expect(useRouteOutcome().value).toBe(404)
    expect(w.find('[data-page="not-found"]').exists()).toBe(true)
  })

  it('renders an in-scope route normally and clears the outcome', async () => {
    logIn(STUDENT)
    const w = await open('/practice')
    expect(useRouteOutcome().value).toBeNull()
    expect(w.find('[data-testid="practice"]').exists()).toBe(true)
    expect(w.find('[data-page="not-found"]').exists()).toBe(false)
  })

  it('shows NotFoundPage on its own (no shell) for a guest on a public page outside the scope', async () => {
    const w = await open('/sponsor/register')
    expect(w.find('[data-layout]').exists()).toBe(false)
    expect(useRouteOutcome().value).toBe(404)
    expect(w.find('[data-page="not-found"]').exists()).toBe(true)
  })

  it('still sends a guest on a protected route to /login', async () => {
    const w = await open('/misi-harian')
    expect(w.find('[data-testid="login"]').exists()).toBe(true)
  })

  it('a Murid on an admin route keeps the 403 page, not the 404 page', async () => {
    logIn(STUDENT)
    const w = await open('/admin/users')
    expect(useRouteOutcome().value).toBe(403)
    expect(w.find('[data-page="not-found"]').exists()).toBe(false)
  })
})
