/**
 * Pentadbiran menu as `UNavigationMenu` items. Two levels at most and one line per row: each group
 * is a quiet, non-clickable section label followed by its screens (icon + label). A second-level
 * heading (Kirkpatrick) is folded into ONE row that opens its first page; the other pages are
 * in-page tabs (`SECTION_TABS`). Pure data so it can be unit-tested and reused by the Ctrl+K palette.
 */
import type { NavigationMenuItem } from '@nuxt/ui'

import type { PentadbiranGroup, PentadbiranItem } from './menu'
import { ITEM_ICON } from './menu-icons'

export interface NavBuildOptions {
  activeId: string | undefined
  /** Sub-heading of the active screen (for example `Kirkpatrick`), when it has one. */
  activeSub?: string | undefined
}

function row(
  item: PentadbiranItem,
  group: PentadbiranGroup,
  opts: NavBuildOptions,
  label = item.label,
  active = item.id === opts.activeId,
): NavigationMenuItem {
  return {
    label,
    icon: ITEM_ICON[item.id] ?? `i-ph-${group.icon}`,
    to: item.to,
    active,
    value: item.id,
  }
}

/** Groups as label + rows (array of arrays, the `UNavigationMenu` shape). */
export function buildNavItems(
  groups: readonly PentadbiranGroup[],
  opts: NavBuildOptions,
): NavigationMenuItem[][] {
  return groups.map((group) => {
    const rows: NavigationMenuItem[] = [{ label: group.label, type: 'label', value: group.key }]
    const folded = new Set<string>()
    for (const item of group.items) {
      if (!item.sub) {
        rows.push(row(item, group, opts))
        continue
      }
      if (folded.has(item.sub)) continue
      folded.add(item.sub)
      rows.push(row(item, group, opts, item.sub, opts.activeSub === item.sub))
    }
    return rows
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
export function buildSearchGroups(groups: readonly PentadbiranGroup[]) {
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
