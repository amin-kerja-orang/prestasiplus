import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/api'

import { isApiSession, restoreHttpSession, storedCsrfToken, toClientSessionFromApi, type ApiSession } from '../http-session'
import { useSessionStore } from '../session'

const apiSession: ApiSession = {
  user: { id: '42', name: 'Guru Demo', email: 'guru@demo.test', username: null, avatarUrl: null, schoolId: '7' },
  roles: [{ role: 'teacher' }, { role: 'school_admin' }],
  active: { role: 'teacher' },
  mode: null,
  landingPath: '/guru',
  expiresAt: '2026-10-20T12:00:00.000Z',
  csrf: 'csrf-token',
  mustChangePassword: false,
}

describe('real API session adapter (V2-T31)', () => {
  it('recognises the contract Session and not the mock bearer payload', () => {
    expect(isApiSession(apiSession)).toBe(true)
    expect(isApiSession({ token: 't', expiresAt: 'x', user: {} })).toBe(false)
    expect(isApiSession(null)).toBe(false)
  })

  it('maps it to a ClientSession: csrf kept, active role and landing path from the server', () => {
    const s = toClientSessionFromApi(apiSession, true)
    expect(s).toMatchObject({
      token: 'csrf-token',
      csrf: 'csrf-token',
      remember: true,
      expiresAt: apiSession.expiresAt,
      user: { id: 42, name: 'Guru Demo', email: 'guru@demo.test', role: 'teacher', schoolId: 7, landingPath: '/guru' },
    })
  })

  it('carries the forced-change flag only when it is set (AM2-A1)', () => {
    expect(toClientSessionFromApi({ ...apiSession, mustChangePassword: true }, false).mustChangePassword).toBe(true)
    expect('mustChangePassword' in toClientSessionFromApi(apiSession, false)).toBe(false)
  })
})

describe('restoreHttpSession scope check (P4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('rebuilds the session of a prototype role', async () => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
    vi.spyOn(api, 'get').mockResolvedValue(apiSession)
    const post = vi.spyOn(api, 'post').mockResolvedValue(undefined)
    await restoreHttpSession()
    expect(useSessionStore().user?.role).toBe('teacher')
    expect(post).not.toHaveBeenCalled()
  })

  it('ends the session of a role outside the prototype scope: logout called, no session', async () => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
    vi.spyOn(api, 'get').mockResolvedValue({ ...apiSession, active: { role: 'parent' } })
    // Web Storage, so the stale session is really stored (the transport reads it from there).
    const mem = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
      clear: () => mem.clear(),
      key: () => null,
      length: 0,
    })
    const store = useSessionStore()
    // A session left from before the reload, with an OLDER csrf than the one GET /api/session returns.
    store.setSession(toClientSessionFromApi({ ...apiSession, csrf: 'stale-csrf' }, true))
    expect(storedCsrfToken()).toBe('stale-csrf')
    let storedAtLogout: string | null = 'unset'
    const post = vi.spyOn(api, 'post').mockImplementation(() => {
      // The transport sends the stored token when there is one: it must be gone by now.
      storedAtLogout = storedCsrfToken()
      return Promise.reject(new Error('network'))
    })
    await restoreHttpSession()
    expect(storedAtLogout).toBeNull()
    expect(post).toHaveBeenCalledWith('/api/auth/logout', { headers: { 'x-csrf-token': 'csrf-token' } })
    expect(store.token).toBeNull()
    expect(store.user).toBeNull()
  })

  it('keeps the session of any role when the prototype scope is off', async () => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'off')
    vi.spyOn(api, 'get').mockResolvedValue({ ...apiSession, active: { ...apiSession.active, role: 'parent' } })
    const post = vi.spyOn(api, 'post').mockResolvedValue(undefined)
    await restoreHttpSession()
    expect(post).not.toHaveBeenCalled()
    expect(useSessionStore().user?.role).toBe('parent')
  })
})
