/**
 * M05-T3 developer smoke: S1 `/dashboard` (SRS M05 §12 rows 1-15) as admin, pelajarmaju (subscriber
 * with quest progress), pelajar2 (nothing seeded) and a teacher at 375 / 768 / 1280. Counts that
 * come from the M04 dataset are read from the page, not hard-coded, where the SRS says so.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  isDesktopShell,
  moduleTag,
  TAG,
  viewportWidth,
} from '../support'

const ADMIN = 'admin@demo.test'
const MAJU = 'pelajarmaju@demo.test'
const PELAJAR2 = 'pelajar2@demo.test'
const GURU = 'guru@demo.test'

const tid = (page: Page, id: string) => page.getByTestId(id)

async function openDashboard(
  page: Page,
  loginAs: (who: string) => Promise<unknown>,
  gotoApp: (path: string) => Promise<void>,
  who: string,
): Promise<void> {
  await loginAs(who)
  await gotoApp('/dashboard')
  await expect(tid(page, 'dash-greeting')).toBeVisible()
}

test.describe('M05 S1 dashboard smoke', { tag: [TAG.smoke, moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('admin: header, greeting, trial, Kombo, quick actions and the responsive layout', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await openDashboard(page, loginAs, gotoApp, ADMIN)
    await expectTabTitle(page, 'Dashboard - PRESTASIPLUS')
    await expect(tid(page, 'shell-user-title')).toHaveText('Dashboard')
    await expect(tid(page, 'shell-user-subtitle')).toHaveText('Selamat datang kembali')
    await expect(tid(page, 'dash-greeting')).toHaveText(/^Selamat Petang, .+ 👋$/)
    await expect(tid(page, 'dash-greeting-line')).toHaveText('Jom teruskan latihan hari ini! 🚀')

    // FR-M05-02: the cap is shown from 768 px.
    if (viewportWidth(page) < 768) {
      await expect(tid(page, 'dash-hero-cap')).toBeHidden()
    } else {
      await expect(tid(page, 'dash-hero-cap')).toBeVisible()
    }

    await expect(tid(page, 'dash-trial-remaining')).toHaveText('Baki 0 / 50 soalan')
    await expect(tid(page, 'dash-trial')).toContainText('Percubaan Percuma')
    await expect(tid(page, 'dash-trial-link')).toHaveAttribute('href', '/pricing')
    await expect(tid(page, 'dash-kombo')).toContainText('Kombo 1 hari akan putus!')
    await expect(tid(page, 'dash-kombo-link')).toHaveAttribute('href', '/practice')

    await expect(tid(page, 'dash-quick-admin')).toHaveAttribute('href', '/admin')
    await expect(tid(page, 'dash-revision-badge')).toHaveText('72')
    await expect(tid(page, 'dash-badges-empty')).toContainText('Belum Ada Lencana Lagi!')

    // FR-M05-17: 2 columns at 375, 5 across from 768.
    const cols = await tid(page, 'dash-quick').evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
    )
    expect(cols).toBe(viewportWidth(page) >= 768 ? 5 : 2)

    // FR-M05-22: the aside only from 1024 px.
    if (isDesktopShell(page)) {
      await expect(tid(page, 'dashboard-aside')).toBeVisible()
      await expect(tid(page, 'dash-aside')).toContainText('Artikel Terkini')
      await expect(tid(page, 'dash-aside-all')).toHaveAttribute('href', '/artikel')
    } else {
      await expect(tid(page, 'dashboard-aside')).toBeHidden()
    }
    await expectNoHorizontalScroll(page)
  })

  test('counters count up from 0 (admin 256 / 8 / 1 / 0 / 0%)', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await openDashboard(page, loginAs, gotoApp, ADMIN)
    const stat = (id: string) => tid(page, id).getByTestId('dash-stat-value')
    await mock.advanceTime(2500)
    await expect(stat('dash-stat-coins')).toHaveText('256')
    await expect(stat('dash-stat-points')).toHaveText('8')
    await expect(tid(page, 'dash-stat-points')).toContainText('Mata (Lvl 2)')
    await expect(stat('dash-stat-streak')).toHaveText('1')
    await expect(stat('dash-stat-sessions')).toHaveText('0')
    await expect(stat('dash-stat-accuracy')).toHaveText('0%')
    await expect(tid(page, 'dash-platform-total').getByTestId('dash-platform-value')).toHaveText(
      '130152',
    )
    await expect(tid(page, 'dash-platform-approved').getByTestId('dash-platform-value')).toHaveText(
      '129752',
    )
    await expect(tid(page, 'dash-platform-subjects').getByTestId('dash-platform-value')).toHaveText(
      '31',
    )
    await expect(tid(page, 'dash-platform-levels').getByTestId('dash-platform-value')).toHaveText(
      '11',
    )
    await expectNoHorizontalScroll(page)
  })

  test('pelajarmaju: subscriber, wallet stats and quest progress 4 / 10', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await openDashboard(page, loginAs, gotoApp, MAJU)
    await expect(tid(page, 'dash-trial')).toHaveCount(0)
    await expect(tid(page, 'dash-kombo')).toHaveCount(0)
    await expect(tid(page, 'dash-quick-admin')).toHaveCount(0)
    await mock.advanceTime(2500)
    const stat = (id: string) => tid(page, id).getByTestId('dash-stat-value')
    await expect(stat('dash-stat-coins')).toHaveText('267')
    await expect(stat('dash-stat-points')).toHaveText('432')
    await expect(tid(page, 'dash-stat-points')).toContainText('Mata (Lvl 3)')
    await expect(tid(page, 'dash-level-bar')).toHaveAttribute('style', /width: 100%/)
    await expect(stat('dash-stat-streak')).toHaveText('3')
    await expect(stat('dash-stat-sessions')).toHaveText('4')
    await expect(stat('dash-stat-accuracy')).toHaveText('70%')

    await expect(tid(page, 'dash-quest')).toHaveCount(10)
    await expect(tid(page, 'dash-quest-done')).toHaveText('4')
    await expect(tid(page, 'dash-chest')).toContainText(
      'Selesaikan 6 lagi misi untuk buka peti! 🔒',
    )
    await expect(tid(page, 'dash-quest-progress').first()).toContainText('2/3')
    await expectNoHorizontalScroll(page)
  })

  test('pelajar2: trial 50 / 50, no Kombo, no revision badge, "Hari Berturut" 0', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await openDashboard(page, loginAs, gotoApp, PELAJAR2)
    await expect(tid(page, 'dash-trial-remaining')).toHaveText('Baki 50 / 50 soalan')
    await expect(tid(page, 'dash-kombo')).toHaveCount(0)
    await expect(tid(page, 'dash-revision-badge')).toHaveCount(0)
    await mock.advanceTime(2500)
    await expect(tid(page, 'dash-stat-streak').getByTestId('dash-stat-value')).toHaveText('0')
    await expect(tid(page, 'dash-chest')).toContainText(
      'Selesaikan 10 lagi misi untuk buka peti! 🔒',
    )
    await expectNoHorizontalScroll(page)
  })

  for (const [now, word] of [
    ['2026-09-25T09:00:00+08:00', 'Pagi'],
    ['2026-09-25T13:00:00+08:00', 'Tengah Hari'],
    ['2026-09-25T20:00:00+08:00', 'Malam'],
  ] as const) {
    test.describe(`clock ${word}`, () => {
      test.use({ mockInit: { latency: 0, now } })

      test(`greeting reads "${word}" at ${now}`, async ({ page, loginAs, gotoApp }) => {
        await openDashboard(page, loginAs, gotoApp, PELAJAR2)
        await expect(tid(page, 'dash-greeting')).toContainText(`Selamat ${word},`)
      })
    })
  }

  test('carousel: arrows, dots, per-slide toggle and autoplay with pause', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await openDashboard(page, loginAs, gotoApp, PELAJAR2)
    const counter = tid(page, 'dash-counter')
    await expect(counter).toHaveText('1 / 5')
    await expect(tid(page, 'dash-slide-0')).toContainText('Selamat Datang ke PRESTASIPLUS')
    await expect(tid(page, 'dash-slide-0').getByTestId('dash-slide-badge')).toHaveText('HERO')
    await expect(tid(page, 'dash-dot-0')).toHaveAttribute('data-active', 'true')

    const toggle = tid(page, 'dash-slide-0').getByTestId('dash-slide-toggle')
    await expect(toggle).toContainText('Baca Selanjutnya')
    await toggle.click()
    await expect(toggle).toContainText('Tutup')

    await tid(page, 'dash-slide-0').getByTestId('dash-next').click()
    await expect(counter).toHaveText('2 / 5')
    await expect(tid(page, 'dash-slide-1').getByTestId('dash-slide-badge')).toHaveText('FEATURE')
    await tid(page, 'dash-slide-1').getByTestId('dash-prev').click()
    await tid(page, 'dash-slide-0').getByTestId('dash-prev').click()
    await expect(counter).toHaveText('5 / 5')
    await tid(page, 'dash-dot-2').click()
    await expect(counter).toHaveText('3 / 5')

    // FR-M05-08: 5 s advances; hover pauses. The pointer rests on the carousel after the clicks.
    await page.mouse.move(1, 1)
    await mock.advanceTime(5100)
    await expect(counter).toHaveText('4 / 5')
    await tid(page, 'dash-carousel').dispatchEvent('mouseenter')
    await mock.advanceTime(10_000)
    await expect(counter).toHaveText('4 / 5')
    await tid(page, 'dash-carousel').dispatchEvent('mouseleave')
    await mock.advanceTime(5100)
    await expect(counter).toHaveText('5 / 5')
    await expectNoHorizontalScroll(page)
  })

  test('catalogue blocks: subjects, levels, recent questions, difficulty, subject stats', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await openDashboard(page, loginAs, gotoApp, ADMIN)
    await expect(tid(page, 'dash-subjects-count')).toHaveText('31 subjek')
    await expect(tid(page, 'dash-subject-MATH').getByTestId('dash-subject-count')).toHaveText(
      '13872 soalan',
    )
    await expect(tid(page, 'dash-subject-core')).toHaveCount(7)
    await expect(tid(page, 'dash-subject-MATH').getByTestId('dash-subject-start')).toHaveAttribute(
      'href',
      '/practice?subject=MATH',
    )
    await expect(tid(page, 'dash-subject-icon').first()).toBeVisible()

    await expect(tid(page, 'dash-level-pill')).toHaveCount(11)
    await expect(tid(page, 'dash-level-pill').first()).toHaveText(/^Darjah 1\s*\(11396\)$/)
    await expect(tid(page, 'dash-level-pill').first()).toHaveAttribute('href', '/practice?level=D1')

    await expect(tid(page, 'dash-recent-item')).toHaveCount(5)
    await expect(tid(page, 'dash-recent-item').first().locator('a')).toHaveCount(0)

    await mock.advanceTime(1000)
    await expect(tid(page, 'dash-difficulty-count')).toHaveText([
      '39694',
      '47138',
      '33720',
      '9600',
      '0',
    ])
    await expect(tid(page, 'dash-difficulty-total')).toHaveText('130152')
    await expect(tid(page, 'dash-difficulty-bar').nth(1)).toHaveAttribute('style', /width: 100%/)
    await expect(tid(page, 'dash-difficulty-bar').nth(4)).toHaveAttribute('style', /width: 0%/)

    await expect(tid(page, 'dash-subject-stat')).toHaveCount(31)
    await expect(tid(page, 'dash-stat-used').first()).toHaveText('0x')
    await expectNoHorizontalScroll(page)
  })

  test('articles: strip scrolls inside its row and the cards link to the article', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await openDashboard(page, loginAs, gotoApp, PELAJAR2)
    await expect(tid(page, 'dash-article-card')).toHaveCount(5)
    await expect(tid(page, 'dash-article-chip').first()).toHaveCSS('text-transform', 'uppercase')
    const href = await tid(page, 'dash-article-card').first().getAttribute('href')
    expect(href).toMatch(/^\/artikel\/.+/)
    await expect(tid(page, 'dash-articles-all')).toHaveAttribute('href', '/artikel')
    const strip = tid(page, 'dash-articles-strip')
    const overflowing = await strip.evaluate((el) => el.scrollWidth > el.clientWidth)
    expect(overflowing).toBe(true)
    await expectNoHorizontalScroll(page)
  })

  test('navigation: a subject card lands on its S3 and a quick action on S8', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await openDashboard(page, loginAs, gotoApp, MAJU)
    await tid(page, 'dash-subject-MATH').getByTestId('dash-subject-start').click()
    await expect(page).toHaveURL(/\/practice\/MATH$/)
    await gotoApp('/dashboard')
    await tid(page, 'dash-quick-progress').click()
    await expect(page).toHaveURL(/\/practice\/progress/)
  })

  test('teacher opens the dashboard without "Panel Admin"', async ({ page, loginAs, gotoApp }) => {
    await openDashboard(page, loginAs, gotoApp, GURU)
    await expect(tid(page, 'dash-quick')).toBeVisible()
    await expect(tid(page, 'dash-quick-admin')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })
})
