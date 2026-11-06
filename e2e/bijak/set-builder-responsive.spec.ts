/**
 * Set Builder (R1-F08) and Semak Kertas at 375 / 768 / 1280: no horizontal page scroll, the D90
 * group flow by hand (add a group, Naik / Turun, Buang) and the Terbitkan disabled reason.
 * Mock only; needs the scope-on build: `npm run test:e2e:bijak`.
 */
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll } from '../support'
import { HTTP_MODE } from './bijak-flow'

test.skip(HTTP_MODE, 'mock-only')
test.skip(process.env.E2E_PROTOTYPE_SCOPE !== 'on', 'needs the scope-on build: playwright.bijak.config.mjs')

const SHOTS = process.env.SHOTS_DIR ?? 'test-results-bijak/shots'

async function noScroll(page: Page): Promise<void> {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
  expect(r.sw, `scrollWidth ${r.sw} > innerWidth ${r.iw}`).toBeLessThanOrEqual(r.iw)
  await expectNoHorizontalScroll(page)
}

/** The pane switch is shown below `lg` (1024 px): tabs below 1024, two panes at 1024 and above. */
const narrow = (page: Page): boolean => (page.viewportSize()?.width ?? 0) < 1024

async function shot(page: Page, name: string): Promise<void> {
  const w = page.viewportSize()?.width ?? 0
  await page.screenshot({ path: `${SHOTS}/${name}-${w}.png`, fullPage: true })
}

