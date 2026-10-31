/**
 * Admin-panel menu (F-18; design shells.md v1.2 §2.2, §2.6–§2.8): ONE ordered definition rendered
 * by the desktop sidebar (≥ lg), the "Lagi" popover and the bottom nav (< lg).
 *
 * Sources: `docs/discovery/inventory/M01/SHA-admin-shell.json` (labels, hrefs, FA icons, order,
 * desktop and "Lagi" states; OBSERVED) and shells.md §2.7 (icon colours, popover placement).
 * Icon colours marked (i) in shells.md are INFERRED from the same item in `user-nav.ts`; the rest
 * are OBSERVED from screenshots or SRS. Group sub-items carry no colour (all `slate-400`).
 *
 * Roles (shells.md §1.4, §2.6): `adminMenuFor(role)`
 * - `admin`   -> `ADMIN_NAV` (this file);
 * - `teacher` -> the teacher menu of `user-nav.ts` (`navFor('teacher', 'sidebar')`): one data
 *   definition, two renderings (DV-SH-04 extended). It is imported, never restated here;
 * - any other role -> that role's own `navFor(role, 'sidebar')` (FR-G-04: hidden, not disabled).
 *
 * Active item (§2.8): a path activates an item when it equals its `to` or an `alias`, or lies below
 * it at a `/` boundary; `exact` items match only themselves. The **longest match wins and only one
 * item is active** (menu order breaks ties). This is not the user shell's prefix rule
 * (`isActivePath`), which can mark several items.
 */

import { shellHomePath } from '@/app/prototype-scope'
import type { Role } from '@/stores/session-types'

import {
  navFor,
  withoutAlesa,
  type NavEntry,
  type NavGroup,
  type NavItem,
  type NavSection,
  type NavSubheading,
} from './user-nav'

// ---------------------------------------------------------------------------------------------
// Types

/** Where an item appears in the mobile "Lagi" popover (shells.md §2.7 "Lagi" column). */
export interface LagiPlacement {
  /** Popover heading (shown upper case), or `null` for the first block, which has none. */
  heading: string | null
  /** Sort key across the whole popover (observed order; headings follow first appearance). */
  order: number
  /** Label when it differs from the sidebar's (for example "Laporan Aktiviti"). */
  label?: string
  /** Icon colour class in the popover. */
  colour?: string
  /** Link target when it differs from the entry's own (the Kirkpatrick group row). */
  to?: string
}

export interface AdminNavItem extends NavItem {
  /** Matches only the exact path (`/admin`, `/guru`, Kirkpatrick Overview / Ringkasan). */
  exact?: boolean
  /** Extra paths that also activate the item (the `/guru/...` twins, FR-M11-05, FR-M12-04). */
  alias?: readonly string[]
  /** Label colour class of a pinned item (default `text-slate-500`). */
  textClass?: string
  /** Popover placement; absent = not in the popover. */
  lagi?: LagiPlacement
  /** The item is one of the four link cells of the bottom nav. */
  bottomNav?: boolean
}

export interface AdminNavGroup extends Omit<NavGroup, 'children'> {
  /** `localStorage["admin_sidebar"]` key. */
  key: string
  children: readonly AdminNavItem[]
  /** Popover row that stands for the whole group (Kirkpatrick). */
  lagi?: LagiPlacement
}

export type AdminNavEntry = NavSection | NavSubheading | AdminNavItem | AdminNavGroup

/** A cell of the bottom nav (a link, or the "Lagi" button). */
export interface AdminBottomNavLink {
  kind: 'link'
  id: string
  label: string
  to: string
  fa: string
  /** Active only on this exact path; otherwise on it and everything below it. */
  exact?: boolean
}
export interface AdminBottomNavButton {
  kind: 'button'
  id: 'lagi'
  label: string
  fa: string
}
export type AdminBottomNavEntry = AdminBottomNavLink | AdminBottomNavButton

/** A row of the "Lagi" popover. */
export interface LagiHeading {
  kind: 'heading'
  id: string
  label: string
}
export interface LagiRow {
  kind: 'row'
  /** Item id, or group id for the Kirkpatrick row. */
  id: string
  label: string
  to: string
  fa: string
  /** Icon colour class. */
  colour: string
  /** Set on a group row: active while the current path is inside the group. */
  groupKey?: string
}
export type LagiEntry = LagiHeading | LagiRow

export interface LagiMenu {
  entries: readonly LagiEntry[]
  /** Rows after the `border-t`: "Student View" (admin only) and "Log Keluar". */
  tail: readonly LagiRow[]
}

