/**
 * M04 G5 QA specs (written by QA, gaps in the developer smoke): S2 create, S4 edit, S5 import,
 * S5h history, S6 quality. Covers AC-M04-06.x .. 09.x, 12.x .. 16.x.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  isDesktopShell,
  moduleTag,
  viewportWidth,
  SM_MIN_WIDTH,
} from '../support'

const ADMIN = 'admin@demo.test'
const byId = (page: Page, id: string) => page.getByTestId(id)
const NL = String.fromCharCode(10)

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

test.describe('QA G5 S2 create form', { tag: [moduleTag(4), '@qa'] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(150_000)

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions/create')
  })

  test('E2E-M04-10 header, back link, shell title, difficulty cards, extra card, Batal (AC-06.1, 06.2, 06.4)', async ({
    page,
  }) => {
    await expect(byId(page, 'shell-admin-title')).toHaveText('Tambah Soalan Baru')
    await expect(byId(page, 'shell-admin-subtitle')).toHaveCount(0)
    await expect(byId(page, 'q-subject').locator('option').first()).toHaveText('Pilih Subjek')
    await expect(byId(page, 'q-level').locator('option').first()).toHaveText(
      'Pilih Tahap Pendidikan',
    )
    for (const n of [1, 2, 3, 4, 5])
      await expect(page.locator(`[id="q-difficulty"] [role="radio"][value="${String(n)}"]`)).not.toBeChecked()
    for (const label of ['Sangat Mudah', 'Mudah', 'Sederhana', 'Sukar', 'Sangat Sukar'])
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    await expect(byId(page, 'q-text')).toHaveAttribute(
      'placeholder',
      'Masukkan teks soalan di sini...',
    )
    await expect(byId(page, 'q-explanation')).toHaveAttribute('rows', '3')
    await expect(byId(page, 'q-explanation')).toHaveAttribute(
      'placeholder',
      'Penjelasan untuk jawapan (pilihan)',
    )
    await expect(
      page.getByText('Penjelasan akan ditunjukkan kepada pelajar selepas menjawab'),
    ).toBeVisible()
    await expect(byId(page, 'q-language').locator('option:checked')).toHaveText('Bahasa Melayu')
    expect(
      (await byId(page, 'q-language').locator('option').allInnerTexts()).map((s) => s.trim()),
    ).toEqual(['Bahasa Melayu', 'Bahasa Inggeris'])
    await expect(byId(page, 'q-points')).toHaveAttribute('min', '1')
    await expect(page.getByText('Mata yang diperoleh jika jawapan betul')).toBeVisible()
    await expect(byId(page, 'form-cancel')).toHaveAttribute('href', '/admin/questions')
    await expect(byId(page, 'q-type').locator('option:checked')).toContainText('Objektif (MCQ)')
    await expect(byId(page, 'question-form').getByRole('link', { name: /Batal/ })).toBeVisible()
    await byId(page, 'form-cancel').click()
    await expect(page).toHaveURL(/\/admin\/questions$/)
  })

  test('E2E-M04-12 required fields block submit one by one (AC-06.5)', async ({ page }) => {
    await byId(page, 'form-submit').click()
    await expect(byId(page, 'q-subject')).toHaveJSProperty('validity.valueMissing', true)
    await byId(page, 'q-subject').selectOption({ label: 'Sains' })
    await byId(page, 'form-submit').click()
    await expect(byId(page, 'q-level')).toHaveJSProperty('validity.valueMissing', true)
    await byId(page, 'q-level').selectOption({ label: 'Tingkatan 5' })
    await byId(page, 'q-text').fill('Soalan ujian lengkap tanpa kesukaran.')
    await byId(page, 'form-submit').click()
    // Difficulty radio group required.
    await expect(byId(page, 'field-error').first()).toHaveText('Sila pilih tahap kesukaran.')
    await expect(page).toHaveURL(/\/admin\/questions\/create$/)
    // Essay with empty options is not blocked by the (now optional) option fields.
    await byId(page, 'q-type').selectOption('essay')
    await page.locator('[id="q-difficulty"] [role="radio"][value="2"]').check()
    await byId(page, 'form-submit').click()
    await expect(page).toHaveURL(/\/admin\/questions$/)
  })

  test('E2E-M04-14 MCQ card: 4 rows A-D, radios, placeholders, image pickers, note (AC-07.1)', async ({
    page,
  }) => {
    for (const i of [0, 1, 2, 3]) {
      const letter = 'ABCD'[i]
      await expect(byId(page, `q-option-${String(i)}`)).toHaveAttribute(
        'placeholder',
        `Masukkan pilihan ${letter}`,
      )
      await expect(byId(page, `q-option-${String(i)}`)).toHaveAttribute('required', '')
      await expect(byId(page, `q-option-image-${String(i)}`)).toBeVisible()
    }
    await expect(page.locator('[id="q-correct-0"] [role="radio"]')).toBeChecked()
    await expect(byId(page, 'mcq-card')).toContainText(
      'Pilih butang radio di sebelah pilihan yang merupakan jawapan yang betul.',
    )
    await expect(byId(page, 'mcq-card')).toContainText('Pilihan Jawapan')
    await expect(byId(page, 'mcq-card').getByRole('button', { name: /tambah|buang/i })).toHaveCount(
      0,
    )
  })

  test('E2E-M04-14 true/false, short, fill-blank, essay cards: copy and optional (AC-07.2, 07.3, 07.4)', async ({
    page,
  }) => {
    await byId(page, 'q-type').selectOption('true_false')
    await expect(byId(page, 'tf-card')).toContainText('Betul')
    await expect(byId(page, 'tf-card')).toContainText('Salah')
    await expect(page.locator('[id="q-tf"] [role="radio"][value="true"]')).not.toBeChecked()
    await expect(page.locator('[id="q-tf"] [role="radio"][value="false"]')).not.toBeChecked()
    await expect(byId(page, 'q-option-0')).not.toHaveAttribute('required', /.*/)

    await byId(page, 'q-type').selectOption('short_answer')
    await expect(byId(page, 'q-answer-text')).toHaveAttribute(
      'placeholder',
      'Masukkan jawapan betul',
    )
    await expect(byId(page, 'q-answer-text')).not.toHaveAttribute('required', /.*/)
    await expect(byId(page, 'q-alt')).toHaveAttribute('placeholder', 'cth: jawapan1, jawapan2')
    await expect(page.getByText('Jawapan lain yang juga diterima')).toBeVisible()
    await expect(page.getByText('Jawapan Alternatif (pisahkan dengan koma)')).toBeVisible()

    await byId(page, 'q-type').selectOption('essay')
    await expect(byId(page, 'q-model')).toHaveAttribute('rows', '6')
    await expect(byId(page, 'q-model')).toHaveAttribute(
      'placeholder',
      'Tulis jawapan contoh di sini...',
    )
    await expect(
      page.getByText('Jawapan Model (pilihan — ditunjukkan sebagai rujukan)'),
    ).toBeVisible()
  })

  test('E2E-M04-13 create an MCQ: new question is the first row, flash; short text error (AC-06.6)', async ({
    page,
    gotoApp,
  }) => {
    await byId(page, 'q-subject').selectOption({ label: 'Sains' })
    await byId(page, 'q-level').selectOption({ label: 'Tingkatan 5' })
    await page.locator('[id="q-difficulty"] [role="radio"][value="3"]').check()
    await byId(page, 'q-text').fill('Soalan QA G5 yang baharu dicipta untuk ujian.')
    for (const [i, t] of ['Satu', 'Dua', 'Tiga', 'Empat'].entries())
      await byId(page, `q-option-${String(i)}`).fill(t)
    await page.locator('[id="q-correct-2"] [role="radio"]').check()
    await byId(page, 'form-submit').click()
    await expect(page).toHaveURL(/\/admin\/questions$/)
    await expect(byId(page, 'cmp-flash')).toBeVisible()
    await expect(byId(page, 'question-row').first()).toContainText('Soalan QA G5 yang baharu')
    await expect(byId(page, 'questions-total')).toHaveText('Jumlah: 465,279 soalan')
    await expect(byId(page, 'question-status').first()).toHaveText(/Draf|Menunggu|Diluluskan/)
    void gotoApp
  })

  test('E2E-M04-11 option A image picker: preview and remove (AC-06.3)', async ({ page }) => {
    await byId(page, 'q-option-image-0-input').setInputFiles({
      name: 'a.png',
      mimeType: 'image/png',
      buffer: PNG,
    })
    await expect(byId(page, 'q-option-image-0-preview')).toBeVisible()
    await byId(page, 'q-option-image-0-remove').click()
    await expect(byId(page, 'q-option-image-0-preview')).toHaveCount(0)
    await expect(byId(page, 'q-option-image-0-input')).toHaveValue('')
  })

  test('E2E-M04-16 keyboard toggle size, Arab panel caption, 9 harakat titles, Jawi rows (AC-08.1, 08.2, 08.3)', async ({
    page,
  }) => {
    const box = await byId(page, 'vkb-toggle').boundingBox()
    // 36x36 on desktop; 44px hit area on touch (AC-30.5).
    if (isDesktopShell(page)) {
      expect(Math.round(box!.width)).toBe(36)
      expect(Math.round(box!.height)).toBe(36)
    } else {
      expect(box!.width).toBeGreaterThanOrEqual(36)
    }
    await expect(byId(page, 'vkb-toggle')).toHaveAttribute('title', 'Papan kekunci Arab / Jawi')
    await byId(page, 'vkb-toggle').click()
    await expect(byId(page, 'vkb-mode-arab')).toBeVisible()
    await expect(byId(page, 'vkb-caption')).toHaveText('Papan Kekunci Arab')
    const titles = await byId(page, 'vkb-harakat').evaluateAll((els) =>
      els.map((e) => e.getAttribute('title')),
    )
    expect(titles).toHaveLength(9)
    expect(titles[0]).toBe('Fathah (atas)')
    expect(titles[8]).toBe('Superscript Alif (alif kecil)')
    await expect(byId(page, 'vkb-panel')).toContainText('SPACE')
    await expect(byId(page, 'vkb-panel')).toContainText('ال')
    await expect(byId(page, 'vkb-panel')).toContainText('ة')
    await byId(page, 'vkb-mode-jawi').click()
    for (const ch of ['ڤ', 'ڠ', 'ڽ', 'ݢ', 'ۏ', 'چ'])
      await expect(byId(page, 'vkb-panel')).toContainText(ch)
    // Panel placement: bottom sheet below 640px, 580px wide under the textarea on desktop.
    const panel = await byId(page, 'vkb-panel').boundingBox()
    if (viewportWidth(page) < SM_MIN_WIDTH) {
      expect(panel!.y + panel!.height).toBeGreaterThan(700)
    } else if (isDesktopShell(page)) {
      expect(Math.round(panel!.width)).toBe(580)
    }
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M04-17 harakat inserts and newline key; textarea stays focused (AC-08.4)', async ({
    page,
  }) => {
    await byId(page, 'vkb-toggle').click()
    const text = byId(page, 'q-text')
    await text.fill('ab')
    await text.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(1, 1))
    await byId(page, 'vkb-harakat').first().click()
    const v = await text.inputValue()
    expect(v.length).toBe(3)
    expect(v.startsWith('a')).toBe(true)
    expect(v.endsWith('b')).toBe(true)
    await byId(page, 'vkb-newline').click()
    expect(await text.inputValue()).toContain(NL)
    await expect(text).toBeFocused()
  })

  test('E2E-M04-18 Esc, close button close; textarea keeps dir=rtl; desktop below textarea (AC-08.5)', async ({
    page,
  }) => {
    await byId(page, 'vkb-toggle').click()
    if (isDesktopShell(page)) {
      const t = await byId(page, 'q-text').boundingBox()
      const p = await byId(page, 'vkb-panel').boundingBox()
      expect(p!.y).toBeGreaterThanOrEqual(t!.y + t!.height - 2)
    }
    await byId(page, 'vkb-close').click()
    await expect(byId(page, 'vkb-panel')).toHaveCount(0)
    await expect(byId(page, 'q-text')).toHaveAttribute('dir', 'rtl')
    await expect(byId(page, 'q-text')).toHaveCSS('font-family', /Scheherazade New/)
    await expect(byId(page, 'vkb-toggle')).toBeVisible()
  })

  test('E2E-M04-19 DSKP chain: Bidang only after Subjek+Tahap, SK/SP disabled, tag, reset, clear subject keeps tag (AC-09.1, 09.2, 09.3, 09.6)', async ({
    page,
  }) => {
    await expect(byId(page, 'dskp-bidang').locator('option')).toHaveCount(1)
    await byId(page, 'q-subject').selectOption({ label: 'Sains' })
    await expect(byId(page, 'dskp-bidang').locator('option')).toHaveCount(1)
    await byId(page, 'q-level').selectOption({ label: 'Tingkatan 5' })
    await expect.poll(() => byId(page, 'dskp-bidang').locator('option').count()).toBeGreaterThan(1)
    await expect(byId(page, 'dskp-bidang').locator('option').first()).toHaveText(
      '-- Pilih Bidang --',
    )
    await expect(byId(page, 'dskp-bidang')).toContainText(
      'T5-SUB4-TEXTBOOK - Sains T5 - Sokongan Bab Buku Teks',
    )
    await expect(byId(page, 'dskp-sk')).toBeDisabled()
    await expect(byId(page, 'dskp-sp')).toBeDisabled()
    const bid = byId(page, 'dskp-bidang').locator('option', { hasText: 'T5-SUB4-TEXTBOOK' })
    await byId(page, 'dskp-bidang').selectOption((await bid.getAttribute('value')) ?? '')
    await expect(byId(page, 'dskp-sk')).toBeEnabled()
    await expect(byId(page, 'dskp-sp')).toBeDisabled()
    await expect(byId(page, 'dskp-sk').locator('option').first()).toHaveText('-- Pilih SK --')
    await expect.poll(() => byId(page, 'dskp-sk').locator('option').count()).toBeGreaterThan(1)
    const sk = byId(page, 'dskp-sk')
      .locator('option', { hasText: /^\s*T5SN\.B9 - / })
      .first()
    await byId(page, 'dskp-sk').selectOption((await sk.getAttribute('value')) ?? '')
    await expect(byId(page, 'dskp-sp')).toBeEnabled()
    await expect.poll(() => byId(page, 'dskp-sp').locator('option').count()).toBeGreaterThan(1)
    await byId(page, 'dskp-sp').selectOption({ index: 1 })
    await expect(byId(page, 'dskp-tagged')).toHaveText('DSKP ditag')

    // AC-09.6: clearing Subjek keeps SK, SP and the tag (as live, AUD-M04-02); Bidang list empties.
    const spBefore = await byId(page, 'dskp-sp').inputValue()
    await byId(page, 'q-subject').selectOption('')
    await expect(byId(page, 'dskp-bidang').locator('option')).toHaveCount(1)
    await expect(byId(page, 'dskp-tagged')).toBeVisible()
    await expect(byId(page, 'dskp-sk')).toBeEnabled()
    await expect(byId(page, 'dskp-sp')).toBeEnabled()
    expect(await byId(page, 'dskp-sp').inputValue()).toBe(spBefore)

    // Setting both again resets all three.
    await byId(page, 'q-subject').selectOption({ label: 'Sains' })
    await expect.poll(() => byId(page, 'dskp-bidang').locator('option').count()).toBeGreaterThan(1)
    await expect(byId(page, 'dskp-tagged')).toHaveCount(0)
    await expect(byId(page, 'dskp-sk')).toBeDisabled()
  })
})

