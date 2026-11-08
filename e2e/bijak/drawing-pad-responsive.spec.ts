/**
 * Papan Lukisan (S8-T03, FR-PA-08 / AC-PA-16), mock build: the `drawing` leaf (d) of `mat2-garis-v1`
 * (Bahagian B of `mat-k2-2025-a`) has a graph-paper template. Run at 375 / 768 / 1280 by the three
 * projects of playwright.bijak.config.mjs.
 *  - the pad and its template grid are visible; every pad control is at least 44px high;
 *  - a stroke drawn with the mouse is auto-saved as one photo (`lukisan.png`), never two, no error;
 *  - no horizontal page scroll.
 */
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll } from '../support'

import { openHubFromSpm, startPaper } from './bijak-flow'

const PAD_CONTROLS = [
  'pad-tool-pen',
  'pad-tool-line',
  'pad-tool-eraser',
  'pad-undo',
  'pad-clear',
  'pad-save',
] as const

/** `mat2-garis-v1` is question 4 of `mat-k2-2025-a` (registry.ts: three Bahagian A questions, then Bahagian B). */
const DRAWING_Q = 4
const DRAWING_LEAF = 'part-input-mat2-garis-v1-d'

/** Below 1024px the shared Rajah drawer opens by itself on the first member of its group: close it. */
async function closeStimulusDrawer(page: Page): Promise<void> {
  if (await page.getByTestId('group-stimuli').isVisible()) {
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('group-stimuli')).toBeHidden()
  }
}

/** Jumps to the drawing leaf through the question map (`nav-<n>`): the rail at 1280, the "Peta" sheet below lg. */
async function toDrawingLeaf(page: Page): Promise<void> {
  await expect(page.getByTestId('next')).toBeVisible()
  await closeStimulusDrawer(page)
  // the map exists twice below lg (rail kept in the DOM + the sheet): use the visible one
  const nav = page.locator(`[data-testid="nav-${DRAWING_Q}"]:visible`)
  if ((await nav.count()) === 0) await page.getByTestId('open-map').click()
  await nav.click()
  if (await page.getByTestId('open-map').isVisible()) await page.keyboard.press('Escape')
  await closeStimulusDrawer(page)
  await expect(page.getByTestId(DRAWING_LEAF)).toBeVisible()
}

async function drawStroke(page: Page): Promise<void> {
  const canvas = page.getByTestId('pad-canvas')
  await canvas.scrollIntoViewIfNeeded()
  const box = (await canvas.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.7)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, { steps: 5 })
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.2, { steps: 5 })
  await page.mouse.up()
}

test.skip(
  process.env.E2E_PROTOTYPE_SCOPE !== 'on',
  'needs the scope-on build: playwright.bijak.config.mjs',
)

test.describe('Papan Lukisan responsive @bijak', () => {
  test('template grid, mouse stroke auto-saved once, 44px controls, no h-scroll', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajar@demo.test')
    await openHubFromSpm(page, gotoApp)
    await startPaper(page, 'mat-k2-2025-a')
    await toDrawingLeaf(page)

    const pad = page.getByTestId('drawing-pad')
    await expect(pad).toBeVisible()
    await expect(pad).toContainText('Papan Lukisan')
    await expect(page.getByTestId('pad-template-grid')).toBeVisible()
    await expect(page.getByTestId('pad-canvas')).toBeVisible()
    await expect(page.getByTestId('pad-scale')).toContainText('1 petak = 1 unit')
    await expect(page.getByTestId('pad-save')).toBeDisabled()
    await expectNoHorizontalScroll(page)

    for (const id of PAD_CONTROLS) {
      const box = (await page.getByTestId(id).boundingBox())!
      expect(box.height, `${id} height`).toBeGreaterThanOrEqual(44)
      expect(box.width, `${id} width`).toBeGreaterThanOrEqual(44)
    }
    // the canvas stays inside the viewport on both sides
    const vw = page.viewportSize()!.width
    const cbox = (await page.getByTestId('pad-canvas').boundingBox())!
    expect(cbox.x).toBeGreaterThanOrEqual(0)
    expect(cbox.x + cbox.width).toBeLessThanOrEqual(vw)

    await drawStroke(page)
    await expect(page.getByTestId('pad-save')).toBeEnabled()

    // auto-save (800 ms after the stroke): one photo listed, no error
    const photos = page.getByRole('list', { name: 'Gambar jawapan lukisan' }).getByRole('listitem')
    await expect(photos).toHaveCount(1, { timeout: 10_000 })
    await expect(photos.first()).toContainText('lukisan.png')
    await expect(page.getByTestId('pad-error')).toHaveCount(0)

    // a second stroke and an explicit save replace the drawing: still one photo
    // positive signal: the stored drawing is replaced (its preview gets a new object URL), then exactly one photo is left
    const preview = photos.first().locator('img')
    await expect(preview).toHaveAttribute('src', /^blob:/)
    const firstSrc = await preview.getAttribute('src')
    await drawStroke(page)
    await page.getByTestId('pad-save').click()
    await expect(preview).not.toHaveAttribute('src', firstSrc!, { timeout: 10_000 })
    await expect(photos).toHaveCount(1)

    // clearing the pad removes the drawing photo
    await page.getByTestId('pad-clear').click()
    await expect(photos).toHaveCount(0, { timeout: 10_000 })
    await expect(page.getByTestId('pad-save')).toBeDisabled()
    await expectNoHorizontalScroll(page)
  })
})
