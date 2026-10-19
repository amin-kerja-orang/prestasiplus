// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'

import { createAppRouter } from '@/app/router'
import { adminShellFor, resolveShell, resolveShellForPath } from '@/app/router/layouts'

import { isPathInScope } from '@/app/prototype-scope'
import {
  navFor,
  userBottomNavFor,
  userDrawerAccountFor,
  type NavEntry,
} from '@/shells/nav/user-nav'

import { ALL_ITEMS, FULL_ITEMS, PENTADBIRAN_FULL_MENU, PENTADBIRAN_MENU, activeItem } from '../menu'

const itemsOf = (label: string): string[] =>
  PENTADBIRAN_MENU.find((g) => g.label === label)?.items.map((i) => i.id) ?? []

describe('Pentadbiran menu data', () => {
  it('keeps the full 9-group, 103-item definition as data', () => {
    expect(PENTADBIRAN_FULL_MENU.map((g) => g.items.length)).toEqual([
      2, 28, 7, 15, 12, 6, 22, 6, 5,
    ])
    expect(FULL_ITEMS).toHaveLength(103)
    expect(new Set(FULL_ITEMS.map((i) => i.id)).size).toBe(103)
  })

  it('renders built screens only and drops empty groups', () => {
    expect(ALL_ITEMS.every((i) => i.built)).toBe(true)
    expect(ALL_ITEMS.length).toBe(FULL_ITEMS.filter((i) => i.built).length)
    expect(PENTADBIRAN_MENU.every((g) => g.items.length > 0)).toBe(true)
    expect(PENTADBIRAN_MENU.map((g) => g.label)).toContain('Kertas & SPM')
    expect(itemsOf('Kertas & SPM')).toEqual(['KS-13', 'KS-14', 'KS-15', 'KS-02', 'KS-09'])
  })

  it('never points a visible item at a placeholder route', () => {
    for (const item of ALL_ITEMS) expect(item.to, item.id).not.toContain('/admin/p/')
  })

  it('activates the longest matching item (drill pages stay on Langsung)', () => {
    expect(activeItem('/admin/command-center/school/3')?.id).toBe('PM-01')
    expect(activeItem('/admin/command-center/daily-activity')?.id).toBe('PM-02')
    expect(activeItem('/admin/questions/import')?.id).toBe('BS-02')
  })
})

describe('Pentadbiran routing', () => {
  it('every item resolves to a real route (not the 404 catch-all)', () => {
    const router = createAppRouter({ history: createMemoryHistory() })
    for (const item of ALL_ITEMS) {
      const resolved = router.resolve(item.to)
      expect(resolved.matched.length, `${item.id} ${item.to}`).toBeGreaterThan(0)
      expect(String(resolved.name), `${item.id} ${item.to}`).not.toMatch(/not-found|404/i)
    }
  })

  it('the old placeholder URL redirects to the admin home', () => {
    const router = createAppRouter({ history: createMemoryHistory() })
    expect(router.resolve('/admin/p/pm-04').matched[0]?.redirect).toBe('/admin/command-center')
  })

  it('Admin Pusat gets the portal only while the prototype scope is on', () => {
    const admin = { isLoggedIn: true, role: 'admin' as const }
    expect(resolveShell('admin', admin)).toBe('admin') // vitest runs with the scope off
    expect(resolveShellForPath('bare', admin, '/admin/command-center')).toBeNull()
    expect(adminShellFor('teacher')).toBe('admin')
  })
})

describe('Pembelajaran menus (scope on)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const paths = (entries: readonly NavEntry[]): string[] =>
    entries.flatMap((e) =>
      e.kind === 'item' ? [e.to] : e.kind === 'group' ? e.children.map((c) => c.to) : [],
    )

  it('every visible link of every role resolves to a real, in-scope route', () => {
    const router = createAppRouter({ history: createMemoryHistory() })
    for (const role of ['student', 'teacher', 'school_admin'] as const) {
      const all = [
        ...paths(navFor(role, 'sidebar')),
        ...paths(navFor(role, 'drawer')),
        ...userBottomNavFor(role).flatMap((e) => (e.kind === 'button' ? [] : [e.to])),
        ...userDrawerAccountFor(role).map((i) => i.to),
      ].filter((to) => to.startsWith('/'))
      for (const to of all) {
        const resolved = router.resolve(to)
        expect(isPathInScope(role, to), `${role} ${to} in scope`).toBe(true)
        expect(resolved.matched.length, `${role} ${to}`).toBeGreaterThan(0)
        expect(String(resolved.name), `${role} ${to}`).not.toMatch(/not-found|404/i)
      }
    }
  })
})
