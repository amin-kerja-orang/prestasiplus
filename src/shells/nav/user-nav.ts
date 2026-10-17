/**
 * User-portal menu: ONE ordered definition for the desktop sidebar (≥ lg) and the mobile drawer
 * (< lg, also opened by the bottom-nav "Lagi"). This is the DV-SH-04 fix (design shells.md §5–§6):
 * live renders two different menus (G-D4); the rebuild renders this single list on both surfaces.
 *
 * Sources (build-plan F-19, §S.5):
 * - `docs/discovery/inventory/_raw/M05/work/page_dashboard.html` (admin identity, which sees every
 *   role's block): desktop sidebar `aside.sidebar nav` and drawer `.mobile-drawer nav`. Labels,
 *   hrefs, FA icons, colour classes, tooltips (`data-tip`) and badge classes are copied from it.
 * - `docs/discovery/inventory/*\/SHU-user-shell.json` (same capture, element inventory).
 * - `roles-matrix/murid/*.jpeg`, `roles-matrix/guru/*.jpeg`, `roles-matrix/admin sekolah/*.jpeg`:
 *   live desktop sidebars of a **student**, a **teacher** (`/guru`) and a **school admin**
 *   (`/admin-sekolah`) account. They give each role's full menu content and order (OBSERVED; the
 *   red tick marks on them are ignored: scope is the full live menu). Labels, order, sections and
 *   visible badges come from them; hrefs, icons and colours not readable there are taken from the
 *   admin capture when the same item exists, else marked INFERRED.
 *
 * Canonical order = the desktop sidebar. Each role sees exactly its own observed sequence: the
 * admin sees the admin-identity capture (sidebar order, drawer-only entries slotted in: Amaran
 * Awal, the Command Center cards, the drawer's teacher block, the extra PPD/JPN items); student,
 * teacher and school_admin see the entries of their screenshots. Drawer copies of sidebar entries
 * (e.g. the drawer "Gamifikasi" block) are not repeated. Where the two live admin menus disagree
 * on an icon colour, the sidebar colour is used.
 *
 * Role filter (FR-G-04): an entry is **hidden** (not rendered), never disabled, for a role outside
 * `roles`. `roles` omitted = every logged-in role. Student, teacher, school_admin and admin
 * visibility is OBSERVED. **parent, sponsor, ppd_officer and jpn_officer have no screenshot: their
 * visibility is INFERRED** ("Dashboard", the account links, Bantuan; PPD/JPN also their section).
 *
 * Marks used in comments: OBSERVED = in the capture; INFERRED = not observed, reasoned.
 * Hrefs are app paths (the live origin `https://prestasiplus.my` is dropped). Unbuilt routes
 * resolve to the 404 page (overview §5.5, build-plan §S.5).
 */

import type { Role } from '@/stores/session-types'

import { isOutOfScope } from './out-of-scope'

/** Where an entry is rendered. */
export type NavSurface = 'sidebar' | 'drawer'

/** A badge pill: literal live text and the full live class string as rendered in the sidebar. */
export interface NavBadge {
  text: string
  /**
   * Sidebar class string. The drawer uses the same string with `text-[10px]` → `text-[9px]`
   * (design-system §4: SPM, PRO and emoji pills are 10px in the sidebar and 9px in the drawer;
   * 8px pills are identical on both surfaces).
   */
  cls: string
}

interface EntryBase {
  /** Stable key (unique in the list); used for `v-for` keys and `data-nav-id`. */
  id: string
  /** Roles that see the entry; omitted = every logged-in role. */
  roles?: readonly Role[]
  /** Surfaces that render the entry; omitted = both. */
  surfaces?: readonly NavSurface[]
}

/**
 * Main section header (`pt-4 pb-2` row with a gradient rule in the sidebar; `.drawer-section-label`
 * in the drawer). Label is literal live text; both surfaces display it upper case via CSS.
 */
export interface NavSection extends EntryBase {
  kind: 'section'
  label: string
  /** Label colour, e.g. `text-amber-700`. */
  text: string
  /** Rule gradient start, e.g. `from-amber-300`. */
  rule: string
  /** Sidebar wrapper spacing; live uses `pt-4 pb-2` except "Cikgu Alesa Tools" (`pt-2 pb-1`). */
  wrap?: string
  /**
   * `gradient`: the "Pusat AI" header of the shared Pusat AI block, rendered with the same markup
   * on both surfaces (live includes one partial in both menus).
   */
  variant?: 'gradient'
  badge?: NavBadge
}

/** Sub-heading of the Pusat AI block (`px-3 pt-3 pb-1`, 10px bold upper case). */
export interface NavSubheading extends EntryBase {
  kind: 'subheading'
  label: string
  /** Full span class string. */
  cls: string
}

export interface NavItem extends EntryBase {
  kind: 'item'
  label: string
  /** App path. */
  to: string
  /** Live Font Awesome class name without `fas`, e.g. `fa-home`. */
  fa: string
  /** Icon colour class as live (`text-rose-500`, or a live custom class `icon-brain`), or ''. */
  color: string
  /**
   * Rendering style:
   * - `main` (default): `.nav-item` + `text-lg` icon + `font-semibold` label in the sidebar,
   *   `.drawer-nav-item` in the drawer;
   * - `ai`: an item of the Pusat AI partial: `.nav-item` + `text-sm font-semibold` label and a
   *   base-size icon on **both** surfaces (live includes the same partial in both menus);
   * - `drawer-style`: live sidebar item rendered with the drawer classes (Audio KBAT, OBSERVED);
   * - `command`: the dark "Command Center" card with the LIVE pill (`target="_blank"`);
   * - `admin-link`: "Ke Admin Panel" (indigo tint classes).
   */
  variant?: 'main' | 'ai' | 'drawer-style' | 'command' | 'admin-link'
  /** Live `data-tip` tooltip (sidebar hover, hidden below 1024 by live CSS). */
  tip?: string
  badge?: NavBadge
  /** Live `target` attribute. */
  target?: '_blank'
  /**
   * Sub-paths that do NOT keep this item active although they lie below `to` ("Latih Tubi" `/practice`
   * is not active on `/practice/chapter` or `/practice/revision`; M05 FN-M05-9.1.6).
   */
  activeExcept?: readonly string[]
}

/** Collapsible group (drawer "Kirkpatrick", Alpine `kirkGuruOpen`, not persisted). */
export interface NavGroup extends EntryBase {
  kind: 'group'
  label: string
  fa: string
  color: string
  children: readonly NavItem[]
}

export type NavEntry = NavSection | NavSubheading | NavItem | NavGroup

// ---------------------------------------------------------------------------------------------
// Role sets

const S = ['student'] as const satisfies readonly Role[]
const A = ['admin'] as const satisfies readonly Role[]
const SA_ = ['student', 'admin'] as const satisfies readonly Role[]
/** Pusat AI block roles: student, admin, teacher and school_admin screenshots all show it. */
const AI_ALL = ['student', 'admin', 'teacher', 'school_admin'] as const satisfies readonly Role[]
/** Teacher sidebar (roles-matrix/guru screenshots). */
const T = ['teacher'] as const satisfies readonly Role[]
/** School-admin sidebar (roles-matrix/admin sekolah screenshots). */
const SCH = ['school_admin'] as const satisfies readonly Role[]
/**
 * Roles without screenshots (parent, sponsor, PPD, JPN: INFERRED) plus student and admin. Used for
 * "Dashboard" and the sidebar account links; teacher and school_admin have their own copies in
 * their observed position (LAIN-LAIN) and no "Dashboard" → /dashboard.
 */
const DASH = [
  'student',
  'admin',
  'parent',
  'sponsor',
  'ppd_officer',
  'jpn_officer',
] as const satisfies readonly Role[]

// ---------------------------------------------------------------------------------------------
// Badge class strings (design-system §4, copied from the capture)

const B_SPM = 'ml-auto px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full'
const B_PRO =
  'ml-auto px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full'
const B_AI =
  'ml-auto text-[8px] bg-gradient-to-r from-purple-500 to-pink-500 text-white px-1.5 py-0.5 rounded-full font-bold'
const B_NEW_ITEM = 'ml-auto text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold'
const B_NEW_SECTION =
  'text-[8px] bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-1.5 py-0.5 rounded-full font-bold'
const B_DEV =
  'ml-auto text-[8px] bg-gradient-to-r from-amber-500 to-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold'
const B_LIVE =
  'ml-auto text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse'
const B_BARU =
  'ml-auto px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full'
const B_GAME =
  'ml-auto px-1.5 py-0.5 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 text-[10px] font-bold rounded-full'
const B_TICKET =
  'ml-auto px-1.5 py-0.5 bg-gradient-to-r from-fuchsia-100 to-pink-100 text-fuchsia-700 text-[10px] font-bold rounded-full'
const B_GOLD =
  'ml-auto px-1.5 py-0.5 bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 text-[10px] font-bold rounded-full'
const B_COUNT_AMBER =
  'ml-auto px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full'
const B_COUNT_RED =
  'ml-auto px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full'

/*
 * Student-only badges seen in the murid screenshots. The text is OBSERVED; the class strings are
 * INFERRED from the screenshot colours in the live badge pattern (the markup was not captured).
 */
const B_NEW_PINK_INFERRED =
  'ml-auto text-[8px] bg-gradient-to-r from-pink-500 to-rose-500 text-white px-1.5 py-0.5 rounded-full font-bold'
const B_NEW_PURPLE_INFERRED =
  'ml-auto text-[8px] bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-1.5 py-0.5 rounded-full font-bold'
const B_NEW_ORANGE_INFERRED =
  'ml-auto text-[8px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold'