// ---------------------------------------------------------------------------------------------
// Badge classes (design-system §4)

const B_LIVE =
  'ml-auto text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse'
/** DEV pill on the heading row of "Bilik Duta" (after the rule, not `ml-auto`). */
const B_DEV_HEADING =
  'text-[8px] bg-gradient-to-r from-amber-500 to-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold'

// ---------------------------------------------------------------------------------------------
// Builders (one entry per line below, in live order, for review against the inventory)

const lagi = (
  heading: string | null,
  order: number,
  colour: string,
  label?: string,
): LagiPlacement => ({ heading, order, colour, ...(label ? { label } : {}) })

function item(
  id: string,
  label: string,
  to: string,
  fa: string,
  color: string,
  extra: Partial<AdminNavItem> = {},
): AdminNavItem {
  return { kind: 'item', id, label, to, fa, color, ...extra }
}

function group(
  key: string,
  label: string,
  fa: string,
  color: string,
  children: readonly AdminNavItem[],
  extra: Partial<AdminNavGroup> = {},
): AdminNavGroup {
  return { kind: 'group', id: `g-${key}`, key, label, fa, color, children, ...extra }
}

/** A Kirkpatrick sub-item: its `/admin/...` route and the `/guru/...` twin (FR-M12-04). */
const kirk = (id: string, label: string, path: string, fa: string, exact = false): AdminNavItem =>
  item(id, label, `/admin/kirkpatrick${path}`, fa, '', {
    exact,
    alias: [`/guru/kirkpatrick${path}`],
  })

// ---------------------------------------------------------------------------------------------
// The menu

