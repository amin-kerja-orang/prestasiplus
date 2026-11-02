/**
 * Kontrak Blueprint against the REAL API: Admin Pusat creates a Kontrak in the UI (Baharu, Teruskan, fields on each
 * tab, Simpan, evidence from two bodies, Sahkan), then a pupil's Jana Kertas offers it. No horizontal page scroll at
 * 375 / 768 / 1280. The mock twin is `kontrak.spec.ts`, which is skipped in http mode.
 *
 * WRITES REAL DATA: it creates and verifies Sejarah Kertas 1 (the one hub subject and kertas with no seeded contract),
 * then retires it so the next width can create it again. Run it only against a local or disposable stack.
 *
 * Tag `@kontrakhttp`, deliberately not `@api` or `@bijak`: `test:e2e:http` (the CI `e2e-api` job) selects `@api` and
 * `test:e2e:bijak` selects `@bijak`, and this write flow is not meant to grow either. One worker, because all widths
 * share the one contract. The http config cannot run it (its own `grep` needs `@api`), so:
 *
 *   BIJAK_API_BASE=http://localhost:5192 npx playwright test -c playwright.bijak.config.mjs \
 *     e2e/bijak/kontrak-http.spec.ts --grep @kontrakhttp --workers=1
 *
 * Needs the demo seed (run on profiles `poc` then `e2e`). Password: see `e2e/api/helpers.ts`.
 */
import type { Browser, Page, TestInfo } from '@playwright/test'

import { account, csrfOf } from '../api/helpers'
import { expect as baseExpect, loginViaUi, test } from '../fixtures/api'
import { expectNoHorizontalScrollHttp, HTTP_MODE } from './bijak-flow'

test.skip(!HTTP_MODE, 'needs BASE_URL or BIJAK_API_BASE (integration stack)')

const expect = baseExpect.configure({ timeout: 15_000 })

const SUBJECT = 'SEJ'
const SUBJECT_NAME = 'Sejarah'
const KERTAS = 1
const CODE = '1249/1'
const DURATION = '60'
const MARKS = '5'
const QUESTIONS = '5'
const SECTION = 'Bahagian Ujian'

const CONTRACT_API = `/api/admin/blueprints/${SUBJECT}/${KERTAS}`

/** Removes the contract of an earlier run or width. Nothing to remove (404) or already retired (409) is fine. */
async function retireContract(page: Page): Promise<void> {
  const res = await page.request.post(`${CONTRACT_API}/retire`, {
    headers: { 'x-csrf-token': await csrfOf(page) },
  })
  expect([200, 404, 409], `POST ${CONTRACT_API}/retire`).toContain(res.status())
}

/** A pupil in a separate browser context opens Jana Kertas on this subject and kertas. */
async function withJanaKertas(
  browser: Browser,
  info: TestInfo,
  run: (page: Page) => Promise<void>,
): Promise<void> {
  const { baseURL, viewport, isMobile, hasTouch, deviceScaleFactor } = info.project.use
  const context = await browser.newContext({
    baseURL,
    viewport: viewport ?? null,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale: 'ms-MY',
  })
  try {
    const page = await context.newPage()
    const pupil = account('student')
    await loginViaUi(page, pupil.user, pupil.pass)
    await page.goto('/spm/bijak?tab=jana')
    await expect(page.getByTestId('tab-jana')).toBeVisible()
    await page.getByTestId('jana-subject').click()
    await page.getByRole('option', { name: SUBJECT_NAME, exact: true }).click()
    await page.getByTestId('jana-kertas').click()
    await page.getByRole('option', { name: `Kertas ${KERTAS}`, exact: true }).click()
    await run(page)
    await expectNoHorizontalScrollHttp(page)
  } finally {
    await context.close()
  }
}

