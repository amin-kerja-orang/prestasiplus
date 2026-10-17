import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { lookupFaName } from '@/components/icon'
import type { Role } from '@/stores/session-types'

import {
  USER_BOTTOM_NAV,
  USER_DRAWER_ACCOUNT,
  USER_NAV,
  bottomNavActive,
  drawerBadgeClass,
  isActivePath,
  navFor,
  type BottomNavLink,
  type NavEntry,
  type NavItem,
} from '../nav/user-nav'
import { OUT_OF_SCOPE_ROUTES, isOutOfScope } from '../nav/out-of-scope'
import { SHELL_ICON_FALLBACKS, shellIcon } from '../shared/shell-icons'

/** Full menu data (fidelity checks); the rendered menu hides out-of-scope items. */
const FULL = { includeOutOfScope: true } as const

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

function items(entries: readonly NavEntry[]): NavItem[] {
  return entries.flatMap((e) =>
    e.kind === 'item' ? [e] : e.kind === 'group' ? [...e.children] : [],
  )
}

function labels(entries: readonly NavEntry[]): string[] {
  return entries.map((e) => e.label)
}

const ALL_ITEMS = [...items(USER_NAV), ...USER_DRAWER_ACCOUNT]

// ---------------------------------------------------------------------------------------------
// Live inventory (build-plan F-19 acceptance: hrefs equal the live hrefs of the inventory)

interface InventoryElement {
  kind: string
  landmark?: string
  text?: string
  href?: string
  absHref?: string
  icon?: string
}

const inventoryPath = fileURLToPath(
  new URL('../../../docs/discovery/inventory/M05/SHU-user-shell.json', import.meta.url),
)
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8')) as {
  elements: InventoryElement[]
}

/** Menu links of the live sidebar and drawer (`nav` landmark; the bottom nav is separate). */
const liveMenuLinks = inventory.elements
  .filter((e) => e.kind === 'link' && e.landmark === 'nav' && e.absHref)
  .map((e) => ({
    href: new URL(e.absHref!).pathname,
    text: (e.text ?? '').trim(),
    icon: e.icon ?? '',
  }))

/** Live links the rebuild deliberately changes (approved DVs). */
const REPLACED_LIVE_HREFS: Record<string, string> = {
  '/settings': '/tetapan', // M01 DV-01 (drawer "Tetapan")
  '/guru/laporan-mingguan-kelas': '/laporan-mingguan', // L48: the built screen is M08 S21 (M11-T5 S8 not built)
}
/** Rebuild hrefs that differ from live on purpose. */
const CHANGED_HREFS = new Set([
  '/admin/hadiah/tebusan', // M15 DV-M15-04 ("Admin Tebusan", live /admin/hadiah)
])
/** Student-only entries: seen in the murid screenshots, not in the admin-identity capture. */
const STUDENT_ONLY_IDS = new Set(
  items(USER_NAV)
    .filter((i) => i.roles?.length === 1 && i.roles[0] === 'student')
    .map((i) => i.id),
)

