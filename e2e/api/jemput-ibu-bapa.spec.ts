/**
 * @api D-05 `/jemput-ibu-bapa` against the REAL API: the student's invite link must end in a 64-hex
 * token, never `undefined` (GET /api/me/parent-invite returns status only, D58; the adapter issues a
 * token on the first visit). A later visit (a live token exists, but its clear value is never
 * returned) shows an empty field with Salin disabled until "Jana Link Baru"; either way no href or
 * value may carry `undefined`. Issues a token for the seed student.
 */

import { expect, gotoApi, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll } from './helpers'

const LINK = /\/ibu-bapa\/terima\/[0-9a-f]{64}$/

test.describe('jemput ibu bapa link @api', () => {
  test.setTimeout(60_000)

  test('student sees a valid invite link, Salin and WhatsApp carry the same token @api', async ({ page }) => {
    const { user, pass } = account('student')
    await loginViaUi(page, user, pass)
    await gotoApi(page, '/jemput-ibu-bapa')

    const field = page.getByTestId('jemput-url')
    await expect(page.getByTestId('jemput-link-card')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('jemput-regenerate')).toBeEnabled({ timeout: 20_000 })
    expect(await page.getByTestId('jemput-link-card').innerHTML()).not.toContain('undefined')
    if ((await field.inputValue()) === '') {
      // Later visit: no clear token on the page. Nothing to copy until a new link is issued.
      await expect(page.getByTestId('jemput-copy')).toBeDisabled()
      expect(await page.getByTestId('jemput-whatsapp').getAttribute('href')).toBeNull()
      await page.getByTestId('jemput-regenerate').click()
      await expect(page.getByTestId('jemput-flash')).toBeVisible()
    }
    await expect(field).toHaveValue(LINK, { timeout: 20_000 })
    expect(await field.inputValue()).not.toContain('undefined')

    const href = await page.getByTestId('jemput-whatsapp').getAttribute('href')
    expect(href).not.toBeNull()
    expect(decodeURIComponent(href ?? '')).toMatch(/\/ibu-bapa\/terima\/[0-9a-f]{64}$/)
    expect(href).not.toContain('undefined')

    await page.getByTestId('jemput-regenerate').click()
    await expect(page.getByTestId('jemput-flash')).toBeVisible()
    await expect(field).toHaveValue(LINK)
    await expectNoHScroll(page)
  })
})
