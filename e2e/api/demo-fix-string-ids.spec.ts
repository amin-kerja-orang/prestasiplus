/**
 * @api DEMO-FIX-1 (D-01 / D-02 / D-03 of the AZ-32 rehearsal, report #144 section 7): the three demo
 * flows that failed because the SPA sent or expected numeric ids where `packages/contract` uses string
 * ids (`IdSchema`). Runs against the REAL API at 375 / 768 / 1280 (playwright.http.config.ts).
 *
 * - D-01: the teacher creates a class from "Cipta Kelas" (201, not 422 "Sila pilih subjek.") and a
 *   pupil joins it with the class code.
 * - D-02: Latih Tubi with a specific Tahap Pendidikan starts (201, not 422 "Nilai tidak sah.") and
 *   runs to the results. Needs a level with questions (the D1–D4 pool of AZ-02 / #129).
 * - D-03: Battle Arena "Quick Match" enters the queue (searching card) without "Ralat sistem: ID
 *   giliran tidak sah. Sila cuba lagi.", then "Batal".
 *
 * Every flow fails on any browser dialog (the quiz start error is an `alert`) and checks that no
 * horizontal page scroll appears. Env: E2E_DEMO_PASSWORD (or the BIJAK_<ROLE>_PASS variables).
 */

import type { Page } from '@playwright/test'

import { expect, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll, newPeerContext } from './helpers'

/** Records every dialog (and dismisses it) so a test can assert that none appeared. */
function recordDialogs(page: Page): string[] {
  const seen: string[] = []
  page.on('dialog', (d) => {
    seen.push(`${d.type()}: ${d.message()}`)
    void d.dismiss()
  })
  return seen
}