describe('USER_NAV data', () => {
  it('has unique ids', () => {
    const ids = [
      ...USER_NAV.map((e) => e.id),
      ...USER_NAV.flatMap((e) => (e.kind === 'group' ? e.children.map((c) => c.id) : [])),
      ...USER_DRAWER_ACCOUNT.map((i) => i.id),
    ]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every icon resolves to a Lucide component', () => {
    const missing = [...ALL_ITEMS.map((i) => i.fa), ...USER_BOTTOM_NAV.map((b) => b.fa)]
      .concat(USER_NAV.flatMap((e) => (e.kind === 'group' ? [e.fa] : [])))
      .filter((fa) => shellIcon(fa) === null)
    expect(missing).toEqual([])
  })

  it('a shell icon fallback is never shadowed by a design-system row (else remove it)', () => {
    const shadowed = Object.keys(SHELL_ICON_FALLBACKS).filter((name) => lookupFaName(name))
    expect(shadowed).toEqual([])
  })

  it('every live sidebar/drawer link is in the menu (by href), except approved DV changes', () => {
    const menuHrefs = new Set(ALL_ITEMS.map((i) => i.to))
    const missing = liveMenuLinks
      .map((l) => REPLACED_LIVE_HREFS[l.href] ?? l.href)
      .filter((href) => !menuHrefs.has(href))
    // The capture has ~130 menu links (sidebar + drawer); guard against an empty read.
    expect(liveMenuLinks.length).toBeGreaterThan(100)
    // `/admin/hadiah` stays in the menu as "Urus Hadiah"; only "Admin Tebusan" moved (DV-M15-04).
    expect([...new Set(missing)]).toEqual([])
  })

  it('every live label appears with its live href (drawer label variants included)', () => {
    const byHref = new Map<string, NavItem[]>()
    for (const item of ALL_ITEMS) byHref.set(item.to, [...(byHref.get(item.to) ?? []), item])
    // Drawer copies whose live label differs from the sidebar label kept for the same href.
    const DRAWER_LABELS: Record<string, string> = {
      '/cikgu/rph': 'RPH',
      '/ppd/statistik-penggunaan': 'Statistik Penggunaan',
      '/jpn/ranking-kebangsaan': 'Ranking Kebangsaan',
      '/admin/hadiah': 'Admin Tebusan',
    }
    const mismatched = liveMenuLinks.filter((l) => {
      const href = REPLACED_LIVE_HREFS[l.href] ?? l.href
      const candidates = byHref.get(href) ?? []
      const ok = candidates.some((c) => l.text === c.label || l.text.startsWith(`${c.label} `))
      return (
        !ok && DRAWER_LABELS[href] !== l.text && !(l.href === '/settings' && l.text === 'Tetapan')
      )
    })
    expect(mismatched).toEqual([])
  })

  it('every admin-visible item comes from the capture (student-only items are separate)', () => {
    const liveHrefs = new Set(liveMenuLinks.map((l) => REPLACED_LIVE_HREFS[l.href] ?? l.href))
    const notLive = items(navFor('admin', 'sidebar', USER_NAV, FULL))
      .concat(items(navFor('admin', 'drawer')))
      .filter((i) => !liveHrefs.has(i.to) && !CHANGED_HREFS.has(i.to))
      .map((i) => i.to)
    expect(notLive).toEqual([])
    expect(STUDENT_ONLY_IDS.size).toBeGreaterThan(0)
  })

  it('bottom nav: Home, SPM, Game, Topik links, then Chat and Lagi buttons (live)', () => {
    expect(USER_BOTTOM_NAV.map((b) => b.label)).toEqual([
      'Home',
      'SPM',
      'Game',
      'Topik',
      'Chat',
      'Lagi',
    ])
    expect(USER_BOTTOM_NAV.filter((b) => b.kind === 'link').map((b) => b.to)).toEqual([
      '/dashboard',
      '/spm',
      '/permainan',
      '/topics',
    ])
  })

  it('drawer account section: Profil Saya, Tetapan → /tetapan (DV-01), Panduan, Log Keluar', () => {
    expect(USER_DRAWER_ACCOUNT.map((i) => [i.label, i.to])).toEqual([
      ['Profil Saya', '/profile'],
      ['Tetapan', '/tetapan'],
      ['Panduan', '/pusat-tuisyen/panduan'],
      ['Log Keluar', '/logout'],
    ])
  })
})

