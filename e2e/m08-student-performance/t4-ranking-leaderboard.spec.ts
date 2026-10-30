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

test.describe('M08 S19 /ranking', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('admin@demo.test')
  })

  const hero = (page: import('@playwright/test').Page) => page.getByTestId('ranking-hero')
  const activePills = (page: import('@playwright/test').Page) =>
    page.locator('[data-testid=ranking-pills] a[data-active=true]')

  test('national: titles, pills, filters, three rows and footer', async ({ page, gotoApp }) => {
    await gotoApp('/ranking')
    await expect(page.getByTestId('ranking-row')).toHaveCount(3)
    await expectTabTitle(page, 'Kedudukan Nasional')
    await expect(page.getByTestId('shell-user-title')).toHaveText('Kedudukan')
    await expect(page.getByTestId('shell-user-subtitle')).toHaveText('Selamat datang kembali')
    await expect(hero(page).getByRole('heading', { name: 'Kedudukan' })).toBeVisible()
    await expect(page.getByTestId('ranking-subtitle')).toHaveText('Nasional')

    await expect(page.locator('[data-testid=ranking-pills] a')).toHaveText([
      'Nasional',
      'Negeri',
      'Daerah',
      'Sekolah',
    ])
    await expect(activePills(page)).toHaveText(['Nasional'])
    await expect(activePills(page)).toHaveClass(/bg-indigo-600/)

    const subjects = page.locator('[data-testid=ranking-subject] option')
    await expect(subjects).toHaveCount(32)
    await expect(subjects.first()).toHaveText('Semua Subjek')
    const names = await subjects.allTextContents()
    expect(names.slice(1)).toEqual([...names.slice(1)].sort((a, b) => a.localeCompare(b, 'ms')))
    await expect(page.locator('[data-testid=ranking-tingkatan] option')).toHaveText([
      'Semua',
      'Tingkatan 4',
      'Tingkatan 5',
    ])
    await expect(page.getByTestId('ranking-negeri')).toHaveCount(0)

    // SRS §6.10 anchors: all-subject figures in list order (Betul ascending, DV-26).
    expect(await texts(page.getByTestId('ranking-tahap'))).toEqual(['L8', 'L10', 'L10'])
    expect(await texts(page.getByTestId('ranking-betul'))).toEqual(['2,223', '5,293', '17,612'])
    expect(await texts(page.getByTestId('ranking-tepat'))).toEqual(['93.48%', '83.79%', '89.94%'])
    await expect(page.getByTestId('ranking-rank').first()).toHaveText('🥇')
    await expect(page.getByTestId('ranking-footer')).toHaveText('Menunjukkan 3 dari 3 pelajar')
    // Plain names: no link in the list, whatever the user id.
    await expect(page.locator('[data-testid=ranking-list] a')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('subject Matematik keeps subject_id on the pills and colours < 50 red', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/ranking')
    await expect(page.getByTestId('ranking-row')).toHaveCount(3)
    const matematik = await page
      .locator('[data-testid=ranking-subject] option', { hasText: 'Matematik' })
      .first()
      .getAttribute('value')
    expect(matematik).toBe('3')
    await page.getByTestId('ranking-subject').selectOption('3')
    await expect.poll(() => new URL(page.url()).searchParams.get('subject_id')).toBe('3')
    expect(new URL(page.url()).searchParams.get('scope')).toBe('nasional')
    await expect(page.getByTestId('ranking-betul').first()).toHaveText('128')

    expect(await texts(page.getByTestId('ranking-tahap'))).toEqual(['L4', 'L7', 'L8'])
    expect(await texts(page.getByTestId('ranking-betul'))).toEqual(['128', '530', '889'])
    expect(await texts(page.getByTestId('ranking-tepat'))).toEqual(['48.85%', '35.50%', '99.78%'])
    await expect(page.getByTestId('ranking-tepat').nth(0)).toHaveClass(/text-red-500/)
    await expect(page.getByTestId('ranking-tepat').nth(1)).toHaveClass(/text-red-500/)
    await expect(page.getByTestId('ranking-tepat').nth(2)).toHaveClass(/text-green-600/)
    await expect(page.getByTestId('ranking-footer')).toBeVisible()

    const hrefs = await page.locator('[data-testid=ranking-pills] a').evaluateAll((as) =>
      as.map((a) => {
        const u = new URL((a as HTMLAnchorElement).href)
        return [u.pathname, u.searchParams.get('subject_id'), u.searchParams.get('scope')]
      }),
    )
    expect(hrefs).toEqual([
      ['/ranking', '3', 'nasional'],
      ['/ranking', '3', 'negeri'],
      ['/ranking', '3', 'daerah'],
      ['/ranking', '3', 'sekolah'],
    ])
    await expectNoHorizontalScroll(page)
  })

  test('negeri scope: select shown, empty until a state is chosen, subtitle follows (DV-22)', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/ranking?scope=negeri')
    await expect(page.getByTestId('ranking-empty')).toBeVisible()
    await expectTabTitle(page, 'Kedudukan Negeri')
    await expect(page.getByTestId('ranking-subtitle')).toHaveText('Negeri')
    await expect(activePills(page)).toHaveText(['Negeri'])
    await expect(page.getByTestId('ranking-empty')).toContainText('Tiada data kedudukan')
    await expect(page.getByTestId('ranking-empty')).toContainText(
      'Mula menjawab soalan untuk muncul di papan kedudukan!',
    )
    await expect(page.getByTestId('ranking-start')).toHaveAttribute('href', '/practice')
    await expect(page.getByTestId('ranking-footer')).toHaveCount(0)
    await expect(page.locator('[data-testid=ranking-negeri] option')).toHaveText([
      'Pilih Negeri',
      'Selangor',
    ])

    await page.getByTestId('ranking-negeri').selectOption('Selangor')
    await expect(page.getByTestId('ranking-row')).toHaveCount(3)
    await expectTabTitle(page, 'Kedudukan Selangor')
    await expect(page.getByTestId('ranking-subtitle')).toHaveText('Selangor')
    // Footer only on the nasional scope.
    await expect(page.getByTestId('ranking-footer')).toHaveCount(0)
    expect(new URL(page.url()).searchParams.get('negeri')).toBe('Selangor')
    await expectNoHorizontalScroll(page)
  })

  test('daerah and sekolah scopes are empty for the admin', async ({ page, gotoApp }) => {
    test.slow()
    await gotoApp('/ranking?scope=daerah')
    await expect(page.getByTestId('ranking-empty')).toBeVisible()
    await expectTabTitle(page, 'Kedudukan Daerah')
    await expect(page.getByTestId('ranking-negeri')).toBeVisible()
    await expect(activePills(page)).toHaveText(['Daerah'])

    await gotoApp('/ranking?scope=daerah&negeri=Selangor')
    await expect(page.getByTestId('ranking-empty')).toBeVisible()
    await expect(page.getByTestId('ranking-subtitle')).toHaveText('Daerah')

    await gotoApp('/ranking?scope=sekolah')
    await expect(page.getByTestId('ranking-empty')).toBeVisible()
    await expectTabTitle(page, 'Kedudukan Sekolah')
    await expect(page.getByTestId('ranking-negeri')).toHaveCount(0)
    await expect(activePills(page)).toHaveText(['Sekolah'])
    await expectNoHorizontalScroll(page)
  })

  test('tingkatan T4 is empty; an unknown scope ranks nationally with no pill and no footer', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/ranking?scope=nasional&tingkatan=T4')
    await expect(page.getByTestId('ranking-empty')).toBeVisible()
    await expect(page.getByTestId('ranking-tingkatan')).toHaveValue('T4')

    await gotoApp('/ranking?scope=xyz')
    await expect(page.getByTestId('ranking-row')).toHaveCount(3)
    await expect(activePills(page)).toHaveCount(0)
    await expect(page.getByTestId('ranking-footer')).toHaveCount(0)
    await expectTabTitle(page, 'Kedudukan Nasional')
    await expect(page.getByTestId('ranking-subtitle')).toHaveText('Nasional')
  })

  test('layout at the project width: pills scroll inside their row, no page scroll', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/ranking')
    await expect(page.getByTestId('ranking-row')).toHaveCount(3)
    const pills = page.getByTestId('ranking-pills')
    const [scrollWidth, clientWidth] = await pills.evaluate((el) => [
      el.scrollWidth,
      el.clientWidth,
    ])
    if (viewportWidth(page) < 640) expect(scrollWidth).toBeGreaterThan(clientWidth)
    else expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 8)
    // Every pill is a 44px touch target.
    for (const box of await page
      .locator('[data-testid=ranking-pills] a')
      .evaluateAll((as) => as.map((a) => a.getBoundingClientRect().height))) {
      expect(box).toBeGreaterThanOrEqual(44)
    }
    await expectNoHorizontalScroll(page)
  })
})

