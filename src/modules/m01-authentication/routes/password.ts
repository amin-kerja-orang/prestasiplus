import type { RouteRecordRaw } from 'vue-router'

/**
 * M01 route fragment: S3 forgot password, S4 reset with token, S5 IC reset (M01-T4). All are public
 * bare pages (they draw their own card) and render for a logged-in user too (FR-M01-13). Tab titles
 * are exact (FR-M01-67); no suffix is added by the router.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/password/reset',
    name: 'm01.password.forgot',
    component: () => import('../pages/PasswordForgotPage.vue'),
    meta: {
      layout: 'bare',
      access: 'public',
      title: 'Lupa Kata Laluan - PRESTASIPLUS',
      module: 'M01',
    },
  },
  {
    path: '/password/reset-ic',
    name: 'm01.password.reset-ic',
    component: () => import('../pages/PasswordResetIcPage.vue'),
    meta: {
      layout: 'bare',
      access: 'public',
      title: 'Set Semula Kata Laluan (No IC) - PRESTASIPLUS',
      module: 'M01',
    },
  },
  {
    path: '/password/reset/:token',
    name: 'm01.password.reset',
    component: () => import('../pages/PasswordResetPage.vue'),
    meta: {
      layout: 'bare',
      access: 'public',
      title: 'Set Semula Kata Laluan - PRESTASIPLUS',
      module: 'M01',
    },
  },
]

export default routes
