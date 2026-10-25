/**
 * G5 acceptance of v2-dskp-integration (FB-026): intake, manual entry, the Tag DSKP block, the
 * gates, the bank and the review queue, the student side, responsive and dark mode.
 *
 * Needs the scope-ON build: `npx playwright test -c playwright.bijak.config.mjs` (set
 * `BIJAK_DEV=1`), or any config that serves `vite --mode e2e` with `VITE_PROTOTYPE_SCOPE=on`.
 * Set DSKP_SHOTS=<dir> to write screenshots. Test names carry the AC ids they execute.
 */
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTouchTarget } from '../support'
import {
  ADMIN,
  SUBJECTS_13,
  applyFilters,
  fillBasics,
  makePaperPdf,
  openFilters,
  openIssues,
  optionTexts,
  pagerTotal,
  rowButton,
  setFilter,
  shot,
  startManual,
  tid,
} from './dskp-g5-support'

test.skip(
  process.env.E2E_PROTOTYPE_SCOPE !== 'on',
  'needs the scope-on build: playwright.bijak.config.mjs',
)

/* ----------------------------------------------------------------------------- 1. manual entry */

test.describe('Manual entry and the Tag DSKP block (US-03, US-04, US-05, US-06)', () => {
  test('AC-03.1 AC-04.1 AC-05.1: 13 subjects in the declaration; nothing pre-chosen in the block', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/spm/soalan/manual')
    await expect(tid(page, 'intake-subject')).toBeVisible()
    expect(await optionTexts(tid(page, 'intake-subject'))).toEqual(SUBJECTS_13)
    await expectNoHorizontalScroll(page)
    await shot(page, 'manual-declaration')

    await tid(page, 'intake-source').fill('Kertas sekolah sendiri')
    await tid(page, 'intake-copyright').selectOption('sendiri')
    await tid(page, 'manual-start').click()
    const block = tid(page, 'tag-block')
    await block.scrollIntoViewIfNeeded()
    await expect(block.getByTestId('tag-subject')).toHaveText('Subjek: Matematik')
    await expect(tid(page, 'q-form')).toHaveValue('')
    await expect(tid(page, 'q-tp')).toHaveValue('')
    await expect(tid(page, 'q-kbat')).toHaveValue('')
    await expect(tid(page, 'q-unit')).toBeDisabled()
    await expect(tid(page, 'sp-search')).toBeDisabled()
    await expect(tid(page, 'sp-need-unit')).toHaveText('Pilih unit dahulu untuk melihat SP.')
    await expect(tid(page, 'q-sk')).toContainText('Dipaparkan selepas SP dipilih.')
    expect(await optionTexts(tid(page, 'q-form'))).toEqual([
      'Pilih tingkatan',
      'Tingkatan 4',
      'Tingkatan 5',
      'Tingkatan 1-3 (di luar DSKP)',
    ])
    expect(await optionTexts(tid(page, 'q-tp'))).toEqual([
      'Pilih TP',
      'TP 1',
      'TP 2',
      'TP 3',
      'TP 4',
      'TP 5',
      'TP 6',
    ])
    await expectNoHorizontalScroll(page)
    await shot(block, 'tag-block-empty')
  })

  test('AC-04.2..04.5 AC-04.7 AC-04.8 AC-02.2 AC-05.4 AC-06.1..06.3 AC-07.3: T4 unit, SP picker, SK, TP descriptor, KBAT, notices, messages', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    const block = await startManual(page, gotoApp, 'MAT')
    await fillBasics(page)

    // Nothing chosen: the gate names subject/tingkatan and TP.
    expect(await openIssues(page)).toEqual([
      'Soalan 1: Subjek dan tingkatan perlu ditetapkan.',
      'Soalan 1: Tahap Penguasaan (TP) belum dipilih.',
    ])

    // Tingkatan 4: unit, SP and TP are asked for, with the exact messages.
    await tid(page, 'q-form').selectOption('T4')
    await expect(tid(page, 'q-unit')).toBeEnabled()
    expect(await openIssues(page)).toEqual([
      'Soalan 1: Unit DSKP belum dipilih.',
      'Soalan 1: Standard Pembelajaran (SP) belum dipilih.',
      'Soalan 1: Tahap Penguasaan (TP) belum dipilih.',
    ])

    // Unit list: only MAT T4 (10 units), grouped by Bidang, "{kod} - {tajuk}" as printed.
    const unitOpts = await optionTexts(tid(page, 'q-unit'))
    expect(unitOpts[0]).toBe('Pilih unit')
    expect(unitOpts).toHaveLength(11)
    expect(unitOpts[1]).toBe('1.0 - Fungsi dan Persamaan Kuadratik dalam Satu Pemboleh Ubah')
    expect(unitOpts).toContain('10.0 - Matematik Pengguna: Pengurusan Kewangan') // under its Bidang
    expect(unitOpts.join('|')).not.toContain('Ubahan') // a T5 unit never shows under T4
    const groups = await tid(page, 'q-unit')
      .locator('optgroup')
      .evaluateAll((gs) => gs.map((g) => g.getAttribute('label')))
    expect(groups).toEqual([
      'PERKAITAN DAN ALGEBRA',
      'NOMBOR DAN OPERASI',
      'MATEMATIK DISKRET',
      'STATISTIK DAN KEBARANGKALIAN',
    ])
    await expectTouchTarget(tid(page, 'q-form'))
    await expectTouchTarget(tid(page, 'q-unit'))

    // Unit 4.0 (Operasi Set): hint with the unit noun, SP list scoped to this unit.
    await tid(page, 'q-unit').selectOption('MAT:T4:u:4.0')
    await expect(block).toContainText('Mengikut Tajuk dalam DSKP')
    await expect(tid(page, 'sp-count')).toContainText('0 SP dipilih')
    await expect(tid(page, 'sp-count')).toContainText('9 SP dalam unit ini')
    await expect(page.locator('[data-testid^="sp-option-"]')).toHaveCount(9)

    // Search by code, by text, no match (with its clear button) and an SP of another unit.
    await tid(page, 'sp-search').fill('4.1.1')
    await expect(page.locator('[data-testid^="sp-option-"]')).toHaveCount(1)
    await tid(page, 'sp-search').fill('2.1.1')
    await expect(page.locator('[data-testid^="sp-option-"]')).toHaveCount(0) // AC-04.5
    await expect(tid(page, 'sp-no-match')).toContainText('Tiada SP sepadan dengan "2.1.1".')
    await tid(page, 'sp-search').fill('zzzz')
    await expectTouchTarget(tid(page, 'sp-clear-search'))
    await tid(page, 'sp-clear-search').click()
    await expect(tid(page, 'sp-search')).toHaveValue('')
    await expect(tid(page, 'sp-search')).toBeFocused()
    await tid(page, 'sp-search').fill('operasi')
    expect(await page.locator('[data-testid^="sp-option-"]').count()).toBeGreaterThan(0)
    await tid(page, 'sp-search').press('Enter') // never submits a surrounding form
    await tid(page, 'sp-search').fill('')

    // Two SP of two SK: both SK are shown, read-only, in print order.
    await expectTouchTarget(page.getByTestId('sp-option-4.1.1').locator('xpath=ancestor::li'))
    await tid(page, 'sp-option-4.1.1').click()
    await tid(page, 'sp-option-4.2.1').click()
    await expect(tid(page, 'sp-chip-4.1.1')).toBeVisible()
    await expect(tid(page, 'sp-chip-4.2.1')).toBeVisible()
    await expect(tid(page, 'sp-count')).toContainText('2 SP dipilih')
    await expect(tid(page, 'q-sk').locator('[data-testid="sk-row"]')).toHaveCount(2)
    await expect(tid(page, 'q-sk').locator('[data-testid="sk-row"]').first()).toContainText('4.1')
    await expect(tid(page, 'q-sk').locator('[data-testid="sk-row"]').nth(1)).toContainText('4.2')
    await expectTouchTarget(tid(page, 'sp-remove-4.1.1'))
    await tid(page, 'sp-remove-4.2.1').click()
    await expect(tid(page, 'sp-chip-4.2.1')).toHaveCount(0)
    await expect(tid(page, 'q-sk').locator('[data-testid="sk-row"]')).toHaveCount(1)

    // TP: no default; helper line, then the printed descriptor of the Tajuk (AC-02.2).
    await expect(tid(page, 'q-tp')).toHaveValue('')
    await expect(tid(page, 'tp-descriptor')).toContainText(
      'Pilih TP untuk melihat penerangannya mengikut DSKP.',
    )
    await expectTouchTarget(tid(page, 'q-tp'))
    await tid(page, 'q-tp').selectOption('3')
    await expect(tid(page, 'tp-descriptor')).toContainText('TP 3')
    await expect(tid(page, 'tp-descriptor')).toContainText('Mengikut Tajuk 4.0')
    const tp3 = await tid(page, 'tp-descriptor').innerText()
    expect(tp3.length).toBeGreaterThan(40)
    await tid(page, 'q-tp').selectOption('5')
    const tp5 = await tid(page, 'tp-descriptor').innerText()
    expect(tp5).not.toEqual(tp3) // it follows the TP; the TP itself is never changed by it
    await expect(tid(page, 'q-tp')).toHaveValue('5')
    await tid(page, 'q-tp').selectOption('3')

    // KBAT: optional, separate from TP, never derived (AC-06.1..06.3).
    expect(await optionTexts(tid(page, 'q-kbat'))).toEqual([
      'Bukan KBAT',
      'Mengaplikasi',
      'Menganalisis',
      'Menilai',
      'Mencipta',
    ])
    await expect(block).toContainText('Aras KBAT (pilihan)')
    await expect(block).toContainText('Tidak ditentukan oleh TP.')
    await expectTouchTarget(tid(page, 'q-kbat'))
    // Complete tag with KBAT empty: the gate list is empty (KBAT is not required).
    await expect(tid(page, 'issues-toggle')).toContainText('Semua semakan kualiti lulus. Sedia dihantar.')
    await expect(tid(page, 'submit-review')).toBeEnabled()
    await tid(page, 'q-kbat').selectOption('menilai')
    await tid(page, 'q-tp').selectOption('1')
    await expect(tid(page, 'q-kbat')).toHaveValue('menilai') // TP 1 + KBAT Menilai: no derivation
    await tid(page, 'q-tp').selectOption('6')
    await tid(page, 'q-kbat').selectOption('')
    await expect(tid(page, 'q-tp')).toHaveValue('6')
    await tid(page, 'q-tp').selectOption('3')
    await expectNoHorizontalScroll(page)
    await shot(block, 'tag-block-filled')

    // Unit change clears the SP that is not in the new unit, and says so (AC-04.5).
    await tid(page, 'q-unit').selectOption('MAT:T4:u:3.0')
    await expect(tid(page, 'tag-notice')).toHaveText('SP dikosongkan kerana unit berubah.')
    await expect(page.locator('[data-testid^="sp-chip-"]')).toHaveCount(0)
    expect(await openIssues(page)).toEqual(['Soalan 1: Standard Pembelajaran (SP) belum dipilih.'])
    await shot(block, 'tag-block-unit-notice')
    await tid(page, 'sp-option-3.1.1').click()

    // Tingkatan change clears unit and SP and says so (AC-04.7).
    await tid(page, 'q-form').selectOption('T5')
    await expect(tid(page, 'tag-notice')).toHaveText('Unit dan SP dikosongkan kerana tingkatan berubah.')
    await expect(tid(page, 'q-unit')).toHaveValue('')
    await expect(page.locator('[data-testid^="sp-chip-"]')).toHaveCount(0)
    const t5 = await optionTexts(tid(page, 'q-unit'))
    expect(t5[1]).toBe('1.0 - Ubahan')
    await expect(tid(page, 'sp-need-unit')).toBeVisible()
    await shot(block, 'tag-block-form-notice')
    await expectNoHorizontalScroll(page)
  })
})

