/**
 * M18 S23 "Ringkasan Eksekutif" (`/amaran/ringkasan-eksekutif`) and S21 "Keberkesanan Intervensi"
 * (`/amaran/keberkesanan`) at 375 / 768 / 1280 (design `docs/design/m18-amaran-summary.md`). Both are
 * `school_admin` only, own school, reached from the two M18 buttons on M27 S4 `/amaran/sekolah`.
 *
 * Personas (as the M27 S4 spec): azlan = school 900003 (no pupil, so no interventions), user 1214 = the populated
 * school's admin. Developer smoke spec: no `E2E-M18-nn` ids yet (the M18 SRS section 12 defines none for these
 * screens), so the trace check has nothing to match.
 */

import type { Page } from '@playwright/test'

import { createMockHandle, gotoApp as gotoAppOn } from '../fixtures/mock-handle'
import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, viewportWidth } from '../support'

const MODULE = { tag: ['@m18'] }
const S4 = '/amaran/sekolah'
const S23 = '/amaran/ringkasan-eksekutif'
const S21 = '/amaran/keberkesanan'
const AZLAN = 'azlan@demo.test'
const POPULATED = 1214
const SLOW = { timeout: 60_000 }

test.use({ mockInit: { latency: 0 } })
// the populated school is computed from large owner datasets: first answers are slow on a loaded PC
test.describe.configure({ timeout: 150_000 })

async function signIn(page: Page, who: string | number): Promise<void> {
  await gotoAppOn(page, '/login')
  await createMockHandle(page).setUser(who)
}

/** Opens S4 as the given school admin and waits for the page and both M18 buttons. */
async function openS4(
  page: Page,
  gotoApp: (p: string) => Promise<void>,
  who: string | number,
): Promise<void> {
  await signIn(page, who)
  await gotoApp(S4)
  await expect(page.getByTestId('am-tiles')).toBeVisible(SLOW)
  await expect(page.getByTestId('am-btn-ringkasan')).toBeVisible()
  await expect(page.getByTestId('am-btn-keberkesanan')).toBeVisible()
}

const personas: [string, string | number][] = [
  ['no-pupil school (azlan)', AZLAN],
  ['populated school (1214)', POPULATED],
]

async function expectForbidden(page: Page, path: string): Promise<void> {
  await expect(page.locator('[data-page=forbidden]')).toBeVisible()
  await expect(page.locator('[data-page=forbidden]')).toContainText('Akses Ditolak')
  expect(page.url()).toContain(path)
  await expect(page.getByTestId('rk-page')).toHaveCount(0)
  await expect(page.getByTestId('kb-page')).toHaveCount(0)
}

test.describe('S23 Ringkasan Eksekutif', MODULE, () => {
  for (const [label, who] of personas) {
    test(`S4 button opens S23, main blocks, no district comparison, Kembali returns, no h-scroll (${label})`, async ({
      page,
      gotoApp,
    }) => {
      await openS4(page, gotoApp, who)
      await page.getByTestId('am-btn-ringkasan').click()
      await expect(page).toHaveURL(new RegExp(`${S23}`))
      await expect(page.getByTestId('rk-sheet')).toBeVisible(SLOW)
      for (const id of ['rk-title', 'rk-tiles', 'rk-distribution', 'rk-kombo', 'rk-footer']) {
        await expect(page.getByTestId(id)).toBeVisible()
      }
      await expect(page.getByTestId('rk-print')).toBeEnabled()
      await expect(page.getByTestId('rk-loading')).toHaveCount(0)
      await expect(page.getByText('Perbandingan Sekolah Daerah')).toHaveCount(0)
      await expectNoHorizontalScroll(page)

      await page.getByTestId('rk-back').click()
      await expect(page).toHaveURL(new RegExp(`${S4}$`))
      await expect(page.getByTestId('am-tiles')).toBeVisible(SLOW)
    })
  }

  test('Kembali on a direct visit falls back to /amaran/sekolah', async ({ page, gotoApp }) => {
    await signIn(page, POPULATED)
    await gotoApp(S23)
    await expect(page.getByTestId('rk-sheet')).toBeVisible(SLOW)
    await page.getByTestId('rk-back').click()
    await expect(page).toHaveURL(new RegExp(`${S4}$`))
  })

  test('hand-edited scope and school_id still show the own school', async ({ page, gotoApp }) => {
    await signIn(page, POPULATED)
    await gotoApp(S23)
    await expect(page.getByTestId('rk-sheet')).toBeVisible(SLOW)
    const own = (await page.getByTestId('rk-title').textContent())?.trim()
    const ownTiles = (await page.getByTestId('rk-tiles').textContent())?.trim()
    expect(own).toBeTruthy()

    await gotoApp(`${S23}?scope=national&school_id=900003`)
    await expect(page.getByTestId('rk-sheet')).toBeVisible(SLOW)
    await expect(page.getByTestId('rk-title')).toHaveText(own!)
    expect((await page.getByTestId('rk-tiles').textContent())?.trim()).toBe(ownTiles)
    await expectNoHorizontalScroll(page)
  })

  for (const email of ['pelajar@demo.test']) {
    test(`${email} gets the 403 page on S23`, async ({ page, loginAs, gotoApp }) => {
      await loginAs(email)
      await gotoApp(S23)
      await expectForbidden(page, S23)
    })
  }
})

