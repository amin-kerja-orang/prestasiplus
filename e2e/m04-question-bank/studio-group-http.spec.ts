/**
 * S2-T01 against the real stack: group-first entry, then the group moves as one unit (FR-ADM-QE2.1, FR-QA-04, 50, AC-QA-50).
 *
 *   BASE_URL=http://localhost:5192 E2E_DEMO_PASSWORD=<demo password> \
 *     npx playwright test -c playwright.http.config.ts e2e/m04-question-bank/studio-group-http.spec.ts --workers=1
 *
 * Writes: one stimulus, one group and its 3 questions, archived with `Arkibkan kumpulan` at the end.
 */
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { HTTP_MODE } from '../bijak/bijak-flow'
import { demoCreds, NEEDS_PASSWORD } from '../bijak/http-creds'

const { user: ADMIN_USER, pass: ADMIN_PASS } = demoCreds('adminPusat')

test.skip(!HTTP_MODE, 'needs BIJAK_API_BASE or BASE_URL (integration stack)')
test.skip(!ADMIN_USER || !ADMIN_PASS, NEEDS_PASSWORD)

const data = async <T>(page: Page, path: string): Promise<T> => ((await (await page.request.get(path)).json()) as { data: T }).data

test.describe('S2-T01 Studio bulk bar @api', () => {
  test('selected rows go to review; all results of the filter are archived after a count @api', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) !== 1280, 'the whole flow runs once; responsive-s2 covers the widths')
    test.setTimeout(120_000)
    const login = await page.request.post('/api/auth/login', { data: { identifier: ADMIN_USER, password: ADMIN_PASS } })
    expect(login.ok()).toBe(true)
    const csrf = (await data<{ csrf: string }>(page, '/api/session')).csrf
    const subjects = await data<{ id: number | string; name: string }[]>(page, '/api/subjects')
    const levels = await data<{ id: number | string; name: string }[]>(page, '/api/education-levels')
    const subjectId = String(subjects.find((s) => s.name === 'Matematik')?.id)
    const educationLevelId = String(levels.find((l) => l.name === 'Tingkatan 4')?.id)
    const token = `PUKALUJIAN${String(Date.now())}`
    for (const n of [1, 2]) {
      const res = await page.request.post('/api/questions', {
        headers: { 'x-csrf-token': csrf },
        data: { subjectId, educationLevelId, difficultyLevel: 3, questionType: 'mcq', questionText: `Soalan ${token} nombor ${String(n)}`, options: ['4', '5', '6', '7'], correctAnswer: 1 },
      })
      expect(res.status(), await res.text()).toBe(201)
    }

    await page.goto(`/admin/studio?search=${token}`)
    const table = page.getByTestId('studio-table')
    await expect(table).toContainText(token)
    await table.locator('tbody [role="checkbox"]').first().click()
    await expect(page.getByTestId('studio-bulk-count')).toHaveText('1 soalan dipilih')
    await page.getByTestId('studio-bulk-review').click()
    await expect(page.getByTestId('studio-bulk-result')).toBeVisible()

    await page.getByTestId('studio-bulk-all').click()
    await expect(page.getByTestId('studio-bulk-review')).toHaveCount(0)
    await page.getByTestId('studio-bulk-archived').click()
    await expect(page.locator('[data-ds="confirm-message"]')).toContainText('2 daripada 2 soalan sepadan akan diarkibkan.')
    await page.locator('[data-ds="confirm-ok"]').click()
    await expect(page.getByTestId('bulk-filter-result')).toBeVisible()
  })
})

