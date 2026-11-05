/**
 * Tracking A admin (S3-T05, R1-ADM-Q-17) on the mock build: the lane, Tambah Set, Isi set, Simpan and the refusal of a repeat, with no
 * horizontal scroll at the project viewport. Screenshots go to KUIZ_SHOTS when set.
 */
import { expect, test } from '../fixtures/test'

const SHOTS = process.env.KUIZ_SHOTS

async function fits(page: import('@playwright/test').Page, label: string): Promise<void> {
  await page.waitForTimeout(300)
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
  expect(m.sw, label).toBeLessThanOrEqual(m.iw)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label}-${String(m.iw)}.png`, fullPage: true })
}

test('Tracking A: hub card, lane, Tambah Set, Isi set, Simpan, repeat refused', async ({ page, loginAs, gotoApp }) => {
  await loginAs('admin@demo.test')
  await gotoApp('/admin/spm')
  await expect(page.getByTestId('kandungan-card-tracking-a')).toBeVisible({ timeout: 30_000 })

  await gotoApp('/admin/spm/tracking-a')
  await expect(page.getByTestId('lane-tracking-a')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('lane-status')).toHaveCount(0)
  await expect(page).toHaveTitle('Tracking A | PRESTASIPLUS')
  await fits(page, 'tracking-list-empty')

  await page.getByTestId('tracking-add').click()
  await expect(page).toHaveURL(/\/admin\/spm\/tracking-a\/baharu\/sunting$/)
  const subject = page.locator('select[data-testid="tracking-add-subject"]')
  await expect(subject.locator('option', { hasText: 'Matematik' }).first()).toBeAttached()
  await expect(subject.locator('option', { hasText: 'Bahasa Melayu' })).toHaveCount(0)
  await expect(subject.locator('option', { hasText: 'Bahasa Inggeris' })).toHaveCount(0)
  await page.getByTestId('tracking-add-submit').click()
  await expect(page.getByTestId('tracking-add-form')).toContainText('Sila pilih subjek.')
  await fits(page, 'tracking-new')

  await subject.selectOption({ label: 'Matematik' })
  await page.getByTestId('tracking-add-submit').click()
  await expect(page).toHaveURL(/\/admin\/spm\/tracking-a\/\d+\/sunting$/)
  await expect(page).toHaveTitle('Matematik · 2026 · Set 1 | PRESTASIPLUS')
  await expect(page.getByTestId('tracking-kind')).toHaveText('ramalan')
  await expect(page.getByTestId('tracking-empty')).toHaveText('Set ini masih kosong.')
  await expect(page.getByTestId('tracking-pane-empty')).toHaveText('Pilih soalan untuk menyunting.')
  await expect(page.getByTestId('tracking-needed')).toHaveText('6 soalan lagi diperlukan.')
  await expect(page.getByTestId('tracking-available')).toContainText('Soalan tersedia untuk Matematik:')
  await fits(page, 'tracking-editor-empty')

  // An empty save never reaches the server.
  await page.getByTestId('tracking-save').click()
  await expect(page.getByTestId('tracking-notice')).toContainText('Pilih sekurang-kurangnya satu soalan sebelum menyimpan.')

  await page.getByTestId('tracking-fill').click()
  await expect(page.getByTestId('tracking-rows')).toBeVisible()
  await expect(page.getByTestId('tracking-unsaved')).toBeVisible()
  await fits(page, 'tracking-editor-draft')
  const counter = (await page.getByTestId('tracking-counter').textContent())?.trim() ?? ''
  expect(counter).toMatch(/^\d+ \/ 6$/)

  // Naik and Turun on a touch screen: a row can be picked and moved.
  const rows = page.locator('[data-testid^="tracking-row-"]')
  if ((await rows.count()) > 1) {
    await rows.first().getByRole('button', { name: 'Turun' }).click()
    await rows.first().getByRole('button', { name: 'Naik' }).isDisabled()
  }
  await rows.first().locator('[data-testid^="tracking-select-"]').click()
  await expect(page.getByTestId('tracking-pane')).toContainText('Buka di laman berasingan')
  await fits(page, 'tracking-editor-selected')

  await page.getByTestId('tracking-save').click()
  await expect(page.getByText('Set dikemas kini.').first()).toBeVisible()
  await expect(page.getByTestId('tracking-unsaved')).toHaveCount(0)

  // The same subject, year and set number again.
  await page.getByTestId('tracking-add-open').click()
  await page.getByTestId('tracking-add-submit').click()
  await expect(page.getByTestId('tracking-add-form')).toContainText('Set 1 sudah wujud untuk subjek dan tahun ini.')
  await page.getByTestId('tracking-add-cancel').click()

  await page.getByRole('link', { name: 'Kembali' }).first().click()
  await expect(page.getByTestId('lane-tracking-a')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('lane-tracking-a')).toContainText('Matematik · 2026 Set 1')
  await fits(page, 'tracking-list')
})
