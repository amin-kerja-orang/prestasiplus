/**
 * Menus of the Pembelajaran layout (design v2-shells 5.1, 5.5). Nothing is listed twice: the
 * sidebar, the "Lagi" panel and the tab bar are all derived from the existing user-nav data
 * (`navFor`, `userBottomNavFor`, `userDrawerAccountFor`), which already applies the role filter
 * and the prototype scope (D43). The tab bar only chooses which of those entries become tabs.
 */
import type { NavigationMenuItem } from '@nuxt/ui'
import type { Router } from 'vue-router'

import { isPathAllowed, isPrototypeScopeOn } from '@/app/prototype-scope'
import { FALLBACK_PH, FA_TO_PH } from '@/theme/learn-icons'
import {
  bottomNavActive,
  isActivePath,
  navFor,
  userBottomNavFor,
  userDrawerAccountFor,
  type NavEntry,
  type NavItem,
} from '@/shells/nav/user-nav'
import type { Role } from '@/stores/session-types'

export interface PembelajaranTab {
  id: string
  label: string
  to: string
  /** Phosphor base name (listed in `src/theme/ds-icons.ts`). */
  icon: string
  /** Extra path prefixes that keep the tab active. */
  also?: readonly string[]
  /** Shows the red live dot (Command Center). */
  live?: boolean
}

/** Phosphor glyph per menu entry id; entries without one show no glyph. */
const ICON_BY_ID: Record<string, string> = {
  dashboard: 'house',
  spm: 'graduation-cap',
  game: 'game-controller',
  topik: 'book-open-text',
  't-dashboard-guru': 'house',
  't-kelas-saya': 'chalkboard-teacher',
  't-command-center': 'chart-line-up',
  't-prestasi': 'pencil-simple-line',
  permainan: 'game-controller',
  tournament: 'trophy',
  kedudukan: 'trophy',
  'cikgu-alesa': 'sparkle',
  'cikgu-alesa-chat': 'sparkle',
}

/** Teacher tabs: label shown, and the existing menu entry (by id) it points at. */
const TEACHER_TABS: readonly { label: string; navId: string; live?: boolean }[] = [
  { label: 'Dashboard', navId: 't-dashboard-guru' },
  { label: 'Kelas', navId: 't-kelas-saya' },
  { label: 'Command Center', navId: 't-command-center', live: true },
  { label: 'Penilaian', navId: 't-prestasi' },
]

/** School-admin tabs (the user-nav bottom bar has none for this role). */
const SCHOOL_TABS: readonly { label: string; navId: string; icon: string; live?: boolean }[] = [
  { label: 'Dashboard', navId: 'sa-dashboard', icon: 'house' },
  { label: 'Command Center', navId: 'sa-command-center', icon: 'chart-line-up', live: true },
  { label: 'Prestasi', navId: 'sa-prestasi', icon: 'pencil-simple-line' },
  { label: 'Pelajar', navId: 'sa-senarai-pelajar', icon: 'chalkboard-teacher' },
]

export function iconFor(id: string): string | null {
  return ICON_BY_ID[id] ?? null
}

function allItems(entries: readonly NavEntry[]): NavItem[] {
  const out: NavItem[] = []
  for (const entry of entries) {
    if (entry.kind === 'item') out.push(entry)
    else if (entry.kind === 'group') out.push(...entry.children)
  }
  return out
}

/** The tabs before "Lagi" for a role (the live "Chat" tab is replaced by the floating button). */
export function pembelajaranTabs(role: Role | null): PembelajaranTab[] {
  if (role === 'teacher') {
    const items = allItems(navFor(role, 'sidebar'))
    const tabs: PembelajaranTab[] = []
    for (const spec of TEACHER_TABS) {
      const item = items.find((i) => i.id === spec.navId)
      if (!item) continue
      tabs.push({
        id: item.id,
        label: spec.label,
        to: item.to,
        icon: ICON_BY_ID[item.id] ?? 'house',
        ...(spec.live ? { live: true } : {}),
      })
    }
    return tabs
  }
  if (role === 'school_admin') {
    const items = allItems(navFor(role, 'sidebar'))
    const tabs: PembelajaranTab[] = []
    for (const spec of SCHOOL_TABS) {
      const item = items.find((i) => i.id === spec.navId)
      if (!item) continue
      tabs.push({
        id: item.id,
        label: spec.label,
        to: item.to,
        icon: spec.icon,
        ...(spec.live ? { live: true } : {}),
      })
    }
    return tabs
  }
  const tabs: PembelajaranTab[] = []
  for (const entry of userBottomNavFor(role)) {
    if (entry.kind !== 'link') continue
    tabs.push({
      id: entry.id,
      label: entry.label,
      to: entry.to,
      icon: ICON_BY_ID[entry.id] ?? 'house',
      ...(entry.activeAlso ? { also: entry.activeAlso } : {}),
    })
  }
  return tabs
}

