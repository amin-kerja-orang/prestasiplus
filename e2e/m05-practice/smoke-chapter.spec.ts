/**
 * M05-T5 developer smoke (build-plan M05-T5): S4 `/practice/chapter`, S5 `/practice/chapter/:code`,
 * Q2 the chapter quiz, S6 `/practice/revision` and S7 `/practice/revision/:code`, as pelajar (2) and
 * guru (5; roles-matrix L14: the teacher opens S4 too) at 375 / 768 / 1280. The scenario-level checks
 * (SRS §12 rows 24–35 and the S4–S7 part of 54) are in `chapter-revision.spec.ts`.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, moduleTag, TAG } from '../support'

const PELAJAR = 'pelajar@demo.test'
const GURU = 'guru@demo.test'

const tid = (page: Page, id: string) => page.getByTestId(id)

/** The page title the Pembelajaran navbar prints (h1, or `shell-title` when the page owns its h1). */
const shellTitle = (page: Page) =>
  page.getByTestId('pembelajaran-header').locator('h1, [data-testid=shell-title]').first()

/** Ids of the open chapter cards on S5 (D98: no chapter is locked). */
async function openChapterIds(page: Page): Promise<string[]> {
  await expect(page.locator('[data-testid^=chapter-card-][data-state=open]').first()).toBeVisible()
  const ids = await page
    .locator('[data-testid^=chapter-card-][data-state=open]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? ''))
  return ids.map((x) => x.replace('chapter-card-', ''))
}

/** Layout default subtitle when the page sets none (V2 pelajar/layout.blade.php:462; the teacher shell greets by name). */
const DEFAULT_SUBTITLE = { pelajar: 'Selamat datang kembali', guru: 'Selamat datang, Guru Demo 👩‍🏫' } as const

test.describe('M05 S4 / S5 / Q2 / S6 / S7 smoke', { tag: [TAG.smoke, moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  for (const [who, label] of [
    [PELAJAR, 'pelajar'],
    [GURU, 'guru'],
  ] as const) {
    test(`S4 lists the chapter subjects and S5 opens from a card as ${label}`, async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(who)
      await gotoApp('/practice/chapter')
      await expectTabTitle(page, 'Soalan by Chapter | PRESTASIPLUS')
      await expect(shellTitle(page)).toHaveText('Soalan by Chapter')
      await expect(tid(page, 'pembelajaran-subtitle')).toHaveText(DEFAULT_SUBTITLE[label])
      // The shell prints the only h1 (asserted above); V2 bab.blade.php:10 had a second page h1, not kept in V3.
      await expect(tid(page, 'chapter-random')).toHaveAttribute('href', '/practice')
      await expect(tid(page, 'chapter-subject-grid').locator('> li > a')).toHaveCount(2)
      await expectNoHorizontalScroll(page)

      await tid(page, 'chapter-subject-MATH').click()
      await expect(page).toHaveURL(/\/practice\/chapter\/MATH(\?level=[^&]+)?$/)
      await expectTabTitle(page, 'Chapter Matematik | PRESTASIPLUS')
      await expect(shellTitle(page)).toHaveText('Soalan by Chapter')
      await expect(tid(page, 'pembelajaran-subtitle')).toHaveText('Matematik')
      await expect(tid(page, 'chapter-subject-name')).toHaveText('Matematik')
      // D72: Tingkatan 4 and 5 only. A USelect: the options live in the opened listbox.
      await tid(page, 'chapter-level-select').click()
      await expect(page.getByRole('option')).toHaveCount(2)
      await page.keyboard.press('Escape')
      await expect(tid(page, 'chapter-list').locator('[data-state=locked]')).toHaveCount(0)
      await expect(tid(page, 'chapter-list').locator('[data-state=open]').first()).toBeVisible()
      await expectNoHorizontalScroll(page)
    })
  }

  test('Q2 starts from an open chapter', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJAR)
    await gotoApp('/practice/chapter/MATH')
    const firstId = (await openChapterIds(page))[0] ?? ''
    await tid(page, `chapter-count-${firstId}-5`).click()
    await expect(page).toHaveURL(new RegExp(`/practice/chapter/MATH/${firstId}/quiz\\?count=5$`))
    await expect(tid(page, 'quiz-title')).toContainText('Bab 1:')
    await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 5')
    await expectTabTitle(page, 'Kuiz Matematik | PRESTASIPLUS')
    await expectNoHorizontalScroll(page)
  })

  test('the second chapter starts a session without completing the first (D98, no chapter lock)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/practice/chapter/MATH')
    const secondId = (await openChapterIds(page))[1] ?? ''
    // In-app navigation (no second boot): the router is the app's own.
    await page.evaluate((path) => {
      const el = document.querySelector('#app') as Element & {
        __vue_app__: {
          config: { globalProperties: { $router: { push(p: string): Promise<void> } } }
        }
      }
      void el.__vue_app__.config.globalProperties.$router.push(path)
    }, `/practice/chapter/MATH/${secondId}/quiz?count=5`)
    await expect(page).toHaveURL(/\/practice\/chapter\/MATH\/\d+\/quiz\?count=5$/)
    await expect(page.getByTestId('quiz-runner')).toBeVisible()
  })

  test('S6 lists the wrong-answer subjects and S7 opens from a card', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/practice/revision')
    await expectTabTitle(page, 'Soalan Aku Salah | PRESTASIPLUS')
    await expect(shellTitle(page)).toHaveText('Soalan Aku Salah')
    await expect(tid(page, 'pembelajaran-subtitle')).toHaveText('Ulang kaji soalan yang pernah dijawab salah')
    await expect(tid(page, 'revision-total')).toContainText('soalan perlu diulang kaji')
    await expect(tid(page, 'revision-tips')).toContainText('Tips Ulang Kaji')
    await expectNoHorizontalScroll(page)

    await page.locator('[data-testid^=revision-subject-][href]').first().click()
    await expect(page).toHaveURL(/\/practice\/revision\/[A-Z]+$/)
    await expect(tid(page, 'quiz-title')).toContainText('Ulang Kaji — ')
    await expect(tid(page, 'chip-revision')).toHaveText(
      'Mode Ulang Kaji — soalan ini pernah dijawab salah',
    )
    await expectNoHorizontalScroll(page)
  })

  for (const path of [
    '/practice/chapter/XYZ',
    '/practice/chapter/XYZ/1/quiz?count=5',
    '/practice/revision/XYZ',
  ]) {
    test(`an unknown subject code is the global 404 page on ${path}`, async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(PELAJAR)
      await gotoApp(path)
      await expectTabTitle(page, 'Halaman Tidak Dijumpai | PRESTASIPLUS')
    })
  }
})
