// @vitest-environment jsdom
import { FEATURE_ROUTE_PREFIXES } from '@pp/contract'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clock, toIsoMyt } from '@/lib/time'
import { navFor, userBottomNavFor, USER_DRAWER_ACCOUNT, USER_NAV, type NavEntry } from '@/shells/nav/user-nav'
import { toClientSessionFromApi, type ApiSession } from '@/stores/http-session'
import { useSessionStore } from '@/stores/session'
import type { ClientSession, Role } from '@/stores/session-types'

import { isFeatureOn, isServerFeatureOn, NAV_FEATURE_KEYS } from '../features'

/** S0-T10 Kawalan Ciri: the server flags of `GET /api/session` (`features`), absent key = ON. */

const apiSession = (features?: Record<string, boolean>, role = 'student'): ApiSession => ({
  user: { id: '1', name: 'Pelajar Demo', email: null, username: 'demo', avatarUrl: null, schoolId: null },
  roles: [{ role }],
  active: { role },
  mode: null,
  landingPath: '/dashboard',
  expiresAt: '2099-01-01T00:00:00.000+08:00',
  csrf: 'c',
  mustChangePassword: false,
  ...(features ? { features } : {}),
})

const signIn = (features?: Record<string, boolean>, role: Role = 'student'): void => {
  const client: ClientSession = toClientSessionFromApi(apiSession(features, role), false)
  useSessionStore().setSession({ ...client, expiresAt: toIsoMyt(clock.now() + 3_600_000), user: { ...client.user } })
}

const ids = (role: Role, surface: 'sidebar' | 'drawer' = 'sidebar'): string[] => {
  const out: string[] = []
  const walk = (list: readonly NavEntry[]) =>
    list.forEach((e) => {
      out.push(e.id)
      if (e.kind === 'group') walk(e.children)
    })
  walk(navFor(role, surface))
  return out
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isServerFeatureOn / isFeatureOn', () => {
  it('is ON without a session, without a map and for a key the map does not list', () => {
    expect(isServerFeatureOn('permainan')).toBe(true)
    signIn()
    expect(isServerFeatureOn('permainan')).toBe(true)
    signIn({ 'latih-tubi': false })
    expect(isServerFeatureOn('permainan')).toBe(true)
  })

  it('is ON with no active Pinia at all', () => {
    setActivePinia(undefined)
    expect(isServerFeatureOn('permainan')).toBe(true)
  })

  it('is OFF only for a key the map sets to false', () => {
    signIn({ permainan: false, 'latih-tubi': true })
    expect(isServerFeatureOn('permainan')).toBe(false)
    expect(isServerFeatureOn('latih-tubi')).toBe(true)
  })

  it('combines the build-time flag AND the server flag', () => {
    signIn({ permainan: false })
    expect(isFeatureOn('permainan', true)).toBe(false)
    expect(isFeatureOn('latih-tubi', true)).toBe(true)
    expect(isFeatureOn('latih-tubi', false)).toBe(false)
    expect(isFeatureOn('permainan', false)).toBe(false)
  })
})

describe('session mapping', () => {
  it('copies the features map into the client session, and omits it when the API sends none', () => {
    expect(toClientSessionFromApi(apiSession({ permainan: false }), false).features).toEqual({ permainan: false })
    expect('features' in toClientSessionFromApi(apiSession(), false)).toBe(false)
  })

  it('the store exposes an empty map without a session', () => {
    expect(useSessionStore().features).toEqual({})
  })
})

describe('menus hide an OFF item', () => {
  it('maps the four seeded keys to their menu items', () => {
    expect(NAV_FEATURE_KEYS).toMatchObject({
      permainan: 'permainan',
      'latih-tubi': 'latih-tubi',
      'cikgu-alesa': 'cikgu-alesa',
      'mohon-keluarga-angkat': 'keluarga-angkat',
    })
  })

  it('shows everything the build flags allow while no flag is OFF', () => {
    signIn({ permainan: true, 'latih-tubi': true })
    expect(ids('student')).toEqual(expect.arrayContaining(['permainan', 'latih-tubi']))
  })

  it('permainan OFF removes Permainan only (sidebar, drawer and the bottom-nav Game tab)', () => {
    signIn({ permainan: false })
    for (const surface of ['sidebar', 'drawer'] as const) {
      const list = ids('student', surface)
      expect(list).not.toContain('permainan')
      expect(list).toContain('latih-tubi')
    }
    expect(userBottomNavFor('student').map((e) => e.id)).not.toContain('game')
  })

  it('permainan ON keeps the bottom-nav Game tab', () => {
    signIn({ permainan: true })
    expect(userBottomNavFor('student').map((e) => e.id)).toContain('game')
  })

  it('latih-tubi OFF removes only Latih Tubi', () => {
    signIn({ 'latih-tubi': false })
    const list = ids('student')
    expect(list).not.toContain('latih-tubi')
    expect(list).toContain('permainan')
    expect(list).toContain('topik')
  })

  it('removes the item for a teacher too', () => {
    const teacherHas = (id: string) =>
      USER_NAV.some((e) => e.id === id && (!('roles' in e) || !e.roles || e.roles.includes('teacher')))
    signIn({ permainan: false, 'latih-tubi': false }, 'teacher')
    for (const id of ['permainan', 'latih-tubi']) {
      if (teacherHas(id)) expect(ids('teacher')).not.toContain(id)
    }
  })

  it('cikgu-alesa OFF removes both Cikgu Alesa entries when ALESA is built in', () => {
    vi.stubEnv('VITE_ALESA_AI', 'on')
    expect(ids('student')).toEqual(expect.arrayContaining(['cikgu-alesa', 'cikgu-alesa-chat']))
    signIn({ 'cikgu-alesa': false })
    expect(ids('student')).not.toContain('cikgu-alesa')
    expect(ids('student')).not.toContain('cikgu-alesa-chat')
  })

  it('keluarga-angkat OFF removes Mohon Keluarga Angkat when the build flag is on', () => {
    vi.stubEnv('VITE_KELUARGA_ANGKAT', 'on')
    expect(ids('student')).toContain('mohon-keluarga-angkat')
    signIn({ 'keluarga-angkat': false })
    expect(ids('student')).not.toContain('mohon-keluarga-angkat')
  })

  it('an OFF server flag cannot show what the build flag hides', () => {
    signIn({ 'keluarga-angkat': true, 'cikgu-alesa': true })
    expect(ids('student')).not.toContain('mohon-keluarga-angkat')
    expect(ids('student')).not.toContain('cikgu-alesa')
  })
})

