/**
 * @api M06 SPM hub against the REAL API (AZ-20a, BE-41 on origin/feature/v2-backend). The M06 pages
 * call the shared api client (src/modules/m06-spm/api/spm.ts), so they run in http mode with only the
 * id fixes of AZ-20a (string level and question ids for M05 #4, uuid mock ids).
 *
 * Screens in the prototype scope (matrix row 13 "SPM", student): S1 /spm, S2 /spm/tahun-lepas,
 * S3 /spm/latih-tubi, S4 /spm/latih-tubi/:code, S5 /spm/ramalan, S6 /spm/ramalan/:code,
 * S8 /spm/subjektif, S10 /spm/history. The quiz starts (Q1/Q2/Q3) go through M05
 * `POST /api/practice/sessions` and create a practice session for the seed pupil.
 * The mock exam routes (/spm-mock/:uuid, /spm-mock/:uuid/result) are covered by the last test; the
 * walkthrough (/pusat-ai/spm) is not.
 *
 * Every figure on screen is compared with the API body the page loaded; each test ends with the
 * horizontal-scroll check at the project viewport (375 / 768 / 1280).
 *
 * Env: E2E_DEMO_PASSWORD (or BIJAK_STUDENT_PASS).
 */

import type { Page, Response } from '@playwright/test'

import { expect, loginViaUi, test } from '../fixtures/api'
import { account, csrfOf, expectNoHScroll, newPeerContext } from './helpers'

/** Tab title of the global 404 page (src/app/router/outcome.ts `NOT_FOUND_TITLE`). */
const NOT_FOUND_TITLE = 'Halaman Tidak Dijumpai | PRESTASIPLUS'

const digits = (s: string | null): string => (s ?? '').replace(/\D/g, '')

/** Opens `path` and resolves with the JSON `data` of the GET the page makes to `apiPath` (exact path). */
async function openWith<T>(page: Page, path: string, apiPath: string): Promise<T> {
  const wait = page.waitForResponse(
    (r) => new URL(r.url()).pathname === apiPath && r.request().method() === 'GET',
    { timeout: 30_000 },
  )
  await page.goto(path)
  const res = await wait
  expect(res.status(), `GET ${apiPath}`).toBe(200)
  return ((await res.json()) as { data: T }).data
}

/** The `POST /api/practice/sessions` the quiz page sends next. */
const sessionStart = (page: Page): Promise<Response> =>
  page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/practice/sessions' && r.request().method() === 'POST',
    { timeout: 30_000 },
  )

async function loginStudent(page: Page): Promise<void> {
  const { user, pass } = account('student')
  await loginViaUi(page, user, pass)
}

