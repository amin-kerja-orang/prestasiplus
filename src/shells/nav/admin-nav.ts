/**
 * Admin-panel menu (F-18; design shells.md v1.2 §2.2, §2.6–§2.8): ONE ordered definition rendered
 * by the desktop sidebar (≥ lg), the "Lagi" popover and the bottom nav (< lg).
 *
 * Admin Pusat is framed by the Portal Pentadbiran (`src/shells/pentadbiran/menu.ts`, S0-T07); its old
 * `ADMIN_NAV` definition (footer links, bottom nav, "Lagi" rows) was removed with it. This shell now
 * serves only the roles outside the staff and student frames.
 *
 * Roles (shells.md §1.4, §2.6): `adminMenuFor(role)`
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
// Bottom nav (shells.md §2.4, §2.6)

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
  if (role === null) return []
  return navFor(role, 'sidebar').map(adoptUserEntry)
}

export function bottomNavFor(role: Role | null): readonly AdminBottomNavEntry[] {
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
  if (entry.target === '_blank') return 0
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

/** The id of the one active item for `current`, or `null`. */
export function activeItemId(entries: readonly AdminNavEntry[], current: string): string | null {
  let bestId: string | null = null
  let best = 0
  for (const candidate of flatItems(entries)) {
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

const LOG_KELUAR: LagiRow = {
  kind: 'row',
  id: 'log-keluar',
  label: 'Log Keluar',
  to: '/logout',
  fa: 'fa-sign-out-alt',
  colour: 'text-red-600',
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
  if (role === null) return { entries: [], tail: [] }
  return derivedLagi(role)
}
