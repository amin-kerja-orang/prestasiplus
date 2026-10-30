import type { RouteRecordRaw } from 'vue-router'

import { whenAlesaAi } from '@/app/features'

import { mockIdPattern } from '../lib/wire-id'

/**
 * M06 route fragment "mock-exam" (M06-T4): S11 `/spm-mock`, Q4 `/spm-mock/:id` (provisional, L-8),
 * S12 `/spm-mock/:id/result` and S13 `/pusat-ai/spm`. `layout: 'role'` (DV-07): the admin sees them
 * in the admin shell, every other role in the user shell. Headers follow DV-M06-07 (the page title,
 * no subtitle); S12's header and tab title carry the subject and are set by the page.
 */
// The mock exam id: digits in the mock, a uuid on the real API (BE-41 open question 4).
const ID = `:id(${mockIdPattern()})`

const routes: RouteRecordRaw[] = [
  {
    path: '/spm-mock',
    name: 'm06.mock',
    component: () => import('../pages/MockExamPage.vue'),
    meta: {
      layout: 'role',
      access: 'auth',
      title: 'SPM Mock Exam',
      header: { title: 'SPM Mock Exam' },
      module: 'M06',
      v2: true,
    },
  },
  {
    path: `/spm-mock/${ID}`,
    name: 'm06.mock-run',
    component: () => import('../pages/MockRunPage.vue'),
    meta: {
      layout: 'role',
      access: 'auth',
      title: 'SPM Mock Exam',
      header: { title: 'SPM Mock Exam' },
      module: 'M06',
      v2: true,
    },
  },
  {
    path: `/spm-mock/${ID}/result`,
    name: 'm06.mock-result',
    component: () => import('../pages/MockResultPage.vue'),
    meta: {
      layout: 'role',
      access: 'auth',
      title: 'Result Mock SPM',
      header: { title: 'Result Mock SPM' },
      module: 'M06',
      v2: true,
    },
  },
]

// S13 is a Cikgu Alesa AI page: hidden behind VITE_ALESA_AI (D73).
const walkthroughRoutes: RouteRecordRaw[] = [
  {
    path: '/pusat-ai/spm',
    name: 'm06.walkthrough',
    component: () => import('../pages/WalkthroughPage.vue'),
    meta: {
      layout: 'role',
      access: 'auth',
      title: 'SPM Walkthrough — Cikgu Alesa',
      header: { title: 'SPM Walkthrough — Cikgu Alesa' },
      module: 'M06',
      v2: true,
    },
  },
]

export default [...routes, ...whenAlesaAi(walkthroughRoutes)]
