import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isPathInScope } from '@/app/prototype-scope'
import type { Role } from '@/stores/session-types'

import { adminMenuFor, bottomNavFor, chromeFor, flatItems, lagiFor } from '../nav/admin-nav'
import {
  navFor,
  userBottomNavFor,
  userDrawerAccountFor,
  USER_NAV,
  type NavEntry,
  type NavItem,
} from '../nav/user-nav'

const PROTOTYPE = ['student', 'teacher', 'school_admin'] as const

beforeEach(() => {
  vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

function items(entries: readonly NavEntry[]): NavItem[] {
  return entries.flatMap((e) =>
    e.kind === 'item' ? [e] : e.kind === 'group' ? [...e.children] : [],
  )
}

/** Labels of the menu items and of the group headers (e.g. "Kirkpatrick"). */
const labels = (role: Role, surface: 'sidebar' | 'drawer' = 'sidebar'): string[] => {
  const entries = navFor(role, surface)
  return [
    ...items(entries).map((i) => i.label),
    ...entries.flatMap((e) => (e.kind === 'group' ? [e.label] : [])),
  ]
}

describe('navFor with the prototype scope on', () => {
  it('shows no item outside the role scope, on either surface', () => {
    for (const role of PROTOTYPE) {
      for (const surface of ['sidebar', 'drawer'] as const) {
        for (const item of items(navFor(role, surface))) {
          expect(isPathInScope(role, item.to), `${role} ${surface} ${item.label} ${item.to}`).toBe(
            true,
          )
        }
      }
    }
  })

  it('Murid keeps the matrix menu (37 + section A) and drops the rest', () => {
    const shown = labels('student')
    for (const label of ['Dashboard', 'Latih Tubi', 'Kedai Hadiah 🎁', 'Jemput Ibu Bapa', 'SPM']) {
      expect(shown).toContain(label)
    }
    // 37 matrix labels + the four section A links in the menu (Log Keluar is the footer control).
    expect(shown).toHaveLength(37 + 4)
    for (const label of [
      'Target SPM',
      'Misi Harian',
      'Kombo',
      'Invois Saya',
      'Cikgu Suara',
      'Liga Pertandingan',
      'Bilik Duta',
      'Laporan Soalan',
      'Cikgu Alesa Chat',
    ]) {
      expect(shown, label).not.toContain(label)
    }
    // Section A: Profil Saya, Tetapan Peribadi, Panduan, Tiket Bantuan.
    for (const label of ['Profil Saya', 'Tetapan Peribadi', 'Panduan', 'Tiket Bantuan']) {
      expect(shown.filter((l) => l === label), label).toHaveLength(1)
    }
  })

  it('Guru keeps the 15 matrix screens (Kirkpatrick with its sub-pages)', () => {
    const shown = labels('teacher')
    for (const label of [
      'Command Center',
      'Dashboard Guru',
      'Headcount',
      'Prestasi',
      'Analitik Adaptif',
      'Analisa Item',
      'Analisis Item',
      'Video',
      'Kelas Saya',
      'Soalan by Chapter',
      'Monitoring',
      'Kirkpatrick',
      'T1: Reaksi',
      'T4: Hasil',
      'Rantaian Impak',
      'Intervensi',
      'Pelajar Saya',
      'Laporan',
      'Laporan Mingguan',
      'Sumbang Soalan',
    ]) {
      expect(shown, label).toContain(label)
    }
    for (const label of ['Misi Harian', 'Broadcast', 'Databank Soalan', 'Liga Pertandingan']) {
      expect(shown, label).not.toContain(label)
    }
  })

  it('Admin Sekolah keeps the 18 matrix screens only', () => {
    const shown = labels('school_admin')
    for (const label of [
      'Command Center',
      'Dashboard',
      'Senarai Pelajar',
      'Senarai Guru',
      'Kelas Sekolah',
      'Headcount',
      'Prestasi',
      'Amaran Awal',
      'Laporan Bulanan',
      'Monitoring',
      'Kirkpatrick',
      'Analitik Adaptif',
      'Statistik Penggunaan',
      'DSKP Heatmap',
      'Analisa Item',
      'Laporan Aktiviti',
      'Video',
      'Sekolah Bersaing',
    ]) {
      expect(shown, label).toContain(label)
    }
    for (const label of [
      'Urus Pengguna',
      'Import Pelajar',
      'Aktiviti Guru',
      'Langganan',
      'Invois',
      'Perutusan',
      'Kombo Harian',
      'Liga Pertandingan',
      'Tournament',
      'Soalan Berstruktur',
      'Audit Log',
    ]) {
      expect(shown, label).not.toContain(label)
    }
  })

  it('moves "Tetapan Peribadi" next to "Profil Saya" instead of leaving it under Pusat AI', () => {
    for (const role of PROTOTYPE) {
      const flat = navFor(role, 'sidebar')
      const at = flat.findIndex((e) => e.kind === 'item' && e.label === 'Tetapan Peribadi')
      expect(at, role).toBeGreaterThan(0)
      const before = flat[at - 1]
      expect(before?.kind === 'item' && before.label === 'Profil Saya', role).toBe(true)
    }
  })

  it('leaves no heading without an item after it', () => {
    for (const role of PROTOTYPE) {
      const flat = navFor(role, 'sidebar')
      flat.forEach((e, i) => {
        if (e.kind === 'item' || e.kind === 'group') return
        // After a heading: only sub-headings may come before the first item (a section may
        // introduce its sub-headings), and never the next section or the end of the menu.
        const rest = flat.slice(i + 1)
        const firstItem = rest.findIndex((n) => n.kind === 'item' || n.kind === 'group')
        expect(firstItem, `${role} ${e.id}`).toBeGreaterThanOrEqual(0)
        expect(
          rest.slice(0, firstItem).every((n) => n.kind === 'subheading'),
          `${role} ${e.id}`,
        ).toBe(true)
      })
    }
  })

  it('shows nothing app-specific for roles outside the prototype but section A', () => {
    for (const role of ['admin', 'parent', 'sponsor', 'ppd_officer', 'jpn_officer'] as const) {
      const shown = labels(role)
      expect(shown).not.toContain('Latih Tubi')
      for (const item of items(navFor(role, 'sidebar'))) {
        expect(isPathInScope(role, item.to), `${role} ${item.label}`).toBe(true)
      }
    }
  })

  it('does nothing when the scope is off (full live menu)', () => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'off')
    expect(labels('student')).toContain('Target SPM')
    expect(navFor('student', 'sidebar', USER_NAV).length).toBeGreaterThan(80)
  })
})

