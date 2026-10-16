/**
 * Bijak SPM student flow (v2): hub reachable from the SPM menu row, a stimulus-group question
 * answered with the Rajah pinned (side panel on desktop, chip + sheet on mobile), a structured
 * question with the maths keyboard, submit, win screen and the per-point result.
 *
 * Needs the scope-ON build: `npx playwright test -c playwright.bijak.config.mjs`.
 * Set BIJAK_SHOTS=<dir> to also write screenshots.
 */
import { mkdirSync } from 'node:fs'

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, isDesktopShell, viewportWidth } from '../support'

test.skip(
  process.env.E2E_PROTOTYPE_SCOPE !== 'on',
  'needs the scope-on build: playwright.bijak.config.mjs',
)

const SHOTS = process.env.BIJAK_SHOTS

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return
  mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: `${SHOTS}/${name}-${viewportWidth(page)}.png` })
}

async function startPaper(
  page: Page,
  paperId: string,
  mode: 'exam' | 'latihan' = 'exam',
): Promise<void> {
  await page.getByTestId(`open-${paperId}`).click()
  await expect(page.getByTestId('bijak-cover')).toBeVisible()
  if (mode === 'latihan') await page.getByText('Mod Latihan', { exact: true }).click()
  await page.getByTestId('start').click()
  await expect(page.getByTestId('attempt-shell')).toBeVisible()
}

test.describe('Bijak SPM', () => {
  test('hub from SPM, stimulus group with pinned Rajah, submit and per-point result', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/spm')
    await page.getByTestId('spm-bijak-link').click()
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    await expect(page.getByTestId('bijak-subtitle')).toHaveText(
      'Duduki kertas SPM penuh dalam format kertas sebenar — bermasa, dengan skema.',
    )
    await expectNoHorizontalScroll(page)
    await shot(page, 'hub')

    await startPaper(page, 'mat-k1-2025-a')
    // Questions 1-4 are singles; 5-8 share Rajah 1.
    for (let i = 0; i < 4; i++) await page.getByTestId('next').click()
    await expect(page.getByTestId('question-heading')).toHaveText(/Soalan 5 · berdasarkan Rajah 1/)

    const desktop = isDesktopShell(page)
    if (desktop) {
      await expect(page.getByTestId('pinned-stimulus')).toBeVisible()
    } else {
      await expect(page.getByTestId('stimulus-chip')).toBeVisible()
      await page.getByTestId('stimulus-chip').click()
      await expect(page.getByRole('dialog').getByTestId('stimulus')).toBeVisible()
      await page.keyboard.press('Escape')
    }
    await page.locator('[data-testid^=option-]').first().click()
    await expectNoHorizontalScroll(page)
    await shot(page, 'attempt-stimulus')

    // Next question of the group: the Rajah stays.
    await page.getByTestId('next').click()
    await expect(page.getByTestId('question-heading')).toHaveText(/Soalan 6 · berdasarkan Rajah 1/)
    if (desktop) await expect(page.getByTestId('pinned-stimulus')).toBeVisible()
    await page.locator('[data-testid^=option-]').nth(1).click()

    // Autosave status settles.
    await expect(page.getByTestId('save-status')).toHaveText('Disimpan')

    while (await page.getByTestId('next').isVisible()) await page.getByTestId('next').click()
    await page.getByTestId('submit').click()
    await expect(page.getByTestId('submit-summary')).toContainText('Belum dijawab')
    await page.getByTestId('confirm-submit').click()

    await expect(page.getByTestId('win-screen')).toBeVisible()
    await expect(page.getByTestId('friend-line')).toContainText('awak')
    await expect(page.getByTestId('section-score').first()).toBeVisible()
    await shot(page, 'win')
    await page.getByTestId('result-q-5').locator('summary').click()
    await expect(page.getByTestId('result-q-5').getByTestId('scheme')).toContainText(
      'Skema Pemarkahan',
    )
    await expectNoHorizontalScroll(page)
  })

  test('structured question: maths keyboard, working lines, per-point marks', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/spm/bijak')
    await startPaper(page, 'mat-k2-2025-a')
    await expect(page.getByTestId('question-heading')).toHaveText(/Soalan 1 · berdasarkan Rajah 1/)

    const inputs = page.locator('input[data-testid=math-input]')
    await inputs.nth(0).fill('AC^2 = 12^2 + 5^2')
    await inputs.nth(0).blur()
    // The on-screen keyboard inserts LaTeX at the caret.
    await page.getByTestId('math-keypad-toggle').nth(1).click()
    await expect(page.getByTestId('math-keyboard')).toBeVisible()
    await page.locator('[data-key=frac]').click()
    await expect(inputs.nth(1)).toHaveValue('\\frac{}{}')
    await shot(page, 'maths-keyboard')
    await page.locator('[data-key="1"]').click()
    await page.locator('[data-key=right]').click()
    await page.locator('[data-key="2"]').click()
    await expect(inputs.nth(1)).toHaveValue('\\frac{1}{2}')
    // replace by the real answer typed with the physical keyboard
    await inputs.nth(1).fill('13')
    await page.locator('input[data-testid=unit-input]').fill('cm')

    while (await page.getByTestId('next').isVisible()) await page.getByTestId('next').click()
    await page.getByTestId('submit').click()
    await page.getByTestId('confirm-submit').click()
    await expect(page.getByTestId('win-screen')).toBeVisible()
    await page.getByTestId('result-q-1').locator('summary').click()
    await expect(page.getByTestId('point-mat2-segitiga-v1-q1-a-p1')).toHaveAttribute(
      'data-hit',
      'true',
    )
    await expect(page.getByTestId('point-mat2-segitiga-v1-q1-a-p2')).toHaveAttribute(
      'data-hit',
      'true',
    )
    await shot(page, 'result-points')
    await expectNoHorizontalScroll(page)
  })

  test('Jana Kertas generates a paper and shows a shortage list for an empty pool', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/spm/bijak?tab=jana')
    await page.getByTestId('generate').click()
    await expect(page.getByTestId('bijak-cover')).toBeVisible()
    await expect(page.getByTestId('cover-title')).toContainText('Kertas Jana')
    await page.goBack()
    await page.getByTestId('jana-subject').click()
    await page.getByRole('option', { name: 'Sains' }).click()
    await page.getByTestId('jana-kertas').click()
    await page.getByRole('option', { name: 'Kertas 1' }).click()
    await page.getByTestId('generate').click()
    await expect(page.getByTestId('shortage-line')).toHaveText(
      'Bahagian A: perlu 40 soalan, hanya 0 tersedia',
    )
    await shot(page, 'jana-shortage')
  })
})