test.describe('DEMO-FIX-1 string ids @api', () => {
  test.setTimeout(120_000)

  test('D-01: the teacher creates a class and a pupil joins it with the code @api', async ({
    page,
    browser,
  }, info) => {
    const dialogs = recordDialogs(page)
    const guru = account('guru')
    await loginViaUi(page, guru.user, guru.pass)

    await page.goto('/guru/kelas/cipta')
    await expect(page.getByTestId('kelas-create-page')).toBeVisible()
    const subject = page.getByTestId('kelas-subject')
    // The subject list comes from the API: wait for a real option, then pick Matematik.
    await expect(subject.locator('option').filter({ hasText: /^\s*Matematik\s*$/ })).toHaveCount(1)
    const name = `DF1 ${info.project.name} ${String(Date.now()).slice(-6)}`
    await page.getByTestId('kelas-name').fill(name)
    await subject.selectOption({ label: 'Matematik' })
    await page.getByTestId('kelas-levels').getByRole('radio', { name: 'Ting. 4' }).click()
    await expectNoHScroll(page)

    const created = page.waitForResponse(
      (r) => r.url().endsWith('/api/guru/classes') && r.request().method() === 'POST',
    )
    await page.getByTestId('kelas-submit').click()
    const res = await created
    const sentBody = res.request().postDataJSON() as { subjectId: unknown }
    expect(typeof sentBody.subjectId, 'subjectId on the wire').toBe('string')
    expect(res.status(), `POST /api/guru/classes ${await res.text()}`).toBe(201)
    const cls = ((await res.json()) as { data: { joinCode: string; name: string } }).data
    expect(cls.name).toBe(name)
    await expect(page).toHaveURL(/\/guru\/kelas$/)
    await expect(page.getByTestId('kelas-grid')).toContainText(name)
    await expectNoHScroll(page)

    // The pupil joins with the new code (own cookie session).
    const peer = await newPeerContext(browser, info)
    try {
      const pupilPage = await peer.newPage()
      const pupilDialogs = recordDialogs(pupilPage)
      const pupil = account('studentB')
      await loginViaUi(pupilPage, pupil.user, pupil.pass)
      await pupilPage.goto('/kelas-saya')
      await pupilPage.getByTestId('class-code').fill(cls.joinCode)
      const joined = pupilPage.waitForResponse(
        (r) => r.url().endsWith('/api/kelas-saya/join') && r.request().method() === 'POST',
      )
      await pupilPage.getByTestId('join-submit').click()
      expect((await joined).status(), 'POST /api/kelas-saya/join').toBeLessThan(300)
      await expect(pupilPage.getByTestId('join-success')).toBeVisible()
      await expect(pupilPage.getByTestId('join-error')).toHaveCount(0)
      await expectNoHScroll(pupilPage)
      expect(pupilDialogs).toEqual([])
    } finally {
      await peer.close()
    }
    expect(dialogs).toEqual([])
  })

  test('D-02: Latih Tubi with a specific Tahap Pendidikan starts and finishes @api', async ({
    page,
  }) => {
    const dialogs = recordDialogs(page)
    const pupil = account('student')
    await loginViaUi(page, pupil.user, pupil.pass)

    await page.goto('/practice/MATH')
    await expect(page.getByTestId('practice-config-page')).toBeVisible()
    // Darjah 4 (D4 pool): the level id comes from the API as a string.
    await page
      .getByTestId('config-levels')
      .getByRole('button', { name: /Darjah 4/ })
      .click()
    await expect(page.getByTestId('summary-level')).toHaveText('Darjah 4')
    await page.getByTestId('count-5').click()
    await expectNoHScroll(page)

    const started = page.waitForResponse(
      (r) => r.url().endsWith('/api/practice/sessions') && r.request().method() === 'POST',
    )
    await page.getByTestId('config-start').click()
    const res = await started
    const sentBody = res.request().postDataJSON() as { levelId: unknown }
    expect(typeof sentBody.levelId, 'levelId on the wire').toBe('string')
    expect(res.status(), `POST /api/practice/sessions ${await res.text()}`).toBe(201)

    await expect(page.getByTestId('quiz-question')).toBeVisible()
    await expectNoHScroll(page)
    for (let i = 0; i < 5; i++) {
      await page.getByTestId('option-A').click()
      await page.getByTestId('btn-check').click()
      await page.getByTestId('btn-next').click()
    }
    await expect(page.getByTestId('quiz-results')).toBeVisible()
    await expectNoHScroll(page)
    expect(dialogs).toEqual([])
  })

  test('D-02: a refused start is not silent: the API message is shown, then the config page @api', async ({
    page,
  }) => {
    // The rehearsal saw a "silent" return because Playwright auto-dismisses dialogs. The runner shows
    // the API's BM message with the existing alert (FR-M05-51) before going back; this pins it.
    const dialogs = recordDialogs(page)
    const pupil = account('student')
    await loginViaUi(page, pupil.user, pupil.pass)
    const started = page.waitForResponse(
      (r) => r.url().endsWith('/api/practice/sessions') && r.request().method() === 'POST',
    )
    // A level the subject does not have: 422 VALIDATION_ERROR "Nilai tidak sah.".
    await page.goto('/practice/MATH/quiz?level=999&count=5')
    const res = await started
    expect(res.status()).toBe(422)
    await expect(page).toHaveURL(/\/practice\/MATH$/)
    await expect(page.getByTestId('practice-config-page')).toBeVisible()
    expect(dialogs).toEqual(['alert: Nilai tidak sah.'])
    await expectNoHScroll(page)
  })

  test('D-03: Battle Arena Quick Match enters the queue without the queue-id error @api', async ({
    page,
  }) => {
    const dialogs = recordDialogs(page)
    const pupil = account('student')
    await loginViaUi(page, pupil.user, pupil.pass)

    await page.goto('/battle')
    await expect(page.getByTestId('battle-lobby')).toBeVisible()
    await page.getByTestId('battle-subject').filter({ hasText: 'Matematik' }).first().click()
    await expectNoHScroll(page)

    const started = page.waitForResponse(
      (r) => r.url().endsWith('/api/battle/quick-match') && r.request().method() === 'POST',
    )
    await page.getByTestId('battle-quick-match').click()
    const res = await started
    expect(res.status(), 'POST /api/battle/quick-match').toBe(200)
    const sentBody = res.request().postDataJSON() as { subject_id: unknown }
    expect(typeof sentBody.subject_id, 'subject_id on the wire').toBe('string')
    const body = (await res.json()) as { queue_id?: unknown; matched?: boolean }
    if (body.matched !== true) {
      expect(typeof body.queue_id, 'queue_id from the API').toBe('string')
      await expect(page.getByTestId('battle-searching')).toBeVisible()
      await expect(page.getByTestId('battle-error')).toHaveCount(0)
      await expect(page.getByText('Ralat sistem: ID giliran tidak sah.')).toHaveCount(0)
      // The first poll uses the string queue id and is answered 2xx.
      const poll = await page.waitForResponse((r) => r.url().includes('/api/battle/poll-match/'))
      expect(poll.url()).toContain(`/api/battle/poll-match/${String(body.queue_id)}`)
      expect(poll.status(), 'GET /api/battle/poll-match').toBeLessThan(300)
      await expectNoHScroll(page)
      await page.getByTestId('battle-cancel').click()
      await expect(page.getByTestId('battle-searching')).toHaveCount(0)
    }
    expect(dialogs).toEqual([])
  })
})
