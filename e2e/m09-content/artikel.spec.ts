/**
 * M09 article reader S15 `/artikel` and S16 `/artikel/:slug` at 375 / 768 / 1280 (SRS M09 §12
 * scenarios 15..24; the titles carry "SRS §12 #nn", not the E2E ids: developer specs trace no ids
 * before G5). Seeds are SRS §6.9 (72 published articles, 13 featured), clock 2026-09-25 15:40,
 * random seed 1. Logged-in checks use `pelajar@demo.test` (the admin shares the user shell, covered
 * in one test); guest checks run without a session.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isDesktopShell,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'

const MODULE = { tag: [moduleTag(9)] }
const STUDENT = 'pelajar@demo.test'
const GENERIC_TITLE = 'PRESTASIPLUS - Platform Latih Tubi Nasional'
const GUEST_TITLE = 'Artikel — PRESTASIPLUS'
const SLUG_10 = 'teknik-pomodoro-belajar-25-minit-rehat-5-minit'
const SLUG_9 = 'ai-ini-apa-sebenarnya-jom-fahami-bersama'

test.use({ mockInit: { latency: 0 } })
// The app boot (mock + seeds) can take long on a loaded machine.
test.describe.configure({ timeout: 90_000 })

const cards = (page: Page) => page.getByTestId('artikel-card')

async function cardTitles(page: Page): Promise<string[]> {
  return page.getByTestId('artikel-card-title').allInnerTexts()
}

async function gridColumns(page: Page): Promise<number> {
  return page.getByTestId('artikel-grid').evaluate((el) => {
    return getComputedStyle(el).gridTemplateColumns.split(' ').length
  })
}

test.describe('M09 S15 article list (logged in)', MODULE, () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(STUDENT)
  })

  test('SRS §12 #15 shell, header, 18 cards in reader order and the card anatomy', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/artikel')
    await expect(cards(page)).toHaveCount(18)
    await expectTabTitle(page, GENERIC_TITLE)
    await expect(page.locator('[data-layout="user"]')).toBeVisible()
    await expect(page.getByTestId('shell-user-title')).toHaveText('Artikel')
    await expect(page.getByTestId('shell-user-subtitle')).toHaveText(
      'Tips belajar, berita pendidikan, motivasi dan panduan',
    )
    const titles = await cardTitles(page)
    expect(titles[0]).toBe('AI Ini Apa Sebenarnya? Jom Fahami Bersama!')
    expect(titles[1]).toBe('5 Tips Belajar Matematik yang Menyeronokkan')
    expect(titles[2]).toBe('Cara Baca Buku Cerita dalam Bahasa Inggeris')
    const first = cards(page).first()
    await expect(first.getByTestId('artikel-card-category')).toHaveText('Tips Belajar')
    await expect(first.getByTestId('artikel-card-initial')).toHaveText('C')
    await expect(first.getByTestId('artikel-card-author')).toHaveText('Cikgu Demo 01')
    await expect(first.getByTestId('artikel-card-views')).toHaveText('👁️ 310')
    await expect(first.getByTestId('artikel-card-date')).toHaveText('7 bulan yang lepas')
    await expect(first).toHaveAttribute('href', `/artikel/${SLUG_9}`)
    await expect(first.getByTestId('artikel-card-hot')).toHaveCount(0)
    await expect(cards(page).nth(1).getByTestId('artikel-card-hot')).toHaveText('HOT')
    await expectNoHorizontalScroll(page)
  })

  test('SRS §12 #15 grid columns follow 1 / 2 / 3 / 6 and meta items never wrap inside', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/artikel')
    await expect(cards(page)).toHaveCount(18)
    const width = viewportWidth(page)
    const columns = await gridColumns(page)
    if (width < 640) expect(columns).toBe(1)
    else if (width < 1024) expect(columns).toBe(2)
    else expect(columns).toBe(6) // 1280 is `xl`: 6 columns even beside the sidebar
    const date = cards(page).first().getByTestId('artikel-card-date')
    const whiteSpace = await date.evaluate((el) => getComputedStyle(el).whiteSpace)
    expect(whiteSpace).toBe('nowrap')
    const box = await date.boundingBox()
    expect(box!.height).toBeLessThan(24) // one line (DV-M09-12)
    await expectNoHorizontalScroll(page)
  })

  test('SRS §12 #16 category pill and search keep each other; the hot section disappears', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/artikel')
    await expect(cards(page)).toHaveCount(18)
    await expect(page.getByTestId('artikel-hot')).toBeVisible()
    await page.locator('[data-testid="artikel-pill"][data-category="BERITA"]').click()
    await expect(page).toHaveURL(/\/artikel\?category=BERITA$/)
    await expect(cards(page)).toHaveCount(7)
    const titles = await cardTitles(page)
    expect(titles[0]).toBe('Perpustakaan Bergerak Sampai ke Pedalaman Sabah')
    expect(titles[1]).toBe('Pertandingan Menulis Karangan Kreatif Kebangsaan 2026')
    await expect(
      page.locator('[data-testid="artikel-pill"][data-category="BERITA"]'),
    ).toHaveAttribute('data-active', 'true')
    await expect(page.locator('input[type=hidden][name=category]')).toHaveValue('BERITA')
    await expect(page.getByTestId('artikel-hot')).toHaveCount(0)

    await gotoApp('/artikel')
    await page.getByTestId('artikel-search-input').fill('sifir')
    await page.getByTestId('artikel-search-input').press('Enter')
    await expect(page).toHaveURL(/\/artikel\?search=sifir$/)
    await expect(cards(page)).toHaveCount(2)
    const pills = page.getByTestId('artikel-pill')
    for (const href of await pills.evaluateAll((els) => els.map((e) => e.getAttribute('href')))) {
      expect(href).toContain('search=sifir')
    }
    await expect(pills.first()).toHaveAttribute('href', '/artikel?search=sifir')
    await expect(page.getByTestId('artikel-hot')).toHaveCount(0)
    for (const pill of await pills.all()) await expectTouchTarget(pill, 44)
  })

  test('SRS §12 #17 pager keeps the category; empty state', async ({ page, gotoApp }) => {
    await gotoApp('/artikel?category=TIPS_BELAJAR&page=2')
    await expect(cards(page)).toHaveCount(3)
    expect((await cardTitles(page))[0]).toBe('Rahsia Pelajar Cemerlang: Ulangkaji Sebelum Tidur')
    const prev = page.locator('nav[aria-label="Pagination Navigation"] a', {
      hasText: /Previous/,
    })
    await expect(prev.first()).toHaveAttribute('href', '/artikel?category=TIPS_BELAJAR&page=1')
    await expectNoHorizontalScroll(page)

    await gotoApp('/artikel?search=zzzqqq')
    const empty = page.getByTestId('artikel-empty')
    await expect(empty).toContainText('Tiada Artikel Dijumpai')
    await expect(empty).toContainText('Cuba ubah carian atau pilih kategori lain.')
    await expect(page.getByTestId('artikel-empty-action')).toHaveText('Lihat Semua Artikel')
    await expect(page.getByTestId('artikel-empty-action')).toHaveAttribute('href', '/artikel')
    await expect(page.getByTestId('artikel-grid')).toHaveCount(0)
    await expect(page.locator('nav[aria-label="Pagination Navigation"]')).toHaveCount(0)
  })

  test('SRS §12 #18 hot section shows 6 cards on every page and none with a filter', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/artikel')
    await expect(cards(page)).toHaveCount(18)
    await expect(page.getByTestId('artikel-hot-heading')).toHaveText('Artikel Paling Hangat')
    const hot = page.getByTestId('artikel-hot-card')
    await expect(hot).toHaveCount(6)
    const badges = await page.getByTestId('artikel-hot-badge').allInnerTexts()
    expect(badges.every((b) => b === 'PILIHAN' || b === 'POPULAR')).toBe(true)
    const first = await hot.evaluateAll((els) => els.map((e) => e.getAttribute('data-slug')))

    await gotoApp('/artikel?page=4')
    await expect(page.getByTestId('artikel-hot-card')).toHaveCount(6)

    await gotoApp('/artikel?category=UMUM')
    await expect(cards(page).first()).toBeVisible()
    await expect(page.getByTestId('artikel-hot')).toHaveCount(0)
    await gotoApp('/artikel?search=a')
    await expect(cards(page).first()).toBeVisible()
    await expect(page.getByTestId('artikel-hot')).toHaveCount(0)
    expect(first).toHaveLength(6)
  })

  test(
    'SRS §12 #18 a new seed draws a different hot set',
    provisional('pool of 10 most-viewed non-featured is INFERRED (BR-M09-05, OQ-M09-14)'),
    async ({ page, gotoApp, mock }) => {
      await gotoApp('/artikel')
      const hot = page.getByTestId('artikel-hot-card')
      await expect(hot).toHaveCount(6)
      const a = await hot.evaluateAll((els) => els.map((e) => e.getAttribute('data-slug')))
      await mock.setRandomSeed(3)
      // In-app navigation (a reload would reset the seed): filter, then "Semua" draws again.
      await page.locator('[data-testid="artikel-pill"][data-category="BERITA"]').click()
      await expect(page.getByTestId('artikel-hot')).toHaveCount(0)
      await page.locator('[data-testid="artikel-pill"][data-category=""]').click()
      await expect(hot).toHaveCount(6)
      const b = await hot.evaluateAll((els) => els.map((e) => e.getAttribute('data-slug')))
      expect(b).not.toEqual(a)
    },
  )
})

test.describe('M09 S15 article list (guest)', MODULE, () => {
  test('SRS §12 #19 guest public layout, hero, hot, pills, 18 cards, pager, CTA, footer', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/artikel')
    await expect(cards(page)).toHaveCount(18)
    await expectTabTitle(page, GUEST_TITLE)
    await expect(page.locator('[data-layout="public"]')).toBeVisible()
    await expect(page.locator('[data-layout="user"]')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Log Masuk' }).first()).toHaveAttribute(
      'href',
      '/login',
    )
    await expect(page.getByRole('link', { name: 'Daftar Percuma' }).first()).toHaveAttribute(
      'href',
      '/register',
    )
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel Pilihan')
    await expect(page.getByText('Terkini & Menarik')).toBeVisible()
    await expect(page.getByTestId('artikel-hero-line')).toHaveText(
      'tips belajar, berita pendidikan, motivasi dan panduan untuk pelajar Malaysia!',
    )
    await expect(page.locator('[data-testid="artikel-hero-line"] .font-bold')).toHaveCount(4)
    await expect(page.getByTestId('artikel-hot-card')).toHaveCount(6)
    await expect(page.getByTestId('artikel-search-input')).toHaveAttribute(
      'placeholder',
      'Cari artikel menarik...',
    )
    await expect(page.getByText('Pilih Kategori:')).toBeVisible()
    await expect(page.getByTestId('artikel-pill').nth(1)).toHaveText('✨ Tips Belajar')
    await expect(cards(page).first().locator('[data-icon="clock"]')).toHaveCount(1)
    await expect(page.locator('nav[aria-label="Pagination Navigation"]')).toBeVisible()
    await expect(page.getByText('Nak Baca Lebih Banyak?')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Daftar Percuma Sekarang' })).toHaveAttribute(
      'href',
      '/register',
    )
    await expect(page.getByText('100% Percuma • Tiada Kad Kredit Diperlukan')).toBeVisible()
    await expect(page.getByText('© 2026 PRESTASIPLUS by GCM Technologies Sdn Bhd.')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })
})

test.describe('M09 S16 article detail', MODULE, () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(STUDENT)
  })

  test('SRS §12 #20 detail #10: header, breadcrumb, chips, author card and rendered body', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp(`/artikel/${SLUG_10}`)
    await expect(page.getByTestId('artikel-title')).toHaveText(
      'Teknik Pomodoro: Belajar 25 Minit, Rehat 5 Minit',
    )
    await expectTabTitle(page, GENERIC_TITLE)
    await expect(page.getByTestId('shell-user-subtitle')).toHaveText('Artikel')
    await expect(page.getByTestId('artikel-breadcrumb')).toContainText('Dashboard')
    await expect(page.getByTestId('artikel-breadcrumb')).toContainText('Artikel')
    await expect(page.getByTestId('artikel-breadcrumb-current')).toHaveText(
      'Teknik Pomodoro: Belajar 25 Minit, Rehat...',
    )
    await expect(page.getByTestId('artikel-chip-category')).toHaveText('Tips Belajar')
    await expect(page.getByTestId('artikel-chip-level')).toHaveText('Tingkatan 4')
    await expect(page.getByTestId('artikel-chip-featured')).toHaveText('Pilihan')
    await expect(page.getByTestId('artikel-author-initial')).toHaveText('A')
    await expect(page.getByTestId('artikel-author-name')).toHaveText('Admin Demo')
    await expect(page.getByTestId('artikel-published')).toHaveText('24 Dec 2025')
    await expect(page.getByTestId('artikel-age')).toHaveText('9 bulan yang lepas')
    await expect(page.getByTestId('artikel-views')).toHaveText('597')
    await expect(page.getByTestId('artikel-likes')).toHaveText('6')
    await expect(page.getByRole('button', { name: /Suka/ })).toHaveCount(0)
    const body = page.getByTestId('artikel-body')
    await expect(body.locator('h2').first()).toHaveText('Apa Itu Teknik Pomodoro?')
    // The five observed steps are a bulleted list (`ul`; screenshot shows bullets, not numbers).
    await expect(body.locator('ul > li')).toHaveCount(5)
    await expectNoHorizontalScroll(page)
  })

  test('SRS §12 #21 share links and the copy confirmation for 2 seconds', async ({
    page,
    gotoApp,
    clock,
  }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await gotoApp(`/artikel/${SLUG_10}`)
    await expect(page.getByTestId('artikel-share')).toBeVisible()
    const url = page.url()
    const title = 'Teknik Pomodoro: Belajar 25 Minit, Rehat 5 Minit'
    await expect(page.getByTestId('share-whatsapp')).toHaveAttribute(
      'href',
      `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    )
    await expect(page.getByTestId('share-facebook')).toHaveAttribute(
      'href',
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    )
    await expect(page.getByTestId('share-twitter')).toHaveAttribute(
      'href',
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
    )
    for (const id of ['share-whatsapp', 'share-facebook', 'share-twitter']) {
      await expect(page.getByTestId(id)).toHaveAttribute('target', '_blank')
    }
    await expectTouchTarget(page.getByTestId('share-copy'), 44)
    await page.getByTestId('share-copy').click()
    await expect(page.getByTestId('share-copied')).toHaveText('Link Disalin!')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url)
    await clock.runFor(2100)
    await expect(page.getByTestId('share-copied')).toHaveCount(0)
  })

  test('SRS §12 #22 related cards and the aside from lg only', async ({ page, gotoApp }) => {
    await gotoApp(`/artikel/${SLUG_10}`)
    const related = page.getByTestId('artikel-related-card')
    await expect(related).toHaveCount(3)
    await expect(related.nth(0)).toContainText('AI Ini Apa Sebenarnya? Jom Fahami Bersama!')
    await expect(related.nth(0)).toContainText('👁️ 310')
    await expect(related.nth(1)).toContainText('👁️ 543')
    await expect(related.nth(2)).toContainText('👁️ 351')
    const aside = page.getByTestId('artikel-aside')
    if (isDesktopShell(page)) {
      await expect(aside).toBeVisible()
      await expect(aside.getByTestId('artikel-aside-item')).toHaveCount(5)
      await expect(aside.getByTestId('artikel-aside-all')).toHaveText('Lihat Semua Artikel')
      await expect(aside.getByTestId('artikel-aside-all')).toHaveAttribute('href', '/artikel')
      const asideTitles = await aside.getByTestId('artikel-aside-item').allInnerTexts()
      expect(asideTitles[0]).toContain('AI Ini Apa Sebenarnya? Jom Fahami Bersama!')
    } else {
      await expect(aside).toBeHidden()
    }
    await expectNoHorizontalScroll(page)
  })

  test(
    'SRS §12 #23 every open counts a view (no deduplication)',
    provisional('only a single open was observed; "no deduplication" is INFERRED (SEC-07)'),
    async ({ page, gotoApp }) => {
      for (const expected of ['311', '312', '313']) {
        await gotoApp(`/artikel/${SLUG_9}`)
        await expect(page.getByTestId('artikel-views')).toHaveText(expected)
      }
    },
  )

  test('SRS §12 #24 an unknown slug shows the standalone 404 page', async ({ page, gotoApp }) => {
    await gotoApp('/artikel/tiada-slug-zzz')
    await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
    await expect(page.getByText('404', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Halaman Utama' })).toHaveAttribute('href', '/')
    await expect(page.getByRole('link', { name: 'Mula Latihan' })).toHaveAttribute(
      'href',
      '/practice',
    )
    await expect(page.getByTestId('artikel-title')).toHaveCount(0)
  })
})

test.describe('M09 S16 article detail (guest)', MODULE, () => {
  test(
    'SRS §12 #19 guest detail uses the public layout without breadcrumb and aside',
    provisional('guest article detail was not observed (L-7, FR-M09-39)'),
    async ({ page, gotoApp }) => {
      await gotoApp(`/artikel/${SLUG_10}`)
      await expect(page.getByTestId('artikel-title')).toBeVisible()
      await expectTabTitle(page, GUEST_TITLE)
      await expect(page.locator('[data-layout="public"]')).toBeVisible()
      await expect(page.getByTestId('artikel-breadcrumb')).toHaveCount(0)
      await expect(page.getByTestId('artikel-aside')).toHaveCount(0)
      await expect(page.getByTestId('artikel-body').locator('h2').first()).toHaveText(
        'Apa Itu Teknik Pomodoro?',
      )
      await expectNoHorizontalScroll(page)
    },
  )
})

test.describe('M09 S15 article list (admin)', MODULE, () => {
  test('SRS §12 #15 the admin sees the same page in the user shell', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/artikel')
    await expect(cards(page)).toHaveCount(18)
    await expect(page.locator('[data-layout="user"]')).toBeVisible()
    await expect(page.locator('[data-layout="admin"]')).toHaveCount(0)
    await expect(page.getByTestId('shell-user-title')).toHaveText('Artikel')
  })
})