const B_DIGITAL_INFERRED =
  'ml-auto text-[8px] bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-1.5 py-0.5 rounded-full font-bold'

/** Pusat AI sub-heading span (live `text-[10px] font-bold uppercase tracking-wider <colour>`). */
const sub = (colour: string) => `text-[10px] font-bold uppercase tracking-wider ${colour}`

// ---------------------------------------------------------------------------------------------
// The menu

// One entry per line, in live order (easier to review against the capture than wrapped objects).
// prettier-ignore
export const USER_NAV: readonly NavEntry[] = [
  // ── Top (OBSERVED sidebar; the drawer shows only "Dashboard") ──
  { kind: 'item', id: 'dashboard', label: 'Dashboard', to: '/dashboard', fa: 'fa-home', color: '', roles: DASH },
  { kind: 'item', id: 'target-spm', label: 'Target SPM', to: '/target-spm', fa: 'fa-bullseye', color: 'text-rose-500', tip: 'Tetapkan target gred SPM dan pantau kemajuan', surfaces: ['sidebar'], roles: SA_ },
  { kind: 'item', id: 'misi-harian', label: 'Misi Harian', to: '/misi-harian', fa: 'fa-rocket', color: 'text-amber-500', tip: 'Misi latih tubi harian dari guru', surfaces: ['sidebar'], roles: SA_ },
  { kind: 'item', id: 'remedial', label: 'Remedial', to: '/remedial/saya', fa: 'fa-flask', color: 'text-rose-500', tip: 'Ujian pemulihan untuk topik lemah', surfaces: ['sidebar'], roles: SA_ },

  // ── SPM ──
  { kind: 'section', id: 'sec-spm', label: 'SPM', text: 'text-amber-700', rule: 'from-amber-300', roles: SA_ },
  { kind: 'item', id: 'spm', label: 'SPM', to: '/spm', fa: 'fa-graduation-cap', color: 'text-amber-500', badge: { text: 'SPM', cls: B_SPM }, roles: SA_ },
  { kind: 'item', id: 'headcount', label: 'Headcount', to: '/headcount', fa: 'fa-chart-line', color: 'text-blue-500', roles: SA_ },
  { kind: 'item', id: 'prestasi', label: 'Prestasi', to: '/prestasi', fa: 'fa-chart-bar', color: 'text-emerald-500', roles: SA_ },
  { kind: 'item', id: 'analitik-adaptif', label: 'Analitik Adaptif', to: '/analitik/pelajar', fa: 'fa-brain', color: 'text-violet-500', roles: SA_ },
  { kind: 'item', id: 'analisa-item', label: 'Analisa Item', to: '/analisa-item', fa: 'fa-magnifying-glass-chart', color: 'text-rose-500', roles: SA_ },
  // Drawer-only on live (admin capture, SPM block).
  { kind: 'item', id: 'amaran-awal', label: 'Amaran Awal', to: '/amaran', fa: 'fa-exclamation-triangle', color: 'text-amber-500', roles: A },
  { kind: 'item', id: 'kombo', label: 'Kombo', to: '/kombo', fa: 'fa-fire', color: 'text-orange-500', roles: SA_ },
  { kind: 'item', id: 'laporan-mingguan', label: 'Laporan Mingguan', to: '/laporan-mingguan', fa: 'fa-file-lines', color: 'text-indigo-500', roles: SA_ },

  // ── School admin: first entry (admin-sekolah screenshot). Href INFERRED. ──
  { kind: 'item', id: 'sa-command-center', label: 'Command Center', to: '/admin-sekolah/command-center', fa: 'fa-satellite-dish', color: 'text-indigo-200', variant: 'command', target: '_blank', badge: { text: 'LIVE', cls: B_LIVE }, roles: SCH },

  // ── Teacher, part 1 (guru screenshots: Command Center, HARIAN, PENGAJARAN, PENILAIAN,
  //    ANALITIK; the Pusat AI block follows). Hrefs/icons as the admin drawer capture's teacher
  //    items where the same item exists; otherwise INFERRED (marked). ──
  { kind: 'item', id: 't-command-center', label: 'Command Center', to: '/guru/command-center', fa: 'fa-satellite-dish', color: 'text-indigo-200', variant: 'command', target: '_blank', badge: { text: 'LIVE', cls: B_LIVE }, roles: T },
  { kind: 'section', id: 't-sec-harian', label: 'HARIAN', text: 'text-teal-700', rule: 'from-teal-300', roles: T },
  { kind: 'item', id: 't-dashboard-guru', label: 'Dashboard Guru', to: '/guru', fa: 'fa-chart-pie', color: 'text-teal-500', roles: T },
  // The screenshot shows a small pill after "Headcount", hidden under a tick mark: not transcribed.
  { kind: 'item', id: 't-headcount', label: 'Headcount', to: '/headcount', fa: 'fa-chart-line', color: 'text-blue-500', roles: T },
  { kind: 'item', id: 't-misi-harian', label: 'Misi Harian', to: '/guru/misi-harian', fa: 'fa-rocket', color: 'text-amber-500', roles: T },
  { kind: 'item', id: 't-soalan-by-chapter', label: 'Soalan by Chapter', to: '/practice/chapter', fa: 'fa-layer-group', color: 'text-emerald-500', roles: T },
  // INFERRED href and icon.
  { kind: 'item', id: 't-verify-struktur', label: 'Verify Soalan Struktur', to: '/guru/verify-soalan-struktur', fa: 'fa-shield-halved', color: 'text-slate-500', roles: T },
  // INFERRED href and icon.
  { kind: 'item', id: 't-verify-mcq', label: 'Verify Soalan MCQ', to: '/guru/verify-soalan-mcq', fa: 'fa-list-check', color: 'text-slate-500', roles: T },
  { kind: 'item', id: 't-kelas-saya', label: 'Kelas Saya', to: '/guru/kelas', fa: 'fa-chalkboard-teacher', color: 'text-teal-500', roles: T },
  { kind: 'item', id: 't-pelajar-saya', label: 'Pelajar Saya', to: '/guru/pelajar', fa: 'fa-user-graduate', color: 'text-blue-500', roles: T },
  { kind: 'item', id: 't-kehadiran-digital', label: 'Kehadiran Digital', to: '/guru/kehadiran-digital', fa: 'fa-clipboard-check', color: 'text-green-500', roles: T },
  { kind: 'section', id: 't-sec-pengajaran', label: 'PENGAJARAN', text: 'text-blue-700', rule: 'from-blue-300', roles: T },
  { kind: 'item', id: 't-jadual-belajar', label: 'Jadual Belajar', to: '/guru/jadual-belajar', fa: 'fa-calendar-alt', color: 'text-purple-500', roles: T },
  { kind: 'item', id: 't-broadcast', label: 'Broadcast', to: '/guru/broadcast', fa: 'fa-bullhorn', color: 'text-amber-500', roles: T },
  { kind: 'item', id: 't-kelas-live', label: 'Kelas Live', to: '/guru/live-kelas', fa: 'fa-broadcast-tower', color: 'text-red-500', roles: T },
  { kind: 'section', id: 't-sec-penilaian', label: 'PENILAIAN', text: 'text-amber-700', rule: 'from-amber-300', roles: T },
  { kind: 'item', id: 't-prestasi', label: 'Prestasi', to: '/prestasi/kelas', fa: 'fa-chart-bar', color: 'text-emerald-500', roles: T },
  { kind: 'item', id: 't-laporan', label: 'Laporan', to: '/guru/laporan', fa: 'fa-chart-pie', color: 'text-orange-500', roles: T },
  { kind: 'item', id: 't-amaran-awal', label: 'Amaran Awal', to: '/amaran', fa: 'fa-exclamation-triangle', color: 'text-amber-500', roles: T },
  { kind: 'section', id: 't-sec-analitik', label: 'ANALITIK', text: 'text-indigo-700', rule: 'from-indigo-300', roles: T },
  { kind: 'item', id: 't-monitoring', label: 'Monitoring', to: '/guru/monitoring', fa: 'fa-binoculars', color: 'text-teal-500', roles: T },
  {
    kind: 'group',
    id: 't-kirkpatrick',
    label: 'Kirkpatrick',
    fa: 'fa-microscope',
    color: 'text-cyan-500',
    roles: T,
    children: [
      { kind: 'item', id: 't-kirk-ringkasan', label: 'Ringkasan', to: '/guru/kirkpatrick', fa: 'fa-home', color: '' },
      { kind: 'item', id: 't-kirk-reaksi', label: 'T1: Reaksi', to: '/guru/kirkpatrick/reaction', fa: 'fa-smile', color: '' },
      { kind: 'item', id: 't-kirk-pembelajaran', label: 'T2: Pembelajaran', to: '/guru/kirkpatrick/learning', fa: 'fa-graduation-cap', color: '' },
      { kind: 'item', id: 't-kirk-tingkah-laku', label: 'T3: Tingkah Laku', to: '/guru/kirkpatrick/behavior', fa: 'fa-running', color: '' },
      { kind: 'item', id: 't-kirk-hasil', label: 'T4: Hasil', to: '/guru/kirkpatrick/results', fa: 'fa-trophy', color: '' },
      { kind: 'item', id: 't-kirk-rantaian', label: 'Rantaian Impak', to: '/guru/kirkpatrick/chain', fa: 'fa-link', color: '' },
      { kind: 'item', id: 't-kirk-intervensi', label: 'Intervensi', to: '/guru/kirkpatrick/interventions', fa: 'fa-hand-holding-medical', color: '' },
    ],
  },
  // INFERRED hrefs (the student items of the same label).
  { kind: 'item', id: 't-analitik-adaptif', label: 'Analitik Adaptif', to: '/analitik/pelajar', fa: 'fa-brain', color: 'text-violet-500', roles: T },
  { kind: 'item', id: 't-analisa-item', label: 'Analisa Item', to: '/analisa-item', fa: 'fa-magnifying-glass-chart', color: 'text-rose-500', roles: T },
  { kind: 'item', id: 't-perbandingan-kelas', label: 'Perbandingan Kelas', to: '/guru/perbandingan-kelas', fa: 'fa-balance-scale', color: 'text-purple-500', roles: T },
  { kind: 'item', id: 't-laporan-mingguan', label: 'Laporan Mingguan', to: '/laporan-mingguan', fa: 'fa-calendar-week', color: 'text-emerald-500', roles: T },

  // ── Pusat AI (one live partial, same markup in sidebar and drawer) ──
  { kind: 'section', id: 'sec-pusat-ai', label: 'Pusat AI', text: '', rule: 'from-purple-300', variant: 'gradient', badge: { text: 'NEW', cls: B_NEW_SECTION }, roles: AI_ALL },

  // Student-only sub-blocks (murid screenshots). Labels and order OBSERVED; hrefs, icons and
  // heading colours INFERRED unless noted (the student markup was not captured).
  { kind: 'subheading', id: 'sub-cita-cita', label: '✨ Cita-Cita Hijrah', cls: sub('text-amber-600/80'), roles: S },
  { kind: 'item', id: 'cita-cita-saya', label: 'Cita-Cita Saya', to: '/cita-cita', fa: 'fa-star', color: 'text-pink-600', variant: 'ai', badge: { text: 'NEW', cls: B_NEW_PINK_INFERRED }, roles: S },
  { kind: 'item', id: 'universiti', label: 'Universiti', to: '/cita-cita/universiti', fa: 'fa-building-columns', color: 'text-indigo-600', variant: 'ai', roles: S },
  { kind: 'item', id: 'biasiswa', label: 'Biasiswa', to: '/cita-cita/biasiswa', fa: 'fa-coins', color: 'text-emerald-600', variant: 'ai', roles: S },
  { kind: 'subheading', id: 'sub-streak', label: '🔥 Streak & Syiling', cls: sub('text-orange-600/80'), roles: S },
  { kind: 'item', id: 'streak-saya', label: 'Streak Saya', to: '/streak', fa: 'fa-fire', color: 'text-orange-500', variant: 'ai', badge: { text: '1', cls: B_COUNT_AMBER }, roles: S },
  { kind: 'subheading', id: 'sub-nota', label: '📝 Nota Ringkas', cls: sub('text-orange-600/80'), roles: S },
  // href OBSERVED as a live link elsewhere (M06 inventory, `/pusat-nota-ringkas`).
  { kind: 'item', id: 'pusat-nota-ringkas', label: 'Pusat Nota Ringkas', to: '/pusat-nota-ringkas', fa: 'fa-compass', color: 'text-indigo-600', variant: 'ai', roles: S },
  { kind: 'item', id: 'buku-nota-saya', label: 'Buku Nota Saya', to: '/buku-nota-saya', fa: 'fa-book', color: 'text-blue-600', variant: 'ai', roles: S },
  { kind: 'item', id: 'pusat-kerjaya', label: 'Pusat Kerjaya', to: '/pusat-kerjaya', fa: 'fa-briefcase', color: 'text-teal-600', variant: 'ai', roles: S },
  { kind: 'item', id: 'pusat-ilmu-sekolah', label: 'Pusat Ilmu Sekolah', to: '/pusat-ilmu-sekolah', fa: 'fa-graduation-cap', color: 'text-emerald-600', variant: 'ai', roles: S },
  { kind: 'item', id: 'psikometrik', label: 'Psikometrik', to: '/psikometrik', fa: 'fa-brain', color: 'text-pink-600', variant: 'ai', badge: { text: 'NEW', cls: B_NEW_PINK_INFERRED }, roles: S },
  { kind: 'item', id: 'heatmap-topik-lemah', label: 'Heatmap Topik Lemah', to: '/buku-nota/heatmap', fa: 'fa-fire', color: 'text-red-600', variant: 'ai', roles: S },

  { kind: 'subheading', id: 'sub-cikgu-alesa-ai', label: '🤖 Cikgu Alesa AI', cls: sub('text-purple-600/80'), roles: AI_ALL },
  { kind: 'item', id: 'cikgu-alesa-chat', label: 'Cikgu Alesa Chat', to: '/cikgu', fa: 'fa-robot', color: 'text-purple-600', variant: 'ai', tip: 'Bual dengan Cikgu Alesa — guru maya pakar SPM yang ingat nama dan progress anda', badge: { text: 'AI', cls: B_AI }, roles: AI_ALL },

  { kind: 'subheading', id: 'sub-visi-ai', label: '✨ Visi & Pertandingan', cls: sub('text-indigo-600/80'), roles: AI_ALL },
  // Student only (murid screenshot); INFERRED href (same page as the "Profil Cerah" item below).
  { kind: 'item', id: 'profil-cerah-ai', label: 'Profil Cerah', to: '/profil-cerah', fa: 'fa-magic', color: 'text-indigo-500', variant: 'ai', badge: { text: 'NEW', cls: B_NEW_PURPLE_INFERRED }, roles: S },
  { kind: 'item', id: 'sekolah-bersaing-ai', label: 'Sekolah Bersaing', to: '/sekolah-bersaing', fa: 'fa-trophy', color: 'text-amber-500', variant: 'ai', tip: 'Leaderboard mingguan sekolah-sekolah Malaysia', badge: { text: 'NEW', cls: B_NEW_ITEM }, roles: AI_ALL },
  { kind: 'item', id: 'tetapan-peribadi', label: 'Tetapan Peribadi', to: '/tetapan', fa: 'fa-cog', color: 'text-slate-600', variant: 'ai', tip: 'Tetapan rohani, masa Subuh, mod Ramadan', roles: AI_ALL },

  { kind: 'subheading', id: 'sub-bilik-duta-preview', label: '🏆 Bilik Duta · 🔒 PREVIEW', cls: sub('text-amber-600/80'), roles: A },
  { kind: 'item', id: 'bilik-duta-preview', label: 'Bilik Duta', to: '/bilik-duta', fa: 'fa-crown', color: 'text-amber-500', variant: 'ai', tip: 'Bilik Duta — preview admin sahaja', badge: { text: 'DEV', cls: B_DEV }, roles: A },

  { kind: 'subheading', id: 'sub-ai-pelajar', label: '🤖 AI Pintar (Pelajar)', cls: sub('text-emerald-600/80'), roles: AI_ALL },
  // Student only (murid screenshot). "Cikgu Suara" and "SPM Mock Exam" hrefs as the Killer
  // Features items; the SPM Mock tooltip is OBSERVED in the screenshot.
  { kind: 'item', id: 'cikgu-suara-ai', label: 'Cikgu Suara', to: '/cikgu-suara', fa: 'fa-microphone', color: 'text-slate-600', variant: 'ai', roles: S },
  { kind: 'item', id: 'spm-mock-ai', label: 'SPM Mock Exam', to: '/spm-mock', fa: 'fa-file-pen', color: 'text-orange-700', variant: 'ai', tip: 'Mock SPM penuh — timer + auto-grade', badge: { text: 'NEW', cls: B_NEW_ORANGE_INFERRED }, roles: S },
  { kind: 'item', id: 'mood-saya', label: 'Mood Saya', to: '/pusat-ai/mood', fa: 'fa-smile', color: 'text-amber-500', variant: 'ai', roles: S },
  { kind: 'item', id: 'wellbeing-alerts-ai', label: 'Wellbeing Alerts', to: '/wellbeing/alerts', fa: 'fa-triangle-exclamation', color: 'text-red-600', variant: 'ai', tip: 'Wellbeing alerts pelajar di sekolah anda', roles: ['admin', 'teacher', 'school_admin'] },
  { kind: 'item', id: 'kamus-ai', label: 'Kamus AI', to: '/pusat-ai/kamus', fa: 'fa-book-open', color: 'text-cyan-600', variant: 'ai', tip: 'BM↔EN, istilah teknikal, Jawi-Rumi, sinonim', roles: AI_ALL },
  // Student only; href `/pusat-ai/spm` OBSERVED for "SPM Walkthrough" in the admin shell (M06 FN-1.2.7).
  { kind: 'item', id: 'spm-walkthrough', label: 'SPM Walkthrough', to: '/pusat-ai/spm', fa: 'fa-pen-to-square', color: 'text-rose-600', variant: 'ai', roles: S },
  { kind: 'item', id: 'pendamping-motivasi', label: 'Pendamping Motivasi', to: '/pusat-ai/pendamping', fa: 'fa-heart', color: 'text-purple-600', variant: 'ai', tip: 'Pendamping motivasi — bukan kaunselor klinikal', roles: AI_ALL },
  { kind: 'item', id: 'doa-motivasi', label: 'Doa & Motivasi', to: '/pusat-ai/doa', fa: 'fa-mosque', color: 'text-emerald-600', variant: 'ai', tip: 'Doa belajar/exam, hadis pendidikan, ayat motivasi', roles: AI_ALL },

  { kind: 'subheading', id: 'sub-ai-guru', label: '🎯 AI Pintar (Guru)', cls: sub('text-blue-600/80'), roles: ['admin', 'teacher', 'school_admin'] },
  { kind: 'item', id: 'aktiviti-advisor', label: 'Aktiviti Advisor', to: '/pusat-ai/aktiviti', fa: 'fa-lightbulb', color: 'text-green-600', variant: 'ai', tip: 'Cadangan aktiviti pembelajaran B40-aware', roles: ['admin', 'teacher', 'school_admin'] },
  { kind: 'item', id: 'whiteboard-quiz', label: 'Whiteboard → Quiz', to: '/pusat-ai/whiteboard', fa: 'fa-clipboard-question', color: 'text-blue-600', variant: 'ai', tip: 'Snap whiteboard → 5 soalan exit-ticket dalam 20 saat', roles: ['admin', 'teacher', 'school_admin'] },
  { kind: 'item', id: 'rph-cikgu-alesa', label: 'RPH (Cikgu Alesa)', to: '/cikgu/rph', fa: 'fa-clipboard-list', color: 'text-emerald-600', variant: 'ai', tip: 'Cikgu Alesa jana RPH AI mengikut DSKP — siap untuk dicetak', roles: ['admin', 'teacher', 'school_admin'] },
  { kind: 'item', id: 'semak-karangan', label: 'Semak Karangan (Cikgu Alesa)', to: '/cikgu/essay', fa: 'fa-pen-fancy', color: 'text-amber-600', variant: 'ai', tip: 'Cikgu Alesa bantu semak karangan pelajar dengan rubrik DSKP', roles: ['admin', 'teacher', 'school_admin'] },
  { kind: 'item', id: 'pbd-cikgu-alesa', label: 'PBD (Cikgu Alesa)', to: '/cikgu/pbd', fa: 'fa-tasks', color: 'text-rose-600', variant: 'ai', tip: 'Cikgu Alesa bantu Pentaksiran Bilik Darjah — TP rollup dari aktiviti', roles: ['admin', 'teacher', 'school_admin'] },

  { kind: 'subheading', id: 'sub-kawalan-kualiti', label: '🛡️ Kawalan Kualiti', cls: sub('text-violet-600/80'), roles: ['admin', 'school_admin'] },
  { kind: 'item', id: 'semakan-nota-master', label: 'Semakan Nota Master', to: '/admin/master-notes', fa: 'fa-shield-alt', color: 'text-violet-600', variant: 'ai', tip: 'Semak dan approve nota AI yang flagged — quality compounds untuk semua pelajar', roles: ['admin', 'school_admin'] },
  { kind: 'item', id: 'audit-log', label: 'Audit Log', to: '/admin/audit-log', fa: 'fa-clipboard-check', color: 'text-slate-600', variant: 'ai', tip: 'Audit log AI - PDPA & KPM compliance, CSV export', roles: ['admin', 'school_admin'] },

  // ── Teacher, part 2 (guru screenshots: BANK SOALAN, AKTIVITI, LAIN-LAIN; Bantuan is shared) ──
  { kind: 'section', id: 't-sec-bank-soalan', label: 'BANK SOALAN', text: 'text-emerald-700', rule: 'from-emerald-300', roles: T },
  { kind: 'item', id: 't-sumbang-soalan', label: 'Sumbang Soalan', to: '/guru/soalan', fa: 'fa-pen-fancy', color: 'text-emerald-500', roles: T },
  { kind: 'item', id: 't-soalan-rujukan', label: 'Soalan & Rujukan', to: '/guru/soalan-guru', fa: 'fa-book-open', color: 'text-teal-500', roles: T },
  { kind: 'item', id: 't-soalan-berstruktur', label: 'Soalan Berstruktur', to: '/guru/soalan-berstruktur', fa: 'fa-list-ol', color: 'text-cyan-500', roles: T },
  { kind: 'item', id: 't-databank', label: 'Databank Soalan', to: '/guru/databank', fa: 'fa-database', color: 'text-violet-500', roles: T },
  { kind: 'item', id: 't-set-soalan', label: 'Set Soalan', to: '/guru/set-soalan', fa: 'fa-clipboard-list', color: 'text-cyan-500', roles: T },
  // Smaller text in the screenshot, as the student "Audio KBAT" (drawer classes). Href INFERRED.
  { kind: 'item', id: 't-audio-kbat', label: 'Audio KBAT', to: '/audio-kbat', fa: 'fa-headphones', color: 'text-amber-500', variant: 'drawer-style', roles: T },
  // INFERRED hrefs and icons.
  { kind: 'item', id: 't-kertas-peperiksaan', label: 'Kertas Peperiksaan', to: '/guru/kertas-peperiksaan', fa: 'fa-file-pdf', color: 'text-red-500', roles: T },
  { kind: 'item', id: 't-penjana-peperiksaan', label: 'Penjana Peperiksaan', to: '/guru/penjana-peperiksaan', fa: 'fa-wand-magic-sparkles', color: 'text-pink-500', roles: T },
  // Heading colours INFERRED (purple in the screenshot).
  { kind: 'section', id: 't-sec-aktiviti', label: 'AKTIVITI', text: 'text-purple-700', rule: 'from-purple-300', roles: T },
  { kind: 'item', id: 't-liga', label: 'Liga Pertandingan', to: '/liga', fa: 'fa-trophy', color: 'text-yellow-500', roles: T },
  // Icon INFERRED (a shield in the screenshot).
  { kind: 'item', id: 't-tournament', label: 'Tournament', to: '/tournament', fa: 'fa-shield-halved', color: 'text-amber-500', roles: T },
  { kind: 'item', id: 't-kombo', label: 'Kombo', to: '/kombo', fa: 'fa-fire', color: 'text-orange-500', roles: T },
  { kind: 'item', id: 't-syiling-ganjaran', label: 'Syiling & Ganjaran', to: '/guru/gamifikasi', fa: 'fa-coins', color: 'text-amber-500', roles: T },
  { kind: 'section', id: 't-sec-lain-lain', label: 'LAIN-LAIN', text: 'text-slate-700', rule: 'from-slate-300', roles: T },
  { kind: 'item', id: 't-perutusan', label: 'Perutusan', to: '/perutusan', fa: 'fa-scroll', color: 'text-amber-500', roles: T },
  { kind: 'item', id: 't-video', label: 'Video', to: '/video', fa: 'fa-play-circle', color: 'text-emerald-500', roles: T },
  { kind: 'item', id: 't-sumbang-artikel', label: 'Sumbang Artikel', to: '/guru/artikel', fa: 'fa-newspaper', color: 'text-orange-500', roles: T },
  // Account links in the teacher's LAIN-LAIN (icon INFERRED: an id card). The drawer shows them
  // in its account section instead, so they are sidebar-only (as the general ones).
  { kind: 'item', id: 't-profil-saya', label: 'Profil Saya', to: '/profile', fa: 'fa-id-card', color: 'text-emerald-600', surfaces: ['sidebar'], roles: T },
  { kind: 'item', id: 't-panduan', label: 'Panduan', to: '/panduan', fa: 'fa-book', color: 'text-indigo-400', surfaces: ['sidebar'], roles: T },
  { kind: 'item', id: 't-analisis-item', label: 'Analisis Item', to: '/guru/analisis-item', fa: 'fa-chart-pie', color: 'text-indigo-500', roles: T },

  // ── School admin (admin-sekolah screenshots, after Pusat AI … Kawalan Kualiti). Labels and order
  //    OBSERVED; hrefs INFERRED under `/admin-sekolah/` (only `/admin-sekolah` itself, the active
  //    "Dashboard", is observed) unless the same item exists elsewhere; icons and heading colours
  //    INFERRED from the screenshot. ──
  { kind: 'section', id: 'sa-sec-harian', label: 'HARIAN', text: 'text-teal-700', rule: 'from-teal-300', roles: SCH },
  { kind: 'item', id: 'sa-dashboard', label: 'Dashboard', to: '/admin-sekolah', fa: 'fa-home', color: '', roles: SCH },
  { kind: 'item', id: 'sa-senarai-pelajar', label: 'Senarai Pelajar', to: '/admin-sekolah/pelajar', fa: 'fa-user-graduate', color: 'text-indigo-500', roles: SCH },
  { kind: 'item', id: 'sa-senarai-guru', label: 'Senarai Guru', to: '/admin-sekolah/guru', fa: 'fa-chalkboard-teacher', color: 'text-teal-500', roles: SCH },
  { kind: 'item', id: 'sa-kelas-sekolah', label: 'Kelas Sekolah', to: '/admin-sekolah/kelas', fa: 'fa-door-open', color: 'text-red-500', roles: SCH },
  { kind: 'section', id: 'sa-sec-pengurusan', label: 'PENGURUSAN', text: 'text-blue-700', rule: 'from-blue-300', roles: SCH },
  { kind: 'item', id: 'sa-urus-pengguna', label: 'Urus Pengguna', to: '/admin-sekolah/pengguna', fa: 'fa-users', color: 'text-indigo-500', roles: SCH },
  { kind: 'item', id: 'sa-import-pelajar', label: 'Import Pelajar', to: '/admin-sekolah/import-pelajar', fa: 'fa-file-import', color: 'text-emerald-500', roles: SCH },
  { kind: 'item', id: 'sa-aktiviti-guru', label: 'Aktiviti Guru', to: '/admin-sekolah/aktiviti-guru', fa: 'fa-users', color: 'text-teal-500', roles: SCH },
  { kind: 'item', id: 'sa-langganan', label: 'Langganan', to: '/admin-sekolah/langganan', fa: 'fa-file-contract', color: 'text-emerald-500', roles: SCH },
  { kind: 'item', id: 'sa-invois', label: 'Invois', to: '/admin-sekolah/invois', fa: 'fa-file-invoice', color: 'text-amber-500', roles: SCH },
  { kind: 'section', id: 'sa-sec-penilaian', label: 'PENILAIAN', text: 'text-amber-700', rule: 'from-amber-300', roles: SCH },
  { kind: 'item', id: 'sa-headcount', label: 'Headcount', to: '/headcount', fa: 'fa-chart-line', color: 'text-blue-500', roles: SCH },
  { kind: 'item', id: 'sa-prestasi', label: 'Prestasi', to: '/prestasi', fa: 'fa-chart-bar', color: 'text-emerald-500', roles: SCH },
  { kind: 'item', id: 'sa-amaran-awal', label: 'Amaran Awal', to: '/amaran/sekolah', fa: 'fa-exclamation-triangle', color: 'text-amber-500', roles: SCH },
  { kind: 'item', id: 'sa-laporan-bulanan', label: 'Laporan Bulanan', to: '/admin-sekolah/laporan-bulanan', fa: 'fa-calendar-alt', color: 'text-blue-500', roles: SCH },
  { kind: 'section', id: 'sa-sec-analitik', label: 'ANALITIK', text: 'text-indigo-700', rule: 'from-indigo-300', roles: SCH },
  { kind: 'item', id: 'sa-monitoring', label: 'Monitoring', to: '/admin-sekolah/monitoring', fa: 'fa-binoculars', color: 'text-teal-500', roles: SCH },
  // Shown collapsed in the screenshot (its sub-items are not visible): rendered as a link.
  { kind: 'item', id: 'sa-kirkpatrick', label: 'Kirkpatrick', to: '/admin-sekolah/kirkpatrick', fa: 'fa-microscope', color: 'text-cyan-500', roles: SCH },
  { kind: 'item', id: 'sa-analitik-adaptif', label: 'Analitik Adaptif', to: '/analitik/pelajar', fa: 'fa-brain', color: 'text-violet-500', roles: SCH },
  { kind: 'item', id: 'sa-statistik-penggunaan', label: 'Statistik Penggunaan', to: '/admin-sekolah/statistik-penggunaan', fa: 'fa-chart-pie', color: 'text-purple-500', roles: SCH },
  { kind: 'item', id: 'sa-dskp-heatmap', label: 'DSKP Heatmap', to: '/admin-sekolah/dskp-heatmap', fa: 'fa-table-cells', color: 'text-emerald-500', roles: SCH },
  { kind: 'item', id: 'sa-analisa-item', label: 'Analisa Item', to: '/analisa-item', fa: 'fa-magnifying-glass-chart', color: 'text-purple-500', roles: SCH },
  { kind: 'item', id: 'sa-laporan-aktiviti', label: 'Laporan Aktiviti', to: '/admin-sekolah/laporan-aktiviti', fa: 'fa-file-lines', color: 'text-orange-500', roles: SCH },
  { kind: 'section', id: 'sa-sec-akademik', label: 'AKADEMIK', text: 'text-emerald-700', rule: 'from-emerald-300', roles: SCH },
  // The screenshot crop ends after "Soalan Berstruktur" and resumes at "Kombo Harian": a further
  // AKADEMIK item or heading may be hidden between the two crops (not observable).
  { kind: 'item', id: 'sa-soalan-berstruktur', label: 'Soalan Berstruktur', to: '/latihan-berstruktur', fa: 'fa-list-ol', color: 'text-cyan-500', roles: SCH },
  { kind: 'item', id: 'sa-kombo-harian', label: 'Kombo Harian', to: '/kombo', fa: 'fa-fire', color: 'text-emerald-500', roles: SCH },
  { kind: 'item', id: 'sa-liga', label: 'Liga Pertandingan', to: '/liga', fa: 'fa-trophy', color: 'text-yellow-500', roles: SCH },
  { kind: 'item', id: 'sa-tournament', label: 'Tournament', to: '/tournament', fa: 'fa-shield-halved', color: 'text-amber-500', roles: SCH },
  { kind: 'section', id: 'sa-sec-lain-lain', label: 'LAIN-LAIN', text: 'text-slate-700', rule: 'from-slate-300', roles: SCH },
  { kind: 'item', id: 'sa-perutusan', label: 'Perutusan', to: '/perutusan', fa: 'fa-scroll', color: 'text-amber-500', roles: SCH },
  { kind: 'item', id: 'sa-video', label: 'Video', to: '/video', fa: 'fa-play-circle', color: 'text-emerald-500', roles: SCH },
  { kind: 'item', id: 'sa-profil-saya', label: 'Profil Saya', to: '/profile', fa: 'fa-user-circle', color: 'text-indigo-600', surfaces: ['sidebar'], roles: SCH },
  { kind: 'item', id: 'sa-panduan', label: 'Panduan', to: '/panduan', fa: 'fa-book', color: 'text-indigo-400', surfaces: ['sidebar'], roles: SCH },

  // ── 🏆 Bilik Duta ──
  { kind: 'section', id: 'sec-bilik-duta', label: '🏆 Bilik Duta', text: 'text-amber-700', rule: 'from-amber-300', roles: SA_ },
  { kind: 'item', id: 'bilik-duta', label: 'Bilik Duta', to: '/bilik-duta', fa: 'fa-crown', color: 'text-amber-500', roles: SA_ },
  { kind: 'item', id: 'akademi-duta', label: 'Akademi Duta', to: '/akademi-duta', fa: 'fa-graduation-cap', color: 'text-purple-500', roles: SA_ },
  { kind: 'item', id: 'kem-bootcamp', label: 'Kem & Bootcamp', to: '/bilik-duta/kem', fa: 'fa-campground', color: 'text-rose-500', roles: SA_ },

  // ── ✨ Visi & Pertandingan ──
  { kind: 'section', id: 'sec-visi', label: '✨ Visi & Pertandingan', text: 'text-indigo-700', rule: 'from-indigo-300', roles: SA_ },
  { kind: 'item', id: 'profil-cerah', label: 'Profil Cerah', to: '/profil-cerah', fa: 'fa-magic', color: 'text-indigo-500', roles: SA_ },
  { kind: 'item', id: 'sekolah-bersaing', label: 'Sekolah Bersaing', to: '/sekolah-bersaing', fa: 'fa-trophy', color: 'text-amber-500', roles: SA_ },
  { kind: 'item', id: 'cita-cita-hijrah', label: 'Cita-Cita Hijrah', to: '/cita-cita', fa: 'fa-star', color: 'text-pink-500', roles: SA_ },

  // ── 💎 Killer Features ──
  { kind: 'section', id: 'sec-killer', label: '💎 Killer Features', text: 'text-fuchsia-700', rule: 'from-fuchsia-300', roles: SA_ },
  { kind: 'item', id: 'cikgu-suara', label: 'Cikgu Suara', to: '/cikgu-suara', fa: 'fa-microphone', color: 'text-fuchsia-500', roles: SA_ },
  { kind: 'item', id: 'spm-mock', label: 'SPM Mock Exam', to: '/spm-mock', fa: 'fa-file-pen', color: 'text-orange-700', roles: SA_ },
  { kind: 'item', id: 'wellbeing-alerts', label: 'Wellbeing Alerts', to: '/wellbeing/alerts', fa: 'fa-triangle-exclamation', color: 'text-red-500', roles: SA_ },
  { kind: 'item', id: 'pembetulan', label: 'Pembetulan', to: '/pembetulan', fa: 'fa-arrows-rotate', color: 'text-teal-500', roles: SA_ },
  { kind: 'item', id: 'mohon-keluarga-angkat', label: 'Mohon Keluarga Angkat', to: '/mohon-keluarga-angkat', fa: 'fa-hand-holding-heart', color: 'text-pink-500', roles: SA_ },
  { kind: 'item', id: 'penguasaan', label: 'Penguasaan', to: '/penguasaan', fa: 'fa-layer-group', color: 'text-purple-500', roles: SA_ },
  { kind: 'item', id: 'laporan-soalan', label: 'Laporan Soalan', to: '/laporan-soalan', fa: 'fa-flag', color: 'text-red-400', roles: SA_ },
  { kind: 'item', id: 'liga', label: 'Liga Pertandingan', to: '/liga', fa: 'fa-trophy', color: 'text-yellow-500', roles: SA_ },
  { kind: 'item', id: 'perutusan', label: 'Perutusan', to: '/perutusan', fa: 'fa-scroll', color: 'text-amber-500', roles: SA_ },

  // ── Pembelajaran ──
  { kind: 'section', id: 'sec-pembelajaran', label: 'Pembelajaran', text: 'text-blue-700', rule: 'from-blue-300', roles: SA_ },
  { kind: 'item', id: 'latih-tubi', label: 'Latih Tubi', to: '/practice', fa: 'fa-brain', color: 'icon-brain', activeExcept: ['/practice/chapter', '/practice/revision', '/practice/progress', '/practice/history'], roles: SA_ },
  { kind: 'item', id: 'soalan-by-chapter', label: 'Soalan by Chapter', to: '/practice/chapter', fa: 'fa-layer-group', color: 'text-emerald-500', roles: SA_ },
  { kind: 'item', id: 'soalan-berstruktur', label: 'Soalan Berstruktur', to: '/latihan-berstruktur', fa: 'fa-list-ol', color: 'text-cyan-500', roles: SA_ },
  { kind: 'item', id: 'kedudukan', label: 'Kedudukan', to: '/ranking', fa: 'fa-trophy', color: 'text-amber-500', roles: SA_ },
  { kind: 'item', id: 'pksk', label: 'PKSK', to: '/pksk', fa: 'fa-shield-halved', color: 'text-indigo-500', badge: { text: 'PRO', cls: B_PRO }, roles: SA_ },
  { kind: 'item', id: 'artikel', label: 'Artikel', to: '/artikel', fa: 'fa-newspaper', color: 'text-pink-500', roles: SA_ },
  { kind: 'item', id: 'video', label: 'Video', to: '/video', fa: 'fa-play-circle', color: 'text-emerald-500', roles: SA_ },
  { kind: 'item', id: 'permainan', label: 'Permainan', to: '/permainan', fa: 'fa-gamepad', color: 'text-purple-500', badge: { text: '🎮', cls: B_GAME }, roles: SA_ },
  { kind: 'item', id: 'cabutan', label: 'Cabutan Bertuah', to: '/cabutan', fa: 'fa-ticket', color: 'text-fuchsia-500', badge: { text: '🎟️', cls: B_TICKET }, roles: SA_ },
  { kind: 'item', id: 'tournament', label: 'Tournament', to: '/tournament', fa: 'fa-trophy', color: 'text-amber-500', roles: SA_ },
  { kind: 'item', id: 'topik', label: 'Topik', to: '/topics', fa: 'fa-book-open', color: 'icon-book', roles: SA_ },
  { kind: 'item', id: 'peta-belajar', label: 'Peta Belajar', to: '/peta-belajar', fa: 'fa-map', color: 'text-cyan-500', roles: SA_ },
  { kind: 'item', id: 'kelas-saya', label: 'Kelas Saya', to: '/kelas-saya', fa: 'fa-book-reader', color: 'text-emerald-500', roles: SA_ },
  { kind: 'item', id: 'set-soalan-guru', label: 'Set Soalan Guru', to: '/set-soalan-saya', fa: 'fa-clipboard-list', color: 'text-cyan-500', roles: SA_ },
  // Live sidebar renders this one item with the drawer classes (OBSERVED, replicated).
  { kind: 'item', id: 'audio-kbat', label: 'Audio KBAT', to: '/audio-kbat', fa: 'fa-headphones', color: 'text-amber-500', variant: 'drawer-style', roles: SA_ },
  { kind: 'item', id: 'syiling-token', label: 'Syiling & Token', to: '/gamification', fa: 'fa-coins', color: 'text-amber-500', badge: { text: '🏆', cls: B_GOLD }, roles: SA_ },
  { kind: 'item', id: 'tukar-token', label: 'Tukar Token', to: '/gamification/convert', fa: 'fa-exchange-alt', color: 'text-blue-500', roles: SA_ },
  { kind: 'item', id: 'cabaran-harian', label: 'Cabaran Harian', to: '/gamification/challenges', fa: 'fa-bullseye', color: 'text-emerald-500', roles: SA_ },
  { kind: 'item', id: 'kedai-hadiah', label: 'Kedai Hadiah', to: '/gamification/rewards', fa: 'fa-gift', color: 'icon-gift', roles: SA_ },
  { kind: 'item', id: 'kelulusan-hadiah', label: 'Kelulusan Hadiah', to: '/cikgu/kelulusan-hadiah', fa: 'fa-shield-halved', color: 'text-amber-500', roles: A },
  { kind: 'item', id: 'marketplace', label: 'Marketplace', to: '/marketplace', fa: 'fa-shopping-bag', color: 'text-emerald-500', roles: SA_ },
  { kind: 'item', id: 'papan-pendahulu', label: 'Papan Pendahulu', to: '/gamification/leaderboard', fa: 'fa-trophy', color: 'icon-trophy', roles: SA_ },
  { kind: 'item', id: 'pencapaian', label: 'Pencapaian', to: '/gamification/achievements', fa: 'fa-medal', color: 'text-purple-500', roles: SA_ },
  { kind: 'item', id: 'kotak-misteri', label: 'Kotak Misteri', to: '/gamification/mystery-box', fa: 'fa-box-open', color: 'text-indigo-500', roles: SA_ },
  { kind: 'item', id: 'rujuk-kawan', label: 'Rujuk Kawan', to: '/gamification/referral', fa: 'fa-user-plus', color: 'text-green-500', roles: SA_ },
  { kind: 'item', id: 'cikgu-alesa', label: 'Cikgu Alesa', to: '/cikgu', fa: 'fa-robot', color: 'text-purple-500', badge: { text: 'AI', cls: B_AI }, roles: SA_ },
  // Student only (murid screenshot); label (with 🎁) and "DIGITAL" OBSERVED; href `/cikgu/hadiah` per L43 discovery
  // (`/kedai-hadiah` is 404 on live, DV-M15-18 / XR-M15-13); classes INFERRED.
  { kind: 'item', id: 'kedai-hadiah-digital', label: 'Kedai Hadiah 🎁', to: '/cikgu/hadiah', fa: 'fa-gift', color: 'text-emerald-500', badge: { text: 'DIGITAL', cls: B_DIGITAL_INFERRED }, roles: S },

  // ── Cikgu Alesa Tools (admin capture) ──
  { kind: 'section', id: 'sec-cikgu-alesa-tools', label: 'Cikgu Alesa Tools', text: 'text-purple-700', rule: 'from-purple-300', wrap: 'pt-2 pb-1', roles: A },
  { kind: 'item', id: 'rph-rancangan-harian', label: 'RPH (Rancangan Harian)', to: '/cikgu/rph', fa: 'fa-file-alt', color: 'text-purple-500', roles: A },
  { kind: 'item', id: 'pbd-auto-tag', label: 'PBD Auto-Tag', to: '/cikgu/pbd', fa: 'fa-clipboard-check', color: 'text-blue-500', roles: A },
  { kind: 'item', id: 'mark-karangan', label: 'Mark Karangan', to: '/cikgu/essay', fa: 'fa-pen-fancy', color: 'text-rose-500', roles: A },
  // DV-M15-04: live `/admin/hadiah`.
  { kind: 'item', id: 'admin-tebusan', label: 'Admin Tebusan', to: '/admin/hadiah/tebusan', fa: 'fa-cogs', color: 'text-slate-500', roles: A },

  { kind: 'item', id: 'timeline-saya', label: 'Timeline Saya', to: '/timeline', fa: 'fa-camera', color: 'text-pink-500', roles: SA_ },
  // Student only (murid screenshot); href confirmed on live (L45 discovery: route exists, murid-only); icon and colour INFERRED.
  { kind: 'item', id: 'jemput-ibu-bapa', label: 'Jemput Ibu Bapa', to: '/jemput-ibu-bapa', fa: 'fa-users', color: 'text-red-500', roles: S },

  // ── Portal Guru (sidebar capture) ──
  { kind: 'section', id: 'sec-portal-guru', label: 'Portal Guru', text: 'text-teal-700', rule: 'from-teal-300', roles: A },
  { kind: 'item', id: 'dashboard-guru', label: 'Dashboard Guru', to: '/guru', fa: 'fa-chart-pie', color: 'text-teal-500', roles: A },
  { kind: 'item', id: 'kelas-guru', label: 'Kelas Guru', to: '/guru/kelas', fa: 'fa-chalkboard-teacher', color: 'text-teal-500', roles: A },
  { kind: 'item', id: 'sumbang-soalan', label: 'Sumbang Soalan', to: '/guru/soalan', fa: 'fa-pen-fancy', color: 'text-emerald-500', roles: A },
  { kind: 'item', id: 'databank-soalan', label: 'Databank Soalan', to: '/guru/databank', fa: 'fa-database', color: 'text-violet-500', roles: A },

  // ── Teacher block as captured in the ADMIN identity's drawer (admin only; the teacher's own
  //    sidebar is transcribed above from the guru screenshots) ──
  { kind: 'item', id: 'command-center-guru', label: 'Command Center', to: '/guru/command-center', fa: 'fa-satellite-dish', color: 'text-indigo-200', variant: 'command', target: '_blank', badge: { text: 'LIVE', cls: B_LIVE }, roles: A },
  { kind: 'section', id: 'sec-harian', label: 'HARIAN', text: 'text-teal-700', rule: 'from-teal-300', roles: A },
  { kind: 'item', id: 'guru-dashboard', label: 'Dashboard Guru', to: '/guru', fa: 'fa-chart-pie', color: 'text-teal-500', roles: A },
  { kind: 'item', id: 'guru-misi-harian', label: 'Misi Harian', to: '/guru/misi-harian', fa: 'fa-rocket', color: 'text-amber-500', roles: A },
  { kind: 'item', id: 'guru-soalan-by-chapter', label: 'Soalan by Chapter', to: '/practice/chapter', fa: 'fa-layer-group', color: 'text-emerald-500', roles: A },
  { kind: 'item', id: 'guru-kelas-saya', label: 'Kelas Saya', to: '/guru/kelas', fa: 'fa-chalkboard-teacher', color: 'text-teal-500', roles: A },
  { kind: 'item', id: 'guru-pelajar-saya', label: 'Pelajar Saya', to: '/guru/pelajar', fa: 'fa-user-graduate', color: 'text-blue-500', roles: A },
  { kind: 'item', id: 'guru-kehadiran-digital', label: 'Kehadiran Digital', to: '/guru/kehadiran-digital', fa: 'fa-clipboard-check', color: 'text-green-500', roles: A },
  { kind: 'section', id: 'sec-pengajaran', label: 'PENGAJARAN', text: 'text-blue-700', rule: 'from-blue-300', roles: A },
  { kind: 'item', id: 'guru-jadual-belajar', label: 'Jadual Belajar', to: '/guru/jadual-belajar', fa: 'fa-calendar-alt', color: 'text-purple-500', roles: A },
  { kind: 'item', id: 'guru-broadcast', label: 'Broadcast', to: '/guru/broadcast', fa: 'fa-bullhorn', color: 'text-amber-500', roles: A },
  { kind: 'item', id: 'guru-kelas-live', label: 'Kelas Live', to: '/guru/live-kelas', fa: 'fa-broadcast-tower', color: 'text-red-500', roles: A },
  { kind: 'section', id: 'sec-penilaian', label: 'PENILAIAN', text: 'text-amber-700', rule: 'from-amber-300', roles: A },
  { kind: 'item', id: 'guru-headcount', label: 'Headcount', to: '/headcount', fa: 'fa-chart-line', color: 'text-blue-500', roles: A },
  { kind: 'item', id: 'guru-prestasi', label: 'Prestasi', to: '/prestasi/kelas', fa: 'fa-chart-bar', color: 'text-emerald-500', roles: A },
  { kind: 'item', id: 'guru-laporan', label: 'Laporan', to: '/guru/laporan', fa: 'fa-chart-pie', color: 'text-orange-500', roles: A },
  { kind: 'item', id: 'guru-amaran-awal', label: 'Amaran Awal', to: '/amaran', fa: 'fa-exclamation-triangle', color: 'text-amber-500', roles: A },
  { kind: 'section', id: 'sec-analitik', label: 'ANALITIK', text: 'text-indigo-700', rule: 'from-indigo-300', roles: A },
  { kind: 'item', id: 'guru-monitoring', label: 'Monitoring', to: '/guru/monitoring', fa: 'fa-binoculars', color: 'text-teal-500', roles: A },
  {
    kind: 'group',
    id: 'guru-kirkpatrick',
    label: 'Kirkpatrick',
    fa: 'fa-microscope',
    color: 'text-cyan-500',
    roles: A,
    children: [
      { kind: 'item', id: 'kirk-ringkasan', label: 'Ringkasan', to: '/guru/kirkpatrick', fa: 'fa-home', color: '' },
      { kind: 'item', id: 'kirk-reaksi', label: 'T1: Reaksi', to: '/guru/kirkpatrick/reaction', fa: 'fa-smile', color: '' },
      { kind: 'item', id: 'kirk-pembelajaran', label: 'T2: Pembelajaran', to: '/guru/kirkpatrick/learning', fa: 'fa-graduation-cap', color: '' },
      { kind: 'item', id: 'kirk-tingkah-laku', label: 'T3: Tingkah Laku', to: '/guru/kirkpatrick/behavior', fa: 'fa-running', color: '' },
      { kind: 'item', id: 'kirk-hasil', label: 'T4: Hasil', to: '/guru/kirkpatrick/results', fa: 'fa-trophy', color: '' },
      { kind: 'item', id: 'kirk-rantaian', label: 'Rantaian Impak', to: '/guru/kirkpatrick/chain', fa: 'fa-link', color: '' },
      { kind: 'item', id: 'kirk-intervensi', label: 'Intervensi', to: '/guru/kirkpatrick/interventions', fa: 'fa-hand-holding-medical', color: '' },
    ],
  },
  { kind: 'item', id: 'guru-analisis-item', label: 'Analisis Item', to: '/guru/analisis-item', fa: 'fa-chart-pie', color: 'text-indigo-500', roles: A },
  { kind: 'item', id: 'guru-perbandingan-kelas', label: 'Perbandingan Kelas', to: '/guru/perbandingan-kelas', fa: 'fa-balance-scale', color: 'text-purple-500', roles: A },
  { kind: 'item', id: 'guru-laporan-mingguan', label: 'Laporan Mingguan', to: '/laporan-mingguan', fa: 'fa-calendar-week', color: 'text-emerald-500', roles: A },
  { kind: 'section', id: 'sec-bank-soalan', label: 'BANK SOALAN', text: 'text-emerald-700', rule: 'from-emerald-300', roles: A },
  { kind: 'item', id: 'guru-sumbang-soalan', label: 'Sumbang Soalan', to: '/guru/soalan', fa: 'fa-pen-fancy', color: 'text-emerald-500', roles: A },
  { kind: 'item', id: 'guru-soalan-rujukan', label: 'Soalan & Rujukan', to: '/guru/soalan-guru', fa: 'fa-book-open', color: 'text-teal-500', roles: A },
  { kind: 'item', id: 'guru-soalan-berstruktur', label: 'Soalan Berstruktur', to: '/guru/soalan-berstruktur', fa: 'fa-list-ol', color: 'text-cyan-500', roles: A },
  { kind: 'item', id: 'guru-databank', label: 'Databank Soalan', to: '/guru/databank', fa: 'fa-database', color: 'text-violet-500', roles: A },
  { kind: 'item', id: 'guru-set-soalan', label: 'Set Soalan', to: '/guru/set-soalan', fa: 'fa-clipboard-list', color: 'text-cyan-500', roles: A },
  { kind: 'section', id: 'sec-lain-lain', label: 'LAIN-LAIN', text: 'text-slate-700', rule: 'from-slate-300', roles: A },
  { kind: 'item', id: 'guru-gamifikasi', label: 'Syiling & Ganjaran', to: '/guru/gamifikasi', fa: 'fa-coins', color: 'text-amber-500', roles: A },
  { kind: 'item', id: 'guru-artikel', label: 'Sumbang Artikel', to: '/guru/artikel', fa: 'fa-newspaper', color: 'text-orange-500', roles: A },
  { kind: 'item', id: 'guru-video', label: 'Video', to: '/video', fa: 'fa-play-circle', color: 'text-red-500', roles: A },
  { kind: 'item', id: 'guru-kelas-saya-baru', label: 'Kelas Saya', to: '/kelas-saya', fa: 'fa-book-reader', color: 'text-emerald-500', badge: { text: 'BARU', cls: B_BARU }, roles: A },
  { kind: 'item', id: 'guru-set-soalan-guru', label: 'Set Soalan Guru', to: '/set-soalan-saya', fa: 'fa-clipboard-list', color: 'text-cyan-500', roles: A },

  // ── PPD / JPN (sidebar capture + drawer-only items) ──
  { kind: 'section', id: 'sec-ppd-jpn', label: 'PPD / JPN', text: 'text-indigo-700', rule: 'from-indigo-300', roles: ['admin', 'ppd_officer', 'jpn_officer'] },
  { kind: 'item', id: 'command-center-ppd', label: 'Command Center', to: '/ppd/command-center', fa: 'fa-satellite-dish', color: 'text-indigo-200', variant: 'command', target: '_blank', badge: { text: 'LIVE', cls: B_LIVE }, roles: ['admin', 'ppd_officer'] },
  { kind: 'item', id: 'dashboard-ppd', label: 'Dashboard PPD', to: '/ppd/dashboard', fa: 'fa-building-columns', color: 'text-indigo-500', roles: ['admin', 'ppd_officer'] },
  { kind: 'item', id: 'statistik-ppd', label: 'Statistik PPD', to: '/ppd/statistik-penggunaan', fa: 'fa-chart-pie', color: 'text-violet-500', roles: ['admin', 'ppd_officer'] },
  { kind: 'item', id: 'ranking-kebangsaan-ppd', label: 'Ranking Kebangsaan', to: '/ppd/ranking-kebangsaan', fa: 'fa-trophy', color: 'text-amber-500', roles: ['admin', 'ppd_officer'] },
  { kind: 'item', id: 'benchmark-sekolah', label: 'Benchmark Sekolah', to: '/ppd/benchmark-sekolah', fa: 'fa-ranking-star', color: 'text-amber-500', roles: ['admin', 'ppd_officer'] },
  { kind: 'item', id: 'peta-haba', label: 'Peta Haba', to: '/ppd/peta-haba', fa: 'fa-map-location-dot', color: 'text-red-500', roles: ['admin', 'ppd_officer'] },
  { kind: 'item', id: 'export-laporan', label: 'Export Laporan', to: '/ppd/export-laporan', fa: 'fa-file-export', color: 'text-emerald-500', roles: ['admin', 'ppd_officer'] },
  { kind: 'item', id: 'leaderboard-sekolah', label: 'Leaderboard Sekolah', to: '/ppd/leaderboard-sekolah', fa: 'fa-trophy', color: 'text-yellow-500', roles: ['admin', 'ppd_officer'] },
  { kind: 'item', id: 'dashboard-jpn', label: 'Dashboard JPN', to: '/jpn/dashboard', fa: 'fa-building-flag', color: 'text-violet-500', roles: ['admin', 'jpn_officer'] },
  { kind: 'item', id: 'statistik-jpn', label: 'Statistik Penggunaan', to: '/jpn/statistik-penggunaan', fa: 'fa-chart-pie', color: 'text-violet-500', roles: ['admin', 'jpn_officer'] },
  { kind: 'item', id: 'ranking-kebangsaan-jpn', label: 'Ranking Kebangsaan JPN', to: '/jpn/ranking-kebangsaan', fa: 'fa-trophy', color: 'text-amber-500', roles: ['admin', 'jpn_officer'] },

  // ── Admin ──
  { kind: 'section', id: 'sec-admin', label: 'Admin', text: 'text-red-700', rule: 'from-red-300', roles: A },
  { kind: 'item', id: 'ke-admin-panel', label: 'Ke Admin Panel', to: '/admin', fa: 'fa-shield-halved', color: 'text-indigo-600', variant: 'admin-link', roles: A },
  { kind: 'item', id: 'admin-soalan-by-chapter', label: 'Soalan by Chapter', to: '/practice/chapter', fa: 'fa-layer-group', color: 'text-emerald-500', roles: A },
  { kind: 'item', id: 'billing-dashboard', label: 'Billing Dashboard', to: '/admin/billing', fa: 'fa-chart-line', color: 'text-emerald-500', roles: A },
  { kind: 'item', id: 'urus-produk', label: 'Urus Produk', to: '/admin/marketplace/products', fa: 'fa-store', color: 'text-orange-500', roles: A },
  { kind: 'item', id: 'urus-penjual', label: 'Urus Penjual', to: '/admin/marketplace/sellers', fa: 'fa-user-tie', color: 'text-teal-500', roles: A },
  { kind: 'item', id: 'urus-hadiah', label: 'Urus Hadiah', to: '/admin/hadiah', fa: 'fa-gift', color: 'text-pink-500', roles: A },
  { kind: 'item', id: 'gamifikasi-guru', label: 'Gamifikasi Guru', to: '/admin/gamifikasi/guru', fa: 'fa-chalkboard-teacher', color: 'text-amber-500', roles: A },
  { kind: 'item', id: 'kertas-soalan-guru', label: 'Kertas Soalan Guru', to: '/admin/question-submissions', fa: 'fa-file-upload', color: 'text-blue-500', surfaces: ['sidebar'], roles: A },

  // ── Account links (sidebar). The drawer shows "Profil Saya" and "Panduan" in its own account
  //    section instead (USER_DRAWER_ACCOUNT, FR-M01-49/51), so they are sidebar-only here. ──
  { kind: 'item', id: 'profil-saya', label: 'Profil Saya', to: '/profile', fa: 'fa-user-circle', color: 'icon-profile', surfaces: ['sidebar'], roles: DASH },
  { kind: 'item', id: 'pakej', label: 'Pakej', to: '/pricing', fa: 'fa-crown', color: 'text-amber-500', badge: { text: '💎', cls: B_GOLD }, roles: A },
  { kind: 'item', id: 'invois-saya', label: 'Invois Saya', to: '/billing/invoices', fa: 'fa-file-invoice', color: 'text-teal-500', roles: SA_ },
  { kind: 'item', id: 'panduan', label: 'Panduan', to: '/panduan', fa: 'fa-book', color: 'text-indigo-400', surfaces: ['sidebar'], roles: DASH },

  // ── Bantuan (every role). OBSERVED in the admin capture and the guru and admin-sekolah
  //    screenshots; the student crop does not show the heading (INFERRED there); parent,
  //    sponsor, PPD and JPN INFERRED. ──
  { kind: 'section', id: 'sec-bantuan', label: 'Bantuan', text: 'text-red-500', rule: 'from-red-300' },
  { kind: 'item', id: 'tiket-bantuan', label: 'Tiket Bantuan', to: '/pusat-tuisyen/tiket', fa: 'fa-life-ring', color: 'text-emerald-500' },
  // Observed "6,144" is the default text; the shell replaces it with the live M04 count (nav-badges.ts).
  { kind: 'item', id: 'gambar-rajah', label: 'Gambar Rajah', to: '/admin/soalan-gambar', fa: 'fa-images', color: 'text-amber-500', badge: { text: '6,144', cls: B_COUNT_AMBER }, surfaces: ['sidebar'], roles: ['admin', 'teacher', 'school_admin'] },
  { kind: 'item', id: 'urus-tiket', label: 'Urus Tiket', to: '/admin/tiket', fa: 'fa-headset', color: 'text-red-400', badge: { text: '2', cls: B_COUNT_RED }, roles: A },
]