test.describe('S21 Keberkesanan Intervensi', MODULE, () => {
  for (const [label, who] of personas) {
    test(`S4 button opens S21: tiles, charts, lists or zero state, no h-scroll (${label})`, async ({
      page,
      gotoApp,
    }) => {
      await openS4(page, gotoApp, who)
      await page.getByTestId('am-btn-keberkesanan').click()
      await expect(page).toHaveURL(new RegExp(`${S21}`))
      await expect(page.getByTestId('kb-tiles')).toBeVisible(SLOW)
      await expect(page.getByTestId('kb-loading')).toHaveCount(0)
      for (const id of ['kb-tile-total', 'kb-tile-rate', 'kb-tile-action', 'kb-tile-pending']) {
        await expect(page.getByTestId(id)).toBeVisible()
      }
      await expect(page.getByText('Perbandingan Sekolah Daerah')).toHaveCount(0)

      const none = page.getByTestId('kb-none')
      if (await none.isVisible()) {
        await expect(none).toContainText('Belum Ada Intervensi')
        await expect(page.getByTestId('kb-doughnut-empty')).toBeVisible()
        await expect(page.getByTestId('kb-trend-empty')).toBeVisible()
        await expect(page.getByTestId('kb-types')).toHaveCount(0)
      } else {
        await expect(page.getByTestId('kb-doughnut')).toBeVisible()
        await expect(page.getByTestId('kb-trend')).toBeVisible()
        await expect(page.getByTestId('kb-types')).toBeVisible()
        await expect(page.getByTestId('kb-teachers')).toBeVisible()
        await expect(page.getByTestId('kb-followups')).toBeVisible()
        // S24 does not exist yet: no follow-up arrow.
        await expect(page.getByTestId('kb-followup-link')).toHaveCount(0)
        // Below md the teacher stats are cards (no table); from md a table.
        const table = page.getByTestId('kb-teachers').locator('table')
        if (viewportWidth(page) < 768) await expect(table).toBeHidden()
        else await expect(table.first()).toBeVisible()
      }
      await expectNoHorizontalScroll(page)

      await page.getByTestId('kb-back').click()
      await expect(page).toHaveURL(new RegExp(`${S4}$`))
    })
  }

  test('zero state link "Lihat Senarai Risiko" leads to S4', async ({ page, gotoApp }) => {
    await signIn(page, AZLAN)
    await gotoApp(S21)
    await expect(page.getByTestId('kb-tiles')).toBeVisible(SLOW)
    test.skip(!(await page.getByTestId('kb-none').isVisible()), 'this school has interventions')
    await page.getByTestId('kb-none-link').click()
    await expect(page).toHaveURL(new RegExp(`${S4}$`))
  })

  for (const email of ['pelajar@demo.test']) {
    test(`${email} gets the 403 page on S21`, async ({ page, loginAs, gotoApp }) => {
      await loginAs(email)
      await gotoApp(S21)
      await expectForbidden(page, S21)
    })
  }
})

test.describe('Teacher on S23 / S21', MODULE, () => {
  test('S23: own school sheet, URL query ignored, Kembali points to /guru, no h-scroll', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('guru@demo.test')
    await gotoApp(`${S23}?scope=state&state=Perak`)
    await expect(page.getByTestId('rk-sheet')).toBeVisible(SLOW)
    await expect(page.getByTestId('rk-schools')).toHaveCount(0)
    await expect(page.getByTestId('rk-back')).toHaveAttribute('href', '/guru')
    await expectNoHorizontalScroll(page)
  })

  test('S21: loads, Kembali points to /guru, no "Lihat Senarai Risiko", no h-scroll', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('guru@demo.test')
    await gotoApp(S21)
    await expect(page.getByTestId('kb-tiles')).toBeVisible(SLOW)
    await expect(page.getByTestId('kb-back')).toHaveAttribute('href', '/guru')
    await expect(page.getByTestId('kb-none-link')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })
})

test.describe('Admin on S23 / S21', MODULE, () => {
  for (const [label, query, title] of [
    ['district', 'scope=district&district=PPD%20BATANG%20PADANG&state=Perak', 'PPD BATANG PADANG'],
    ['state', 'scope=state&state=Perak', 'Negeri Perak'],
  ] as const) {
    test(`S23 scope=${label}: schools card (table from md, cards below), no h-scroll`, async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs('admin@demo.test')
      await gotoApp(`${S23}?${query}`)
      await expect(page.getByTestId('rk-sheet')).toBeVisible(SLOW)
      await expect(page.getByTestId('rk-title')).toHaveText(title)
      await expect(page.getByTestId('rk-schools')).toContainText('Pecahan Mengikut Sekolah')
      await expect(page.getByTestId('rk-subjects')).toHaveCount(0)
      await expect(page.getByTestId('rk-back')).toHaveAttribute('href', '/admin')
      const table = page.getByTestId('rk-schools').locator('table')
      if (viewportWidth(page) < 768) {
        await expect(table).toBeHidden()
        await expect(page.getByTestId('rk-school-name').first()).toBeVisible()
      } else {
        await expect(table.first()).toBeVisible()
        await expect(table.first().locator('th')).toHaveText([
          '#', 'Sekolah', 'Pelajar', 'Hijau', 'Kuning', 'Merah', 'Prt. Skor',
        ])
      }
      if (label === 'state') await expect(page.getByTestId('rk-pupils')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    })
  }

  test('S23 without scope gives the 403 page (no default scope in v2)', async ({ page, loginAs, gotoApp }) => {
    await loginAs('admin@demo.test')
    await gotoApp(S23)
    await expectForbidden(page, S23)
  })

  test('S21 gives the 403 page (the admin has no school)', async ({ page, loginAs, gotoApp }) => {
    await loginAs('admin@demo.test')
    await gotoApp(S21)
    await expectForbidden(page, S21)
  })
})
