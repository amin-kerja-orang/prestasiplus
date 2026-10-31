/**
 * Page object / flow steps for the Bijak SPM E2E suite (slug `e2e-bijak`).
 *
 * All selectors and steps live here so the specs stay readable and the target can change later:
 * today the suite runs against the MOCK build (scope-ON, `playwright.bijak.config.mjs`; the Bijak
 * server is an in-tab mock persisted in localStorage). When the real API is deployed the target
 * switches through config/env only (baseURL / the scope flag in the Playwright config), not by
 * editing the specs. The real-API switch is NOT built yet.
 */
import type { Page } from '@playwright/test'

import { expect } from '../fixtures/test'
import { expectNoHorizontalScroll, H_SCROLL_SAMPLE_GAP_MS, H_SCROLL_SAMPLES } from '../support'

/**
 * One flag flips the suite from the mock build to an http-mode stack: `BIJAK_API_BASE=<origin>`
 * (the origin that serves the VITE_API_MODE=http SPA and proxies /api, as in BE-32). Mock-only specs
 * skip themselves when it is set; `http-autosave.spec.ts` runs only then.
 */
export const API_BASE = process.env.BIJAK_API_BASE
export const HTTP_MODE = !!(API_BASE || process.env.BASE_URL)

/**
 * Http-mode twin of `expectNoHorizontalScroll` (e2e/support/assertions.ts): same sampling, but the
 * app has booted when `#app.__vue_app__` exists; there is no `window.__mock` in http mode.
 */
export async function expectNoHorizontalScrollHttp(page: Page): Promise<void> {
  const samples: number[] = []
  for (let i = 0; i < H_SCROLL_SAMPLES; i++) {
    if (i > 0) await page.waitForTimeout(H_SCROLL_SAMPLE_GAP_MS)
    const sample = await page.evaluate(() => {
      const app = document.querySelector('#app') as (Element & { __vue_app__?: unknown }) | null
      if (!app?.__vue_app__) return null
      const el = document.documentElement
      return el.scrollWidth - el.clientWidth
    })
    expect(sample, 'expectNoHorizontalScrollHttp: the app has not mounted').not.toBeNull()
    samples.push(sample!)
  }
  for (const overflow of samples) {
    expect(
      overflow,
      `horizontal page overflow in px (samples: ${samples.join(', ')})`,
    ).toBeLessThanOrEqual(0)
  }
}

/** The right check for the current mode (shared steps run in both). */
export const expectNoHorizontalScrollAuto = (page: Page): Promise<void> =>
  HTTP_MODE ? expectNoHorizontalScrollHttp(page) : expectNoHorizontalScroll(page)

export const PAPER_ID = 'mat-k1-2025-a'
export const FORBIDDEN_TITLE = 'Akses Ditolak | PRESTASIPLUS'

/** Hub -> cover -> Mula (exam mode). Resolves once the attempt shell is visible. */
export async function startPaper(page: Page, paperId = PAPER_ID): Promise<void> {
  await page.getByTestId(`open-${paperId}`).click()
  await expect(page.getByTestId('bijak-cover')).toBeVisible()
  await expectNoHorizontalScrollAuto(page)
  await page.locator('[data-ds=hero-cta]').click()
  await expect(page.getByTestId('attempt-shell')).toBeVisible()
  await expectNoHorizontalScrollAuto(page)
}

/** Opens the hub from the SPM section (the menu route a student really takes). */
export async function openHubFromSpm(
  page: Page,
  gotoApp: (path: string) => Promise<void>,
): Promise<void> {
  await gotoApp('/spm')
  await page.getByTestId('spm-bijak-link').click()
  await expect(page.getByTestId('bijak-hub')).toBeVisible()
  await expectNoHorizontalScrollAuto(page)
}

/** Picks option `index` of the current MCQ question. */
export async function pickOption(page: Page, index: number): Promise<void> {
  await page.locator('[data-testid^=option-]').nth(index).click()
}

/** The option buttons carry `aria-pressed`; returns the pressed flags in order. */
export async function pressedOptions(page: Page): Promise<string[]> {
  return page
    .locator('[data-testid^=option-]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-pressed') ?? ''))
}

/** Walks to the last question, taps Hantar and confirms. Resolves on the win screen. */
export async function submitAttempt(page: Page): Promise<void> {
  while (await page.getByTestId('next').isVisible()) await page.getByTestId('next').click()
  await page.getByTestId('submit').click()
  await expect(page.getByTestId('submit-summary')).toBeVisible()
  await page.getByTestId('confirm-submit').click()
  await expect(page.getByTestId('win-screen')).toBeVisible()
  await expectNoHorizontalScrollAuto(page)
}
