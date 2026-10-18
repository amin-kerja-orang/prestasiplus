/**
 * M03-T3 E2E for S1-S5 (the admin curriculum browser and the chapter / topic forms; SRS §12 E2E-M03-01..20
 * and the S1-S5 part of 48 / 52), as the admin demo account at 375 / 768 / 1280. Success flashes are
 * UNVERIFIED COPY (SRS §8), so the tests that assert their text are `@provisional`.
 *
 * Seeds used (SRS §6.9): Matematik = subject 3, Tingkatan 4 = level 10 (10 chapters, 24 topics, 0 subtopics;
 * chapter 91 "Fungsi dan Persamaan Kuadratik" with topics 126 / 380 / 127), Bahasa Melayu = subject 1, Darjah 1
 * = level 1 (chapter 35 with topic 59 "Mendengar dan Memahami" and 2 subtopics), Bahasa Inggeris = subject 2,
 * Tingkatan 3 = level 9 (empty).
 */

import type { Page } from '@playwright/test'

import { reloadApp } from '../fixtures/mock-handle'
import { expect, test } from '../fixtures/test'
import {
  acceptNextDialog,
  dismissNextDialog,
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isMobileWidth,
  moduleTag,
  provisional,
  TAG,
} from '../support'

const ADMIN = 'admin@demo.test'
const MATH_T4 = '/admin/curriculum?subject_id=3&education_level_id=10'
const BM_D1 = '/admin/curriculum?subject_id=1&education_level_id=1'
const TREE_TAB = 'Pengurusan Kurikulum - Admin PRESTASIPLUS'

const chapters = (page: Page) => page.getByTestId('chapter')
const flash = (page: Page) => page.getByTestId('cmp-flash')

/** The computed font size (px) of the smallest visible text node inside `main`. */
async function smallestTextPx(page: Page): Promise<number> {
  return page.evaluate(() => {
    const main = document.querySelector('main')
    if (!main) return 0
    let min = Infinity
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent || n.textContent.trim() === '') continue
      const el = n.parentElement
      if (!el || el.closest('svg')) continue
      const rect = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      if (rect.width === 0 || rect.height === 0 || style.visibility === 'hidden') continue
      min = Math.min(min, parseFloat(style.fontSize))
    }
    return min === Infinity ? 0 : min
  })
}

