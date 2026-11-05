/**
 * Prototype scope (TRACKER D43): the demo shows ONLY the screens listed in
 * `docs/requirements/role-access-matrix.md` (section A for every role, section B per role) plus
 * the child and detail routes reachable from those screens and the auth/public pages.
 *
 * ONE source for the menus (sidebar, drawer, bottom nav, "Lagi"), the route guard, the mock
 * login and the in-page links. Everything else (Admin Pusat, PPD/JPN, Ibu Bapa, Penaja and any
 * menu or route not in the matrix) is hidden, and a typed URL answers the standard 404 page.
 *
 * The scope is ON in every mode (dev, demo, artifact). The only switch is
 * `VITE_PROTOTYPE_SCOPE=off` (set for the e2e build and for Vitest, so the admin/PPD/parent
 * regression specs and tests keep working, and for UAT so every module and role is reachable). The
 * switch only hides routes, menus and roles: which shell frames a page never depends on it
 * (`src/app/router/layouts.ts`).
 *
 * Sector markers: rows of the matrix lists are grouped by owning sector with `// [S<n> begin]` /
 * `// [S<n> end]` comments (R1 plan section 2); each sector edits only its own rows. A path that
 * several sectors share (e.g. `/analitik`) sits in the row of its primary owner. Row order has no
 * effect (`isPathInScope` uses `some`), but menus read the lists in order, so rows are not reordered.
 *
 * Mapping to the live rows: `docs/ROLES-MATRIX-LINES.md` (L01-L59). Each `MatrixItem.no` is the
 * matrix row number of section B; section A items are `A1`-`A5`.
 */

import type { Role } from '@/stores/session-types'

export const SCOPE_SWITCH_ENV = 'VITE_PROTOTYPE_SCOPE'

/** Whether the prototype scope applies. ON unless `VITE_PROTOTYPE_SCOPE=off`. Read at call time. */
export function isPrototypeScopeOn(): boolean {
  return import.meta.env.VITE_PROTOTYPE_SCOPE !== 'off'
}

/**
 * The roles that exist in the prototype (the demo accounts of these roles can log in). `admin`
 * (Admin Pusat, Portal Pentadbiran) is in scope since the 2026-10-17 decision (TRACKER D48) so the
 * system can be monitored: it gets every `/admin/**` route. Parent, sponsor, PPD and JPN stay out.
 */
export const PROTOTYPE_ROLES = ['student', 'teacher', 'school_admin', 'admin'] as const
export type PrototypeRole = (typeof PROTOTYPE_ROLES)[number]

export function isPrototypeRole(role: Role | null): role is PrototypeRole {
  return role !== null && (PROTOTYPE_ROLES as readonly string[]).includes(role)
}

/** Login refusal shown for an account whose role is outside the prototype (BM). */
export const MSG_ROLE_OUT_OF_SCOPE = 'Peranan ini belum menggunakan sistem ini.'
export const ROLE_OUT_OF_SCOPE_CODE = 'ROLE_OUT_OF_SCOPE'

/** A path rule: the path itself and everything below it, or the path alone (`exact`). */
export interface PathRule {
  path: string
  exact?: boolean
}

export interface MatrixItem {
  /** Matrix row of section B (1-53), or `A1`-`A5` for section A. */
  no: number | `A${number}`
  /** Exact BM menu label. */
  label: string
  /** The route(s) of the menu item, with the child and detail routes reachable from it. */
  rules: readonly PathRule[]
}

const p = (path: string, exact = false): PathRule => ({ path, ...(exact ? { exact: true } : {}) })
const item = (no: MatrixItem['no'], label: string, ...rules: PathRule[]): MatrixItem => ({
  no,
  label,
  rules,
})

/** Section A: available to every prototype role (D-RAM-3). */
export const ACCOUNT_ITEMS: readonly MatrixItem[] = [
  // [S5 begin]
  item('A1', 'Profil Saya', p('/profile'), p('/guru/profil')),
  item('A2', 'Tetapan Peribadi', p('/tetapan')),
  item('A3', 'Panduan', p('/panduan'), p('/pusat-tuisyen/panduan')),
  // [S5 end]
  // [S7 begin]
  item('A4', 'Tiket Bantuan', p('/pusat-tuisyen/tiket')),
  // [S7 end]
  // [S0 begin]
  item('A5', 'Log Keluar', p('/logout')),
  // [S0 end]
]