/**
 * Drawer account section (after a `border-t border-amber-100 my-2` divider), OBSERVED except the
 * DV-01 fix: live "Tetapan" links to `/settings` (a 404); the rebuild links to `/tetapan`
 * (M01 DV-01, FR-M01-49). "Log Keluar" is the drawer logout control (FR-M01-36).
 * Icon colours are the drawer's own (`text-purple-500`, `text-slate-400`, `text-blue-400`).
 */
export const USER_DRAWER_ACCOUNT: readonly NavItem[] = [
  {
    kind: 'item',
    id: 'drawer-profil-saya',
    label: 'Profil Saya',
    to: '/profile',
    fa: 'fa-user-circle',
    color: 'text-purple-500',
  },
  {
    kind: 'item',
    id: 'drawer-tetapan',
    label: 'Tetapan',
    to: '/tetapan',
    fa: 'fa-cog',
    color: 'text-slate-400',
  },
  {
    kind: 'item',
    id: 'drawer-panduan',
    label: 'Panduan',
    to: '/pusat-tuisyen/panduan',
    fa: 'fa-book',
    color: 'text-blue-400',
  },
  {
    kind: 'item',
    id: 'drawer-log-keluar',
    label: 'Log Keluar',
    to: '/logout',
    fa: 'fa-sign-out-alt',
    color: '',
  },
]

