// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/api'
import { clock } from '@/lib/time'

import { parseClientSession, PP_AUTH_STORAGE_KEY, useSessionStore } from '..'
import { fakeTransport, session } from './fixtures'

const NOW = '2026-09-25T15:40:00+08:00'

/** `GET /api/me` as the real API sends it: opaque string ids (contract `UserMe`). */
const API_ME = {
  id: '1',
  name: 'Murid Demo',
  email: 'pelajar@demo.test',
  phone: null,
  role: 'student',
  grade: 10,
  schoolId: '1',
  bio: null,
  avatarUrl: null,
  school: null,
  landingPath: '/dashboard',
  createdAt: '2026-09-25T15:40:00.000+08:00',
  updatedAt: '2026-09-25T15:40:00.000+08:00',
  lastLoginAt: null,
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: Date.parse(NOW), toFake: ['Date'] })
  clock.reset()
  setActivePinia(createPinia())
})

afterEach(() => {
  clock.reset()
  vi.useRealTimers()
  api.configure({ transport: null })
})

describe('background /api/me refresh with the real API (demo rehearsal blocker)', () => {
  it('keeps the session valid for the next navigation when /api/me sends string ids', async () => {
    api.configure({ transport: fakeTransport(() => ({ status: 200, body: { data: API_ME } })) })
    const store = useSessionStore()
    store.setSession(session())

    await store.refreshUser()

    const stored = parseClientSession(localStorage.getItem(PP_AUTH_STORAGE_KEY))
    expect(stored?.user).toMatchObject({
      id: 1,
      schoolId: 1,
      name: 'Murid Demo',
      landingPath: '/dashboard',
    })
    // The router guard runs check() before every navigation: it must not log the user out.
    expect(store.check()).toBe(true)
    expect(store.isLoggedIn).toBe(true)
  })

  it('keeps the current landing path when /api/me has none', async () => {
    const noLanding: Partial<typeof API_ME> = { ...API_ME }
    delete noLanding.landingPath
    api.configure({ transport: fakeTransport(() => ({ status: 200, body: { data: noLanding } })) })
    const store = useSessionStore()
    store.setSession(session())

    await store.refreshUser()

    expect(store.check()).toBe(true)
    expect(store.landingPath).toBe('/dashboard')
  })
})
