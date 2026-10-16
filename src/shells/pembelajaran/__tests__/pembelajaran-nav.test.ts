// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveShell, userShellFor } from '@/app/router/layouts'
import { FRIEND_STORAGE_KEY, resetFriendForTests, useFriend } from '@/composables/useFriend'

import { accountItems, drawerEntries, pembelajaranTabs, sidebarEntries } from '../pembelajaran-nav'

beforeEach(() => vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on'))
afterEach(() => vi.unstubAllEnvs())

describe('Pembelajaran shell selection', () => {
  it('student and teacher get the Pembelajaran layout while the scope is on', () => {
    expect(userShellFor('student')).toBe('pembelajaran')
    expect(userShellFor('teacher')).toBe('pembelajaran')
    expect(userShellFor('school_admin')).toBe('user')
    expect(resolveShell('user', { isLoggedIn: true, role: 'student' })).toBe('pembelajaran')
    expect(resolveShell('public-or-user', { isLoggedIn: false, role: null })).toBe('public')
  })

  it('keeps the legacy user shell when the scope is off (e2e build)', () => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'off')
    expect(userShellFor('student')).toBe('user')
  })
})

describe('Pembelajaran menus come from the scoped nav data', () => {
  it('student tabs are Home, SPM, Game, Topik (Lagi is added by the layout)', () => {
    expect(pembelajaranTabs('student').map((t) => t.label)).toEqual([
      'Home',
      'SPM',
      'Game',
      'Topik',
    ])
  })

  it('teacher tabs use the teacher labels and only in-scope targets', () => {
    const labels = pembelajaranTabs('teacher').map((t) => t.label)
    expect(labels.length).toBeGreaterThan(0)
    for (const l of labels) {
      expect(['Dashboard', 'Kelas', 'Command Center', 'Penilaian']).toContain(l)
    }
  })

  it('sidebar and drawer are non-empty and the drawer account keeps no logout row', () => {
    expect(sidebarEntries('student').length).toBeGreaterThan(0)
    expect(drawerEntries('teacher').length).toBeGreaterThan(0)
    expect(accountItems('student').some((i) => i.to === '/logout')).toBe(false)
  })
})

describe('useFriend', () => {
  beforeEach(() => {
    localStorage.clear()
    resetFriendForTests()
  })

  it('defaults to Aiman without storing, and persists a choice', () => {
    const f = useFriend()
    expect(f.friend.value).toBe('aiman')
    expect(f.hasChosen.value).toBe(false)
    f.choose('aisyah')
    expect(f.friend.value).toBe('aisyah')
    expect(localStorage.getItem(FRIEND_STORAGE_KEY)).toBe('aisyah')
  })

  it('offers the picker once on first run only', () => {
    const f = useFriend()
    f.offerFirstRun()
    expect(f.pickerOpen.value).toBe(true)
    f.pickerOpen.value = false
    f.offerFirstRun()
    expect(f.pickerOpen.value).toBe(false)
  })

  it('does not offer the picker when a friend was already chosen', () => {
    localStorage.setItem(FRIEND_STORAGE_KEY, 'aisyah')
    resetFriendForTests()
    const f = useFriend()
    f.offerFirstRun()
    expect(f.pickerOpen.value).toBe(false)
  })
})
