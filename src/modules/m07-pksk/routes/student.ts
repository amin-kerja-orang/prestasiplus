import type { RouteRecordRaw } from 'vue-router'

import { TAB_TITLE } from '../lib/levels'

/**
 * M07 route fragment "student" (M07-T2; SRS M07 §2): S1 hub, S2 dashboard, S3 domains, S4 history,
 * S4a domain practice and S4b full exam (provisional). `:level` is limited to `T1` / `T4` (case
 * sensitive) so any other value falls to the catch-all 404 page (BR-M07-19, FR-M07-18). The level
 * gate (no access -> `/pksk`) is applied by the page from the API's 403 (FR-M07-19). A domain code
 * outside the 15 is a 404 from the API. All tab titles are the generic live title (DV-M07-06).
 */
const LEVEL = ':level(T1|T4)'

const base = { layout: 'user', access: 'auth', title: TAB_TITLE, module: 'M07' } as const
const pksk = {
  title: 'PKSK',
  subtitle: 'Persediaan Kemasukan SBP / MRSM / SMKA',
} as const

const routes: RouteRecordRaw[] = [
  {
    path: '/pksk',
    name: 'm07.pksk',
    component: () => import('../pages/PkskHubPage.vue'),
    meta: { ...base, header: pksk },
  },
  {
    path: `/pksk/level/${LEVEL}`,
    name: 'm07.pksk.level',
    component: () => import('../pages/PkskDashboardPage.vue'),
    props: true,
    meta: { ...base },
  },
  {
    path: `/pksk/level/${LEVEL}/domains`,
    name: 'm07.pksk.domains',
    component: () => import('../pages/PkskDomainsPage.vue'),
    props: true,
    meta: { ...base },
  },
  {
    path: `/pksk/level/${LEVEL}/history`,
    name: 'm07.pksk.history',
    component: () => import('../pages/PkskHistoryPage.vue'),
    props: true,
    meta: { ...base },
  },
  {
    path: `/pksk/level/${LEVEL}/domain/:code`,
    name: 'm07.pksk.practice',
    component: () => import('../pages/PkskPracticePage.vue'),
    props: true,
    meta: { ...base, header: pksk },
  },
  {
    path: `/pksk/level/${LEVEL}/exam`,
    name: 'm07.pksk.exam',
    component: () => import('../pages/PkskExamPage.vue'),
    props: true,
    meta: { ...base, header: pksk },
  },
]

export default routes
