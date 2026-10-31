/**
 * R1 end-to-end acceptance, BASELINE (T23; CLOUD-HANDOFF §7(i); v3-bijak-spm-scope R1-20).
 * Real stack only (VITE_API_MODE=http SPA + API + Postgres). Config: playwright.r1-e2e.config.ts.
 *
 * Journey, one named test per step, at 375 / 768 / 1280 (no horizontal page scroll):
 *   0  pupil baseline counts (Databank, Latih Tubi SPM, Soalan by Chapter)
 *   1  Admin Pusat enters questions: form + image (Bank Soalan), CSV (Import & Semakan),
 *      PDF (Muat Naik Kertas), one D90 group (one shared stimulus, >= 2 member questions)
 *   2  approves them (approved = servable, D80/D85); S2c = API-assisted review -> approved when
 *      the UI path is broken (recorded as such, never as a UI pass)
 *   5a-c (R1 target, right after approval) Databank, Latih Tubi SPM and Soalan by Chapter (Bab)
 *      receive the admin's APPROVED question
 *   2d/5d BASE-1 interim: bulk Terbitkan (published is what BASE-1 serves), then the same counts,
 *      so the rest of the pipeline can be observed on the lifecycle BASE-1 has
 *   3  builds a paper (Set Builder target; BASE-1 Pembina Kertas), review, Terbit
 *   4  pupil (T4, T5) sits it in Bijak SPM, self-marks, sees the result, Cuba Lagi
 *   B  re-tests of B-01, B-02, B-04, B-05 (docs/qa/r1-student-smoke-2026-10-31.md)
 *
 * BASELINE: many steps are expected to fail on BASE-1 (Set Builder UI, Studio groups and the
 * lifecycle are not merged). Each step asserts the target behaviour and fails with the observed
 * reason; a step whose input an earlier step did not produce is skipped as "Blocked: ...".
 * Nothing is faked. Fictitious demo accounts only (seed, public password of the local stack).
 * Report: docs/qa/r1-e2e-baseline-2026-10-31.md.
 *
 * WRITES REAL DATA (questions, intake batches, a paper, attempts) into the target database.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import type { Page, Response, TestInfo } from '@playwright/test'

import { API_PASSWORD, expect, test } from '../fixtures/api'
import { isDesktopShell } from '../support'
import { csrfOf, expectNoHScroll } from './helpers'

const RUN = process.env.R1_E2E_RUN || 'r-local'
const SHOTS = process.env.R1_E2E_SHOTS || 'docs/qa/r1-e2e-baseline-2026-10-31'
const STATE_DIR = 'test-results-r1-e2e/state'

const ADMIN = process.env.BIJAK_ADMIN_PUSAT_USER || 'admin@demo.test'
const PUPIL_T4 = process.env.BIJAK_STUDENT_USER || 'pelajar@demo.test' // grade 10 = Tingkatan 4
const PUPIL_T5 = process.env.BIJAK_STUDENT_T5_USER || 'pelajarmaju@demo.test' // grade 11 = Tingkatan 5
const PASS = process.env.E2E_DEMO_PASSWORD || API_PASSWORD

// ---------------------------------------------------------------- state across steps (per project)

interface RunState {
  tag: string
  baseline?: {
    databankMath?: number
    latihTubiMath?: number
    chapterSubjects?: number
    babTotals?: Record<string, number>
  }
  /** When the run's questions last became servable (approved, S2a/S2c) or published (S2d). */
  servableAt?: number
  publishedAt?: number
  formQuestion?: { text: string; id?: string; chapter?: string }
  /** S1e: the same MCQ without an image, to tell the image path apart from the rest. */
  controlQuestion?: { text: string; id?: string }
  csvQuestions?: string[]
  pdfBatch?: { id: string; submitted: boolean; groups: number; questions: number }
  manualBatch?: { id: string; submitted: boolean; groups: number; questions: number }
  approvedM04?: number
  approvedViaApi?: number
  approvedIntake?: number
  /** BASE-1 interim (S2d): run questions moved approved -> published with bulk Terbitkan. */
  publishedM04?: number
  paper?: { id: string; title: string; published: boolean; hasAdminQuestion: boolean }
  controlPaper?: { id: string; title: string; published: boolean; hasAdminQuestion: boolean }
  attempt?: { id: string; submitted: boolean }
}

const statePath = (info: TestInfo) => join(STATE_DIR, `${RUN}-${info.project.name}.json`)

function readState(info: TestInfo): RunState {
  try {
    return JSON.parse(readFileSync(statePath(info), 'utf8')) as RunState
  } catch {
    return { tag: `R1E2E ${RUN} ${info.project.name}` }
  }
}

function saveState(info: TestInfo, patch: Partial<RunState>): RunState {
  const next = { ...readState(info), ...patch }
  mkdirSync(STATE_DIR, { recursive: true })
  writeFileSync(statePath(info), JSON.stringify(next, null, 2))
  return next
}

/** Records one observed fact on the test (shown in the report and in results.json). */
function observe(info: TestInfo, text: string): void {
  info.annotations.push({ type: 'observed', description: text })
}

// ---------------------------------------------------------------- generic helpers

async function login(page: Page, user: string): Promise<void> {
  await page.goto('/login')
  await page.getByTestId('login-email').fill(user)
  await page.getByTestId('login-password').fill(PASS)
  const res = page.waitForResponse((r) => r.url().endsWith('/api/auth/login'), { timeout: 30_000 })
  await page.getByTestId('login-submit').click()
  expect((await res).status(), 'POST /api/auth/login').toBe(200)
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

/** Fails when the route renders the "Halaman Tidak Dijumpai" placeholder or redirects away. */
async function expectRouteExists(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await page.waitForLoadState('networkidle').catch(() => undefined)
  const url = new URL(page.url())
  expect(url.pathname, `route ${path} redirected to ${url.pathname}`).toBe(path)
  await expect(
    page.getByTestId('app-placeholder'),
    `route ${path} renders "Halaman Tidak Dijumpai" (no page registered)`,
  ).toHaveCount(0)
}

const firstNumber = (text: string): number =>
  Number(/(\d[\d,.]*)/.exec(text)?.[1]?.replace(/[,.]/g, '') ?? NaN)

const isApi = (r: Response, method: string, re: RegExp) =>
  r.request().method() === method && re.test(r.url())

/** A 2 x 2 PNG (red), small enough for every upload limit. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==',
  'base64',
)

/** A one-page PDF with a text layer: one line per entry (Helvetica, top to bottom). */
function pdfOf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const body = lines
    .map((l, i) => `BT /F1 11 Tf 50 ${800 - i * 18} Td (${esc(l)}) Tj ET`)
    .join('\n')
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out))
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = Buffer.byteLength(out)
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

/**
 * pdfjs-dist 6 (PDF intake) calls `Map/WeakMap.prototype.getOrInsertComputed`, which current Chrome
 * and Edge ship but older Chromium builds lack (Chromium 153 of this run has it natively). This
 * shim adds the standard method in the page and in the pdf.js worker ONLY when the browser lacks it,
 * so the rest of the intake flow can be observed; the step records that the shim was needed.
 */
const SHIM = `for (const C of [Map, WeakMap]) {
  if (!C.prototype.getOrInsertComputed) {
    globalThis.__r1e2eShim = true
    Object.defineProperty(C.prototype, 'getOrInsertComputed', { configurable: true, writable: true,
      value(k, f) { if (this.has(k)) return this.get(k); const v = f(k); this.set(k, v); return v } })
  }
  if (!C.prototype.getOrInsert) {
    Object.defineProperty(C.prototype, 'getOrInsert', { configurable: true, writable: true,
      value(k, v) { if (!this.has(k)) this.set(k, v); return this.get(k) } })
  }
}\n`

async function shimPdfjs(page: Page, info: TestInfo): Promise<void> {
  await page.addInitScript(SHIM)
  await page.route(/pdf\.worker[^/]*\.m?js(\?.*)?$/, async (route) => {
    const res = await route.fetch()
    await route.fulfill({ response: res, body: SHIM + (await res.text()) })
  })
  const native = await page
    .evaluate(
      () =>
        'getOrInsertComputed' in Map.prototype &&
        !(globalThis as { __r1e2eShim?: boolean }).__r1e2eShim,
    )
    .catch(() => true)
  if (!native) observe(info, 'browser lacks Map.prototype.getOrInsertComputed: shim applied')
}

/** Pentadbiran: opens a menu item by its label (drawer below 1024 px). */
async function adminMenu(page: Page, label: string): Promise<void> {
  if (!isDesktopShell(page)) await page.getByTestId('pentadbiran-menu-button').click()
  const nav = page.locator('[data-testid=pentadbiran-nav]:visible')
  await nav.getByRole('link', { name: label, exact: true }).first().click()
}

