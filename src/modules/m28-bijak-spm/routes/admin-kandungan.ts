import type { RouteRecordRaw } from 'vue-router'

import { KANDUNGAN_ROUTES } from '../admin/kandungan/api'

/**
 * Kandungan SPM hub and its R1 lanes (V2 `/admin/spm`, `/admin/spm/{lane}`; AC-R1-21.1, 21.2). Admin Pusat only. Menu KS-01
 * points at the hub, KS-06 at the Bijak SPM lane.
 */
const base = { layout: 'admin', access: 'auth', roles: ['admin'], module: 'M06', v2: true } as const

const routes: RouteRecordRaw[] = [
  {
    path: '/admin/spm',
    name: KANDUNGAN_ROUTES.hub,
    component: () => import('../admin/kandungan/pages/KandunganHubPage.vue'),
    meta: { ...base, title: 'Kandungan SPM - Admin PRESTASIPLUS', header: { title: 'Kandungan SPM' } },
  },
  {
    path: '/admin/spm/databank',
    name: KANDUNGAN_ROUTES.databank,
    component: () => import('../admin/kandungan/pages/LaneDatabankPage.vue'),
    meta: { ...base, title: 'Databank Soalan - Admin PRESTASIPLUS', header: { title: 'Kandungan SPM' } },
  },
  {
    path: '/admin/spm/simulasi',
    name: KANDUNGAN_ROUTES.simulasi,
    component: () => import('../admin/kandungan/pages/LaneSimulasiPage.vue'),
    meta: { ...base, title: 'Bijak SPM - Admin PRESTASIPLUS', header: { title: 'Kandungan SPM' } },
  },
]

export default routes