/* ------------------------------------------------------------------ 3. upload and AI suggestion */

async function openCard(page: Page, label: string): Promise<Locator> {
  const card = page.locator(`[data-testid="question-card"][data-label="${label}"]`)
  await expect(card).toBeVisible()
  const head = card.locator('button[aria-expanded]').first()
  if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click()
  return card
}

test.describe('Upload and AI suggestion (US-04 AC-04.9, US-05 AC-05.2, AC-05.3, US-10)', () => {
  test('AC-04.9 AC-05.2 AC-05.3 AC-10.1: upload, badges, 2-word rendah must be confirmed, unmatched unit is not auto-filled', async ({
    page,
    browser,
    loginAs,
    gotoApp,
  }) => {
    const pdf = await makePaperPdf(browser, [
      [
        'Kertas Percubaan QA Matematik Kertas 2 (fiksyen)',
        'Bahagian A',
        '1. Nyatakan nilai min, mod dan median bagi data berikut. [2 markah]',
        '2. Apakah warna langit pada waktu pagi? [1 markah]',
        '3. Selesaikan persamaan kuadratik 2x^2 + 5x + 3 = 0 dengan kaedah pemfaktoran. [3 markah]',
        '4. Terangkan mengapa langit berwarna biru pada waktu siang. [2 markah]',
      ].join('\n'),
      [
        'Skema Pemarkahan',
        'Skema 1',
        'K1 Min = jumlah per bilangan [1]',
        'N1 Jawapan betul [1]',
        'Skema 2',
        'N1 Biru [1]',
        'Skema 3',
        'K1 (2x + 3)(x + 1) = 0 [1]',
        'K1 x = -3/2 atau x = -1 [1]',
        'N1 Jawapan akhir [1]',
        'Skema 4',
        'K1 Cahaya biru bertaburan [1]',
        'N1 Taburan Rayleigh [1]',
      ].join('\n'),
    ])
    await loginAs(ADMIN)
    await gotoApp('/admin/spm/soalan/muat-naik')
    await expect(tid(page, 'intake-subject')).toBeVisible()
    await tid(page, 'intake-subject').selectOption('MAT')
    await tid(page, 'intake-source').fill('Kertas percubaan QA')
    await tid(page, 'intake-copyright').selectOption('sendiri')
    await page.locator('input[type=file]').setInputFiles({
      name: 'kertas-qa-g5.pdf',
      mimeType: 'application/pdf',
      buffer: pdf,
    })
    await expectNoHorizontalScroll(page)
    await shot(page, 'upload-declaration')
    await tid(page, 'intake-submit').click()
    await expect(tid(page, 'intake-review-page')).toBeVisible({ timeout: 90_000 })
    await expect(page.locator('[data-testid="question-card"]')).toHaveCount(4)

    // Q1: two-word evidence is rendah: pre-filled but must be confirmed (unit, SP and TP).
    const q1 = await openCard(page, '1')
    const block1 = q1.getByTestId('tag-block')
    await block1.scrollIntoViewIfNeeded()
    await expect(block1.getByTestId('ai-badge')).toHaveCount(3)
    await expect(block1.getByTestId('ai-badge').first()).toContainText('Cadangan AI')
    await expect(block1.getByTestId('ai-badge').first()).toContainText('Keyakinan rendah')
    await expect(block1.getByTestId('q-unit')).toHaveValue('MAT:T4:u:8.0') // suggested, not final
    await expect(block1.getByTestId('confirm-tag.unit')).toBeVisible()
    await expect(block1.getByTestId('confirm-tag.sp')).toBeVisible()
    await expect(block1.getByTestId('confirm-tag.tp')).toBeVisible()
    await expect(block1).toContainText('Saya sahkan unit DSKP (keyakinan rendah)')
    await expect(block1).toContainText('Saya sahkan SP (keyakinan rendah)')
    await expect(block1).toContainText('Saya sahkan TP (cadangan AI)')
    await shot(block1, 'intake-ai-badges')
    const issues = await openIssues(page)
    expect(issues).toContain('Soalan 1: Medan keyakinan rendah belum disahkan: unit DSKP.')
    expect(issues).toContain('Soalan 1: Medan keyakinan rendah belum disahkan: SP.')
    expect(issues).toContain('Soalan 1: Cadangan AI belum disahkan: TP.')
    await expect(tid(page, 'submit-review')).toBeDisabled()

    // Q2: nothing matches: unit and SP stay empty, no guessed code, the reviewer is told.
    const q2 = await openCard(page, '2')
    const block2 = q2.getByTestId('tag-block')
    await block2.scrollIntoViewIfNeeded()
    await expect(block2.getByTestId('q-unit')).toHaveValue('')
    await expect(block2.getByTestId('q-form')).toHaveValue('')
    await expect(block2.locator('[data-testid^="sp-chip-"]')).toHaveCount(0)
    const i2 = (await openIssues(page)).filter((m) => m.startsWith('Soalan 2:'))
    expect(i2).toContain('Soalan 2: Subjek dan tingkatan perlu ditetapkan.')
    // The reviewer chooses a tingkatan: the unit and SP are now asked for by name.
    await block2.getByTestId('q-form').selectOption('T4')
    const i2b = (await openIssues(page)).filter((m) => m.startsWith('Soalan 2:'))
    expect(i2b).toContain('Soalan 2: Unit DSKP belum dipilih.')
    expect(i2b).toContain('Soalan 2: Standard Pembelajaran (SP) belum dipilih.')
    await block2.getByTestId('q-unit').selectOption('MAT:T4:u:8.0')
    const i2c = (await openIssues(page)).filter((m) => m.startsWith('Soalan 2:'))
    expect(i2c).toEqual([
      'Soalan 2: Standard Pembelajaran (SP) belum dipilih.',
      'Soalan 2: Tahap Penguasaan (TP) belum dipilih.',
    ])
    await block2.locator('[data-testid^="sp-option-"]').first().click()
    await block2.getByTestId('q-tp').selectOption('1')

    // Q4: a command word gives a TP suggestion only; the unit stays empty and the reviewer is told.
    const q4 = await openCard(page, '4')
    const block4 = q4.getByTestId('tag-block')
    await block4.scrollIntoViewIfNeeded()
    await expect(block4.getByTestId('q-unit')).toHaveValue('')
    await expect(block4.getByTestId('ai-no-match').first()).toContainText(
      'AI tidak menjumpai unit yang sepadan. Pilih secara manual.',
    )
    await shot(block4, 'intake-ai-no-match')

    // Q3: TP is a suggestion at any confidence and must be confirmed (AC-05.2).
    const q3 = await openCard(page, '3')
    const block3 = q3.getByTestId('tag-block')
    await block3.scrollIntoViewIfNeeded()
    // High confidence for unit and SP: no confirmation asked, but the suggested TP still is.
    await expect(block3.getByTestId('q-unit')).toHaveValue('MAT:T4:u:1.0')
    await expect(block3.getByTestId('ai-badge').first()).toContainText('Keyakinan tinggi')
    await expect(block3.getByTestId('confirm-tag.unit')).toHaveCount(0)
    await expect(block3.getByTestId('confirm-tag.sp')).toHaveCount(0)
    await expect(block3.getByTestId('confirm-tag.tp')).toBeVisible()
    await shot(block3, 'intake-ai-q3')

    // Confirm Q1's three fields (ticks), then the TP of Q3 is changed instead of ticked.
    await block1.scrollIntoViewIfNeeded()
    await block1.getByTestId('confirm-tag.unit').click()
    await block1.getByTestId('confirm-tag.sp').click()
    await block1.getByTestId('confirm-tag.tp').click()
    await expect(block1.getByTestId('ai-badge').first()).toContainText('Disahkan')
    await block3.scrollIntoViewIfNeeded()
    await block3.getByTestId('q-tp').selectOption('6')
    await expect(block3.getByTestId('ai-changed')).toContainText('Diubah daripada cadangan AI')
    await block3.getByTestId('q-kbat').selectOption('menganalisis') // optional, set by hand
    await expect(block3.getByTestId('confirm-tag.tp')).toHaveCount(0)
    const after = await openIssues(page)
    expect(after.filter((m) => m.startsWith('Soalan 1:') && /belum disahkan/.test(m))).toEqual([])
    expect(after.filter((m) => m.startsWith('Soalan 3:') && /TP/.test(m))).toEqual([])
    await expectNoHorizontalScroll(page)

    // Q4: the reviewer picks the tag by hand and confirms the AI TP; then the batch is complete.
    await block4.scrollIntoViewIfNeeded()
    await block4.getByTestId('q-form').selectOption('T4')
    await block4.getByTestId('q-unit').selectOption('MAT:T4:u:8.0')
    await block4.locator('[data-testid^="sp-option-"]').first().click()
    await block4.getByTestId('confirm-tag.tp').click()
    await expect(tid(page, 'issues-toggle')).toContainText('Semua semakan kualiti lulus. Sedia dihantar.')
    await expect(tid(page, 'submit-review')).toBeEnabled()
    await tid(page, 'submit-review').click()
    await expect(tid(page, 'submitted-note')).toBeVisible()

    // AC-10.1: the audit trail keeps the AI value, the final value and the confidence.
    await tid(page, 'goto-queue').click()
    await expect(tid(page, 'review-queue-page')).toBeVisible()
    await (await rowButton(page, 'queue-open-', 'Nyatakan nilai min, mod dan median')).click()
    const h1 = tid(page, 'review-history')
    await expect(h1.getByTestId('history-tag-formOrigin').first()).toContainText('Tag: Tingkatan: Tingkatan 4')
    await expect(h1.getByTestId('history-tag-unit').first()).toContainText(
      'Tag: Unit: 8.0 - Sukatan Serakan Data Tak Terkumpul (cadangan AI diterima, keyakinan rendah)',
    )
    await expect(h1.getByTestId('history-tag-sp').first()).toContainText('Tag: SP: 8.2.4 (cadangan AI diterima, keyakinan rendah)')
    await expect(h1.getByTestId('history-tag-tp').first()).toContainText('Tag: TP: 1 (cadangan AI diterima, keyakinan rendah)')
    await shot(page, 'review-ai-history')
    await page.goBack()
    await expect(tid(page, 'review-queue-page')).toBeVisible()
    await (await rowButton(page, 'queue-open-', 'Selesaikan persamaan kuadratik')).click()
    await expect(tid(page, 'review-history').getByTestId('history-tag-tp').first()).toContainText(
      'Tag: TP: 6 (cadangan AI: 3, keyakinan rendah)',
    )
    await expect(tid(page, 'review-history').getByTestId('history-tag-unit').first()).toContainText(
      '(cadangan AI diterima, keyakinan tinggi)',
    )
    await page.goBack()
    await expect(tid(page, 'review-queue-page')).toBeVisible()
    await (await rowButton(page, 'queue-open-', 'Apakah warna langit')).click()
    // Typed by hand (no AI suggestion): the line carries no AI suffix.
    const h2 = await tid(page, 'review-history').getByTestId('history-tag-unit').first().innerText()
    expect(h2).toContain('Tag: Unit: 8.0')
    expect(h2).not.toContain('cadangan AI')

    // Publish the T4 question with its tag (the publish gate runs the same rule), then find it in the
    // bank with unit title, SP, TP and KBAT, and through the KBAT filter (Ya / Tidak / level).
    await page.goBack()
    await expect(tid(page, 'review-queue-page')).toBeVisible()
    await (await rowButton(page, 'queue-open-', 'Selesaikan persamaan kuadratik')).click()
    await expect(tid(page, 'review-tag')).toContainText('KBAT: Menganalisis')
    await expect(tid(page, 'review-gate')).toContainText('Semua syarat dipenuhi')
    await tid(page, 'action-publish').click()
    await expect(tid(page, 'review-queue-page')).toBeVisible()
    await gotoApp('/admin/spm/soalan')
    await expect(page.locator('[data-testid^="bank-open-"]').first()).toBeVisible()
    await tid(page, 'bank-search').fill('Selesaikan persamaan kuadratik 2x')
    await openFilters(page)
    await tid(page, 'bank-subject').selectOption('MAT')
    await tid(page, 'bank-kbat').selectOption('ya')
    await applyFilters(page, 'bank-filter')
    expect(await pagerTotal(page)).toBe(1)
    const rowTxt = await page.locator('[data-testid^="bank-open-"]').first().evaluate((el) => {
      let e: Element | null = el
      while (e && !(e.tagName === 'TR' || e.tagName === 'ARTICLE' || e.tagName === 'LI')) e = e.parentElement
      return (e ?? el.parentElement)?.textContent ?? ''
    })
    expect(rowTxt).toContain('Fungsi dan Persamaan Kuadratik dalam Satu Pemboleh Ubah')
    expect(rowTxt).toContain('TP 6')
    expect(rowTxt).toMatch(/KBAT:? Menganalisis/) // the card prints "TP 6 · KBAT Menganalisis"
    expect(await tid(page, 'active-filter').allInnerTexts()).toContain('KBAT: Ya')
    await shot(page, 'bank-kbat-row')
    await openFilters(page)
    await tid(page, 'bank-kbat').selectOption('menganalisis')
    await applyFilters(page, 'bank-filter')
    expect(await pagerTotal(page)).toBe(1)
    expect(await tid(page, 'active-filter').allInnerTexts()).toContain('KBAT: Menganalisis')
    await openFilters(page)
    await tid(page, 'bank-kbat').selectOption('menilai')
    await applyFilters(page, 'bank-filter')
    expect(await pagerTotal(page)).toBe(0)
    await openFilters(page)
    await tid(page, 'bank-kbat').selectOption('tidak')
    await applyFilters(page, 'bank-filter')
    expect(await pagerTotal(page)).toBe(0) // the only question matching the search is KBAT
  })
})

