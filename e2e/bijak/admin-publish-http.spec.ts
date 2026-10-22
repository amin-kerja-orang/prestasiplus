/**
 * go/no-go evidence for (c) once B3 + B4 land: Admin Pusat publishes a Bijak SPM paper over HTTP
 * (the http twin of admin-publish.spec.ts, no `loginAs`/`__mock`, UI login with the real form).
 *
 * WRITES REAL DATA: the full flow creates a draft paper, publishes it, and cleans up after itself
 * (Tarik balik, then delete the draft). Titles carry a timestamp so a leftover is easy to find.
 * Run it only against an environment you may write to.
 *
 * Runs only with BIJAK_API_BASE (origin serving the VITE_API_MODE=http SPA with /api behind it) and
 * credentials from the environment, never from the repo:
 *   BIJAK_ADMIN_PUSAT_USER / BIJAK_ADMIN_PUSAT_PASS   (admin@demo.test)
 *   BIJAK_STUDENT_USER / BIJAK_STUDENT_PASS           (only for the "student sees it" step)
 *
 * What http mode does (code, not a run): since B3 (003cff0b) `bijakAdminServer()` returns the admin
 * http client (server/http-admin.ts, wired to BE-39: papers list/get/create/save/publish/unpublish/
 * delete, blueprints). The intake, review-queue and bank methods were wired afterwards (AZ-20, see
 * intake-review-http.spec.ts); only the bank "Sunting" versions and "Minta Pembetulan" have no route.
 * The demo path is Pembina Kertas. B4 (155cf001 on v2-backend: composite builder source) gives the
 * builder the PoC questions when the API runs with BIJAK_POC_QUESTIONS=true, so create + publish
 * works. Subject/kertas used: Matematik Kertas 1 (PoC blueprint "Objektif", take 10, 10 marks, pool
 * MAT1-A with 45 PoC questions: apps/api/src/modules/bijak/papers/poc/poc-bank.ts). Without B4 a
 * publish is refused ("<Bahagian>: Kurang N soalan (perlu X, ada Y)", BE-39 contract,
 * bijak/builder/paths.ts).
 */
import type { Browser, Page, TestInfo } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { isDesktopShell } from '../support'
import { expectNoHorizontalScrollHttp, HTTP_MODE } from './bijak-flow'
import { demoCreds, NEEDS_PASSWORD } from './http-creds'

const { user: ADMIN_USER, pass: ADMIN_PASS } = demoCreds('adminPusat')
const { user: STUDENT_USER, pass: STUDENT_PASS } = demoCreds('student')

test.skip(!HTTP_MODE, 'needs BIJAK_API_BASE or BASE_URL (integration stack)')
test.skip(!ADMIN_USER || !ADMIN_PASS, NEEDS_PASSWORD)

async function login(page: Page, user: string, pass: string): Promise<void> {
  await page.goto('/login')
  await page.getByTestId('login-email').fill(user)
  await page.getByTestId('login-password').fill(pass)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))
}

/** Pentadbiran menu (drawer below 1024 px) -> Pembina Kertas. */
async function openPaperBuilder(page: Page): Promise<void> {
  if (!isDesktopShell(page)) await page.getByTestId('pentadbiran-menu-button').click()
  const nav = page.locator('[data-testid=pentadbiran-nav]:visible')
  await nav.getByRole('link', { name: 'Pembina Kertas' }).click()
  await expect(page).toHaveURL(/\/admin\/spm\/kertas$/)
}

/** Kertas Baharu -> Cipta Kertas (Matematik Kertas 1, titled for easy cleanup). */
async function createDraft(page: Page, title: string): Promise<string> {
  await page.getByTestId('paper-new').click()
  await expect(page.getByTestId('paper-new-page')).toBeVisible()
  await expectNoHorizontalScrollHttp(page)
  // The subject option is matched by name (value is the subject code), Kertas by its label.
  const subjectValue = await page
    .getByTestId('new-subject')
    .locator('option', { hasText: /^Matematik$/ })
    .first()
    .getAttribute('value')
  expect(subjectValue, 'a "Matematik" subject option').toBeTruthy()
  await page.getByTestId('new-subject').selectOption(subjectValue ?? '')
  await page.getByTestId('new-kertas').selectOption({ label: 'Kertas 1' })
  await page.getByTestId('new-title').fill(title)
  await expect(page.getByTestId('blueprint-summary')).toBeVisible()
  await page.getByRole('button', { name: 'Cipta Kertas' }).click()
  await expect(page.getByTestId('paper-editor-page')).toBeVisible()
  await expect(page.getByTestId('budget-check')).toContainText('Belum sepadan dengan blueprint')
  return new URL(page.url()).pathname.split('/').pop() ?? ''
}

