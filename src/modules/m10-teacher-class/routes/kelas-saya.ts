import type { RouteRecordRaw } from 'vue-router'

/**
 * M10 route fragment: S33 Kelas Saya, student (`/kelas-saya`), M10-T7. User shell; Pelajar and Admin
 * only (SRS §2 route table, SEC-M10-02): any other role is sent to its landing path, a guest to
 * `/login`. Tab title "Kelas Saya", header "Kelas Saya" / "Kelas yang anda sertai, guru dan rakan sekelas anda" (V2 pelajar/kelas-saya.blade.php:4).
 */
export const KELAS_SAYA_ROUTE = 'm10.kelas-saya'

const routes: RouteRecordRaw[] = [
  {
    path: '/kelas-saya',
    name: KELAS_SAYA_ROUTE,
    component: () => import('../pages/KelasSayaPelajarPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['student', 'admin'],
      title: 'Kelas Saya',
      header: { title: 'Kelas Saya', subtitle: 'Kelas yang anda sertai, guru dan rakan sekelas anda' },
      module: 'M10',
      v2: true,
    },
  },
]

export default routes
