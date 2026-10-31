import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Role } from '@/stores/session-types'

import {
  ADMIN_BOTTOM_NAV,
  ADMIN_FOOTER_LINKS,
  ADMIN_NAV,
  TEACHER_BOTTOM_NAV,
  activeGroupKey,
  activeItemId,
  adminMenuFor,
  bottomNavActive,
  bottomNavFor,
  chromeFor,
  flatItems,
  footerLinksFor,
  lagiFor,
  type AdminBottomNavLink,
  type AdminNavGroup,
  type AdminNavItem,
  type LagiEntry,
} from '../nav/admin-nav'
import { shellIcon } from '../shared/shell-icons'
import { USER_NAV, navFor } from '../nav/user-nav'

// ---------------------------------------------------------------------------------------------
// Live inventory (build-plan F-18 acceptance: every nav item's href equals the live href)

interface InventoryElement {
  kind: string
  landmark?: string
  text?: string
  href?: string
  absHref?: string
  icon?: string
  status?: string
}

const inventory = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('../../../docs/discovery/inventory/M01/SHA-admin-shell.json', import.meta.url),
    ),
    'utf8',
  ),
) as { elements: InventoryElement[] }

const pathOf = (e: InventoryElement): string => new URL(e.absHref ?? e.href ?? '').pathname
const clean = (text: string | undefined): string => (text ?? '').replace(/\s+/g, ' ').trim()

/** Sidebar links (desktop), in live order. `absHref` is absent on the logo link only. */
const liveSidebar = inventory.elements.filter(
  (e) => e.kind === 'link' && e.landmark === 'nav' && e.absHref && !e.status?.includes('mobile'),
)
/** The mobile bottom-nav landmark: the four cells, then the popover links. */
const liveBottom = inventory.elements.filter(
  (e) => e.kind === 'link' && e.landmark === 'nav.bottom-0' && e.absHref,
)

const items = flatItems(ADMIN_NAV)
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

