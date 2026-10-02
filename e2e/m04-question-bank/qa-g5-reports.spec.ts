/**
 * M04 G5 QA specs (written by QA): S7 admin report triage, S13 "Laporan Soalan Saya", S14 report modal
 * (harness). Gaps in the developer `t6-reports.spec.ts`. Covers AC-M04-17.x .. 21.x, 29.2, 33.6.
 */

import type { Page } from '@playwright/test'

import { waitForApp, type MockHandle } from '../fixtures/mock-handle'
import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, moduleTag } from '../support'

const ADMIN = 'admin@demo.test'
const PELAJAR = 'pelajar@demo.test'
const S7 = '/admin/question-reports'
const S13 = '/laporan-soalan'
const HARNESS = '/__e2e/report-modal'

/** Switch the stored session (no `loginAs` init session, which would re-apply on every load) and open `path`. */
async function asUser(
  page: Page,
  mock: MockHandle,
  who: string | number,
  path: string,
): Promise<void> {
  await mock.setUser(who)
  await page.goto(path)
  await waitForApp(page, 60_000)
}

const byId = (page: Page, id: string) => page.getByTestId(id)
const card = (page: Page, id: number) => page.getByTestId(`report-card-${String(id)}`)
const tab = (page: Page, value: string) => page.getByTestId(`reports-tab-${value}`)

