/**
 * M09 admin banners (S9-S11), Audio KBAT sets (S12-S13, templates) and screenshot upload (S14) at
 * 375 / 768 / 1280 as `admin@demo.test` (SRS M09 §12 scenarios 35..39, 41..44, 69 and the S9-S14 part of
 * 72; the titles carry "SRS §12 #nn", not the E2E ids: developer specs trace no ids before G5). Seeds
 * are SRS §6.9 (5 banners, 0 Audio KBAT sets, 0 screenshots). Flash texts and the save/delete/upload
 * results are PROPOSED COPY / INFERRED (SRS §8.2): the provisional tests assert that a flash appears,
 * never its words. The sets of #42 and #44 are created through S13 (no seed hook exists).
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  acceptNextDialog,
  dismissNextDialog,
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isDesktopShell,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'

const ADMIN = 'admin@demo.test'
const MODULE = { tag: [moduleTag(9)] }

test.use({ mockInit: { latency: 0 } })
test.beforeEach(async ({ loginAs }) => {
  await loginAs(ADMIN)
})

function bannerRow(page: Page, id: number) {
  return page.locator(`[data-testid="banner-row"][data-banner-id="${String(id)}"]`)
}

async function expectHeader(page: Page, title: string, subtitle?: string): Promise<void> {
  await expect(page.getByTestId('shell-admin-title')).toHaveText(title)
  if (subtitle === undefined) {
    await expect(page.getByTestId('shell-admin-subtitle')).toHaveCount(0)
  } else {
    await expect(page.getByTestId('shell-admin-subtitle')).toHaveText(subtitle)
  }
}

/** "Batal" and the submit button on one row, right-aligned in the form card. */
async function expectButtonRow(page: Page): Promise<void> {
  const cancel = await page.getByTestId('form-cancel').boundingBox()
  const submit = await page.getByTestId('form-submit').boundingBox()
  const card = await page.locator('form').first().boundingBox()
  expect(cancel && submit && card).toBeTruthy()
  expect(Math.abs(cancel!.y - submit!.y)).toBeLessThan(2)
  expect(cancel!.x).toBeLessThan(submit!.x)
  expect(card!.x + card!.width - (submit!.x + submit!.width)).toBeLessThan(40)
}

/** The selected option's label of a `<select>`. */
function selectedLabel(page: Page, testId: string): Promise<string> {
  return page
    .getByTestId(testId)
    .evaluate((el) => (el as HTMLSelectElement).selectedOptions[0]?.textContent?.trim() ?? '')
}

function optionLabels(page: Page, testId: string): Promise<string[]> {
  return page
    .getByTestId(testId)
    .evaluate((el) =>
      [...(el as HTMLSelectElement).options].map((o) => (o.textContent ?? '').trim()),
    )
}

// --- Banners (S9-S11) -------------------------------------------------------------------------------