describe('admin shell navigation with the prototype scope on', () => {
  it('adminMenuFor / lagiFor only list allowed routes', () => {
    for (const role of PROTOTYPE) {
      for (const entry of flatItems(adminMenuFor(role))) {
        expect(isPathInScope(role, entry.to), `${role} menu ${entry.label}`).toBe(true)
      }
      const lagi = lagiFor(role)
      for (const entry of [...lagi.entries, ...lagi.tail]) {
        if (entry.kind === 'row' && entry.to !== '') {
          expect(isPathInScope(role, entry.to), `${role} lagi ${entry.label}`).toBe(true)
        }
      }
    }
  })

  it('bottom nav and drawer account links stay inside the scope', () => {
    for (const role of PROTOTYPE) {
      for (const entry of bottomNavFor(role)) {
        if (entry.kind === 'link') expect(isPathInScope(role, entry.to), role).toBe(true)
      }
      for (const entry of userBottomNavFor(role)) {
        if (entry.kind === 'link') expect(isPathInScope(role, entry.to), role).toBe(true)
      }
      for (const link of userDrawerAccountFor(role)) {
        expect(isPathInScope(role, link.to), `${role} ${link.label}`).toBe(true)
      }
    }
    // The student keeps all four tabs and the three account links; a teacher has no student tabs.
    expect(userBottomNavFor('student').filter((e) => e.kind === 'link')).toHaveLength(4)
    expect(userDrawerAccountFor('student').map((l) => l.label)).toEqual([
      'Profil Saya',
      'Tetapan',
      'Panduan',
      'Log Keluar',
    ])
    expect(userBottomNavFor('teacher').filter((e) => e.kind === 'link')).toHaveLength(0)
  })

  it('the school admin home is /admin-sekolah, not /dashboard', () => {
    expect(chromeFor('school_admin').home).toBe('/admin-sekolah')
    expect(chromeFor('teacher').home).toBe('/guru')
  })
})
