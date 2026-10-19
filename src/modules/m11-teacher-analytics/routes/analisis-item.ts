import type { RouteRecordRaw } from 'vue-router'

/**
 * M11 route fragment "analisis-item": S6 `/guru/analisis-item` (`?subject_id=&classroom_id=`), user
 * shell (FR-M11-04). Teacher and admin only (M10 §7 **T** guard); `/guru/analisis-item/{x}` renders the
 * global 404 (FR-M11-07).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/guru/analisis-item',
    name: 'guru-analisis-item',
    component: () => import('../pages/AnalisisItemPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['teacher', 'admin'],
      title: 'Analisis Item Soalan - Portal Guru',
      header: {
        title: 'Analisis Item Soalan',
        subtitle: 'Kenal pasti soalan yang sukar dan indeks diskriminasi',
      },
      module: 'M11',
      v2: true,
    },
  },
]

export default routes