export function tabActive(tab: PembelajaranTab, currentPath: string): boolean {
  return bottomNavActive(
    { kind: 'link', id: tab.id, label: tab.label, to: tab.to, fa: '', activeAlso: tab.also ?? [] },
    currentPath,
  )
}

export function itemActive(item: NavItem, currentPath: string): boolean {
  return isActivePath(currentPath, item.to, item.activeExcept)
}

/** Whether the role may open a menu target (`true` when no check is given). */
export type CanOpen = (to: string) => boolean

/**
 * `CanOpen` from the router: false when a matched route's `meta.roles` refuses the role. A route
 * with `roles: []` is the observed live "403 for every role" page (M08 S21 Laporan Mingguan), kept
 * in the menu as with the scope on. Used only with the prototype scope off: with it on, the
 * role-access matrix already decides the menu.
 */
export function routeRoleCheck(router: Pick<Router, 'resolve'>, role: Role | null): CanOpen {
  return (to) => {
    if (isPrototypeScopeOn() || role === null || !to.startsWith('/')) return true
    return !router
      .resolve(to)
      .matched.some((r) => r.meta.roles && r.meta.roles.length > 0 && !r.meta.roles.includes(role))
  }
}

/** Drops the items (and group children) the role may not open; an emptied group goes too. */
function openable(entries: readonly NavEntry[], canOpen?: CanOpen): NavEntry[] {
  if (!canOpen) return [...entries]
  const out: NavEntry[] = []
  for (const entry of entries) {
    if (entry.kind === 'item') {
      if (canOpen(entry.to)) out.push(entry)
    } else if (entry.kind === 'group') {
      const children = entry.children.filter((c) => canOpen(c.to))
      if (children.length > 0) out.push({ ...entry, children })
    } else {
      out.push(entry)
    }
  }
  // A heading left with no item before the next heading goes too (as in `navFor`).
  return out.filter((entry, index) => {
    if (entry.kind !== 'section' && entry.kind !== 'subheading') return true
    for (const next of out.slice(index + 1)) {
      if (next.kind === 'item' || next.kind === 'group') return true
      if (next.kind === 'section') return false
      if (entry.kind === 'subheading') return false
    }
    return false
  })
}

/** Full menu for the sidebar (>= lg). */
export function sidebarEntries(role: Role | null, canOpen?: CanOpen): NavEntry[] {
  return openable(navFor(role, 'sidebar'), canOpen)
}

/** Full menu for the "Lagi" panel (< lg). */
export function drawerEntries(role: Role | null, canOpen?: CanOpen): NavEntry[] {
  return openable(navFor(role, 'drawer'), canOpen)
}

/** Account links (Profil Saya, Tetapan, Panduan) for the "Lagi" panel; the logout is separate. */
export function accountItems(role: Role | null): NavItem[] {
  return userDrawerAccountFor(role).filter((i) => i.to !== '/logout')
}

// ---------------------------------------------------------------------------------------------
// Nuxt UI navigation data (sidebar and "Lagi" sheet)

/** Phosphor base name of a menu item: explicit override, else mapped from its Font Awesome class. */
export function phIconFor(item: NavItem): string {
  return ICON_BY_ID[item.id] ?? FA_TO_PH[item.fa] ?? FALLBACK_PH
}

/** `i-ph-*` class for a base name: learner Duotone, staff Regular (design-system 10.1). */
export function phClass(name: string, learner: boolean): string {
  return `i-ph-${name}${learner ? '-duotone' : ''}`
}

export interface LearnNavOptions {
  learner: boolean
  currentPath: string
}

/** The single item that is current on `currentPath`: the longest matching `to` wins. */
export function currentItem(entries: readonly NavEntry[], currentPath: string): NavItem | undefined {
  let best: NavItem | undefined
  for (const item of flatItems(entries)) {
    if (!itemActive(item, currentPath)) continue
    if (!best || item.to.length > best.to.length) best = item
  }
  return best
}

