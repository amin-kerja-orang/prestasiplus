import type { RouteLocationNormalized, RouteLocationRaw, RouteRecordRaw } from 'vue-router'

/**
 * SW8-07 (DV-29): the API mails `/password/reset#token=…&email=…` (the token stays out of the path,
 * logs and Referer), while S4 is `/password/reset/:token?email=`. A hash that carries a token goes
 * to S4 (a redirect, so the hash is not kept in history); any other visit is the forgot page (S3).
 */
export function resetLinkTarget(
  to: Pick<RouteLocationNormalized, 'hash'>,
): true | RouteLocationRaw {
  const params = new URLSearchParams(to.hash.replace(/^#/, ''))
  const token = params.get('token')?.trim()
  if (!token) return true
  const email = params.get('email')?.trim()
  return {
    path: `/password/reset/${encodeURIComponent(token)}`,
    query: email ? { email } : {},
    replace: true,
  }
}

/**
 * M01 route fragment: S3 forgot password, S4 reset with token, S5 IC reset (M01-T4). All are public
 * bare pages (they draw their own card) and render for a logged-in user too (FR-M01-13). Tab titles
 * are exact (FR-M01-67); no suffix is added by the router.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/password/reset',
    name: 'm01.password.forgot',
    beforeEnter: resetLinkTarget,
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
      title: 'Reset Kata Laluan (No IC) - PRESTASIPLUS',
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