/** Bottom nav (< lg), OBSERVED. "Chat" and "Lagi" are buttons, not links. */
export interface BottomNavLink {
  kind: 'link'
  id: string
  label: string
  to: string
  fa: string
  /** Live inline icon colour (`style="color: …"`), when set. */
  iconStyle?: string
  /**
   * Further path prefixes that keep this tab active (the entry's own `to` always does). Same prefix
   * rule as `isActivePath`.
   */
  activeAlso?: readonly string[]
}

export interface BottomNavButton {
  kind: 'button'
  id: 'chat' | 'lagi'
  label: string
  fa: string
  iconStyle: string
}

export type BottomNavEntry = BottomNavLink | BottomNavButton

export const USER_BOTTOM_NAV: readonly BottomNavEntry[] = [
  { kind: 'link', id: 'home', label: 'Home', to: '/dashboard', fa: 'fa-home' },
  {
    kind: 'link',
    id: 'spm',
    label: 'SPM',
    to: '/spm',
    fa: 'fa-graduation-cap',
    iconStyle: 'color: #f59e0b;',
  },
  {
    kind: 'link',
    id: 'game',
    label: 'Game',
    to: '/permainan',
    fa: 'fa-gamepad',
    iconStyle: 'color: #8b5cf6;',
    // INFERRED (G5 L26 Low-1: live highlights "Game" on these pages; the exact live condition was
    // not captured): the M16 game pages outside `/permainan`: Battle Arena, Papan Bijak, the five
    // lobbies and their rooms (`/{game}/:code`).
    activeAlso: [
      '/battle',
      '/papan-bijak',
      '/perang-fakta',
      '/benteng-ilmu',
      '/perlumbaan-matematik',
      '/kuiz-relay',
      '/teka-silang-kata',
    ],
  },
  { kind: 'link', id: 'topik', label: 'Topik', to: '/topics', fa: 'fa-book-open' },
  // Live dispatches `toggle-chatbot` for the chatbot widget (M22, not built: no listener yet).
  { kind: 'button', id: 'chat', label: 'Chat', fa: 'fa-comments', iconStyle: 'color: #3B82F6;' },
  // Live dispatches `toggle-drawer`: "Lagi" opens the same drawer as the header hamburger.
  { kind: 'button', id: 'lagi', label: 'Lagi', fa: 'fa-bars', iconStyle: 'color: #f59e0b;' },
]

