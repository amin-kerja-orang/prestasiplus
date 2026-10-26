import type { RouteRecordRaw } from 'vue-router'

/**
 * M01 route fragment: S3 forgot password, S4 reset with token, S5 IC reset (M01-T4), plus the forced
 * change `/password/change` (AM2-A1, DV-26: signed-in, any role). All are bare pages (they draw
 * their own card); the three reset pages are public and render for a logged-in user too
 * (FR-M01-13). Tab titles are exact (FR-M01-67); no suffix is added by the router.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/password/reset',
    name: 'm01.password.forgot',
    // S3, or S4 when the mailed link carries `#token=...` (SW8-07b).
    component: () => import('../pages/PasswordResetEntryPage.vue'),
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
      title: 'Reset Kata Laluan (No IC) - PRESTASIPLUS',
      module: 'M01',
    },
  },
  {
    // AM2-A1 / DV-26: the forced password change. Needs a session (any role); under the `/password`
    // scope prefix, so every role may open it in the prototype scope.
    path: '/password/change',
    name: 'm01.password.change',
    component: () => import('../pages/PasswordChangeRequiredPage.vue'),
    meta: {
      layout: 'bare',
      access: 'auth',
      title: 'Tukar Kata Laluan - PRESTASIPLUS',
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
      title: 'Reset Kata Laluan - PRESTASIPLUS',
      module: 'M01',
    },
  },
]

export default routes
