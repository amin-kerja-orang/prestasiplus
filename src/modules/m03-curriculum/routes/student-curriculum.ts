import type { RouteRecordRaw } from 'vue-router'

import { STUDENT_ROUTES, TOPIC_TAB_TITLE } from '../lib/student-catalogue'

/**
 * M03 route fragment: S12 `/topics`, S13 `/topics/:id` and S14 `/peta-belajar` (M03-T4; SRS §2).
 * User shell, any authenticated role (FR-M03-94). S13's header and tab title come from the loaded
 * topic; a non-numeric id matches no route and falls to the global 404.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/topics',
    name: STUDENT_ROUTES.topics,
    component: () => import('../pages/TopicsPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: TOPIC_TAB_TITLE,
      header: { title: 'Topik Pembelajaran', subtitle: 'Terokai semua topik pembelajaran' },
      module: 'M03',
      v2: true,
    },
  },
  {
    path: '/topics/:id(\\d+)',
    name: STUDENT_ROUTES.topic,
    component: () => import('../pages/TopicDetailPage.vue'),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: {
      ownsH1: true,
      layout: 'user',
      access: 'auth',
      title: TOPIC_TAB_TITLE,
      module: 'M03',
      v2: true,
    },
  },
  {
    path: '/peta-belajar',
    name: STUDENT_ROUTES.map,
    component: () => import('../pages/LearningMapPage.vue'),
    meta: {
      ownsH1: true,
      layout: 'user',
      access: 'auth',
      title: 'Peta Belajar — PRESTASIPLUS',
      header: { title: 'Peta Belajar' },
      module: 'M03',
      v2: true,
    },
  },
]

export default routes
