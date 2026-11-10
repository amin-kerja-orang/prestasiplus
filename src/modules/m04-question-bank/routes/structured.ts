import type { RouteRecordRaw } from 'vue-router'

import { AUDIT_ROUTES } from '../lib/audit-routes'

/**
 * M04 route fragment: S8 structured list, S9 structured detail (M04-T7; FR-M04-83..90). Admin shell,
 * admin only. Tab titles are exact (SRS §2). The shell header is the route title with no subtitle
 * (FR-M04-107, DV-M04-02).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin/structured-questions',
    // Bank Lama retired (PO: one bank, DSKP format): the Subjektif lane is the admin list of structured questions.
    redirect: { path: '/admin/spm/subjektif' },
  },
  {
    path: '/admin/structured-questions/:id(\\d+)',
    name: AUDIT_ROUTES.structuredDetail,
    // Bank Lama retired 2026-11-09: the Subjektif editor (Skema & Rubrik) is the admin view of a structured question.
    redirect: (to) => ({ path: `/admin/spm/subjektif/${String(to.params.id)}/sunting` }),
  },
  // V2 Panel Subjektif Sunting (Skema & Rubrik) and the read-only Pratonton of a bank soalan (Admin Pusat only).
  {
    path: '/admin/spm/subjektif/:id(\\d+)/sunting',
    name: 'm04.structured.rubric',
    component: () => import('../pages/StructuredRubricPage.vue'),
    props: (route) => ({ id: String(route.params.id) }),
    meta: {
      layout: 'admin',
      v2: true,
      access: 'auth',
      roles: ['admin'],
      title: 'Sunting Subjektif',
      header: { title: 'Sunting Subjektif' },
      module: 'M04',
    },
  },
  {
    path: '/admin/spm/soalan/:id(\\d+)/pratonton',
    name: 'm04.question.preview',
    component: () => import('../pages/QuestionPreviewPage.vue'),
    props: (route) => ({ id: String(route.params.id) }),
    meta: {
      layout: 'admin',
      v2: true,
      access: 'auth',
      roles: ['admin'],
      title: 'Pratonton Soalan',
      header: { title: 'Pratonton Soalan' },
      module: 'M04',
    },
  },
]

export default routes
