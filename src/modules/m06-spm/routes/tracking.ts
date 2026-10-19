import type { RouteRecordRaw } from 'vue-router'

/**
 * M06 route fragment "tracking" (M06-T3; SRS M06 v1.5 §2): S5 Tracking A hub, S6 set list / Q3 set quiz
 * (one path, `?year=2026&set=n` starts the quiz; BM/BI redirect to S7) and S8 Subjektif. S7 and S9 are
 * the M05 structured-list routes (`/latihan-berstruktur?scope=spm…`), only linked from here.
 * Titles: S5 and S8 keep the live title with the live subtitle (FR-M06-10); S6 sets
 * "Tracking A SPM — {Subjek}" from its data (DV-M06-07); Q3 was never captured (UNVERIFIED) and shows
 * the list title without a subtitle.
 */
const SUBTITLE = 'Selamat datang kembali'

const routes: RouteRecordRaw[] = [
  {
    path: '/spm/ramalan',
    name: 'm06.spm.ramalan',
    component: () => import('../pages/TrackingAHubPage.vue'),
    meta: {
      ownsH1: true,
      layout: 'user',
      access: 'auth',
      title: 'Tracking A SPM - PRESTASIPLUS',
      header: { title: 'Tracking A SPM', subtitle: SUBTITLE },
      module: 'M06',
      v2: true,
    },
  },
  {
    path: '/spm/ramalan/:code',
    name: 'm06.spm.ramalan.subject',
    component: () => import('../pages/TrackingACodePage.vue'),
    meta: {
      ownsH1: true,
      layout: 'user',
      access: 'auth',
      title: 'Tracking A SPM - PRESTASIPLUS',
      header: { title: 'Tracking A SPM' },
      module: 'M06',
      v2: true,
    },
  },
  {
    path: '/spm/subjektif',
    name: 'm06.spm.subjektif',
    component: () => import('../pages/SubjektifPage.vue'),
    meta: {
      ownsH1: true,
      layout: 'user',
      access: 'auth',
      title: 'Latihan Subjektif SPM - PRESTASIPLUS',
      header: { title: 'Subjektif SPM', subtitle: SUBTITLE },
      module: 'M06',
      v2: true,
    },
  },
]

export default routes
