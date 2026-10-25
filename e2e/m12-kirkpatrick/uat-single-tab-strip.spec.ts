/**
 * UAT G-16 (Guru, Kirkpatrick) and A-PM11 (Admin, Pemantauan > Intervensi): the level tabs and the page
 * actions appear ONCE at 375 / 768 / 1280. The v2 layouts (Pembelajaran, Pentadbiran) print the Kirkpatrick
 * section tabs above the page, and each page also rendered its own `KirkpatrickTabs`: two identical strips.
 * The page strip now steps aside when the layout prints one (`useShellPrintsSectionTabs`).
 * Counted inside `<main>`, so the sidebar and the drawer menu do not count. Works with the legacy shells
 * (e2e build: the page strip is the only strip) and with `VITE_PROTOTYPE_SCOPE=on` (the layout strip only).
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, moduleTag } from '../support'

const MODULE = { tag: [moduleTag(12)] }

test.use({ mockInit: { latency: 0 } })

const PAGES = ['reaction', 'learning', 'behavior', 'results', 'interventions'] as const
const LEVEL_TABS = ['T1: Reaksi', 'T2: Pembelajaran', 'T3: Tingkah Laku', 'T4: Hasil'] as const

const WHO = [
  { who: 'UAT G-16 guru', email: 'guru@demo.test', base: '/guru/kirkpatrick' },
  { who: 'UAT A-PM11 admin', email: 'admin@demo.test', base: '/admin/kirkpatrick' },
] as const

const main = (page: Page) => page.getByRole('main')

/** Visible links of `main` whose accessible name is exactly `name`. */
const links = (page: Page, name: string) =>
  main(page).getByRole('link', { name, exact: true }).filter({ visible: true })

for (const c of WHO) {
  test.describe(c.who, MODULE, () => {
    for (const slug of PAGES) {
      test(`${slug}: each level tab shows once @m12`, async ({ page, loginAs, gotoApp }) => {
        await loginAs(c.email)
        await gotoApp(`${c.base}/${slug}`)
        await expect(main(page)).toBeVisible()
        // The strip is there (exactly one) ...
        await expect(links(page, 'T1: Reaksi')).toHaveCount(1)
        // ... and so is every other tab, never twice.
        for (const label of LEVEL_TABS) await expect(links(page, label), label).toHaveCount(1)
        await expect(links(page, 'Intervensi'), 'Intervensi').toHaveCount(1)
        await expectNoHorizontalScroll(page)
      })
    }

    test('interventions: the form toggle and the page heading show once @m12', async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(c.email)
      await gotoApp(`${c.base}/interventions`)
      await expect(page.getByRole('button', { name: 'Rekod Intervensi Baru' })).toHaveCount(1)
      await expect(page.getByRole('button', { name: 'Rekod Intervensi Baru' })).toBeVisible()
      await page.getByRole('button', { name: 'Rekod Intervensi Baru' }).click()
      await expect(page.getByRole('button', { name: 'Simpan Intervensi' })).toHaveCount(1)
      await expect(page.getByRole('button', { name: 'Simpan Intervensi' })).toBeVisible()
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    })
  })
}
