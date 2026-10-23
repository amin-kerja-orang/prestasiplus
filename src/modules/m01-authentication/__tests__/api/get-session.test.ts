import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/api'

import { getSession } from '../../api'

const API_SESSION = {
  user: {
    id: '42',
    name: 'Pelajar Demo',
    email: null,
    username: 'pelajar',
    avatarUrl: null,
    schoolId: null,
  },
  roles: [{ role: 'student' }],
  active: { role: 'student' },
  mode: null,
  landingPath: '/dashboard',
  expiresAt: '2099-01-01T00:00:00.000Z',
  csrf: 'csrf-rotated',
  mustChangePassword: false,
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('getSession (AM2-A1)', () => {
  it('reads GET /api/session in http mode and maps it, keeping the remember flag', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    const get = vi.spyOn(api, 'get').mockResolvedValue(API_SESSION)
    const session = await getSession(true)
    expect(get).toHaveBeenCalledWith('/api/session')
    expect(session).toMatchObject({ token: 'csrf-rotated', csrf: 'csrf-rotated', remember: true })
    expect(session?.user.landingPath).toBe('/dashboard')
  })

  it('does not call the API outside http mode (the mock session needs no refresh)', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    const get = vi.spyOn(api, 'get')
    expect(await getSession(false)).toBeNull()
    expect(get).not.toHaveBeenCalled()
  })

  it('throws in http mode for a 200 body that is not the API session (the caller failure path runs)', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    vi.spyOn(api, 'get').mockResolvedValue({ token: 't' })
    await expect(getSession(false)).rejects.toThrow('unexpected response body')
  })

  it('lets an API error propagate', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    vi.spyOn(api, 'get').mockRejectedValue(new Error('offline'))
    await expect(getSession(false)).rejects.toThrow('offline')
  })
})
