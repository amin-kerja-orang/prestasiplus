import type { RouteRecordRaw } from 'vue-router'

import { SUBSCRIPTION_ROUTES } from '../lib/subscription-options'

/**
 * M02 route fragment: S12 subscription list, S13 new, S14 detail, S15 renewal invoice (standalone,
 * `bare`) and S16 assign SPM packages (M02-T9; FR-M02-47..50, 82..97). Admin only. Tab titles are exact
 * (SRS §2); S14, S15 and S16 replace them (and S14/S16 the header subtitle) once the data is loaded.
 */
const adminMeta = {
  layout: 'admin',
  access: 'auth',
  roles: ['admin'],
  module: 'M02',
  v2: true,
} as const

const routes: RouteRecordRaw[] = [
  {
    path: '/admin/school-subscriptions',
    name: SUBSCRIPTION_ROUTES.list,
    component: () => import('../pages/SubscriptionListPage.vue'),
    meta: {
      ...adminMeta,
      title: 'Langganan Sekolah - Admin PRESTASIPLUS',
      header: {
        title: 'Langganan Sekolah',
        subtitle: 'Urus langganan pakej SPM untuk semua sekolah',
      },
    },
  },
  {
    path: '/admin/school-subscriptions/create',
    name: SUBSCRIPTION_ROUTES.create,
    component: () => import('../pages/SubscriptionCreatePage.vue'),
    meta: {
      ...adminMeta,
      title: 'Langganan Baru - Admin PRESTASIPLUS',
      header: {
        title: 'Langganan Sekolah Baru',
        subtitle: 'Daftarkan langganan pakej SPM untuk sekolah',
      },
    },
  },
  {
    path: '/admin/school-subscriptions/:id(\\d+)',
    name: SUBSCRIPTION_ROUTES.detail,
    component: () => import('../pages/SubscriptionDetailPage.vue'),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: {
      ...adminMeta,
      title: 'Langganan - Admin PRESTASIPLUS',
      header: { title: 'Butiran Langganan' },
    },
  },
  {
    path: '/admin/school-subscriptions/:id(\\d+)/renewal-invoice',
    name: SUBSCRIPTION_ROUTES.invoice,
    component: () => import('../pages/RenewalInvoicePage.vue'),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: {
      layout: 'bare',
      access: 'auth',
      roles: ['admin'],
      module: 'M02',
      title: 'Invois Pembaharuan',
    },
  },
  {
    path: '/admin/users/:id(\\d+)/packages',
    name: SUBSCRIPTION_ROUTES.userPackages,
    component: () => import('../pages/UserPackagesPage.vue'),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: {
      ...adminMeta,
      title: 'Tetapkan Pakej SPM - Admin PRESTASIPLUS',
      header: { title: 'Tetapkan Pakej SPM' },
    },
  },
]

export default routes
