import type { RouteRecordRaw } from 'vue-router'

import { INTAKE_ROUTES } from '../admin/intake/lib/intake-routes'

/**
 * Admin SPM question intake (v2-question-bank 4.2-4.8): upload a paper, review / edit the extract,
 * list the batches. Admin Pusat only (D40: approver Guru or Admin Pusat; the Guru entry lives in the
 * teacher portal later). Menu entries are owned by the Pentadbiran menu, not by these routes.
 */
const base = {
  layout: 'admin',
  access: 'auth',
  roles: ['admin'],
  module: 'M06',
  v2: true,
} as const

const routes: RouteRecordRaw[] = [
  {
    path: '/admin/spm/soalan/ekstrak',
    name: INTAKE_ROUTES.list,
    component: () => import('../admin/intake/pages/IntakeListPage.vue'),
    meta: {
      ...base,
      title: 'Senarai Ekstrak - Admin PRESTASIPLUS',
      header: { title: 'Senarai Ekstrak', subtitle: 'Kertas SPM yang dimuat naik' },
    },
  },
  {
    path: '/admin/spm/soalan/muat-naik',
    name: INTAKE_ROUTES.upload,
    component: () => import('../admin/intake/pages/IntakeUploadPage.vue'),
    meta: {
      ...base,
      title: 'Muat Naik Kertas - Admin PRESTASIPLUS',
      header: { title: 'Muat Naik Kertas', subtitle: 'Ekstrak soalan daripada PDF' },
    },
  },
  {
    path: '/admin/spm/soalan/manual',
    name: INTAKE_ROUTES.manual,
    component: () => import('../admin/intake/pages/IntakeManualPage.vue'),
    meta: {
      ...base,
      title: 'Tulis Soalan Manual - Admin PRESTASIPLUS',
      header: { title: 'Tulis Soalan Manual', subtitle: 'Taip soalan sendiri tanpa PDF' },
    },
  },
  {
    path: '/admin/spm/soalan/ekstrak/:batchId',
    name: INTAKE_ROUTES.review,
    component: () => import('../admin/intake/pages/IntakeReviewPage.vue'),
    props: true,
    meta: {
      ...base,
      title: 'Semak Ekstrak - Admin PRESTASIPLUS',
      header: { title: 'Semak Ekstrak' },
    },
  },
]

export default routes
