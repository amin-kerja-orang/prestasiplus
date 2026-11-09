import type { RouteRecordRaw } from 'vue-router'

/**
 * M27 route fragment: "Tanda Karangan (semakan AI)", V2 Panel `/spm/tanda-karangan`. Two doors to one page:
 * `/admin-sekolah/tanda-karangan` (school admin, user shell, own school) and `/admin/spm/tanda-karangan`
 * (Admin Pusat, admin shell, every school; V2 has no menu entry for it there, the page opens by its URL).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin-sekolah/tanda-karangan',
    name: 'm27.tanda-karangan',
    component: () => import('../pages/TandaKaranganPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'Tanda Karangan - PRESTASIPLUS',
      header: { title: 'Tanda Karangan' },
      module: 'M27',
      v2: true,
    },
  },
  {
    path: '/admin/spm/tanda-karangan',
    name: 'm27.tanda-karangan.pusat',
    component: () => import('../pages/TandaKaranganPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      onForbidden: '403',
      title: 'Tanda Karangan - Admin Panel',
      header: { title: 'Tanda Karangan' },
      module: 'M27',
      v2: true,
    },
  },
]

export default routes
