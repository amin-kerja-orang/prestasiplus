import type { RouteRecordRaw } from 'vue-router'

/**
 * M04 route fragment: the old S2 create path (a redirect to Studio) and S4 edit question (M04-T4) (build-plan
 * §S.3 rule 2). Admin only, admin shell. Tab titles are exact (SRS §2); the shell header has no subtitle (DV-M04-02).
 * `/admin/questions/create` is a static path, so it never meets the `:id(\d+)` detail route.
 */
const adminMeta = {
  layout: 'admin',
  v2: true,
  access: 'auth',
  roles: ['admin'],
  module: 'M04',
} as const

const routes: RouteRecordRaw[] = [
  // FR-ADM-Q04.7: the one wizard is Studio. `/:id/edit` stays until the S2-T10 essay form exists (decision 3 on #428).
  {
    path: '/admin/questions/create',
    name: 'm04.questions.create',
    redirect: () => ({ path: '/admin/studio/questions/create', query: { dari: 'borang-lama' } }),
  },
  {
    path: '/admin/questions/:id(\\d+)/edit',
    name: 'm04.questions.edit',
    component: () => import('../pages/QuestionEditPage.vue'),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: { ...adminMeta, title: 'Edit Soalan', header: { title: 'Edit Soalan' } },
  },
]

export default routes
