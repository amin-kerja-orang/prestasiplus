/**
 * T23: BASELINE end-to-end of the R1 admin -> pupil question pipeline on the REAL local stack
 * (http-mode SPA + API + Postgres, demo seed, `BIJAK_POC_QUESTIONS=true`). Slug `r1-e2e-baseline`.
 * Report: docs/qa/r1-e2e-baseline-2026-10-31.md.
 *
 * This is a BASELINE run on feature/v3-bijak-r1 (BASE-1). Several R1 pieces are not merged there
 * (Set Builder UI F08, Studio groups F03, lifecycle B01, Simulasi Kuiz F12), so many steps are
 * EXPECTED to fail. Every step is its own test with a step id in the title, so the report shows
 * each one; nothing is faked: a step that cannot run because its precondition step failed fails
 * with that reason (never skipped silently, never passed).
 *
 * Flow (docs/handoff/CLOUD-HANDOFF.md §7(i), docs/requirements/v3-bijak-spm-scope.md):
 *   S1a  Admin Pusat: Tambah Soalan form (M04), T4 Kimia MCQ with an image and a Bab
 *   S1b  Admin Pusat: CSV import (M04), 2 T4 Kimia MCQs
 *   S1c  Admin Pusat: PDF intake (Bijak, Muat Naik Kertas) -> extract -> Hantar untuk semakan
 *   S1d  Admin Pusat: PDF intake with ONE shared passage and 2 member questions (D90 group)
 *   S2a  Approve the M04 questions (bulk "Luluskan") -> status Diluluskan
 *   S2a2 Approve the S1a question on its detail page (Hantar untuk Semakan, then Luluskan): no Terbitkan hop (D80)
 *   S2b  Approve the intake items (Baris Gilir Semakan) -> servable (approved, D80/D85)
 *   S3   Set Builder (/admin/studio/sets): build a paper with the group as a unit, review, Terbit
 *   S4   Pupil (T4) sits the S3 paper in Bijak SPM, self-marks, result, Cuba Lagi
 *   S5a  Databank Soalan SPM serves the approved S1a question
 *   S5b  Latih Tubi SPM serves it
 *   S5c  Soalan by Chapter (Bab) serves it
 *   R-B01 / R-B02 / R-B04 / R-B05: re-test of docs/qa/r1-student-smoke-2026-10-31.md (on branch
 *   handoff/shared-tree-2026-10-31).
 *
 * Why Kimia: the demo seed has no servable Kimia questions (Databank "0 soalan"), so the admin's
 * question is the only Kimia question a pupil can be served and S5 can look for its stem exactly.
 *
 * WRITES REAL DATA on the target stack (questions, intake batches, attempts). Local stack only.
 * Run: BASE_URL=<origin> npx playwright test -c playwright.http.config.ts e2e/bijak/http-r1-flow.spec.ts
 * Data tokens: `R1_RUN_ID` (any short alphanumeric id, same for the whole run) keeps the steps of
 * one viewport linked across tests; it defaults to the current UTC hour. Screenshots go to
 * `R1_SHOT_DIR` (default test-results-http/r1-baseline).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Browser, Page, TestInfo } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { expectNoHorizontalScrollHttp, HTTP_MODE } from './bijak-flow'
import { demoCreds } from './http-creds'

test.skip(!HTTP_MODE, 'needs BIJAK_API_BASE or BASE_URL (integration stack)')

/** The public seed password of the local stack (e2e/fixtures/api.ts), unless the env gives one. */
const SEED_PASSWORD = 'Demo1234'
const ADMIN = demoCreds('adminPusat')
const ADMIN_USER = ADMIN.user
const ADMIN_PASS = ADMIN.pass ?? SEED_PASSWORD
/** A secondary pupil: murid4 is Tingkatan 4 (the smoke-test account). */
const PUPIL_USER = process.env.BIJAK_STUDENT_B_USER || 'murid4@demo.test'
const PUPIL_PASS = process.env.BIJAK_STUDENT_B_PASS || process.env.E2E_DEMO_PASSWORD || SEED_PASSWORD

const RUN_ID = (process.env.R1_RUN_ID || new Date().toISOString().slice(0, 13).replace(/\D/g, '')).replace(
  /[^A-Za-z0-9]/g,
  '',
)
const SHOT_DIR = process.env.R1_SHOT_DIR || 'test-results-http/r1-baseline'

/** One token per run and viewport, so the 3 projects never see each other's data. */
const tokenOf = (info: TestInfo): string => `R1T23${RUN_ID}${info.project.name.slice(0, 3)}`