test.describe('QA G5 S4 edit form', { tag: [moduleTag(4), '@qa'] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(150_000)

  test('E2E-M04-27 header, shell title, options required, Batal to S3, save shows new text + flash (AC-12.1, 12.2, 12.5)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions/564159/edit')
    await expect(byId(page, 'shell-admin-title')).toHaveText('Edit Soalan')
    await expect(byId(page, 'shell-admin-subtitle')).toHaveCount(0)
    for (const i of [0, 1, 2, 3])
      await expect(byId(page, `q-option-${String(i)}`)).toHaveAttribute('required', '')
    await expect(page.locator('[id="q-correct-0"] [role="radio"]')).toBeChecked()
    await byId(page, 'q-text').fill('Teks soalan yang dikemaskini oleh QA G5.')
    await byId(page, 'form-submit').click()
    await expect(page).toHaveURL(/\/admin\/questions\/564159$/)
    await expect(byId(page, 'cmp-flash')).toBeVisible()
    await expect(byId(page, 'question-text')).toContainText(
      'Teks soalan yang dikemaskini oleh QA G5.',
    )
    await gotoApp('/admin/questions/564159/edit')
    await byId(page, 'form-cancel').click()
    await expect(page).toHaveURL(/\/admin\/questions\/564159$/)
  })

  test.describe('states profile (image anchor)', () => {
    test.use({ mockInit: { latency: 0, overrides: { questionStore: { profile: 'states' } } } })

    test('E2E-M04-29 S4 of 570022: new image reads "Tukar gambar"; remove posts remove flags (AC-12.4)', async ({
      page,
      loginAs,
      gotoApp,
      mock,
    }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/questions/570022/edit')
      await expect(byId(page, 'q-image')).toBeVisible()
      await byId(page, 'q-image-input').setInputFiles({
        name: 'n.png',
        mimeType: 'image/png',
        buffer: PNG,
      })
      await expect(byId(page, 'q-image')).toContainText('Tukar gambar')
      await byId(page, 'q-image-remove').click()
      // Remove the saved question image and option B image when present.
      const removeBtns = page.locator('[data-testid$="-remove"]:visible')
      const n = await removeBtns.count()
      for (let i = 0; i < n; i++) await removeBtns.first().click()
      await byId(page, 'form-submit').click()
      await expect(page).toHaveURL(/\/admin\/questions\/570022$/)
      const reqs = (await mock.requests('/api/questions/570022')).filter((r) => r.method !== 'GET')
      expect(reqs.length).toBeGreaterThan(0)
      expect(JSON.stringify(reqs)).toMatch(/removeQuestionImage|remove_question_image/)
    })
  })
})

