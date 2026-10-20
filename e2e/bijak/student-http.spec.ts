/**
 * Bijak SPM, Murid: full student journey against the REAL API (http-mode build).
 *
 * GO/NO-GO EVIDENCE for objective (a). This spec WRITES ONE REAL ATTEMPT on the target (it starts,
 * answers and submits a paper as the pupil whose credentials are given). Run it only against a
 * stack the lead has cleared (staging after GO).
 *
 * Env (never in the repo):
 *   BIJAK_API_BASE        origin serving the VITE_API_MODE=http SPA with /api behind it
 *   BIJAK_STUDENT_USER    pupil e-mail
 *   BIJAK_STUDENT_PASS    pupil password
 *   BIJAK_PAPER_ID        optional: published paper to open (default: the first one on the hub)
 *
 *   BIJAK_API_BASE=https://... npx playwright test -c playwright.bijak.config.mjs student-http
 *
 * Journey (one serial test, steps named in the report):
 *   1 login (UI) -> hub (>= 1 published paper) -> cover (title, duration, instructions)
 *   2 Mula (exam mode, the cover default) -> attempt screen; attempt id + clock recorded
 *   3 answer Q1 (+ Q2) -> PUT /api/bijak/attempts/:id/answers 2xx -> "Disimpan"
 *   4 go to a later question (position saved by a PUT), drop pp.bijak.local.* and reload: the same
 *     attempt id, answers, position and a continuing (not reset) clock must come from the server
 *   5 Hantar + confirm -> POST /api/bijak/attempts/:id/submit 2xx -> result (score, per section)
 *   6 history -> GET /api/bijak/history 2xx -> the new attempt is first, with the same score
 *
 * Endpoints are those of src/modules/m28-bijak-spm/server/http.ts. Plain `@playwright/test`: no
 * mock fixtures, no clock, no `loginAs`.
 */
import { expect, test } from '@playwright/test'
import type { Page, Response } from '@playwright/test'

import { expectNoHorizontalScroll } from '../support'
import { HTTP_MODE } from './bijak-flow'

const USER = process.env.BIJAK_STUDENT_USER
const PASS = process.env.BIJAK_STUDENT_PASS
const PAPER = process.env.BIJAK_PAPER_ID

test.skip(!HTTP_MODE, 'needs BIJAK_API_BASE (integration stack)')
test.skip(!USER || !PASS, 'needs BIJAK_STUDENT_USER and BIJAK_STUDENT_PASS')