export const ADMIN_NAV: readonly AdminNavEntry[] = [
  // Pinned (not inside a section). Command Center and Aktiviti Harian open in a new tab.
  item(
    'command-center',
    'Command Center',
    '/admin/command-center',
    'fa-satellite-dish',
    'text-indigo-200',
    { variant: 'command', target: '_blank', badge: { text: 'LIVE', cls: B_LIVE } },
  ),
  item(
    'aktiviti-harian',
    'Aktiviti Harian',
    '/admin/command-center/daily-activity',
    'fa-chart-line',
    'text-emerald-600',
    { target: '_blank', textClass: 'text-emerald-700' },
  ),
  item('audio-kbat', 'Audio KBAT', '/admin/audio-kbat', 'fa-headphones', 'text-amber-500', {
    textClass: 'text-amber-700',
  }),

  {
    kind: 'section',
    id: 'sec-harian',
    label: 'HARIAN',
    text: 'text-teal-700',
    rule: 'from-teal-300',
  },
  item('dashboard', 'Dashboard', '/admin', 'fa-tachometer-alt', 'text-indigo-500', {
    exact: true,
    bottomNav: true,
  }),

  {
    kind: 'section',
    id: 'sec-analitik',
    label: 'ANALITIK',
    text: 'text-indigo-700',
    rule: 'from-indigo-300',
  },
  item('analitik', 'Analitik', '/admin/analytics', 'fa-chart-pie', 'text-fuchsia-500', {
    lagi: lagi(null, 101, 'text-fuchsia-500'),
  }),
  item('monitoring', 'Monitoring', '/admin/monitoring', 'fa-binoculars', 'text-teal-500', {
    alias: ['/guru/monitoring'],
    lagi: lagi(null, 103, 'text-teal-500'),
  }),
  group(
    'kirkpatrick',
    'Kirkpatrick',
    'fa-microscope',
    'text-cyan-500',
    [
      kirk('kirk-overview', 'Overview', '', 'fa-th-large', true),
      kirk('kirk-reaction', 'Tahap 1: Reaksi', '/reaction', 'fa-smile'),
      kirk('kirk-learning', 'Tahap 2: Pembelajaran', '/learning', 'fa-brain'),
      kirk('kirk-behavior', 'Tahap 3: Tingkah Laku', '/behavior', 'fa-running'),
      kirk('kirk-results', 'Tahap 4: Hasil', '/results', 'fa-trophy'),
      kirk('kirk-chain', 'Rantaian Impak', '/chain', 'fa-link'),
      kirk('kirk-interventions', 'Intervensi', '/interventions', 'fa-hand-holding-medical'),
    ],
    { lagi: { ...lagi(null, 104, 'text-cyan-500'), to: '/admin/kirkpatrick' } },
  ),
  item('laporan', 'Laporan', '/admin/laporan', 'fa-chart-bar', 'text-orange-500', {
    lagi: lagi(null, 102, 'text-orange-500', 'Laporan Aktiviti'),
  }),

  {
    kind: 'section',
    id: 'sec-pengurusan',
    label: 'PENGURUSAN',
    text: 'text-blue-700',
    rule: 'from-blue-300',
  },
  group('kurikulum', 'Kurikulum', 'fa-sitemap', 'text-teal-500', [
    item('kurikulum', 'Kurikulum', '/admin/curriculum', 'fa-sitemap', '', {
      lagi: lagi('Kurikulum', 401, 'text-teal-500'),
    }),
    item('subjek', 'Subjek', '/admin/subjects', 'fa-book', '', {
      lagi: lagi('Kurikulum', 402, 'text-indigo-500'),
    }),
    item(
      'tahap-pendidikan',
      'Tahap Pendidikan',
      '/admin/education-levels',
      'fa-graduation-cap',
      '',
      { lagi: lagi('Kurikulum', 403, 'text-purple-500') },
    ),
  ]),
  group('soalan', 'Soalan', 'fa-question-circle', 'text-amber-500', [
    item('senarai-soalan', 'Senarai Soalan', '/admin/questions', 'fa-list', '', {
      bottomNav: true,
    }),
    item('import-csv', 'Import CSV', '/admin/questions/import', 'fa-file-csv', '', {
      lagi: lagi('Soalan', 301, 'text-indigo-500'),
    }),
    item('kualiti-soalan', 'Kualiti Soalan', '/admin/questions/quality', 'fa-clipboard-check', '', {
      lagi: lagi('Soalan', 302, 'text-teal-500'),
    }),
    item('laporan-soalan', 'Laporan Soalan', '/admin/question-reports', 'fa-flag', '', {
      lagi: lagi('Soalan', 303, 'text-red-500'),
    }),
    item(
      'soalan-berstruktur',
      'Soalan Berstruktur',
      '/admin/structured-questions',
      'fa-list-ol',
      '',
      { lagi: lagi('Soalan', 304, 'text-cyan-500') },
    ),
    item(
      'kertas-soalan-guru',
      'Kertas Soalan Guru',
      '/admin/question-submissions',
      'fa-file-upload',
      '',
      { lagi: lagi('Soalan', 305, 'text-blue-500') },
    ),
  ]),
  group('pengguna', 'Pengguna', 'fa-users', 'text-violet-500', [
    item('senarai-pengguna', 'Senarai Pengguna', '/admin/users', 'fa-users', '', {
      bottomNav: true,
    }),
    item('sekolah', 'Sekolah', '/admin/schools', 'fa-school', '', {
      lagi: lagi('Sistem', 1001, 'text-indigo-500'),
    }),
    item(
      'langganan-sekolah',
      'Langganan Sekolah',
      '/admin/school-subscriptions',
      'fa-file-contract',
      '',
      { lagi: lagi('Sistem', 1002, 'text-emerald-500') },
    ),
    item('import-pelajar', 'Import Pelajar', '/admin/import-students', 'fa-user-plus', '', {
      lagi: lagi('Sistem', 1009, 'text-blue-500'),
    }),
    item('pelajar-komplimen', 'Pelajar Komplimen', '/admin/comp-students', 'fa-gift', ''),
    item('import-pengguna', 'Import Pengguna', '/admin/users/bulk-import', 'fa-users-cog', '', {
      lagi: lagi('Sistem', 1010, 'text-violet-500'),
    }),
    item('penajaan', 'Penajaan', '/admin/sponsors', 'fa-handshake', '', { bottomNav: true }),
    item('anak-angkat', 'Anak Angkat', '/admin/anak-angkat', 'fa-child', ''),
    item('permohonan', 'Permohonan', '/admin/anak-angkat/permohonan', 'fa-file-alt', ''),
  ]),
  group('spm', 'SPM', 'fa-graduation-cap', 'text-orange-500', [
    item('spm-databank', 'Databank Soalan', '/spm/tahun-lepas', 'fa-database', '', {
      lagi: lagi('SPM', 201, 'text-rose-500'),
    }),
    item('spm-latih-tubi', 'Latih Tubi', '/spm/latih-tubi', 'fa-bolt', '', {
      lagi: lagi('SPM', 202, 'text-amber-500'),
    }),
    item('spm-tracking', 'Tracking A', '/spm/ramalan', 'fa-crosshairs', '', {
      lagi: lagi('SPM', 203, 'text-emerald-500'),
    }),
    item('spm-subjektif', 'Subjektif', '/spm/subjektif', 'fa-pen-fancy', '', {
      lagi: lagi('SPM', 204, 'text-violet-500'),
    }),
  ]),
  group('premium', 'Premium', 'fa-shield-halved', 'text-indigo-500', [
    item('pksk-soalan', 'PKSK Soalan', '/admin/pksk/questions', 'fa-shield-halved', '', {
      lagi: lagi('Premium', 501, 'text-indigo-500'),
    }),
    item('pksk-akses', 'PKSK Akses', '/admin/pksk/access', 'fa-key', '', {
      lagi: lagi('Premium', 502, 'text-amber-500'),
    }),
  ]),

  {
    kind: 'section',
    id: 'sec-sistem',
    label: 'SISTEM',
    text: 'text-slate-700',
    rule: 'from-slate-300',
  },
  group('gamifikasi', 'Gamifikasi', 'fa-gamepad', 'text-purple-500', [
    item('gami-overview', 'Overview', '/admin/gamification', 'fa-gamepad', '', {
      exact: true,
      lagi: lagi('Gamifikasi', 601, 'text-purple-500'),
    }),
    item('gami-tiers', 'Tier Config', '/admin/gamification/tiers', 'fa-crown', '', {
      lagi: lagi('Gamifikasi', 602, 'text-amber-500'),
    }),
    item('gami-challenges', 'Cabaran', '/admin/gamification/challenges', 'fa-bullseye', '', {
      lagi: lagi('Gamifikasi', 603, 'text-emerald-500'),
    }),
    item('gami-students', 'Pelajar', '/admin/gamification/students', 'fa-users', ''),
    item('gami-transactions', 'Transaksi', '/admin/gamification/transactions', 'fa-receipt', ''),
    item('kedai-hadiah', 'Kedai Hadiah', '/admin/hadiah', 'fa-gift', '', {
      lagi: lagi('Gamifikasi', 604, 'text-pink-500'),
    }),
    item(
      'gamifikasi-guru',
      'Gamifikasi Guru',
      '/admin/gamifikasi/guru',
      'fa-chalkboard-teacher',
      '',
      { lagi: lagi('Gamifikasi', 605, 'text-amber-500') },
    ),
    item('kawalan-reward', 'Kawalan Reward', '/admin/reward-control', 'fa-shield-halved', ''),
  ]),
  group('battle', 'Battle & Permainan', 'fa-bolt', 'text-red-500', [
    item('battle-live', 'Battle Live', '/battle', 'fa-bolt', '', {
      lagi: lagi('Battle & Permainan', 701, 'text-red-500'),
    }),
    item('battle-ranking', 'Ranking Sekolah', '/battle/ranking-sekolah', 'fa-school', ''),
    item('battle-leaderboard', 'Leaderboard', '/battle/leaderboard', 'fa-trophy', ''),
    item('tetapan-permainan', 'Tetapan Permainan', '/admin/permainan', 'fa-dice', '', {
      lagi: lagi('Battle & Permainan', 702, 'text-emerald-500'),
    }),
  ]),
  group('marketplace', 'Marketplace', 'fa-shopping-bag', 'text-emerald-500', [
    item('mp-produk', 'Produk', '/admin/marketplace/products', 'fa-shopping-bag', '', {
      lagi: lagi('Marketplace', 901, 'text-emerald-500'),
    }),
    item('mp-penjual', 'Penjual', '/admin/marketplace/sellers', 'fa-store', '', {
      lagi: lagi('Marketplace', 902, 'text-orange-500'),
    }),
  ]),
  group('kandungan', 'Kandungan', 'fa-newspaper', 'text-pink-500', [
    item('banner', 'Banner', '/admin/banners', 'fa-image', '', {
      lagi: lagi('Kandungan', 801, 'text-pink-500'),
    }),
    item('artikel', 'Artikel', '/admin/articles', 'fa-newspaper', '', {
      lagi: lagi('Kandungan', 802, 'text-orange-500'),
    }),
    item('nota', 'Nota', '/admin/notes', 'fa-sticky-note', '', {
      lagi: lagi('Kandungan', 803, 'text-yellow-500'),
    }),
    item('push-notifikasi', 'Push Notifikasi', '/admin/notifications', 'fa-bell', '', {
      lagi: lagi('Kandungan', 804, 'text-amber-500'),
    }),
    item(
      'upload-screenshot',
      'Upload Screenshot',
      '/admin/tools/screenshots',
      'fa-cloud-upload-alt',
      '',
      { lagi: lagi('Kandungan', 806, 'text-blue-500') },
    ),
  ]),
  group('kewangan', 'Kewangan', 'fa-credit-card', 'text-blue-500', [
    item('pembayaran', 'Pembayaran', '/admin/payments', 'fa-credit-card', '', {
      lagi: lagi('Sistem', 1004, 'text-teal-500'),
    }),
    item('billing', 'Billing Dashboard', '/admin/billing', 'fa-chart-line', '', {
      lagi: lagi('Sistem', 1005, 'text-emerald-500'),
    }),
    item('dunning', 'Dunning Log', '/admin/dunning', 'fa-bell-slash', '', {
      lagi: lagi('Sistem', 1006, 'text-red-500'),
    }),
  ]),
  group('sistem', 'Sistem', 'fa-cog', 'text-slate-500', [
    item('performance', 'Performance', '/admin/performance', 'fa-gauge-high', '', {
      lagi: lagi('Sistem', 1008, 'text-orange-500'),
    }),
    item('tetapan', 'Tetapan', '/admin/settings', 'fa-cog', '', {
      lagi: lagi('Sistem', 1003, 'text-slate-500'),
    }),
    item('log-audit', 'Log Audit', '/admin/audit-logs', 'fa-clipboard-list', '', {
      lagi: lagi('Sistem', 1007, 'text-slate-500'),
    }),
    // Sidebar: under Sistem. Popover: under Kandungan (observed, replicated).
    item('chatbot', 'Chatbot', '/admin/chatbot', 'fa-robot', '', {
      lagi: lagi('Kandungan', 805, 'text-purple-500'),
    }),
  ]),

  {
    kind: 'section',
    id: 'sec-bilik-duta',
    label: '🏆 Bilik Duta',
    text: 'text-amber-700',
    rule: 'from-amber-300',
    badge: { text: 'DEV', cls: B_DEV_HEADING },
  },
  item('bilik-duta', 'Bilik Duta', '/bilik-duta', 'fa-crown', 'text-amber-500'),
  item('akademi-duta', 'Akademi Duta', '/akademi-duta', 'fa-graduation-cap', 'text-purple-500'),
  item(
    'permohonan-duta',
    'Permohonan Duta',
    '/admin/duta-applications',
    'fa-clipboard-check',
    'text-teal-500',
  ),
  item('duta-dashboard', 'Duta Dashboard', '/duta-dashboard', 'fa-user-tie', 'text-indigo-500'),
  item('jemput-duta', 'Jemput Duta', '/jemput-duta', 'fa-school', 'text-pink-500'),
  item('kem-bootcamp', 'Kem & Bootcamp', '/bilik-duta/kem', 'fa-campground', 'text-rose-500'),

  {
    kind: 'section',
    id: 'sec-pusat-ai',
    label: '🤖 Pusat AI',
    text: 'text-purple-700',
    rule: 'from-purple-300',
  },
  item('kamus-ai', 'Kamus AI', '/pusat-ai/kamus', 'fa-book-open', 'text-cyan-600'),
  item(
    'aktiviti-advisor',
    'Aktiviti Advisor',
    '/pusat-ai/aktiviti',
    'fa-lightbulb',
    'text-green-600',
  ),
  item(
    'pendamping-motivasi',
    'Pendamping Motivasi',
    '/pusat-ai/pendamping',
    'fa-heart',
    'text-purple-600',
  ),
  item('spm-walkthrough', 'SPM Walkthrough', '/pusat-ai/spm', 'fa-pen-to-square', 'text-rose-600'),
  item(
    'whiteboard-quiz',
    'Whiteboard → Quiz',
    '/pusat-ai/whiteboard',
    'fa-clipboard-question',
    'text-blue-600',
  ),
  item(
    'parent-whisperer',
    'Parent Whisperer',
    '/pusat-ai/parent-whisperer',
    'fa-comments',
    'text-teal-600',
  ),
  item('doa-motivasi', 'Doa & Motivasi', '/pusat-ai/doa', 'fa-mosque', 'text-emerald-600'),

  {
    kind: 'section',
    id: 'sec-visi',
    label: '✨ Visi & Pertandingan',
    text: 'text-indigo-700',
    rule: 'from-indigo-300',
  },
  item('profil-cerah', 'Profil Cerah', '/profil-cerah', 'fa-magic', 'text-indigo-500'),
  item('sekolah-bersaing', 'Sekolah Bersaing', '/sekolah-bersaing', 'fa-trophy', 'text-amber-500'),
  item('cita-cita', 'Cita-Cita Hijrah', '/cita-cita', 'fa-star', 'text-pink-500'),
  item('kombo', 'Streak / Kombo', '/kombo', 'fa-fire', 'text-orange-500'),

  {
    kind: 'section',
    id: 'sec-killer',
    label: '💎 Killer Features',
    text: 'text-fuchsia-700',
    rule: 'from-fuchsia-300',
  },
  item('cikgu-suara', 'Cikgu Suara', '/cikgu-suara', 'fa-microphone', 'text-fuchsia-500'),
  item('spm-mock', 'SPM Mock Exam', '/spm-mock', 'fa-file-pen', 'text-orange-700'),
  item(
    'wellbeing-alerts',
    'Wellbeing Alerts',
    '/wellbeing/alerts',
    'fa-triangle-exclamation',
    'text-red-500',
  ),
]

