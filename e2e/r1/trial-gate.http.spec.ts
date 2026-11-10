/**
 * M05 trial gate on the REAL API (moved from e2e/m05-practice/smoke-practice.spec.ts: the gate is API-side,
 * start.planner.ts:191-193 -> 402 TRIAL_EXHAUSTED, QuizRunner.vue:150-157; the mock has no trial gate, users.ts:554).
 *
 * A pupil with 0 free questions left opens the config page, sees "Baki percubaan percuma: 0 soalan lagi.",
 * starting is blocked (the quiz page shows the `trial-exhausted-start` notice, no quiz body), the browser never
 * lands on /pricing and no pricing/"Langgan" link is rendered (/pricing retired, r1-canonical-map.json:6344).
 *
 * Fixture: the same unsubscribed e2e-trial pupils as e2e/api/trial-exhausted-midquiz.spec.ts (apps/api/prisma/seed/e2e-trial.ts),
 * stack seeded with `--profile=e2e` and `E2E_SEED=1`; `E2E_DATABASE_URL` (a local or throw-away database) lets `beforeEach` set the
 * counter to 50 of 50 with psql. Without it the counter is not touched and the pupil must already be at 50.
 * Type-checked only in the mock-only checkout: it needs the real stack (playwright.http.config.ts).
 */

import { execFileSync } from 'node:child_process'

import type { Page } from '@playwright/test'

import { API_PASSWORD, expect, loginViaUi, test } from '../fixtures/api'

/** Same order as `E2E_TRIAL_PUPILS` in apps/api/prisma/seed/e2e-trial.ts: 375 px, 768 px, 1280 px. */
const PUPILS = [
  'murid.trial.e2e@example.test',
  'murid.trial2.e2e@example.test',
  'murid.trial3.e2e@example.test',
]
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])
const TRIAL_EMAIL = /^murid\.trial[0-9]*\.e2e@example\.test$/

/** Sets `users.trial_questions_used` to 50 for one fixture pupil on the test database (same guards as the mid-quiz spec). */
function exhaustTrial(email: string): void {
  const raw = process.env.E2E_DATABASE_URL
  if (!raw) return
  if (!TRIAL_EMAIL.test(email)) throw new Error('reset refused: not a trial fixture pupil e-mail')
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('E2E_DATABASE_URL is not a valid URL')
  }
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (!LOCAL_HOSTS.has(host) && process.env.E2E_DB_IS_TEST !== '1') {
    throw new Error('reset refused: the database host is not local (set E2E_DB_IS_TEST=1 for a test database)')
  }
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PGHOST: host,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, '')) || 'postgres',
  }
  try {
    execFileSync('psql', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-v', `email=${email}`, '-f', '-'], {
      env,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      input: "update users set trial_questions_used = 50 where email = :'email' returning id;\n",
    })
  } catch {
    throw new Error('setting the trial counter failed (psql)')
  }
}

const pupilEmail = (page: Page): string => {
  const width = page.viewportSize()?.width ?? 1280
  return PUPILS[width < 768 ? 0 : width < 1280 ? 1 : 2]!
}

test.describe('trial gate: 0 free questions @api', () => {
  test.setTimeout(120_000)

  test.beforeEach(({ page }) => {
    exhaustTrial(pupilEmail(page))
  })

  test('murid with no free questions left: notice, start blocked, no /pricing redirect or link @api', async ({ page }) => {
    await loginViaUi(page, pupilEmail(page), process.env.E2E_DEMO_PASSWORD || API_PASSWORD)
    await page.goto('/practice/MATH')
    await expect(page.getByTestId('config-trial')).toContainText('Baki percubaan percuma: 0 soalan lagi.')
    await page.getByTestId('config-start').click()

    // Start is refused with 402: the quiz page stays on the loading phase with the notice, no question is shown.
    await expect(page.getByTestId('trial-exhausted-start')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('quiz-body')).toHaveCount(0)
    // /pricing retired (r1-canonical-map.json:6344): never redirected there, no pricing/"Langgan" link rendered.
    await expect(page).not.toHaveURL(/\/pricing/)
    await expect(page.locator('a[href="/pricing"]')).toHaveCount(0)
    await expect(page.getByText(/Langgan/)).toHaveCount(0)
  })
})