export function flatItems(entries: readonly NavEntry[]): NavItem[] {
  return allItems(entries)
}

/** The heading (section / sub-heading / group) that contains an item, for the breadcrumb. */
export function sectionOf(entries: readonly NavEntry[], itemId: string): string {
  let heading = ''
  for (const entry of entries) {
    if (entry.kind === 'section' || entry.kind === 'subheading') heading = entry.label
    else if (entry.kind === 'item' && entry.id === itemId) return heading
    else if (entry.kind === 'group' && entry.children.some((c) => c.id === itemId)) {
      return heading ? `${heading} · ${entry.label}` : entry.label
    }
  }
  return ''
}

/** Categorical slot (1-8, theme tokens) per old Font Awesome colour family. */
const HUE_TO_CAT: readonly [RegExp, number][] = [
  [/(indigo|blue-[56])/, 1],
  [/(amber|yellow)/, 5],
  [/orange/, 6],
  [/(red|rose)/, 3],
  [/(purple|violet|fuchsia|pink)/, 7],
  [/(emerald|green|teal)/, 8],
  [/(cyan|blue)/, 4],
]

/** Chip colour slot of an item: from its old colour class, else a stable pick by id. */
export function chipSlot(item: Pick<NavItem, 'id' | 'color'>): number {
  for (const [re, n] of HUE_TO_CAT) if (re.test(item.color)) return n
  let h = 0
  for (const ch of item.id) h = (h * 31 + ch.charCodeAt(0)) % 8
  return h + 1
}

/** Literal classes (Tailwind scans this file): soft tint chip and glyph colour per slot. */
export const CHIP_CLASS: Record<number, string> = {
  1: 'bg-cat-1/15 text-cat-1',
  2: 'bg-cat-2/15 text-cat-2',
  3: 'bg-cat-3/15 text-cat-3',
  4: 'bg-cat-4/15 text-cat-4',
  5: 'bg-cat-5/15 text-cat-5',
  6: 'bg-cat-6/15 text-cat-6',
  7: 'bg-cat-7/15 text-cat-7',
  8: 'bg-cat-8/15 text-cat-8',
}

/**
 * `UNavigationMenu` slot classes of the sidebar and the "Lagi" panel. The active row's fill sits on
 * the link itself, not only on its `::before` pill: the theme's `hover:bg-elevated` paints the link
 * background above the pill, so hovering the active learner row used to show the `primary-on`
 * (white) label on the light `elevated` grey. Learner: `bg-gradient-primary` (from `--ds-c1` to
 * `--ds-primary-2`) with `text-primary-on`, light and dark (white label 5.2:1). Staff: the
 * `primary-soft` tint with `text-primary-t`, kept on hover as well.
 */
export function learnNavUi(learner: boolean): Record<string, string> {
  const active = learner
    ? 'aria-[current=page]:bg-gradient-primary aria-[current=page]:before:bg-gradient-primary aria-[current=page]:text-primary-on aria-[current=page]:hover:text-primary-on'
    : 'aria-[current=page]:bg-primary-soft aria-[current=page]:hover:bg-primary-soft aria-[current=page]:text-primary-t aria-[current=page]:hover:text-primary-t'
  return {
    root: 'gap-0',
    link: `h-10 gap-2.5 px-2.5 rounded-md hover:before:bg-elevated ${active} aria-[current=page]:font-semibold`,
    linkLeadingIcon: 'size-4',
    linkLabel: 'truncate',
    linkTrailing: 'shrink-0',
    label: 'px-2.5 pt-5 pb-1.5 text-overline font-semibold text-muted uppercase',
  }
}

/**
 * Native `title` of a menu label, only for a label long enough to be cut off: a short label is shown
 * in full, and a browser tooltip on it only covers the next row.
 */
export function labelTitle(label: string | undefined): string | undefined {
  // Labels up to this length fit the default sidebar width (16rem) in one line.
  const fits = 22
  return label && label.length > fits ? label : undefined
}

/** A heading without its leading emoji (the rows carry the icons; labels stay quiet text). */
export function plainLabel(label: string): string {
  return label.replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '').trim() || label
}

