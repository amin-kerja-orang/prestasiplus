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
 * delete, blueprints). Intake, review-queue and bank methods have no backend route and REJECT with
 * `BijakError('unavailable', 'Fungsi ini belum tersedia.')`; their pages show the generic load error.
 * The demo path is Pembina Kertas. B4 = the builder needs PoC questions; without B4 a publish is
 * refused ("<Bahagian>: Kurang N soalan (perlu X, ada Y)", BE-39 contract, bijak/builder/paths.ts),
 * so create + publish stays `test.fixme` (remove the fixme once B4 lands).
 */
import type { Browser, Page, TestInfo } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { expectNoHorizontalScroll, isDesktopShell } from '../support'
import { HTTP_MODE } from './bijak-flow'

const ADMIN_USER = process.env.BIJAK_ADMIN_PUSAT_USER
const ADMIN_PASS = process.env.BIJAK_ADMIN_PUSAT_PASS
const STUDENT_USER = process.env.BIJAK_STUDENT_USER
const STUDENT_PASS = process.env.BIJAK_STUDENT_PASS

test.skip(!HTTP_MODE, 'needs BIJAK_API_BASE (integration stack)')
test.skip(!ADMIN_USER || !ADMIN_PASS, 'needs BIJAK_ADMIN_PUSAT_USER and BIJAK_ADMIN_PUSAT_PASS')

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
  await expectNoHorizontalScroll(page)
  await page.getByTestId('new-subject').selectOption({ label: 'Matematik' })
  await page.getByTestId('new-kertas').selectOption({ index: 1 })
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
    await expectNoHorizontalScroll(page)
  } finally {
    await context.close()
  }
}

test.describe('Bijak SPM Admin Pusat terbit kertas, http mode @bijak', () => {
  // Works today: the real login, the Pentadbiran shell and the menu entry (no Bijak admin API call).
  test('admin logs in and the Pentadbiran menu offers Pembina Kertas at /admin/spm/kertas @bijak', async ({
    page,
  }) => {
    await login(page, ADMIN_USER ?? '', ADMIN_PASS ?? '')
    await page.goto('/admin/command-center')
    await expect(page.getByTestId('pentadbiran-header')).toBeVisible()
    await expectNoHorizontalScroll(page)
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
    await expectNoHorizontalScroll(page)
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
    await expectNoHorizontalScroll(page)
  })

  // Out of scope for the demo (no backend route yet): they reject with BijakError('unavailable',
  // 'Fungsi ini belum tersedia.') and each page shows its generic load error, no crash.
  test(
    'Bank Soalan, Baris Gilir Semakan and Intake show a graceful unavailable state @bijak',
    {
      tag: '@provisional',
      annotation: {
        type: 'provisional',
        description:
          'known limitation, not a go/no-go blocker; post-demo follow-up (no Bijak backend route for bank, review queue, intake)',
      },
    },
    async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await login(page, ADMIN_USER ?? '', ADMIN_PASS ?? '')
      const screens = [
        // [route, page test id (not for intake), message]
        ['/admin/spm/soalan', 'bank-page', 'Tidak dapat memuatkan bank soalan.'],
        ['/admin/spm/semakan', 'review-queue-page', 'Tidak dapat memuatkan baris gilir.'],
        ['/admin/spm/soalan/ekstrak', '', 'Tidak dapat memuatkan senarai ekstrak.'],
      ] as const
      for (const [route, testId, message] of screens) {
        await page.goto(route)
        if (testId) await expect(page.getByTestId(testId)).toBeVisible()
        await expect(page.getByText(message).first()).toBeVisible()
        await expectNoHorizontalScroll(page)
      }
      expect(errors).toEqual([])
    },
  )

  test.fixme('Terbitkan on an empty draft is refused with the gap list, then cleaned up @bijak', async ({
    page,
  }) => {
    // FIXME(B4): builder needs PoC questions; without B4 publish is refused "Kurang 10 soalan".
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
      await expectNoHorizontalScroll(page)
    } finally {
      // Cleanup: delete the draft from the list.
      await page.goto('/admin/spm/kertas')
      const row = page.getByTestId('papers-table').locator('tr', { hasText: title })
      if (await row.count()) await row.getByRole('button', { name: 'Padam kertas' }).click()
      expect(id).not.toBe('')
    }
  })

  test.fixme('draft, assemble to Sepadan, Simpan, Terbitkan, student sees it, Tarik balik, delete @bijak', async ({
    page,
    browser,
  }, testInfo) => {
    test.skip(!STUDENT_USER || !STUDENT_PASS, 'needs BIJAK_STUDENT_USER and BIJAK_STUDENT_PASS')
    // FIXME(B4): builder needs PoC questions; without B4 publish is refused "Kurang 10 soalan".
    const title = `E2E-http publish ${Date.now()}`
    await login(page, ADMIN_USER ?? '', ADMIN_PASS ?? '')
    await page.goto('/admin/command-center')
    await openPaperBuilder(page)
    await expect(page.getByTestId('papers-page')).toBeVisible()
    await expectNoHorizontalScroll(page)
    await createDraft(page, title)
    try {
      await assembleUntilMatching(page)
      await page.getByTestId('paper-save').click()
      await expect(page.getByTestId('paper-save')).toBeDisabled()

      await page.getByTestId('paper-publish').click()
      await expect(page.getByTestId('paper-unpublish')).toBeVisible()
      await expect(page.getByTestId('paper-view-student')).toBeVisible()
      await expect(page.getByTestId('paper-publish')).toHaveCount(0)
      await expect(page.getByTestId('paper-title')).toBeDisabled()
      await expectNoHorizontalScroll(page)

      await studentSees(browser, testInfo, title)
    } finally {
      // Cleanup so staging is not polluted: Tarik balik, then delete the draft.
      if (await page.getByTestId('paper-unpublish').isVisible()) {
        await page.getByTestId('paper-unpublish').click()
        await expect(page.getByTestId('paper-publish')).toBeVisible()
      }
      await page.goto('/admin/spm/kertas')
      const row = page.getByTestId('papers-table').locator('tr', { hasText: title })
      if (await row.count()) await row.getByRole('button', { name: 'Padam kertas' }).click()
    }
  })
})