// ---------------------------------------------------------------------------------------------
// Helpers

function visibleTo(entry: EntryBase, role: Role | null, surface: NavSurface): boolean {
  if (entry.surfaces && !entry.surfaces.includes(surface)) return false
  if (!entry.roles) return role !== null
  return role !== null && entry.roles.includes(role)
}

/**
 * The entries a role sees on a surface, in menu order. Hidden entries are removed (FR-G-04).
 * A section or sub-heading with no visible item after it (before the next heading) is dropped
 * too, so no empty heading is left behind.
 */
export function navFor(
  role: Role | null,
  surface: NavSurface,
  entries: readonly NavEntry[] = USER_NAV,
  options: { includeOutOfScope?: boolean } = {},
): NavEntry[] {
  // Release 1.0 scope: items listed in out-of-scope.ts stay in the data but are not rendered.
  const inScope = (entry: NavEntry): boolean =>
    options.includeOutOfScope === true || entry.kind !== 'item' || !isOutOfScope(entry.to)
  const visible = entries
    .filter((entry) => visibleTo(entry, role, surface) && inScope(entry))
    .map((entry) =>
      entry.kind === 'group' ? { ...entry, children: entry.children.filter(inScope) } : entry,
    )
    .filter((entry) => entry.kind !== 'group' || entry.children.length > 0)
  return visible.filter((entry, index) => {
    if (entry.kind !== 'section' && entry.kind !== 'subheading') return true
    for (const next of visible.slice(index + 1)) {
      if (next.kind === 'item' || next.kind === 'group') return true
      if (next.kind === 'section') return false
      if (entry.kind === 'subheading') return false
    }
    return false
  })
}

