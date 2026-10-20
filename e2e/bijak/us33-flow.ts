/**
 * Expected shapes, routes and TODO selectors for the US-33 (b) Bijak results UI (branch
 * `be/us33-ui`, not on origin yet). Everything marked TODO is filled in once the UI lands.
 *
 * Decision: NO new Bijak fields in the contract. "Bijak" is the http-mode data source plus a UI
 * label; Bijak data reaches the screens through the EXISTING performance fields. The types below
 * are plain copies of those contract shapes (the e2e tsconfig does not import `packages/contract`,
 * which is not on this branch), each with its source.
 */
import type { Page } from '@playwright/test'

import { expect } from '../fixtures/test'
import { expectNoHorizontalScroll } from '../support'

/** Existing routes (real today). */
export const US33_ROUTES = {
  /** School admin dashboard: src/modules/m27-school-admin/routes/dashboard.ts */
  schoolDashboard: '/admin-sekolah',
  /** Guru modules: src/modules/m08-student-performance/routes/{class,analitik}.ts */
  teacherClassPrestasi: '/prestasi/kelas/:id',
  teacherAnalitikKelas: '/analitik/kelas',
  teacherAnalitikPelajar: '/analitik/pelajar',
} as const

/** Mock accounts (src/mock/core-data/accounts.ts). */
export const US33_ACCOUNTS = {
  student: 'pelajar@demo.test',
  teacher: 'guru@demo.test',
  schoolAdmin: 'adminsekolah@demo.test',
  admin: 'admin@demo.test',
} as const

/**
 * School dashboard performance block.
 * Source: origin/be/BE-21-school-dashboard, packages/contract/src/school-admin/reports.ts,
 * `SchoolAdminDashboardSchema.performance` (GET /admin-sekolah/dashboard).
 */
export interface SchoolDashboardPerformance {
  gps: { value: number | null; grade: string | null; band: string | null; entries: number }
  risk: { safe: number; watch: number; high: number; total: number } | null
  practice: {
    /** null (never 0%) when there are no sessions. */
    accuracy: number | null
    sessions: number
    questions: number
  }
  levels: { code: 't4' | 't5'; name: string; accuracy: number }[]
  distribution: { grade: string; count: number; pct: number }[]
  /** Sum of the distribution counts. */
  total: number
}

/**
 * Teacher / school reports figures.
 * Source: origin/be/BE-19-reports-slice, packages/contract/src/reports/performance/schema.ts,
 * `PerformanceSchoolSchema` (GET /performance/school): stats, levels, distribution.
 */
export interface PerformanceSchoolFigures {
  stats: {
    students: number
    teachers: number
    classes: number
    subjects: number
    sessions: number
    answered: number
    accuracy: number
  }
  levels: { code: string; accuracy: number; classes: number; students: number; sessions: number }[]
  distribution: { grade: string; count: number; pct: number }[]
}

/**
 * Per-student rows of a class (teacher scoping: own students only).
 * Source: same file, `PerformanceClassAnalyticsSchema.rows` (GET /performance/classes).
 */
export interface PerformanceClassRow {
  userId: number
  name: string
  accuracy: number
  answered: number
  riskLevel: string
}

/** TODO selectors: fill in from be/us33-ui. */
export const US33_SELECTORS = {
  /** The "Bijak" label the UI puts on the Bijak-sourced figures. */
  bijakLabel: '[data-testid="TODO-bijak-label"]',
  /** The no-data state shown instead of zeros when there are no Bijak attempts. */
  noData: '[data-testid="TODO-bijak-no-data"]',
  schoolPerformance: '[data-testid="TODO-school-performance"]',
  teacherReports: '[data-testid="TODO-teacher-reports"]',
  sessions: '[data-testid="TODO-sessions"]',
  answered: '[data-testid="TODO-answered"]',
  accuracy: '[data-testid="TODO-accuracy"]',
  levels: '[data-testid="TODO-levels"]',
  distribution: '[data-testid="TODO-distribution"]',
  studentRow: '[data-testid="TODO-student-row"]',
} as const

/** Reads a number out of a stat element (TODO: adjust to the real markup). */
export async function readStat(page: Page, scope: string, selector: string): Promise<number> {
  const el = page.locator(scope).locator(selector)
  await expect(el).toBeVisible()
  return Number.parseFloat((await el.innerText()).replace(/[^\d.]/g, ''))
}

/** Asserts the "Bijak" label inside a block and no horizontal scroll. */
export async function expectBijakBlock(page: Page, scope: string): Promise<void> {
  await expect(page.locator(scope)).toBeVisible()
  await expect(page.locator(scope).locator(US33_SELECTORS.bijakLabel)).toBeVisible()
  await expectNoHorizontalScroll(page)
}