/** Footer links above the user block (admin only; the teacher has none, shells.md §2.6). */
export const ADMIN_FOOTER_LINKS: readonly AdminNavItem[] = [
  item('tetapan-peribadi', 'Tetapan Peribadi', '/tetapan', 'fa-cog', 'text-slate-500'),
  item('ke-dashboard', 'Ke Dashboard', '/dashboard', 'fa-arrow-left', 'text-emerald-600', {
    textClass: 'text-emerald-600',
  }),
]

/** The footer link that is a cross-shell switch, never an active item. */
const NEVER_ACTIVE_IDS: ReadonlySet<string> = new Set(['ke-dashboard'])

// ---------------------------------------------------------------------------------------------
// Bottom nav (shells.md §2.4, §2.6)

export const ADMIN_BOTTOM_NAV: readonly AdminBottomNavEntry[] = [
  {
    kind: 'link',
    id: 'dashboard',
    label: 'Dashboard',
    to: '/admin',
    fa: 'fa-tachometer-alt',
    exact: true,
  },
  { kind: 'link', id: 'soalan', label: 'Soalan', to: '/admin/questions', fa: 'fa-question-circle' },
  { kind: 'link', id: 'penaja', label: 'Penaja', to: '/admin/sponsors', fa: 'fa-handshake' },
  { kind: 'link', id: 'pengguna', label: 'Pengguna', to: '/admin/users', fa: 'fa-users' },
  { kind: 'button', id: 'lagi', label: 'Lagi', fa: 'fa-ellipsis-h' },
]

