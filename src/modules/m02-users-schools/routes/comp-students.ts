import type { RouteRecordRaw } from 'vue-router'

import { COMP_CREATE_PATH, COMP_LIST_PATH, COMP_ROUTES } from '../lib/comp-students'

/**
 * M02 route fragment: S6 complimentary list, S7 register, S8 detail (M02-T7; FR-M02-65…75). Admin only,
 * admin shell. Tab titles and headers are exact (SRS §2); S8 replaces both with the student's name once
 * the data is loaded.
 */
const adminMeta = { layout: 'admin', access: 'auth', roles: ['admin'], module: 'M02' } as const

const routes: RouteRecordRaw[] = [
  {
    path: COMP_LIST_PATH,
    name: COMP_ROUTES.list,
    component: () => import('../pages/CompStudentListPage.vue'),
    meta: {
      ...adminMeta,
      title: 'Pelajar Komplimen - Admin Panel',
      header: {
        title: 'Pelajar Komplimen',
        subtitle: 'Pelajar bantuan QA — pakej penuh percuma, syiling dimatikan',
      },
    },
  },
  {
    path: COMP_CREATE_PATH,
    name: COMP_ROUTES.create,
    component: () => import('../pages/CompStudentCreatePage.vue'),
    meta: {
      ...adminMeta,
      title: 'Daftar Pelajar Komplimen - Admin Panel',
      header: {
        title: 'Daftar Pelajar Komplimen',
        subtitle: 'Pelajar bantuan QA — akaun percuma, pakej penuh, syiling dimatikan',
      },
    },
  },
  {
    path: `${COMP_LIST_PATH}/:id(\\d+)`,
    name: COMP_ROUTES.detail,
    component: () => import('../pages/CompStudentDetailPage.vue'),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: {
      ...adminMeta,
      title: 'Pelajar Komplimen - Admin Panel',
      header: { title: 'Pelajar Komplimen', subtitle: 'Detail pelajar komplimen' },
    },
  },
]

export default routes
