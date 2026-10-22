import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/api'

import { isApiSession, restoreHttpSession, toClientSessionFromApi, type ApiSession } from '../http-session'
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
})

describe('restoreHttpSession scope check (P4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
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
    const post = vi.spyOn(api, 'post').mockRejectedValue(new Error('network'))
    const store = useSessionStore()
    store.setSession(toClientSessionFromApi(apiSession, true)) // a session left from before the reload
    expect(store.token).not.toBeNull()
    await restoreHttpSession()
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
