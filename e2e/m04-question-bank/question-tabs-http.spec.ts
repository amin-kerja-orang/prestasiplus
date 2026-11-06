/**
 * S2-T06 against the real stack (PRD30 R1-ADM-Q-20 and Q-22): the tabs of Senarai Soalan, typed "Arkib Semua" and one spec per row
 * action of Laporan Soalan (gap 5.1). Tabs and Arkib Semua run at every width; the row actions run at 1280 and `Disemak` also at 375,
 * because each one spends a seeded structured question.
 *
 *   BASE_URL=http://localhost:5192 E2E_DEMO_PASSWORD=<demo password> \
 *     npx playwright test -c playwright.http.config.ts e2e/m04-question-bank/question-tabs-http.spec.ts --workers=1
 *
 * Writes: one draft question per Arkib Semua run, deleted in `finally`; one pupil report per row action, on a question with no report
 * yet (a pupil reports a question once and only one shown to them, so the test fails when none is left). `Nyahaktif Segera` restores the question; `Arkib` archives one that no paper places and sends it back through draft, review and approve (the refused fields are logged).
 */
import type { APIRequestContext, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { HTTP_MODE } from '../bijak/bijak-flow'
import { demoCreds, NEEDS_PASSWORD } from '../bijak/http-creds'

const { user: ADMIN_USER, pass: ADMIN_PASS } = demoCreds('adminPusat')
const { user: PUPIL_USER, pass: PUPIL_PASS } = demoCreds('student')

test.skip(!HTTP_MODE, 'needs BIJAK_API_BASE or BASE_URL (integration stack)')
test.skip(!ADMIN_PASS || !PUPIL_PASS, NEEDS_PASSWORD)

const REPORTS = '/admin/question-reports'
const width = (page: Page): number => page.viewportSize()?.width ?? 0

async function csrfOf(request: APIRequestContext, identifier: string, password: string): Promise<string> {
  const res = await request.post('/api/auth/login', { data: { identifier, password } })
  expect(res.ok(), 'API login').toBe(true)
  return ((await (await request.get('/api/session')).json()) as { data: { csrf: string } }).data.csrf
}

async function expectNoPageScroll(page: Page): Promise<void> {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(over, 'horizontal page overflow in px').toBeLessThanOrEqual(0)
}

interface Report {
  id: string
  questionId: string
  status: string
  displayStatus: string
  adminNotes: string | null
  question: { isActive?: boolean }
}

test.describe('S2-T06 Senarai Soalan tabs and regions @api', () => {
  let csrf = ''
  test.beforeEach(async ({ page }) => {
    csrf = await csrfOf(page.request, ADMIN_USER, ADMIN_PASS as string)
  })

  test('the tabs open the three existing routes, each with its own tab active @api', async ({ page }) => {
    await page.goto('/admin/questions')
    await expect(page.getByTestId('questions-table')).toBeVisible()
    await expect(page.getByTestId('question-area-tab-senarai')).toHaveAttribute('data-active', 'true')
    await expectNoPageScroll(page)

    await page.getByTestId('question-area-tab-kualiti').click()
    await expect(page).toHaveURL(/\/admin\/questions\/quality$/)
    await expect(page.getByTestId('quality-page')).toBeVisible()
    await expect(page.getByTestId('question-area-tab-kualiti')).toHaveAttribute('data-active', 'true')
    await expectNoPageScroll(page)

    await page.getByTestId('question-area-tab-laporan').click()
    await expect(page).toHaveURL(/\/admin\/question-reports$/)
    await expect(page.getByTestId('reports-page')).toBeVisible()
    await expect(page.getByTestId('question-area-tab-laporan')).toHaveAttribute('data-active', 'true')
    await expectNoPageScroll(page)

    await page.getByTestId('question-area-tab-senarai').click()
    await expect(page).toHaveURL(/\/admin\/questions$/)
  })

  test('the banner links to Studio and Import CSV opens its form @api', async ({ page }) => {
    await page.goto('/admin/questions')
    await expect(page.getByTestId('questions-legacy-banner')).toContainText(
      'Ini bank soalan lama (model flat). Soalan baharu dicipta dan diterbitkan di bank kanonikal.',
    )
    await expect(page.getByTestId('questions-studio-link')).toHaveAttribute('href', '/admin/studio')
    await page.getByTestId('questions-import').click()
    await expect(page.getByTestId('import-form')).toBeVisible()
  })

  test('Arkib Semua with a filter asks for ARKIB and archives only the filtered rows @api', async ({ page }) => {
    const sample = ((await (await page.request.get('/api/questions?pageSize=1')).json()) as { data: { subject: { id: string }; level: { id: string } }[] }).data[0]
    const token = `ARKIBUJIAN${String(Date.now())}`
    const made = await page.request.post('/api/questions', {
      headers: { 'x-csrf-token': csrf },
      data: {
        subjectId: sample!.subject.id,
        educationLevelId: sample!.level.id,
        difficultyLevel: 3,
        questionType: 'mcq',
        questionText: `Soalan ujian ${token}`,
        options: ['4', '5', '6', '7'],
        correctAnswer: 1,
      },
    })
    expect(made.status(), await made.text()).toBe(201)
    const id = ((await made.json()) as { data: { id: string } }).data.id
    // Outside the filter: the same subject and level, a text the search does not match.
    const outside = await page.request.post('/api/questions', {
      headers: { 'x-csrf-token': csrf },
      data: {
        subjectId: sample!.subject.id,
        educationLevelId: sample!.level.id,
        difficultyLevel: 3,
        questionType: 'mcq',
        questionText: `Soalan luar tapisan ${String(Date.now())}`,
        options: ['4', '5', '6', '7'],
        correctAnswer: 1,
      },
    })
    expect(outside.status(), await outside.text()).toBe(201)
    const outsideId = ((await outside.json()) as { data: { id: string } }).data.id
    try {
      await page.goto(`/admin/questions?search=${token}`)
      await expect(page.getByTestId('questions-table')).toContainText(token)
      if (width(page) < 640) {
        await page.getByTestId('questions-more-actions').click()
        await page.getByRole('menuitem', { name: 'Arkib Semua' }).click()
      } else {
        await page.getByTestId('questions-archive-all').click()
      }
      const dialog = page.getByTestId('questions-archive-dialog')
      await expect(dialog).toContainText('1 daripada 1 soalan sepadan akan diarkibkan.')
      await expect(dialog).not.toContainText('KOSONG')
      await expect(dialog).toContainText('Taip ARKIB untuk mengesahkan.')
      const confirm = page.getByTestId('questions-archive-confirm')
      await expect(confirm).toBeDisabled()
      await page.getByTestId('questions-archive-word').fill('arkib')
      await expect(confirm).toBeDisabled()
      await page.getByTestId('questions-archive-word').fill('ARKIB')
      await confirm.click()
      await expect(page.getByTestId('bulk-filter-success')).toContainText('Berjaya arkib 1 soalan (hasil tapisan).')
      const after = (await (await page.request.get(`/api/questions/${id}`)).json()) as { data: { status: string } }
      expect(after.data.status).toBe('archived')
      const untouched = (await (await page.request.get(`/api/questions/${outsideId}`)).json()) as { data: { status: string } }
      expect(untouched.data.status).toBe('draft')
      await expectNoPageScroll(page)
    } finally {
      await page.request.delete(`/api/questions/${outsideId}`, { headers: { 'x-csrf-token': csrf } }).catch(() => undefined)
      await page.request.delete(`/api/questions/${id}`, { headers: { 'x-csrf-token': csrf } }).catch(() => undefined)
    }
  })
})

test.describe('S2-T06 Laporan Soalan row actions (gap 5.1) @api', () => {
  let csrf = ''
  let pupil: APIRequestContext
  let pupilCsrf = ''

  test.beforeEach(async ({ page, playwright, baseURL }) => {
    csrf = await csrfOf(page.request, ADMIN_USER, ADMIN_PASS as string)
    pupil = await playwright.request.newContext({ baseURL: baseURL as string })
    pupilCsrf = await csrfOf(pupil, PUPIL_USER, PUPIL_PASS as string)
  })
  test.afterEach(async () => {
    await pupil.dispose()
  })

  const reports = async (page: Page): Promise<Report[]> =>
    ((await (await page.request.get(`${REPORTS.replace('/admin', '/api')}?status=all`)).json()) as { data: Report[] }).data
  const reportOf = async (page: Page, id: string): Promise<Report> => {
    const found = (await reports(page)).find((r) => r.id === id)
    expect(found, `report ${id}`).toBeDefined()
    return found as Report
  }

  /** True when no paper (Pilihan, any status) and no generated paper places the question (admin detail, `placements`). */
  async function isUnplaced(page: Page, id: string): Promise<boolean> {
    const d = ((await (await page.request.get(`/api/questions/${id}`)).json()) as { data: { placements?: unknown[]; generatedPaperCount?: number } }).data
    return (d.placements ?? []).length === 0 && (d.generatedPaperCount ?? 0) === 0
  }

  /**
   * A pupil report on a structured question nobody reported yet; the page opens on the Menunggu tab. `unplaced` picks one that no paper
   * places, for the test that archives it: a structured question has no create route (intake only) and a pupil may report only a
   * live, seeded one, so the spec cannot make its own question and paper; it must not archive one a Terbit paper depends on.
   */
  async function fileReport(page: Page, opts: { unplaced?: boolean } = {}): Promise<Report> {
    const used = new Set((await reports(page)).map((r) => r.questionId))
    const rows = ((await (await page.request.get('/api/structured-questions')).json()) as { data: { id: string }[] }).data
    const open = rows.filter((row) => !used.has(String(row.id)))
    // Unplaced questions are scarce on the CI stack (the K2 fixture places its 15 in a Terbit paper): only the Arkib test needs one,
    // so every other test takes a placed question first and falls back to an unplaced one only when no placed one is left.
    const unplaced = new Set<string>()
    for (const row of open) if (await isUnplaced(page, String(row.id))) unplaced.add(String(row.id))
    const free: { id: string } | undefined =
      opts.unplaced === true
        ? open.find((row) => unplaced.has(String(row.id)))
        : (open.find((row) => !unplaced.has(String(row.id))) ?? open[0])
    // A hard failure on purpose: a skip here would hide the row-action coverage once the seeded pool runs out. A pupil may
    // report only a question shown to them, so a test cannot make its own.
    expect(free, 'no structured question without a report is left on this stack').toBeDefined()
    const res = await pupil.post('/api/question-reports', {
      headers: { 'x-csrf-token': pupilCsrf },
      data: { questionId: String(free!.id), questionType: 'structured', reasons: ['other'] },
    })
    expect(res.status(), await res.text()).toBe(201)
    const report = (await reports(page)).find((r) => r.questionId === String(free!.id))
    expect(report).toBeDefined()
    await page.goto(`${REPORTS}?status=pending`)
    await expect(page.getByTestId(`report-card-${report!.id}`)).toBeVisible()
    return report as Report
  }
  const button = (page: Page, r: Report, testid: string) => page.getByTestId(`report-card-${r.id}`).getByTestId(testid)
  const only1280 = (page: Page): void => test.skip(width(page) < 1280, 'spends a seeded question: runs at 1280 only')

  test('Disemak moves the report to reviewed and keeps the note @api', async ({ page }) => {
    test.skip(width(page) > 375 && width(page) < 1280, 'runs at 375 and 1280')
    const r = await fileReport(page)
    await button(page, r, 'report-notes').fill('Dalam semakan')
    await button(page, r, 'report-review').click()
    await expect(page.getByTestId(`report-card-${r.id}`)).toHaveCount(0)
    expect(await reportOf(page, r.id)).toMatchObject({ status: 'reviewed', adminNotes: 'Dalam semakan' })
    await page.goto(`${REPORTS}?status=reviewed`)
    await expect(button(page, r, 'report-status')).toHaveText('Disemak')
    await expect(button(page, r, 'report-review')).toHaveCount(0)
    await expectNoPageScroll(page)
  })

  test('Tandakan Selesai moves the report to fixed @api', async ({ page }) => {
    only1280(page)
    const r = await fileReport(page)
    await button(page, r, 'report-fix').click()
    await expect(page.getByTestId(`report-card-${r.id}`)).toHaveCount(0)
    expect((await reportOf(page, r.id)).status).toBe('fixed')
    await page.goto(`${REPORTS}?status=fixed`)
    await expect(button(page, r, 'report-status')).toHaveText('Diperbaiki')
    await expect(button(page, r, 'report-actions')).toHaveCount(0)
  })

  test('Tolak & Aktifkan Semula moves the report to dismissed @api', async ({ page }) => {
    only1280(page)
    const r = await fileReport(page)
    await button(page, r, 'report-dismiss').click()
    await expect(page.getByTestId(`report-card-${r.id}`)).toHaveCount(0)
    expect((await reportOf(page, r.id)).status).toBe('dismissed')
  })

  test('the question link opens the structured detail page @api', async ({ page }) => {
    only1280(page)
    const r = await fileReport(page)
    await button(page, r, 'report-question-link').click()
    await expect(page).toHaveURL(new RegExp(`/admin/structured-questions/${r.questionId}$`))
    await expect(page.getByTestId('structured-detail')).toBeVisible()
  })

  test('Nyahaktif Segera deactivates; Tolak & Aktifkan Semula on the reviewed report restores it @api', async ({ page }) => {
    only1280(page)
    const r = await fileReport(page)
    await button(page, r, 'report-deactivate').click()
    await expect(page.getByTestId(`report-card-${r.id}`)).toHaveCount(0)
    expect(await reportOf(page, r.id)).toMatchObject({ status: 'reviewed', question: { isActive: false } })
    await page.goto(`${REPORTS}?status=reviewed`)
    await expect(button(page, r, 'report-inactive')).toBeVisible()
    await button(page, r, 'report-dismiss').click()
    await expect(page.getByTestId(`report-card-${r.id}`)).toHaveCount(0)
    expect(await reportOf(page, r.id)).toMatchObject({ status: 'dismissed', question: { isActive: true } })
  })

  test('Arkib asks first, then admin and pupil read Dikeluarkan (AC-ADM-Q22.1) @api', async ({ page }) => {
    only1280(page)
    const r = await fileReport(page, { unplaced: true })
    try {
      await button(page, r, 'report-archive').click()
      await expect(page.locator('[data-ds="confirm-message"]')).toContainText(`Soalan #${r.questionId} akan diarkibkan`)
      await page.locator('[data-ds="confirm-ok"]').click()
      await expect(page.getByTestId(`report-card-${r.id}`)).toHaveCount(0)
      expect(await reportOf(page, r.id)).toMatchObject({ status: 'fixed', displayStatus: 'removed' })
      await page.goto(`${REPORTS}?status=fixed`)
      await expect(button(page, r, 'report-status')).toHaveText('Dikeluarkan')
      const mine = ((await (await pupil.get('/api/question-reports/mine')).json()) as { data: Report[] }).data
      expect(mine.find((m) => m.id === r.id)?.displayStatus).toBe('removed')
    } finally {
      // An archived version goes back only through draft, review and approve (lifecycle.ts). The question is unplaced (no paper depends
      // on it), but restore it anyway. A seeded question may not pass today's approve gate: the refused `fields` (approveFields,
      // gates.ts) are logged and attached so the cause is visible, and the test fails loudly unless the question is live again.
      const refused: { action: string; failed: unknown[] }[] = []
      for (const action of ['draft', 'review', 'approved']) {
        const res = await page.request.post('/api/questions/bulk-action', {
          headers: { 'x-csrf-token': csrf },
          data: { action, ids: [r.questionId] },
        })
        const body = (await res.json().catch(() => null)) as { data?: { failed?: unknown[] } } | null
        const failed = body?.data?.failed ?? []
        if (failed.length > 0) refused.push({ action, failed })
      }
      const status = ((await (await page.request.get(`/api/questions/${r.questionId}`)).json()) as { data: { status: string } }).data.status
      const note = JSON.stringify({ questionId: r.questionId, status, refused })
      console.log(`[S2-T06 Arkib restore] ${note}`)
      await test.info().attach('arkib-restore', { body: note, contentType: 'application/json' })
      // Back to live; a refusal by the approve gate fails here, with the refused fields in the message and the log.
      expect(status, `restore: ${note}`).toBe('approved')
    }
  })
})
