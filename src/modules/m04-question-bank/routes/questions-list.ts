import type { RouteRecordRaw } from 'vue-router'

import { QUESTION_ROUTES, QUESTIONS_LIST_PATH, REGROUP_PATH, REGROUP_TAB } from '../lib/question-list'

/**
 * M04 route fragment: S1 question list (now a redirect to Studio), S3 question detail (M04-T3, redirect) (build-plan §S.3 rule 2). Admin
 * only, admin shell. Tab titles are exact (SRS §2); the shell header has no subtitle (DV-M04-02).
 * `:id(\d+)` keeps `create`, `import` and `quality` (other tasks' routes) out of the detail route.
 */
const adminMeta = {
  layout: 'admin',
  v2: true,
  access: 'auth',
  roles: ['admin'],
  module: 'M04',
} as const

const routes: RouteRecordRaw[] = [
  // Bank Lama list retired (PO: one bank, DSKP format; Studio covers its filters). `?tab=regroup` keeps its own page; a subject
  // or search filter carries over to Studio.
  {
    path: QUESTIONS_LIST_PATH,
    name: QUESTION_ROUTES.list,
    redirect: (to) => {
      if (to.query.tab === REGROUP_TAB) return { path: REGROUP_PATH, query: { ...to.query, tab: undefined } }
      const query: Record<string, string> = {}
      for (const key of ['subject_id', 'search'] as const) {
        const v = to.query[key]
        if (typeof v === 'string' && v !== '') query[key] = v
      }
      return { path: '/admin/studio', query }
    },
  },
  {
    path: `${QUESTIONS_LIST_PATH}/:id(\\d+)`,
    name: QUESTION_ROUTES.detail,
    // Bank Lama retired 2026-11-09 (PO: one bank, DSKP format): the old detail page is the Studio editor now.
    redirect: (to) => ({ path: `/admin/studio/questions/${String(to.params.id)}/sunting` }),
  },
  // The work-list of V2 questions that need regrouping (R1-ADM-QE-08), reachable from the Soalan menu (BS-11).
  {
    path: REGROUP_PATH,
    name: 'm04.questions.regroup',
    component: () => import('../pages/RegroupPage.vue'),
    meta: { ...adminMeta, title: 'Perlu Dikumpulkan Semula', header: { title: 'Perlu Dikumpulkan Semula' } },
  },
]

export default routes
