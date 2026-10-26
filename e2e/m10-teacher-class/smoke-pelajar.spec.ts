/**
 * M10 S6 `/guru/pelajar` at 375 / 768 / 1280 (M10-T5; SRS M10 §12 E2E-M10-25 and 26, and the S6 part
 * of 02 and 79). Accounts: guru2 (no teacher-profile school, no classes; the admin is redirected, DV-M10-48) and 5 guru
 * (`guru@demo.test`: 8 students in classes 2001 and 2002, profile school SMK DEMO). The populated
 * rows and the add / remove actions are PROPOSED / INFERRED (FR-M10-36, FR-M10-37), so those tests
 * are `@provisional`.
 */

import type { Page } from '@playwright/test'

import { addInitSession } from '../fixtures/mock-page'
import { expect, test } from '../fixtures/test'
import {
  acceptNextDialog,
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isMobileWidth,
  moduleTag,
  provisional,
} from '../support'

const GURU = 'guru@demo.test'
const ADMIN = 'admin@demo.test'
/** The admin landing `/admin` (D48); the prototype scope redirects it on to the Command Center. */
const ADMIN_LANDING = /\/admin(\/command-center)?$/
/** Mock teacher with no class and no profile school (id 5301): the observed empty state of S6 (DV-M10-48: the admin no longer reaches it). */
const GURU_NO_CLASS = 'guru2@demo.test'
const PELAJAR = 'pelajar@demo.test'
const MODULE = { tag: [moduleTag(10)] }

test.use({ mockInit: { latency: 0 } })

async function expectHeader(page: Page): Promise<void> {
  await expect(page.getByTestId('shell-user-title')).toHaveText('Pelajar')
  await expect(page.getByTestId('shell-user-subtitle')).toHaveText('Urus pelajar dalam kelas anda')
}