test.describe('M03 S1 curriculum browser', { tag: [TAG.smoke, moduleTag(3)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M03-01 default: tab title, filter card, options and the prompt', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/curriculum')
    await expect(page.getByTestId('curriculum-prompt')).toBeVisible()
    await expectTabTitle(page, TREE_TAB)
    await expect(page.getByText('Tapis Kurikulum')).toBeVisible()
    await expect(page.getByTestId('curriculum-prompt')).toContainText(
      'Sila pilih subjek dan tahap pendidikan',
    )
    await expect(page.getByTestId('curriculum-prompt')).toContainText('Gunakan penapis di atas')
    const subjects = page.getByTestId('curriculum-subject').locator('option')
    await expect(subjects).toHaveCount(32)
    await expect(subjects.first()).toHaveText('-- Pilih Subjek --')
    const levels = page.getByTestId('curriculum-level').locator('option')
    await expect(levels).toHaveCount(12)
    await expect(levels.first()).toHaveText('-- Pilih Tahap --')
    await expect(page.getByTestId('curriculum-stats')).toHaveCount(0)
    await expectNoHorizontalScroll(page)

    await gotoApp('/admin/curriculum?subject_id=3')
    await expect(page.getByTestId('curriculum-prompt')).toBeVisible()
    await expect(page.getByTestId('curriculum-subject')).toHaveValue('3')
    await expect(page.getByTestId('curriculum-stats')).toHaveCount(0)
  })

  test('E2E-M03-02 filter: URL, cards and the "Tambah Bab" link', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/curriculum')
    await page.getByTestId('curriculum-subject').selectOption('3')
    await page.getByTestId('curriculum-level').selectOption('10')
    await page.getByTestId('curriculum-filter-submit').click()
    await expect(page).toHaveURL(/\/admin\/curriculum\?subject_id=3&education_level_id=10$/)
    await expect(page.getByTestId('curriculum-stats')).toBeVisible()
    await expect(page.getByTestId('curriculum-subject')).toHaveValue('3')
    await expect(page.getByTestId('curriculum-level')).toHaveValue('10')
    await expect(page.getByTestId('stat-subject')).toContainText('Matematik')
    await expect(page.getByTestId('stat-level')).toContainText('Tingkatan 4')
    await expect(page.getByTestId('stat-chapters')).toContainText('10')
    await expect(page.getByTestId('stat-topics')).toContainText('24 / 0')
    await expect(page.getByTestId('chapter-add')).toHaveAttribute(
      'href',
      '/admin/curriculum/chapters/create?subject_id=3&education_level_id=10',
    )
    await expectTouchTarget(page.getByTestId('chapter-add'))
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M03-03 tree: chevrons, descriptions, "Tiada subtopik"', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(MATH_T4)
    await expect(chapters(page)).toHaveCount(10)
    const first = chapters(page).first()
    await expect(first.getByTestId('chapter-heading')).toHaveText(
      'Bab 1: Fungsi dan Persamaan Kuadratik',
    )
    await expect(first.getByTestId('chapter-topics')).toBeVisible()
    await expect(first.getByTestId('topic-description').first()).toHaveText(
      'Konsep fungsi dan graf',
    )
    await first.getByTestId('chapter-toggle').click()
    await expect(first.getByTestId('chapter-topics')).toBeHidden()
    await first.getByTestId('chapter-toggle').click()
    await expect(first.getByTestId('chapter-topics')).toBeVisible()

    await expect(first.getByTestId('topic-subtopics')).toHaveCount(0)
    await first.getByTestId('topic-toggle').first().click()
    await expect(first.getByTestId('topic-subtopics').first()).toContainText('Tiada subtopik')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M03-04 subtopic rows of Bahasa Melayu Darjah 1', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp(BM_D1)
    const topic = page.getByTestId('topic').filter({ hasText: 'Topik 1: Mendengar dan Memahami' })
    await topic.getByTestId('topic-toggle').click()
    await expect(topic.getByTestId('subtopic-row')).toHaveCount(2)
    await expect(topic.getByTestId('subtopic-row').first()).toContainText(
      'Mendengar sebutan dan intonasi',
    )
    await expect(topic.getByTestId('subtopic-edit').first()).toHaveAttribute(
      'title',
      'Edit Subtopik',
    )
    await expect(topic.getByTestId('subtopic-delete').first()).toHaveAttribute(
      'title',
      'Padam Subtopik',
    )
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M03-05 ordering: topics of Matematik T4 Bab 1 read Topik 1, 2, 3', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(MATH_T4)
    const headings = chapters(page).first().getByTestId('topic-heading')
    await expect(headings).toHaveCount(3)
    await expect(headings.nth(0)).toHaveText(/^Topik 1: /)
    await expect(headings.nth(1)).toHaveText(/^Topik 2: /)
    await expect(headings.nth(2)).toHaveText(/^Topik 3: /)
    await gotoApp('/admin/curriculum?subject_id=3&education_level_id=1')
    await expect(chapters(page).first()).toBeVisible()
    const numbers = await page.getByTestId('chapter-heading').allInnerTexts()
    const parsed = numbers.map((t) => Number(/^Bab (\d+):/.exec(t)?.[1]))
    expect(parsed.length).toBeGreaterThan(1)
    expect(parsed).toEqual([...parsed].sort((a, b) => a - b))
  })

  test('E2E-M03-07 empty trees show the inbox text and "Tambah Bab Pertama"', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/curriculum?subject_id=2&education_level_id=9')
    await expect(page.getByTestId('tree-empty')).toContainText(
      'Tiada bab dijumpai untuk subjek dan tahap ini.',
    )
    await expect(page.getByTestId('stat-chapters')).toContainText('0')
    await expect(page.getByTestId('stat-topics')).toContainText('0 / 0')
    await expect(page.getByTestId('chapter-add-first')).toHaveAttribute(
      'href',
      '/admin/curriculum/chapters/create?subject_id=2&education_level_id=9',
    )
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M03-08 "Tambah Topik" after every chapter', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp(MATH_T4)
    await expect(page.getByTestId('topic-add')).toHaveCount(10)
    await expect(page.getByTestId('topic-add').first()).toHaveAttribute(
      'href',
      '/admin/curriculum/topics/create?chapter_id=91',
    )
    await expect(page.getByTestId('chapter-edit').first()).toHaveAttribute(
      'href',
      '/admin/curriculum/chapters/91/edit',
    )
    await expect(page.getByTestId('topic-edit').first()).toHaveAttribute(
      'href',
      '/admin/curriculum/topics/126/edit',
    )
  })

  test(
    'E2E-M03-09 delete a chapter: cancel keeps, accept removes it and flashes',
    provisional('The success flash text is a placeholder (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp(MATH_T4)
      await expect(chapters(page)).toHaveCount(10)
      const chapter = chapters(page).first()
      await expect(chapter.getByTestId('chapter-delete')).toHaveAttribute('title', 'Padam Bab')
      await expectTouchTarget(chapter.getByTestId('chapter-delete'), isMobileWidth(page) ? 44 : 32)

      const dismissed = dismissNextDialog(page, {
        type: 'confirm',
        message: 'Adakah anda pasti mahu padam bab ini?',
      })
      await chapter.getByTestId('chapter-delete').click()
      await dismissed
      await expect(chapters(page)).toHaveCount(10)

      const accepted = acceptNextDialog(page, { type: 'confirm' })
      await chapter.getByTestId('chapter-delete').click()
      await accepted
      await expect(chapters(page)).toHaveCount(9)
      await expect(page.getByTestId('stat-chapters')).toContainText('9')
      await expect(flash(page)).toContainText('Bab berjaya dipadam.')
      await expect(page).toHaveURL(/subject_id=3&education_level_id=10$/)
      await expect(page.getByText('Fungsi dan Persamaan Kuadratik')).toHaveCount(0)
    },
  )

  test(
    'E2E-M03-10 delete a topic and a subtopic',
    provisional('The success flash text is a placeholder (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp(BM_D1)
      const topic = page.getByTestId('topic').filter({ hasText: 'Topik 1: Mendengar dan Memahami' })
      await topic.getByTestId('topic-toggle').click()
      await expect(topic.getByTestId('subtopic-row')).toHaveCount(2)

      const dismissed = dismissNextDialog(page, {
        type: 'confirm',
        message: 'Adakah anda pasti mahu padam subtopik ini?',
      })
      await topic.getByTestId('subtopic-delete').first().click()
      await dismissed
      await expect(topic.getByTestId('subtopic-row')).toHaveCount(2)

      const accepted = acceptNextDialog(page, { type: 'confirm' })
      await topic.getByTestId('subtopic-delete').first().click()
      await accepted
      await expect(flash(page)).toContainText('Subtopik berjaya dipadam.')
      // The tree reloaded: the topics are collapsed again.
      await topic.getByTestId('topic-toggle').click()
      await expect(topic.getByTestId('subtopic-row')).toHaveCount(1)

      const topicDelete = acceptNextDialog(page, {
        type: 'confirm',
        message: 'Adakah anda pasti mahu padam topik ini?',
      })
      await topic.getByTestId('topic-delete').click()
      await topicDelete
      await expect(flash(page)).toContainText('Topik berjaya dipadam.')
      await expect(page.getByText('Mendengar dan Memahami')).toHaveCount(0)
    },
  )

  test(
    'E2E-M03-11 add a subtopic: "Batal" hides but keeps the typed text; empty name blocked',
    provisional('The success flash text is a placeholder (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp(BM_D1)
      const topic = page.getByTestId('topic').filter({ hasText: 'Topik 1: Mendengar dan Memahami' })
      await topic.getByTestId('topic-toggle').click()
      const toggle = topic.getByTestId('subtopic-add-toggle')
      await expect(toggle).toHaveText('Tambah Subtopik')
      await expect(topic.getByTestId('subtopic-add-form')).toBeHidden()
      await toggle.click()
      await expect(toggle).toHaveText('Batal')
      const name = topic.getByTestId('subtopic-add-name')
      await expect(name).toHaveAttribute('placeholder', 'Nama Subtopik (BM)')
      await expect(topic.getByTestId('subtopic-add-name-en')).toHaveAttribute(
        'placeholder',
        'Nama Subtopik (EN)',
      )
      await expect(topic.getByTestId('subtopic-add-objective')).toHaveAttribute(
        'placeholder',
        'Objektif Pembelajaran',
      )
      await name.fill('Draf')
      await toggle.click()
      await expect(topic.getByTestId('subtopic-add-form')).toBeHidden()
      await expect(topic.getByTestId('subtopic-row')).toHaveCount(2)
      await toggle.click()
      await expect(name).toHaveValue('Draf')

      // Native `required`: an empty name does not submit.
      await name.fill('')
      await topic.getByTestId('subtopic-add-submit').click()
      await expect(topic.getByTestId('subtopic-row')).toHaveCount(2)
      await expect(flash(page)).toHaveCount(0)

      await name.fill('Subtopik Demo')
      await topic.getByTestId('subtopic-add-submit').click()
      await expect(flash(page)).toContainText('Subtopik berjaya ditambah.')
      await topic.getByTestId('topic-toggle').click()
      await expect(topic.getByTestId('subtopic-row')).toHaveCount(3)
      await expect(topic.getByTestId('subtopic-row').last()).toContainText('Subtopik Demo')
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'E2E-M03-12 edit a subtopic inline: one at a time, "Batal" keeps the typed text, "Simpan" saves',
    provisional('The success flash text is a placeholder (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp(BM_D1)
      const topic = page.getByTestId('topic').filter({ hasText: 'Topik 1: Mendengar dan Memahami' })
      await topic.getByTestId('topic-toggle').click()
      const rows = topic.getByTestId('subtopic-row')
      const forms = topic.getByTestId('subtopic-edit-form')
      await topic.getByTestId('subtopic-edit').first().click()
      await expect(rows.first()).toBeHidden()
      await expect(forms.first()).toBeVisible()
      const name = topic.getByTestId('subtopic-edit-name').first()
      await expect(name).toHaveValue('Mendengar sebutan dan intonasi')
      await expect(topic.getByTestId('subtopic-edit-name-en').first()).toHaveValue(
        'Listening to pronunciation and intonation',
      )

      // Opening another row closes the first.
      await topic.getByTestId('subtopic-edit').nth(1).click()
      await expect(forms.first()).toBeHidden()
      await expect(rows.first()).toBeVisible()
      await expect(forms.nth(1)).toBeVisible()

      await topic.getByTestId('subtopic-edit').first().click()
      await name.fill('Diubah')
      await topic.getByTestId('subtopic-edit-cancel').first().click()
      await expect(rows.first()).toContainText('Mendengar sebutan dan intonasi')
      await topic.getByTestId('subtopic-edit').first().click()
      await expect(name).toHaveValue('Diubah')

      await topic.getByTestId('subtopic-edit-save').first().click()
      await expect(flash(page)).toContainText('Subtopik berjaya dikemaskini.')
      await topic.getByTestId('topic-toggle').click()
      await expect(rows.first()).toContainText('Diubah')
    },
  )

  test('E2E-M03-13a unknown chapter redirects to S1 with a one-time flash', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/curriculum/chapters/zzz/edit')
    await expect(page).toHaveURL(/\/admin\/curriculum$/)
    await expect(flash(page)).toHaveText('Bab tidak dijumpai.')
    await expectTabTitle(page, TREE_TAB)

    // The flash is shown once: a reload clears it.
    await reloadApp(page)
    await expect(page.getByTestId('curriculum-prompt')).toBeVisible()
    await expect(flash(page)).toHaveCount(0)
  })

  test('E2E-M03-13b S4 with an unknown or missing chapter id redirects with the flash', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/curriculum/topics/create?chapter_id=zzz')
    await expect(page).toHaveURL(/\/admin\/curriculum$/)
    await expect(flash(page)).toHaveText('Bab tidak dijumpai.')

    await gotoApp('/admin/curriculum/topics/create')
    await expect(page).toHaveURL(/\/admin\/curriculum$/)
    await expect(flash(page)).toHaveText('Chapter ID diperlukan.')
  })

  test('E2E-M03-13c unknown topic redirects to S1 with the flash', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/curriculum/topics/zzz/edit')
    await expect(page).toHaveURL(/\/admin\/curriculum$/)
    await expect(flash(page)).toHaveText('Topik tidak dijumpai.')
  })
})