describe('ADMIN_NAV data (shells.md §2.7)', () => {
  it('has unique ids and unique group keys', () => {
    const ids = [
      ...ADMIN_NAV.map((e) => e.id),
      ...ADMIN_NAV.flatMap((e) => (e.kind === 'group' ? e.children.map((c) => c.id) : [])),
      ...ADMIN_FOOTER_LINKS.map((i) => i.id),
    ]
    expect(new Set(ids).size).toBe(ids.length)
    const keys = ADMIN_NAV.flatMap((e) => (e.kind === 'group' ? [e.key] : []))
    expect(keys).toEqual([
      'kirkpatrick',
      'kurikulum',
      'soalan',
      'pengguna',
      'spm',
      'premium',
      'gamifikasi',
      'battle',
      'marketplace',
      'kandungan',
      'kewangan',
      'sistem',
    ])
  })

  it('every icon (items, groups, footer, bottom nav) resolves to a Lucide component', () => {
    const groups = ADMIN_NAV.filter((e): e is AdminNavGroup => e.kind === 'group')
    const fas = [
      ...items.map((i) => i.fa),
      ...groups.map((g) => g.fa),
      ...ADMIN_FOOTER_LINKS.map((i) => i.fa),
      ...ADMIN_BOTTOM_NAV.map((b) => b.fa),
      ...TEACHER_BOTTOM_NAV.map((b) => b.fa),
      ...['fa-chevron-down', 'fa-sign-out-alt', 'fa-arrow-left', 'fa-microchip', 'fa-memory'],
      ...['fa-hard-drive', 'fa-clock'],
    ]
    expect(fas.filter((fa) => shellIcon(fa) === null)).toEqual([])
  })

  it('section order and headings are the observed ones', () => {
    const sections = ADMIN_NAV.flatMap((e) => (e.kind === 'section' ? [e.label] : []))
    expect(sections).toEqual([
      'HARIAN',
      'ANALITIK',
      'PENGURUSAN',
      'SISTEM',
      '🏆 Bilik Duta',
      '🤖 Pusat AI',
      '✨ Visi & Pertandingan',
      '💎 Killer Features',
    ])
    const bilik = ADMIN_NAV.find((e) => e.id === 'sec-bilik-duta')
    expect(bilik?.kind === 'section' && bilik.badge?.text).toBe('DEV')
  })

  it('pinned block: Command Center (LIVE, new tab), Aktiviti Harian, Audio KBAT come first', () => {
    const [cc, ah, kbat] = ADMIN_NAV as readonly AdminNavItem[]
    expect([cc?.label, ah?.label, kbat?.label]).toEqual([
      'Command Center',
      'Aktiviti Harian',
      'Audio KBAT',
    ])
    expect(cc?.badge?.text).toBe('LIVE')
    expect(cc?.target).toBe('_blank')
    expect(ah?.target).toBe('_blank')
  })

  it('the sidebar links equal the live inventory links in order (label, href, icon)', () => {
    // The live sidebar text of the command card includes its LIVE pill.
    const live = liveSidebar
      // D9 deviation (SWEEP-23OCT): the live "Laporan Eksekutif" item is a dead link here (S8 not built).
      .filter((e) => e.icon !== 'fa-sign-out-alt' && pathOf(e) !== '/admin/laporan-eksekutif')
      .map((e) => ({
        // User decision 2026-10-31 (DV-M12-39): the Kirkpatrick levels read "Tahap N", not the live "TN".
        text: clean(e.text).replace(/ LIVE$/, '').replace(/^T([1-4]): /, 'Tahap $1: '),
        href: pathOf(e),
        icon: e.icon ?? '',
      }))
    const ours = [...items, ...ADMIN_FOOTER_LINKS].map((i) => ({
      text: i.label,
      href: i.to,
      icon: i.fa,
    }))
    expect(live.length).toBeGreaterThan(80)
    expect(ours).toEqual(live)
  })

  it('the bottom-nav cells and the "Lagi" links equal the live inventory (href, order)', () => {
    const lagi = lagiFor('admin')
    const liveCells = liveBottom.slice(0, 4).map((e) => ({ text: clean(e.text), href: pathOf(e) }))
    expect(
      ADMIN_BOTTOM_NAV.flatMap((b) => (b.kind === 'link' ? [{ text: b.label, href: b.to }] : [])),
    ).toEqual(liveCells)

    const livePopover = liveBottom.slice(4).map((e) => ({ text: clean(e.text), href: pathOf(e) }))
    const ours = [
      ...lagi.entries.flatMap((e) => (e.kind === 'row' ? [{ text: e.label, href: e.to }] : [])),
      ...lagi.tail.map((r) => ({ text: r.label, href: r.to })),
    ]
    expect(ours).toEqual(livePopover)
  })

  it('the four bottom-nav items are flagged and match the bottom nav', () => {
    const flagged = items.filter((i) => i.bottomNav).map((i) => i.to)
    const cells = ADMIN_BOTTOM_NAV.flatMap((b) => (b.kind === 'link' ? [b.to] : []))
    expect([...flagged].sort()).toEqual([...cells].sort())
  })
})

