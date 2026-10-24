/**
 * M04-T7 developer smoke for S12 (build-plan M04-T7; QA writes the E2E ids at G5): the master notes
 * in the **user** shell with the admin role, the tabs, the 525-note "Semua" list with its pager, and
 * the three row buttons, at 375 / 768 / 1280. The button results after a reload (BR-M04-23) are INFERRED,
 * so those tests are `@provisional`.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isDesktopShell,
  isMobileWidth,
  moduleTag,
  provisional,
  TAG,
} from '../support'

const ADMIN = 'admin@demo.test'
const PATH = '/admin/master-notes'
const SUMMARY = (f: number, a: number) =>
  `Nota AI pemulihan sendiri: ${String(f)} ditanda · ${String(a)} diluluskan guru · 525 jumlah. Semak nota yang ditanda untuk meningkatkan kualiti.`

function rows(page: Page) {
  return page.getByTestId('note-row')
}

async function openAll(page: Page, gotoApp: (path: string) => Promise<void>) {
  await gotoApp(`${PATH}?tab=all`)
  await expect(rows(page).first()).toBeVisible()
}

test.describe('M04 S12 master notes', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('renders in the user shell with the readable header card, the tabs and the empty flagged tab', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    await expect(page.getByTestId('notes-empty')).toHaveText('Tiada nota dalam tab ini.')
    await expect(page.locator('[data-layout="user"]')).toBeVisible()
    await expect(page.locator('[data-layout="admin"]')).toHaveCount(0)
    await expectTabTitle(page, 'Nota Induk — Semakan Admin')
    await expect(page.getByTestId('shell-user-title')).toHaveText('Nota Induk — Semakan Admin')
    await expect(page.getByTestId('shell-user-subtitle')).toHaveCount(0)

    // DV-M04-14: the card h1 is white on the dark card.
    const h1 = page.getByTestId('notes-header').getByRole('heading', { level: 1 })
    await expect(h1).toHaveText('Nota Induk — Semakan Admin')
    expect(await h1.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)')
    await expect(page.getByTestId('notes-summary')).toHaveText(SUMMARY(0, 0))

    // Tabs: flagged is the default and the dark pill.
    await expect(page.getByTestId('notes-tabs').locator('a')).toHaveText([
      'Perlu Semakan',
      'Diluluskan Guru',
      'Semua',
    ])
    await expect(page.getByTestId('notes-tab-flagged')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('notes-tab-all')).toHaveAttribute('data-active', 'false')
    await expectTouchTarget(page.getByTestId('notes-tab-all'))
    // The "Gambar Rajah" badge follows the live M04 count (desktop sidebar only).
    if (isDesktopShell(page)) {
      await expect(page.locator('[data-nav-id="gambar-rajah"]')).toContainText('6,144')
    }
    await expectNoHorizontalScroll(page)
  })

  test('"Diluluskan Guru" is empty and "Semua" switches the active pill', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    await page.getByTestId('notes-tab-approved').click()
    await expect(page).toHaveURL(/tab=approved/)
    await expect(page.getByTestId('notes-tab-approved')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('notes-empty')).toHaveText('Tiada nota dalam tab ini.')
    await page.getByTestId('notes-tab-all').click()
    await expect(page).toHaveURL(/tab=all/)
    await expect(page.getByTestId('notes-tab-all')).toHaveAttribute('data-active', 'true')
    await expect(rows(page)).toHaveCount(15)
    await expectNoHorizontalScroll(page)
  })

  test('"Semua" lists 15 notes with meta line, boxes, buttons and a 35-page pager', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openAll(page, gotoApp)
    await expect(rows(page)).toHaveCount(15)
    const first = rows(page).first()
    await expect(first).toContainText('question_id:')
    await expect(first).toContainText('subject:')
    await expect(first).toContainText('chapter:')
    await expect(first).toContainText('model:')
    await expect(first).toContainText('tokens:')
    await expect(first.getByTestId('note-conf')).toHaveText(/^conf \d+$/)
    await expect(first.getByTestId('note-question')).toContainText('Soalan:')
    await expect(first.getByTestId('note-trap')).toContainText('Perangkap:')
    await expect(first.locator('button')).toHaveText(['Luluskan', 'Jana Semula', 'Buang Tanda'])
    await expectTouchTarget(first.getByTestId('note-approve'))

    const pager = page.getByTestId('notes-pager')
    if (isMobileWidth(page)) {
      await expect(pager.getByText('Next »')).toBeVisible()
    } else {
      await expect(pager).toContainText('Showing 1 to 15 of 525 results')
      await expect(pager.getByRole('link', { name: 'Go to page 35' })).toBeVisible()
    }
    await expectNoHorizontalScroll(page)

    // The pager keeps the tab.
    await pager.getByRole('link', { name: /Next/ }).first().click()
    await expect(page).toHaveURL(/tab=all&page=2$/)
    await expect(rows(page)).toHaveCount(15)
    await expectNoHorizontalScroll(page)
  })

  test(
    'Approve shows "..." then "Done", dims the row, and a reload moves the note to Diluluskan Guru',
    provisional('the effect of Approve is INFERRED (BR-M04-23)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await openAll(page, gotoApp)
      const first = rows(page).first()
      const id = await first.getAttribute('data-note-id')
      const approve = first.getByTestId('note-approve')
      await approve.click()
      await expect(approve).toHaveText('Selesai')
      await expect(approve).toBeDisabled()
      await expect.poll(() => first.evaluate((el) => getComputedStyle(el).opacity)).toBe('0.5')
      // The other buttons stay usable.
      await expect(first.getByTestId('note-regen')).toBeEnabled()

      await page.getByTestId('notes-tab-approved').click()
      await expect(page).toHaveURL(/tab=approved/)
      await expect(page.getByTestId('notes-summary')).toHaveText(SUMMARY(0, 1))
      await expect(rows(page)).toHaveCount(1)
      await expect(rows(page).first()).toHaveAttribute('data-note-id', id ?? '')
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'Regenerate marks the row done and a reload shows the canned note',
    provisional('the effect of Regenerate is INFERRED (BR-M04-23, D4)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await openAll(page, gotoApp)
      const first = rows(page).first()
      const id = (await first.getAttribute('data-note-id')) ?? ''
      const before = await first.getByTestId('note-text').innerText()
      const regen = first.getByTestId('note-regen')
      await regen.click()
      await expect(regen).toHaveText('Selesai')
      await expect(regen).toBeDisabled()

      await page.getByTestId('notes-tab-approved').click()
      await expect(page).toHaveURL(/tab=approved/)
      await page.getByTestId('notes-tab-all').click()
      await expect(page).toHaveURL(/tab=all/)
      const again = page.locator(`[data-note-id="${id}"]`)
      await expect(again).toBeVisible()
      await expect(again.getByTestId('note-text')).not.toHaveText(before)
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'Clear Flag answers at once without a confirm and reads "Done"',
    provisional('the effect of Clear Flag is INFERRED (BR-M04-23)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await openAll(page, gotoApp)
      let dialogs = 0
      page.on('dialog', (d) => {
        dialogs += 1
        void d.dismiss()
      })
      const unflag = rows(page).first().getByTestId('note-unflag')
      await unflag.click()
      await expect(unflag).toHaveText('Selesai')
      await expect(unflag).toBeDisabled()
      expect(dialogs).toBe(0)
    },
  )
})
