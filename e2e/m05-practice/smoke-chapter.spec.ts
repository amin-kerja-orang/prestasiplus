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

/** Ids of the locked chapter cards on S5. */
async function lockedChapterIds(page: Page): Promise<string[]> {
  await expect(page.locator('[data-testid^=chapter-card-][data-state=open]').first()).toBeVisible()
  const ids = await page
    .locator('[data-testid^=chapter-card-][data-state=locked]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? ''))
  return ids.map((x) => x.replace('chapter-card-', ''))
}

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
      await expect(tid(page, 'shell-user-title')).toHaveText('Soalan by Chapter')
      await expect(tid(page, 'shell-user-subtitle')).toHaveText(
        'Latihan tersusun ikut bab buku teks dan DSKP',
      )
      await expect(tid(page, 'chapter-index-page').getByRole('heading', { level: 1 })).toHaveText(
        'Soalan by Chapter',
      )
      await expect(tid(page, 'chapter-random')).toHaveAttribute('href', '/practice')
      await expect(tid(page, 'chapter-subject-grid').locator('> a')).toHaveCount(10)
      await expectNoHorizontalScroll(page)

      await tid(page, 'chapter-subject-MATH').click()
      await expect(page).toHaveURL(/\/practice\/chapter\/MATH$/)
      await expectTabTitle(page, 'Chapter Matematik | PRESTASIPLUS')
      await expect(tid(page, 'shell-user-title')).toHaveText('Soalan by Chapter')
      await expect(tid(page, 'shell-user-subtitle')).toHaveText('Matematik')
      await expect(tid(page, 'chapter-subject-name')).toHaveText('Matematik')
      await expect(tid(page, 'chapter-level-select').locator('option')).toHaveCount(4)
      await expect(tid(page, 'chapter-list').locator('[data-state=open]')).toHaveCount(1)
      await expect(tid(page, 'chapter-list').locator('[data-state=locked]').first()).toBeVisible()
      await expectNoHorizontalScroll(page)
    })
  }

  test('Q2 starts from an open chapter', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJAR)
    await gotoApp('/practice/chapter/MATH')
    await tid(page, 'chapter-count-1-5').click()
    await expect(page).toHaveURL(/\/practice\/chapter\/MATH\/1\/quiz\?count=5$/)
    await expect(tid(page, 'quiz-title')).toContainText('Bab 1:')
    await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 5')
    await expectTabTitle(page, 'Chapter Matematik | PRESTASIPLUS')
    await expectNoHorizontalScroll(page)
  })

  test('a locked chapter answers 409 and returns to S5 of its level without a message', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/practice/chapter/MATH')
    const lockedId = (await lockedChapterIds(page))[0] ?? ''
    // In-app navigation (no second boot): the router is the app's own.
    await page.evaluate((path) => {
      const el = document.querySelector('#app') as Element & {
        __vue_app__: {
          config: { globalProperties: { $router: { push(p: string): Promise<void> } } }
        }
      }
      void el.__vue_app__.config.globalProperties.$router.push(path)
    }, `/practice/chapter/MATH/${lockedId}/quiz?count=5`)
    await expect(page).toHaveURL(/\/practice\/chapter\/MATH\?level=1$/)
    await expect(tid(page, 'chapter-list')).toBeVisible()
    await expect(page.getByTestId('quiz-runner')).toHaveCount(0)
  })

  test('S6 lists the wrong-answer subjects and S7 opens from a card', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/practice/revision')
    await expectTabTitle(page, 'Soalan Aku Salah | PRESTASIPLUS')
    await expect(tid(page, 'shell-user-title')).toHaveText('Soalan Aku Salah')
    await expect(tid(page, 'shell-user-subtitle')).toHaveCount(0)
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
