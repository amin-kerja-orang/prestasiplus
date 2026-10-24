/**
 * M04-T7 developer smoke for S8 / S9 (build-plan M04-T7; QA writes the E2E ids at G5): the structured
 * list, its filters, pager and empty state, and the detail page, as the admin demo account at
 * 375 / 768 / 1280. The empty-state copy is PROPOSED (DV-M04-12), so that test is `@provisional`.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isInViewportX,
  isMobileWidth,
  moduleTag,
  provisional,
  TAG,
  viewportWidth,
} from '../support'

const ADMIN = 'admin@demo.test'
const LIST = '/admin/structured-questions'

function rows(page: Page) {
  return page.getByTestId('structured-row')
}

function pager(page: Page) {
  return page.getByRole('navigation', { name: 'Pagination Navigation' })
}

async function openList(page: Page, gotoApp: (path: string) => Promise<void>, path = LIST) {
  await gotoApp(path)
  await expect(rows(page).first()).toBeVisible()
}

test.describe('M04 S8 structured list', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('header, stats, filter, 25 rows, columns and pager at every width', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openList(page, gotoApp)
    await expectTabTitle(page, 'Soalan Berstruktur')
    await expect(page.getByTestId('shell-admin-title')).toHaveText('Soalan Berstruktur')
    await expect(page.getByTestId('shell-admin-subtitle')).toHaveCount(0)
    await expect(page.getByTestId('structured-page').getByRole('heading', { level: 1 })).toHaveText(
      'Soalan Berstruktur',
    )
    await expect(page.getByText('Semua soalan berstruktur SPM dalam sistem')).toBeVisible()
    const add = page.getByTestId('structured-add')
    await expect(add).toHaveText('Tambah Soalan')
    await expect(add).toHaveAttribute('href', '/guru/soalan-berstruktur/cipta')
    // Wait for the layout to settle (fonts, grid) before measuring the hit area.
    await expect.poll(async () => (await add.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
    await expectTouchTarget(add)

    await expect(page.getByTestId('structured-stat-total')).toContainText('4,064')
    await expect(page.getByTestId('structured-stat-total')).toContainText('Jumlah Soalan')
    await expect(page.getByTestId('structured-stat-published')).toContainText('4,064')
    await expect(page.getByTestId('structured-by-subject')).toContainText('Agihan Mengikut Subjek')
    await expect(page.getByTestId('structured-subject-pill')).toHaveCount(15)
    await expect(page.getByTestId('structured-subject-pill').first()).toHaveText(
      'Bahasa Inggeris: 774',
    )

    // Filter: 31 subjects + all, 11 levels + all, KBAT 2 to 5 + all.
    await expect(page.getByTestId('structured-subject').locator('option')).toHaveCount(32)
    await expect(page.getByTestId('structured-level').locator('option')).toHaveCount(12)
    await expect(page.getByTestId('structured-kbat').locator('option')).toHaveText([
      'Semua KBAT',
      'Memahami (L2)',
      'Mengaplikasi (L3)',
      'Menganalisis (L4)',
      'Menilai/Mencipta (L5)',
    ])
    await expect(page.getByTestId('structured-search')).toHaveText('Cari')
    await expect(page.getByTestId('structured-reset')).toHaveCount(0)

    // Table: 25 rows, the first three ids are the observed anchors.
    await expect(rows(page)).toHaveCount(25)
    await expect(rows(page).nth(0).locator('td').first()).toHaveText('4454')
    await expect(rows(page).nth(1).locator('td').first()).toHaveText('4455')
    await expect(rows(page).nth(2).locator('td').first()).toHaveText('4456')
    await expect(rows(page).first().getByTestId('structured-kbat-pill')).toHaveText('L3')
    await expect(rows(page).first().getByTestId('structured-view')).toHaveText('Lihat')
    await expect(page.getByTestId('structured-counter')).toHaveText(
      'Menunjukkan 1–25 daripada 4,064 soalan',
    )

    // Column visibility: Subjek, Tgk, Markah from 640, Sub-Soalan from 768.
    const width = viewportWidth(page)
    const th = (name: string) => page.locator('thead th', { hasText: new RegExp(`^${name}$`) })
    if (width < 640) {
      await expect(th('Subjek')).toBeHidden()
      await expect(th('Tgk')).toBeHidden()
      await expect(th('Markah')).toBeHidden()
    } else {
      await expect(th('Subjek')).toBeVisible()
      await expect(th('Tgk')).toBeVisible()
      await expect(th('Markah')).toBeVisible()
    }
    if (width < 768) await expect(th('Sub-Soalan')).toBeHidden()
    else await expect(th('Sub-Soalan')).toBeVisible()

    // Pager: mobile "« Previous / Next »", otherwise the numbered strip that fits (DV-M04-09).
    if (isMobileWidth(page)) {
      await expect(pager(page).getByText('Next »')).toBeVisible()
    } else {
      await expect(pager(page)).toContainText('Showing 1 to 25 of 4064 results')
      const last = pager(page).getByRole('link', { name: 'Go to page 163' })
      await expect(last).toBeVisible()
      expect(await isInViewportX(page, last)).toBe(true)
    }
    await expectNoHorizontalScroll(page)
  })

  test('the next link opens page 2 (26 to 50) and the filters stay in the links', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openList(page, gotoApp)
    await pager(page).getByRole('link', { name: /Next/ }).first().click()
    await expect(page).toHaveURL(/\/admin\/structured-questions\?page=2$/)
    await expect(page.getByTestId('structured-counter')).toHaveText(
      'Menunjukkan 26–50 daripada 4,064 soalan',
    )
    await expect(rows(page)).toHaveCount(25)
    await expectNoHorizontalScroll(page)
  })

  test('the KBAT 5 filter shows 483 rows and Reset returns to 4,064', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openList(page, gotoApp)
    await page.getByTestId('structured-kbat').selectOption({ label: 'Menilai/Mencipta (L5)' })
    await page.getByTestId('structured-search').click()
    await expect(page).toHaveURL(/kbat_level=5/)
    await expect(page.getByTestId('structured-counter')).toHaveText(
      'Menunjukkan 1–25 daripada 483 soalan',
    )
    await expect(rows(page).first().getByTestId('structured-kbat-pill')).toHaveText('L5')
    const reset = page.getByTestId('structured-reset')
    await expect(reset).toHaveText('Set Semula')
    await expectNoHorizontalScroll(page)
    await reset.click()
    await expect(page).toHaveURL(/\/admin\/structured-questions$/)
    await expect(page.getByTestId('structured-counter')).toHaveText(
      'Menunjukkan 1–25 daripada 4,064 soalan',
    )
  })

  test(
    'a filter with no match shows the empty row and the zero counter',
    provisional('DV-M04-12 empty copy is PROPOSED'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp(`${LIST}?subject_id=18`)
      await expect(page.getByTestId('structured-empty')).toHaveText(
        'Tiada soalan berstruktur ditemui',
      )
      await expect(page.getByTestId('structured-counter')).toHaveText(
        'Menunjukkan 0 daripada 0 soalan',
      )
      await expect(pager(page)).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    },
  )
})

test.describe('M04 S9 structured detail', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('opens from the list "Lihat" link and shows the question with its sub-questions', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openList(page, gotoApp)
    const view = rows(page).first().getByTestId('structured-view')
    await expectTouchTarget(view)
    await view.click()
    await expect(page).toHaveURL(/\/admin\/structured-questions\/4454$/)
    await expect(page.getByTestId('structured-detail')).toBeVisible()
    await expectTabTitle(page, 'Detail Soalan Berstruktur')
    await expect(page.getByTestId('shell-admin-title')).toHaveText('Detail Soalan Berstruktur')
    await expect(page.getByTestId('structured-id')).toHaveText('ID: #4454')
    await expect(page.getByTestId('structured-pill-marks')).toHaveText('8 Markah')
    await expect(page.getByTestId('structured-subs-heading')).toHaveText(
      'Bahagian Soalan (1 sub-soalan)',
    )
    await expectNoHorizontalScroll(page)

    // Back to the list.
    await page.getByTestId('structured-back-list').click()
    await expect(page).toHaveURL(/\/admin\/structured-questions$/)
    await expect(rows(page).first()).toBeVisible()
  })

  test('the observed question 4454 shows its header, its part and both actions', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${LIST}/4454`)
    await expect(page.getByTestId('structured-id')).toHaveText('ID: #4454')
    await expect(page.getByTestId('structured-pill-subject')).toHaveText('Perniagaan')
    await expect(page.getByTestId('structured-pill-level')).toHaveText('Tingkatan 5')
    await expect(page.getByTestId('structured-pill-kbat')).toHaveText('KBAT: Mengaplikasi (L3)')
    await expect(page.getByTestId('structured-pill-marks')).toHaveText('8 Markah')
    await expect(page.getByTestId('structured-stimulus')).toContainText('Soalan Oleh:')
    await expect(page.getByTestId('structured-meta')).toContainText('Visibiliti: Public')
    await expect(page.getByTestId('structured-meta')).toContainText('Diterbitkan')
    await expect(page.getByTestId('structured-subs-heading')).toHaveText(
      'Bahagian Soalan (1 sub-soalan)',
    )
    await expect(page.getByTestId('structured-sub-label')).toHaveText(['A'])
    await expect(page.getByTestId('structured-sub-marks')).toHaveText(['8m'])
    await expect(page.getByTestId('structured-sub').first()).toContainText('Jawapan Model')
    const edit = page.getByTestId('structured-edit')
    await expect(edit).toHaveText('Edit Soalan')
    await expect(edit).toHaveAttribute('href', '/guru/soalan-berstruktur/4454/edit')
    await expectTouchTarget(edit)
    await expect(page.getByTestId('structured-back')).toHaveAttribute('href', LIST)
    await expectNoHorizontalScroll(page)
  })

  test('the observed question 3698 shows its id, marks and three parts', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${LIST}/3698`)
    await expect(page.getByTestId('structured-id')).toHaveText('ID: #3698')
    await expect(page.getByTestId('structured-pill-kbat')).toHaveText('KBAT: Mengaplikasi (L3)')
    await expect(page.getByTestId('structured-pill-marks')).toHaveText('10 Markah')
    await expect(page.getByTestId('structured-subs-heading')).toHaveText(
      'Bahagian Soalan (3 sub-soalan)',
    )
    await expect(page.getByTestId('structured-sub-label')).toHaveText(['3(A)', '3(B)', '3(C)'])
    await expect(page.getByTestId('structured-sub-marks')).toHaveText(['2m', '4m', '4m'])
    await expectNoHorizontalScroll(page)
  })

  test('an unknown id shows the standard 404 page', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp(`${LIST}/99999999`)
    await expectTabTitle(page, '404 - Halaman Tidak Dijumpai | PRESTASIPLUS')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Halaman Tidak Dijumpai', exact: true }),
    ).toBeVisible()
    await expectNoHorizontalScroll(page)
  })
})