async function fillIntakeMeta(page: Page): Promise<void> {
  await page.getByTestId('intake-source').fill(`E2E ${RUN}`)
  await page.getByTestId('intake-copyright').selectOption('sendiri')
}

/**
 * Completes every question card of an intake batch so "Hantar untuk semakan" can pass the gate
 * (validation.ts): MCQ with 4 options and key A, stem, DSKP unit (first offered), SP 1.1, TP 3, and
 * every low-confidence field confirmed. Fields an extractor already filled are kept.
 */
async function completeIntakeQuestions(page: Page, tag: string): Promise<void> {
  const cards = page.getByTestId('question-card')
  const n = await cards.count()
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i)
    if ((await card.getByTestId('question-editor').count()) === 0)
      await card.getByRole('button').first().click()
    const ed = card.getByTestId('question-editor')
    await expect(ed).toBeVisible()
    if ((await ed.getByTestId('q-type').inputValue()) !== 'mcq')
      await ed.getByTestId('q-type').selectOption('mcq')
    const stem = ed.getByTestId('q-stem')
    if (!(await stem.inputValue()).trim())
      await stem.fill(`${tag} manual ${i + 1}: Apakah tujuan utama kitar semula?`)
    const opts = ed.getByRole('textbox', { name: /^Pilihan [A-E]$/ })
    while ((await opts.count()) < 4)
      await ed.getByRole('button', { name: 'Tambah pilihan' }).click()
    const texts = ['Mengurangkan sisa', 'Menambah sisa', 'Membakar sampah', 'Membuang ke sungai']
    for (let k = 0; k < 4; k++)
      if (!(await opts.nth(k).inputValue()).trim()) await opts.nth(k).fill(texts[k] ?? 'x')
    if ((await ed.locator('input[type=radio]:checked').count()) === 0)
      await ed.getByRole('radio', { name: 'Jadikan A kunci jawapan' }).check()
    const unit = ed.getByTestId('q-unit')
    if (!(await unit.inputValue())) {
      const first = await unit
        .locator('option:not([value=""])')
        .first()
        .getAttribute('value')
        .catch(() => null)
      if (first) await unit.selectOption(first)
    }
    const sp = ed.getByTestId('q-sp')
    if (!(await sp.inputValue()).trim()) {
      await sp.fill('1.1')
      await sp.press('Tab')
    }
    const tp = ed.getByRole('spinbutton', { name: /TP/ })
    if ((await tp.count()) > 0 && !(Number(await tp.inputValue()) >= 1)) await tp.fill('3')
    const confirms = ed.locator('[data-testid^=confirm-]')
    for (let k = 0; k < (await confirms.count()); k++) {
      const box = confirms
        .nth(k)
        .locator('xpath=self::*[@role="checkbox"] | .//*[@role="checkbox"]')
        .first()
      if ((await box.getAttribute('aria-checked')) !== 'true') await box.dispatchEvent('click')
    }
  }
}

/**
 * "Hantar untuk semakan": in http mode it runs the server gate (`GET .../review`). Records the
 * server's blocking issues and asserts the "Dihantar untuk semakan" note.
 */
async function submitBatch(page: Page, info: TestInfo): Promise<void> {
  const review = page
    .waitForResponse((r) => isApi(r, 'GET', /\/api\/intake\/batches\/[^/]+\/review$/), {
      timeout: 30_000,
    })
    .catch(() => null)
  await page.getByTestId('submit-review').click()
  const res = await review
  const body = res
    ? ((await res.json().catch(() => ({}))) as {
        data?: { issues?: { where: string; message: string }[] }
      })
    : {}
  const text = (body.data?.issues ?? []).map((i) => `${i.where}: ${i.message}`).join('; ')
  if (text) observe(info, `server gate refused: ${text}`)
  await expect(
    page.getByTestId('submitted-note'),
    `batch sent for review; server gate: ${text || 'no issues'}`,
  ).toBeVisible()
}

/** The open issues of the batch gate, as text (for the report). */
async function gateIssues(page: Page): Promise<string> {
  const toggle = page.getByTestId('issues-toggle')
  if ((await toggle.count()) === 0) return ''
  if ((await page.getByTestId('issues-list').count()) === 0) await toggle.click()
  return (
    await page
      .getByTestId('issues-list')
      .innerText()
      .catch(() => '')
  )
    .replace(/\s+/g, ' ')
    .slice(0, 400)
}

/** Databank / Latih Tubi card count of Matematik ("N soalan ..."). */
async function cardCount(
  page: Page,
  path: string,
  testid: string,
  countId: string,
): Promise<number> {
  await page.goto(path)
  const card = page.getByTestId(testid)
  await expect(card, `${testid} on ${path}`).toBeVisible()
  return firstNumber(await card.getByTestId(countId).innerText())
}

/**
 * Bank Soalan rows of the run: table rows at desktop/tablet, cards below the table breakpoint
 * (DsDataTable renders `[data-ds=data-table-cards] > li` there, without the status and view cells).
 */
const listRows = (page: Page, text: string) =>
  page
    .getByTestId('questions-table')
    .locator('tbody tr, [data-ds=data-table-cards] > li')
    .filter({ hasText: text })

/** The run's questions as the admin API lists them (id + status), for ids and evidence. */
async function runQuestions(page: Page, tag: string): Promise<{ id: string; status: string }[]> {
  const res = await page.request.get(`/api/questions?search=${encodeURIComponent(tag)}&pageSize=50`)
  expect(res.status(), 'GET /api/questions (admin list)').toBe(200)
  const body = (await res.json()) as { data?: { id: string | number; status: string }[] }
  return (body.data ?? []).map((q) => ({ id: String(q.id), status: q.status }))
}

/**
 * The practice bank facts behind Databank / Latih Tubi / Soalan by Chapter counts are memoised per
 * API process for 60 s (`DEFAULT_OVERVIEW_OPTIONS.bankTtlMs`, a documented staleness). Waits until
 * that window has passed since the status change, so a count read afterwards is current.
 */
const BANK_TTL_MS = 60_000
async function waitOutBankCache(page: Page, changedAt: number | undefined): Promise<void> {
  if (!changedAt) return
  const left = changedAt + BANK_TTL_MS + 3_000 - Date.now()
  if (left > 0) await page.waitForTimeout(left)
}

/** Soalan by Chapter, Matematik: question total per Bab name (GET /api/practice/chapter-subjects/MATH). */
async function babTotals(page: Page): Promise<Record<string, number>> {
  const res = await page.request.get('/api/practice/chapter-subjects/MATH')
  if (!res.ok()) return {}
  const body = (await res.json()) as {
    data?: { levels?: { id: string }[]; chapters?: { name: string; total: number }[] }
  }
  const out: Record<string, number> = {}
  for (const lvl of body.data?.levels ?? []) {
    const r = await page.request.get(`/api/practice/chapter-subjects/MATH?levelId=${lvl.id}`)
    if (!r.ok()) continue
    const b = (await r.json()) as { data?: { chapters?: { name: string; total: number }[] } }
    for (const c of b.data?.chapters ?? []) out[c.name] = (out[c.name] ?? 0) + c.total
  }
  return out
}

/**
 * Result page "Semakan soalan": opens each question until a self-mark control shows, raises the
 * mark by one and presses "Simpan markah". Asserts the control exists and the save succeeds.
 */
async function selfMarkOne(page: Page, info: TestInfo): Promise<void> {
  const cards = page.locator('[data-testid^=result-q-]')
  await expect(cards.first(), 'Semakan soalan lists the questions').toBeVisible()
  const n = await cards.count()
  let control = page
    .locator(
      '[data-testid^=selfmark-]:not([data-testid^=selfmark-state]):not([data-testid^=selfmark-bands])',
    )
    .first()
  for (let i = 0; i < n && !(await page.getByTestId('selfmark-save').first().isVisible()); i++) {
    await cards.nth(i).locator('summary').click()
  }
  const save = page.getByTestId('selfmark-save').first()
  observe(
    info,
    `self-mark controls on the page: ${await page.getByTestId('selfmark-save').count()}`,
  )
  await expect(save, 'self-mark control ("Simpan markah") on a written part').toBeVisible()
  control = save.locator(
    'xpath=ancestor::*[starts-with(@data-testid, "selfmark-") and not(@data-testid="selfmark-save")][1]',
  )
  const inc = control.getByTestId('selfmark-inc')
  if ((await inc.count()) > 0 && (await inc.isEnabled())) await inc.click()
  else
    await control
      .getByTestId('selfmark-bands')
      .getByRole('radio')
      .first()
      .click()
      .catch(() => undefined)
  const put = page
    .waitForResponse(
      (r) =>
        r.request().method() !== 'GET' &&
        /\/api\/bijak\/attempts\/[^/]+\/(semak|self-?mark)/.test(r.url()),
      { timeout: 15_000 },
    )
    .catch(() => null)
  await save.click()
  const res = await put
  observe(
    info,
    `self-mark save -> ${res ? `${res.request().method()} ${new URL(res.url()).pathname} ${res.status()}` : 'no request seen'}`,
  )
  expect(res?.status() ?? 0, 'self-mark saved (2xx)').toBeGreaterThanOrEqual(200)
  expect(res?.status() ?? 999, 'self-mark saved (2xx)').toBeLessThan(300)
  await expect(control.getByTestId('selfmark-error')).toHaveCount(0)
}

