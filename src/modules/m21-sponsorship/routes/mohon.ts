import type { RouteRecordRaw } from 'vue-router'

/**
 * M21 route fragment: S6 Mohon Keluarga Angkat (`/mohon-keluarga-angkat`, M21-T2). User shell, every
 * signed-in role (FR-M21-07, FR-M21-09); a guest goes to `/login`. Header title "Mohon Keluarga Angkat"
 * instead of the live "Dashboard" (DV-M21-06, FR-M21-05); the tab title is the live one.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/mohon-keluarga-angkat',
    name: 'm21.mohon-keluarga-angkat',
    component: () => import('../pages/MohonKeluargaAngkatPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Mohon Keluarga Angkat',
      header: { title: 'Mohon Keluarga Angkat', subtitle: 'Selamat datang kembali' },
      module: 'M21',
    },
  },
]

export default routes
