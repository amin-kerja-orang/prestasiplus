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
 * What http mode does today (code, not a run): the admin Bijak pages call `bijakAdminServer()`
 * (src/modules/m28-bijak-spm/server/client.ts, 21fb311c) in script setup. In http mode it throws
 * "Bijak admin API is not available in http mode (student routes only)." because the admin routes
 * have no HTTP client yet (B3), so /admin/spm/kertas cannot render its list. B4 = the paper builder
 * serving questions in http mode (BE-39 paper builder is in the base, 88059c9f; the client and
 * question bridge are not). The steps that need B3/B4 are `test.fixme` with the expected behaviour
 * fully written: remove the fixme once both land.
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

  test.fixme('Pembina Kertas list renders (table or empty state, summary counts) @bijak', async ({
    page,
  }) => {
    // FIXME(B3): needs the admin HTTP client; today bijakAdminServer() throws in http mode.
    await login(page, ADMIN_USER ?? '', ADMIN_PASS ?? '')
    await page.goto('/admin/command-center')
    await openPaperBuilder(page)
    await expect(page.getByTestId('papers-page')).toBeVisible()
    await expect(page.getByTestId('papers-table')).toBeVisible()
    await expect(page.getByTestId('paper-new')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test.fixme('Terbitkan on an empty draft is refused with the gap list, then cleaned up @bijak', async ({
    page,
  }) => {
    // FIXME(B3/B4): needs B3 (admin HTTP client) and B4 (builder questions in http mode).
    const title = `E2E-http refuse ${Date.now()}`
    await login(page, ADMIN_USER ?? '', ADMIN_PASS ?? '')
    await page.goto('/admin/spm/kertas')
    const id = await createDraft(page, title)
    try {
      await page.getByTestId('paper-publish').click()
      await expect(page.getByTestId('publish-errors')).toContainText(
        'Kertas belum boleh diterbitkan: selesaikan',
      )
      await expect(page.getByTestId('budget-issues')).toBeVisible()
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
    // FIXME(B3/B4): needs B3 (admin HTTP client) and B4 (builder questions in http mode).
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
