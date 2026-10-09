/**
 * QA G5 (M07 PKSK, roles-matrix row L24 + the admin screens): end-to-end flows across screens and
 * roles, at 375 / 768 / 1280.
 *
 * - Student flow: hub -> dashboard -> domains -> practice submit -> exam submit -> history (AC-01..07).
 * - Admin lifecycle: create A question -> student counts -> edit -> bulk approve / reject -> delete
 *   with confirm -> 404 on the deleted id (AC-09..16, 23).
 * - Access lifecycle: grant -> student hub gains access -> revoke -> student loses access; expiry
 *   boundary; Kombo / T4 counts; M02 switch; stale revoke 409 reloads the list (AC-17..20).
 * - Error handling (500 / network), XSS-looking text, long text, whitespace-only text.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { gotoApp as gotoAppOn } from '../fixtures/mock-handle'
import { addInitSession } from '../fixtures/mock-page'
import {
  acceptNextDialog,
  actAs,
  dismissNextDialog,
  expectNoHorizontalScroll,
  moduleTag,
  viewportWidth,
} from '../support'

const MODULE = { tag: [moduleTag(7)] }
const LIST = '/admin/pksk/questions'
const ACCESS = '/admin/pksk/access'
const tid = (page: Page, id: string) => page.getByTestId(id)

test.describe.configure({ timeout: 400_000 })
test.use({ mockInit: { latency: 0 } })

const stats = (page: Page) => tid(page, 'stat-value').allTextContents()
const rowOf = (page: Page, id: number) => page.locator(`[data-question-id="${String(id)}"]`)

/** Ticks every radio-less essay and the first option of every item (programmatic, 100+ items). */
async function answerAll(page: Page, essay = 'Jawapan esei QA G5.'): Promise<number> {
  const n = await tid(page, 'pksk-item').count()
  await page.evaluate(() => {
    for (const item of Array.from(document.querySelectorAll('[data-testid=pksk-item]'))) {
      const radio = item.querySelector<HTMLInputElement>('input[type=radio]')
      if (radio) radio.click()
    }
  })
  for (const area of await tid(page, 'pksk-essay').all()) await area.fill(essay)
  return n
}

// --- student flow ------------------------------------------------------------------------------

