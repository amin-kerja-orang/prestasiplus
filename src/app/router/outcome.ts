/**
 * In-place error outcome of the current navigation (overview §5.4 step 3, §5.5 "403").
 *
 * 403 is not a route: when a guard decides `onForbidden: '403'` (or `'404'`), the navigation is
 * allowed (the URL stays as typed, as on live) and `LayoutHost` renders the standalone error page
 * instead of the route's page. The guard sets the outcome for every navigation, so it is cleared
 * again on the next allowed page.
 */

import { readonly, shallowRef } from 'vue'

import { SCOPE_PAGE_TITLE } from '../prototype-scope'

/** `'scope'`: the route exists but is outside the prototype scope (D43, `prototype-scope.ts`). */
export type RouteOutcome = 403 | 404 | 'scope'

const outcome = shallowRef<RouteOutcome | null>(null)

export function setRouteOutcome(next: RouteOutcome | null): void {
  outcome.value = next
  // A page that raises 404/403 itself (after its fetch) must show the error tab title too. Clearing
  // needs nothing here: the after-each hook sets the next page's title on navigation.
  if (next !== null && typeof document !== 'undefined') {
    document.title =
      next === 404 ? NOT_FOUND_TITLE : next === 'scope' ? SCOPE_PAGE_TITLE : FORBIDDEN_TITLE
  }
}

/** The in-place outcome of the current page (`null` = render the route's page). */
export function useRouteOutcome() {
  return readonly(outcome)
}

/** Exact tab titles of the standalone error pages (build-plan F-21; M01 FR-M01-50, M08). */
export const NOT_FOUND_TITLE = '404 - Halaman Tidak Dijumpai | PRESTASIPLUS'
export const FORBIDDEN_TITLE = '403 - Akses Ditolak | PRESTASIPLUS'
