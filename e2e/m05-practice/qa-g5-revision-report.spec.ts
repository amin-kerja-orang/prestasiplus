/**
 * QA G5 gap-fill (Session 4, L14): AC-M05-22.2, 22.3, 22.5, 24.1 - 24.4 (S7 question card, feedback
 * copy, failed-check behaviour and the report modal) at 375 / 768 / 1280.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, moduleTag } from '../support'

const tid = (page: Page, id: string) => page.getByTestId(id)
test.describe.configure({ timeout: 180_000 })

async function openChecked(page: Page, loginAs: (w: string) => Promise<unknown>, gotoApp: (p: string) => Promise<void>) {
  await loginAs('pelajarmaju@demo.test')
  await gotoApp('/practice/revision/MATH')
  await expect(tid(page, 'quiz-title')).toBeVisible()
  await tid(page, 'option-A').click()
  await tid(page, 'btn-check').click()
  await expect(tid(page, 'quiz-feedback')).toBeVisible()
}

test.describe('QA-G5 S7 question card, feedback and report modal', { tag: [moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M05-31 / 32 the question card shows "Soalan {i}", "Salah 2x" and a DSKP label; feedback copy follows the answer', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajarmaju@demo.test')
    await gotoApp('/practice/revision/MATH')
    await expect(tid(page, 'quiz-title')).toBeVisible()
    await expect(tid(page, 'quiz-question')).toContainText('Soalan 1')
    await expect(tid(page, 'pill-wrong-times').first()).toHaveText(/Salah 2x/)
    await expect(tid(page, 'quiz-question')).toContainText(/Mengikut DSKP|Latihan Tambahan/)
    await expect(tid(page, 'chip-revision').first()).toBeVisible()
    await tid(page, 'option-A').click()
    await tid(page, 'btn-check').click()
    const correct = (await tid(page, 'quiz-feedback').getAttribute('data-correct')) === 'true'
    await expect(tid(page, 'feedback-title')).toHaveText(
      correct ? 'Betul! Kali ini berjaya!' : 'Masih belum tepat',
    )
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M05-32 a network failure on the check leaves the option selected with no feedback', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs('pelajarmaju@demo.test')
    await gotoApp('/practice/revision/MATH')
    await expect(tid(page, 'quiz-title')).toBeVisible()
    await mock.networkErrorNext('/api/practice/sessions/*/check-answer')
    await tid(page, 'option-A').click()
    await tid(page, 'btn-check').click()
    await expect(tid(page, 'quiz-feedback')).toHaveCount(0)
    await expect(tid(page, 'option-A')).toHaveAttribute('data-state', 'selected')
  })

  test('E2E-M05-35 the report modal: copy, 7 reasons, counter, tints, enable rule', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await openChecked(page, loginAs, gotoApp)
    await tid(page, 'btn-report').click()
    const modal = tid(page, 'report-modal')
    await expect(tid(page, 'report-title')).toHaveText('Lapor Soalan')
    await expect(tid(page, 'report-subtitle')).toHaveText('Soalan ini akan dinyahaktifkan sementara')
    await expect(modal.locator('[data-testid^=report-reason-]')).toHaveCount(7)
    await expect(tid(page, 'report-counter')).toHaveText('0/500')
    await expect(tid(page, 'report-submit')).toBeDisabled()
    await tid(page, 'report-reason-missing_options').click()
    await tid(page, 'report-reason-duplicate').click()
    await expect(tid(page, 'report-reason-missing_options')).toHaveClass(/yellow/)
    await expect(tid(page, 'report-reason-duplicate')).toHaveClass(/blue/)
    await expect(tid(page, 'report-submit')).toBeEnabled()
    await tid(page, 'report-comment').fill('abc')
    await expect(tid(page, 'report-counter')).toHaveText('3/500')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M05-35 sending: "Menghantar...", then "Terima Kasih!" and the stored report has source revision', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await openChecked(page, loginAs, gotoApp)
    await tid(page, 'btn-report').click()
    await tid(page, 'report-reason-duplicate').click()
    await mock.setLatency(1500, '/api/question-reports')
    await tid(page, 'report-submit').click()
    await expect(tid(page, 'report-submit')).toContainText('Menghantar...')
    await expect(tid(page, 'report-done')).toContainText('Terima Kasih!')
    await expect(tid(page, 'report-message')).toHaveText('Laporan berjaya dihantar.')
    const req = await mock.lastRequest('/api/question-reports')
    expect(req?.method).toBe('POST')
    expect((req?.body as { source?: string }).source).toBe('revision')
    await tid(page, 'report-done-close').click()
    await expect(tid(page, 'report-modal')).toHaveCount(0)
  })

  test('E2E-M05-35 a network failure shows the same "Terima Kasih!" view with the failure message (as live)', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await openChecked(page, loginAs, gotoApp)
    await tid(page, 'btn-report').click()
    await tid(page, 'report-reason-typo').click()
    await mock.networkErrorNext('/api/question-reports')
    await tid(page, 'report-submit').click()
    await expect(tid(page, 'report-done')).toContainText('Terima Kasih!')
    await expect(tid(page, 'report-message')).toHaveText('Gagal menghantar laporan. Sila cuba lagi.')
  })

  test('E2E-M05-35 Batal, the X and Esc close the modal without sending; reopening is cleared', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await openChecked(page, loginAs, gotoApp)
    for (const how of ['cancel', 'x', 'esc'] as const) {
      await tid(page, 'btn-report').click()
      await tid(page, 'report-reason-typo').click()
      await tid(page, 'report-comment').fill('x')
      if (how === 'cancel') await tid(page, 'report-cancel').click()
      else if (how === 'x') await tid(page, 'report-close').click()
      else await page.keyboard.press('Escape')
      await expect(tid(page, 'report-modal')).toHaveCount(0)
      await tid(page, 'btn-report').click()
      await expect(tid(page, 'report-counter')).toHaveText('0/500')
      await expect(tid(page, 'report-submit')).toBeDisabled()
      await page.keyboard.press('Escape')
      await expect(tid(page, 'report-modal')).toHaveCount(0)
    }
    const posts = (await mock.requests('/api/question-reports')).filter((r) => r.method === 'POST')
    expect(posts).toHaveLength(0)
  })
})
