/**
 * Standard assertions (overview §12.2 "Standard assertions").
 */

import { expect, type Dialog, type Locator, type Page } from '@playwright/test'

/** Samples taken by {@link expectNoHorizontalScroll}, and the pause between them. */
export const H_SCROLL_SAMPLES = 3
export const H_SCROLL_SAMPLE_GAP_MS = 100

/**
 * No horizontal page scroll: `documentElement.scrollWidth ≤ clientWidth` (CLAUDE.md §7; a layout
 * break is a High bug).
 *
 * **Callers must assert the final content first** (the heading, the list rows, the open drawer):
 * this helper cannot know what "rendered" means for a screen. It requires the app to have booted
 * (`__mock.ready` and the Vue app mounted; it fails otherwise, so an unrendered page can never
 * pass), then takes {@link H_SCROLL_SAMPLES} measurements {@link H_SCROLL_SAMPLE_GAP_MS} ms apart,
 * and every one of them must show no overflow. It does not poll until a pass.
 */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const samples: number[] = []
  for (let i = 0; i < H_SCROLL_SAMPLES; i++) {
    if (i > 0) await page.waitForTimeout(H_SCROLL_SAMPLE_GAP_MS)
    const sample = await page.evaluate(() => {
      const app = document.querySelector('#app') as (Element & { __vue_app__?: unknown }) | null
      if (window.__mock?.ready !== true || !app?.__vue_app__) return null
      const el = document.documentElement
      return el.scrollWidth - el.clientWidth
    })
    expect(sample, 'expectNoHorizontalScroll: the app has not booted (use gotoApp)').not.toBeNull()
    samples.push(sample!)
  }
  for (const overflow of samples) {
    expect(
      overflow,
      `horizontal page overflow in px (samples: ${samples.join(', ')})`,
    ).toBeLessThanOrEqual(0)
  }
}

/** The exact tab title. */
export async function expectTabTitle(page: Page, exact: string): Promise<void> {
  await expect(page).toHaveTitle(exact)
}

/** A touch target of at least `min` × `min` CSS px (default 44). */
export async function expectTouchTarget(locator: Locator, min = 44): Promise<void> {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  expect(box, 'touch target has a box').not.toBeNull()
  // 0.1 px slack: emulated devices sometimes report 43.99998 for a 44 px box (sub-pixel artefact).
  expect(box!.width, 'touch target width').toBeGreaterThanOrEqual(min - 0.1)
  expect(box!.height, 'touch target height').toBeGreaterThanOrEqual(min - 0.1)
}

/** `true` when the locator's box lies inside the viewport horizontally (not off-canvas). */
export async function isInViewportX(page: Page, locator: Locator): Promise<boolean> {
  const box = await locator.boundingBox()
  const width = page.viewportSize()?.width ?? 0
  return box !== null && box.width > 0 && box.x >= -1 && box.x + box.width <= width + 1
}

export interface DialogExpectation {
  /** Expected type, e.g. `'confirm'` for a native `confirm()`. */
  type?: ReturnType<Dialog['type']>
  /** Exact expected message. */
  message?: string
}

/**
 * Accepts the next native dialog (`confirm`, `alert`, `prompt`) and returns it. Start it **before**
 * the action that opens the dialog:
 *
 * ```ts
 * const dialog = acceptNextDialog(page, { type: 'confirm', message: 'Padam?' })
 * await page.getByRole('button', { name: 'Padam' }).click()
 * await dialog
 * ```
 */
export function acceptNextDialog(
  page: Page,
  expected: DialogExpectation = {},
  promptText?: string,
): Promise<Dialog> {
  return handleNextDialog(page, expected, (d) => d.accept(promptText))
}

/** Dismisses the next native dialog (Cancel). See {@link acceptNextDialog}. */
export function dismissNextDialog(page: Page, expected: DialogExpectation = {}): Promise<Dialog> {
  return handleNextDialog(page, expected, (d) => d.dismiss())
}

async function handleNextDialog(
  page: Page,
  expected: DialogExpectation,
  answer: (dialog: Dialog) => Promise<void>,
): Promise<Dialog> {
  const dialog = await page.waitForEvent('dialog')
  // Answer first, so a failed expectation does not leave the page blocked.
  await answer(dialog)
  if (expected.type !== undefined) expect(dialog.type()).toBe(expected.type)
  if (expected.message !== undefined) expect(dialog.message()).toBe(expected.message)
  return dialog
}