/** PROPOSED (P-4): the four teacher routes that use this chrome, plus the teacher's home. */
export const TEACHER_BOTTOM_NAV: readonly AdminBottomNavEntry[] = [
  { kind: 'link', id: 'guru', label: 'Guru', to: '/guru', fa: 'fa-chart-pie', exact: true },
  { kind: 'link', id: 'kelas', label: 'Kelas', to: '/guru/kelas', fa: 'fa-chalkboard-teacher' },
  {
    kind: 'link',
    id: 'monitoring',
    label: 'Monitoring',
    to: '/guru/monitoring',
    fa: 'fa-binoculars',
  },
  {
    kind: 'link',
    id: 'kirkpatrick',
    label: 'Kirkpatrick',
    to: '/guru/kirkpatrick',
    fa: 'fa-microscope',
  },
  { kind: 'button', id: 'lagi', label: 'Lagi', fa: 'fa-ellipsis-h' },
]

/** INFERRED: a role with no SRS-defined bottom nav (§1.4) gets the "Lagi" button only. */
const LAGI_ONLY_BOTTOM_NAV: readonly AdminBottomNavEntry[] = [
  { kind: 'button', id: 'lagi', label: 'Lagi', fa: 'fa-ellipsis-h' },
]

// ---------------------------------------------------------------------------------------------
// Role selection

