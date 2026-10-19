import type { RouteRecordRaw } from 'vue-router'

/**
 * M10 route fragment: S6 Pelajar Saya (`/guru/pelajar`, with the `/guru/pelajar/cipta` redirect), M10-T5.
 * `/guru/pelajar/cipta` goes back to `/guru/pelajar` with no message (DV-M10-07, replicated).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/guru/pelajar',
    name: 'guru-pelajar',
    component: () => import('../pages/PelajarSayaPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['teacher', 'admin'],
      title: 'Pelajar Saya - PRESTASIPLUS',
      header: { title: 'Pelajar', subtitle: 'Urus pelajar dalam kelas anda' },
      module: 'M10',
      v2: true,
    },
  },
  { path: '/guru/pelajar/cipta', redirect: '/guru/pelajar' },
]

export default routes