test.describe('M09 S9 banner list', MODULE, () => {
  test('SRS §12 #35 header, table, rows in order and an unknown id @m09', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/banners')
    await expect(page.getByTestId('banner-row').first()).toBeVisible()
    await expectTabTitle(page, 'Pengurusan Banner - Admin PRESTASIPLUS')
    await expectHeader(page, 'Pengurusan Banner', 'Urus banner promosi dan pengumuman')
    await expect(page.getByText('Senarai Banner')).toBeVisible()
    await expect(page.getByTestId('banners-count')).toHaveText('Jumlah: 5 banner')
    await expect(page.getByTestId('banners-add')).toHaveAttribute('href', '/admin/banners/create')
    expect(
      await page
        .getByTestId('banners-th')
        .evaluateAll((els) => els.map((el) => (el as HTMLElement).innerText)),
    ).toEqual(['#', 'TAJUK', 'JENIS', 'SASARAN', 'SUSUNAN', 'MULA', 'TAMAT', 'AKTIF?', 'TINDAKAN'])

    const rows = page.getByTestId('banner-row')
    await expect(rows).toHaveCount(5)
    expect(
      await page.getByTestId('banner-type').evaluateAll((els) => els.map((e) => e.textContent)),
    ).toEqual(['HERO', 'FEATURE', 'PROMOTIONAL', 'ANNOUNCEMENT', 'FEATURE'])
    expect(
      await page.getByTestId('banner-audience').evaluateAll((els) => els.map((e) => e.textContent)),
    ).toEqual(['ALL', 'STUDENT', 'STUDENT', 'ALL', 'STUDENT'])

    const first = bannerRow(page, 1)
    await expect(first.getByTestId('banner-title')).toHaveText('Selamat Datang ke PRESTASIPLUS')
    await expect(first.getByTestId('banner-description')).toHaveText(
      'Platform pembelajaran interaktif untuk pelajar sek...',
    )
    await expect(first.getByTestId('banner-order')).toHaveText('1')
    await expect(first.getByTestId('banner-order')).toHaveClass(/rounded-md/)
    await expect(first.getByTestId('banner-start')).toHaveText('01/01/2026')
    await expect(first.getByTestId('banner-end')).toHaveText('31/12/2026')
    await expect(first.getByTestId('banner-active')).toHaveText('Aktif')
    await expect(first.getByTestId('banner-type')).toHaveClass(/bg-slate-100/)
    await expect(first.getByTestId('banner-edit')).toHaveAttribute('title', 'Edit')
    await expect(first.getByTestId('banner-edit')).toHaveAttribute('href', '/admin/banners/1/edit')
    await expect(first.getByTestId('banner-delete')).toHaveAttribute('title', 'Padam')
    await expect(page.locator('[title="Lihat"]')).toHaveCount(0)
    // No filter, search or pager.
    await expect(page.locator('main form, main input, main select')).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Pagination Navigation' })).toHaveCount(0)
    await expectNoHorizontalScroll(page)

    await gotoApp('/admin/banners/99/edit')
    await expect(page).toHaveURL(/\/admin\/banners$/)
    await expect(page.getByTestId('cmp-flash')).toContainText('Banner tidak dijumpai.')
    await expect(page.getByTestId('banner-row').first()).toBeVisible()
  })

  test('SRS §12 #72 the table scrolls inside its card below 1280, no sticky cell @m09', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/banners')
    await expect(page.getByTestId('banner-row').first()).toBeVisible()
    const metrics = await page.getByTestId('banners-table').evaluate((table) => {
      const card = table.closest('.overflow-x-auto') as HTMLElement
      return { scroll: card.scrollWidth, client: card.clientWidth }
    })
    if (viewportWidth(page) < 1280) expect(metrics.scroll).toBeGreaterThan(metrics.client)
    else expect(metrics.scroll).toBeLessThanOrEqual(metrics.client)
    const sticky = await page
      .locator('[data-testid="banners-table"] td, [data-testid="banners-table"] th')
      .evaluateAll((cells) => cells.some((c) => getComputedStyle(c).position === 'sticky'))
    expect(sticky).toBe(false)
    await expectNoHorizontalScroll(page)
    // The scroll reveals "TINDAKAN".
    await page.getByTestId('banners-th').last().scrollIntoViewIfNeeded()
    await expect(page.getByTestId('banners-th').last()).toBeInViewport()
  })

  test('SRS §12 #36 the delete confirm text; dismissing keeps the banner @m09', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/admin/banners')
    await expect(page.getByTestId('banner-row').first()).toBeVisible()
    const dialog = dismissNextDialog(page, {
      type: 'confirm',
      message: 'Adakah anda pasti mahu padam banner ini?',
    })
    await bannerRow(page, 1).getByTestId('banner-delete').click()
    await dialog
    expect(await mock.requests('DELETE /api/admin/banners/1')).toHaveLength(0)
    await expect(page.getByTestId('banners-count')).toHaveText('Jumlah: 5 banner')
    await expect(bannerRow(page, 1)).toBeVisible()
  })

  test(
    'SRS §12 #36 accepting the confirm deletes the banner and shows a flash @m09',
    provisional('the delete result and flash are INFERRED (L-1)'),
    async ({ page, gotoApp }) => {
      await gotoApp('/admin/banners')
      await expect(page.getByTestId('banner-row').first()).toBeVisible()
      const dialog = acceptNextDialog(page, { type: 'confirm' })
      await bannerRow(page, 5).getByTestId('banner-delete').click()
      await dialog
      await expect(bannerRow(page, 5)).toHaveCount(0)
      await expect(page.getByTestId('banners-count')).toHaveText('Jumlah: 4 banner')
      await expect(page.getByTestId('cmp-flash')).toBeVisible()
    },
  )
})

