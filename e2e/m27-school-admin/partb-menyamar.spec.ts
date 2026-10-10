/**
 * M27-T6 / T7: "Menyamar" on S6 and S7 and the shell impersonation banner (SRS M27 Part B v1.8 §24: E2E-M27-103, 104
 * and the request-level guards of 105 that the UI can reach). Desktop width only (the table above is the same at
 * every width; the responsive pass of the banner belongs to M27-T8).
 *
 * Persona P2 `adminsekolah@demo.test` (school 900001: pupils 3001 to 3008, teacher 5 `guru@demo.test`). The audit rows
 * are read through `window.__mock.impersonationAudit()`. The guards of #20 and #21 (404, 403, 409, no switch) are
 * covered request-level by `impersonate-endpoints.test.ts`; the nested 409 cannot be reached from the UI.
 */

import { createMockHandle } from '../fixtures/mock-handle'
import { expect, test } from '../fixtures/test'
import { acceptNextDialog, dismissNextDialog, viewportWidth } from '../support'

const MODULE = { tag: ['@m27'] }
const P2 = 'adminsekolah@demo.test'
const BTN = '[data-testid="user-impersonate"]'
const BANNER_TEXT = 'Mod menyamar — anda melihat sebagai'

test.use({ mockInit: { latency: 0 } })
test.skip(({ page }) => viewportWidth(page) !== 1280, 'desktop width only')

interface AuditRow {
  actorId: number
  targetId: number
  action: string
}

const rowOf = (page: import('@playwright/test').Page, id: number) =>
  page.locator(`[data-testid="user-row"][data-user-id="${id}"]`)

async function openList(
  page: import('@playwright/test').Page,
  gotoApp: (p: string) => Promise<void>,
  path: string,
): Promise<void> {
  await gotoApp(path)
  await expect(page.getByTestId('user-found')).toContainText('pengguna dijumpai', {
    timeout: 60_000,
  })
}

test.describe('Menyamar', MODULE, () => {
  test('E2E-M27-103 button on every row, disabled with its title for an inactive account, cancel does nothing', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    await openList(page, gotoApp, '/admin-sekolah/pelajar')
    const count = await page.getByTestId('user-row').count()
    await expect(page.locator(BTN)).toHaveCount(count)
    const first = rowOf(page, 3001).locator(BTN)
    await expect(first).toBeEnabled()
    await expect(first).toHaveAttribute('title', 'Log masuk sebagai pengguna ini')

    const name = (await rowOf(page, 3001).getByTestId('user-name').innerText()).trim()
    const cancelled = dismissNextDialog(page, {
      type: 'confirm',
      message: `Log masuk sebagai ${name}? Anda boleh kembali bila-bila masa.`,
    })
    await first.click()
    await cancelled
    await expect(page).toHaveURL(/\/admin-sekolah\/pelajar$/)
    await expect(page.getByTestId('impersonation-banner')).toHaveCount(0)
    expect(await createMockHandle(page).hook<AuditRow[]>('impersonationAudit')).toEqual([])

    // An inactive account (arranged through the S7 "Aktif?" toggle, M02 #8): present but disabled.
    await openList(page, gotoApp, '/admin-sekolah/guru')
    const toggle = rowOf(page, 5).getByTestId('user-toggle')
    const off = acceptNextDialog(page, { type: 'confirm' })
    await toggle.click()
    await off
    await expect(toggle).toContainText('Tidak')
    const teacherBtn = rowOf(page, 5).locator(BTN)
    await expect(teacherBtn).toBeDisabled()
    await expect(teacherBtn).toHaveAttribute('title', 'Akaun ini tidak aktif')
    const on = acceptNextDialog(page, { type: 'confirm' })
    await toggle.click()
    await on
    await expect(toggle).toContainText('Aktif')
    await expect(rowOf(page, 5).locator(BTN)).toBeEnabled()
  })

  test('E2E-M27-104 pupil: session switch, landing, flash, banner on two pages, "Kembali ke Admin" to S6, audit', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    await openList(page, gotoApp, '/admin-sekolah/pelajar')
    const name = (await rowOf(page, 3001).getByTestId('user-name').innerText()).trim()
    const accepted = acceptNextDialog(page, { type: 'confirm' })
    await rowOf(page, 3001).locator(BTN).click()
    await accepted

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByText(`Anda kini menyamar sebagai ${name}.`)).toBeVisible()
    const banner = page.getByTestId('impersonation-banner')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText(`${BANNER_TEXT} ${name}`)
    await expect(banner.getByRole('button', { name: 'Kembali ke Admin' })).toBeVisible()

    // second page: the banner follows the session, not the page
    await gotoApp('/profile')
    await expect(page.getByTestId('impersonation-banner')).toContainText(`${BANNER_TEXT} ${name}`)

    await page.getByTestId('impersonation-leave').click()
    await expect(page).toHaveURL(/\/admin-sekolah\/pelajar$/)
    await expect(page.getByText('Anda telah kembali ke akaun pentadbir.')).toBeVisible()
    await expect(page.getByTestId('impersonation-banner')).toHaveCount(0)
    await expect(page.getByTestId('user-found')).toContainText('pengguna dijumpai', {
      timeout: 60_000,
    })

    const audit = await createMockHandle(page).hook<AuditRow[]>('impersonationAudit')
    expect(audit.map((r) => [r.action, r.targetId])).toEqual([
      ['impersonate.start', 3001],
      ['impersonate.leave', 3001],
    ])
  })

  test('E2E-M27-104 teacher: lands on /guru and "Kembali ke Admin" opens S7', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    await openList(page, gotoApp, '/admin-sekolah/guru')
    const accepted = acceptNextDialog(page, { type: 'confirm' })
    await rowOf(page, 5).locator(BTN).click()
    await accepted
    await expect(page).toHaveURL(/\/guru$/)
    await expect(page.getByTestId('impersonation-banner')).toContainText(BANNER_TEXT)
    await page.getByTestId('impersonation-leave').click()
    await expect(page).toHaveURL(/\/admin-sekolah\/guru$/)
    await expect(page.getByTestId('impersonation-banner')).toHaveCount(0)
    const audit = await createMockHandle(page).hook<AuditRow[]>('impersonationAudit')
    expect(audit.map((r) => [r.action, r.targetId])).toEqual([
      ['impersonate.start', 5],
      ['impersonate.leave', 5],
    ])
  })
})
