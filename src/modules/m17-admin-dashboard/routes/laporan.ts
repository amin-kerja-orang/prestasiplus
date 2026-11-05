import type { RouteRecordRaw } from 'vue-router'

import { whenCentralReports } from '@/app/features'
import type { Role } from '@/stores/session-types'

/**
 * M17 route fragment: S11 `/admin/laporan` (M17-T5; empty until its UI task) and the Admin Pusat central views of
 * the school reports (S6-T13, R1-ADM-M-07, Decided D-T13-1): one page component `AdminCentralReportPage.vue`
 * with a `view` prop and one route record per Portal Pentadbiran item, `/admin/laporan-sekolah/{view}`.
 *
 * Hidden (routes not registered -> the global 404) unless `VITE_CENTRAL_REPORTS=on` (`src/app/features.ts`).
 * `sekolah-bersaing` redirects to the existing national board `/sekolah-bersaing`.
 * PM-24 Headcount has no record yet: it waits for the Headcount list of S10-T09.
 */

/** The central views and their menu label (PM-12, 13, 15, 21, 22, 23, 27, 28). */
export const CENTRAL_REPORT_VIEWS = {
  'laporan-aktiviti': 'Laporan Aktiviti',
  'amaran-wellbeing': 'Amaran Wellbeing',
  'statistik-penggunaan': 'Statistik Penggunaan',
  'dskp-heatmap': 'DSKP Heatmap',
  'amaran-awal': 'Amaran Awal',
  'laporan-bulanan': 'Laporan Bulanan',
  'analisa-item': 'Analisa Item',
  'sekolah-bersaing': 'Sekolah Bersaing',
} as const

export type CentralReportView = keyof typeof CENTRAL_REPORT_VIEWS

const roles: readonly Role[] = ['admin']

const meta = (view: CentralReportView) => ({
  layout: 'admin' as const,
  v2: true,
  access: 'auth' as const,
  roles,
  title: CENTRAL_REPORT_VIEWS[view],
  header: { title: CENTRAL_REPORT_VIEWS[view] },
  module: 'M17' as const,
})

const centralReportRoutes: RouteRecordRaw[] = [
  {
    path: '/admin/laporan-sekolah/laporan-aktiviti',
    name: 'm17.laporan-sekolah.laporan-aktiviti',
    component: () => import('../pages/AdminCentralReportPage.vue'),
    props: { view: 'laporan-aktiviti' },
    meta: meta('laporan-aktiviti'),
  },
  {
    path: '/admin/laporan-sekolah/amaran-wellbeing',
    name: 'm17.laporan-sekolah.amaran-wellbeing',
    component: () => import('../pages/AdminCentralReportPage.vue'),
    props: { view: 'amaran-wellbeing' },
    meta: meta('amaran-wellbeing'),
  },
  {
    path: '/admin/laporan-sekolah/statistik-penggunaan',
    name: 'm17.laporan-sekolah.statistik-penggunaan',
    component: () => import('../pages/AdminCentralReportPage.vue'),
    props: { view: 'statistik-penggunaan' },
    meta: meta('statistik-penggunaan'),
  },
  {
    path: '/admin/laporan-sekolah/dskp-heatmap',
    name: 'm17.laporan-sekolah.dskp-heatmap',
    component: () => import('../pages/AdminCentralReportPage.vue'),
    props: { view: 'dskp-heatmap' },
    meta: meta('dskp-heatmap'),
  },
  {
    path: '/admin/laporan-sekolah/amaran-awal',
    name: 'm17.laporan-sekolah.amaran-awal',
    component: () => import('../pages/AdminCentralReportPage.vue'),
    props: { view: 'amaran-awal' },
    meta: meta('amaran-awal'),
  },
  {
    path: '/admin/laporan-sekolah/laporan-bulanan',
    name: 'm17.laporan-sekolah.laporan-bulanan',
    component: () => import('../pages/AdminCentralReportPage.vue'),
    props: { view: 'laporan-bulanan' },
    meta: meta('laporan-bulanan'),
  },
  {
    path: '/admin/laporan-sekolah/analisa-item',
    name: 'm17.laporan-sekolah.analisa-item',
    component: () => import('../pages/AdminCentralReportPage.vue'),
    props: { view: 'analisa-item' },
    meta: meta('analisa-item'),
  },
  // PM-28: the board is national, so there is no picker; the existing page is the view (D-T13-1)
  {
    path: '/admin/laporan-sekolah/sekolah-bersaing',
    name: 'm17.laporan-sekolah.sekolah-bersaing',
    redirect: '/sekolah-bersaing',
    meta: meta('sekolah-bersaing'),
  },
]

const routes: RouteRecordRaw[] = whenCentralReports(centralReportRoutes)

export default routes
