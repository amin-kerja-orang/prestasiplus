/**
 * M15 admin Hadiah and Tebusan at 375 / 768 / 1280 (S7-T11; 30 P2-07, P2-08, 48 GAME-21): the catalogue
 * list, a new reward through the form, `Hantar kod` and `Batal` on the queue. The admin (Admin Pusat)
 * works on the mock: 59 rewards, all Off, and the `queue` fixture (one Menunggu, one stored
 * pending_parent_consent, one Dihantar row).
 */

import type { Page } from '@playwright/test'

import { expect as baseExpect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTouchTarget,
  moduleTag,
  viewportWidth,
} from '../support'

const expect = baseExpect.configure({ timeout: Number(process.env.E2E_EXPECT_MS) || 10_000 })

const ADMIN = 'admin@demo.test'
const MODULE = { tag: [moduleTag(15)] }

test.describe.configure({ timeout: 90_000 })
test.use({ mockInit: { latency: 0 } })

/** Client-side navigation (keeps the mock state, unlike a page load). */
async function spaGo(page: Page, path: string): Promise<void> {
  await page.evaluate(async (to) => {
    const el = document.querySelector('#app') as Element & {
      __vue_app__: {
        config: { globalProperties: { $router: { push(p: string): Promise<unknown> } } }
      }
    }
    await el.__vue_app__.config.globalProperties.$router.push(to)
  }, path)
}

/** The table shows from `md`; below it the rows are cards. */
const wide = (page: Page): boolean => viewportWidth(page) >= 768

