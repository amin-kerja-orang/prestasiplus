// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionStore } from '@/stores/session'

import type { ClientSession } from '../../api'
import { changePasswordAndRefresh } from '../../lib/password-change'

const apiMocks = vi.hoisted(() => ({ changePassword: vi.fn(), getSession: vi.fn() }))
vi.mock('../../api', () => apiMocks)

const user = {
  id: 2,
  name: 'Pelajar Demo',
  email: 'pelajar@demo.test',
  phone: null,
  role: 'student' as const,
  grade: 10,
  schoolId: null,
  bio: null,
  avatarUrl: null,
  createdAt: '2026-02-06T09:00:00+08:00',
  updatedAt: '2026-02-06T09:00:00+08:00',
  lastLoginAt: null,
  school: null,
  landingPath: '/dashboard',
}
const OLD: ClientSession = {
  token: 'csrf-old',
  csrf: 'csrf-old',
  remember: false,
  expiresAt: '2099-01-01T00:00:00+08:00',
  user,
}
const FRESH: ClientSession = { ...OLD, token: 'csrf-new', csrf: 'csrf-new' }
const REQUEST = { currentPassword: 'a', password: 'b', passwordConfirmation: 'b' }

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  useSessionStore().setSession(OLD)
  apiMocks.changePassword.mockReset()
  apiMocks.getSession.mockReset()
})

describe('changePasswordAndRefresh (DV-26, DV-27)', () => {
  it('stores the re-read session (rotated CSRF) after the change', async () => {
    apiMocks.changePassword.mockResolvedValue('ok')
    apiMocks.getSession.mockResolvedValue(FRESH)
    await expect(changePasswordAndRefresh(REQUEST)).resolves.toEqual({
      status: 'ok',
      refreshed: true,
    })
    expect(useSessionStore().auth?.csrf).toBe('csrf-new')
  })

  it('keeps the session when there is nothing to re-read (mock mode)', async () => {
    apiMocks.changePassword.mockResolvedValue('ok')
    apiMocks.getSession.mockResolvedValue(null)
    await expect(changePasswordAndRefresh(REQUEST)).resolves.toEqual({
      status: 'ok',
      refreshed: true,
    })
    expect(useSessionStore().auth?.csrf).toBe('csrf-old')
  })

  it('resolves refreshed: false when the re-read fails (the password is changed)', async () => {
    apiMocks.changePassword.mockResolvedValue('ok')
    apiMocks.getSession.mockRejectedValue(new Error('offline'))
    await expect(changePasswordAndRefresh(REQUEST)).resolves.toEqual({
      status: 'ok',
      refreshed: false,
    })
  })

  it('rejects with the API error and does not re-read when the change fails', async () => {
    apiMocks.changePassword.mockRejectedValue(new Error('422'))
    await expect(changePasswordAndRefresh(REQUEST)).rejects.toThrow('422')
    expect(apiMocks.getSession).not.toHaveBeenCalled()
    expect(useSessionStore().auth?.csrf).toBe('csrf-old')
  })
})
