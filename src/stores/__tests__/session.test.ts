// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'

import { api, ApiError } from '@/api'
import { clock, MINUTE_MS, toIsoMyt } from '@/lib/time'
import type { ClientSession as MockClientSession } from '@/mock/core-data/client-session'
import { PP_AUTH_STORAGE_KEY as MOCK_KEY } from '@/mock/core-data/client-session'

import {
  parseClientSession,
  PP_AUTH_STORAGE_KEY,
  SESSION_LIFETIME_MS,
  setUnauthorizedRedirect,
  useSessionStore,
  withSessionSliding,
  type ClientSession,
} from '..'
import { fakeTransport, session, STUDENT } from './fixtures'

const NOW = '2026-09-25T15:40:00+08:00'

function stored(): ClientSession | null {
  return parseClientSession(localStorage.getItem(PP_AUTH_STORAGE_KEY))
}

function writeStored(value: unknown): void {
  localStorage.setItem(PP_AUTH_STORAGE_KEY, JSON.stringify(value))
}

beforeEach(() => {
  localStorage.clear()
  // Freeze Date.now so ISO strings compare exactly; the shared clock runs on top of it.
  vi.useFakeTimers({ now: Date.parse(NOW), toFake: ['Date'] })
  clock.reset()
  setActivePinia(createPinia())
})

afterEach(() => {
  clock.reset()
  vi.useRealTimers()
  setUnauthorizedRedirect(null)
  api.configure({ transport: null })
  vi.restoreAllMocks()
})

describe('client session contract', () => {
  it('uses the same key and shape as the mock core (F-11)', () => {
    expect(PP_AUTH_STORAGE_KEY).toBe('pp.auth')
    expect(PP_AUTH_STORAGE_KEY).toBe(MOCK_KEY)
    expectTypeOf<ClientSession>().toEqualTypeOf<MockClientSession>()
  })
})

describe('session store: load, save and expiry', () => {
  it('restores pp.auth on creation (as written by the setUser hook)', () => {
    writeStored(session())
    const store = useSessionStore()
    expect(store.isLoggedIn).toBe(true)
    expect(store.token).toBe('pp_token_1')
    expect(store.user?.email).toBe('pelajar@demo.test')
    expect(store.role).toBe('student')
    expect(store.landingPath).toBe('/dashboard')
  })

  it('starts logged out without pp.auth', () => {
    const store = useSessionStore()
    expect(store.isLoggedIn).toBe(false)
    expect(store.user).toBeNull()
  })

  it('drops a malformed pp.auth', () => {
    localStorage.setItem(PP_AUTH_STORAGE_KEY, '{not json')
    expect(useSessionStore().isLoggedIn).toBe(false)
    expect(localStorage.getItem(PP_AUTH_STORAGE_KEY)).toBeNull()

    writeStored({ token: 'x', remember: 'no', expiresAt: NOW, user: STUDENT })
    expect(useSessionStore().check()).toBe(false)
    expect(localStorage.getItem(PP_AUTH_STORAGE_KEY)).toBeNull()
  })

  it('drops an expired session on creation', () => {
    writeStored(session({ expiresAt: '2026-09-25T15:39:59+08:00' }))
    const store = useSessionStore()
    expect(store.isLoggedIn).toBe(false)
    expect(localStorage.getItem(PP_AUTH_STORAGE_KEY)).toBeNull()
  })

  it('expires by the shared clock at expiresAt (check before navigation)', () => {
    writeStored(session({ expiresAt: '2026-09-25T17:40:00+08:00' }))
    const store = useSessionStore()
    clock.setNow('2026-09-25T17:39:59+08:00')
    expect(store.check()).toBe(true)
    clock.setNow('2026-09-25T17:40:00+08:00')
    expect(store.check()).toBe(false)
    expect(store.isLoggedIn).toBe(false)
    expect(localStorage.getItem(PP_AUTH_STORAGE_KEY)).toBeNull()
  })

  it('check() picks up a session written to storage after creation', () => {
    const store = useSessionStore()
    expect(store.isLoggedIn).toBe(false)
    writeStored(session({ token: 'later' }))
    expect(store.check()).toBe(true)
    expect(store.token).toBe('later')
  })

  it('setSession saves pp.auth; setUser updates the cached user; clear removes it', () => {
    const store = useSessionStore()
    store.setSession(session({ remember: true }))
    expect(stored()).toEqual(session({ remember: true }))

    store.setUser({ ...STUDENT, name: 'Nama Baharu' })
    expect(stored()?.user.name).toBe('Nama Baharu')
    expect(store.user?.name).toBe('Nama Baharu')

    store.clear()
    expect(store.isLoggedIn).toBe(false)
    expect(localStorage.getItem(PP_AUTH_STORAGE_KEY)).toBeNull()
  })
})

