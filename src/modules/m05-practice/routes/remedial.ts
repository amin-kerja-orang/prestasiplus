import type { RouteRecordRaw } from 'vue-router'

/**
 * M05 route fragment: S13 Remedial, S14 Misi Harian, S15 Target SPM, Q4–Q6 (M05-T7; SRS M05 v1.19
 * §2). Every route needs a session (FR-M05-130). `/remedial/saya` ranks above `/remedial/:id`.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/remedial/saya',
    name: 'm05.remedial',
    component: () => import('../pages/RemedialListPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Ujian Remedial Saya',
      // DV-M05-01 / DV-SH-03: no subtitle.
      header: { title: 'Ujian Remedial Saya' },
      module: 'M05',
      v2: true,
    },
  },
  {
    path: '/remedial/:id',
    name: 'm05.remedial.quiz',
    component: () => import('../pages/RemedialQuizPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Ujian Remedial Saya',
      header: { title: 'Ujian Remedial Saya' },
      module: 'M05',
      v2: true,
    },
  },
  {
    path: '/misi-harian',
    name: 'm05.missions',
    component: () => import('../pages/MissionListPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Misi Harian — PrestasiPlus',
      header: { title: 'Misi Harian', subtitle: 'Selesaikan misi, kumpul syiling!' },
      module: 'M05',
    },
  },
  {
    path: '/misi-harian/:id',
    name: 'm05.missions.quiz',
    component: () => import('../pages/MissionQuizPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Misi Harian — PrestasiPlus',
      header: { title: 'Misi Harian', subtitle: 'Selesaikan misi, kumpul syiling!' },
      module: 'M05',
    },
  },
  {
    path: '/set-soalan-saya/:id/jawab',
    name: 'm05.questionset.quiz',
    component: () => import('../pages/QuestionSetQuizPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Set Soalan Guru — PrestasiPlus',
      header: { title: 'Set Soalan Guru' },
      module: 'M05',
      v2: true,
    },
  },
  {
    path: '/target-spm',
    name: 'm05.targets',
    component: () => import('../pages/SpmTargetsPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Target SPM Saya — PrestasiPlus',
      header: {
        title: 'Target SPM Saya',
        subtitle: 'Tetapkan target gred SPM dan pantau kemajuan anda',
      },
      module: 'M05',
    },
  },
]

export default routes