test.describe('S2-T01 Studio group first @api', () => {
  test('Cipta baharu makes a scoped group; 3 questions go through review and publish as one @api', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) !== 1280, 'the whole flow runs once; responsive-s2 covers the widths')
    test.setTimeout(120_000)
    const login = await page.request.post('/api/auth/login', { data: { identifier: ADMIN_USER, password: ADMIN_PASS } })
    expect(login.ok()).toBe(true)
    const csrf = (await data<{ csrf: string }>(page, '/api/session')).csrf
    const subjects = await data<{ id: number | string; name: string }[]>(page, '/api/subjects')
    const levels = await data<{ id: number | string; name: string }[]>(page, '/api/education-levels')
    const subject = String(subjects.find((s) => s.name === 'Matematik')?.id)
    const level = String(levels.find((l) => l.name === 'Tingkatan 4')?.id)

    await page.goto('/admin/studio')
    await page.getByTestId('studio-create').click()
    await expect(page.getByTestId('studio-start-single')).toHaveAttribute('href', '/admin/studio/questions/create')
    await page.getByTestId('studio-start-group').click()
    await page.getByTestId('studio-start-create').click()
    await expect(page.getByTestId('studio-start-form')).toContainText('Sila pilih subjek.')
    await page.getByTestId('studio-start-subject').selectOption(subject)
    await page.getByTestId('studio-start-level').selectOption(level)
    await page.getByTestId('studio-start-stimulus-label').fill('Petikan ujian')
    await page.getByTestId('studio-start-stimulus-body').fill('Teks petikan ujian kumpulan.')
    await page.getByTestId('studio-start-create').click()
    await expect(page).toHaveURL(/\/admin\/studio\/groups\/\d+$/)
    const groupId = /groups\/(\d+)$/.exec(page.url())?.[1] as string
    await expect(page.getByTestId('studio-group-scope')).toContainText('Subjek: Matematik')
    await expect(page.getByTestId('studio-group-scope')).toContainText('Tingkatan: Tingkatan 4')

    const dskp = await data<{ units: { id: string; sps: { id: string }[] }[] }>(page, `/api/questions/studio/dskp?subjectId=${subject}&educationLevelId=${level}`)
    const unit = dskp.units.find((u) => u.sps.length > 0)
    const { chapters } = await data<{ chapters: { id: number | string }[] }>(page, `/api/admin/curriculum?subjectId=${subject}&educationLevelId=${level}`)
    for (const n of [1, 2, 3]) {
      const res = await page.request.post(`/api/stimulus-groups/${groupId}/questions`, {
        headers: { 'x-csrf-token': csrf },
        data: {
          subjectId: subject,
          educationLevelId: level,
          difficultyLevel: 3,
          questionType: 'mcq',
          questionText: `Soalan kumpulan ujian nombor ${String(n)}?`,
          options: ['4', '5', '6', '7'],
          correctAnswer: 1,
          cognitiveLevel: 'mengaplikasi',
          kertas: '1',
          numberLabel: String(n),
          ...(chapters[0] ? { curriculumChapterId: String(chapters[0].id) } : {}),
          ...(unit ? { tag: { unitId: unit.id, spIds: [unit.sps[0]?.id], tp: 3 } } : {}),
        },
      })
      expect(res.status(), await res.text()).toBe(201)
    }

    await page.reload()
    const publish = page.getByTestId('studio-group-publish')
    await expect(publish).toBeDisabled()
    await expect(page.getByTestId('studio-group-members').locator('li')).toHaveCount(3)
    await page.getByTestId('studio-group-submit').click()
    await expect(page.getByTestId('studio-group-notice')).toHaveText('Kumpulan dihantar untuk semakan.')
    await expect(publish).toBeEnabled()
    await publish.click()
    await expect(page.getByTestId('studio-group-served-banner')).toContainText('Kumpulan ini sedang dipaparkan kepada murid.')

    await page.getByTestId('studio-group-copy').click()
    await expect(page).not.toHaveURL(new RegExp(`/groups/${groupId}$`))
    await page.getByTestId('studio-group-discard-copy').click()
    await expect(page).toHaveURL(new RegExp(`/groups/${groupId}$`))

    await page.getByTestId('studio-group-retire').click()
    await page.locator('[data-ds="confirm-ok"]').click()
    await expect(page.getByTestId('studio-group-notice')).toContainText('3 soalan diarkibkan.')
  })
})
