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
import { expectNoHorizontalScroll } from '../support'

export const PAPER_ID = 'mat-k1-2025-a'
export const FORBIDDEN_TITLE = '403 - Akses Ditolak | PRESTASIPLUS'

/** Hub -> cover -> Mula (exam mode). Resolves once the attempt shell is visible. */
export async function startPaper(page: Page, paperId = PAPER_ID): Promise<void> {
  await page.getByTestId(`open-${paperId}`).click()
  await expect(page.getByTestId('bijak-cover')).toBeVisible()
  await expectNoHorizontalScroll(page)
  await page.locator('[data-ds=hero-cta]').click()
  await expect(page.getByTestId('attempt-shell')).toBeVisible()
  await expectNoHorizontalScroll(page)
}

/** Opens the hub from the SPM section (the menu route a student really takes). */
export async function openHubFromSpm(
  page: Page,
  gotoApp: (path: string) => Promise<void>,
): Promise<void> {
  await gotoApp('/spm')
  await page.getByTestId('spm-bijak-link').click()
  await expect(page.getByTestId('bijak-hub')).toBeVisible()
  await expectNoHorizontalScroll(page)
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
  await expectNoHorizontalScroll(page)
}
