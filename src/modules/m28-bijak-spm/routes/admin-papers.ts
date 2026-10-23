import type { RouteRecordRaw } from 'vue-router'

import { ADMIN_ROUTES } from '../admin/papers/ui'

/**
 * Bijak SPM admin routes (v2-question-bank): review queue, question bank and paper builder in the
 * Portal Pentadbiran. Admin Pusat only (`/admin/*`); the prototype scope already lets admin reach
 * every `/admin/**` path. Mounted next to the student routes in `routes.ts`.
 */
const base = {
  layout: 'admin',
  access: 'auth',
  roles: ['admin'],
  // A typed URL of another role gets the in-place 403 (AC-22.4 / R26), not a redirect.
  onForbidden: '403',
  module: 'M06',
  v2: true,
} as const

const routes: RouteRecordRaw[] = [
  {
    path: '/admin/spm/semakan',
    name: ADMIN_ROUTES.review,
    component: () => import('../admin/papers/ReviewQueuePage.vue'),
    meta: {
      ...base,
      title: 'Baris Gilir Semakan - Admin PRESTASIPLUS',
      header: { title: 'Baris Gilir Semakan', subtitle: 'Soalan SPM yang menunggu keputusan' },
    },
  },
  {
    path: '/admin/spm/semakan/:key',
    name: ADMIN_ROUTES.reviewItem,
    component: () => import('../admin/papers/ReviewItemPage.vue'),
    meta: {
      ...base,
      title: 'Semak Soalan - Admin PRESTASIPLUS',
      header: { title: 'Semak Soalan' },
    },
  },
  {
    path: '/admin/spm/soalan',
    name: ADMIN_ROUTES.bank,
    component: () => import('../admin/papers/BankPage.vue'),
    meta: {
      ...base,
      title: 'Bank Soalan SPM - Admin PRESTASIPLUS',
      header: { title: 'Bank Soalan SPM', subtitle: 'Soalan SPM yang diterbitkan' },
    },
  },
  {
    path: '/admin/spm/soalan/:qid/sunting',
    name: ADMIN_ROUTES.bankEdit,
    component: () => import('../admin/papers/BankEditPage.vue'),
    props: true,
    meta: {
      ...base,
      title: 'Sunting Soalan - Admin PRESTASIPLUS',
      header: { title: 'Sunting Soalan' },
    },
  },
  {
    path: '/admin/spm/kertas',
    name: ADMIN_ROUTES.papers,
    component: () => import('../admin/papers/PaperListPage.vue'),
    meta: {
      ...base,
      title: 'Pembina Kertas - Admin PRESTASIPLUS',
      header: { title: 'Pembina Kertas', subtitle: 'Bina dan terbitkan kertas SPM' },
    },
  },
  {
    path: '/admin/spm/kertas/baharu',
    name: ADMIN_ROUTES.paperNew,
    component: () => import('../admin/papers/PaperNewPage.vue'),
    meta: {
      ...base,
      title: 'Kertas Baharu - Admin PRESTASIPLUS',
      header: { title: 'Kertas Baharu' },
    },
  },
  {
    path: '/admin/spm/kertas/:id',
    name: ADMIN_ROUTES.paperEdit,
    component: () => import('../admin/papers/PaperEditorPage.vue'),
    meta: {
      ...base,
      title: 'Pembina Kertas - Admin PRESTASIPLUS',
      header: { title: 'Pembina Kertas' },
    },
  },
]

export default routes