/** One item in the evidence drawer, with the values as printed on the paper. A skema prints no duration or rule. */
async function addEvidence(
  page: Page,
  kind: 'Kertas percubaan' | 'Skema jawapan',
  body: string,
  shownSoFar: number,
): Promise<void> {
  await page.getByTestId('evidence-add').click()
  await page.getByTestId('evidence-kind').getByRole('radio', { name: kind }).click()
  await page.locator('#ev-body').fill(body)
  await page.locator('#ev-code').fill(CODE)
  if (kind === 'Kertas percubaan') await page.locator('#ev-duration').fill(DURATION)
  await page.locator('#ev-total').fill(MARKS)
  await page.locator('#evidence-form').getByRole('button', { name: 'Tambah Bahagian' }).click()
  await page.locator('#ev-s0-label').fill(SECTION)
  await page.locator('#ev-s0-marks').fill(MARKS)
  await page.locator('#ev-s0-q').fill(QUESTIONS)
  await expectNoHorizontalScrollHttp(page)
  await page.locator('button[type=submit][form=evidence-form]').click()
  await expect(page.locator('#evidence-form'), 'the evidence drawer closes after saving').toHaveCount(0)
  await expect(page.getByTestId('evidence-list').getByRole('listitem')).toHaveCount(shownSoFar + 1)
}

