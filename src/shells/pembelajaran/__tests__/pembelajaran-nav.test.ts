// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveShell, userShellFor } from '@/app/router/layouts'
import { FRIEND_STORAGE_KEY, resetFriendForTests, useFriend } from '@/composables/useFriend'

import { dsIconBaseNames } from '@/theme/ds-icons'
import { learnIconNames } from '@/theme/learn-icons'

import {
  accountItems,
  accountLinks,
  buildLearnNav,
  buildLearnSearch,
  drawerEntries,
  flatItems,
  groupTabs,
  labelTitle,
  learnNavUi,
  pembelajaranTabs,
  phIconFor,
  sidebarEntries,
} from '../pembelajaran-nav'

beforeEach(() => vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on'))
afterEach(() => vi.unstubAllEnvs())

describe('Pembelajaran shell selection', () => {
  it('student and teacher get the Pembelajaran layout while the scope is on', () => {
    expect(userShellFor('student')).toBe('pembelajaran')
    expect(userShellFor('teacher')).toBe('pembelajaran')
    expect(userShellFor('school_admin')).toBe('pembelajaran') // staff v2 shell (S-01)
    expect(userShellFor('admin')).toBe('pentadbiran') // Profil, Tetapan, Tiket (S-10)
    expect(resolveShell('admin', { isLoggedIn: true, role: 'teacher' })).toBe('pembelajaran') // S-12
    expect(resolveShell('role', { isLoggedIn: true, role: 'admin' })).toBe('pentadbiran')
    expect(resolveShell('user', { isLoggedIn: true, role: 'student' })).toBe('pembelajaran')
    expect(resolveShell('public-or-user', { isLoggedIn: false, role: null })).toBe('public')
  })

  it('picks the same v2 shells when the scope is off (UAT and e2e builds)', () => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'off')
    expect(userShellFor('student')).toBe('pembelajaran')
    expect(userShellFor('teacher')).toBe('pembelajaran')
    expect(userShellFor('school_admin')).toBe('pembelajaran')
    expect(userShellFor('admin')).toBe('pentadbiran')
    expect(resolveShell('admin', { isLoggedIn: true, role: 'teacher' })).toBe('pembelajaran')
    expect(resolveShell('role', { isLoggedIn: true, role: 'admin' })).toBe('pentadbiran')
    // Roles outside v2 keep the legacy user shell.
    for (const role of ['parent', 'sponsor', 'ppd_officer'] as const) {
      expect(userShellFor(role), role).toBe('user')
    }
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
    expect(f.promptOpen.value).toBe(true)
    expect(f.pickerOpen.value).toBe(false)
    f.dismissPrompt()
    expect(f.promptOpen.value).toBe(false)
    expect(localStorage.getItem(FRIEND_STORAGE_KEY)).toBe('aiman')
    f.offerFirstRun()
    expect(f.promptOpen.value).toBe(false)
  })

  it('does not offer the picker when a friend was already chosen', () => {
    localStorage.setItem(FRIEND_STORAGE_KEY, 'aisyah')
    resetFriendForTests()
    const f = useFriend()
    f.offerFirstRun()
    expect(f.promptOpen.value).toBe(false)
  })
})

