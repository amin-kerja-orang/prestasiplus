/**
 * M09 admin articles (S1-S4) and notes (S5-S8) at 375 / 768 / 1280 as `admin@demo.test`
 * (SRS M09 §12 scenarios 01..14 and 28..34; the titles carry "SRS §12 #nn", not the E2E ids: developer specs trace no ids before G5). Seeds are SRS §6.9. Steps that need the reader pages
 * (`/artikel`, `/dashboard`) belong to the reader tasks and are not asserted here. Flash texts are
 * PROPOSED COPY (SRS §8.2): the provisional tests assert that a flash appears, never its words.
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
  isMobileWidth,
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

function articleRow(page: Page, id: number) {
  return page.locator(`[data-testid="admin-article-row"][data-article-id="${String(id)}"]`)
}

function noteRow(page: Page, id: number) {
  return page.locator(`[data-testid="admin-note-row"][data-note-id="${String(id)}"]`)
}

async function articleIds(page: Page): Promise<number[]> {
  return page
    .getByTestId('admin-article-row')
    .evaluateAll((els) => els.map((el) => Number((el as HTMLElement).dataset.articleId)))
}

async function noteIds(page: Page): Promise<number[]> {
  return page
    .getByTestId('admin-note-row')
    .evaluateAll((els) => els.map((el) => Number((el as HTMLElement).dataset.noteId)))
}

async function expectHeader(page: Page, title: string, subtitle: string): Promise<void> {
  await expect(page.getByTestId('shell-admin-title')).toHaveText(title)
  await expect(page.getByTestId('shell-admin-subtitle')).toHaveText(subtitle)
}

/** "Batal" and the submit button on one row, right-aligned in the form card. */
async function expectButtonRow(page: Page): Promise<void> {
  const cancel = await page.getByTestId('form-cancel').boundingBox()
  const submit = await page.getByTestId('form-submit').boundingBox()
  const card = await page.locator('form[data-testid$="-form"]').boundingBox()
  expect(cancel && submit && card).toBeTruthy()
  expect(Math.abs(cancel!.y - submit!.y)).toBeLessThan(2)
  expect(cancel!.x).toBeLessThan(submit!.x)
  expect(card!.x + card!.width - (submit!.x + submit!.width)).toBeLessThan(40)
}

// --- Articles (S1-S4) -------------------------------------------------------------------------------

