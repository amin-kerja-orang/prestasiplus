/**
 * M08-T4 developer E2E (build-plan M08-T4; QA writes the final E2E-M08-* at G5): S19 `/ranking`
 * "Kedudukan" and S20 `/leaderboard` "Papan Pendahulu" as the demo admin and the demo pelajar at
 * 375 / 768 / 1280 — scopes, filters and periods, the §6.10 anchors (S20 week 46 participants and
 * the pelajar at #39; admin #1050 all-time with 26 / 4 / 22%), titles, responsive columns and no
 * horizontal page scroll.
 */

import type { Locator } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'

const texts = async (l: Locator) => (await l.allTextContents()).map((t) => t.trim())

// S19 was rebuilt as the V2 Kedudukan (R1-MUR-18, T-C14): rank cards by syiling and "Sekitar anda";
// the V3-only filters, scope pills and table are gone and the page has no query string (FR-MUR-18-6).
test.describe('M08 S19 /ranking', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('pupil: title, syiling line, rank cards, Sekitar anda and the board link', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/ranking')
    await expectTabTitle(page, 'Kedudukan | PRESTASIPLUS')
    await expect(page.getByRole('heading', { level: 1, name: 'Kedudukan' })).toBeVisible()
    await expect(page.getByTestId('pembelajaran-subtitle')).toHaveText('Di mana anda berdiri — dalam kelas, sekolah, negeri dan seluruh negara')
    await expect(page.getByTestId('ranking-syiling')).toContainText('Syiling anda')
    await expect(page.getByTestId('ranking-syiling')).toContainText(
      'Kedudukan dikira berdasarkan baki syiling.',
    )
    await expect(page.getByTestId('ranking-cards')).toBeVisible()
    await expect(page.getByTestId('ranking-card-kebangsaan')).toContainText('Kebangsaan')
    await expect(page.getByTestId('ranking-card-sekolah')).toContainText('Dalam sekolah')
    await expect(page.getByTestId('ranking-nearby')).toContainText('Sekitar anda')
    // No filters, no pills, no query string.
    await expect(page.getByTestId('ranking-pills')).toHaveCount(0)
    await expect(page.getByTestId('ranking-subject')).toHaveCount(0)
    const board = page.getByTestId('ranking-full-board')
    await expect(board).toContainText('Lihat papan pendahulu penuh')
    await expect(board).toHaveAttribute('href', '/leaderboard')
    expect(new URL(page.url()).search).toBe('')
    await expectNoHorizontalScroll(page)
  })

  test('a query string is ignored: the same page, no pill and no filter (FR-MUR-18-6)', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/ranking?scope=negeri&subject_id=3')
    await expect(page.getByTestId('ranking-cards')).toBeVisible()
    await expect(page.getByTestId('ranking-pills')).toHaveCount(0)
    await expect(page.getByTestId('ranking-subject')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('admin has no class or school: the empty state "Kedudukan belum tersedia"', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/ranking')
    await expect(page.getByTestId('ranking-empty')).toContainText('Kedudukan belum tersedia')
    await expect(page.getByTestId('ranking-empty')).toContainText(
      'Akaun anda belum dikaitkan dengan sekolah atau kelas.',
    )
    await expect(page.getByTestId('ranking-cards')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })
})

