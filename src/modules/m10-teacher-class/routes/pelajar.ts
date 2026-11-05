import type { RouteRecordRaw } from 'vue-router'

import { GURU_API_ROLES } from './roles'

/**
 * M10 route fragment: S6 Pelajar Saya (`/guru/pelajar`, `/guru/pelajar/cipta`), M10-T5.
 * `/guru/pelajar/cipta` no longer redirects silently (R1-GUR-41, D-T10-1): it renders the same page with the
 * "Cipta Pelajar" card open. Roles: teacher and admin in mock mode, teacher only in http mode (DV-M10-37, `./roles`).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/guru/pelajar',
    name: 'guru-pelajar',
    component: () => import('../pages/PelajarSayaPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: GURU_API_ROLES,
      title: 'Pelajar Saya - PRESTASIPLUS',
      header: { title: 'Pelajar', subtitle: 'Urus pelajar dalam kelas anda' },
      module: 'M10',
      v2: true,
    },
  },
  {
    path: '/guru/pelajar/cipta',
    name: 'guru-pelajar-cipta',
    component: () => import('../pages/PelajarSayaPage.vue'),
    props: { create: true },
    meta: {
      layout: 'user',
      access: 'auth',
      roles: GURU_API_ROLES,
      title: 'Cipta Pelajar - PRESTASIPLUS',
      header: { title: 'Pelajar', subtitle: 'Urus pelajar dalam kelas anda' },
      module: 'M10',
      v2: true,
    },
  },
]

export default routes
