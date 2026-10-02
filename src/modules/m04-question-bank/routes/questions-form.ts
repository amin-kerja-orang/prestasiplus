import type { RouteRecordRaw } from 'vue-router'

/**
 * M04 route fragment: S2 create question, S4 edit question (M04-T4) (build-plan §S.3 rule 2). Admin
 * only, admin shell. Tab titles are exact (SRS §2); the shell header has no subtitle (DV-M04-02).
 * `/admin/questions/create` is a static path, so it never meets the `:id(\d+)` detail route.
 */
const adminMeta = { layout: 'admin', access: 'auth', roles: ['admin'], module: 'M04' } as const

const routes: RouteRecordRaw[] = [
  {
    path: '/admin/questions/create',
    name: 'm04.questions.create',
    component: () => import('../pages/QuestionCreatePage.vue'),
    meta: { ...adminMeta, title: 'Tambah Soalan Baru', header: { title: 'Tambah Soalan Baru' } },
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
