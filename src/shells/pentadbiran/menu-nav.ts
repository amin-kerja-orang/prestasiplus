/**
 * Pentadbiran menu as `DsAdminShell` data. Each group is a quiet label followed by its screens
 * (icon + label, one line per row). A second-level heading (Kirkpatrick) is folded into ONE row that
 * opens its first page; the other pages are in-page tabs (`sectionTabs`). Pure data (no class names)
 * so it can be unit-tested and reused by the Ctrl+K palette.
 */
import type { DsShellNavGroup, DsShellNavLink, DsShellSearchGroup } from '@/ds'

import type { PentadbiranGroup, PentadbiranItem } from './menu'
import { ITEM_ICON } from './menu-icons'

export interface NavBuildOptions {
  activeId: string | undefined
  /** Sub-heading of the active screen (for example `Kirkpatrick`), when it has one. */
  activeSub?: string | undefined
}

function link(
  item: PentadbiranItem,
  group: PentadbiranGroup,
  opts: NavBuildOptions,
  label = item.label,
  active = item.id === opts.activeId,
): DsShellNavLink {
  return {
    kind: 'link',
    id: item.id,
    label,
    icon: ITEM_ICON[item.id] ?? `i-ph-${group.icon}`,
    to: item.to,
    active,
  }
}

/** Groups with their rows, in menu order. */
export function buildNavGroups(
  groups: readonly PentadbiranGroup[],
  opts: NavBuildOptions,
): DsShellNavGroup[] {
  return groups.map((group) => {
    const rows: DsShellNavLink[] = []
    const folded = new Set<string>()
    for (const item of group.items) {
      if (!item.sub) {
        rows.push(link(item, group, opts))
        continue
      }
      if (folded.has(item.sub)) continue
      folded.add(item.sub)
      rows.push(link(item, group, opts, item.sub, opts.activeSub === item.sub))
    }
    return { key: group.key, label: group.label, rows }
  })
}

/** In-page tabs of a folded section: the screens that share the sub-heading `sub`. */
export function sectionTabs(
  groups: readonly PentadbiranGroup[],
  sub: string,
): { label: string; to: string }[] {
  return groups
    .flatMap((g) => g.items)
    .filter((i) => i.sub === sub)
    .map((i) => ({ label: i.label, to: i.to }))
}

/** Flat entries for the command palette: every visible screen, grouped. */
export function buildSearchGroups(groups: readonly PentadbiranGroup[]): DsShellSearchGroup[] {
  return groups.map((g) => ({
    id: g.key,
    label: g.label,
    items: g.items.map((i) => ({
      id: i.id,
      label: i.label,
      suffix: i.sub,
      icon: ITEM_ICON[i.id] ?? `i-ph-${g.icon}`,
      to: i.to,
    })),
  }))
}