test.describe('Kontrak Blueprint, http mode @kontrakhttp', () => {
  test('Baharu, Teruskan, fields on each tab, Simpan, evidence, Sahkan, then Jana Kertas offers it @kontrakhttp', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(240_000)
    const admin = account('adminPusat')
    await loginViaUi(page, admin.user, admin.pass)
    await retireContract(page)

    await withJanaKertas(browser, info, async (pupil) => {
      await expect(pupil.getByTestId('no-contract'), 'no contract before it is created').toBeVisible()
      await expect(pupil.getByTestId('contract')).toHaveCount(0)
    })

    // Baharu, Teruskan.
    await page.goto('/admin/spm/kontrak')
    await expect(page.getByTestId('kontrak-list')).toBeVisible()
    await expect(page.getByTestId('kontrak-table')).toBeVisible()
    await expectNoHorizontalScrollHttp(page)
    await page.getByTestId('kontrak-add').click()
    await page.getByTestId('add-subject').selectOption(SUBJECT)
    await page.getByTestId('add-kertas').selectOption(String(KERTAS))
    await expect(page.getByTestId('add-exists'), 'the contract does not exist yet').toHaveCount(0)
    await page.getByTestId('add-continue').click()
    await expect(page).toHaveURL(new RegExp(`/admin/spm/kontrak/${SUBJECT}/${KERTAS}\\?.*baharu=1`))
    await expect(page.getByTestId('kontrak-editor')).toBeVisible()
    await expectNoHorizontalScrollHttp(page)

    // Tab Umum.
    const code = page.locator('#kontrak-umum-code')
    const duration = page.locator('#kontrak-umum-duration')
    const total = page.locator('#kontrak-umum-jumlah')
    await code.fill(CODE)
    await duration.fill(DURATION)
    await total.fill(MARKS)
    await page.locator('#kontrak-umum-kbat').fill('0')
    await expectNoHorizontalScrollHttp(page)

    // Tab Bahagian: changing the tab must keep what was typed on the first tab, and the reverse below.
    await page.getByTestId('tab-bahagian-1').click()
    await expect(page).toHaveURL(/paparan=bahagian-1/)
    const label = page.locator('#kontrak-s0-label')
    await expect(label).toBeVisible()
    await label.fill(SECTION)
    await page.locator('#kontrak-s0-m').fill(QUESTIONS)
    await page.locator('#kontrak-s0-budget').fill(MARKS)
    await page
      .getByTestId('profile-kind')
      .getByRole('radio', { name: /Mengikut Bahagian/ })
      .click()
    await page.getByTestId('add-unit').click()
    const picker = page.getByTestId('unit-picker')
    await picker.getByRole('checkbox').first().click()
    await page.getByTestId('unit-add').click()
    await expect(picker).toHaveCount(0)
    await page
      .getByTestId('quota-lines')
      .locator('input[id^=kontrak-s0-q-]')
      .first()
      .fill(QUESTIONS)
    await page.locator('#kontrak-s0-kbat-input').fill('0')
    await expectNoHorizontalScrollHttp(page)

    // Back on Umum: every value of the first tab is still there.
    await page.getByTestId('tab-umum').click()
    await expect(page).toHaveURL(/paparan=umum/)
    await expect(code, 'Kod Kertas survives the tab change').toHaveValue(CODE)
    await expect(duration, 'Tempoh survives the tab change').toHaveValue(DURATION)
    await expect(total, 'Jumlah Markah survives the tab change').toHaveValue(MARKS)
    await expect(page.getByTestId('section-row-0'), 'the Bahagian survives the tab change').toContainText(
      SECTION,
    )

    // And the Bahagian tab still holds its own values.
    await page.getByTestId('tab-bahagian-1').click()
    await expect(label, 'the Bahagian label survives the tab change').toHaveValue(SECTION)
    await expect(page.locator('#kontrak-s0-m')).toHaveValue(QUESTIONS)
    await expect(page.locator('#kontrak-s0-budget')).toHaveValue(MARKS)

    // Simpan.
    await expect(page.getByTestId('problem-chip'), 'the live check has no problem left').toHaveText(
      'Tiada masalah',
    )
    const created = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/admin/blueprints' && r.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Simpan', exact: true }).click()
    expect((await created).status(), 'POST /api/admin/blueprints').toBe(201)
    await expect(page).not.toHaveURL(/baharu=1/)
    await expect(page.getByTestId('tab-pengesahan'), 'a saved contract has the Pengesahan tab').toBeVisible()
    await expectNoHorizontalScrollHttp(page)

    // Pengesahan: evidence, then Sahkan.
    await page.getByTestId('tab-pengesahan').click()
    await expect(page.getByTestId('verify-panel')).toBeVisible()
    await expect(page.getByTestId('sahkan-reason'), 'no Sahkan without evidence').toBeVisible()
    await expectNoHorizontalScrollHttp(page)
    // Gate (e), `checkEvidence`: at least two bodies, each with a trial paper AND a skema.
    await addEvidence(page, 'Kertas percubaan', 'SBP', 0)
    await addEvidence(page, 'Skema jawapan', 'SBP', 1)
    await addEvidence(page, 'Kertas percubaan', 'MRSM', 2)
    await addEvidence(page, 'Skema jawapan', 'MRSM', 3)
    await expectNoHorizontalScrollHttp(page)
    await expect(page.getByTestId('gate-rekod'), 'two bodies recorded').toHaveAttribute('data-ok', 'true')
    await expect(page.getByTestId('gate-bukti'), 'the evidence agrees').toHaveAttribute('data-ok', 'true')
    await expect(page.getByTestId('sahkan-reason'), 'only the note is left').toContainText('nota pengesahan')
    await page.getByTestId('verify-note').fill('E2E: bukti dua badan sepadan dengan kontrak.')
    await expect(page.getByTestId('sahkan-reason')).toHaveCount(0)
    await page.getByTestId('sahkan').click()
    await page.getByTestId('sahkan-confirm').click()
    await expect(page.getByText('Kontrak berjaya disahkan.').first()).toBeVisible()
    await expect(page.getByTestId('evidence-locked'), 'a Disahkan contract locks its evidence').toBeVisible()
    await expectNoHorizontalScrollHttp(page)

    // The pupil's Jana Kertas now offers it.
    await withJanaKertas(browser, info, async (pupil) => {
      const contract = pupil.getByTestId('contract')
      await expect(contract, 'Jana Kertas offers the new contract').toBeVisible()
      await expect(contract).toContainText(`${SUBJECT_NAME} Kertas ${KERTAS}`)
      await expect(contract).toContainText(CODE)
      await expect(contract).toContainText(`${DURATION} minit`)
      await expect(contract).toContainText(SECTION)
      await expect(pupil.getByTestId('no-contract')).toHaveCount(0)
      await expect(pupil.getByTestId('generate')).toBeEnabled()
    })

    await retireContract(page)
  })
})