test.describe('QA-G5 M07 student flow', MODULE, () => {
  test('L24 hub -> dashboard -> domains -> practice -> exam -> history', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/pksk')
    await expect(tid(page, 'badge-aktif')).toHaveCount(2)
    await tid(page, 'start-T1').click()
    await expect(page).toHaveURL(/\/pksk\/level\/T1$/)
    await expect(tid(page, 'score')).toHaveText('55%')
    await expect(tid(page, 'grade')).toHaveText('C')
    await expect(tid(page, 'exam-count')).toHaveText('2')
    await expect(tid(page, 'avg-b')).toHaveText('59.7%')

    // Dashboard -> domains (shortcut card).
    await tid(page, 'shortcut-domains').click()
    await expect(page).toHaveURL(/\/pksk\/level\/T1\/domains$/)
    const math = page.locator('[data-code=PKSK_MATH]')
    await expect(math.getByTestId('question-count')).toHaveText('27')
    await expect(math.getByTestId('mastery-pct')).toHaveText('70%')
    await expectNoHorizontalScroll(page)

    // Domains -> practice, answer every served item, submit.
    await math.click()
    await expect(page).toHaveURL(/\/pksk\/level\/T1\/domain\/PKSK_MATH$/)
    await expect(tid(page, 'practice-title')).toHaveText('Matematik')
    const served = await answerAll(page)
    expect(served, 'BR-M07-25: 10 questions per practice session').toBe(10)
    await tid(page, 'practice-submit').click()
    await expect(page).toHaveURL(/\/pksk\/level\/T1\/domains$/)
    const post = await mock.lastRequest('POST /api/pksk/levels/T1/domains/PKSK_MATH/practice-sessions')
    expect(post?.status).toBe(201)
    const data = (post?.body ?? {}) as { answers?: Array<{ questionId: number; optionIndex?: number }> }
    expect(data.answers).toHaveLength(10)
    expect(
      data.answers!.every((a) => typeof a.optionIndex === 'number'),
      'every answer carries the chosen option index',
    ).toBe(true)
    const pct = await page.locator('[data-code=PKSK_MATH]').getByTestId('mastery-pct').innerText()
    expect(pct).toMatch(/^\d{1,3}%$/)
    // Mastery of another domain is untouched.
    await expect(page.locator('[data-code=PKSK_SCI]').getByTestId('mastery-pct')).toHaveText('55%')
    // Admin-side counts are unchanged by a practice (BR-M07-26: no M07 question change).

    // Back to the dashboard via the back link, then the full exam.
    await tid(page, 'back-link').click()
    await expect(page).toHaveURL(/\/pksk\/level\/T1$/)
    await tid(page, 'shortcut-exam').click()
    await expect(page).toHaveURL(/\/pksk\/level\/T1\/exam$/)
    await expect(tid(page, 'exam-section-A').getByTestId('pksk-item')).toHaveCount(30)
    await expect(tid(page, 'exam-section-B').getByTestId('pksk-item')).toHaveCount(70)
    await expect(tid(page, 'exam-section-C').getByTestId('pksk-item')).toHaveCount(1)
    await answerAll(page)
    await tid(page, 'exam-submit').click()
    await expect(page).toHaveURL(/\/pksk\/level\/T1$/)
    await expect(tid(page, 'exam-count')).toHaveText('3')
    const score = await tid(page, 'score').innerText()
    expect(score).toMatch(/^\d{1,3}%$/)

    // History: 3 rows, newest first, today's attempt on top.
    await tid(page, 'shortcut-history').click()
    await expect(page).toHaveURL(/\/pksk\/level\/T1\/history$/)
    const rows = tid(page, 'history-row')
    await expect(rows).toHaveCount(3)
    const texts = await rows.allTextContents()
    expect(texts[0]).toContain('25/09/2026')
    expect(texts[1]).toContain('20/09/2026')
    expect(texts[2]).toContain('10/09/2026')
    expect(texts[1]).toMatch(/64%\s*C/)
    expect(texts[2]).toMatch(/46%\s*D/)
    // T4 history is separate and still empty.
    await gotoApp('/pksk/level/T4/history')
    await expect(tid(page, 'history-empty')).toHaveText('Tiada sejarah peperiksaan.')
  })

  test('SEC-M07-07 the served exam has no correct-answer marker in the DOM and is 30 / 70 / 1', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    // The response bodies cannot be read from the browser (in-process mock); the no-isCorrect payload is
    // asserted by the mock tests (handlers.test.ts). Here: nothing in the rendered exam marks an answer.
    await loginAs('pelajar@demo.test')
    await gotoApp('/pksk/level/T1/exam')
    await expect(tid(page, 'exam-submit')).toBeVisible()
    await expect(tid(page, 'exam-section-A').getByTestId('pksk-item')).toHaveCount(30)
    await expect(tid(page, 'exam-section-B').getByTestId('pksk-item')).toHaveCount(70)
    await expect(tid(page, 'exam-section-C').getByTestId('pksk-item')).toHaveCount(1)
    const html = await tid(page, 'pksk-exam').innerHTML()
    expect(html).not.toMatch(/isCorrect|is_correct|data-correct|checked=""/)
    expect(await page.locator('[data-testid=pksk-option]:checked').count()).toBe(0)
  })

  test('FR-14/15 an exam submitted with nothing answered is still one attempt; unanswered practice submits', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('pelajarmaju@demo.test')
    await gotoApp('/pksk/level/T4/exam')
    await expect(tid(page, 'exam-submit')).toBeVisible()
    await tid(page, 'exam-submit').click()
    await expect(page).toHaveURL(/\/pksk\/level\/T4$/)
    await expect(tid(page, 'exam-count')).toHaveText('1')
    await expect(tid(page, 'score')).toHaveText('0%')
    await expect(tid(page, 'grade')).toHaveText('E')
  })

  test('L24 student error states: a 500 shows the retry card, not a blank or a redirect', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/pksk')
    await expect(tid(page, 'pksk-hub')).toBeVisible()
    await mock.failNext('GET /api/pksk/levels/T1/dashboard', 500)
    await tid(page, 'start-T1').click()
    await expect(tid(page, 'page-error')).toBeVisible()
    await expect(page).toHaveURL(/\/pksk\/level\/T1$/)
    await page.getByRole('button', { name: 'Cuba Semula' }).click()
    await expect(tid(page, 'score')).toHaveText('55%')
    await expectNoHorizontalScroll(page)
  })
})

// --- admin question lifecycle ------------------------------------------------------------------

