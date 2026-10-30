import type { RouteRecordRaw } from 'vue-router'

import adminIntake from './routes/admin-intake'
import adminKontrak from './routes/admin-kontrak'
import adminPapers from './routes/admin-papers'

/**
 * Bijak SPM routes (v2 student flow). They sit under `/spm`, so the Murid menu row 13 "SPM" of the
 * role-access matrix (D43) already covers them. Students only (and Admin Pusat in Mod Pelajar);
 * other roles get the in-place 403 (AC-01.4). `layout: 'user'` is the existing student frame; the
 * pages render inside the learner layout once it replaces it.
 */
const base = {
  layout: 'user',
  access: 'auth',
  roles: ['student', 'admin'],
  onForbidden: '403',
  module: 'M06',
  v2: true,
} as const

const routes: RouteRecordRaw[] = [
  ...adminPapers,
  ...adminKontrak,
  {
    path: '/spm/bijak',
    name: 'm28.bijak',
    component: () => import('./pages/BijakHubPage.vue'),
    meta: {
      ...base,
      title: 'Bijak SPM - PRESTASIPLUS',
      header: { title: 'Bijak SPM', subtitle: 'Kertas SPM penuh, bermasa, dengan skema' },
    },
  },
  {
    path: '/spm/bijak/sejarah',
    name: 'm28.bijak.history',
    component: () => import('./pages/HistoryPage.vue'),
    meta: {
      ...base,
      title: 'Sejarah Bijak SPM - PRESTASIPLUS',
      header: { title: 'Sejarah Bijak SPM' },
    },
  },
  {
    path: '/spm/bijak/kertas/:paperId',
    name: 'm28.bijak.cover',
    component: () => import('./pages/PaperCoverPage.vue'),
    meta: {
      ...base,
      title: 'Bijak SPM - PRESTASIPLUS',
      header: { title: 'Bijak SPM' },
      ownsH1: true,
    },
  },
  {
    path: '/spm/bijak/percubaan/:attemptId',
    name: 'm28.bijak.attempt',
    component: () => import('./pages/AttemptPage.vue'),
    meta: { ...base, title: 'Bijak SPM - PRESTASIPLUS', header: { title: 'Bijak SPM' } },
  },
  {
    path: '/spm/bijak/percubaan/:attemptId/keputusan',
    name: 'm28.bijak.result',
    component: () => import('./pages/ResultPage.vue'),
    meta: {
      ...base,
      title: 'Semakan Bijak SPM - PRESTASIPLUS',
      header: { title: 'Semakan Bijak SPM' },
    },
  },
  ...adminIntake,
]

export default routes
