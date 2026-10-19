import type { RouteRecordRaw } from 'vue-router'

/**
 * M08 route fragment "class" (M08-T7; build-plan §S.3 rule 2): S5 `/prestasi/kelas/:id` and S8
 * `/analitik/kelas`. Admin and teacher only: every other role gets the standalone 404 for S5 (BR-M08-26,
 * "none → 404", INFERRED) and the 403 page for S8 (§9 "none"). S4, S10 and S11 are M08-T5's pages.
 * An unknown or unpermitted class is decided by the API (S5 404, S8 403). The S5 tab title and header
 * are set from the class (`{kelas} — Dashboard Kelas`, FR-M08-03).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/prestasi/kelas/:id',
    name: 'm08.prestasi.kelas.detail',
    component: () => import('../pages/PrestasiKelasDetailPage.vue'),
    meta: {
      ownsH1: true,
      layout: 'user',
      access: 'auth',
      roles: ['admin', 'teacher', 'school_admin'],
      onForbidden: '404',
      title: 'Dashboard Kelas',
      module: 'M08',
      v2: true,
    },
  },
  {
    path: '/analitik/kelas',
    name: 'm08.analitik.kelas',
    component: () => import('../pages/AnalitikKelasPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['admin', 'teacher'],
      onForbidden: '403',
      title: 'Analitik Kelas',
      header: {
        title: 'Analitik Kelas',
        subtitle: 'Pantau prestasi pelajar dan kenal pasti yang memerlukan perhatian',
      },
      module: 'M08',
      v2: true,
    },
  },
]

export default routes
