/**
 * M10 S21-S24 Sumbang Soalan at 375 / 768 / 1280 (SRS M10 §12 scenarios 57-66; the titles carry
 * "SRS §12 #nn", not the E2E ids). Teacher `guru@demo.test` (anchor 700302, SRS §6.11: S21 1 / 1 / 0 / 0),
 * admin `admin@demo.test` (16,817 contributions from 522425) and the role refusals. The runtime
 * fixture 700301 is not insertable from a browser (no hook): the pending row is created through S22.
 * Flash texts are UNVERIFIED COPY (SRS §8.3): provisional tests assert that a flash appears.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  acceptNextDialog,
  dismissNextDialog,
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isMobileWidth,
  moduleTag,
  provisional,
} from '../support'

const GURU = 'guru@demo.test'
const ADMIN = 'admin@demo.test'
const MODULE = { tag: [moduleTag(10)] }

test.use({ mockInit: { latency: 0 } })

async function expectHeader(page: Page, title: string, subtitle: string): Promise<void> {
  await expect(page.getByTestId('shell-user-title')).toHaveText(title)
  await expect(page.getByTestId('shell-user-subtitle')).toHaveText(subtitle)
}

/** FR-M10-129: no text node inside `main` smaller than 12px (S21). */
async function expectMinFont(page: Page): Promise<void> {
  const smallest = await page.evaluate(() => {
    const main = document.querySelector('main')
    if (!main) return 0
    let min = Infinity
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if ((n.textContent ?? '').trim() === '' || !n.parentElement) continue
      const el = n.parentElement
      if (el.closest('.sr-only')) continue
      min = Math.min(min, parseFloat(getComputedStyle(el).fontSize))
    }
    return min
  })
  expect(smallest).toBeGreaterThanOrEqual(12)
}

/** Fills the S22 form for an MCQ and returns after choosing the options. */
async function fillMcq(page: Page, text: string, difficulty: string): Promise<void> {
  await page.getByTestId('q-level').selectOption({ label: 'Tingkatan 5' })
  await page.getByTestId('q-subject').selectOption({ label: 'Bahasa Melayu' })
  await page.getByTestId('q-difficulty').selectOption({ label: difficulty })
  await page.getByTestId('q-text').fill(text)
  for (const [i, v] of ['Pilihan satu', 'Pilihan dua', 'Pilihan tiga', 'Pilihan empat'].entries()) {
    await page.getByTestId(`q-option-${String(i)}`).fill(v)
  }
  await page.locator('[data-testid="q-correct"] [role="radio"]').nth(1).click()
}

// --- S21 -----------------------------------------------------------------------------------------

