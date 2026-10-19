import type { RouteRecordRaw } from 'vue-router'

import { USER_FORM_ROUTES } from '../lib/user-form-options'

/**
 * M02 route fragment: S2 create user, S3 edit user (M02-T5; FR-M02-20…46). Admin only (`/admin/*`, admin
 * shell). Tab titles and shell headers are exact (SRS §2).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin/users/create',
    name: USER_FORM_ROUTES.create,
    component: () => import('../pages/UserCreatePage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: 'Tambah Pengguna - Admin Panel',
      header: {
        title: 'Tambah Pengguna Baru',
        subtitle: 'Daftarkan akaun pengguna baru ke sistem',
      },
      module: 'M02',
      v2: true,
    },
  },
  {
    path: '/admin/users/:id(\\d+)/edit',
    name: USER_FORM_ROUTES.edit,
    component: () => import('../pages/UserEditPage.vue'),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: 'Edit Pengguna - Admin Panel',
      header: { title: 'Edit Pengguna', subtitle: 'Kemaskini maklumat pengguna' },
      module: 'M02',
      v2: true,
    },
  },
]

export default routes
