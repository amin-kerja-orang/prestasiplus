/**
 * M09 Video S17 `/video`, S18 `/video/:id`, S20 `/video/tambah`, S19 `/video/:id/edit` at 375 / 768 /
 * 1280 (M09-T3; SRS M09 §12 E2E-M09-47..55 and the S17-S20 part of 72) for the accounts of build-plan
 * §2.7b: 2 `pelajar@demo.test`, 5 `guru@demo.test`, 8 `adminsekolah@demo.test`, plus the admin (the
 * SRS scenarios are written as admin) and a guest. The dataset is the 2,260 live videos (SRS §6.11,
 * #2224 first); assertions on titles, ids and views use observed live values or are structural. The titles carry "SRS §12 #nn", not the E2E
 * ids (developer specs trace no ids before G5).
 * Thumbnails are the live img.youtube.com images (empty frame on error) and the player is the live
 * YouTube embed; both carry their URLs in attributes.
 * Save, publish and delete results and their flashes are INFERRED (L-1): provisional tests assert
 * that a flash appears, never its words.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  acceptNextDialog,
  dismissNextDialog,
  expectNoHorizontalScroll,
  expectTabTitle,
  isDesktopShell,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'

const ADMIN = 'admin@demo.test'
const PELAJAR = 'pelajar@demo.test' // account 2
const GURU = 'guru@demo.test' // account 5
const ADMIN_SEKOLAH = 'adminsekolah@demo.test' // account 8
const MODULE = { tag: [moduleTag(9)] }

test.use({ mockInit: { latency: 0 } })

const cards = (page: Page) => page.getByTestId('video-card')
const cardIds = (page: Page) =>
  cards(page).evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-video-id'))))

/** The number inside a pill label such as "Tutorial (12)". */
async function pillCount(page: Page, label: string): Promise<number> {
  const text =
    (await page
      .getByTestId('video-category-pill')
      .filter({ hasText: label })
      .first()
      .textContent()) ?? ''
  return Number(text.split('(')[1]?.replace(')', ''))
}

async function expectHeader(page: Page, title: string, subtitle: string): Promise<void> {
  await expect(page.getByTestId('shell-user-title')).toHaveText(title)
  await expect(page.getByTestId('shell-user-subtitle')).toHaveText(subtitle)
}

/** Submit and "Batal" on one row inside the form column. */
async function expectFooterRow(page: Page): Promise<void> {
  // One synchronous measurement, so a scroll or reflow between two calls cannot skew the rows.
  const { submit, cancel } = await page.evaluate(() => {
    const box = (id: string) => {
      const r = document.querySelector('[data-testid="' + id + '"]')!.getBoundingClientRect()
      return { x: r.x, y: r.y, h: r.height }
    }
    return { submit: box('video-form-submit'), cancel: box('video-form-cancel') }
  })
  expect(Math.abs(submit.y - cancel.y)).toBeLessThan(2)
  expect(submit.x).toBeLessThan(cancel.x)
}

// --- S17 as a guest ----------------------------------------------------------------------------------

