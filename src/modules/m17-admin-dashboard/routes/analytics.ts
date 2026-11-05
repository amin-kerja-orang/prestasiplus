import type { RouteRecordRaw } from 'vue-router'

/**
 * M17 route fragment: `/admin/analytics` Analitik (R1-ADM-M-05). Admin Pusat only, admin shell (S6-T11).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin/analytics',
    name: 'm17.admin-analytics',
    component: () => import('../pages/AdminAnalitikPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: 'Analitik & Statistik - Admin Panel',
      header: { title: 'Analitik & Statistik', subtitle: 'Analisis kandungan soalan platform' },
      module: 'M17',
      v2: true,
    },
  },
]

export default routes
