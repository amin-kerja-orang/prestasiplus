/**
 * M05-T4 developer smoke (build-plan M05-T4; QA writes the E2E-M05-nn ids at G5): the reusable quiz
 * component and its three screens — S2 `/practice`, S3 `/practice/:code`, Q1 `/practice/:code/quiz` —
 * at 375 / 768 / 1280: list, configuration, a full quiz run to the results, the trial gate, an unknown
 * code. The scenario-level checks (SRS §12 rows 14, 16–23, 54) are in `practice-s2-s3-q1.spec.ts`.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  moduleTag,
  TAG,
} from '../support'

const PELAJAR = 'pelajar@demo.test'
const PELAJARMAJU = 'pelajarmaju@demo.test'
const ADMIN = 'admin@demo.test'

const tid = (page: Page, id: string) => page.getByTestId(id)

test.describe('M05 S2 / S3 / Q1 smoke', { tag: [TAG.smoke, moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('S2 lists the subjects, S3 opens from a card and Q1 from "Mula Kuiz"', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJARMAJU)
    await gotoApp('/practice')
    await expectTabTitle(page, 'Latih Tubi | PRESTASIPLUS')
    await expect(tid(page, 'shell-user-title')).toHaveText('Latih Tubi')
    await expect(tid(page, 'practice-title')).toHaveText('Latih Tubi 🎯')
    await expect(tid(page, 'chapter-banner')).toHaveAttribute('href', '/practice/chapter')
    await expect(page.locator('[data-testid^=subject-card-]')).toHaveCount(31)
    await expectNoHorizontalScroll(page)

    await tid(page, 'subject-card-MATH').click()
    await expect(page).toHaveURL(/\/practice\/MATH$/)
    await expectTabTitle(page, 'Matematik - Latihan')
    await expect(tid(page, 'shell-user-title')).toHaveText('Latih Tubi')
    await expect(tid(page, 'config-name')).toHaveText('Matematik')
    await expect(tid(page, 'config-start')).toHaveAttribute('href', '/practice/MATH/quiz?count=10')
    await expectNoHorizontalScroll(page)

    await tid(page, 'level-1').click()
    await tid(page, 'count-5').click()
    await tid(page, 'config-start').click()
    await expect(page).toHaveURL(/\/practice\/MATH\/quiz\?level=1&count=5$/)
    await expect(tid(page, 'quiz-title')).toHaveText('Matematik')
    await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 5')
    await expectNoHorizontalScroll(page)
  })

  test('Q1 runs from the first question to the results and starts again', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJARMAJU)
    await gotoApp('/practice/MATH/quiz?level=1&count=5')
    await expect(tid(page, 'quiz-title')).toHaveText('Matematik')

    // Option buttons are touch targets (44 px) and the question is plain text.
    await expectTouchTarget(tid(page, 'option-A'))
    await expect(tid(page, 'btn-check')).toHaveCount(0)
    await tid(page, 'option-A').click()
    await expect(tid(page, 'option-A')).toHaveAttribute('data-state', 'selected')
    await expectTouchTarget(tid(page, 'btn-check'))
    await tid(page, 'btn-check').click()
    await expect(tid(page, 'quiz-feedback')).toBeVisible()
    await expectTouchTarget(tid(page, 'btn-report'))
    await expectNoHorizontalScroll(page)

    // Finish: the first answer is already checked; carry on with the remaining four.
    await tid(page, 'btn-next').click()
    expect(await answerFrom(page, 2, 5)).toHaveLength(4)

    await expect(tid(page, 'result-title')).toHaveText('Keputusan Latihan')
    await expect(tid(page, 'result-subject')).toHaveText('Matematik')
    await expect(tid(page, 'result-back')).toHaveAttribute('href', '/practice/MATH')
    await expect(tid(page, 'result-rewards')).toBeVisible()
    await expectNoHorizontalScroll(page)

    await tid(page, 'result-retry').click()
    await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 5')
  })

  test('the trial gate sends an admin with no free questions left to /pricing', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/practice/MATH')
    await expect(tid(page, 'config-trial')).toContainText('Baki percubaan percuma: 0 soalan lagi.')
    await tid(page, 'config-start').click()
    await expect(page).toHaveURL(/\/pricing$/)
    expect(await page.evaluate(() => document.body.innerText)).not.toContain('Memuat Soalan')
  })

  test('an unknown code is the global 404 page on S3 and Q1', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/practice/XYZ')
    await expectTabTitle(page, 'Halaman Tidak Dijumpai | PRESTASIPLUS')
    await gotoApp('/practice/XYZ/quiz?count=10')
    await expectTabTitle(page, 'Halaman Tidak Dijumpai | PRESTASIPLUS')
  })
})

/** Picks "A", checks and goes on from question `from` (1-based) through `count`; returns which were right. */
async function answerFrom(page: Page, from: number, count: number): Promise<boolean[]> {
  const right: boolean[] = []
  for (let i = from; i <= count; i++) {
    await expect(tid(page, 'quiz-progress-text')).toHaveText(`Soalan ${i} daripada ${count}`)
    await tid(page, 'option-A').click()
    await tid(page, 'btn-check').click()
    const feedback = tid(page, 'quiz-feedback')
    await expect(feedback).toBeVisible()
    right.push((await feedback.getAttribute('data-correct')) === 'true')
    await tid(page, 'btn-next').click()
  }
  return right
}