test.describe('M03 S2 create chapter', { tag: [TAG.smoke, moduleTag(3)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M03-14 form from "Tambah Bab": pre-selected pair, labels, placeholders, no "Aktif"', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(MATH_T4)
    await page.getByTestId('chapter-add').click()
    await expect(page.getByTestId('chapter-form')).toBeVisible()
    await expectTabTitle(page, 'Tambah Bab - Admin PRESTASIPLUS')
    await expect(page.getByTestId('chapter-subject')).toHaveValue('3')
    await expect(page.getByTestId('chapter-level')).toHaveValue('10')
    await expect(page.getByTestId('chapter-name')).toHaveAttribute(
      'placeholder',
      'cth: Nombor Bulat',
    )
    await expect(page.getByTestId('chapter-name-en')).toHaveAttribute(
      'placeholder',
      'e.g: Whole Numbers',
    )
    await expect(page.getByTestId('chapter-number')).toHaveAttribute('placeholder', 'cth: 1')
    await expect(page.getByTestId('chapter-form')).toContainText('Contoh: 1, 2, 3 (opsional)')
    await expect(page.getByTestId('chapter-description')).toHaveAttribute(
      'placeholder',
      'Penerangan ringkas tentang bab ini...',
    )
    await expect(page.getByTestId('chapter-active')).toHaveCount(0)
    await expect(page.getByTestId('form-submit')).toHaveText('Simpan Bab')
    await expect(page.getByTestId('form-cancel')).toHaveText('Batal')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M03-15a without a query the selects are empty and the links go to S1', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/curriculum/chapters/create')
    await expect(page.getByTestId('chapter-subject')).toHaveValue('')
    await expect(page.getByTestId('chapter-level')).toHaveValue('')
    await expect(page.getByTestId('curriculum-back')).toHaveAttribute('href', '/admin/curriculum')
    await expect(page.getByTestId('form-cancel')).toHaveAttribute('href', '/admin/curriculum')
  })

  test('E2E-M03-15b with one parameter the links carry only that parameter', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/curriculum/chapters/create?subject_id=3')
    await expect(page.getByTestId('curriculum-back')).toHaveAttribute(
      'href',
      '/admin/curriculum?subject_id=3',
    )
    await expect(page.getByTestId('form-cancel')).toHaveAttribute(
      'href',
      '/admin/curriculum?subject_id=3',
    )
  })

  test('E2E-M03-15c with both parameters "Batal" returns to the filtered tree', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/curriculum/chapters/create?subject_id=3&education_level_id=10')
    await expect(page.getByTestId('form-cancel')).toHaveAttribute('href', MATH_T4)
    await page.getByTestId('form-cancel').click()
    await expect(page).toHaveURL(/\/admin\/curriculum\?subject_id=3&education_level_id=10$/)
    await expect(page.getByTestId('curriculum-tree')).toBeVisible()
  })

  test(
    'E2E-M03-16 native validation blocks; a valid chapter is listed in number order with a flash',
    provisional('The success flash text is a placeholder (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/curriculum/chapters/create?subject_id=3&education_level_id=10')
      await expect(page.getByTestId('chapter-form')).toBeVisible()
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL(/chapters\/create/)
      await page.getByTestId('chapter-name').fill('Bab 11 Demo')
      await page.getByTestId('chapter-number').fill('0')
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL(/chapters\/create/)

      await page.getByTestId('chapter-number').fill('11')
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL(/\/admin\/curriculum\?subject_id=3&education_level_id=10$/)
      await expect(flash(page)).toContainText('Bab berjaya ditambah.')
      await expect(chapters(page)).toHaveCount(11)
      await expect(chapters(page).last().getByTestId('chapter-heading')).toHaveText(
        'Bab 11: Bab 11 Demo',
      )
    },
  )

  test('E2E-M03-16b a server rejection shows the red box and keeps the input', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/curriculum/chapters/create?subject_id=3&education_level_id=10')
    await expect(page.getByTestId('chapter-form')).toBeVisible()
    await mock.failNext('/api/admin/curriculum/chapters', {
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Invalid',
      fields: { name: 'The name field is required.' },
    })
    await page.getByTestId('chapter-name').fill('Kekal')
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('curriculum-form-alert')).toContainText(
      'The name field is required.',
    )
    await expect(page.getByTestId('chapter-name')).toHaveValue('Kekal')
    await expect(page).toHaveURL(/chapters\/create/)
  })
})