test.describe('M10 S6 Pelajar Saya', MODULE, () => {
  test('SRS §12 #25 teacher with no class: counter, link label, tabs and badge, empty card @m10', async ({
    page,
    gotoApp,
  }) => {
    await addInitSession(page, GURU_NO_CLASS)
    await gotoApp('/guru/pelajar')
    await expectTabTitle(page, 'Pelajar Saya - PRESTASIPLUS')
    await expectHeader(page)
    await expect(page.getByTestId('pelajar-value')).toHaveText('0')
    await expect(page.getByText('Pelajar dalam kelas saya')).toBeVisible()
    const link = page.getByTestId('pelajar-create')
    await expect(link).toHaveAttribute('href', '/guru/pelajar/cipta')
    // `toHaveText` reads textContent (it includes the label hidden below 640px): compare the visible text.
    await expect
      .poll(() => link.evaluate((el) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim()))
      .toBe(isMobileWidth(page) ? 'Cipta' : 'Cipta Pelajar')
    await expect(page.locator('[data-testid="pelajar-tabs"] button')).toHaveText([
      'Pelajar Sekolah',
      'Pelajar Saya (0)',
    ])
    const empty = page.getByTestId('pelajar-empty')
    await expect(empty).toContainText('Belum ada pelajar dalam kelas anda')
    await expect(empty).toContainText('Buat kelas dan tambah pelajar dari senarai sekolah.')
    await expect(page.getByTestId('pelajar-empty-create')).toHaveAttribute(
      'href',
      '/guru/kelas/cipta',
    )
    await expectTouchTarget(page.getByTestId('tab-school'))
    await expectTouchTarget(link)
    await expectNoHorizontalScroll(page)
  })

  test('SRS §12 #25 teacher with no class: "Cipta Pelajar" returns to /guru/pelajar with no message @m10', async ({
    page,
    gotoApp,
  }) => {
    await addInitSession(page, GURU_NO_CLASS)
    await gotoApp('/guru/pelajar')
    await page.getByTestId('pelajar-create').click()
    await expect(page).toHaveURL(/\/guru\/pelajar$/)
    await expect(page.getByTestId('pelajar-value')).toHaveText('0')
    await expect(page.getByTestId('flash-outlet')).toHaveCount(0)
    await gotoApp('/guru/pelajar/cipta')
    await expect(page).toHaveURL(/\/guru\/pelajar$/)
  })

  test('SRS §12 #25 teacher with no class school tab: class select and the no-school card with "Tetapan Profil" @m10', async ({
    page,
    gotoApp,
  }) => {
    await addInitSession(page, GURU_NO_CLASS)
    await gotoApp('/guru/pelajar')
    await page.getByTestId('tab-school').click()
    await expect(page.getByText('Tambah pelajar ke:')).toBeVisible()
    await expect(page.locator('[data-testid="pelajar-target"] option')).toHaveText([
      '-- Pilih kelas --',
    ])
    const card = page.getByTestId('pelajar-no-school')
    await expect(card).toContainText('Sekolah belum ditetapkan')
    await expect(card).toContainText(
      'Sila tetapkan sekolah anda di Profil atau semasa cipta kelas untuk melihat senarai pelajar sekolah.',
    )
    await expect(page.getByTestId('pelajar-profile-link')).toHaveAttribute(
      'href',
      '/guru/profil/edit',
    )
    await expect(page.getByTestId('pelajar-profile-link')).toHaveText('Tetapan Profil')
    await expectNoHorizontalScroll(page)
    // tabs stay side by side at every width
    const [a, b] = await Promise.all([
      page.getByTestId('tab-school').boundingBox(),
      page.getByTestId('tab-mine').boundingBox(),
    ])
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(2)
    expect(a!.x).toBeLessThan(b!.x)
  })

  test(
    'SRS §12 #26 guru: 8 in counter and badge, 8 rows @m10',
    provisional('populated rows are PROPOSED (FR-M10-36)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp('/guru/pelajar')
      await expect(page.getByTestId('pelajar-count')).toHaveText('8')
      await expect(page.getByTestId('tab-mine-count')).toHaveText('8')
      await expect(page.getByTestId('student-row')).toHaveCount(8)
      await expect(page.getByTestId('student-name').first()).toContainText('Murid Demo')
      await expect(page.getByTestId('student-class').first()).toBeVisible()
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'SRS §12 #26 guru school tab: 2 classes, school students, add pelajar (id 2) to 2002 → counter 9 @m10',
    provisional('the add control and the school list are INFERRED / PROPOSED (FR-M10-37)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp('/guru/pelajar')
      await page.getByTestId('tab-school').click()
      await expect(page.locator('[data-testid="pelajar-target"] option')).toHaveCount(3)
      const row = page.getByTestId('student-row').filter({ hasText: 'Pelajar Demo' }).first()
      await expect(row).toBeVisible()
      await expect(row.getByTestId('student-add')).toBeDisabled()
      await page.getByTestId('pelajar-target').selectOption({ index: 2 })
      await expect(row.getByTestId('student-add')).toBeEnabled()
      await expectTouchTarget(row.getByTestId('student-add'))
      await expectNoHorizontalScroll(page)
      await row.getByTestId('student-add').click()
      await expect(page.getByTestId('pelajar-count')).toHaveText('9')
      await page.getByTestId('tab-mine').click()
      await expect(page.getByTestId('student-row').filter({ hasText: 'Pelajar Demo' })).toHaveCount(
        1,
      )
    },
  )

  test(
    'SRS §12 #26 guru: remove a student from a class after confirm @m10',
    provisional('remove (#17) is INFERRED; the confirm copy is PROPOSED'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp('/guru/pelajar')
      await expect(page.getByTestId('student-row')).toHaveCount(8)
      const chips = await page.getByTestId('student-class').count()
      const remove = page.getByTestId('student-remove').first()
      await expectTouchTarget(remove)
      const dialog = acceptNextDialog(page, { type: 'confirm' })
      await remove.click()
      await dialog
      await expect(page.getByTestId('student-class')).toHaveCount(chips - 1)
    },
  )

  test('SRS §9 / DV-M10-48 the admin leaves /guru/pelajar for its landing page @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/guru/pelajar')
    await expect(page).not.toHaveURL(/\/guru\//)
    await expect(page).toHaveURL(ADMIN_LANDING)
  })

  test(
    'SRS §9 a guest is sent to /login; a pelajar leaves /guru/pelajar for its landing page @m10',
    provisional('other roles on /guru/* are INFERRED (OQ-M10-08)'),
    async ({ page, gotoApp, loginAs }) => {
      await gotoApp('/guru/pelajar')
      await expect(page).toHaveURL(/\/login$/)
      await loginAs(PELAJAR)
      await gotoApp('/guru/pelajar')
      await expect(page).not.toHaveURL(/\/guru\//)
    },
  )
})
