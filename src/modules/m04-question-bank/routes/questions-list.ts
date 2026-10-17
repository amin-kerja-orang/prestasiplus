import type { RouteRecordRaw } from 'vue-router'

import { QUESTION_ROUTES, QUESTIONS_LIST_PATH } from '../lib/question-list'

/**
 * M04 route fragment: S1 question list, S3 question detail (M04-T3) (build-plan §S.3 rule 2). Admin
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
  {
    path: QUESTIONS_LIST_PATH,
    name: QUESTION_ROUTES.list,
    component: () => import('../pages/QuestionListPage.vue'),
    meta: { ...adminMeta, title: 'Pengurusan Soalan', header: { title: 'Pengurusan Soalan' } },
  },
  {
    path: `${QUESTIONS_LIST_PATH}/:id(\\d+)`,
    name: QUESTION_ROUTES.detail,
    component: () => import('../pages/QuestionDetailPage.vue'),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: { ...adminMeta, title: 'Lihat Soalan', header: { title: 'Detail Soalan' } },
  },
]

export default routes