/* ------------------------------------------------------------- 2. T1-T3, submit, queue, publish */

test.describe('Tingkatan 1-3, gates and the audit trail (US-07, US-10)', () => {
  test('AC-04.6 AC-07.2 AC-05.1 AC-10.2: T1-T3 disables unit and SP, TP stays required; submit, review, publish, history', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    const STEM = 'QA G5 soalan manual tingkatan satu hingga tiga'
    await loginAs(ADMIN)
    const block = await startManual(page, gotoApp, 'MAT')
    await fillBasics(page)
    await tid(page, 'q-stem').fill(STEM)

    await tid(page, 'q-form').selectOption('T1-T3')
    await expect(tid(page, 'q-unit')).toBeDisabled()
    await expect(tid(page, 'sp-search')).toBeDisabled()
    await expect(tid(page, 'q-sk')).toHaveAttribute('aria-disabled', 'true')
    await expect(tid(page, 'tag-outside')).toHaveText(
      'Tingkatan 1-3 berada di luar DSKP. Unit dan SP tidak diperlukan; TP masih wajib.',
    )
    // The gate asks for TP only: no unit and no SP message for an exempt question.
    expect(await openIssues(page)).toEqual(['Soalan 1: Tahap Penguasaan (TP) belum dipilih.'])
    await expect(tid(page, 'submit-review')).toBeDisabled()
    await expect(tid(page, 'tp-descriptor')).toContainText('Tiada penerangan TP DSKP untuk Tingkatan 1-3.')
    await expectNoHorizontalScroll(page)
    await shot(block, 'tag-block-t1t3')

    await tid(page, 'q-tp').selectOption('2')
    await expect(tid(page, 'issues-toggle')).toContainText('Semua semakan kualiti lulus. Sedia dihantar.')
    await expect(tid(page, 'submit-review')).toBeEnabled()
    await tid(page, 'submit-review').click()
    await expect(tid(page, 'submitted-note')).toBeVisible()

    // Queue: the item carries the T1-T3 tag; review workspace shows the same badges.
    await tid(page, 'goto-queue').click()
    await expect(tid(page, 'review-queue-page')).toBeVisible()
    await (await rowButton(page, 'queue-open-', STEM)).click()
    await expect(tid(page, 'review-item-page')).toBeVisible()
    await expect(tid(page, 'review-tag')).toContainText('Tingkatan 1-3 (di luar DSKP)')
    await expect(tid(page, 'review-tag')).toContainText('TP 2')
    await expect(tid(page, 'review-gate')).toContainText('Semua syarat dipenuhi')
    // Audit (AC-10.2): typed by a person, so the line has no AI suffix; no unit or SP line.
    const hist = tid(page, 'review-history')
    await expect(hist.locator('[data-testid="history-tag-formOrigin"]').first()).toContainText(
      'Tag: Tingkatan: Tingkatan 1-3 (di luar DSKP)',
    )
    await expect(hist.locator('[data-testid="history-tag-tp"]').first()).toContainText('Tag: TP: 2')
    await expect(hist.locator('[data-testid="history-tag-unit"]')).toHaveCount(0)
    await expect(hist.locator('[data-testid="history-tag-sp"]')).toHaveCount(0)
    expect(await hist.innerText()).not.toContain('cadangan AI')
    await expectNoHorizontalScroll(page)
    await shot(page, 'review-t1t3')

    await tid(page, 'action-publish').click()
    await expect(tid(page, 'review-queue-page')).toBeVisible()
  })
})

