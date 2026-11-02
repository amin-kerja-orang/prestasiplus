/**
 * @api M05 quiz run: the free trial runs out in the middle of a quiz (402 TRIAL_EXHAUSTED on POST /api/practice/sessions/:id/check-answer)
 * against the REAL API. Fix: src/modules/m05-practice/components/quiz (QuizRunner `trial-exhausted` notice).
 *
 * Fixture: `apps/api/prisma/seed/e2e-trial.ts`, called by the e2e seed. It needs the stack seeded with `--profile=e2e` AND `E2E_SEED=1`
 * (the same guards as the other e2e fixtures). It creates three unsubscribed pupils at DEMO001 with 49 of 50 trial answers used, one per
 * viewport project (375 / 768 / 1280), because this spec spends a pupil's last answer and the projects share one database.
 * Self-healing: with `E2E_DATABASE_URL` set (CI: the job's throw-away database), `beforeEach` resets the current pupil's counter to 49 with `psql`
 * (same host guard as forced-password-change.spec.ts), so a rerun or a Playwright retry works. Without it nothing is reset: a rerun needs a re-seed.
 *
 * Flow: log in as the pupil, open Latih Tubi SPM (S3/S4), start a session (the 50th answer is still free, so start is 201),
 * check #1 -> 200, "Soalan Seterusnya", check #2 -> 402. Expected UI: the notice `trial-exhausted` "Baki percubaan percuma anda telah habis."
 * with the link "Langgan untuk akses tanpa had" -> /pricing, the question stays unchecked (no `quiz-feedback`, no "Salah"), no horizontal scroll.
 * Before the fix the 402 body marked the question checked as "Salah" and showed no message.
 *
 * Env: E2E_DEMO_PASSWORD (the shared demo password; default Demo1234).
 */

import { execFileSync } from 'node:child_process'

import type { Page, Response } from '@playwright/test'

import { API_PASSWORD, expect, loginViaUi, test } from '../fixtures/api'
import { expectNoHScroll } from './helpers'

/** Same order as `E2E_TRIAL_PUPILS` in apps/api/prisma/seed/e2e-trial.ts: 375 px, 768 px, 1280 px. */
const PUPILS = [
  'murid.trial.e2e@example.test',
  'murid.trial2.e2e@example.test',
  'murid.trial3.e2e@example.test',
]
/** The contract / server text (packages/contract practice/schema.ts PRACTICE_ERRORS.TRIAL_EXHAUSTED). */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])
/** The only e-mails this spec resets (the e2e-trial.ts fixture pupils). */
const TRIAL_EMAIL = /^murid\.trial[0-9]*\.e2e@example\.test$/

/**
 * Sets `users.trial_questions_used = 49` for one fixture pupil and deletes that pupil's own practice sessions, checks and answers, on the TEST database `E2E_DATABASE_URL` only (no `DATABASE_URL` fallback).
 * Without `E2E_DATABASE_URL` it does nothing. The host must be localhost / 127.0.0.1 / ::1, or `E2E_DB_IS_TEST=1` must say that it is a
 * throw-away database. The connection goes to `psql` through the PG* environment variables only (no URL or password in argv or an error).
 * A failure throws a fixed message.
 */
function resetTrial(email: string): void {
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
    throw new Error(
      'reset refused: the database host is not local (set E2E_DB_IS_TEST=1 for a test database)',
    )
  }
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PGHOST: host,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, '')) || 'postgres',
  }
  let out: string
  try {
    out = execFileSync(
      'psql',
      ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-v', `email=${email}`, '-f', '-'],
      {
        env,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
        input: [
          "delete from practice_checks where session_id in (select s.id from practice_sessions s join users u on u.id = s.user_id where u.email = :'email');",
          "delete from practice_answers where session_id in (select s.id from practice_sessions s join users u on u.id = s.user_id where u.email = :'email');",
          "delete from practice_session_questions where session_id in (select s.id from practice_sessions s join users u on u.id = s.user_id where u.email = :'email');",
          "delete from practice_sessions where user_id in (select id from users where email = :'email');",
          "update users set trial_questions_used = 49 where email = :'email' returning id;",
          '',
        ].join('\n'),
      },
    )
  } catch {
    throw new Error('resetting the trial counter failed (psql)')
  }
  if (out.trim().split('\n').filter(Boolean).length !== 1)
    throw new Error('resetting the trial counter changed an unexpected number of rows')
}

