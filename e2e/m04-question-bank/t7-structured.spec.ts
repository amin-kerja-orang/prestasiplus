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
  moduleTag,
  provisional,
  TAG,
  viewportWidth,
} from '../support'

import { openFilters } from './list-helpers'

const ADMIN = 'admin@demo.test'
const LIST = '/admin/structured-questions'

function rows(page: Page) {
  return page.getByTestId('structured-table').locator('tbody tr, li')
}

function pager(page: Page) {
  return page.locator('[data-ds="data-table-pager"]')
}

/** The apply button: in the sheet below 768 px, in the bar from 768 px. */
function applyButton(page: Page) {
  return viewportWidth(page) < 768
    ? page.locator('[data-ds="filter-sheet"]').getByRole('button').first()
    : page.getByTestId('structured-filter').locator('button[type=submit]')
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
    await expectTabTitle(page, 'Soalan Berstruktur | PRESTASIPLUS')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Soalan Berstruktur')
    await expect(page.getByTestId('pentadbiran-subtitle')).toHaveText(
      'Semua soalan berstruktur SPM dalam sistem',
    )
    // D9 dead link: the M10 create form is not routed, so "Tambah Soalan" is hidden (no link to a 404).
    await expect(page.getByTestId('structured-add')).toHaveCount(0)
    await expect(page.locator('a[href*="soalan-berstruktur"]')).toHaveCount(0)

    await expect(page.getByTestId('structured-stat-total')).toContainText('4,064')
    await expect(page.getByTestId('structured-stat-total')).toContainText('Jumlah Soalan')
    await expect(page.getByTestId('structured-stat-published')).toContainText('4,064')
    await expect(page.getByTestId('structured-by-subject')).toContainText('Agihan Mengikut Subjek')
    await expect(page.getByTestId('structured-subject-pill')).toHaveCount(15)
    await expect(page.getByTestId('structured-subject-pill').first()).toHaveText(
      'Bahasa Inggeris: 774',
    )

    // Filter: 31 subjects + all, Tingkatan 1 to 5 + all, KBAT 2 to 5 + all. Behind a sheet on a phone.
    await openFilters(page)
    await expect(page.getByTestId('structured-subject').locator('option')).toHaveCount(32)
    await expect(page.getByTestId('structured-level').locator('option')).toHaveCount(6)
    await expect(page.getByTestId('structured-kbat').locator('option')).toHaveText([
      'Semua KBAT',
      'Memahami (L2)',
      'Mengaplikasi (L3)',
      'Menganalisis (L4)',
      'Menilai/Mencipta (L5)',
    ])
    await expectTouchTarget(applyButton(page))
    if (viewportWidth(page) < 768) await page.keyboard.press('Escape')

    // 25 rows, the first three ids are the observed anchors.
    await expect(rows(page)).toHaveCount(25)
    if (viewportWidth(page) >= 768) {
      await expect(rows(page).nth(0).locator('td').first()).toHaveText('4454')
      await expect(rows(page).nth(1).locator('td').first()).toHaveText('4455')
      await expect(rows(page).nth(2).locator('td').first()).toHaveText('4456')
      await expect(rows(page).first().getByTestId('structured-kbat-pill')).toHaveText('L3')
    }
    await expect(rows(page).first().getByTestId('structured-view')).toHaveAttribute(
      'aria-label',
      'Lihat',
    )
    await expect(pager(page)).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('the next link opens page 2 (26 to 50) and the filters stay in the links', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openList(page, gotoApp)
    await pager(page).getByRole('button', { name: 'Halaman seterusnya' }).click()
    await expect(page).toHaveURL(/\/admin\/structured-questions\?page=2$/)
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
    await openFilters(page)
    await page.getByTestId('structured-kbat').selectOption({ label: 'Menilai/Mencipta (L5)' })
    await applyButton(page).click()
    await expect(page).toHaveURL(/kbat_level=5/)
    await expect(pager(page)).toContainText('483')
    if (viewportWidth(page) >= 768)
      await expect(rows(page).first().getByTestId('structured-kbat-pill')).toHaveText('L5')
    await expectNoHorizontalScroll(page)
    await openFilters(page)
    await page.getByRole('button', { name: 'Set Semula', exact: true }).first().click()
    await expect(page).toHaveURL(/\/admin\/structured-questions$/)
    await expect(pager(page)).toContainText('4064')
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
    if (viewportWidth(page) < 1024) await expectTouchTarget(view)
    await view.click()
    await expect(page).toHaveURL(/\/admin\/structured-questions\/4454$/)
    await expect(page.getByTestId('structured-detail')).toBeVisible()
    await expectTabTitle(page, 'Detail Soalan Berstruktur | PRESTASIPLUS')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Detail Soalan Berstruktur')
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
    await expect(page.getByTestId('structured-meta')).toContainText('Published')
    await expect(page.getByTestId('structured-subs-heading')).toHaveText(
      'Bahagian Soalan (1 sub-soalan)',
    )
    await expect(page.getByTestId('structured-sub-label')).toHaveText(['A'])
    await expect(page.getByTestId('structured-sub-marks')).toHaveText(['8m'])
    await expect(page.getByTestId('structured-sub').first()).toContainText('Jawapan Model')
    // D9 dead link: the M10 edit form is not routed, so "Edit Soalan" is hidden.
    await expect(page.getByTestId('structured-edit')).toHaveCount(0)
    await expect(page.locator('a[href*="soalan-berstruktur"]')).toHaveCount(0)
    await expectTouchTarget(page.getByTestId('structured-back-list'))
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
    await expectTabTitle(page, 'Halaman Tidak Dijumpai | PRESTASIPLUS')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Halaman Tidak Dijumpai', exact: true }),
    ).toBeVisible()
    await expectNoHorizontalScroll(page)
  })
})