test.describe('M03 S3 edit chapter', { tag: [TAG.smoke, moduleTag(3)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M03-17 chapter 91 via "Edit Bab": values, "Aktif", back links', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(MATH_T4)
    await chapters(page).first().getByTestId('chapter-edit').click()
    await expect(page).toHaveURL(/\/admin\/curriculum\/chapters\/91\/edit$/)
    await expect(page.getByTestId('chapter-form')).toBeVisible()
    await expectTabTitle(page, 'Edit Bab - Admin PRESTASIPLUS')
    await expect(page.getByTestId('chapter-subject')).toHaveValue('3')
    await expect(page.getByTestId('chapter-level')).toHaveValue('10')
    await expect(page.getByTestId('chapter-name')).toHaveValue('Fungsi dan Persamaan Kuadratik')
    await expect(page.getByTestId('chapter-name-en')).toHaveValue(
      'Functions and Quadratic Equations',
    )
    await expect(page.getByTestId('chapter-number')).toHaveValue('1')
    await expect(page.getByTestId('chapter-description')).toHaveValue('')
    await expect(page.getByTestId('chapter-active')).toBeChecked()
    await expect(page.getByTestId('chapter-form')).toContainText(
      'Nyahtanda jika bab ini tidak mahu dipaparkan buat masa ini',
    )
    await expect(page.getByTestId('form-submit')).toHaveText('Kemaskini Bab')
    await expect(page.getByTestId('curriculum-back')).toHaveAttribute('href', MATH_T4)
    await expect(page.getByTestId('form-cancel')).toHaveAttribute('href', MATH_T4)
    await expectNoHorizontalScroll(page)
  })

  test(
    'E2E-M03-18 save with "Aktif" unticked stays listed; moving to Tingkatan 5 keeps its topics',
    provisional('The success flash text is a placeholder (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/curriculum/chapters/91/edit')
      await expect(page.getByTestId('chapter-form')).toBeVisible()
      await page.getByTestId('chapter-active').uncheck()
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL(/\/admin\/curriculum\?subject_id=3&education_level_id=10$/)
      await expect(flash(page)).toContainText('Bab berjaya dikemaskini.')
      await expect(page.getByText('Bab 1: Fungsi dan Persamaan Kuadratik')).toBeVisible()

      await gotoApp('/admin/curriculum/chapters/91/edit')
      await expect(page.getByTestId('chapter-active')).not.toBeChecked()
      await page.getByTestId('chapter-level').selectOption('11')
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL(/\/admin\/curriculum\?subject_id=3&education_level_id=11$/)
      const moved = chapters(page).filter({ hasText: 'Fungsi dan Persamaan Kuadratik' })
      await expect(moved).toHaveCount(1)
      await expect(moved.getByTestId('topic')).toHaveCount(3)
    },
  )
})

