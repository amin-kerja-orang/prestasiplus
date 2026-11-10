/**
 * M03-T2 developer smoke for S6-S8 (subjects) and S9-S11 (education levels), as the admin demo
 * account at 375 / 768 / 1280 (build-plan M03-T2; QA writes E2E-M03-21..34 and 52 at G5, so no
 * E2E id is traced here). Values are the SRS §6.9 seeds and live observations (discovery
 * Appendix B). Flash texts after a save or delete are UNVERIFIED COPY (SRS §8), so the tests that
 * assert them are `@provisional`.
 */

import type { Page } from '@playwright/test'

import { expect, reloadApp, test } from '../fixtures/test'
import {
  chooseDelete,
  confirmDialog,
  expectSwitch,
  listRows,
  listTable,
  rowById,
  rowEdit,
  rowSwitch,
  expectListLoaded,
} from './admin-table'
import {
  acceptNextDialog,
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isMobileWidth,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'

const ADMIN = 'admin@demo.test'
const MODULE = { tag: [moduleTag(3)] }

const SUBJECT_UPPER_HEADERS = [
  '#',
  'IKON',
  'NAMA (BM)',
  'NAMA (EN)',
  'KOD',
  'WARNA',
  'TERAS?',
  'SOALAN',
  'AKTIF?',
  'TINDAKAN',
]

function subjectRow(page: Page, id: number) {
  return rowById(page, 'subjects', id)
}

function levelRow(page: Page, id: number) {
  return rowById(page, 'levels', id)
}

async function openSubjects(page: Page, gotoApp: (path: string) => Promise<void>): Promise<void> {
  await gotoApp('/admin/subjects')
  await expectListLoaded(page, 'subjects')
}

async function openLevels(page: Page, gotoApp: (path: string) => Promise<void>): Promise<void> {
  await gotoApp('/admin/education-levels')
  await expectListLoaded(page, 'levels')
}

/** The smallest font size (px) of any visible text-bearing element inside `main` (0 when none). */
async function smallestTextInMain(page: Page): Promise<number> {
  return page.evaluate(() => {
    const main = document.querySelector('main')
    if (!main) return 0
    let smallest = Number.POSITIVE_INFINITY
    for (const el of main.querySelectorAll<HTMLElement>('*')) {
      const own = [...el.childNodes].some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
      )
      if (!own) continue
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      if (el.getBoundingClientRect().width === 0) continue
      smallest = Math.min(smallest, Number.parseFloat(style.fontSize))
    }
    return smallest === Number.POSITIVE_INFINITY ? 0 : smallest
  })
}

/** Both form buttons on one row, right-aligned in the card (FR-99). */
async function expectButtonRow(page: Page): Promise<void> {
  const cancel = await page.getByTestId('form-cancel').boundingBox()
  const submit = await page.getByTestId('form-submit').boundingBox()
  const card = await page.locator('form').first().boundingBox()
  expect(cancel && submit && card).toBeTruthy()
  expect(Math.abs(cancel!.y - submit!.y)).toBeLessThan(2)
  expect(cancel!.x).toBeLessThan(submit!.x)
  expect(card!.x + card!.width - (submit!.x + submit!.width)).toBeLessThan(40)
}

