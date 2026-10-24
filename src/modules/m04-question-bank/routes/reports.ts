import type { RouteRecordRaw } from 'vue-router'

import { REPORT_ROUTES } from '../lib/report-routes'

/**
 * M04 route fragment: S7 admin report triage (M04-T6c; build-plan §S.3 rule 2). Admin only, admin shell.
 * The shell header is the readable title with no subtitle (FR-M04-107, DV-M04-02); the page itself
 * carries the live h1 and subtitle.
 *
 * Also the S14 modal harness `/__e2e/report-modal` (SRS SQ-2), only in builds with the test hooks.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin/question-reports',
    name: REPORT_ROUTES.admin,
    component: () => import('../pages/QuestionReportsPage.vue'),
    meta: {
      layout: 'admin',
      v2: true,
      access: 'auth',
      roles: ['admin'],
      title: 'Laporan Soalan — Panel Admin',
      header: { title: 'Laporan Soalan' },
      module: 'M04',
    },
  },
]

if (import.meta.env.VITE_TEST_HOOKS === 'true') {
  routes.push({
    path: '/__e2e/report-modal',
    name: REPORT_ROUTES.harness,
    component: () => import('../pages/ReportModalHarnessPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Harness S14',
      header: { title: 'Harness S14' },
      module: 'M04',
    },
  })
}

export default routes