describe('Pembelajaran Nuxt UI menu data', () => {
  const roles = ['student', 'teacher', 'school_admin'] as const

  it('every menu item gets a Phosphor glyph that is registered in the icon bundle', () => {
    for (const role of roles) {
      for (const item of flatItems(sidebarEntries(role))) {
        expect([...learnIconNames, ...dsIconBaseNames], `${role}/${item.id}`).toContain(phIconFor(item))
      }
    }
  })

  it('learner rows use the Duotone weight, staff rows the Regular weight', () => {
    const learner = buildLearnNav(sidebarEntries('student'), { learner: true, currentPath: '/spm' })
    const staff = buildLearnNav(sidebarEntries('teacher'), { learner: false, currentPath: '/guru' })
    const icons = (groups: typeof learner) =>
      groups.flat().flatMap((i) => (i.icon ? [String(i.icon)] : []))
    expect(icons(learner).every((c) => c.endsWith('-duotone'))).toBe(true)
    expect(icons(staff).some((c) => c.endsWith('-duotone'))).toBe(false)
  })

  it('headings become label rows and exactly one item is active', () => {
    const groups = buildLearnNav(sidebarEntries('teacher'), { learner: false, currentPath: '/guru' })
    const flat = groups.flat()
    expect(flat.some((i) => i.type === 'label')).toBe(true)
    expect(flat.filter((i) => i.active === true)).toHaveLength(1)
  })

  it('folds Kirkpatrick into one row (no children) and exposes its pages as in-page tabs', () => {
    const entries = sidebarEntries('teacher')
    const flat = buildLearnNav(entries, { learner: false, currentPath: '/guru/kirkpatrick/chain' }).flat()
    expect(flat.every((i) => i.children === undefined)).toBe(true)
    const row = flat.filter((i) => i.label === 'Kirkpatrick')
    expect(row).toHaveLength(1)
    expect(row[0]?.active).toBe(true)
    expect(row[0]?.to).toBe('/guru/kirkpatrick')
    const tabs = groupTabs(entries, 't-kirk-rantaian')
    expect(tabs.map((t) => t.label)).toContain('Rantaian Impak')
    expect(tabs).toHaveLength(7)
    expect(groupTabs(entries, 't-prestasi')).toEqual([])
  })

  it('the account menu lists the section A links and keeps routes in scope', () => {
    for (const role of roles) {
      const labels = accountLinks(role).map((l) => l.label)
      expect(labels, role).toEqual(['Profil Saya', 'Tetapan Peribadi', 'Panduan', 'Tiket Bantuan'])
    }
  })

  it('search groups cover every sidebar item', () => {
    const entries = sidebarEntries('student')
    const ids = buildLearnSearch(entries, { learner: true, currentPath: '/' }).flatMap((g) =>
      g.items.map((i) => i.id),
    )
    expect(ids.sort()).toEqual(flatItems(entries).map((i) => i.id).sort())
  })
})

describe('sidebar active row (UAT: white label on a light grey pill when hovered)', () => {
  const classes = (learner: boolean): string[] => (learnNavUi(learner).link ?? '').split(/\s+/)

  it('learner: the gradient fill is on the link itself, so the hover grey cannot cover it', () => {
    const c = classes(true)
    expect(c).toContain('aria-[current=page]:bg-gradient-primary')
    expect(c).toContain('aria-[current=page]:text-primary-on')
    expect(c).toContain('aria-[current=page]:hover:text-primary-on')
  })

  it('staff: the primary-soft tint and primary-t label stay on hover', () => {
    const c = classes(false)
    expect(c).toContain('aria-[current=page]:bg-primary-soft')
    expect(c).toContain('aria-[current=page]:hover:bg-primary-soft')
    expect(c).toContain('aria-[current=page]:text-primary-t')
    expect(c).toContain('aria-[current=page]:hover:text-primary-t')
  })

  it('uses design-system tokens only (no arbitrary colour values)', () => {
    for (const learner of [true, false]) {
      for (const cls of classes(learner)) {
        expect(cls, cls).not.toMatch(/(bg|text)-\[|#[0-9a-f]{3,8}|(bg|text)-(white|black|gray|slate)/i)
      }
    }
  })

  it('a short label gets no browser tooltip; a long one keeps its full text', () => {
    expect(labelTitle('Dashboard')).toBeUndefined()
    expect(labelTitle(undefined)).toBeUndefined()
    expect(labelTitle('Kedai Hadiah 🎁 (DIGITAL) untuk murid')).toBe('Kedai Hadiah 🎁 (DIGITAL) untuk murid')
  })
})
