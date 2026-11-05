/**
 * R1-ADM-N-05 `/admin/permainan` at 375 / 768 / 1280 (S7-T03; 30 N-05, 48 section 2, AC-GM-00.11, AC-GM-14.3). The admin
 * edits the three cards against the mock: the live breakdown, a refusal at the field, a save and its flash, a segment
 * total refused; no horizontal page scroll.
 */

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, moduleTag } from '../support'

const MODULE = { tag: [moduleTag(16)] }

test.use({ mockInit: { latency: 0 } })

test('E2E-S7-T03 Tetapan Permainan: the three cards save, refuse and fit', MODULE, async ({ page, gotoApp, loginAs }) => {
  await loginAs(1)
  await gotoApp('/admin/permainan')
  await expectTabTitle(page, 'Tetapan Permainan | PRESTASIPLUS')

  for (const label of ['Jumlah Bilik', 'Sedang Aktif', 'Selesai', 'Pemain Unik']) {
    await expect(page.getByTestId('gs-page').getByText(label, { exact: true })).toBeVisible()
  }

  // Papan Bijak: the breakdown follows the input, 39 is refused at the field, 20 saves with the flash.
  const tiles = page.getByTestId('gs-quiz-tiles')
  await expect(tiles).toHaveValue('35')
  await expect(page.getByTestId('gs-chip-plain')).toHaveText('3 biasa')
  await tiles.fill('39')
  await page.getByTestId('gs-board-save').click()
  await expect(page.getByTestId('gs-board-form').getByTestId('field-error')).toHaveText('Maksimum 38 petak soalan.')
  await tiles.fill('20')
  await expect(page.getByTestId('gs-chip-quiz')).toHaveText('20 soalan')
  await expect(page.getByTestId('gs-chip-plain')).toHaveText('18 biasa')
  await page.getByTestId('gs-board-save').click()
  await expect(page.getByText('Tetapan permainan disimpan.')).toBeVisible()
  await expect(page.getByTestId('gs-board-form').getByTestId('field-error')).toHaveCount(0)

  // Ganjaran & Had Permainan: AC-GM-00.11, then a good value.
  const seconds = page.getByTestId('gs-setting-battle_question_seconds')
  await seconds.fill('5')
  await page.getByTestId('gs-reward-save').click()
  await expect(page.getByTestId('gs-reward-form').getByTestId('field-error')).toHaveText('Nilai mesti antara 10 dan 60.')
  await seconds.fill('20')
  await page.getByTestId('gs-reward-save').click()
  await expect(page.getByTestId('gs-reward-form').getByTestId('field-error')).toHaveCount(0)
  await expect(seconds).toHaveValue('20')

  // Segmen Roda Nasib: AC-GM-14.3, then back to 100.
  const segmentForm = page.getByTestId('gs-segment-form')
  for (const word of ['Label', 'Syiling', 'Berat']) await expect(segmentForm.getByText(word, { exact: true }).first()).toBeVisible()
  const weight = page.getByTestId('gs-seg-1-weight')
  await expect(weight).toHaveValue('25')
  await weight.fill('24')
  await expect(page.getByTestId('gs-weight-total')).toHaveText('Jumlah berat: 99 / 100')
  await page.getByTestId('gs-segment-save').click()
  await expect(page.getByTestId('gs-segment-failure')).toContainText('Jumlah berat mesti 100.')
  await weight.fill('25')
  await page.getByTestId('gs-segment-save').click()
  await expect(page.getByTestId('gs-segment-failure')).toHaveCount(0)

  await expectNoHorizontalScroll(page)
})