/** Paths that are only active on themselves in the user-shell menus (`user-nav.ts` has no flag). */
const EXACT_PATHS: ReadonlySet<string> = new Set([
  '/guru',
  '/guru/kirkpatrick',
  '/admin-sekolah',
  '/dashboard',
])

const KIRKPATRICK_TEACHER_GROUP_ID = 't-kirkpatrick'

function adoptItem(source: NavItem): AdminNavItem {
  return EXACT_PATHS.has(source.to) ? { ...source, exact: true } : { ...source }
}

/** Gives a user-shell entry the admin-menu fields (`exact`, group `key`). */
function adoptUserEntry(entry: NavEntry): AdminNavEntry {
  if (entry.kind === 'item') return adoptItem(entry)
  if (entry.kind === 'group') {
    return {
      ...entry,
      // The teacher's one group shares the admin key, so the saved state is common (§2.2).
      key: entry.id === KIRKPATRICK_TEACHER_GROUP_ID ? 'kirkpatrick' : entry.id,
      children: entry.children.map(adoptItem),
    }
  }
  return entry
}

/** The sidebar entries of a role, in order (§2.8 `adminMenuFor`). */
export function adminMenuFor(role: Role | null): readonly AdminNavEntry[] {
  if (role === 'admin') return withoutAlesa(ADMIN_NAV)
  if (role === null) return []
  return navFor(role, 'sidebar').map(adoptUserEntry)
}