test.describe('M15 admin Hadiah', MODULE, () => {
  test('list: tiles, pills, 50 a page, bulk toolbar, edit link, out-of-range page @m15', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/hadiah/baharu')
    await mock.hook('m15LoadFixture', 'queue')
    await spaGo(page, '/admin/hadiah')

    await expect(page.getByTestId('hadiah-tile-total')).toContainText('Total Hadiah')
    await expect(page.getByTestId('hadiah-tile-total')).toContainText('59')
    await expect(page.getByTestId('hadiah-tile-active')).toContainText('0')
    await expect(page.getByTestId('hadiah-tile-month')).toContainText('Tebusan Bulan Ini')
    await expect(page.getByTestId('hadiah-tile-pending')).toContainText('Pending Proses')
    await expect(page.getByTestId('hadiah-tile-pending')).toContainText('1')

    // First row of the catalogue, Off, in the shown form of its kind.
    await expect(page.getByTestId('hadiah-status-1')).toHaveText('Off')
    if (wide(page)) await expect(page.getByTestId('hadiah-title-1')).toContainText('Roblox Gift Card RM10')
    else await expect(page.getByTestId('hadiah-card-1')).toContainText('Roblox Gift Card RM10')

    // Pills: Semua first, the category words of OPT-HADIAH-KATEGORI, one active.
    const pills = page.getByRole('navigation', { name: 'Kategori hadiah' }).getByRole('link')
    await expect(pills).toHaveCount(10)
    expect((await pills.allTextContents()).map((t) => t.trim())).toEqual([
      'Semua',
      '🏆 Mahkota',
      '💳 E-Wallet',
      '📱 Telco',
      '🎮 Gaming',
      '🎬 Streaming',
      '🍔 F&B',
      '🛒 E-Commerce',
      '📚 Pembelajaran',
      '🎭 Hiburan',
    ])
    await expectTouchTarget(pills.first())
    await expect(page.getByTestId('hadiah-pill-all')).toHaveAttribute('data-active', 'true')
    await expectNoHorizontalScroll(page)

    // A category filter, and the queue card below the catalogue.
    await page.getByRole('link', { name: '📱 Telco' }).click()
    await expect(page).toHaveURL(/cat=telco/)
    await expect(page.getByTestId('hadiah-pill-telco')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('hadiah-status-9')).toBeVisible()
    await expect(page.getByTestId('tebusan-card-title')).toHaveText('Tebusan Queue')
    await expect(page.getByTestId(wide(page) ? 'tebusan-reward-15101' : 'tebusan-card-15101')).toContainText(
      'TnG eWallet RM10',
    )
    await expectNoHorizontalScroll(page)

    // Select two rows: the sticky bar says how many, with the seven actions.
    await spaGo(page, '/admin/hadiah')
    await expect(page.getByTestId('hadiah-status-1')).toBeVisible()
    const boxes = page.getByTestId('hadiah-table').getByRole('checkbox')
    // The table has a "select all" box first; the cards do not.
    const first = wide(page) ? 1 : 0
    await boxes.nth(first).check()
    await boxes.nth(first + 1).check()
    await expect(page.getByTestId('hadiah-selected')).toHaveText('2 hadiah dipilih')
    for (const [id, label] of [
      ['activate', 'Aktifkan'],
      ['deactivate', 'Nyahaktifkan'],
      ['stock', 'Set Stok'],
      ['max', 'Had/Bulan'],
      ['cost', 'Pelaras Token'],
      ['delete', 'Padam'],
      ['clear', 'Batal'],
    ] as const) {
      const button = page.getByTestId(`hadiah-bulk-${id}`)
      await expect(button).toHaveText(label)
      await expectTouchTarget(button)
    }
    await expectNoHorizontalScroll(page)
    await page.getByTestId('hadiah-bulk-activate').click()
    await expect(page.getByTestId('hadiah-tile-active')).toContainText('2')
    await expect(page.getByTestId('hadiah-status-1')).toHaveText('On')
    await expect(page.getByTestId('hadiah-selected')).toHaveCount(0)

    // A page past the last goes back to the last one.
    await spaGo(page, '/admin/hadiah?page=9')
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByTestId('hadiah-status-59')).toBeVisible()
  })

  test('create: field messages first, then a new reward that is Off @m15', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/hadiah')
    await page.getByTestId('hadiah-add').click()
    await expect(page).toHaveURL(/\/admin\/hadiah\/baharu$/)
    await expect(page.getByTestId('hadiah-form')).toBeVisible()

    // The consent field is not on the form; `api` is not offered.
    await expect(page.getByText('Perlu kelulusan ibu bapa')).toHaveCount(0)
    const delivery = page.getByTestId('hadiah-delivery')
    await expect(delivery.locator('option')).toHaveText(['Manual (admin paste)', 'Instant'])
    await expect(page.getByTestId('hadiah-active')).not.toBeChecked()

    await page.getByRole('button', { name: 'Tambah' }).click()
    for (const message of [
      'Kategori diperlukan.',
      'Vendor diperlukan.',
      'Tajuk diperlukan.',
      'Nilai (RM) diperlukan.',
      'Kos Token diperlukan.',
    ]) {
      await expect(page.getByText(message)).toBeVisible()
    }
    await expectNoHorizontalScroll(page)

    await page.getByTestId('hadiah-category').selectOption('telco')
    await page.getByTestId('hadiah-vendor').fill('Hotlink')
    await page.getByTestId('hadiah-title').fill('Hotlink Topup RM10')
    await page.getByTestId('hadiah-denomination').fill('10')
    await page.getByTestId('hadiah-token-cost').fill('10')
    await page.getByTestId('hadiah-stock').fill('5')
    await page.getByRole('button', { name: 'Tambah' }).click()

    // Back on the list; the new reward (id 60) is in Telco and Off.
    await expect(page).toHaveURL(/\/admin\/hadiah$/)
    await expect(page.getByTestId('hadiah-tile-total')).toContainText('60')
    await spaGo(page, '/admin/hadiah?cat=telco')
    await expect(page.getByTestId('hadiah-status-60')).toHaveText('Off')

    // Edit it: the form is filled and a save returns to the list.
    await page.getByTestId('hadiah-edit-60').click()
    await expect(page).toHaveURL(/\/admin\/hadiah\/60\/edit$/)
    await expect(page.getByTestId('hadiah-title')).toHaveValue('Hotlink Topup RM10')
    await page.getByTestId('hadiah-title').fill('Hotlink Topup RM12')
    await page.getByRole('button', { name: 'Simpan' }).click()
    await expect(page).toHaveURL(/\/admin\/hadiah$/)
    await spaGo(page, '/admin/hadiah?cat=telco')
    if (wide(page)) await expect(page.getByTestId('hadiah-title-60')).toContainText('Hotlink Topup RM12')
    else await expect(page.getByTestId('hadiah-card-60')).toContainText('Hotlink Topup RM12')
  })
})

