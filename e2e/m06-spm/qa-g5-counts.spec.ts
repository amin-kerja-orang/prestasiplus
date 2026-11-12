/**
 * QA G5 (row L18, M06 SPM): AC-M06-02.2 - an approved, active Matematik Tingkatan 5 MCQ in the SPM pool
 * raises the Matematik count on S2/S3, the S4 total and "Tingkatan 5" by 1 while the hub constants stay put.
 *
 * Proof level: in the mock build the AC is proven at the count level only. The row is inserted with the
 * M04 mock hook `createQuestionFixture` (approved, `spmPool`), because Studio, the only create path since
 * the old flat form was retired, is http-only (m04 api/studio.ts:26). The UI create-and-approve path
 * (Studio editor, then publish) is covered only in http mode: no http spec yet creates and approves a
 * Matematik question and then reads these M06 counts.
 *
 * Not covered here: a deactivated Sains question lowering the Sains count by 1 (M04
 * `POST /api/questions/bulk-action` is not used; reported as not executed).
 */

import { navigateInApp, moduleTag } from '../support'
import { expect, test } from './fixtures'
import { ADMIN, statValues, tabCount, tid } from './support'

test.describe.configure({ timeout: 360_000 })
test.use({ mockInit: { latency: 0 } })

const num = (s: string) => Number(s.replace(/[^\d]/g, ''))

test.describe('QA-G5 M06 counts follow M04', { tag: [moduleTag(6)] }, () => {
  test('AC-M06-02.2 a new approved MATH T5 MCQ adds 1 to S2, S3, S4 total and Tingkatan 5', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/spm/latih-tubi/MATH')
    await expect(tid(page, 'config-title')).toBeVisible({ timeout: 60_000 })
    const total0 = num((await tid(page, 'config-sub').innerText()).split('soalan')[0] ?? '')
    const t5_0 = num(await tabCount(page, 'level-11'))
    await navigateInApp(page, '/spm')
    const hub0 = await statValues(tid(page, 'spm-stat-total')).innerText()

    // The flat create form is retired: /admin/questions/create redirects to the Studio editor
    // (m04 routes/questions-form.ts:19-21), and Studio is only available in http mode
    // (m04 api/studio.ts:26 `studioAvailable()`; e2e/m04-question-bank/t4-question-form.spec.ts shows the
    // "studio-unavailable" notice in this mock build). So the new approved Matematik T5 MCQ is inserted
    // through the M04 mock test hook `createQuestionFixture` (m04 mock/index.ts:90-94, repository
    // createFixture: approved, active, objective MCQ by default). The id is in the reserved M11 block
    // 700400-700999 above the highest seeded anchor 700931 (m11 data/anchors.ts:9).
    // Sederhana = difficulty 3; the fixture does not derive the pool flag, so it is set explicitly.
    await mock.hook('createQuestionFixture', {
      id: 700999,
      subjectId: 3,
      educationLevelId: 11,
      status: 'approved',
      isActive: true,
      questionType: 'mcq',
      spmPool: true,
      difficultyLevel: 3,
    })

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
    await expect(statValues(tid(page, 'spm-stat-total'))).toHaveText(hub0)
  })
})
