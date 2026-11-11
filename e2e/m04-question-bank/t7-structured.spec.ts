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
  isDesktopShell,
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
  return page.getByTestId('structured-table').locator('tbody tr')
}

function pager(page: Page) {
  return page.getByRole('navigation', { name: 'Pagination Navigation' })
}

async function openList(page: Page, gotoApp: (path: string) => Promise<void>, path = LIST) {
  await gotoApp(path)
  await expect(rows(page).first()).toBeVisible()
}

// PO decision: /admin/structured-questions stays retired (routes/structured.ts:11-21); the admin list of structured
// questions is the Subjektif lane (/admin/spm/subjektif) and its editor "Skema & Rubrik" (.../:id/sunting).
const SUBJEKTIF = '/admin/spm/subjektif'
const editorOf = (id: number | string) => `${SUBJEKTIF}/${String(id)}/sunting`

function laneRows(page: Page) {
  return page.getByTestId('lane-subjektif').locator('tbody tr, [data-ds=data-table-cards] > li')
}

async function openLane(page: Page, gotoApp: (path: string) => Promise<void>, path = SUBJEKTIF) {
  await gotoApp(path)
  await expect(laneRows(page).first()).toBeVisible()
}

test.describe('M04 S8 retired route', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('/admin/structured-questions redirects to the Subjektif lane (PO: Bank Lama retired)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(LIST)
    await expect(page).toHaveURL(new RegExp(`${SUBJEKTIF}$`))
    await expect(page.getByTestId('lane-subjektif')).toBeVisible()
    await expect(page.getByTestId('structured-page')).toHaveCount(0)
  })

  test('/admin/structured-questions/:id redirects to the Subjektif editor of that question', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${LIST}/4454`)
    await expect(page).toHaveURL(new RegExp(`${editorOf(4454)}$`))
    await expect(page.getByTestId('rubric-page')).toBeVisible()
    await expect(page.getByTestId('structured-detail')).toHaveCount(0)
  })
})

test.describe('M04 S8 Subjektif lane (admin list of structured questions)', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('header, filter bar, rows and pager at every width', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await openLane(page, gotoApp)
    // Was 'Soalan Berstruktur' (S8); the lane title and subtitle are the route meta (routes/admin-kandungan.ts:31-35, R1-ADM-Q-23); the shell adds ' | PRESTASIPLUS'.
    await expectTabTitle(page, 'Subjektif | PRESTASIPLUS')
    await expect(page.getByTestId('pentadbiran-header').getByRole('heading', { level: 1 })).toHaveText('Subjektif')
    await expect(page.getByTestId('pentadbiran-subtitle')).toHaveText('Soalan berstruktur dan esei.')
    // C-60: the lane reads the m04 structured store: 4,064 questions (the S8 anchor 'Jumlah Soalan'), 25 per page, newest first.
    await expect(page.getByTestId('lane-count')).toHaveText('4,064 item ·')
    await expect(page.getByTestId('lane-back')).toHaveText('← Semua laluan SPM')

    // Filters: Subjek, Status (Subjektif has its own list), Cari, Tapis / Set Semula.
    // Source rule: mock handlers/servability-lanes.ts:82-86 (active M03 subjects ordered by sort_order, data/curriculum.json subjects[].sort_order 1..31); http servability.controller.ts:104.
    await expect(page.getByTestId('lane-subject').locator('option')).toHaveText([
      'Semua Subjek',
      'Bahasa Melayu',
      'Bahasa Inggeris',
      'Matematik',
      'Sains',
      'Sejarah',
      'Pendidikan Islam',
      'Pendidikan Moral',
      'Matematik Tambahan',
      'Fizik',
      'Kimia',
      'Biologi',
      'Geografi',
      'Pendidikan Seni Visual',
      'Pendidikan Muzik',
      'Pendidikan Jasmani & Kesihatan',
      'Reka Bentuk & Teknologi',
      'Sains Komputer',
      'Bahasa Arab',
      'Bahasa Cina',
      'Bahasa Tamil',
      'Prinsip Perakaunan',
      'Ekonomi',
      'Perniagaan',
      'Pendidikan Al-Quran & As-Sunnah',
      'Tasawwur Islam',
      'Jawi',
      'Pendidikan Syariah Islamiah',
      'Sains Rumah Tangga',
      'Pembuatan Pakaian Wanita',
      'Pertanian',
      'Sains Sukan',
    ])
    await expect(page.getByTestId('lane-status').locator('option')).toHaveText([
      'Semua Status',
      'Draf',
      'Menunggu Semakan',
      'Diluluskan',
      'Diarkibkan',
    ])
    await expect(page.getByTestId('lane-search')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tapis', exact: true })).toBeVisible()

    // Rows: Senarai (number), Tajuk, Status, Perhatian, Tindakan with one Sunting action.
    await expect(laneRows(page)).toHaveCount(25)
    const first = laneRows(page).first()
    await expect(first).toContainText('#4456 · Perniagaan · Tingkatan 5')
    await expect(first.getByRole('link', { name: 'Sunting' })).toHaveAttribute('href', '/admin/spm/subjektif/4456/sunting')
    // Staff page (admin): 44 px below lg, 40 from lg (C-16).
    if (!isDesktopShell(page)) await expectTouchTarget(first.getByRole('link', { name: 'Sunting' }))
    await expect(page.locator('[data-ds="data-table-pager"]')).toContainText('Menunjukkan 1-25 daripada 4064 hasil')
    await expectNoHorizontalScroll(page)
  })

  test('the hub card total equals the lane total (C-60)', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/spm')
    await expect(page.getByTestId('kandungan-card-subjektif')).toContainText('4,064')
  })

  test('searching a stimulus lists its questions newest first; 4454 is among them', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await openLane(page, gotoApp)
    await page.getByTestId('lane-search').fill('Baca situasi perniagaan')
    await page.getByRole('button', { name: 'Tapis', exact: true }).click()
    // 763 = the Perniagaan structured questions of the dataset (the V2 'Perniagaan: 763' anchor of the old S8 pills).
    await expect(page.getByTestId('lane-count')).toHaveText('763 item ·')
    await expect(laneRows(page).nth(2).getByRole('link', { name: 'Sunting' })).toHaveAttribute('href', editorOf(4454))
  })

  test('a search with no match shows the empty row; Set Semula returns the list', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openLane(page, gotoApp)
    await page.getByTestId('lane-search').fill('zzqxv')
    await page.getByRole('button', { name: 'Tapis', exact: true }).click()
    await expect(page.getByText('Tiada item untuk penapis ini.')).toBeVisible()
    await expectNoHorizontalScroll(page)
    await page.getByRole('button', { name: 'Set Semula' }).first().click()
    await expect(laneRows(page).first()).toBeVisible()
    await expect(page.getByText('Tiada item untuk penapis ini.')).toHaveCount(0)
  })

  test('the Sunting action opens the Skema & Rubrik editor of that row', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await openLane(page, gotoApp)
    const link = laneRows(page).first().getByRole('link', { name: 'Sunting' })
    const href = await link.getAttribute('href')
    await link.click()
    await expect(page).toHaveURL(new RegExp(`${href}$`))
    await expect(page.getByTestId('rubric-page')).toBeVisible()
    await page.getByTestId('rubric-back').click()
    await expect(page).toHaveURL(new RegExp(`${SUBJEKTIF}$`))
  })
})

test.describe('M04 S9 Subjektif editor (Skema & Rubrik)', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('the observed question 4454 shows its header, its part and the scheme editor', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(editorOf(4454))
    await expectTabTitle(page, 'Sunting Subjektif | PRESTASIPLUS')
    await expect(page.getByTestId('rubric-header')).toContainText('Skema & Rubrik Pemarkahan')
    await expect(page.getByTestId('rubric-meta')).toHaveText('Soalan #4454 · Perniagaan · Tingkatan 5 · 8 markah')
    await expect(page.getByTestId('rubric-status')).toHaveText('Diluluskan')
    await expect(page.getByTestId('rubric-stimulus')).toContainText('Soalan Oleh:')
    await expect(page.getByTestId('rubric-sub')).toHaveCount(1)
    await expect(page.getByTestId('rubric-sub-number')).toHaveText(['a'])
    await expect(page.getByTestId('rubric-sub').first()).toContainText('8m')
    await expect(page.getByText('Skema (ayat penuh)')).toBeVisible()
    await expect(page.getByText('Poin Rubrik')).toBeVisible()
    await expect(page.getByTestId('rubric-save')).toHaveText('Simpan Skema & Rubrik')
    await expectTouchTarget(page.getByTestId('rubric-back'))
    await expect(page.getByTestId('rubric-back')).toHaveAttribute('href', SUBJEKTIF)
    await expect(page.locator('a[href*="soalan-berstruktur"]')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('the observed question 3698 shows its marks and three parts', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp(editorOf(3698))
    await expect(page.getByTestId('rubric-meta')).toHaveText('Soalan #3698 · Sejarah · Tingkatan 5 · 10 markah')
    await expect(page.getByTestId('rubric-sub')).toHaveCount(3)
    await expect(page.getByTestId('rubric-sub-number')).toHaveText(['a', 'b', 'c'])
    await expectNoHorizontalScroll(page)
  })

  test('an unknown id shows the standard 404 page', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp(editorOf(99999999))
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
      await expect(
        page.getByTestId('pembelajaran-header').getByRole('heading', { level: 1 }),
      ).toHaveText('Soalan Berstruktur')
      await expect(page.getByTestId('structured-page')).toContainText(
        'Cipta & urus soalan berstruktur mengikut piawaian SPM KPM',
      )
      await expect(page.getByTestId('structured-page')).toContainText('soalan dalam bank')
      await expect(rows(page)).toHaveCount(20)
      await expect(page.getByTestId('structured-add')).toHaveCount(0)
      await expect(page.getByTestId('structured-stat-total')).toHaveCount(0)
      await expect(page.getByTestId('structured-counter')).toHaveText(
        /^Menunjukkan 1 hingga 20 daripada [\d,]+ keputusan$/,
      )
      await expect(page.getByTestId('structured-pager')).toContainText('Seterusnya')
      await expect(page.getByTestId('structured-status').locator('option')).toHaveText([
        'Semua',
        'Diluluskan',
        'Menunggu Semakan',
      ])
      const submit = page.getByTestId('structured-filter').locator('button[type=submit]')
      await expect(submit).toHaveText('Tapis')
      await expect
        .poll(async () => (await submit.boundingBox())?.height ?? 0)
        .toBeGreaterThanOrEqual(44)
      await expectTouchTarget(submit)
      // Teacher mount is a staff page (data-personality staff): 44 px below lg, 40 from lg (C-16); the eye link is 40 at 1280.
      if (!isDesktopShell(page)) await expectTouchTarget(rows(page).first().getByTestId('structured-view'))
      // 44 px on touch viewports (C-16: 44 below lg, 40 from lg); the 1280 desktop is not touch-checked.
      const next = page.getByTestId('structured-pager').getByRole('button', { name: 'Seterusnya' })
      if (!isDesktopShell(page)) await expectTouchTarget(next)
      else await expect(next).toBeVisible()
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
      await expect(rows(page).first().getByTestId('structured-status-chip')).toHaveText(
        'Menunggu Semakan',
      )
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
