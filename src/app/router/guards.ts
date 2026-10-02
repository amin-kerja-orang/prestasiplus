/**
 * Navigation guards and after-each hook (overview §5.4, M01 FR-M01-12/13/14, BR-07/08/09/23).
 *
 * Before each navigation, in order:
 * 1. **Session check**: `session.check()` reloads `pp.auth` and drops an expired session (by the
 *    shared clock).
 * 2. **Auth**: `access: 'auth'` and no session → `/login`, with no `redirect` query and no message
 *    (FR-M01-14, BR-08).
 * 3. **Role**: `roles` set and the role not in it → `onForbidden`: `landing` redirects to the
 *    server-given `landingPath` (BR-07); `403` / `404` render the error page in place.
 * 4. **Guest pages have no guard**: `/login` and `/register` render for a logged-in user too
 *    (FR-M01-13, BR-08). There is deliberately no guest-only guard.
 *
 * The guards never look at `isActive`: an inactive account is refused at login only; an already
 * open session is not ended (BR-23).
 *
 * After each successful navigation: reset the page meta, set the exact tab title, consume the
 * pending flash, close the shell overlays, and (logged in) refresh the cached user and the bell
 * badge in the background (FR-M01-52/53). Scrolling is the router's `scrollBehavior` (./index.ts).
 */

import type { RouteLocationNormalized, RouteLocationRaw, Router } from 'vue-router'

import { usePageMeta } from '@/composables/usePageMeta'
import { useFlashStore } from '@/stores/flash'
import { useNotificationBadgeStore } from '@/stores/notification-badge'
import { useSessionStore } from '@/stores/session'
import type { Role } from '@/stores/session-types'
import { useShellStore } from '@/stores/shell'

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

/** What the guard needs from the session store. */
export interface GuardSession {
  readonly isLoggedIn: boolean
  readonly role: Role | null
  readonly landingPath: string | null
}

export type AccessDecision =
  { kind: 'allow' } | { kind: 'redirect'; to: string } | { kind: 'in-place'; status: RouteOutcome }

const ALLOW: AccessDecision = { kind: 'allow' }

/** Steps 2–3 of overview §5.4 for an already checked session. Pure, for unit tests. */
export function decideAccess(to: RouteLocationNormalized, session: GuardSession): AccessDecision {
  const access = to.meta.access ?? DEFAULT_ACCESS
  const roles = to.meta.roles

  // A role list implies a session.
  if ((access === 'auth' || roles !== undefined) && !session.isLoggedIn) {
    return { kind: 'redirect', to: LOGIN_PATH }
  }

  if (roles !== undefined && (session.role === null || !roles.includes(session.role))) {
    const outcome = to.meta.onForbidden ?? DEFAULT_ON_FORBIDDEN
    if (outcome === '403') return { kind: 'in-place', status: 403 }
    if (outcome === '404') return { kind: 'in-place', status: 404 }
    const landing = session.landingPath
    // A landing path that itself refuses the role would loop; show the 403 page instead.
    if (landing === null || landing === to.path) return { kind: 'in-place', status: 403 }
    return { kind: 'redirect', to: landing }
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
    return decision.kind === 'redirect' ? decision.to : true
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
  if (title !== null && typeof document !== 'undefined') document.title = title

  useFlashStore().consume()
  useShellStore().closeOverlays()

  const session = useSessionStore()
  if (session.isLoggedIn) {
    void session.refreshUser()
    void useNotificationBadgeStore().refresh()
  }
}

function titleFor(to: RouteLocationNormalized): string | null {
  // In-place error pages keep the URL but show their own tab title.
  const status = useRouteOutcome().value
  if (status === 403) return FORBIDDEN_TITLE
  if (status === 404) return NOT_FOUND_TITLE
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