test.describe('S21 as the admin', MODULE, () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(ADMIN)
  })

  test('SRS §12 #57 stats, tiers, chips, first card, pager', async ({ page, gotoApp }) => {
    await gotoApp('/guru/soalan')
    await expectTabTitle(page, 'Sumbang Soalan - PRESTASIPLUS')
    await expectHeader(
      page,
      'Sumbang Soalan',
      'Sumbangan anda kepada bank soalan kebangsaan PrestasiPlus',
    )
    await expect(page.getByTestId('stat-total-value')).toHaveText('16817')
    await expect(page.getByTestId('stat-approved-value')).toHaveText('16817')
    await expect(page.getByTestId('stat-pending-value')).toHaveText('0')
    await expect(page.getByTestId('stat-used-value')).toHaveText('0')
    await expect(page.getByTestId('contribution-info')).toContainText(
      'Sumbang Soalan adalah platform perkongsian soalan untuk manfaat semua pelajar di seluruh Malaysia.',
    )
    await expect(page.getByTestId('tier')).toHaveCount(8)
    await expect(page.locator('[data-testid="tier"][data-reached="true"]')).toHaveCount(7)
    await expect(page.getByTestId('tier').first()).toContainText('Penyumbang Baru (10)')
    await expect(page.getByTestId('tier').last()).toContainText('Legenda Terulung (50,000)')
    await expect(page.getByTestId('next-tier')).toHaveText(
      'Sasaran seterusnya: Legenda Terulung — 50,000 soalan',
    )
    expect(await page.getByTestId('breakdown-chip').allTextContents()).toEqual([
      'Matematik — 3,287',
      'Pendidikan Islam — 2,516',
      'Bahasa Melayu — 2,342',
      'Bahasa Inggeris — 2,214',
      'Sains — 1,935',
      'Pendidikan Moral — 1,823',
      'Sejarah — 795',
      'Lain — 763',
      'Pendidikan Seni Visual — 510',
      'Pendidikan Syariah Islamiah — 363',
      'Geografi — 269',
    ])

    // Static AI card and the Audio KBAT links.
    await expect(page.getByTestId('ai-card')).toContainText('AI Auto-Generate Soalan')
    await expect(page.getByTestId('ai-card').locator('a, button, form')).toHaveCount(0)
    await expect(page.getByTestId('audio-kbat-card')).toContainText('Template XLSX')
    await expect(page.getByTestId('audio-kbat-card')).toContainText('Template Word')
    await expect(page.getByTestId('audio-create')).toHaveAttribute(
      'href',
      '/guru/audio-kbat/create',
    )
    await expect(page.getByTestId('audio-list')).toHaveAttribute('href', '/guru/audio-kbat')

    // First card.
    const cards = page.getByTestId('question-card')
    await expect(cards).toHaveCount(20)
    const first = cards.first()
    await expect(first).toHaveAttribute('data-question-id', '522425')
    // Subject / source / text of 522425 differ in the M04 seed from the observed anchor (reported to M04).
    await expect(first.getByTestId('chip-subject')).not.toHaveText('')
    await expect(first.getByTestId('chip-level')).not.toHaveText('')
    await expect(first.getByTestId('chip-difficulty')).not.toHaveText('')
    await expect(first.getByTestId('chip-dskp')).toHaveText('DSKP')
    await expect(first.getByTestId('chip-status')).toHaveText('Diluluskan')
    await expect(first.getByTestId('question-date')).toHaveText(/^\d{2} [A-Z][a-z]{2} 2026$/)
    await expect(first.getByTestId('question-body')).toHaveCount(0)
    await first.getByTestId('question-toggle').click()
    await expect(first.getByTestId('question-body')).toBeVisible()
    await expect(first.getByTestId('question-id')).toHaveText('522425')
    await expect(first.getByTestId('question-body')).toContainText('Aktif')
    await expect(first.locator('[data-testid="question-option"][data-correct="true"]')).toHaveCount(
      1,
    )
    await expect(first.getByTestId('question-edit')).toHaveAttribute(
      'href',
      '/guru/soalan/522425/edit',
    )

    // Padam: the confirm text, cancel keeps the card.
    const dismissed = dismissNextDialog(page, {
      type: 'confirm',
      message: 'Padam soalan #522425? Tindakan ini tidak boleh dibatalkan.',
    })
    await first.getByTestId('question-delete').click()
    await dismissed
    await expect(page.locator('[data-question-id="522425"]')).toHaveCount(1)
    await expect(page.getByTestId('stat-total-value')).toHaveText('16817')

    // Pager.
    await expect(page.getByText('Showing 1 to 20 of 16817 results')).toBeVisible({
      visible: !isMobileWidth(page),
    })
    await first.getByTestId('question-toggle').click()
    await expectMinFont(page)
    await expectNoHorizontalScroll(page)
    await gotoApp('/guru/soalan?page=2')
    await expect(page.getByTestId('question-card').first()).toHaveAttribute(
      'data-question-id',
      /^52\d{4}$/, // seed ids ascend; the observed 522445 is not reproduced (reported to M04)
    )
    await expect(page.getByTestId('question-card')).toHaveCount(20)
    await expectNoHorizontalScroll(page)
  })

  test('SRS §12 #65 S23 and S24 of 522425', async ({ page, gotoApp }) => {
    await gotoApp('/guru/soalan/522425')
    await expectTabTitle(page, 'Detail Soalan — Sumbang Soalan')
    await expectHeader(page, 'Detail Soalan', 'Selamat datang kembali')
    // Subject name of 522425 is not asserted: the seed gives "Pendidikan Islam" (reported to M04).
    await expect(page.getByTestId('detail-subject')).not.toHaveText('')
    await expect(page.getByTestId('detail-source')).not.toHaveText('')
    await expect(page.getByTestId('detail-tahap')).toHaveText(/^\s*Tahap [1-5]\s*$/)
    await expect(page.getByTestId('detail-type')).toHaveText('mcq')
    await expect(page.getByTestId('detail-text')).not.toHaveText('')
    const options = page.getByTestId('detail-option')
    await expect(options).toHaveCount(4)
    await expect(page.locator('[data-testid="detail-option"][data-correct="true"]')).toHaveCount(1)
    await expect(options.nth(0)).toContainText('A)')
    await expect(page.getByTestId('detail-explanation')).toContainText('Penerangan')
    await expect(page.getByTestId('stat-attempts')).toHaveText('0')
    await expect(page.getByTestId('stat-correct')).toHaveText('0')
    await expect(page.getByTestId('stat-accuracy')).toHaveText('0%')
    await expect(page.getByTestId('detail-back')).toHaveAttribute('href', '/guru/soalan')
    await expectTouchTarget(page.getByTestId('detail-edit'))
    await expectNoHorizontalScroll(page)

    await page.getByTestId('detail-edit').click()
    await expect(page).toHaveURL(/\/guru\/soalan\/522425\/edit$/)
    await expectTabTitle(page, 'Edit Soalan — Sumbang Soalan')
    await expectHeader(page, 'Edit Soalan', 'Selamat datang kembali')
    await expect(page.getByTestId('edit-source')).toContainText('Sumber Asal')
    // The seed difficulty of 522425 is not the observed 4 (reported to M04): only the structure is asserted.
    await expect(page.getByTestId('e-difficulty').locator('option')).toHaveCount(4)
    await expect(page.locator('[data-testid="e-correct"] [role="radio"][aria-checked="true"]')).toHaveCount(1)
    await expect(page.getByTestId('e-text')).toHaveAttribute('required', '')
    await expect(page.getByText('JPG, PNG, max 5MB.')).toBeVisible()
    await expect(page.getByTestId('form-cancel')).toHaveAttribute('href', '/guru/soalan/522425')
    await expect(page.getByTestId('edit-back')).toHaveAttribute('href', '/guru/soalan/522425')
    await expectNoHorizontalScroll(page)
  })
})