test.describe('M09 S17 guest', MODULE, () => {
  test('SRS §12 #50 guest /video: public layout, pills, cards, no "Tambah Video", CTA and footer @m09', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/video')
    await expect(cards(page)).toHaveCount(24)
    await expectTabTitle(page, 'Video Pembelajaran — PRESTASIPLUS')
    await expect(page.getByTestId('public-layout-topbar')).toBeVisible()
    await expect(page.getByTestId('public-layout-section')).toContainText('Video')
    await expect(page.getByTestId('video-guest-hero')).toContainText('Tonton & Fahami')
    await expect(page.getByTestId('video-guest-hero')).toContainText('VIDEO PEMBELAJARAN')
    await expect(page.getByTestId('video-guest-hero')).toContainText(
      'Tutorial, tips SPM, motivasi dan banyak lagi — semua dalam satu platform!',
    )
    await expect(page.getByTestId('video-category-pill').first()).toHaveText('Semua (2260)')
    await expect(page.getByTestId('video-add')).toHaveCount(0)
    await expect(page.getByTestId('public-layout-cta')).toContainText('Nak Tonton Lebih Banyak?')
    await expect(page.getByTestId('public-layout-footer')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('S18 guest may open a video (L-7): public layout, no Edit or Padam @m09', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/video/2224')
    await expect(page.getByTestId('video-title')).toHaveText(
      'Sejarah Tingkatan 1: Bab 1 - Mengenali Sejarah',
    )
    await expectTabTitle(
      page,
      'Sejarah Tingkatan 1: Bab 1 - Mengenali Sejarah - Video PRESTASIPLUS',
    )
    await expect(page.getByTestId('public-layout-topbar')).toBeVisible()
    await expect(page.getByTestId('video-edit')).toHaveCount(0)
    await expect(page.getByTestId('video-delete')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('S19 and S20 send a guest to /login; an unknown video is the 404 page @m09', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/video/tambah')
    await expect(page).toHaveURL(/\/login$/)
    await gotoApp('/video/2224/edit')
    await expect(page).toHaveURL(/\/login$/)
    await gotoApp('/video/999999')
    await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
  })
})

// --- S17 / S18 for the three roles ---------------------------------------------------------------------

for (const [label, email] of [
  ['account 2 (Murid)', PELAJAR],
  ['account 5 (Guru)', GURU],
  ['account 8 (Admin Sekolah)', ADMIN_SEKOLAH],
] as const) {
  test.describe(`M09 S17 and S18 as ${label}`, MODULE, () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs(email)
    })

    test('SRS §12 #47 S17 default: header, tab, pills, add link, 24 cards in the live order, pager @m09', async ({
      page,
      gotoApp,
    }) => {
      await gotoApp('/video')
      await expect(cards(page)).toHaveCount(24)
      await expectTabTitle(page, 'Video Pembelajaran - PRESTASIPLUS')
      await expectHeader(
        page,
        'Video Pembelajaran',
        'Tonton video motivasi, tutorial dan tips peperiksaan',
      )
      await expect(page.getByTestId('video-search')).toHaveAttribute('placeholder', 'Cari video...')
      await expect(page.getByTestId('video-category-pill')).toHaveText([
        'Semua (2260)',
        'Motivasi (3)',
        'Tutorial (12)',
        'Tips SPM (3)',
        'Ceramah (2242)',
        'Lain-lain (0)',
      ])
      await expect(page.getByTestId('video-subject-pill')).toHaveText([
        'Matematik (865)',
        'Sejarah (97)',
        'Matematik Tambahan (420)',
        'Fizik (779)',
        'Kimia (96)',
      ])
      await expect(page.getByTestId('video-subject-pill').nth(1)).toHaveAttribute(
        'href',
        '/video?subject=5',
      )
      await expect(page.getByTestId('video-add')).toHaveAttribute('href', '/video/tambah')
      expect((await cardIds(page)).slice(0, 12)).toEqual([
        2224, 64, 433, 825, 1020, 19, 2225, 65, 434, 827, 1021, 2226,
      ])
      const first = cards(page).first()
      await expect(first.getByTestId('video-card-platform')).toHaveText('YouTube')
      await expect(first.getByTestId('video-card-title')).toHaveText(
        'Sejarah Tingkatan 1: Bab 1 - Mengenali Sejarah',
      )
      const uploader = (await first.getByTestId('video-card-uploader').textContent())?.trim() ?? ''
      expect(uploader).not.toBe('')
      await expect(first.getByTestId('video-card-initial')).toHaveText(uploader.charAt(0))
      await expect(first.getByTestId('video-card-role')).toHaveText(/\S/)
      await expect(first.getByTestId('video-card-views')).toHaveText(/^\d+ tontonan$/)
      await expect(first.getByTestId('video-card-date')).toHaveText('6 bulan yang lepas')
      // Observed on live: ids 1 to 20 are one month older (id 19 is on page 1).
      await expect(
        page
          .locator('[data-testid="video-card"][data-video-id="19"]')
          .getByTestId('video-card-date'),
      ).toHaveText('7 bulan yang lepas')
      await expect(first.getByTestId('video-card-views')).toHaveText('134 tontonan')
      await expect(first.getByTestId('video-thumb')).toHaveAttribute(
        'data-thumbnail-url',
        /^https:\/\/img\.youtube\.com\/vi\/.+\/hqdefault\.jpg$/,
      )
      await expect(page.getByText('Showing 1 to 24 of 2260 results')).toBeVisible({
        visible: viewportWidth(page) >= 640,
      })
      if (isDesktopShell(page)) {
        const overlay = first.getByTestId('video-card-overlay')
        await expect(overlay).toHaveCSS('opacity', '0')
        await first.hover()
        await expect(overlay).toHaveCSS('opacity', '1')
      }
    })

    test('SRS §12 #48 filters: zero pill, ?category=lain-lain, ?category=motivasi, ?subject=5, no match @m09', async ({
      page,
      gotoApp,
    }) => {
      await gotoApp('/video')
      const zero = page.getByTestId('video-category-pill').filter({ hasText: 'Lain-lain (0)' })
      await expect(zero).not.toHaveAttribute('href', /.*/)
      await zero.click()
      await expect(page).toHaveURL(/\/video$/)

      await gotoApp('/video?category=lain-lain')
      await expect(page.getByTestId('video-empty')).toContainText('Tiada Video Dijumpai')
      await expect(page.getByTestId('video-empty')).toContainText(
        'Cuba ubah carian atau pilih kategori lain.',
      )
      await expect(page.getByTestId('video-empty-action')).toHaveText('Lihat Semua Video')
      await expect(page.getByTestId('video-empty-action')).toHaveAttribute('href', '/video')

      await gotoApp('/video?category=motivasi')
      await expect(cards(page)).toHaveCount(3)
      expect(await cardIds(page)).toEqual([18, 17, 16])
      await expect(page.getByTestId('video-subject-pill')).toHaveText(['Sejarah (1)'])
      await expect(page.getByTestId('video-subject-pill')).toHaveAttribute(
        'href',
        '/video?category=motivasi&subject=5',
      )
      await expect(
        page.getByTestId('video-category-pill').filter({ hasText: 'Motivasi' }),
      ).toHaveCSS('background-image', /linear-gradient/)

      await gotoApp('/video?subject=5')
      await expect(page.getByTestId('video-category-pill')).toHaveText([
        'Semua (97)',
        'Motivasi (1)',
        'Tutorial (12)',
        'Tips SPM (3)',
        'Ceramah (81)',
        'Lain-lain (0)',
      ])
      await expect(page.getByTestId('video-category-pill').nth(1)).toHaveAttribute(
        'href',
        '/video?subject=5&category=motivasi',
      )
      await expect(page.getByTestId('video-subject-pill')).toHaveText([
        'Matematik (865)',
        'Sejarah (97)',
        'Matematik Tambahan (420)',
        'Fizik (779)',
        'Kimia (96)',
      ])
      await expect(page.getByTestId('video-subject-pill').nth(1)).not.toHaveCSS(
        'background-image',
        /linear-gradient/,
      )
      await page.getByTestId('video-reset-subject').click()
      await expect(page).toHaveURL(/\/video$/)

      await gotoApp('/video?search=zzzqqq')
      await expect(page.getByTestId('video-empty')).toBeVisible()
      await expect(page.getByTestId('video-category-pill').first()).toHaveText('Semua (0)')
      for (const pill of await page.getByTestId('video-category-pill').all()) {
        await expect(pill).not.toHaveAttribute('href', /.*/)
      }
    })

    test('SRS §12 #49 orders and pager: ?subject=5, page 2, page 95, subject kept in links @m09', async ({
      page,
      gotoApp,
    }) => {
      await gotoApp('/video?subject=5')
      await expect(cards(page)).toHaveCount(24)
      expect(await cardIds(page)).toEqual(Array.from({ length: 24 }, (_, i) => 2224 + i))

      await gotoApp('/video?subject=5&page=2')
      await expect(cards(page)).toHaveCount(24)
      expect(await cardIds(page)).toEqual([
        ...Array.from({ length: 13 }, (_, i) => 2248 + i),
        ...Array.from({ length: 11 }, (_, i) => 21 + i),
      ])

      await gotoApp('/video?page=2')
      await expect(cards(page)).toHaveCount(24)
      expect((await cardIds(page)).slice(0, 12)).toEqual([
        878, 1024, 2229, 69, 438, 879, 1025, 2230, 70, 439, 880, 1026,
      ])

      await gotoApp('/video?page=95')
      await expect(cards(page)).toHaveCount(4)
      expect(await cardIds(page)).toEqual([2220, 2221, 2222, 2223])
      if (viewportWidth(page) >= 640) {
        await expect(page.getByText('Showing 2257 to 2260 of 2260 results')).toBeVisible()
      }
      await expect(page.getByRole('link', { name: /Previous/ }).first()).toHaveAttribute(
        'href',
        '/video?page=94',
      )

      await gotoApp('/video?subject=9&page=2')
      await expect(cards(page).first()).toBeVisible()
      await expect(page.getByRole('link', { name: /Next/ }).first()).toHaveAttribute(
        'href',
        '/video?subject=9&page=3',
      )
    })

    test('SRS §12 #51 S18 #2224: header, tab, player placeholder, meta, chips, related, +1 view @m09', async ({
      page,
      gotoApp,
    }) => {
      // The list shows the count the detail will show (the open adds 1 after the page is built).
      await gotoApp('/video')
      const listed = page
        .locator('[data-testid="video-card"][data-video-id="2224"]')
        .getByTestId('video-card-views')
      await expect(listed).toHaveText(/^\d+ tontonan$/)
      const before = Number.parseInt((await listed.textContent()) ?? '', 10)
      await gotoApp('/video/2224')
      await expect(page.getByTestId('video-title')).toBeVisible()
      await expectTabTitle(
        page,
        'Sejarah Tingkatan 1: Bab 1 - Mengenali Sejarah - Video PRESTASIPLUS',
      )
      await expectHeader(page, 'Video', 'Sejarah Tingkatan 1: Bab 1 - Mengenali Sejarah')
      await expect(page.getByTestId('video-back')).toHaveText('Semua Video')
      await expect(page.getByTestId('video-back')).toHaveAttribute('href', '/video')
      const EMBED = /^https:\/\/www\.youtube\.com\/embed\/[A-Za-z0-9_-]{11}$/
      await expect(page.getByTestId('video-player')).toHaveAttribute('data-embed-url', EMBED)
      await expect(page.getByTestId('video-player-frame')).toHaveAttribute('src', EMBED)
      await expect(page.getByTestId('video-views')).toHaveText(`${String(before)} tontonan`)
      await expect(page.getByTestId('video-date')).toHaveText('03 Mar 2026')
      await expect(page.getByTestId('video-chip-platform')).toHaveText('YouTube')
      await expect(page.getByTestId('video-chip-category')).toHaveText('Ceramah')
      await expect(page.getByTestId('video-chip-subject')).toHaveText('Sejarah')
      await expect(page.getByTestId('video-uploader-name')).toHaveText(/\S/)
      await expect(page.getByTestId('video-uploader-role')).toHaveText(/\S/)
      await expect(page.getByTestId('video-description')).toHaveText(/\S/)
      await expect(page.getByText('Video Berkaitan')).toBeVisible()
      expect(
        await page
          .getByTestId('video-related-card')
          .evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-video-id')))),
      ).toEqual([2260, 2259, 2258, 2257, 2256, 2255])
      await expectNoHorizontalScroll(page)

      await page.getByTestId('video-back').click()
      await expect(cards(page).first()).toBeVisible()
      await expect(
        page
          .locator('[data-testid="video-card"][data-video-id="2224"]')
          .getByTestId('video-card-views'),
      ).toHaveText(`${String(before + 1)} tontonan`)
    })

    test('SRS §12 #55 S18 has no Edit or Padam on another user video and S19 is refused @m09', async ({
      page,
      gotoApp,
    }) => {
      await gotoApp('/video/2224')
      await expect(page.getByTestId('video-title')).toBeVisible()
      await expect(page.getByTestId('video-edit')).toHaveCount(0)
      await expect(page.getByTestId('video-delete')).toHaveCount(0)
      await gotoApp('/video/2224/edit')
      await expect(page.getByTestId('video-form')).toHaveCount(0)
      await expect(page).not.toHaveURL(/\/video\/2224\/edit/)
    })

    test('responsive: S17 grid columns and no horizontal scroll at this width @m09', async ({
      page,
      gotoApp,
    }) => {
      await gotoApp('/video')
      await expect(cards(page)).toHaveCount(24)
      const width = viewportWidth(page)
      const expected = width >= 1280 ? 6 : width >= 640 ? 2 : 1
      const xs = await cards(page).evaluateAll((els) =>
        els.slice(0, 7).map((el) => Math.round(el.getBoundingClientRect().top)),
      )
      expect(xs.filter((top) => top === xs[0])).toHaveLength(Math.min(expected, 7))
      await expectNoHorizontalScroll(page)
    })
  })
}

