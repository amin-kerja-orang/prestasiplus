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

import {
  accountLinks,
  drawerEntries,
  pembelajaranTabs,
  routeRoleCheck,
  sidebarEntries,
} from '@/shells/pembelajaran/pembelajaran-nav'

import { ALL_ITEMS, FULL_ITEMS, PENTADBIRAN_FULL_MENU, PENTADBIRAN_MENU, activeItem } from '../menu'

const itemsOf = (label: string): string[] =>
  PENTADBIRAN_MENU.find((g) => g.label === label)?.items.map((i) => i.id) ?? []

describe('Pentadbiran menu data', () => {
  it('keeps the full 9-group, 106-item definition as data', () => {
    expect(PENTADBIRAN_FULL_MENU.map((g) => g.items.length)).toEqual([
      2, 28, 8, 17, 12, 6, 22, 6, 5,
    ])
    expect(FULL_ITEMS).toHaveLength(106)
    expect(new Set(FULL_ITEMS.map((i) => i.id)).size).toBe(106)
  })

  it('renders built screens only and drops empty groups', () => {
    expect(ALL_ITEMS.every((i) => i.built)).toBe(true)
    expect(ALL_ITEMS.length).toBe(FULL_ITEMS.filter((i) => i.built).length)
    expect(PENTADBIRAN_MENU.every((g) => g.items.length > 0)).toBe(true)
    expect(PENTADBIRAN_MENU.map((g) => g.label)).toContain('Kertas & SPM')
    expect(itemsOf('Kertas & SPM')).toEqual([
      'KS-01',
      'KS-13',
      'KS-16',
      'KS-14',
      'KS-15',
      'KS-02',
      'KS-08',
      'KS-09',
      'KS-17',
    ])
  })

  it('V2 labels (D79): SPM hub, Kontrak Simulasi, Studio list', () => {
    const byId = new Map(ALL_ITEMS.map((i) => [i.id, i]))
    expect(byId.get('KS-01')).toMatchObject({ label: 'SPM', to: '/admin/spm' })
    expect(byId.get('KS-08')?.label).toBe('Kontrak Simulasi')
    expect(byId.get('BS-08')).toMatchObject({ label: 'Bank Soalan (Studio)', to: '/admin/studio' })
  })

  it('never points a visible item at a placeholder route', () => {
    for (const item of ALL_ITEMS) expect(item.to, item.id).not.toContain('/admin/p/')
  })

  it('activates the longest matching item (drill pages stay on Langsung)', () => {
    expect(activeItem('/admin/command-center/school/3')?.id).toBe('PM-01')
    expect(activeItem('/admin/command-center/daily-activity')?.id).toBe('PM-02')
    // BS-02 now opens the batch list (V2 I1); the CSV import page falls back to the Bank Soalan entry.
    expect(activeItem('/admin/questions/import')?.id).toBe('BS-01')
    expect(activeItem('/admin/spm/soalan/manual')?.id).toBe('KS-16')
    expect(activeItem('/admin/spm/soalan/mat1-pub-1/sunting')?.id).toBe('KS-02')
  })
})