describe('adminMenuFor / chromeFor: the menu per role', () => {
  it('admin gets ADMIN_NAV with the footer links, the pill and "Panel Pentadbir"', () => {
    expect(adminMenuFor('admin')).toBe(ADMIN_NAV)
    expect(footerLinksFor('admin').map((i) => i.label)).toEqual([
      'Tetapan Peribadi',
      'Ke Dashboard',
    ])
    expect(chromeFor('admin')).toEqual({
      caption: 'Panel Pentadbir',
      home: '/admin',
      roleLabel: 'Admin',
      serverStatus: true,
    })
    expect(bottomNavFor('admin')).toBe(ADMIN_BOTTOM_NAV)
  })

  it('teacher: the user-shell teacher menu, imported (not restated), "Portal Guru", no pill', () => {
    const source = navFor('teacher', 'sidebar')
    expect(teacherEntries.map((e) => e.id)).toEqual(source.map((e) => e.id))
    expect(teacherItems.map((i) => i.to)).toEqual(
      source.flatMap((e) =>
        e.kind === 'item' ? [e.to] : e.kind === 'group' ? e.children.map((c) => c.to) : [],
      ),
    )
    expect(footerLinksFor('teacher')).toEqual([])
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
      if (role === 'admin') continue
      expect(menu.map((e) => e.id)).toEqual(navFor(role, 'sidebar').map((e) => e.id))
    }
    expect(adminMenuFor(null)).toEqual([])
    expect(USER_NAV.length).toBeGreaterThan(0)
  })
})

describe('active item: single longest match (shells.md §2.8)', () => {
  const activeLabel = (path: string): string | null => {
    const id = activeItemId(ADMIN_NAV, path, ADMIN_FOOTER_LINKS)
    return [...items, ...ADMIN_FOOTER_LINKS].find((i) => i.id === id)?.label ?? null
  }

  it('the route of every item activates that item and no other one', () => {
    for (const item of [...items, ...ADMIN_FOOTER_LINKS]) {
      if (item.target === '_blank' || item.id === 'ke-dashboard') continue
      expect(activeItemId(ADMIN_NAV, item.to, ADMIN_FOOTER_LINKS), item.label).toBe(item.id)
    }
  })

  it('a deeper route wins over its parent prefix', () => {
    expect(activeLabel('/admin/questions')).toBe('Senarai Soalan')
    expect(activeLabel('/admin/questions/import')).toBe('Import CSV')
    expect(activeLabel('/admin/questions/quality')).toBe('Kualiti Soalan')
    expect(activeLabel('/admin/questions/123/edit')).toBe('Senarai Soalan')
    expect(activeLabel('/admin/users/bulk-import')).toBe('Import Pengguna')
    expect(activeLabel('/admin/users/42')).toBe('Senarai Pengguna')
    expect(activeLabel('/admin/anak-angkat/permohonan')).toBe('Permohonan')
    expect(activeLabel('/battle/ranking-sekolah')).toBe('Ranking Sekolah')
    expect(activeLabel('/battle')).toBe('Battle Live')
    expect(activeLabel('/admin/gamification/tiers')).toBe('Tier Config')
  })

  it('/admin (Dashboard) is exact and does not match every /admin/* page', () => {
    expect(activeLabel('/admin')).toBe('Dashboard')
    expect(activeLabel('/admin/')).toBe('Dashboard')
    expect(activeLabel('/admin/unknown-page')).toBeNull()
  })

  it('matches at a "/" boundary only (Laporan vs a longer sibling path)', () => {
    expect(activeLabel('/admin/laporan')).toBe('Laporan')
    expect(activeLabel('/admin/laporan-eksekutif')).toBeNull()
    expect(activeLabel('/admin/laporan-eksekutif/sekolah/7')).toBeNull()
  })

  it('the /guru twins activate Monitoring and Kirkpatrick (FR-M11-05, FR-M12-04)', () => {
    expect(activeLabel('/admin/monitoring')).toBe('Monitoring')
    expect(activeLabel('/guru/monitoring')).toBe('Monitoring')
    expect(activeLabel('/guru/monitoring/sekolah/5/pelajar/9')).toBe('Monitoring')
    expect(activeLabel('/guru/kirkpatrick')).toBe('Overview')
    expect(activeLabel('/guru/kirkpatrick/reaction')).toBe('Tahap 1: Reaksi')
    expect(activeLabel('/admin/kirkpatrick/interventions')).toBe('Intervensi')
  })

  it('Kirkpatrick Overview is exact-only: no item on a pupil page, but the group opens', () => {
    expect(activeLabel('/guru/kirkpatrick/pelajar/12')).toBeNull()
    expect(activeGroupKey(ADMIN_NAV, '/guru/kirkpatrick/pelajar/12')).toBe('kirkpatrick')
    expect(activeGroupKey(ADMIN_NAV, '/admin/kirkpatrick/chain')).toBe('kirkpatrick')
  })

  it('the group of the active item is the group to open; top-level items open none', () => {
    expect(activeGroupKey(ADMIN_NAV, '/admin/questions/import')).toBe('soalan')
    expect(activeGroupKey(ADMIN_NAV, '/admin/schools')).toBe('pengguna')
    expect(activeGroupKey(ADMIN_NAV, '/admin/chatbot')).toBe('sistem')
    expect(activeGroupKey(ADMIN_NAV, '/spm/latih-tubi')).toBe('spm')
    expect(activeGroupKey(ADMIN_NAV, '/admin/analytics')).toBeNull()
    expect(activeGroupKey(ADMIN_NAV, '/admin')).toBeNull()
  })

  it('/tetapan activates the footer link "Tetapan Peribadi"; "Ke Dashboard" is never active', () => {
    expect(activeLabel('/tetapan')).toBe('Tetapan Peribadi')
    expect(activeLabel('/dashboard')).toBeNull()
  })

  it('Command Center and Aktiviti Harian (new tab) are never active', () => {
    expect(activeLabel('/admin/command-center')).toBeNull()
    expect(activeLabel('/admin/command-center/daily-activity')).toBeNull()
  })

  it('the query string and hash are ignored', () => {
    expect(activeLabel('/admin/users?page=2#top')).toBe('Senarai Pengguna')
  })

  it('teacher menu: the same rule, Dashboard Guru and Ringkasan are exact', () => {
    const label = (path: string): string | null => {
      const id = activeItemId(teacherEntries, path)
      return teacherItems.find((i) => i.id === id)?.label ?? null
    }
    expect(label('/guru')).toBe('Dashboard Guru')
    expect(label('/guru/monitoring')).toBe('Monitoring')
    expect(label('/guru/monitoring/sekolah/3')).toBe('Monitoring')
    expect(label('/guru/kirkpatrick')).toBe('Ringkasan')
    expect(label('/guru/kirkpatrick/results')).toBe('Tahap 4: Hasil')
    expect(label('/guru/kirkpatrick/pelajar/8')).toBeNull()
    expect(label('/guru/laporan')).toBe('Laporan')
    expect(label('/laporan-mingguan')).toBe('Laporan Mingguan')
    expect(label('/guru/kelas/4')).toBe('Kelas Saya')
    expect(activeGroupKey(teacherEntries, '/guru/kirkpatrick/pelajar/8')).toBe('kirkpatrick')
    expect(activeGroupKey(teacherEntries, '/guru/monitoring')).toBeNull()
  })
})