describe('session store: sliding (BR-06)', () => {
  it('slides a normal session to now + 120 min after a 2xx authenticated response', async () => {
    writeStored(session())
    const store = useSessionStore()
    const transport = fakeTransport(() => {
      clock.setNow('2026-09-25T16:10:00+08:00')
      return { status: 200, body: { data: { ok: true } } }
    })
    api.configure({ transport: withSessionSliding(transport) })

    await api.get('/api/dashboard')

    expect(transport.requests[0]?.headers.authorization).toBe('Bearer pp_token_1')
    expect(store.expiresAt).toBe('2026-09-25T18:10:00+08:00')
    expect(stored()?.expiresAt).toBe('2026-09-25T18:10:00+08:00')
    expect(SESSION_LIFETIME_MS).toBe(120 * MINUTE_MS)
  })

  it('keeps a normal session alive past its original expiry while requests continue', async () => {
    writeStored(session({ expiresAt: toIsoMyt(clock.now() + SESSION_LIFETIME_MS) }))
    const store = useSessionStore()
    api.configure({ transport: withSessionSliding(fakeTransport(() => ({ status: 200 }))) })

    for (let i = 0; i < 3; i += 1) {
      clock.advance(100 * MINUTE_MS)
      await api.get('/api/me')
      expect(store.check()).toBe(true)
    }
    clock.advance(SESSION_LIFETIME_MS)
    expect(store.check()).toBe(false)
  })

  it('does not slide a remembered session ("Ingat saya": +5 years, fixed)', async () => {
    writeStored(session({ remember: true, expiresAt: '2031-09-25T15:40:00+08:00' }))
    const store = useSessionStore()
    api.configure({ transport: withSessionSliding(fakeTransport(() => ({ status: 200 }))) })
    clock.setNow('2027-01-01T00:00:00+08:00')

    await api.get('/api/me')

    expect(store.expiresAt).toBe('2031-09-25T15:40:00+08:00')
    expect(store.remember).toBe(true)
  })

  it.each([422, 409, 500])(
    'slides on a %i response too (the token resolved on the server, M01 v1.10)',
    async (status) => {
      writeStored(session())
      const store = useSessionStore()
      api.configure({ transport: withSessionSliding(fakeTransport(() => ({ status }))) })
      clock.setNow('2026-09-25T16:00:00+08:00')

      await expect(api.post('/api/me/settings')).rejects.toBeInstanceOf(ApiError)

      expect(store.expiresAt).toBe('2026-09-25T18:00:00+08:00')
      expect(stored()?.expiresAt).toBe('2026-09-25T18:00:00+08:00')
    },
  )

  it('does not slide on a 401 or a network failure', async () => {
    writeStored(session())
    const store = useSessionStore()
    const before = store.expiresAt
    const failing = withSessionSliding({
      request: () => Promise.reject(new Error('offline')),
    })
    api.configure({ transport: failing })
    clock.setNow('2026-09-25T16:00:00+08:00')
    await expect(api.get('/api/me')).rejects.toBeInstanceOf(ApiError)
    expect(store.expiresAt).toBe(before)

    const sent: string[] = []
    const unauthorized = withSessionSliding(fakeTransport(() => ({ status: 401 })))
    // Observe the store right after the wrapper, before the 401 policy clears it.
    api.configure({
      transport: {
        async request(req, signal) {
          const res = await unauthorized.request(req, signal)
          sent.push(store.expiresAt ?? 'none')
          return res
        },
      },
    })
    await expect(api.get('/api/me')).rejects.toBeInstanceOf(ApiError)
    expect(sent).toEqual([before])
  })

  it('does not slide for a guest request or another token', async () => {
    writeStored(session())
    const store = useSessionStore()
    const before = store.expiresAt
    api.configure({ transport: withSessionSliding(fakeTransport(() => ({ status: 200 }))) })
    clock.setNow('2026-09-25T16:00:00+08:00')

    await api.get('/api/x', { headers: { authorization: 'Bearer someone-else' } })
    expect(store.expiresAt).toBe(before)

    store.clear()
    await api.get('/api/public')
    expect(store.expiresAt).toBeNull()
  })

  it('slide() is a no-op without a session', () => {
    const store = useSessionStore()
    store.slide()
    expect(localStorage.getItem(PP_AUTH_STORAGE_KEY)).toBeNull()
  })
})