test.describe('M09 S1 article list', MODULE, () => {
  test('SRS §12 #01 default list, header, row 10 and the last page @m09', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/articles')
    await expect(page.getByTestId('admin-article-row').first()).toBeVisible()
    await expectTabTitle(page, 'Pengurusan Artikel - Admin PRESTASIPLUS')
    await expectHeader(page, 'Pengurusan Artikel', 'Urus artikel dan konten pendidikan')
    if (isDesktopShell(page)) {
      await expect(
        page.getByTestId('shell-admin-sidebar').getByRole('link', { name: 'Artikel' }),
      ).toBeVisible()
    }
    await expect(page.getByTestId('admin-articles-count')).toHaveText('Jumlah: 72 artikel')
    await expect(page.getByTestId('admin-articles-add')).toHaveAttribute(
      'href',
      '/admin/articles/create',
    )
    expect(
      await page
        .getByTestId('admin-articles-th')
        .evaluateAll((els) => els.map((el) => (el as HTMLElement).innerText)),
    ).toEqual(['TAJUK', 'KATEGORI', 'TAHAP', 'STATUS', 'VIEWS', 'TARIKH', 'TINDAKAN'])

    const ids = await articleIds(page)
    expect(ids).toHaveLength(20)
    expect(ids[0]).toBe(10)
    expect(ids[19]).toBe(29)

    const row = articleRow(page, 10)
    await expect(row.getByTestId('article-featured')).toHaveAttribute('title', 'Pilihan')
    await expect(row.getByTestId('article-title')).toContainText('Teknik Pomodoro')
    await expect(row.getByTestId('article-author')).toHaveText('Oleh: Admin Demo')
    await expect(row.getByTestId('article-category')).toHaveText('Petua Belajar')
    await expect(row.getByTestId('article-category')).toHaveClass(/bg-blue-100/)
    await expect(row.getByTestId('article-category')).toHaveClass(/text-blue-700/)
    await expect(row.getByTestId('article-grade')).toHaveText('DARJAH_4')
    await expect(row.getByTestId('status-pill')).toHaveText('Diterbitkan')
    await expect(row.getByTestId('article-views')).toHaveText('596')
    await expect(row.getByTestId('article-date')).toHaveText('22/02/2026')
    await expectNoHorizontalScroll(page)

    await gotoApp('/admin/articles?page=4')
    await expect(page.getByTestId('admin-article-row').first()).toBeVisible()
    expect(await articleIds(page)).toEqual([70, 71, 72, 9, 1, 2, 3, 4, 5, 6, 7, 8])
  })

  test('SRS §12 #02 filters keep their values and narrow the list @m09', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/articles')
    await expect(page.getByTestId('admin-article-row').first()).toBeVisible()
    await expect(page.getByTestId('admin-articles-search')).toHaveAttribute(
      'placeholder',
      'Cari artikel...',
    )
    await expect(page.getByTestId('admin-articles-category').locator('option')).toHaveCount(8)
    await expect(page.getByTestId('admin-articles-published').locator('option')).toHaveText([
      'Semua Status',
      'Diterbitkan',
      'Draf',
    ])

    await page.getByTestId('admin-articles-category').selectOption({ label: 'Motivasi' })
    await page.getByTestId('admin-articles-submit').click()
    await expect(page).toHaveURL(/category=MOTIVASI/)
    await expect(page.getByTestId('admin-articles-count')).toHaveText('Jumlah: 14 artikel')
    await expect(page.getByTestId('admin-articles-category')).toHaveValue('MOTIVASI')
    expect((await articleIds(page))[0]).toBe(25)
    for (const text of await page.getByTestId('article-category').allTextContents()) {
      expect(text).toBe('Motivasi')
    }

    await page.getByTestId('admin-articles-reset').click()
    await expect(page).toHaveURL(/\/admin\/articles$/)
    await expect(page.getByTestId('admin-articles-count')).toHaveText('Jumlah: 72 artikel')
    await expect(page.getByTestId('admin-articles-category')).toHaveValue('all')

    await page.getByTestId('admin-articles-search').fill('sifir')
    await page.getByTestId('admin-articles-submit').click()
    await expect(page.getByTestId('admin-articles-count')).toHaveText('Jumlah: 2 artikel')
    expect((await articleIds(page))[0]).toBe(17)

    await gotoApp('/admin/articles?published=1')
    await expect(page.getByTestId('admin-articles-count')).toHaveText('Jumlah: 72 artikel')
    await expect(page.getByTestId('admin-articles-published')).toHaveValue('1')
  })

  test('SRS §12 #03 the pager keeps the filters (DV-M09-03) @m09', async ({ page, gotoApp }) => {
    await gotoApp('/admin/articles?category=TIPS_BELAJAR')
    await expect(page.getByTestId('admin-articles-count')).toHaveText('Jumlah: 21 artikel')
    if (isMobileWidth(page)) {
      await expect(page.getByText('« Previous').first()).toBeVisible()
      expect(await page.getByRole('link', { name: '« Previous' }).count()).toBe(0)
      const next = page.getByRole('link', { name: 'Next »' })
      await expect(next).toHaveAttribute('href', '/admin/articles?category=TIPS_BELAJAR&page=2')
      await next.click()
    } else {
      await expect(page.getByText('Showing')).toContainText('Showing 1 to 20 of 21 results')
      const page2 = page.getByRole('link', { name: 'Go to page 2' })
      await expect(page2).toHaveAttribute('href', /category=TIPS_BELAJAR/)
      await page2.click()
    }
    await expect(page).toHaveURL(/category=TIPS_BELAJAR&page=2/)
    expect(await articleIds(page)).toEqual([8])
    await expect(page.getByTestId('admin-articles-count')).toHaveText('Jumlah: 21 artikel')
    const hrefs = await page
      .locator('nav[aria-label="Pagination Navigation"] a')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href')))
    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) expect(href).toContain('category=TIPS_BELAJAR')
    await expectNoHorizontalScroll(page)

    await gotoApp('/admin/articles')
    await expect(page.getByTestId('admin-article-row').first()).toBeVisible()
    if (!isMobileWidth(page)) {
      await expect(page.getByText('Showing')).toContainText('Showing 1 to 20 of 72 results')
      for (const n of [2, 3, 4]) {
        await expect(page.getByRole('link', { name: `Go to page ${String(n)}` })).toBeVisible()
      }
    }
  })

  test('SRS §12 #04 empty states @m09', async ({ page, gotoApp }) => {
    for (const url of ['/admin/articles?published=0', '/admin/articles?search=zzzqqq']) {
      await gotoApp(url)
      await expect(page.getByTestId('admin-articles-empty')).toContainText(
        'Tiada artikel dijumpai.',
      )
      await expect(page.getByTestId('admin-articles-count')).toHaveText('Jumlah: 0 artikel')
      await expect(page.locator('nav[aria-label="Pagination Navigation"]')).toHaveCount(0)
    }
    await expectNoHorizontalScroll(page)
  })

  test('SRS §12 #05 row actions and a cancelled delete @m09', async ({ page, gotoApp, mock }) => {
    await gotoApp('/admin/articles')
    const row = articleRow(page, 10)
    await expect(row).toBeVisible()
    await expect(row.getByTestId('row-view')).toHaveAttribute('href', '/admin/articles/10')
    await expect(row.getByTestId('row-view')).toHaveAttribute('title', 'Lihat')
    await expect(row.getByTestId('row-edit')).toHaveAttribute('href', '/admin/articles/10/edit')
    await expect(row.getByTestId('row-edit')).toHaveAttribute('title', 'Edit')
    if (viewportWidth(page) < 1024) {
      await expectTouchTarget(row.getByTestId('row-delete'))
      await expectTouchTarget(row.getByTestId('row-edit'))
    }
    const dialog = dismissNextDialog(page, {
      type: 'confirm',
      message: 'Adakah anda pasti mahu padam artikel ini?',
    })
    await row.getByTestId('row-delete').click()
    await dialog
    expect(await mock.requests('DELETE /api/admin/articles/10')).toHaveLength(0)
    await expect(row).toBeVisible()
  })

  test(
    'SRS §12 #06 deleting an article removes it and shows a flash @m09',
    provisional('the delete result and flash are INFERRED (L-1)'),
    async ({ page, gotoApp }) => {
      await gotoApp('/admin/articles')
      const dialog = acceptNextDialog(page, { type: 'confirm' })
      await articleRow(page, 10).getByTestId('row-delete').click()
      await dialog
      await expect(articleRow(page, 10)).toHaveCount(0)
      await expect(page.getByTestId('admin-articles-count')).toHaveText('Jumlah: 71 artikel')
      await expect(page.getByTestId('cmp-flash')).toBeVisible()
    },
  )

  test('SRS §12 #07 an unknown id returns to the list with the red flash @m09', async ({
    page,
    gotoApp,
  }) => {
    for (const url of [
      '/admin/articles/9999',
      '/admin/articles/9999/edit',
      '/admin/articles/categories',
    ]) {
      await gotoApp(url)
      await expect(page).toHaveURL(/\/admin\/articles$/)
      await expect(page.getByTestId('cmp-flash')).toContainText('Artikel tidak dijumpai.')
      await expect(page.getByTestId('admin-article-row').first()).toBeVisible()
    }
    await page.reload()
    await expect(page.getByTestId('admin-article-row').first()).toBeVisible()
    await expect(page.getByTestId('cmp-flash')).toHaveCount(0)
  })
})