// --- S20 add --------------------------------------------------------------------------------------------

test.describe('M09 S20 add video', MODULE, () => {
  test('SRS §12 #52 admin: header, labels, options, uploader strip, no school, footer row, detection, validation @m09', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/video/tambah')
    await expect(page.getByTestId('video-form-h1')).toHaveText('Tambah Video Baru')
    await expectTabTitle(page, 'Tambah Video')
    await expectHeader(
      page,
      'Tambah Video',
      'Kongsi video pembelajaran dari YouTube, Vimeo dan lain-lain',
    )
    await expect(page.getByTestId('video-form-sub')).toHaveText(
      'Paste sahaja link video — kami akan buat selebihnya',
    )
    await expect(page.getByTestId('video-url')).toHaveAttribute(
      'placeholder',
      'https://www.youtube.com/watch?v=...',
    )
    await expect(
      page.getByText('Sokongan: YouTube, Vimeo, Dailymotion, TikTok, Facebook'),
    ).toBeVisible()
    await expect(page.getByTestId('video-title-input')).toHaveAttribute(
      'placeholder',
      'Contoh: Tips Skor A+ Matematik SPM',
    )
    await expect(page.getByTestId('video-description-input')).toHaveAttribute(
      'placeholder',
      'Terangkan secara ringkas tentang video ini...',
    )
    const categories = await page
      .getByTestId('video-category-input')
      .evaluate((el) => [...(el as HTMLSelectElement).options].map((o) => o.textContent?.trim()))
    expect(categories).toEqual([
      'Pilih kategori...',
      'Motivasi',
      'Tutorial',
      'Tips SPM',
      'Ceramah',
      'Lain-lain',
    ])
    const subjects = await page
      .getByTestId('video-subject-input')
      .evaluate((el) => [...(el as HTMLSelectElement).options].map((o) => o.textContent?.trim()))
    expect(subjects[0]).toBe('Tiada subjek khusus')
    expect(subjects).toHaveLength(32)
    await expect(page.getByTestId('video-uploader-strip')).toContainText('Admin Demo')
    await expect(page.getByTestId('video-strip-role')).toHaveText(/^admin$/i)
    await expect(page.getByText('Nama anda akan dipaparkan bersama video')).toBeVisible()
    await expect(page.getByTestId('video-form-submit')).toHaveText('Terbitkan Video')
    await expectFooterRow(page)

    // Platform detection after 500 ms.
    await page.getByTestId('video-url').fill('https://youtu.be/abc123XYZ00')
    await expect(page.getByTestId('video-preview-label')).toHaveText('Platform dikesan: YouTube')
    await expect(page.getByTestId('video-thumb')).toHaveAttribute(
      'data-thumbnail-url',
      'https://img.youtube.com/vi/abc123XYZ00/hqdefault.jpg',
    )
    await page.getByTestId('video-url').fill('https://vimeo.com/123456')
    await expect(page.getByTestId('video-preview-label')).toHaveText('Platform dikesan: Vimeo')
    await expect(page.getByTestId('video-thumb')).toHaveCount(0)
    await page.getByTestId('video-url').fill('https://example.com/x')
    await expect(page.getByTestId('video-preview')).toHaveCount(0)

    // "Sekolah Saya" is disabled for the seed admin and a click keeps "Semua Pengguna".
    await expect(page.getByTestId('video-visibility-school')).toBeDisabled()
    await expect(page.getByTestId('video-school-hint')).toHaveText('Tiada sekolah')
    await page.getByText('Sekolah Saya').click({ force: true })
    await expect(page.getByTestId('video-visibility-global')).toBeChecked()

    // Native validation: an empty form is blocked and nothing is posted.
    await page.getByTestId('video-url').fill('')
    await page.getByTestId('video-form-submit').click()
    expect(
      await page
        .getByTestId('video-url')
        .evaluate((el) => (el as HTMLInputElement).validity.valueMissing),
    ).toBe(true)
    expect(
      await page
        .getByTestId('video-title-input')
        .evaluate((el) => (el as HTMLInputElement).validity.valueMissing),
    ).toBe(true)
    expect(
      await page
        .getByTestId('video-category-input')
        .evaluate((el) => (el as HTMLSelectElement).validity.valueMissing),
    ).toBe(true)
    await expect(page).toHaveURL(/\/video\/tambah$/)
    await expectNoHorizontalScroll(page)

    await page.getByTestId('video-form-cancel').click()
    await expect(page).toHaveURL(/\/video$/)
  })

  test(
    'SRS §12 #52 provisional: account 5 has "Sekolah Saya" with SMK DEMO; accounts 2 and 8 do not @m09',
    provisional('the video-form school is INFERRED (L-6)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp('/video/tambah')
      await expect(page.getByTestId('video-school-hint')).toHaveText('SMK DEMO')
      await expect(page.getByTestId('video-visibility-school')).toBeEnabled()
      await page.getByText('Sekolah Saya').click()
      await expect(page.getByTestId('video-visibility-school')).toBeChecked()
      await expectFooterRow(page)
      await expectNoHorizontalScroll(page)
    },
  )

  for (const email of [PELAJAR, ADMIN_SEKOLAH]) {
    test(
      `SRS §12 #52 provisional: ${email} has no video-form school ("Tiada sekolah", disabled) @m09`,
      provisional('the video-form school is INFERRED (L-6)'),
      async ({ page, gotoApp, loginAs }) => {
        await loginAs(email)
        await gotoApp('/video/tambah')
        await expect(page.getByTestId('video-school-hint')).toHaveText('Tiada sekolah')
        await expect(page.getByTestId('video-visibility-school')).toBeDisabled()
        await expectFooterRow(page)
        await expectNoHorizontalScroll(page)
      },
    )
  }

  for (const [label, email, name] of [
    ['account 2', PELAJAR, 'Pelajar Demo'],
    ['account 8', ADMIN_SEKOLAH, 'Pentadbir Sekolah Demo'],
  ] as const) {
    test(
      `SRS §12 #53 and #55 provisional: ${label} publishes a video, owns it, can edit and delete it @m09`,
      provisional('publish, edit and delete results and flashes are INFERRED (L-1)'),
      async ({ page, gotoApp, loginAs }) => {
        await loginAs(email)
        await gotoApp('/video')
        await expect(cards(page)).toHaveCount(24)
        const totalBefore = await pillCount(page, 'Semua')
        const tutorialBefore = await pillCount(page, 'Tutorial')
        await gotoApp('/video/tambah')
        await page.getByTestId('video-url').fill('https://youtu.be/abc123XYZ00')
        await page.getByTestId('video-title-input').fill('Video ujian E2E')
        await page.getByTestId('video-category-input').selectOption('tutorial')
        await page.getByTestId('video-subject-input').selectOption({ label: 'Matematik' })
        await page.getByTestId('video-form-submit').click()
        await expect(page).toHaveURL(/\/video$/)
        await expect(page.getByTestId('cmp-flash')).toBeVisible()
        await expect(page.getByTestId('video-category-pill').first()).toHaveText(
          `Semua (${String(totalBefore + 1)})`,
        )
        await expect(
          page.getByTestId('video-category-pill').filter({ hasText: 'Tutorial' }),
        ).toHaveText(`Tutorial (${String(tutorialBefore + 1)})`)
        const first = cards(page).first()
        await expect(first.getByTestId('video-card-title')).toHaveText('Video ujian E2E')
        await expect(first.getByTestId('video-card-uploader')).toHaveText(name)
        await expect(first.getByTestId('video-card-views')).toHaveText('0 tontonan')

        // The uploader sees Edit and Padam.
        await first.click()
        await expect(page.getByTestId('video-edit')).toBeVisible()
        await expect(page.getByTestId('video-delete')).toBeVisible()
        await expectNoHorizontalScroll(page)

        // Edit: preloaded form, save returns to the detail page with the new title.
        await page.getByTestId('video-edit').click()
        await expect(page.getByTestId('video-form-h1')).toHaveText('Edit Video')
        await expect(page.getByTestId('video-title-input')).toHaveValue('Video ujian E2E')
        await expect(page.getByTestId('video-preview-label')).toHaveText(
          'Platform dikesan: Youtube',
        )
        await expectFooterRow(page)
        await page.getByTestId('video-title-input').fill('Video ujian E2E (kemas kini)')
        await page.getByTestId('video-form-submit').click()
        await expect(page.getByTestId('video-title')).toHaveText('Video ujian E2E (kemas kini)')
        await expect(page.getByTestId('cmp-flash')).toBeVisible()

        // Delete: dismiss keeps it; accept returns to the list without it.
        const dismissed = dismissNextDialog(page, { type: 'confirm', message: 'Padam video ini?' })
        await page.getByTestId('video-delete').click()
        await dismissed
        await expect(page.getByTestId('video-title')).toBeVisible()
        const accepted = acceptNextDialog(page, { type: 'confirm', message: 'Padam video ini?' })
        await page.getByTestId('video-delete').click()
        await accepted
        await expect(page).toHaveURL(/\/video$/)
        await expect(page.getByTestId('video-category-pill').first()).toHaveText(
          `Semua (${String(totalBefore)})`,
        )
        await expect(
          page.getByTestId('video-category-pill').filter({ hasText: 'Tutorial' }),
        ).toHaveText(`Tutorial (${String(tutorialBefore)})`)
      },
    )
  }
})

