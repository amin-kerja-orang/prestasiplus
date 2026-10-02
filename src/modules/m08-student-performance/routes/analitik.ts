import type { RouteRecordRaw } from 'vue-router'

/**
 * M08 route fragment "analitik" (M08-T2; build-plan §S.3 rule 2): S7 `/analitik/pelajar` and S6
 * `/prestasi/{userId}` (Prestasi 360). Both are user-shell routes open to every logged-in role; the pupil
 * a viewer may open on S6 is decided by the API (§9: unknown id → 404, not permitted → 403).
 *
 * The S6 path is constrained to digits: without it `/prestasi/tingkatan` and `/prestasi/kelas` (M08-T5 /
 * M08-T7) would also match `:userId`. The tab title of S6 is set from the loaded name
 * ("Prestasi 360 — {nama} — PRESTASIPLUS").
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/analitik/pelajar',
    name: 'm08.analitik.pelajar',
    component: () => import('../pages/AnalitikPelajarPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Analitik Pembelajaran',
      header: {
        title: 'Analitik Pembelajaran',
        subtitle: 'Pantau prestasi dan kenal pasti topik yang perlu diperkukuhkan',
      },
      module: 'M08',
    },
  },
  {
    path: '/prestasi/:userId(\\d+)',
    name: 'm08.prestasi.360',
    component: () => import('../pages/Prestasi360Page.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      header: { title: 'Prestasi 360', subtitle: 'Selamat datang kembali' },
      module: 'M08',
    },
  },
]

export default routes