describe('S0-T11: every key hides its menu items', () => {
  const FULL = { includeOutOfScope: true } as const
  /** All ids of the menu data (items and group children). */
  const allIds = (): Set<string> =>
    new Set([
      ...USER_NAV.flatMap((e) => (e.kind === 'group' ? [e.id, ...e.children.map((c) => c.id)] : [e.id])),
      ...USER_DRAWER_ACCOUNT.map((i) => i.id),
    ])
  const sidebarIds = (role: Role): string[] => {
    const out: string[] = []
    const walk = (list: readonly NavEntry[]) =>
      list.forEach((e) => {
        out.push(e.id)
        if (e.kind === 'group') walk(e.children)
      })
    walk(navFor(role, 'sidebar', USER_NAV, FULL))
    return out
  }
  const idsOfKey = (key: string): string[] =>
    Object.entries(NAV_FEATURE_KEYS)
      .filter(([, k]) => k === key)
      .map(([id]) => id)

  it('maps only keys that exist and menu ids that exist', () => {
    const known = allIds()
    for (const [id, key] of Object.entries(NAV_FEATURE_KEYS)) {
      expect(known.has(id), `menu id ${id}`).toBe(true)
      expect(FEATURE_ROUTE_PREFIXES[key], `key ${key}`).toBeDefined()
    }
  })

  it('every menu item whose path lies under a key fe prefix is mapped to that key (Cikgu Alesa extras: build flag)', () => {
    const items = USER_NAV.flatMap((e) => (e.kind === 'group' ? e.children : e.kind === 'item' ? [e] : []))
    const has = (p: string, x: string) => p === x || p.startsWith(`${x}/`)
    for (const item of items) {
      for (const [key, p] of Object.entries(FEATURE_ROUTE_PREFIXES)) {
        if (key === 'cikgu-alesa') continue
        const covered = p.fe.some((f) => has(item.to, f)) && !(p.feExcept ?? []).some((e) => has(item.to, e))
        if (covered) expect(NAV_FEATURE_KEYS[item.id], `${item.id} (${item.to}) under ${key}`).toBe(key)
      }
    }
  })

  it('the only keys without a menu item are Kemajuan Saya and Sejarah Latihan (home shortcuts)', () => {
    const withItems = new Set(Object.values(NAV_FEATURE_KEYS))
    const without = Object.keys(FEATURE_ROUTE_PREFIXES).filter((k) => !withItems.has(k)).sort()
    expect(without).toEqual(['kemajuan-saya', 'sejarah-latihan'])
  })

  const keys = [...new Set(Object.values(NAV_FEATURE_KEYS))].filter((k) => k !== 'cikgu-alesa' && k !== 'keluarga-angkat')
  it.each(keys)('%s OFF removes its menu items and nothing else (bar a section left empty)', (key) => {
    const mine = idsOfKey(key)
    for (const role of ['student', 'teacher', 'school_admin'] as const) {
      signIn({}, role)
      const before = sidebarIds(role)
      signIn({ [key]: false }, role)
      const after = sidebarIds(role)
      for (const id of mine) expect(after, `${role}: ${id} stays with ${key} OFF`).not.toContain(id)
      const removed = before.filter((id) => !after.includes(id))
      expect(removed.every((id) => mine.includes(id) || id.startsWith('sec-')), `${role} ${key} removed ${removed.join(',')}`).toBe(true)
    }
  })

  it('AC-ADM-P2-19.1: Leaderboard OFF removes Papan Pendahulu from the pupil menu, ON restores it', () => {
    signIn({}, 'student')
    expect(sidebarIds('student')).toContain('papan-pendahulu')
    signIn({ leaderboard: false }, 'student')
    expect(sidebarIds('student')).not.toContain('papan-pendahulu')
    signIn({ leaderboard: true }, 'student')
    expect(sidebarIds('student')).toContain('papan-pendahulu')
  })
})
