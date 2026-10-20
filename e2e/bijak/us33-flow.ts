/**
 * Routes, selectors and contract shapes for the US-33 (b) Bijak results UI (be/us33-ui:
 * 8a55c244 m08 teacher views, fe4313c0 m27 school dashboard).
 *
 * "Bijak" is the http-mode data source plus a UI label; no new contract fields. The label and the
 * no-data state render ONLY when `isHttpMode()` (src/api/mode.ts: VITE_API_MODE === 'http'). In the
 * mock build the same screens show the plain practice figures, unlabelled.
 */
import type { Page } from '@playwright/test'

import { expect } from '../fixtures/test'
import { expectNoHorizontalScroll } from '../support'

/** Existing routes. */
export const US33_ROUTES = {
  /** School admin dashboard: src/modules/m27-school-admin/routes/dashboard.ts */
  schoolDashboard: '/admin-sekolah',
  /** Class performance picker and detail: src/modules/m08-student-performance/routes/class.ts */
  classPicker: '/prestasi/kelas',
  /** Observed demo class (e2e/m08-student-performance/qa-g5-class228.spec.ts). */
  classDetail: '/prestasi/kelas/228',
  /** Pupil Prestasi 360: routes/analitik.ts (`/prestasi/:userId`); account 2 = pelajar@demo.test. */
  pupilPrestasi: '/prestasi/2',
} as const

/** Mock accounts (src/mock/core-data/accounts.ts). */
export const US33_ACCOUNTS = {
  student: 'pelajar@demo.test',
  teacher: 'guru@demo.test',
  schoolAdmin: 'adminsekolah@demo.test',
  admin: 'admin@demo.test',
} as const

/** Label and empty-state copy, exactly as in the code. */
export const US33_COPY = {
  /** PerformanceSummary.vue:48-55 (UBadge label), Prestasi360Page.vue:147 / PrestasiKelasDetailPage.vue:182 (section title). */
  label: 'Keputusan Bijak SPM',
  /** DsEmptyState title: PerformanceSummary.vue:60-64, Prestasi360Page.vue:149, PrestasiKelasDetailPage.vue:184. */
  noData: 'Tiada data',
} as const

/** Test ids (file:line in the commit named above). */
export const US33_SELECTORS = {
  // m27 PerformanceSummary.vue
  schoolPanel: 'sd-performance', // :38
  schoolTitle: 'sd-performance-title', // :42
  schoolSource: 'sd-performance-source', // :54 (http mode only)
  schoolEmpty: 'sd-performance-empty', // :63 (http mode only, when no data)
  schoolPractice: 'sd-panel-practice', // :127
  practiceAccuracy: 'sd-practice-accuracy', // :130
  practiceCounts: 'sd-practice-counts', // :134 ("n sesi · m soalan")
  levels: 'sd-panel-levels', // :141
  // m08 Prestasi360Page.vue / PrestasiKelasDetailPage.vue
  classPage: 'prestasi-kelas-detail-page', // PrestasiKelasDetailPage.vue:152
  pupilPage: 'prestasi360-page', // Prestasi360Page.vue:111
  bijakSummary: 'bijak-summary', // http mode only
  bijakEmpty: 'bijak-empty', // http mode only, when sessions === 0
  statCards: 'stat-cards', // StatRow prefix `stat`
} as const

/**
 * School dashboard performance block.
 * Source: origin/be/BE-21-school-dashboard, packages/contract/src/school-admin/reports.ts,
 * `SchoolAdminDashboardSchema.performance` (GET /admin-sekolah/dashboard).
 */
export interface SchoolDashboardPerformance {
  gps: { value: number | null; grade: string | null; band: string | null; entries: number }
  risk: { safe: number; watch: number; high: number; total: number } | null
  practice: { accuracy: number | null; sessions: number; questions: number }
  levels: { code: 't4' | 't5'; name: string; accuracy: number }[]
  distribution: { grade: string; count: number; pct: number }[]
  total: number
}

/**
 * Teacher / class stats.
 * Source: origin/be/BE-19-reports-slice, packages/contract/src/reports/performance/schema.ts,
 * `PerformanceSchoolSchema.stats` and the class detail `stats` (students, accuracy, sessions, answered).
 */
export interface PerformanceStats {
  students: number
  sessions: number
  answered: number
  accuracy: number
}

/** Parses "12 sesi · 340 soalan" (sd-practice-counts) into numbers. */
export function parseCounts(text: string): { sessions: number; questions: number } {
  const m = /(\d[\d,.]*)\s*sesi\s*·\s*(\d[\d,.]*)\s*soalan/.exec(text.replace(/\s+/g, ' '))
  const n = (s: string | undefined): number => Number.parseInt((s ?? '0').replace(/[,.]/g, ''), 10)
  return { sessions: n(m?.[1]), questions: n(m?.[2]) }
}

/** UI login through the login form (http mode: real session cookie). */
export async function httpLogin(page: Page, user: string, pass: string): Promise<void> {
  await page.goto('/login')
  await page.getByTestId('login-email').fill(user)
  await page.getByTestId('login-password').fill(pass)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))
}

/** Screen is up, no horizontal scroll. */
export async function expectScreen(page: Page, testId: string): Promise<void> {
  await expect(page.getByTestId(testId)).toBeVisible()
  await expectNoHorizontalScroll(page)
}