test.describe('M09 S2 create article', MODULE, () => {
  test('SRS §12 #08 the form fields, labels and footer @m09', async ({ page, gotoApp }) => {
    await gotoApp('/admin/articles/create')
    await expect(page.getByTestId('admin-article-form')).toBeVisible()
    await expectTabTitle(page, 'Tambah Artikel - Admin PRESTASIPLUS')
    await expectHeader(page, 'Tambah Artikel Baru', 'Cipta artikel pendidikan baharu')
    await expect(page.getByTestId('back-link')).toHaveText('Kembali ke Senarai')
    await expect(page.getByTestId('back-link')).toHaveAttribute('href', '/admin/articles')

    const title = page.getByTestId('article-title')
    await expect(title).toHaveAttribute('required', '')
    await expect(title).toHaveAttribute('placeholder', 'cth: 10 Petua Belajar Matematik')
    await expect(page.getByTestId('article-excerpt')).toHaveAttribute(
      'placeholder',
      'Ringkasan artikel',
    )
    const content = page.getByTestId('article-content')
    expect(await content.evaluate((el) => el.tagName)).toBe('TEXTAREA')
    await expect(content).toHaveAttribute('rows', '15')
    await expect(content).toHaveAttribute('required', '')
    await expect(content).toHaveAttribute('placeholder', 'Tulis kandungan artikel di sini...')
    await expect(page.getByTestId('article-image')).toHaveAttribute('type', 'url')
    await expect(page.getByTestId('article-category')).toHaveAttribute('required', '')
    await expect(page.getByTestId('article-category').locator('option').first()).toHaveText(
      'Pilih kategori',
    )
    await expect(page.getByTestId('article-grade')).toHaveValue('SEMUA')
    await expect(page.getByTestId('article-published')).not.toBeChecked()
    await expect(page.getByTestId('article-featured')).not.toBeChecked()
    await expect(page.locator('.ql-toolbar, .ck-toolbar')).toHaveCount(0)
    await expect(page.getByTestId('form-submit')).toHaveText('Simpan Artikel')
    await expect(page.getByTestId('form-cancel')).toHaveText('Batal')
    await expectButtonRow(page)
    if (viewportWidth(page) < 768) {
      const a = await title.boundingBox()
      const b = await page.getByTestId('article-excerpt').boundingBox()
      expect(Math.abs(a!.x - b!.x)).toBeLessThan(2)
      await expectTouchTarget(page.getByTestId('form-submit'))
    }
    await expectNoHorizontalScroll(page)
  })

  test('SRS §12 #09 native validation blocks the submit and Batal discards @m09', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/admin/articles/create')
    await expect(page.getByTestId('admin-article-form')).toBeVisible()
    await page.getByTestId('form-submit').click()
    const invalid = (id: string) =>
      page.getByTestId(id).evaluate((el) => (el as HTMLInputElement).validity.valueMissing)
    expect(await invalid('article-title')).toBe(true)
    expect(await invalid('article-content')).toBe(true)
    expect(await invalid('article-category')).toBe(true)
    expect(await mock.requests('POST /api/admin/articles')).toHaveLength(0)

    await page.getByTestId('article-title').fill('Tajuk')
    await page.getByTestId('article-content').fill('<p>Isi</p>')
    expect(await invalid('article-title')).toBe(false)
    expect(await invalid('article-content')).toBe(false)
    expect(await invalid('article-category')).toBe(true)

    await page.getByTestId('form-cancel').click()
    await expect(page).toHaveURL(/\/admin\/articles$/)
    await expect(page.getByTestId('admin-articles-count')).toHaveText('Jumlah: 72 artikel')
  })

  test(
    'SRS §12 #10 saving a published article adds it to the list @m09',
    provisional(
      'the save result and flash are INFERRED (L-1); the reader checks belong to S15/S16',
    ),
    async ({ page, gotoApp }) => {
      await gotoApp('/admin/articles/create')
      await page.getByTestId('article-title').fill('Artikel Ujian Baharu')
      await page.getByTestId('article-content').fill('<h2>Tajuk</h2><p>Isi</p>')
      await page.getByTestId('article-category').selectOption({ label: 'Berita' })
      await page.getByTestId('article-published').check()
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL(/\/admin\/articles$/)
      await expect(page.getByTestId('cmp-flash')).toBeVisible()
      await expect(page.getByTestId('admin-articles-count')).toHaveText('Jumlah: 73 artikel')
    },
  )
})

