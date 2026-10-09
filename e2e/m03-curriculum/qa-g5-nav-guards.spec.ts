/**
 * M03 G5 QA specs (written by QA): admin menu entries (E2E-M03-48, AC-27.1..27.3, FR-91/92) and route
 * guards (E2E-M03-50, AC-29.1/29.2, FR-94) for the 11 built admin routes, plus a responsive sweep of
 * the same 11 routes (E2E-M03-52, AC-31.1) lives in `qa-g5-sweep.spec.ts`.
 */

import type { Page } from '@playwright/test'

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

  test('E2E-M03-48 sidebar (>=1024): group KURIKULUM open with 3 links; active item per screen', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(!isDesktopShell(page), 'sidebar is desktop only; the Lagi menu is tested below')
    await loginAs(ADMIN)
    for (const [name, path, activeId] of ROUTES) {
      await gotoApp(path)
      const group = page.locator('[data-group-key="kurikulum"]')
      await expect(group, name).toBeVisible()
      const label = await group.locator('button span').first().evaluate((el) => (el as HTMLElement).innerText)
      expect(label.trim(), `${name} group label`).toBe('KURIKULUM')
      for (const [, text, href] of LINKS) {
        const link = group.locator(`a[href="${href}"]`)
        await expect(link, `${name} ${text}`).toBeVisible()
        await expect(link).toContainText(text)
      }
      const active = group.locator('a.active')
      await expect(active, `${name} active item`).toHaveCount(1)
      await expect(active).toHaveAttribute('data-nav-id', activeId)
      // The group sits under the PENGURUSAN section header.
      await expect(byId(page, 'shell-admin-nav').locator('[data-nav-id="sec-pengurusan"]')).toContainText(
        'PENGURUSAN',
      )
    }
  })

  test('E2E-M03-48 sidebar: group toggle closes and reopens and is saved in localStorage admin_sidebar', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(!isDesktopShell(page), 'sidebar is desktop only')
    await loginAs(ADMIN)
    await gotoApp('/admin/subjects')
    const group = page.locator('[data-group-key="kurikulum"]')
    const links = group.locator('a[href="/admin/curriculum"]')
    await expect(links).toBeVisible()
    await group.locator('button').click()
    await expect(links).toBeHidden()
    const saved = await page.evaluate(() => localStorage.getItem('admin_sidebar'))
    expect(JSON.parse(saved ?? '{}')).toMatchObject({ kurikulum: false })
    await group.locator('button').click()
    await expect(links).toBeVisible()
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem('admin_sidebar'))) ?? '{}')).toMatchObject({
      kurikulum: true,
    })
  })

  test('E2E-M03-48 "Lagi" menu (<1024): section KURIKULUM with the same 3 links', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(isDesktopShell(page), 'the Lagi menu exists below 1024 px only')
    await loginAs(ADMIN)
    await gotoApp('/admin/subjects')
    // The desktop sidebar is not rendered / not visible below lg.
    await expect(byId(page, 'shell-admin-sidebar')).toBeHidden()
    const bottom = byId(page, 'shell-admin-bottom-nav')
    await expect(bottom).toBeVisible()
    await bottom.getByText('Lagi').click()
    const lagi = byId(page, 'shell-admin-lagi')
    await expect(lagi).toBeVisible()
    const heading = lagi.locator('[data-lagi-heading="Kurikulum"]')
    await expect(heading).toHaveCount(1)
    expect(await heading.evaluate((el) => (el as HTMLElement).innerText)).toBe('KURIKULUM')
    for (const [, text, href] of LINKS) {
      const link = lagi.locator(`a[href="${href}"]`)
      await expect(link, text).toBeVisible()
      await expect(link).toContainText(text)
    }
    // The links are reachable: tap "Tahap Pendidikan".
    await lagi.locator('a[href="/admin/education-levels"]').click()
    await expect(page).toHaveURL(/\/admin\/education-levels$/)
    await expect(byId(page, 'levels-count')).toBeVisible()
  })

  test('E2E-M03-48 Lagi: the matching item is active on S1, S6 and S9', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(isDesktopShell(page), 'the Lagi menu exists below 1024 px only')
    await loginAs(ADMIN)
    for (const [path, href] of [
      ['/admin/curriculum', '/admin/curriculum'],
      ['/admin/subjects', '/admin/subjects'],
      ['/admin/education-levels', '/admin/education-levels'],
    ]) {
      await gotoApp(path!)
      await byId(page, 'shell-admin-bottom-nav').getByText('Lagi').click()
      const lagi = byId(page, 'shell-admin-lagi')
      await expect(lagi.locator(`a[href="${href!}"]`), path).toHaveClass(/active/)
    }
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
    test(`E2E-M03-50 ${who} is kept out of all 11 admin routes and lands on its own page (AC-29.2)`, async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(who)
      for (const [name, path] of ROUTES) {
        await gotoApp(path)
        const url = new URL(page.url())
        expect(url.pathname, `${name}: ${who} must not stay on an admin route`).not.toMatch(
          /^\/admin\/(curriculum|subjects|education-levels)/,
        )
        expect(url.pathname, `${name}: ${who} is logged in, not sent to login`).not.toBe('/login')
        // None of the M03 admin pages rendered.
        await expect(page.getByTestId('curriculum-page'), name).toHaveCount(0)
        await expect(page.getByTestId('subjects-table'), name).toHaveCount(0)
        await expect(page.getByTestId('levels-table'), name).toHaveCount(0)
      }
    })
  }
})
