/**
 * M08-T3 developer E2E (build-plan M08-T3; QA writes the final E2E-M08-* at G5): S16 `/timeline`, S17
 * `/timeline/create` and S18 `/pelajar/{id}` as the demo admin, the demo pelajar and a guest at
 * 375 / 768 / 1280 - texts and hrefs, the copy and share stubs, publishing a post with a photo, the
 * public profile (guest and logged in), the 404 pages (`/timeline/{id}` is DV-24) and no horizontal page
 * scroll.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, moduleTag, viewportWidth } from '../support'

const NOT_FOUND_TITLE = 'Halaman Tidak Dijumpai | PRESTASIPLUS'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const png = (name: string, size?: number) => ({
  name,
  mimeType: 'image/png',
  buffer: size ? Buffer.concat([PNG, Buffer.alloc(size)]) : PNG,
})

async function expectNotFound(page: Page): Promise<void> {
  await expect(page.locator('[data-page=not-found]')).toBeVisible()
  await expectTabTitle(page, NOT_FOUND_TITLE)
}

test.describe('M08 T3 S16 / S17 admin', { tag: [moduleTag(8)] }, () => {
  test.use({
    mockInit: { latency: 0 },
    permissions: ['clipboard-read', 'clipboard-write'],
  })

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('admin@demo.test')
  })

  test('S16 empty: texts, links, title, header and the copy button', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/timeline')
    await expect(page.getByTestId('timeline-empty')).toContainText('Timeline Kosong')
    await expectTabTitle(page, 'Timeline Saya | PRESTASIPLUS')
    await expect(page.getByTestId('shell-user-title')).toHaveText('Timeline Saya')
    await expect(page.getByTestId('shell-user-subtitle')).toHaveText(
      'Kongsi pencapaian & cerita anda',
    )
    await expect(page.getByRole('heading', { name: 'Timeline Saya', level: 2 })).toBeVisible()
    await expect(page.getByText('Kongsi sijil, pencapaian, aktiviti & cerita anda')).toBeVisible()
    await expect(page.getByText('Mula kongsi pencapaian, sijil, dan cerita anda')).toBeVisible()
    await expect(page.getByTestId('add-post')).toHaveAttribute('href', '/timeline/create')
    await expect(page.getByTestId('add-first')).toHaveText('Tambah Post Pertama')
    await expect(page.getByTestId('add-first')).toHaveAttribute('href', '/timeline/create')

    const url = page.getByTestId('public-url')
    await expect(url).toHaveAttribute('href', /\/pelajar\/1$/)
    await expect(url).toHaveAttribute('target', '_blank')
    await expect(url).toHaveText(/\/pelajar\/1$/)
    await expect(page.getByTestId('public-profile-box')).toContainText('Profil Awam Anda')

    const copy = page.getByTestId('copy-url')
    await expect(copy).toHaveAttribute('data-copied', 'false')
    await copy.click()
    await expect(copy).toHaveAttribute('data-copied', 'true')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      new URL('/pelajar/1', page.url()).href,
    )
    await mock.advanceTime(2000)
    await expect(copy).toHaveAttribute('data-copied', 'false')
    await expectNoHorizontalScroll(page)
  })

  test('S17 fields, defaults and limits; Batal discards', async ({ page, gotoApp }) => {
    await gotoApp('/timeline/create')
    await expect(page.getByRole('heading', { name: 'Post Baru' })).toBeVisible()
    await expectTabTitle(page, 'Tambah Post - Timeline')
    await expect(page.getByTestId('shell-user-title')).toHaveText('Tambah Post')
    await expect(page.getByTestId('shell-user-subtitle')).toHaveText(
      'Kongsi pencapaian atau cerita baru',
    )
    await expect(page.getByTestId('back-link')).toHaveAttribute('href', '/timeline')
    const title = page.locator('input[name=title]')
    await expect(title).toHaveAttribute('maxlength', '150')
    await expect(title).toHaveAttribute('placeholder', 'cth: Sijil Kecemerlangan Matematik 2026')
    await expect(title).toHaveAttribute('required', '')
    await expect(page.locator('select[name=category] option')).toHaveText([
      '🏆 Sijil',
      '🥇 Pencapaian',
      '🏃 Aktiviti',
      '✍️ Cerita',
      '⭐ Lain-lain',
    ])
    await expect(page.locator('select[name=category]')).toHaveValue('cerita')
    await expect(page.locator('textarea[name=story]')).toHaveAttribute('maxlength', '2000')
    await expect(page.locator('textarea[name=story]')).toHaveAttribute(
      'placeholder',
      'Ceritakan pengalaman anda...',
    )
    await expect(page.getByText('Maks 2000 aksara')).toBeVisible()
    await expect(page.getByText('Klik atau seret gambar ke sini')).toBeVisible()
    await expect(page.getByText('JPG, PNG, WEBP • Maks 2MB • 1-5 gambar')).toBeVisible()
    await expect(page.getByTestId('photo-input')).not.toHaveAttribute('required', '')
    await expect(page.getByTestId('submit')).toHaveText('Terbitkan')
    await expectNoHorizontalScroll(page)

    // Native validation: an empty title does not submit.
    await page.getByTestId('submit').click()
    await expect(page).toHaveURL(/\/timeline\/create$/)
    expect(await title.evaluate((el) => (el as HTMLInputElement).validity.valueMissing)).toBe(true)

    await title.fill('tidak disimpan')
    await page.getByTestId('cancel').click()
    await expect(page).toHaveURL(/\/timeline$/)
    await expect(page.getByTestId('timeline-empty')).toBeVisible()
  })

  test('S17 photos: 6 files incl. one over 2 MB, captions kept (DV-30), remove', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/timeline/create')
    const dialogs: string[] = []
    page.on('dialog', (d) => {
      dialogs.push(d.message())
      void d.dismiss()
    })
    const input = page.getByTestId('photo-input')
    await input.setInputFiles([
      png('a.png'),
      png('besar.png', 3 * 1024 * 1024),
      png('b.png'),
      png('c.png'),
      png('d.png'),
      png('e.png'),
    ])
    await expect(page.getByTestId('photo-preview')).toHaveCount(5)
    expect(dialogs).toEqual(['besar.png terlalu besar (maks 2MB)'])
    await expect(page.getByTestId('caption-input')).toHaveCount(5)
    await expect(page.getByTestId('caption-input').nth(2)).toHaveAttribute(
      'placeholder',
      'Keterangan gambar 3...',
    )
    await expect(page.getByTestId('caption-input').first()).toHaveAttribute('maxlength', '200')
    await expect(page.getByText('Keterangan Gambar (opsional)')).toBeVisible()

    await page.getByTestId('caption-input').nth(0).fill('satu')
    await page.getByTestId('caption-input').nth(1).fill('dua')
    await page.getByTestId('photo-remove').first().click()
    await expect(page.getByTestId('photo-preview')).toHaveCount(4)
    await expect(page.getByTestId('caption-input')).toHaveCount(4)
    await expect(page.getByTestId('caption-input').nth(0)).toHaveValue('dua')
    await expect(page.getByTestId('caption-input').nth(1)).toHaveValue('')
    await expectNoHorizontalScroll(page)
  })

  test('S17 publish: no photo keeps the values; with a photo the post shows on S16 and S18', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/timeline/create')
    await page.locator('input[name=title]').fill('Pertandingan <i>Sains</i> 2026')
    await page.locator('select[name=category]').selectOption('pencapaian')
    await page.locator('input[name=event_date]').fill('2026-09-20')
    await page.locator('textarea[name=story]').fill('Cerita <script>x</script> saya')
    await page.getByTestId('submit').click()
    await expect(
      page.getByText('Sila muat naik sekurang-kurangnya 1 gambar.').first(),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/timeline\/create$/)
    await expect(page.locator('input[name=title]')).toHaveValue('Pertandingan <i>Sains</i> 2026')
    await expect(page.locator('textarea[name=story]')).toHaveValue('Cerita <script>x</script> saya')

    await page.getByTestId('photo-input').setInputFiles([png('foto.png')])
    await page.getByTestId('caption-input').first().fill('Trofi')
    await page.getByTestId('submit').click()
    await expect(page).toHaveURL(/\/timeline$/)
    const card = page.getByTestId('post-card')
    await expect(card).toHaveCount(1)
    await expect(card.getByTestId('post-category')).toHaveText('🥇 Pencapaian')
    await expect(card.getByTestId('post-title')).toHaveText('Pertandingan <i>Sains</i> 2026')
    await expect(card.getByTestId('post-date')).toHaveText('20 September 2026')
    await expect(card.getByTestId('post-story')).toHaveText('Cerita <script>x</script> saya')
    await expect(card.locator('i, script')).toHaveCount(0)
    await expect(card.getByTestId('post-photo')).toHaveCount(1)
    await expect(card.getByText('Trofi')).toBeVisible()
    await expect(page.getByTestId('timeline-empty')).toHaveCount(0)
    expect(
      await card
        .getByTestId('post-photo')
        .evaluate((img) => (img as HTMLImageElement).naturalWidth > 0),
    ).toBe(true)
    await expectNoHorizontalScroll(page)

    await gotoApp('/pelajar/1')
    await expect(page.getByTestId('profile-posts').getByTestId('post-title')).toHaveText(
      'Pertandingan <i>Sains</i> 2026',
    )
  })
})

test.describe('M08 T3 S16 pelajar', { tag: [moduleTag(8)] }, () => {
  test.use({
    mockInit: { latency: 0 },
    permissions: ['clipboard-read', 'clipboard-write'],
  })

  async function publish(
    page: Page,
    gotoApp: (path: string) => Promise<void>,
    title: string,
    category: string,
    date: string,
    photos: number,
  ): Promise<void> {
    await gotoApp('/timeline/create')
    await page.locator('input[name=title]').fill(title)
    await page.locator('select[name=category]').selectOption(category)
    await page.locator('input[name=event_date]').fill(date)
    await page
      .getByTestId('photo-input')
      .setInputFiles(Array.from({ length: photos }, (_, i) => png(`f${String(i)}.png`)))
    await page.getByTestId('submit').click()
    await expect(page).toHaveURL(/\/timeline$/)
  }

  test('no seeded posts: S16 is empty and S18 has no posts section', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/timeline')
    await expect(page.getByTestId('timeline-empty')).toBeVisible()
    await expect(page.getByTestId('public-url')).toHaveAttribute('href', /\/pelajar\/2$/)
    await expectNoHorizontalScroll(page)
    await gotoApp('/pelajar/2')
    await expect(page.getByTestId('name')).toBeVisible()
    await expect(page.getByTestId('profile-posts')).toHaveCount(0)
    // bare page: no shell.
    await expect(page.getByTestId('shell-user-title')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('two own posts newest first with category, date and photos; shown on S18 too', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('pelajar@demo.test')
    await publish(page, gotoApp, 'Sijil Awal', 'sijil', '2026-08-14', 2)
    await publish(page, gotoApp, 'Hari Sukan', 'aktiviti', '2026-09-05', 1)
    const cards = page.getByTestId('post-card')
    await expect(cards).toHaveCount(2)
    await expect(cards.getByTestId('post-title')).toHaveText(['Hari Sukan', 'Sijil Awal'])
    await expect(cards.getByTestId('post-category')).toHaveText(['🏃 Aktiviti', '🏆 Sijil'])
    await expect(cards.getByTestId('post-date')).toHaveText(['5 September 2026', '14 Ogos 2026'])
    await expect(cards.nth(0).getByTestId('post-photo')).toHaveCount(1)
    await expect(cards.nth(1).getByTestId('post-photo')).toHaveCount(2)
    await expectNoHorizontalScroll(page)

    await gotoApp('/pelajar/2')
    await expect(page.getByTestId('profile-posts').getByTestId('post-card')).toHaveCount(2)
    await expectNoHorizontalScroll(page)
  })
})

test.describe('M08 T3 S18 public profile', { tag: [moduleTag(8)] }, () => {
  test.use({
    mockInit: { latency: 0 },
    permissions: ['clipboard-read', 'clipboard-write'],
  })

  test('guest sees the whole profile of the admin (no login)', async ({ page, gotoApp }) => {
    await gotoApp('/pelajar/1')
    await expect(page.getByTestId('name')).toHaveText('Admin Demo')
    await expect(page).toHaveURL(/\/pelajar\/1$/)
    await expectTabTitle(page, 'Admin Demo — Pelajar | PRESTASIPLUS')
    await expect(page.getByTestId('shell-user-title')).toHaveCount(0)

    await expect(page.getByTestId('logo')).toHaveText('PRESTASIPLUS')
    await expect(page.getByTestId('logo')).toHaveAttribute('href', '/')
    await expect(page.getByTestId('share')).toHaveText('Kongsi')
    await expect(page.getByTestId('home')).toHaveAttribute('href', '/')

    await expect(page.getByTestId('tier-pill')).toHaveText('🥉 Bronze')
    await expect(page.getByTestId('chip-school')).toHaveText('SK Demo')
    await expect(page.getByTestId('chip-level')).toHaveText('Darjah 6')
    await expect(page.getByTestId('chip-joined')).toHaveText('Ahli sejak 25 Oktober 2025')
    await expect(page.getByTestId('coin-value')).toHaveText('256')
    await expect(page.getByTestId('mini-kombo')).toContainText('1')
    await expect(page.getByTestId('mini-kombo')).toContainText('Kombo')
    await expect(page.getByTestId('mini-tepat')).toContainText('0%')
    await expect(page.getByTestId('tier-card')).toContainText('Bronze')
    await expect(page.getByTestId('tier-card')).toContainText('Tahap 1')
    await expect(page.getByTestId('tier-next')).toHaveText('244 syiling lagi ke Silver')
    await expect(page.getByTestId('tier-bar').getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '51.2',
    )
    await expect(page.getByRole('heading', { name: 'Ringkasan Aktiviti' })).toBeVisible()
    await expect(page.getByTestId('summary-item')).toHaveText([
      '0 sesi latihan',
      '0 hari berlatih',
      '0 jawapan betul',
      '5 kombo terpanjang',
    ])
    // The stat row is `DsStatRow` (`stat-cards > li`: value then label), no longer `stat-card` paragraphs.
    await expect(page.getByTestId('stat-cards').locator('> li')).toHaveText([
      /^256\s*Syiling$/,
      /^1\s*Kombo Hari$/,
      /^0\s*Sesi Latihan$/,
      /^0%\s*Ketepatan$/,
    ])
    await expect(page.getByTestId('profile-posts')).toHaveCount(0)
    // The sponsor CTA is hidden while no `/sponsor/register` route exists (DV-M08-43, D9).
    await expect(page.getByTestId('sponsor-cta')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Ingin menyokong pelajar ini?' })).toHaveCount(0)
    await expect(page.getByTestId('footer-line')).toHaveText('Teruskan usaha Admin!')
    await expect(page.getByText('Setiap latihan membawa kejayaan ⭐')).toBeVisible()
    await expect(page.getByText('— Platform Latih Tubi Interaktif Malaysia')).toBeVisible()
    await expect(page.getByTestId('footer-logo')).toHaveAttribute('href', '/')
  })

  test('responsive: chips from 1024px, "Utama" label from 640px, no horizontal scroll', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/pelajar/1')
    await expect(page.getByTestId('name')).toBeVisible()
    const w = viewportWidth(page)
    if (w >= 1024) {
      await expect(page.getByTestId('cover-chips')).toBeVisible()
      await expect(page.getByTestId('days-with')).toHaveText(/^\s*\d+ hari bersama\s*$/)
    } else {
      await expect(page.getByTestId('cover-chips')).toBeHidden()
    }
    const label = page.getByTestId('home').locator('span')
    if (w >= 640) await expect(label).toBeVisible()
    else await expect(label).toBeHidden()
    // 44px touch targets in the top bar.
    for (const id of ['share', 'home', 'logo']) {
      const box = await page.getByTestId(id).boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(page.getByTestId('profile-footer')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('"Kongsi" without navigator.share copies the link and alerts "Link disalin!"', async ({
    page,
    gotoApp,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    })
    await gotoApp('/pelajar/1')
    const dialogs: string[] = []
    page.on('dialog', (d) => {
      dialogs.push(d.message())
      void d.accept()
    })
    await page.getByTestId('share').click()
    await expect.poll(() => dialogs).toEqual(['Link disalin!'])
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      new URL('/pelajar/1', page.url()).href,
    )
  })

  test('"Kongsi" with navigator.share calls it with {title, url} and shows no alert', async ({
    page,
    gotoApp,
  }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __shared: unknown[] }
      w.__shared = []
      Object.defineProperty(navigator, 'share', {
        value: (data: unknown) => {
          w.__shared.push(data)
          return Promise.resolve()
        },
        configurable: true,
      })
    })
    await gotoApp('/pelajar/1')
    const dialogs: string[] = []
    page.on('dialog', (d) => {
      dialogs.push(d.message())
      void d.dismiss()
    })
    await page.getByTestId('share').click()
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared))
      .toEqual([{ title: 'Admin Demo', url: new URL('/pelajar/1', page.url()).href }])
    expect(dialogs).toEqual([])
  })

  test('unknown id, non-numeric id and /timeline/{id} are the 404 page', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await gotoApp('/pelajar/99999999')
    await expectNotFound(page)
    await gotoApp('/pelajar/abc')
    await expectNotFound(page)
    // Logged in: GET /timeline/{id} is the 404 page (DV-24; live answers 405).
    await loginAs('pelajar@demo.test')
    await gotoApp('/timeline/5')
    await expectNotFound(page)
  })

  test('a guest on /timeline and /timeline/create goes to /login', async ({ page, gotoApp }) => {
    await gotoApp('/timeline')
    await expect(page).toHaveURL(/\/login/)
    await gotoApp('/timeline/create')
    await expect(page).toHaveURL(/\/login/)
  })
})
