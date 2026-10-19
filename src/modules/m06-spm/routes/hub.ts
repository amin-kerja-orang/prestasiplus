import type { RouteRecordRaw } from 'vue-router'

/**
 * M06 route fragment "hub" (M06-T2; SRS M06 v1.4 §2): S1 hub, S2 databank + Q1, S3/S4 latih tubi + Q2,
 * S10 history. Every route needs a session (FR-M06-12). Titles: S1–S3 and S10 keep the live title with
 * the live subtitle "Selamat datang kembali"; S4 sets "Latih Tubi SPM — {Subjek}" from its data (DV-M06-07).
 * Q1/Q2 titles were never captured (UNVERIFIED): they show their list's title without a subtitle.
 */
const SUBTITLE = 'Selamat datang kembali'

const routes: RouteRecordRaw[] = [
  {
    path: '/spm',
    name: 'm06.spm',
    component: () => import('../pages/SpmHubPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Mod SPM - PRESTASIPLUS',
      header: { title: 'Mod SPM', subtitle: SUBTITLE },
      module: 'M06',
      v2: true,
    },
  },
  {
    path: '/spm/tahun-lepas',
    name: 'm06.spm.databank',
    component: () => import('../pages/DatabankPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Databank Soalan SPM - PRESTASIPLUS',
      header: { title: 'Databank Soalan SPM', subtitle: SUBTITLE },
      module: 'M06',
      v2: true,
    },
  },
  {
    path: '/spm/tahun-lepas/:code/quiz',
    name: 'm06.spm.databank.quiz',
    component: () => import('../pages/DatabankQuizPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Databank Soalan SPM - PRESTASIPLUS',
      header: { title: 'Databank Soalan SPM' },
      module: 'M06',
      v2: true,
    },
  },
  {
    path: '/spm/latih-tubi',
    name: 'm06.spm.latih-tubi',
    component: () => import('../pages/LatihTubiListPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Latih Tubi SPM - PRESTASIPLUS',
      header: { title: 'Latih Tubi SPM', subtitle: SUBTITLE },
      module: 'M06',
      v2: true,
    },
  },
  {
    path: '/spm/latih-tubi/:code',
    name: 'm06.spm.latih-tubi.config',
    component: () => import('../pages/LatihTubiConfigPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Latih Tubi SPM - PRESTASIPLUS',
      header: { title: 'Latih Tubi SPM' },
      module: 'M06',
      v2: true,
    },
  },
  {
    path: '/spm/latih-tubi/:code/quiz',
    name: 'm06.spm.latih-tubi.quiz',
    component: () => import('../pages/LatihTubiQuizPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Latih Tubi SPM - PRESTASIPLUS',
      header: { title: 'Latih Tubi SPM' },
      module: 'M06',
      v2: true,
    },
  },
  {
    path: '/spm/history',
    name: 'm06.spm.history',
    component: () => import('../pages/HistoryPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Sejarah Kuiz SPM - PRESTASIPLUS',
      header: { title: 'Sejarah Kuiz SPM', subtitle: SUBTITLE },
      module: 'M06',
      v2: true,
    },
  },
]

export default routes