/**
 * Soalan by Chapter serves the S1a question's Bab: its total rose against S0 (API) and the pupil
 * can open Matematik and see the Bab (UI).
 */
async function expectBabServes(
  page: Page,
  info: TestInfo,
  st: RunState,
  stage: 'approved' | 'published',
): Promise<void> {
  const name = st.formQuestion!.chapter!.replace(/^Bab \d+:\s*/, '')
  const before = st.baseline?.babTotals?.[name] ?? 0
  const after = (await babTotals(page))[name] ?? 0
  observe(info, `${stage}: Bab "${name}" total ${before} -> ${after}`)
  await page.goto('/practice/chapter')
  await expect(page.getByTestId('chapter-index-page')).toBeVisible()
  const tile = page.getByTestId('chapter-subject-MATH')
  const listed = await tile.isVisible().catch(() => false)
  observe(
    info,
    `Matematik tile on Soalan by Chapter: ${listed ? (await tile.innerText()).replace(/\s+/g, ' ') : 'absent'}`,
  )
  await expectNoHScroll(page)
  expect(
    after,
    `Bab "${name}" total rose after the admin question became ${stage}`,
  ).toBeGreaterThan(before)
  await expect(tile, 'Matematik listed in Soalan by Chapter').toBeVisible()
  await tile.click()
  await expect(page.getByText(name).first(), `Bab "${name}" listed`).toBeVisible()
  await expectNoHScroll(page)
}

// ---------------------------------------------------------------- the journey

