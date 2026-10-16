/**
 * Menus of the Pembelajaran layout (design v2-shells 5.1, 5.5). Nothing is listed twice: the
 * sidebar, the "Lagi" panel and the tab bar are all derived from the existing user-nav data
 * (`navFor`, `userBottomNavFor`, `userDrawerAccountFor`), which already applies the role filter
 * and the prototype scope (D43). The tab bar only chooses which of those entries become tabs.
 */
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

/** Full menu for the sidebar (>= lg). */
export function sidebarEntries(role: Role | null): NavEntry[] {
  return navFor(role, 'sidebar')
}

/** Full menu for the "Lagi" panel (< lg). */
export function drawerEntries(role: Role | null): NavEntry[] {
  return navFor(role, 'drawer')
}

/** Account links (Profil Saya, Tetapan, Panduan) for the "Lagi" panel; the logout is separate. */
export function accountItems(role: Role | null): NavItem[] {
  return userDrawerAccountFor(role).filter((i) => i.to !== '/logout')
}
