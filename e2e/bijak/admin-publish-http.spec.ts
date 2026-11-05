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
 * The demo path is Set Builder and Semak Kertas (S3-T02: the old Pembina Kertas list redirects). Since R1-B07 (T36) the builder offers the QUESTION BANK only: the PoC fixture and the composite
 * builder source are gone from the API (`BIJAK_POC_QUESTIONS` is a deprecated no-op), so create + publish works only on a database with
 * enough approved bank questions for the blueprint (the demo seed's bank questions, T26 e2e seed). Subject/kertas used: Matematik
 * Kertas 1 (blueprint "Objektif"). A publish that lacks questions is refused ("<Bahagian>: Kurang N soalan (perlu X, ada Y)", BE-39
 * contract, bijak/builder/paths.ts).
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

/** Pentadbiran menu (drawer below 1024 px) -> the old Pembina Kertas entry -> the Set Builder it redirects to (FR-ADM-Q15.6). */
async function openPaperBuilder(page: Page): Promise<void> {
  if (!isDesktopShell(page)) await page.getByTestId('pentadbiran-menu-button').click()
  const nav = page.locator('[data-testid=pentadbiran-nav]:visible')
  await nav.getByRole('link', { name: 'Pembina Kertas' }).click()
  await expect(page).toHaveURL(/\/admin\/studio\/sets$/)
}

/** Mula kosong (Matematik Kertas 1, titled for easy cleanup). */
async function createDraft(page: Page, title: string): Promise<string> {
  await expect(page.getByTestId('set-builder-page')).toBeVisible()
  await expectNoHorizontalScrollHttp(page)
  await page.getByTestId('blank-subject').selectOption({ label: 'Matematik' })
  await page.getByTestId('blank-kertas').selectOption({ label: 'Kertas 1' })
  await page.getByTestId('blank-title').fill(title)
  await page.getByTestId('blank-submit').click()
  await expect(page.getByTestId('set-builder-editor')).toBeVisible()
  await expect(page.getByTestId('budget-check')).toContainText('Belum sepadan dengan blueprint')
  return new URL(page.url()).pathname.split('/').at(-2) ?? ''
}

/** Adds the first free bank unit to section 0 until the blueprint matches (the bank pages 50 units at a time). */
async function assembleUntilMatching(page: Page): Promise<void> {
  const check = page.getByTestId('budget-check')
  if ((page.viewportSize()?.width ?? 0) < 1024) await page.getByTestId('builder-pane-bank').click()
  for (let i = 0; i < 40; i++) {
    if ((await check.innerText()).includes('Sepadan dengan blueprint')) return
    const add = page.locator('li[data-testid^=pool-]:not([data-testid^=pool-group-])').locator('[data-testid^=pool-add-]:not([disabled])')
    const more = page.getByTestId('bank-more')
    await expect(add.or(more).first()).toBeVisible()
    while ((await add.count()) === 0 && (await more.isVisible())) {
      const paged = page.waitForResponse((r) => /\/pool\?/.test(r.url()))
      await more.click()
      await paged
    }
    const placed = page.waitForResponse((r) => /\/placements$/.test(r.url()))
    await add.first().click()
    await placed
  }
  await expect(check).toContainText('Sepadan dengan blueprint')
}

/** Deletes a draft from the one list, past its confirm. */
async function deleteDraft(page: Page, id: string): Promise<void> {
  await page.goto('/admin/studio/sets')
  await expect(page.getByTestId('set-builder-page')).toBeVisible()
  const button = page.getByTestId(`set-delete-${id}`)
  if (await button.count()) {
    await button.click()
    await page.locator('[data-ds=confirm-ok]').click()
    await expect(page.getByTestId(`set-${id}`)).toHaveCount(0)
  }
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

  // Real (B3): GET /api/admin/papers behind the one list (SetBuilderLandingPage.vue); the old menu entry redirects to it.
  test('the Set Builder list renders through the admin http client @bijak', async ({ page }) => {
    await login(page, ADMIN_USER ?? '', ADMIN_PASS ?? '')
    await page.goto('/admin/command-center')
    await openPaperBuilder(page)
    await expect(page.getByTestId('set-builder-page')).toBeVisible()
    await expect(page.getByTestId('blank-submit')).toBeVisible()
    // The generic load error must not be showing.
    await expect(page.getByText('Tidak dapat memuatkan senarai set.')).toHaveCount(0)
    await expectNoHorizontalScrollHttp(page)
  })

  // Real, read-only: opens the first existing paper (no edit, no publish, no write).
  test('opening an existing paper renders the editor read-only path @bijak', async ({ page }) => {
    await login(page, ADMIN_USER ?? '', ADMIN_PASS ?? '')
    await page.goto('/admin/studio/sets')
    await expect(page.getByTestId('set-builder-page')).toBeVisible()
    const open = page.locator('a[href^="/admin/spm/kertas/"]').first()
    test.skip((await open.count()) === 0, 'no existing paper in this environment')
    await open.click()
    await expect(page.getByTestId('paper-editor-page')).toBeVisible()
    await expect(page.getByTestId('budget-check')).toBeVisible()
    await expect(page.getByTestId('meta-title')).toBeVisible()
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
    await page.goto('/admin/studio/sets')
    const id = await createDraft(page, title)
    try {
      await page.getByTestId('builder-semak').click()
      await expect(page.getByTestId('paper-editor-page')).toBeVisible()
      // R1-F09: Terbitkan is disabled while the check fails; the reason is shown as text.
      await expect(page.getByTestId('paper-publish')).toBeDisabled()
      await expect(page.getByTestId('publish-errors')).toContainText(
        'Kertas belum boleh diterbitkan: selesaikan',
      )
      await expect(page.getByTestId('budget-issues')).toContainText('Kurang') // e.g. "Objektif: Kurang 10 soalan (perlu 10, ada 0)" (Needs confirmation: exact numbers)
      await expect(page.getByTestId('paper-unpublish')).toHaveCount(0)
      await expectNoHorizontalScrollHttp(page)
    } finally {
      // Cleanup: delete the draft from the list.
      await deleteDraft(page, id)
    }
  })

  test('draft, assemble to Sepadan, Simpan, Terbitkan, student sees it, Tarik balik, delete @bijak', async ({
    page,
    browser,
  }, testInfo) => {
    test.skip(!STUDENT_USER || !STUDENT_PASS, NEEDS_PASSWORD)
    // The full 7-step flow (draft, Sepadan, Simpan, Terbitkan, student, Tarik balik, delete) adds the blueprint's 40 questions one
    // by one (about 0.7 s each): 52 s measured locally under the CI config, so the 30 s default cannot hold it. This test only.
    test.setTimeout(120_000)
    const title = `E2E-http publish ${Date.now()}`
    await login(page, ADMIN_USER ?? '', ADMIN_PASS ?? '')
    await page.goto('/admin/command-center')
    await openPaperBuilder(page)
    const id = await createDraft(page, title)
    try {
      await assembleUntilMatching(page)
      await page.getByTestId('builder-semak').click()
      await expect(page.getByTestId('paper-editor-page')).toBeVisible()

      // REQ-B-054: the demo seed Disahkan only 3472/2, so the Kontrak of Matematik Kertas 1 (1449/1) is still Spec: the plain
      // Terbitkan is disabled with the server's reason and the audited override publishes (the same path as admin-publish.spec.ts).
      await expect(page.getByTestId('paper-publish')).toBeDisabled()
      await expect(page.getByTestId('publish-errors')).toContainText('belum Disahkan')
      await page.getByTestId('override-tick').click()
      await page.getByTestId('override-reason').fill('Kontrak masih Spec, kertas ujian dalaman')
      await page.getByTestId('override-publish').click()
      await page.locator('[data-ds=confirm-ok]').click()
      await expect(page.getByTestId('paper-unpublish')).toBeVisible()
      await expect(page.getByTestId('paper-view-student')).toBeVisible()
      await expect(page.getByTestId('paper-publish')).toHaveCount(0)
      await expect(page.getByTestId('meta-title')).toBeDisabled()
      await expectNoHorizontalScrollHttp(page)

      await studentSees(browser, testInfo, title)
    } finally {
      // Cleanup so staging is not polluted: Tarik balik, then delete the draft.
      if (await page.getByTestId('paper-unpublish').isVisible()) {
        await page.getByTestId('paper-unpublish').click()
        await expect(page.locator('[data-ds=confirm-message]').filter({ hasText: 'Tarik balik kertas ini ke draf?' })).toBeVisible()
        await page.locator('[data-ds=confirm-ok]').click()
        await expect(page.getByTestId('paper-publish')).toBeVisible()
      }
      await deleteDraft(page, id)
    }
  })
})
