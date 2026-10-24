/**
 * M10 Sumbang Soalan, UAT task T6: the contribution chain end to end, at 375 / 768 / 1280.
 *
 * Chain: Guru "Tambah Soalan Baru" (Bab and DSKP added inline) -> "Hantar untuk Semakan" -> admin
 * Bank Soalan (Menunggu Semakan) -> "Luluskan" -> student practice (the question is served).
 *
 * Also the UAT regression G-49: Enter inside a field of an add-row panel (Bab, Bidang, SK, SP) saves
 * that panel and does not submit the whole question.
 *
 * These tests carry no SRS E2E ids; they sit beside the M10 smoke specs. The student step uses the
 * real chapter quiz screen (S5/Q2), not an API probe.
 */

import type { Page } from '@playwright/test'

import { waitForApp } from '../fixtures/mock-handle'
import { expect, test } from '../fixtures/test'
import { actAs, expectNoHorizontalScroll, moduleTag, viewportWidth } from '../support'

const GURU = 'guru@demo.test'
const ADMIN = 'admin@demo.test'
const PELAJAR = 'pelajar@demo.test'
const CREATE = '/guru/soalan/cipta'
const MODULE = { tag: [moduleTag(10)] }

/** A chapter number no seeded Bab uses, and the texts that identify this run's data. */
const CHAPTER_NO = '77'
const CHAPTER_NAME = 'Bab UAT T6'
const QUESTION = 'Soalan sumbangan UAT T6: berapakah hasil tambah dua dan tiga?'

test.describe.configure({ timeout: 240_000 })
test.use({ mockInit: { latency: 0 } })

const tid = (page: Page, id: string) => page.getByTestId(id)

/**
 * Every page load of these specs: the full-profile mock boot is slow on a loaded machine and replays
 * saved changes after a write, so it gets a 60 s budget instead of the 15 s of `gotoApp`.
 */
async function reopen(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await waitForApp(page, 60_000)
}

/** Level, subject, difficulty, question text and the four options (the correct one stays "A"). */
async function fillBasics(page: Page): Promise<void> {
  await tid(page, 'q-level').selectOption({ label: 'Tingkatan 4' })
  await tid(page, 'q-subject').selectOption({ label: 'Matematik' })
  await tid(page, 'q-difficulty').selectOption({ label: 'Mudah' })
  await tid(page, 'q-text').fill(QUESTION)
  for (const [i, v] of ['Empat', 'Lima', 'Enam', 'Tujuh'].entries()) {
    await tid(page, `q-option-${String(i)}`).fill(v)
  }
}

/**
 * Opens an add-row panel, types its fields and presses Enter in the last one (UAT G-49). The panel
 * must close and the select must show the new row; the caller asserts that the question was not sent.
 */
async function addRowWithEnter(
  page: Page,
  row: 'q-chapter' | 'q-bidang' | 'q-sk' | 'q-sp',
  fields: Record<string, string>,
): Promise<void> {
  await tid(page, `${row}-add`).click()
  await expect(tid(page, `${row}-panel`)).toBeVisible()
  const keys = Object.keys(fields)
  for (const key of keys) await tid(page, `${row}-field-${key}`).fill(fields[key] ?? '')
  const last = tid(page, `${row}-field-${keys[keys.length - 1] ?? ''}`)
  await last.press('Enter')
  await expect(tid(page, `${row}-panel`)).toBeHidden()
}

/** Every inline add of the form: a Bab, then Bidang -> SK -> SP, each saved with Enter. */
async function addChapterAndDskp(page: Page): Promise<void> {
  await addRowWithEnter(page, 'q-chapter', { number: CHAPTER_NO, name: CHAPTER_NAME })
  await expect(tid(page, 'q-chapter-select').locator('option:checked')).toContainText(CHAPTER_NAME)
  await addRowWithEnter(page, 'q-bidang', { code: 'B9', name: 'Bidang UAT T6' })
  await expect(tid(page, 'q-bidang-select').locator('option:checked')).toContainText(
    'Bidang UAT T6',
  )
  await addRowWithEnter(page, 'q-sk', { code: '9.1', description: 'SK UAT T6' })
  await expect(tid(page, 'q-sk-select').locator('option:checked')).toContainText('SK UAT T6')
  await addRowWithEnter(page, 'q-sp', { code: '9.1.1', description: 'SP UAT T6' })
  await expect(tid(page, 'q-sp-select').locator('option:checked')).toContainText('SP UAT T6')
}