test.describe('S21 as the teacher', MODULE, () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(GURU)
  })

  test('SRS §12 #58 default seed anchors, delete 700302', async ({ page, gotoApp }) => {
    await gotoApp('/guru/soalan')
    await expect(page.getByTestId('stat-total-value')).toHaveText('1')
    await expect(page.getByTestId('stat-approved-value')).toHaveText('1')
    await expect(page.getByTestId('stat-pending-value')).toHaveText('0')
    await expect(page.getByTestId('stat-used-value')).toHaveText('0')
    await expect(page.locator('[data-testid="tier"][data-reached="true"]')).toHaveCount(0)
    await expect(page.getByTestId('next-tier')).toHaveText(
      'Sasaran seterusnya: Penyumbang Baru — 10 soalan',
    )
    expect(await page.getByTestId('breakdown-chip').allTextContents()).toEqual([
      'Bahasa Melayu — 1',
    ])
    const card = page.getByTestId('question-card')
    await expect(card).toHaveCount(1)
    const ownId = await card.getAttribute('data-question-id')
    await expect(card.getByTestId('chip-difficulty')).toHaveText('Mudah')
    await expect(page.locator('[data-testid="question-card"]')).toHaveCount(1)
    await expectMinFont(page)
    await expectNoHorizontalScroll(page)

    await card.getByTestId('question-toggle').click()
    const accepted = acceptNextDialog(page, {
      type: 'confirm',
      message: `Padam soalan #${String(ownId)}? Tindakan ini tidak boleh dibatalkan.`,
    })
    await card.getByTestId('question-delete').click()
    await accepted
    await expect(page.getByTestId('stat-total-value')).toHaveText('0')
    await expect(page.getByTestId('question-card')).toHaveCount(0)
    await expect(page.getByTestId('breakdown-chip')).toHaveCount(0)
  })

  test('SRS §12 #59 template download and the import form', async ({ page, gotoApp }) => {
    await gotoApp('/guru/soalan')
    await expect(page.getByTestId('import-card')).toContainText('Import Soalan (CSV/Excel)')
    await expect(page.getByTestId('import-card')).toContainText('Muat naik banyak soalan sekaligus')
    const download = page.waitForEvent('download')
    await page.getByTestId('import-template').click()
    expect((await download).suggestedFilename()).toBe('template-import-soalan.csv')

    await expect(page.getByTestId('import-form')).toHaveCount(0)
    await page.getByTestId('import-toggle').click()
    await expect(page.getByTestId('import-file')).toHaveAttribute('accept', '.csv,.txt')
    await expect(page.getByTestId('import-file')).toHaveAttribute('required', '')
    await expect(page.getByTestId('import-guide')).toContainText(
      'Soalan akan dihantar sebagai "Menunggu Semakan" untuk kelulusan admin',
    )
    await expectTouchTarget(page.getByTestId('import-submit'))
    await expectNoHorizontalScroll(page)
    await page.getByTestId('import-toggle').click()
    await expect(page.getByTestId('import-form')).toHaveCount(0)
  })

  test(
    'SRS §12 #60 imports a 2-row CSV with one invalid row',
    provisional('Import result summary is UNVERIFIED COPY (SRS §8.3)', MODULE.tag),
    async ({ page, gotoApp }) => {
      await gotoApp('/guru/soalan')
      await page.getByTestId('import-toggle').click()
      const csv = [
        'question_text,option_a,option_b,option_c,option_d,correct_answer,subject_id,education_level_id,difficulty_level,marks,explanation',
        '"Ibu negara Malaysia?",Kuala Lumpur,Putrajaya,Johor Bahru,Ipoh,A,1,11,2,1,"KL"',
        '"Soalan salah?",A,B,C,D,Z,1,11,2,1,',
      ].join('\r\n')
      await page
        .getByTestId('import-file')
        .setInputFiles({ name: 'soalan.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
      await page.getByTestId('import-submit').click()
      await expect(page.getByTestId('import-result-summary')).toBeVisible()
      await expect(page.getByTestId('import-failure')).toHaveCount(1)
      await expect(page.getByTestId('import-failure')).toContainText('Baris 3')
      await expect(page.getByTestId('stat-pending-value')).toHaveText('1')
      await expect(page.getByTestId('stat-total-value')).toHaveText('2')
    },
  )

  test('SRS §12 #61 Hantar Kertas texts, options, limits and the file list', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/guru/soalan')
    const card = page.getByTestId('paper-card')
    await expect(card).toContainText('Hantar Kertas Soalan kepada Admin')
    await expect(card).toContainText('Admin akan proses dan upload ke databank soalan')
    await expect(page.getByTestId('paper-types')).toContainText('Jenis Soalan Yang Diterima')
    await expect(page.getByTestId('paper-conditions')).toContainText(
      'PDF scan imej TIDAK diterima — teks mesti boleh disalin',
    )
    await expect(page.getByTestId('paper-steps')).toContainText('3. Databank')
    expect(await page.getByTestId('paper-jenis').locator('option').allTextContents()).toEqual([
      '-- Pilih Jenis --',
      'Soalan Umum',
      'Trial Paper',
      'Soalan DSKP',
      'Buku Teks',
      'Buku Latihan',
      'Soalan Peperiksaan',
      'Lain-lain',
    ])
    await expect(page.getByTestId('paper-subject')).toHaveAttribute('maxlength', '100')
    await expect(page.getByTestId('paper-subject')).toHaveAttribute(
      'placeholder',
      'Cth: Matematik, Fizik, BM...',
    )
    await expect(page.getByTestId('paper-tahun')).toHaveAttribute('min', '2000')
    await expect(page.getByTestId('paper-tahun')).toHaveAttribute('max', '2099')
    await expect(page.getByTestId('paper-oleh')).toHaveAttribute('maxlength', '150')
    await expect(page.getByTestId('paper-catatan')).toHaveAttribute('maxlength', '1000')
    await expect(page.getByTestId('paper-files')).toHaveAttribute(
      'accept',
      '.pdf,.doc,.docx,.xls,.xlsx',
    )
    await expect(page.getByTestId('paper-drop')).toContainText(
      'Klik untuk pilih fail PDF (teks), DOCX, XLSX — maks 5 fail, 20MB setiap fail',
    )
    await page.getByTestId('paper-files').setInputFiles([
      { name: 'kertas.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(1024 * 1024) },
      { name: 'skema.docx', mimeType: 'application/octet-stream', buffer: Buffer.from('x') },
    ])
    await expect(page.getByTestId('paper-file')).toHaveCount(2)
    await expect(page.getByTestId('paper-file').first()).toContainText('kertas.pdf')
    await expect(page.getByTestId('paper-file').first()).toContainText('1.00 MB')
    await expect(page.getByTestId('paper-file').first()).toHaveAttribute('data-kind', 'pdf')
    await expect(page.getByTestId('paper-file').nth(1)).toHaveAttribute('data-kind', 'word')
    await expectNoHorizontalScroll(page)
  })

  // --- S22 ---------------------------------------------------------------------------------------

  test('SRS §12 #63 S22 fields, type blocks, Arab keyboard, gallery, Batal', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/guru/soalan/cipta')
    await expectTabTitle(page, 'Tambah Soalan - PRESTASIPLUS')
    await expectHeader(page, 'Tambah Soalan Baru', 'Sumbangkan soalan untuk pelajar Malaysia')
    await expect(page.getByTestId('back-link')).toHaveText('Kembali ke Senarai Soalan')
    expect(await page.getByTestId('q-difficulty').locator('option').allTextContents()).toEqual([
      '-- Pilih Tahap --',
      'Mudah',
      'Sederhana',
      'Sukar',
    ])
    await expect(page.getByTestId('q-type').locator('option:checked')).toHaveText(
      'Aneka Pilihan (MCQ)',
    )
    await expect(page.getByTestId('q-subject').locator('option')).toHaveCount(32)
    await expect(page.getByTestId('q-level').locator('option')).toHaveCount(12)
    await expect(page.getByTestId('dskp-card')).toContainText('Pemetaan DSKP')
    await expect(page.getByTestId('q-chapter-add')).toBeDisabled()

    // Option images at 375 do not widen the page (DV-M10-21).
    await expect(page.getByTestId('mcq-card')).toContainText(
      'Masukkan 4 pilihan dan pilih jawapan yang betul.',
    )
    await expect(page.getByTestId('q-option-image-0')).toBeVisible()
    await expectNoHorizontalScroll(page)

    // Type switching.
    await page.getByTestId('q-type').selectOption('true_false')
    await expect(page.getByTestId('tf-card')).toBeVisible()
    await expect(page.getByTestId('mcq-card')).toHaveCount(0)
    await page.getByTestId('q-type').selectOption('short_answer')
    await expect(page.getByTestId('short-card')).toContainText('Jawapan Utama *')
    await page.getByTestId('q-type').selectOption('fill_blank')
    await expect(page.getByTestId('short-card')).toContainText('Gunakan ___ dalam soalan')
    await page.getByTestId('q-type').selectOption('essay')
    await expect(page.getByTestId('essay-card')).toContainText('Jawapan Contoh (Model Answer)')
    await page.getByTestId('q-type').selectOption('mcq')

    // Arab script: right to left, keyboard, "ب", Jawi layout.
    await page.getByTestId('q-script').selectOption('arab')
    await expect(page.getByTestId('q-text')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByTestId('q-preview')).toContainText('Pratonton paparan soalan:')
    await expect(page.getByTestId('q-preview-text')).toHaveText('(Tiada teks lagi)')
    await page.getByTestId('q-text').click()
    await page.getByTestId('vkb-toggle').click()
    const panel = page.getByTestId('vkb-panel')
    await expect(panel).toBeVisible()
    await expect(page.getByTestId('vkb-caption')).toHaveText('Papan Kekunci Arab')
    const mobile = (page.viewportSize()?.width ?? 0) < 640
    const box = await panel.boundingBox()
    expect(box).not.toBeNull()
    if (mobile) {
      await expect(page.getByTestId('vkb-backdrop')).toBeVisible()
      const vp = page.viewportSize()!
      expect(Math.abs(box!.width - vp.width)).toBeLessThan(2)
      expect(box!.y + box!.height).toBeGreaterThan(vp.height - 2)
    } else {
      await expect(page.getByTestId('vkb-backdrop')).toHaveCount(0)
      expect(box!.width).toBeLessThanOrEqual(580.5)
      expect(box!.width).toBeGreaterThan(500)
    }
    await expect(page.getByTestId('vkb-harakat')).toHaveCount(9)
    await panel.getByTestId('vkb-key').filter({ hasText: /^ب$/ }).first().click()
    await expect(page.getByTestId('q-text')).toHaveValue('ب')
    await expect(page.getByTestId('q-preview-text')).toHaveText('ب')
    await page.getByTestId('vkb-mode-jawi').click()
    await expect(page.getByTestId('vkb-caption')).toHaveText('Papan Kekunci Jawi')
    await expect(panel.getByTestId('vkb-key').filter({ hasText: /^ڤ$/ })).toHaveCount(1)
    await expectNoHorizontalScroll(page)
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)

    // Galeri Rajah: the live empty texts.
    await page.getByTestId('galeri-open').click()
    await expect(page.getByTestId('galeri-empty')).toContainText('Tiada galeri rajah tersedia')
    await expect(page.getByTestId('galeri-empty')).toContainText(
      'Sila muat naik imej secara manual menggunakan butang "Muat Naik"',
    )
    await page.getByTestId('galeri-cancel').click()
    await expect(page.getByTestId('galeri-empty')).toHaveCount(0)

    // Footer: "Batal" and the submit on one row.
    const cancel = await page.getByTestId('form-cancel').boundingBox()
    const submit = await page.getByTestId('form-submit').boundingBox()
    expect(Math.abs(cancel!.y - submit!.y)).toBeLessThan(2)
    await expectTouchTarget(page.getByTestId('form-submit'))
    await page.getByTestId('form-cancel').click()
    await expect(page).toHaveURL(/\/guru\/soalan$/)
  })

  test('SRS §12 #63 S22 inline chapter add (Bab Baru)', async ({ page, gotoApp }) => {
    await gotoApp('/guru/soalan/cipta')
    await page.getByTestId('q-level').selectOption({ label: 'Tingkatan 5' })
    await page.getByTestId('q-subject').selectOption({ label: 'Sains' })
    await expect(page.getByTestId('q-chapter-add')).toBeEnabled()
    await expect(page.getByTestId('q-chapter-select').locator('option')).not.toHaveCount(1)
    await page.getByTestId('q-chapter-add').click()
    await page.getByTestId('q-chapter-field-name').fill('Bab Ujian')
    await page.getByTestId('q-chapter-save').click()
    // Both number and name are needed: nothing happens.
    await expect(page.getByTestId('q-chapter-select').locator('option:checked')).toHaveText(
      '-- Pilih Bab --',
    )
    await page.getByTestId('q-chapter-field-number').fill('90')
    await page.getByTestId('q-chapter-save').click()
    await expect(page.getByTestId('q-chapter-select').locator('option:checked')).toHaveText(
      'Bab 90: Bab Ujian',
    )
    await expectNoHorizontalScroll(page)
  })

  test(
    'SRS §12 #64 and #66 teacher creates an MCQ, then edits it',
    provisional(
      'Flash texts and the post-save redirects are INFERRED / UNVERIFIED COPY',
      MODULE.tag,
    ),
    async ({ page, gotoApp }) => {
      await gotoApp('/guru/soalan/cipta')
      await fillMcq(page, 'Apakah ibu negara Malaysia?', 'Sukar')
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL(/\/guru\/soalan$/)
      await expect(page.getByTestId('stat-total-value')).toHaveText('2')
      await expect(page.getByTestId('stat-pending-value')).toHaveText('1')
      await expect(page.getByTestId('stat-approved-value')).toHaveText('1')
      const created = page
        .locator('[data-testid="question-card"]')
        .filter({ hasText: 'Apakah ibu negara Malaysia?' })
      await expect(created.getByTestId('chip-status')).toHaveText('Menunggu Semakan')
      await expect(created.getByTestId('chip-difficulty')).toHaveText('Sukar')
      const id = await created.getAttribute('data-question-id')
      expect(Number(id)).toBeGreaterThanOrEqual(9_000_001)

      // A second one with "Sederhana", then S24 changes only the explanation (difficulty kept).
      await gotoApp('/guru/soalan/cipta')
      await fillMcq(page, 'Soalan kedua untuk disunting?', 'Sederhana')
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL(/\/guru\/soalan$/)
      const second = page
        .locator('[data-testid="question-card"]')
        .filter({ hasText: 'Soalan kedua untuk disunting?' })
      const secondId = await second.getAttribute('data-question-id')
      await gotoApp(`/guru/soalan/${String(secondId)}/edit`)
      await expect(page.getByTestId('e-difficulty')).toHaveValue('3')
      await expect(page.locator('[data-testid="e-correct"] [role="radio"]').nth(1)).toBeChecked()
      await page.getByTestId('e-explanation').fill('Penjelasan baharu')
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL(new RegExp(`/guru/soalan/${String(secondId)}$`))
      await expect(page.getByTestId('detail-explanation')).toContainText('Penjelasan baharu')
      await expect(page.getByTestId('detail-tahap')).toHaveText('Tahap 3')
      await expectNoHorizontalScroll(page)
    },
  )

  test('SRS §12 #63 a server refusal keeps the typed values (empty option text via script)', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/guru/soalan/cipta')
    await fillMcq(page, 'Teks kekal selepas ralat?', 'Mudah')
    // Native required validation blocks an empty option before any request is made.
    await page.getByTestId('q-option-2').fill('')
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL(/\/guru\/soalan\/cipta$/)
    expect(await page.evaluate(() => document.querySelector('form:invalid') !== null)).toBe(true)
    await expect(page.getByTestId('q-text')).toHaveValue('Teks kekal selepas ralat?')
  })

  test('SRS §12 #65 a question that is not own is the 404 page', async ({ page, gotoApp }) => {
    await gotoApp('/guru/soalan/522425')
    await expectTabTitle(page, '404 - Halaman Tidak Dijumpai | PRESTASIPLUS')
    await gotoApp('/guru/soalan/522425/edit')
    await expectTabTitle(page, '404 - Halaman Tidak Dijumpai | PRESTASIPLUS')
    await gotoApp('/guru/soalan/99999999')
    await expectTabTitle(page, '404 - Halaman Tidak Dijumpai | PRESTASIPLUS')
  })

  test('S23 and S24 of the own anchor question', async ({ page, gotoApp }) => {
    await gotoApp('/guru/soalan')
    const ownId = await page.getByTestId('question-card').getAttribute('data-question-id')
    await gotoApp(`/guru/soalan/${String(ownId)}`)
    await expect(page.getByTestId('detail-text')).not.toHaveText('')
    await expect(page.getByTestId('detail-tahap')).toHaveText('Tahap 2')
    await expectNoHorizontalScroll(page)
    await gotoApp(`/guru/soalan/${String(ownId)}/edit`)
    await expect(page.getByTestId('e-difficulty')).toHaveValue('2')
    await expectNoHorizontalScroll(page)
  })
})

