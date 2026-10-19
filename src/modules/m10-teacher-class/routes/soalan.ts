import type { RouteRecordRaw } from 'vue-router'

/**
 * M10 route fragment: S21–S24 Sumbang Soalan (`/guru/soalan…`), M10-T6. User shell; Guru and Admin.
 * Tab titles and header texts: URS §1 / FN-M10-1.1.3 (DV-M10-01: S23 / S24 keep "Selamat datang
 * kembali"). Not own / unknown ids are the standard 404 (BR-M10-01), raised by the page.
 */
export const SOALAN_ROUTES = {
  list: 'm10.soalan',
  create: 'm10.soalan.cipta',
  detail: 'm10.soalan.detail',
  edit: 'm10.soalan.edit',
} as const

const base = {
  layout: 'user' as const,
  access: 'auth' as const,
  roles: ['teacher', 'admin'] as const,
  module: 'M10' as const,
  v2: true as const,
}

const routes: RouteRecordRaw[] = [
  {
    path: '/guru/soalan',
    name: SOALAN_ROUTES.list,
    component: () => import('../pages/SumbangSoalanPage.vue'),
    meta: {
      ...base,
      title: 'Sumbang Soalan - PRESTASIPLUS',
      header: {
        title: 'Sumbang Soalan',
        subtitle: 'Sumbangan anda kepada bank soalan kebangsaan PrestasiPlus',
      },
    },
  },
  {
    path: '/guru/soalan/cipta',
    name: SOALAN_ROUTES.create,
    component: () => import('../pages/SumbangSoalanCiptaPage.vue'),
    meta: {
      ...base,
      title: 'Tambah Soalan - PRESTASIPLUS',
      header: { title: 'Tambah Soalan Baru', subtitle: 'Sumbangkan soalan untuk pelajar Malaysia' },
    },
  },
  {
    path: '/guru/soalan/:id([0-9]+)',
    name: SOALAN_ROUTES.detail,
    component: () => import('../pages/SumbangSoalanDetailPage.vue'),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: {
      ...base,
      title: 'Detail Soalan — Sumbang Soalan',
      header: { title: 'Detail Soalan', subtitle: 'Selamat datang kembali' },
    },
  },
  {
    path: '/guru/soalan/:id([0-9]+)/edit',
    name: SOALAN_ROUTES.edit,
    component: () => import('../pages/SumbangSoalanEditPage.vue'),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: {
      ...base,
      title: 'Edit Soalan — Sumbang Soalan',
      header: { title: 'Edit Soalan', subtitle: 'Selamat datang kembali' },
    },
  },
]

export default routes
