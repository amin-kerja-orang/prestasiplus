/**
 * M09 Perutusan S22..S25 `/perutusan`, `/perutusan/:id`, `/perutusan/tulis`, `/perutusan/saya` at
 * 375 / 768 / 1280 (card S5-T09, R1-AS-2). Mock mode. Teacher: list then detail, no compose. School
 * admin: compose then "Perutusan Saya"; the sidebar does not show "Perutusan" (Delivery A, AC-SH-2)
 * but the route works. No horizontal page scroll and 44 px touch targets at every size.
 */

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTouchTarget, isDesktopShell, moduleTag } from '../support'

const MODULE = { tag: [moduleTag(9)] }
const TEACHER = 'guru@demo.test'
const SCHOOL_ADMIN = 'adminsekolah@demo.test'

test.use({ mockInit: { latency: 0 } })
test.describe.configure({ timeout: 90_000 })

test.describe('M09 Perutusan (teacher)', MODULE, () => {
  test('list shows the header, cards without the author name, then opens the detail', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(TEACHER)
    await gotoApp('/perutusan')
    await expect(page.getByRole('heading', { name: 'Perutusan', level: 1, exact: true })).toBeVisible()
    const cards = page.getByTestId('perutusan-card')
    await expect(cards.first()).toBeVisible()
    await expect(page.getByTestId('perutusan-write')).toHaveCount(0)
    await expect(page.getByTestId('perutusan-byline').first()).toContainText(' · ')
    await expectNoHorizontalScroll(page)
    if (isDesktopShell(page)) {
      await expect(
        page
          .getByRole('navigation', { name: 'Menu utama' })
          .getByRole('link', { name: 'Perutusan', exact: true }),
      ).toBeVisible()
    }

    const first = cards.first().getByTestId('perutusan-card-link')
    await expectTouchTarget(first)
    const title = (await first.innerText()).trim()
    await first.click()
    await expect(page).toHaveURL(/\/perutusan\/\d+$/)
    await expect(page.getByTestId('perutusan-title')).toHaveText(title)
    await expect(page.getByTestId('perutusan-body')).toBeVisible()
    await expect(page.getByTestId('perutusan-back')).toHaveText('← Perutusan')
    await expectNoHorizontalScroll(page)
    await page.getByTestId('perutusan-back').click()
    await expect(page).toHaveURL(/\/perutusan$/)
  })

  test('a teacher cannot open the compose page', async ({ page, gotoApp, loginAs }) => {
    await loginAs(TEACHER)
    await gotoApp('/perutusan/tulis')
    await expect(page.getByTestId('perutusan-compose-form')).toHaveCount(0)
    await expect(page.getByText('Akses Ditolak').first()).toBeVisible()
  })
})

test.describe('M09 Perutusan (school admin)', MODULE, () => {
  test('compose validates, sends and lands on "Perutusan Saya"', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(SCHOOL_ADMIN)
    await gotoApp('/perutusan/tulis')
    await expect(page.getByTestId('perutusan-compose-form')).toBeVisible()
    await expect(page.getByTestId('perutusan-scope-input').inputValue()).resolves.toBe('Sekolah')
    await expectNoHorizontalScroll(page)

    const submit = page.getByTestId('perutusan-submit')
    await expectTouchTarget(submit)
    await submit.click()
    await expect(page.getByText('Sila isi tajuk perutusan.')).toBeVisible()
    await expect(page.getByText('Sila isi kandungan perutusan.')).toBeVisible()

    await page.getByTestId('perutusan-title-input').fill('Perutusan ujian E2E')
    await page.getByTestId('perutusan-body-input').fill('Kandungan ujian.')
    await submit.click()
    await expect(page).toHaveURL(/\/perutusan\/saya$/)
    await expect(page.getByText('Perutusan dihantar.')).toBeVisible()
    await expect(
      page.getByTestId('perutusan-mine-row').filter({ hasText: 'Perutusan ujian E2E' }),
    ).toBeVisible()
    await expect(page.getByTestId('perutusan-mine-status').first()).toHaveText('Diterbitkan')
    await expectNoHorizontalScroll(page)
  })

  test('the route works while the sidebar item stays hidden', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(SCHOOL_ADMIN)
    await gotoApp('/perutusan')
    await expect(page.getByRole('heading', { name: 'Perutusan', level: 1, exact: true })).toBeVisible()
    await expect(page.getByTestId('perutusan-write')).toBeVisible()
    await expectTouchTarget(page.getByTestId('perutusan-write'))
    if (isDesktopShell(page)) {
      await expect(
        page
          .getByRole('navigation', { name: 'Menu utama' })
          .getByRole('link', { name: 'Perutusan', exact: true }),
      ).toHaveCount(0)
    }
    await expectNoHorizontalScroll(page)
  })
})
