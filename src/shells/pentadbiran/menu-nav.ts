/**
 * Pentadbiran menu as `UNavigationMenu` items (vertical, collapsible groups). A group is a trigger
 * row (accent icon + label) with its screens below; a second-level heading (Kirkpatrick,
 * Gamifikasi) becomes a nested trigger. Pure data so it can be unit-tested and reused by the
 * Ctrl+K palette.
 */
import type { NavigationMenuItem } from '@nuxt/ui'

import type { PentadbiranGroup, PentadbiranItem } from './menu'

export interface NavBuildOptions {
  activeId: string | undefined
  isOpen: (key: string) => boolean
  toggle: (key: string) => void
}

function leaf(item: PentadbiranItem, activeId: string | undefined): NavigationMenuItem {
  return {
    label: item.label,
    to: item.to,
    active: item.id === activeId,
    value: item.id,
  }
}

export function buildNavItems(
  groups: readonly PentadbiranGroup[],
  opts: NavBuildOptions,
): NavigationMenuItem[] {
  return groups.map((group) => {
    const children: NavigationMenuItem[] = []
    const subs = new Map<string, NavigationMenuItem>()
    for (const item of group.items) {
      if (!item.sub) {
        children.push(leaf(item, opts.activeId))
        continue
      }
      let sub = subs.get(item.sub)
      if (!sub) {
        sub = {
          label: item.sub,
          type: 'trigger',
          defaultOpen: true,
          children: [],
        }
        subs.set(item.sub, sub)
        children.push(sub)
      }
      sub.children?.push(leaf(item, opts.activeId))
    }
    return {
      label: group.label,
      icon: `i-ph-${group.icon}`,
      type: 'trigger',
      value: group.key,
      open: opts.isOpen(group.key),
      onSelect: () => opts.toggle(group.key),
      children,
    }
  })
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
      icon: `i-ph-${g.icon}`,
      to: i.to,
    })),
  }))
}