/** Footer links above the user block: admin only. */
export function footerLinksFor(role: Role | null): readonly AdminNavItem[] {
  return role === 'admin' ? ADMIN_FOOTER_LINKS : []
}

export function bottomNavFor(role: Role | null): readonly AdminBottomNavEntry[] {
  if (role === 'admin') return ADMIN_BOTTOM_NAV
  if (role === 'teacher') return TEACHER_BOTTOM_NAV
  return LAGI_ONLY_BOTTOM_NAV
}

export interface AdminChrome {
  /** Caption under the sidebar logo. */
  caption: string
  /** Where the logo links to. */
  home: string
  /** Role label in the user block. */
  roleLabel: string
  /** The server-status pill is shown (admin only; GET /api/admin/server-status is 403 otherwise). */
  serverStatus: boolean
}

/** Chrome text per role (§2.2, §2.6). Teacher values are PROPOSED (P-3). */
export function chromeFor(role: Role | null): AdminChrome {
  if (role === 'admin') {
    return { caption: 'Panel Pentadbir', home: '/admin', roleLabel: 'Admin', serverStatus: true }
  }
  if (role === 'teacher') {
    return { caption: 'Portal Guru', home: '/guru', roleLabel: 'Guru', serverStatus: false }
  }
  // INFERRED (§1.4): another role on an admin-layout route keeps its own portal wording.
  return {
    caption: 'Platform Latih Tubi Nasional',
    // Prototype scope (D43): the school admin's home is `/admin-sekolah` (no `/dashboard`).
    home: shellHomePath(role),
    roleLabel: role ?? '',
    serverStatus: false,
  }
}

// ---------------------------------------------------------------------------------------------
// Active item (§2.8): longest match, one item