test.describe('M09 S3 edit article', MODULE, () => {
  test('SRS §12 #11 edit pre-fills the saved values; Batal discards @m09', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/articles/10/edit')
    await expect(page.getByTestId('admin-article-form')).toBeVisible()
    await expectTabTitle(page, 'Edit Artikel - Admin PRESTASIPLUS')
    await expectHeader(page, 'Edit Artikel', 'Kemaskini artikel')
    await expect(page.getByTestId('article-title')).toHaveValue(/Teknik Pomodoro/)
    await expect(page.getByTestId('article-category')).toHaveValue('TIPS_BELAJAR')
    await expect(page.getByTestId('article-category').locator('option')).toHaveCount(7)
    await expect(page.getByTestId('article-grade')).toHaveValue('DARJAH_4')
    await expect(page.getByTestId('article-published')).toBeChecked()
    await expect(page.getByTestId('article-featured')).toBeChecked()
    expect(
      await page
        .getByTestId('admin-article-form')
        .evaluate((f) => (f as HTMLFormElement).checkValidity()),
    ).toBe(true)
    await expect(page.getByTestId('form-submit')).toHaveText('Kemaskini Artikel')
    await expectButtonRow(page)
    await expectNoHorizontalScroll(page)

    await gotoApp('/admin/articles/11/edit')
    await expect(page.getByTestId('article-grade')).toHaveValue('DARJAH_5')
    await expect(page.getByTestId('article-featured')).not.toBeChecked()
    await page.getByTestId('article-title').fill('Tajuk diubah')
    await page.getByTestId('form-cancel').click()
    await expect(page).toHaveURL(/\/admin\/articles$/)
    await gotoApp('/admin/articles/11/edit')
    await expect(page.getByTestId('article-title')).not.toHaveValue('Tajuk diubah')
  })

  test(
    'SRS §12 #12 ticking Featured on article 11 updates the list @m09',
    provisional(
      'the update result and flash are INFERRED (L-1); the /artikel HOT badge belongs to S15',
    ),
    async ({ page, gotoApp }) => {
      await gotoApp('/admin/articles/11/edit')
      await page.getByTestId('article-featured').check()
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL(/\/admin\/articles$/)
      await expect(page.getByTestId('cmp-flash')).toBeVisible()
      await expect(articleRow(page, 11).getByTestId('article-featured')).toBeVisible()
    },
  )
})

