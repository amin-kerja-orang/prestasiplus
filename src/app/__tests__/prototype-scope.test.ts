import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ACCOUNT_ITEMS,
  isPathAllowed,
  isPathInScope,
  isPrototypeRole,
  isPrototypeScopeOn,
  moduleItemsFor,
  normalisePath,
  SCHOOL_ADMIN_ITEMS,
  scopeHomePath,
  scopeItemsFor,
  shellHomePath,
  STUDENT_ITEMS,
  TEACHER_ITEMS,
} from '../prototype-scope'

afterEach(() => {
  vi.unstubAllEnvs()
})

/** Matrix rows (docs/requirements/role-access-matrix.md, table B) allowed for each role. */
const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)
const MATRIX_ROWS = {
  student: [...range(2, 9), ...range(12, 40)],
  teacher: [...range(1, 11), ...range(41, 44)],
  school_admin: [...range(1, 7), 10, 11, ...range(45, 53)],
} as const

describe('matrix counts (role-access-matrix.md)', () => {
  it('Murid has 37 module items, Guru 15, Admin Sekolah 18', () => {
    expect(STUDENT_ITEMS).toHaveLength(37)
    expect(TEACHER_ITEMS).toHaveLength(15)
    expect(SCHOOL_ADMIN_ITEMS).toHaveLength(18)
  })

  it('maps exactly the matrix rows of each role, once each', () => {
    for (const role of ['student', 'teacher', 'school_admin'] as const) {
      const nos = moduleItemsFor(role).map((i) => i.no)
      expect([...nos].sort((a, b) => Number(a) - Number(b))).toEqual(MATRIX_ROWS[role])
      expect(new Set(nos).size).toBe(nos.length)
    }
  })

  it('every item has a label and at least one route rule', () => {
    for (const role of ['student', 'teacher', 'school_admin'] as const) {
      for (const item of moduleItemsFor(role)) {
        expect(item.label.length).toBeGreaterThan(0)
        expect(item.rules.length).toBeGreaterThan(0)
      }
    }
  })

  it('section A has the five account items for every prototype role', () => {
    expect(ACCOUNT_ITEMS.map((i) => i.label)).toEqual([
      'Profil Saya',
      'Tetapan Peribadi',
      'Panduan',
      'Tiket Bantuan',
      'Log Keluar',
    ])
    expect(scopeItemsFor('student')).toHaveLength(37 + 5)
    expect(scopeItemsFor('teacher')).toHaveLength(15 + 5)
    expect(scopeItemsFor('school_admin')).toHaveLength(18 + 5)
    expect(scopeItemsFor('admin')).toHaveLength(1 + 5)
    expect(scopeItemsFor('parent')).toHaveLength(0)
  })
})

