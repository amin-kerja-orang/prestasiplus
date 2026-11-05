import type { PentadbiranGroup, PentadbiranItem } from '../menu'

/** Path of a route, without query, hash or trailing slash, for comparing routes. */
export function normalisePath(to: string): string {
  const path = (to.split(/[?#]/)[0] ?? '').replace(/\/+$/, '')
  return path === '' ? '/' : path
}

/** The page a route finally shows: follows the redirect table (cycle-safe, at most 8 hops). */
export function resolveRoute(to: string, redirects: Readonly<Record<string, string>>): string {
  let current = normalisePath(to)
  const seen = new Set<string>()
  while (!seen.has(current) && seen.size < 8) {
    seen.add(current)
    const next = redirects[current]
    if (next === undefined) break
    current = normalisePath(next)
  }
  return current
}

/**
 * The rendered menu: built screens only, in menu order. An entry is skipped when its route equals an
 * earlier rendered entry's route, or redirects to a page an earlier rendered entry shows (the first
 * entry wins). A group left with no item is dropped. Pure: no router, no side effects.
 */
export function renderMenu(
  full: readonly PentadbiranGroup[],
  redirects: Readonly<Record<string, string>> = {},
): PentadbiranGroup[] {
  const shown = new Set<string>()
  const keep = (item: PentadbiranItem): boolean => {
    if (!item.built) return false
    const page = resolveRoute(item.to, redirects)
    if (shown.has(page)) return false
    shown.add(page)
    return true
  }
  return full.map((g) => ({ ...g, items: g.items.filter(keep) })).filter((g) => g.items.length > 0)
}
