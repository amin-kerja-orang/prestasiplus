/**
 * Typed route meta (overview §5.2). Every module route declares its `meta` with these keys.
 *
 * Defaults when a key is left out:
 * - `layout`: `'bare'` (no shell);
 * - `access`: `'auth'` (a session is required; public pages must say `access: 'public'`);
 * - `roles`: any logged-in role;
 * - `onForbidden`: `'landing'`.
 */

import type { RouteLocationNormalized } from 'vue-router'

import type { PageHeader } from '@/composables/usePageMeta'
import type { Role } from '@/stores/session-types'

/** Which frame wraps the page (overview §5.3, ADR-0008). */
export type LayoutMode = 'admin' | 'user' | 'role' | 'public-or-user' | 'bare'

/** `auth` = session required; a guest goes to `/login` (FR-M01-14, BR-08, BR-09). */
export type RouteAccess = 'public' | 'auth'

/**
 * Outcome for a logged-in user whose role is not in `roles`:
 * - `landing`: redirect to the role landing path (`UserMe.landingPath`, M01 BR-07);
 * - `403`: the standalone "Akses Ditolak" page rendered in place, URL unchanged (M08);
 * - `404`: the standalone 404 page rendered in place, URL unchanged (where an SRS says so).
 */
export type ForbiddenOutcome = 'landing' | '403' | '404'

/** Exact tab title (no suffix is added: live suffixes vary). */
export type RouteTitle = string | ((route: RouteLocationNormalized) => string)

export type ModuleId = `M${number}`

declare module 'vue-router' {
  interface RouteMeta {
    layout?: LayoutMode
    access?: RouteAccess
    roles?: readonly Role[]
    onForbidden?: ForbiddenOutcome
    title?: RouteTitle
    /** Tab title used instead of `title` when the public (guest) layout renders the route (F-20). */
    guestTitle?: RouteTitle
    /** Static shell header. Pages with a data-driven header use `usePageMeta().setHeader()`. */
    header?: PageHeader
    module?: ModuleId
  }
}

export const DEFAULT_LAYOUT: LayoutMode = 'bare'
export const DEFAULT_ACCESS: RouteAccess = 'auth'
export const DEFAULT_ON_FORBIDDEN: ForbiddenOutcome = 'landing'

/** The tab title of a resolved route, or `null` when the route declares none. */
export function resolveTitle(route: RouteLocationNormalized): string | null {
  const title = route.meta.title
  if (title === undefined) return null
  return typeof title === 'function' ? title(route) : title
}
