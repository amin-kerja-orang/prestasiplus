import { describe, expect, it } from 'vitest'

import { isApiSession, toClientSessionFromApi, type ApiSession } from '../http-session'

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
