import type { RouteRecordRaw } from 'vue-router'

/**
 * M05 route fragment: S2 Latih Tubi, S3 configuration, Q1 random quiz (M05-T4; SRS M05 v1.19 §2).
 * Every route needs a session (FR-M05-130: the default `access: 'auth'`). The `:code` pages answer an
 * unknown subject code with the global 404 page. Static siblings (`/practice/chapter`,
 * `/practice/revision`, `/practice/progress`, `/practice/history`) rank above `:code` by the router.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/practice',
    name: 'm05.practice',
    component: () => import('../pages/PracticeListPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Latih Tubi - PRESTASIPLUS',
      header: { title: 'Latih Tubi', subtitle: 'Pilih subjek dan mula berlatih' },
      module: 'M05',
      v2: true,
    },
  },
  {
    path: '/practice/:code',
    name: 'm05.practice.config',
    component: () => import('../pages/PracticeConfigPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      // The tab title is "{subject} - Latihan" once the subject is known (the page sets it).
      title: 'Latih Tubi - PRESTASIPLUS',
      // DV-M05-01 / DV-SH-03: no subtitle.
      header: { title: 'Latih Tubi' },
      module: 'M05',
      v2: true,
    },
  },
  {
    path: '/practice/:code/quiz',
    name: 'm05.practice.quiz',
    component: () => import('../pages/PracticeQuizPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Latih Tubi - PRESTASIPLUS',
      // INFERRED (FR-M05-52 table: Q1 "Latih Tubi", no subtitle).
      header: { title: 'Latih Tubi' },
      module: 'M05',
      v2: true,
    },
  },
]

export default routes