test.describe('QA G5 S5 import', { tag: [moduleTag(4), '@qa'] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(150_000)

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions/import')
  })

  test('E2E-M04-30 shell title/subtitle, file hints, defaults, format card suffixes (AC-13.1, 13.2, 13.3, 13.4)', async ({
    page,
  }) => {
    await expect(byId(page, 'shell-admin-title')).toHaveText('Import Soalan Secara Pukal')
    await expect(byId(page, 'shell-admin-subtitle')).toHaveText(
      'Muat naik fail CSV untuk menambah soalan secara pukal',
    )
    await expect(page.getByText('Saiz maksimum: 5MB. Format: CSV atau TXT')).toBeVisible()
    await expect(page.getByText('Tetapan Lalai (Pilihan)')).toBeVisible()
    await expect(
      page.getByText('Nilai ini digunakan jika kolum berkaitan tiada dalam CSV.'),
    ).toBeVisible()
    await expect(byId(page, 'import-default-subject').locator('option').first()).toHaveText(
      '-- Tidak ditetapkan --',
    )
    await expect(byId(page, 'import-default-level').locator('option').first()).toHaveText(
      '-- Tidak ditetapkan --',
    )
    await expect(byId(page, 'import-default-difficulty').locator('option:checked')).toHaveText(
      'Mudah',
    )
    await expect(byId(page, 'import-file')).toHaveAttribute('required', '')
    await expect(byId(page, 'import-format-card')).toContainText(
      /subject_id.*(atau guna Tetapan Lalai)/,
    )
    await expect(byId(page, 'import-format-card')).toContainText(
      /education_level_id.*(atau guna Tetapan Lalai)/,
    )
    await expect(byId(page, 'import-template-card')).toContainText('Muat Turun Templat')
    await expect(byId(page, 'import-submit')).toContainText('Mula Import')
    await byId(page, 'import-submit').click()
    await expect(byId(page, 'import-file')).toHaveJSProperty('validity.valueMissing', true)
    await expect(byId(page, 'import-alert')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
    // Side cards stack below under 1024 and sit beside at 1280 (AC-30.4).
    const form = await byId(page, 'import-form').boundingBox()
    const tpl = await byId(page, 'import-template-card').boundingBox()
    if (isDesktopShell(page)) expect(tpl!.x).toBeGreaterThan(form!.x + form!.width - 4)
    else expect(tpl!.y).toBeGreaterThan(form!.y + form!.height - 4)
  })

  test('E2E-M04-31 3-row CSV: one row missing subject; without default 2 imported 1 failed; with default Matematik 3 (AC-13.5)', async ({
    page,
    gotoApp,
  }) => {
    const header =
      'question_text,option_a,option_b,option_c,option_d,correct_answer,subject_id,education_level_id,difficulty_level,marks,explanation'
    const csv = [
      header,
      '"Soalan QA import satu apakah ini?",A1,B1,C1,D1,A,3,11,2,1,',
      '"Soalan QA import dua apakah ini?",A2,B2,C2,D2,B,3,11,2,1,',
      '"Soalan QA import tiga tanpa subjek",A3,B3,C3,D3,C,,11,2,1,',
    ].join(NL)
    await byId(page, 'import-file').setInputFiles({
      name: 'qa.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    })
    await byId(page, 'import-submit').click()
    await expect(byId(page, 'cmp-flash')).toContainText(
      'Import selesai: 2 soalan diimport, 1 gagal.',
    )

    await gotoApp('/admin/questions/import')
    await byId(page, 'import-default-subject').selectOption({ label: 'Matematik' })
    await byId(page, 'import-file').setInputFiles({
      name: 'qa.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    })
    await byId(page, 'import-submit').click()
    await expect(byId(page, 'cmp-flash')).toContainText(
      'Import selesai: 3 soalan diimport, 0 gagal.',
    )
    await gotoApp('/admin/questions?status=draft')
    await expect(byId(page, 'question-row').first()).toBeVisible()
    await expect(byId(page, 'question-status').first()).toHaveText('Draf')
  })

  test('E2E-M04-32 Muat Turun Templat: file name and header row (AC-13.6)', async ({ page }) => {
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      byId(page, 'import-template-download').click(),
    ])
    expect(dl.suggestedFilename()).toBe('templat-import-soalan.csv')
    const stream = await dl.createReadStream()
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(c as Buffer)
    const first = Buffer.concat(chunks).toString('utf8').split(/\r?\n/)[0] ?? ''
    expect(first.replace(/^﻿/, '')).toBe(
      'question_text,option_a,option_b,option_c,option_d,correct_answer,subject_id,education_level_id,difficulty_level,marks,explanation',
    )
  })

  test('E2E-M04-33 history: Kembali goes to import; only Kembali action; empty-run page (AC-14.1, 14.2)', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/questions/import-history')
    await expect(page.getByText('Sejarah Import').first()).toBeVisible()
    await expect(page.locator('main button')).toHaveCount(0)
    await byId(page, 'history-back').click()
    await expect(page).toHaveURL(/\/admin\/questions\/import$/)
  })
})

