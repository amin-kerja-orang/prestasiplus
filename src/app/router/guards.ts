/**
 * Navigation guards and after-each hook (overview §5.4, M01 FR-M01-12/13/14, BR-07/08/09/23).
 *
 * Before each navigation, in order:
 * 1. **Session check**: `session.check()` reloads `pp.auth` and drops an expired session (by the
 *    shared clock).
 * 2. **Auth**: `access: 'auth'` and no session → `/login?redirect=<requested path>` (v2; the 401
 *    policy goes to plain `/login`), no message (FR-M01-14, BR-08).
 * 2b. **Forced password change** (AM2-A1, DV-26), before the role check: a session flagged
 *    `mustChangePassword` can open only `/password/change` and `/logout` (one trailing slash
 *    ignored, query and hash ignored; a nested path is not exempt); every other path (login,
 *    register, reset links included) goes to `/password/change`, ahead of the role and scope checks.
 * 3. **Role**: `roles` set and the role not in it → `onForbidden`: `landing` redirects to the
 *    server-given `landingPath` (BR-07); `403` / `404` render the error page in place.
 * 4. **Guest pages have no guard**: `/login` and `/register` render for a logged-in user too
 *    (FR-M01-13, BR-08). There is deliberately no guest-only guard. This does not hold for a
 *    flagged session (step 2b): it is sent to `/password/change` from `/login` and `/register` too.
 *
 * The guards never look at `isActive`: an inactive account is refused at login only; an already
 * open session is not ended (BR-23).
 *
 * After each successful navigation: reset the page meta, set the exact tab title, consume the
 * pending flash, close the shell overlays, and (logged in) refresh the cached user and the bell
 * badge in the background (FR-M01-52/53), except while the session is flagged (both calls would be
 * refused with 403 until the password is changed). Scrolling is the router's `scrollBehavior` (./index.ts).
 */

import type { RouteLocationNormalized, RouteLocationRaw, Router } from 'vue-router'

import { formatTabTitle } from '@/composables/tabTitle'
import { usePageMeta } from '@/composables/usePageMeta'
import { useFlashStore } from '@/stores/flash'
import { useNotificationBadgeStore } from '@/stores/notification-badge'
import { useSessionStore } from '@/stores/session'
import type { Role } from '@/stores/session-types'
import { useShellStore } from '@/stores/shell'

import {
  isPathAllowed,
  isPrototypeRole,
  isPrototypeScopeOn,
  SCOPE_PAGE_TITLE,
  scopeHomePath,
} from '../prototype-scope'
import { resolveShell } from './layouts'
import { DEFAULT_ACCESS, DEFAULT_LAYOUT, DEFAULT_ON_FORBIDDEN, resolveTitle } from './meta'
import {
  FORBIDDEN_TITLE,
  NOT_FOUND_TITLE,
  setRouteOutcome,
  useRouteOutcome,
  type RouteOutcome,
} from './outcome'

export const LOGIN_PATH = '/login'
export const PASSWORD_CHANGE_PATH = '/password/change'

/** The only paths a flagged session may open (the API refuses everything else, 403). */
const PASSWORD_CHANGE_ALLOWED = [PASSWORD_CHANGE_PATH, '/logout']

