import type { RouteRecordRaw } from 'vue-router'

import { CURRICULUM_PATH, CURRICULUM_ROUTES } from '../lib/curriculum-paths'

/**
 * M03 route fragment: S1 curriculum browser and S2-S5 chapter / topic forms (M03-T3; SRS §2). Admin only.
 * Tab titles and headers are exact (§2). The id params are not restricted to digits: an unknown id
 * (even "zzz") redirects to S1 with the BR-18 flash.
 */
const adminMeta = { layout: 'admin', access: 'auth', roles: ['admin'], module: 'M03' } as const

const routes: RouteRecordRaw[] = [
  {
    path: CURRICULUM_PATH,
    name: CURRICULUM_ROUTES.tree,
    component: () => import('../pages/CurriculumBrowserPage.vue'),
    meta: {
      ...adminMeta,
      title: 'Pengurusan Kurikulum - Admin PRESTASIPLUS',
      header: {
        title: 'Pengurusan Kurikulum',
        subtitle: 'Urus struktur kurikulum (Bab → Topik → Subtopik)',
      },
    },
  },
  {
    path: `${CURRICULUM_PATH}/chapters/create`,
    name: CURRICULUM_ROUTES.chapterCreate,
    component: () => import('../pages/ChapterCreatePage.vue'),
    meta: {
      ...adminMeta,
      title: 'Tambah Bab - Admin PRESTASIPLUS',
      header: { title: 'Tambah Bab Baru', subtitle: 'Cipta bab baharu dalam kurikulum' },
    },
  },
  {
    path: `${CURRICULUM_PATH}/chapters/:id/edit`,
    name: CURRICULUM_ROUTES.chapterEdit,
    component: () => import('../pages/ChapterEditPage.vue'),
    props: (route) => ({ id: String(route.params.id) }),
    meta: {
      ...adminMeta,
      title: 'Edit Bab - Admin PRESTASIPLUS',
      header: { title: 'Edit Bab', subtitle: 'Kemaskini maklumat bab' },
    },
  },
  {
    path: `${CURRICULUM_PATH}/topics/create`,
    name: CURRICULUM_ROUTES.topicCreate,
    component: () => import('../pages/TopicCreatePage.vue'),
    meta: {
      ...adminMeta,
      title: 'Tambah Topik - Admin PRESTASIPLUS',
      header: { title: 'Tambah Topik Baru', subtitle: 'Cipta topik baharu dalam bab' },
    },
  },
  {
    path: `${CURRICULUM_PATH}/topics/:id/edit`,
    name: CURRICULUM_ROUTES.topicEdit,
    component: () => import('../pages/TopicEditPage.vue'),
    props: (route) => ({ id: String(route.params.id) }),
    meta: {
      ...adminMeta,
      title: 'Edit Topik - Admin PRESTASIPLUS',
      header: { title: 'Edit Topik', subtitle: 'Kemaskini maklumat topik' },
    },
  },
]

export default routes