test.describe('M09 S4 preview article', MODULE, () => {
  test('SRS §12 #13 preview card and the escaped body @m09', async ({ page, gotoApp }) => {
    await gotoApp('/admin/articles/10')
    await expect(page.getByTestId('admin-article-card')).toBeVisible()
    await expectTabTitle(page, 'Lihat Artikel - Admin PRESTASIPLUS')
    await expect(page.getByTestId('shell-admin-title')).toContainText('Teknik Pomodoro')
    await expect(page.getByTestId('shell-admin-subtitle')).toHaveText('Paparan artikel')
    await expect(page.getByTestId('preview-author')).toHaveText('Admin Demo')
    await expect(page.getByTestId('preview-date')).toHaveText('22 Feb 2026')
    await expect(page.getByTestId('preview-views')).toHaveText('596 tontonan')
    await expect(page.getByTestId('status-pill')).toHaveText('Diterbitkan')
    await expect(page.getByTestId('preview-featured')).toHaveText('Pilihan')
    await expect(page.getByTestId('preview-edit')).toHaveAttribute(
      'href',
      '/admin/articles/10/edit',
    )
    const body = page.getByTestId('preview-body')
    expect(
      ((await body.innerText()) ?? '').startsWith('<h2>Apa Itu Teknik Pomodoro?</h2><p>'),
    ).toBe(true)
    await expect(body.locator('h2')).toHaveCount(0)

    await gotoApp('/admin/articles/11')
    await expect(page.getByTestId('admin-article-card')).toBeVisible()
    await expect(page.getByTestId('preview-featured')).toHaveCount(0)
    await expect(page.getByTestId('preview-author')).toHaveText('Cikgu Demo 01')
  })

  test('SRS §12 #14 the preview never scrolls sideways and never counts a view @m09', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/articles/10')
    await expect(page.getByTestId('admin-article-card')).toBeVisible()
    await expectNoHorizontalScroll(page)
    await gotoApp('/admin/articles/10')
    await expect(page.getByTestId('preview-views')).toHaveText('596 tontonan')
    await gotoApp('/admin/articles')
    await expect(articleRow(page, 10).getByTestId('article-views')).toHaveText('596')
  })
})

