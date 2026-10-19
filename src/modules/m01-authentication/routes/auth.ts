import type { RouteRecordRaw } from 'vue-router'

/**
 * M01 route fragment: S1 Login, S2 Register (M01-T3). Both are public bare pages (they draw their
 * own auth layout) and render for a logged-in user too, with no guest-only guard (FR-M01-13).
 * Tab titles are exact (FR-M01-67); no suffix is added by the router.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'm01.login',
    component: () => import('../pages/LoginPage.vue'),
    meta: { layout: 'bare', access: 'public', title: 'Log Masuk - PRESTASIPLUS', module: 'M01' },
  },
  {
    path: '/register',
    name: 'm01.register',
    component: () => import('../pages/RegisterPage.vue'),
    meta: { layout: 'bare', access: 'public', title: 'Daftar - PRESTASIPLUS', module: 'M01' },
  },
]

export default routes