test.describe('M03 S4 create topic', { tag: [TAG.smoke, moduleTag(3)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test(
    'E2E-M03-19 chapter 91: context card, fields, native validation, saved topic in number order',
    provisional('The success flash text is a placeholder (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp(MATH_T4)
      await chapters(page).first().getByTestId('topic-add').click()
      await expect(page.getByTestId('topic-form')).toBeVisible()
      await expectTabTitle(page, 'Tambah Topik - Admin PRESTASIPLUS')
      const context = page.getByTestId('chapter-context')
      await expect(context).toContainText('Bab')
      await expect(context).toContainText('Bab 1: Fungsi dan Persamaan Kuadratik')
      await expect(page.getByTestId('context-subject')).toHaveText('Matematik')
      await expect(page.getByTestId('context-level')).toHaveText('Tingkatan 4')
      await expect(page.getByTestId('topic-name')).toHaveAttribute(
        'placeholder',
        'cth: Nombor hingga 1000',
      )
      await expect(page.getByTestId('topic-name-en')).toHaveAttribute(
        'placeholder',
        'e.g: Numbers up to 1000',
      )
      await expect(page.getByTestId('topic-number')).toHaveAttribute('placeholder', 'cth: 1.1')
      await expect(page.getByTestId('topic-standard')).toHaveAttribute(
        'placeholder',
        'Standard pembelajaran mengikut kurikulum KSSM/KSSR...',
      )
      await expect(page.getByTestId('topic-form')).toContainText('Contoh: 1.1, 1.2, 2.1 (opsional)')
      await expect(page.getByTestId('topic-form')).toContainText(
        'Rujuk dokumen standard kurikulum KPM',
      )
      await expect(page.getByTestId('topic-active')).toHaveCount(0)
      await expect(page.getByTestId('form-submit')).toHaveText('Simpan Topik')
      await expectNoHorizontalScroll(page)

      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL(/topics\/create/)

      await page.getByTestId('topic-name').fill('Topik Demo')
      await page.getByTestId('topic-number').fill('1.5')
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL(/\/admin\/curriculum\?subject_id=3&education_level_id=10$/)
      await expect(flash(page)).toContainText('Topik berjaya ditambah.')
      const headings = chapters(page).first().getByTestId('topic-heading')
      // Natural topic-number order: 1, 1.5, 2, 3.
      await expect(headings).toHaveCount(4)
      await expect(headings.nth(1)).toHaveText('Topik 1.5: Topik Demo')
    },
  )
})

test.describe('M03 S5 edit topic', { tag: [TAG.smoke, moduleTag(3)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test(
    'E2E-M03-20 topic 126 via "Edit Topik": context, values, "Aktif", no chapter select, save',
    provisional('The success flash text is a placeholder (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp(MATH_T4)
      await chapters(page).first().getByTestId('topic-edit').first().click()
      await expect(page).toHaveURL(/\/admin\/curriculum\/topics\/126\/edit$/)
      await expect(page.getByTestId('topic-form')).toBeVisible()
      await expectTabTitle(page, 'Edit Topik - Admin PRESTASIPLUS')
      await expect(page.getByTestId('chapter-context')).toContainText(
        'Bab 1: Fungsi dan Persamaan Kuadratik',
      )
      await expect(page.getByTestId('topic-name')).toHaveValue('Fungsi')
      await expect(page.getByTestId('topic-name-en')).toHaveValue('Functions')
      await expect(page.getByTestId('topic-number')).toHaveValue('1')
      await expect(page.getByTestId('topic-description')).toHaveValue('Konsep fungsi dan graf')
      await expect(page.getByTestId('topic-standard')).toHaveValue('')
      await expect(page.getByTestId('topic-active')).toBeChecked()
      await expect(page.getByTestId('topic-form')).toContainText(
        'Nyahtanda jika topik ini tidak mahu dipaparkan buat masa ini',
      )
      await expect(page.locator('main select')).toHaveCount(0)
      await expect(page.getByTestId('form-submit')).toHaveText('Kemaskini Topik')
      await expect(page.getByTestId('curriculum-back')).toHaveAttribute('href', MATH_T4)

      await page.getByTestId('topic-name').fill('Fungsi Diubah')
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL(/\/admin\/curriculum\?subject_id=3&education_level_id=10$/)
      await expect(flash(page)).toContainText('Topik berjaya dikemaskini.')
      await expect(page.getByText('Topik 1: Fungsi Diubah')).toBeVisible()
    },
  )
})

test.describe('M03 S1-S5 responsive sweep', { tag: [moduleTag(3)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  const SCREENS = [
    { name: 'S1 prompt', path: '/admin/curriculum', ready: 'curriculum-prompt' },
    { name: 'S1 tree', path: MATH_T4, ready: 'curriculum-tree' },
    {
      name: 'S2',
      path: '/admin/curriculum/chapters/create?subject_id=3&education_level_id=10',
      ready: 'chapter-form',
    },
    { name: 'S3', path: '/admin/curriculum/chapters/91/edit', ready: 'chapter-form' },
    { name: 'S4', path: '/admin/curriculum/topics/create?chapter_id=91', ready: 'topic-form' },
    { name: 'S5', path: '/admin/curriculum/topics/126/edit', ready: 'topic-form' },
  ]

  for (const screen of SCREENS) {
    test(`E2E-M03-52 ${screen.name}: no h-scroll, text >= 12px, buttons on one row`, async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(ADMIN)
      await gotoApp(screen.path)
      await expect(page.getByTestId(screen.ready)).toBeVisible()
      await expectNoHorizontalScroll(page)
      expect(await smallestTextPx(page)).toBeGreaterThanOrEqual(12)

      if (screen.ready.endsWith('-form')) {
        const prefix = screen.ready.startsWith('chapter') ? 'chapter' : 'topic'
        const cancel = await page.getByTestId(`${prefix}-cancel`).boundingBox()
        const submit = await page.getByTestId(`${prefix}-submit`).boundingBox()
        expect(cancel).not.toBeNull()
        expect(submit).not.toBeNull()
        // One row, right-aligned: same vertical band, the submit button is the right-most.
        expect(Math.abs(cancel!.y - submit!.y)).toBeLessThan(8)
        expect(cancel!.x).toBeLessThan(submit!.x)
        const width = page.viewportSize()!.width
        expect(submit!.x + submit!.width).toBeLessThanOrEqual(width)
        await expectTouchTarget(page.getByTestId(`${prefix}-submit`))
      }
    })
  }

  test('E2E-M03-52 S1 tree: names wrap (no ellipsis) and the cards fit', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(MATH_T4)
    await expect(chapters(page)).toHaveCount(10)
    const truncated = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid=chapter-heading], [data-testid=topic-heading]')]
        .filter((el) => getComputedStyle(el).textOverflow === 'ellipsis')
        .map((el) => el.textContent),
    )
    expect(truncated).toEqual([])
    await expect(page.getByTestId('curriculum-stats')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })
})
