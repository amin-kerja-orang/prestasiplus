/**
 * `/sekolah-bersaing` at 375 / 768 / 1280: the live board (R1-AS-45, FR-AS-45-1..6, OQ-API-09). Account 8
 * is the school admin. The rows come from the M05 owner mock, so only their shape is asserted here:
 * the exact values are covered by the handler tests.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, moduleTag, viewportWidth } from '../support'

const ADMIN = 'admin@demo.test'
const STUDENT = 'pelajar@demo.test'
const MODULE = { tag: [moduleTag(16)] }

test.use({ mockInit: { latency: 0 } })

async function expectBoard(page: Page): Promise<void> {
  // The shell sets the tab title from its header title (useShellTabTitle), over the route meta.
  await expectTabTitle(page, 'Sekolah Bersaing | PRESTASIPLUS')
  await expect(page.getByRole('heading', { level: 1, name: 'Sekolah Bersaing' })).toBeVisible()
  // The admin shell moves the sub-line into its own header and hides the copy on the page.
  await expect(
    page
      .getByText('Kedudukan sekolah teratas berdasarkan purata ketepatan latihan pelajar.')
      .filter({ visible: true }),
  ).toBeVisible()
  await expect(page.getByTestId('sb-label')).toHaveText('Papan Pemimpin')

  const rows = page.getByTestId('sb-row')
  await expect(rows.first()).toBeVisible()
  const count = await rows.count()
  expect(count).toBeGreaterThanOrEqual(4)
  expect(count).toBeLessThanOrEqual(30)

  const ranks = page.getByTestId('sb-rank')
  await expect(ranks.nth(0)).toHaveText('🥇')
  await expect(ranks.nth(1)).toHaveText('🥈')
  await expect(ranks.nth(2)).toHaveText('🥉')
  await expect(ranks.nth(3)).toHaveText('4')

  for (const field of ['sb-school', 'sb-state', 'sb-pupils']) {
    await expect(page.getByTestId(field)).toHaveCount(count)
    await expect(page.getByTestId(field).first()).toBeVisible()
  }
  await expect(page.getByTestId('sb-accuracy')).toHaveCount(count)
  await expect(page.getByTestId('sb-accuracy').first()).toHaveText(/^\d{1,3}%$/)

  const table = page.getByTestId('sb-table')
  if (viewportWidth(page) >= 768) {
    await expect(table.locator('thead th')).toHaveText([
      '#',
      'Sekolah',
      'Negeri',
      'Ketepatan',
      'Pelajar',
    ])
  } else {
    await expect(table.locator('table')).toHaveCount(0)
    await expect(table.locator('[data-ds="data-table-cards"] > li')).toHaveCount(count)
    await expect(rows.first().locator('dt')).toHaveText(['Negeri', 'Ketepatan', 'Pelajar'])
    // AC-AS-45-4: every text of a card is at least 14 px at 375.
    const sizes = await rows
      .first()
      .locator('p, span, dt, dd')
      .evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)))
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14)
  }
  await expectNoHorizontalScroll(page)
}

for (const [name, who] of [
  ['school admin (account 8)', 8],
  ['admin', ADMIN],
] as const) {
  test(`AC-AS-45-4 ${name} sees the live board`, MODULE, async ({ page, gotoApp, loginAs }) => {
    await loginAs(who)
    await gotoApp('/sekolah-bersaing')
    await expectBoard(page)
  })
}

test(
  'FR-X2-4 a student gets the 403 page and no board',
  MODULE,
  async ({ page, gotoApp, loginAs }) => {
    await loginAs(STUDENT)
    await gotoApp('/sekolah-bersaing')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Akses Ditolak')
    await expect(page.getByTestId('sb-row')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  },
)