describe('bottom nav (shells.md §2.4, §2.6)', () => {
  const links = (cells: readonly { kind: string }[]): AdminBottomNavLink[] =>
    cells.filter((c): c is AdminBottomNavLink => c.kind === 'link')
  const activeOn = (cells: readonly AdminBottomNavLink[], path: string): string[] =>
    cells.filter((c) => bottomNavActive(c, path)).map((c) => c.label)

  it('admin: Dashboard, Soalan, Penaja, Pengguna, Lagi', () => {
    expect(ADMIN_BOTTOM_NAV.map((b) => b.label)).toEqual([
      'Dashboard',
      'Soalan',
      'Penaja',
      'Pengguna',
      'Lagi',
    ])
    expect(ADMIN_BOTTOM_NAV.at(-1)?.kind).toBe('button')
  })

  it('admin: one cell active at most; Dashboard is exact, the others match their subtree', () => {
    const cells = links(ADMIN_BOTTOM_NAV)
    expect(activeOn(cells, '/admin')).toEqual(['Dashboard'])
    expect(activeOn(cells, '/admin/questions/import')).toEqual(['Soalan'])
    expect(activeOn(cells, '/admin/sponsors')).toEqual(['Penaja'])
    expect(activeOn(cells, '/admin/users/bulk-import')).toEqual(['Pengguna'])
    expect(activeOn(cells, '/admin/schools')).toEqual([])
  })

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
  const admin = lagiFor('admin')
  const headings = (entries: readonly LagiEntry[]): string[] =>
    entries.flatMap((e) => (e.kind === 'heading' ? [e.label] : []))
  const rowsUnder = (heading: string | null): string[] => {
    const out: string[] = []
    let current: string | null = null
    for (const e of admin.entries) {
      if (e.kind === 'heading') current = e.label
      else if (current === heading) out.push(e.label)
    }
    return out
  }

  it('heading order is the observed one, and the first block has no heading', () => {
    expect(headings(admin.entries)).toEqual([
      'SPM',
      'Soalan',
      'Kurikulum',
      'Premium',
      'Gamifikasi',
      'Battle & Permainan',
      'Kandungan',
      'Marketplace',
      'Sistem',
    ])
    expect(rowsUnder(null)).toEqual(['Analitik', 'Laporan Aktiviti', 'Monitoring', 'Kirkpatrick'])
    expect(admin.entries[0]).toMatchObject({ kind: 'row', label: 'Analitik' })
  })

  it('rows under each heading follow the observed order and labels', () => {
    expect(rowsUnder('SPM')).toEqual(['Databank Soalan', 'Latih Tubi', 'Tracking A', 'Subjektif'])
    expect(rowsUnder('Soalan')).toEqual([
      'Import CSV',
      'Kualiti Soalan',
      'Laporan Soalan',
      'Soalan Berstruktur',
      'Kertas Soalan Guru',
    ])
    expect(rowsUnder('Kandungan')).toEqual([
      'Banner',
      'Artikel',
      'Nota',
      'Push Notifikasi',
      'Chatbot',
      'Upload Screenshot',
    ])
    expect(rowsUnder('Sistem')).toEqual([
      'Sekolah',
      'Langganan Sekolah',
      'Tetapan',
      'Pembayaran',
      'Billing Dashboard',
      'Dunning Log',
      'Log Audit',
      'Performance',
      'Import Pelajar',
      'Import Pengguna',
    ])
  })

  it('is a mobile subset: pinned, the bottom-nav pages and the sidebar-only blocks are absent', () => {
    const labels = admin.entries.flatMap((e) => (e.kind === 'row' ? [e.label] : []))
    for (const absent of [
      'Command Center',
      'Aktiviti Harian',
      'Audio KBAT',
      'Laporan Eksekutif',
      'Senarai Soalan',
      'Senarai Pengguna',
      'Penajaan',
      'Pelajar Komplimen',
      'Bilik Duta',
      'Kamus AI',
    ]) {
      expect(labels).not.toContain(absent)
    }
  })

  it('the Kirkpatrick row links to /admin/kirkpatrick and stands for the whole group', () => {
    const row = admin.entries.find((e) => e.kind === 'row' && e.label === 'Kirkpatrick')
    expect(row).toMatchObject({ to: '/admin/kirkpatrick', groupKey: 'kirkpatrick' })
  })

  it('ends with "Student View" and "Log Keluar"', () => {
    expect(admin.tail.map((r) => [r.label, r.to])).toEqual([
      ['Student View', '/dashboard'],
      ['Log Keluar', '/logout'],
    ])
  })

  it('every popover row is a link of the sidebar (same route), except the 4 bottom-nav pages', () => {
    const sidebar = new Set([...items.map((i) => i.to), '/admin/kirkpatrick'])
    const missing = admin.entries.flatMap((e) =>
      e.kind === 'row' && !sidebar.has(e.to) ? [e.label] : [],
    )
    expect(missing).toEqual([])
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