test.describe('M03 S6 subject list', MODULE, () => {
  test.use({ mockInit: { latency: 0 } })

  test('header, count, upper-case headers, rows, pills and responsive table', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openSubjects(page, gotoApp)
    await expectTabTitle(page, 'Subjek | PRESTASIPLUS')
    await expect(page.getByTestId('pentadbiran-header').getByRole('heading', { level: 1 })).toHaveText('Subjek')
    await expect.soft(page.getByRole('heading', { name: 'Senarai Subjek', level: 2 })).toBeVisible() // V2 subjects.blade.php h2
    await expect(page.getByTestId('subjects-count')).toHaveText('Jumlah: 31 subjek')
    const add = page.getByTestId('subjects-add')
    await expect(add).toHaveText('Tambah')
    await expect(add).toHaveAttribute('href', '/admin/subjects/create')

    // Headers (the DsTable header cells; the label text is the source label, case aside).
    const headers = listTable(page, 'subjects').locator('thead th')
    await expect(headers).toHaveCount(10)
    expect(
      (await headers.evaluateAll((els) => els.map((el) => (el as HTMLElement).innerText))).map(
        (text) => text.trim().toUpperCase(),
      ),
    ).toEqual(SUBJECT_UPPER_HEADERS)

    // 31 rows by id; level line, Teras / Elektif, code pill, colour and question count.
    const rows = listRows(page, 'subjects')
    await expect(rows).toHaveCount(31)
    await expect(rows.nth(0).locator('td').first()).toHaveText('1')
    await expect(rows.nth(30).locator('td').first()).toHaveText('31')
    await expect(subjectRow(page, 8).getByTestId('subject-levels')).toHaveText(
      'Tingkatan 4, Tingkatan 5',
    )
    await expect(subjectRow(page, 28).getByTestId('subject-levels')).toHaveCount(0)
    await expect(subjectRow(page, 3).getByTestId('subject-code')).toHaveText('MATH')
    await expect(subjectRow(page, 3).getByTestId('subject-core')).toHaveText('Teras')
    await expect(subjectRow(page, 8).getByTestId('subject-core')).toHaveText('Elektif')
    // Edit is an icon link named "Edit"; "Padam" sits in the row's "Tindakan" menu (D-staff DsRowActions).
    await expect(rowEdit(subjectRow(page, 3))).toHaveAttribute('href', '/admin/subjects/3/edit')
    await expect(rowEdit(subjectRow(page, 3))).toHaveAttribute('title', 'Edit')
    await subjectRow(page, 3).getByRole('button', { name: 'Tindakan', exact: true }).click()
    await expect(page.getByRole('menuitem', { name: 'Padam', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')

    // Below sm: swatch only and the question number only; from sm the hex and the word "soalan" show too
    // (V2 subjects.blade.php: hidden sm:inline). The v2 restyle hides them below 2xl: stays red until the app is fixed.
    const hex = subjectRow(page, 27).getByTestId('subject-color-hex')
    const questions = subjectRow(page, 3).getByTestId('subject-questions')
    if (isMobileWidth(page)) {
      await expect(hex).toBeHidden()
      await expect
        .poll(() => questions.evaluate((el) => (el as HTMLElement).innerText.trim()))
        .toBe('13872')
    } else {
      await expect(hex).toBeVisible()
      await expect(hex).toHaveText('#0f766e')
      await expect(questions).toHaveText('13872 soalan')
    }

    // The table fits its card from 1280 and scrolls inside the card below it (DV-M03-03).
    const scroller = listTable(page, 'subjects').locator('div.overflow-x-auto').first()
    const overflow = await scroller.evaluate((el) => el.scrollWidth - el.clientWidth)
    if (viewportWidth(page) >= 1280) {
      expect(overflow).toBeLessThanOrEqual(0)
      const card = await listTable(page, 'subjects').boundingBox()
      const last = await headers.nth(9).boundingBox()
      expect(last!.x + last!.width).toBeLessThanOrEqual(card!.x + card!.width + 1)
    } else {
      expect(overflow).toBeGreaterThan(0)
    }
    expect(await smallestTextInMain(page)).toBeGreaterThanOrEqual(12)
    await expectNoHorizontalScroll(page)
  })

  test('every subject with an icon shows a glyph in its colour; the two empty ones do not', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openSubjects(page, gotoApp)
    for (let id = 1; id <= 31; id++) {
      const tile = subjectRow(page, id).getByTestId('subject-icon')
      const glyph = await tile.evaluate((el) => ({
        svg: el.querySelector('svg') !== null,
        text: (el.textContent ?? '').trim(),
        background: getComputedStyle(el).backgroundColor,
        color: getComputedStyle(el).color,
      }))
      if (id >= 30) {
        expect(glyph.svg, `subject ${String(id)} svg`).toBe(false)
        expect(glyph.text, `subject ${String(id)} text`).toBe('')
        continue
      }
      expect(glyph.svg || glyph.text !== '', `subject ${String(id)} glyph`).toBe(true)
      // Background is the colour at 12.5 % alpha (`#rrggbb20`).
      const match = /rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/.exec(glyph.background)
      expect(match, `subject ${String(id)} background ${glyph.background}`).not.toBeNull()
      expect(Number(match![4])).toBeCloseTo(0.125, 2)
    }
    await expectNoHorizontalScroll(page)
  })

  test('the switch flips at once, needs no confirm and persists after a reload', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openSubjects(page, gotoApp)
    let dialogs = 0
    page.on('dialog', (dialog) => {
      dialogs += 1
      void dialog.dismiss()
    })
    await expectSwitch(subjectRow(page, 12), true)
    await rowSwitch(subjectRow(page, 12)).click()
    await expectSwitch(subjectRow(page, 12), false)
    expect(dialogs).toBe(0)

    await reloadApp(page)
    await expectListLoaded(page, 'subjects')
    await expectSwitch(subjectRow(page, 12), false)
    await expectNoHorizontalScroll(page)
  })

  test('a failed switch reverts with "Gagal kemaskini status"; a network failure with "Ralat rangkaian"', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(ADMIN)
    await openSubjects(page, gotoApp)

    await mock.failNext('PATCH /api/admin/subjects/12/active', 500)
    const failed = acceptNextDialog(page, { type: 'alert', message: 'Gagal kemaskini status' })
    await rowSwitch(subjectRow(page, 12)).click()
    await failed
    await expectSwitch(subjectRow(page, 12), true)

    await mock.networkErrorNext('PATCH /api/admin/subjects/12/active')
    const offline = acceptNextDialog(page, { type: 'alert', message: 'Ralat rangkaian' })
    await rowSwitch(subjectRow(page, 12)).click()
    await offline
    await expectSwitch(subjectRow(page, 12), true)
  })

  test(
    'delete: cancel keeps the row, accept removes it and shows the flash',
    provisional('the flash text after a delete is UNVERIFIED COPY (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await openSubjects(page, gotoApp)
      // The confirmation is the DS dialog (useConfirm), not a native confirm.
      const dialog = confirmDialog(page)
      await chooseDelete(page, subjectRow(page, 31))
      await expect(dialog.message).toHaveText('Adakah anda pasti mahu padam subjek ini?')
      await dialog.cancel.click()
      await expect(dialog.message).toBeHidden()
      await expect(listRows(page, 'subjects')).toHaveCount(31)

      await chooseDelete(page, subjectRow(page, 31))
      await dialog.ok.click()
      await expect(subjectRow(page, 31)).toHaveCount(0)
      await expect(page.getByTestId('subjects-count')).toHaveText('Jumlah: 30 subjek')
      await expect(page.getByText('Subjek berjaya dipadam.')).toBeVisible()
      await expectNoHorizontalScroll(page)
    },
  )

  test('row actions are touch-sized below 1024px', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await openSubjects(page, gotoApp)
    if (viewportWidth(page) >= 1024) return
    const row = subjectRow(page, 1)
    await expectTouchTarget(rowEdit(row))
    await expectTouchTarget(row.getByRole('button', { name: 'Tindakan', exact: true }))
    await expectTouchTarget(rowSwitch(row))
    await expectTouchTarget(page.getByTestId('subjects-add'))
  })
})