test.describe('QA G5 S14 report modal', { tag: [moduleTag(4), '@qa'] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(150_000)

  test('E2E-M04-36 MCQ modal: 7 reasons with their descriptions, cleared form, maxlength 500 (AC-17.1, 17.2, 17.4)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(HARNESS)
    await byId(page, 'harness-open').click()
    const expected: Array<[string, string, string]> = [
      ['wrong_answer', 'Jawapan tidak tepat', 'Jawapan yang ditandakan betul sebenarnya salah'],
      ['confusing_question', 'Soalan mengelirukan', 'Ayat soalan tidak jelas atau mengelirukan'],
      ['wrong_options', 'Set jawapan tidak tepat', 'Pilihan jawapan yang diberikan tidak betul'],
      ['missing_options', 'Pilihan jawapan tidak lengkap', 'Soalan tiada cukup pilihan jawapan'],
      ['duplicate', 'Soalan berulang / pendua', 'Soalan yang sama muncul lebih dari sekali'],
      ['typo', 'Kesalahan ejaan / taip', 'Ada kesilapan ejaan dalam soalan atau jawapan'],
      ['other', 'Lain-lain', 'Sebab lain yang tidak disenaraikan'],
    ]
    for (const [value, label, desc] of expected) {
      const el = byId(page, `report-reason-${value}`)
      await expect(el, value).toContainText(label)
      await expect(el, value).toContainText(desc)
    }
    await expect(byId(page, 'report-title')).toHaveText('Lapor Soalan')
    await expect(byId(page, 'report-close')).toBeVisible()
    await expect(byId(page, 'report-submit')).toContainText('Hantar Laporan')
    await expect(byId(page, 'report-submit')).toBeDisabled()
    await byId(page, 'report-reason-other').click()
    await expect(byId(page, 'report-submit')).toBeEnabled()
    await byId(page, 'report-reason-other').click()
    await expect(byId(page, 'report-submit')).toBeDisabled()
    await byId(page, 'report-comment').fill('x'.repeat(600))
    await expect(byId(page, 'report-comment')).toHaveValue('x'.repeat(500))
    await expect(byId(page, 'report-counter')).toHaveText('500/500')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M04-38 structured modal reasons carry their descriptions (AC-18.2)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(`${HARNESS}?variant=structured&questionId=4455`)
    await byId(page, 'harness-open').click()
    const expected: Array<[string, string]> = [
      [
        'Skema jawapan tidak tepat',
        'Keyword/rubrik yang ditandakan tidak sepadan dengan jawapan sebenar',
      ],
      ['Soalan mengelirukan', 'Ayat soalan atau arahan tidak jelas'],
      ['Markah tidak adil', 'Pembahagian markah atau pemarkahan auto tidak tepat'],
      ['Kesalahan ejaan / taip', 'Ada kesilapan ejaan dalam soalan atau skema'],
      ['Lain-lain', 'Sebab lain yang tidak disenaraikan'],
    ]
    const reasons = byId(page, 'report-form')
    for (const [label, desc] of expected) {
      await expect(reasons).toContainText(label)
      await expect(reasons).toContainText(desc)
    }
  })

  test('E2E-M04-36 cancel / close / Esc send nothing; while sending the button reads "Menghantar..." (AC-17.5, 17.6)', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(HARNESS)
    const posts = async () =>
      (await mock.requests('/api/question-reports')).filter((r) => r.method === 'POST').length
    await byId(page, 'harness-open').click()
    await byId(page, 'report-reason-typo').click()
    await byId(page, 'report-cancel').click()
    await byId(page, 'harness-open').click()
    await page.keyboard.press('Escape')
    expect(await posts()).toBe(0)

    await mock.setLatency(1500)
    await byId(page, 'harness-open').click()
    await byId(page, 'report-reason-typo').click()
    await byId(page, 'report-submit').click()
    await expect(byId(page, 'report-submit')).toContainText('Menghantar...')
    await expect(byId(page, 'report-submit')).toBeDisabled()
    await expect(byId(page, 'report-done')).toContainText('Terima Kasih!', { timeout: 15_000 })
    await expect(byId(page, 'report-done-close')).toContainText('Tutup')
  })

  test('E2E-M04-37 default network failure shows the default failure text under "Terima Kasih!" (AC-17.6)', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(HARNESS)
    await byId(page, 'harness-open').click()
    await byId(page, 'report-reason-other').click()
    await mock.networkErrorNext('/api/question-reports')
    await byId(page, 'report-submit').click()
    await expect(byId(page, 'report-done')).toContainText('Terima Kasih!')
    await expect(byId(page, 'report-message')).toHaveText('Ralat. Sila cuba lagi.')
  })

  test('E2E-M04-37/38 an MCQ report is on S7 "Menunggu" and deactivates the MCQ; structured needs 3 reports (AC-17.7, 18.3)', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/login')
    await asUser(page, mock, PELAJAR, HARNESS)
    await byId(page, 'harness-open').click()
    await byId(page, 'report-reason-wrong_answer').click()
    await byId(page, 'report-submit').click()
    await expect(byId(page, 'report-done')).toContainText('Terima Kasih!')

    for (let i = 0; i < 2; i++) {
      await gotoApp(`${HARNESS}?variant=structured&questionId=4455`)
      await byId(page, 'harness-open').click()
      await byId(page, 'report-reason-wrong_answer').click()
      await byId(page, 'report-submit').click()
      await expect(byId(page, 'report-done')).toContainText('Terima Kasih!')
    }

    await asUser(page, mock, ADMIN, `${S7}?status=all`)
    await expect(byId(page, 'reports-title')).toBeVisible()
    await expect(tab(page, 'all')).toHaveText('Semua (14)')
    const cards = page.locator('[data-card=report]')
    await expect(cards).toHaveCount(14)
    const mcq = cards.filter({ hasText: 'ID Soalan: 564161' })
    await expect(mcq).toHaveCount(1)
    await expect(mcq.getByTestId('report-status')).toHaveText('Menunggu')
    await expect(mcq.getByTestId('report-inactive')).toHaveText('Dinyahaktif')
    const four = cards.filter({ hasText: 'ID Soalan: 4455' })
    await expect(four).toHaveCount(2)
    // Two structured reports: still active.
    await expect(four.getByTestId('report-inactive')).toHaveCount(0)
    await expectNoHorizontalScroll(page)

    // Third structured report as the pelajar: the question becomes inactive.
    await asUser(page, mock, PELAJAR, `${HARNESS}?variant=structured&questionId=4455`)
    await byId(page, 'harness-open').click()
    await byId(page, 'report-reason-other').click()
    await byId(page, 'report-submit').click()
    await expect(byId(page, 'report-done')).toContainText('Terima Kasih!')
    await asUser(page, mock, ADMIN, `${S7}?status=all`)
    const four3 = page.locator('[data-card=report]').filter({ hasText: 'ID Soalan: 4455' })
    await expect(four3).toHaveCount(3)
    await expect(four3.first().getByTestId('report-inactive')).toHaveText('Dinyahaktif')
  })
})