describe('navFor (role filter: hidden, not disabled)', () => {
  it('student: the live murid menu order at the top, no admin/teacher entries', () => {
    const menu = labels(navFor('student', 'sidebar', USER_NAV, FULL))
    expect(menu.slice(0, 13)).toEqual([
      'Dashboard',
      'Target SPM',
      'Misi Harian',
      'Remedial',
      'SPM',
      'SPM',
      'Headcount',
      'Prestasi',
      'Analitik Adaptif',
      'Analisa Item',
      'Kombo',
      'Laporan Mingguan',
      'Pusat AI',
    ])
    for (const hidden of [
      'Ke Admin Panel',
      'Portal Guru',
      'Amaran Awal',
      'Kelulusan Hadiah',
      'Pakej',
      'Urus Tiket',
      'Gambar Rajah',
      'Kehadiran Digital',
      '🛡️ Kawalan Kualiti',
      '🎯 AI Pintar (Guru)',
    ]) {
      expect(menu).not.toContain(hidden)
    }
    expect(menu).toContain('Heatmap Topik Lemah')
    expect(menu).toContain('Kedai Hadiah 🎁')
    expect(menu).toContain('Jemput Ibu Bapa')
    expect(menu.slice(-5)).toEqual([
      'Profil Saya',
      'Invois Saya',
      'Panduan',
      'Bantuan',
      'Tiket Bantuan',
    ])
  })

  it('admin sees every captured entry, including the admin-only ones', () => {
    const menu = labels(navFor('admin', 'sidebar', USER_NAV, FULL))
    for (const label of ['Ke Admin Panel', 'Portal Guru', 'Amaran Awal', 'Pakej', 'Urus Tiket']) {
      expect(menu).toContain(label)
    }
    expect(menu).not.toContain('Heatmap Topik Lemah')
  })

  it('teacher: the full live guru sidebar, in order (roles-matrix/guru)', () => {
    expect(labels(navFor('teacher', 'sidebar', USER_NAV, FULL))).toEqual([
      'Command Center',
      'HARIAN',
      'Dashboard Guru',
      'Headcount',
      'Misi Harian',
      'Soalan by Chapter',
      'Verify Soalan Struktur',
      'Verify Soalan MCQ',
      'Kelas Saya',
      'Pelajar Saya',
      'Kehadiran Digital',
      'PENGAJARAN',
      'Jadual Belajar',
      'Broadcast',
      'Kelas Live',
      'PENILAIAN',
      'Prestasi',
      'Laporan',
      'Amaran Awal',
      'ANALITIK',
      'Monitoring',
      'Kirkpatrick',
      'Analitik Adaptif',
      'Analisa Item',
      'Perbandingan Kelas',
      'Laporan Mingguan',
      'Pusat AI',
      '🤖 Cikgu Alesa AI',
      'Cikgu Alesa Chat',
      '✨ Visi & Pertandingan',
      'Sekolah Bersaing',
      'Tetapan Peribadi',
      '🤖 AI Pintar (Pelajar)',
      'Wellbeing Alerts',
      'Kamus AI',
      'Pendamping Motivasi',
      'Doa & Motivasi',
      '🎯 AI Pintar (Guru)',
      'Aktiviti Advisor',
      'Whiteboard → Quiz',
      'RPH (Cikgu Alesa)',
      'Semak Karangan (Cikgu Alesa)',
      'PBD (Cikgu Alesa)',
      'BANK SOALAN',
      'Sumbang Soalan',
      'Soalan & Rujukan',
      'Soalan Berstruktur',
      'Databank Soalan',
      'Set Soalan',
      'Audio KBAT',
      'Kertas Peperiksaan',
      'Penjana Peperiksaan',
      'AKTIVITI',
      'Liga Pertandingan',
      'Tournament',
      'Kombo',
      'Syiling & Ganjaran',
      'LAIN-LAIN',
      'Perutusan',
      'Video',
      'Sumbang Artikel',
      'Profil Saya',
      'Panduan',
      'Analisis Item',
      'Bantuan',
      'Tiket Bantuan',
      'Gambar Rajah',
    ])
    const kirk = navFor('teacher', 'sidebar', USER_NAV, FULL).find((e) => e.id === 't-kirkpatrick')
    expect(kirk?.kind === 'group' && kirk.children.map((c) => c.label)).toEqual([
      'Ringkasan',
      'T1: Reaksi',
      'T2: Pembelajaran',
      'T3: Tingkah Laku',
      'T4: Hasil',
      'Rantaian Impak',
      'Intervensi',
    ])
  })

  it('school_admin: the full live admin-sekolah sidebar, in order (roles-matrix/admin sekolah)', () => {
    expect(labels(navFor('school_admin', 'sidebar', USER_NAV, FULL))).toEqual([
      'Command Center',
      'Pusat AI',
      '🤖 Cikgu Alesa AI',
      'Cikgu Alesa Chat',
      '✨ Visi & Pertandingan',
      'Sekolah Bersaing',
      'Tetapan Peribadi',
      '🤖 AI Pintar (Pelajar)',
      'Wellbeing Alerts',
      'Kamus AI',
      'Pendamping Motivasi',
      'Doa & Motivasi',
      '🎯 AI Pintar (Guru)',
      'Aktiviti Advisor',
      'Whiteboard → Quiz',
      'RPH (Cikgu Alesa)',
      'Semak Karangan (Cikgu Alesa)',
      'PBD (Cikgu Alesa)',
      '🛡️ Kawalan Kualiti',
      'Semakan Nota Master',
      'Audit Log',
      'HARIAN',
      'Dashboard',
      'Senarai Pelajar',
      'Senarai Guru',
      'Kelas Sekolah',
      'PENGURUSAN',
      'Urus Pengguna',
      'Import Pelajar',
      'Aktiviti Guru',
      'Langganan',
      'Invois',
      'PENILAIAN',
      'Headcount',
      'Prestasi',
      'Amaran Awal',
      'Laporan Bulanan',
      'ANALITIK',
      'Monitoring',
      'Kirkpatrick',
      'Analitik Adaptif',
      'Statistik Penggunaan',
      'DSKP Heatmap',
      'Analisa Item',
      'Laporan Aktiviti',
      'AKADEMIK',
      'Soalan Berstruktur',
      'Kombo Harian',
      'Liga Pertandingan',
      'Tournament',
      'LAIN-LAIN',
      'Perutusan',
      'Video',
      'Profil Saya',
      'Panduan',
      'Bantuan',
      'Tiket Bantuan',
      'Gambar Rajah',
    ])
  })

  it('the same list renders on both surfaces, except the drawer account links (DV-SH-04)', () => {
    const sidebarOnly = new Set(
      items(USER_NAV)
        .filter((i) => i.surfaces?.length === 1 && i.surfaces[0] === 'sidebar')
        .map((i) => i.id),
    )
    // M04 FN-M04-6.2.3 / 6.2.4: "Kertas Soalan Guru" and "Gambar Rajah" are desktop-sidebar only; M05 FN-M05-9.1.4: so are "Target SPM", "Misi Harian" and "Remedial".
    expect(
      [...sidebarOnly].every(
        (id) =>
          /^(profil-saya|panduan|kertas-soalan-guru|gambar-rajah|target-spm|misi-harian|remedial)$/.test(
            id,
          ) || /profil-saya|panduan/.test(id),
      ),
    ).toBe(true)
    for (const role of ROLES) {
      const sidebar = navFor(role, 'sidebar').map((e) => e.id)
      const drawer = navFor(role, 'drawer').map((e) => e.id)
      expect(sidebar.filter((id) => !sidebarOnly.has(id))).toEqual(drawer)
    }
  })

  it('never leaves a heading without an item under it', () => {
    for (const role of ROLES) {
      const menu = navFor(role, 'drawer')
      menu.forEach((entry, index) => {
        if (entry.kind !== 'section' && entry.kind !== 'subheading') return
        const next = menu[index + 1]
        expect(next, `${role}: ${entry.id}`).toBeDefined()
        if (entry.kind === 'subheading') expect(['item', 'group']).toContain(next!.kind)
      })
    }
  })

  it('hides out-of-scope items from every rendered menu but keeps them as data', () => {
    expect(OUT_OF_SCOPE_ROUTES.length).toBeGreaterThan(40)
    const dataHrefs = new Set(ALL_ITEMS.map((i) => i.to))
    for (const r of OUT_OF_SCOPE_ROUTES) expect(dataHrefs.has(r.to), r.to).toBe(true)
    for (const role of ROLES.concat('admin')) {
      for (const surface of ['sidebar', 'drawer'] as const) {
        const rendered = items(navFor(role, surface))
        expect(rendered.filter((i) => isOutOfScope(i.to)).map((i) => i.to)).toEqual([])
      }
    }
    // The opt-out still returns them.
    expect(
      items(navFor('student', 'sidebar', USER_NAV, FULL)).some((i) => i.to === '/kombo'),
    ).toBe(true)
  })

  it('Release 1.0 items stay visible and none points at an out-of-scope path', () => {
    const teacher = items(navFor('teacher', 'sidebar')).map((i) => i.to)
    for (const to of [
      '/guru',
      '/guru/kelas',
      '/guru/pelajar',
      '/guru/laporan',
      '/laporan-mingguan',
      '/guru/soalan',
      '/guru/monitoring',
      '/guru/kirkpatrick',
    ]) {
      expect(teacher, to).toContain(to)
    }
    const school = items(navFor('school_admin', 'sidebar')).map((i) => i.to)
    for (const to of [
      '/admin-sekolah/pelajar',
      '/admin-sekolah/guru',
      '/admin-sekolah/kelas',
      '/amaran/sekolah',
      '/sekolah-bersaing',
    ]) {
      expect(school, to).toContain(to)
    }
  })

  it('shows nothing to a guest', () => {
    expect(navFor(null, 'sidebar')).toEqual([])
  })
})