/* ------------------------------------------------------------------ shared helpers */

/** pdf.js on the upload screen calls Map.getOrInsertComputed (newest Chromium only); same shim as intake-review-http. */
const UPSERT_SHIM = `
for (const C of [Map, WeakMap]) {
  if (!C.prototype.getOrInsertComputed) {
    C.prototype.getOrInsertComputed = function (key, fn) {
      if (this.has(key)) return this.get(key)
      const v = fn(key); this.set(key, v); return v
    }
  }
  if (!C.prototype.getOrInsert) {
    C.prototype.getOrInsert = function (key, v) {
      if (this.has(key)) return this.get(key)
      this.set(key, v); return v
    }
  }
}`

/**
 * UI login, once per account and viewport per run: the session cookies are kept in the OS temp folder
 * and reused while GET /api/me still answers 200, so the run does not hammer the login throttle.
 */
async function login(page: Page, user: string, pass: string): Promise<void> {
  await page.addInitScript(UPSERT_SHIM)
  const viewport = page.viewportSize()?.width ?? 0
  const cache = join(tmpdir(), `r1-e2e-${RUN_ID}-${user.replace(/\W/g, '_')}-${viewport}.json`)
  if (existsSync(cache)) {
    await page.context().addCookies(JSON.parse(readFileSync(cache, 'utf8')) as never)
    if ((await page.request.get('/api/me')).status() === 200) return
    await page.context().clearCookies()
  }
  await page.goto('/login')
  await page.getByTestId('login-email').fill(user)
  await page.getByTestId('login-password').fill(pass)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
  writeFileSync(cache, JSON.stringify(await page.context().cookies()))
}

const asAdmin = (page: Page) => login(page, ADMIN_USER, ADMIN_PASS)
const asPupil = (page: Page) => login(page, PUPIL_USER, PUPIL_PASS)

async function csrf(page: Page): Promise<string> {
  const res = await page.request.get('/api/session')
  return ((await res.json()) as { data: { csrf: string } }).data.csrf
}

interface BankRow {
  id: string | number
  status?: string
  questionText?: string
  text?: string
  imageUrl?: string | null
  imagePath?: string | null
  chapterId?: number | string | null
  curriculumChapterId?: number | string | null
  [k: string]: unknown
}

/** M04 bank rows whose text carries `search` (admin session, GET /api/questions). */
async function m04Rows(page: Page, search: string): Promise<BankRow[]> {
  const res = await page.request.get(`/api/questions?search=${encodeURIComponent(search)}&perPage=50`)
  expect(res.status(), 'GET /api/questions').toBe(200)
  return ((await res.json()) as { data?: BankRow[] }).data ?? []
}

/**
 * The M04 status of this viewport's admin questions, read in a separate admin context. Pupil steps
 * annotate it so a failure says whether the precondition (S2a approved) held.
 */
async function adminStatuses(browser: Browser, info: TestInfo, token: string): Promise<string> {
  const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: info.project.use.viewport ?? null })
  try {
    const page = await context.newPage()
    await asAdmin(page)
    const s = (await m04Rows(page, token)).map((r) => String(r.status)).join(',') || 'none'
    info.annotations.push({ type: 'precondition', description: `M04 token questions: ${s}` })
    return s
  } finally {
    await context.close()
  }
}

/** A small valid PNG (8x8, solid colour) for the "Gambar Soalan" upload. */
function pngBuffer(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC',
    'base64',
  )
}

