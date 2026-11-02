/**
 * Bijak SPM edge cases against the mock: partial progress + resume through the hub, result history
 * after submit, and the "no eligible questions" 422 path (fixme: see below).
 * Needs the scope-ON build: `npm run test:e2e:bijak`.
 */
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll } from '../support'
import { HTTP_MODE, PAPER_ID, pickOption, pressedOptions, startPaper } from './bijak-flow'

test.skip(
  HTTP_MODE,
  'mock-only (loginAs init-script session, __mock boot, local mock server): not run when BIJAK_API_BASE is set',
)
test.skip(
  process.env.E2E_PROTOTYPE_SCOPE !== 'on',
  'needs the scope-on build: playwright.bijak.config.mjs',
)

const attemptIdOf = (url: string): string => /percubaan\/([^/?#]+)/.exec(url)?.[1] ?? ''

/** Rewinds to the first question with "Sebelum". */
async function toFirstQuestion(page: Page): Promise<void> {
  const prev = page.getByTestId('prev')
  while ((await prev.isVisible()) && (await prev.isEnabled())) await prev.click()
}

/** Per question: is any option pressed? Walks forward from Q1 for `count` questions. */
async function answeredFlags(page: Page, count: number): Promise<boolean[]> {
  await expect(page.getByTestId('attempt-loading')).toHaveCount(0)
  await expect(page.locator('[data-testid^=option-]').first()).toBeVisible()
  await toFirstQuestion(page)
  const out: boolean[] = []
  for (let i = 0; i < count; i++) {
    out.push((await pressedOptions(page)).includes('true'))
    if (i < count - 1) await page.getByTestId('next').click()
  }
  return out
}

/** Hantar from wherever we are; returns the result URL and the first section score text. */
async function submitAndRead(page: Page): Promise<{ url: string; score: string }> {
  while (await page.getByTestId('next').isVisible()) await page.getByTestId('next').click()
  await page.getByTestId('submit').click()
  await page.getByTestId('confirm-submit').click()
  await expect(page.getByTestId('win-screen')).toBeVisible()
  await expectNoHorizontalScroll(page)
  const score = (await page.getByTestId('section-score').first().innerText()).trim()
  return { url: page.url(), score }
}

const pair = (text: string): string => {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(text)
  return m ? `${m[1]}/${m[2]}` : text
}

test.describe('Bijak SPM edge cases @bijak', () => {
  test('partial progress resumes through the hub "Sambung" entry on the same attempt @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/spm/bijak')
    await startPaper(page)
    const attemptId = attemptIdOf(page.url())
    expect(attemptId).not.toBe('')

    // Answer Q1 and Q2, leave Q3+ empty.
    await pickOption(page, 0)
    await page.getByTestId('next').click()
    await pickOption(page, 1)
    await expect(page.getByTestId('save-status')).toHaveText('disimpan')

    // Leave to the hub (full load: local copy + mock server are the only memory).
    await gotoApp('/spm/bijak')
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    await expect(page.getByTestId('paper-status').first()).toContainText('Sedang dijawab')
    await expect(page.getByTestId(`open-${PAPER_ID}`)).toHaveText('Sambung')
    await expectNoHorizontalScroll(page)

    await page.getByTestId(`open-${PAPER_ID}`).click()
    await expect(page.getByTestId('bijak-cover')).toBeVisible()
    await expectNoHorizontalScroll(page)
    // Cover offers Sambung / Mula Semula for an unsent attempt; take "Sambung".
    const resume = page.getByTestId('resume')
    if (await resume.isVisible()) await resume.click()
    else await page.locator('[data-ds=hero-cta]').click()
    await expect(page.getByTestId('attempt-shell')).toBeVisible()

    expect(attemptIdOf(page.url())).toBe(attemptId)
    expect(await answeredFlags(page, 4)).toEqual([true, true, false, false])
    await expectNoHorizontalScroll(page)

    // No second attempt was created.
    await gotoApp('/spm/bijak/sejarah')
    await expect(page.getByTestId('history-list').locator('li')).toHaveCount(1)
    await expect(page.getByTestId('history-status')).toHaveText('Sedang dijawab')
    await expectNoHorizontalScroll(page)
  })

  test('history after submit: newest first, title and score match the result @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/spm/bijak')

    // Attempt A: one answer.
    await startPaper(page)
    // The attempt header reads "<paper title> Mod Peperiksaan"; the history row shows the title alone.
    const title = (await page.getByTestId('attempt-title').innerText())
      .replace(/\s+Mod\s.*$/, '')
      .trim()
    await pickOption(page, 0)
    await expect(page.getByTestId('save-status')).toHaveText('disimpan')
    const a = await submitAndRead(page)

    // Attempt B (same paper, "Cuba lagi"): no answers.
    await gotoApp('/spm/bijak')
    await startPaper(page)
    const b = await submitAndRead(page)
    const idA = attemptIdOf(a.url)
    const idB = attemptIdOf(b.url)
    expect(idA).not.toBe(idB)

    await gotoApp('/spm/bijak/sejarah')
    const items = page.getByTestId('history-list').locator('> li')
    await expect(items).toHaveCount(2)
    await expectNoHorizontalScroll(page)
    // Newest first: B above A.
    await expect(items.nth(0).locator(`[data-testid=history-${idB}]`)).toBeVisible()
    await expect(items.nth(1).locator(`[data-testid=history-${idA}]`)).toBeVisible()
    for (const [id, result] of [
      [idB, b],
      [idA, a],
    ] as const) {
      const entry = page.getByTestId(`history-${id}`)
      await expect(entry).toContainText(title)
      // Date: the mock clock is fixed, so the line carries a formatted date and duration.
      await expect(entry).toContainText(/\d{4}/)
      expect(pair((await entry.getByTestId('history-score').innerText()).trim())).toBe(
        pair(result.score),
      )
    }
  })

  test.fixme('422 "Tiada soalan layak" when nothing is eligible shows a graceful message @bijak', () => {
    // The copy "Tiada soalan layak..." is not defined anywhere in the app, the mock server, or the
    // origin/be/BE-16-* branches (http client maps 422 to bad_request / NO_BLUEPRINT / SHORTAGE;
    // the mock's empty pool returns the shortage list, covered by e2e/m06-spm/bijak-spm.spec.ts).
    // Not inventing UI copy: revisit when the backend publishes the 422 message.
  })
})