test.describe('M09 S10 create banner', MODULE, () => {
  test('SRS §12 #37 header, labels, placeholders, hints and defaults @m09', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/banners/create')
    await expect(page.getByTestId('banner-form')).toBeVisible()
    await expectTabTitle(page, 'Tambah Banner - Admin PRESTASIPLUS')
    await expectHeader(page, 'Tambah Banner Baru', 'Cipta banner promosi atau pengumuman')
    await expect(page.getByTestId('banner-back')).toHaveText('Kembali ke Senarai')
    await expect(page.getByTestId('banner-back')).toHaveAttribute('href', '/admin/banners')
    await expect(page.getByTestId('banner-title')).toHaveAttribute(
      'placeholder',
      'cth: Promosi SPM 2024',
    )
    await expect(page.getByTestId('banner-description')).toHaveAttribute(
      'placeholder',
      'Penerangan ringkas tentang banner',
    )
    await expect(page.getByTestId('banner-image-url')).toHaveAttribute(
      'placeholder',
      'https://example.com/image.jpg',
    )
    await expect(page.getByText('Masukkan URL gambar banner')).toBeVisible()
    await expect(page.getByText('Nombor lebih kecil akan dipaparkan dahulu')).toBeVisible()
    await expect(page.getByText('Tandakan untuk memaparkan banner')).toBeVisible()
    expect(await optionLabels(page, 'banner-type')).toEqual([
      'Pilih jenis banner',
      'Hero',
      'Promo',
      'Pengumuman',
      'Acara',
    ])
    expect(await optionLabels(page, 'banner-link-type')).toEqual([
      'Tiada Pautan',
      'Subjek',
      'Kuiz',
      'Artikel',
      'Pautan Luar',
    ])
    expect(await optionLabels(page, 'banner-audience')).toEqual([
      'Semua',
      'Pelajar',
      'Guru',
      'Admin',
    ])
    await expect(page.getByTestId('banner-order')).toHaveValue('0')
    await expect(page.getByTestId('banner-active')).toBeChecked()
    await expect(page.getByTestId('form-submit')).toHaveText('Simpan Banner')
    await expectButtonRow(page)
    await expectTouchTarget(page.getByTestId('form-submit'))
    await expectTouchTarget(page.getByTestId('form-cancel'))
    await expectNoHorizontalScroll(page)
  })

  test('SRS §12 #37 "Pautan Luar" shows the URL input and keeps its value @m09', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/banners/create')
    const external = page.getByTestId('banner-external-url')
    await expect(external).toBeHidden()
    for (const value of ['subject', 'quiz', 'article']) {
      await page.getByTestId('banner-link-type').selectOption(value)
      await expect(external).toBeHidden()
    }
    await page.getByTestId('banner-link-type').selectOption('external')
    await expect(external).toBeVisible()
    await expect(external).toHaveAttribute('placeholder', 'https://example.com')
    await external.fill('https://contoh.example/promo')
    await page.getByTestId('banner-link-type').selectOption('none')
    await expect(external).toBeHidden()
    await page.getByTestId('banner-link-type').selectOption('external')
    await expect(external).toHaveValue('https://contoh.example/promo')
  })

  test('SRS §12 #37 an empty submit is blocked on title and banner_type @m09', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/admin/banners/create')
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL(/\/admin\/banners\/create$/)
    const invalid = await page
      .getByTestId('banner-form')
      .evaluate((form) =>
        [...(form as HTMLFormElement).elements]
          .filter((el) => !(el as HTMLInputElement).checkValidity())
          .map((el) => (el as HTMLInputElement).name),
      )
    expect(invalid).toEqual(['title', 'banner_type'])
    expect(
      await page
        .getByTestId('banner-title')
        .evaluate((el) => (el as HTMLInputElement).validity.valueMissing),
    ).toBe(true)
    expect(await mock.requests('POST /api/admin/banners')).toHaveLength(0)
  })

  test(
    'SRS §12 #38 saving a banner adds a row; externalUrl is not sent unless "Pautan Luar" @m09',
    provisional('the save result and flash are INFERRED (L-1)'),
    async ({ page, gotoApp, mock }) => {
      await gotoApp('/admin/banners/create')
      await page.getByTestId('banner-title').fill('Pengumuman Ujian')
      await page.getByTestId('banner-external-url').evaluate((el) => {
        ;(el as HTMLInputElement).value = 'https://tidak.dihantar.example'
        el.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await page.getByTestId('banner-type').selectOption('announcement')
      await page.getByTestId('banner-audience').selectOption('all')
      await page.getByTestId('banner-order').fill('6')
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL(/\/admin\/banners$/)
      await expect(page.getByTestId('cmp-flash')).toBeVisible()
      const row = bannerRow(page, 6)
      await expect(row.getByTestId('banner-type')).toHaveText('ANNOUNCEMENT')
      await expect(row.getByTestId('banner-audience')).toHaveText('ALL')
      await expect(row.getByTestId('banner-order')).toHaveText('6')
      await expect(page.getByTestId('banners-count')).toHaveText('Jumlah: 6 banner')
      const body = (await mock.lastRequest('POST /api/admin/banners'))?.body as Record<
        string,
        unknown
      >
      expect(body).toBeTruthy()
      expect('externalUrl' in body).toBe(false)
    },
  )
})

