/**
 * M07-T3 / M07-T4 E2E (SRS M07 §12): the admin screens S5 question list, S6 create, S7 edit and S8
 * access at 375 / 768 / 1280 as `admin@demo.test`, from `mock.reset()` state at the project clock.
 *
 * Covered: E2E-M07-12..39 (S5-S8 behaviour), 41 (admin sidebar, desktop), 42 (guest and role
 * redirect, provisional) and 44 (admin parts). The student parts of 11, 38 (student side), 39 and
 * 43 belong to the student spec / M04 and are not asserted here. Flash texts are UNVERIFIED COPY
 * (SRS §8.2); the provisional tests assert that a flash appears.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  acceptNextDialog,
  actAs,
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
const MODULE = { tag: [moduleTag(7)] }
const LIST = '/admin/pksk/questions'

test.use({ mockInit: { latency: 0 } })
const asAdmin = () =>
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(ADMIN)
  })

const title = (page: Page) => page.getByTestId('shell-admin-title')
const subtitle = (page: Page) => page.getByTestId('shell-admin-subtitle')
const rowsOf = (page: Page) => page.getByTestId('pksk-question-row')

async function ids(page: Page): Promise<number[]> {
  return page
    .getByTestId('pksk-question-row')
    .evaluateAll((els) => els.map((el) => Number((el as HTMLElement).dataset.questionId)))
}

async function statValues(page: Page): Promise<string[]> {
  return page.getByTestId('stat-value').allTextContents()
}

async function openList(page: Page, gotoApp: (p: string) => Promise<void>, query = '') {
  await gotoApp(`${LIST}${query}`)
  await expect(page.getByTestId('pksk-questions-table')).toBeVisible()
}

async function expectHeader(page: Page, head: string, sub: string): Promise<void> {
  await expect(title(page)).toHaveText(head)
  await expect(subtitle(page)).toHaveText(sub)
}

// --- S5 list -----------------------------------------------------------------------------------

test.describe('M07 S5 question list', MODULE, () => {
  asAdmin()
  test('E2E-M07-12 header, tab title, add button and stat cards', async ({ page, gotoApp }) => {
    await openList(page, gotoApp)
    await expectTabTitle(page, 'Soalan PKSK - Admin')
    await expectHeader(page, 'Soalan PKSK', 'Urus soalan Pentaksiran Kemasukan Sekolah Khusus')
    const add = page.getByTestId('pksk-add')
    await expect(add).toHaveText('Tambah Soalan')
    await expect(add).toHaveAttribute('href', '/admin/pksk/questions/create')
    await expect(add).toHaveClass(/bg-green-600/)
    expect(await statValues(page)).toEqual(['763', '763', '0', '383', '380'])
    await expect(page.getByTestId('stat-label')).toHaveText([
      'Jumlah',
      'Diluluskan',
      'Menunggu',
      'Ting. 1',
      'Ting. 4',
    ])
    for (const [id, cls] of [
      ['stat-total', 'text-indigo-600'],
      ['stat-approved', 'text-green-600'],
      ['stat-pending', 'text-amber-600'],
      ['stat-t1', 'text-blue-600'],
      ['stat-t4', 'text-purple-600'],
    ] as const) {
      await expect(page.getByTestId(id).getByTestId('stat-value')).toHaveClass(new RegExp(cls))
    }
    if (isDesktopShell(page)) {
      const sidebar = page.getByTestId('shell-admin-sidebar')
      await expect(sidebar.getByRole('link', { name: 'PKSK Soalan' })).toHaveAttribute('href', LIST)
      await expect(sidebar.getByRole('link', { name: 'PKSK Akses' })).toBeVisible()
    }
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M07-13 table: columns, 20 rows and the first row cells', async ({ page, gotoApp }) => {
    await openList(page, gotoApp)
    await expect(page.getByTestId('pksk-questions-table').locator('th')).toHaveText([
      '',
      'Soalan',
      'Bahagian',
      'Domain',
      'Level',
      'Status',
      'Tindakan',
    ])
    await expect(rowsOf(page)).toHaveCount(20)
    const first = rowsOf(page).first()
    const text = (await first.getByTestId('q-text').textContent())?.trim() ?? ''
    expect(text.startsWith('Bagi calon T4, apakah tindakan terbaik')).toBe(true)
    expect(text.length).toBeLessThanOrEqual(83)
    if (text.length > 80) expect(text.endsWith('...')).toBe(true)
    await expect(first.getByTestId('q-text')).toHaveCSS('white-space', 'nowrap')
    await expect(first.getByTestId('q-bahagian')).toHaveText('B')
    await expect(first.getByTestId('q-bahagian')).toHaveClass(/bg-blue-100/)
    await expect(first.getByTestId('q-bahagian')).toHaveClass(/text-blue-700/)
    await expect(first.getByTestId('q-domain')).toContainText('Kebudayaan Kaum')
    await expect(first.getByTestId('q-domain').locator('svg')).toHaveCSS(
      'color',
      'rgb(236, 72, 153)',
    )
    await expect(first.getByTestId('q-level')).toHaveText('T4')
    await expect(first.getByTestId('q-status')).toHaveText('Diluluskan')
    await expect(first.getByTestId('q-status')).toHaveClass(/bg-green-100/)
    await expect(first.getByTestId('q-edit')).toHaveAttribute(
      'href',
      '/admin/pksk/questions/178460/edit',
    )
    await expect(first.getByTestId('q-delete')).toBeVisible()
  })

  test('E2E-M07-14 order: page 1 and the last page', async ({ page, gotoApp }) => {
    await openList(page, gotoApp)
    const first = await ids(page)
    expect(first[0]).toBe(178460)
    expect(first.slice(1, 3)).toEqual([178432, 178433])
    await openList(page, gotoApp, '?page=39')
    expect(await ids(page)).toEqual([178174, 177919, 178175])
  })

  test('E2E-M07-15 pager: numbered from 640px, Previous / Next below', async ({
    page,
    gotoApp,
  }) => {
    await openList(page, gotoApp)
    if (viewportWidth(page) >= 640) {
      await expect(page.getByText('Showing 1 to 20 of 763 results')).toBeVisible()
      await expect(page.locator('a[aria-label="Go to page 38"]')).toBeVisible()
      await expect(page.locator('a[aria-label="Next &raquo;"]').first()).toBeVisible()
    } else {
      await expect(page.getByText('« Previous')).toBeVisible()
      await expect(page.getByRole('link', { name: 'Next »' })).toHaveAttribute(
        'href',
        `${LIST}?page=2`,
      )
    }
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M07-16 filters: options, change navigates at once, page link keeps the filter', async ({
    page,
    gotoApp,
  }) => {
    await openList(page, gotoApp)
    await expect(page.getByTestId('filter-bahagian').locator('option')).toHaveText([
      'Semua Bahagian',
      'A - Insaniah',
      'B - Intelek',
      'C - Esei',
    ])
    await expect(page.getByTestId('filter-level').locator('option')).toHaveText([
      'Semua Level',
      'Tingkatan 1',
      'Tingkatan 4',
    ])
    await expect(page.getByTestId('filter-status').locator('option')).toHaveText([
      'Semua Status',
      'Menunggu',
      'Diluluskan',
      'Ditolak',
    ])
    await expect(page.getByTestId('filter-search')).toHaveAttribute('placeholder', 'Cari soalan...')
    await page.getByTestId('filter-bahagian').selectOption('A')
    await expect(page).toHaveURL(/[?&]bahagian=A/)
    await expect(rowsOf(page).first().getByTestId('q-bahagian')).toHaveText('A')
    await expect(page.getByTestId('filter-bahagian')).toHaveValue('A')
    expect(await statValues(page)).toEqual(['763', '763', '0', '383', '380'])
    if (viewportWidth(page) >= 640) {
      await expect(page.getByText('Showing 1 to 20 of 160 results')).toBeVisible()
      await expect(page.locator('a[aria-label="Go to page 2"]').first()).toHaveAttribute(
        'href',
        `${LIST}?bahagian=A&page=2`,
      )
    }
  })

  test('E2E-M07-17 filter totals and search', async ({ page, gotoApp }) => {
    await openList(page, gotoApp, '?bahagian=C')
    if (viewportWidth(page) >= 640) {
      await expect(page.getByText('Showing 1 to 20 of 30 results')).toBeVisible()
    }
    await openList(page, gotoApp, '?level=T1&bahagian=B')
    if (viewportWidth(page) >= 640) {
      await expect(page.getByText('Showing 1 to 20 of 288 results')).toBeVisible()
    }
    await openList(page, gotoApp, '?level=t1')
    if (viewportWidth(page) >= 640) {
      await expect(page.getByText('Showing 1 to 20 of 383 results')).toBeVisible()
    }
    await openList(page, gotoApp)
    await page.getByTestId('filter-search').fill('inovasi')
    await page.getByTestId('filter-submit').click()
    await expect(rowsOf(page)).toHaveCount(13)
    await expect(page).toHaveURL(/search=inovasi/)
    // The cell shows only the first 80 characters, so the full text is not asserted here.
    await openList(page, gotoApp, '?search=%20INOVASI%20')
    await expect(rowsOf(page)).toHaveCount(13)
  })

  test('E2E-M07-18 empty row keeps the header, no pager', async ({ page, gotoApp }) => {
    for (const q of ['?status=pending', '?status=rejected', '?search=zzzzqqq', '?status=zzz']) {
      await openList(page, gotoApp, q)
      await expect(page.getByTestId('pksk-questions-table').locator('th')).toHaveCount(7)
      const empty = page.getByTestId('pksk-questions-empty')
      await expect(empty).toContainText('Tiada soalan PKSK lagi')
      await expect(empty.locator('svg').first()).toBeVisible()
      await expect(page.getByTestId('pksk-empty-add')).toHaveText('Tambah soalan pertama')
      await expect(page.getByTestId('pksk-empty-add')).toHaveAttribute(
        'href',
        '/admin/pksk/questions/create',
      )
      await expect(page.getByText(/Showing .* results/)).toHaveCount(0)
    }
  })

  test('E2E-M07-19 selection and the bulk bar', async ({ page, gotoApp }) => {
    await openList(page, gotoApp)
    const bar = page.getByTestId('pksk-bulk-bar')
    await expect(bar).toHaveCount(0)
    await page.getByTestId('row-select').first().check()
    await expect(page.getByTestId('bulk-count')).toHaveText('1 dipilih')
    await expect(page.getByTestId('bulk-approve')).toHaveText('Luluskan')
    await expect(page.getByTestId('bulk-approve')).toHaveClass(/bg-green-600/)
    await expect(page.getByTestId('bulk-reject')).toHaveText('Tolak')
    await expect(page.getByTestId('bulk-reject')).toHaveClass(/bg-amber-600/)
    await expect(page.getByTestId('bulk-delete')).toHaveText('Padam')
    await expect(page.getByTestId('bulk-delete')).toHaveClass(/bg-red-600/)
    if (!isDesktopShell(page)) {
      for (const id of ['bulk-approve', 'bulk-reject', 'bulk-delete']) {
        await expectTouchTarget(page.getByTestId(id))
      }
    }
    await page.getByTestId('row-select').first().uncheck()
    await expect(bar).toHaveCount(0)
    await page.getByTestId('select-all').check()
    await expect(page.getByTestId('bulk-count')).toHaveText('20 dipilih')
    await page.getByTestId('row-select').nth(3).uncheck()
    await expect(page.getByTestId('bulk-count')).toHaveText('19 dipilih')
    await expect(page.getByTestId('select-all')).toBeChecked()
    await page.getByTestId('select-all').uncheck()
    await expect(bar).toHaveCount(0)
  })

  test('E2E-M07-20 bulk dialogs: no confirm for approve / reject, confirm for delete', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await openList(page, gotoApp)
    const dialogs: string[] = []
    page.on('dialog', (d) => {
      dialogs.push(d.message())
      void d.dismiss()
    })
    await page.getByTestId('row-select').first().check()
    await page.getByTestId('bulk-approve').click()
    await expect(page.getByTestId('cmp-flash')).toBeVisible()
    expect(dialogs).toEqual([])
    expect(await mock.lastRequest('POST /api/admin/pksk-questions/bulk')).not.toBeNull()
    await page.getByTestId('row-select').first().check()
    await page.getByTestId('bulk-reject').click()
    await expect(page.getByTestId('bulk-count')).toHaveCount(0)
    expect(dialogs).toEqual([])
    const before = (await mock.requests('POST /api/admin/pksk-questions/bulk')).length
    await page.getByTestId('row-select').first().check()
    await page.getByTestId('bulk-delete').click()
    await expect.poll(() => dialogs).toEqual(['Padam soalan terpilih?'])
    expect((await mock.requests('POST /api/admin/pksk-questions/bulk')).length).toBe(before)
  })

  test(
    'E2E-M07-21 bulk reject updates the rows and the cards',
    provisional('the bulk result and flash are INFERRED (L-8)'),
    async ({ page, gotoApp }) => {
      await openList(page, gotoApp)
      const [a, b] = (await ids(page)).slice(0, 2) as [number, number]
      await page.getByTestId('row-select').nth(0).check()
      await page.getByTestId('row-select').nth(1).check()
      await page.getByTestId('bulk-reject').click()
      await expect(page.getByTestId('cmp-flash')).toBeVisible()
      await expect(page).toHaveURL(new RegExp(`${LIST}$`))
      await expect(
        page.locator(`[data-question-id="${String(a)}"]`).getByTestId('q-status'),
      ).toHaveText('Ditolak')
      await expect(
        page.locator(`[data-question-id="${String(b)}"]`).getByTestId('q-status'),
      ).toHaveText('Ditolak')
      expect(await statValues(page)).toEqual(['763', '761', '0', '383', '380'])
      await openList(page, gotoApp, '?status=rejected')
      expect((await ids(page)).sort()).toEqual([a, b].sort())
    },
  )

  test(
    'E2E-M07-22 bulk delete removes the rows and updates the cards',
    provisional('the bulk result and flash are INFERRED (L-8)'),
    async ({ page, gotoApp }) => {
      await openList(page, gotoApp, '?level=T4')
      const [a, b] = (await ids(page)).slice(0, 2) as [number, number]
      await page.getByTestId('row-select').nth(0).check()
      await page.getByTestId('row-select').nth(1).check()
      void acceptNextDialog(page, { type: 'confirm', message: 'Padam soalan terpilih?' })
      await page.getByTestId('bulk-delete').click()
      await expect(page.getByTestId('cmp-flash')).toBeVisible()
      await expect(page.locator(`[data-question-id="${String(a)}"]`)).toHaveCount(0)
      await expect(page.locator(`[data-question-id="${String(b)}"]`)).toHaveCount(0)
      expect(await statValues(page)).toEqual(['761', '761', '0', '383', '378'])
    },
  )

  test(
    'E2E-M07-23 row actions: edit link, delete confirm (cancel and accept)',
    provisional('the delete result and flash are INFERRED'),
    async ({ page, gotoApp }) => {
      await openList(page, gotoApp)
      const row = page.locator('[data-question-id="178460"]')
      await expect(row.getByTestId('q-edit')).toHaveAttribute(
        'href',
        '/admin/pksk/questions/178460/edit',
      )
      if (!isDesktopShell(page)) {
        await expectTouchTarget(row.getByTestId('q-edit'))
        await expectTouchTarget(row.getByTestId('q-delete'))
      }
      const dismissed = dismissNextDialog(page, { type: 'confirm', message: 'Padam soalan ini?' })
      await row.getByTestId('q-delete').click()
      await dismissed
      await expect(row).toHaveCount(1)
      void acceptNextDialog(page, { type: 'confirm', message: 'Padam soalan ini?' })
      await row.getByTestId('q-delete').click()
      await expect(page.getByTestId('cmp-flash')).toBeVisible()
      await expect(row).toHaveCount(0)
      expect(await statValues(page)).toEqual(['762', '762', '0', '383', '379'])
    },
  )
})

// --- S6 create ---------------------------------------------------------------------------------

test.describe('M07 S6 create', MODULE, () => {
  asAdmin()
  const CREATE = `${LIST}/create`

  async function openCreate(page: Page, gotoApp: (p: string) => Promise<void>) {
    await gotoApp(CREATE)
    await expect(page.getByTestId('pksk-question-form')).toBeVisible()
  }

  test('E2E-M07-24 header, tab, selects and domain filtering', async ({ page, gotoApp }) => {
    await openCreate(page, gotoApp)
    await expectTabTitle(page, 'Tambah Soalan PKSK - Admin')
    await expectHeader(page, 'Tambah Soalan PKSK', 'Cipta soalan baru untuk PKSK')
    await expect(page.getByTestId('q-bahagian').locator('option')).toHaveText([
      '-- Pilih --',
      'A - Kecerdasan Insaniah',
      'B - Kecerdasan Intelek',
      'C - Artikulasi Penulisan',
    ])
    const domainOptions = page.getByTestId('q-domain').locator('option')
    await expect(domainOptions).toHaveCount(16)
    expect(await domainOptions.allTextContents()).not.toContainEqual(expect.stringMatching(/^\[/))
    await page.getByTestId('q-bahagian').selectOption('A')
    await expect(domainOptions).toHaveCount(2)
    await page.getByTestId('q-bahagian').selectOption('B')
    await expect(domainOptions).toHaveCount(14)
    await page.getByTestId('q-bahagian').selectOption('C')
    await expect(domainOptions).toHaveCount(2)
    await expect(page.getByTestId('q-level').locator('option')).toHaveText([
      'Tingkatan 1 (Darjah 6)',
      'Tingkatan 4 (Tingkatan 3)',
    ])
    await expect(page.getByTestId('q-level')).toHaveValue('T1')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M07-25 a Bahagian change resets only the domain (DV-M07-08)', async ({
    page,
    gotoApp,
  }) => {
    await openCreate(page, gotoApp)
    await page.getByTestId('q-bahagian').selectOption('B')
    await page.getByTestId('q-domain').selectOption({ label: 'Sains' })
    await page.getByTestId('q-text').fill('Soalan ujian')
    await page.getByTestId('q-difficulty').selectOption('4')
    await page.getByTestId('q-explanation').fill('Penjelasan ujian')
    await page.getByTestId('q-level').selectOption('T4')
    await page.getByTestId('option-text').nth(0).fill('Pilihan satu')
    await page.getByTestId('option-correct').nth(1).check()
    await page.getByTestId('q-bahagian').selectOption('A')
    await expect(page.getByTestId('q-domain')).toHaveValue('')
    await expect(page.getByTestId('q-domain').locator('option:checked')).toHaveText(
      '-- Pilih domain --',
    )
    await expect(page.getByTestId('q-text')).toHaveValue('Soalan ujian')
    await expect(page.getByTestId('q-difficulty')).toHaveValue('4')
    await expect(page.getByTestId('q-explanation')).toHaveValue('Penjelasan ujian')
    await expect(page.getByTestId('q-level')).toHaveValue('T4')
    await expect(page.getByTestId('option-text').nth(0)).toHaveValue('Pilihan satu')
    await page.getByTestId('q-bahagian').selectOption('B')
    await expect(page.getByTestId('option-correct').nth(1)).toBeChecked()
  })

  test('E2E-M07-26 options card by Bahagian', async ({ page, gotoApp }) => {
    await openCreate(page, gotoApp)
    await expect(page.getByText('Teks Soalan')).toBeVisible()
    await expect(page.getByText('Tahap Kesukaran (1-5)')).toBeVisible()
    await expect(page.getByText('Penjelasan (Opsional)')).toBeVisible()
    await expect(page.getByTestId('q-text')).toHaveAttribute(
      'placeholder',
      'Tulis soalan di sini...',
    )
    await expect(page.getByTestId('q-explanation')).toHaveAttribute(
      'placeholder',
      'Penjelasan jawapan...',
    )
    await expect(page.getByTestId('q-difficulty').locator('option')).toHaveText([
      '1 - Sangat Mudah',
      '2 - Mudah',
      '3 - Sederhana',
      '4 - Sukar',
      '5 - Sangat Sukar',
    ])
    await expect(page.getByTestId('q-difficulty').locator('option:checked')).toHaveText(
      '3 - Sederhana',
    )
    await expect(page.getByTestId('option-row')).toHaveCount(4)
    await expect(page.getByTestId('option-text').first()).toHaveAttribute(
      'placeholder',
      'Teks pilihan',
    )
    await expect(page.getByTestId('option-correct-label').first()).toBeHidden()
    await expect(page.getByTestId('options-title')).toHaveText('Pilihan Jawapan')
    await page.getByTestId('q-bahagian').selectOption('A')
    await expect(page.getByTestId('options-title')).toHaveText(
      'Pilihan Jawapan (Tiada jawapan betul/salah)',
    )
    await expect(page.getByTestId('option-correct-label').first()).toBeHidden()
    await page.getByTestId('q-bahagian').selectOption('B')
    await expect(page.getByTestId('options-title')).toHaveText('Pilihan Jawapan')
    await expect(page.getByTestId('option-correct-label')).toHaveCount(4)
    await expect(page.getByTestId('option-correct-label').first()).toBeVisible()
    await page.getByTestId('option-correct').nth(0).check()
    await page.getByTestId('option-correct').nth(2).check()
    await expect(page.getByTestId('option-correct').nth(0)).toBeChecked()
    await expect(page.getByTestId('option-correct').nth(2)).toBeChecked()
    await page.getByTestId('q-bahagian').selectOption('C')
    await expect(page.getByTestId('options-card')).toBeHidden()
  })

  test('E2E-M07-27 option limits 2-6 and re-lettering', async ({ page, gotoApp }) => {
    await openCreate(page, gotoApp)
    const add = page.getByTestId('option-add')
    await add.click()
    await add.click()
    await expect(page.getByTestId('option-letter')).toHaveText(['A', 'B', 'C', 'D', 'E', 'F'])
    await expect(add).toBeHidden()
    for (let i = 0; i < 4; i++) await page.getByTestId('option-remove').first().click()
    await expect(page.getByTestId('option-letter')).toHaveText(['A', 'B'])
    await expect(page.getByTestId('option-remove').first()).toBeHidden()
    await expect(add).toBeVisible()
    if (!isDesktopShell(page)) {
      await add.click()
      await expectTouchTarget(page.getByTestId('option-remove').first())
    }
  })

  test('E2E-M07-28 native validation, and a Bahagian C question can be saved', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await openCreate(page, gotoApp)
    await page.getByTestId('form-submit').click()
    const valid = await page.locator('form').evaluate((f) => (f as HTMLFormElement).checkValidity())
    expect(valid).toBe(false)
    const missing = await page
      .getByTestId('q-bahagian')
      .evaluate((el) => (el as HTMLSelectElement).validity.valueMissing)
    expect(missing).toBe(true)
    expect(await mock.requests('POST /api/admin/pksk-questions')).toHaveLength(0)
    await page.getByTestId('q-bahagian').selectOption('C')
    await page.getByTestId('q-domain').selectOption({ label: 'Artikulasi Penulisan' })
    await page.getByTestId('q-text').fill('Tulis esei tentang kebersihan')
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL(new RegExp(`${LIST}$`))
    const body = (await mock.lastRequest('POST /api/admin/pksk-questions'))?.body as Record<
      string,
      unknown
    >
    expect(body).toBeTruthy()
    expect('options' in body).toBe(false)
    expect(body.bahagian).toBe('C')
  })

  test(
    'E2E-M07-29 save a B question: list, flash, first row, counts',
    provisional('the save result and flash are INFERRED (L-5)'),
    async ({ page, gotoApp }) => {
      await openCreate(page, gotoApp)
      await page.getByTestId('q-bahagian').selectOption('B')
      await page.getByTestId('q-domain').selectOption({ label: 'Matematik' })
      await page.getByTestId('q-text').fill('Berapakah 3 + 4?')
      const texts = page.getByTestId('option-text')
      for (const [i, t] of ['5', '6', '7', '8'].entries()) await texts.nth(i).fill(t)
      await page.getByTestId('option-correct').nth(2).check()
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL(new RegExp(`${LIST}$`))
      await expect(page.getByTestId('cmp-flash')).toBeVisible()
      const first = rowsOf(page).first()
      await expect(first.getByTestId('q-text')).toContainText('Berapakah 3 + 4?')
      await expect(first.getByTestId('q-status')).toHaveText('Diluluskan')
      await expect(first.getByTestId('q-edit')).toHaveAttribute(
        'href',
        '/admin/pksk/questions/9000001/edit',
      )
      expect(await statValues(page)).toEqual(['764', '764', '0', '384', '380'])
    },
  )

  test('E2E-M07-30 Kembali leaves without saving or a dialog', async ({ page, gotoApp, mock }) => {
    const dialogs: string[] = []
    page.on('dialog', (d) => {
      dialogs.push(d.message())
      void d.dismiss()
    })
    await openCreate(page, gotoApp)
    await page.getByTestId('q-text').fill('Tidak disimpan')
    await page.getByTestId('form-back').click()
    await expect(page).toHaveURL(new RegExp(`${LIST}$`))
    expect(dialogs).toEqual([])
    expect(await mock.requests('POST /api/admin/pksk-questions')).toHaveLength(0)
    await gotoApp(`${LIST}/178460/edit`)
    await expect(page.getByTestId('q-text')).not.toHaveValue('')
    const original = await page.getByTestId('q-text').inputValue()
    await page.getByTestId('q-text').fill('Diubah')
    await page.getByTestId('form-back').click()
    await expect(page).toHaveURL(new RegExp(`${LIST}$`))
    await gotoApp(`${LIST}/178460/edit`)
    await expect(page.getByTestId('q-text')).toHaveValue(original)
    expect(dialogs).toEqual([])
  })

  test('E2E-M07-44a S6 footer shares one row and the page does not scroll', async ({
    page,
    gotoApp,
  }) => {
    await openCreate(page, gotoApp)
    const back = await page.getByTestId('form-back').boundingBox()
    const submit = await page.getByTestId('form-submit').boundingBox()
    expect(back && submit).toBeTruthy()
    expect(Math.abs(back!.y - submit!.y)).toBeLessThan(8)
    expect(back!.x).toBeLessThan(submit!.x)
    if (!isDesktopShell(page)) {
      await expectTouchTarget(page.getByTestId('form-back'))
      await expectTouchTarget(page.getByTestId('form-submit'))
    }
    await expectNoHorizontalScroll(page)
  })
})

// --- S7 edit -----------------------------------------------------------------------------------

test.describe('M07 S7 edit', MODULE, () => {
  asAdmin()
  const edit = (id: number | string) => `${LIST}/${String(id)}/edit`

  test('E2E-M07-31 edit #178460: header, prefill and card layout', async ({ page, gotoApp }) => {
    await gotoApp(edit(178460))
    await expect(page.getByTestId('pksk-question-form')).toBeVisible()
    await expectTabTitle(page, 'Edit Soalan PKSK - Admin')
    await expectHeader(page, 'Edit Soalan PKSK', 'Kemaskini soalan #178460')
    await expect(page.getByText('<?php')).toHaveCount(0)
    const domain = page.getByTestId('q-domain')
    await expect(domain.locator('option')).toHaveCount(15)
    await expect(domain.locator('option').first()).toHaveText('[A] Kecerdasan Insaniah')
    await expect(domain.locator('option').last()).toHaveText('[C] Artikulasi Penulisan')
    await expect(domain.locator('option:checked')).toHaveText('[B] Kebudayaan Kaum')
    await expect(page.getByTestId('q-level').locator('option')).toHaveText([
      'Tingkatan 1',
      'Tingkatan 4',
    ])
    await expect(page.getByTestId('q-level').locator('option:checked')).toHaveText('Tingkatan 4')
    await expect(page.getByTestId('q-status').locator('option')).toHaveText([
      'Menunggu',
      'Diluluskan',
      'Ditolak',
    ])
    await expect(page.getByTestId('q-status').locator('option:checked')).toHaveText('Diluluskan')
    await expect(page.getByTestId('q-text')).toHaveValue(/Bagi calon T4, apakah tindakan terbaik/)
    await expect(page.getByTestId('q-difficulty').locator('option')).toHaveText([
      '1',
      '2',
      '3',
      '4',
      '5',
    ])
    await expect(page.getByTestId('q-difficulty')).toHaveValue('3')
    await expect(page.getByTestId('q-explanation')).not.toHaveValue('')
    await expect(page.getByTestId('option-row')).toHaveCount(4)
    await expect(page.getByTestId('option-text').first()).not.toHaveValue('')
    await expect(page.getByTestId('option-correct').first()).toBeChecked()
    await expect(page.getByTestId('form-submit')).toHaveText('Kemaskini')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M07-31b "Betul" follows the saved Bahagian; C has no options card', async ({
    page,
    gotoApp,
  }) => {
    // #178359: Bahagian A (no visible "Betul"); #178349: Bahagian C (no options card).
    await gotoApp(edit(178359))
    await expect(page.getByTestId('pksk-question-form')).toBeVisible()
    await expect(page.getByTestId('options-card')).toBeVisible()
    await expect(page.getByTestId('option-correct-label').first()).toBeHidden()
    await gotoApp(edit(178349))
    await expect(page.getByTestId('pksk-question-form')).toBeVisible()
    await expect(page.getByTestId('options-card')).toHaveCount(0)
  })

  test('E2E-M07-32 edit options: limits and the card ignores the domain', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp(edit(178460))
    await expect(page.getByTestId('option-row')).toHaveCount(4)
    const add = page.getByTestId('option-add')
    await add.click()
    await expect(page.getByTestId('option-letter').last()).toHaveText('E')
    await add.click()
    await expect(add).toBeHidden()
    for (let i = 0; i < 4; i++) await page.getByTestId('option-remove').first().click()
    await expect(page.getByTestId('option-remove').first()).toBeHidden()
    await page.getByTestId('q-domain').selectOption({ label: '[A] Kecerdasan Insaniah' })
    await expect(page.getByTestId('option-correct-label').first()).toBeVisible()
  })

  test(
    'E2E-M07-33 edit save: status Menunggu is stored and counted',
    provisional('the update result and flash are INFERRED (L-5)'),
    async ({ page, gotoApp }) => {
      await gotoApp(edit(178460))
      await expect(page.getByTestId('pksk-question-form')).toBeVisible()
      await page.getByTestId('q-status').selectOption('pending')
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL(new RegExp(`${LIST}$`))
      await expect(page.getByTestId('cmp-flash')).toBeVisible()
      await expect(page.locator('[data-question-id="178460"]').getByTestId('q-status')).toHaveText(
        'Menunggu',
      )
      expect(await statValues(page)).toEqual(['763', '762', '1', '383', '380'])
    },
  )

  test('E2E-M07-09a unknown id shows the 404 page', async ({ page, gotoApp }) => {
    await gotoApp(edit(99999999))
    await expect(page.locator('[data-page=not-found]')).toBeVisible()
    await expectTabTitle(page, '404 - Halaman Tidak Dijumpai | PRESTASIPLUS')
    await gotoApp(`${LIST}/178460`)
    await expect(page.locator('[data-page=not-found]')).toBeVisible()
  })

  test('E2E-M07-44b S7 footer on one row; "Kesukaran" stays in a 2-column grid', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp(edit(178460))
    await expect(page.getByTestId('pksk-question-form')).toBeVisible()
    const back = await page.getByTestId('form-back').boundingBox()
    const submit = await page.getByTestId('form-submit').boundingBox()
    expect(Math.abs(back!.y - submit!.y)).toBeLessThan(8)
    const grid = page.getByTestId('q-difficulty').locator('xpath=ancestor::div[2]')
    const columns = await grid.evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
    )
    expect(columns).toBe(2)
    await expectNoHorizontalScroll(page)
  })
})

// --- S8 access ---------------------------------------------------------------------------------

test.describe('M07 S8 access', MODULE, () => {
  asAdmin()
  const ACCESS = '/admin/pksk/access'

  async function openAccess(page: Page, gotoApp: (p: string) => Promise<void>, query = '') {
    await gotoApp(`${ACCESS}${query}`)
    await expect(page.getByTestId('access-table')).toBeVisible()
  }

  test('E2E-M07-34 default list: header, cards, columns and the 3 seeded rows', async ({
    page,
    gotoApp,
  }) => {
    await openAccess(page, gotoApp)
    await expectTabTitle(page, 'Akses PKSK - Admin')
    await expectHeader(page, 'Akses PKSK', 'Urus akses premium pengguna')
    await expect(page.getByTestId('stat-label')).toHaveText([
      'Jumlah Akses Aktif',
      'Akses T1',
      'Akses T4',
    ])
    expect(await statValues(page)).toEqual(['3', '3', '3'])
    await expect(page.getByTestId('stat-active').getByTestId('stat-value')).toHaveClass(
      /text-indigo-600/,
    )
    await expect(page.getByTestId('stat-t1').getByTestId('stat-value')).toHaveClass(/text-blue-600/)
    await expect(page.getByTestId('stat-t4').getByTestId('stat-value')).toHaveClass(
      /text-purple-600/,
    )
    await expect(page.getByTestId('access-table').locator('th')).toHaveText([
      'Pengguna',
      'Pakej',
      'Diberi Oleh',
      'Tarikh',
      'Tamat',
      'Status',
      'Tindakan',
    ])
    const order = async () =>
      page
        .getByTestId('access-row')
        .evaluateAll((els) => els.map((el) => Number((el as HTMLElement).dataset.accessId)))
    expect(await order()).toEqual([3, 2, 1])
    const rows = page.getByTestId('access-row')
    await expect(rows).toHaveCount(3)
    const expected = [
      ['Pelajar Maju Demo', 'pelajarmaju@demo.test', '22/04/2026'],
      ['Ibu Bapa Demo', null, '28/02/2026'],
      ['Pelajar Demo', null, '28/02/2026'],
    ] as const
    for (const [i, [name, email, date]] of expected.entries()) {
      const r = rows.nth(i)
      await expect(r.getByTestId('a-name')).toHaveText(name)
      if (email) await expect(r.getByTestId('a-email')).toHaveText(email)
      await expect(r.getByTestId('a-package')).toHaveText('PKSK Kombo (T1 + T4)')
      await expect(r.getByTestId('a-package')).toHaveClass(/bg-green-100/)
      await expect(r.getByTestId('a-granter')).toHaveText('-')
      await expect(r.getByTestId('a-granted')).toHaveText(date)
      await expect(r.getByTestId('a-expires')).toHaveText('Tiada had')
      await expect(r.getByTestId('a-status')).toHaveText('Aktif')
      await expect(r.getByTestId('a-revoke')).toHaveText('Tarik')
    }
    await openAccess(page, gotoApp)
    expect(await order()).toEqual([3, 2, 1])
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M07-35 search and the empty row', async ({ page, gotoApp }) => {
    await openAccess(page, gotoApp)
    await page.getByTestId('access-search').fill('maju')
    await page.getByTestId('access-search-submit').click()
    await expect(page.getByTestId('access-row')).toHaveCount(1)
    await expect(page.getByTestId('a-name')).toHaveText('Pelajar Maju Demo')
    expect(await statValues(page)).toEqual(['3', '3', '3'])
    for (const q of ['?search=zzzzqqq', '?page=2']) {
      await openAccess(page, gotoApp, q)
      await expect(page.getByTestId('access-table').locator('th')).toHaveCount(7)
      await expect(page.getByTestId('access-empty')).toContainText('Tiada rekod akses')
    }
  })

  test('E2E-M07-36 grant form: hidden, toggle, kept values, fields', async ({ page, gotoApp }) => {
    await openAccess(page, gotoApp)
    const form = page.getByTestId('grant-form')
    await expect(form).toBeHidden()
    const toggle = page.getByTestId('grant-toggle')
    await expect(toggle).toHaveText('Beri Akses Baru')
    await toggle.click()
    await expect(form).toBeVisible()
    await expect(page.getByTestId('grant-user')).toHaveAttribute('type', 'number')
    await expect(page.getByTestId('grant-user')).toHaveAttribute('placeholder', 'ID Pengguna')
    await expect(page.getByTestId('grant-expires')).toHaveAttribute('type', 'date')
    await expect(page.getByTestId('grant-package').locator('option')).toHaveText([
      'PKSK Tingkatan 1 (SBP/MRSM) (T1)',
      'PKSK Tingkatan 4 (SBP/MRSM) (T4)',
      'PKSK Kombo (T1 + T4) (ALL)',
    ])
    await expect(page.getByTestId('grant-package').locator('option:checked')).toHaveText(
      'PKSK Tingkatan 1 (SBP/MRSM) (T1)',
    )
    await expect(form.getByText('Batal')).toHaveCount(0)
    await expect(page.getByTestId('grant-submit')).toHaveText('Beri Akses')
    await page.getByTestId('grant-user').fill('123')
    await toggle.click()
    await expect(form).toBeHidden()
    await toggle.click()
    await expect(page.getByTestId('grant-user')).toHaveValue('123')
    await page.getByTestId('grant-user').fill('')
    await page.getByTestId('grant-submit').click()
    const missing = await page
      .getByTestId('grant-user')
      .evaluate((el) => (el as HTMLInputElement).validity.valueMissing)
    expect(missing).toBe(true)
    await expect(page.getByTestId('access-row')).toHaveCount(3)
  })

  test(
    'E2E-M07-37 grant to an unknown user shows the error under "ID Pengguna"',
    provisional('the 422 copy is UNVERIFIED (L-7)'),
    async ({ page, gotoApp }) => {
      await openAccess(page, gotoApp)
      await page.getByTestId('grant-toggle').click()
      await page.getByTestId('grant-user').fill('999999')
      await page.getByTestId('grant-submit').click()
      await expect(page.getByTestId('field-error')).toHaveText('Pengguna tidak dijumpai.')
      await expect(page.getByTestId('access-row')).toHaveCount(3)
      expect(await statValues(page)).toEqual(['3', '3', '3'])
    },
  )

  test(
    'E2E-M07-11a grant opens a new row and updates the cards',
    provisional('the grant result and flash are INFERRED (L-7)'),
    async ({ page, gotoApp }) => {
      await openAccess(page, gotoApp)
      await page.getByTestId('grant-toggle').click()
      // pelajar2@demo.test is the canonical account 3 (M01 §6.8).
      await page.getByTestId('grant-user').fill('3')
      await page.getByTestId('grant-package').selectOption({ index: 0 })
      await page.getByTestId('grant-submit').click()
      await expect(page.getByTestId('cmp-flash')).toBeVisible()
      await expect(page.getByTestId('grant-form')).toBeHidden()
      await expect(page.getByTestId('access-row')).toHaveCount(4)
      const first = page.getByTestId('access-row').first()
      await expect(first.getByTestId('a-name')).toHaveText('Pelajar Dua Demo')
      await expect(first.getByTestId('a-package')).toHaveText('PKSK Tingkatan 1 (SBP/MRSM)')
      await expect(first.getByTestId('a-granter')).toHaveText('Admin Demo')
      await expect(first.getByTestId('a-granted')).toHaveText('25/09/2026')
      await expect(first.getByTestId('a-expires')).toHaveText('Tiada had')
      await expect(first.getByTestId('a-status')).toHaveText('Aktif')
      expect(await statValues(page)).toEqual(['4', '4', '3'])
    },
  )

  test('E2E-M07-38 revoke: confirm text, cancel keeps the row', async ({ page, gotoApp, mock }) => {
    await openAccess(page, gotoApp)
    const dismissed = dismissNextDialog(page, { type: 'confirm', message: 'Tarik balik akses?' })
    await page.getByTestId('access-row').last().getByTestId('a-revoke').click()
    await dismissed
    expect(await mock.requests('POST /api/admin/pksk-access/1/revoke')).toHaveLength(0)
    await expect(page.getByTestId('a-revoke')).toHaveCount(3)
    expect(await statValues(page)).toEqual(['3', '3', '3'])
  })

  test(
    'E2E-M07-38b revoke on accept keeps the row with the revoked label',
    provisional('the revoke result, flash and label are INFERRED (L-7)'),
    async ({ page, gotoApp }) => {
      await openAccess(page, gotoApp)
      const row = page.locator('[data-access-id="1"]')
      void acceptNextDialog(page, { type: 'confirm', message: 'Tarik balik akses?' })
      await row.getByTestId('a-revoke').click()
      await expect(page.getByTestId('cmp-flash')).toBeVisible()
      await expect(row.getByTestId('a-status')).toHaveText('Ditarik')
      await expect(row.getByTestId('a-revoke')).toHaveCount(0)
      expect(await statValues(page)).toEqual(['2', '2', '2'])
    },
  )

  test(
    'E2E-M07-39 expired and revoked rows show their label, no "Tarik" and are not counted',
    provisional('the expired / revoked labels are UNVERIFIED (L-7)'),
    async ({ page, gotoApp, mock }) => {
      await gotoApp(ACCESS)
      await mock.hook('seedPkskAccessEdgeCases')
      await openAccess(page, gotoApp)
      const rows = page.getByTestId('access-row')
      await expect(rows).toHaveCount(5)
      await expect(page.getByTestId('a-status').filter({ hasText: 'Tamat Tempoh' })).toHaveCount(1)
      await expect(page.getByTestId('a-status').filter({ hasText: 'Ditarik' })).toHaveCount(1)
      await expect(page.getByTestId('a-revoke')).toHaveCount(3)
      await expect(page.getByText('30/06/2026')).toBeVisible()
      expect(await statValues(page)).toEqual(['3', '3', '3'])
    },
  )

  test('E2E-M07-44c S8: table scrolls inside its card below 768, grids and touch targets', async ({
    page,
    gotoApp,
  }) => {
    await openAccess(page, gotoApp)
    const stats = page.getByTestId('access-stats')
    const cols = await stats.evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
    )
    expect(cols).toBe(3)
    await page.getByTestId('grant-toggle').click()
    const formCols = await page
      .getByTestId('grant-form')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
    expect(formCols).toBe(viewportWidth(page) >= 768 ? 4 : 1)
    const scroller = page.getByTestId('access-table').locator('xpath=ancestor::div[2]')
    const overflow = await scroller.evaluate((el) => ({
      scroll: el.scrollWidth,
      client: el.clientWidth,
    }))
    if (viewportWidth(page) < 768) expect(overflow.scroll).toBeGreaterThan(overflow.client)
    await expect(page.getByTestId('access-table').locator('td, th').first()).not.toHaveCSS(
      'position',
      'sticky',
    )
    if (!isDesktopShell(page)) {
      await expectTouchTarget(page.getByTestId('grant-toggle'))
      await expectTouchTarget(page.getByTestId('grant-submit'))
      await expectTouchTarget(page.getByTestId('access-search-submit'))
    }
    await expectNoHorizontalScroll(page)
  })
})

// --- layout of S5 and access control -----------------------------------------------------------

test.describe('M07 S5 layout', MODULE, () => {
  asAdmin()
  test('E2E-M07-44d S5: stats grid, table scrolls in its card, filters wrap', async ({
    page,
    gotoApp,
  }) => {
    await openList(page, gotoApp)
    const width = viewportWidth(page)
    const cols = await page
      .getByTestId('pksk-stats')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
    expect(cols).toBe(width >= 1024 ? 5 : 2)
    const scroller = page.getByTestId('pksk-questions-table').locator('xpath=ancestor::div[2]')
    const m = await scroller.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }))
    if (width < 1024) expect(m.scroll).toBeGreaterThan(m.client)
    await expect(page.getByTestId('pksk-questions-table').locator('td, th').first()).not.toHaveCSS(
      'position',
      'sticky',
    )
    const level = await page.getByTestId('filter-level').boundingBox()
    const bahagian = await page.getByTestId('filter-bahagian').boundingBox()
    const submit = await page.getByTestId('filter-submit').boundingBox()
    const add = await page.getByTestId('pksk-add').boundingBox()
    expect(Math.abs(level!.y - bahagian!.y)).toBeLessThan(2)
    if (width < 1024) expect(submit!.y).toBeGreaterThan(bahagian!.y + 20)
    expect(add!.y + add!.height).toBeGreaterThan(0)
    if (!isDesktopShell(page)) {
      await expectTouchTarget(page.getByTestId('filter-submit'))
      await expectTouchTarget(page.getByTestId('pksk-add'))
      await expectTouchTarget(page.getByTestId('filter-bahagian'))
    }
    await expectNoHorizontalScroll(page)
    // Scrolling the card to its end brings "Tindakan" into view.
    await scroller.evaluate((el) => {
      el.scrollLeft = el.scrollWidth
    })
    await expect(page.getByTestId('pksk-questions-table').locator('th').last()).toBeInViewport()
  })
})

test.describe('M07 admin access control', MODULE, () => {
  // No `asAdmin()`: `actAs` switches the session itself.
  test(
    'E2E-M07-42 guest goes to /login, a student to the landing page',
    provisional('the role redirect is INFERRED'),
    async ({ page, gotoApp, mock }) => {
      await gotoApp('/login')
      for (const path of [LIST, `${LIST}/create`, '/admin/pksk/access']) {
        await actAs(page, mock, gotoApp, null, path)
        await expect(page).toHaveURL(/\/login/)
      }
      for (const path of [LIST, '/admin/pksk/access']) {
        await actAs(page, mock, gotoApp, 'pelajar@demo.test', path)
        await expect(page).toHaveURL(/\/dashboard/)
      }
    },
  )
})
