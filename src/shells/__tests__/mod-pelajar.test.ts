// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionStore, type UserMe } from '@/stores'

import { enterModPelajar, leaveModPelajar, MOD_PELAJAR_RETURN } from '../shared/mod-pelajar'

const post = vi.hoisted(() => vi.fn())
vi.mock('@/api', async (orig) => ({
  ...(await orig<typeof import('@/api')>()),
  api: { post, get: vi.fn(), configure: vi.fn() },
}))

const user = (over: Partial<UserMe>): UserMe => ({
  id: 1,
  name: 'Admin Demo',
  email: 'admin@demo.test',
  phone: null,
  role: 'admin',
  grade: null,
  schoolId: null,
  bio: null,
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00+08:00',
  updatedAt: '2026-01-01T00:00:00+08:00',
  lastLoginAt: null,
  school: null,
  landingPath: '/admin/command-center',
  ...over,
})
const FUTURE = '2099-01-01T00:00:00+08:00'
const student = {
  token: 'stu-token',
  expiresAt: FUTURE,
  user: user({ id: 2, name: 'Pelajar Demo', role: 'student', landingPath: '/dashboard' }),
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  post.mockReset()
})

describe('Mod Pelajar', () => {
  it('admin enters as the demo student with the admin session parked, and leaves back to it', async () => {
    const session = useSessionStore()
    session.setSession({ token: 'adm-token', remember: false, expiresAt: FUTURE, user: user({}) })
    post.mockResolvedValue(student)

    await expect(enterModPelajar()).resolves.toBe('/dashboard')
    expect(post).toHaveBeenCalledWith('/api/admin/users/2/impersonate')
    expect(session.role).toBe('student')
    expect(session.token).toBe('stu-token')
    expect(session.mode?.returnRole).toBe('admin')
    // survives a reload of pp.auth
    expect(session.check()).toBe(true)
    expect(session.mode?.parent.token).toBe('adm-token')

    expect(leaveModPelajar()).toBe(MOD_PELAJAR_RETURN)
    expect(session.role).toBe('admin')
    expect(session.token).toBe('adm-token')
    expect(session.mode).toBeNull()
  })

  it('refuses a non-admin', async () => {
    const session = useSessionStore()
    session.setSession({
      token: 't',
      remember: false,
      expiresAt: FUTURE,
      user: user({ role: 'teacher' }),
    })
    await expect(enterModPelajar()).rejects.toThrow()
    expect(post).not.toHaveBeenCalled()
  })

  it('goes to /login when the parked admin session expired meanwhile', () => {
    const session = useSessionStore()
    session.setSession({
      token: 'adm-token',
      remember: false,
      expiresAt: '2000-01-01T00:00:00+08:00',
      user: user({}),
    })
    session.enterModPelajar(student, MOD_PELAJAR_RETURN)
    expect(leaveModPelajar()).toBe('/login')
    expect(session.isLoggedIn).toBe(false)
  })
})
