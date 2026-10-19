import type { RouteRecordRaw } from 'vue-router'

/**
 * M27 route fragment: S8 `/admin-sekolah/kelas` "Kelas Sekolah" (SRS M27 Part B v1.8 §14.2; FR-M27-38, 40,
 * 44; PROPOSED screen, D26). User shell, role `school_admin` only, in-place 403 for other roles, `/login` for
 * a guest.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin-sekolah/kelas',
    name: 'm27.kelas-sekolah',
    component: () => import('../pages/KelasSekolahPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'Kelas Sekolah - PRESTASIPLUS',
      header: { title: 'Kelas Sekolah' },
      module: 'M27',
      v2: true,
    },
  },
]

export default routes