const POSTS_OF_QUESTIONS = '/api/guru/questions'

/** POSTs of the contribution form that reached the mock API (the question being sent). */
async function questionPosts(mock: { requests: (p?: string) => Promise<{ method: string }[]> }) {
  return (await mock.requests(POSTS_OF_QUESTIONS)).filter((r) => r.method === 'POST')
}

test.describe('M10 T6 add-row panels (G-49)', MODULE, () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs(GURU)
    await reopen(page, CREATE)
    await expect(tid(page, 'question-form')).toBeVisible()
  })

  test('Enter in a panel field saves that panel and does not send the question', async ({
    page,
    mock,
  }) => {
    // A complete, valid question: before the fix, Enter in a panel submitted all of it.
    await fillBasics(page)
    await addChapterAndDskp(page)

    await expect(page).toHaveURL(/\/guru\/soalan\/cipta$/)
    await expect(tid(page, 'question-form')).toBeVisible()
    await expect(tid(page, 'form-errors')).toHaveCount(0)
    await expect(tid(page, 'q-text')).toHaveValue(QUESTION)
    expect(await questionPosts(mock)).toHaveLength(0)
    await expectNoHorizontalScroll(page)

    // The question is still sent by its own button, once.
    await tid(page, 'form-submit').click()
    await expect(page).toHaveURL(/\/guru\/soalan$/)
    await expect.poll(async () => (await questionPosts(mock)).length).toBe(1)
  })

  test('Enter in a panel with an empty field changes nothing: the panel stays open and nothing is sent', async ({
    page,
    mock,
  }) => {
    await fillBasics(page)
    await tid(page, 'q-bidang-add').click()
    await tid(page, 'q-bidang-field-code').fill('B8')
    await tid(page, 'q-bidang-field-name').press('Enter')

    await expect(tid(page, 'q-bidang-panel')).toBeVisible()
    await expect(tid(page, 'q-bidang-field-code')).toHaveValue('B8')
    await expect(tid(page, 'q-bidang-select')).toHaveValue('')
    await expect(page).toHaveURL(/\/guru\/soalan\/cipta$/)
    expect(await questionPosts(mock)).toHaveLength(0)

    // The same panel still saves from its own button once complete.
    await tid(page, 'q-bidang-field-name').fill('Bidang UAT T6')
    await tid(page, 'q-bidang-save').click()
    await expect(tid(page, 'q-bidang-panel')).toBeHidden()
    await expect(tid(page, 'q-bidang-select').locator('option:checked')).toContainText(
      'Bidang UAT T6',
    )
  })
})