describe('isActivePath', () => {
  it('honours the exclusion list (M05: Latih Tubi is not active on chapter / revision pages)', () => {
    const ex = ['/practice/chapter', '/practice/revision']
    expect(isActivePath('/practice', '/practice', ex)).toBe(true)
    expect(isActivePath('/practice/MATH/quiz', '/practice', ex)).toBe(true)
    expect(isActivePath('/practice/chapter/MATH', '/practice', ex)).toBe(false)
    expect(isActivePath('/practice/revision', '/practice', ex)).toBe(false)
    expect(isActivePath('/practice/chapter/MATH', '/practice/chapter', [])).toBe(true)
  })

  it('matches the path and its sub-paths only', () => {
    expect(isActivePath('/dashboard', '/dashboard')).toBe(true)
    expect(isActivePath('/spm/latih-tubi', '/spm')).toBe(true)
    expect(isActivePath('/spm-mock', '/spm')).toBe(false)
    expect(isActivePath('/topics/12', '/topics')).toBe(true)
    expect(isActivePath('/cikgu/rph', '/cikgu')).toBe(true)
    expect(isActivePath('/profile/', '/profile')).toBe(true)
    expect(isActivePath('/', '/dashboard')).toBe(false)
  })

  it('M27 FR-M27-02: the school admin "Dashboard" is active on exactly /admin-sekolah', () => {
    expect(isActivePath('/admin-sekolah', '/admin-sekolah')).toBe(true)
    expect(isActivePath('/admin-sekolah/', '/admin-sekolah')).toBe(true)
    expect(isActivePath('/admin-sekolah/monitoring', '/admin-sekolah')).toBe(false)
    expect(isActivePath('/admin-sekolah/pelajar', '/admin-sekolah')).toBe(false)
    // the other admin items stay active on their own path and sub-paths
    expect(isActivePath('/admin-sekolah/pelajar', '/admin-sekolah/pelajar')).toBe(true)
    expect(isActivePath('/admin-sekolah/pelajar/', '/admin-sekolah/pelajar')).toBe(true)
    expect(isActivePath('/admin-sekolah/pelajar/12', '/admin-sekolah/pelajar')).toBe(true)
    expect(isActivePath('/admin-sekolah/monitoring', '/admin-sekolah/pelajar')).toBe(false)
  })
})

