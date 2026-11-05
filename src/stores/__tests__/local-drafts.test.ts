// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { readFileSync } from 'node:fs'

import { LOCAL_DRAFT_PREFIX, useSessionStore } from '..'
import { BIJAK_LOCAL_PREFIX } from '../session'

// Read from source: a test may not deep-import another module, and the store must not import from m28.
const LOCAL_PREFIX = /export const LOCAL_PREFIX = '([^']+)'/.exec(
  readFileSync(`${process.cwd()}/src/modules/m28-bijak-spm/lib/autosave.ts`, 'utf8'),
)?.[1]

describe('unsaved drafts belong to the signed-in user', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
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

  it('keeps the store prefix equal to the Bijak autosave LOCAL_PREFIX', () => {
    expect(LOCAL_PREFIX).toBe('pp.bijak.local.')
    expect(BIJAK_LOCAL_PREFIX).toBe(LOCAL_PREFIX)
  })

  it('sign-out also removes pp.bijak.local.* and pp.draft.* in both storages, nothing else', async () => {
    localStorage.setItem('pp.bijak.local.7', '{}')
    localStorage.setItem('pp.draft.a.new', '{}')
    sessionStorage.setItem('pp.draft.x.new', '{}')
    sessionStorage.setItem('other', '1')
    localStorage.setItem('pp.theme', 'dark')
    await useSessionStore().logout()
    expect(localStorage.getItem('pp.bijak.local.7')).toBeNull()
    expect(localStorage.getItem('pp.draft.a.new')).toBeNull()
    expect(sessionStorage.getItem('pp.draft.x.new')).toBeNull()
    expect(sessionStorage.getItem('other')).toBe('1')
    expect(localStorage.getItem('pp.theme')).toBe('dark')
  })

  it('a 401 keeps the Bijak and pp.draft keys', async () => {
    localStorage.setItem('pp.bijak.local.7', '{}')
    sessionStorage.setItem('pp.draft.x.new', '{}')
    await useSessionStore().handleUnauthorized()
    expect(localStorage.getItem('pp.bijak.local.7')).toBe('{}')
    expect(sessionStorage.getItem('pp.draft.x.new')).toBe('{}')
  })

  it('switching user removes the new key families too', () => {
    const store = useSessionStore()
    const base = { token: 't', remember: false, expiresAt: '2099-01-01T00:00:00+08:00' }
    const user = (id: number) => ({ id, name: 'U', email: 'u@demo.test', role: 'admin' }) as never
    store.setSession({ ...base, user: user(7) })
    localStorage.setItem('pp.bijak.local.7', '{}')
    sessionStorage.setItem('pp.draft.x.new', '{}')
    store.setSession({ ...base, user: user(8) })
    expect(localStorage.getItem('pp.bijak.local.7')).toBeNull()
    expect(sessionStorage.getItem('pp.draft.x.new')).toBeNull()
  })
})