/* -------------------------------------------------------------------- 4. gates on the seeds */

test.describe('Seed gates: flagged questions cannot be published until tagged (US-07, US-08)', () => {
  test('AC-07.1 AC-07.3 AC-07.4 AC-07.5 AC-08.3: publishing the flagged seed mat2-rev-g1 is refused with the exact message', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/spm/semakan')
    await expect(tid(page, 'review-queue-page')).toBeVisible()
    await tid(page, 'queue-open-mat2-rev-g1').click()
    await expect(tid(page, 'review-item-page')).toBeVisible()
    const gate = tid(page, 'review-gate')
    await expect(gate).toContainText('Soalan 2: Subjek dan tingkatan perlu ditetapkan.')
    await expect(tid(page, 'action-publish')).toBeDisabled()
    await expectNoHorizontalScroll(page)
    await shot(page, 'review-flagged-gate')
    // Even with the button forced on, the server runs the same rule and refuses.
    await tid(page, 'action-publish').evaluate((el) => el.removeAttribute('disabled'))
    await tid(page, 'action-publish').click({ force: true })
    await expect(gate).toContainText('Soalan 2: Subjek dan tingkatan perlu ditetapkan.')
    await expect(tid(page, 'review-item-page')).toBeVisible() // still here: not published
    expect(new URL(page.url()).pathname).toBe('/admin/spm/semakan/mat2-rev-g1')
  })

  test('AC-07.5 AC-07.1 AC-07.3 AC-10.3: a stem-only revision of a flagged question is refused by the server', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/spm/soalan')
    await expect(tid(page, 'bank-page')).toBeVisible()
    // There is no screen for a stem-only revision (Sunting is the full editor), so the same
    // server entry the paper builder and tests use is called in the page.
    const res = await page.evaluate(async () => {
      const url = '/src/modules/m28-bijak-spm/server/client.ts'
      const m = (await import(/* @vite-ignore */ url)) as {
        bijakServer: () => { reviseQuestion: (q: string, s: string, n: string) => Promise<unknown> }
      }
      return await m.bijakServer().reviseQuestion('mat1-kecerunan-v1', 'Teks baharu sahaja.', 'ujian QA')
    })
    expect(res).toEqual({ ok: false, errors: ['Soalan: Subjek dan tingkatan perlu ditetapkan.'] })
  })

  test('AC-07.5 AC-08.3 AC-10.3 AC-04.1: tagging a flagged Terbit question in Sunting clears the flag and allows publishing', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/spm/soalan')
    await expect(tid(page, 'bank-page')).toBeVisible()
    const QID = 'mat1-kecerunan-v1'
    await setFilter(page, 'bank-status', 'semua')
    await applyFilters(page, 'bank-filter')
    const all0 = await pagerTotal(page)
    expect(all0).toBe(79)

    // Flagged count (computed): the "Perlu semakan tag" filter lists exactly the flagged rows.
    await openFilters(page)
    await tid(page, 'bank-tag-review').click()
    await applyFilters(page, 'bank-filter')
    const flagged0 = await pagerTotal(page)
    expect(flagged0).toBe(28)
    expect(await tid(page, 'active-filter').allInnerTexts()).toContain('Perlu semakan tag')

    // Drawer of the flagged question (Terbit, keeps serving students).
    await tid(page, 'bank-search').fill(QID)
    await applyFilters(page, 'bank-filter')
    await tid(page, `bank-open-${QID}`).click()
    const drawer = tid(page, 'bank-drawer')
    await expect(drawer).toBeVisible()
    await expect(tid(page, 'bank-tag')).toContainText('Perlu semakan tag')
    await expect(tid(page, 'bank-tag-alert')).toContainText('Perlu semakan tag')
    await expect(tid(page, 'bank-tag-alert')).toContainText(
      'Soalan ini masih melayani murid. Sunting untuk menetapkan tag DSKP sebelum versi baharu boleh diterbitkan.',
    )
    await shot(page, 'bank-drawer-flagged')
    await tid(page, 'bank-revise').click()

    // Sunting: the flag alert, empty tag controls, the stored TP, a refusing gate.
    await expect(tid(page, 'bank-edit-page')).toBeVisible()
    await expect(tid(page, 'tag-review-alert')).toContainText('Perlu semakan tag')
    await expect(tid(page, 'tag-review-alert')).toContainText(
      'Tag soalan ini belum disahkan. Pilih tingkatan, unit dan SP daripada DSKP, kemudian hantar versi baharu.',
    )
    await expect(tid(page, 'q-form')).toHaveValue('')
    await expect(tid(page, 'q-unit')).toBeDisabled()
    await expect(tid(page, 'q-tp')).toHaveValue('2') // the authored seed TP, no AI badge
    await expect(tid(page, 'ai-badge')).toHaveCount(0)
    await expect(tid(page, 'edit-submit')).toBeDisabled()
    await tid(page, 'edit-gate').scrollIntoViewIfNeeded()
    await expect(tid(page, 'edit-gate')).toContainText('Subjek dan tingkatan perlu ditetapkan.')
    await shot(tid(page, 'tag-block'), 'sunting-flagged')

    // Tag it (T1-T3: the seed note says this is probably Tingkatan 1-3 content). The flag clears live.
    await tid(page, 'q-form').selectOption('T1-T3')
    await expect(tid(page, 'tag-review-alert')).toHaveCount(0)
    await expect(tid(page, 'edit-gate')).toContainText('Semua semakan kualiti lulus')
    await expect(tid(page, 'edit-submit')).toBeEnabled()
    await tid(page, 'edit-note').fill('Ditag semula oleh QA sebagai Tingkatan 1-3')
    await tid(page, 'edit-submit').click()
    await expect(tid(page, 'bank-page')).toBeVisible()

    // The live version is untouched until the new one is approved; the new one waits in the queue.
    await gotoApp('/admin/spm/semakan')
    await expect(tid(page, 'review-queue-page')).toBeVisible()
    await expect(tid(page, `queue-open-v:${QID}`).or(page.locator(`[data-testid^="queue-open-"][data-testid*="${QID}"]`)).first()).toBeVisible()
    await page.locator(`[data-testid^="queue-open-"][data-testid*="${QID}"]`).first().click()
    await expect(tid(page, 'review-item-page')).toBeVisible()
    await expect(tid(page, 'review-gate')).toContainText('Semua syarat dipenuhi')
    await expect(tid(page, 'review-tag')).toContainText('Tingkatan 1-3 (di luar DSKP)')
    // Before/after of the tag in the history (AC-10.3).
    const hist = tid(page, 'review-history')
    await expect(hist.getByTestId('history-tag-formOrigin').first()).toHaveText(
      /Tag: Tingkatan: \(kosong\)\s*→\s*kepada\s*Tingkatan 1-3 \(di luar DSKP\)/,
    )
    await shot(page, 'review-revision-tagged')
    await tid(page, 'action-publish').click()
    await expect(tid(page, 'review-queue-page')).toBeVisible()

    // Published: the flagged count fell by one, computed from the data.
    await gotoApp('/admin/spm/soalan')
    await setFilter(page, 'bank-status', 'semua')
    await openFilters(page)
    await tid(page, 'bank-tag-review').click()
    await applyFilters(page, 'bank-filter')
    expect(await pagerTotal(page)).toBe(flagged0 - 1)

    // Drawer: the tag lines of the history in the bank too (AC-10.3), with the new tag shown.
    await tid(page, 'bank-search').fill(QID)
    await openFilters(page)
    await tid(page, 'bank-tag-review').click() // off
    await applyFilters(page, 'bank-filter')
    await tid(page, `bank-open-${QID}`).click()
    await expect(tid(page, 'bank-drawer')).toBeVisible()
    await expect(tid(page, 'bank-tag')).toContainText('Tingkatan 1-3 (di luar DSKP)')
    await expect(tid(page, 'bank-tag-alert')).toHaveCount(0)
    await expect(
      tid(page, 'bank-drawer').getByTestId('history-tag-formOrigin').first(),
    ).toHaveText(/Tag: Tingkatan: \(kosong\)\s*→\s*kepada\s*Tingkatan 1-3 \(di luar DSKP\)/)
    await expectNoHorizontalScroll(page)
    await shot(page, 'bank-drawer-history-tag')
  })
})