test.describe('M09 S11 edit banner', MODULE, () => {
  test('SRS §12 #39 the selects show the stored values (DV-M09-07) @m09', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/banners/1/edit')
    await expect(page.getByTestId('banner-form')).toBeVisible()
    await expectTabTitle(page, 'Edit Banner - Admin PRESTASIPLUS')
    await expectHeader(page, 'Edit Banner', 'Kemaskini maklumat banner')
    await expect(page.getByTestId('banner-title')).toHaveValue('Selamat Datang ke PRESTASIPLUS')
    await expect(page.getByTestId('banner-order')).toHaveValue('1')
    await expect(page.getByTestId('banner-start')).toHaveValue('2026-01-01')
    await expect(page.getByTestId('banner-end')).toHaveValue('2026-12-31')
    await expect(page.getByTestId('banner-active')).toBeChecked()
    expect(await selectedLabel(page, 'banner-type')).toBe('Hero')
    expect(await selectedLabel(page, 'banner-link-type')).toBe('Tiada Pautan')
    expect(await selectedLabel(page, 'banner-audience')).toBe('Semua')
    expect(await optionLabels(page, 'banner-type')).not.toContain('FEATURE')
    expect(
      await page.getByTestId('banner-form').evaluate((f) => (f as HTMLFormElement).checkValidity()),
    ).toBe(true)
    await expect(page.getByTestId('form-submit')).toHaveText('Kemaskini Banner')
    await expect(page.getByTestId('form-cancel')).toHaveAttribute('href', '/admin/banners')
    await expectButtonRow(page)

    await gotoApp('/admin/banners/2/edit')
    await expect(page.getByTestId('banner-form')).toBeVisible()
    expect(await selectedLabel(page, 'banner-type')).toBe('FEATURE')
    expect(await optionLabels(page, 'banner-type')).toContain('FEATURE')
    expect(await selectedLabel(page, 'banner-audience')).toBe('Pelajar')
    expect(
      await page.getByTestId('banner-form').evaluate((f) => (f as HTMLFormElement).checkValidity()),
    ).toBe(true)
    await expectNoHorizontalScroll(page)

    await gotoApp('/admin/banners/create')
    await expect(page.getByTestId('banner-form')).toBeVisible()
    expect(await optionLabels(page, 'banner-type')).not.toContain('FEATURE')
  })

  test(
    'SRS §12 #39 saving unchanged keeps the stored codes @m09',
    provisional('the save result and flash are INFERRED (L-1)'),
    async ({ page, gotoApp, mock }) => {
      await gotoApp('/admin/banners/2/edit')
      await expect(page.getByTestId('banner-form')).toBeVisible()
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL(/\/admin\/banners$/)
      await expect(page.getByTestId('cmp-flash')).toBeVisible()
      const body = (await mock.lastRequest('PUT /api/admin/banners/2'))?.body as Record<
        string,
        unknown
      >
      expect(body).toMatchObject({
        bannerType: 'FEATURE',
        targetAudience: 'STUDENT',
        linkType: 'NONE',
      })
      const row = bannerRow(page, 2)
      await expect(row.getByTestId('banner-type')).toHaveText('FEATURE')
      await expect(row.getByTestId('banner-audience')).toHaveText('STUDENT')
    },
  )

  test('SRS §12 #39 "Batal" returns to the unchanged list @m09', async ({ page, gotoApp }) => {
    await gotoApp('/admin/banners/3/edit')
    await expect(page.getByTestId('banner-form')).toBeVisible()
    await page.getByTestId('banner-title').fill('Diubah tetapi dibatalkan')
    await page.getByTestId('form-cancel').click()
    await expect(page).toHaveURL(/\/admin\/banners$/)
    await expect(bannerRow(page, 3).getByTestId('banner-title')).toHaveText(
      'Cabaran Mingguan: Siapa Paling Rajin?',
    )
  })
})

// --- Audio KBAT (S12-S13) ---------------------------------------------------------------------------