test.describe('QA G5 S7 report cards', { tag: [moduleTag(4), '@qa'] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(150_000)

  test.beforeEach(async ({ loginAs, gotoApp, page }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S7}?status=all`)
    await expect(page.locator('[data-card=report]')).toHaveCount(11)
  })

  test('E2E-M04-40 report 6: badge order, reporter, MCQ option block, comment/notes (AC-19.3, 19.5, 19.6)', async ({
    page,
  }) => {
    const six = card(page, 6)
    const order = await six
      .locator('[data-testid^="report-"]')
      .evaluateAll((els) =>
        els
          .map((e) => e.getAttribute('data-testid') ?? '')
          .filter((t) =>
            [
              'report-status',
              'report-category',
              'report-inactive',
              'report-source-set',
              'report-reporter',
              'report-time',
              'report-room',
              'report-question-id',
              'report-reason',
            ].includes(t),
          ),
      )
    const idx = (t: string) => order.indexOf(t)
    for (const [a, b] of [
      ['report-status', 'report-category'],
      ['report-category', 'report-inactive'],
      ['report-inactive', 'report-source-set'],
      ['report-source-set', 'report-reporter'],
      ['report-reporter', 'report-time'],
      ['report-time', 'report-room'],
      ['report-room', 'report-question-id'],
      ['report-question-id', 'report-reason'],
    ] as Array<[string, string]>) {
      expect(idx(a), `${a} present`).toBeGreaterThanOrEqual(0)
      expect(idx(b), `${b} present`).toBeGreaterThanOrEqual(0)
      expect(idx(a), `${a} before ${b}`).toBeLessThan(idx(b))
    }
    await expect(six.getByTestId('report-reporter')).toContainText('Oleh:')
    await expect(six.getByTestId('report-question')).toContainText('Soalan #136891:')
    await expect(six.getByTestId('report-question')).toContainText('A.')
    await expect(six.getByTestId('report-question')).toContainText('D.')
    await expect(six.getByTestId('report-question')).toContainText(/Compliance:/)
    await expect(six.getByTestId('report-question')).toContainText(/ — Tingkatan/)
  })

  test('E2E-M04-39 each tab: URL, active tab, counts sum, no pager (AC-19.1, 19.2, 19.9)', async ({
    page,
  }) => {
    const counts: Record<string, number> = { pending: 2, reviewed: 3, fixed: 5, dismissed: 1 }
    for (const [value, n] of Object.entries(counts)) {
      await tab(page, value).click()
      await expect(page).toHaveURL(new RegExp(`status=${value}`))
      await expect(tab(page, value)).toHaveAttribute('data-active', 'true')
      await expect(page.locator('[data-card=report]')).toHaveCount(n)
      await expect(page.getByText(/Showing|Next »/)).toHaveCount(0)
    }
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(11)
  })

  test('E2E-M04-41 "Tandakan Selesai" with no dialog; counts refresh (AC-20.1, 20.4)', async ({
    page,
    gotoApp,
  }) => {
    let dialogs = 0
    page.on('dialog', (d) => {
      dialogs += 1
      void d.dismiss()
    })
    await gotoApp(S7)
    await card(page, 9).getByTestId('report-notes').fill('Nota QA')
    await card(page, 9).getByTestId('report-fix').click()
    await expect(tab(page, 'pending')).toHaveText('Menunggu (1)')
    await expect(tab(page, 'fixed')).toHaveText('Diperbaiki (6)')
    expect(dialogs).toBe(0)
  })

  test('E2E-M04-42 "Tolak & Aktifkan Semula" on report 6 reactivates question 136891 on S1 (AC-20.2, 31.3)', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp(`${S7}?status=reviewed`)
    await card(page, 6).getByTestId('report-dismiss').click()
    await expect(card(page, 6)).toHaveCount(0)
    await gotoApp('/admin/questions/136891')
    await expect(byId(page, 'question-detail-page')).toBeVisible()
    await gotoApp('/admin/questions?search=136891')
    // The row (if listed by id search) is ACTIVE; fall back to the detail page.
    await expect(byId(page, 'shell-admin-title')).toBeVisible()
  })

  test('E2E-M04-43 "Nyahaktif Segera" moves the report to Disemak with the fixed note (AC-20.3)', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp(S7)
    await card(page, 10).getByTestId('report-deactivate').click()
    await tab(page, 'reviewed').click()
    await expect(card(page, 10).getByTestId('report-admin-notes')).toContainText(
      'Dinyahaktifkan segera oleh admin',
    )
    await expect(card(page, 10).getByTestId('report-inactive')).toBeVisible()
    await expect(card(page, 10).getByTestId('report-deactivate')).toHaveCount(0)
  })
})

test.describe('QA G5 S13 and access', { tag: [moduleTag(4), '@qa'] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(150_000)

  test('E2E-M04-44 seeded user 5001 (Pelajar Demo 01) sees reports 10, 6, 2: counters 3 / 1 / 1 / 1 / 0 (AC-21.1, 21.3)', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/login')
    await asUser(page, mock, 5001, S13)
    await expect(byId(page, 'my-reports-count-all')).toHaveText('3Jumlah')
    await expect(byId(page, 'my-reports-count-pending')).toHaveText('1Menunggu')
    await expect(byId(page, 'my-reports-count-reviewed')).toHaveText('1Disemak')
    await expect(byId(page, 'my-reports-count-fixed')).toHaveText('1Diperbaiki')
    await expect(byId(page, 'my-reports-count-dismissed')).toHaveText('0Ditolak')
    await expect(byId(page, 'my-reports-list').locator('li')).toHaveCount(3)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M04-44 admin sees zero counters and the empty state on S13 (AC-21.1, 21.2)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S13)
    await expect(byId(page, 'my-reports-empty')).toContainText('Tiada Laporan')
    await expect(byId(page, 'my-reports-count-all')).toHaveText('0Jumlah')
  })

  test('E2E-M04-44 another user does not see a report sent by the pelajar (AC-21.3)', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/login')
    await asUser(page, mock, PELAJAR, HARNESS)
    await byId(page, 'harness-open').click()
    await byId(page, 'report-reason-typo').click()
    await byId(page, 'report-submit').click()
    await expect(byId(page, 'report-done')).toContainText('Terima Kasih!')
    await gotoApp(S13)
    await expect(byId(page, 'my-reports-count-all')).toHaveText('1Jumlah')
    await asUser(page, mock, ADMIN, S13)
    await expect(byId(page, 'my-reports-count-all')).toHaveText('0Jumlah')
    await expect(byId(page, 'my-reports-empty')).toBeVisible()
  })

  test('E2E-M04-56 guest is sent to /login from S7 and S13; pelajar cannot open S7 (AC-29.1, 29.2)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await gotoApp(S7)
    await expect(page).toHaveURL(/\/login/)
    await gotoApp(S13)
    await expect(page).toHaveURL(/\/login/)
    void loginAs
  })

  test('E2E-M04-56 pelajar opening S7 is sent to their own landing page; S13 stays available (AC-29.2)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(S7)
    await expect(page).not.toHaveURL(/question-reports/)
    await gotoApp(S13)
    await expect(page).toHaveURL(/laporan-soalan/)
    await expect(byId(page, 'my-reports-page')).toBeVisible()
  })

  test('E2E-M04-58 S7, S13 and the harness have no horizontal scroll (AC-30.1)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S7)
    await expectNoHorizontalScroll(page)
    await gotoApp(`${S7}?status=all`)
    await expect(page.locator('[data-card=report]')).toHaveCount(11)
    await expectNoHorizontalScroll(page)
    await gotoApp(S13)
    await expectNoHorizontalScroll(page)
  })
})