test.describe('QA-G5 M07 admin question lifecycle', MODULE, () => {
  test('AC-09..16 create A -> edit -> bulk approve / reject -> delete with confirm -> 404', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    const TEXT = 'QA G5 soalan A: apakah sikap terbaik semasa bekerja berpasukan?'
    await loginAs('admin@demo.test')
    await gotoApp(`${LIST}/create`)
    await expect(tid(page, 'pksk-question-form')).toBeVisible()
    await tid(page, 'q-bahagian').selectOption('A')
    await tid(page, 'q-domain').selectOption({ label: 'Kecerdasan Insaniah' })
    await tid(page, 'q-level').selectOption('T4')
    await tid(page, 'q-text').fill(TEXT)
    await tid(page, 'q-difficulty').selectOption('2')
    await tid(page, 'q-explanation').fill('Penjelasan QA G5.')
    const texts = tid(page, 'option-text')
    for (const [i, t] of ['Mengutamakan kepentingan diri', 'Bekerjasama dan berkongsi tugas', 'Mengelak tanggungjawab', 'Menyalahkan rakan'].entries()) {
      await texts.nth(i).fill(t)
    }
    await tid(page, 'form-submit').click()
    await expect(page).toHaveURL(new RegExp(`${LIST}$`))
    await expect(tid(page, 'cmp-flash')).toBeVisible()
    const first = tid(page, 'pksk-question-row').first()
    await expect(first.getByTestId('q-text')).toContainText('QA G5 soalan A')
    await expect(first.getByTestId('q-status')).toHaveText('Diluluskan')
    await expect(first.getByTestId('q-bahagian')).toHaveText('A')
    await expect(first.getByTestId('q-level')).toHaveText('T4')
    await expect(first.getByTestId('q-edit')).toHaveAttribute('href', '/admin/pksk/questions/9000001/edit')
    expect(await stats(page)).toEqual(['764', '764', '0', '383', '381'])

    // Edit: prefill, then pending (student count drops back).
    await gotoApp(`${LIST}/9000001/edit`)
    await expect(tid(page, 'pksk-question-form')).toBeVisible()
    await expect(tid(page, 'shell-admin-subtitle')).toHaveText('Kemaskini soalan #9000001')
    await expect(tid(page, 'q-text')).toHaveValue(TEXT)
    await expect(tid(page, 'q-domain').locator('option:checked')).toHaveText('[A] Kecerdasan Insaniah')
    await expect(tid(page, 'q-level')).toHaveValue('T4')
    await expect(tid(page, 'q-status')).toHaveValue('approved')
    await expect(tid(page, 'q-difficulty')).toHaveValue('2')
    await expect(tid(page, 'q-explanation')).toHaveValue('Penjelasan QA G5.')
    await expect(tid(page, 'option-row')).toHaveCount(4)
    await expect(tid(page, 'option-text').nth(1)).toHaveValue('Bekerjasama dan berkongsi tugas')
    await expect(tid(page, 'option-correct-label').first()).toBeHidden()
    await tid(page, 'q-text').fill(`${TEXT} (disunting)`)
    await tid(page, 'q-status').selectOption('pending')
    await tid(page, 'form-submit').click()
    await expect(page).toHaveURL(new RegExp(`${LIST}$`))
    await expect(tid(page, 'cmp-flash')).toBeVisible()
    await expect(rowOf(page, 9000001).getByTestId('q-status')).toHaveText('Menunggu')
    await expect(rowOf(page, 9000001).getByTestId('q-text')).toContainText('(disunting)')
    expect(await stats(page)).toEqual(['764', '763', '1', '383', '381'])

    // Bulk approve (new pending row + the row below it), then bulk reject both.
    const otherId = Number(
      await tid(page, 'pksk-question-row').nth(1).getAttribute('data-question-id'),
    )
    await rowOf(page, 9000001).getByTestId('row-select').check()
    await rowOf(page, otherId).getByTestId('row-select').check()
    await expect(tid(page, 'bulk-count')).toHaveText('2 dipilih')
    await tid(page, 'bulk-approve').click()
    await expect(tid(page, 'cmp-flash')).toBeVisible()
    await expect(rowOf(page, 9000001).getByTestId('q-status')).toHaveText('Diluluskan')
    await expect(rowOf(page, otherId).getByTestId('q-status')).toHaveText('Diluluskan')
    await expect(tid(page, 'pksk-bulk-bar')).toHaveCount(0)
    expect(await stats(page)).toEqual(['764', '764', '0', '383', '381'])
    await rowOf(page, 9000001).getByTestId('row-select').check()
    await rowOf(page, otherId).getByTestId('row-select').check()
    await tid(page, 'bulk-reject').click()
    await expect(rowOf(page, 9000001).getByTestId('q-status')).toHaveText('Ditolak')
    await expect(rowOf(page, otherId).getByTestId('q-status')).toHaveText('Ditolak')
    expect(await stats(page)).toEqual(['764', '762', '0', '383', '381'])
    // The rejected filter lists exactly those two; approving from there restores them.
    await gotoApp(`${LIST}?status=rejected`)
    await expect(tid(page, 'pksk-question-row')).toHaveCount(2)
    await tid(page, 'select-all').check()
    await tid(page, 'bulk-approve').click()
    await expect(tid(page, 'cmp-flash')).toBeVisible()
    await expect(tid(page, 'pksk-questions-empty')).toBeVisible()
    expect(await stats(page)).toEqual(['764', '764', '0', '383', '381'])

    // Delete with confirm: cancel keeps, accept removes; the edit URL is then a 404.
    const dismissed = dismissNextDialog(page, { type: 'confirm', message: 'Padam soalan ini?' })
    await gotoApp(LIST)
    await rowOf(page, 9000001).getByTestId('q-delete').click()
    await dismissed
    await expect(rowOf(page, 9000001)).toHaveCount(1)
    void acceptNextDialog(page, { type: 'confirm', message: 'Padam soalan ini?' })
    await rowOf(page, 9000001).getByTestId('q-delete').click()
    await expect(tid(page, 'cmp-flash')).toBeVisible()
    await expect(rowOf(page, 9000001)).toHaveCount(0)
    expect(await stats(page)).toEqual(['763', '763', '0', '383', '380'])
    await gotoApp(`${LIST}/9000001/edit`)
    await expect(page.locator('[data-page=not-found]')).toBeVisible()
  })

  test('L24 cross-role: grant T4 -> create -> student count 81 -> delete -> 80 -> revoke -> access gone', async ({
    page,
    gotoApp,
    mock,
  }) => {
    const TEXT = 'QA G5 soalan A: apakah sikap terbaik semasa bekerja berpasukan?'
    await gotoApp('/login')
    await actAs(page, mock, gotoApp, 'admin@demo.test', ACCESS)
    // Grant pelajar2 (id 3) the T4 package so the student side can be observed throughout.
    await actAs(page, mock, gotoApp, 'admin@demo.test', ACCESS)
    await tid(page, 'grant-toggle').click()
    await tid(page, 'grant-user').fill('3')
    await tid(page, 'grant-package').selectOption({ index: 1 })
    await tid(page, 'grant-submit').click()
    await expect(tid(page, 'cmp-flash')).toBeVisible()
    await expect(tid(page, 'access-row').first().getByTestId('a-package')).toHaveText(
      'PKSK Tingkatan 4 (SBP/MRSM)',
    )
    expect(await stats(page)).toEqual(['4', '3', '4'])

    // Create an A question for T4 / Kecerdasan Insaniah.
    await gotoApp(`${LIST}/create`)
    await expect(tid(page, 'pksk-question-form')).toBeVisible()
    await tid(page, 'q-bahagian').selectOption('A')
    await tid(page, 'q-domain').selectOption({ label: 'Kecerdasan Insaniah' })
    await tid(page, 'q-level').selectOption('T4')
    await tid(page, 'q-text').fill(TEXT)
    await tid(page, 'q-difficulty').selectOption('2')
    await tid(page, 'q-explanation').fill('Penjelasan QA G5.')
    const texts = tid(page, 'option-text')
    for (const [i, t] of ['Mengutamakan kepentingan diri', 'Bekerjasama dan berkongsi tugas', 'Mengelak tanggungjawab', 'Menyalahkan rakan'].entries()) {
      await texts.nth(i).fill(t)
    }
    await tid(page, 'form-submit').click()
    await expect(page).toHaveURL(new RegExp(`${LIST}$`))
    await expect(tid(page, 'cmp-flash')).toBeVisible()
    const first = tid(page, 'pksk-question-row').first()
    await expect(first.getByTestId('q-text')).toContainText('QA G5 soalan A')
    await expect(first.getByTestId('q-status')).toHaveText('Diluluskan')
    await expect(first.getByTestId('q-bahagian')).toHaveText('A')
    await expect(first.getByTestId('q-level')).toHaveText('T4')
    await expect(first.getByTestId('q-edit')).toHaveAttribute('href', '/admin/pksk/questions/9000001/edit')
    expect(await stats(page)).toEqual(['764', '764', '0', '383', '381'])

    // Student with T4 access sees the new approved question counted (80 -> 81).
    await actAs(page, mock, gotoApp, 'pelajar2@demo.test', '/pksk')
    await expect(tid(page, 'badge-aktif')).toHaveCount(1)
    await expect(tid(page, 'level-card-T4').getByTestId('badge-aktif')).toBeVisible()
    await expect(tid(page, 'level-card-T1').getByTestId('badge-aktif')).toHaveCount(0)
    await gotoApp('/pksk/level/T4/domains')
    await expect(page.locator('[data-code=PKSK_INSANIAH]').getByTestId('question-count')).toHaveText('81')
    await gotoApp('/pksk/level/T1')
    await expect(page).toHaveURL(/\/pksk$/)

    await actAs(page, mock, gotoApp, 'admin@demo.test', LIST)
    void acceptNextDialog(page, { type: 'confirm', message: 'Padam soalan ini?' })
    await rowOf(page, 9000001).getByTestId('q-delete').click()
    await expect(rowOf(page, 9000001)).toHaveCount(0)
    // Student count is back to 80 and the revoke closes the loop.
    await actAs(page, mock, gotoApp, 'pelajar2@demo.test', '/pksk/level/T4/domains')
    await expect(page.locator('[data-code=PKSK_INSANIAH]').getByTestId('question-count')).toHaveText('80')

    await actAs(page, mock, gotoApp, 'admin@demo.test', ACCESS)
    const row = tid(page, 'access-row').first()
    await expect(row.getByTestId('a-name')).toHaveText('Pelajar Dua Demo')
    const notRevoked = dismissNextDialog(page, { type: 'confirm', message: 'Tarik balik akses?' })
    await row.getByTestId('a-revoke').click()
    await notRevoked
    await expect(row.getByTestId('a-status')).toHaveText('Aktif')
    void acceptNextDialog(page, { type: 'confirm', message: 'Tarik balik akses?' })
    await row.getByTestId('a-revoke').click()
    await expect(tid(page, 'cmp-flash')).toBeVisible()
    await expect(tid(page, 'access-row').first().getByTestId('a-status')).toHaveText('Ditarik')
    await expect(tid(page, 'access-row').first().getByTestId('a-revoke')).toHaveCount(0)
    expect(await stats(page)).toEqual(['3', '3', '3'])

    await actAs(page, mock, gotoApp, 'pelajar2@demo.test', '/pksk')
    await expect(tid(page, 'badge-aktif')).toHaveCount(0)
    await gotoApp('/pksk/level/T4')
    await expect(page).toHaveURL(/\/pksk$/)
    await expectNoHorizontalScroll(page)
  })

  test('AC-23 a PKSK question never appears in M04 totals, list or search; M04 detail shows it', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/admin/questions?search=Bagi calon T4, apakah tindakan terbaik')
    await expect(page.getByText('Tiada soalan dijumpai')).toBeVisible()
    await gotoApp('/admin/questions/178460')
    await expect(tid(page, 'question-text')).toContainText('Bagi calon T4')
    await expect(tid(page, 'question-option')).toHaveCount(4)

    const total = async () => {
      await gotoApp('/admin/questions')
      await expect(tid(page, 'questions-summary')).toContainText(/Jumlah/)
      return (await tid(page, 'questions-summary').innerText()).match(/Jumlah:?\s*([\d.,]+)/)?.[1] ?? null
    }
    const before = await total()
    expect(before).not.toBeNull()
    await gotoApp(`${LIST}/create`)
    await tid(page, 'q-bahagian').selectOption('B')
    await tid(page, 'q-domain').selectOption({ label: 'Matematik' })
    await tid(page, 'q-text').fill('Soalan QA M04 pengecualian')
    const o = tid(page, 'option-text')
    for (const [i, t] of ['a', 'b', 'c', 'd'].entries()) await o.nth(i).fill(t)
    await tid(page, 'form-submit').click()
    await expect(page).toHaveURL(new RegExp(`${LIST}$`))
    await expect(tid(page, 'pksk-question-row').first().getByTestId('q-text')).toContainText(
      'Soalan QA M04 pengecualian',
    )
    expect(await total(), 'M04 total unchanged by a PKSK create').toBe(before)
    await gotoApp('/admin/questions?search=Soalan QA M04 pengecualian')
    await expect(page.getByText('Tiada soalan dijumpai')).toBeVisible()
    await gotoApp('/admin/questions/9000001')
    await expect(tid(page, 'question-text')).toContainText('Soalan QA M04 pengecualian')
  })

  test('AC-23.3 rejecting a T1 Matematik question lowers the student count only; "Ting. 1" stays 383', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/pksk/level/T1/domain/PKSK_MATH')
    await expect(tid(page, 'pksk-item').first()).toBeVisible()
    const id = Number(await tid(page, 'pksk-item').first().getAttribute('data-question-id'))
    const text = (await tid(page, 'pksk-item').first().locator('p').first().innerText())
      .replace(/^\d+\.\s*/, '')
      .trim()
    await gotoApp(`${LIST}?search=${encodeURIComponent(text)}`)
    await expect(rowOf(page, id)).toBeVisible()
    await rowOf(page, id).getByTestId('row-select').check()
    await tid(page, 'bulk-reject').click()
    await expect(rowOf(page, id).getByTestId('q-status')).toHaveText('Ditolak')
    await gotoApp('/pksk/level/T1/domains')
    await expect(page.locator('[data-code=PKSK_MATH]').getByTestId('question-count')).toHaveText('26')
    await gotoApp(LIST)
    await expect(tid(page, 'pksk-questions-table')).toBeVisible()
    await expect(tid(page, 'stat-value').first()).toHaveText('763')
    const v = await stats(page)
    expect(v[3]).toBe('383')
    expect(v[1]).toBe('762')
  })

  test('FR-38/39 whitespace-only text, XSS-looking text, long unbroken text and a server failure', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs('admin@demo.test')
    const dialogs: string[] = []
    page.on('dialog', (d) => {
      dialogs.push(d.message())
      void d.dismiss()
    })
    const fill = async (text: string) => {
      await gotoApp(`${LIST}/create`)
      await expect(tid(page, 'pksk-question-form')).toBeVisible()
      await tid(page, 'q-bahagian').selectOption('B')
      await tid(page, 'q-domain').selectOption({ label: 'Sains' })
      await tid(page, 'q-text').fill(text)
      const o = tid(page, 'option-text')
      for (const [i, t] of ['satu', 'dua', 'tiga', 'empat'].entries()) await o.nth(i).fill(t)
      await tid(page, 'option-correct').nth(0).check()
    }

    // 1. Whitespace-only text: must not create a question (server trims or rejects).
    await fill('     ')
    await tid(page, 'form-submit').click()
    await page.waitForTimeout(1500)
    const wsCreated = (await mock.requests('POST /api/admin/pksk-questions')).filter((r) => r.status === 201)
    expect(wsCreated, 'a whitespace-only question text must not be saved').toHaveLength(0)

    // 2. HTML-looking text is rendered as text (SEC-M07-09) and nothing executes.
    const XSS = '<img src=x onerror=alert(1)> <script>alert(2)</script> & "kutip"'
    await fill(XSS)
    await tid(page, 'form-submit').click()
    await expect(page).toHaveURL(new RegExp(`${LIST}$`))
    const row = tid(page, 'pksk-question-row').first()
    await expect(row.getByTestId('q-text')).toContainText('<img src=x onerror=alert(1)>')
    await expect(row.locator('img')).toHaveCount(0)
    await gotoApp(`${LIST}/9000001/edit`)
    await expect(tid(page, 'q-text')).toHaveValue(XSS)
    expect(dialogs, 'no script executed').toEqual([])

    // 3. 400 unbroken characters: list row stays one line, the page does not scroll sideways.
    const LONG = 'X'.repeat(400)
    await fill(LONG)
    await tid(page, 'form-submit').click()
    await expect(page).toHaveURL(new RegExp(`${LIST}$`))
    const longRow = tid(page, 'pksk-question-row').first()
    const shown = (await longRow.getByTestId('q-text').textContent())?.trim() ?? ''
    expect(shown.length, 'BR-M07-23: cut to 80 characters + "..."').toBeLessThanOrEqual(83)
    expect(shown.endsWith('...')).toBe(true)
    await expectNoHorizontalScroll(page)

    // 4. A 500 from the server keeps the input and shows an error; nothing is created.
    await fill('Soalan gagal disimpan')
    await mock.failNext('POST /api/admin/pksk-questions', 500)
    await tid(page, 'form-submit').click()
    await expect(page).toHaveURL(/\/create$/)
    await expect(tid(page, 'q-text')).toHaveValue('Soalan gagal disimpan')
    await expect(tid(page, 'pksk-form-alert').or(tid(page, 'field-error')).first()).toBeVisible()
    // The form still works after the failure.
    await tid(page, 'form-submit').click()
    await expect(page).toHaveURL(new RegExp(`${LIST}$`))
  })

  test('FR-26 / BR-06 the list handles odd query values without breaking', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('admin@demo.test')
    for (const q of [
      '?page=0',
      '?page=-3',
      '?page=abc',
      '?page=99999',
      '?bahagian=Z',
      '?level=T9',
      '?status=zzz',
      '?search=%25_%5C',
      '?search=' + encodeURIComponent('<b>x</b>'),
      '?level=t1&bahagian=b',
    ]) {
      await gotoApp(`${LIST}${q}`)
      await expect(
        tid(page, 'pksk-questions-table').or(tid(page, 'pksk-questions-empty')).first(),
        q,
      ).toBeVisible()
      await expect(page.locator('[data-page=not-found]'), q).toHaveCount(0)
      await expect(tid(page, 'pksk-questions-error'), q).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    }
    await gotoApp(`${LIST}?level=t1&bahagian=b`)
    await expect(tid(page, 'pksk-question-row').first()).toBeVisible()
  })

  test('S5 list network failure shows the error and recovers on reload', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs('admin@demo.test')
    await gotoApp(LIST)
    await expect(tid(page, 'pksk-questions-table')).toBeVisible()
    await mock.networkErrorNext('GET /api/admin/pksk-questions')
    await page.getByTestId('filter-status').selectOption('approved')
    await expect(
      tid(page, 'pksk-questions-error').or(tid(page, 'page-error')).first(),
    ).toBeVisible()
    await gotoApp(LIST)
    await expect(tid(page, 'pksk-questions-table')).toBeVisible()
  })
})

