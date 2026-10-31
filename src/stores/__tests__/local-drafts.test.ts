// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LOCAL_DRAFT_PREFIX, useSessionStore } from '..'

describe('unsaved drafts belong to the signed-in user', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('sign-out removes every pp:draft:* value and nothing else', async () => {
    localStorage.setItem(`${LOCAL_DRAFT_PREFIX}studio:7:baharu`, '{"v":1}')
    localStorage.setItem(`${LOCAL_DRAFT_PREFIX}studio:7:soalan-5`, '{"v":1}')
    localStorage.setItem('pp.theme', 'dark')
    await useSessionStore().logout()
    expect(Object.keys(localStorage).filter((k) => k.startsWith(LOCAL_DRAFT_PREFIX))).toEqual([])
    expect(localStorage.getItem('pp.theme')).toBe('dark')
  })

  it('a 401 clears the session but keeps the drafts', async () => {
    localStorage.setItem(`${LOCAL_DRAFT_PREFIX}studio:7:baharu`, '{"v":1}')
    await useSessionStore().handleUnauthorized()
    expect(localStorage.getItem(`${LOCAL_DRAFT_PREFIX}studio:7:baharu`)).toBe('{"v":1}')
  })

  it('signing in as another user removes the previous drafts; the same user keeps them', () => {
    const store = useSessionStore()
    const base = { token: 't', remember: false, expiresAt: '2099-01-01T00:00:00+08:00' }
    const user = (id: number) => ({ id, name: 'U', email: 'u@demo.test', role: 'admin' }) as never
    store.setSession({ ...base, user: user(7) })
    localStorage.setItem(`${LOCAL_DRAFT_PREFIX}studio:7:baharu`, '{"v":1}')
    store.setSession({ ...base, user: user(7) })
    expect(localStorage.getItem(`${LOCAL_DRAFT_PREFIX}studio:7:baharu`)).toBe('{"v":1}')
    store.setSession({ ...base, user: user(8) })
    expect(localStorage.getItem(`${LOCAL_DRAFT_PREFIX}studio:7:baharu`)).toBeNull()
  })
})