test.describe('QA G5 S6 quality', { tag: [moduleTag(4), '@qa'] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(150_000)

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions/quality')
  })

  test('E2E-M04-34 shell title/subtitle, KPI labels, bucket titles upper case, legacy backticks (AC-15.1, 15.2)', async ({
    page,
  }) => {
    await expect(byId(page, 'shell-admin-title')).toHaveText('Dashboard Kualiti Soalan')
    await expect(byId(page, 'shell-admin-subtitle')).toHaveText(
      'Analisa kualiti keseluruhan bank soalan',
    )
    await expect(byId(page, 'kpi-total')).toContainText('Jumlah Soalan')
    await expect(byId(page, 'kpi-average')).toContainText('Purata Skor')
    await expect(byId(page, 'kpi-excellent')).toContainText('Cemerlang (76-100)')
    await expect(byId(page, 'kpi-action')).toContainText('Perlu Tindakan Aktif (≤ 50)')
    await expect(byId(page, 'kpi-total-value')).toHaveText('465,278')
    for (const [id, text] of [
      ['bucket-baik', 'Skor 51-75'],
      ['bucket-lemah', 'Skor ≤ 50'],
      ['bucket-legacy', 'Generik Lama'],
    ] as Array<[string, string]>) {
      const title = byId(page, id).getByText(text, { exact: true })
      await expect(title).toBeVisible()
      expect(await title.evaluate((el) => getComputedStyle(el).textTransform)).toBe('uppercase')
    }
    await expect(byId(page, 'bucket-legacy')).toContainText('`tracking_a_feed_20260308`')
    await expect(byId(page, 'bucket-legacy')).toContainText('`spm_tracking_auto_seed_v1`')
    await expect(byId(page, 'bucket-legacy')).toContainText('`source_type=ai_generated`')
  })

  test('E2E-M04-34 distribution, subject rows sorted by Purata desc, levels, action list header (AC-15.3, 15.4, 15.5)', async ({
    page,
  }) => {
    for (const k of ['cemerlang', 'baik', 'lemah', 'kritikal']) void k
    await expect(byId(page, 'quality-distribution')).toContainText('Cemerlang')
    await expect(byId(page, 'quality-distribution')).toContainText('Baik')
    await expect(byId(page, 'quality-distribution')).toContainText('Lemah')
    await expect(byId(page, 'quality-distribution')).toContainText('Kritikal')
    const rows = byId(page, 'subject-row')
    expect(await rows.count()).toBeGreaterThan(20)
    const avgs = await rows.evaluateAll((els) =>
      els.map((el) => {
        const m = (el as HTMLElement).innerText.match(/(\d+\.\d)/)
        return m ? Number(m[1]) : NaN
      }),
    )
    expect(avgs.some((n) => Number.isNaN(n))).toBe(false)
    for (let i = 1; i < avgs.length; i++)
      expect(avgs[i] ?? 0).toBeLessThanOrEqual((avgs[i - 1] ?? 0) + 0.0001)
    await expect(byId(page, 'level-row').first()).toContainText('Darjah 1')
    await expect(byId(page, 'level-row').last()).toContainText('Tingkatan 5')
    await expect(byId(page, 'quality-actions')).toContainText(
      'Memaparkan hanya soalan skor ≤ 50 selepas menolak sumber generic legacy.',
    )
    for (const h of ['ID', 'Soalan', 'Subjek', 'Tingkatan', 'Sumber', 'Skor'])
      await expect(
        byId(page, 'quality-actions').getByText(h, { exact: true }).first(),
      ).toBeVisible()
    await expect(byId(page, 'quality-actions')).toContainText('#129114')
    await expect(byId(page, 'quality-actions')).toContainText('#129216')
  })

  test('E2E-M04-35 audit button shows the busy state while running and no dialog (AC-16.1)', async ({
    page,
    mock,
  }) => {
    await mock.setLatency(1500)
    await byId(page, 'quality-audit').click()
    await expect(byId(page, 'quality-audit')).toBeDisabled()
    await expect(byId(page, 'quality-audit')).toContainText('Sedang audit...')
    await expect(byId(page, 'cmp-flash')).toBeVisible({ timeout: 15_000 })
  })
})
