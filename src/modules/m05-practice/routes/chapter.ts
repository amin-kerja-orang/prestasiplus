import type { RouteRecordRaw } from 'vue-router'

/**
 * M05 route fragment: S4 / S5 / Q2 Soalan by Chapter and S6 / S7 revision (M05-T5; SRS M05 v1.19 §2;
 * roles-matrix L14, Murid and Guru: any session may open them, FR-M05-130). Static siblings of
 * `/practice/:code` (`/practice/chapter`, `/practice/revision`) rank above it by the router. The pages
 * answer an unknown code with the global 404 page and set the dynamic tab titles / shell subtitle.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/practice/chapter',
    name: 'm05.chapter',
    component: () => import('../pages/ChapterIndexPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Soalan by Chapter - PRESTASIPLUS',
      header: {
        title: 'Soalan by Chapter',
        subtitle: 'Latihan tersusun ikut bab buku teks dan DSKP',
      },
      module: 'M05',
      v2: true,
    },
  },
  {
    path: '/practice/chapter/:code',
    name: 'm05.chapter.subject',
    component: () => import('../pages/ChapterSubjectPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      // "Chapter {subject} - PRESTASIPLUS" and the subtitle "{subject}" are set once the subject is known.
      title: 'Soalan by Chapter - PRESTASIPLUS',
      header: { title: 'Soalan by Chapter' },
      module: 'M05',
      v2: true,
    },
  },
  {
    path: '/practice/chapter/:code/:chapterId(\\d+)/quiz',
    name: 'm05.chapter.quiz',
    component: () => import('../pages/ChapterQuizPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      // INFERRED (FR-M05-52 table: Q2 "Soalan by Chapter" / "{subject}"; UNVERIFIED tab title).
      title: 'Soalan by Chapter - PRESTASIPLUS',
      header: { title: 'Soalan by Chapter' },
      module: 'M05',
      v2: true,
    },
  },
  {
    path: '/practice/revision',
    name: 'm05.revision',
    component: () => import('../pages/RevisionListPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Soalan Aku Salah — PRESTASIPLUS',
      // DV-M05-01 / DV-SH-03: no subtitle (live shows the Dashboard header here).
      header: { title: 'Soalan Aku Salah' },
      module: 'M05',
      v2: true,
    },
  },
  {
    path: '/practice/revision/:code',
    name: 'm05.revision.quiz',
    component: () => import('../pages/RevisionQuizPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      // "Ulang Kaji — {subject}" is set once the subject is known.
      title: 'Soalan Aku Salah — PRESTASIPLUS',
      header: { title: 'Soalan Aku Salah' },
      module: 'M05',
      v2: true,
    },
  },
]

export default routes
