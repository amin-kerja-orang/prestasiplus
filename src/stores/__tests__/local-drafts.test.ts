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
})