/** Auth and public pages: reachable by everyone, logged in or not. */
export const COMMON_RULES: readonly PathRule[] = [
  p('/', true),
  p('/login'),
  p('/register'),
  p('/password'),
  p('/403'),
  p('/404'),
  // The design-system approval surface stays reachable in every mode.
  p('/__ds'),
]

/**
 * Public content pages a guest may open (Video is in all three roles' matrix; Artikel is public
 * on live). Murid-only Artikel is still limited per role once logged in.
 */
const GUEST_RULES: readonly PathRule[] = [p('/video'), p('/artikel'), p('/ibu-bapa/terima')]

// ---------------------------------------------------------------------------------------------
// Section B per role

/** Murid: 37 module items (rows 2-9 and 12-40). */
export const STUDENT_ITEMS: readonly MatrixItem[] = [
  // [S5 begin]
  item(2, 'Dashboard', p('/dashboard', true)),
  // [S5 end]
  // [S10 begin]
  item(3, 'Headcount', p('/headcount')),
  item(4, 'Prestasi', p('/prestasi')),
  item(5, 'Analitik Adaptif', p('/analitik')),
  item(6, 'Analisa Item', p('/analisa-item')),
  // [S10 end]
  // [S5 begin]
  item(7, 'Video', p('/video')),
  item(8, 'Kelas Saya', p('/kelas-saya')),
  item(9, 'Soalan by Chapter', p('/practice/chapter')),
  item(12, 'Remedial', p('/remedial')),
  // [S5 end]
  // [S3 begin]
  // /simulasi: Simulasi - Kuiz (V2 path), linked from Bijak SPM under /spm.
  item(13, 'SPM', p('/spm'), p('/simulasi')),
  // [S3 end]
  // [S10 begin]
  item(14, 'Heatmap Topik Lemah', p('/buku-nota/heatmap')),
  // [S10 end]
  // [S7 begin]
  item(15, 'Mohon Keluarga Angkat', p('/mohon-keluarga-angkat')),
  // [S7 end]
  // [S5 begin]
  item(16, 'Latih Tubi', p('/practice')),
  item(17, 'Soalan Berstruktur', p('/latihan-berstruktur')),
  // [S5 end]
  // [S10 begin]
  item(18, 'Kedudukan', p('/ranking')),
  // [S10 end]
  // [S5 begin]
  item(19, 'PKSK', p('/pksk')),
  item(20, 'Artikel', p('/artikel')),
  // [S5 end]
  // [S7 begin]
  item(
    21,
    'Permainan',
    p('/permainan'),
    // The game family reached from the Permainan hub (lobbies, rooms, Battle Arena, Papan Bijak).
    p('/battle'),
    p('/papan-bijak'),
    p('/perang-fakta'),
    p('/benteng-ilmu'),
    p('/perlumbaan-matematik'),
    p('/kuiz-relay'),
    p('/teka-silang-kata'),
  ),
  item(22, 'Cabutan Bertuah', p('/cabutan')),
  item(23, 'Tournament', p('/tournament')),
  // [S7 end]
  // [S5 begin]
  item(24, 'Topik', p('/topics')),
  item(25, 'Peta Belajar', p('/peta-belajar')),
  item(26, 'Set Soalan Guru', p('/set-soalan-saya')),
  item(27, 'Audio KBAT', p('/audio-kbat')),
  // [S5 end]
  // [S7 begin]
  item(28, 'Syiling & Token', p('/gamification', true), p('/gamification/history')),
  item(29, 'Tukar Token', p('/gamification/convert')),
  item(30, 'Cabaran Harian', p('/gamification/challenges')),
  item(31, 'Kedai Hadiah', p('/gamification/rewards')),
  item(32, 'Marketplace', p('/marketplace')),
  item(33, 'Papan Pendahulu', p('/gamification/leaderboard'), p('/leaderboard')),
  item(34, 'Pencapaian', p('/gamification/achievements')),
  item(35, 'Kotak Misteri', p('/gamification/mystery-box')),
  item(36, 'Rujuk Kawan', p('/gamification/referral'), p('/gamification/kad-kongsi')),
  // [S7 end]
  // [S0 begin]
  item(37, 'Cikgu Alesa', p('/cikgu')),
  // [S0 end]
  // [S7 begin]
  item(38, 'Kedai Hadiah 🎁 (DIGITAL)', p('/cikgu/hadiah')),
  // [S7 end]
  // [S10 begin]
  item(39, 'Timeline Saya', p('/timeline')),
  // [S10 end]
  // [S6 begin]
  item(40, 'Jemput Ibu Bapa', p('/jemput-ibu-bapa'), p('/ibu-bapa/terima')),
  // [S6 end]
]

