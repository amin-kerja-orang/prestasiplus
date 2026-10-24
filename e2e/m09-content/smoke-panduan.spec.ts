/**
 * M09 S26 `/panduan` and S27 `/pusat-tuisyen/panduan` at 375 / 768 / 1280 (SRS M09 §12: E2E-M09-66
 * to 68 and the panduan part of 72; titles carry the scenario, not the id). Guest and logged-in
 * (`pelajar`) variants, hash anchors, tab/FAQ behaviour, help box links and the 2 / 3 / 5 tab grid.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isDesktopShell,
  moduleTag,
  viewportWidth,
} from '../support'

const MODULE = { tag: [moduleTag(9)] }
const TITLE = 'Panduan Pengguna — PRESTASIPLUS'

test.use({ mockInit: { latency: 0 } })

async function topBarLink(page: Page, label: string) {
  if (!isDesktopShell(page)) {
    await page.getByTestId('panduan-menu-toggle').click()
    return page.getByTestId('panduan-mobile-menu').getByRole('link', { name: label })
  }
  return page.getByTestId('panduan-links').getByRole('link', { name: label })
}

test.describe('S26 /panduan', MODULE, () => {
  test('guest: layout, title, hero, top bar, help box and register button', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/panduan')
    await expectTabTitle(page, TITLE)
    // No hash: the Pelajar panel is the default.
    await expect(page.getByRole('heading', { name: 'Cara Daftar Akaun Pelajar' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Panduan Pengguna PRESTASIPLUS',
    )
    await expect(
      page.getByText('Pilih peranan anda untuk mula. Semua maklumat di hujung jari!'),
    ).toBeVisible()
    await expect(page.getByTestId('shell-user-sidebar')).toHaveCount(0)

    const home = await topBarLink(page, 'Laman Utama')
    await expect(home).toHaveAttribute('href', '/')
    await expect(
      page.getByRole('link', { name: 'Artikel' }).filter({ visible: true }),
    ).toHaveAttribute('href', '/artikel')
    await expect(
      page.getByRole('link', { name: 'Log Masuk' }).filter({ visible: true }),
    ).toHaveAttribute('href', '/login')
    await expect(
      page.getByRole('link', { name: 'Daftar Percuma' }).filter({ visible: true }).first(),
    ).toHaveAttribute('href', '/register')
    await expect(
      page.getByRole('link', { name: 'Papan Pemuka' }).filter({ visible: true }),
    ).toHaveCount(0)

    await expect(page.getByRole('heading', { name: 'Perlukan Bantuan Lanjut?' })).toBeVisible()
    await expect(page.getByTestId('panduan-email')).toHaveAttribute(
      'href',
      'mailto:support@prestasiplus.my',
    )
    const wa = page.getByTestId('panduan-whatsapp')
    await expect(wa).toHaveAttribute('href', 'https://wa.me/60123456789')
    await expect(wa).toHaveAttribute('target', '_blank')
    await expect(page.getByTestId('panduan-register')).toHaveText('Daftar Percuma Sekarang')
    await expect(page.getByTestId('panduan-register')).toHaveAttribute('href', '/register')
    await expect(page.locator('footer')).toContainText('© 2026')
    await expect(page.locator('footer')).toContainText('Platform Latih Tubi Nasional')
    await expectNoHorizontalScroll(page)
  })

  test('logged in: Dashboard link and no register button', async ({ page, gotoApp, loginAs }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/panduan')
    await expectTabTitle(page, TITLE)
    const dash = await topBarLink(page, 'Papan Pemuka')
    await expect(dash).toHaveAttribute('href', '/dashboard')
    await expect(page.getByTestId('panduan-register')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  const anchors: [string, string][] = [
    ['pelajar', 'Cara Daftar Akaun Pelajar'],
    ['guru', 'Cara Daftar Akaun Guru'],
    ['ibubapa', 'Cara Daftar Akaun Ibu Bapa'],
    ['admin', 'Cara Mula Sebagai Admin Sekolah'],
    ['ppd', 'Cara Mula Sebagai PPD / JPN'],
  ]
  for (const [id, heading] of anchors) {
    test(`hash #${id} opens its role panel`, async ({ page, gotoApp }) => {
      await gotoApp(`/panduan#${id}`)
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
      await expect(page.getByTestId(`panduan-tab-${id}`)).toHaveAttribute('data-active', 'true')
    })
  }

  test('an unknown hash shows no role panel and no active tab', async ({ page, gotoApp }) => {
    await gotoApp('/panduan#xyz')
    await expect(page.getByTestId('panduan-tabs')).toBeVisible()
    await expect(page.locator('[data-active="true"]')).toHaveCount(0)
    await expect(page.locator('[data-testid^="panduan-panel-"]')).toHaveCount(0)
    await expect(page.getByTestId('panduan-help')).toBeVisible()
  })

  test('a tab click switches the panel and replaces the hash', async ({ page, gotoApp }) => {
    await gotoApp('/panduan')
    await page.getByTestId('panduan-tab-guru').click()
    await expect(page.getByRole('heading', { name: 'Cara Daftar Akaun Guru' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Alat-Alat Guru' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Cara Daftar Akaun Pelajar' })).toHaveCount(0)
    await expect.poll(() => new URL(page.url()).hash).toBe('#guru')
    await expect(page.getByTestId('panduan-feature')).toHaveCount(8)
    await expect(page.getByTestId('panduan-tab-guru')).toHaveAttribute('data-active', 'true')
  })

  test('FAQ items open and close independently', async ({ page, gotoApp }) => {
    await gotoApp('/panduan')
    const items = page.getByTestId('panduan-faq')
    await expect(items).toHaveCount(5)
    await items.nth(0).getByTestId('panduan-faq-toggle').click()
    await items.nth(2).getByTestId('panduan-faq-toggle').click()
    await expect(page.getByTestId('panduan-faq-answer')).toHaveCount(2)
    await expect(items.nth(2)).toContainText('Kombo bermaksud hari berturut-turut')
    await items.nth(0).getByTestId('panduan-faq-toggle').click()
    await expect(page.getByTestId('panduan-faq-answer')).toHaveCount(1)
  })

  test('tab grid is 2 / 3 / 5 columns and touch targets are >= 44px', async ({ page, gotoApp }) => {
    await gotoApp('/panduan')
    const boxes = await Promise.all(
      ['pelajar', 'guru', 'ibubapa', 'admin', 'ppd'].map((id) =>
        page.getByTestId(`panduan-tab-${id}`).boundingBox(),
      ),
    )
    const firstRowY = boxes[0]!.y
    const columns = boxes.filter((b) => Math.abs(b!.y - firstRowY) < 2).length
    const width = viewportWidth(page)
    expect(columns).toBe(width >= 1024 ? 5 : width >= 768 ? 3 : 2)
    await expectTouchTarget(page.getByTestId('panduan-tab-pelajar'))
    if (!isDesktopShell(page)) {
      await expectTouchTarget(page.getByTestId('panduan-menu-toggle'))
    }
    await expectNoHorizontalScroll(page)
  })

  test('the menu toggle shows the links below lg', async ({ page, gotoApp }) => {
    await gotoApp('/panduan')
    if (isDesktopShell(page)) {
      await expect(page.getByTestId('panduan-menu-toggle')).toBeHidden()
      await expect(page.getByTestId('panduan-links')).toBeVisible()
      return
    }
    await expect(page.getByTestId('panduan-links')).toBeHidden()
    await page.getByTestId('panduan-menu-toggle').click()
    await expect(page.getByTestId('panduan-mobile-menu')).toBeVisible()
    await expectNoHorizontalScroll(page)
    await page.getByTestId('panduan-menu-toggle').click()
    await expect(page.getByTestId('panduan-mobile-menu')).toHaveCount(0)
  })

  test('every role panel fits the viewport', async ({ page, gotoApp }) => {
    await gotoApp('/panduan')
    for (const id of ['pelajar', 'guru', 'ibubapa', 'admin', 'ppd']) {
      await page.getByTestId(`panduan-tab-${id}`).click()
      await expect(page.getByTestId(`panduan-panel-${id}`)).toBeVisible()
      await expectNoHorizontalScroll(page)
    }
  })
})

test.describe('S27 /pusat-tuisyen/panduan', MODULE, () => {
  test('logged in: renders the same guide', async ({ page, gotoApp, loginAs }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/pusat-tuisyen/panduan')
    await expect(page).toHaveURL(/\/pusat-tuisyen\/panduan$/)
    await expectTabTitle(page, TITLE)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Panduan Pengguna PRESTASIPLUS',
    )
    await expect(page.getByRole('heading', { name: 'Cara Daftar Akaun Pelajar' })).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('guest: redirected to /login', async ({ page, gotoApp }) => {
    await gotoApp('/pusat-tuisyen/panduan')
    await expect(page).toHaveURL(/\/login/)
  })
})
