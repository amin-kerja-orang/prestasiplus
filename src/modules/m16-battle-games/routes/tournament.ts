import type { RouteRecordRaw } from 'vue-router'

/**
 * M16 route fragment: S23 `/tournament` and the provisional detail `/tournament/:uuid` (M16-T6c; SRS M16
 * v1.6 §2, FR-M16-03..05, 105, 106, 114). User shell, any logged-in role; a guest goes to `/login` by
 * the shared guard. S23 tab title and header are the live ones (FN-M16-1.1.3 / 1.1.4); the detail takes
 * its header and tab title from the loaded tournament (`usePageMeta`). `/tournament/admin/create` (S24)
 * is the T6 remainder and is not declared here: until it exists it falls to the global 404 page.
 * An unknown uuid renders the 404 page in place (the page raises the outcome after #45 answers 404).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/tournament',
    name: 'm16.tournament',
    component: () => import('../pages/TournamentListPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Liga & Kejohanan',
      header: { title: 'Liga & Kejohanan', subtitle: 'Senarai kejohanan antara sekolah' },
      module: 'M16',
      v2: true,
    },
  },
  {
    path: '/tournament/:uuid',
    name: 'm16.tournament-detail',
    component: () => import('../pages/TournamentDetailPage.vue'),
    props: true,
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Kejohanan',
      header: { title: 'Kejohanan', subtitle: 'Selamat datang kembali' },
      module: 'M16',
      v2: true,
    },
  },
]

export default routes
