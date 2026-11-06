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
import { demoCreds, NEEDS_PASSWORD } from './http-creds'
import { US33_COPY, US33_ROUTES, US33_SELECTORS as S, expectScreen, httpLogin } from './us33-flow'

const { user: SCHOOL_USER, pass: SCHOOL_PASS } = demoCreds('adminSekolah')
const { user: GURU_USER, pass: GURU_PASS } = demoCreds('guru')

test.skip(!HTTP_MODE, 'needs BIJAK_API_BASE or BASE_URL (integration stack)')

test.describe('Bijak SPM US-33 results, http mode @bijak @api', () => {
  test('school dashboard panel is labelled Keputusan Bijak SPM, with figures or Tiada data @bijak', async ({
    page,
  }) => {
    test.skip(!SCHOOL_USER || !SCHOOL_PASS, NEEDS_PASSWORD)
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

  test('teacher class view is the full V3 Prestasi Kelas layout, no Bijak-only section @bijak', async ({
    page,
  }) => {
    // R1 (D115, S10-T06 change 1, fixed by S10-T07 #843): the class view no longer has a reduced
    // "Keputusan Bijak SPM" section in http mode; Bijak sittings count inside the normal blocks.
    test.skip(!GURU_USER || !GURU_PASS, NEEDS_PASSWORD)
    await httpLogin(page, GURU_USER ?? '', GURU_PASS ?? '')
    await page.goto(US33_ROUTES.classPicker)
    await expectNoHorizontalScrollHttp(page)
    await page.locator('a[href^="/prestasi/kelas/"]').first().click()
    await expectScreen(page, S.classPage)
    await expect(page.getByTestId(S.statCards)).toBeVisible()
    await expect(page.getByTestId(S.bijakSummary)).toHaveCount(0)
    await expect(page.getByTestId(S.bijakEmpty)).toHaveCount(0)
    await expect(page.getByText(US33_COPY.label)).toHaveCount(0)
  })
})
