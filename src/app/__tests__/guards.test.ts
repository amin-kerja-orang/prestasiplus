// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, type RouteLocationNormalized } from 'vue-router'

import { api, installTransport } from '@/api'
import { usePageMeta } from '@/composables/usePageMeta'
import { clock } from '@/lib/time'
import {
  PP_AUTH_STORAGE_KEY,
  setUnauthorizedRedirect,
  useFlashStore,
  useNotificationBadgeStore,
  useSessionStore,
  useShellStore,
} from '@/stores'

import {
  buildRoutes,
  connectUnauthorizedRedirect,
  createAppRouter,
  decideAccess,
  FORBIDDEN_TITLE,
  NOT_FOUND_TITLE,
  resolvePostLoginTarget,
  scrollBehavior,
  setRouteOutcome,
  useRouteOutcome,
} from '../router'
import {
  ADMIN,
  fakeTransport,
  INACTIVE_STUDENT,
  logIn,
  NOW,
  STUDENT,
  testRouter,
} from './router-fixtures'

/** Lets the background refreshes started by the after-each hook settle. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

let transport: ReturnType<typeof fakeTransport>

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: Date.parse(NOW), toFake: ['Date'] })
  clock.reset()
  setActivePinia(createPinia())
  setRouteOutcome(null)
  transport = fakeTransport()
  installTransport(transport)
  document.title = 'PRESTASIPLUS'
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})

afterEach(() => {
  clock.reset()
  vi.useRealTimers()
  setUnauthorizedRedirect(null)
  api.configure({ transport: null })
  usePageMeta().reset()
  vi.restoreAllMocks()
})

describe('auth guard (FR-M01-14, BR-09)', () => {
  it('sends a guest on an auth route to /login?redirect=<requested page>, no message', async () => {
    const router = testRouter()
    await router.push('/dashboard?x=1')
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query).toEqual({ redirect: '/dashboard?x=1' })
    expect(router.currentRoute.value.hash).toBe('')
    expect(useFlashStore().current).toBeNull()
  })

  it('lets a guest open a public route', async () => {
    const router = testRouter()
    await router.push('/artikel')
    expect(router.currentRoute.value.path).toBe('/artikel')
  })

  it('runs session.check() first: an expired session is cleared and treated as a guest', async () => {
    logIn(STUDENT, { expiresAt: '2026-09-25T15:39:59+08:00' })
    const router = testRouter()
    await router.push('/dashboard')
    expect(router.currentRoute.value.path).toBe('/login')
    expect(localStorage.getItem(PP_AUTH_STORAGE_KEY)).toBeNull()
  })

  it('sees a session written after the store was created (setUser hook mid-test)', async () => {
    const router = testRouter()
    useSessionStore()
    logIn(STUDENT)
    await router.push('/dashboard')
    expect(router.currentRoute.value.path).toBe('/dashboard')
  })
})

describe('guest pages have no guest-only guard (FR-M01-13, BR-08)', () => {
  it('renders /login and /register for a logged-in user, no redirect', async () => {
    logIn(STUDENT)
    const router = testRouter()
    await router.push('/login')
    expect(router.currentRoute.value.path).toBe('/login')
    await router.push('/register')
    expect(router.currentRoute.value.path).toBe('/register')
  })
})

describe('role guard (overview §5.4 step 3)', () => {
  it('redirects a role mismatch to the landing path by default (BR-07)', async () => {
    logIn(STUDENT)
    const router = testRouter()
    await router.push('/admin')
    expect(router.currentRoute.value.path).toBe('/dashboard')
  })

  it('lets the allowed role through', async () => {
    logIn(ADMIN)
    const router = testRouter()
    await router.push('/admin')
    expect(router.currentRoute.value.path).toBe('/admin')
  })

  it('a guest on a role route goes to /login', async () => {
    const router = testRouter()
    await router.push('/admin')
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it("onForbidden '403' renders the 403 page in place: URL unchanged, 403 tab title", async () => {
    logIn(STUDENT)
    const router = testRouter()
    await router.push('/prestasi-sekolah')
    expect(router.currentRoute.value.path).toBe('/prestasi-sekolah')
    expect(useRouteOutcome().value).toBe(403)
    expect(document.title).toBe(FORBIDDEN_TITLE)

    await router.push('/dashboard')
    expect(useRouteOutcome().value).toBeNull()
  })

  it("onForbidden '404' renders the 404 page in place", async () => {
    logIn(STUDENT)
    const router = testRouter()
    await router.push('/timeline/5')
    expect(router.currentRoute.value.path).toBe('/timeline/5')
    expect(useRouteOutcome().value).toBe(404)
    expect(document.title).toBe(NOT_FOUND_TITLE)
  })

  it('does not loop when the landing path itself refuses the role', () => {
    const to = {
      path: '/dashboard',
      meta: { roles: ['admin'] },
    } as unknown as RouteLocationNormalized
    expect(
      decideAccess(to, { isLoggedIn: true, role: 'student', landingPath: '/dashboard' }),
    ).toEqual({ kind: 'in-place', status: 403 })
  })
})

describe('inactive account (BR-23)', () => {
  it('guards never end an already-open session of an inactive account', async () => {
    logIn(INACTIVE_STUDENT)
    const router = testRouter()
    await router.push('/dashboard')
    expect(router.currentRoute.value.path).toBe('/dashboard')
    expect(useSessionStore().isLoggedIn).toBe(true)
    await settle()
    expect(transport.requests.some((r) => r.url === '/api/auth/logout')).toBe(false)
  })
})

describe('404', () => {
  it('an unknown path renders the catch-all 404 with its exact title', async () => {
    const router = testRouter()
    await router.push('/settings')
    expect(router.currentRoute.value.name).toBe('core.not-found')
    expect(document.title).toBe(NOT_FOUND_TITLE)
  })

  it('/admin/questions/abc falls through the numeric param to the 404', async () => {
    logIn(ADMIN)
    const router = testRouter()
    await router.push('/admin/questions/abc')
    expect(router.currentRoute.value.name).toBe('core.not-found')
    await router.push('/admin/questions/12')
    expect(router.currentRoute.value.params.id).toBe('12')
  })

  it('the catch-all is registered last, after every module route', () => {
    const routes = buildRoutes()
    expect(routes.at(-1)?.name).toBe('core.not-found')
    expect(routes.slice(0, 2).map((r) => r.path)).toEqual(['/', '/logout'])
  })
})

describe('page-raised outcome sets the tab title', () => {
  it('a page-set 404 sets the 404 title; navigating away restores the normal title', async () => {
    logIn(STUDENT)
    const router = testRouter()
    await router.push('/dashboard')
    expect(document.title).toBe('Papan Pemuka - PRESTASIPLUS')

    setRouteOutcome(404)
    expect(document.title).toBe(NOT_FOUND_TITLE)

    await router.push('/tetapan')
    expect(useRouteOutcome().value).toBeNull()
    expect(document.title).toBe('Tetapan Peribadi')
  })

  it('setTitle does not overwrite an active 404/403 title', () => {
    setRouteOutcome(404)
    usePageMeta().setTitle('Lihat Soalan')
    expect(document.title).toBe(NOT_FOUND_TITLE)
    setRouteOutcome(403)
    usePageMeta().setTitle('Lihat Soalan')
    expect(document.title).toBe(FORBIDDEN_TITLE)
  })

  it('a 404 set after setTitle replaces the page title', () => {
    usePageMeta().setTitle('Lihat Soalan')
    expect(document.title).toBe('Lihat Soalan')
    setRouteOutcome(404)
    expect(document.title).toBe(NOT_FOUND_TITLE)
  })

  it('a page-set 403 sets the 403 title', () => {
    setRouteOutcome(403)
    expect(document.title).toBe(FORBIDDEN_TITLE)
  })

  it('a guard-raised 404 still works and is restored on the next navigation', async () => {
    logIn(STUDENT)
    const router = testRouter()
    await router.push('/timeline/5')
    expect(document.title).toBe(NOT_FOUND_TITLE)
    await router.push('/dashboard')
    expect(document.title).toBe('Papan Pemuka - PRESTASIPLUS')
  })
})

describe('core routes', () => {
  it('/ sends a guest to /login and a logged-in user to the landing path', async () => {
    const router = testRouter()
    await router.push('/')
    expect(router.currentRoute.value.path).toBe('/login')

    logIn(ADMIN)
    await router.push('/')
    expect(router.currentRoute.value.path).toBe('/admin')
  })

  it('/logout posts the logout, clears the session and lands on /login with no message', async () => {
    logIn(STUDENT)
    const router = testRouter()
    await router.push('/dashboard')
    useNotificationBadgeStore().set(12)
    await router.push('/logout')
    expect(useNotificationBadgeStore().count).toBe(0) // no stale unread count for the next user

    expect(transport.requests.filter((r) => r.url === '/api/auth/logout')).toHaveLength(1)
    expect(transport.requests.find((r) => r.url === '/api/auth/logout')?.method).toBe('POST')
    expect(localStorage.getItem(PP_AUTH_STORAGE_KEY)).toBeNull()
    expect(useSessionStore().isLoggedIn).toBe(false)
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query).toEqual({})
    expect(useFlashStore().current).toBeNull()
  })

  it('/logout clears the session even when the logout call fails', async () => {
    transport = fakeTransport((req) => (req.url === '/api/auth/logout' ? { status: 500 } : {}))
    installTransport(transport)
    logIn(STUDENT)
    const router = testRouter()
    await router.push('/logout')
    expect(localStorage.getItem(PP_AUTH_STORAGE_KEY)).toBeNull()
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('the dev-only gallery routes are registered in dev mode', () => {
    const paths = buildRoutes([]).map((r) => r.path)
    expect(import.meta.env.DEV).toBe(true)
    expect(paths).toContain('/__dev/tokens')
    expect(paths).toContain('/__dev/feedback')
  })
})

describe('after each navigation (overview §5.4 step 5)', () => {
  it('sets the exact tab title from meta.title (string or function), no suffix', async () => {
    logIn(STUDENT)
    const router = testRouter()
    await router.push('/dashboard')
    expect(document.title).toBe('Papan Pemuka - PRESTASIPLUS')
    await router.push('/topics?s=Sains')
    expect(document.title).toBe('Topik Sains')
  })

  it('resets the page meta before the new page', async () => {
    logIn(STUDENT)
    const router = testRouter()
    await router.push('/dashboard')
    usePageMeta().setHeader({ title: 'Dinamik' })
    await router.push('/tetapan')
    expect(usePageMeta().state.header).toBeNull()
    expect(usePageMeta().state.title).toBeNull()
  })

  it('consumes the pending flash onto the next page, then clears it on the one after', async () => {
    logIn(STUDENT)
    const router = testRouter()
    await router.push('/dashboard')
    const flash = useFlashStore()
    flash.success('Profil berjaya dikemaskini.')
    await router.push('/tetapan')
    expect(flash.current).toEqual({ type: 'success', message: 'Profil berjaya dikemaskini.' })
    expect(flash.pending).toBeNull()
    await router.push('/dashboard')
    expect(flash.current).toBeNull()
  })

  it('closes the shell overlays (drawer, Lagi)', async () => {
    logIn(STUDENT)
    const router = testRouter()
    await router.push('/dashboard')
    const shell = useShellStore()
    shell.setDrawerOpen(true)
    shell.setLagiOpen(true)
    await router.push('/tetapan')
    expect(shell.drawerOpen).toBe(false)
    expect(shell.lagiOpen).toBe(false)
  })

  it('logged in: refreshes the user (GET /api/me) and the bell badge in the background', async () => {
    logIn(STUDENT)
    const router = testRouter()
    await router.push('/dashboard')
    await settle()
    expect(transport.requests.map((r) => r.url)).toEqual([
      '/api/me',
      '/api/me/notifications/unread-count',
    ])
    expect(useNotificationBadgeStore().count).toBe(3)
  })

  it('guest: no background refresh', async () => {
    const router = testRouter()
    await router.push('/artikel')
    await settle()
    expect(transport.requests).toEqual([])
  })

  it('scrolls to the top, or to the hash anchor', () => {
    const at = (hash: string) => ({ hash }) as RouteLocationNormalized
    expect(scrollBehavior(at(''), at(''), null)).toEqual({ top: 0 })
    expect(scrollBehavior(at('#pelajar'), at(''), null)).toEqual({ el: '#pelajar' })
  })
})

describe('401 policy (FR-M01-14)', () => {
  it('a 401 clears the session and replaces the route with /login', async () => {
    transport = fakeTransport((req) =>
      req.url === '/api/me'
        ? { status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'Unauthenticated.' } } }
        : {},
    )
    installTransport(transport)
    logIn(STUDENT)
    const router = testRouter()
    connectUnauthorizedRedirect(router)
    useNotificationBadgeStore().set(12)

    await router.push('/dashboard')
    await settle()
    await settle()

    expect(useNotificationBadgeStore().count).toBe(0)
    expect(localStorage.getItem(PP_AUTH_STORAGE_KEY)).toBeNull()
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query).toEqual({})
  })
})

describe('in-place outcome is committed only on success (F13-1)', () => {
  it('a lazy page that fails to load does not leave the 403 outcome set', async () => {
    logIn(STUDENT)
    const router = testRouter()
    router.addRoute({
      path: '/rosak',
      component: () => Promise.reject(new Error('chunk load failed')),
      meta: { layout: 'user', access: 'auth', roles: ['teacher'], onForbidden: '403' },
    })
    await router.push('/dashboard')
    await expect(router.push('/rosak')).rejects.toThrow('chunk load failed')
    expect(router.currentRoute.value.path).toBe('/dashboard')
    expect(useRouteOutcome().value).toBeNull()
  })

  it('a navigation aborted by a later guard does not leave the 404 outcome set', async () => {
    logIn(STUDENT)
    const router = testRouter()
    router.beforeEach((to) => (to.path.startsWith('/timeline') ? false : true))
    await router.push('/dashboard')
    const failure = await router.push('/timeline/5')
    expect(failure).toBeTruthy()
    expect(router.currentRoute.value.path).toBe('/dashboard')
    expect(useRouteOutcome().value).toBeNull()
  })

  it('a failed navigation away from a 403 page keeps that page on its 403 outcome', async () => {
    logIn(STUDENT)
    const router = testRouter()
    router.beforeEach((to) => to.path !== '/tetapan')
    await router.push('/prestasi-sekolah')
    expect(useRouteOutcome().value).toBe(403)
    await router.push('/tetapan')
    expect(router.currentRoute.value.path).toBe('/prestasi-sekolah')
    expect(useRouteOutcome().value).toBe(403)
  })
})

describe('meta.guestTitle (F-20)', () => {
  const guestRouter = () =>
    createAppRouter({
      history: createMemoryHistory(),
      registry: [
        {
          id: 'M99',
          slug: 'm99-guest-title',
          routes: [
            {
              path: '/g',
              component: { render: () => null },
              meta: {
                layout: 'public-or-user',
                access: 'public',
                title: 'Tajuk Log Masuk',
                guestTitle: (to: RouteLocationNormalized) => `Tetamu ${String(to.query.p ?? '')}`,
              },
            },
            {
              path: '/u',
              component: { render: () => null },
              meta: { layout: 'user', access: 'public', title: 'Tajuk U', guestTitle: 'Tetamu U' },
            },
          ],
        },
      ],
    })

  it('replaces meta.title synchronously in afterEach when the public layout is resolved', async () => {
    const router = guestRouter()
    await router.push('/g?p=1')
    expect(document.title).toBe('Tetamu 1')
  })

  it('is ignored when the resolved shell is not public (logged in, or another layout)', async () => {
    const router = guestRouter()
    await router.push('/u')
    expect(document.title).toBe('Tajuk U')
    logIn(STUDENT)
    await router.push('/g')
    expect(document.title).toBe('Tajuk Log Masuk')
  })
})

describe('session survives a reload and returns to the requested page', () => {
  it('a stored session is restored by a fresh store (simulated full page load)', async () => {
    logIn(STUDENT)
    setActivePinia(createPinia()) // a new page load: empty memory, same localStorage
    const router = testRouter()
    await router.push('/dashboard')
    expect(router.currentRoute.value.path).toBe('/dashboard')
    expect(useSessionStore().isLoggedIn).toBe(true)
  })

  it('remembers the requested page, and the login page returns there for an allowed role', async () => {
    const router = testRouter()
    await router.push('/topics')
    expect(router.currentRoute.value.query).toEqual({ redirect: '/topics' })
    const redirect = router.currentRoute.value.query.redirect
    const admin = { isLoggedIn: true, role: STUDENT.role, landingPath: STUDENT.landingPath }
    expect(resolvePostLoginTarget(router, redirect, admin)).toBe('/topics')
  })

  it('falls back to the role landing for an unknown or unsafe target', () => {
    const router = testRouter()
    const student = {
      isLoggedIn: true,
      role: STUDENT.role,
      landingPath: STUDENT.landingPath,
    }
        expect(resolvePostLoginTarget(router, '/no/such/page', student)).toBe(student.landingPath)
    expect(resolvePostLoginTarget(router, '//evil.example', student)).toBe(student.landingPath)
    expect(resolvePostLoginTarget(router, '/login', student)).toBe(student.landingPath)
    expect(resolvePostLoginTarget(router, undefined, student)).toBe(student.landingPath)
  })

  it('logout clears pp.auth so a reload shows login', async () => {
    logIn(STUDENT)
    await useSessionStore().logout()
    expect(localStorage.getItem(PP_AUTH_STORAGE_KEY)).toBeNull()
    setActivePinia(createPinia())
    const router = testRouter()
    await router.push('/dashboard')
    expect(router.currentRoute.value.path).toBe('/login')
  })
})