describe('session store: 401 policy (FR-M01-14)', () => {
  it('clears the session, then runs the registered redirect', async () => {
    writeStored(session())
    const store = useSessionStore()
    const order: string[] = []
    const redirect = vi.fn(() => {
      order.push(`redirect:${String(store.isLoggedIn)}`)
    })
    setUnauthorizedRedirect(redirect)
    api.configure({ transport: fakeTransport(() => ({ status: 401 })) })

    const error = await api.get('/api/me').catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('UNAUTHORIZED')
    expect(redirect).toHaveBeenCalledOnce()
    expect(order).toEqual(['redirect:false'])
    expect(store.isLoggedIn).toBe(false)
    expect(localStorage.getItem(PP_AUTH_STORAGE_KEY)).toBeNull()
  })

  it('leaves /api/auth/* 401s to the page', async () => {
    writeStored(session())
    const store = useSessionStore()
    const redirect = vi.fn()
    setUnauthorizedRedirect(redirect)
    api.configure({ transport: fakeTransport(() => ({ status: 401 })) })

    await expect(api.post('/api/auth/logout')).rejects.toBeInstanceOf(ApiError)
    expect(redirect).not.toHaveBeenCalled()
    expect(store.isLoggedIn).toBe(true)
  })

  it('the unregister function removes the redirect', async () => {
    const redirect = vi.fn()
    const off = setUnauthorizedRedirect(redirect)
    off()
    const store = useSessionStore()
    store.setSession(session())
    await store.handleUnauthorized()
    expect(redirect).not.toHaveBeenCalled()
    expect(store.isLoggedIn).toBe(false)
  })

  it('sends the token of the current session', async () => {
    const store = useSessionStore()
    const transport = fakeTransport(() => ({ status: 200 }))
    api.configure({ transport })
    await api.get('/api/a')
    store.setSession(session({ token: 'tok-2' }))
    await api.get('/api/b')
    expect(transport.requests[0]?.headers.authorization).toBeUndefined()
    expect(transport.requests[1]?.headers.authorization).toBe('Bearer tok-2')
  })
})

describe('session store: me refresh and logout', () => {
  it('refreshUser updates the cached user from GET /api/me', async () => {
    writeStored(session())
    const store = useSessionStore()
    const fresh = { ...STUDENT, name: 'Pelajar Dikemas Kini' }
    const transport = fakeTransport(() => ({ status: 200, body: { data: fresh } }))
    api.configure({ transport })

    await expect(store.refreshUser()).resolves.toEqual(fresh)
    expect(transport.requests[0]).toMatchObject({ method: 'GET', url: '/api/me' })
    expect(stored()?.user.name).toBe('Pelajar Dikemas Kini')
  })

  it('refreshUser keeps the cached user on a failure and does nothing when logged out', async () => {
    const store = useSessionStore()
    const transport = fakeTransport(() => ({ status: 500 }))
    api.configure({ transport })
    await expect(store.refreshUser()).resolves.toBeNull()
    expect(transport.requests).toHaveLength(0)

    store.setSession(session())
    await expect(store.refreshUser()).resolves.toBeNull()
    expect(store.user).toEqual(STUDENT)
  })

  it('logout posts to /api/auth/logout and clears the session whatever the result', async () => {
    writeStored(session())
    const store = useSessionStore()
    const transport = fakeTransport(() => ({ status: 500 }))
    api.configure({ transport })

    await store.logout()

    expect(transport.requests[0]).toMatchObject({ method: 'POST', url: '/api/auth/logout' })
    expect(transport.requests[0]?.headers.authorization).toBe('Bearer pp_token_1')
    expect(store.isLoggedIn).toBe(false)
    expect(localStorage.getItem(PP_AUTH_STORAGE_KEY)).toBeNull()
  })
})

describe('impersonator (XR-M27-21)', () => {
  const impersonator = { id: 8, name: 'Pentadbir Sekolah Demo', returnTo: '/admin-sekolah/pelajar' }

  it('round-trips through pp.auth and the store getter', () => {
    writeStored(session({ impersonator }))
    const store = useSessionStore()
    expect(store.check()).toBe(true)
    expect(store.impersonator).toEqual(impersonator)
    expect(stored()?.impersonator).toEqual(impersonator)
    store.setSession(session({ impersonator }))
    expect(stored()?.impersonator).toEqual(impersonator)
  })

  it('is null without it and a malformed one is dropped', () => {
    writeStored({ ...session(), impersonator: { id: 'x' } })
    const store = useSessionStore()
    expect(store.check()).toBe(true)
    expect(store.impersonator).toBeNull()
    store.setSession(session())
    expect(store.impersonator).toBeNull()
  })
})