test.describe('M15 admin Tebusan', MODULE, () => {
  test('deliver a code and cancel with the focus on Batal @m15', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/hadiah')
    await mock.hook('m15LoadFixture', 'queue')
    await mock.hook('m15SetReward', 40, { isActive: true })
    const second = await mock.hook<{ ok: boolean; data: { id: number } }>('m15Redeem', {
      userId: 2,
      rewardId: 40,
    })
    expect(second.ok).toBe(true)
    const extra = String(second.data.id)
    await spaGo(page, '/admin/hadiah/tebusan')

    // Menunggu is the default pill; the other three words are there, the V1 ones are not.
    await expect(page.getByTestId('tebusan-pill-pending_admin')).toHaveAttribute('data-active', 'true')
    const pills = page.getByRole('navigation', { name: 'Status tebusan' }).getByRole('button')
    expect((await pills.allTextContents()).map((t) => t.trim())).toEqual([
      'Menunggu',
      'Dihantar',
      'Dibatalkan',
      'Semua',
    ])
    await expect(page.getByText('Pending Admin')).toHaveCount(0)
    await expect(page.getByTestId('tebusan-deliver-15101')).toBeVisible()
    await expect(page.getByTestId('tebusan-deliver-15102')).toHaveCount(0)
    await expectNoHorizontalScroll(page)

    // Hantar kod: blank is refused in the dialog, then the code is delivered.
    await page.getByTestId('tebusan-deliver-15101').click()
    await page.getByTestId('tebusan-deliver-go').click()
    await expect(page.getByText('Kod baucar diperlukan.')).toBeVisible()
    await page.getByTestId('tebusan-code').fill('ABC-123')
    await page.getByTestId('tebusan-deliver-go').click()
    await expect(page.getByText('Kod dihantar kepada pelajar.')).toBeVisible()
    await expect(page.getByTestId('tebusan-deliver-15101')).toHaveCount(0)
    await page.getByTestId('tebusan-pill-delivered').click()
    await expect(page.getByTestId('tebusan-status-15101')).toHaveText('Dihantar')
    await expect(page.getByTestId('tebusan-status-15103')).toHaveText('Dihantar')
    await expect(page.getByTestId('tebusan-deliver-15101')).toHaveCount(0)
    await expect(page.getByText('Tiada tebusan dalam status ini.')).toHaveCount(0)

    // The stored consent row shows under Semua with Batal only.
    await page.getByTestId('tebusan-pill-all').click()
    await expect(page.getByTestId('tebusan-status-15102')).toHaveText('Menunggu Ibu Bapa')
    await expect(page.getByTestId('tebusan-cancel-15102')).toBeVisible()
    await expect(page.getByTestId('tebusan-deliver-15102')).toHaveCount(0)
    await expectNoHorizontalScroll(page)

    // Batal: the confirmation keeps the focus on Batal, the buttons are 44 px and stack on a phone.
    await page.getByTestId('tebusan-pill-pending_admin').click()
    await page.getByTestId(`tebusan-cancel-${extra}`).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Batalkan tebusan ini?')).toBeVisible()
    await expect(dialog.getByText('Token pelajar akan dipulangkan.')).toBeVisible()
    const keep = page.getByTestId('tebusan-cancel-keep')
    const go = page.getByTestId('tebusan-cancel-go')
    await expect(keep).toBeFocused()
    await expect
      .poll(async () => (await go.boundingBox())!.height, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(43.9)
    await expectTouchTarget(keep)
    await expectTouchTarget(go)
    // The dialog grows into place; measure once it has settled.
    await expect
      .poll(async () => (await keep.boundingBox())!.height, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(43.9)
    if (viewportWidth(page) < 640) {
      // A phone: the bottom sheet stacks the two buttons, one under the other.
      await expect
        .poll(
          async () => {
            const [a, b] = [(await keep.boundingBox())!, (await go.boundingBox())!]
            return Math.abs(a.x - b.x) <= 1 ? b.y - a.y : -1
          },
          { timeout: 5_000 },
        )
        .toBeGreaterThanOrEqual(44)
    }
    await expectNoHorizontalScroll(page)
    await keep.click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByTestId(`tebusan-cancel-${extra}`)).toBeVisible()

    const before = await mock.hook<{ tokenBalance: number }>('getWallet', 2)
    await page.getByTestId(`tebusan-cancel-${extra}`).click()
    await page.getByTestId('tebusan-cancel-go').click()
    await expect(page.getByTestId(`tebusan-cancel-${extra}`)).toHaveCount(0)
    const after = await mock.hook<{ tokenBalance: number }>('getWallet', 2)
    expect(after.tokenBalance).toBe(before.tokenBalance + 10)
    await page.getByTestId('tebusan-pill-cancelled').click()
    await expect(page.getByTestId(`tebusan-status-${extra}`)).toHaveText('Dibatalkan')
  })
})