test.describe('M03 S7 / S8 subject form', MODULE, () => {
  test.use({ mockInit: { latency: 0 } })

  test('create form: fields, defaults, hints, level box, colour mirror and buttons', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openSubjects(page, gotoApp)
    await page.getByTestId('subjects-add').click()
    await expect(page).toHaveURL('/admin/subjects/create')
    await expect(page.getByTestId('subject-form')).toBeVisible()
    await expectTabTitle(page, 'Tambah Subjek | PRESTASIPLUS')

    await expect(page.getByTestId('subject-back')).toHaveText('Kembali ke Senarai')
    await expect(page.getByLabel('Nama Subjek (Bahasa Melayu)')).toHaveAttribute(
      'placeholder',
      'cth: Matematik',
    )
    await expect(page.getByLabel('Nama Subjek (English)')).toHaveAttribute(
      'placeholder',
      'e.g: Mathematics',
    )
    const code = page.getByTestId('subject-code')
    await expect(code).toHaveAttribute('placeholder', 'cth: MATH01')
    await expect(code).toHaveAttribute('maxlength', '20')
    expect.soft(await code.evaluate((el) => getComputedStyle(el).textTransform)).toBe('uppercase') // V2 subjects/create.blade.php: input class uppercase
    await expect(page.getByText('Kod akan ditukar ke huruf besar automatik')).toBeVisible()
    await expect(page.getByTestId('subject-icon-input')).toHaveValue('fas fa-book')
    await expect(page.getByTestId('subject-icon-input')).toHaveAttribute(
      'placeholder',
      'cth: fas fa-calculator',
    )
    const link = page.getByRole('link', { name: 'Font Awesome' })
    await expect(link).toHaveAttribute('href', 'https://fontawesome.com/icons')
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(page.getByTestId('subject-color-text')).toHaveValue('#4f46e5')
    await expect(page.getByTestId('subject-core')).not.toBeChecked()
    await expect(page.getByText('Tandakan jika subjek ini adalah subjek wajib')).toBeVisible()
    await expect(page.getByTestId('subject-order')).toHaveValue('0')
    await expect(page.getByText('Nombor lebih kecil akan dipaparkan dahulu')).toBeVisible()
    await expect(page.getByTestId('form-submit')).toHaveText('Simpan Subjek')
    await expect(page.getByTestId('form-cancel')).toHaveText('Batal')
    await expect(page.getByText('Aktif', { exact: true })).toHaveCount(0)

    // Typing displays upper-case; the picker mirrors into the read-only text.
    await code.fill('math02')
    expect.soft(await code.evaluate((el) => getComputedStyle(el).textTransform)).toBe('uppercase')
    await page.getByTestId('subject-color').fill('#00ff00')
    await expect(page.getByTestId('subject-color-text')).toHaveValue('#00ff00')

    // 5 unticked levels (the Tingkatan levels; the Darjah levels are hidden, D72), in a box of at most
    // 320 px (max-h-80) that scrolls inside itself when it overflows: one column below md, two from md.
    const options = page.getByTestId('subject-level-option')
    await expect(options).toHaveCount(5)
    for (const option of await options.all()) await expect(option).not.toBeChecked()
    await expect(page.getByText('Tingkatan 1 (Form 1)')).toBeVisible()
    await expect(page.getByText('Darjah 1 (Year 1)')).toHaveCount(0)
    const box = page.getByTestId('subject-levels-box')
    const metrics = await box.evaluate((el) => ({
      client: el.clientHeight,
      scroll: el.scrollHeight,
      maxHeight: getComputedStyle(el).maxHeight,
      overflowY: getComputedStyle(el).overflowY,
    }))
    expect(metrics.client).toBeLessThanOrEqual(320)
    expect(metrics.maxHeight).toBe('320px')
    expect(metrics.overflowY).toBe('auto')
    const first = await options.nth(0).boundingBox()
    const second = await options.nth(1).boundingBox()
    if (viewportWidth(page) >= 768) {
      expect(second!.x).toBeGreaterThan(first!.x)
    } else {
      expect(second!.y).toBeGreaterThan(first!.y)
    }

    await expectButtonRow(page)
    expect(await smallestTextInMain(page)).toBeGreaterThanOrEqual(12)
    await expectNoHorizontalScroll(page)

    // Native validation blocks an empty submit.
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL('/admin/subjects/create')
    expect(
      await page
        .getByTestId('subject-name')
        .evaluate((el) => (el as HTMLInputElement).validity.valueMissing),
    ).toBe(true)

    await page.getByTestId('form-cancel').click()
    await expect(page).toHaveURL('/admin/subjects')
  })

  test(
    'create saves an upper-case code with its levels and returns to the list with the flash',
    provisional('the flash text after a save is UNVERIFIED COPY (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/subjects/create')
      await page.getByLabel('Nama Subjek (Bahasa Melayu)').fill('Sains Demo')
      await page.getByLabel('Nama Subjek (English)').fill('Demo Science')
      await page.getByTestId('subject-code').fill('demo01')
      await page.getByText('Tingkatan 1 (Form 1)').click()
      await page.getByText('Tingkatan 2 (Form 2)').click()
      await page.getByTestId('form-submit').click()

      await expect(page).toHaveURL('/admin/subjects')
      await expect(page.getByText('Subjek berjaya ditambah.')).toBeVisible()
      await expect(page.getByTestId('subjects-count')).toHaveText('Jumlah: 32 subjek')
      const created = listRows(page, 'subjects').filter({ hasText: 'Sains Demo' })
      await expect(created.getByTestId('subject-code')).toHaveText('DEMO01')
      await expect(created.getByTestId('subject-levels')).toHaveText('Tingkatan 1, Tingkatan 2')
      await expectSwitch(created, true)
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'a duplicate code shows the red box and keeps the input',
    provisional('the duplicate-code message is INFERRED Laravel copy (SRS §5)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/subjects/create')
      await page.getByLabel('Nama Subjek (Bahasa Melayu)').fill('Salinan')
      await page.getByLabel('Nama Subjek (English)').fill('Copy')
      await page.getByTestId('subject-code').fill('MATH')
      await page.getByTestId('form-submit').click()
      await expect(page.getByTestId('subject-form-alert')).toContainText(
        'The code has already been taken.',
      )
      await expect(page).toHaveURL('/admin/subjects/create')
      await expect(page.getByTestId('subject-code')).toHaveValue('MATH')
      await expect(page.getByLabel('Nama Subjek (Bahasa Melayu)')).toHaveValue('Salinan')
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'edit pre-fills subject 3 and saves a changed level set',
    provisional('the flash text after a save is UNVERIFIED COPY (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      test.slow()
      await loginAs(ADMIN)
      await openLevels(page, gotoApp)
      const t1Text = await levelRow(page, 7).getByTestId('level-subjects').innerText()
      const t1Subjects = Number.parseInt(t1Text, 10)
      expect(t1Subjects).toBeGreaterThan(0)
      await openSubjects(page, gotoApp)
      await rowEdit(subjectRow(page, 3)).click()
      await expect(page).toHaveURL('/admin/subjects/3/edit')
      await expectTabTitle(page, 'Edit Subjek | PRESTASIPLUS')
      await expect(page.getByTestId('subject-name')).toHaveValue('Matematik')
      await expect(page.getByTestId('subject-name-en')).toHaveValue('Mathematics')
      await expect(page.getByTestId('subject-code')).toHaveValue('MATH')
      await expect(page.getByTestId('subject-icon-input')).toHaveValue('calculator')
      await expect(page.getByTestId('subject-color-text')).toHaveValue('#EF4444')
      await expect(page.getByTestId('subject-core')).toBeChecked()
      await expect(page.getByTestId('subject-order')).toHaveValue('3')
      const options = page.getByTestId('subject-level-option')
      await expect(options).toHaveCount(5)
      for (const option of await options.all()) await expect(option).toBeChecked()
      await expect(page.getByTestId('form-submit')).toHaveText('Kemaskini Subjek')
      await expect(page.getByText('Aktif', { exact: true })).toHaveCount(0)
      await expectButtonRow(page)
      await expectNoHorizontalScroll(page)

      await page.getByText('Tingkatan 1 (Form 1)').click()
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL('/admin/subjects')
      await expect(page.getByText('Subjek berjaya dikemaskini.')).toBeVisible()
      await expect(subjectRow(page, 3).getByTestId('subject-levels')).not.toContainText('Tingkatan 1,')

      await openLevels(page, gotoApp)
      await expect(levelRow(page, 7).getByTestId('level-subjects')).toHaveText(
        `${String(t1Subjects - 1)} subjek`,
      )
    },
  )

  test('an unknown subject returns to the list with the one-time flash', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/subjects/999/edit')
    await expect(page).toHaveURL('/admin/subjects')
    await expect(page.getByText('Subjek tidak dijumpai.')).toBeVisible()
    await expectListLoaded(page, 'subjects')
    await reloadApp(page)
    await expectListLoaded(page, 'subjects')
    await expect(page.getByText('Subjek tidak dijumpai.')).toHaveCount(0)
  })
})

