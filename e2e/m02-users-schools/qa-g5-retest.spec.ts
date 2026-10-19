/**
 * M02 G5 re-test (qa-engineer): E2E-M02-38 (S6 empty list), E2E-M02-54 (grace row), BUG-03 (out-of-range
 * page) and BUG-04 (S9 header case, dim zero counts, toggle pill).
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, moduleTag, TAG } from '../support'

const byId = (page: Page, id: string) => page.getByTestId(id)

async function spaGoto(page: Page, path: string): Promise<void> {
  await page.evaluate(async (p) => {
    const el = document.querySelector('#app') as Element & {
      __vue_app__: {
        config: { globalProperties: { $router: { push(t: string): Promise<unknown> } } }
      }
    }
    await el.__vue_app__.config.globalProperties.$router.push(p)
  }, path)
}

test.describe('M02 QA re-test', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.describe.configure({ timeout: 120_000 })
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/admin/users')
  })

  test.describe('overrides comp 0', () => {
    test.use({ mockInit: { latency: 0, overrides: { comp: 0 } } })
    test('E2E-M02-38: after mock.reset({comp:0}) the S6 list shows the empty text with the "Daftar baru." link', async ({
      page,
      gotoApp,
    }) => {
      await gotoApp('/admin/comp-students')
      await expect(byId(page, 'comp-empty')).toContainText('Tiada pelajar komplimen lagi.')
      await expect(byId(page, 'comp-empty-link')).toHaveText('Daftar baru.')
      await expect(byId(page, 'comp-empty-link')).toHaveAttribute(
        'href',
        '/admin/comp-students/create',
      )
      await expect(byId(page, 'comp-row')).toHaveCount(0)
      await expect(byId(page, 'comp-summary')).toContainText('0 / 0')
      await expectNoHorizontalScroll(page)
    })
  })

  test('BUG-03: /admin/comp-students?page=9 shows the empty text and the pager', async ({
    page,
  }) => {
    await spaGoto(page, '/admin/comp-students?page=9')
    await expect(byId(page, 'comp-empty')).toContainText(
      'Tiada pelajar komplimen lagi. Daftar baru.',
    )
    await expect(byId(page, 'comp-empty')).toBeVisible()
    await expect(byId(page, 'comp-pager')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test.describe('profile subscriptions-extra', () => {
    test.use({ mockInit: { latency: 0, overrides: { profile: 'subscriptions-extra' } } })
    test('E2E-M02-54: with profile subscriptions-extra the grace row reads "Tempoh Ihsan" on S12 and S14', async ({
      page,
      gotoApp,
    }) => {
      await gotoApp('/admin/school-subscriptions')
      await expect(byId(page, 'subs-row')).toHaveCount(15)
      await expect(byId(page, 'subs-stat-grace')).toHaveText(/1\s*Tempoh Ihsan/)
      await expect(byId(page, 'subs-status-badge').filter({ hasText: 'Tempoh Ihsan' })).toHaveCount(
        1,
      )
      await gotoApp('/admin/school-subscriptions/16')
      await expect(byId(page, 'sub-status')).toHaveText('Tempoh Ihsan')
      await expect(byId(page, 'sub-summary-card')).toBeVisible()
      await expectNoHorizontalScroll(page)
    })
  })

  test('BUG-04: S9 headers are title case, zero counts are dim, the status control is a green toggle', async ({
    page,
  }) => {
    await spaGoto(page, '/admin/schools')
    await expect(byId(page, 'school-row').first()).toBeVisible()
    const th = page.locator('thead th').first()
    await expect(th).toHaveText('Nama Sekolah')
    await expect(th).toHaveCSS('text-transform', 'none')
    // A zero-count cell is lighter than a non-zero one.
    const zero = await page
      .getByTestId('school-row')
      .nth(1)
      .locator('td')
      .nth(5)
      .evaluate((el) => getComputedStyle(el).color)
    const name = await page
      .getByTestId('school-row')
      .nth(1)
      .locator('td')
      .first()
      .evaluate((el) => getComputedStyle(el).color)
    expect(zero).not.toBe(name)
    await expect(byId(page, 'school-toggle').first()).toBeVisible()
    await expectNoHorizontalScroll(page)
  })
})