/** A one-page text-layer PDF (Helvetica, ASCII), as in intake-review-http.spec.ts. */
function makePdf(lines: string[]): Buffer {
  const esc = (s: string): string => s.replace(/[\\()]/g, '\\$&')
  const content = `BT /F1 11 Tf 40 780 Td 14 TL ${lines.map((l) => `(${esc(l)}) Tj T*`).join(' ')} ET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

/** The mock extractor reads "N. stem [M markah]", "A. option" and "Jawapan: 1-B 2-A" (Sejarah units). */
function sejarahLines(token: string, tag: string): string[] {
  return [
    `Kertas percubaan ${token}${tag}`,
    `1. Pada tahun berapakah kemerdekaan persekutuan tanah melayu dicapai ${token}${tag}? [1 markah]`,
    'A. 1945',
    'B. 1957',
    'C. 1963',
    'D. 1971',
    `2. Apakah perjuangan rakyat ke arah kemerdekaan tanah air yang utama ${token}${tag}? [1 markah]`,
    'A. Rundingan',
    'B. Peperangan',
    'C. Pembelian',
    'D. Pindaan',
    'Jawapan: 1-B 2-A',
  ]
}

/** Upload one PDF on Muat Naik Kertas (Sejarah K2) and run the server extraction; resolves on the review page. */
async function uploadAndExtract(page: Page, token: string, tag: string): Promise<string> {
  await page.goto('/admin/spm/soalan/muat-naik')
  await expect(page.getByTestId('intake-upload-page')).toBeVisible()
  await expectNoHorizontalScrollHttp(page)
  const subject = await page
    .getByTestId('intake-subject')
    .locator('option', { hasText: /^Sejarah$/ })
    .first()
    .getAttribute('value')
  expect(subject, 'a "Sejarah" subject option on Muat Naik Kertas').toBeTruthy()
  await page.getByTestId('intake-subject').selectOption(subject ?? '')
  await page.getByTestId('intake-kertas').selectOption('2')
  await page.getByTestId('intake-source').fill(`Sekolah Contoh ${token}${tag}`)
  await page.getByTestId('intake-copyright').selectOption('sendiri')
  await page.getByTestId('intake-file').setInputFiles({
    name: `kertas-${token}${tag}.pdf`,
    mimeType: 'application/pdf',
    buffer: makePdf(sejarahLines(token, tag)),
  })
  await expect(page.getByTestId('intake-submit')).toBeEnabled()
  await page.getByTestId('intake-submit').click()
  await page.waitForURL(/\/admin\/spm\/soalan\/ekstrak\/[^/]+$/, { timeout: 60_000 })
  const batchId = new URL(page.url()).pathname.split('/').pop() ?? ''
  await expect(page.getByTestId('intake-review-page')).toBeVisible()
  const start = page.getByTestId('extract-start')
  await expect(start).toBeEnabled({ timeout: 60_000 })
  await start.click()
  await expect(page.getByTestId('question-card')).toHaveCount(2, { timeout: 90_000 })
  await expectNoHorizontalScrollHttp(page)
  return batchId
}

/** Confirms the low-confidence SP tag of both extracted questions and waits for the autosave. */
async function confirmTags(page: Page): Promise<void> {
  const cards = page.getByTestId('question-card')
  if ((await page.getByTestId('confirm-tag.sp').count()) === 0) await cards.first().getByRole('button').first().click()
  await page.getByTestId('confirm-tag.sp').first().click()
  await cards.nth(1).getByRole('button').first().click()
  await page.getByTestId('confirm-tag.sp').last().click()
  await expect(page.getByTestId('save-state')).toHaveText('Semua perubahan disimpan', { timeout: 20_000 })
}

async function submitForReview(page: Page): Promise<void> {
  await expect(page.getByTestId('issues-toggle')).toContainText('Sedia dihantar', { timeout: 20_000 })
  await page.getByTestId('submit-review').click()
  await expect(page.getByTestId('submitted-note')).toBeVisible()
}

/** Cover -> a NEW sitting: "Mula Semula" when an open sitting exists (it navigates by itself), else Mula. */
async function startFresh(page: Page): Promise<string> {
  await expect(page.getByTestId('resume-choice').or(page.getByTestId('mode-choice')).first()).toBeVisible({ timeout: 15_000 })
  if (await page.getByTestId('resume-choice').isVisible()) {
    await page.getByTestId('restart').click()
    await page.getByTestId('confirm-restart').click()
  } else {
    await page.locator('[data-ds=hero-cta]').click()
  }
  await expect(page.getByTestId('attempt-shell')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('attempt-loading')).toHaveCount(0)
  return /percubaan\/([^/?#]+)/.exec(page.url())?.[1] ?? ''
}

/** Pupil: open the first visible element among candidates, or fail with `why`. */
async function firstVisible(page: Page, selectors: string[], why: string) {
  for (const s of selectors) {
    const l = page.locator(s).first()
    if (await l.isVisible().catch(() => false)) return l
  }
  throw new Error(why)
}

/* ------------------------------------------------------------------ evidence */

test.beforeAll(() => mkdirSync(SHOT_DIR, { recursive: true }))

test.afterEach(async ({ page }, info) => {
  const step = /^(\S+)/.exec(info.title)?.[1] ?? 'step'
  const file = join(SHOT_DIR, `${step}-${info.project.name}.jpg`)
  await page
    .screenshot({ path: file, type: 'jpeg', quality: 60, timeout: 10_000 })
    .then(() => info.annotations.push({ type: 'screenshot', description: file }))
    .catch(() => undefined)
})

/* ------------------------------------------------------------------ the flow */

test.describe('R1 admin -> pupil pipeline, baseline @bijak @api @r1-baseline', () => {
  test.setTimeout(240_000)

  test('S1a admin Tambah Soalan form: T4 Kimia MCQ with an image and a Bab @api', async ({ page }, info) => {
    const token = tokenOf(info)
    await asAdmin(page)
    await page.goto('/admin/questions/create')
    await expect(page.getByTestId('question-create-page')).toBeVisible()
    await expectNoHorizontalScrollHttp(page)
    const subject = page.getByTestId('q-subject')
    const kimia = await subject.locator('option', { hasText: /^Kimia$/ }).first().getAttribute('value')
    expect(kimia, 'a "Kimia" subject option').toBeTruthy()
    await subject.selectOption(kimia ?? '')
    const level = page.getByTestId('q-level')
    const t4 = await level.locator('option', { hasText: /Tingkatan 4/ }).first().getAttribute('value')
    expect(t4, 'a "Tingkatan 4" level option').toBeTruthy()
    await level.selectOption(t4 ?? '')
    // D89: the admin picks the Bab by hand. The select lists the chapters of subject x level.
    const chapter = page.getByTestId('q-chapter')
    await expect
      .poll(async () => chapter.locator('option:not([value=""])').count(), {
        message: 'Bab select offers at least one chapter for Kimia Tingkatan 4 (D89)',
        timeout: 10_000,
      })
      .toBeGreaterThan(0)
    const chapterValue = await chapter.locator('option:not([value=""])').first().getAttribute('value')
    await chapter.selectOption(chapterValue ?? '')
    await page.locator('#q-difficulty').getByText('Mudah', { exact: true }).click()
    await page.getByTestId('q-text').fill(`Unsur manakah logam alkali ${token}?`)
    await page.getByTestId('q-image-input').setInputFiles({ name: `${token}.png`, mimeType: 'image/png', buffer: pngBuffer() })
    for (const [i, t] of ['Natrium', 'Klorin', 'Argon', 'Karbon'].entries()) {
      await page.getByTestId(`q-option-${i}`).fill(t)
    }
    await page.getByLabel('Jawapan betul A').check()
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('field-error')).toHaveCount(0)
    await page.waitForURL((u) => !u.pathname.endsWith('/create'), { timeout: 30_000 })
    await expectNoHorizontalScrollHttp(page)
    const rows = await m04Rows(page, token)
    expect(rows.length, 'the new question is in the M04 bank').toBe(1)
    const res = await page.request.get(`/api/questions/${String(rows[0]!.id)}`)
    expect(res.status(), 'GET /api/questions/:id').toBe(200)
    const d = ((await res.json()) as { data: Record<string, unknown> }).data
    const keys = Object.keys(d).join(',')
    expect(d.questionImage ?? null, `the question kept its image (fields: ${keys})`).toBeTruthy()
    expect(d.chapterId ?? d.curriculumChapterId ?? null, `the question kept its Bab (fields: ${keys})`).toBeTruthy()
  })

  test('S1b admin CSV import: 2 T4 Kimia MCQs @api', async ({ page }, info) => {
    const token = tokenOf(info)
    await asAdmin(page)
    await page.goto('/admin/questions/import')
    await expect(page.getByTestId('import-page')).toBeVisible()
    await expectNoHorizontalScrollHttp(page)
    const subj = page.getByTestId('import-default-subject')
    const kimia = await subj.locator('option', { hasText: /^Kimia$/ }).first().getAttribute('value')
    expect(kimia, 'a "Kimia" default-subject option').toBeTruthy()
    await subj.selectOption(kimia ?? '')
    const lvl = page.getByTestId('import-default-level')
    const t4 = await lvl.locator('option', { hasText: /Tingkatan 4/ }).first().getAttribute('value')
    expect(t4, 'a "Tingkatan 4" default-level option').toBeTruthy()
    await lvl.selectOption(t4 ?? '')
    const csv = [
      'question_text,option_a,option_b,option_c,option_d,correct_answer,difficulty_level,kertas',
      `Apakah simbol bagi natrium CSV1${token}?,Na,N,S,K,A,2,1`,
      `Apakah nombor proton bagi karbon CSV2${token}?,6,12,8,14,A,2,1`,
    ].join('\n')
    await page.getByTestId('import-file').setInputFiles({ name: `${token}.csv`, mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') })
    await page.getByTestId('import-submit').click()
    await expect(page.getByText(/Import selesai: 2 soalan diimport, 0 gagal/)).toBeVisible({ timeout: 30_000 })
    await expectNoHorizontalScrollHttp(page)
    await expect.poll(async () => (await m04Rows(page, `CSV1${token}`)).length + (await m04Rows(page, `CSV2${token}`)).length, {
      message: 'both CSV rows are in the M04 bank',
      timeout: 30_000,
    }).toBe(2)
  })

  test('S1c admin PDF intake: upload, extract, Hantar untuk semakan @api', async ({ page }, info) => {
    const token = tokenOf(info)
    await asAdmin(page)
    await uploadAndExtract(page, token, 'P')
    await confirmTags(page)
    await submitForReview(page)
    await expectNoHorizontalScrollHttp(page)
  })

  test('S1d admin PDF intake: one shared passage with 2 member questions (D90 group) @api', async ({ page }, info) => {
    const token = tokenOf(info)
    await asAdmin(page)
    await uploadAndExtract(page, token, 'G')
    // Mobile/tablet show the source panel behind a tab; the stimulus panel lives there.
    const panel = page.getByTestId('stimulus-panel')
    if (!(await panel.isVisible())) {
      await page.getByRole('tab', { name: /Sumber|Halaman|Rajah/ }).first().click()
    }
    await expect(panel).toBeVisible()
    await panel.getByRole('button', { name: 'Tambah petikan' }).click()
    const card = page.getByTestId('stimulus-card').first()
    await expect(card).toBeVisible()
    await card.getByTestId('stimulus-alt').fill(`Petikan bersama ${token}`)
    await card.locator('textarea').fill(`Petikan tentang kemerdekaan ${token}.`)
    await card.locator('[data-testid$="-q1"]').click()
    await card.locator('[data-testid$="-q2"]').click()
    if (!(await page.getByTestId('questions-panel').isVisible())) {
      await page.getByRole('tab', { name: /Soalan/ }).first().click()
    }
    await expect(page.getByTestId('group-header')).toHaveCount(1)
    await expect(page.getByTestId('group-header')).toContainText('berkongsi rajah ini')
    await confirmTags(page)
    await submitForReview(page)
    await expectNoHorizontalScrollHttp(page)
  })

  test('S2a approve the M04 questions (bulk Luluskan) @api', async ({ page }, info) => {
    const token = tokenOf(info)
    await asAdmin(page)
    const before = await m04Rows(page, token)
    expect(before.length, 'S1a/S1b questions exist (precondition)').toBeGreaterThan(0)
    await page.goto(`/admin/questions?search=${token}`)
    await expect(page.getByTestId('questions-page')).toBeVisible()
    await expectNoHorizontalScrollHttp(page)
    const boxes = page.getByTestId('questions-table').getByRole('checkbox')
    await expect(boxes.first()).toBeVisible()
    await boxes.first().check() // "select all" on the page (header), or the first card
    await expect(page.getByTestId('questions-bulk-bar')).toBeVisible()
    await page.getByTestId('questions-bulk-action').selectOption('approve')
    await page.getByTestId('questions-bulk-submit').click()
    await page.getByRole('dialog').getByRole('button').filter({ hasNotText: /Batal|Tutup/ }).last().click()
    const flash = page.getByRole('alert').filter({ hasText: /dikemaskini/ }).first()
    await expect(flash).toBeVisible({ timeout: 15_000 })
    const note = (await flash.innerText()).replace(/\s+/g, ' ').trim()
    await expectNoHorizontalScrollHttp(page)
    await expect
      .poll(async () => (await m04Rows(page, token)).map((r) => r.status).join(','), {
        message: `every token question is approved (server said: "${note}")`,
        timeout: 15_000,
      })
      .toMatch(/^(approved|published)(,(approved|published))*$/)
  })

  test('S2a2 approve the S1a question on its detail page (Hantar untuk Semakan, then Luluskan) @api', async ({ page }, info) => {
    const token = tokenOf(info)
    await asAdmin(page)
    const mine = (await m04Rows(page, token)).find((r) => String(r.questionText ?? r.text ?? '').includes('logam alkali'))
    expect(mine, 'the S1a question exists (precondition)').toBeTruthy()
    await page.goto(`/admin/questions/${String(mine!.id)}`)
    await expect(page.getByTestId('quick-actions')).toBeVisible()
    await expectNoHorizontalScrollHttp(page)
    const confirmDialog = async () =>
      page.getByRole('dialog').getByRole('button').filter({ hasNotText: /Batal|Tutup/ }).last().click()
    if (await page.getByTestId('status-pending-review').isVisible()) {
      await page.getByTestId('status-pending-review').click()
      await confirmDialog()
      await expect(page.getByTestId('status-pending-review')).toHaveCount(0, { timeout: 15_000 })
    }
    await page.getByTestId('status-approve').click()
    await confirmDialog()
    await expect
      .poll(async () => (await m04Rows(page, token)).find((r) => r.id === mine!.id)?.status, {
        message: 'the S1a question is approved after the two detail-page actions',
        timeout: 15_000,
      })
      .toMatch(/^(approved|published)$/)
    await expectNoHorizontalScrollHttp(page)
  })

  test('S2b approve the intake items (Baris Gilir Semakan) -> approved = servable @api', async ({ page }, info) => {
    const token = tokenOf(info)
    await asAdmin(page)
    await page.goto('/admin/spm/semakan')
    await expect(page.getByTestId('review-queue-page')).toBeVisible()
    await expectNoHorizontalScrollHttp(page)
    const mine = page.getByTestId('queue-table').getByText(new RegExp(`${token}[PG]`))
    await expect(mine.first(), 'S1c/S1d items are in the queue (precondition)').toBeVisible({ timeout: 30_000 })
    for (let i = 0; i < 4 && (await mine.count()) > 0; i++) {
      await mine.first().click()
      await expect(page.getByTestId('review-item-page')).toBeVisible()
      await expectNoHorizontalScrollHttp(page)
      await page.getByTestId('action-publish').click()
      await expect(page.getByTestId('review-queue-page')).toBeVisible()
    }
    // D80/D85: the accepted question must be approved (servable), not a Draf waiting for another hop.
    await page.goto('/admin/spm/soalan')
    await expect(page.getByTestId('bank-page')).toBeVisible()
    await page.getByTestId('bank-search').fill(token)
    const open = page.locator('[data-ds=filter-open]')
    if (await open.isVisible()) {
      await open.click()
      await page.locator('[data-ds=filter-sheet] button').first().click()
    } else await page.getByTestId('bank-search').press('Enter')
    const rows = page.getByTestId('bank-table').getByText(token)
    await expect(page.getByTestId('bank-table')).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(2_000)
    const servable = await rows.count()
    await expectNoHorizontalScrollHttp(page)
    let drafts = 0
    if (servable === 0) {
      // Where did they go? The same search under the "Draf" status.
      if (await open.isVisible()) {
        await open.click()
        await page.getByTestId('bank-status').selectOption('draf')
        await page.locator('[data-ds=filter-sheet] button').first().click()
      } else {
        await page.getByTestId('bank-status').selectOption('draf')
        await page.getByTestId('bank-search').press('Enter')
      }
      await page.waitForTimeout(2_000)
      drafts = await rows.count()
    }
    expect(
      servable,
      `accepted intake questions servable in Bank Soalan SPM (Diterbitkan): ${servable}; still Draf: ${drafts}; the bank drawer offers no approve/terbit action`,
    ).toBeGreaterThan(0)
  })

  test('S3 Set Builder: build a paper (group moves as a unit), review, Terbit @api', async ({ page }, info) => {
    const token = tokenOf(info)
    await asAdmin(page)
    // Pentadbiran menu: "Set Builder" (KS-17, /admin/studio/sets) per CLOUD-HANDOFF §7(c).
    await page.goto('/admin/command-center')
    await expect(page.getByTestId('pentadbiran-header')).toBeVisible()
    if (!(await page.getByTestId('pentadbiran-nav').first().isVisible())) await page.getByTestId('pentadbiran-menu-button').click()
    const link = page.locator('[data-testid=pentadbiran-nav]:visible').getByRole('link', { name: 'Set Builder' })
    await expect(link, 'Pentadbiran menu offers "Set Builder" (KS-17)').toHaveCount(1, { timeout: 5_000 }).catch(async (e) => {
      await page.goto('/admin/studio/sets')
      throw e
    })
    await link.click()
    await expect(page).toHaveURL(/\/admin\/studio\/sets/)
    await expect(page.getByTestId('app-placeholder')).toHaveCount(0)
    await expect(page.getByText(token)).toBeVisible()
  })

  test('S4 pupil sits the S3 paper, self-marks, sees the result, Cuba Lagi @api', async ({ page }, info) => {
    const token = tokenOf(info)
    await asPupil(page)
    await page.goto('/spm/bijak')
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    await expectNoHorizontalScrollHttp(page)
    const card = page.locator('[data-testid^=paper-]').filter({ hasText: token })
    await expect(card.first(), `the paper built in S3 (title carries ${token}) is on the Bijak hub`).toBeVisible({ timeout: 10_000 })
    await card.first().locator('[data-testid^=open-]').click()
    await expect(page.getByTestId('bijak-cover')).toBeVisible()
  })

  test('S5a Databank Soalan SPM serves the approved admin question @api', async ({ page, browser }, info) => {
    const token = tokenOf(info)
    const pre = await adminStatuses(browser, info, token)
    await asPupil(page)
    await page.goto('/spm/tahun-lepas')
    await expect(page.getByTestId('spm-databank-page')).toBeVisible()
    await expectNoHorizontalScrollHttp(page)
    const card = page.getByTestId('databank-card-CHEM')
    await expect(card).toBeVisible()
    await expect(card.getByTestId('databank-count'), `Kimia count includes the approved admin questions (precondition: ${pre})`).not.toContainText(/^\s*0 soalan/)
    await page.getByTestId('databank-set-CHEM-5').click()
    await expect(page.getByText(token).first(), 'the admin question stem is served').toBeVisible({ timeout: 20_000 })
    await expectNoHorizontalScrollHttp(page)
  })

  test('S5b Latih Tubi SPM serves the approved admin question @api', async ({ page, browser }, info) => {
    const token = tokenOf(info)
    const pre = await adminStatuses(browser, info, token)
    await asPupil(page)
    await page.goto('/spm/latih-tubi')
    await expect(page.getByTestId('spm-latih-tubi-page')).toBeVisible()
    await expectNoHorizontalScrollHttp(page)
    const card = page.getByTestId('latih-tubi-card-CHEM')
    await expect(card).toBeVisible()
    await expect(card.getByTestId('latih-tubi-locked'), `Kimia card is not locked (precondition: ${pre})`).toHaveCount(0)
    await expect(card.getByTestId('latih-tubi-count')).not.toContainText(/^\s*0\b/)
    await card.click()
    await expect(page).toHaveURL(/\/spm\/latih-tubi\/CHEM/)
    const start = await firstVisible(page, ['[data-testid*=start]', 'button:has-text("Mula")'], 'no start button on the Latih Tubi SPM setup')
    await start.click()
    await expect(page.getByText(token).first(), 'the admin question stem is served').toBeVisible({ timeout: 20_000 })
    await expectNoHorizontalScrollHttp(page)
  })

  test('S5c Soalan by Chapter (Bab) serves the approved admin question @api', async ({ page, browser }, info) => {
    const token = tokenOf(info)
    const pre = await adminStatuses(browser, info, token)
    await asPupil(page)
    await page.goto('/practice/chapter')
    await expect(page.getByTestId('chapter-index-page')).toBeVisible()
    await expectNoHorizontalScrollHttp(page)
    const grid = page.getByTestId('chapter-subject-grid')
    const kimia = grid.getByText('Kimia').first()
    await expect(kimia, `Kimia is offered under Soalan by Chapter (precondition: ${pre})`).toBeVisible({ timeout: 10_000 })
    await kimia.click()
    await expect(page).toHaveURL(/\/practice\/chapter\/CHEM/)
    const chapterStart = page.locator('a[href*="/quiz"], [data-testid*=chapter-start], [data-testid*=chapter-card]').first()
    await expect(chapterStart, 'a Bab with questions is listed').toBeVisible({ timeout: 10_000 })
    await chapterStart.click()
    await expect(page.getByText(token).first(), 'the admin question stem is served').toBeVisible({ timeout: 20_000 })
    await expectNoHorizontalScrollHttp(page)
  })

  /* ---------------------------------------------------------------- re-tests (smoke 2026-10-31) */

  test('R-B01 Soalan by Chapter lists subjects or shows an empty state @api', async ({ page }) => {
    await asPupil(page)
    const res = page.waitForResponse((r) => r.url().includes('/api/practice/chapter-subjects'))
    await page.goto('/practice/chapter')
    await expect(page.getByTestId('chapter-index-page')).toBeVisible()
    const body = (await (await res).json()) as { data?: unknown[] }
    await expectNoHorizontalScrollHttp(page)
    const grid = page.getByTestId('chapter-subject-grid')
    const tiles = await grid.locator('a, button').count()
    const emptyState = await page.locator('[data-ds=empty-state], [data-testid*=empty]').count()
    expect(
      { apiSubjects: body.data?.length ?? 0, tiles, emptyState },
      'B-01: subjects listed (V2) or at least an empty-state message',
    ).toMatchObject({ tiles: expect.any(Number) })
    expect(tiles > 0 || emptyState > 0, `B-01: chapter-subjects=${body.data?.length ?? 0}, tiles=${tiles}, empty-state=${emptyState}`).toBe(true)
    expect(tiles, 'B-01 (V2 parity): at least one subject with Bab is listed').toBeGreaterThan(0)
  })

  test('R-B02 Bijak K2 text answers can be self-marked and the score is final @api', async ({ page }) => {
    await asPupil(page)
    await page.goto('/spm/bijak')
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    const card = page.locator('[data-testid^=paper-]').filter({ hasText: /Sains/ }).filter({ hasText: /Kertas 2/ })
    await expect(card.first(), 'a Sains Kertas 2 paper (PoC "Contoh Pendek") is listed').toBeVisible()
    await card.first().locator('[data-testid^=open-]').click()
    await expect(page.getByTestId('bijak-cover')).toBeVisible()
    await startFresh(page)
    const box = page.locator('[data-testid=attempt-shell] textarea').first()
    await expect(box).toBeVisible()
    await box.fill('Klorofil menyerap cahaya matahari untuk fotosintesis.')
    await expect(page.getByTestId('save-status')).toHaveText('Disimpan', { timeout: 15_000 })
    while (await page.getByTestId('next').isVisible()) await page.getByTestId('next').click()
    await page.getByTestId('submit').click()
    await page.getByTestId('confirm-submit').click()
    await expect(page.getByTestId('win-screen')).toBeVisible({ timeout: 30_000 })
    await expectNoHorizontalScrollHttp(page)
    // Semakan rows are collapsed: open Soalan 1.
    const q1 = page.getByTestId('result-q-1')
    await q1.locator('summary, [aria-expanded]').first().click()
    const save = q1.locator('[data-testid=selfmark-save]:visible').first()
    await expect(save, 'B-02: a self-mark control ("Simpan markah") per part').toBeVisible({ timeout: 10_000 })
    const before = (await q1.getByTestId('q-score').innerText()).trim()
    const inc = q1.locator('[data-testid=selfmark-inc]:visible').first()
    if (await inc.isVisible()) await inc.click()
    else await q1.locator('[data-testid=selfmark-bands]:visible button').last().click()
    await save.click()
    await expect(page.getByTestId('selfmark-error')).toHaveCount(0)
    await expect(q1.getByTestId('q-score'), `self-mark changes the question score (was ${before})`).not.toHaveText(before, {
      timeout: 10_000,
    })
    await expectNoHorizontalScrollHttp(page)
  })

  test('R-B04 Simulasi Kuiz is reachable at /simulasi/kuiz @api', async ({ page }) => {
    await asPupil(page)
    await page.goto('/simulasi/kuiz')
    await page.waitForLoadState('networkidle')
    expect(new URL(page.url()).pathname, 'B-04: /simulasi/kuiz does not redirect away').toBe('/simulasi/kuiz')
    await expectNoHorizontalScrollHttp(page)
  })

  test('R-B05 Bijak Cuba Lagi starts a fresh sitting directly @api', async ({ page }) => {
    await asPupil(page)
    await page.goto('/spm/bijak')
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    const card = page.locator('[data-testid^=paper-]').filter({ hasText: /Matematik/ }).filter({ hasText: /Kertas 1/ })
    await expect(card.first(), 'a Matematik Kertas 1 paper is listed').toBeVisible()
    await card.first().locator('[data-testid^=open-]').click()
    await expect(page.getByTestId('bijak-cover')).toBeVisible()
    const first = await startFresh(page)
    await page.locator('[data-testid^=option-]').first().click()
    await expect(page.getByTestId('save-status')).toHaveText('Disimpan', { timeout: 15_000 })
    while (await page.getByTestId('next').isVisible()) await page.getByTestId('next').click()
    await page.getByTestId('submit').click()
    await page.getByTestId('confirm-submit').click()
    await expect(page.getByTestId('win-screen')).toBeVisible({ timeout: 30_000 })
    await expectNoHorizontalScrollHttp(page)
    await page.getByTestId('retry').click()
    await expect(page, 'B-05: Cuba Lagi opens a new attempt, not the cover').toHaveURL(/\/spm\/bijak\/percubaan\/[^/]+$/, {
      timeout: 15_000,
    })
    const second = /percubaan\/([^/?#]+)/.exec(page.url())?.[1]
    expect(second, 'a different attempt id').not.toBe(first)
    await expect(page.getByTestId('attempt-shell')).toBeVisible()
    await expectNoHorizontalScrollHttp(page)
  })
})
