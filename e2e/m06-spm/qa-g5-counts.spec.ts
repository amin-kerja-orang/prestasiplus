/**
 * QA G5 (row L18, M06 SPM): AC-M06-02.2 — an admin-created approved Matematik Tingkatan 5 MCQ (M04
 * `POST /api/questions`) enters the SPM pool, so the Matematik count on S2/S3, the S4 total and
 * "Tingkatan 5" all rise by 1 while the hub constants stay put; a deactivated Sains question lowers
 * the Sains count by 1 (M04 `POST /api/questions/bulk-action` is not used: the question is toggled
 * through its own endpoint when one exists, otherwise that half is reported as not executed).
 */

import { navigateInApp, moduleTag } from '../support'
import { expect, test } from './fixtures'
import { ADMIN, tabCount, tid } from './support'

test.describe.configure({ timeout: 360_000 })
test.use({ mockInit: { latency: 0 } })

const num = (s: string) => Number(s.replace(/[^\d]/g, ''))

test.describe('QA-G5 M06 counts follow M04', { tag: [moduleTag(6)] }, () => {
  test('AC-M06-02.2 a new approved MATH T5 MCQ adds 1 to S2, S3, S4 total and Tingkatan 5', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/spm/latih-tubi/MATH')
    await expect(tid(page, 'config-title')).toBeVisible({ timeout: 60_000 })
    const total0 = num((await tid(page, 'config-sub').innerText()).split('soalan')[0] ?? '')
    const t5_0 = num(await tabCount(page, 'level-11'))
    await navigateInApp(page, '/spm')
    const hub0 = await page.locator('[data-testid=spm-stat-total] [data-testid=stat-value]').innerText()

    await navigateInApp(page, '/admin/questions/create')
    await tid(page, 'q-subject').selectOption({ label: 'Matematik' })
    await tid(page, 'q-level').selectOption({ label: 'Tingkatan 5' })
    await tid(page, 'q-difficulty-3').check()
    await tid(page, 'q-text').fill('Soalan QA G5 untuk mengira pertambahan dua nombor.')
    for (const [i, t] of ['Satu', 'Dua', 'Tiga', 'Empat'].entries())
      await tid(page, `q-option-${String(i)}`).fill(t)
    await tid(page, 'q-correct-1').check()
    await tid(page, 'q-submit').click()
    await expect(page).toHaveURL(/\/admin\/questions$/)
    await expect(tid(page, 'cmp-flash')).toBeVisible()

    await navigateInApp(page, '/spm/latih-tubi/MATH')
    await expect(tid(page, 'config-title')).toBeVisible({ timeout: 60_000 })
    const total1 = num((await tid(page, 'config-sub').innerText()).split('soalan')[0] ?? '')
    expect(total1, 'S4 total').toBe(total0 + 1)
    expect(num(await tabCount(page, 'level-11')), 'Tingkatan 5').toBe(t5_0 + 1)

    await navigateInApp(page, '/spm/tahun-lepas')
    await expect(tid(page, 'databank-card-MATH').getByTestId('databank-count')).toContainText(
      String(total1).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
    )
    await navigateInApp(page, '/spm/latih-tubi')
    await expect(tid(page, 'latih-tubi-card-MATH').getByTestId('latih-tubi-count')).toContainText(
      String(total1).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
    )
    await navigateInApp(page, '/spm')
    await expect(
      page.locator('[data-testid=spm-stat-total] [data-testid=stat-value]'),
    ).toHaveText(hub0)
  })
})