test.describe('Set Builder responsive @bijak', () => {
  test('landing, builder with a stimulus group, Semak Kertas @bijak', async ({ page, loginAs, gotoApp }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/admin/studio/sets')
    await expect(page.getByTestId('set-builder-page')).toBeVisible()
    await noScroll(page)
    await shot(page, 'landing')

    // Mula kosong: try every subject / kertas until the bank holds a stimulus group.
    const subjects = await page.getByTestId('blank-subject').locator('option').evaluateAll((o) =>
      (o as HTMLOptionElement[]).map((x) => x.value).filter(Boolean),
    )
    let found = false
    for (const code of subjects) {
      await page.getByTestId('blank-subject').selectOption(code)
      const kertas = await page.getByTestId('blank-kertas').locator('option').evaluateAll((o) =>
        (o as HTMLOptionElement[]).map((x) => x.value).filter(Boolean),
      )
      for (const k of kertas) {
        await page.getByTestId('blank-subject').selectOption(code)
        await page.getByTestId('blank-kertas').selectOption(k)
        await page.getByTestId('blank-submit').click()
        await expect(page.getByTestId('set-builder-editor')).toBeVisible()
        if (narrow(page)) await page.getByTestId('builder-pane-bank').click()
        await expect(page.locator('[data-testid=bank-list], [data-testid=bank-empty]')).toBeVisible()
        if (await page.locator('[data-testid^=pool-group-]').count()) {
          found = true
          break
        }
        // In-app back to the landing (a reload would reset the mock state).
        await page.getByRole('link', { name: 'Kembali' }).first().click()
        await expect(page.getByTestId('set-builder-page')).toBeVisible()
      }
      if (found) break
    }
    expect(found, 'a stimulus group in the bank').toBe(true)
    await noScroll(page)
    await shot(page, 'builder-bank')

    // Add the group (one click on the unit), then a single question after it.
    const group = page.locator('[data-testid^=pool-group-]').first()
    const gid = (await group.getAttribute('data-testid'))!.replace('pool-group-', '')
    await group.locator('[data-testid^=pool-add-]').click()
    await expect(page.locator('[data-testid^=pool-add-]').first()).toBeVisible()
    await expect(page.getByTestId(`unit-group-${gid}`)).toHaveCount(1)
    const single = page.locator('[data-testid^=pool-]:not([data-testid^=pool-group-]):not([data-testid=pool-stimulus]):not([data-testid=pool-reasons])').filter({ has: page.locator('[data-testid^=pool-add-]') }).first()
    if (await single.count()) {
      await single.locator('[data-testid^=pool-add-]').click()
      await expect(page.locator('[data-testid^=builder-section-] [data-testid^=remove-]')).toHaveCount(2)
    }

    if (narrow(page)) await page.getByTestId('builder-pane-set').click()
    const unit = page.getByTestId(`unit-group-${gid}`)
    await expect(unit).toHaveCount(1)
    await expect(unit.locator('[data-testid=set-stimulus]')).toHaveCount(1)
    await noScroll(page)
    await shot(page, 'builder-set')

    // Naik / Turun move the whole unit, Buang removes it whole.
    const firstId = (await unit.locator('[data-testid^=remove-]').getAttribute('data-testid'))!.replace('remove-', '')
    const down = page.getByTestId(`down-${firstId}`)
    if (await down.isEnabled()) await down.click()
    else await page.getByTestId(`up-${firstId}`).click()
    await expect(page.getByTestId(`unit-group-${gid}`)).toHaveCount(1)
    await expect(page.getByTestId('builder-publish')).toBeDisabled()
    await expect(page.getByTestId('builder-publish-reason')).toContainText('masalah')
    await noScroll(page)
    await shot(page, 'builder-publish-blocked')
    await page.getByTestId(`remove-${firstId}`).click()
    await expect(page.getByTestId(`unit-group-${gid}`)).toHaveCount(0)

    // Semak Kertas of the same paper.
    const id = new URL(page.url()).pathname.split('/')[4]!
    await page.getByTestId('builder-semak').click()
    await expect(page.getByTestId('paper-editor-page')).toBeVisible()
    await expect(page.getByTestId('paper-review')).toBeVisible()
    await expect(page.getByTestId('paper-publish')).toBeDisabled()
    expect(new URL(page.url()).pathname).toContain(id)
    await expect(page.getByRole('heading', { name: 'Semak Kertas Simulasi' })).toBeVisible()
    await expect(page.getByTestId('paper-edit-in-builder')).toContainText('Sunting di Set Builder')
    await noScroll(page)
    await shot(page, 'semak')
  })

  test('Jana set fields, a scaled draw, the rule control, the two redirects @bijak', async ({ page, loginAs, gotoApp }) => {
    await loginAs('admin@demo.test')
    // FR-ADM-Q15.6: the old list and form land on the one list.
    await gotoApp('/admin/spm/kertas')
    await expect(page).toHaveURL(/\/admin\/studio\/sets$/)
    await gotoApp('/admin/spm/kertas/baharu')
    await expect(page).toHaveURL(/\/admin\/studio\/sets$/)
    await expect(page.getByTestId('landing-contract')).toBeVisible()

    await page.getByTestId('gen-subject').selectOption({ label: 'Matematik' })
    await page.getByTestId('gen-kertas').selectOption({ label: 'Kertas 1' })
    await expect(page.getByTestId('gen-count')).toHaveValue('10')
    await expect(page.getByTestId('gen-title')).toHaveValue('Percubaan SPM Matematik Kertas 1 (draf)')
    await expect(page.getByTestId('gen-years')).toBeVisible()
    await expect(page.getByTestId('gen-negeri')).toBeVisible()
    await expect(page.getByTestId('pool-available')).toContainText('soalan tersedia')
    await noScroll(page)
    await shot(page, 'landing-jana')

    await page.getByTestId('gen-count').fill('11')
    await expect(page.getByTestId('generate-form')).toContainText('Bilangan soalan melebihi jumlah kontrak (10).')
    await expect(page.getByTestId('gen-submit')).toBeDisabled()
    await page.getByTestId('gen-count').fill('4')
    await expect(page.getByTestId('gen-scaled')).toBeVisible()
    await page.getByTestId('gen-title').fill('Set Berskala Ujian')
    await expect(page.getByTestId('gen-submit')).toBeEnabled()
    await page.getByTestId('gen-submit').click()

    await expect(page.getByTestId('set-builder-editor')).toBeVisible()
    await expect(page.getByTestId('builder-fill-0')).toContainText('/ 4 dipilih')
    await expect(page.getByTestId('section-0-badges')).toContainText('Soalan 4 / 4')
    await expect(page.getByTestId('budget-check')).toBeVisible()
    await noScroll(page)
    await shot(page, 'builder-scaled')

    // The rule control, on a Bahagian that keeps its marks: Pilih N then back.
    await page.getByTestId('rule-type-0').selectOption('choose', { force: true })
    await expect(page.getByTestId('section-0-badges')).toContainText('Markah 1 /')
    await expect(page.getByTestId('rule-n-0')).toBeVisible()
    await page.getByTestId('rule-n-0').fill('99')
    await page.getByTestId('rule-n-0').blur()
    await expect(page.getByTestId('builder-rule-0')).toContainText('Nombor N tidak sah.')
    await noScroll(page)
    await shot(page, 'builder-rule')
    await page.getByTestId('rule-n-0').fill('2')
    await page.getByTestId('rule-n-0').blur()
    await expect(page.getByTestId('section-0-badges')).toContainText('Markah 2 /')

    // Tahun and Negeri of the bank: hidden with no data, here the mock has data.
    if (narrow(page)) await page.getByTestId('builder-pane-bank').click()
    await expect(page.getByTestId('bank-negeri-toggle')).toBeVisible()
    await page.getByTestId('bank-negeri-toggle').click()
    await expect(page.getByTestId('bank-count')).toContainText('dipaparkan')
    await noScroll(page)
    await shot(page, 'builder-bank-filters')
  })
})
