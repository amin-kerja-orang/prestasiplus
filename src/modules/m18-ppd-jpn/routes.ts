import type { RouteRecordRaw } from 'vue-router'

/**
 * M18 routes. Built so far (design `docs/design/m18-amaran-summary.md`): S23 `/amaran/ringkasan-eksekutif` and
 * S21 `/amaran/keberkesanan`, both reached from the two buttons of M27 S4 `/amaran/sekolah`. User shell, role
 * `school_admin` only (like the M27 `/amaran` route), in-place 403 for other roles, `/login` for a guest.
 * The shell header title is static; the school name sub-line is set by each page.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/amaran/ringkasan-eksekutif',
    name: 'm18.amaran-ringkasan',
    component: () => import('./pages/RingkasanEksekutifPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'Ringkasan Eksekutif | PRESTASIPLUS',
      header: { title: 'Ringkasan Eksekutif' },
      module: 'M18',
      v2: true,
    },
  },
  {
    path: '/amaran/keberkesanan',
    name: 'm18.amaran-keberkesanan',
    component: () => import('./pages/KeberkesananPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'Keberkesanan Intervensi | PRESTASIPLUS',
      header: { title: 'Keberkesanan Intervensi' },
      module: 'M18',
      v2: true,
    },
  },
]

export default routes
