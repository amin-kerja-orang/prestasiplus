/**
 * AM2-A1b: `login()` sends the typed value as `identifier` in http mode (an e-mail or a roster
 * username, `POST /api/auth/login`) and keeps the prototype `email` field in mock mode.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ http: true, post: vi.fn() }))
vi.mock('@/api', () => ({
  api: { post: h.post },
  isHttpMode: () => h.http,
}))
vi.mock('@/stores/http-session', () => ({
  isApiSession: () => h.http,
  toClientSessionFromApi: () => ({ token: 'csrf', remember: false }),
}))

import { login } from '../../api/auth'

beforeEach(() => {
  h.post.mockReset()
  h.post.mockResolvedValue({ token: 't', expiresAt: 'x', user: {} })
})

describe('login() identifier (AM2-A1b)', () => {
  it('http mode: a username goes out as `identifier`', async () => {
    h.http = true
    await login({ email: 'murid04', password: 'pw', remember: false })
    expect(h.post).toHaveBeenCalledWith('/api/auth/login', {
      body: { identifier: 'murid04', password: 'pw', remember: false },
    })
  })

  it('mock mode: unchanged, the value goes out as `email`', async () => {
    h.http = false
    await login({ email: 'pelajar@demo.test', password: 'pw', remember: true })
    expect(h.post).toHaveBeenCalledWith('/api/auth/login', {
      body: { email: 'pelajar@demo.test', password: 'pw', remember: true },
    })
  })
})
