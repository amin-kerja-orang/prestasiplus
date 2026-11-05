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

async function put(admin: Page, enabled: boolean, key = 'permainan'): Promise<void> {
  const res = await admin.request.put(`/api/admin/feature-toggles/${key}`, {
    data: { enabled },
    headers: { 'x-csrf-token': await csrfOf(admin) },
  })
  expect(res.status(), `PUT ${key}`).toBe(200)
}

const NAV_SCOPES = [
  '[data-testid="pembelajaran-nav"]',
  '[data-testid="pembelajaran-bottom-nav"]',
  '[data-testid="pembelajaran-lagi-nav"]',
]

/** Links to `href` in the pupil menus: sidebar, bottom nav and (below lg) the opened "Lagi" panel. */
async function menuLinks(pupil: Page, href: string): Promise<number> {
  const lagi = pupil.locator('button[data-nav-id="tab-lagi"]')
  const opened = (await lagi.count()) > 0 && (await lagi.isVisible())
  if (opened) await lagi.click()
  let n = 0
  for (const scope of NAV_SCOPES) n += await pupil.locator(`${scope} a[href="${href}"]`).count()
  if (opened) await pupil.keyboard.press('Escape')
  return n
}

const notFoundHeading = (pupil: Page) => pupil.getByRole('heading', { name: 'Halaman Tidak Dijumpai' }).first()

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
  test('@api Latih Tubi OFF: /practice is 404, the menu item goes, progress and history stay (AC-ADM-N06.1)', async ({ page, browser }, info) => {
    test.setTimeout(240_000)
    const adminAcc = account('adminPusat')
    await loginViaUi(page, adminAcc.user, adminAcc.pass)

    /** One fresh pupil session (the flags are read at login). */
    const asPupil = async (check: (pupil: Page) => Promise<void>): Promise<void> => {
      const ctx = await newPeerContext(browser, info)
      try {
        const pupil = await ctx.newPage()
        const acc = account('student')
        await loginViaUi(pupil, acc.user, acc.pass)
        await gotoApi(pupil, '/dashboard')
        await check(pupil)
      } finally {
        await ctx.close()
      }
    }

    try {
      await put(page, true, 'latih-tubi')
      await asPupil(async (pupil) => {
        expect(await menuLinks(pupil, '/practice'), 'ON: Latih Tubi item').toBeGreaterThan(0)
        await gotoApi(pupil, '/practice')
        await expect(pupil.getByTestId('practice-list-page')).toBeVisible()
        await expect(notFoundHeading(pupil)).toBeHidden()
      })

      await put(page, false, 'latih-tubi')
      await asPupil(async (pupil) => {
        expect(await menuLinks(pupil, '/practice'), 'OFF: Latih Tubi item').toBe(0)
        await gotoApi(pupil, '/practice')
        await expect(notFoundHeading(pupil)).toBeVisible()
        expect(await pupil.title(), 'OFF: 404 title').toBe(NOT_FOUND_TITLE)
        // D-5 exceptions: other modules under /practice keep working.
        await gotoApi(pupil, '/practice/progress')
        await expect(pupil.getByTestId('progress-page')).toBeVisible()
        await expect(notFoundHeading(pupil)).toBeHidden()
        await gotoApi(pupil, '/practice/history')
        await expect(pupil.getByTestId('history-page')).toBeVisible()
        await expect(notFoundHeading(pupil)).toBeHidden()
      })

      await put(page, true, 'latih-tubi')
      await asPupil(async (pupil) => {
        expect(await menuLinks(pupil, '/practice'), 'ON again: Latih Tubi item').toBeGreaterThan(0)
        await gotoApi(pupil, '/practice')
        await expect(pupil.getByTestId('practice-list-page')).toBeVisible()
      })
    } finally {
      await put(page, true, 'latih-tubi')
    }
  })


  // S0-T11, AC-ADM-P2-19.1: the same round trip for Leaderboard (`leaderboard`, seeded ON by migration 0250).
  test('@api Admin Pusat switches Leaderboard OFF and ON; the pupil menu and URL follow', async ({ page, browser }, info) => {
    test.setTimeout(180_000)
    const adminAcc = account('adminPusat')
    await loginViaUi(page, adminAcc.user, adminAcc.pass)
    await gotoApi(page, '/admin/feature-toggles')
    await expect(page.locator('[data-testid="ft-row-leaderboard"]')).toBeVisible()
    await expectNoHScroll(page)

    const putLeaderboard = async (enabled: boolean): Promise<void> => {
      const res = await page.request.put('/api/admin/feature-toggles/leaderboard', {
        data: { enabled },
        headers: { 'x-csrf-token': await csrfOf(page) },
      })
      expect(res.status(), 'PUT leaderboard').toBe(200)
    }
    const pupilSees = async (): Promise<{ menu: boolean; title: string; notFoundShown: boolean }> => {
      const ctx = await newPeerContext(browser, info)
      try {
        const pupil = await ctx.newPage()
        const acc = account('student')
        await loginViaUi(pupil, acc.user, acc.pass)
        await gotoApi(pupil, '/dashboard')
        const menu = (await pupil.locator('a[href="/leaderboard"], a[href="/gamification/leaderboard"]').count()) > 0
        await gotoApi(pupil, '/leaderboard')
        await expect.poll(() => pupil.title()).not.toBe('')
        const notFoundShown = await pupil.getByRole('heading', { name: 'Halaman Tidak Dijumpai' }).first().isVisible()
        return { menu, title: await pupil.title(), notFoundShown }
      } finally {
        await ctx.close()
      }
    }

    try {
      await putLeaderboard(true)
      expect((await pupilSees()).menu, 'ON: menu item').toBe(true)

      await putLeaderboard(false)
      const off = await pupilSees()
      expect(off.menu, 'OFF: menu item').toBe(false)
      expect(off.title, 'OFF: 404 page title').toBe(NOT_FOUND_TITLE)
      expect(off.notFoundShown, 'OFF: 404 page heading').toBe(true)

      await putLeaderboard(true)
      const on = await pupilSees()
      expect(on.menu, 'ON again: menu item').toBe(true)
      expect(on.title, 'ON again: not the 404 page').not.toBe(NOT_FOUND_TITLE)
      expect(on.notFoundShown, 'ON again: no 404 heading').toBe(false)
    } finally {
      await putLeaderboard(true)
    }
  })
})
