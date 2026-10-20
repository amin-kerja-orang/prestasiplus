/**
 * Expected shapes, routes and TODO selectors for the US-33 (b) Bijak results UI (branch
 * `be/us33-ui`, not on origin yet). Everything marked TODO is filled in once the UI lands.
 *
 * Grounding: docs/requirements/v2-bijak-spm.md US-33 / AC-33.1..33.5 (attempt record + one
 * aggregate per submitted sitting for Guru modules; AC-33.5 Mod Pelajar writes no aggregate).
 * The contracts on origin/be/BE-19-reports-slice and origin/be/BE-21-school-dashboard define NO
 * Bijak-specific field yet (grep "bijak" finds nothing under reports/ or school-admin/), so the
 * shapes below are PROVISIONAL and must be replaced by the real ones from `be/us33-ui`.
 */
import type { Page } from '@playwright/test'

import { expect } from '../fixtures/test'
import { expectNoHorizontalScroll } from '../support'

/** Existing routes (real today). */
export const US33_ROUTES = {
  /** School admin dashboard: src/modules/m27-school-admin/routes/dashboard.ts */
  schoolDashboard: '/admin-sekolah',
  /** Contract: GET /admin-sekolah/dashboard, SchoolAdminDashboardSchema (school-admin/reports.ts) */
  schoolUsageApi: '/admin-sekolah/usage',
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
 * PROVISIONAL aggregate shape of a Bijak results block (AC-33.1/33.4: subject, units = marks,
 * duration, start type, score, maximum). TODO: replace with the contract type from be/us33-ui.
 */
export interface BijakResultsBlock {
  attempts: number
  /** Mean percent, 0..100, null when there are no attempts (never 0%). */
  averagePercent: number | null
  /** One row per paper or subject. */
  rows: { label: string; attempts: number; averagePercent: number }[]
}

/** TODO selectors: fill in from be/us33-ui. */
export const US33_SELECTORS = {
  schoolBlock: '[data-testid="TODO-school-bijak-block"]',
  teacherBlock: '[data-testid="TODO-teacher-bijak-block"]',
  attemptsStat: '[data-testid="TODO-bijak-attempts"]',
  averageStat: '[data-testid="TODO-bijak-average"]',
  rows: '[data-testid="TODO-bijak-row"]',
} as const

/** Reads a block's visible numbers (TODO: adjust to the real markup). */
export async function readBlock(page: Page, selector: string): Promise<BijakResultsBlock> {
  const block = page.locator(selector)
  await expect(block).toBeVisible()
  await expectNoHorizontalScroll(page)
  const num = async (sel: string): Promise<number> =>
    Number.parseFloat((await block.locator(sel).innerText()).replace(/[^\d.]/g, ''))
  const rows = await block.locator(US33_SELECTORS.rows).allInnerTexts()
  return {
    attempts: await num(US33_SELECTORS.attemptsStat),
    averagePercent: await num(US33_SELECTORS.averageStat),
    rows: rows.map((t) => {
      const [label = '', attempts = '0', pct = '0'] = t.split('\n')
      return {
        label,
        attempts: Number.parseInt(attempts, 10),
        averagePercent: Number.parseFloat(pct),
      }
    }),
  }
}
