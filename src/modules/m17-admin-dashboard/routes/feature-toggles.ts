import type { RouteRecordRaw } from 'vue-router'

/**
 * M17 route fragment: `/admin/feature-toggles` "Kawalan Ciri" (S0-T10, R1-ADM-N-06). Admin Pusat only;
 * another role gets the 403 page.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin/feature-toggles',
    name: 'm17.feature-toggles',
    component: () => import('../pages/FeatureTogglesPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      onForbidden: '403',
      title: 'Kawalan Ciri',
      header: { title: 'Kawalan Ciri', subtitle: 'Hidupkan / matikan ciri untuk Pelajar & Guru' },
      module: 'M17',
      v2: true,
    },
  },
]

export default routes