/** Adds the first picker candidate to section 0 until the blueprint matches. */
async function assembleUntilMatching(page: Page): Promise<void> {
  const check = page.getByTestId('budget-check')
  for (let i = 0; i < 40; i++) {
    if ((await check.innerText()).includes('Sepadan dengan blueprint')) return
    await page.getByTestId('add-0').click()
    await expect(page.getByTestId('picker')).toBeVisible()
    await page.locator('[data-testid^=pick-add-]').first().click()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('picker')).toBeHidden()
  }
  await expect(check).toContainText('Sepadan dengan blueprint')
}

/** Deletes a draft from the list (card button below 640 px, table row button above). */
async function deleteDraft(page: Page, id: string, title: string): Promise<void> {
  await page.goto('/admin/spm/kertas')
  await expect(page.getByTestId('papers-page')).toBeVisible()
  const byId = page.getByTestId(`paper-delete-${id}`)
  const inRow = page
    .getByTestId('papers-table')
    .locator('tr', { hasText: title })
    .getByRole('button', { name: 'Padam kertas' })
  const button = (await byId.count()) ? byId : inRow
  if (await button.count()) await button.first().click()
}

/** A student in a SEPARATE browser context sees the paper title in the Bijak list. */
async function studentSees(browser: Browser, info: TestInfo, title: string): Promise<void> {
  const context = await browser.newContext({
    baseURL: info.project.use.baseURL,
    viewport: info.project.use.viewport ?? null,
    locale: 'ms-MY',
  })
  try {
    const page = await context.newPage()
    await login(page, STUDENT_USER ?? '', STUDENT_PASS ?? '')
    await page.goto('/spm/bijak')
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    await expect(page.getByText(title).first()).toBeVisible()
    await expectNoHorizontalScrollHttp(page)
  } finally {
    await context.close()
  }
}