function normalise(path: string): string {
  const bare = path.split(/[?#]/, 1)[0] ?? ''
  return bare.replace(/\/+$/, '') || '/'
}

/** Length of `base` when `path` is `base` or below it (or equals it, for `exact`); else 0. */
function matchLength(path: string, base: string, exact: boolean): number {
  const target = normalise(base)
  if (target === '/') return 0
  if (path === target) return target.length
  return !exact && path.startsWith(`${target}/`) ? target.length : 0
}

/** How well `current` matches an item: 0 = not at all, else the length of the matched prefix. */
export function itemMatch(entry: AdminNavItem, current: string): number {
  if (entry.target === '_blank' || NEVER_ACTIVE_IDS.has(entry.id)) return 0
  const path = normalise(current)
  let best = 0
  for (const base of [entry.to, ...(entry.alias ?? [])]) {
    best = Math.max(best, matchLength(path, base, entry.exact === true))
  }
  return best
}

function isGroup(entry: AdminNavEntry): entry is AdminNavGroup {
  return entry.kind === 'group'
}

function isItem(entry: AdminNavEntry): entry is AdminNavItem {
  return entry.kind === 'item'
}

/** Every item of the menu in menu order (group children in place). */
export function flatItems(entries: readonly AdminNavEntry[]): AdminNavItem[] {
  return entries.flatMap((entry) =>
    isItem(entry) ? [entry] : isGroup(entry) ? [...entry.children] : [],
  )
}

/**
 * The id of the one active item for `current`, or `null`. `extra` are the footer links, which
 * take part in the same rule (they come after the menu, so they lose ties).
 */
export function activeItemId(
  entries: readonly AdminNavEntry[],
  current: string,
  extra: readonly AdminNavItem[] = [],
): string | null {
  let bestId: string | null = null
  let best = 0
  for (const candidate of [...flatItems(entries), ...extra]) {
    const length = itemMatch(candidate, current)
    if (length > best) {
      best = length
      bestId = candidate.id
    }
  }
  return bestId
}

/**
 * The group to open for `current`: the group of the active item, else (no item is active, for
 * example `/guru/kirkpatrick/pelajar/5`, "Overview" being exact-only) the group whose routes
 * lie above the path. `null` when there is none.
 */
export function activeGroupKey(
  entries: readonly AdminNavEntry[],
  current: string,
  activeId: string | null = activeItemId(entries, current),
): string | null {
  const groups = entries.filter(isGroup)
  if (activeId !== null) {
    const owner = groups.find((g) => g.children.some((c) => c.id === activeId))
    return owner ? owner.key : null
  }
  const path = normalise(current)
  const owner = groups.find((g) =>
    g.children.some((c) =>
      [c.to, ...(c.alias ?? [])].some((base) => matchLength(path, base, false) > 0),
    ),
  )
  return owner ? owner.key : null
}

/** Bottom-nav cell active for `current` (a plain prefix rule, §2.4). */
export function bottomNavActive(entry: AdminBottomNavLink, current: string): boolean {
  return matchLength(normalise(current), entry.to, entry.exact === true) > 0
}

// ---------------------------------------------------------------------------------------------
// "Lagi" popover (§2.4, §2.6)

const STUDENT_VIEW: LagiRow = {
  kind: 'row',
  id: 'student-view',
  label: 'Student View',
  to: '/dashboard',
  fa: 'fa-arrow-left',
  colour: 'text-emerald-600',
}
const LOG_KELUAR: LagiRow = {
  kind: 'row',
  id: 'log-keluar',
  label: 'Log Keluar',
  to: '/logout',
  fa: 'fa-sign-out-alt',
  colour: 'text-red-600',
}

interface PlacedRow {
  order: number
  heading: string | null
  row: LagiRow
}

function placeRow(source: AdminNavItem | AdminNavGroup, at: LagiPlacement): PlacedRow {
  return {
    order: at.order,
    heading: at.heading,
    row: {
      kind: 'row',
      id: source.id,
      label: at.label ?? source.label,
      to: at.to ?? (source.kind === 'item' ? source.to : ''),
      fa: source.fa,
      colour: at.colour ?? source.color,
      ...(source.kind === 'group' ? { groupKey: source.key } : {}),
    },
  }
}

function adminLagi(): LagiMenu {
  const placed: PlacedRow[] = []
  for (const entry of withoutAlesa(ADMIN_NAV)) {
    if (isItem(entry) && entry.lagi) placed.push(placeRow(entry, entry.lagi))
    if (isGroup(entry)) {
      if (entry.lagi) placed.push(placeRow(entry, entry.lagi))
      for (const child of entry.children) {
        if (child.lagi) placed.push(placeRow(child, child.lagi))
      }
    }
  }
  placed.sort((a, b) => a.order - b.order)

  const entries: LagiEntry[] = []
  let heading: string | null = null
  for (const { heading: next, row } of placed) {
    if (next !== heading && next !== null) {
      entries.push({ kind: 'heading', id: `lagi-h-${next}`, label: next })
    }
    heading = next
    entries.push(row)
  }
  return { entries, tail: [STUDENT_VIEW, LOG_KELUAR] }
}

/**
 * Teacher popover (P-5): every sidebar entry except the pinned Command Center and the entries that
 * are already bottom-nav cells (Dashboard Guru, Kelas Saya, Monitoring, the Kirkpatrick group).
 * Headings are the sidebar's section and sub-heading labels.
 */
function derivedLagi(role: Role): LagiMenu {
  const bottom = bottomNavFor(role)
  const bottomTargets = new Set(bottom.flatMap((b) => (b.kind === 'link' ? [b.to] : [])))
  const out: LagiEntry[] = []
  for (const entry of adminMenuFor(role)) {
    if (entry.kind === 'section' || entry.kind === 'subheading') {
      out.push({ kind: 'heading', id: `lagi-h-${entry.id}`, label: entry.label })
    } else if (isItem(entry)) {
      if (entry.variant === 'command' || bottomTargets.has(entry.to)) continue
      out.push({
        kind: 'row',
        id: entry.id,
        label: entry.label,
        to: entry.to,
        fa: entry.fa,
        colour: entry.color,
      })
    }
  }
  // A heading with no row before the next heading (or the end) is dropped.
  const entries = out.filter(
    (entry, index) => entry.kind === 'row' || out[index + 1]?.kind === 'row',
  )
  return { entries, tail: [LOG_KELUAR] }
}

/** The "Lagi" popover of a role, generated from the same nav data as the sidebar (§2.8). */
export function lagiFor(role: Role | null): LagiMenu {
  if (role === 'admin') return adminLagi()
  if (role === null) return { entries: [], tail: [] }
  return derivedLagi(role)
}