/** Fills the required fields of S13 with filler text and saves with `status`. */
async function createSet(page: Page, title: string, status: string): Promise<void> {
  await page.getByTestId('set-title').fill(title)
  await page.getByTestId('set-level').selectOption({ label: 'Tingkatan 4' })
  await page.getByTestId('set-subject').selectOption({ label: 'Bahasa Melayu' })
  await page.getByTestId('set-status').selectOption({ label: status })
  await page.getByTestId('audio-form').evaluate((form) => {
    for (const el of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input[required], textarea[required]',
    )) {
      el.value = el.value || 'Isi ujian'
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  await page.getByTestId('audio-submit').click()
}

test.describe('M09 S12 Audio KBAT set list', MODULE, () => {
  test('SRS §12 #41 header, intro, links, guide, stats and filter @m09', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/audio-kbat')
    await expect(page.getByTestId('audio-list-page')).toBeVisible()
    await expectTabTitle(page, 'Set Audio KBAT')
    await expectHeader(page, 'Set Audio KBAT')
    await expect(page.getByText('Dashboard', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Selamat datang, Admin')).toHaveCount(0)
    const list = page.getByTestId('audio-list-page')
    await expect(list.getByText('Ujian Mendengar')).toBeVisible()
    await expect(list.locator('h1')).toHaveText('Set Audio KBAT')
    await expect(
      list.getByText('Senarai set soalan audio berturutan tetap, bukan rawak.'),
    ).toBeVisible()
    await expect(page.getByTestId('template-xlsx')).toHaveText('Templat XLSX')
    await expect(page.getByTestId('template-xlsx')).toHaveAttribute(
      'href',
      '/admin/audio-kbat/template',
    )
    await expect(page.getByTestId('template-word')).toHaveText('Templat Word')
    await expect(page.getByTestId('template-word')).toHaveAttribute(
      'href',
      '/admin/audio-kbat/template-word',
    )
    await expect(page.getByTestId('audio-create')).toHaveText('Cipta Set')
    await expect(page.getByTestId('audio-create')).toHaveAttribute(
      'href',
      '/admin/audio-kbat/create',
    )
    const guide = page.getByTestId('audio-guide')
    await expect(guide).toContainText(
      'Panduan ringkas untuk cikgu yang ingin sumbang soalan Audio KBAT',
    )
    await expect(guide).toContainText(
      'Set ini bukan soalan rawak. Cikgu perlu bekalkan satu set lengkap 30 soalan MCQ bersama 4 fail audio mengikut julat tetap: audio 1 untuk soalan 1-8, audio 2 untuk soalan 9-16, audio 3 untuk soalan 17-24 dan audio 4 untuk soalan 25-30.',
    )
    await expect(guide).toContainText(
      'Jika cikgu mahu bahan yang mudah ditaip, gunakan Templat Word. Jika mahu format paling senang diimport oleh admin, gunakan Templat XLSX. Nama fail audio dalam template mesti sama dengan fail audio yang dihantar.',
    )
    const stats = page.getByTestId('audio-stats')
    await expect(stats).toContainText('Set')
    await expect(stats).toContainText('Approved')
    await expect(stats).toContainText('Draf/Menunggu')
    await expect(stats).toContainText('Soalan')
    expect(
      await page
        .getByTestId('stat-value')
        .evaluateAll((els) => els.map((e) => e.textContent?.trim())),
    ).toEqual(['0', '0', '0', '0'])

    const levels = await optionLabels(page, 'filter-level')
    expect(levels).toHaveLength(12)
    expect(levels.slice(0, 2)).toEqual(['Semua Tahap', 'Darjah 1'])
    expect(levels[11]).toBe('Tingkatan 5')
    const subjects = await optionLabels(page, 'filter-subject')
    expect(subjects).toHaveLength(32)
    expect(subjects[0]).toBe('Semua Subjek')
    expect(subjects[1]).toBe('Bahasa Arab')
    expect(subjects.slice(1)).toEqual(
      [...subjects.slice(1)].sort((a, b) => a.localeCompare(b, 'ms')),
    )
    expect(await optionLabels(page, 'filter-status')).toEqual([
      'Semua Status',
      'Draf',
      'Menunggu Semakan',
      'Diluluskan',
      'Diarkibkan',
    ])
    await expect(page.getByTestId('filter-search')).toHaveAttribute(
      'placeholder',
      'Cari tajuk/sumber...',
    )
    await expect(page.getByTestId('audio-empty')).toHaveText('Belum ada set Audio KBAT.')
    await expectNoHorizontalScroll(page)
  })

  test('SRS §12 #41 "Tapis" keeps the filter values and shows the empty state @m09', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/audio-kbat')
    await expect(page.getByTestId('audio-list-page')).toBeVisible()
    await page.getByTestId('filter-level').selectOption({ label: 'Tingkatan 4' })
    await page.getByTestId('filter-subject').selectOption({ label: 'Matematik' })
    await page.getByTestId('filter-status').selectOption({ label: 'Diluluskan' })
    await page.getByTestId('filter-search').fill('sifir')
    await page.getByTestId('filter-submit').click()
    await expect(page).toHaveURL(
      /\/admin\/audio-kbat\?education_level_id=10&subject_id=3&status=approved&search=sifir$/,
    )
    expect(await selectedLabel(page, 'filter-level')).toBe('Tingkatan 4')
    expect(await selectedLabel(page, 'filter-subject')).toBe('Matematik')
    expect(await selectedLabel(page, 'filter-status')).toBe('Approved')
    await expect(page.getByTestId('filter-search')).toHaveValue('sifir')
    await expect(page.getByTestId('audio-empty')).toHaveText('Belum ada set Audio KBAT.')
    await expect(page.getByTestId('stat-value').first()).toHaveText('0')
  })

  test('SRS §12 #41 the two template links download the placeholder files @m09', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/audio-kbat')
    await expect(page.getByTestId('audio-list-page')).toBeVisible()
    const xlsx = page.waitForEvent('download')
    await page.getByTestId('template-xlsx').click()
    expect((await xlsx).suggestedFilename()).toBe('templat-audio-kbat.xlsx')
    const word = page.waitForEvent('download')
    await page.getByTestId('template-word').click()
    expect((await word).suggestedFilename()).toBe('templat-audio-kbat.docx')
    await expect(page).toHaveURL(/\/admin\/audio-kbat$/)
  })

  test('SRS §12 #41 the template URLs download and return to the list @m09', async ({
    page,
    gotoApp,
  }) => {
    for (const [path, name] of [
      ['/admin/audio-kbat/template', 'templat-audio-kbat.xlsx'],
      ['/admin/audio-kbat/template-word', 'templat-audio-kbat.docx'],
    ] as const) {
      const download = page.waitForEvent('download')
      await gotoApp(path)
      expect((await download).suggestedFilename()).toBe(name)
      await expect(page).toHaveURL(/\/admin\/audio-kbat$/)
      await expect(page.getByTestId('audio-list-page')).toBeVisible()
    }
  })

  test(
    'SRS §12 #42 two sets: stats, rows and the status filter @m09',
    provisional('the set rows and the counting are INFERRED (L-3); sets are made through S13'),
    async ({ page, gotoApp }) => {
      await gotoApp('/admin/audio-kbat/create')
      await createSet(page, 'Set Lulus 1', 'Approved')
      await expect(page).toHaveURL(/\/admin\/audio-kbat$/)
      await gotoApp('/admin/audio-kbat/create')
      await createSet(page, 'Set Draf 2', 'Draft')
      await expect(page).toHaveURL(/\/admin\/audio-kbat$/)
      expect(
        await page
          .getByTestId('stat-value')
          .evaluateAll((els) => els.map((e) => e.textContent?.trim())),
      ).toEqual(['2', '1', '1', '60'])
      await expect(page.getByTestId('audio-set')).toHaveCount(2)
      const first = page.getByTestId('audio-set').first()
      await expect(first.getByTestId('set-level')).toHaveText('Tingkatan 4')
      await expect(first.getByTestId('set-subject')).toHaveText('Bahasa Melayu')
      await expect(first.getByTestId('set-questions')).toHaveText('30 soalan')
      await gotoApp('/admin/audio-kbat?status=approved')
      await expect(page.getByTestId('audio-set')).toHaveCount(1)
      await expect(page.getByTestId('set-status')).toHaveText('Approved')
      // The stat cards stay global while filtered.
      await expect(page.getByTestId('stat-value').first()).toHaveText('2')
    },
  )
})

test.describe('M09 S13 create Audio KBAT set', MODULE, () => {
  test('SRS §12 #43 header, box, defaults, sections and 30 question blocks @m09', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/audio-kbat/create')
    await expect(page.getByTestId('audio-form')).toBeVisible()
    await expectTabTitle(page, 'Cipta Set Audio KBAT')
    await expectHeader(page, 'Cipta Set Audio KBAT')
    await expect(page.getByText('Dashboard', { exact: true })).toHaveCount(0)
    await expect(page.getByTestId('audio-back')).toHaveText('Kembali')
    await expect(page.getByTestId('audio-back')).toHaveAttribute('href', '/admin/audio-kbat')
    await expect(page.getByTestId('audio-create-page').locator('h1')).toHaveText(
      'Cipta Set Audio KBAT',
    )
    await expect(page.getByText('Format tetap: 4 bahagian audio, 30 soalan MCQ')).toBeVisible()
    const guide = page.getByTestId('audio-guide')
    await expect(guide).toContainText('Apa yang cikgu perlu sediakan?')
    await expect(guide).toContainText('Lengkapkan 30 soalan mengikut turutan asal.')
    await expect(guide).toContainText('Jika cikgu bekalkan bahan luar talian')
    await expect(guide.getByTestId('template-word')).toHaveAttribute(
      'href',
      '/admin/audio-kbat/template-word',
    )
    await expect(guide.getByTestId('template-xlsx')).toHaveAttribute(
      'href',
      '/admin/audio-kbat/template',
    )
    // DV-M09-20: the box links are readable (not near-white on the pale box).
    const linkColour = await guide
      .getByTestId('template-word')
      .evaluate((el) => getComputedStyle(el).color)
    expect(linkColour).not.toBe('rgb(255, 255, 255)')

    await expect(page.getByTestId('set-title')).toHaveAttribute(
      'placeholder',
      'Contoh: BM T4 Ujian Mendengar Set 1',
    )
    expect(await selectedLabel(page, 'set-status')).toBe('Approved')
    expect(await optionLabels(page, 'set-status')).toEqual(['Approved', 'Pending Review', 'Draft'])
    expect(await optionLabels(page, 'set-level')).toHaveLength(12)
    expect((await optionLabels(page, 'set-subject'))[1]).toBe('Bahasa Arab')
    await expect(page.getByTestId('set-source')).toHaveAttribute(
      'placeholder',
      'Contoh: Cikgu Demo 02',
    )
    await expect(page.getByTestId('set-instructions')).toHaveAttribute(
      'placeholder',
      'Dengar audio bagi setiap bahagian dan jawab semua soalan.',
    )

    const titles = await page.getByTestId('section-card').locator('h2').allTextContents()
    expect(titles.map((s) => s.trim())).toEqual([
      'Bahagian 1 · Soalan 1-8',
      'Bahagian 2 · Soalan 9-16',
      'Bahagian 3 · Soalan 17-24',
      'Bahagian 4 · Soalan 25-30',
    ])
    expect(
      await page
        .getByTestId('section-title')
        .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value)),
    ).toEqual(['Audio 1', 'Audio 2', 'Audio 3', 'Audio 4'])
    const audio = page.getByTestId('section-audio').first()
    await expect(audio).toHaveAttribute('accept', '.mp3,.m4a,.wav,.ogg,.aac,.mp4,audio/*')
    expect(await audio.evaluate((el) => (el as HTMLInputElement).required)).toBe(false)
    // 8 / 8 / 8 / 6 questions follow their section.
    const layout = await page.getByTestId('audio-form').evaluate((form) => {
      const counts: number[] = []
      for (const el of form.querySelectorAll(
        '[data-testid="section-card"], [data-testid="question-block"]',
      )) {
        if (el.getAttribute('data-testid') === 'section-card') counts.push(0)
        else counts[counts.length - 1] = (counts[counts.length - 1] ?? 0) + 1
      }
      return counts
    })
    expect(layout).toEqual([8, 8, 8, 6])
    await expect(page.getByTestId('question-block')).toHaveCount(30)
    const q1 = page.getByTestId('question-block').first()
    await expect(q1).toContainText('Soalan 1')
    await expect(q1).toContainText('KBAT Audio')
    await expect(q1.getByTestId('q-answer')).toHaveValue('A')
    await expect(q1.getByTestId('q-marks')).toHaveValue('1')
    await expect(q1.getByTestId('q-marks')).toHaveAttribute('min', '1')
    await expect(q1.getByTestId('q-marks')).toHaveAttribute('max', '20')
    await expect(q1.getByTestId('q-kbat')).toHaveValue('3')
    await expect(q1.getByTestId('q-kbat')).toHaveAttribute('max', '5')
    await expect(q1.getByTestId('q-dskp')).toHaveAttribute('placeholder', 'Pilihan')
    await expect(page.getByTestId('question-block').last()).toContainText('Soalan 30')

    // Options: one column below md, two from md.
    await q1.scrollIntoViewIfNeeded()
    const a = await q1.getByTestId('q-optionA').boundingBox()
    const b = await q1.getByTestId('q-optionB').boundingBox()
    expect(a && b).toBeTruthy()
    if (viewportWidth(page) < 768) expect(Math.abs(a!.x - b!.x)).toBeLessThan(2)
    else expect(b!.x).toBeGreaterThan(a!.x + 50)
    await expect(page.getByRole('link', { name: 'Batal' })).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('SRS §12 #43 an empty submit leaves 153 invalid fields and sends nothing @m09', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/admin/audio-kbat/create')
    await expect(page.getByTestId('audio-form')).toBeVisible()
    await page.getByTestId('audio-submit').click()
    await expect(page).toHaveURL(/\/admin\/audio-kbat\/create$/)
    const invalid = await page
      .getByTestId('audio-form')
      .evaluate(
        (form) =>
          [...(form as HTMLFormElement).elements].filter(
            (el) => !(el as HTMLInputElement).checkValidity(),
          ).length,
      )
    expect(invalid).toBe(153)
    expect(await mock.requests('POST /api/admin/audio-kbat-sets')).toHaveLength(0)
  })

  test('SRS §12 #43 the save button stays visible while scrolling (sticky, bottom right) @m09', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/audio-kbat/create')
    await expect(page.getByTestId('audio-form')).toBeVisible()
    const submit = page.getByTestId('audio-submit')
    await expect(submit).toHaveText('Simpan Set Audio KBAT')
    await expect(submit).toBeInViewport()
    await page.evaluate(() => window.scrollTo(0, 3000))
    await expect(submit).toBeInViewport()
    const box = await submit.boundingBox()
    expect(box).toBeTruthy()
    // Right-aligned: its right edge is within the card's right padding of the viewport.
    expect(viewportWidth(page) - (box!.x + box!.width)).toBeLessThan(80)
    await expectTouchTarget(submit)
    await expectNoHorizontalScroll(page)
  })

  test(
    'SRS §12 #44 saving a complete set returns to the list with a flash and the stats @m09',
    provisional('the save result and flash are INFERRED (L-1, L-3)'),
    async ({ page, gotoApp }) => {
      await gotoApp('/admin/audio-kbat/create')
      await expect(page.getByTestId('audio-form')).toBeVisible()
      await createSet(page, 'BM T4 Ujian Mendengar Set 1', 'Approved')
      await expect(page).toHaveURL(/\/admin\/audio-kbat$/)
      await expect(page.getByTestId('cmp-flash')).toBeVisible()
      expect(
        await page
          .getByTestId('stat-value')
          .evaluateAll((els) => els.map((e) => e.textContent?.trim())),
      ).toEqual(['1', '1', '0', '30'])
      await expect(page.getByTestId('audio-set')).toHaveCount(1)
      await expect(page.getByTestId('set-title')).toHaveText('BM T4 Ujian Mendengar Set 1')
    },
  )
})