test.describe('Bijak SPM Admin Pusat terbit kertas, http mode @bijak @api', () => {
  // Works today: the real login, the Pentadbiran shell and the menu entry (no Bijak admin API call).
  test('admin logs in and the Pentadbiran menu offers Pembina Kertas at /admin/spm/kertas @bijak', async ({
    page,
  }) => {
    await login(page, ADMIN_USER ?? '', ADMIN_PASS ?? '')
    await page.goto('/admin/command-center')
    await expect(page.getByTestId('pentadbiran-header')).toBeVisible()
    await expectNoHorizontalScrollHttp(page)
    if (!isDesktopShell(page)) await page.getByTestId('pentadbiran-menu-button').click()
    const link = page
      .locator('[data-testid=pentadbiran-nav]:visible')
      .getByRole('link', { name: 'Pembina Kertas' })
    await expect(link).toHaveAttribute('href', '/admin/spm/kertas')
  })

  // Real (B3): GET /api/admin/papers behind the list (PaperListPage.vue: papers-page, papers-table, paper-new).
  test('Pembina Kertas list renders through the admin http client @bijak', async ({ page }) => {
    await login(page, ADMIN_USER ?? '', ADMIN_PASS ?? '')
    await page.goto('/admin/command-center')
    await openPaperBuilder(page)
    await expect(page.getByTestId('papers-page')).toBeVisible()
    await expect(page.getByTestId('papers-table')).toBeVisible()
    await expect(page.getByTestId('paper-new')).toBeVisible()
    // The generic load error ("Tidak dapat memuatkan senarai kertas.") must not be showing.
    await expect(page.getByText('Tidak dapat memuatkan senarai kertas.')).toHaveCount(0)
    await expectNoHorizontalScrollHttp(page)
  })

  // Real, read-only: opens the first existing paper (no edit, no publish, no write).
  test('opening an existing paper renders the editor read-only path @bijak', async ({ page }) => {
    await login(page, ADMIN_USER ?? '', ADMIN_PASS ?? '')
    await page.goto('/admin/spm/kertas')
    await expect(page.getByTestId('papers-page')).toBeVisible()
    const open = page.locator('a[href^="/admin/spm/kertas/"]:not([href$="/baharu"])').first()
    test.skip((await open.count()) === 0, 'no existing paper in this environment')
    await open.click()
    await expect(page.getByTestId('paper-editor-page')).toBeVisible()
    await expect(page.getByTestId('budget-check')).toBeVisible()
    await expect(page.getByTestId('paper-title')).toBeVisible()
    await expect(page.getByTestId('section-0')).toBeVisible()
    await expect(page.getByText('Tidak dapat memuatkan kertas.')).toHaveCount(0)
    await expectNoHorizontalScrollHttp(page)
  })

  // Wired since AZ-20 (BE-37 intake, BE-38 items, BE-09 questions): the bank, the review queue and
  // the intake list load for real. The full flow is intake-review-http.spec.ts. An unknown id shows
  // the page's own not-found / load-error state (never the "belum tersedia" unavailable state).
  test('Bank Soalan, Baris Gilir Semakan and Intake load; unknown ids show their error state @bijak', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await login(page, ADMIN_USER ?? '', ADMIN_PASS ?? '')
    const loaded = [
      ['/admin/spm/soalan', 'bank-page'],
      ['/admin/spm/semakan', 'review-queue-page'],
      ['/admin/spm/soalan/ekstrak', 'intake-list-page'],
    ] as const
    for (const [route, testId] of loaded) {
      await page.goto(route)
      await expect(page.getByTestId(testId), `${route} mounts`).toBeVisible()
      await expect(page.getByTestId('unavailable-state')).toHaveCount(0)
      await expect(page.getByText(/^Tidak dapat memuatkan/)).toHaveCount(0)
      await expectNoHorizontalScrollHttp(page)
    }
    const missing = [
      ['/admin/spm/semakan/tiada-item', 'review-item-page', 'Tidak dapat memuatkan item semakan.'],
      [
        '/admin/spm/soalan/ekstrak/tiada-kumpulan',
        'intake-review-page',
        'Kumpulan ekstrak tidak ditemui.',
      ],
    ] as const
    for (const [route, testId, copy] of missing) {
      await page.goto(route)
      await expect(page.getByTestId(testId), `${route} mounts`).toBeVisible()
      await expect(page.getByText(copy).first()).toBeVisible()
      await expect(page.getByTestId('unavailable-state')).toHaveCount(0)
      await expectNoHorizontalScrollHttp(page)
    }
    expect(errors).toEqual([])
  })

  test('Terbitkan on an empty draft is refused with the gap list, then cleaned up @bijak', async ({
    page,
  }) => {
    const title = `E2E-http refuse ${Date.now()}`
    await login(page, ADMIN_USER ?? '', ADMIN_PASS ?? '')
    await page.goto('/admin/spm/kertas')
    const id = await createDraft(page, title)
    try {
      await page.getByTestId('paper-publish').click()
      await expect(page.getByTestId('publish-errors')).toContainText(
        'Kertas belum boleh diterbitkan: selesaikan',
      )
      await expect(page.getByTestId('budget-issues')).toContainText('Kurang') // e.g. "Objektif: Kurang 10 soalan (perlu 10, ada 0)" (Needs confirmation: exact numbers)
      await expect(page.getByTestId('paper-unpublish')).toHaveCount(0)
      await expectNoHorizontalScrollHttp(page)
    } finally {
      // Cleanup: delete the draft from the list.
      await deleteDraft(page, id, title)
    }
  })

  test('draft, assemble to Sepadan, Simpan, Terbitkan, student sees it, Tarik balik, delete @bijak', async ({
    page,
    browser,
  }, testInfo) => {
    test.skip(!STUDENT_USER || !STUDENT_PASS, NEEDS_PASSWORD)
    const title = `E2E-http publish ${Date.now()}`
    await login(page, ADMIN_USER ?? '', ADMIN_PASS ?? '')
    await page.goto('/admin/command-center')
    await openPaperBuilder(page)
    await expect(page.getByTestId('papers-page')).toBeVisible()
    await expectNoHorizontalScrollHttp(page)
    const id = await createDraft(page, title)
    try {
      await assembleUntilMatching(page)
      await page.getByTestId('paper-save').click()
      await expect(page.getByTestId('paper-save')).toBeDisabled()

      await page.getByTestId('paper-publish').click()
      await expect(page.getByTestId('paper-unpublish')).toBeVisible()
      await expect(page.getByTestId('paper-view-student')).toBeVisible()
      await expect(page.getByTestId('paper-publish')).toHaveCount(0)
      await expect(page.getByTestId('paper-title')).toBeDisabled()
      await expectNoHorizontalScrollHttp(page)

      await studentSees(browser, testInfo, title)
    } finally {
      // Cleanup so staging is not polluted: Tarik balik, then delete the draft.
      if (await page.getByTestId('paper-unpublish').isVisible()) {
        await page.getByTestId('paper-unpublish').click()
        await expect(page.getByTestId('paper-publish')).toBeVisible()
      }
      await deleteDraft(page, id, title)
    }
  })
})
