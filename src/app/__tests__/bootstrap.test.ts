// @vitest-environment jsdom
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'

import { api } from '@/api'
import { clock } from '@/lib/time'
import { setUnauthorizedRedirect, useSessionStore } from '@/stores'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'

import { bootstrap, type BootstrappedApp } from '../bootstrap'

let booted: BootstrappedApp | null = null

/** The core reads the M01 users and M02 schools stores (F-23), so their owners boot with it. */
const CORE_PLUGINS = [m01, m02]

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = '<div id="app"></div>'
  clock.reset()
  // Vitest runs in `test` mode; the dev/e2e builds set this flag, which loads the test hooks.
  vi.stubEnv('VITE_TEST_HOOKS', 'true')
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})

afterEach(() => {
  booted?.app.unmount()
  booted = null
  delete window.__MOCK_INIT__
  delete window.__mock
  setUnauthorizedRedirect(null)
  api.configure({ transport: null })
  clock.reset()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('bootstrap (overview §6.13 wiring)', () => {
  it('with __MOCK_INIT__.session set, the first route renders as the logged-in user without a login request', async () => {
    window.__MOCK_INIT__ = { session: 'pelajar@demo.test', latency: 0 }
    const history = createMemoryHistory()
    history.replace('/')

    booted = await bootstrap({
      history,
      // Core + the owners of the stores it reads (other plugins have their own boot tests); no
      // IndexedDB in jsdom.
      mock: { plugins: CORE_PLUGINS, persistence: null },
    })
    await booted.router.isReady()
    await flushPromises()

    const session = booted.app.runWithContext(() => useSessionStore())
    expect(session.isLoggedIn).toBe(true)
    expect(session.user?.email).toBe('pelajar@demo.test')
    // `/` sent the logged-in user straight to the landing path (BR-07).
    expect(booted.router.currentRoute.value.path).toBe(session.landingPath)
    expect(document.querySelector('#app')?.innerHTML).not.toBe('')

    const log = booted.mockRuntime?.log.entries() ?? []
    expect(log.some((e) => e.path.startsWith('/api/auth/login'))).toBe(false)
    expect(log.some((e) => e.path === '/api/me')).toBe(true)
    expect(typeof window.__mock?.sentinel).toBe('string')
  })

  it('without a session, the first route is /login', async () => {
    window.__MOCK_INIT__ = { latency: 0 }
    const history = createMemoryHistory()
    history.replace('/')

    booted = await bootstrap({ history, mock: { plugins: CORE_PLUGINS, persistence: null } })
    await booted.router.isReady()
    await flushPromises()

    expect(booted.router.currentRoute.value.path).toBe('/login')
  })
})
