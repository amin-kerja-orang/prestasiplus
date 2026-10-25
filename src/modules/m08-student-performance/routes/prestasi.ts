import type { RouteRecordRaw } from 'vue-router'

import type { Role } from '@/stores/session-types'
import { useSessionStore } from '@/stores/session'

/**
 * Roles that may open the school-level screens (S1–S3 `/prestasi/sekolah`, `/prestasi/tingkatan*` and S9
 * `/analisa-item/sekolah*`): every role except the pelajar, who gets the standalone 403 page in place
 * (UAT M-09). The pelajar's own view is S6 `/prestasi/{ownId}`.
 */
export const SCHOOL_VIEW_ROLES: readonly Role[] = [
  'admin',
  'teacher',
  'school_admin',
  'parent',
  'sponsor',
  'ppd_officer',
  'jpn_officer',
]

/**
 * `/prestasi` (the sidebar "Prestasi"; UAT M-09): a pelajar goes to the own Prestasi 360 (S6, self only,
 * SRS §9); every other role (and a guest, who is then sent to `/login`) to S1 `/prestasi/sekolah`.
 */
export function prestasiTarget(role: string | null, userId: number | null): string {
  if (role === 'student' && userId !== null) return `/prestasi/${String(userId)}`
  return '/prestasi/sekolah'
}

/**
 * M08 route fragment "prestasi" (M08-T5; build-plan §S.3 rule 2): S1 `/prestasi/sekolah` (`/prestasi`
 * replaces to it), S2, S3, S4 and S21. All user-shell routes; any logged-in role but the pelajar opens S1–S3 (the own-school
 * view for non-admins, FR-M08-13; the pelajar gets the 403 page, UAT M-09); S4 is the teacher's own classes. Tab titles are exact (SRS §2); S1 keeps the DV-M08-01 header.
 * `/prestasi/{userId}` (S6) belongs to M08-T2.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/prestasi',
    redirect: () => {
      const session = useSessionStore()
      return prestasiTarget(session.role, session.user?.id ?? null)
    },
  },
  {
    path: '/prestasi/sekolah',
    name: 'm08.prestasi.sekolah',
    component: () => import('../pages/PrestasiSekolahPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: SCHOOL_VIEW_ROLES,
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
      roles: SCHOOL_VIEW_ROLES,
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
      roles: SCHOOL_VIEW_ROLES,
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