test.describe('R1 E2E baseline @api @r1e2e', () => {
  test.afterEach(async ({ page }, info) => {
    // A skipped (Blocked) step never opened a page: no screenshot, the skip reason is the evidence.
    if (info.status === 'skipped' || page.url() === 'about:blank') return
    const step = info.title.split(' ')[0] ?? 'step'
    const file = join(SHOTS, `${info.project.name}-${step}.jpg`)
    mkdirSync(dirname(file), { recursive: true })
    await page.screenshot({ path: file, type: 'jpeg', quality: 45 }).catch(() => undefined)
    info.annotations.push({ type: 'screenshot', description: file })
  })

  test('S0 pupil baseline counts (Databank, Latih Tubi SPM, Soalan by Chapter)', async ({
    page,
  }, info) => {
    await login(page, PUPIL_T4)
    const databankMath = await cardCount(
      page,
      '/spm/tahun-lepas',
      'databank-card-MATH',
      'databank-count',
    )
    await expectNoHScroll(page)
    const latihTubiMath = await cardCount(
      page,
      '/spm/latih-tubi',
      'latih-tubi-card-MATH',
      'latih-tubi-count',
    )
    await expectNoHScroll(page)
    await page.goto('/practice/chapter')
    await expect(page.getByTestId('chapter-index-page')).toBeVisible()
    const chapterSubjects = await page
      .getByTestId('chapter-subject-grid')
      .locator(':scope > *')
      .count()
    await expectNoHScroll(page)
    const bab = await babTotals(page)
    saveState(info, {
      baseline: { databankMath, latihTubiMath, chapterSubjects, babTotals: bab },
    })
    observe(
      info,
      `Databank MATH ${databankMath}, Latih Tubi SPM MATH ${latihTubiMath}, chapter subjects ${chapterSubjects}, Matematik Bab totals ${JSON.stringify(bab)}`,
    )
    expect(Number.isNaN(databankMath), 'Databank Matematik count is readable').toBe(false)
  })

  /**
   * Bank Soalan > Tambah Soalan: a T4 Matematik MCQ (key B = 42) with the first Bab and the first
   * DSKP Bidang > SK > SP offered, Kertas 1, optionally a stem image. Returns the new id and Bab.
   */
  async function createFormMcq(
    page: Page,
    info: TestInfo,
    text: string,
    withImage: boolean,
  ): Promise<{ id?: string; chapter?: string }> {
    await login(page, ADMIN)
    await adminMenu(page, 'Bank Soalan')
    await expect(page).toHaveURL(/\/admin\/questions$/)
    await page.getByTestId('questions-add').click()
    await expect(page.getByTestId('question-create-page')).toBeVisible()
    await expect(page.getByTestId('question-form')).toBeVisible()
    await expectNoHScroll(page)

    await page.getByTestId('q-subject').selectOption({ label: 'Matematik' })
    await page.getByTestId('q-level').selectOption({ label: 'Tingkatan 4' })
    // Bab (D89): the first real chapter of Matematik T4, when the list has one.
    const chapter = page.getByTestId('q-chapter')
    let chapterLabel: string | undefined
    await expect(chapter)
      .toBeEnabled({ timeout: 10_000 })
      .catch(() => undefined)
    if ((await chapter.evaluate((e) => e.tagName)) === 'SELECT') {
      const opts = chapter.locator('option:not([value=""])')
      if ((await opts.count()) > 0) {
        chapterLabel = (await opts.first().innerText()).trim()
        await chapter.selectOption({ label: chapterLabel })
      }
    }
    observe(info, chapterLabel ? `Bab chosen: ${chapterLabel}` : 'Bab list empty for Matematik T4')
    // DSKP tag (R1-13; publish needs unit + SP): first Bidang -> first SK -> first SP offered.
    let dskp = ''
    for (const id of ['dskp-bidang', 'dskp-sk', 'dskp-sp']) {
      const sel = page.getByTestId(id)
      await expect(sel)
        .toBeEnabled({ timeout: 10_000 })
        .catch(() => undefined)
      const opt = sel.locator('option:not([value=""])').first()
      const value = await opt.getAttribute('value', { timeout: 5_000 }).catch(() => null)
      if (!value) break
      await sel.selectOption(value)
      dskp += `${(await opt.innerText()).trim().slice(0, 40)} > `
    }
    observe(info, dskp ? `DSKP chosen: ${dskp.slice(0, -3)}` : 'DSKP lists empty for Matematik T4')
    // The reka radio buttons are sr-only under their labels: click the label text.
    await page.locator('#q-difficulty').getByText('Mudah', { exact: true }).click()
    await page.getByTestId('q-text').fill(text)
    if (withImage) {
      await page
        .getByTestId('q-image-input')
        .setInputFiles({ name: 'rajah.png', mimeType: 'image/png', buffer: PNG })
      await expect(
        page.getByTestId('q-image-preview').first(),
        'stem image preview after upload',
      ).toBeAttached()
    }
    const answers = ['40', '42', '44', '32']
    for (let i = 0; i < 4; i++) await page.getByTestId(`q-option-${i}`).fill(answers[i] ?? '')
    // Correct answer = B (42).
    await page.getByRole('radio', { name: 'Jawapan betul B' }).dispatchEvent('click')
    await expect(page.getByRole('radio', { name: 'Jawapan betul B' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await page.getByTestId('q-explanation').fill('12 + 30 = 42.')
    await page.getByTestId('q-kertas').selectOption({ label: 'Kertas 1' })
    await expectNoHScroll(page)

    const created = page.waitForResponse((r) => isApi(r, 'POST', /\/api\/(admin\/)?questions$/), {
      timeout: 30_000,
    })
    await page.getByRole('button', { name: 'Simpan Soalan' }).click()
    const res = await created
    const body = (await res.json().catch(() => ({}))) as {
      data?: { id?: string | number; status?: string }
    }
    expect(
      res.status(),
      `POST questions -> ${res.status()} ${JSON.stringify(body).slice(0, 300)}`,
    ).toBeLessThan(300)
    await expect(page).toHaveURL(/\/admin\/questions$/)
    const id = body.data?.id !== undefined ? String(body.data.id) : undefined
    observe(
      info,
      `created question id ${id ?? '?'}; response status field: ${String(body.data?.status ?? '-')}`,
    )
    // The list filter as a URL (live GET form): works at every width (the "Cari" button sits in
    // the "Penapis" drawer below lg).
    await page.goto(`/admin/questions?search=${encodeURIComponent(text.slice(0, 40))}`)
    await expect(listRows(page, text.slice(0, 40)).first(), 'new question listed').toBeVisible()
    await expectNoHScroll(page)
    return { id, chapter: chapterLabel }
  }

  test('S1a admin creates a T4 MCQ with an image and a Bab via the form (Bank Soalan)', async ({
    page,
  }, info) => {
    const st = readState(info)
    const text = `${st.tag} borang: Berapakah hasil tambah 12 dan 30?`
    const { id, chapter } = await createFormMcq(page, info, text, true)
    saveState(info, { formQuestion: { text, id, chapter } })
  })

  test('S1e control: admin creates the same MCQ WITHOUT an image (isolates the image path)', async ({
    page,
  }, info) => {
    const st = readState(info)
    const text = `${st.tag} kawalan: Berapakah hasil tambah 12 dan 30?`
    const { id } = await createFormMcq(page, info, text, false)
    saveState(info, { controlQuestion: { text, id } })
  })

  test('S1b admin imports a CSV of 2 MCQs (Import & Semakan)', async ({ page }, info) => {
    const st = readState(info)
    const q1 = `${st.tag} csv-1: Nilai 7 darab 6 ialah`
    const q2 = `${st.tag} csv-2: Nilai 81 bahagi 9 ialah`
    const csv = [
      'question_text,option_a,option_b,option_c,option_d,correct_answer,difficulty_level,kertas',
      `"${q1}",40,42,48,36,B,2,1`,
      `"${q2}",8,9,7,6,B,2,1`,
    ].join('\n')
    await login(page, ADMIN)
    await adminMenu(page, 'Import & Semakan')
    await expect(page.getByTestId('import-page')).toBeVisible()
    await expectNoHScroll(page)
    await page.getByTestId('import-file').setInputFiles({
      name: 'soalan.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf8'),
    })
    await page.getByTestId('import-default-subject').selectOption({ label: 'Matematik' })
    await page.getByTestId('import-default-level').selectOption({ label: 'Tingkatan 4' })
    const posted = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /import/.test(r.url()),
      { timeout: 60_000 },
    )
    await page.getByTestId('import-submit').click()
    const res = await posted
    const body = await res.text()
    observe(info, `POST import -> ${res.status()} ${body.slice(0, 200)}`)
    expect(res.status(), `CSV import response ${res.status()}`).toBeLessThan(300)
    saveState(info, { csvQuestions: [q1, q2] })
    await page.goto(`/admin/questions?search=${encodeURIComponent(st.tag + ' csv')}`)
    await expect(
      page.getByTestId('questions-table'),
      'imported rows listed in Bank Soalan',
    ).toContainText('csv-1')
    await expectNoHScroll(page)
  })

  test('S1c admin PDF intake with a passage shared by 2 questions (Muat Naik Kertas)', async ({
    page,
  }, info) => {
    const st = readState(info)
    const pdf = pdfOf([
      `Kertas contoh ${st.tag}`,
      'Petikan 1: Harga sebatang pensel RM1, sebuah buku RM6 dan sebiji pemadam 50 sen.',
      'Gunakan Petikan 1 untuk menjawab soalan 1 dan 2.',
      `1. Berapakah harga sebatang pensel? ${st.tag} pdf`,
      'A. RM1',
      'B. RM2',
      'C. RM3',
      'D. RM4',
      `2. Barangan manakah yang paling murah? ${st.tag} pdf`,
      'A. Pemadam',
      'B. Pensel',
      'C. Buku',
      'D. Beg',
      'Jawapan: 1-A 2-A',
    ])
    await login(page, ADMIN)
    await shimPdfjs(page, info)
    await adminMenu(page, 'Muat Naik Kertas')
    await expect(page.getByTestId('intake-upload-page')).toBeVisible()
    await expectNoHScroll(page)
    await fillIntakeMeta(page)
    await page.getByTestId('intake-file').setInputFiles({
      name: 'kertas-e2e.pdf',
      mimeType: 'application/pdf',
      buffer: pdf,
    })
    await page.getByTestId('intake-submit').click()
    await expect(page, 'upload leads to the review page').toHaveURL(
      /\/admin\/spm\/soalan\/ekstrak\/[^/]+$/,
      { timeout: 90_000 },
    )
    const id = page.url().split('/').pop() ?? ''
    await expect(page.getByTestId('intake-review-page')).toBeVisible()
    await expect(
      page.getByTestId('step-unavailable'),
      'review step available in http mode',
    ).toHaveCount(0)
    // http mode: the server reads the file (job intake.process_file), then "Ekstrak soalan" runs the
    // extraction provider. Poll with reloads; the job needs JOBS_WORKER_ENABLED=true on the API.
    const start = page.getByTestId('extract-start')
    await expect
      .poll(
        async () => {
          if (await start.isEnabled().catch(() => false)) return 'ready'
          await page.reload()
          return (await page.getByTestId('extract-processing').count()) > 0 ? 'processing' : 'other'
        },
        {
          message: 'server finished reading the PDF (Ekstrak soalan enabled)',
          timeout: 60_000,
          intervals: [3_000],
        },
      )
      .toBe('ready')
    await start.click()
    await expect
      .poll(
        async () => {
          if ((await page.getByTestId('question-card').count()) > 0) return 'questions'
          if ((await page.getByTestId('extract-failed').count()) > 0)
            return `failed: ${await page.getByTestId('extract-failed').innerText()}`
          if ((await page.getByTestId('extract-empty').count()) > 0) return 'empty'
          await page.reload()
          return 'waiting'
        },
        { message: 'extraction produced question cards', timeout: 90_000, intervals: [3_000] },
      )
      .toBe('questions')
    const questions = await page.getByTestId('question-card').count()
    const groups = await page.getByTestId('group-header').count()
    observe(info, `batch ${id}: ${questions} question card(s), ${groups} group header(s)`)
    saveState(info, { pdfBatch: { id, submitted: false, groups, questions } })
    expect(questions, 'extracted questions').toBeGreaterThanOrEqual(2)
    expect(groups, 'Petikan 1 forms one shared-stimulus group').toBeGreaterThanOrEqual(1)
    await expectNoHScroll(page)
    // The figure needs alt text before the batch can be sent; questions need key + DSKP tag.
    const alt = page.getByTestId('stimulus-alt').first()
    if (await alt.isVisible()) await alt.fill('Jadual harga tiga barangan')
    await completeIntakeQuestions(page, st.tag)
    observe(info, `gate after completing: ${(await gateIssues(page)) || 'no issues'}`)
    await expect(page.getByTestId('submit-review'), 'Hantar untuk semakan enabled').toBeEnabled()
    await submitBatch(page, info)
    saveState(info, { pdfBatch: { id, submitted: true, groups, questions } })
  })

  test('S1d admin D90 group: one shared stimulus with 2 member questions (Studio / Tulis Soalan Manual)', async ({
    page,
  }, info) => {
    const st = readState(info)
    await login(page, ADMIN)
    // R1-13 / R1-21 P5: the Studio is the V2 place for groups. Record whether it exists.
    await page.goto('/admin/studio')
    const studio = (await page.getByTestId('app-placeholder').count()) === 0
    observe(
      info,
      studio
        ? '/admin/studio exists'
        : '/admin/studio renders "Halaman Tidak Dijumpai" (Studio F03a/b not merged)',
    )
    // Today's group path: Tulis Soalan Manual -> review page (stimulus panel, group membership).
    await page.goto('/admin/command-center')
    await adminMenu(page, 'Tulis Soalan Manual')
    await expect(page.getByTestId('intake-manual-page')).toBeVisible()
    await expectNoHScroll(page)
    await fillIntakeMeta(page)
    await page.getByTestId('manual-start').click()
    await expect(page).toHaveURL(/\/admin\/spm\/soalan\/ekstrak\/[^/]+$/, { timeout: 30_000 })
    const id = page.url().split('/').pop() ?? ''
    await expect(page.getByTestId('intake-review-page')).toBeVisible()
    await expect(
      page.getByTestId('step-unavailable'),
      'manual editor available in http mode',
    ).toHaveCount(0)
    // Two questions, one passage, both attached.
    while ((await page.getByTestId('question-card').count()) < 2)
      await page.getByTestId('add-question').click()
    await page.getByRole('button', { name: /Tambah petikan/ }).click()
    const stim = page.getByTestId('stimulus-card').first()
    await stim
      .getByLabel(/Kapsyen/)
      .fill(`Petikan ${st.tag}`)
      .catch(() => undefined)
    await stim
      .getByTestId('stimulus-alt')
      .fill('Petikan pendek tentang kitar semula')
      .catch(() => undefined)
    await stim
      .locator('textarea')
      .last()
      .fill(`Petikan bersama ${st.tag}: Kitar semula mengurangkan sisa.`)
      .catch(() => undefined)
    await stim.getByRole('checkbox', { name: 'Soalan 1' }).check()
    await stim.getByRole('checkbox', { name: 'Soalan 2' }).check()
    await expect(
      page.getByTestId('group-header'),
      'one group header for the shared stimulus',
    ).toHaveCount(1)
    await completeIntakeQuestions(page, st.tag)
    observe(info, `manual batch ${id}; gate: ${(await gateIssues(page)) || 'no issues'}`)
    saveState(info, { manualBatch: { id, submitted: false, groups: 1, questions: 2 } })
    await expectNoHScroll(page)
    const submit = page.getByTestId('submit-review')
    await expect(submit, 'Hantar untuk semakan enabled (no blocking issues)').toBeEnabled()
    await submitBatch(page, info)
    saveState(info, { manualBatch: { id, submitted: true, groups: 1, questions: 2 } })
  })

  /** Bank Soalan: select every row of the run and apply one bulk action; returns the API result. */
  async function bulkOnRun(
    page: Page,
    tag: string,
    label: string,
    info: TestInfo,
  ): Promise<{ affected: number; failed: string[] }> {
    await page.goto(`/admin/questions?search=${encodeURIComponent(tag)}`)
    await expect(page.getByTestId('questions-table')).toBeVisible()
    const rows = listRows(page, tag)
    await expect(rows.first(), 'run questions listed').toBeVisible()
    const count = await rows.count()
    for (let i = 0; i < count; i++)
      await rows.nth(i).getByRole('checkbox').first().check({ force: true })
    await expect(page.getByTestId('questions-bulk-bar')).toBeVisible()
    await page.getByTestId('questions-bulk-action').selectOption({ label })
    const bulk = page.waitForResponse(
      (r) => r.request().method() !== 'GET' && /bulk/.test(r.url()),
      { timeout: 30_000 },
    )
    await page.getByTestId('questions-bulk-submit').click()
    await page.getByRole('button', { name: 'Ya', exact: true }).click()
    const res = await bulk
    const body = (await res.json().catch(() => ({}))) as {
      data?: { affected?: number; failed?: { message: string }[] }
    }
    const out = {
      affected: body.data?.affected ?? 0,
      failed: (body.data?.failed ?? []).map((f) => f.message),
    }
    observe(
      info,
      `${label} on ${count} row(s) -> HTTP ${res.status()}, affected ${out.affected}${out.failed.length ? `, refused: ${[...new Set(out.failed)].join(' / ')}` : ''}`,
    )
    observe(
      info,
      `statuses now (API): ${(await runQuestions(page, tag)).map((q) => `#${q.id} ${q.status}`).join(', ')}`,
    )
    return out
  }

  test('S2a admin approves the Bank Soalan questions (Luluskan)', async ({ page }, info) => {
    const st = readState(info)
    test.skip(!st.formQuestion && !st.csvQuestions, 'Blocked: S1a/S1b created no question')
    await login(page, ADMIN)
    const n =
      (st.formQuestion ? 1 : 0) + (st.controlQuestion ? 1 : 0) + (st.csvQuestions?.length ?? 0)
    // V3 lifecycle: Draf -> "Hantar untuk Semakan" (question detail) -> "Luluskan" (bulk bar).
    const ids = (await runQuestions(page, st.tag)).map((q) => q.id)
    observe(info, `${ids.length} run question(s) found`)
    let sent = 0
    for (const id of ids) {
      await page.goto(`/admin/questions/${id}`)
      const btn = page.getByTestId('status-pending-review')
      if (
        !(await btn.waitFor({ state: 'visible', timeout: 10_000 }).then(
          () => true,
          () => false,
        ))
      )
        continue
      await expectNoHScroll(page)
      const r = page
        .waitForResponse(
          (x) => x.request().method() !== 'GET' && /\/api\/.*questions/.test(x.url()),
          { timeout: 15_000 },
        )
        .catch(() => null)
      await btn.click()
      // "Pengesahan: Adakah anda pasti mahu mengubah status soalan ini?" -> Ya
      await page.getByRole('button', { name: 'Ya', exact: true }).click()
      const res = await r
      if (res?.ok()) sent++
      else if (res)
        observe(
          info,
          `${new URL(page.url()).pathname} Hantar untuk Semakan -> ${res.request().method()} ${new URL(res.url()).pathname} body ${res.request().postData() ?? ''} -> HTTP ${res.status()} ${(await res.text().catch(() => '')).slice(0, 160)}`,
        )
    }
    observe(info, `Hantar untuk Semakan succeeded on ${sent} of ${ids.length} question(s)`)
    const res = await bulkOnRun(page, st.tag, 'Luluskan', info)
    saveState(info, {
      approvedM04: res.affected,
      ...(res.affected ? { servableAt: Date.now() } : {}),
    })
    await expectNoHScroll(page)
    expect(sent, '"Hantar untuk Semakan" succeeded on every question').toBe(ids.length)
    expect(res.failed, 'no question refused by Luluskan').toEqual([])
    expect(res.affected, 'every run question approved (Diluluskan)').toBe(n)
  })

  test('S2c API-assisted lifecycle (UI path blocked): review -> approved, so the pupil side can be observed', async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(!st.formQuestion && !st.csvQuestions, 'Blocked: S1a/S1b created no question')
    test.skip(!!st.approvedM04, 'Not needed: S2a approved the questions through the UI')
    // NOT a UI pass: the same POST /api/questions/bulk-action the screens use, with string ids
    // (the detail page sends numeric ids and gets 422, bug R1E2E-03). Only "approved" is applied,
    // the R1 target state (D80/D85); whether approved is servable is what S5 then shows.
    await login(page, ADMIN)
    const ids = (await runQuestions(page, st.tag)).map((q) => q.id)
    const csrf = await csrfOf(page)
    const out: string[] = []
    let approved = 0
    for (const action of ['review', 'approved']) {
      const res = await page.request.post('/api/questions/bulk-action', {
        headers: { 'x-csrf-token': csrf },
        data: { action, ids },
      })
      const body = (await res.json().catch(() => ({}))) as { data?: { affected?: number } }
      out.push(`${action}: HTTP ${res.status()} affected ${body.data?.affected ?? '?'}`)
      if (action === 'approved') approved = body.data?.affected ?? 0
    }
    observe(info, `API-assisted on ${ids.length} id(s): ${out.join('; ')}`)
    observe(
      info,
      `statuses now (API): ${(await runQuestions(page, st.tag)).map((q) => `#${q.id} ${q.status}`).join(', ')}`,
    )
    await page.goto(`/admin/questions?search=${encodeURIComponent(st.tag)}`)
    await expect(listRows(page, st.tag).first()).toBeVisible()
    await expectNoHScroll(page)
    saveState(info, { approvedViaApi: approved, servableAt: Date.now() })
    expect(approved, 'every run question approved through the API').toBe(ids.length)
  })

  test('S2b admin approves the intake questions in Baris Gilir Semakan', async ({ page }, info) => {
    const st = readState(info)
    test.skip(
      !st.pdfBatch?.submitted && !st.manualBatch?.submitted,
      'Blocked: S1c/S1d sent no batch for review',
    )
    await login(page, ADMIN)
    await adminMenu(page, 'Baris Gilir Semakan')
    await expect(page.getByTestId('review-queue-page')).toBeVisible()
    await expectNoHScroll(page)
    const rows = page
      .getByTestId('queue-table')
      .locator('tbody tr, [data-ds=data-table-cards] > li')
    const before = await rows.count()
    observe(info, `queue rows: ${before}`)
    expect(before, 'the submitted batches are queued').toBeGreaterThanOrEqual(1)
    let approved = 0
    for (let guard = 0; guard < 10; guard++) {
      const row = page
        .getByTestId('queue-table')
        .locator('tbody tr, [data-ds=data-table-cards] > li', { hasText: 'E2E' })
        .first()
      if ((await row.count()) === 0) break
      await row.getByRole('link').first().click()
      const approve = page.getByRole('button', { name: /Lulus/ }).first()
      await expect(approve, 'Luluskan on the review item').toBeVisible()
      await approve.click()
      await page
        .getByRole('button', { name: /^(Ya|Luluskan|Sahkan)/ })
        .last()
        .click()
        .catch(() => undefined)
      approved++
      await page.goto('/admin/spm/semakan')
    }
    saveState(info, { approvedIntake: approved })
    observe(info, `approved ${approved} queue item(s)`)
    await page.goto(`/admin/spm/soalan`)
    await expect(
      page.getByTestId('bank-table'),
      'approved intake questions in Bank Soalan SPM',
    ).toContainText('E2E')
  })

  test("S5a Databank Soalan SPM receives the admin's approved MCQs (count rises)", async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(st.baseline?.databankMath === undefined, 'Blocked: S0 baseline missing')
    const served = st.approvedM04 || st.approvedViaApi || 0
    test.skip(!served, 'Blocked: no Bank Soalan question reached Diluluskan (S2a UI, S2c API)')
    await waitOutBankCache(page, st.servableAt)
    await login(page, PUPIL_T4)
    const now = await cardCount(page, '/spm/tahun-lepas', 'databank-card-MATH', 'databank-count')
    observe(
      info,
      `path: ${st.approvedM04 ? 'approved via UI (S2a)' : 'approved via API (S2c)'}; Databank MATH ${st.baseline!.databankMath} -> ${now}; approved MCQs this run: ${served} (form, DSKP-tagged: ${(st.formQuestion ? 1 : 0) + (st.controlQuestion ? 1 : 0)}; CSV, untagged: ${st.csvQuestions?.length ?? 0})`,
    )
    await expectNoHScroll(page)
    // R1 target (AC-R1-11.2): approving the tagged MCQ raises the count; untagged CSV rows may not count.
    expect(now, 'Databank Matematik count rose after approval').toBeGreaterThan(
      st.baseline!.databankMath ?? 0,
    )
  })

  test("S5b Latih Tubi SPM receives the admin's approved MCQs (count rises)", async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(st.baseline?.latihTubiMath === undefined, 'Blocked: S0 baseline missing')
    const served = st.approvedM04 || st.approvedViaApi || 0
    test.skip(!served, 'Blocked: no Bank Soalan question reached Diluluskan (S2a UI, S2c API)')
    await waitOutBankCache(page, st.servableAt)
    await login(page, PUPIL_T4)
    const now = await cardCount(page, '/spm/latih-tubi', 'latih-tubi-card-MATH', 'latih-tubi-count')
    observe(
      info,
      `path: ${st.approvedM04 ? 'approved via UI (S2a)' : 'approved via API (S2c)'}; Latih Tubi SPM MATH ${st.baseline!.latihTubiMath} -> ${now}; approved MCQs this run: ${served} (form, DSKP-tagged: ${(st.formQuestion ? 1 : 0) + (st.controlQuestion ? 1 : 0)}; CSV, untagged: ${st.csvQuestions?.length ?? 0})`,
    )
    await expectNoHScroll(page)
    expect(now, 'Latih Tubi SPM Matematik count rose after approval').toBeGreaterThan(
      st.baseline!.latihTubiMath ?? 0,
    )
  })

  test("S5c Soalan by Chapter lists the admin question's Bab", async ({ page }, info) => {
    const st = readState(info)
    test.skip(!st.formQuestion?.chapter, 'Blocked: S1a could not choose a Bab (empty Bab list)')
    test.skip(
      !(st.approvedM04 || st.approvedViaApi),
      'Blocked: no Bank Soalan question reached Diluluskan (S2a UI, S2c API)',
    )
    await waitOutBankCache(page, st.servableAt)
    await login(page, PUPIL_T4)
    await expectBabServes(page, info, st, 'approved')
  })

  test('S2d BASE-1 interim: admin publishes the approved questions (bulk Terbitkan)', async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(
      !(st.approvedM04 || st.approvedViaApi),
      'Blocked: no Bank Soalan question reached Diluluskan (S2a UI, S2c API)',
    )
    // NOT the R1 target: D80 makes "approved" servable with no Terbitkan hop (T04, b01-lifecycle,
    // not merged on BASE-1). BASE-1 still serves only "published", so this UI step lets the pupil
    // side and the paper builder be observed with the lifecycle BASE-1 actually has.
    await login(page, ADMIN)
    const res = await bulkOnRun(page, st.tag, 'Terbitkan', info)
    saveState(info, { publishedM04: res.affected, publishedAt: Date.now() })
    await expectNoHScroll(page)
    // The CSV rows carry no DSKP tag; the publish gate refuses them ("Sila pilih unit DSKP"), which
    // matches AC-R1-14.4 / PIPE AC-03.2 (no approval without a tag). The form question has a tag.
    expect(
      res.affected,
      'the DSKP-tagged form question is published (Diterbitkan)',
    ).toBeGreaterThanOrEqual(1)
  })

  test('S5d BASE-1 interim: Databank, Latih Tubi SPM and Bab serve the published admin MCQs', async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(st.baseline?.databankMath === undefined, 'Blocked: S0 baseline missing')
    test.skip(!st.publishedM04, 'Blocked: S2d published no question')
    await waitOutBankCache(page, st.publishedAt)
    await login(page, PUPIL_T4)
    const databank = await cardCount(
      page,
      '/spm/tahun-lepas',
      'databank-card-MATH',
      'databank-count',
    )
    await expectNoHScroll(page)
    const latih = await cardCount(
      page,
      '/spm/latih-tubi',
      'latih-tubi-card-MATH',
      'latih-tubi-count',
    )
    await expectNoHScroll(page)
    observe(
      info,
      `after S2d (${st.publishedM04} published): Databank MATH ${st.baseline!.databankMath} -> ${databank}; Latih Tubi SPM MATH ${st.baseline!.latihTubiMath} -> ${latih}`,
    )
    expect
      .soft(databank, 'Databank Matematik count rose by the published admin MCQs')
      .toBe((st.baseline!.databankMath ?? 0) + (st.publishedM04 ?? 0))
    expect
      .soft(latih, 'Latih Tubi SPM Matematik count rose by the published admin MCQs')
      .toBe((st.baseline!.latihTubiMath ?? 0) + (st.publishedM04 ?? 0))
    if (st.formQuestion?.chapter) await expectBabServes(page, info, st, 'published')
  })

  test('S3a Set Builder: build a paper from the approved questions (group moves as a unit)', async ({
    page,
  }, info) => {
    await login(page, ADMIN)
    // R1-16 / R1-21 P6: Set Builder at /admin/studio/sets(/:paper/builder), V2 flow 4
    // (cloud-student-mechanism §3.4). Owned by T10 (r1/f08-builder-ui), not merged on BASE-1.
    await expectRouteExists(page, '/admin/studio/sets')
    await expectNoHScroll(page)
    observe(info, 'Set Builder route exists')
  })

  /**
   * Pembina Kertas (the BASE-1 builder at /admin/spm/kertas): a new Matematik Kertas 1 paper; adds
   * every picker candidate matching `term` (the admin's questions), fills the rest of the blueprint
   * from the bank and saves. Returns the paper id and how many admin candidates were offered.
   */
  async function buildPaper(
    page: Page,
    info: TestInfo,
    title: string,
    term: string,
    tag: string,
  ): Promise<{ id: string; offered: number }> {
    await login(page, ADMIN)
    await adminMenu(page, 'Pembina Kertas')
    await expect(page).toHaveURL(/\/admin\/spm\/kertas$/)
    await page.getByTestId('paper-new').click()
    await expect(page.getByTestId('paper-new-page')).toBeVisible()
    await expectNoHScroll(page)
    const subject = await page
      .getByTestId('new-subject')
      .locator('option', { hasText: /^Matematik$/ })
      .first()
      .getAttribute('value')
    await page.getByTestId('new-subject').selectOption(subject ?? '')
    // The admin questions are Kertas 1 MCQs (form "Kertas 1", CSV kertas 1).
    await page.getByTestId('new-kertas').selectOption({ label: 'Kertas 1' })
    await page.getByTestId('new-title').fill(title)
    await page.getByRole('button', { name: 'Cipta Kertas' }).click()
    await expect(page.getByTestId('paper-editor-page')).toBeVisible()
    const id = new URL(page.url()).pathname.split('/').pop() ?? ''
    await expectNoHScroll(page)
    await page.getByTestId('add-0').click()
    const search = page.getByRole('textbox', { name: 'Cari soalan' })
    await expect(search, 'question picker').toBeVisible()
    await search.fill(term)
    const picks = page.locator('[data-testid^=pick-add-]')
    await page.waitForTimeout(1000)
    const offered = await picks.count()
    observe(info, `picker candidates for "${term}": ${offered}`)
    for (let i = 0; i < offered; i++) await picks.first().click()
    // Fill the rest of the blueprint from the bank so the paper can be published.
    await search.fill('')
    const issues = page.getByTestId('budget-issues')
    for (let guard = 0; guard < 45; guard++) {
      if ((await issues.count()) === 0) break
      if (!/Kurang/.test(await issues.innerText())) break
      if ((await picks.count()) === 0) break
      await picks.first().click()
    }
    await page.keyboard.press('Escape')
    // A stimulus group moves as one unit, so the last add can overshoot: drop single bank questions
    // (never the admin's) until the count fits.
    for (let guard = 0; guard < 5; guard++) {
      if ((await issues.count()) === 0 || !/Lebih \d+ soalan/.test(await issues.innerText())) break
      const single = page
        .locator('[data-testid^="unit-"]:not([data-testid^="unit-group-"])')
        .filter({ hasNotText: tag })
        .last()
      const unitId = ((await single.getAttribute('data-testid')) ?? '').replace(/^unit-/, '')
      await page.getByTestId(`remove-${unitId}`).click()
    }
    observe(
      info,
      `budget check after placing: ${(await page.getByTestId('budget-check').innerText()).replace(/\s+/g, ' ').slice(0, 300)}`,
    )
    observe(
      info,
      `D90 group units in the paper: ${await page.locator('[data-testid^=unit-group-]').count()} (bank groups; no admin group exists because S1c/S1d are refused)`,
    )
    if (offered > 0) {
      const saved = page.waitForResponse((r) => isApi(r, 'PUT', /\/api\/admin\/papers\/[^/]+$/), {
        timeout: 20_000,
      })
      await page.getByTestId('paper-save').click()
      expect((await saved).status(), 'Simpan draf (PUT paper)').toBeLessThan(300)
      await expect(page.getByText(tag).first(), 'admin question placed in the paper').toBeVisible()
    }
    await expectNoHScroll(page)
    return { id, offered }
  }

  /** Terbitkan on the paper editor; records the server verdict. Returns true when published. */
  async function publishPaper(page: Page, info: TestInfo, id: string): Promise<boolean> {
    await page.goto(`/admin/spm/kertas/${id}`)
    await expect(page.getByTestId('paper-editor-page')).toBeVisible()
    const publish = page.getByTestId('paper-publish')
    await expect(publish, 'Terbitkan shown on a draft paper').toBeEnabled()
    const posted = page
      .waitForResponse(
        (r) =>
          r.request().method() !== 'GET' && /\/api\/admin\/papers\/[^/]+\/publish/.test(r.url()),
        { timeout: 20_000 },
      )
      .catch(() => null)
    await publish.click()
    const res = await posted
    observe(
      info,
      `publish -> ${res ? `HTTP ${res.status()} ${(await res.text().catch(() => '')).slice(0, 240)}` : 'no request seen'}`,
    )
    await expect(
      page.getByTestId('paper-unpublish').or(page.getByTestId('publish-errors')).first(),
    ).toBeVisible({ timeout: 20_000 })
    await expectNoHScroll(page)
    return page.getByTestId('paper-unpublish').isVisible()
  }

  /** The pupil opens the paper from the Bijak SPM hub, presses Mula, answers every MCQ, Hantar. */
  async function sitPaper(page: Page, info: TestInfo, title: string, tag: string): Promise<string> {
    await login(page, PUPIL_T4)
    await page.goto('/spm/bijak')
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    const card = page.locator('[data-testid^=paper-]', { hasText: title }).first()
    await expect(card, 'admin paper on the hub').toBeVisible()
    await expectNoHScroll(page)
    await card.locator('[data-testid^=open-]').click()
    await expect(page.getByTestId('bijak-cover')).toBeVisible()
    await expectNoHScroll(page)
    const started = page
      .waitForResponse((r) => isApi(r, 'POST', /\/api\/bijak\/attempts$/), { timeout: 20_000 })
      .catch(() => null)
    await page.locator('[data-ds=hero-cta]').click()
    const start = await started
    observe(
      info,
      `Mula -> POST /api/bijak/attempts ${start ? `HTTP ${start.status()} ${start.status() >= 400 ? (await start.text().catch(() => '')).slice(0, 160) : ''}` : 'no request seen'}`,
    )
    const failure = page.getByText(/tidak dapat dimulakan/i).first()
    await expect(page.getByTestId('attempt-shell').or(failure).first()).toBeVisible()
    if (await failure.isVisible()) {
      await failure.scrollIntoViewIfNeeded()
      observe(info, `cover shows: "${(await failure.innerText()).trim()}"`)
    }
    await expect(
      page.getByTestId('attempt-shell'),
      'the sitting starts (attempt shell)',
    ).toBeVisible()
    await expect(page.getByTestId('attempt-loading')).toHaveCount(0)
    await expect(page.getByTestId('next').or(page.getByTestId('submit')).first()).toBeVisible()
    const id = /percubaan\/([^/?#]+)/.exec(page.url())?.[1] ?? ''
    await expectNoHScroll(page)
    // Answer every MCQ: "42" where offered (the admin key), else the first option.
    const options = page.locator(
      '[data-testid^=option-]:visible, [data-testid^=mcq-option-]:not([data-testid=mcq-option-image]):visible',
    )
    let answered = 0
    let sawAdmin = false
    for (let guard = 0; guard < 60; guard++) {
      if (
        await page
          .getByText(tag)
          .first()
          .isVisible()
          .catch(() => false)
      )
        sawAdmin = true
      if ((await options.count()) > 0) {
        const right = options.filter({ hasText: /^\s*B?\s*42\s*$/ })
        await ((await right.count()) > 0 ? right.first() : options.first()).click()
        answered++
      }
      if (!(await page.getByTestId('next').isVisible())) break
      await page.getByTestId('next').click()
    }
    observe(info, `answered ${answered} MCQ(s); admin question seen in the sitting: ${sawAdmin}`)
    await expect(page.getByTestId('submit')).toBeVisible()
    await page.getByTestId('submit').click()
    await page.getByTestId('confirm-submit').click()
    await expect(page.getByTestId('win-screen')).toBeVisible()
    observe(
      info,
      `result headline: ${(await page.getByTestId('win-screen').innerText()).split('\n').filter(Boolean).slice(0, 3).join(' / ')}`,
    )
    await expectNoHScroll(page)
    expect(sawAdmin, "the admin's question is part of the sitting").toBe(true)
    return id
  }

  test('S3b Pembina Kertas (BASE-1 builder): the admin MCQs are offered and placed in a Kertas 1 paper', async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(!st.publishedM04, 'Blocked: no admin question is servable on BASE-1 (S2d)')
    const title = `${st.tag} kertas`
    const { id, offered } = await buildPaper(page, info, title, st.tag, st.tag)
    saveState(info, { paper: { id, title, published: false, hasAdminQuestion: offered > 0 } })
    expect(
      offered,
      "the admin's published questions are offered in the paper picker",
    ).toBeGreaterThanOrEqual(1)
  })

  test('S3c Terbit: the paper publishes (review shows no blockers)', async ({ page }, info) => {
    const st = readState(info)
    test.skip(!st.paper?.id, 'Blocked: S3b created no paper')
    test.skip(!st.paper?.hasAdminQuestion, "Blocked: S3b placed none of the admin's questions")
    await login(page, ADMIN)
    const ok = await publishPaper(page, info, st.paper!.id)
    saveState(info, { paper: { ...st.paper!, published: ok } })
    expect(ok, 'published paper offers Tarik balik').toBe(true)
  })

  test('S4a pupil T4 sits the admin paper (form MCQ with image) in Bijak SPM and submits', async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(!st.paper?.published, 'Blocked: no admin-built paper was published (S3c)')
    const id = await sitPaper(page, info, st.paper!.title, st.tag)
    saveState(info, { attempt: { id, submitted: true } })
  })

  test('S3d control paper: only the image-free admin MCQ (S1e), built and published', async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(!st.controlQuestion, 'Blocked: S1e created no control question')
    test.skip(!st.publishedM04, 'Blocked: no admin question is servable on BASE-1 (S2d)')
    const title = `${st.tag} kawalan kertas`
    const term = `${st.tag} kawalan`
    const { id, offered } = await buildPaper(page, info, title, term, term)
    saveState(info, {
      controlPaper: { id, title, published: false, hasAdminQuestion: offered > 0 },
    })
    expect(offered, 'the control question is offered in the picker').toBeGreaterThanOrEqual(1)
    const ok = await publishPaper(page, info, id)
    saveState(info, { controlPaper: { id, title, published: ok, hasAdminQuestion: true } })
    expect(ok, 'control paper published').toBe(true)
  })

  test('S4a2 pupil T4 sits the control paper (image-free admin MCQ) and submits', async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(!st.controlPaper?.published, 'Blocked: the control paper was not published (S3d)')
    const id = await sitPaper(page, info, st.controlPaper!.title, `${st.tag} kawalan`)
    // S4b-S4d use the sitting that worked: the control one when S4a could not start.
    if (!st.attempt?.submitted) saveState(info, { attempt: { id, submitted: true } })
  })

  test('S4b pupil self-marks a written part (Simpan markah)', async ({ page }, info) => {
    const st = readState(info)
    test.skip(!st.attempt?.submitted, 'Blocked: no submitted attempt of an admin paper (S4a, S4a2)')
    await login(page, PUPIL_T4)
    await page.goto(`/spm/bijak/percubaan/${st.attempt!.id}/keputusan`)
    await expect(page.getByTestId('win-screen')).toBeVisible()
    test.skip(
      (await page.getByTestId('provisional').count()) === 0,
      'Blocked: the admin paper has no written (self-markable) part: it holds only MCQs, because the written/D90 intake path (S1c, S1d) is refused on BASE-1. Self-mark itself is covered by B-02.',
    )
    await selfMarkOne(page, info)
    await expectNoHScroll(page)
  })

  test('S4c pupil sees the result (score / max, per Bahagian)', async ({ page }, info) => {
    const st = readState(info)
    test.skip(!st.attempt?.submitted, 'Blocked: no submitted attempt of an admin paper (S4a, S4a2)')
    await login(page, PUPIL_T4)
    await page.goto(`/spm/bijak/percubaan/${st.attempt!.id}/keputusan`)
    await expect(page.getByTestId('win-screen')).toBeVisible()
    await expect(page.getByTestId('section-score').first()).toBeVisible()
    observe(
      info,
      `attempt ${st.attempt!.id}; headline: ${(await page.getByTestId('win-screen').innerText()).split('\n').filter(Boolean).slice(0, 2).join(' / ')}; sections: ${(await page.getByTestId('section-score').allInnerTexts()).join(', ')}; questions listed: ${await page.locator('[data-testid^=result-q-]').count()}`,
    )
    await expectNoHScroll(page)
  })

  test('S4d pupil presses Cuba Lagi: a new blank attempt of the same paper', async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(!st.attempt?.submitted, 'Blocked: no submitted attempt of an admin paper (S4a, S4a2)')
    await login(page, PUPIL_T4)
    await page.goto(`/spm/bijak/percubaan/${st.attempt!.id}/keputusan`)
    await expect(page.getByTestId('retry'), 'Cuba Lagi on the result').toBeVisible()
    await page.getByTestId('retry').click()
    await expect(page).toHaveURL(/\/spm\/bijak\/percubaan\/[^/]+$/)
    expect(page.url(), 'a different attempt id').not.toContain(st.attempt!.id)
    await expect(page.getByTestId('attempt-shell')).toBeVisible()
    observe(info, `old ${st.attempt!.id} -> new ${new URL(page.url()).pathname}`)
    await expectNoHScroll(page)
  })

  test('S4e pupil T5 sees the admin paper on the Bijak SPM hub', async ({ page }, info) => {
    const st = readState(info)
    const paper = st.paper?.published ? st.paper : st.controlPaper
    test.skip(!paper?.published, 'Blocked: no admin-built paper was published (S3c, S3d)')
    await login(page, PUPIL_T5)
    await page.goto('/spm/bijak')
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    await expect(
      page.locator('[data-testid^=paper-]', { hasText: paper!.title }).first(),
    ).toBeVisible()
    await expectNoHScroll(page)
  })

  // ---------------------------------------------------------------- re-tests of the smoke bugs

  test('B-01 Soalan by Chapter shows subjects or an empty-state message', async ({
    page,
  }, info) => {
    await login(page, PUPIL_T4)
    const res = page.waitForResponse((r) => /\/api\/practice\/chapter-subjects/.test(r.url()))
    await page.goto('/practice/chapter')
    const body = await (await res).text()
    observe(info, `GET chapter-subjects: ${body.slice(0, 160)}`)
    await expect(page.getByTestId('chapter-index-page')).toBeVisible()
    await expectNoHScroll(page)
    const tiles = await page.getByTestId('chapter-subject-grid').locator(':scope > *').count()
    const empty = await page.getByText(/tiada|belum ada/i).count()
    observe(info, `subject tiles ${tiles}, empty-state texts ${empty}`)
    expect(tiles > 0 || empty > 0, 'subjects listed, or an empty-state message shown').toBe(true)
  })

  test('B-02 Bijak text answers can be self-marked (stepper with Simpan markah)', async ({
    page,
  }, info) => {
    await login(page, PUPIL_T4)
    await page.goto('/spm/bijak')
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    // Sains K2 (structured, short text): the smoke doc's reproduction paper.
    const card = page.locator('[data-testid^=paper-]', { hasText: 'Sains' }).first()
    await expect(card, 'a Sains Kertas 2 paper on the hub').toBeVisible()
    await card.locator('[data-testid^=open-]').click()
    await expect(page.getByTestId('bijak-cover')).toBeVisible()
    if (await page.getByTestId('resume-choice').isVisible()) {
      await page.getByTestId('restart').click()
      await page.getByTestId('confirm-restart').click()
    } else {
      await page.locator('[data-ds=hero-cta]').click()
    }
    await expect(page.getByTestId('attempt-shell')).toBeVisible()
    await expect(page.getByTestId('attempt-loading')).toHaveCount(0)
    await expect(page.getByTestId('next').or(page.getByTestId('submit')).first()).toBeVisible()
    const first = page.locator('textarea').first()
    if (await first.isVisible()) await first.fill('Klorofil menyerap cahaya')
    while (await page.getByTestId('next').isVisible()) await page.getByTestId('next').click()
    await expect(page.getByTestId('submit')).toBeVisible()
    await page.getByTestId('submit').click()
    await page.getByTestId('confirm-submit').click()
    await expect(page.getByTestId('win-screen')).toBeVisible()
    const attemptId = /percubaan\/([^/?#]+)/.exec(page.url())?.[1] ?? ''
    mkdirSync(STATE_DIR, { recursive: true })
    writeFileSync(join(STATE_DIR, `${RUN}-${info.project.name}-b02.txt`), attemptId)
    const headline = async () =>
      (await page.getByTestId('win-screen').innerText())
        .split('\n')
        .filter(Boolean)
        .slice(0, 3)
        .join(' / ')
    observe(info, `result headline before self-mark: ${await headline()}`)
    await selfMarkOne(page, info)
    await page.reload()
    await expect(page.getByTestId('win-screen')).toBeVisible()
    observe(info, `result headline after self-mark + reload: ${await headline()}`)
    await expectNoHScroll(page)
  })

  test('B-04 Simulasi Kuiz is reachable at /simulasi/kuiz', async ({ page }) => {
    await login(page, PUPIL_T4)
    await expectRouteExists(page, '/simulasi/kuiz')
    await expectNoHScroll(page)
  })

  test('B-05 Bijak "Cuba lagi" on the result starts a fresh sitting', async ({ page }, info) => {
    let attemptId = ''
    try {
      attemptId = readFileSync(
        join(STATE_DIR, `${RUN}-${info.project.name}-b02.txt`),
        'utf8',
      ).trim()
    } catch {
      /* no B-02 attempt */
    }
    test.skip(!attemptId, 'Blocked: B-02 produced no submitted attempt')
    await login(page, PUPIL_T4)
    await page.goto(`/spm/bijak/percubaan/${attemptId}/keputusan`)
    await expect(page.getByTestId('win-screen')).toBeVisible()
    const retry = page.getByTestId('retry')
    await expect(retry, '"Cuba Lagi" on the result').toBeVisible()
    // V2 (cloud-student-mechanism §1.7): "Lihat semakan lepas" links to the last review.
    observe(
      info,
      `"Lihat semakan lepas" links on the result: ${await page.getByText(/Lihat semakan lepas/i).count()}`,
    )
    const started = page
      .waitForResponse(
        (r) => isApi(r, 'POST', /\/api\/bijak\/attempts(\/[^/]+\/retry)?$|cuba-lagi|retry/),
        { timeout: 10_000 },
      )
      .catch(() => null)
    await retry.click()
    const res = await started
    await expect(page, 'Cuba lagi opens a new attempt, not the cover').toHaveURL(
      /\/spm\/bijak\/percubaan\/[^/]+$/,
    )
    observe(
      info,
      `old attempt ${attemptId}; after Cuba lagi: ${new URL(page.url()).pathname} (POST ${res ? res.status() : 'none'})`,
    )
    expect(page.url(), 'a different attempt id').not.toContain(attemptId)
    await expect(page.getByTestId('attempt-shell')).toBeVisible()
    await expectNoHScroll(page)
  })
})