const attemptIdOf = (url: string): string => /percubaan\/([^/?#]+)/.exec(url)?.[1] ?? ''

/** "mm:ss" or "h:mm:ss" -> seconds. */
function clockSeconds(text: string): number {
  const parts = text
    .trim()
    .split(':')
    .map((p) => Number(p))
  if (parts.some((n) => Number.isNaN(n))) return Number.NaN
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

/** "12 / 40" -> "12/40" */
const pair = (text: string): string => {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(text)
  return m ? `${m[1]}/${m[2]}` : text.trim()
}

const is2xx = (r: Response): boolean => r.status() >= 200 && r.status() < 300

const answersPut = (r: Response): boolean =>
  r.request().method() === 'PUT' && /\/api\/bijak\/attempts\/[^/]+\/answers$/.test(r.url())

const pressed = (page: Page): Promise<string[]> =>
  page
    .locator('[data-testid^=option-]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-pressed') ?? ''))

/** Reads "Soalan N / M" (visible from the sm breakpoint) or the map button "Peta N/M" (mobile). */
async function questionNumber(page: Page): Promise<number> {
  const el = (await page.getByTestId('position').isVisible())
    ? page.getByTestId('position')
    : page.getByTestId('open-map')
  const m = /(\d+)\s*\/\s*\d+/.exec(await el.innerText())
  return m ? Number(m[1]) : 0
}

test.describe('Bijak SPM Murid over HTTP @bijak', () => {
  test.describe.configure({ mode: 'serial' })

  test('login, paper, answer, server-side resume, submit, result, history @bijak', async ({
    page,
  }) => {
    let attemptId = ''
    let clockAtStart = 0
    let answersBefore: string[] = []
    let positionBefore = 0
    let scoreText = ''
    let title = ''

    await test.step('1 login, hub lists a published paper, cover shows title/duration/instructions', async () => {
      await page.goto('/login')
      await page.getByTestId('login-email').fill(USER ?? '')
      await page.getByTestId('login-password').fill(PASS ?? '')
      await page.getByTestId('login-submit').click()
      await page.waitForURL((u) => !u.pathname.startsWith('/login'))

      const papersRes = page.waitForResponse(
        (r) => r.request().method() === 'GET' && /\/api\/bijak\/papers$/.test(r.url()),
      )
      await page.goto('/spm/bijak')
      expect(is2xx(await papersRes)).toBe(true)
      await expect(page.getByTestId('bijak-hub')).toBeVisible()
      await expectNoHorizontalScroll(page)
      const open = PAPER
        ? page.getByTestId(`open-${PAPER}`)
        : page.locator('[data-testid^=open-]').first()
      await expect(open, 'at least one published paper on the hub').toBeVisible()
      expect(await page.locator('[data-testid^=open-]').count()).toBeGreaterThanOrEqual(1)

      const coverRes = page.waitForResponse(
        (r) => r.request().method() === 'GET' && /\/api\/bijak\/papers\/[^/]+$/.test(r.url()),
      )
      await open.click()
      expect(is2xx(await coverRes)).toBe(true)
      await expect(page.getByTestId('bijak-cover')).toBeVisible()
      await expectNoHorizontalScroll(page)
      title = (await page.getByTestId('cover-title').innerText()).trim()
      expect(title.length).toBeGreaterThan(0)
      await expect(page.getByTestId('cover-hero')).toContainText(/\d+ minit/)
      await expect(page.getByTestId('instructions').locator('li').first()).toBeVisible()
    })

    await test.step('2 Mula (exam mode) opens the attempt screen; record attempt id and clock', async () => {
      // A leftover unsent attempt of this paper turns the cover into Sambung / Mula Semula: take
      // Mula Semula so the journey always starts from a fresh attempt.
      const started = page.waitForResponse(
        (r) => r.request().method() === 'POST' && /\/api\/bijak\/attempts$/.test(r.url()),
      )
      if (await page.getByTestId('resume-choice').isVisible()) {
        await page.getByTestId('restart').click()
        await page.getByTestId('confirm-restart').click()
      } else {
        // Exam is the radio default; select it explicitly so the timer assertions are meaningful.
        await expect(page.getByTestId('mode-choice')).toBeVisible()
        await page.getByRole('radio', { name: /Mod Peperiksaan/ }).check()
        await page.locator('[data-ds=hero-cta]').click()
      }
      expect(is2xx(await started)).toBe(true)
      await expect(page.getByTestId('attempt-shell')).toBeVisible()
      await expect(page.getByTestId('attempt-loading')).toHaveCount(0)
      attemptId = attemptIdOf(page.url())
      expect(attemptId).not.toBe('')
      await expect(page.getByTestId('attempt-title')).toContainText('Mod Peperiksaan')
      await expect(page.getByTestId('clock')).toHaveText(/\d+:\d{2}/)
      clockAtStart = clockSeconds(await page.getByTestId('clock').innerText())
      expect(clockAtStart).toBeGreaterThan(0)
      await expectNoHorizontalScroll(page)
    })

    await test.step('3 answer Q1 (+ Q2): PUT answers 2xx, indicator reads Disimpan', async () => {
      await expect(page.locator('[data-testid^=option-]').first()).toBeVisible()
      const saved1 = page.waitForResponse(answersPut)
      await page.locator('[data-testid^=option-]').nth(1).click()
      const res1 = await saved1
      expect(is2xx(res1), `PUT answers status ${res1.status()}`).toBe(true)
      await expect(page.getByTestId('save-status')).toHaveText('Disimpan')
      expect(await pressed(page)).toContain('true')

      // Q2 when there is one.
      if (await page.getByTestId('next').isVisible()) {
        await page.getByTestId('next').click()
        const saved2 = page.waitForResponse(answersPut)
        await page.locator('[data-testid^=option-]').first().click()
        expect(is2xx(await saved2)).toBe(true)
        await expect(page.getByTestId('save-status')).toHaveText('Disimpan')
      }
      await expectNoHorizontalScroll(page)
    })

    await test.step('4 move on, drop the device copy, reload: state comes from the server', async () => {
      // Go to the third question when available (position is saved by its own debounced PUT).
      const savedPos = page.waitForResponse(answersPut)
      let moves = 0
      while (moves < 2 && (await page.getByTestId('next').isVisible())) {
        await page.getByTestId('next').click()
        moves++
      }
      if (moves > 0) expect(is2xx(await savedPos)).toBe(true)
      await expect(page.getByTestId('save-status')).toHaveText('Disimpan')
      positionBefore = await questionNumber(page)

      // Answers of the first question as the server must restore them.
      while ((await questionNumber(page)) > 1) await page.getByTestId('prev').click()
      answersBefore = await pressed(page)
      expect(answersBefore).toContain('true')
      // Return to the later question and let the position PUT settle.
      if (positionBefore > 1) {
        const savedBack = page.waitForResponse(answersPut)
        while ((await questionNumber(page)) < positionBefore) {
          await page.getByTestId('next').click()
        }
        expect(is2xx(await savedBack)).toBe(true)
        await expect(page.getByTestId('save-status')).toHaveText('Disimpan')
      }

      const clockBefore = clockSeconds(await page.getByTestId('clock').innerText())
      await page.evaluate(() => {
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith('pp.bijak.local.')) localStorage.removeItem(k)
        }
      })
      const view = page.waitForResponse(
        (r) =>
          r.request().method() === 'GET' &&
          new RegExp(`/api/bijak/attempts/${attemptId}$`).test(r.url()),
      )
      await page.reload()
      expect(is2xx(await view)).toBe(true)
      await expect(page.getByTestId('attempt-shell')).toBeVisible()
      await expect(page.getByTestId('attempt-loading')).toHaveCount(0)
      expect(attemptIdOf(page.url())).toBe(attemptId)

      // Position: the app restores it from attempt.position (AttemptPage.load -> autosave.position()).
      expect(await questionNumber(page)).toBe(positionBefore)

      // Timer continues from the server deadline: not reset to the full duration. Only seconds pass
      // between the reading and the reload; allow 60 s of drift (network, server/browser skew).
      const clockAfter = clockSeconds(await page.getByTestId('clock').innerText())
      expect(clockAfter).toBeLessThan(clockAtStart)
      expect(Math.abs(clockBefore - clockAfter)).toBeLessThanOrEqual(60)

      // Answers: back to Q1 and compare.
      while ((await questionNumber(page)) > 1) await page.getByTestId('prev').click()
      await expect.poll(() => pressed(page)).toEqual(answersBefore)
      await expectNoHorizontalScroll(page)
    })

    await test.step('5 Hantar + confirm: POST submit 2xx, result screen with per-section scores', async () => {
      while (await page.getByTestId('next').isVisible()) await page.getByTestId('next').click()
      await page.getByTestId('submit').click()
      await expect(page.getByTestId('submit-summary')).toBeVisible()
      const submitted = page.waitForResponse(
        (r) =>
          r.request().method() === 'POST' &&
          new RegExp(`/api/bijak/attempts/${attemptId}/submit$`).test(r.url()),
      )
      await page.getByTestId('confirm-submit').click()
      const res = await submitted
      expect(is2xx(res), `POST submit status ${res.status()}`).toBe(true)
      await expect(page.getByTestId('win-screen')).toBeVisible()
      expect(page.url()).toContain(attemptId)
      await expect(page.getByTestId('section-score').first()).toBeVisible()
      expect(await page.getByTestId('section-score').count()).toBeGreaterThanOrEqual(1)
      await expect(page.getByTestId('home')).toBeVisible()
      await expectNoHorizontalScroll(page)
      // Total score as the ring label prints it: "Skor X daripada Y".
      scoreText = await page
        .getByTestId('win-screen')
        .locator('[aria-label^="Skor "]')
        .first()
        .getAttribute('aria-label')
        .then((v) => v ?? '')
        .catch(() => '')
    })

    await test.step('6 history: the new attempt is on top with the same score', async () => {
      const hist = page.waitForResponse(
        (r) => r.request().method() === 'GET' && /\/api\/bijak\/history$/.test(r.url()),
      )
      await page.goto('/spm/bijak/sejarah')
      expect(is2xx(await hist)).toBe(true)
      await expect(page.getByTestId('history-list')).toBeVisible()
      await expectNoHorizontalScroll(page)

      const entry = page.getByTestId(`history-${attemptId}`)
      await expect(entry).toBeVisible()
      await expect(entry).toContainText(title)
      await expect(entry.getByTestId('history-status')).not.toHaveText('Sedang dijawab')

      // PROVISIONAL: "newest first" is not stated in the client (it renders the server order as is);
      // the mock sorts newest first. Soft, so a different server order is reported, not hidden.
      const top = page.getByTestId('history-list').locator('> li').first()
      await expect
        .soft(top.locator(`[data-testid=history-${attemptId}]`), '@provisional newest first')
        .toBeVisible()

      // PROVISIONAL: the result total is read from the win ring aria-label (selector inferred from
      // ResultPage props); falls back to a shape check when the label is not found.
      const rowScore = pair(await entry.getByTestId('history-score').innerText())
      const nums = /(\d+)\s+daripada\s+(\d+)/.exec(scoreText)
      if (nums) {
        expect
          .soft(rowScore, '@provisional history score = result score')
          .toBe(`${nums[1]}/${nums[2]}`)
      } else {
        expect.soft(rowScore, '@provisional result total not readable').toMatch(/^\d+\/\d+$/)
      }
    })
  })
})
