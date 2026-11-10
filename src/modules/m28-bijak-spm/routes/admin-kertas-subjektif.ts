import type { RouteRecordRaw } from 'vue-router'

import { SUBJEKTIF_ROUTES } from '../admin/papers/ui'

/**
 * Kertas Subjektif admin routes (S3-T06, PRD30 Q-18): the list, the paper detail and the V2 path alias
 * `/admin/spm/kertas-subjektif`. Admin Pusat only. The list carries the route name reserved in
 * `KANDUNGAN_ROUTES` for the Kandungan SPM hub.
 */
const base = {
  layout: 'admin',
  access: 'auth',
  roles: ['admin'],
  module: 'M06',
  v2: true,
} as const

const routes: RouteRecordRaw[] = [
  { path: '/admin/spm/kertas-subjektif', redirect: '/admin/kertas-subjektif' },
  {
    path: '/admin/kertas-subjektif',
    name: SUBJEKTIF_ROUTES.list,
    component: () => import('../admin/papers/SubjektifPaperListPage.vue'),
    meta: {
      ...base,
      title: 'Kertas Subjektif - Admin Panel',
      header: { title: 'Kertas Subjektif', subtitle: 'Kertas 2/3/4 percubaan negeri — pratonton & terbitan' },
    },
  },
  {
    path: '/admin/kertas-subjektif/dokumen/:id',
    name: SUBJEKTIF_ROUTES.dokumen,
    component: () => import('../admin/papers/SubjektifDokumenPreviewPage.vue'),
    meta: {
      ...base,
      title: 'Kertas Subjektif - Admin Panel',
      header: { title: 'Kertas Subjektif' },
    },
  },
  {
    path: '/admin/kertas-subjektif/:id',
    name: SUBJEKTIF_ROUTES.detail,
    component: () => import('../admin/papers/SubjektifPaperDetailPage.vue'),
    meta: {
      ...base,
      title: 'Kertas Subjektif - Admin Panel',
      header: { title: 'Kertas Subjektif' },
    },
  },
]

export default routes
