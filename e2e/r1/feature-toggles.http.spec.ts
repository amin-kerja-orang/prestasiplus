/**
 * S0-T10 Kawalan Ciri (R1-ADM-N-06, AC-ADM-N06.1). The Admin Pusat switches `permainan` OFF on
 * `/admin/feature-toggles` and the pupil (separate session) loses the Permainan menu item and gets the
 * standard 404 page on `/permainan`; switched ON again, both are back. The pupil reads the flags at login,
 * so the pupil signs in after each switch. Checks no horizontal page scroll of the toggle page.
 *
 * Runs only under playwright.http.config.ts (real stack, `permainan` seeded ON by migration 0250).
 */
import type { Page } from '@playwright/test'

import { account, csrfOf, expectNoHScroll, newPeerContext } from '../api/helpers'
import { expect, gotoApi, loginViaUi, test } from '../fixtures/api'

const NOT_FOUND_TITLE = 'Halaman Tidak Dijumpai | PRESTASIPLUS'
const ROW = '[data-testid="ft-row-permainan"]'

async function put(admin: Page, enabled: boolean): Promise<void> {
  const res = await admin.request.put('/api/admin/feature-toggles/permainan', {
    data: { enabled },
    headers: { 'x-csrf-token': await csrfOf(admin) },
  })
  expect(res.status(), 'PUT permainan').toBe(200)
}

test.describe('Kawalan Ciri (S0-T10)', () => {
  test('@api Admin Pusat switches Permainan OFF and ON; the pupil menu and URL follow', async ({ page, browser }, info) => {
    test.setTimeout(180_000)
    const adminAcc = account('adminPusat')
    await loginViaUi(page, adminAcc.user, adminAcc.pass)
    await gotoApi(page, '/admin/feature-toggles')
    await expect(page.locator(ROW)).toBeVisible()
    // Runs in every http project (375 / 768 / 1280): no horizontal page scroll on the page.
    await expectNoHScroll(page)

    const pupilSees = async (): Promise<{ menu: boolean; title: string; notFoundShown: boolean }> => {
      const ctx = await newPeerContext(browser, info)
      try {
        const pupil = await ctx.newPage()
        const acc = account('student')
        await loginViaUi(pupil, acc.user, acc.pass)
        await gotoApi(pupil, '/dashboard')
        const menu = (await pupil.locator('a[href="/permainan"]').count()) > 0
        await gotoApi(pupil, '/permainan')
        await expect.poll(() => pupil.title()).not.toBe('')
        // The FE guard answers the standard 404 page in place (the API prefix 404s too).
        const notFoundShown = await pupil
          .getByRole('heading', { name: 'Halaman Tidak Dijumpai' })
          .first()
          .isVisible()
        return { menu, title: await pupil.title(), notFoundShown }
      } finally {
        await ctx.close()
      }
    }

    try {
      // Start from ON, whatever an earlier run left behind.
      await put(page, true)
      await gotoApi(page, '/admin/feature-toggles')
      expect((await pupilSees()).menu, 'ON: menu item').toBe(true)

      // OFF through the page: the confirm asks first.
      await page.locator(`${ROW} button[role="switch"]`).click()
      const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'))
      await expect(dialog).toContainText('Matikan "Zona Permainan"?')
      await dialog.getByRole('button', { name: 'Ya, Matikan' }).click()
      await expect(page.getByText('Ciri "Zona Permainan" telah DINYAHAKTIFKAN.')).toBeVisible()
      const off = await pupilSees()
      expect(off.menu, 'OFF: menu item').toBe(false)
      expect(off.title, 'OFF: 404 page title').toBe(NOT_FOUND_TITLE)
      expect(off.notFoundShown, 'OFF: 404 page heading').toBe(true)

      // ON again.
      await page.locator(`${ROW} button[role="switch"]`).click()
      await expect(page.getByText('Ciri "Zona Permainan" telah DIAKTIFKAN.')).toBeVisible()
      const on = await pupilSees()
      expect(on.menu, 'ON again: menu item').toBe(true)
      expect(on.title, 'ON again: not the 404 page').not.toBe(NOT_FOUND_TITLE)
      expect(on.notFoundShown, 'ON again: no 404 heading').toBe(false)
    } finally {
      await put(page, true)
    }
  })
})
