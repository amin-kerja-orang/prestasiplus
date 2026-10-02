/**
 * M03 G5 QA specs (written by QA): lookups omit deactivated records (E2E-M03-25, AC-11.4 / 16.3 / 30.2),
 * deletes that must reach other screens (E2E-M03-26 / 32 S1 part, AC-12.2 / 17.2), and the cross-screen
 * flow level -> subject -> chapter -> topic -> subtopic -> delete everything (counts on S1, S6, S9).
 *
 * Success-flash texts are UNVERIFIED COPY (SRS §8) and are not asserted here.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { acceptNextDialog, moduleTag } from '../support'

const ADMIN = 'admin@demo.test'
const MODULE = { tag: [moduleTag(3), '@qa'] }

const subjectRow = (page: Page, id: number | string) =>
  page.locator(`[data-testid="subject-row"][data-subject-id="${String(id)}"]`)
const levelRow = (page: Page, id: number | string) =>
  page.locator(`[data-testid="level-row"][data-level-id="${String(id)}"]`)

async function optionValues(page: Page, testId: string): Promise<string[]> {
  const read = () =>
    page
      .getByTestId(testId)
      .locator('option')
      .evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== ''))
  // The lookups load asynchronously: wait until the list is populated before reading it.
  await expect.poll(async () => (await read()).length, { timeout: 15_000 }).toBeGreaterThan(0)
  return read()
}

async function confirmDelete(page: Page, click: () => Promise<void>): Promise<void> {
  const accepted = acceptNextDialog(page, { type: 'confirm' })
  await click()
  await accepted
}

test.describe('QA G5 lookups', MODULE, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(90_000)

  test('E2E-M03-25 a deactivated subject and level leave the lookups (M04 form + list filter) but stay in admin lists and S1', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)

    // Baseline: both are offered by the M04 question form.
    await gotoApp('/admin/questions/create')
    await expect(page.getByTestId('q-subject')).toBeVisible()
    const subjectsBefore = await optionValues(page, 'q-subject')
    const levelsBefore = await optionValues(page, 'q-level')
    expect(subjectsBefore).toContain('12')
    expect(levelsBefore).toContain('11')

    // Deactivate subject 12 on S6 and level 11 on S9.
    await gotoApp('/admin/subjects')
    await expect(subjectRow(page, 12)).toBeVisible()
    await subjectRow(page, 12).getByTestId('subject-switch').click()
    await expect(subjectRow(page, 12).getByTestId('switch-track')).toHaveClass(/bg-slate-300/)
    await gotoApp('/admin/education-levels')
    await expect(levelRow(page, 11)).toBeVisible()
    await levelRow(page, 11).getByTestId('level-switch').click()
    await expect(levelRow(page, 11).getByTestId('switch-track')).toHaveClass(/bg-slate-300/)

    // Lookup consumers: M04 question form no longer offers them; the others are unchanged and ordered.
    await gotoApp('/admin/questions/create')
    await expect(page.getByTestId('q-subject')).toBeVisible()
    const subjectsAfter = await optionValues(page, 'q-subject')
    const levelsAfter = await optionValues(page, 'q-level')
    expect(subjectsAfter).not.toContain('12')
    expect(levelsAfter).not.toContain('11')
    expect(subjectsAfter).toEqual(subjectsBefore.filter((v) => v !== '12'))
    expect(levelsAfter).toEqual(levelsBefore.filter((v) => v !== '11'))
    const ids = subjectsAfter.map(Number)
    expect(ids).toEqual([...ids].sort((a, b) => a - b))

    // M04 list filter.
    await gotoApp('/admin/questions')
    await expect(page.getByTestId('questions-subject')).toBeVisible()
    expect(await optionValues(page, 'questions-subject')).not.toContain('12')
    expect(await optionValues(page, 'questions-level')).not.toContain('11')

    // Admin screens still list them (BR-11): S6, S9 and the S1 filter.
    await gotoApp('/admin/subjects')
    await expect(subjectRow(page, 12)).toBeVisible()
    await expect(page.getByTestId('subjects-count')).toHaveText('Jumlah: 31 subjek')
    await gotoApp('/admin/education-levels')
    await expect(levelRow(page, 11)).toBeVisible()
    await expect(page.getByTestId('levels-count')).toHaveText('Jumlah: 11 tahap')
    await gotoApp('/admin/curriculum')
    expect(await optionValues(page, 'curriculum-subject')).toContain('12')
    expect(await optionValues(page, 'curriculum-level')).toContain('11')

    // Reactivate: back in the lookups.
    await gotoApp('/admin/subjects')
    await subjectRow(page, 12).getByTestId('subject-switch').click()
    await expect(subjectRow(page, 12).getByTestId('switch-track')).toHaveClass(/bg-emerald-500/)
    await gotoApp('/admin/education-levels')
    await levelRow(page, 11).getByTestId('level-switch').click()
    await expect(levelRow(page, 11).getByTestId('switch-track')).toHaveClass(/bg-emerald-500/)
    await gotoApp('/admin/questions/create')
    await expect(page.getByTestId('q-subject')).toBeVisible()
    expect(await optionValues(page, 'q-subject')).toContain('12')
    expect(await optionValues(page, 'q-level')).toContain('11')
  })

  test('E2E-M03-25 a subject created on S7 and a level created on S10 appear in the lookups, deleted ones leave', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/subjects/create')
    await page.getByTestId('subject-name').fill('Subjek Carian')
    await page.getByTestId('subject-name-en').fill('Lookup Subject')
    await page.getByTestId('subject-code').fill('LKP1')
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL('/admin/subjects')
    const row = page.getByTestId('subject-row').filter({ hasText: 'Subjek Carian' })
    const id = await row.getAttribute('data-subject-id')
    expect(id).toBeTruthy()

    await gotoApp('/admin/questions/create')
    await expect(page.getByTestId('q-subject')).toBeVisible()
    expect(await optionValues(page, 'q-subject')).toContain(id!)

    await gotoApp('/admin/subjects')
    await confirmDelete(page, () => subjectRow(page, id!).getByTestId('subject-delete').click())
    await expect(subjectRow(page, id!)).toHaveCount(0)
    await gotoApp('/admin/questions/create')
    await expect(page.getByTestId('q-subject')).toBeVisible()
    expect(await optionValues(page, 'q-subject')).not.toContain(id!)
  })

  test('E2E-M03-26 deleting a subject removes it from the S1 filter; E2E-M03-32 deleting a level removes it from S1 and S6 lines', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/subjects')
    await expect(subjectRow(page, 31)).toBeVisible()
    await confirmDelete(page, () => subjectRow(page, 31).getByTestId('subject-delete').click())
    await expect(subjectRow(page, 31)).toHaveCount(0)
    await expect(page.getByTestId('subjects-count')).toHaveText('Jumlah: 30 subjek')
    await gotoApp('/admin/curriculum')
    expect(await optionValues(page, 'curriculum-subject')).not.toContain('31')
    expect(await optionValues(page, 'curriculum-subject')).toHaveLength(30)

    await gotoApp('/admin/education-levels')
    await expect(levelRow(page, 11)).toBeVisible()
    await confirmDelete(page, () => levelRow(page, 11).getByTestId('level-delete').click())
    await expect(levelRow(page, 11)).toHaveCount(0)
    await expect(page.getByTestId('levels-count')).toHaveText('Jumlah: 10 tahap')
    await gotoApp('/admin/curriculum')
    expect(await optionValues(page, 'curriculum-level')).not.toContain('11')
    expect(await optionValues(page, 'curriculum-level')).toHaveLength(10)
    await gotoApp('/admin/subjects')
    await expect(subjectRow(page, 3).getByTestId('subject-levels')).not.toContainText('Tingkatan 5')
  })

  test('AC-12.2 deleting Matematik Tambahan lowers the "Subjek" count of its levels (T4, T5) by one', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/education-levels')
    await expect(levelRow(page, 10)).toBeVisible()
    const before10 = await levelRow(page, 10).getByTestId('level-subjects').innerText()
    const before11 = await levelRow(page, 11).getByTestId('level-subjects').innerText()
    await gotoApp('/admin/subjects')
    await confirmDelete(page, () => subjectRow(page, 8).getByTestId('subject-delete').click())
    await expect(subjectRow(page, 8)).toHaveCount(0)
    await gotoApp('/admin/education-levels')
    await expect(levelRow(page, 10)).toBeVisible()
    const n = (s: string) => Number(/\d+/.exec(s)![0])
    expect(n(await levelRow(page, 10).getByTestId('level-subjects').innerText())).toBe(n(before10) - 1)
    expect(n(await levelRow(page, 11).getByTestId('level-subjects').innerText())).toBe(n(before11) - 1)
  })
})

test.describe('QA G5 cross-screen flow', MODULE, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(150_000)

  test('level -> subject -> chapter -> topic -> subtopic: S1 stats, S6 and S9 counts update, then deleting reverts them', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)

    // Baseline counts.
    await gotoApp('/admin/subjects')
    await expect(page.getByTestId('subjects-count')).toHaveText('Jumlah: 31 subjek')
    await gotoApp('/admin/education-levels')
    await expect(page.getByTestId('levels-count')).toHaveText('Jumlah: 11 tahap')

    // 1. Level (S10).
    await gotoApp('/admin/education-levels/create')
    await page.getByTestId('level-name').fill('Tahap QA')
    await page.getByTestId('level-name-en').fill('QA Level')
    await page.getByTestId('level-code').fill('qal')
    await page.getByTestId('level-stage').selectOption('lower_secondary')
    await page.getByTestId('level-curriculum').fill('KSSM')
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL('/admin/education-levels')
    await expect(page.getByTestId('levels-count')).toHaveText('Jumlah: 12 tahap')
    const newLevel = page.getByTestId('level-row').filter({ hasText: 'Tahap QA' })
    await expect(newLevel).toHaveCount(1)
    const levelId = (await newLevel.getAttribute('data-level-id'))!
    await expect(newLevel.getByTestId('level-subjects')).toHaveText('0 subjek')
    await expect(newLevel).toContainText('QAL')

    // 2. Subject linked to it (S7).
    await gotoApp('/admin/subjects/create')
    await page.getByTestId('subject-name').fill('Subjek QA')
    await page.getByTestId('subject-name-en').fill('QA Subject')
    await page.getByTestId('subject-code').fill('qas1')
    await expect(page.getByTestId('subject-level-option')).toHaveCount(12)
    await page.getByTestId('subject-levels-box').getByText('Tahap QA (QA Level)').click()
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL('/admin/subjects')
    await expect(page.getByTestId('subjects-count')).toHaveText('Jumlah: 32 subjek')
    const newSubject = page.getByTestId('subject-row').filter({ hasText: 'Subjek QA' })
    await expect(newSubject).toHaveCount(1)
    const subjectId = (await newSubject.getAttribute('data-subject-id'))!
    await expect(newSubject.getByTestId('subject-levels')).toHaveText('Tahap QA')
    await expect(newSubject.getByTestId('subject-questions')).toContainText('0')

    // S9 now counts the linked subject.
    await gotoApp('/admin/education-levels')
    await expect(levelRow(page, levelId).getByTestId('level-subjects')).toHaveText('1 subjek')

    // 3. S1: empty tree for the new pair; stats 0 / 0 / 0.
    const tree = `/admin/curriculum?subject_id=${subjectId}&education_level_id=${levelId}`
    await gotoApp('/admin/curriculum')
    expect(await optionValues(page, 'curriculum-subject')).toContain(subjectId)
    expect(await optionValues(page, 'curriculum-level')).toContain(levelId)
    await gotoApp(tree)
    await expect(page.getByTestId('stat-subject')).toContainText('Subjek QA')
    await expect(page.getByTestId('stat-level')).toContainText('Tahap QA')
    await expect(page.getByTestId('stat-chapters')).toContainText('0')
    await expect(page.getByTestId('stat-topics')).toContainText('0 / 0')
    await expect(page.getByTestId('tree-empty')).toBeVisible()

    // Chapter (S2) from "Tambah Bab Pertama".
    await page.getByTestId('chapter-add-first').click()
    await expect(page.getByTestId('chapter-subject')).toHaveValue(subjectId)
    await expect(page.getByTestId('chapter-level')).toHaveValue(levelId)
    await page.getByTestId('chapter-name').fill('Bab QA')
    await page.getByTestId('chapter-number').fill('1')
    await page.getByTestId('chapter-submit').click()
    await expect(page).toHaveURL(new RegExp(`subject_id=${subjectId}&education_level_id=${levelId}$`))
    await expect(page.getByTestId('chapter')).toHaveCount(1)
    await expect(page.getByTestId('stat-chapters')).toContainText('1')
    await expect(page.getByTestId('stat-topics')).toContainText('0 / 0')

    // Topic (S4).
    await page.getByTestId('topic-add').click()
    await expect(page.getByTestId('chapter-context')).toContainText('Bab 1: Bab QA')
    await page.getByTestId('topic-name').fill('Topik QA')
    await page.getByTestId('topic-number').fill('1')
    await page.getByTestId('topic-submit').click()
    await expect(page.getByTestId('topic')).toHaveCount(1)
    await expect(page.getByTestId('topic-heading')).toHaveText('Topik 1: Topik QA')
    await expect(page.getByTestId('stat-topics')).toContainText('1 / 0')

    // Subtopic inline.
    await page.getByTestId('topic-toggle').click()
    await expect(page.getByTestId('topic-subtopics')).toContainText('Tiada subtopik')
    await page.getByTestId('subtopic-add-toggle').click()
    await page.getByTestId('subtopic-add-name').fill('Subtopik QA')
    await page.getByTestId('subtopic-add-submit').click()
    await expect(page.getByTestId('stat-topics')).toContainText('1 / 1')
    await page.getByTestId('topic-toggle').click()
    await expect(page.getByTestId('subtopic-row')).toHaveCount(1)
    await expect(page.getByTestId('subtopic-row')).toContainText('Subtopik QA')

    // Reload keeps the data (persisted in the store, not the page).
    await gotoApp(tree)
    await expect(page.getByTestId('stat-chapters')).toContainText('1')
    await expect(page.getByTestId('stat-topics')).toContainText('1 / 1')

    // 4. Delete bottom-up; stats revert one step at a time.
    await page.getByTestId('topic-toggle').click()
    await confirmDelete(page, () => page.getByTestId('subtopic-delete').click())
    await expect(page.getByTestId('stat-topics')).toContainText('1 / 0')
    await confirmDelete(page, () => page.getByTestId('topic-delete').click())
    await expect(page.getByTestId('stat-topics')).toContainText('0 / 0')
    await expect(page.getByTestId('stat-chapters')).toContainText('1')
    await confirmDelete(page, () => page.getByTestId('chapter-delete').click())
    await expect(page.getByTestId('tree-empty')).toBeVisible()
    await expect(page.getByTestId('stat-chapters')).toContainText('0')

    // 5. Delete the subject: S6 count reverts, S9 link count reverts; then the level: S9 count reverts.
    await gotoApp('/admin/subjects')
    await confirmDelete(page, () => subjectRow(page, subjectId).getByTestId('subject-delete').click())
    await expect(subjectRow(page, subjectId)).toHaveCount(0)
    await expect(page.getByTestId('subjects-count')).toHaveText('Jumlah: 31 subjek')
    await gotoApp('/admin/education-levels')
    await expect(levelRow(page, levelId).getByTestId('level-subjects')).toHaveText('0 subjek')
    await confirmDelete(page, () => levelRow(page, levelId).getByTestId('level-delete').click())
    await expect(levelRow(page, levelId)).toHaveCount(0)
    await expect(page.getByTestId('levels-count')).toHaveText('Jumlah: 11 tahap')
    await gotoApp('/admin/curriculum')
    expect(await optionValues(page, 'curriculum-subject')).toHaveLength(31)
    expect(await optionValues(page, 'curriculum-level')).toHaveLength(11)
  })

  test('deleting a chapter that still has topics and subtopics cascades (stats of the pair, BR-10)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    // BM Darjah 1 chapter 35 has topic 59 with 2 subtopics.
    const tree = '/admin/curriculum?subject_id=1&education_level_id=1'
    await gotoApp(tree)
    await expect(page.getByTestId('chapter').first()).toBeVisible()
    const stat = async (id: string) => (await page.getByTestId(id).innerText()).replace(/\s+/g, ' ')
    const before = await stat('stat-topics')
    const [t0, s0] = (/(\d+) \/ (\d+)/.exec(before) ?? []).slice(1).map(Number) as [number, number]
    expect(s0).toBeGreaterThanOrEqual(2)
    const chapter = page.getByTestId('chapter').filter({ hasText: 'Mendengar dan Memahami' })
    const topicsInChapter = await chapter.getByTestId('topic').count()
    await confirmDelete(page, () => chapter.getByTestId('chapter-delete').click())
    await expect(page.getByTestId('chapter').filter({ hasText: 'Mendengar dan Memahami' })).toHaveCount(0)
    const after = await stat('stat-topics')
    const [t1, s1] = (/(\d+) \/ (\d+)/.exec(after) ?? []).slice(1).map(Number) as [number, number]
    expect(t1).toBe(t0 - topicsInChapter)
    expect(s1).toBeLessThanOrEqual(s0 - 2)
  })
})
