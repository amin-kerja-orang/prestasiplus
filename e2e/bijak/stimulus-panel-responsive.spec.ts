/**
 * Stimulus panel (S8-T02, AC-X6-2 / AC-PA-03, FR-X6-6/7), mock build: the attempt of `mat-k1-2025-a`, where
 * questions 5 to 8 share one diagram (Rajah 1). The mock data has no 3-question figure group; this 4-question
 * group is the closest. Run at 375 / 768 / 1280 by the three projects of playwright.bijak.config.mjs.
 *  - the stimulus is rendered once, above its questions;
 *  - from 1024px it is a sticky pane; below, a sticky chip "Lihat {label}" and a drawer;
 *  - the drawer is open the first time the group appears and keeps the pupil's choice on the next member (FR-X6-6);
 *  - tap to zoom opens the full-screen view; "Tutup" and the browser Back both close it;
 *  - no horizontal scroll at any step.
 */
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll } from '../support'

import { openHubFromSpm, startPaper } from './bijak-flow'

/** Moves on with "Seterusnya" until the shared stimulus panel is on screen (the first member of the group). */
async function toGroup(page: Page): Promise<void> {
  for (let i = 0; i < 9; i += 1) {
    if ((await page.getByTestId('stimulus-group').count()) > 0) return
    await page.getByTestId('next').click()
    await page.waitForTimeout(250)
  }
  await expect(page.getByTestId('stimulus-group')).toBeVisible()
}

test.skip(
  process.env.E2E_PROTOTYPE_SCOPE !== 'on',
  'needs the scope-on build: playwright.bijak.config.mjs',
)

test.describe('Stimulus panel responsive @bijak', () => {
  test('one figure shared by its questions: once, sticky, zoomable', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajar@demo.test')
    await openHubFromSpm(page, gotoApp)
    await startPaper(page)
    await toGroup(page)

    const wide = (page.viewportSize()?.width ?? 0) >= 1024
    const group = page.getByTestId('stimulus-group')
    await expect(group).toBeVisible()
    await expect(group).toHaveAttribute('data-layout', wide ? 'split' : 'stacked')
    const visibleFigures = page.locator('[data-testid="stimulus"]:visible')

    if (wide) {
      // a pinned pane, left of the question, one figure
      const pane = group.getByTestId('stimulus-pane')
      await expect(pane).toBeVisible()
      expect(await pane.evaluate((el) => getComputedStyle(el).position)).toBe('sticky')
      expect(await group.getByTestId('stimulus-chip').count()).toBe(0)
      await expect(visibleFigures).toHaveCount(1)
    } else {
      // a sticky chip "Lihat Rajah 1" and a drawer, open the first time the group appears (FR-X6-6)
      const chip = group.getByTestId('stimulus-chip')
      await expect(chip).toBeVisible()
      await expect(chip).toContainText('Lihat Rajah 1')
      expect(await chip.evaluate((el) => getComputedStyle(el.parentElement!).position)).toBe(
        'sticky',
      )
      expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44)
      await expect(page.getByTestId('group-stimuli')).toBeVisible()
      await expect(visibleFigures).toHaveCount(1)
    }
    await expectNoHorizontalScroll(page)

    // tap to zoom: the full-screen view opens, "Tutup" closes it
    const zoomOpen = page.getByTestId('stimulus-zoom-open').first()
    await expect(zoomOpen).toBeAttached({ timeout: 10_000 })
    await zoomOpen.click()
    const zoom = page.getByTestId('stimulus-zoom')
    await expect(zoom).toBeVisible()
    await expectNoHorizontalScroll(page)
    await page.getByTestId('stimulus-zoom-close').click()
    await expect(zoom).toBeHidden()

    // the browser Back closes the zoom view as well and stays on the attempt
    const url = page.url()
    await zoomOpen.click()
    await expect(zoom).toBeVisible()
    await page.goBack()
    await expect(zoom).toBeHidden()
    expect(page.url()).toBe(url)

    if (!wide) {
      // closing the drawer is remembered: on the next member of the group it stays collapsed, the chip reopens it
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('group-stimuli')).toBeHidden()
      await page.getByTestId('next').click()
      await expect(page.getByTestId('stimulus-group')).toBeVisible()
      await expect(page.getByTestId('group-stimuli')).toBeHidden()
      await page.getByTestId('stimulus-chip').click()
      await expect(page.getByTestId('group-stimuli')).toBeVisible()
      await expect(visibleFigures).toHaveCount(1)
      await page.keyboard.press('Escape')
    } else {
      // the pane is still there on the next member, still one figure
      await page.getByTestId('next').click()
      await expect(page.getByTestId('stimulus-pane')).toBeVisible()
      await expect(visibleFigures).toHaveCount(1)
    }
    await expectNoHorizontalScroll(page)
  })
})
