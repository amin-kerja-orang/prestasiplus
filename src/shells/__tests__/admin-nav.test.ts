import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Role } from '@/stores/session-types'

import {
  TEACHER_BOTTOM_NAV,
  activeGroupKey,
  activeItemId,
  adminMenuFor,
  bottomNavActive,
  bottomNavFor,
  chromeFor,
  flatItems,
  lagiFor,
  type AdminBottomNavLink,
  type AdminNavGroup,
  type LagiEntry,
} from '../nav/admin-nav'
import { shellIcon } from '../shared/shell-icons'
import { USER_NAV, navFor } from '../nav/user-nav'

const teacherEntries = adminMenuFor('teacher')
const teacherItems = flatItems(teacherEntries)

const ROLES: readonly Role[] = [
  'student',
  'teacher',
  'parent',
  'sponsor',
  'school_admin',
  'ppd_officer',
  'jpn_officer',
  'admin',
]

// ---------------------------------------------------------------------------------------------

// ALESA AI surfaces are hidden unless VITE_ALESA_AI=on (D73): this file covers the "on" state;
// the "off" state is in src/app/__tests__/features.test.ts and the OFF cases of each module.
vi.hoisted(() => {
  vi.stubEnv('VITE_ALESA_AI', 'on')
})
// Re-applied per test: files that call `vi.unstubAllEnvs()` in their own afterEach drop it.
beforeEach(() => {
  vi.stubEnv('VITE_ALESA_AI', 'on')
})

describe('admin shell data', () => {
  it('every icon (teacher bottom nav and the popover glyphs) resolves to a Lucide component', () => {
    const fas = [
      ...TEACHER_BOTTOM_NAV.map((b) => b.fa),
      ...['fa-chevron-down', 'fa-sign-out-alt', 'fa-arrow-left', 'fa-microchip', 'fa-memory'],
      ...['fa-hard-drive', 'fa-clock'],
    ]
    expect(fas.filter((fa) => shellIcon(fa) === null)).toEqual([])
  })
})

describe('adminMenuFor / chromeFor: the menu per role', () => {
  it('teacher: the user-shell teacher menu, imported (not restated), "Portal Guru", no pill', () => {
    const source = navFor('teacher', 'sidebar')
    expect(teacherEntries.map((e) => e.id)).toEqual(source.map((e) => e.id))
    expect(teacherItems.map((i) => i.to)).toEqual(
      source.flatMap((e) =>
        e.kind === 'item' ? [e.to] : e.kind === 'group' ? e.children.map((c) => c.to) : [],
      ),
    )
    expect(chromeFor('teacher')).toEqual({
      caption: 'Portal Guru',
      home: '/guru',
      roleLabel: 'Guru',
      serverStatus: false,
    })
    expect(bottomNavFor('teacher')).toBe(TEACHER_BOTTOM_NAV)
    // The pinned card is the first entry and opens in a new tab.
    expect(teacherEntries[0]).toMatchObject({ label: 'Command Center', to: '/guru/command-center' })
  })

  it('teacher menu holds no admin-only item', () => {
    const labels = teacherItems.map((i) => i.label)
    for (const adminOnly of ['Ke Admin Panel', 'Ke Dashboard', 'Student View', 'Panel Pentadbir']) {
      expect(labels).not.toContain(adminOnly)
    }
    // No route under /admin except the open item "Gambar Rajah" (shells.md §7.2 item 4).
    expect(teacherItems.filter((i) => i.to.startsWith('/admin/')).map((i) => i.label)).toEqual([
      'Gambar Rajah',
    ])
  })

  it('the teacher Kirkpatrick group uses the shared "kirkpatrick" key and the teacher labels', () => {
    const group = teacherEntries.find((e): e is AdminNavGroup => e.kind === 'group')
    expect(group?.key).toBe('kirkpatrick')
    expect(group?.children.map((c) => c.label)).toEqual([
      'Ringkasan',
      'Tahap 1: Reaksi',
      'Tahap 2: Pembelajaran',
      'Tahap 3: Tingkah Laku',
      'Tahap 4: Hasil',
      'Rantaian Impak',
      'Intervensi',
    ])
  })

  it('other roles get their own user-shell menu; no role is ever shown another role’s items', () => {
    for (const role of ROLES) {
      const menu = adminMenuFor(role)
      expect(menu.map((e) => e.id)).toEqual(navFor(role, 'sidebar').map((e) => e.id))
    }
    expect(adminMenuFor(null)).toEqual([])
    expect(USER_NAV.length).toBeGreaterThan(0)
  })
})

describe('active item: single longest match (shells.md §2.8)', () => {
  const label = (path: string): string | null => {
    const id = activeItemId(teacherEntries, path)
    return teacherItems.find((i) => i.id === id)?.label ?? null
  }

  it('teacher menu: the same rule, Dashboard Guru and Ringkasan are exact', () => {
    expect(label('/guru')).toBe('Dashboard Guru')
    expect(label('/guru/monitoring')).toBe('Monitoring')
    expect(label('/guru/monitoring/sekolah/3')).toBe('Monitoring')
    expect(label('/guru/kirkpatrick')).toBe('Ringkasan')
    expect(label('/guru/kirkpatrick/results')).toBe('Tahap 4: Hasil')
    expect(label('/guru/kirkpatrick/pelajar/8')).toBeNull()
    expect(label('/guru/laporan')).toBe('Laporan')
    expect(label('/guru/laporan-mingguan-kelas')).toBe('Laporan Mingguan')
    expect(label('/guru/kelas/4')).toBe('Kelas Saya')
    expect(activeGroupKey(teacherEntries, '/guru/kirkpatrick/pelajar/8')).toBe('kirkpatrick')
    expect(activeGroupKey(teacherEntries, '/guru/monitoring')).toBeNull()
  })

  it('the query string and hash are ignored, and a longer sibling path does not match', () => {
    expect(label('/guru/laporan?page=2#top')).toBe('Laporan')
    expect(label('/guru/laporan-mingguan-kelas/3')).toBe('Laporan Mingguan')
  })
})