/** Guru: 15 module items (rows 1-11 and 41-44). */
export const TEACHER_ITEMS: readonly MatrixItem[] = [
  // [S6 begin]
  item(1, 'Command Center', p('/guru/command-center'), p('/guru/remedial-progress')),
  item(2, 'Dashboard Guru', p('/guru', true)),
  // [S6 end]
  // [S10 begin]
  item(3, 'Headcount', p('/headcount')),
  item(4, 'Prestasi', p('/prestasi')),
  item(5, 'Analitik Adaptif', p('/analitik')),
  item(6, 'Analisa Item', p('/analisa-item'), p('/guru/analisis-item')),
  // [S10 end]
  // [S5 begin]
  item(7, 'Video', p('/video')),
  // [S5 end]
  // [S6 begin]
  item(8, 'Kelas Saya', p('/guru/kelas')),
  // [S6 end]
  // [S5 begin]
  item(9, 'Soalan by Chapter', p('/practice/chapter')),
  // [S5 end]
  // [S6 begin]
  item(10, 'Monitoring', p('/guru/monitoring')),
  item(11, 'Kirkpatrick', p('/guru/kirkpatrick')),
  item(41, 'Pelajar Saya', p('/guru/pelajar')),
  item(42, 'Laporan', p('/guru/laporan')),
  item(43, 'Laporan Mingguan', p('/guru/laporan-mingguan-kelas'), p('/laporan-mingguan')),
  item(44, 'Sumbang Soalan', p('/guru/soalan'), p('/guru/databank')),
  // [S6 end]
]

/** Admin Sekolah: 18 module items (rows 1-7, 10, 11 and 45-53). */
export const SCHOOL_ADMIN_ITEMS: readonly MatrixItem[] = [
  // [S6 begin]
  item(1, 'Command Center', p('/admin-sekolah/command-center')),
  item(2, 'Dashboard', p('/admin-sekolah', true)),
  // [S6 end]
  // [S10 begin]
  item(3, 'Headcount', p('/headcount')),
  item(4, 'Prestasi', p('/prestasi')),
  item(5, 'Analitik Adaptif', p('/analitik')),
  item(6, 'Analisa Item', p('/analisa-item')),
  // [S10 end]
  // [S5 begin]
  item(7, 'Video', p('/video')),
  // [S5 end]
  // [S6 begin]
  item(10, 'Monitoring', p('/admin-sekolah/monitoring')),
  item(11, 'Kirkpatrick', p('/admin-sekolah/kirkpatrick')),
  // [S6 end]
  // [S7 begin]
  item(45, 'Sekolah Bersaing', p('/sekolah-bersaing')),
  // [S7 end]
  // [S6 begin]
  item(46, 'Statistik Penggunaan', p('/admin-sekolah/statistik-penggunaan')),
  item(47, 'DSKP Heatmap', p('/admin-sekolah/dskp-heatmap')),
  item(48, 'Laporan Aktiviti', p('/admin-sekolah/laporan-aktiviti')),
  item(
    49,
    'Amaran Awal',
    p('/amaran/sekolah'),
    // M18 S23 and S21, reached from the two buttons of S4 (design m18-amaran-summary, decision 6).
    p('/amaran/ringkasan-eksekutif'),
    p('/amaran/keberkesanan'),
  ),
  item(50, 'Laporan Bulanan', p('/admin-sekolah/laporan-bulanan')),
  item(51, 'Senarai Pelajar', p('/admin-sekolah/pelajar')),
  item(52, 'Senarai Guru', p('/admin-sekolah/guru')),
  item(53, 'Kelas Sekolah', p('/admin-sekolah/kelas')),
  // [S6 end]
]