test.describe('M03 S9 level list', MODULE, () => {
  test.use({ mockInit: { latency: 0 } })

  test('header, count, upper-case headers, rows, badges, counts and table fit', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openLevels(page, gotoApp)
    await expectTabTitle(page, 'Tahap Pendidikan | PRESTASIPLUS')
    await expect(page.getByTestId('pentadbiran-header').getByRole('heading', { level: 1 })).toHaveText('Tahap Pendidikan')
    await expect.soft(page.getByRole('heading', { name: 'Senarai Tahap Pendidikan', level: 2 })).toBeVisible() // V2 education-levels.blade.php h2
    // 5 levels: the Tingkatan levels only; the 6 Darjah levels are hidden (D72).
    await expect(page.getByTestId('levels-count')).toHaveText('Jumlah: 5 tahap')
    const add = page.getByTestId('levels-add')
    await expect(add).toHaveText('Tambah Tahap')
    await expect(add).toHaveAttribute('href', '/admin/education-levels/create')

    const headers = listTable(page, 'levels').locator('thead th')
    expect(
      (await headers.evaluateAll((els) => els.map((el) => (el as HTMLElement).innerText))).map(
        (text) => text.trim().toUpperCase(),
      ),
    ).toEqual([
      '#',
      'NAMA (BM)',
      'NAMA (EN)',
      'KOD',
      'PERINGKAT',
      'KURIKULUM',
      'SOALAN',
      'SUBJEK',
      'AKTIF?',
      'TINDAKAN',
    ])

    await expect(listRows(page, 'levels')).toHaveCount(5)
    await expect(listRows(page, 'levels').nth(0).locator('td').first()).toHaveText('7')
    await expect(listRows(page, 'levels').nth(4).locator('td').first()).toHaveText('11')
    const t1 = levelRow(page, 7)
    await expect(t1).toContainText('Tingkatan 1')
    await expect(t1).toContainText('Form 1')
    await expect(t1).toContainText('T1')
    await expect(t1.getByTestId('level-stage')).toHaveText('Menengah Rendah')
    await expect(t1).toContainText('KSSM')
    await expect(t1.getByTestId('level-questions')).toHaveText('19455 soalan') // ACTIVE_BY_LEVEL[7] = Q-ACTIVE(Tingkatan 1), src/modules/m04-question-bank/mock/data/tables.ts:953-965 (D11)
    await expect(t1.getByTestId('level-subjects')).toHaveText('15 subjek')
    await expect(levelRow(page, 10).getByTestId('level-stage')).toHaveText('Menengah Atas')
    await expect(rowEdit(t1)).toHaveAttribute('href', '/admin/education-levels/7/edit')
    await expect(rowEdit(t1)).toHaveAttribute('title', 'Edit')
    await t1.getByRole('button', { name: 'Tindakan', exact: true }).click()
    await expect(page.getByRole('menuitem', { name: 'Padam', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')

    // Counts read in full at every width (unlike S6); the table scrolls inside its card below 1280.
    const scroller = listTable(page, 'levels').locator('div.overflow-x-auto').first()
    const overflow = await scroller.evaluate((el) => el.scrollWidth - el.clientWidth)
    if (viewportWidth(page) >= 1280) expect(overflow).toBeLessThanOrEqual(0)
    else expect(overflow).toBeGreaterThan(0)
    expect(await smallestTextInMain(page)).toBeGreaterThanOrEqual(12)
    await expectNoHorizontalScroll(page)
  })

  test('the switch flips, persists and reverts with the right alert on failure', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(ADMIN)
    await openLevels(page, gotoApp)
    let dialogs = 0
    const counter = (): void => {
      dialogs += 1
    }
    page.on('dialog', counter)
    await expectSwitch(levelRow(page, 11), true)
    await rowSwitch(levelRow(page, 11)).click()
    await expectSwitch(levelRow(page, 11), false)
    expect(dialogs).toBe(0)
    await reloadApp(page)
    await expectListLoaded(page, 'levels')
    await expectSwitch(levelRow(page, 11), false)
    page.off('dialog', counter)

    await mock.failNext('PATCH /api/admin/education-levels/11/active', 500)
    const failed = acceptNextDialog(page, { type: 'alert', message: 'Gagal kemaskini status' })
    await rowSwitch(levelRow(page, 11)).click()
    await failed
    await expectSwitch(levelRow(page, 11), false)

    await mock.networkErrorNext('PATCH /api/admin/education-levels/11/active')
    const offline = acceptNextDialog(page, { type: 'alert', message: 'Ralat rangkaian' })
    await rowSwitch(levelRow(page, 11)).click()
    await offline
    await expectSwitch(levelRow(page, 11), false)
  })

  test(
    'delete: cancel keeps the row, accept removes Tingkatan 5 and shows the flash',
    provisional('the flash text after a delete is UNVERIFIED COPY (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await openLevels(page, gotoApp)
      const dialog = confirmDialog(page)
      await chooseDelete(page, levelRow(page, 11))
      await expect(dialog.message).toHaveText('Adakah anda pasti mahu padam tahap pendidikan ini?')
      await dialog.cancel.click()
      await expect(dialog.message).toBeHidden()
      await expect(listRows(page, 'levels')).toHaveCount(5)

      await chooseDelete(page, levelRow(page, 11))
      await dialog.ok.click()
      await expect(levelRow(page, 11)).toHaveCount(0)
      await expect(page.getByTestId('levels-count')).toHaveText('Jumlah: 4 tahap')
      await expect(page.getByText('Tahap Pendidikan berjaya dipadam.')).toBeVisible()

      await gotoApp('/admin/subjects')
      await expectListLoaded(page, 'subjects')
      await expect(subjectRow(page, 8).getByTestId('subject-levels')).toHaveText('Tingkatan 4')
      await expectNoHorizontalScroll(page)
    },
  )

  test('row actions are touch-sized below 1024px', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await openLevels(page, gotoApp)
    if (viewportWidth(page) >= 1024) return
    const row = levelRow(page, 7)
    await expectTouchTarget(rowEdit(row))
    await expectTouchTarget(row.getByRole('button', { name: 'Tindakan', exact: true }))
    await expectTouchTarget(rowSwitch(row))
    await expectTouchTarget(page.getByTestId('levels-add'))
  })
})