// --- Role refusals -------------------------------------------------------------------------------

test.describe('S21-S24 access', MODULE, () => {
  test('a guest is sent to /login', async ({ page, gotoApp }) => {
    await gotoApp('/guru/soalan')
    await expect(page).toHaveURL(/\/login/)
  })

  for (const path of ['/guru/soalan', '/guru/soalan/cipta', '/guru/soalan/700302']) {
    test(
      `a student does not get ${path}`,
      provisional(
        'Student access to /guru/* is UNVERIFIED (OQ-M10-08): landing redirect, INFERRED',
        MODULE.tag,
      ),
      async ({ page, loginAs, gotoApp }) => {
        await loginAs('pelajar@demo.test')
        await gotoApp(path)
        await expect(page).not.toHaveURL(/\/guru\/soalan/)
        await expect(page.getByTestId('soalan-page')).toHaveCount(0)
      },
    )
  }
})

// --- Observed anchors (reproduced by the M04 mock v7 seed) -----------------------------------------
// Exact observed anchors (M04 mock v7 reproduces them). The structural assertions above stay as the
// always-on check.

test.describe('S21-S24 observed anchors', MODULE, () => {
  test('522425 on S21 page 1 and page 2 start', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/guru/soalan')
    const first = page.getByTestId('question-card').first()
    await expect(first).toHaveAttribute('data-question-id', '522425')
    await expect(first.getByTestId('chip-subject')).toHaveText('Bahasa Melayu')
    await expect(first.getByTestId('chip-level')).toHaveText('Darjah 6')
    await expect(first.getByTestId('chip-difficulty')).toHaveText('Sukar')
    await expect(first.getByTestId('question-date')).toHaveText('02 May 2026')
    await first.getByTestId('question-toggle').click()
    await expect(first.getByTestId('question-body')).toContainText('textbook_content_rebuild')
    await expect(first.locator('[data-testid="question-option"]').nth(2)).toHaveAttribute(
      'data-correct',
      'true',
    )
    await gotoApp('/guru/soalan?page=2')
    await expect(page.getByTestId('question-card').first()).toHaveAttribute(
      'data-question-id',
      '522445',
    )
  })

  test('522425 on S23 and S24', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/guru/soalan/522425')
    await expect(page.getByTestId('detail-subject')).toHaveText('Bahasa Melayu')
    await expect(page.getByTestId('detail-source')).toHaveText('textbook_content_rebuild')
    await expect(page.getByTestId('detail-tahap')).toHaveText('Tahap 4')
    await expect(page.getByTestId('detail-text')).toHaveText(
      'Dalam tugasan pengukuhan, pilih ayat dialog yang betul dari segi tanda baca?',
    )
    await expect(page.getByTestId('detail-option').nth(2)).toHaveAttribute('data-correct', 'true')
    await gotoApp('/guru/soalan/522425/edit')
    await expect(page.getByTestId('edit-source')).toContainText('textbook_content_rebuild')
    await expect(page.getByTestId('e-difficulty')).toHaveValue('4')
    await expect(page.locator('[data-testid="e-correct"] [role="radio"]').nth(2)).toBeChecked()
  })

  test('teacher own question is 700302', async ({ page, loginAs, gotoApp }) => {
    await loginAs(GURU)
    await gotoApp('/guru/soalan/700302')
    await expect(page.getByTestId('detail-text')).toHaveText(
      'Pilih ayat yang menggunakan kata sendi nama dengan betul.',
    )
    await expect(page.getByTestId('detail-tahap')).toHaveText('Tahap 2')
  })
})