// --- S18 / S19 as admin ---------------------------------------------------------------------------------

test.describe('M09 S18 and S19 as admin', MODULE, () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(ADMIN)
  })

  test('SRS §12 #54 #2224 shows Edit and Padam; dismissing the confirm keeps the video; S19 is preloaded @m09', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/video/2224')
    await expect(page.getByTestId('video-edit')).toHaveText('Edit')
    await expect(page.getByTestId('video-edit')).toHaveAttribute('href', '/video/2224/edit')
    await expect(page.getByTestId('video-delete')).toHaveText('Padam')
    const dialog = dismissNextDialog(page, { type: 'confirm', message: 'Padam video ini?' })
    await page.getByTestId('video-delete').click()
    await dialog
    await expect(page).toHaveURL(/\/video\/2224$/)
    await expect(page.getByTestId('video-title')).toBeVisible()

    await gotoApp('/video/2224/edit')
    await expect(page.getByTestId('video-form-h1')).toHaveText('Edit Video')
    await expectTabTitle(page, 'Edit Video - Sejarah Tingkatan 1: Bab 1 - Mengenali Sejarah')
    await expectHeader(page, 'Edit Video', 'Sejarah Tingkatan 1: Bab 1 - Mengenali Sejarah')
    await expect(page.getByTestId('video-form-sub')).toHaveText('Kemaskini maklumat video')
    await expect(page.getByTestId('video-url')).toHaveValue(
      /^https:\/\/(www\.)?youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/,
    )
    await expect(page.getByTestId('video-title-input')).toHaveValue(
      'Sejarah Tingkatan 1: Bab 1 - Mengenali Sejarah',
    )
    await expect(page.getByTestId('video-category-input')).toHaveValue('ceramah')
    await expect(page.getByTestId('video-subject-input').locator('option:checked')).toHaveText(
      'Sejarah',
    )
    await expect(page.getByTestId('video-preview-label')).toHaveText('Platform dikesan: Youtube')
    const categories = await page
      .getByTestId('video-category-input')
      .evaluate((el) => [...(el as HTMLSelectElement).options].map((o) => o.value))
    expect(categories).not.toContain('')
    await expect(page.getByTestId('video-uploader-strip')).toHaveCount(0)
    await expect(page.getByTestId('video-form-submit')).toHaveText('Simpan Perubahan')
    await expectFooterRow(page)
    await expect(page.getByTestId('video-form-cancel')).toHaveAttribute('href', '/video/2224')
    await expectNoHorizontalScroll(page)
    await page.getByTestId('video-form-cancel').click()
    await expect(page).toHaveURL(/\/video\/2224$/)
  })

  test(
    'SRS §12 #54 provisional: save returns to the detail page; delete returns to the list with one video less @m09',
    provisional('save and delete results and flashes are INFERRED (L-1)'),
    async ({ page, gotoApp }) => {
      await gotoApp('/video')
      await expect(cards(page)).toHaveCount(24)
      const totalBefore = await pillCount(page, 'Semua')
      await gotoApp('/video/2224/edit')
      await page.getByTestId('video-title-input').fill('Tajuk dikemas kini')
      await page.getByTestId('video-form-submit').click()
      await expect(page.getByTestId('video-title')).toHaveText('Tajuk dikemas kini')
      await expect(page.getByTestId('cmp-flash')).toBeVisible()

      const dialog = acceptNextDialog(page, { type: 'confirm', message: 'Padam video ini?' })
      await page.getByTestId('video-delete').click()
      await dialog
      await expect(page).toHaveURL(/\/video$/)
      await expect(page.getByTestId('cmp-flash')).toBeVisible()
      await expect(page.getByTestId('video-category-pill').first()).toHaveText(
        `Semua (${String(totalBefore - 1)})`,
      )
    },
  )

  test('S19 open does not count a view (non-counting ?for=edit read) @m09', async ({
    page,
    gotoApp,
  }) => {
    const views = async (): Promise<string> => {
      await gotoApp('/video')
      const v = page
        .locator('[data-testid="video-card"][data-video-id="2224"]')
        .getByTestId('video-card-views')
      await expect(v).toBeVisible()
      return (await v.textContent()) ?? ''
    }
    const before = await views()
    expect(before).toBe('134 tontonan')
    await gotoApp('/video/2224/edit')
    await expect(page.getByTestId('video-form')).toBeVisible()
    expect(await views()).toBe(before)
  })

  test('an unknown video id is the 404 page on S18 and S19 @m09', async ({ page, gotoApp }) => {
    await gotoApp('/video/999999')
    await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
    await gotoApp('/video/999999/edit')
    await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
  })
})