describe('drawerBadgeClass', () => {
  it('turns 10px pills into 9px and leaves 8px pills', () => {
    expect(drawerBadgeClass('ml-auto text-[10px] font-bold')).toBe('ml-auto text-[9px] font-bold')
    expect(drawerBadgeClass('ml-auto text-[8px] font-bold')).toBe('ml-auto text-[8px] font-bold')
  })
})

describe('bottomNavActive: "Game" tab', () => {
  const link = (id: string) => USER_BOTTOM_NAV.find((b) => b.id === id) as BottomNavLink
  it('is active on the game pages', () => {
    for (const p of [
      '/permainan',
      '/permainan/roda-nasib',
      '/battle',
      '/battle/history',
      '/battle/leaderboard',
      '/papan-bijak',
      '/papan-bijak/ABC123',
      '/perang-fakta',
      '/teka-silang-kata/ABC123',
    ])
      expect(bottomNavActive(link('game'), p), p).toBe(true)
  })
  it('is not active elsewhere, and other tabs are unchanged', () => {
    for (const p of ['/dashboard', '/spm', '/topics', '/battle-x', '/permainanx'])
      expect(bottomNavActive(link('game'), p), p).toBe(false)
    expect(bottomNavActive(link('spm'), '/spm/latih-tubi')).toBe(true)
    expect(bottomNavActive(link('spm'), '/battle')).toBe(false)
  })
})
