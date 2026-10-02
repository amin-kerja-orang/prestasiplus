import type { RouteRecordRaw } from 'vue-router'

/**
 * M05 route fragment: S10 Soalan Berstruktur (+ the SPM variants `?scope=spm[&track=bahasa]`, which
 * set their own shell header from the page) and Q3 the structured answer page (M05-T7; SRS M05 v1.19
 * §2). Every route needs a session (FR-M05-130).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/latihan-berstruktur',
    name: 'm05.structured',
    component: () => import('../pages/StructuredListPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Soalan Berstruktur - PRESTASIPLUS',
      // DV-M05-01 / DV-SH-03: no subtitle.
      header: { title: 'Soalan Berstruktur' },
      module: 'M05',
    },
  },
  {
    path: '/latihan-berstruktur/:id/jawab',
    name: 'm05.structured.answer',
    component: () => import('../pages/StructuredAnswerPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      // UNVERIFIED (Q3 never opened on live): the S10 title.
      title: 'Soalan Berstruktur - PRESTASIPLUS',
      header: { title: 'Soalan Berstruktur' },
      module: 'M05',
    },
  },
]

export default routes
