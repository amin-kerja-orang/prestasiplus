/**
 * G5-M01 BUG-06: with `registrationOpen: false` in `GET /api/public/stats` the register page shows
 * the closed copy up front and disables submit. The mock runs in-process (no network request for
 * `page.route` to catch), so the stats response is replaced with the mock `failNext` hook.
 */

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, moduleTag, TAG } from '../support'

type Fixtures = Parameters<Parameters<typeof test>[2]>[0]

async function expectClosedUpFront({
  page,
  gotoApp,
  mock,
}: Pick<Fixtures, 'page' | 'gotoApp' | 'mock'>): Promise<void> {
  // The mock handle exists only after boot: boot on /login, queue the fault, then go client-side.
  await gotoApp('/login')
  await mock.failNext('GET /api/public/stats', {
    status: 200,
    body: {
      data: { questionCount: 1, subjectCount: 1, levelCount: 1, registrationOpen: false },
    },
  })
  await page
    .getByTestId('login-form')
    .getByRole('link', { name: /Daftar Sekarang/ })
    .click()
  await expect(page).toHaveURL(/\/register$/)
  await expect(page.getByTestId('register-alert')).toContainText(
    'Pendaftaran akaun baharu ditutup buat sementara waktu. Sila cuba lagi kemudian.',
  )
  await expect(page.getByTestId('register-submit')).toBeDisabled()
  await expectNoHorizontalScroll(page)
}

test.describe('M01 register: registration closed', { tag: [TAG.smoke, moduleTag(1)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('flag false: closed copy up front, submit disabled, no horizontal scroll', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await expectClosedUpFront({ page, gotoApp, mock })
  })

  test.describe('at 320px', () => {
    test.use({ viewport: { width: 320, height: 700 } })

    test('flag false at 320px: closed copy up front, submit disabled, no horizontal scroll', async ({
      page,
      gotoApp,
      mock,
    }) => {
      await expectClosedUpFront({ page, gotoApp, mock })
    })
  })

  test('flag absent: form stays usable', async ({ page, gotoApp }) => {
    await gotoApp('/register')
    await expect(page.getByTestId('register-submit')).toBeEnabled()
    await expect(page.getByTestId('register-alert')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })
})