test.describe('M08 S20 /leaderboard', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  const rowsOf = (page: import('@playwright/test').Page) => page.getByTestId('leaderboard-row')
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
          await expect(page.getByTestId('shell-user-title')).toHaveText('Papan Pendahulu')
          await expect(page.getByTestId('shell-user-subtitle')).toHaveText(
            'Siapa juara minggu ini?',
          )
          await expect(page.getByTestId('leaderboard-hero')).toContainText(
            'Siapa juara minggu ini?',
          )
          await expect(page.locator('[data-testid=leaderboard-tabs] a')).toHaveText([
            'Semua Masa',
            'Minggu Ini',
            'Bulan Ini',
          ])
          await expect(activeTab(page)).toHaveText(['Minggu Ini'])

          await expect(page.getByTestId('me-rank')).toHaveText('#-')
          await expect(page.getByTestId('me-coins')).toHaveText('0')
          await expect(page.getByTestId('me-sessions')).toHaveText('0')
          await expect(page.getByTestId('me-accuracy')).toHaveText('0%')

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
      await expect(page.getByTestId('me-rank')).toHaveText('#1050')
      await expect(page.getByTestId('me-coins')).toHaveText('26')
      await expect(page.getByTestId('me-sessions')).toHaveText('4')
      await expect(page.getByTestId('me-accuracy')).toHaveText('22%')
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
      await expect(page.getByTestId('me-rank')).toHaveText('#-')
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
      // The hero text stays for every period.
      await expect(page.getByTestId('leaderboard-hero')).toContainText('Siapa juara minggu ini?')
      await expect(page.getByTestId('shell-user-subtitle')).toHaveText('Siapa juara minggu ini?')
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
      await expect(page.getByTestId('me-rank')).toHaveText('#1050')
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
      await expect(pills.nth(0)).toHaveClass(/bg-green-100/)
      await expect(pills.nth(3)).toHaveClass(/bg-amber-100/)
      // Rank circles.
      await expect(page.getByTestId('row-rank').nth(0)).toHaveClass(/bg-amber-100/)
      await expect(page.getByTestId('row-rank').nth(1)).toHaveClass(/bg-slate-200/)
      await expect(page.getByTestId('row-rank').nth(2)).toHaveClass(/bg-orange-100/)
      await expect(page.getByTestId('row-rank').nth(3)).toHaveClass(/bg-slate-50/)

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
        await expect(page.getByTestId('me-rank')).toHaveText('#39')
        await expect(page.getByTestId('me-coins')).toHaveText('70')
        await expect(page.getByTestId('me-sessions')).toHaveText('4')
        await expect(page.getByTestId('me-accuracy')).toHaveText('65%')
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

    test('S19 is open to every role: the same national list', async ({ page, gotoApp }) => {
      await gotoApp('/ranking')
      await expect(page.getByTestId('ranking-row')).toHaveCount(3)
      await expect(page.getByTestId('ranking-footer')).toHaveText('Menunjukkan 3 dari 3 pelajar')
      await expectNoHorizontalScroll(page)
    })
  })
})