// --- Screenshots (S14) ------------------------------------------------------------------------------

test.describe('M09 S14 screenshot upload', MODULE, () => {
  test('SRS §12 #69 header, texts, drop zone, hidden input and the empty list @m09', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/tools/screenshots')
    await expect(page.getByTestId('screenshots-page')).toBeVisible()
    await expectTabTitle(page, 'Muat Naik Tangkapan Skrin - Admin PRESTASIPLUS')
    await expectHeader(page, 'Muat Naik Tangkapan Skrin', 'Alat admin untuk muat naik & urus gambar (peribadi)')
    await expect(page.getByText('Muat Naik Gambar')).toBeVisible()
    await expect(
      page.getByText('Format: JPG, PNG, GIF, WebP, BMP. Maks 10MB setiap fail.'),
    ).toBeVisible()
    const zone = page.getByTestId('drop-zone')
    await expect(zone).toContainText('Klik atau seret fail ke sini')
    await expect(zone).toContainText('Boleh pilih banyak fail')
    await expect(
      page.getByText('Petua: guna nama fail yang ringkas. Sistem akan membersihkan nama fail secara automatik.'),
    ).toBeVisible()
    const input = page.getByTestId('file-input')
    await expect(input).toHaveAttribute('accept', 'image/*')
    expect(await input.evaluate((el) => (el as HTMLInputElement).multiple)).toBe(true)
    await zone.dispatchEvent('dragover')
    await expect(zone).toHaveClass(/border-indigo-400/)
    await expect(zone).toHaveClass(/bg-indigo-50/)
    await zone.dispatchEvent('dragleave')
    await expect(zone).not.toHaveClass(/bg-indigo-50/)
    await expect(page.getByText('Fail Sedia Ada')).toBeVisible()
    await expect(page.getByTestId('files-count')).toHaveText('Jumlah: 0 fail')
    await expect(page.getByTestId('files-empty')).toHaveText('Tiada fail lagi.')
    await expectNoHorizontalScroll(page)
  })

  test(
    'SRS §12 #69 choosing a file uploads at once and lists it by its sanitised name @m09',
    provisional('the upload result, list and flash are INFERRED (L-5)'),
    async ({ page, gotoApp }) => {
      await gotoApp('/admin/tools/screenshots')
      await expect(page.getByTestId('screenshots-page')).toBeVisible()
      await page.getByTestId('file-input').setInputFiles({
        name: 'Gambar Saya (1).PNG',
        mimeType: 'image/png',
        buffer: Buffer.from('png'),
      })
      await expect(page.getByTestId('files-count')).toHaveText('Jumlah: 1 fail')
      await expect(page.getByTestId('file-item')).toHaveText('gambar-saya-1.png')
      await expect(page.getByTestId('cmp-flash')).toBeVisible()
      await expect(page.getByTestId('cmp-flash')).toHaveAttribute('data-variant', 'success')
    },
  )

  test(
    'SRS §12 #69 a 12 MB file is refused with an error flash @m09',
    provisional('the refusal copy and the size rule are INFERRED (L-5)'),
    async ({ page, gotoApp }) => {
      await gotoApp('/admin/tools/screenshots')
      await expect(page.getByTestId('screenshots-page')).toBeVisible()
      await page.getByTestId('file-input').setInputFiles({
        name: 'besar.png',
        mimeType: 'image/png',
        buffer: Buffer.alloc(12 * 1024 * 1024),
      })
      await expect(page.getByTestId('cmp-flash')).toHaveAttribute('data-variant', 'error')
      await expect(page.getByTestId('files-count')).toHaveText('Jumlah: 0 fail')
    },
  )
})