/**
 * Active-link rule: the current path equals the item path, or lies below it (`/spm/…` keeps "SPM"
 * active, M06 FN-1.2.1; `/cikgu/rph` keeps "Cikgu Alesa" active, M13 FN-1.1.4; `/topics/12`
 * keeps "Topik" active, M03 FN-6.2.1). `/dashboard` only matches itself and its sub-paths.
 */
export function isActivePath(
  currentPath: string,
  to: string,
  except: readonly string[] = [],
): boolean {
  const path = currentPath.replace(/\/+$/, '') || '/'
  const target = to.replace(/\/+$/, '') || '/'
  if (target === '/') return path === '/'
  // M27 FR-M27-02: the school admin "Dashboard" is active on exactly `/admin-sekolah`, not on `/admin-sekolah/*`.
  if (target === '/admin-sekolah') return path === target
  if (except.some((e) => path === e || path.startsWith(`${e}/`))) return false
  return path === target || path.startsWith(`${target}/`)
}

/** Whether a bottom-nav link tab is active on `currentPath` (its `to` plus any `activeAlso`). */
export function bottomNavActive(entry: BottomNavLink, currentPath: string): boolean {
  return [entry.to, ...(entry.activeAlso ?? [])].some((to) => isActivePath(currentPath, to))
}

/** Drawer badge classes: 10px pills become 9px (design-system §4). */
export function drawerBadgeClass(cls: string): string {
  return cls.replace('text-[10px]', 'text-[9px]')
}