// S6-T17 (R1-GUR-44b): the teacher mount of the same pages at /guru/soalan-berstruktur (the m10 route
// records pass portal 'guru'). Runs at 375 / 768 / 1280 with the other tests of this file.
test.describe(
  'R1-GUR-44b teacher structured list and detail',
  { tag: [TAG.smoke, moduleTag(4)] },
  () => {
    test.use({ mockInit: { latency: 0 } })
    const GURU_ACCOUNT = 'guru@demo.test'
    const GURU_LIST = '/guru/soalan-berstruktur'

    test('the list shows 20 rows, the PRD copy and the BM pager without horizontal scroll', async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(GURU_ACCOUNT)
      await openList(page, gotoApp, GURU_LIST)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Soalan Berstruktur')
      await expect(
        page.getByText(
          /^Cipta & urus soalan berstruktur mengikut piawaian SPM KPM — [\d,]+ soalan dalam bank$/,
        ),
      ).toBeVisible()
      await expect(rows(page)).toHaveCount(20)
      await expect(page.getByTestId('structured-add')).toHaveCount(0)
      await expect(page.getByTestId('structured-stat-total')).toHaveCount(0)
      await expect(page.getByTestId('structured-counter')).toHaveText(
        /^Menunjukkan 1 hingga 20 daripada [\d,]+ keputusan$/,
      )
      await expect(page.getByTestId('structured-pager')).toContainText('Seterusnya')
      // The filter is behind a sheet on a phone (DsFilterBar).
      await openFilters(page)
      await expect(page.getByTestId('structured-status').locator('option')).toHaveText([
        'Semua',
        'Diluluskan',
        'Menunggu Semakan',
      ])
      const submit = applyButton(page)
      // "Tapis" in the bar; the phone sheet keeps the DsFilterBar "Guna".
      await expect(submit).toHaveText(viewportWidth(page) < 768 ? 'Guna' : 'Tapis')
      await expect
        .poll(async () => (await submit.boundingBox())?.height ?? 0)
        .toBeGreaterThanOrEqual(44)
      await expectTouchTarget(submit)
      if (viewportWidth(page) < 768) await page.keyboard.press('Escape')
      // The icon row action is 36 px on a desktop table, as in the admin list above.
      if (viewportWidth(page) < 1024)
        await expectTouchTarget(rows(page).first().getByTestId('structured-view'))
      await expectTouchTarget(
        page.getByTestId('structured-pager').getByRole('button', { name: 'Seterusnya' }),
      )
      await expectNoHorizontalScroll(page)
    })

    test('the Menunggu Semakan filter lists the seeded own submissions; the eye of an approved question opens its detail with the stimulus once', async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(GURU_ACCOUNT)
      await gotoApp(`${GURU_LIST}?status=review`)
      // The canonical Guru has two seeded own submissions (g2 newest, then g1), both waiting.
      await expect(rows(page)).toHaveCount(2)
      await expect(rows(page).first().getByTestId('structured-view')).toHaveAttribute(
        'href',
        `${GURU_LIST}/g2`,
      )
      await expect(rows(page).nth(1).getByTestId('structured-view')).toHaveAttribute(
        'href',
        `${GURU_LIST}/g1`,
      )
      // The status is a chip in the table and a card field below 768 px.
      if (viewportWidth(page) >= 768)
        await expect(rows(page).first().getByTestId('structured-status-chip')).toHaveText(
          'Menunggu Semakan',
        )
      else await expect(rows(page).first()).toContainText('Menunggu Semakan')
      await expectNoHorizontalScroll(page)

      // An approved question row (the first row that is not a g-submission).
      await gotoApp(`${GURU_LIST}?status=approved`)
      await rows(page).first().getByTestId('structured-view').click()
      await expect(page).toHaveURL(/\/guru\/soalan-berstruktur\/\d+$/)
      await expect(page.getByTestId('structured-detail')).toBeVisible()
      await expect(page.getByTestId('structured-stimulus')).toHaveCount(1)
      await expect(page.getByTestId('structured-status')).toHaveText('Diluluskan')
      await expect(page.getByTestId('structured-subs-heading')).toContainText('Sub-Soalan (')
      await expect(page.getByTestId('structured-sub').first()).toContainText('Skema Jawapan')
      await expect(page.getByTestId('structured-id')).toHaveCount(0)
      await expectTouchTarget(page.getByTestId('structured-back'))
      await expectNoHorizontalScroll(page)
      await page.getByTestId('structured-back').click()
      await expect(page).toHaveURL(/\/guru\/soalan-berstruktur$/)
    })
  },
)
