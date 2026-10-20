/**
 * US-33 (b) in the MOCK build: the school dashboard performance panel and the teacher Prestasi
 * views render their figures through the existing performance contract and carry NO "Bijak" label
 * (the label and the "Tiada data" state exist in http mode only: see us33-http.spec.ts).
 * Needs the scope-ON build: `npm run test:e2e:bijak`.
 */
import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll } from '../support'
import { HTTP_MODE } from './bijak-flow'
import {
  US33_ACCOUNTS,
  US33_COPY,
  US33_ROUTES,
  US33_SELECTORS as S,
  expectScreen,
  parseCounts,
} from './us33-flow'

test.skip(
  HTTP_MODE,
  'mock-only (loginAs init-script session, __mock boot, local mock server): not run when BIJAK_API_BASE is set',
)
test.skip(
  process.env.E2E_PROTOTYPE_SCOPE !== 'on',
  'needs the scope-on build: playwright.bijak.config.mjs',
)

test.describe('Bijak SPM US-33 results, mock build @bijak', () => {
  test('school dashboard: performance panel shows practice figures, no Bijak label @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(US33_ACCOUNTS.schoolAdmin)
    await gotoApp(US33_ROUTES.schoolDashboard)
    await expectScreen(page, S.schoolPanel)
    await expect(page.getByTestId(S.schoolTitle)).toBeVisible()
    await expect(page.getByTestId(S.schoolPractice)).toBeVisible()
    await expect(page.getByTestId(S.levels)).toBeVisible()

    const pct = (await page.getByTestId(S.practiceAccuracy).innerText()).trim()
    expect(pct).toMatch(/^(\d+(\.\d+)?%|-|–|—)$/)
    const counts = parseCounts(await page.getByTestId(S.practiceCounts).innerText())
    expect(counts.sessions).toBeGreaterThanOrEqual(0)
    expect(counts.questions).toBeGreaterThanOrEqual(counts.sessions > 0 ? 1 : 0)

    // Mock mode: no source label, no http-only empty state, label copy absent from the panel.
    await expect(page.getByTestId(S.schoolSource)).toHaveCount(0)
    await expect(page.getByTestId(S.schoolEmpty)).toHaveCount(0)
    await expect(page.getByTestId(S.schoolPanel)).not.toContainText(US33_COPY.label)
    await expectNoHorizontalScroll(page)
  })

  test('teacher class view: stat cards, no Bijak section @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(US33_ACCOUNTS.admin)
    await gotoApp(US33_ROUTES.classDetail)
    await expectScreen(page, S.classPage)
    await expect(page.getByTestId(S.statCards)).toBeVisible()
    await expect(page.getByTestId(S.bijakSummary)).toHaveCount(0)
    await expect(page.getByTestId(S.bijakEmpty)).toHaveCount(0)
    await expect(page.getByTestId(S.classPage)).not.toContainText(US33_COPY.label)
    await expectNoHorizontalScroll(page)
  })

  test('teacher opens a class from the picker and sees the same unlabelled view @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(US33_ACCOUNTS.teacher)
    await gotoApp(US33_ROUTES.classPicker)
    await expectNoHorizontalScroll(page)
    await page.locator('a[href^="/prestasi/kelas/"]').first().click()
    await expectScreen(page, S.classPage)
    await expect(page.getByTestId(S.statCards)).toBeVisible()
    await expect(page.getByTestId(S.bijakSummary)).toHaveCount(0)
  })

  test('pupil Prestasi 360: stat cards, no Bijak section @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(US33_ACCOUNTS.admin)
    await gotoApp(US33_ROUTES.pupilPrestasi)
    await expectScreen(page, S.pupilPage)
    await expect(page.getByTestId(S.statCards)).toBeVisible()
    await expect(page.getByTestId(S.bijakSummary)).toHaveCount(0)
    await expect(page.getByTestId(S.pupilPage)).not.toContainText(US33_COPY.label)
  })

  test.fixme('teacher sees own students only (no other class or school) @bijak', () => {
    // The mock performance data (m08/m10 fixtures) is generated independently of the Bijak store and
    // the mock does not scope a teacher view by Bijak attempts; scoping is a backend rule asserted
    // over http (BE-19). Revisit with real teacher credentials in http mode.
  })

  test.fixme('a submitted student attempt moves sessions and answered @bijak', () => {
    // Mock: the Bijak attempt store (m28, tab localStorage) is not wired into the m08/m27 mock
    // performance datasets, so a submit cannot change their figures. Needs the real stack (student,
    // teacher and school admin credentials) in http mode.
  })

  test.fixme('Mod Pelajar attempts do not move the school or teacher figures (AC-33.5) @bijak', () => {
    // Same reason as the data-flow test: no mock link from Bijak attempts to the performance
    // figures, so there is nothing to exclude. Needs the real stack in http mode.
  })
})