describe('isPathInScope', () => {
  it('lets every prototype role use section A and the auth pages', () => {
    for (const role of ['student', 'teacher', 'school_admin'] as const) {
      for (const path of [
        '/profile',
        '/profile/edit',
        '/tetapan',
        '/panduan',
        '/pusat-tuisyen/panduan',
        '/pusat-tuisyen/tiket',
        '/logout',
        '/login',
        '/__ds',
      ]) {
        expect(isPathInScope(role, path), `${role} ${path}`).toBe(true)
      }
    }
  })

  it('Murid: allows matrix screens and their children, not the rest', () => {
    for (const path of [
      '/dashboard',
      '/practice',
      '/practice/chapter/BM/3/quiz',
      '/spm/ramalan',
      '/gamification/rewards',
      '/cikgu/hadiah/saya',
      '/permainan/betul-salah',
      '/papan-bijak/ABC123',
      '/topics/12',
      '/remedial/12',
      '/marketplace/some-product',
      '/ibu-bapa/terima/tok',
    ]) {
      expect(isPathInScope('student', path), path).toBe(true)
    }
    for (const path of [
      '/misi-harian',
      '/target-spm',
      '/kombo',
      '/pricing',
      '/billing/invoices',
      '/bilik-duta',
      '/sekolah-bersaing',
      '/laporan-soalan',
      '/admin',
      '/guru',
      '/notifikasi',
      '/gamification/unknown',
    ]) {
      expect(isPathInScope('student', path), path).toBe(false)
    }
  })

  it('Guru: only the 15 screens and their children', () => {
    for (const path of [
      '/guru',
      '/guru/command-center/classroom/3',
      '/guru/remedial-progress',
      '/remedial/12',
      // Side effect of the `/remedial` prefix (DV-M10-50): the student list is reachable, unlinked;
      // the API answers the teacher's own (empty) list.
      '/remedial/saya',
      '/guru/kelas/cipta',
      '/guru/kirkpatrick/reaction',
      '/guru/kirkpatrick/pelajar/5',
      '/guru/soalan/cipta',
      '/guru/analisis-item',
      '/guru/laporan-mingguan-kelas',
      '/headcount/12/summary',
      '/prestasi/kelas',
      '/practice/chapter',
      '/analisa-item/kelas',
    ]) {
      expect(isPathInScope('teacher', path), path).toBe(true)
    }
    for (const path of [
      '/dashboard',
      '/guru/misi-harian',
      '/guru/soalan-guru',
      '/guru/databank',
      '/guru/laporan-mingguan',
      '/practice',
      '/practice/revision',
      '/amaran',
      '/liga',
      '/cikgu/rph',
      '/gamification',
    ]) {
      expect(isPathInScope('teacher', path), path).toBe(false)
    }
  })

  it('Admin Sekolah: the dashboard is exact, only matrix sub-pages are allowed', () => {
    for (const path of [
      '/admin-sekolah',
      '/admin-sekolah/command-center/daily-activity',
      '/admin-sekolah/pelajar/baru',
      '/admin-sekolah/guru/7',
      '/admin-sekolah/kirkpatrick',
      '/admin-sekolah/monitoring/sekolah/1',
      '/amaran/sekolah',
      '/amaran/ringkasan-eksekutif',
      '/amaran/keberkesanan',
      '/sekolah-bersaing',
      '/headcount',
      '/prestasi/sekolah',
      '/analitik/pelajar',
    ]) {
      expect(isPathInScope('school_admin', path), path).toBe(true)
    }
    for (const path of [
      '/admin-sekolah/pengguna',
      '/admin-sekolah/import-pelajar',
      '/admin-sekolah/langganan',
      '/admin-sekolah/invois',
      '/admin-sekolah/aktiviti-guru',
      '/amaran/intervensi/5',
      '/perutusan',
      '/dashboard',
      '/liga',
    ]) {
      expect(isPathInScope('school_admin', path), path).toBe(false)
    }
  })

  it('roles outside the prototype only keep section A and the public pages', () => {
    for (const role of ['ppd_officer', 'jpn_officer', 'parent', 'sponsor'] as const) {
      expect(isPrototypeRole(role)).toBe(false)
      expect(isPathInScope(role, '/profile')).toBe(true)
      expect(isPathInScope(role, '/pusat-tuisyen/tiket')).toBe(true)
      expect(isPathInScope(role, '/admin')).toBe(false)
      expect(isPathInScope(role, '/ppd')).toBe(false)
      expect(isPathInScope(role, '/dashboard')).toBe(false)
    }
  })

  it('a guest only sees the auth pages, the public content and section A links', () => {
    expect(isPathInScope(null, '/login')).toBe(true)
    expect(isPathInScope(null, '/register')).toBe(true)
    expect(isPathInScope(null, '/password/reset/abc')).toBe(true)
    expect(isPathInScope(null, '/video/3')).toBe(true)
    expect(isPathInScope(null, '/artikel/some-slug')).toBe(true)
    expect(isPathInScope(null, '/sponsor/register')).toBe(false)
    expect(isPathInScope(null, '/pelajar/5')).toBe(false)
  })

  it('does not match on a bare string prefix', () => {
    expect(isPathInScope('student', '/spm-mock')).toBe(false)
    expect(isPathInScope('student', '/spmx')).toBe(false)
    expect(isPathInScope('teacher', '/guru/laporan-mingguan')).toBe(false)
  })

  it('ignores the query string, the hash and a trailing slash', () => {
    expect(normalisePath('/practice/?a=1#x')).toBe('/practice')
    expect(normalisePath('/')).toBe('/')
    expect(isPathInScope('student', '/practice/?a=1')).toBe(true)
  })
})

describe('the VITE_PROTOTYPE_SCOPE switch', () => {
  it('is off in the unit-test environment (existing admin/PPD/parent tests rely on it)', () => {
    expect(isPrototypeScopeOn()).toBe(false)
    expect(isPathAllowed('student', '/admin/users')).toBe(true)
  })

  it('is ON by default and ON for any value except "off"', () => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', '')
    expect(isPrototypeScopeOn()).toBe(true)
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
    expect(isPrototypeScopeOn()).toBe(true)
    expect(isPathAllowed('student', '/admin/users')).toBe(false)
    expect(isPathAllowed('student', '/dashboard')).toBe(true)
  })
})

describe('home paths', () => {
  it('scopeHomePath points at the role dashboard', () => {
    expect(scopeHomePath('student')).toBe('/dashboard')
    expect(scopeHomePath('teacher')).toBe('/guru')
    expect(scopeHomePath('school_admin')).toBe('/admin-sekolah')
    expect(scopeHomePath(null)).toBe('/login')
    // A role outside the prototype signs out (no dashboard to return to, no /login loop).
    expect(scopeHomePath('admin')).toBe('/admin/command-center')
    expect(scopeHomePath('parent')).toBe('/logout')
  })

  it('shellHomePath keeps /dashboard when the scope is off', () => {
    expect(shellHomePath('school_admin')).toBe('/dashboard')
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
    expect(shellHomePath('school_admin')).toBe('/admin-sekolah')
    expect(shellHomePath('teacher')).toBe('/guru')
    expect(shellHomePath('student')).toBe('/dashboard')
  })
})

describe('Admin Pusat in the prototype (D48)', () => {
  it('allows every admin route', () => {
    expect(isPrototypeRole('admin')).toBe(true)
    for (const path of ['/admin', '/admin/users', '/admin/schools/3/edit', '/admin/bijak-spm']) {
      expect(isPathInScope('admin', path), path).toBe(true)
    }
    for (const path of ['/spm/tahun-lepas', '/ppd/dashboard']) {
      expect(isPathInScope('admin', path), path).toBe(true)
    }
  })
})
