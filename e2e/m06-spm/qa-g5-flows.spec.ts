/**
 * QA G5 (row L18, M06 SPM): one end-to-end flow per area, driven from the hub the way a pupil would.
 *
 * - F1 hub -> databank -> Q1 -> results -> S10 / S1 stats (AC-M06-01.5, 05.2, 06.1, 06.2)
 * - F2 hub -> latih tubi -> S4 config -> Q2 -> results -> S10 `?type=latih_tubi` (AC-M06-07 ... 10)
 * - F3 hub -> Tracking A -> AKAUN set 3 -> Q3 -> results -> S10; a refused (locked) set returns to S6
 *   with no session (AC-M06-11 ... 15)
 * - F4 S11 -> Q4 -> S12 -> S13 (AC-M06-19 ... 22), Q4 is provisional
 *
 * Quiz answers are picked blind ("A"), so only consistency is asserted, never an exact score.
 */

import { expectNoHorizontalScroll, moduleTag, navigateInApp, provisional, viewportWidth } from '../support'
import { expect, test } from './fixtures'
import { answerFrom, PELAJAR, tid } from './support'

test.describe.configure({ timeout: 360_000 })
test.use({ mockInit: { latency: 0 } })

test.describe('QA-G5 M06 flows', { tag: [moduleTag(6)] }, () => {
  test('F1 hub -> databank (Matematik, 5) -> Q1 -> results -> S10 and S1', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm')
    await expect(tid(page, 'spm-hub-page')).toBeVisible({ timeout: 60_000 })
    const before = await page
      .locator('[data-testid=spm-mine-sessions] [data-testid=mine-value]')
      .innerText()
    // Hub module card -> S2 (an in-app navigation, not a reload).
    await page.locator('a[href="/spm/tahun-lepas"]').first().click()
    await expect(page).toHaveURL(/\/spm\/tahun-lepas$/)
    await expect(tid(page, 'databank-grid')).toBeVisible()
    await expect(tid(page, 'databank-set-MATH-5')).toHaveAttribute(
      'href',
      '/spm/tahun-lepas/MATH/quiz?count=5',
    )
    await tid(page, 'databank-set-MATH-5').click()
    await expect(page).toHaveURL(/\/spm\/tahun-lepas\/MATH\/quiz\?count=5$/)
    await expect(tid(page, 'quiz-title')).toHaveText('Matematik')
    await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 5')
    const sessions = (await mock.requests('/api/practice/sessions')).filter((r) => r.method === 'POST')
    expect(sessions[0]?.body).toMatchObject({ mode: 'past_year', subjectCode: 'MATH', count: 5 })

    const right = await answerFrom(page, 1, 5)
    await expect(tid(page, 'quiz-results')).toBeVisible()
    await expectNoHorizontalScroll(page)
    const correct = right.filter(Boolean).length
    await expect(tid(page, 'result-score')).toContainText(`${String(correct)}`)

    await gotoApp('/spm/history')
    const first = page.getByTestId('history-row').first()
    await expect(first.getByTestId('row-badge')).toHaveText('Tahun Lepas')
    await expect(first.getByTestId('row-correct')).toHaveText(`${String(correct)}/5 betul`)
    await expect(first.getByTestId('row-coins')).toContainText(`+${String(correct)}`)
    await gotoApp('/spm')
    await expect(
      page.locator('[data-testid=spm-mine-sessions] [data-testid=mine-value]'),
    ).toHaveText(String(Number(before) + 1))
  })

  test('F2 S3 -> S4 config (Tingkatan 5 + Sukar) -> Q2 -> results -> S10 latih_tubi', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm/latih-tubi')
    await expect(tid(page, 'spm-latih-tubi-page')).toBeVisible({ timeout: 60_000 })
    await page.locator('a[href="/spm/latih-tubi/MATH"]').first().click()
    await expect(page).toHaveURL(/\/spm\/latih-tubi\/MATH$/)
    await expect(tid(page, 'config-title')).toHaveText('Matematik')
    await tid(page, 'level-11').click()
    await tid(page, 'difficulty-4').click()
    await expect(tid(page, 'config-start')).toHaveAttribute(
      'href',
      '/spm/latih-tubi/MATH/quiz?count=40&level=11&difficulty=4',
    )
    // The pool for Tingkatan 5 + Sukar is small (27 in the seed): the quiz has all of them.
    await tid(page, 'config-start').click()
    await expect(tid(page, 'quiz-title')).toHaveText('Matematik')
    const progress = await tid(page, 'quiz-progress-text').innerText()
    const n = Number(/daripada (\d+)/.exec(progress)?.[1])
    expect(n).toBeGreaterThan(0)
    expect(n).toBeLessThanOrEqual(40)
    const posts = (await mock.requests('/api/practice/sessions')).filter((r) => r.method === 'POST')
    expect(posts[0]?.body).toMatchObject({ mode: 'latih_tubi', levelId: 11, difficulty: 4 })
    // Finish only the first 3 and leave: the rest of the run is covered by the developer spec (27 Q).
    const right = await answerFrom(page, 1, n)
    await expect(tid(page, 'quiz-results')).toBeVisible()
    const correct = right.filter(Boolean).length
    await gotoApp('/spm/history?type=latih_tubi')
    const rows = page.getByTestId('history-row')
    await expect(rows.first().getByTestId('row-badge')).toHaveText('Latih Tubi')
    await expect(rows.first().getByTestId('row-correct')).toHaveText(
      `${String(correct)}/${String(n)} betul`,
    )
  })

  test('F3 S5 -> S6 AKAUN -> Set 3 -> Q3 -> results -> S10 ramalan; a locked set goes back to S6', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    const dialogs: string[] = []
    page.on('dialog', (d) => {
      dialogs.push(d.message())
      void d.dismiss()
    })
    await loginAs(PELAJAR)
    // Refused set: GEO Set 2 (Belum Cukup) typed by URL.
    await gotoApp('/spm/ramalan/GEO?year=2026&set=2')
    await expect(page).toHaveURL(/\/spm\/ramalan\/GEO$/)
    await expect(tid(page, 'subject-title')).toHaveText('Geografi')
    expect(dialogs).toEqual([])
    const after = (await mock.requests('/api/practice/sessions')).filter(
      (r) => r.method === 'POST' && r.status === 201,
    )
    expect(after.some((r) => (r.body as { setNo?: number }).setNo === 2)).toBe(false)
    // Out-of-range / malformed parameters are refused the same way (no crash, no session).
    for (const q of ['year=2026&set=999', 'year=1999&set=1', 'year=abc&set=xyz', 'set=1']) {
      await navigateInApp(page, `/spm/ramalan/AKAUN?${q}`)
      await expect(page.getByTestId('quiz-runner'), q).toHaveCount(0)
      await expect(tid(page, 'tracking-subject-page'), q).toBeVisible()
    }
    await gotoApp('/spm/ramalan')
    await expect(tid(page, 'lanes')).toBeVisible({ timeout: 60_000 })
    await page.locator('a[href="/spm/ramalan/AKAUN"]').first().click()
    await expect(page).toHaveURL(/\/spm\/ramalan\/AKAUN$/)
    await tid(page, 'set-card-3').click()
    await expect(page).toHaveURL(/\/spm\/ramalan\/AKAUN\?year=2026&set=3$/)
    await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 40')
    const posts = (await mock.requests('/api/practice/sessions')).filter((r) => r.method === 'POST')
    expect(posts[0]?.body).toMatchObject({ mode: 'ramalan', subjectCode: 'AKAUN', year: 2026, setNo: 3 })
    const right = await answerFrom(page, 1, 40)
    await expect(tid(page, 'quiz-results')).toBeVisible()
    await gotoApp('/spm/history?type=ramalan')
    const first = page.getByTestId('history-row').first()
    await expect(first.getByTestId('row-badge')).toHaveText('Tracking A')
    await expect(first.getByTestId('row-correct')).toHaveText(
      `${String(right.filter(Boolean).length)}/40 betul`,
    )

  })

  test(
    'F4 S11 -> generate -> Q4 -> submit -> S12 -> S13 walkthrough',
    provisional('L-8: Q4 in-exam UI is UNVERIFIED (URS OQ-M06-05)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(PELAJAR)
      await gotoApp('/spm-mock')
      await expect(tid(page, 'mock-form')).toBeVisible({ timeout: 60_000 })
      await tid(page, 'mock-subject').selectOption('Matematik')
      await tid(page, 'mock-generate').click()
      await expect(page).toHaveURL(/\/spm-mock\/\d+$/)
      const id = new URL(page.url()).pathname.split('/').pop()!
      await expect(tid(page, 'run-title')).toHaveText('Matematik · Paper 1')
      await expectNoHorizontalScroll(page)
      // Submitting with nothing answered must still grade (0 marks) and not crash.
      await tid(page, 'run-submit').click()
      await expect(page).toHaveURL(new RegExp(`/spm-mock/${id}/result$`))
      await expect(tid(page, 'result-title')).toHaveText('Matematik · Paper 1')
      await expect(tid(page, 'result-grade')).toHaveText(/^(A\+|A|B\+|B|C|D|E|G)$/)
      await expectNoHorizontalScroll(page)
      // The result is reachable again and the run page forwards a submitted mock to it.
      await gotoApp(`/spm-mock/${id}`)
      await expect(page).toHaveURL(new RegExp(`/spm-mock/${id}/result$`))
      // S11 row, then the walkthrough.
      await gotoApp('/spm-mock')
      await expect(tid(page, `mock-row-${id}`).getByTestId('mock-row-link')).toHaveText('Lihat →')
      await gotoApp('/pusat-ai/spm')
      await tid(page, 'walk-subject').selectOption('Matematik')
      await tid(page, 'walk-question').fill('Selesaikan 2x = 6')
      await tid(page, 'walk-submit').click()
      await expect(tid(page, 'walk-result')).toBeVisible({ timeout: 60_000 })
      await expect(tid(page, 'walk-submit')).toHaveText('Beri Panduan Langkah')
      expect(viewportWidth(page)).toBeGreaterThan(0)
      await expectNoHorizontalScroll(page)
    },
  )
})
