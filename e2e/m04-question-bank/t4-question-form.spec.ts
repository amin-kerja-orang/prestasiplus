/**
 * M04-T4 developer smoke for the old create path (a redirect to Studio) and S4 `/admin/questions/:id/edit` (build-plan
 * M04-T4; QA writes E2E-M04-* at G5): editing anchor 564159 (clearing its DSKP tag, kept after a reload), as the admin
 * demo account at 375 / 768 / 1280. The flash texts are UNVERIFIED COPY, so those assertions are `@provisional`.
 */

import type { Page } from '@playwright/test'

import { waitForApp } from '../fixtures/mock-handle'
import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  moduleTag,
  provisional,
  TAG,
} from '../support'

const ADMIN = 'admin@demo.test'

const byId = (page: Page, id: string) => page.getByTestId(id)

/** A full page load after a write: the mock boot replays the saved changes, so it gets a longer budget. */
async function reopen(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await waitForApp(page, 60_000)
}

// The flat create form is retired (FR-ADM-Q04.7, PRD45 line 115): the wizard is its one host, and its unit tests are
// `StudioEditorPage.test.ts`. Studio has no mock backend, so this build shows the unavailable notice there.
test.describe('M04 old create path', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('redirects to the Studio wizard with the notice, and removes the query', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions/create')
    await expect(page).toHaveURL(/\/admin\/studio\/questions\/create$/)
    await expect(page.getByText('Borang soalan lama telah dipindahkan ke Studio.')).toBeVisible()
    await expect(byId(page, 'studio-unavailable')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })
})

test.describe('M04 S4 edit question', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions/564159/edit')
  })

  test('is pre-filled, has no type select or keyboard, and shows the saved DSKP chain', async ({
    page,
  }) => {
    await expectTabTitle(page, 'Edit Soalan')
    await expect(page.getByRole('heading', { name: '✏️ Edit Soalan' })).toBeVisible()
    await expect(page.getByText('Kemaskini maklumat soalan #564159')).toBeVisible()
    await expect(byId(page, 'q-text')).toHaveValue(/Apakah maksud satelit buatan/)
    await expect(byId(page, 'q-type')).toHaveCount(0)
    await expect(byId(page, 'vkb-toggle')).toHaveCount(0)
    await expect(byId(page, 'form-submit')).toHaveText('Kemaskini Soalan')
    await expect(page.locator('[id="q-correct-0"] [role="radio"]')).toBeChecked()
    await expect(byId(page, 'q-option-0')).toHaveValue(/Objek buatan manusia/)
    await expect(page.locator('[id="q-difficulty"] [role="radio"][value="3"]')).toBeChecked()
    await expect(byId(page, 'dskp-tagged')).toBeVisible()
    await expect(byId(page, 'dskp-sp').locator('option:checked')).not.toHaveText('-- Pilih SP --')
    await expect(byId(page, 'dskp-remove')).toBeVisible()
    await expect(byId(page, 'form-cancel')).toHaveAttribute('href', '/admin/questions/564159')
    await expectNoHorizontalScroll(page)
  })

  test(
    'clearing the DSKP tag is saved and still gone after a reload',
    provisional('The flash text is UNVERIFIED COPY (SRS §8.2)'),
    async ({ page }) => {
      test.setTimeout(150_000)
      await expect(byId(page, 'dskp-tagged')).toBeVisible()
      await byId(page, 'dskp-remove').click()
      await expect(byId(page, 'dskp-tagged')).toHaveCount(0)
      await expect(byId(page, 'dskp-bidang')).toHaveValue('')
      await expect(byId(page, 'dskp-sk')).toBeDisabled()
      await expect(byId(page, 'dskp-remove')).toHaveCount(0)

      await byId(page, 'form-submit').click()
      await expect(page).toHaveURL(/\/admin\/questions\/564159$/)
      await expect(byId(page, 'cmp-flash')).toContainText('Soalan berjaya dikemaskini.')
      await expect(page.getByText('Belum ditag')).toBeVisible()

      await reopen(page, '/admin/questions/564159')
      await expect(page.getByText('Belum ditag')).toBeVisible()
      await reopen(page, '/admin/questions/564159/edit')
      await expect(byId(page, 'q-text')).toHaveValue(/Apakah maksud satelit buatan/)
      await expect(byId(page, 'dskp-tagged')).toHaveCount(0)
      await expect(byId(page, 'dskp-remove')).toHaveCount(0)
    },
  )

  test('saving without touching the DSKP keeps the tag (DV-M04-15)', async ({ page }) => {
    test.setTimeout(150_000)
    await expect(byId(page, 'dskp-tagged')).toBeVisible()
    await byId(page, 'q-points').fill('2')
    await byId(page, 'form-submit').click()
    await expect(page).toHaveURL(/\/admin\/questions\/564159$/)
    await reopen(page, '/admin/questions/564159/edit')
    await expect(byId(page, 'q-points')).toHaveValue('2')
    await expect(byId(page, 'dskp-tagged')).toBeVisible()
  })

  test('an unknown id is the standard 404 page', async ({ page, gotoApp }) => {
    await gotoApp('/admin/questions/99999999/edit')
    await expect(page.getByTestId('question-edit-page')).toHaveCount(0)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Halaman Tidak Dijumpai', exact: true }),
    ).toBeVisible()
  })
})