/** A same-origin app path that is worth returning to (not `/`, not an auth page, no `//host`). */
export function isSafeRedirect(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return false
  if (value.includes('\\') ||value === '/') return false
  const path = value.split(/[?#]/)[0] ?? ''
  return !['/login', '/logout', '/register'].includes(path)
}

/** Name of the catch-all 404 route (core-routes.ts). */
const NOT_FOUND_ROUTE_NAME = 'core.not-found'

/** What the guard needs from the session store. */
export interface GuardSession {
  readonly isLoggedIn: boolean
  readonly role: Role | null
  readonly landingPath: string | null
  /** The session is flagged: only `/password/change` and `/logout` may open (AM2-A1). */
  readonly mustChangePassword?: boolean
}

export type AccessDecision =
  { kind: 'allow' } | { kind: 'redirect'; to: string } | { kind: 'in-place'; status: RouteOutcome }

const ALLOW: AccessDecision = { kind: 'allow' }

/** Steps 2–3 of overview §5.4 for an already checked session. Pure, for unit tests. */
export function decideAccess(to: RouteLocationNormalized, session: GuardSession): AccessDecision {
  const access = to.meta.access ?? DEFAULT_ACCESS
  const roles = to.meta.roles

  if (session.isLoggedIn && session.mustChangePassword === true) {
    return PASSWORD_CHANGE_ALLOWED.includes(
      to.path.length > 1 && to.path.endsWith('/') ? to.path.slice(0, -1) : to.path,
    )
      ? ALLOW
      : { kind: 'redirect', to: PASSWORD_CHANGE_PATH }
  }

  // A role list implies a session.
  if ((access === 'auth' || roles !== undefined) && !session.isLoggedIn) {
    return { kind: 'redirect', to: LOGIN_PATH }
  }

  if (roles !== undefined && (session.role === null || !roles.includes(session.role))) {
    const outcome = to.meta.onForbidden ?? DEFAULT_ON_FORBIDDEN
    if (outcome === '403') return { kind: 'in-place', status: 403 }
    if (outcome === '404') return { kind: 'in-place', status: 404 }
    // In scope (D43) a prototype role goes to its own home, not the server landing: the real API
    // lands a school admin on `/admin` (Admin Pusat only), which would bounce here forever.
    const landing =
      isPrototypeScopeOn() && isPrototypeRole(session.role)
        ? scopeHomePath(session.role)
        : session.landingPath
    // A landing path that itself refuses the role would loop; show the 403 page instead.
    if (landing === null || landing === to.path) return { kind: 'in-place', status: 403 }
    return { kind: 'redirect', to: landing }
  }

  // The server-given landing of a teacher / school admin is `/dashboard` (the student page, M01
  // BR-07, INFERRED); a v2 staff role lands on its own home instead (teacher `/guru`, school admin
  // `/admin-sekolah`, Admin Pusat `/admin/command-center`). With the scope on or off, since the v2
  // shells frame these roles in every build. None of those homes leads back to `/dashboard`.
  const home = scopeHomePath(session.role)
  if (
    to.path === '/dashboard' &&
    session.isLoggedIn &&
    session.role !== 'student' &&
    home !== '/dashboard' &&
    isPrototypeRole(session.role)
  ) {
    return { kind: 'redirect', to: home }
  }

  // Prototype scope (D43): a route outside the role's allowed set renders the friendly "Belum
  // tersedia" page in place (URL unchanged). That includes a path no screen exists for (an unbuilt
  // or mistyped URL): a logged-in user gets the friendly page, a guest keeps the plain 404.
  if (isPrototypeScopeOn() && (to.name !== NOT_FOUND_ROUTE_NAME || session.isLoggedIn)) {
    if (!isPathAllowed(session.role, to.path)) {
      // Never show "Belum tersedia": send a logged-in prototype role to its own home. The page
      // stays only where no home exists (guest, or the home itself is out of scope).
      if (isPrototypeRole(session.role) && home !== to.path && isPathAllowed(session.role, home)) {
        return { kind: 'redirect', to: home }
      }
      return { kind: 'in-place', status: 'scope' }
    }
  }

  return ALLOW
}

/**
 * Installs the before-each guard and the after-each hook. Stores are resolved per navigation, so
 * Pinia must be installed on the app before the first navigation runs.
 */
export function installGuards(router: Router): void {
  // The in-place outcome is decided before the navigation but committed only once it has
  // succeeded (F13-1). A failed or errored navigation (a guard returning `false`, a lazy chunk
  // that fails to load) never commits it, so the page still shown keeps its own outcome.
  let pendingOutcome: RouteOutcome | null = null

  router.beforeEach((to): RouteLocationRaw | true => {
    const session = useSessionStore()
    session.check()

    const decision = decideAccess(to, session)
    pendingOutcome = decision.kind === 'in-place' ? decision.status : null
    if (decision.kind !== 'redirect') return true
    // v2 usability: a guest sent to /login remembers the page asked for (`?redirect=`); the login
    // page returns there when the role may open it. The 401 policy and `/logout` stay plain.
    if (decision.to === LOGIN_PATH && isSafeRedirect(to.fullPath)) {
      return { path: LOGIN_PATH, query: { redirect: to.fullPath } }
    }
    return decision.to
  })

  router.afterEach((to, _from, failure) => {
    const next = pendingOutcome
    pendingOutcome = null
    if (failure) return
    setRouteOutcome(next)
    runAfterNavigation(to)
  })
}

/** The after-each work (overview §5.4 step 5). Exported for unit tests. */
export function runAfterNavigation(to: RouteLocationNormalized): void {
  const pageMeta = usePageMeta()
  pageMeta.reset()

  const title = titleFor(to)
  if (title !== null && typeof document !== 'undefined') document.title = formatTabTitle(title)

  useFlashStore().consume()
  useShellStore().closeOverlays()

  const session = useSessionStore()
  // A flagged session gets 403 on both calls until the password is changed (AM2-A1).
  if (session.isLoggedIn && !session.mustChangePassword) {
    void session.refreshUser()
    void useNotificationBadgeStore().refresh()
  }
}

function titleFor(to: RouteLocationNormalized): string | null {
  // In-place error pages keep the URL but show their own tab title.
  const status = useRouteOutcome().value
  if (status === 403) return FORBIDDEN_TITLE
  if (status === 404) return NOT_FOUND_TITLE
  if (status === 'scope') return SCOPE_PAGE_TITLE
  // A guest on a `public-or-user` route sees the public layout's title (F-20, M09 FR-M09-29/82).
  const guestTitle = to.meta.guestTitle
  if (
    guestTitle !== undefined &&
    resolveShell(to.meta.layout ?? DEFAULT_LAYOUT, useSessionStore()) === 'public'
  ) {
    return typeof guestTitle === 'function' ? guestTitle(to) : guestTitle
  }
  return resolveTitle(to)
}

/**
 * Where to go after a successful login: the remembered `redirect` when it resolves to a real page
 * the signed-in role may open, otherwise the role landing path.
 */
export function resolvePostLoginTarget(
  router: Router,
  redirect: unknown,
  session: GuardSession,
): string {
  const landing = session.landingPath ?? '/'
  if (!isSafeRedirect(redirect)) return landing
  const resolved = router.resolve(redirect)
  if (resolved.name === NOT_FOUND_ROUTE_NAME) return landing
  return decideAccess(resolved as RouteLocationNormalized, session).kind === 'allow' ? resolved.fullPath : landing
}
