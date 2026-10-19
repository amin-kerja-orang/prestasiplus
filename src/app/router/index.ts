/**
 * App router (overview §5): `createWebHistory`, routes from the module registry, guards in the
 * §5.4 order, and scroll to the top (or to the hash) after every navigation.
 */

import {
  createRouter,
  createWebHashHistory,
  createWebHistory,
  type RouteRecordRaw,
  type Router,
  type RouterHistory,
  type RouterScrollBehavior,
} from 'vue-router'

import { useNotificationBadgeStore } from '@/stores/notification-badge'
import { setUnauthorizedRedirect } from '@/stores/session'

import { modules, type ModuleManifest } from '../modules'
import { catchAllRoute, devRoutes, leadingCoreRoutes } from './core-routes'
import { installGuards, LOGIN_PATH } from './guards'

export * from './guards'
export * from './layouts'
export * from './meta'
export * from './outcome'

/**
 * Live does a full page load on every navigation (query-only changes too), so the page always
 * starts at the top; a hash (e.g. `/panduan#pelajar`) scrolls to its anchor.
 */
export const scrollBehavior: RouterScrollBehavior = (to) => (to.hash ? { el: to.hash } : { top: 0 })

/** Core routes, then every module's routes in registry order, then the dev routes and the 404. */
export function buildRoutes(registry: readonly ModuleManifest[] = modules): RouteRecordRaw[] {
  return [...leadingCoreRoutes, ...registry.flatMap((m) => m.routes), ...devRoutes(), catchAllRoute]
}

export interface CreateAppRouterOptions {
  history?: RouterHistory
  registry?: readonly ModuleManifest[]
}

export function createAppRouter(options: CreateAppRouterOptions = {}): Router {
  const router = createRouter({
    history:
      options.history ??
      // Static-hosting artifact build (`npm run build:artifact`): hash routing, no server rewrites.
      (import.meta.env.VITE_HASH_HISTORY === 'true'
        ? createWebHashHistory()
        : createWebHistory(import.meta.env.BASE_URL)),
    routes: buildRoutes(options.registry),
    scrollBehavior,
  })
  installGuards(router)
  return router
}

/**
 * 401 policy (FR-M01-14): after the session store has cleared the session, go to `/login` with no
 * query and no message. Returns the unregister function.
 */
export function connectUnauthorizedRedirect(router: Router): () => void {
  return setUnauthorizedRedirect(() => {
    useNotificationBadgeStore().reset()
    return router.replace(LOGIN_PATH)
  })
}
