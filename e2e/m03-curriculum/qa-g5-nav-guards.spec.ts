/**
 * M03 G5 QA specs (written by QA): admin menu entries (E2E-M03-48, AC-27.1..27.3, FR-91/92) and route
 * guards (E2E-M03-50, AC-29.1/29.2, FR-94) for the 11 built admin routes, plus a responsive sweep of
 * the same 11 routes (E2E-M03-52, AC-31.1) lives in `qa-g5-sweep.spec.ts`.
 */

import type { Locator, Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { TIMEOUT_FACTOR } from './timeout-factor'
import { isDesktopShell, moduleTag } from '../support'

const ADMIN = 'admin@demo.test'
const byId = (page: Page, id: string) => page.getByTestId(id)

const LINKS: Array<[string, string, string]> = [
  ['kurikulum', 'Kurikulum', '/admin/curriculum'],
  ['subjek', 'Subjek', '/admin/subjects'],
  ['tahap-pendidikan', 'Tahap Pendidikan', '/admin/education-levels'],
]

/** Every built admin route and the sidebar item that must be active on it. */
const ROUTES: Array<[string, string, string]> = [
  ['S1 prompt', '/admin/curriculum', 'kurikulum'],
  ['S1 tree', '/admin/curriculum?subject_id=3&education_level_id=10', 'kurikulum'],
  [
    'S2',
    '/admin/curriculum/chapters/create?subject_id=3&education_level_id=10',
    'kurikulum',
  ],
  ['S3', '/admin/curriculum/chapters/91/edit', 'kurikulum'],
  ['S4', '/admin/curriculum/topics/create?chapter_id=91', 'kurikulum'],
  ['S5', '/admin/curriculum/topics/126/edit', 'kurikulum'],
  ['S6', '/admin/subjects', 'subjek'],
  ['S7', '/admin/subjects/create', 'subjek'],
  ['S8', '/admin/subjects/3/edit', 'subjek'],
  ['S9', '/admin/education-levels', 'tahap-pendidikan'],
  ['S10', '/admin/education-levels/create', 'tahap-pendidikan'],
  ['S11', '/admin/education-levels/10/edit', 'tahap-pendidikan'],
]

test.describe('QA G5 admin menu entries', { tag: [moduleTag(3), '@qa'] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(120_000 * TIMEOUT_FACTOR)

  /** The Portal Pentadbiran menu: the sidebar from lg, the drawer behind the menu button below it. */
  async function openNav(page: Page): Promise<Locator> {
    if (!isDesktopShell(page)) await byId(page, 'pentadbiran-menu-button').click()
    const nav = page.locator('[data-testid="pentadbiran-nav"]:visible')
    await expect(nav).toBeVisible()
    return nav
  }

  test('E2E-M03-48 menu: the Kurikulum group lists 3 links; the matching item is active per screen', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    for (const [name, path, activeId] of ROUTES) {
      await gotoApp(path)
      const nav = await openNav(page)
      for (const [, text, href] of LINKS) {
        const link = nav.locator(`a[href="${href}"]`).first()
        await expect(link, `${name} ${text}`).toBeVisible()
        await expect(link).toContainText(text)
      }
      const activeHref = LINKS.find(([id]) => id === activeId)![2]
      const active = nav.locator(
        `a[href="${LINKS.map(([, , h]) => h).join('"][aria-current="page"], a[href="')}"][aria-current="page"]`,
      )
      await expect(active, `${name} active item`).toHaveCount(1)
      await expect(active).toHaveAttribute('href', activeHref)
      if (!isDesktopShell(page)) await page.keyboard.press('Escape')
    }
  })

  test('E2E-M03-48 menu: the links are reachable (below 1024 through the menu button)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/subjects')
    const nav = await openNav(page)
    await nav.locator('a[href="/admin/education-levels"]').first().click()
    await expect(page).toHaveURL(/\/admin\/education-levels$/)
    // The count is lifted into the shell header (pentadbiran-subtitle) and kept as a hidden span.
    await expect(byId(page, 'levels-count')).toHaveText(/^Jumlah: \d+ tahap$/)
  })
})

test.describe('QA G5 route guards', { tag: [moduleTag(3), '@qa'] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(180_000 * TIMEOUT_FACTOR)

  test('E2E-M03-50 guest is sent to /login from all 11 admin routes (AC-29.1)', async ({
    page,
    gotoApp,
  }) => {
    for (const [name, path] of ROUTES) {
      await gotoApp(path)
      await expect(page, name).toHaveURL(/\/login/)
    }
  })

  for (const who of ['pelajar@demo.test', 'guru@demo.test'] as const) {
    test(`E2E-M03-50 ${who} is refused with the in-place 403 page on all 11 admin routes (AC-29.2)`, async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(who)
      for (const [name, path] of ROUTES) {
        await gotoApp(path)
        // Route guard default onForbidden '403': the refusal renders in place (URL kept, no redirect
        // to a role landing) as the DS 403 error page; the role is logged in, so never sent to /login.
        await expect(page.locator('[data-ds="error-page"][data-code="403"]'), name).toBeVisible()
        const url = new URL(page.url())
        expect(url.pathname, `${name}: ${who} is refused in place`).toBe(path.split('?')[0])
        expect(url.pathname, `${name}: ${who} is logged in, not sent to login`).not.toBe('/login')
        // None of the M03 admin pages rendered.
        await expect(page.getByTestId('curriculum-page'), name).toHaveCount(0)
        await expect(page.getByTestId('subjects-table'), name).toHaveCount(0)
        await expect(page.getByTestId('levels-table'), name).toHaveCount(0)
      }
    })
  }
})