test.describe('M08 S20 /leaderboard', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  const rowsOf = (page: import('@playwright/test').Page) =>
    page.locator(
      '[data-testid=leaderboard-table] tbody tr, [data-testid=leaderboard-table] [data-ds=data-table-cards] > li',
    )
  const podiumText = async (page: import('@playwright/test').Page, selector: string) =>
    (await page.locator(`[data-testid=podium] ${selector}`).allTextContents()).map((t) => t.trim())
  const activeTab = (page: import('@playwright/test').Page) =>
    page.locator('[data-testid=leaderboard-tabs] a[data-active=true]')

  test.describe('as admin', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin@demo.test')
    })

    for (const url of ['/leaderboard', '/leaderboard?period=xyz']) {
      test(`week (${url}): own card, podium, 46 rows, footer`, async ({ page, gotoApp }) => {
        {
          await gotoApp(url)
          await expect(rowsOf(page)).toHaveCount(46)
          await expectTabTitle(page, 'Papan Pendahulu | PRESTASIPLUS')
          await expect(page.locator('[data-testid=pentadbiran-header] :is(h1, [data-testid=shell-title])')).toHaveText('Papan Pendahulu')
          await expect(page.getByTestId('pentadbiran-subtitle')).toHaveText(
            'Kedudukan pelajar terbaik mengikut syiling',
          )
          // V2 pelajar/leaderboard.blade.php:53-62 hero banner (title + tagline); restored by C-28 fa26c0da9, subtitle per C-29.
          await expect(page.getByTestId('leaderboard-hero')).toContainText('Papan Pendahulu')
          await expect(page.getByTestId('leaderboard-hero')).toContainText('Siapa kumpul syiling paling banyak?')
          await expect(page.locator('[data-testid=leaderboard-tabs] a')).toHaveText([
            'Semua Masa',
            'Minggu Ini',
            'Bulan Ini',
          ])
          await expect(activeTab(page)).toHaveText(['Minggu Ini'])

          await expect(page.getByTestId('me-rank')).toContainText('#-')
          await expect(page.getByTestId('me-coins')).toHaveText('0Syiling')
          await expect(page.getByTestId('me-sessions')).toHaveText('0Sesi')
          await expect(page.getByTestId('me-accuracy')).toHaveText('0%Ketepatan')

          // Visual order 2-1-3: accuracies 89 / 98 / 99, coins 1,215 / 1,547 / 787.
          expect(await podiumText(page, '[data-testid=podium-accuracy]')).toEqual([
            '89% ketepatan',
            '98% ketepatan',
            '99% ketepatan',
          ])
          expect(await podiumText(page, '[data-testid=podium-coins]')).toEqual([
            '1,215',
            '1,547',
            '787',
          ])
          expect(await podiumText(page, '[data-testid=podium-base]')).toEqual(['2', '1', '3'])
          await expect(page.getByTestId('podium-1')).toContainText('👑')
          expect((await texts(page.getByTestId('row-accuracy'))).slice(0, 5)).toEqual([
            '98%',
            '89%',
            '99%',
            '68%',
            '100%',
          ])
          await expect(page.getByTestId('participants')).toHaveText('46')
          await expect(page.getByTestId('leaderboard-footer')).toContainText('46 peserta bersaing')
          // Headers are not upper case (text-transform).
          const transform = await page
            .locator('[data-testid=leaderboard-table] thead th')
            .first()
            .evaluate((el) => getComputedStyle(el).textTransform)
          expect(transform).toBe('none')
          await expect(page.locator('[data-testid=leaderboard-table] a')).toHaveCount(0)
          await expectNoHorizontalScroll(page)
        }
      })
    }

    test('all time: #1050 with 26 / 4 / 22%, capped podium, 50 rows', async ({ page, gotoApp }) => {
      await gotoApp('/leaderboard?period=all')
      await expect(rowsOf(page)).toHaveCount(50)
      await expect(activeTab(page)).toHaveText(['Semua Masa'])
      await expect(page.getByTestId('me-rank')).toContainText('#1050')
      await expect(page.getByTestId('me-coins')).toHaveText('26Syiling')
      await expect(page.getByTestId('me-sessions')).toHaveText('4Sesi')
      await expect(page.getByTestId('me-accuracy')).toHaveText('22%Ketepatan')
      // The live 101% is shown capped (DV-07, FR-M08-124).
      expect(await podiumText(page, '[data-testid=podium-accuracy]')).toEqual([
        '100% ketepatan',
        '88% ketepatan',
        '93% ketepatan',
      ])
      expect(await podiumText(page, '[data-testid=podium-coins]')).toEqual([
        '30,510',
        '64,689',
        '25,736',
      ])
      expect((await texts(page.getByTestId('row-accuracy'))).slice(0, 5)).toEqual([
        '88%',
        '100%',
        '93%',
        '98%',
        '84%',
      ])
      await expect(page.getByTestId('leaderboard-footer')).toContainText('50 peserta bersaing')
      await expectNoHorizontalScroll(page)
    })

    test('month: podium, "#-" and 50 rows', async ({ page, gotoApp }) => {
      await gotoApp('/leaderboard?period=month')
      await expect(rowsOf(page)).toHaveCount(50)
      await expect(activeTab(page)).toHaveText(['Bulan Ini'])
      await expect(page.getByTestId('me-rank')).toContainText('#-')
      expect(await podiumText(page, '[data-testid=podium-accuracy]')).toEqual([
        '99% ketepatan',
        '94% ketepatan',
        '85% ketepatan',
      ])
      expect(await podiumText(page, '[data-testid=podium-coins]')).toEqual([
        '3,363',
        '5,199',
        '2,999',
      ])
      expect((await texts(page.getByTestId('row-accuracy'))).slice(0, 5)).toEqual([
        '94%',
        '99%',
        '85%',
        '79%',
        '98%',
      ])
      await expect(page.getByTestId('leaderboard-footer')).toContainText('50 peserta bersaing')
      // The hero text stays for every period (V2 hero banner, see above).
      await expect(page.getByTestId('leaderboard-hero')).toContainText('Siapa kumpul syiling paling banyak?')
      await expect(page.getByTestId('pentadbiran-subtitle')).toHaveText('Kedudukan pelajar terbaik mengikut syiling')
      await expectNoHorizontalScroll(page)
    })

    test('period links navigate and keep one list', async ({ page, gotoApp }) => {
      await gotoApp('/leaderboard')
      await expect(rowsOf(page)).toHaveCount(46)
      await page.getByTestId('leaderboard-tab-month').click()
      await expect(page).toHaveURL(/period=month/)
      await expect(activeTab(page)).toHaveText(['Bulan Ini'])
      await expect(rowsOf(page)).toHaveCount(50)
      await page.getByTestId('leaderboard-tab-all').click()
      await expect(page).toHaveURL(/period=all/)
      await expect(page.getByTestId('me-rank')).toContainText('#1050')
    })

    test('responsive columns and pill colours; the podium fits (DV-10)', async ({
      page,
      gotoApp,
    }) => {
      await gotoApp('/leaderboard')
      await expect(rowsOf(page)).toHaveCount(46)
      const width = viewportWidth(page)
      const head = page.locator('[data-testid=leaderboard-table] thead th')
      await expect(head.nth(0)).toBeVisible()
      await expect(head.nth(1)).toBeVisible()
      await expect(head.nth(2)).toBeVisible()
      if (width >= 768) await expect(head.nth(3)).toBeVisible()
      else await expect(head.nth(3)).toBeHidden()
      if (width >= 1024) await expect(head.nth(4)).toBeVisible()
      else await expect(head.nth(4)).toBeHidden()
      // "Dikemaskini real-time" from 768px.
      const live = page.getByText('Dikemaskini real-time')
      if (width >= 768) await expect(live).toBeVisible()
      else await expect(live).toBeHidden()

      // Pill thresholds on the unrounded value: 98 green, 68 amber, 100 green.
      const pills = page.getByTestId('row-accuracy')
      await expect(pills.nth(0)).toHaveClass(/bg-success/)
      await expect(pills.nth(3)).toHaveClass(/bg-warning/)
      // Rank circles.
      await expect(page.getByTestId('row-rank').nth(0)).toHaveClass(/bg-primary/)
      await expect(page.getByTestId('row-rank').nth(1)).toHaveClass(/bg-primary/)
      await expect(page.getByTestId('row-rank').nth(2)).toHaveClass(/bg-primary/)
      await expect(page.getByTestId('row-rank').nth(3)).not.toHaveClass(/bg-primary/)

      // The podium columns stay inside the viewport.
      const boxes = await page
        .locator('[data-testid=podium] > div')
        .evaluateAll((els) => els.map((e) => e.getBoundingClientRect()))
      expect(boxes).toHaveLength(3)
      for (const b of boxes) {
        expect(b.left).toBeGreaterThanOrEqual(0)
        expect(b.right).toBeLessThanOrEqual(width)
      }
      await expectNoHorizontalScroll(page)
    })
  })

  test.describe('as pelajar', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('pelajar@demo.test')
    })

    test(
      'week: #39 with 70 / 4 / 65%, the same 46 rows with the pelajar at row 39',
      provisional('membership rule of the shared list (SRS E2E-M08-56)'),
      async ({ page, gotoApp }) => {
        await gotoApp('/leaderboard')
        await expect(rowsOf(page)).toHaveCount(46)
        await expect(page.getByTestId('me-rank')).toContainText('#39')
        await expect(page.getByTestId('me-coins')).toHaveText('70Syiling')
        await expect(page.getByTestId('me-sessions')).toHaveText('4Sesi')
        await expect(page.getByTestId('me-accuracy')).toHaveText('65%Ketepatan')
        await expect(rowsOf(page).nth(38).getByTestId('row-name')).toHaveText('Pelajar Demo')
        await expect(page.getByTestId('participants')).toHaveText('46')
        expect((await texts(page.getByTestId('row-accuracy'))).slice(0, 5)).toEqual([
          '98%',
          '89%',
          '99%',
          '68%',
          '100%',
        ])
        await expectNoHorizontalScroll(page)
      },
    )

    test('S19 is open to the pupil: rank cards and the Sekitar anda neighbours (the old 3-row national list is gone)', async ({ page, gotoApp }) => {
      await gotoApp('/ranking')
      await expect(page.getByTestId('ranking-cards')).toBeVisible()
      await expect(page.getByTestId('ranking-nearby-row').first()).toBeVisible()
      await expectNoHorizontalScroll(page)
    })
  })
})
