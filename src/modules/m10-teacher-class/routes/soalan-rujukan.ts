import type { RouteRecordRaw } from 'vue-router'

/**
 * M10 route fragment: Soalan & Rujukan (`/guru/soalan-guru…`), S6-T16 (PRD-20 R1-GUR-44a). The teacher's private MCQ
 * with a reference link; the tool opens from the "Alat Soalan" tile of Sumbang Soalan. User shell; Guru and Admin.
 * The tab title of the form is the PRD text; the list and edit titles follow it. A foreign or unknown id is the
 * standard 404 (FR-GUR-44a-1), raised by the edit page.
 */
export const SOALAN_RUJUKAN_ROUTES = {
  list: 'm10.soalan-rujukan',
  create: 'm10.soalan-rujukan.cipta',
  edit: 'm10.soalan-rujukan.sunting',
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
    path: '/guru/soalan-guru',
    name: SOALAN_RUJUKAN_ROUTES.list,
    component: () => import('../pages/SoalanRujukanListPage.vue'),
    meta: {
      ...base,
      title: 'Soalan & Rujukan — PRESTASIPLUS',
      header: { title: 'Soalan & Rujukan', subtitle: 'Soalan peribadi + rujukan' },
    },
  },
  {
    path: '/guru/soalan-guru/cipta',
    name: SOALAN_RUJUKAN_ROUTES.create,
    component: () => import('../pages/SoalanRujukanCreatePage.vue'),
    meta: {
      ...base,
      title: 'Cipta Soalan & Rujukan — PRESTASIPLUS',
      header: { title: 'Cipta Soalan & Rujukan' },
    },
  },
  {
    path: '/guru/soalan-guru/:id(\\d+)/sunting',
    name: SOALAN_RUJUKAN_ROUTES.edit,
    component: () => import('../pages/SoalanRujukanEditPage.vue'),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: {
      ...base,
      title: 'Edit Soalan & Rujukan — PRESTASIPLUS',
      header: { title: 'Edit Soalan & Rujukan' },
    },
  },
]

export default routes
