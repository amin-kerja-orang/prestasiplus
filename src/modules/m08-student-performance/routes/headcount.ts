import type { RouteRecordRaw, RouteMeta } from 'vue-router'

/**
 * M08 route fragment "headcount" (M08-T6; build-plan §S.3 rule 2): S12 `/headcount`, S13, S14, S15, S22,
 * S23, the L-12 page shells (FR-M08-137) and the CSV download `/headcount/{id}/export` (FR-M08-132).
 * Every route is for the admin, the teacher and the school admin only; any other role, pelajar included,
 * gets the standalone 403 page in place (SRS §9, OD-R3, FR-M08-08). The API decides the rest (own configs,
 * own school). Titles are exact (SRS §2); S15 and S23 replace theirs once the name / subject is known.
 */
const HOME = 'Selamat datang kembali'

const base = (title: string, header: string): RouteMeta => ({
  layout: 'user',
  access: 'auth',
  roles: ['admin', 'teacher', 'school_admin'],
  onForbidden: '403',
  title,
  header: { title: header, subtitle: HOME },
  module: 'M08',
  v2: true,
})

/** L-12 shells: the shell header names the action (INFERRED from the S23 button label). */
const shell = (header: string): RouteMeta => base(`${header} - PRESTASIPLUS`, header)

const routes: RouteRecordRaw[] = [
  {
    path: '/headcount',
    name: 'm08.headcount',
    component: () => import('../pages/HeadcountListPage.vue'),
    meta: base('Headcount - PRESTASIPLUS', 'Headcount'),
  },
  {
    path: '/headcount/dashboard',
    name: 'm08.headcount.dashboard',
    component: () => import('../pages/HeadcountDashboardPage.vue'),
    meta: base('Dashboard Headcount - PRESTASIPLUS', 'Dashboard Headcount'),
  },
  {
    path: '/headcount/create',
    name: 'm08.headcount.create',
    component: () => import('../pages/HeadcountCreatePage.vue'),
    meta: base('Buat Headcount Baru - PRESTASIPLUS', 'Buat Headcount Baru'),
  },
  {
    path: '/headcount/student/:id([0-9]+)',
    name: 'm08.headcount.student',
    component: () => import('../pages/HeadcountStudentPage.vue'),
    meta: base('Headcount - PRESTASIPLUS', 'Headcount — Prestasi Individu'),
  },
  {
    path: '/headcount/:id([0-9]+)',
    name: 'm08.headcount.detail',
    component: () => import('../pages/HeadcountTablePage.vue'),
    meta: base('Headcount - PRESTASIPLUS', 'Headcount'),
  },
  {
    path: '/headcount/:id([0-9]+)/summary',
    name: 'm08.headcount.summary',
    component: () => import('../pages/HeadcountSummaryPage.vue'),
    meta: base('Ringkasan Kelas - PRESTASIPLUS', 'Ringkasan Kelas'),
  },
  {
    path: '/headcount/:id([0-9]+)/export',
    name: 'm08.headcount.export',
    component: () => import('../pages/HeadcountExportPage.vue'),
    meta: base('Headcount - PRESTASIPLUS', 'Headcount'),
  },
  {
    path: '/headcount/:id([0-9]+)/results/:n([0-9]+)',
    name: 'm08.headcount.results',
    component: () => import('../pages/HeadcountShellPage.vue'),
    meta: shell('Key-in AR'),
  },
  {
    path: '/headcount/:id([0-9]+)/edit',
    name: 'm08.headcount.edit',
    component: () => import('../pages/HeadcountShellPage.vue'),
    meta: shell('Edit TOV/ETR'),
  },
  {
    path: '/headcount/:id([0-9]+)/unjuran',
    name: 'm08.headcount.unjuran',
    component: () => import('../pages/HeadcountShellPage.vue'),
    meta: shell('Unjuran'),
  },
  {
    path: '/headcount/:id([0-9]+)/settings',
    name: 'm08.headcount.settings',
    component: () => import('../pages/HeadcountShellPage.vue'),
    meta: shell('Tetapan'),
  },
]

export default routes
