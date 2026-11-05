import type { RouteRecordRaw, RouteMeta } from 'vue-router'

import type { Role } from '@/stores/session-types'

/**
 * M08 route fragment "headcount" (M08-T6; build-plan §S.3 rule 2): S12 `/headcount`, S13, S14, S15, S22,
 * S23, the four action pages (Key-in AR, Edit TOV/ETR, Unjuran, Tetapan; S10-T02) and the CSV download `/headcount/{id}/export` (FR-M08-132).
 * Every route is for the admin, the teacher and the school admin; the pelajar (S10-T09) opens only `/headcount`
 * and `/headcount/student/{ownId}`; the write pages (Key-in AR, Edit TOV/ETR, Tetapan) are the admin and the
 * teacher only (the school admin is read-only, Unjuran stays readable). Any other role gets the standalone 403
 * page in place (SRS §9, OD-R3, FR-M08-08). The API decides the rest (own configs,
 * own school). Titles are exact (SRS §2); S15 and S23 replace theirs once the name / subject is known.
 */
const HOME = 'Selamat datang kembali'

const base = (
  title: string,
  header: string,
  roles: Role[] = ['admin', 'teacher', 'school_admin'],
): RouteMeta => ({
  layout: 'user',
  access: 'auth',
  roles,
  onForbidden: '403',
  title,
  header: { title: header, subtitle: HOME },
  module: 'M08',
  v2: true,
})

/** The four action pages (S10-T02): the header names the action. */
const action = (header: string, roles?: Role[]): RouteMeta =>
  base(`${header} - PRESTASIPLUS`, header, roles)

/** The write pages (R1-AS-3: the school admin is read-only, 403 by URL). */
const WRITERS: Role[] = ['admin', 'teacher']
/** The two pupil read screens. */
const WITH_PUPIL: Role[] = ['admin', 'teacher', 'school_admin', 'student']

const routes: RouteRecordRaw[] = [
  {
    path: '/headcount',
    name: 'm08.headcount',
    // S10-T09: the pupil gets the read view, every other role the list (same route name).
    component: () => import('../pages/HeadcountIndexPage.vue'),
    meta: base('Headcount - PRESTASIPLUS', 'Headcount', WITH_PUPIL),
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
    meta: base('Buat Headcount Baru - PRESTASIPLUS', 'Buat Headcount Baru', WRITERS),
  },
  {
    path: '/headcount/student/:id([0-9]+)',
    name: 'm08.headcount.student',
    component: () => import('../pages/HeadcountStudentPage.vue'),
    meta: base('Headcount - PRESTASIPLUS', 'Headcount — Prestasi Individu', WITH_PUPIL),
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
    component: () => import('../pages/HeadcountResultsPage.vue'),
    meta: action('Key-in AR', WRITERS),
  },
  {
    path: '/headcount/:id([0-9]+)/edit',
    name: 'm08.headcount.edit',
    component: () => import('../pages/HeadcountEditPage.vue'),
    meta: action('Edit TOV/ETR', WRITERS),
  },
  {
    path: '/headcount/:id([0-9]+)/unjuran',
    name: 'm08.headcount.unjuran',
    component: () => import('../pages/HeadcountUnjuranPage.vue'),
    meta: action('Unjuran'),
  },
  {
    path: '/headcount/:id([0-9]+)/settings',
    name: 'm08.headcount.settings',
    component: () => import('../pages/HeadcountSettingsPage.vue'),
    meta: action('Tetapan', WRITERS),
  },
]

export default routes