test.describe('M10 T6 contribution chain', MODULE, () => {
  test('guru contributes -> admin approves -> the student is served the question', async ({
    page,
    mock,
  }) => {
    // Several roles in one page: no `loginAs` (its init-script session would win over `actAs`).
    await reopen(page, '/login')
    await actAs(page, mock, (p) => reopen(page, p), GURU, CREATE)

    // 1. Guru: the form, a new Bab and DSKP rows, then "Hantar untuk Semakan".
    await expect(tid(page, 'question-form')).toBeVisible()
    await fillBasics(page)
    await addChapterAndDskp(page)
    await expectNoHorizontalScroll(page)
    await tid(page, 'form-submit').click()
    await expect(page).toHaveURL(/\/guru\/soalan$/)
    await expect(page.getByText('Soalan berjaya dihantar untuk semakan.')).toBeVisible()
    const card = page.locator('[data-testid="question-card"]', { hasText: QUESTION })
    await expect(card).toHaveCount(1)
    await expect(card.getByTestId('chip-dskp')).toHaveText('DSKP')
    await expectNoHorizontalScroll(page)
    const questionId = Number(await card.getAttribute('data-question-id'))
    expect(questionId).toBeGreaterThan(0)

    // 2. Student, before approval: "Buka Soalan Sama" for the question refuses to start it and goes
    //    back to the Latih Tubi config (the practice chapter list offers Darjah 1-4 only, so a
    //    Tingkatan 4 question is served through the SPM Latih Tubi quiz).
    const quiz = `/spm/latih-tubi/MATH/quiz?question_id=${String(questionId)}&count=1`
    await actAs(page, mock, (p) => reopen(page, p), PELAJAR, quiz)
    await expect(page).toHaveURL(/\/spm\/latih-tubi\/MATH$/)
    await expect(tid(page, 'quiz-runner')).toHaveCount(0)
    await expect(page.getByText(QUESTION)).toHaveCount(0)

    // 3. Admin: the pending row in Bank Soalan, then "Luluskan".
    await actAs(page, mock, (p) => reopen(page, p), ADMIN, '/admin/questions?status=pending_review')
    await expect(tid(page, 'questions-table')).toBeVisible()
    // A short term: the whole sentence would make the active-filter chip overflow at 375 (see the
    // BUG-T6-01 test below).
    await tid(page, 'questions-search').fill('sumbangan UAT T6')
    await tid(page, 'questions-search').press('Enter')
    // A table row from 768 px, a card below it; both name the status.
    const row = tid(page, 'questions-table')
      .locator(viewportWidth(page) >= 768 ? 'tr' : 'li')
      .filter({ hasText: QUESTION })
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('Menunggu Semakan')
    if (viewportWidth(page) >= 768)
      await expect(row.getByTestId('question-dskp')).toHaveText('DSKP')
    await expectNoHorizontalScroll(page)

    await reopen(page, `/admin/questions/${String(questionId)}`)
    await expect(tid(page, 'question-detail-page')).toBeVisible()
    await expect(tid(page, 'question-status')).toHaveText('Menunggu Semakan')
    await expect(tid(page, 'info-dskp')).toContainText('SP UAT T6')
    await tid(page, 'status-approve').click()
    await page.getByRole('button', { name: 'Ya' }).click()
    await expect(page.getByText('1 soalan berjaya dikemaskini.')).toBeVisible()
    await expect(tid(page, 'quick-actions')).toHaveCount(0)
    await expect(page.getByText('Diluluskan').first()).toBeVisible()
    await expectNoHorizontalScroll(page)

    // 4. Student, after approval: the same link starts a one-question quiz that shows it.
    await actAs(page, mock, (p) => reopen(page, p), PELAJAR, quiz)
    await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 1')
    await expect(page.getByText(QUESTION)).toBeVisible()
    await expect(page.getByText('Empat', { exact: true })).toBeVisible()
    const posts = (await mock.requests('/api/practice/sessions')).filter((r) => r.method === 'POST')
    expect(posts.at(-1)?.body).toMatchObject({
      mode: 'latih_tubi',
      count: 1,
      targetQuestionId: questionId,
    })
    expect(posts.at(-1)?.status).toBe(201)
    await expectNoHorizontalScroll(page)
  })
})

test.describe('M10 T6 known layout defect', MODULE, () => {
  test('BUG-T6-01 a long search term keeps the active-filter chip inside the page at 375', async ({
    page,
    loginAs,
  }) => {
    // Expected to fail below 640 px until DsActiveFilters truncates its chip (it is 576 px wide, so
    // the page scrolls sideways by ~220 px). Playwright reports an unexpected pass once it is fixed.
    test.fail(viewportWidth(page) < 640, 'BUG-T6-01: DsActiveFilters chip has no max width')
    await loginAs(ADMIN)
    await reopen(page, '/admin/questions')
    await expect(tid(page, 'questions-table')).toBeVisible()
    await tid(page, 'questions-search').fill(QUESTION)
    await tid(page, 'questions-search').press('Enter')
    await expect(tid(page, 'active-filter').first()).toBeVisible()
    await expectNoHorizontalScroll(page)
  })
})