// --- Responsive sweep (S9-S14 part of #72) ----------------------------------------------------------

test.describe('M09 S9-S14 responsive', MODULE, () => {
  test('SRS §12 #72 no horizontal page scroll on S9-S14 and the touch targets @m09', async ({
    page,
    gotoApp,
  }) => {
    const pages: [string, string][] = [
      ['/admin/banners', 'banner-row'],
      ['/admin/banners/create', 'banner-form'],
      ['/admin/banners/1/edit', 'banner-form'],
      ['/admin/audio-kbat', 'audio-list-page'],
      ['/admin/audio-kbat/create', 'audio-form'],
      ['/admin/tools/screenshots', 'screenshots-page'],
    ]
    for (const [path, ready] of pages) {
      await gotoApp(path)
      await expect(page.getByTestId(ready).first()).toBeVisible()
      await expectNoHorizontalScroll(page)
    }
    if (!isDesktopShell(page)) {
      await gotoApp('/admin/banners')
      await expect(page.getByTestId('banner-row').first()).toBeVisible()
      await expectTouchTarget(page.getByTestId('banner-edit').first())
      await expectTouchTarget(page.getByTestId('banner-delete').first())
      await expectTouchTarget(page.getByTestId('banners-add'))
      await gotoApp('/admin/audio-kbat')
      await expect(page.getByTestId('audio-list-page')).toBeVisible()
      await expectTouchTarget(page.getByTestId('filter-submit'))
      await expectTouchTarget(page.getByTestId('template-xlsx'))
      await expectTouchTarget(page.getByTestId('audio-create'))
    }
  })
})
