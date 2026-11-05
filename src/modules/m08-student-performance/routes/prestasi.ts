import type { RouteRecordRaw } from 'vue-router'

import { useSessionStore } from '@/stores/session'
import type { Role } from '@/stores/session-types'

/**
 * M08 route fragment "prestasi" (M08-T5; build-plan §S.3 rule 2): `/prestasi` (S10-T01: the pupil's own
 * Prestasi 360 at the same URL, every other role goes to `/prestasi/sekolah`), S1 `/prestasi/sekolah`, S2, S3, S4 and S21. All user-shell routes; S1–S3 show the own-school
 * view to non-admins (FR-M08-13), see the roles below. Tab titles are exact (SRS §2); S1 keeps the DV-M08-01 header.
 * `/prestasi/{userId}` (S6) belongs to M08-T2.
 *
 * Roles (SW4-04, DV-M08-46): a typed URL of a role with no place on these screens shows the 403 page
 * in place instead of a teacher screen. S1–S3 follow SRS §9 (admin, guru, admin sekolah, and ibu bapa
 * "as pelajar without data"); the pelajar has no school-wide view (FR-MUR-4-2, S10-T01); PPD / JPN officers and sponsors have M18 screens, not these. S4 lists
 * the viewer's own classes, so only the roles that reach a class dashboard (S5, `class.ts`) open it:
 * the API answers an empty list for everyone else.
 */
/** S1–S3 (`/prestasi/sekolah`, `/prestasi/tingkatan[/{code}]`): the API scopes the figures per role. */
export const PRESTASI_SCHOOL_ROLES: readonly Role[] = [
  'admin',
  'teacher',
  'school_admin',
  'parent',
]
/** S4 (`/prestasi/kelas`): the roles that can open a class dashboard (S5); the pelajar gets the 403 page (FR-MUR-4-2). */
export const PRESTASI_CLASS_ROLES: readonly Role[] = ['admin', 'teacher', 'school_admin']

const routes: RouteRecordRaw[] = [
  {
    // FR-MUR-4-13: a pupil's URL stays `/prestasi` (own Prestasi 360); no other role has an own view.
    path: '/prestasi',
    name: 'm08.prestasi.own',
    component: () => import('../pages/Prestasi360Page.vue'),
    beforeEnter: () => (useSessionStore().role === 'student' ? true : '/prestasi/sekolah'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Prestasi Saya',
      header: { title: 'Prestasi Saya', subtitle: 'Analisis pencapaian latihan anda' },
      module: 'M08',
      v2: true,
    },
  },
  {
    path: '/prestasi/sekolah',
    name: 'm08.prestasi.sekolah',
    component: () => import('../pages/PrestasiSekolahPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: PRESTASI_SCHOOL_ROLES,
      onForbidden: '403',
      title: 'Dashboard Sekolah — Prestasi',
      header: { title: 'Dashboard Sekolah', subtitle: 'Selamat datang kembali' },
      module: 'M08',
      v2: true,
    },
  },
  {
    path: '/prestasi/tingkatan',
    name: 'm08.prestasi.tingkatan',
    component: () => import('../pages/TingkatanPilihPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: PRESTASI_SCHOOL_ROLES,
      onForbidden: '403',
      title: 'Pilih Tingkatan — Prestasi | PRESTASIPLUS',
      header: {
        title: 'Dashboard Tingkatan',
        subtitle: 'Pilih tingkatan untuk lihat prestasi keseluruhan',
      },
      module: 'M08',
      v2: true,
    },
  },
  {
    path: '/prestasi/tingkatan/:code',
    name: 'm08.prestasi.tingkatan.detail',
    component: () => import('../pages/TingkatanPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: PRESTASI_SCHOOL_ROLES,
      onForbidden: '403',
      title: (route) =>
        `Tingkatan ${route.params.code === 't4' ? '4' : '5'} — Dashboard Tingkatan | PRESTASIPLUS`,
      module: 'M08',
      v2: true,
    },
  },
  {
    path: '/prestasi/kelas',
    name: 'm08.prestasi.kelas',
    component: () => import('../pages/PrestasiKelasPilihPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: PRESTASI_CLASS_ROLES,
      onForbidden: '403',
      title: 'Pilih Kelas — Prestasi',
      header: { title: 'Prestasi Kelas', subtitle: 'Pilih kelas untuk lihat prestasi keseluruhan' },
      module: 'M08',
      v2: true,
    },
  },
  {
    // S21: 403 for every logged-in role (observed for the admin; others BLOCKED, OQ-M08-01).
    path: '/laporan-mingguan',
    name: 'm08.laporan-mingguan',
    component: () => import('../pages/LaporanMingguanPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: [],
      onForbidden: '403',
      module: 'M08',
      v2: true,
    },
  },
]

export default routes
