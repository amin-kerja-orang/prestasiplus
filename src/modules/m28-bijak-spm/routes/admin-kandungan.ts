import type { RouteRecordRaw } from 'vue-router'

import { KANDUNGAN_ROUTES } from '../admin/kandungan/api'

/**
 * Kandungan SPM hub and its lanes (`/admin/spm`, `/admin/spm/{lane}`; R1-ADM-Q-01, Q-02). Admin Pusat only. Menu KS-01
 * points at the hub, KS-06 at the Bijak SPM lane.
 */
const base = { layout: 'admin', access: 'auth', roles: ['admin'], module: 'M06', v2: true } as const

const routes: RouteRecordRaw[] = [
  {
    path: '/admin/spm',
    name: KANDUNGAN_ROUTES.hub,
    component: () => import('../admin/kandungan/pages/KandunganHubPage.vue'),
    meta: { ...base, title: 'SPM - Admin PRESTASIPLUS', header: { title: 'SPM' } },
  },
  {
    path: '/admin/spm/databank',
    name: KANDUNGAN_ROUTES.databank,
    component: () => import('../admin/kandungan/pages/LaneDatabankPage.vue'),
    meta: { ...base, title: 'Databank Soalan - Admin PRESTASIPLUS', header: { title: 'Databank Soalan' } },
  },
  {
    path: '/admin/spm/simulasi',
    name: KANDUNGAN_ROUTES.simulasi,
    component: () => import('../admin/kandungan/pages/LaneSimulasiPage.vue'),
    meta: { ...base, title: 'Bijak SPM - Admin PRESTASIPLUS', header: { title: 'Bijak SPM' } },
  },
  {
    path: '/admin/spm/subjektif',
    name: KANDUNGAN_ROUTES.subjektif,
    component: () => import('../admin/kandungan/pages/LaneSubjektifPage.vue'),
    meta: { ...base, title: 'Subjektif - Admin PRESTASIPLUS', header: { title: 'Subjektif' } },
  },
  {
    path: '/admin/spm/latih-tubi',
    name: KANDUNGAN_ROUTES.latihTubi,
    component: () => import('../admin/kandungan/pages/LaneLatihTubiPage.vue'),
    meta: { ...base, title: 'Latih Tubi - Admin PRESTASIPLUS', header: { title: 'Latih Tubi' } },
  },
  {
    path: '/admin/spm/tracking-a',
    name: KANDUNGAN_ROUTES.trackingA,
    component: () => import('../admin/kandungan/pages/TrackingAListPage.vue'),
    meta: { ...base, title: 'Tracking A - Admin PRESTASIPLUS', header: { title: 'Tracking A' } },
  },
  {
    path: '/admin/spm/tracking-a/:set/sunting',
    name: KANDUNGAN_ROUTES.trackingAEdit,
    component: () => import('../admin/kandungan/pages/TrackingASetEditorPage.vue'),
    meta: { ...base, title: 'Tracking A - Admin PRESTASIPLUS', header: { title: 'Tracking A' } },
  },
]

export default routes
