// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionStore } from '@/stores'
import { toClientSessionFromApi, type ApiSession } from '@/stores/http-session'

import { enterModPelajar, exitModPelajar } from '../shared/mod-pelajar'

const post = vi.hoisted(() => vi.fn())
const del = vi.hoisted(() => vi.fn())
const get = vi.hoisted(() => vi.fn())
vi.mock('@/api', async (orig) => ({
  ...(await orig<typeof import('@/api')>()),
  api: { post, get, delete: del, configure: vi.fn() },
}))

const FUTURE = '2099-01-01T00:00:00+08:00'
const apiSession = (over: Partial<ApiSession>): ApiSession => ({
  user: { id: '1', name: 'Admin Demo', email: 'admin@demo.test', username: null, avatarUrl: null, schoolId: null },
  roles: [{ role: 'admin' }],
  active: { role: 'admin' },
  mode: null,
  landingPath: '/admin/command-center',
  expiresAt: FUTURE,
  csrf: 'csrf-staff',
  mustChangePassword: false,
  ...over,
})
const modeSession = apiSession({
  active: { role: 'student' },
  mode: { kind: 'mod_pelajar', returnRole: 'admin', since: '2026-10-20T10:00:00+08:00' },
  landingPath: '/dashboard',
  csrf: 'csrf-mode',
})

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  post.mockReset()
  del.mockReset()
  get.mockReset()
})
afterEach(() => vi.unstubAllEnvs())

describe('Mod Pelajar (http mode)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_MODE', 'http')
    useSessionStore().setSession(toClientSessionFromApi(apiSession({}), false))
  })

  it('enters via POST /api/session/mode, applies the returned session and lands on the student home', async () => {
    post.mockResolvedValue(modeSession)
    const path = await enterModPelajar()
    expect(post).toHaveBeenCalledWith('/api/session/mode', { body: { mode: 'mod_pelajar' } })
    const session = useSessionStore()
    expect(session.role).toBe('student')
    expect(session.mode?.kind).toBe('mod_pelajar')
    expect(session.mode?.returnRole).toBe('admin')
    expect(path).toBe('/spm/bijak')
    // The rotated csrf token is stored, as after login.
    expect(JSON.parse(localStorage.getItem('pp.auth') ?? '{}').csrf).toBe('csrf-mode')
  })

  it('leaves via DELETE /api/session/mode and restores the staff session', async () => {
    post.mockResolvedValue(modeSession)
    await enterModPelajar()
    del.mockResolvedValue(apiSession({ csrf: 'csrf-back' }))
    const path = await exitModPelajar()
    expect(del).toHaveBeenCalledWith('/api/session/mode')
    const session = useSessionStore()
    expect(session.role).toBe('admin')
    expect(session.mode).toBeNull()
    expect(path).toBe('/admin/command-center')
  })

  it('falls back to GET /api/me when no Session body comes back', async () => {
    post.mockResolvedValue(undefined)
    get.mockRejectedValue(new Error('offline'))
    await enterModPelajar()
    expect(get).toHaveBeenCalledWith('/api/me')
  })

  it('rejects and keeps the staff session when the API refuses', async () => {
    post.mockRejectedValue(new Error('MODE_NOT_ALLOWED'))
    await expect(enterModPelajar()).rejects.toThrow('MODE_NOT_ALLOWED')
    expect(useSessionStore().role).toBe('admin')
    expect(useSessionStore().mode).toBeNull()
  })

  it('rejects an exit error without touching the session', async () => {
    post.mockResolvedValue(modeSession)
    await enterModPelajar()
    del.mockRejectedValue(new Error('NO_MODE_ACTIVE'))
    await expect(exitModPelajar()).rejects.toThrow('NO_MODE_ACTIVE')
    expect(useSessionStore().role).toBe('student')
  })

  it('rebuilds the mode from GET /api/session (reload)', () => {
    const client = toClientSessionFromApi(modeSession, false)
    expect(client.mode?.returnRole).toBe('admin')
    expect(client.user.role).toBe('student')
  })
})

describe('Mod Pelajar (mock mode)', () => {
  it('still uses the impersonate endpoint', async () => {
    useSessionStore().setSession({
      token: 'adm',
      remember: false,
      expiresAt: FUTURE,
      user: { ...toClientSessionFromApi(apiSession({}), false).user },
    })
    post.mockResolvedValue({
      token: 'stu',
      expiresAt: FUTURE,
      user: { ...toClientSessionFromApi(apiSession({}), false).user, id: 2, role: 'student' },
    })
    expect(await enterModPelajar()).toBe('/dashboard')
    expect(post).toHaveBeenCalledWith('/api/admin/users/2/impersonate')
    expect(del).not.toHaveBeenCalled()
  })
})