const pupilEmail = (page: Page): string => {
  const width = page.viewportSize()?.width ?? 1280
  return PUPILS[width < 768 ? 0 : width < 1280 ? 1 : 2]!
}

const EXHAUSTED = 'Baki percubaan percuma anda telah habis.'

const isPath = (r: Response, suffix: RegExp, method: string): boolean =>
  suffix.test(new URL(r.url()).pathname) && r.request().method() === method

async function openOption(page: Page): Promise<void> {
  await page.getByTestId('option-A').click()
}

test.describe('trial exhausted mid-quiz @api', () => {
  test.setTimeout(120_000)

  test.beforeEach(({ page }) => {
    resetTrial(pupilEmail(page))
  })

  test('murid: the 402 on the second answer shows the trial notice with a /pricing link and no wrong answer @api', async ({
    page,
  }) => {
    const email = pupilEmail(page)
    await loginViaUi(page, email, process.env.E2E_DEMO_PASSWORD || API_PASSWORD)

    // Latih Tubi SPM: the first unlocked subject with questions (same lookup as spm-hub.spec.ts).
    const listWait = page.waitForResponse((r) => isPath(r, /^\/api\/spm\/latih-tubi$/, 'GET'), {
      timeout: 30_000,
    })
    await page.goto('/spm/latih-tubi')
    const list = (
      (await (await listWait).json()) as {
        data: {
          teras: { code: string; total: number; locked: boolean }[]
          elektif: { code: string; total: number; locked: boolean }[]
        }
      }
    ).data
    const open = [...list.teras, ...list.elektif].find((c) => !c.locked && c.total > 0)
    expect(open, 'an unlocked Latih Tubi SPM subject with questions').toBeDefined()
    await page.goto(`/spm/latih-tubi/${open!.code}`)
    await expect(page.getByTestId('spm-config-page')).toBeVisible({ timeout: 20_000 })

    const started = page.waitForResponse((r) => isPath(r, /^\/api\/practice\/sessions$/, 'POST'), {
      timeout: 30_000,
    })
    await page.getByTestId('config-start').click()
    expect(
      (await started).status(),
      'POST /api/practice/sessions (49 of 50 used: still allowed)',
    ).toBe(201)
    await expect(page.getByTestId('quiz-body')).toBeVisible({ timeout: 20_000 })
    await expectNoHScroll(page)

    // Answer 1: the 50th free answer.
    const check1 = page.waitForResponse(
      (r) => isPath(r, /^\/api\/practice\/sessions\/[^/]+\/check-answer$/, 'POST'),
      { timeout: 30_000 },
    )
    await openOption(page)
    await page.getByTestId('btn-check').click()
    expect((await check1).status(), 'check #1').toBe(200)
    await expect(page.getByTestId('quiz-feedback')).toBeVisible()
    await expect(page.getByTestId('trial-exhausted')).toHaveCount(0)
    await page.getByTestId('btn-next').click()
    await expect(page.getByTestId('quiz-feedback')).toHaveCount(0)

    // Answer 2: past the limit.
    const check2 = page.waitForResponse(
      (r) => isPath(r, /^\/api\/practice\/sessions\/[^/]+\/check-answer$/, 'POST'),
      { timeout: 30_000 },
    )
    await openOption(page)
    await page.getByTestId('btn-check').click()
    const res2 = await check2
    expect(res2.status(), 'check #2').toBe(402)
    expect(
      ((await res2.json()) as { error: { code: string; message: string } }).error,
    ).toMatchObject({ code: 'TRIAL_EXHAUSTED', message: EXHAUSTED })

    const notice = page.getByTestId('trial-exhausted')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText(EXHAUSTED)
    const link = notice.getByRole('link', { name: 'Langgan untuk akses tanpa had' })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/pricing')
    // The question is not checked and not marked wrong.
    await expect(page.getByTestId('quiz-feedback')).toHaveCount(0)
    await expect(page.getByTestId('feedback-title')).toHaveCount(0)
    await expect(page.getByTestId('quiz-body')).not.toContainText('Salah')
    await expect(page.getByTestId('btn-check')).toBeVisible()
    await expectNoHScroll(page)
  })
})