function leaf(item: NavItem, opts: LearnNavOptions, activeId: string | undefined): NavigationMenuItem {
  return {
    label: item.label,
    icon: phClass(phIconFor(item), opts.learner),
    to: item.to,
    target: item.target,
    active: item.id === activeId,
    value: item.id,
    ...(item.badge ? { badge: item.badge.text } : {}),
  }
}

/**
 * Menu entries as `UNavigationMenu` groups (array of arrays). Every section or sub-heading starts a
 * new group headed by a label row; the entries before the first heading form an unlabeled group.
 * A collapsible group (Kirkpatrick) is folded into ONE row that opens its first page (active on
 * any of its pages); its pages become in-page tabs (`groupTabs`). Two levels at most, one line per row.
 */
export function buildLearnNav(
  entries: readonly NavEntry[],
  opts: LearnNavOptions,
): NavigationMenuItem[][] {
  const activeId = currentItem(entries, opts.currentPath)?.id
  const groups: NavigationMenuItem[][] = []
  let cur: NavigationMenuItem[] = []
  const flush = (): void => {
    // A heading with nothing under it (the next heading follows at once) is not shown.
    if (cur.some((i) => i.type !== 'label')) groups.push(cur)
    cur = []
  }
  for (const entry of entries) {
    if (entry.kind === 'section' || entry.kind === 'subheading') {
      flush()
      cur.push({ label: plainLabel(entry.label), type: 'label' })
    } else if (entry.kind === 'item') {
      cur.push(leaf(entry, opts, activeId))
    } else {
      const first = entry.children[0]
      if (!first) continue
      cur.push({
        label: entry.label,
        icon: phClass(FA_TO_PH[entry.fa] ?? FALLBACK_PH, opts.learner),
        to: first.to,
        active: entry.children.some((c) => c.id === activeId),
        value: entry.id,
      })
    }
  }
  flush()
  return groups
}

/** The pages of the collapsible group that contains `itemId` (in-page tabs), or `[]`. */
export function groupTabs(
  entries: readonly NavEntry[],
  itemId: string | undefined,
): { id: string; label: string; to: string }[] {
  if (!itemId) return []
  for (const entry of entries) {
    if (entry.kind === 'group' && entry.children.some((c) => c.id === itemId)) {
      return entry.children.map((c) => ({ id: c.id, label: c.label, to: c.to }))
    }
  }
  return []
}

/** Flat Ctrl+K groups over the same entries: one group per heading. */
export function buildLearnSearch(entries: readonly NavEntry[], opts: LearnNavOptions) {
  const out: { id: string; label: string; items: Record<string, unknown>[] }[] = []
  let heading = 'Menu'
  let cur: Record<string, unknown>[] = []
  const flush = (): void => {
    if (cur.length > 0) out.push({ id: `${out.length}-${heading}`, label: heading, items: cur })
    cur = []
  }
  const push = (item: NavItem, prefix = ''): void => {
    cur.push({
      id: item.id,
      label: item.label,
      suffix: prefix || undefined,
      icon: phClass(phIconFor(item), opts.learner),
      to: item.to,
      target: item.target,
    })
  }
  for (const entry of entries) {
    if (entry.kind === 'section' || entry.kind === 'subheading') {
      flush()
      heading = entry.label
    } else if (entry.kind === 'item') push(entry)
    else for (const c of entry.children) push(c, entry.label)
  }
  flush()
  return out
}

// ---------------------------------------------------------------------------------------------
// Account menu (role-access-matrix section A)

export interface AccountLink {
  id: string
  label: string
  to: string
  /** Phosphor base name. */
  icon: string
}

const ACCOUNT_LINKS: readonly AccountLink[] = [
  { id: 'profil', label: 'Profil Saya', to: '/profile', icon: 'user-circle' },
  { id: 'tetapan', label: 'Tetapan Peribadi', to: '/tetapan', icon: 'gear' },
  { id: 'panduan', label: 'Panduan', to: '/pusat-tuisyen/panduan', icon: 'book' },
  { id: 'tiket', label: 'Tiket Bantuan', to: '/pusat-tuisyen/tiket', icon: 'lifebuoy' },
]

/** Section A links the role may open (prototype scope); Log Keluar is added by the layout. */
export function accountLinks(role: Role | null): AccountLink[] {
  return ACCOUNT_LINKS.filter((l) => isPathAllowed(role, l.to))
}
