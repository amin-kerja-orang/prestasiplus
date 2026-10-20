/**
 * US-33 (b) in http mode: the "Keputusan Bijak SPM" label and the "Tiada data" state. Runs only with
 * `BIJAK_API_BASE` (the origin serving the VITE_API_MODE=http SPA) and credentials from the
 * environment, never from the repo:
 *   BIJAK_ADMIN_SEKOLAH_USER / BIJAK_ADMIN_SEKOLAH_PASS
 *   BIJAK_GURU_USER / BIJAK_GURU_PASS
 * Plain `@playwright/test` (no mock fixtures), UI login, `page.goto`.
 */
import { expect, test } from '@playwright/test'

import { expectNoHorizontalScrollHttp, HTTP_MODE } from './bijak-flow'
import { US33_COPY, US33_ROUTES, US33_SELECTORS as S, expectScreen, httpLogin } from './us33-flow'

const SCHOOL_USER = process.env.BIJAK_ADMIN_SEKOLAH_USER
const SCHOOL_PASS = process.env.BIJAK_ADMIN_SEKOLAH_PASS
const GURU_USER = process.env.BIJAK_GURU_USER
const GURU_PASS = process.env.BIJAK_GURU_PASS

test.skip(!HTTP_MODE, 'needs BIJAK_API_BASE (integration stack)')

test.describe('Bijak SPM US-33 results, http mode @bijak', () => {
  test('school dashboard panel is labelled Keputusan Bijak SPM, with figures or Tiada data @bijak', async ({
    page,
  }) => {
    test.skip(!SCHOOL_USER || !SCHOOL_PASS, 'needs BIJAK_ADMIN_SEKOLAH_USER and _PASS')
    await httpLogin(page, SCHOOL_USER ?? '', SCHOOL_PASS ?? '')
    await page.goto(US33_ROUTES.schoolDashboard)
    await expectScreen(page, S.schoolPanel)
    await expect(page.getByTestId(S.schoolSource)).toHaveText(US33_COPY.label)
    // Either the figures (practice panel) or the no-data state, never both and never a blank panel.
    const empty = page.getByTestId(S.schoolEmpty)
    if (await empty.isVisible()) {
      await expect(empty).toContainText(US33_COPY.noData)
      await expect(page.getByTestId(S.schoolPractice)).toHaveCount(0)
    } else {
      await expect(page.getByTestId(S.schoolPractice)).toBeVisible()
      await expect(page.getByTestId(S.practiceCounts)).toContainText('sesi')
    }
    await expectNoHorizontalScrollHttp(page)
  })

  test('teacher class view has the Keputusan Bijak SPM section, figures or Tiada data @bijak', async ({
    page,
  }) => {
    test.skip(!GURU_USER || !GURU_PASS, 'needs BIJAK_GURU_USER and _PASS')
    await httpLogin(page, GURU_USER ?? '', GURU_PASS ?? '')
    await page.goto(US33_ROUTES.classPicker)
    await expectNoHorizontalScrollHttp(page)
    await page.locator('a[href^="/prestasi/kelas/"]').first().click()
    await expectScreen(page, S.classPage)
    const section = page.getByTestId(S.bijakSummary)
    await expect(section).toContainText(US33_COPY.label)
    if (await page.getByTestId(S.bijakEmpty).isVisible()) {
      await expect(page.getByTestId(S.bijakEmpty)).toContainText(US33_COPY.noData)
      await expect(page.getByTestId(S.statCards)).toHaveCount(0)
    } else {
      await expect(page.getByTestId(S.statCards)).toBeVisible()
    }
  })
})
