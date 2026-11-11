import type { RouteRecordRaw } from 'vue-router'

import adminBuilder from './routes/admin-builder'
import adminIntake from './routes/admin-intake'
import adminKandungan from './routes/admin-kandungan'
import adminKertasSubjektif from './routes/admin-kertas-subjektif'
import adminKontrak from './routes/admin-kontrak'
import adminPapers from './routes/admin-papers'

/**
 * Bijak SPM routes (v2 student flow). They sit under `/spm`, so the Murid menu row 13 "SPM" of the
 * role-access matrix (D43) already covers them. Students only; a plain Admin Pusat who opens one
 * directly is taken into Mod Pelajar first (`modPelajarForAdmin`, router guard step 2c) and then lands
 * on the requested route. Other roles (and an admin whose switch fails) get the in-place 403 (AC-01.4).
 * `layout: 'user'` is the existing student frame; the pages render inside the learner layout once it
 * replaces it.
 */
const base = {
  layout: 'user',
  access: 'auth',
  roles: ['student'],
  modPelajarForAdmin: true,
  onForbidden: '403',
  module: 'M06',
  v2: true,
} as const

const routes: RouteRecordRaw[] = [
  ...adminPapers,
  ...adminBuilder,
  ...adminKontrak,
  ...adminKandungan,
  ...adminKertasSubjektif,
  {
    path: '/spm/bijak',
    name: 'm28.bijak',
    component: () => import('./pages/BijakHubPage.vue'),
    meta: {
      ...base,
      title: 'Bijak SPM - PRESTASIPLUS',
      header: { title: 'Simulasi Peperiksaan', subtitle: 'Duduki kertas SPM dalam format kertas sebenar — jawab, tanda automatik setiap halaman' },
    },
  },
  {
    path: '/spm/bijak/sejarah',
    name: 'm28.bijak.history',
    component: () => import('./pages/HistoryPage.vue'),
    meta: {
      ...base,
      title: 'Sejarah Bijak SPM - PRESTASIPLUS',
      header: { title: 'Sejarah Bijak SPM' },
    },
  },
  {
    path: '/spm/bijak/kertas/:paperId',
    name: 'm28.bijak.cover',
    component: () => import('./pages/PaperCoverPage.vue'),
    meta: {
      ...base,
      title: 'Bijak SPM - PRESTASIPLUS',
      header: { title: 'Bijak SPM' },
      ownsH1: true,
    },
  },
  {
    path: '/spm/bijak/percubaan/:attemptId',
    name: 'm28.bijak.attempt',
    component: () => import('./pages/AttemptPage.vue'),
    meta: { ...base, title: 'Bijak SPM - PRESTASIPLUS', header: { title: 'Bijak SPM' } },
  },
  {
    path: '/spm/bijak/percubaan/:attemptId/keputusan',
    name: 'm28.bijak.result',
    component: () => import('./pages/ResultPage.vue'),
    meta: {
      ...base,
      title: 'Semakan Bijak SPM - PRESTASIPLUS',
      header: { title: 'Semakan Bijak SPM' },
    },
  },
  // Simulasi - Kuiz (R1-F12). Outside /spm/bijak because V2 serves it at /simulasi.
  {
    path: '/simulasi/kuiz',
    name: 'm28.kuiz',
    component: () => import('./pages/KuizPage.vue'),
    meta: {
      ...base,
      title: 'Simulasi — Kuiz - PRESTASIPLUS',
      header: { title: 'Simulasi — Kuiz' },
    },
  },
  {
    path: '/simulasi/:paperId/kuiz',
    name: 'm28.kuiz.paper',
    component: () => import('./pages/PaperQuizPage.vue'),
    meta: {
      ...base,
      title: 'Kuiz Kertas - PRESTASIPLUS',
      header: { title: 'Simulasi — Kuiz' },
    },
  },
  // Kertas Subjektif (S3-T06, 46 section 4.7): list, sitting, Semakan. The list and the sitting share one page.
  {
    path: '/kertas-subjektif',
    name: 'm28.kertas-subjektif',
    component: () => import('./pages/SubjektifAttemptPage.vue'),
    meta: {
      ...base,
      title: 'Kertas Subjektif - PRESTASIPLUS',
      header: { title: 'Kertas Subjektif' },
    },
  },
  // The V2 page-image documents of the same Kertas Subjektif list (migration 0265): the viewer.
  {
    path: '/kertas-subjektif/dokumen/:id',
    name: 'm28.kertas-subjektif.dokumen',
    component: () => import('./pages/SubjektifDokumenPage.vue'),
    meta: { ...base, title: 'Kertas Subjektif - PRESTASIPLUS', header: { title: 'Kertas Subjektif' } },
  },
  {
    path: '/kertas-subjektif/:paperId',
    name: 'm28.kertas-subjektif.paper',
    component: () => import('./pages/SubjektifAttemptPage.vue'),
    meta: { ...base, title: 'Kertas Subjektif - PRESTASIPLUS', header: { title: 'Kertas Subjektif' } },
  },
  {
    path: '/kertas-subjektif/:paperId/semakan/:attemptId',
    name: 'm28.kertas-subjektif.semakan',
    component: () => import('./pages/SubjektifSemakanPage.vue'),
    meta: {
      ...base,
      title: 'Semakan Kertas Subjektif - PRESTASIPLUS',
      header: { title: 'Semakan Kertas Subjektif' },
    },
  },
  ...adminIntake,
]

export default routes