test.describe('M03 S10 / S11 level form', MODULE, () => {
  test.use({ mockInit: { latency: 0 } })

  test('create form: fields, hints, stage options, pink submit, validation, buttons', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openLevels(page, gotoApp)
    await page.getByTestId('levels-add').click()
    await expect(page).toHaveURL('/admin/education-levels/create')
    await expect(page.getByTestId('level-form')).toBeVisible()
    await expectTabTitle(page, 'Tambah Tahap Pendidikan | PRESTASIPLUS')

    await expect(page.getByTestId('level-back')).toHaveText('Kembali ke Senarai')
    await expect(page.getByTestId('level-name')).toHaveAttribute('placeholder', 'cth: Tingkatan 1')
    await expect(page.getByTestId('level-name-en')).toHaveAttribute('placeholder', 'e.g: Form 1')
    const code = page.getByTestId('level-code')
    await expect(code).toHaveAttribute('placeholder', 'cth: T1')
    await expect(code).toHaveAttribute('maxlength', '10')
    expect.soft(await code.evaluate((el) => getComputedStyle(el).textTransform)).toBe('uppercase') // V2 reference: uppercase code input
    await expect(page.getByText('Kod akan ditukar ke huruf besar automatik')).toBeVisible()
    await expect(page.locator('[data-testid=level-stage] option')).toHaveText([
      '-- Pilih Peringkat --',
      'Menengah Rendah (Lower Secondary)',
      'Menengah Atas (Upper Secondary)',
    ])
    await expect(page.getByTestId('level-curriculum')).toHaveAttribute(
      'placeholder',
      'cth: KSSR, KSSM',
    )
    await expect(page.getByText('Nama kurikulum yang diguna pakai')).toBeVisible()
    await expect(page.getByTestId('level-order')).toHaveValue('0')
    await expect(page.getByText('Nombor lebih kecil akan dipaparkan dahulu')).toBeVisible()
    await expect(page.getByTestId('form-submit')).toHaveText('Simpan Tahap')
    
    await expect(page.getByText('Aktif', { exact: true })).toHaveCount(0)
    await expectButtonRow(page)
    expect(await smallestTextInMain(page)).toBeGreaterThanOrEqual(12)
    await expectNoHorizontalScroll(page)

    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL('/admin/education-levels/create')
    expect(
      await page
        .getByTestId('level-name')
        .evaluate((el) => (el as HTMLInputElement).validity.valueMissing),
    ).toBe(true)

    await page.getByTestId('form-cancel').click()
    await expect(page).toHaveURL('/admin/education-levels')
  })

  test(
    'create saves the level and lists it with 0 soalan and 0 subjek',
    provisional('the flash text after a save is UNVERIFIED COPY (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/education-levels/create')
      await page.getByTestId('level-name').fill('Tahun Demo')
      await page.getByTestId('level-name-en').fill('Demo Year')
      await page.getByTestId('level-code').fill('yd')
      await page.getByTestId('level-stage').selectOption('lower_secondary')
      await page.getByTestId('level-curriculum').fill('KSSM')
      await page.getByTestId('form-submit').click()

      await expect(page).toHaveURL('/admin/education-levels')
      await expect(page.getByText('Tahap Pendidikan berjaya ditambah.')).toBeVisible()
      await expect(page.getByTestId('levels-count')).toHaveText('Jumlah: 6 tahap')
      const created = listRows(page, 'levels').filter({ hasText: 'Tahun Demo' })
      await expect(created).toContainText('YD')
      await expect(created.getByTestId('level-questions')).toHaveText('0 soalan')
      await expect(created.getByTestId('level-subjects')).toHaveText('0 subjek')
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'edit pre-fills level 10 and saves a change',
    provisional('the flash text after a save is UNVERIFIED COPY (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await openLevels(page, gotoApp)
      await rowEdit(levelRow(page, 10)).click()
      await expect(page).toHaveURL('/admin/education-levels/10/edit')
      await expectTabTitle(page, 'Edit Tahap Pendidikan | PRESTASIPLUS')
      await expect(page.getByTestId('level-name')).toHaveValue('Tingkatan 4')
      await expect(page.getByTestId('level-name-en')).toHaveValue('Form 4')
      await expect(page.getByTestId('level-code')).toHaveValue('T4')
      await expect(page.getByTestId('level-stage')).toHaveValue('upper_secondary')
      await expect(page.getByTestId('level-curriculum')).toHaveValue('KSSM')
      await expect(page.getByTestId('level-order')).toHaveValue('10')
      await expect(page.getByTestId('form-submit')).toHaveText('Kemaskini Tahap')
      await expect(page.getByText('Aktif', { exact: true })).toHaveCount(0)
      await expectButtonRow(page)
      await expectNoHorizontalScroll(page)

      await page.getByTestId('level-curriculum').fill('KSSM Semakan')
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL('/admin/education-levels')
      await expect(page.getByText('Tahap Pendidikan berjaya dikemaskini.')).toBeVisible()
      await expect(levelRow(page, 10)).toContainText('KSSM Semakan')
    },
  )

  test('an unknown level returns to the list with the one-time flash', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/education-levels/999/edit')
    await expect(page).toHaveURL('/admin/education-levels')
    await expect(page.getByText('Tahap Pendidikan tidak dijumpai.')).toBeVisible()
    await expectListLoaded(page, 'levels')
    await reloadApp(page)
    await expectListLoaded(page, 'levels')
    await expect(page.getByText('Tahap Pendidikan tidak dijumpai.')).toHaveCount(0)
  })
})

test.describe('M03 S6-S11 access', MODULE, () => {
  test.use({ mockInit: { latency: 0 } })

  test('a pelajar is refused on the admin screens (in-place 403 page)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajar@demo.test')
    for (const path of ['/admin/subjects', '/admin/education-levels']) {
      await gotoApp(path)
      // Route guard default onForbidden '403': the error page renders in place, the URL is kept.
      await expect(page.locator('[data-ds="error-page"][data-code="403"]')).toBeVisible()
      await expect(page).toHaveURL(path)
      await expect(page.getByTestId('subjects-table')).toHaveCount(0)
      await expect(page.getByTestId('levels-table')).toHaveCount(0)
    }
  })

  test('a guest is sent to the login page', async ({ page, gotoApp }) => {
    await gotoApp('/admin/subjects')
    await expect(page).toHaveURL(/\/login/)
  })
})
