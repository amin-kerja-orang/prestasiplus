/**
 * @api Pupil pages that compared or sent ids as numbers on the REAL API, where ids are strings
 * (`IdSchema`). Runs at 375 / 768 / 1280 (playwright.http.config.ts) on the seeded question pool.
 *
 * - Rooms: the creator is the host, gets "Mula" and may act once the game plays (all six games).
 * - Jutawan Ilmu: a subject card starts the game (200, not 422 "Subjek tidak sah.").
 *
 * Env: E2E_DEMO_PASSWORD (or BIJAK_STUDENT_PASS).
 */

import type { Page } from '@playwright/test'

import { expect, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll } from './helpers'

function recordDialogs(page: Page): string[] {
  const seen: string[] = []
  page.on('dialog', (d) => {
    seen.push(`${d.type()}: ${d.message()}`)
    void d.dismiss()
  })
  return seen
}

const GAMES = [
  'papan-bijak',
  'perang-fakta',
  'benteng-ilmu',
  'perlumbaan-matematik',
  'teka-silang-kata',
  'kuiz-relay',
]

test.describe('pupil pages with string ids @api', () => {
  test.setTimeout(90_000)

  for (const game of GAMES) {
    test(`${game}: the room creator starts the game and may act @api`, async ({ page }) => {
      const dialogs = recordDialogs(page)
      const pupil = account('student')
      await loginViaUi(page, pupil.user, pupil.pass)

      await page.goto(`/${game}`)
      await page.getByTestId('create-form').locator('button[type=submit]').click()
      await expect(page).toHaveURL(new RegExp(`/${game}/[A-Z0-9]+$`))
      await expect(page.getByTestId('room-player-host')).toBeVisible()
      await expect(page.getByTestId('room-wait-host')).toHaveCount(0)
      await expectNoHScroll(page)

      // A poll by the host adds a bot up to the minimum players (`GamesRoomView`), which enables "Mula".
      const startButton = page.getByTestId('room-start')
      await expect(startButton).toBeEnabled({ timeout: 20_000 })
      const started = page.waitForResponse(
        (r) => /\/rooms\/[A-Z0-9]+\/start$/.test(r.url()) && r.request().method() === 'POST',
      )
      await startButton.click()
      const res = await started
      expect(res.status(), `POST start ${await res.text()}`).toBeLessThan(300)
      await expect(page.getByTestId('room-playing')).toBeVisible()
      await expect(page.getByTestId('room-watching')).toHaveCount(0)
      await expectNoHScroll(page)

      // The acting player takes one turn: a roll, a typed word or an option.
      const acted = page.waitForResponse(
        (r) => /\/rooms\/[A-Z0-9]+\/action$/.test(r.url()) && r.request().method() === 'POST',
      )
      if (game === 'papan-bijak') {
        await page.getByTestId('room-roll').click()
      } else if (game === 'teka-silang-kata') {
        await page.getByRole('textbox', { name: 'Jawapan' }).fill('jawapan')
        await page.getByTestId('room-word-submit').click()
      } else {
        await page.getByTestId('room-option').first().click()
      }
      const action = await acted
      expect(action.status(), `POST action ${await action.text()}`).toBeLessThan(300)
      await expect(page.getByTestId('room-action-errors')).toHaveCount(0)
      expect(dialogs).toEqual([])
    })
  }

  test('Jutawan Ilmu: a subject card starts the game with a string subject id @api', async ({
    page,
  }) => {
    const dialogs = recordDialogs(page)
    const pupil = account('student')
    await loginViaUi(page, pupil.user, pupil.pass)

    await page.goto('/permainan/jutawan?darjah=10')
    const card = page.getByTestId('jutawan-subject').filter({ hasText: 'Matematik' }).first()
    await expect(card, 'the Matematik card').toBeVisible()
    const started = page.waitForResponse(
      (r) => r.url().endsWith('/api/games/jutawan/start') && r.request().method() === 'POST',
    )
    await card.click()
    const res = await started
    const sent = res.request().postDataJSON() as { subject: unknown }
    expect(typeof sent.subject, 'subject on the wire').toBe('string')
    expect(res.status(), `POST /api/games/jutawan/start ${await res.text()}`).toBe(200)
    await expect(page.getByTestId('jutawan-question')).toBeVisible()
    await expectNoHScroll(page)

    const answered = page.waitForResponse((r) => r.url().endsWith('/answer'))
    await page.getByTestId('jutawan-option').first().click()
    expect((await answered).status(), 'POST /answer').toBe(200)
    expect(dialogs).toEqual([])
  })
})
