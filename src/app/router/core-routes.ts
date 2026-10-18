/**
 * Core routes (overview §5.5): `/`, `/logout`, the dev-only galleries and the catch-all 404.
 * Module routes come from the registry (`src/app/modules.ts`) and are listed before these.
 */

import type { RouteRecordRaw } from 'vue-router'

import NotFoundPage from '@/pages/NotFoundPage.vue'
import { useNotificationBadgeStore } from '@/stores/notification-badge'
import { useSessionStore } from '@/stores/session'

import { isPrototypeScopeOn } from '../prototype-scope'
import { LOGIN_PATH } from './guards'
import { NOT_FOUND_TITLE } from './outcome'
import EmptyRoute from './placeholders/EmptyRoute.vue'

/**
 * `/`: the public landing page is out of scope (M01 §1). A guest goes to `/login`, a logged-in
 * user to their landing path (overview §5.5).
 */
const rootRoute: RouteRecordRaw = {
  path: '/',
  name: 'core.root',
  component: EmptyRoute,
  meta: { layout: 'bare', access: 'public' },
  beforeEnter: () => {
    const session = useSessionStore()
    return session.isLoggedIn && session.landingPath ? session.landingPath : LOGIN_PATH
  },
}

/**
 * `/logout` (FR-M01-37): `POST /api/auth/logout`, clear the session whatever the result, then
 * `/login` with no message. Returning the location from the guard replaces the `/logout`
 * navigation, so `/logout` never becomes a history entry (the SPA form of live's 302).
 */
const logoutRoute: RouteRecordRaw = {
  path: '/logout',
  name: 'core.logout',
  component: EmptyRoute,
  meta: { layout: 'bare', access: 'public' },
  beforeEnter: async () => {
    await useSessionStore().logout()
    useNotificationBadgeStore().reset() // the next user must not see this user's unread count
    return LOGIN_PATH
  },
}

/**
 * Catch-all 404 (M01 S10, FR-M01-50). Unbuilt modules' paths resolve here too. The page is a
 * page is `src/pages/NotFoundPage.vue` (F-21).
 */
const notFoundRoute: RouteRecordRaw = {
  path: '/:pathMatch(.*)*',
  name: 'core.not-found',
  component: NotFoundPage,
  meta: { layout: 'bare', access: 'public', title: NOT_FOUND_TITLE },
}

/**
 * Dev-only routes (build-plan F-13 v1.6): registered only when `import.meta.env.DEV`, so the demo
 * and e2e builds drop them (and their chunks) entirely.
 */
export function devRoutes(): RouteRecordRaw[] {
  // The preview hub (D20) is also shown in the demo build; it carries no test-hook marker, so the
  // demo-bundle guard is unaffected. The e2e build gets neither.
  // Prototype scope (D43): neither the hub ("pautan semua skrin") nor the `/__dev/*` pages exist in
  // any mode; only the design-system sandbox `/__ds` stays. `VITE_PROTOTYPE_SCOPE=off` restores them.
  const scoped = isPrototypeScopeOn()
  // In scope, the admin landing `/admin` (D48) has no M17 dashboard page yet, so it opens the admin
  // Command Center instead of a 404.
  const hub: RouteRecordRaw[] = scoped
    ? [{ path: '/admin', redirect: '/admin/command-center' }]
    : import.meta.env.DEV || import.meta.env.MODE === 'demo'
      ? previewHubRoutes()
      : []
  // Design-system gallery (V2-T05): dev and demo, never the e2e build.
  const ds: RouteRecordRaw[] =
    import.meta.env.DEV || import.meta.env.MODE === 'demo'
      ? [
          {
            path: '/__ds',
            name: 'dev.ds-gallery',
            component: () => import('@/dev/ds/DsGallery.vue'),
            meta: { layout: 'bare', access: 'public', title: 'Galeri komposit (dev)' },
          },
        ]
      : []
  if (!import.meta.env.DEV || scoped) return [...hub, ...ds]
  return [
    ...hub,
    ...ds,
    {
      path: '/__dev/tokens',
      name: 'dev.token-gallery',
      component: () => import('@/styles/gallery/TokenGallery.vue'),
      meta: { layout: 'bare', access: 'public', title: 'Token gallery (dev)' },
    },
    {
      path: '/__dev/feedback',
      name: 'dev.feedback-gallery',
      component: () => import('@/components/feedback/gallery/FeedbackGallery.vue'),
      meta: { layout: 'bare', access: 'public', title: 'Feedback gallery (dev)' },
    },
    {
      // Delivery Lead convenience (not a build-plan task): lets the user see the built shell
      // chrome per role before any module page exists. See ShellPreviewPicker.vue.
      path: '/__dev/shell',
      name: 'dev.shell-picker',
      component: () => import('@/shells/dev/ShellPreviewPicker.vue'),
      meta: { layout: 'bare', access: 'public', title: 'Pratonton bingkai (dev)' },
    },
    {
      path: '/__dev/shell/preview',
      name: 'dev.shell-preview',
      component: () => import('@/shells/dev/ShellPreviewPage.vue'),
      meta: { layout: 'user', access: 'auth', title: 'Pratonton bingkai (dev)' },
    },
    {
      // F-18 admin shell preview: admin, or the teacher variant for a teacher session.
      path: '/__dev/shell/admin',
      name: 'dev.shell-admin',
      component: () => import('@/shells/dev/ShellPreviewAdmin.vue'),
      meta: {
        layout: 'admin',
        access: 'auth',
        roles: ['admin', 'teacher'],
        title: 'Pratonton bingkai admin (dev)',
        header: { title: 'Pratonton Bingkai Admin', subtitle: 'Dev sahaja' },
      },
    },
  ]
}

/**
 * Temporary landing placeholders (D20) until M17 (`/admin`) and M05 (`/dashboard`) exist. They are
 * listed after every module route, and vue-router ranks equal paths by insertion order (earlier
 * wins, duplicates do not throw), so a real module route with the same path wins with no edit.
 */
function previewHubRoutes(): RouteRecordRaw[] {
  return [
    {
      path: '/admin',
      name: 'dev.preview-hub-admin',
      component: () => import('@/shells/dev/PreviewHub.vue'),
      meta: {
        layout: 'admin',
        access: 'auth',
        roles: ['admin'],
        title: 'Pratonton Prototaip',
        header: { title: 'Pratonton Prototaip' },
      },
    },
    {
      path: '/dashboard',
      name: 'dev.preview-hub-user',
      component: () => import('@/shells/dev/PreviewHub.vue'),
      meta: { layout: 'user', access: 'auth', title: 'Pratonton Prototaip' },
    },
  ]
}

/** Core routes that precede the module routes. */
export const leadingCoreRoutes: readonly RouteRecordRaw[] = [
  rootRoute,
  logoutRoute,
  // Unbuilt Pentadbiran items have no screen (`docs/requirements/v2-pentadbiran-backlog.md`). The
  // old placeholder URL `/admin/p/<id>` goes to the admin home instead of a "not available" page.
  { path: '/admin/p/:itemId', redirect: '/admin/command-center' },
]

/** Must be the last route. */
export const catchAllRoute: RouteRecordRaw = notFoundRoute