describe('Pentadbiran routing', () => {
  it('every item resolves to a real route (not the 404 catch-all)', () => {
    const router = createAppRouter({ history: createMemoryHistory() })
    // KS-01 `/admin/spm` (hub, C2 r1/hc-kandungan-hub) and BS-08 `/admin/studio` (Studio list, C3) are
    // built on other branches (REQ-A-004). Remove them from this set when those screens merge.
    const AWAITING_SCREEN = new Set(['KS-01', 'BS-08'])
    for (const item of ALL_ITEMS) {
      if (AWAITING_SCREEN.has(item.id)) continue
      const resolved = router.resolve(item.to)
      expect(resolved.matched.length, `${item.id} ${item.to}`).toBeGreaterThan(0)
      expect(String(resolved.name), `${item.id} ${item.to}`).not.toMatch(/not-found|404/i)
    }
  })

  it('the old placeholder URL redirects to the admin home', () => {
    const router = createAppRouter({ history: createMemoryHistory() })
    expect(router.resolve('/admin/p/pm-04').matched[0]?.redirect).toBe('/admin/command-center')
  })

  it('Admin Pusat gets the portal with the prototype scope off too (vitest runs with it off)', () => {
    const admin = { isLoggedIn: true, role: 'admin' as const }
    expect(resolveShell('admin', admin)).toBe('pentadbiran')
    expect(resolveShellForPath('bare', admin, '/admin/command-center')).toBe('pentadbiran')
    expect(resolveShellForPath('bare', admin, '/admin/command-center/school/3')).toBe('pentadbiran')
    expect(adminShellFor('teacher')).toBe('pembelajaran')
    expect(adminShellFor('school_admin')).toBe('pembelajaran')
    // Another bare page, or another role, keeps no shell.
    expect(resolveShellForPath('bare', admin, '/login')).toBeNull()
    const teacher = { isLoggedIn: true, role: 'teacher' as const }
    expect(resolveShellForPath('bare', teacher, '/admin/command-center')).toBeNull()
  })
})

describe('Pembelajaran menus (scope off, UAT build)', () => {
  // `${role} ${path}` pairs allowed to open the observed live 403-for-every-role page (M08 S21,
  // OQ-M08-01): only the teacher, whose matrix lists it with the scope on too (row 43). The student
  // entry is hidden (STUDENT_HIDDEN_IDS), so the student is not exempt.
  const LIVE_403_FOR_ALL: ReadonlySet<string> = new Set(['teacher /laporan-mingguan'])

  const routes = (entries: readonly NavEntry[]): string[] =>
    entries.flatMap((e) =>
      e.kind === 'item' ? [e.to] : e.kind === 'group' ? e.children.map((c) => c.to) : [],
    )

  it('every visible link of every v2 role resolves to a real route the role may open', () => {
    const router = createAppRouter({ history: createMemoryHistory() })
    // Every offender is collected so one run lists them all.
    const bad: string[] = []
    for (const role of ['student', 'teacher', 'school_admin'] as const) {
      // What PembelajaranLayout renders: sidebar, "Lagi" panel, tab bar and account links.
      const canOpen = routeRoleCheck(router, role)
      const all = [
        ...routes(sidebarEntries(role, canOpen)),
        ...routes(drawerEntries(role, canOpen)),
        ...pembelajaranTabs(role).map((t) => t.to),
        ...accountLinks(role).map((l) => l.to),
      ].filter((to) => to.startsWith('/'))
      expect(all.length, role).toBeGreaterThan(0)
      for (const to of new Set(all)) {
        const resolved = router.resolve(to)
        if (resolved.matched.length === 0 || /not-found|404/i.test(String(resolved.name))) {
          bad.push(`${role} ${to} (no route)`)
          continue
        }
        // The teacher's Laporan Mingguan: kept by fidelity, listed with the scope on as well.
        if (LIVE_403_FOR_ALL.has(`${role} ${to}`)) continue
        const refused = resolved.matched.some((r) => r.meta.roles && !r.meta.roles.includes(role))
        if (refused) bad.push(`${role} ${to} (role refused)`)
      }
    }
    expect(bad).toEqual([])
  })

  it('lists at least every item the scoped menu lists (nothing lost with the scope off)', () => {
    const router = createAppRouter({ history: createMemoryHistory() })
    const ids = (role: 'student' | 'teacher' | 'school_admin'): string[] =>
      sidebarEntries(role, routeRoleCheck(router, role)).flatMap((e) =>
        e.kind === 'item' ? [e.id] : e.kind === 'group' ? e.children.map((c) => c.id) : [],
      )
    for (const role of ['student', 'teacher', 'school_admin'] as const) {
      const off = new Set(ids(role))
      vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
      const on = ids(role)
      vi.unstubAllEnvs()
      for (const id of on) expect(off.has(id), `${role} ${id}`).toBe(true)
    }
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