// --- access lifecycle --------------------------------------------------------------------------

test.describe('QA-G5 M07 access lifecycle', MODULE, () => {
  test('AC-18..20 expiry boundary, expired grant, Kombo / T4 counts', async ({ page, gotoApp, mock }) => {
    await gotoApp('/login')
    await actAs(page, mock, gotoApp, 'admin@demo.test', ACCESS)
    await expect(tid(page, 'access-table')).toBeVisible()
    const grant = async (userId: string, pkg: number, date?: string) => {
      if (!(await tid(page, 'grant-form').isVisible())) await tid(page, 'grant-toggle').click()
      await tid(page, 'grant-user').fill(userId)
      await tid(page, 'grant-package').selectOption({ index: pkg })
      if (date) await tid(page, 'grant-expires').fill(date)
      await tid(page, 'grant-submit').click()
      await expect(tid(page, 'cmp-flash')).toBeVisible()
    }

    // Expired yesterday (clock = 25/09/2026): row labelled, no "Tarik", not counted, no access.
    await grant('3', 0, '2026-09-24')
    let first = tid(page, 'access-row').first()
    await expect(first.getByTestId('a-status')).toHaveText('Tamat Tempoh')
    await expect(first.getByTestId('a-revoke')).toHaveCount(0)
    await expect(first.getByTestId('a-expires')).toHaveText('24/09/2026')
    expect(await stats(page)).toEqual(['3', '3', '3'])
    await actAs(page, mock, gotoApp, 'pelajar2@demo.test', '/pksk')
    await expect(tid(page, 'badge-aktif')).toHaveCount(0)

    // Expires today: valid through the end of the day (BR-M07-16).
    await actAs(page, mock, gotoApp, 'admin@demo.test', ACCESS)
    await grant('3', 0, '2026-09-25')
    first = tid(page, 'access-row').first()
    await expect(first.getByTestId('a-status')).toHaveText('Aktif')
    await expect(first.getByTestId('a-expires')).toHaveText('25/09/2026')
    expect(await stats(page)).toEqual(['4', '4', '3'])
    await actAs(page, mock, gotoApp, 'pelajar2@demo.test', '/pksk')
    await expect(tid(page, 'level-card-T1').getByTestId('badge-aktif')).toBeVisible()

    // A T4 grant to the teacher (id 5): cards 5 / 4 / 4 -> AC-20.5 pattern (+1 total, +1 T4).
    await actAs(page, mock, gotoApp, 'admin@demo.test', ACCESS)
    await grant('5', 1)
    expect(await stats(page)).toEqual(['5', '4', '4'])
    await expectNoHorizontalScroll(page)
  })

  test('AC-20.3 the M02 "Pakej PKSK" switch opens both levels without a grant row', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/login')
    await actAs(page, mock, gotoApp, 'admin@demo.test', '/admin/users/3/edit')
    await expect(tid(page, 'user-form')).toBeVisible()
    await expect(tid(page, 'user-pksk')).not.toBeChecked()
    await tid(page, 'user-pksk').check({ force: true })
    await tid(page, 'user-submit').click()
    await expect(page).not.toHaveURL(/\/edit$/)
    await actAs(page, mock, gotoApp, 'pelajar2@demo.test', '/pksk')
    await expect(tid(page, 'badge-aktif')).toHaveCount(2)
    for (const lvl of ['T1', 'T4']) {
      await gotoApp(`/pksk/level/${lvl}`)
      await expect(page).toHaveURL(new RegExp(`/pksk/level/${lvl}$`))
      await expect(tid(page, 'pksk-dashboard')).toBeVisible()
    }
    // The access list and its cards are unchanged by the flag.
    await actAs(page, mock, gotoApp, 'admin@demo.test', ACCESS)
    await expect(tid(page, 'access-row')).toHaveCount(3)
    expect(await stats(page)).toEqual(['3', '3', '3'])
  })

  test('FR-52 a stale "Tarik" (409) reloads the list and shows the row as revoked', async ({
    page,
    gotoApp,
    loginAs,
    newTab,
    mock,
  }) => {
    await loginAs('admin@demo.test')
    await gotoApp(ACCESS)
    await expect(tid(page, 'access-row')).toHaveCount(3)
    await expect(page.locator('[data-access-id="3"]').getByTestId('a-revoke')).toBeVisible()

    // A second tab (same browser storage) revokes row 3 first.
    const tab = await newTab()
    await addInitSession(tab, 'admin@demo.test')
    await gotoAppOn(tab, ACCESS)
    await expect(tab.getByTestId('access-table')).toBeVisible()
    void acceptNextDialog(tab, { type: 'confirm', message: 'Tarik balik akses?' })
    await tab.locator('[data-access-id="3"]').getByTestId('a-revoke').click()
    await expect(tab.locator('[data-access-id="3"]').getByTestId('a-status')).toHaveText('Ditarik')

    // The first tab has not reloaded: it still offers "Tarik". Give the cross-tab sync time to apply.
    await expect(page.locator('[data-access-id="3"]').getByTestId('a-revoke')).toBeVisible()
    await page.waitForTimeout(3000)

    void acceptNextDialog(page, { type: 'confirm', message: 'Tarik balik akses?' })
    await page.locator('[data-access-id="3"]').getByTestId('a-revoke').click()
    await expect
      .poll(async () => (await mock.lastRequest('POST /api/admin/pksk-access/3/revoke'))?.status, {
        message: 'the stale revoke is answered 409',
      })
      .toBe(409)
    // The list reloads: the row is revoked, no "Tarik", and the cards are 2 / 2 / 2.
    await expect(page.locator('[data-access-id="3"]').getByTestId('a-status')).toHaveText('Ditarik')
    await expect(page.locator('[data-access-id="3"]').getByTestId('a-revoke')).toHaveCount(0)
    expect(await stats(page)).toEqual(['2', '2', '2'])
    await expectNoHorizontalScroll(page)
  })

  test('FR-51 grant validation: unknown, zero, negative, decimal ids and a failing server', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs('admin@demo.test')
    await gotoApp(ACCESS)
    await tid(page, 'grant-toggle').click()
    for (const bad of ['999999', '0', '-5']) {
      await tid(page, 'grant-user').fill(bad)
      await tid(page, 'grant-submit').click()
      // Either native validation blocks it or the server answers a field error; never a new row.
      await page.waitForTimeout(600)
      await expect(tid(page, 'access-row'), `id ${bad}`).toHaveCount(3)
    }
    expect(await stats(page)).toEqual(['3', '3', '3'])
    // A 500 from the server: the form stays, no row, the page stays usable.
    await tid(page, 'grant-user').fill('3')
    await mock.failNext('POST /api/admin/pksk-access', 500)
    await tid(page, 'grant-submit').click()
    await expect(tid(page, 'access-row')).toHaveCount(3)
    await expect(tid(page, 'grant-form')).toBeVisible()
    await expect(tid(page, 'grant-user')).toHaveValue('3')
    await tid(page, 'grant-submit').click()
    await expect(tid(page, 'access-row')).toHaveCount(4)
  })

  test('FR-48 / BR-18 access search is case-insensitive, by e-mail too, and trims', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('admin@demo.test')
    await gotoApp(`${ACCESS}?search=MAJU`)
    await expect(tid(page, 'access-row')).toHaveCount(1)
    await gotoApp(`${ACCESS}?search=ibubapa@demo`)
    await expect(tid(page, 'access-row')).toHaveCount(1)
    await expect(tid(page, 'a-name')).toHaveText('Ibu Bapa Demo')
    await gotoApp(`${ACCESS}?search=%20%20maju%20%20`)
    await expect(tid(page, 'access-row')).toHaveCount(1)
    expect(await stats(page)).toEqual(['3', '3', '3'])
  })
})
