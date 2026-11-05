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

const labelsOf = (key: string): string[] =>
  PENTADBIRAN_FULL_MENU.find((g) => g.key === key)?.items.map((i) => i.label) ?? []

describe('Pentadbiran menu data', () => {
  it('keeps the whole definition as data with unique ids', () => {
    expect(PENTADBIRAN_FULL_MENU.map((g) => g.key)).toEqual([
      'pintasan',
      'harian',
      'analitik',
      'kurikulum',
      'soalan',
      'pengguna',
      'spm',
      'premium',
      'kawalan-ciri',
      'gamifikasi',
      'battle-permainan',
      'marketplace',
      'kandungan',
      'sistem',
      'ditangguh',
    ])
    expect(new Set(FULL_ITEMS.map((i) => i.id)).size).toBe(FULL_ITEMS.length)
    // removed (KK-03, KS-10..12) or hidden/merged (KS-02, 06, 08, 09, 13..16, BS-04, BS-05) ids are gone
    const gone = ['KK-03', 'KS-10', 'KS-11', 'KS-12', 'KS-02', 'KS-06', 'KS-08', 'KS-09']
    for (const id of [...gone, 'KS-13', 'KS-14', 'KS-15', 'KS-16', 'BS-04', 'BS-05']) {
      expect(FULL_ITEMS.some((i) => i.id === id), id).toBe(false)
    }
  })

  it('renders built screens only, in the V2 group order, and drops empty groups', () => {
    expect(ALL_ITEMS.every((i) => i.built)).toBe(true)
    expect(ALL_ITEMS.length).toBe(FULL_ITEMS.filter((i) => i.built).length)
    expect(PENTADBIRAN_MENU.every((g) => g.items.length > 0)).toBe(true)
    expect(PENTADBIRAN_MENU.map((g) => g.label)).toEqual([
      'Pintasan',
      'Analitik',
      'Kurikulum',
      'Soalan',
      'Pengguna',
      'SPM',
      'Premium',
      'Kandungan',
      'Sistem',
    ])
    expect(PENTADBIRAN_MENU.map((g) => g.items.map((i) => i.label))).toEqual([
      ['Command Center', 'Aktiviti Harian', 'Audio KBAT'],
      [
        'Monitoring',
        'Overview',
        'T1: Reaksi',
        'T2: Pembelajaran',
        'T3: Tingkah Laku',
        'T4: Hasil',
        'Rantaian Impak',
        'Intervensi',
      ],
      ['Kurikulum', 'Subjek', 'Tahap Pendidikan'],
      [
        'SPM',
        'Bank Soalan (Studio)',
        'Import & Semakan',
        'Set Builder',
        'Audit Rajah',
        'Senarai Soalan',
        'Soalan Berstruktur',
      ],
      [
        'Senarai Pengguna',
        'Sekolah',
        'Langganan Sekolah',
        'Import Pelajar',
        'Pelajar Komplimen',
        'Import Pengguna',
      ],
      ['Databank Soalan'],
      ['PKSK Soalan', 'PKSK Akses'],
      ['Artikel', 'Banner', 'Nota', 'Upload Screenshot'],
      ['Tiket Bantuan'],
    ])
  })

  it('Soalan: 9 definitions in PRD order (30 §3.2), 7 rendered', () => {
    expect(labelsOf('soalan')).toEqual([
      'SPM',
      'Bank Soalan (Studio)',
      'Import & Semakan',
      'Set Builder',
      'Sumber Kertas',
      'Kertas Subjektif',
      'Audit Rajah',
      'Senarai Soalan',
      'Soalan Berstruktur',
    ])
    const soalan = PENTADBIRAN_MENU.find((g) => g.key === 'soalan')
    expect(soalan?.items).toHaveLength(7)
    // Sumber Kertas and Kertas Subjektif wait for their S3 cards
    expect(soalan?.items.map((i) => i.label)).not.toContain('Sumber Kertas')
    expect(soalan?.items.map((i) => i.label)).not.toContain('Kertas Subjektif')
    // the sub-group Bank Lama (Legasi) holds the last two
    const legacy = PENTADBIRAN_FULL_MENU.find((g) => g.key === 'soalan')?.items.filter((i) => i.nested)
    expect(legacy?.map((i) => [i.label, i.sub])).toEqual([
      ['Senarai Soalan', 'Bank Lama (Legasi)'],
      ['Soalan Berstruktur', 'Bank Lama (Legasi)'],
    ])
  })

  it('has no duplicate "Bank Soalan" label or group', () => {
    const labels = [...FULL_ITEMS.map((i) => i.label), ...PENTADBIRAN_FULL_MENU.map((g) => g.label)]
    expect(labels.filter((l) => l === 'Bank Soalan')).toEqual([])
    expect(labels.filter((l) => l.startsWith('Bank Soalan'))).toEqual(['Bank Soalan (Studio)'])
    // no two rendered items share a label inside the Soalan group, nor a route anywhere
    expect(new Set(ALL_ITEMS.map((i) => i.to)).size).toBe(ALL_ITEMS.length)
  })

  it('PRD 30 §3.4: labels, badge and routes', () => {
    const byId = new Map(ALL_ITEMS.map((i) => [i.id, i]))
    expect(byId.get('PM-01')).toMatchObject({
      label: 'Command Center',
      badge: 'LIVE',
      to: '/admin/command-center',
    })
    expect(ALL_ITEMS.filter((i) => i.badge).map((i) => i.id)).toEqual(['PM-01'])
    expect(byId.get('PM-03')).toMatchObject({ label: 'Monitoring', to: '/admin/monitoring' })
    expect(byId.get('PS-01')?.label).toBe('Senarai Pengguna')
    expect(byId.get('PS-05')).toMatchObject({ label: 'Import Pengguna', to: '/admin/users/bulk-import' })
    expect(byId.get('KW-06')?.label).toBe('PKSK Akses')
    expect(byId.get('KS-01')).toMatchObject({ label: 'SPM', to: '/admin/spm' })
    expect(byId.get('BS-08')).toMatchObject({ label: 'Bank Soalan (Studio)', to: '/admin/studio' })
    expect(byId.get('BS-01')).toMatchObject({ label: 'Senarai Soalan', to: '/admin/questions' })
    expect(byId.get('BS-09')).toMatchObject({ label: 'Audit Rajah', to: '/admin/soalan-gambar' })
    // unbuilt target routes stay out of the rendered menu (FR-ADM-H0.2)
    for (const id of ['PP-01', 'PP-02', 'PM-04', 'PM-29', 'PS-03', 'SY-01', 'SY-02', 'KK-08', 'BS-03', 'KS-07']) {
      expect(byId.has(id), id).toBe(false)
      expect(FULL_ITEMS.find((i) => i.id === id)?.built, id).toBe(false)
    }
  })

  it('REQ-B-039: Bank Soalan (Studio) opens the Studio list', () => {
    const bs08 = ALL_ITEMS.find((i) => i.id === 'BS-08')
    expect(bs08).toMatchObject({ label: 'Bank Soalan (Studio)', to: '/admin/studio' })
    const router = createAppRouter({ history: createMemoryHistory() })
    expect(router.resolve('/admin/studio').matched.length).toBeGreaterThan(0)
  })

  it('never renders a placeholder route', () => {
    for (const item of ALL_ITEMS) expect(item.to, item.id).not.toContain('/admin/p/')
    for (const g of PENTADBIRAN_MENU) for (const item of g.items) expect(item.built, item.id).toBe(true)
  })

  it('activates the longest matching item (drill pages stay on Command Center)', () => {
    expect(activeItem('/admin/command-center/school/3')?.id).toBe('PM-01')
    expect(activeItem('/admin/command-center/daily-activity')?.id).toBe('PM-02')
    // the CSV import page falls back to Senarai Soalan; Set Builder wins over Studio
    expect(activeItem('/admin/questions/import')?.id).toBe('BS-01')
    expect(activeItem('/admin/studio/sets')?.id).toBe('KS-17')
    expect(activeItem('/admin/studio')?.id).toBe('BS-08')
    expect(activeItem('/admin/spm/databank')?.id).toBe('KS-18')
    // hidden screens (routes stay) fall back to the SPM hub
    expect(activeItem('/admin/spm/soalan/mat1-pub-1/sunting')?.id).toBe('KS-01')
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

const PUPIL_PENDING_ROUTE_ACCESS: ReadonlySet<string> = new Set(['headcount', 'analisa-item'])

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
      for (const id of on) {
        // S0-T05 shows Headcount and Analisa Item to the pupil with the scope on; their m08 routes
        // still refuse the pupil, so the scope-off menu (route-role check) drops them until S10-T09.
        if (role === 'student' && PUPIL_PENDING_ROUTE_ACCESS.has(id)) continue
        expect(off.has(id), `${role} ${id}`).toBe(true)
      }
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