test.describe('M06 SPM hub @api', () => {
  test.setTimeout(90_000)

  test.beforeEach(async ({ page }) => {
    await loginStudent(page)
  })

  test('S1 /spm shows the overview figures of GET /api/spm/overview @api', async ({ page }) => {
    const o = await openWith<{
      stats: Record<'totalQuestions' | 'subjectCount' | 'yearsAvailable' | 'trackingAQuestions', number>
      modules: Record<'databank' | 'latihTubi' | 'trackingA' | 'subjektifSets', number>
      me: { sessions: number; coins: number; answered: number }
    }>(page, '/spm', '/api/spm/overview')
    await expect(page.getByTestId('spm-hub-page')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('[data-ds=load-error]')).toHaveCount(0)

    const stat = async (id: string) => digits(await page.getByTestId(`spm-stat-${id}`).textContent())
    expect(await stat('total')).toContain(String(o.stats.totalQuestions))
    expect(await stat('subjects')).toContain(String(o.stats.subjectCount))
    expect(await stat('tracking')).toContain(String(o.stats.trackingAQuestions))
    const chip = async (id: string) =>
      digits(await page.getByTestId(`spm-module-${id}`).getByTestId('module-chip').textContent())
    expect(await chip('databank')).toBe(String(o.modules.databank))
    expect(await chip('latih-tubi')).toBe(String(o.modules.latihTubi))
    expect(await chip('tracking-a')).toBe(String(o.modules.trackingA))
    expect(await chip('subjektif')).toBe(String(o.modules.subjektifSets))
    expect(digits(await page.getByTestId('spm-mine-sessions').textContent())).toContain(String(o.me.sessions))
    await expectNoHScroll(page)
  })

  test('S2 Tahun Lepas lists GET /api/spm/databank and Q1 starts a past_year session @api', async ({
    page,
  }) => {
    const rows = await openWith<{ code: string; databankCount: number }[]>(
      page,
      '/spm/tahun-lepas',
      '/api/spm/databank',
    )
    await expect(page.getByTestId('spm-databank-page')).toBeVisible({ timeout: 20_000 })
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      const card = page.getByTestId(`databank-card-${r.code}`)
      await expect(card).toBeVisible()
      expect(digits(await card.getByTestId('databank-count').textContent())).toBe(String(r.databankCount))
    }
    await expectNoHScroll(page)

    const withPool = rows.find((r) => r.databankCount >= 10)
    expect(withPool, 'a subject with a pool of 10+').toBeDefined()
    const started = sessionStart(page)
    await page.getByTestId(`databank-set-${withPool!.code}-10`).click()
    const res = await started
    expect(res.status(), 'POST /api/practice/sessions (past_year)').toBeLessThan(300)
    expect(res.request().postDataJSON()).toMatchObject({ mode: 'past_year', subjectCode: withPool!.code, count: 10 })
    await expectNoHScroll(page)
  })

  test('S3/S4 Latih Tubi: level ids of the API reach M05 as strings @api', async ({ page }) => {
    const list = await openWith<{
      teras: { code: string; total: number; locked: boolean }[]
      elektif: { code: string; total: number; locked: boolean }[]
    }>(page, '/spm/latih-tubi', '/api/spm/latih-tubi')
    await expect(page.getByTestId('spm-latih-tubi-page')).toBeVisible({ timeout: 20_000 })
    for (const c of [...list.teras, ...list.elektif]) {
      const card = page.getByTestId(`latih-tubi-card-${c.code}`)
      await expect(card).toBeVisible()
      expect(digits(await card.getByTestId('latih-tubi-count').textContent())).toContain(String(c.total))
      await expect(card.getByTestId('latih-tubi-locked')).toHaveCount(c.locked ? 1 : 0)
    }
    await expectNoHScroll(page)

    const open = list.teras.find((c) => !c.locked && c.total > 0)
    expect(open, 'an unlocked teras subject').toBeDefined()
    const config = await openWith<{
      levelCounts: Record<string, number>
      defaultCount: number
    }>(page, `/spm/latih-tubi/${open!.code}`, `/api/spm/latih-tubi/${open!.code}`)
    await expect(page.getByTestId('spm-config-page')).toBeVisible({ timeout: 20_000 })
    const levelIds = Object.keys(config.levelCounts)
    expect(levelIds).toHaveLength(2)
    const levels = page.getByTestId('config-levels').getByRole('button')
    await expect(levels).toHaveText([/Tingkatan 4/, /Tingkatan 5/])
    for (const id of levelIds) {
      expect(digits(await page.getByTestId(`level-${id}`).getByTestId('level-count').textContent())).toBe(
        String(config.levelCounts[id]),
      )
    }
    await expectNoHScroll(page)

    const t5 = page.getByTestId('config-levels').getByRole('button', { name: /Tingkatan 5/ })
    await t5.click()
    await expect(t5).toHaveAttribute('aria-pressed', 'true')
    const href = await page.getByTestId('config-start').getAttribute('href')
    const level = new URL(href!, 'http://x').searchParams.get('level')
    expect(levelIds).toContain(level)

    const started = sessionStart(page)
    await page.getByTestId('config-start').click()
    const res = await started
    const body = res.request().postDataJSON() as Record<string, unknown>
    expect(body).toMatchObject({ mode: 'latih_tubi', subjectCode: open!.code, levelId: level })
    expect(typeof body.levelId, 'levelId is an Id string (contract IdSchema)').toBe('string')
    // The real API starts this session (201): the BM level-11 pool covers the target count. Pinned so a
    // regression to NOT_ENOUGH_QUESTIONS (422 + the S4 message) fails here instead of passing silently.
    expect(res.status(), 'POST /api/practice/sessions (latih_tubi)').toBe(201)
    await expect(page.getByTestId('spm-no-questions')).toHaveCount(0)
    await expectNoHScroll(page)
  })

  test('S5/S6 Tracking A: open subjects, set list and Q3 ramalan start @api', async ({ page }) => {
    const hub = await openWith<{
      readiness: unknown
      bahasa: { code: string; subjectId: string }[]
      openSubjects: { code: string; startableSets: number }[]
    }>(page, '/spm/ramalan', '/api/spm/tracking-a')
    await expect(page.getByTestId('tracking-hub-page')).toBeVisible({ timeout: 20_000 })
    expect(hub.readiness, 'readiness is admin-only').toBeNull()
    await expect(page.getByTestId('readiness')).toHaveCount(0)
    for (const b of hub.bahasa) {
      const link = page.getByTestId(`bahasa-card-${b.code}`)
      await expect(link).toBeVisible()
      await expect(link).toHaveAttribute(
        'href',
        `/latihan-berstruktur?subject_id=${b.subjectId}&scope=spm&track=bahasa`,
      )
    }
    for (const c of hub.openSubjects) await expect(page.getByTestId(`open-card-${c.code}`)).toBeVisible()
    await expectNoHScroll(page)

    const first = hub.openSubjects[0]
    expect(first, 'an open Tracking A subject in the seed').toBeDefined()
    const subject = await openWith<{
      sets: { setNo: number; status: string; readyCount: number }[]
    }>(page, `/spm/ramalan/${first!.code}`, `/api/spm/tracking-a/${first!.code}`)
    await expect(page.getByTestId('tracking-subject-page')).toBeVisible({ timeout: 20_000 })
    for (const s of subject.sets) await expect(page.getByTestId(`set-card-${s.setNo}`)).toBeVisible()
    await expectNoHScroll(page)

    const ready = subject.sets.find((s) => s.status !== 'belum_cukup')
    expect(ready, 'a startable set').toBeDefined()
    const started = sessionStart(page)
    await page.getByTestId(`set-card-${ready!.setNo}`).click()
    const res = await started
    expect(res.status(), 'POST /api/practice/sessions (ramalan)').toBeLessThan(300)
    expect(res.request().postDataJSON()).toMatchObject({
      mode: 'ramalan',
      subjectCode: first!.code,
      setNo: ready!.setNo,
    })
    await expectNoHScroll(page)
  })

  test('S8 Subjektif lists GET /api/spm/subjektif with structured-track links @api', async ({ page }) => {
    const s = await openWith<{
      subjects: { subjectId: string; sets: number }[]
      stats: { bestScore: number | null }
    }>(page, '/spm/subjektif', '/api/spm/subjektif')
    await expect(page.getByTestId('subjektif-page')).toBeVisible({ timeout: 20_000 })
    for (const sub of s.subjects) {
      const card = page.getByTestId(`subjektif-card-${sub.subjectId}`)
      await expect(card).toBeVisible()
      await expect(card).toHaveAttribute('href', `/latihan-berstruktur?subject_id=${sub.subjectId}&scope=spm`)
    }
    if (s.stats.bestScore === null) await expect(page.getByTestId('subjektif-stats')).toContainText('Belum Ada')
    await expectNoHScroll(page)
  })

  test('S10 /spm/history renders the SPM sessions (list or empty state) @api', async ({ page }) => {
    const wait = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/practice/sessions' && r.request().method() === 'GET',
      { timeout: 30_000 },
    )
    await page.goto('/spm/history')
    expect((await wait).status(), 'GET /api/practice/sessions').toBe(200)
    await expect(page.getByTestId('spm-history-page')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('[data-ds=load-error]')).toHaveCount(0)
    await expect(page.getByTestId('history-rows').or(page.getByTestId('history-empty'))).toBeVisible()
    await expectNoHScroll(page)
  })

  test('S4 an unknown subject code is a 404 and the global not-found page @api', async ({ page }) => {
    const wait = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/spm/latih-tubi/ZZNOSUCH' && r.request().method() === 'GET',
      { timeout: 30_000 },
    )
    await page.goto('/spm/latih-tubi/ZZNOSUCH')
    expect((await wait).status(), 'GET /api/spm/latih-tubi/ZZNOSUCH').toBe(404)
    await expect(page).toHaveTitle(NOT_FOUND_TITLE, { timeout: 20_000 })
    await expect(page.getByTestId('spm-config-page')).toHaveCount(0)
    await expect(page.locator('[data-ds=load-error]')).toHaveCount(0)
    await expectNoHScroll(page)
  })

  // The mock exam pages (/spm-mock/...) are outside the prototype scope (a pupil is sent home), so this
  // drives the BE-41 endpoints the pages call, with the uuid ids the pages build their URLs from.
  test('S11/Q4/S12 mock exam API over uuid ids: create, run, submit, result; foreign mock is 404 @api', async ({
    page,
    browser,
  }, testInfo) => {
    const csrf = await csrfOf(page)
    const created = await page.request.post('/api/spm-mocks', {
      data: { subject: 'Matematik', paperNumber: 1 },
      headers: { 'x-csrf-token': csrf },
    })
    expect(created.status(), 'POST /api/spm-mocks').toBe(201)
    const id = ((await created.json()) as { data: { id: string } }).data.id
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)

    const viewRes = await page.request.get(`/api/spm-mocks/${id}`)
    expect(viewRes.status(), 'GET mock (run)').toBe(200)
    const view = ((await viewRes.json()) as {
      data: { id: string; status: string; items: { no: number; options?: string[] }[] }
    }).data
    expect(view).toMatchObject({ id, status: 'in_progress' })
    expect(view.items.length).toBeGreaterThan(0)
    expect(JSON.stringify(view), 'the paper carries no key').not.toContain('modelAnswer')

    const early = await page.request.get(`/api/spm-mocks/${id}/result`)
    expect(early.status(), 'result before submit').toBe(409)

    const answers = view.items.map((it) => ({ no: it.no, answer: it.no === 1 ? 'A' : '' }))
    const submitted = await page.request.post(`/api/spm-mocks/${id}/submit`, {
      data: { answers },
      headers: { 'x-csrf-token': csrf },
    })
    expect(submitted.status(), 'POST submit').toBe(200)
    const result = ((await submitted.json()) as { data: { id: string; items: unknown[] } }).data
    expect(result.id).toBe(id)
    expect(result.items).toHaveLength(view.items.length)

    const again = await page.request.get(`/api/spm-mocks/${id}/result`)
    expect(again.status(), 'GET result').toBe(200)
    expect(((await again.json()) as { data: unknown }).data).toEqual(result)
    const resubmit = await page.request.post(`/api/spm-mocks/${id}/submit`, {
      data: { answers },
      headers: { 'x-csrf-token': csrf },
    })
    expect(resubmit.status(), 'POST submit twice').toBe(409)

    // Another pupil gets 404 for every route of A's mock; the list is per user.
    const peer = await newPeerContext(browser, testInfo)
    try {
      const pageB = await peer.newPage()
      const b = account('studentB')
      await loginViaUi(pageB, b.user, b.pass)
      expect((await pageB.request.get(`/api/spm-mocks/${id}`)).status(), 'GET mock as B').toBe(404)
      expect((await pageB.request.get(`/api/spm-mocks/${id}/result`)).status(), 'GET result as B').toBe(404)
      const submitB = await pageB.request.post(`/api/spm-mocks/${id}/submit`, {
        data: { answers: [] },
        headers: { 'x-csrf-token': await csrfOf(pageB) },
      })
      expect(submitB.status(), 'POST submit as B').toBe(404)
      const listB = await pageB.request.get('/api/spm-mocks')
      expect(JSON.stringify(await listB.json())).not.toContain(id)
    } finally {
      await peer.close()
    }
    await expectNoHScroll(page)
  })
})
