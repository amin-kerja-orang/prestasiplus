import type { RouteRecordRaw } from 'vue-router'

/**
 * M06 route fragment "mock-exam" (M06-T4): S11 `/spm-mock`, Q4 `/spm-mock/:id` (provisional, L-8),
 * S12 `/spm-mock/:id/result` and S13 `/pusat-ai/spm`. `layout: 'role'` (DV-07): the admin sees them
 * in the admin shell, every other role in the user shell. Headers follow DV-M06-07 (the page title,
 * no subtitle); S12's header and tab title carry the subject and are set by the page.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/spm-mock',
    name: 'm06.mock',
    component: () => import('../pages/MockExamPage.vue'),
    meta: {
      layout: 'role',
      access: 'auth',
      title: 'Peperiksaan Percubaan SPM',
      header: { title: 'Peperiksaan Percubaan SPM' },
      module: 'M06',
      v2: true,
    },
  },
  {
    path: '/spm-mock/:id(\\d+)',
    name: 'm06.mock-run',
    component: () => import('../pages/MockRunPage.vue'),
    meta: {
      layout: 'role',
      access: 'auth',
      title: 'Peperiksaan Percubaan SPM',
      header: { title: 'Peperiksaan Percubaan SPM' },
      module: 'M06',
      v2: true,
    },
  },
  {
    path: '/spm-mock/:id(\\d+)/result',
    name: 'm06.mock-result',
    component: () => import('../pages/MockResultPage.vue'),
    meta: {
      layout: 'role',
      access: 'auth',
      title: 'Keputusan Percubaan SPM',
      header: { title: 'Keputusan Percubaan SPM' },
      module: 'M06',
      v2: true,
    },
  },
  {
    path: '/pusat-ai/spm',
    name: 'm06.walkthrough',
    component: () => import('../pages/WalkthroughPage.vue'),
    meta: {
      layout: 'role',
      access: 'auth',
      title: 'Panduan Langkah SPM — Cikgu Alesa',
      header: { title: 'Panduan Langkah SPM — Cikgu Alesa' },
      module: 'M06',
      v2: true,
    },
  },
]

export default routes
