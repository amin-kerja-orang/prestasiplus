import type { RouteRecordRaw } from 'vue-router'

/**
 * M22 routes (SRS M22 v1.1 §2): S1 `/pusat-tuisyen/tiket` (user shell, every signed-in role) and S2
 * `/admin/tiket` (admin shell, platform admin only; any other signed-in role follows the `/admin/*` router
 * rule, FR-M22-36; the queue is read-only, D27). `/tiket`, `/tiket/baru`, `/pusat-tuisyen/tiket/baru` and any
 * ticket detail route are deliberately not defined: they fall to the global 404 page (DL-M22-04).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/pusat-tuisyen/tiket',
    name: 'm22.tickets',
    component: () => import('../pages/TicketsPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Tiket Bantuan - PRESTASIPLUS',
      header: { title: 'Tiket Bantuan', subtitle: 'Senarai aduan dan permintaan anda' },
      module: 'M22',
    },
  },
  {
    path: '/admin/tiket',
    name: 'm22.admin-tickets',
    component: () => import('../pages/AdminTicketsPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: 'Tiket Sokongan - PRESTASIPLUS',
      module: 'M22',
    },
  },
]

export default routes