describe('bottom nav (shells.md §2.4, §2.6)', () => {
  const links = (cells: readonly { kind: string }[]): AdminBottomNavLink[] =>
    cells.filter((c): c is AdminBottomNavLink => c.kind === 'link')
  const activeOn = (cells: readonly AdminBottomNavLink[], path: string): string[] =>
    cells.filter((c) => bottomNavActive(c, path)).map((c) => c.label)

  it('teacher: Guru, Kelas, Monitoring, Kirkpatrick, Lagi', () => {
    expect(TEACHER_BOTTOM_NAV.map((b) => b.label)).toEqual([
      'Guru',
      'Kelas',
      'Monitoring',
      'Kirkpatrick',
      'Lagi',
    ])
    const cells = links(TEACHER_BOTTOM_NAV)
    expect(activeOn(cells, '/guru')).toEqual(['Guru'])
    expect(activeOn(cells, '/guru/kelas/2')).toEqual(['Kelas'])
    expect(activeOn(cells, '/guru/monitoring/sekolah/1')).toEqual(['Monitoring'])
    expect(activeOn(cells, '/guru/kirkpatrick/pelajar/3')).toEqual(['Kirkpatrick'])
    expect(activeOn(cells, '/guru/laporan')).toEqual([])
  })

  it('a role with no defined bottom nav gets only "Lagi"', () => {
    expect(bottomNavFor('parent').map((b) => b.id)).toEqual(['lagi'])
  })
})

describe('"Lagi" popover (shells.md §2.4, §2.7)', () => {
  const headings = (entries: readonly LagiEntry[]): string[] =>
    entries.flatMap((e) => (e.kind === 'heading' ? [e.label] : []))

  it('no menu is defined for a missing role', () => {
    expect(lagiFor(null)).toEqual({ entries: [], tail: [] })
  })

  it('teacher: the teacher menu minus Command Center and the bottom-nav entries, ends "Log Keluar"', () => {
    const teacher = lagiFor('teacher')
    const rows = teacher.entries.flatMap((e) => (e.kind === 'row' ? [e] : []))
    const labels = rows.map((r) => r.label)
    for (const excluded of [
      'Command Center',
      'Dashboard Guru',
      'Kelas Saya',
      'Monitoring',
      'Ringkasan',
      'Tahap 1: Reaksi',
    ]) {
      expect(labels).not.toContain(excluded)
    }
    for (const kept of [
      'Headcount',
      'Laporan',
      'Analitik Adaptif',
      'Cikgu Alesa Chat',
      'Panduan',
    ]) {
      expect(labels).toContain(kept)
    }
    // Same source as the sidebar: every sidebar item that is not excluded is a row.
    const expected = teacherItems.filter(
      (i) =>
        i.variant !== 'command' &&
        !['/guru', '/guru/kelas', '/guru/monitoring'].includes(i.to) &&
        !i.to.startsWith('/guru/kirkpatrick'),
    )
    expect(rows.map((r) => r.id)).toEqual(expected.map((i) => i.id))
    expect(headings(teacher.entries)).toContain('HARIAN')
    expect(headings(teacher.entries)).toContain('ANALITIK')
    expect(teacher.tail.map((r) => r.label)).toEqual(['Log Keluar'])
    // No heading is left without a row.
    teacher.entries.forEach((e, i) => {
      if (e.kind === 'heading') expect(teacher.entries[i + 1]?.kind).toBe('row')
    })
  })
})

describe('exact routes of the adopted user-shell menus', () => {
  // `user-nav.ts` (F-19) has no `exact` flag, so admin-nav.ts keeps a list of exact paths. This
  // walks every role's menu (not the student's: the router denies that role the admin shell) and fails when an item's path is a parent of another item's path and
  // is neither marked exact nor listed here as an intended prefix parent. (The longest match
  // already gives the child its own page; a parent stays active on the pages that have no item
  // of their own, which is the wanted behaviour only for the listed ones.)
  // M13 FN-1.1.4: /cikgu/* keeps "Cikgu Alesa Chat"; the school admin "Command Center" stays active on its drill-down pages (S4-S7),
  // "Aktiviti Harian" is excluded by `activeExcept` (DV-M17-54)
  const PREFIX_PARENTS = new Set(['/cikgu', '/admin-sekolah/command-center'])

  it.each(ROLES.filter((r) => r !== 'admin' && r !== 'student'))(
    '%s: every parent-path item is exact',
    (role) => {
      const list = flatItems(adminMenuFor(role))
      const norm = (p: string): string => p.replace(/\/+$/, '')
      const notExact = list.filter(
        (parent) =>
          !parent.exact &&
          !PREFIX_PARENTS.has(parent.to) &&
          parent.target !== '_blank' &&
          list.some(
            (other) => other !== parent && norm(other.to).startsWith(norm(parent.to) + '/'),
          ),
      )
      expect(notExact.map((i) => i.to)).toEqual([])
    },
  )
})
