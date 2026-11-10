import type { RouteRecordNormalized } from 'vue-router'

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
 * Redirect pairs (normalised path -> normalised target path) from router records (`router.getRoutes()`).
 * Only static redirects count: a string, or an object with a `path` or a `name` of another record.
 * Function redirects are skipped on purpose: they can depend on the session, so they cannot be resolved
 * statically. Records with params (`:id`) are skipped too.
 */
export function redirectsFrom(
  records: readonly Pick<RouteRecordNormalized, 'path' | 'name' | 'redirect'>[],
): Record<string, string> {
  const pathOfName = new Map<string, string>()
  for (const r of records) if (typeof r.name === 'string') pathOfName.set(r.name, r.path)
  const out: Record<string, string> = {}
  for (const r of records) {
    const { redirect } = r
    if (redirect === undefined || typeof redirect === 'function' || r.path.includes(':')) continue
    let target: string | undefined
    if (typeof redirect === 'string') target = redirect
    else if (typeof redirect.path === 'string') target = redirect.path
    else if (typeof redirect.name === 'string') target = pathOfName.get(redirect.name)
    if (target === undefined || target.includes(':')) continue
    out[normalisePath(r.path)] = normalisePath(target)
  }
  return out
}

/**
 * The rendered menu: built screens only, in menu order. An entry is skipped when its route equals an
 * earlier rendered entry's route, or redirects to a page an earlier rendered entry shows (the first
 * entry wins). A group left with no item is dropped. Pure: no router, no side effects.
 * Dedup runs on the role-unfiltered menu. If role filtering is ever applied AFTER this, a role that cannot
 * see the first entry would also lose the later duplicate: filter by role first in that case.
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
