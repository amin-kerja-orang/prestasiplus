import type { RouteRecordRaw } from 'vue-router'

import { GURU_CLASS_ROLES } from './roles'

/**
 * M10 route fragment: S4 Kelas Saya (`/guru/kelas`) and S5 Cipta Kelas (`/guru/kelas/cipta`), M10-T5.
 * User shell, teacher only in both modes (DV-M10-48: the real API is teacher-only), see `./roles`. Any
 * other role goes to its landing page. The header and tab titles are the live ones (URS FN-M10-1.1.3).
 * `/guru/kelas/:id` and `/:id/edit` match no route here, so the catch-all renders S35 (404).
 */
const roles = GURU_CLASS_ROLES

const routes: RouteRecordRaw[] = [
  {
    path: '/guru/kelas',
    name: 'guru-kelas',
    component: () => import('../pages/KelasListPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles,
      title: 'Kelas Saya - Portal Guru',
      header: { title: 'Portal Guru', subtitle: 'Urus kelas dan tugasan anda 🏫' },
      module: 'M10',
      v2: true,
    },
  },
  {
    path: '/guru/kelas/cipta',
    name: 'guru-kelas-cipta',
    component: () => import('../pages/KelasCreatePage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles,
      title: 'Cipta Kelas - Portal Guru',
      header: { title: 'Cipta Kelas Baru', subtitle: 'Isi butiran kelas anda' },
      module: 'M10',
      v2: true,
    },
  },
]

export default routes