// --- Notes (S5-S8) ----------------------------------------------------------------------------------

test.describe('M09 S5 note list', MODULE, () => {
  test('SRS §12 #28 default list @m09', async ({ page, gotoApp }) => {
    await gotoApp('/admin/notes')
    await expect(page.getByTestId('admin-note-row').first()).toBeVisible()
    await expectTabTitle(page, 'Pengurusan Nota - Admin PRESTASIPLUS')
    await expectHeader(page, 'Pengurusan Nota', 'Urus nota pembelajaran dan sumber belajar')
    await expect(page.getByTestId('admin-notes-count')).toHaveText('Jumlah: 10 nota')
    await expect(page.getByTestId('admin-notes-add')).toHaveText('Tambah Nota')
    await expect(page.getByTestId('admin-notes-add')).toHaveAttribute('href', '/admin/notes/create')
    expect(await noteIds(page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    const row = noteRow(page, 1)
    await expect(row.getByTestId('note-title')).toContainText('Sifir 1 hingga 12')
    await expect(row.getByTestId('note-author')).toHaveText('Oleh: Admin Demo')
    await expect(row.getByTestId('note-subject')).toHaveText('MATEMATIK')
    await expect(row.getByTestId('note-type')).toHaveText('FORMULA')
    await expect(row.getByTestId('note-grade')).toHaveText('DARJAH 2')
    await expect(row.getByTestId('status-pill')).toHaveText('Diterbitkan')
    await expect(row.getByTestId('note-views')).toHaveText('0 tontonan')
    await expect(row.getByTestId('note-downloads')).toHaveText('0 muat turun')
    await expect(page.locator('nav[aria-label="Pagination Navigation"]')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('SRS §12 #29 filters, including the note-type mapping (DV-M09-06) @m09', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/notes')
    await expect(page.getByTestId('admin-note-row').first()).toBeVisible()

    await page.getByTestId('admin-notes-search').fill('sifir')
    await page.getByTestId('admin-notes-submit').click()
    await expect(page.getByTestId('admin-notes-count')).toHaveText('Jumlah: 1 nota')

    await gotoApp('/admin/notes?subject=matematik')
    await expect(page.getByTestId('admin-notes-count')).toHaveText('Jumlah: 3 nota')
    await expect(page.getByTestId('admin-notes-subject')).toHaveValue('matematik')

    const byType: [string, number, string][] = [
      ['Ringkasan', 5, 'RINGKASAN'],
      ['Nota Penuh', 2, 'LENGKAP'],
    ]
    for (const [label, count, stored] of byType) {
      await gotoApp('/admin/notes')
      await expect(page.getByTestId('admin-note-row').first()).toBeVisible()
      await page.getByTestId('admin-notes-type').selectOption({ label })
      await page.getByTestId('admin-notes-submit').click()
      await expect(page.getByTestId('admin-notes-count')).toHaveText(
        `Jumlah: ${String(count)} nota`,
      )
      for (const text of await page.getByTestId('note-type').allTextContents()) {
        expect(text).toBe(stored)
      }
    }
    for (const label of ['Peta Minda', 'Kad Imbas', 'Helaian Rujukan Pantas']) {
      await gotoApp('/admin/notes')
      await expect(page.getByTestId('admin-note-row').first()).toBeVisible()
      await page.getByTestId('admin-notes-type').selectOption({ label })
      await page.getByTestId('admin-notes-submit').click()
      await expect(page.getByTestId('admin-notes-empty')).toContainText('Tiada nota dijumpai.')
      await expect(page.getByTestId('admin-notes-count')).toHaveText('Jumlah: 0 nota')
      await expect(page.getByTestId('admin-notes-type').locator('option:checked')).toHaveText(label)
    }
    await page.getByTestId('admin-notes-reset').click()
    await expect(page).toHaveURL(/\/admin\/notes$/)
    await expect(page.getByTestId('admin-notes-count')).toHaveText('Jumlah: 10 nota')
  })

  test('SRS §12 #30 unknown id, row actions and delete @m09', async ({ page, gotoApp, mock }) => {
    await gotoApp('/admin/notes/9999')
    await expect(page).toHaveURL(/\/admin\/notes$/)
    await expect(page.getByTestId('admin-note-row').first()).toBeVisible()
    await expect(page.getByTestId('cmp-flash')).toHaveCount(0)

    const row = noteRow(page, 1)
    await expect(row.getByTestId('row-view')).toHaveAttribute('href', '/admin/notes/1')
    await expect(row.getByTestId('row-edit')).toHaveAttribute('href', '/admin/notes/1/edit')
    await row.getByTestId('row-edit').click()
    await expect(page).toHaveURL(/\/admin\/notes\/1\/edit$/)
    await expect(page.getByTestId('admin-note-form')).toBeVisible()
    await expect(page.getByText('Ralat Pelayan')).toHaveCount(0)

    await gotoApp('/admin/notes')
    const dialog = dismissNextDialog(page, {
      type: 'confirm',
      message: 'Adakah anda pasti mahu padam nota ini?',
    })
    await noteRow(page, 1).getByTestId('row-delete').click()
    await dialog
    expect(await mock.requests('DELETE /api/admin/notes/1')).toHaveLength(0)
    await expect(noteRow(page, 1)).toBeVisible()
  })

  test(
    'SRS §12 #30 deleting a note removes it and shows a flash @m09',
    provisional('the delete result and flash are INFERRED (L-2)'),
    async ({ page, gotoApp }) => {
      await gotoApp('/admin/notes')
      const dialog = acceptNextDialog(page, { type: 'confirm' })
      await noteRow(page, 1).getByTestId('row-delete').click()
      await dialog
      await expect(page.getByTestId('admin-notes-count')).toHaveText('Jumlah: 9 nota')
      await expect(page.getByTestId('cmp-flash')).toBeVisible()
    },
  )
})

test.describe('M09 S6/S7 note form (DV-M09-01)', MODULE, () => {
  test('SRS §12 #31 the create form replaces the live 500 page @m09', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/admin/notes/create')
    await expect(page.getByTestId('admin-note-form')).toBeVisible()
    await expect(page.getByText('Ralat Pelayan')).toHaveCount(0)
    await expectTabTitle(page, 'Tambah Nota - Admin PRESTASIPLUS')
    await expectHeader(page, 'Tambah Nota', 'Cipta nota baharu')
    await expect(page.getByTestId('back-link')).toHaveText('Kembali ke Senarai')
    await expect(page.getByTestId('note-subject').locator('option')).toHaveText([
      'Pilih subjek',
      'Matematik',
      'Sains',
      'Bahasa Melayu',
      'Bahasa Inggeris',
      'Sejarah',
    ])
    await expect(page.getByTestId('note-type').locator('option')).toHaveText([
      'Pilih jenis',
      'FORMULA',
      'RINGKASAN',
      'LENGKAP',
      'TIPS_TRICKS',
    ])
    await expect(page.getByTestId('note-grade').locator('option')).toHaveCount(7)
    await expect(page.getByTestId('form-submit')).toHaveText('Simpan Nota')
    await expect(page.getByTestId('form-cancel')).toHaveAttribute('href', '/admin/notes')
    await expectButtonRow(page)
    await expectNoHorizontalScroll(page)

    await page.getByTestId('form-submit').click()
    for (const id of ['note-title', 'note-content', 'note-subject', 'note-type', 'note-grade']) {
      expect(
        await page.getByTestId(id).evaluate((el) => (el as HTMLInputElement).validity.valueMissing),
      ).toBe(true)
    }
    expect(await mock.requests('POST /api/admin/notes')).toHaveLength(0)
    if (viewportWidth(page) >= 768) {
      const a = await page.getByTestId('note-subject').boundingBox()
      const b = await page.getByTestId('note-type').boundingBox()
      expect(Math.abs(a!.y - b!.y)).toBeLessThan(2)
    }
  })

  test(
    'SRS §12 #32 saving a note adds it to the list @m09',
    provisional('the save result and flash are INFERRED (L-2)'),
    async ({ page, gotoApp }) => {
      await gotoApp('/admin/notes/create')
      await page.getByTestId('note-title').fill('Nota Sains Ujian')
      await page.getByTestId('note-content').fill('<p>Isi</p>')
      await page.getByTestId('note-subject').selectOption({ label: 'Sains' })
      await page.getByTestId('note-type').selectOption('RINGKASAN')
      await page.getByTestId('note-grade').selectOption({ label: 'Darjah 3' })
      await page.getByTestId('note-published').check()
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL(/\/admin\/notes$/)
      await expect(page.getByTestId('cmp-flash')).toBeVisible()
      await expect(page.getByTestId('admin-notes-count')).toHaveText('Jumlah: 11 nota')
      const ids = await noteIds(page)
      const created = noteRow(page, ids[ids.length - 1]!)
      await expect(created.getByTestId('note-subject')).toHaveText('SAINS')
      await expect(created.getByTestId('note-type')).toHaveText('RINGKASAN')
      await expect(created.getByTestId('note-grade')).toHaveText('DARJAH 3')
      await page.getByTestId('admin-notes-type').selectOption({ label: 'Ringkasan' })
      await page.getByTestId('admin-notes-submit').click()
      await expect(page.getByTestId('admin-notes-count')).toHaveText('Jumlah: 6 nota')
    },
  )

  test('SRS §12 #33 edit opens from the preview, pre-filled @m09', async ({ page, gotoApp }) => {
    await gotoApp('/admin/notes/1')
    await expect(page.getByTestId('admin-note-card')).toBeVisible()
    await page.getByTestId('preview-edit').click()
    await expect(page).toHaveURL(/\/admin\/notes\/1\/edit$/)
    await expectTabTitle(page, 'Edit Nota - Admin PRESTASIPLUS')
    await expectHeader(page, 'Edit Nota', 'Kemaskini nota')
    await expect(page.getByTestId('note-title')).toHaveValue(/Sifir 1 hingga 12/)
    await expect(page.getByTestId('note-subject')).toHaveValue('matematik')
    await expect(page.getByTestId('note-type')).toHaveValue('FORMULA')
    await expect(page.getByTestId('note-grade')).toHaveValue('DARJAH_2')
    await expect(page.getByTestId('form-submit')).toHaveText('Kemaskini Nota')
    await expectButtonRow(page)
    await expectNoHorizontalScroll(page)
    await page.getByTestId('form-cancel').click()
    await expect(page).toHaveURL(/\/admin\/notes$/)
  })
})

test.describe('M09 S8 preview note', MODULE, () => {
  test('SRS §12 #34 card, detail grid and the escaped body; /nota is a 404 @m09', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/notes/1')
    await expect(page.getByTestId('admin-note-card')).toBeVisible()
    await expectTabTitle(page, 'Lihat Nota - Admin PRESTASIPLUS')
    await expect(page.getByTestId('shell-admin-title')).toContainText('Sifir 1 hingga 12')
    await expect(page.getByTestId('shell-admin-subtitle')).toHaveText('Paparan nota')
    await expect(page.getByTestId('preview-author')).toHaveText('Admin Demo')
    await expect(page.getByTestId('preview-date')).toHaveText('06 Feb 2026')
    await expect(page.getByTestId('preview-views')).toHaveText('0 tontonan')
    await expect(page.getByTestId('preview-downloads')).toHaveText('0 muat turun')
    await expect(page.getByTestId('status-pill')).toHaveText('Diterbitkan')
    await expect(page.getByTestId('preview-subject')).toHaveText('MATEMATIK')
    await expect(page.getByTestId('preview-grade')).toHaveText('DARJAH 2')
    await expect(page.getByTestId('preview-type')).toHaveText('FORMULA')
    const body = page.getByTestId('preview-body')
    expect((await body.innerText()).startsWith('<h2>Sifir 1 hingga 12</h2>')).toBe(true)
    await expect(body.locator('h2')).toHaveCount(0)
    await expect(page.getByTestId('preview-edit')).toHaveText('Edit Nota')
    await expect(page.getByTestId('preview-edit')).toHaveAttribute('href', '/admin/notes/1/edit')
    await expectNoHorizontalScroll(page)

    await gotoApp('/nota')
    await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
  })
})