/** Admin Pusat (Portal Pentadbiran, D48): every admin route, including Bijak SPM admin (all under `/admin`). */
export const ADMIN_ITEMS: readonly MatrixItem[] = [
  // [S0 begin]
  item(1, 'Portal Pentadbiran', p('/admin')),
  // [S0 end]
]

const ITEMS: Readonly<Record<PrototypeRole, readonly MatrixItem[]>> = {
  student: STUDENT_ITEMS,
  teacher: TEACHER_ITEMS,
  school_admin: SCHOOL_ADMIN_ITEMS,
  admin: ADMIN_ITEMS,
}

/** The module items (section B) of a prototype role. */
export function moduleItemsFor(role: PrototypeRole): readonly MatrixItem[] {
  return ITEMS[role]
}

/** Every matrix item (section A + section B) of a role; empty for a role outside the prototype. */
export function scopeItemsFor(role: Role | null): readonly MatrixItem[] {
  return isPrototypeRole(role) ? [...ACCOUNT_ITEMS, ...ITEMS[role]] : []
}

// ---------------------------------------------------------------------------------------------
// Path matching

/** Path without query, hash and trailing slashes (`/` stays `/`). Hash-history paths too. */
export function normalisePath(path: string): string {
  const bare = path.split(/[?#]/, 1)[0] ?? ''
  const trimmed = bare.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

function ruleMatches(rule: PathRule, path: string): boolean {
  if (path === rule.path) return true
  return rule.exact !== true && rule.path !== '/' && path.startsWith(`${rule.path}/`)
}

function anyRule(rules: readonly PathRule[], path: string): boolean {
  return rules.some((rule) => ruleMatches(rule, path))
}

const ACCOUNT_RULES: readonly PathRule[] = ACCOUNT_ITEMS.flatMap((i) => i.rules)

/**
 * Whether `path` is in the prototype scope for `role` (`null` = guest). Pure: ignores the
 * `VITE_PROTOTYPE_SCOPE` switch, so tests can exercise it in any mode.
 */
export function isPathInScope(role: Role | null, path: string): boolean {
  const target = normalisePath(path)
  if (anyRule(COMMON_RULES, target)) return true
  if (role === null) return anyRule(GUEST_RULES, target) || anyRule(ACCOUNT_RULES, target)
  if (anyRule(ACCOUNT_RULES, target)) return true
  if (!isPrototypeRole(role)) return anyRule(GUEST_RULES, target)
  // Admin Pusat (D48) monitors the whole system: every route its Portal Pentadbiran shell links to
  // (`/admin/**` plus the cross-module admin screens) is allowed; the route's own `roles` still apply.
  if (role === 'admin') return true
  return ITEMS[role].some((entry) => anyRule(entry.rules, target))
}

/** `isPathInScope`, or `true` for everything when the scope switch is `off`. */
export function isPathAllowed(role: Role | null, path: string): boolean {
  return !isPrototypeScopeOn() || isPathInScope(role, path)
}

/**
 * Home of the shell's logo link: the role's own dashboard for a v2 role (a teacher or school admin
 * has no `/dashboard` of its own; Admin Pusat goes to its Command Center), `/dashboard` for every
 * other role. The same with the scope on or off, since the v2 shells are used in every build. A
 * student's home is `/dashboard` in both API modes (`GET /api/dashboard` is served by the real API).
 */
export function shellHomePath(role: Role | null): string {
  return isPrototypeRole(role) ? scopeHomePath(role) : '/dashboard'
}

/** Where the "back to the dashboard" button of the "not available" page goes. */
export function scopeHomePath(role: Role | null): string {
  if (role === 'teacher') return '/guru'
  if (role === 'school_admin') return '/admin-sekolah'
  // M17 has no '/admin' dashboard page yet; the admin Command Center is the monitoring home.
  if (role === 'admin') return '/admin/command-center'
  if (role === null) return '/login'
  // A role outside the prototype (e.g. restored from storage) has no dashboard: sign out. `/logout`
  // clears the session and ends on `/login`, so there is no redirect loop.
  return isPrototypeRole(role) ? '/dashboard' : '/logout'
}
