/**
 * R1 end-to-end acceptance, BASELINE (T23; CLOUD-HANDOFF §7(i); v3-bijak-spm-scope R1-20).
 * Real stack only (VITE_API_MODE=http SPA + API + Postgres). Config: playwright.r1-e2e.config.ts.
 *
 * Journey, one named test per step, at 375 / 768 / 1280 (no horizontal page scroll):
 *   0  pupil baseline counts (Databank, Latih Tubi SPM, Soalan by Chapter)
 *   1  Admin Pusat enters questions: form + image (Bank Soalan), CSV (Import & Semakan),
 *      PDF (Muat Naik Kertas), one D90 group in Studio (one shared stimulus, 2 member questions, T13)
 *   2  approves them (approved = servable, D80/D85); S2c = API-assisted review -> approved when
 *      the UI path is broken (recorded as such, never as a UI pass)
 *   5a-c (R1 target, right after approval) Databank, Latih Tubi SPM and Soalan by Chapter (Bab)
 *      receive the admin's APPROVED question
 *   2d/5d BASE-1 interim: bulk Terbitkan (published is what BASE-1 serves), then the same counts,
 *      so the rest of the pipeline can be observed on the lifecycle BASE-1 has
 *   3  builds a paper (Set Builder target; BASE-1 Pembina Kertas), review, Terbit
 *   4  pupil (T4, T5) sits it in Bijak SPM, self-marks, sees the result, Cuba Lagi
 *   6  pupil T4 Jana Kertas on blueprint 3472/2 (T26 e2e seed: Disahkan + serves_students)
 *   B  re-tests of B-01, B-02, B-04, B-05 (docs/qa/r1-student-smoke-2026-10-31.md)
 *
 * BASELINE: many steps are expected to fail on BASE-1 (Set Builder UI, Studio groups and the
 * lifecycle are not merged). Each step asserts the target behaviour and fails with the observed
 * reason; a step whose input an earlier step did not produce is skipped as "Blocked: ...".
 * Nothing is faked. Fictitious accounts only: the T26 e2e seed (Admin Pusat, T4 pupil) and the poc demo T5 pupil
 * (public demo password of the local stack). Since BASE-25 the API runs with BIJAK_POC_QUESTIONS=false (bank papers only).
 * Report: docs/qa/r1-e2e-baseline-2026-10-31.md.
 *
 * WRITES REAL DATA (questions, intake batches, a paper, attempts) into the target database.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import type { Page, Response, TestInfo } from '@playwright/test'

import { API_PASSWORD, expect, test } from '../fixtures/api'
import { isDesktopShell } from '../support'
import { csrfOf, expectNoHScroll, publishPaperWithOverride } from './helpers'

const RUN = process.env.R1_E2E_RUN || 'r-local'
const SHOTS = process.env.R1_E2E_SHOTS || 'docs/qa/r1-e2e-baseline-2026-10-31'
const STATE_DIR = 'test-results-r1-e2e/state'

// T26 e2e seed accounts (docs/ops/e2e-seed.md, `--profile=e2e`): Admin Pusat and a Tingkatan 4 pupil. The T5 pupil has no
// e2e-seed equivalent, so the poc demo account stays. One password for all: the demo convention (core/demo-password.ts,
// docs/AKAUN-DEMO-LOCAL.md), `E2E_DEMO_PASSWORD` or the fixture default; never a new secret.
const ADMIN = process.env.BIJAK_ADMIN_PUSAT_USER || 'admin.pusat.e2e@example.test'
const PUPIL_T4 = process.env.BIJAK_STUDENT_USER || 'murid.t4.e2e@example.test' // grade 10 = Tingkatan 4
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
  /** S1d (T13 Studio): one D90 group (shared stimulus) and its member question ids, all DSKP-complete. */
  studioGroup?: { id: string; questionIds: string[]; texts: string[] }
  /** S1f (T13 Studio): one standalone DSKP-complete MCQ with a stem picture. */
  studioSingle?: { id: string; text: string }
  approvedM04?: number
  approvedViaApi?: number
  approvedIntake?: number
  /** BASE-1 interim (S2d): run questions moved approved -> published with bulk Terbitkan. */
  publishedM04?: number
  paper?: { id: string; title: string; published: boolean; hasAdminQuestion: boolean }
  controlPaper?: { id: string; title: string; published: boolean; hasAdminQuestion: boolean }
  attempt?: { id: string; submitted: boolean }
  /** S3e (API-assisted): a published Matematik Kertas 2 paper of structured questions; S4b sits it in the UI. */
  writtenPaper?: { id: string; title: string; published: boolean; hasAdminQuestion: boolean }
  /** S4b: the submitted sitting of the written paper (B-05 falls back to it when B-02 cannot start). */
  writtenAttempt?: string
  /** S3e: approved intake questions (one D90 group with a shared passage) placed in the written paper. */
  intakeInPaper?: number
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

/** T34 (AC-R1-16.2) is in the base under test; set R1_E2E_T34=0 for a base that predates it. */
const T34 = process.env.R1_E2E_T34 !== '0'

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

/** The first SP code of a Matematik unit picked in the intake editor (option value `T4:1.0`), read from the DSKP API. */
async function firstSpCode(page: Page, unitKey: string): Promise<string> {
  const [form, code] = unitKey.split(':')
  const list = async <T>(path: string): Promise<T[]> =>
    ((await (await page.request.get(path)).json()) as { data?: T[] }).data ?? []
  const subject = (
    await list<{ id: string | number; name: string }>('/api/subjects?pageSize=100')
  ).find((x) => x.name === 'Matematik')
  const level = (await list<{ id: string | number; name: string }>('/api/education-levels')).find(
    (x) => x.name === (form === 'T5' ? 'Tingkatan 5' : 'Tingkatan 4'),
  )
  const r = await page.request.get(
    `/api/questions/studio/dskp?subjectId=${String(subject?.id)}&educationLevelId=${String(level?.id)}`,
  )
  const dskp = (
    (await r.json()) as { data?: { units: { code: string; sps: { code: string }[] }[] } }
  ).data
  return dskp?.units.find((u) => u.code === code)?.sps[0]?.code ?? '1.1.1'
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
      // The SP field is free text: type a REAL SP code of the chosen unit (BASE-47 reads real units). A made-up code such
      // as "1.1" passes the intake gate but is dropped on conversion (R1E2E-17).
      await sp.fill(await firstSpCode(page, await unit.inputValue()))
      await sp.press('Tab')
    }
    // BASE-61 (REQ-B-027 intake part): "Aras pemikiran" in the intake editor (question level, and per part if any).
    const cog = ed.getByTestId('q-cognitive')
    if ((await cog.count()) > 0 && !(await cog.inputValue())) await cog.selectOption('memahami')
    const partCogs = ed.getByTestId('part-cognitive')
    for (let k = 0; k < (await partCogs.count()); k++)
      if (!(await partCogs.nth(k).inputValue())) await partCogs.nth(k).selectOption('memahami')
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
  if (text) {
    observe(info, `server gate refused: ${text}`)
    // R1E2E-03 (REQ-B-016): the page must show the refusal and drop the "ready" banner.
    const banner = await page
      .getByTestId('issues-toggle')
      .innerText()
      .catch(() => '(no issues-toggle)')
    observe(info, `review page banner after the refusal: "${banner.replace(/\s+/g, ' ').trim()}"`)
  }
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
async function runQuestions(
  page: Page,
  tag: string,
): Promise<{ id: string; status: string; text: string }[]> {
  const res = await page.request.get(`/api/questions?search=${encodeURIComponent(tag)}&pageSize=50`)
  expect(res.status(), 'GET /api/questions (admin list)').toBe(200)
  const body = (await res.json()) as {
    data?: { id: string | number; status: string; questionText?: string }[]
  }
  return (body.data ?? []).map((q) => ({
    id: String(q.id),
    status: q.status,
    text: q.questionText ?? '',
  }))
}

/** The entry path of a run question, from the marker in its stem. */
const pathOf = (text: string): string =>
  /studio-/.test(text)
    ? 'Studio'
    : /borang|kawalan/.test(text)
      ? 'Bank Soalan form'
      : /csv-/.test(text)
        ? 'CSV'
        : / pdf/.test(text)
          ? 'PDF intake'
          : 'other'

/** "Studio 3/3, PDF intake 0/2, ..." approved per entry path. */
function approvedByPath(qs: { status: string; text: string }[]): string {
  const by = new Map<string, [number, number]>()
  for (const q of qs) {
    const k = pathOf(q.text)
    const [a, t] = by.get(k) ?? [0, 0]
    by.set(k, [a + (q.status === 'approved' ? 1 : 0), t + 1])
  }
  return [...by].map(([k, [a, t]]) => `${k} ${a}/${t}`).join(', ')
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

/** True when `el` comes before the first leaf element whose text contains `text` (the stem) in document order. */
const ABOVE = (el: Element, text: string): boolean => {
  const stem = [...document.querySelectorAll('body *')].find(
    (e) => e.children.length === 0 && (e.textContent ?? '').includes(text),
  )
  return !!stem && !!(el.compareDocumentPosition(stem) & Node.DOCUMENT_POSITION_FOLLOWING)
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
      // The Bab options load after the select is enabled (seen empty once at 1280 on BASE-21).
      await expect(opts.first())
        .toBeAttached({ timeout: 10_000 })
        .catch(() => undefined)
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
    // REQ-B-027 (BASE-56): the form has an "Aras pemikiran" select (R1E2E-12 form side).
    const cognitive = page.getByTestId('q-cognitive')
    if ((await cognitive.count()) > 0) {
      await cognitive.selectOption('memahami')
      observe(info, 'Aras pemikiran field present: Memahami chosen')
    } else observe(info, 'Aras pemikiran field absent on the form')
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

  /** Muat Naik Kertas: uploads `pdf`, waits for the server to read it, runs "Ekstrak soalan"; returns the batch id. */
  async function uploadAndExtract(page: Page, info: TestInfo, pdf: Buffer): Promise<string> {
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
    return id
  }

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
    const id = await uploadAndExtract(page, info, pdf)
    // BASE-54: the cards can appear before the extraction links them to the shared passage; the group header then
    // shows only after a reload. Wait for it (reloading) and record how many reloads were needed.
    let reloads = 0
    await expect
      .poll(
        async () => {
          if ((await page.getByTestId('group-header').count()) > 0) return 'grouped'
          reloads++
          await page.reload()
          await page.getByTestId('question-card').first().waitFor({ timeout: 15_000 })
          return 'waiting'
        },
        { message: 'Petikan 1 group header shown', timeout: 45_000, intervals: [3_000] },
      )
      .toBe('grouped')
      .catch(() => undefined)
    observe(info, `group header after extraction: ${reloads} reload(s) needed`)
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

  /**
   * Studio "Cipta soalan" (T13, `/admin/studio/questions/create`): one DSKP-complete Matematik T4 Kertas 1 MCQ (key A) with
   * Bab, unit + first SP, and TP + Aras pemikiran on its leaf (T33). `stimulus` prepares a new shared passage ("Sediakan
   * rangsangan kongsi", created with the question, D93); `joinGroup` joins an existing group by id ("Sertai"). Returns the
   * new question id and its group id as the edit page shows them.
   */
  async function studioMcq(
    page: Page,
    info: TestInfo,
    opts: {
      stem: string
      number: string
      stimulus?: string
      stimulusLabel?: string
      joinGroup?: string
      joinLabel?: string
      image?: boolean
    },
  ): Promise<{ id: string; groupId: string }> {
    await page.goto('/admin/studio/questions/create')
    await expect(
      page.getByTestId('studio-unavailable'),
      'Studio talks to the real API',
    ).toHaveCount(0)
    await expect(page.getByTestId('studio-form')).toBeVisible()
    await expectNoHScroll(page)
    await page.getByTestId('studio-subject').selectOption({ label: 'Matematik' })
    await page.getByTestId('studio-level').selectOption({ label: 'Tingkatan 4' })
    await page.getByTestId('studio-kertas').selectOption('1')
    await page.getByTestId('studio-number').fill(opts.number)
    await page.getByTestId('studio-stem').fill(opts.stem)
    if (opts.image) {
      await page
        .getByTestId('studio-stem-image')
        .locator('input[type=file]')
        .setInputFiles({ name: 'rajah.png', mimeType: 'image/png', buffer: PNG })
      await expect(
        page.getByTestId('studio-stem-image-preview'),
        'stem picture uploaded (files module)',
      ).toBeAttached({ timeout: 20_000 })
    }
    // Langkah 2: the shared stimulus.
    if (opts.stimulus) {
      await page.getByTestId('studio-group-new-kind').selectOption('passage')
      await page.getByTestId('studio-group-new-label').fill(opts.stimulusLabel ?? 'Petikan 1')
      await page.getByTestId('studio-group-new-body').fill(opts.stimulus)
      await page.getByTestId('studio-group-create').click()
      await expect(
        page.getByTestId('studio-group-deferred'),
        'stimulus waits for the save',
      ).toBeVisible()
    }
    if (opts.joinGroup) {
      // BASE-59 (T13c): no join-by-id field any more; search the groups by label and press "Sertai" on ours.
      if (opts.joinLabel) await page.getByTestId('studio-group-group-search').fill(opts.joinLabel)
      const join = page.getByTestId(`studio-group-group-${opts.joinGroup}-join`)
      await expect(join, 'our group is offered in the group search').toBeVisible({
        timeout: 15_000,
      })
      await join.click()
      await expect(page.getByTestId('studio-group-id'), 'joined the group').toContainText(
        `#${opts.joinGroup}`,
      )
    }
    // Langkah 3: leaf (a), MCQ, key A, TP 3, Aras pemikiran Memahami.
    const leaf = 'studio-leaf-0'
    await page.getByTestId(`${leaf}-prompt`).fill('Pilih jawapan yang betul.')
    const texts = ['Mengurangkan sisa', 'Menambah sisa', 'Membakar sampah', 'Membuang ke sungai']
    for (const [i, l] of ['A', 'B', 'C', 'D'].entries())
      await page.getByTestId(`${leaf}-text-${l}`).fill(texts[i] ?? l)
    await page.getByTestId(`${leaf}-correct`).selectOption('A')
    await page.getByTestId(`${leaf}-tp`).selectOption('3')
    await page.getByTestId(`${leaf}-cognitive`).selectOption('memahami')
    // Langkah 4: Bab (first), unit (first) and its first SP.
    const chapter = page.getByTestId('q-chapter')
    const bab = chapter.locator('option:not([value=""])').first()
    await expect(bab, 'Bab options for Matematik T4').toBeAttached({ timeout: 10_000 })
    await chapter.selectOption((await bab.getAttribute('value')) ?? '')
    const unit = page.getByTestId('studio-unit')
    const firstUnit = unit.locator('option:not([value=""])').first()
    await expect(firstUnit, 'DSKP units for Matematik T4 (Studio DSKP list)').toBeAttached({
      timeout: 10_000,
    })
    await unit.selectOption((await firstUnit.getAttribute('value')) ?? '')
    await page.getByTestId('studio-sp').getByRole('checkbox').first().click()
    observe(
      info,
      `Q${opts.number}: Bab "${(await bab.innerText()).trim()}", unit "${(await firstUnit.innerText()).trim().slice(0, 50)}", ${await page.getByTestId('studio-sp').getByRole('checkbox').count()} SP offered; save bar: ${(await page.getByTestId('studio-save-bar').innerText()).replace(/\s+/g, ' ').slice(0, 120)}`,
    )
    await expectNoHScroll(page)
    const saved = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        /\/api\/(questions|stimulus-groups\/[^/]+\/questions)$/.test(new URL(r.url()).pathname),
      { timeout: 30_000 },
    )
    await page.getByTestId('studio-save-bar').getByRole('button', { name: 'Simpan draf' }).click()
    const res = await saved
    observe(
      info,
      `Q${opts.number} save -> POST ${new URL(res.url()).pathname} HTTP ${res.status()}${res.ok() ? '' : ` ${(await res.text().catch(() => '')).slice(0, 240)}`}`,
    )
    await expect(page, 'saved question opens in Sunting').toHaveURL(
      /\/admin\/studio\/questions\/\d+\/sunting$/,
      {
        timeout: 20_000,
      },
    )
    const id = /questions\/(\d+)\/sunting/.exec(page.url())?.[1] ?? ''
    const groupText = await page
      .getByTestId('studio-group-id')
      .innerText({ timeout: 15_000 })
      .catch(() => '')
    const groupId = /#(\d+)/.exec(groupText)?.[1] ?? ''
    await expectNoHScroll(page)
    return { id, groupId }
  }

  test('S1h R1E2E-17 / R1E2E-03 probe: an unknown SP code in the intake editor; is it refused, and is the refusal shown?', async ({
    page,
  }, info) => {
    const st = readState(info)
    // One MCQ only; the stem carries "probe" (not "pdf"), so S2b never accepts it.
    const pdf = pdfOf([
      `Kertas probe ${st.tag}`,
      `1. Berapakah 2 tambah 2? ${st.tag} probe`,
      'A. 4',
      'B. 5',
      'C. 6',
      'D. 7',
      'Jawapan: 1-A',
    ])
    await login(page, ADMIN)
    await uploadAndExtract(page, info, pdf)
    await completeIntakeQuestions(page, st.tag)
    // Replace the real SP with a code that is not in the unit ("1.1"; the unit's codes are 1.1.1, 1.1.2, ...).
    const cards = page.getByTestId('question-card')
    for (let i = 0; i < (await cards.count()); i++) {
      const sp = cards.nth(i).getByTestId('q-sp')
      await sp.fill('1.1')
      await sp.press('Tab')
    }
    await expectNoHScroll(page)
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
    const issues = (body.data?.issues ?? []).map((i) => `${i.where}: ${i.message}`)
    await page.waitForTimeout(1000)
    const banner = (
      await page
        .getByTestId('issues-toggle')
        .innerText()
        .catch(() => '(none)')
    )
      .replace(/\s+/g, ' ')
      .trim()
    const submitted = await page
      .getByTestId('submitted-note')
      .isVisible()
      .catch(() => false)
    observe(
      info,
      `server gate on SP "1.1": ${issues.join('; ') || 'no issue (accepted)'}; banner "${banner}"; "Dihantar untuk semakan" shown: ${submitted}`,
    )
    await expectNoHScroll(page)
    // R1E2E-17 target: the unknown SP is refused. R1E2E-03 target: then the page shows the refusal, not the ready text.
    expect(
      issues.length,
      'R1E2E-17: an SP not in the unit is refused by the server gate',
    ).toBeGreaterThan(0)
    expect(banner, 'R1E2E-03: the page shows the server refusal').toMatch(/Pelayan menolak/)
    expect(banner, 'R1E2E-03: no "ready" banner after a refusal').not.toMatch(/Sedia dihantar/)
  })

  test('S1d admin D90 group in Studio: one shared stimulus with 2 member questions', async ({
    page,
  }, info) => {
    const st = readState(info)
    await login(page, ADMIN)
    // The Studio list (F03a, T13b) and its menu entry are not merged: the editor is reached by URL.
    await page.goto('/admin/studio')
    const list = (await page.getByTestId('app-placeholder').count()) === 0
    observe(
      info,
      list
        ? '/admin/studio list exists'
        : '/admin/studio list renders "Halaman Tidak Dijumpai" (T13b not merged); editor reached by URL',
    )
    const q1 = `${st.tag} studio-1: Apakah kesan utama kitar semula?`
    const q2 = `${st.tag} studio-2: Mengapakah sisa perlu diasingkan?`
    const a = await studioMcq(page, info, {
      stem: q1,
      number: '1',
      stimulus: `Petikan bersama ${st.tag}: Kitar semula mengurangkan sisa di tapak pelupusan.`,
      stimulusLabel: `Petikan ${st.tag}`,
    })
    expect(a.groupId, 'Q1 saved inside a new shared-stimulus group').not.toBe('')
    const b = await studioMcq(page, info, {
      stem: q2,
      number: '2',
      joinGroup: a.groupId,
      joinLabel: `Petikan ${st.tag}`,
    })
    expect(b.groupId, 'Q2 joined the same group').toBe(a.groupId)
    saveState(info, { studioGroup: { id: a.groupId, questionIds: [a.id, b.id], texts: [q1, q2] } })
    // The group page: one stimulus, both members, no "fewer than 2" warning (D93).
    await page.goto(`/admin/studio/groups/${a.groupId}`)
    await expect(page.getByTestId('studio-group-page')).toBeVisible()
    const members = page.getByTestId('studio-group-members').locator(':scope > li')
    await expect(members, 'two member questions under the one stimulus').toHaveCount(2)
    await expect(page.getByTestId('studio-group-warning')).toHaveCount(0)
    observe(
      info,
      `group #${a.groupId}: questions ${a.id}, ${b.id}; stimuli ${await page.locator('[data-testid^=studio-group-stimulus-]').count()}; members: ${(await members.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').slice(0, 60)).join(' | ')}`,
    )
    await expectNoHScroll(page)
  })

  test('S1i Studio list (T13b): /admin/studio lists the S1d group questions and opens them', async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(!st.studioGroup, 'Blocked: S1d created no group')
    await login(page, ADMIN)
    // Menu: is there an entry to the Studio list?
    if (!isDesktopShell(page)) await page.getByTestId('pentadbiran-menu-button').click()
    const nav = page.locator('[data-testid=pentadbiran-nav]:visible')
    const menuLinks = await nav.locator('a[href="/admin/studio"]').count()
    observe(
      info,
      `menu links to /admin/studio: ${menuLinks} (Bank Soalan group: ${(
        await nav.getByRole('link').allInnerTexts()
      )
        .filter((t) => /Bank Soalan|Import|Kualiti|Laporan|PKSK|Audio|Studio|Sumber/.test(t))
        .map((t) => t.trim())
        .join(', ')})`,
    )
    if (!isDesktopShell(page)) await page.keyboard.press('Escape')
    await page.goto(
      `/admin/studio?search=${encodeURIComponent(st.studioGroup!.texts[0]!.slice(0, 40))}`,
    )
    await expect(page.getByTestId('studio-list-page'), 'Studio list page').toBeVisible()
    await expect(page.getByTestId('app-placeholder')).toHaveCount(0)
    const rows = page
      .getByTestId('studio-table')
      .locator('tbody tr, [data-ds=data-table-cards] > li')
    await expect(
      rows.filter({ hasText: 'studio-1' }).first(),
      'the S1d question is listed',
    ).toBeVisible()
    observe(
      info,
      `list rows for the search: ${await rows.count()}; first: ${(await rows.first().innerText()).replace(/\s+/g, ' ').slice(0, 140)}`,
    )
    await expectNoHScroll(page)
    // Open it from the list ("Edit"), then its group from the editor.
    const row = rows.filter({ hasText: 'studio-1' }).first()
    const edit = row.getByTestId('studio-row-edit')
    if ((await edit.count()) > 0 && (await edit.first().isVisible())) await edit.first().click()
    else {
      await row.getByTestId('studio-row-more').first().click()
      await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
    }
    await expect(page, 'Edit opens the Studio editor').toHaveURL(
      /\/admin\/studio\/questions\/\d+\/sunting$/,
    )
    await expect(page.getByTestId('studio-group-id'), 'the editor shows the group').toContainText(
      `#${st.studioGroup!.id}`,
    )
    await expectNoHScroll(page)
    await page.goto(`/admin/studio/groups/${st.studioGroup!.id}`)
    await expect(page.getByTestId('studio-group-members').locator(':scope > li')).toHaveCount(2)
    await expectNoHScroll(page)
  })

  test('S1j R1E2E-21: Pentadbiran menu > Bank Soalan has a Studio entry that opens /admin/studio', async ({
    page,
  }, info) => {
    await login(page, ADMIN)
    if (!isDesktopShell(page)) await page.getByTestId('pentadbiran-menu-button').click()
    const nav = page.locator('[data-testid=pentadbiran-nav]:visible')
    const link = nav.locator('a[href="/admin/studio"]').first()
    observe(
      info,
      `menu links to /admin/studio: ${await nav.locator('a[href="/admin/studio"]').count()}; label: "${(await link.innerText().catch(() => '')).trim()}"`,
    )
    await expect(link, 'a menu entry to /admin/studio').toBeVisible()
    await expectNoHScroll(page)
    await link.click()
    await expect(page).toHaveURL(/\/admin\/studio$/)
    await expect(page.getByTestId('studio-list-page')).toBeVisible()
    await expectNoHScroll(page)
  })

  test('S1f admin Studio standalone MCQ with a stem picture (no group)', async ({ page }, info) => {
    const st = readState(info)
    await login(page, ADMIN)
    const text = `${st.tag} studio-3: Berapakah hasil tambah 12 dan 30?`
    const q = await studioMcq(page, info, { stem: text, number: '3', image: true })
    expect(q.id, 'saved').not.toBe('')
    expect(q.groupId, 'a standalone question has no group').toBe('')
    saveState(info, { studioSingle: { id: q.id, text } })
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

  test('S2b admin accepts the intake questions in Baris Gilir Semakan (Terima)', async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(!st.pdfBatch?.submitted, 'Blocked: S1c sent no batch for review')
    await login(page, ADMIN)
    await adminMenu(page, 'Baris Gilir Semakan')
    await expect(page.getByTestId('review-queue-page')).toBeVisible()
    await expectNoHScroll(page)
    const runRows = () =>
      page
        .getByTestId('queue-table')
        .locator('tbody tr, [data-ds=data-table-cards] > li')
        .filter({ hasText: `${st.tag} pdf` })
    await expect(runRows().first(), "the run's intake items are queued").toBeVisible()
    observe(info, `queue rows of this run: ${await runRows().count()}`)
    // http mode: the review decision is "Terima (Draf)" (WIRE): the item becomes a draft question in the bank, whose
    // approval is the Bank Soalan lifecycle (S2a, which runs after this step).
    let accepted = 0
    for (let guard = 0; guard < 10; guard++) {
      // The queue reloads after each decision: count the rows only once the list has settled.
      await page.waitForLoadState('networkidle').catch(() => undefined)
      await runRows()
        .first()
        .waitFor({ state: 'visible', timeout: 5_000 })
        .catch(() => undefined)
      if ((await runRows().count()) === 0) break
      const row = runRows().first()
      observe(info, `item: ${(await row.innerText()).replace(/\s+/g, ' ').slice(0, 140)}`)
      // Table rows carry a "Semak" link; below the table breakpoint the card's title is a button that opens the item
      // (BASE-54: a tap on the card body no longer opens it).
      const link = row.locator('[data-testid^=queue-open-]')
      if ((await link.count()) > 0) await link.first().click()
      else await row.locator('button').first().click()
      await expect(page.getByTestId('review-item-page')).toBeVisible()
      await expectNoHScroll(page)
      const gate = page.getByTestId('review-gate')
      if (await gate.isVisible().catch(() => false))
        observe(info, `item gate: ${(await gate.innerText()).replace(/\s+/g, ' ').slice(0, 240)}`)
      const accept = page.getByTestId('action-publish')
      await expect(accept, '"Terima (Draf)" on the review item').toBeVisible()
      observe(
        info,
        `decision button: "${(await accept.innerText()).trim()}", enabled ${await accept.isEnabled()}`,
      )
      await expect(accept, 'the item passes its gate').toBeEnabled()
      const res = page
        .waitForResponse(
          (r) => r.request().method() !== 'GET' && /\/api\/.*(review|semakan|intake)/.test(r.url()),
          {
            timeout: 20_000,
          },
        )
        .catch(() => null)
      await accept.click()
      const r = await res
      observe(
        info,
        `accept -> ${r ? `${r.request().method()} ${new URL(r.url()).pathname} HTTP ${r.status()} ${r.ok() ? '' : (await r.text().catch(() => '')).slice(0, 200)}` : 'no request seen'}`,
      )
      await expect(
        page.getByTestId('review-queue-page'),
        'back on the queue after the decision',
      ).toBeVisible({
        timeout: 20_000,
      })
      accepted++
    }
    saveState(info, { approvedIntake: accepted })
    const qs = await runQuestions(page, `${st.tag} pdf`)
    observe(
      info,
      `accepted ${accepted} item(s); bank questions from the PDF now: ${qs.map((q) => `#${q.id} ${q.status}`).join(', ') || 'none'}`,
    )
    expect(qs.length, 'the PDF questions are in the bank').toBeGreaterThanOrEqual(2)
  })

  test('S2h R1E2E-20: an intake-born question opens and saves in Studio "Sunting"', async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(!st.approvedIntake, 'Blocked: S2b accepted no intake item')
    await login(page, ADMIN)
    const q = (await runQuestions(page, `${st.tag} pdf`))[0]
    test.skip(!q, 'Blocked: no intake question in the bank')
    await page.goto(`/admin/studio/questions/${q!.id}/sunting`)
    await expect(
      page.getByTestId('studio-form').or(page.getByTestId('studio-load-error')).first(),
    ).toBeVisible()
    const unsupported = page.getByTestId('studio-unsupported')
    const blocked = await unsupported.isVisible().catch(() => false)
    observe(
      info,
      `#${q!.id} in Studio: ${blocked ? `refused: ${(await unsupported.innerText()).replace(/\s+/g, ' ').slice(0, 200)}` : 'editable'}`,
    )
    await expectNoHScroll(page)
    expect(blocked, 'Studio opens the intake question for editing').toBe(false)
    // A real edit: Aras pemikiran of leaf (a) to Mengaplikasi, then "Simpan draf".
    await page.getByTestId('studio-leaf-0-cognitive').selectOption('mengaplikasi')
    const put = page.waitForResponse((r) => isApi(r, 'PUT', /\/api\/questions\/\d+$/), {
      timeout: 20_000,
    })
    await page.getByTestId('studio-save-bar').getByRole('button', { name: 'Simpan draf' }).click()
    const r = await put
    observe(
      info,
      `Studio save -> PUT HTTP ${r.status()}${r.ok() ? '' : ` ${(await r.text()).slice(0, 200)}`}`,
    )
    expect(r.status(), 'Studio saves the intake question').toBe(200)
  })

  test('S2g R1E2E-12 workaround in the UI: set Aras pemikiran on the intake questions (Studio "Sunting", else the Bank Soalan edit form)', async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(!st.approvedIntake, 'Blocked: S2b accepted no intake item')
    // Neither the intake editor nor the Bank Soalan form has an Aras pemikiran field (R1E2E-12), and the approve gate
    // needs one per leaf (T33). The Studio editor has it: this is an admin UI path, recorded as a workaround.
    await login(page, ADMIN)
    const qs = await runQuestions(page, `${st.tag} pdf`)
    // Not needed when the intake editor already gave every part an Aras pemikiran (R1E2E-12 intake side fixed).
    let missing = 0
    for (const q of qs) {
      const d = (
        (await (await page.request.get(`/api/questions/${q.id}`)).json()) as {
          data?: { parts?: { cognitiveLevel?: string | null }[] }
        }
      ).data
      if ((d?.parts ?? []).some((pt) => !pt.cognitiveLevel)) missing++
    }
    observe(
      info,
      `intake questions without Aras pemikiran after Terima: ${missing} of ${qs.length}`,
    )
    test.skip(
      qs.length > 0 && missing === 0,
      'Not needed: the intake editor set Aras pemikiran on every intake question (R1E2E-12 intake side)',
    )
    let saved = 0
    for (const q of qs) {
      await page.goto(`/admin/studio/questions/${q.id}/sunting`)
      await expect(
        page.getByTestId('studio-form').or(page.getByTestId('studio-load-error')).first(),
      ).toBeVisible()
      const unsupported = page.getByTestId('studio-unsupported')
      if (await unsupported.isVisible().catch(() => false)) {
        observe(
          info,
          `#${q.id}: Studio cannot edit it: ${(await unsupported.innerText()).replace(/\s+/g, ' ').slice(0, 200)}`,
        )
        // BASE-56 (REQ-B-027) put "Aras pemikiran" on the Bank Soalan form: try its edit page instead.
        await page.goto(`/admin/questions/${q.id}/edit`)
        const cog = page.getByTestId('q-cognitive')
        if (
          !(await cog.waitFor({ state: 'visible', timeout: 15_000 }).then(
            () => true,
            () => false,
          ))
        ) {
          observe(info, `#${q.id}: no Aras pemikiran on the Bank Soalan edit form either`)
          continue
        }
        await expectNoHScroll(page)
        await cog.selectOption('memahami')
        const put = page.waitForResponse((r) => isApi(r, 'PUT', /\/api\/questions\/\d+$/), {
          timeout: 20_000,
        })
        await page.getByRole('button', { name: 'Kemaskini Soalan' }).click()
        const r = await put
        observe(
          info,
          `#${q.id}: Bank Soalan edit form save -> PUT HTTP ${r.status()}${r.ok() ? '' : ` ${(await r.text()).slice(0, 200)}`}`,
        )
        if (r.ok()) saved++
        continue
      }
      await expectNoHScroll(page)
      const leaf = 'studio-leaf-0'
      await page.getByTestId(`${leaf}-cognitive`).selectOption('memahami')
      if (!(await page.getByTestId(`${leaf}-tp`).inputValue()))
        await page.getByTestId(`${leaf}-tp`).selectOption('3')
      const put = page.waitForResponse((r) => isApi(r, 'PUT', /\/api\/questions\/\d+$/), {
        timeout: 20_000,
      })
      await page.getByTestId('studio-save-bar').getByRole('button', { name: 'Simpan draf' }).click()
      const r = await put
      observe(
        info,
        `#${q.id}: Studio save -> PUT HTTP ${r.status()}${r.ok() ? '' : ` ${(await r.text()).slice(0, 200)}`}`,
      )
      if (r.ok()) saved++
    }
    observe(
      info,
      `Aras pemikiran set on ${saved} of ${qs.length} intake question(s); statuses: ${(await runQuestions(page, `${st.tag} pdf`)).map((q) => `#${q.id} ${q.status}`).join(', ')}`,
    )
    expect(saved, 'every intake question saved with Aras pemikiran').toBe(qs.length)
  })

  test('S2a admin approves the Bank Soalan questions (Hantar untuk Semakan, bulk Terbitkan)', async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(
      !st.formQuestion && !st.csvQuestions && !st.studioGroup && !st.studioSingle,
      'Blocked: S1a/S1b/S1d/S1f created no question',
    )
    await login(page, ADMIN)
    // V3 lifecycle: Draf -> "Hantar untuk Semakan" (question detail) -> "Luluskan" (bulk bar).
    const ids = (await runQuestions(page, st.tag)).map((q) => q.id)
    const n = ids.length
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
    // ADR-0027: in http mode the approve bulk action is labelled "Terbitkan" (wire action `approved`); "Luluskan" is the
    // mock-mode label only (lib/question-list.ts HTTP_HIDDEN_BULK_ACTIONS).
    const res = await bulkOnRun(page, st.tag, 'Terbitkan', info)
    saveState(info, {
      approvedM04: res.affected,
      ...(res.affected ? { servableAt: Date.now() } : {}),
    })
    observe(
      info,
      `approved through the UI, per entry path: ${approvedByPath(await runQuestions(page, st.tag))}`,
    )
    await expectNoHScroll(page)
    expect(sent, '"Hantar untuk Semakan" succeeded on every question').toBe(ids.length)
    // The untagged CSV rows are refused by design (no DSKP unit/SP, AC-R1-14.4); every other run question must approve.
    expect(
      res.affected,
      'every DSKP-tagged run question approved through the UI (CSV rows excluded)',
    ).toBe(n - (st.csvQuestions?.length ?? 0))
  })

  test('S2c API-assisted lifecycle (UI path blocked): review -> approved, so the pupil side can be observed', async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(
      !st.formQuestion && !st.csvQuestions && !st.studioGroup && !st.studioSingle,
      'Blocked: S1a/S1b/S1d/S1f created no question',
    )
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
      const body = (await res.json().catch(() => ({}))) as {
        data?: { affected?: number; failed?: { id?: string | number; message: string }[] }
      }
      const refused = [...new Set((body.data?.failed ?? []).map((f) => f.message))]
      out.push(
        `${action}: HTTP ${res.status()} affected ${body.data?.affected ?? '?'}${refused.length ? ` refused: ${refused.join(' / ')}` : ''}`,
      )
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
    // Since T04 (BASE-4) the approve gate refuses a question without a DSKP unit + SP (AC-R1-14.4 /
    // PIPE AC-03.2), so the untagged CSV rows stay in review; the DSKP-tagged form MCQs and the
    // Studio group members (unit, SP, TP and Aras pemikiran per leaf, T33) are expected to approve.
    observe(info, `approved per entry path: ${approvedByPath(await runQuestions(page, st.tag))}`)
    const tagged = ids.length - (st.csvQuestions?.length ?? 0)
    expect(approved, 'every DSKP-tagged run question approved through the API').toBe(tagged)
  })

  test('S2e R1E2E-10 re-test: bulk "Terbitkan" on an already approved question', async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(!st.studioSingle, 'Blocked: S1f created no question')
    await login(page, ADMIN)
    const status = (await runQuestions(page, st.studioSingle!.text)).map((q) => q.status)
    test.skip(!status.includes('approved'), 'Blocked: the S1f question is not approved (S2c)')
    await page.goto(`/admin/questions?search=${encodeURIComponent(st.studioSingle!.text)}`)
    await expect(listRows(page, st.studioSingle!.text).first()).toBeVisible()
    await listRows(page, st.studioSingle!.text)
      .first()
      .getByRole('checkbox')
      .first()
      .check({ force: true })
    await expect(page.getByTestId('questions-bulk-bar')).toBeVisible()
    const offered = await page
      .getByTestId('questions-bulk-action')
      .locator('option')
      .allInnerTexts()
    observe(
      info,
      `bulk actions offered for an approved row: ${offered
        .map((t) => t.trim())
        .filter(Boolean)
        .join(', ')}`,
    )
    await expectNoHScroll(page)
    if (!offered.some((t) => t.trim() === 'Terbitkan')) return
    const res = await bulkOnRun(page, st.studioSingle!.text, 'Terbitkan', info)
    expect(
      // BASE-21 wording "daripada Diterbitkan kepada Diterbitkan"; BASE-37 "Peralihan 'Diterbitkan' -> 'Diterbitkan'".
      res.failed.filter((m) => /Diterbitkan'?\s*(kepada|->)\s*'?Diterbitkan/.test(m)),
      'no self-contradicting "Diterbitkan kepada Diterbitkan" refusal',
    ).toEqual([])
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

  test('S5e Latih Tubi SPM in the UI (REQ-A-005): setup, Mula Kuiz, answer, result, back to the list', async ({
    page,
  }, info) => {
    // Matematik offers one "Bilangan Soalan" only (40, "Target SPM"); 3 x 40 exceeds one pupil's free trial (50 soalan).
    // So each viewport uses its own Tingkatan 4 demo pupil (poc seed, fictitious; the e2e seed has one T4 pupil only).
    const ltPupil =
      (
        {
          mobile: 'murid4@demo.test',
          tablet: 'murid5@demo.test',
          desktop: 'murid6@demo.test',
        } as Record<string, string>
      )[info.project.name] ?? PUPIL_T4
    observe(info, `pupil: ${ltPupil}`)
    await login(page, ltPupil)
    await page.goto('/spm/latih-tubi')
    await expect(page.getByTestId('spm-latih-tubi-page')).toBeVisible()
    await page.getByTestId('latih-tubi-card-MATH').click()
    await expect(page.getByTestId('spm-config-page'), 'the setup page').toBeVisible()
    await expect(page.getByTestId('config-start')).toBeVisible({ timeout: 15_000 })
    // The smallest "Bilangan Soalan" offered (keeps the run short and inside the pupil's free-trial allowance,
    // "Percubaan Percuma: 50 soalan", which 3 viewports x 40 questions exhaust).
    await page
      .locator('[data-testid^=count-]')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => undefined)
    const countIds = await page
      .locator('[data-testid^=count-]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? ''))
    const smallest = countIds
      .map((id) => Number(id.replace('count-', '')))
      .filter((n) => n > 0)
      .sort((x, y) => x - y)[0]
    if (smallest) await page.getByTestId(`count-${smallest}`).click()
    observe(
      info,
      `setup: ${(await page.getByTestId('config-title').innerText()).trim()}; ${(await page.getByTestId('config-summary').innerText()).replace(/\s+/g, ' ')}`,
    )
    await expectNoHScroll(page)
    await page.getByTestId('config-start').click()
    await expect(page, 'the quiz route').toHaveURL(/\/spm\/latih-tubi\/[^/]+\/quiz/)
    await expect(page.getByTestId('quiz-runner')).toBeVisible()
    await expect(page.getByTestId('quiz-loading')).toHaveCount(0, { timeout: 20_000 })
    await expectNoHScroll(page)
    let answered = 0
    for (let guard = 0; guard < 45; guard++) {
      if (
        await page
          .getByTestId('quiz-results')
          .isVisible()
          .catch(() => false)
      )
        break
      const q = page.getByTestId('question-text')
      const before = await q.innerText().catch(() => '')
      await page.locator('[data-testid^=option-]:visible').first().click()
      await page.getByTestId('btn-check').click()
      await page.getByTestId('btn-next').click()
      answered++
      await expect
        .poll(
          async () =>
            (await page
              .getByTestId('quiz-results')
              .isVisible()
              .catch(() => false)) || (await q.innerText().catch(() => before)) !== before,
          { timeout: 15_000 },
        )
        .toBe(true)
    }
    await expect(page.getByTestId('quiz-results'), 'the result').toBeVisible({ timeout: 20_000 })
    observe(
      info,
      `answered ${answered}; result ${(await page.getByTestId('result-score').innerText()).replace(/\s+/g, ' ')} (${(
        await page
          .getByTestId('result-percent')
          .innerText()
          .catch(() => '')
      ).trim()})`,
    )
    await expectNoHScroll(page)
    await page.getByTestId('result-back').click()
    await expect(page, 'the result returns to the Latih Tubi SPM list').toHaveURL(
      /\/spm\/latih-tubi$/,
    )
    await expect(page.getByTestId('spm-latih-tubi-page')).toBeVisible()
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
    test.skip(
      true,
      'Not applicable since BASE-4 (T04, ADR-0027): approved = "Diterbitkan" is the served status, no Terbitkan hop',
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
    test.skip(
      !st.publishedM04,
      'Not applicable since BASE-4: S5a-S5c cover the served (approved) questions',
    )
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
    await page.waitForTimeout(1000)
    observe(info, `bank candidates left in the picker (empty search): ${await picks.count()}`)
    const issues = page.getByTestId('budget-issues')
    // REQ-B-042: the picker pages its candidates ("Muat lagi", `picker-more`). When the visible page has no addable row,
    // press it (while present) and wait for the list to grow; stop when the quota is met or there are no more pages.
    const more = page.getByTestId('picker-more')
    for (let guard = 0; guard < 120; guard++) {
      if ((await issues.count()) === 0) break
      if (!/Kurang/.test(await issues.innerText())) break
      if ((await picks.count()) === 0) {
        if (!(await more.isVisible().catch(() => false))) break
        await more.click()
        await expect
          .poll(
            async () =>
              (await picks.count()) > 0 || !(await more.isVisible().catch(() => false)),
            { timeout: 15_000 },
          )
          .toBe(true)
        continue
      }
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
      `D90 group units in the paper: ${await page.locator('[data-testid^=unit-group-]').count()}, of which the run's own: ${await page.locator('[data-testid^=unit-group-]').filter({ hasText: tag }).count()}`,
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

  /**
   * Terbitkan on the paper editor; records the server verdict. Returns true when published.
   * T34 (AC-R1-16.2 / R1E2E-07): Matematik K1 blueprint 1449/1 is Spec, not Disahkan, so the first Terbitkan is refused with
   * a BLUEPRINT_NOT_VERIFIED blocker (`canOverride: true`). The documented audited-override path then publishes it.
   * `R1_E2E_T34=0` runs against a base without T34 (the first press publishes); `requireRefusal` asserts the refusal.
   */
  async function publishPaper(
    page: Page,
    info: TestInfo,
    id: string,
    opts: { requireRefusal?: boolean } = {},
  ): Promise<boolean> {
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
    const text = res ? await res.text().catch(() => '') : ''
    observe(
      info,
      `publish -> ${res ? `HTTP ${res.status()} ${text.slice(0, 240)}` : 'no request seen'}`,
    )
    await expect(
      page.getByTestId('paper-unpublish').or(page.getByTestId('publish-errors')).first(),
    ).toBeVisible({ timeout: 20_000 })
    await expectNoHScroll(page)
    if (await page.getByTestId('paper-unpublish').isVisible()) {
      expect(
        opts.requireRefusal && T34,
        'T34: the first Terbitkan of a Spec (not Disahkan) blueprint must be refused',
      ).toBeFalsy()
      return true
    }
    // Refused: the blocker line, and (when the payload is reachable) the machine-readable detail.
    if (T34 && /1449\/1/.test(await page.getByTestId('paper-editor-page').innerText())) {
      // DIAGNOSTIC ONLY (default off): R1_E2E_DIAG_SKIP_REASON_TEXT=1 skips this assertion so the downstream steps can be observed
      // while the refusal reason is not shown in the UI (BASE-102 finding R1E2E-C5). The graded run never sets it.
      if (process.env.R1_E2E_DIAG_SKIP_REASON_TEXT === '1') {
        observe(info, 'DIAG: refusal reason text assertion skipped (R1E2E-C5)')
        await expect(page.getByTestId('publish-errors')).toBeVisible()
      } else {
        await expect(page.getByTestId('publish-errors'), 'Kontrak ... belum Disahkan').toContainText('belum Disahkan')
      }
      // Wire shape (apps/api builder/blockers.ts `blockerView`): `data.blockerDetails[] = {code, message, overridable}` and a
      // top-level `data.canOverride`. (Harness fix, BASE-102: the spec read `canOverride` on each detail, which never carries it.)
      type Detail = { code?: string; overridable?: boolean }
      type Body = { blockerDetails?: Detail[]; canOverride?: boolean }
      const parsed = (() => {
        try {
          const j = JSON.parse(text) as { data?: Body } & Body
          return (j.data ?? j) as Body
        } catch {
          return {} as Body
        }
      })()
      const details = parsed.blockerDetails
      if (details) {
        const d = details.find((x) => x.code === 'BLUEPRINT_NOT_VERIFIED')
        expect(d, 'blockerDetails has BLUEPRINT_NOT_VERIFIED').toBeTruthy()
        expect(d?.overridable, 'BLUEPRINT_NOT_VERIFIED overridable').toBe(true)
        expect(parsed.canOverride, 'publish refusal canOverride').toBe(true)
      } else {
        observe(info, 'blockerDetails not in the publish response body (not asserted)')
      }
      // TODO(T10): switch to the UI tick "Terbitkan walaupun tidak memenuhi kontrak blueprint" when T10 lands.
      const ov = await publishPaperWithOverride(page, id)
      observe(info, `publish override (API-assisted) -> HTTP ${ov.status} ${JSON.stringify(ov.data).slice(0, 160)}`)
      expect(ov.status, 'override publish status').toBeLessThan(300)
      expect(ov.data.ok === true || ov.data.overridden === true, 'override publish ok/overridden').toBe(true)
      await page.reload()
      await expect(page.getByTestId('paper-unpublish'), 'published after override').toBeVisible({ timeout: 20_000 })
      await expectNoHScroll(page)
    }
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
    // H-C5: a refused Mula shows the API's BM reason in `start-failure` (the generic line before BASE-37).
    const failure = page
      .getByTestId('start-failure')
      .or(page.getByText(/tidak dapat dimulakan/i))
      .first()
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
    let pictures = 0
    let broken = 0
    let dataUrls = 0
    for (let guard = 0; guard < 60; guard++) {
      // B2 regression check (REQ-A-010): pictures of the sitting render (no broken image, no data: URL).
      const imgs = page.locator('[data-testid=attempt-shell] img:visible')
      await page
        .waitForFunction(
          () =>
            [...document.querySelectorAll('[data-testid=attempt-shell] img')].every(
              (i) => (i as HTMLImageElement).complete,
            ),
          undefined,
          { timeout: 5_000 },
        )
        .catch(() => undefined)
      pictures += await imgs.count()
      broken += await imgs.evaluateAll(
        (els) => els.filter((e) => !(e as HTMLImageElement).naturalWidth).length,
      )
      dataUrls += await page.locator('[data-testid=attempt-shell] img[src^="data:"]').count()
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
    observe(
      info,
      `answered ${answered} MCQ(s); admin question seen in the sitting: ${sawAdmin}; pictures shown ${pictures} (broken ${broken}, data: URLs ${dataUrls})`,
    )
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
    test.skip(
      !(st.publishedM04 || st.approvedM04 || st.approvedViaApi),
      'Blocked: no admin question is servable (approved S2a/S2c, or published S2d on BASE-1)',
    )
    const title = `${st.tag} kertas`
    const { id, offered } = await buildPaper(page, info, title, st.tag, st.tag)
    saveState(info, { paper: { id, title, published: false, hasAdminQuestion: offered > 0 } })
    expect(
      offered,
      "the admin's published questions are offered in the paper picker",
    ).toBeGreaterThanOrEqual(1)
    if (st.studioGroup) await expectGroupMovesAsUnit(page, info, st.studioGroup.texts)
  })

  /**
   * S1d's D90 group in Pembina Kertas: placed as ONE unit holding both members ("2 soalan bergerak bersama"); "Naik" / "Turun"
   * moves the whole unit one place and both members stay together; the paper is saved again.
   */
  async function expectGroupMovesAsUnit(
    page: Page,
    info: TestInfo,
    texts: string[],
  ): Promise<void> {
    const units = page.locator('[data-testid=section-0] [data-testid^="unit-"]')
    const group = page
      .locator('[data-testid^=unit-group-]')
      .filter({ hasText: texts[0]!.slice(0, 40) })
    const placed = await group.count()
    observe(info, `run's Studio group placed as unit(s): ${placed}`)
    expect(placed, 'the Studio group is placed as one unit').toBe(1)
    for (const t of texts)
      await expect(group, `member "${t.slice(-40)}" inside the group unit`).toContainText(
        t.slice(0, 40),
      )
    await expect(group).toContainText(`${texts.length} soalan`)
    const testids = async () =>
      units.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? ''))
    const gid = (await group.getAttribute('data-testid')) ?? ''
    const before = (await testids()).indexOf(gid)
    const dir = before > 0 ? 'Naik' : 'Turun'
    await group.getByRole('button', { name: dir, exact: true }).click()
    const after = (await testids()).indexOf(gid)
    observe(
      info,
      `group unit ${gid} at position ${before + 1} -> "${dir}" -> ${after + 1} of ${await units.count()}`,
    )
    expect(after, `"${dir}" moves the group unit by one place`).toBe(
      before + (dir === 'Naik' ? -1 : 1),
    )
    for (const t of texts)
      await expect(group, 'members still together after the move').toContainText(t.slice(0, 40))
    const saved = page.waitForResponse((r) => isApi(r, 'PUT', /\/api\/admin\/papers\/[^/]+$/), {
      timeout: 20_000,
    })
    await page.getByTestId('paper-save').click()
    expect((await saved).status(), 'Simpan draf after the move').toBeLessThan(300)
    await expectNoHScroll(page)
  }

  test('S3c Terbit: the paper publishes (review shows no blockers)', async ({ page }, info) => {
    const st = readState(info)
    test.skip(!st.paper?.id, 'Blocked: S3b created no paper')
    test.skip(!st.paper?.hasAdminQuestion, "Blocked: S3b placed none of the admin's questions")
    await login(page, ADMIN)
    const ok = await publishPaper(page, info, st.paper!.id, { requireRefusal: true })
    saveState(info, { paper: { ...st.paper!, published: ok } })
    expect(ok, 'published paper offers Tarik balik').toBe(true)
  })

  /**
   * API-ASSISTED (R1E2E-23): the Pembina Kertas picker offers only questions tagged with the paper's kertas, while the
   * builder's section pool (`GET /api/admin/papers/{id}/sections/{sid}/pool`, T26b bank pool) offers the eligible bank
   * units. This fills the UI-built paper from that pool over the same placement route the builder uses, then presses
   * "Terbitkan" in the UI. Not a UI pass of the fill.
   */
  async function fillFromPoolAndPublish(
    page: Page,
    info: TestInfo,
    key: 'paper' | 'controlPaper',
  ): Promise<void> {
    const st = readState(info)
    const p = st[key]
    test.skip(!p?.id, `Blocked: no ${key === 'paper' ? 'S3b' : 'S3d'} paper`)
    test.skip(!!p?.published, `Not needed: the ${key} was published through the UI`)
    await login(page, ADMIN)
    const csrf = await csrfOf(page)
    const get = async <T>(path: string): Promise<T> =>
      ((await (await page.request.get(path)).json()) as { data: T }).data
    const ed = await get<{
      paper: { sections: { id: string; questionCount: number; questionIds: string[] }[] }
    }>(`/api/admin/papers/${p!.id}`)
    const sec = ed.paper.sections[0]!
    let have = sec.questionIds.length
    let placed = 0
    for (let guard = 0; guard < 60 && have < sec.questionCount; guard++) {
      const units = await get<{ questionIds: string[]; eligible: boolean; placed: boolean }[]>(
        `/api/admin/papers/${p!.id}/sections/${sec.id}/pool?pageSize=100`,
      )
      const next = units.find(
        (u) => u.eligible && !u.placed && have + u.questionIds.length <= sec.questionCount,
      )
      if (!next) break
      let res = await page.request.post(`/api/admin/papers/${p!.id}/placements`, {
        headers: { 'x-csrf-token': csrf },
        data: { sectionId: sec.id, questionId: next.questionIds[0] },
      })
      // The builder's write limiter (429 RATE_LIMITED, retryAfter seconds): wait it out and retry.
      for (let retry = 0; retry < 3 && res.status() === 429; retry++) {
        const after =
          ((await res.json().catch(() => ({}))) as { error?: { retryAfter?: number } }).error
            ?.retryAfter ?? 30
        observe(info, `placement rate-limited (429), waiting ${after}s`)
        await page.waitForTimeout((after + 1) * 1000)
        res = await page.request.post(`/api/admin/papers/${p!.id}/placements`, {
          headers: { 'x-csrf-token': csrf },
          data: { sectionId: sec.id, questionId: next.questionIds[0] },
        })
      }
      expect(res.status(), `placement: ${(await res.text()).slice(0, 200)}`).toBe(201)
      have += next.questionIds.length
      placed++
    }
    observe(
      info,
      `API-assisted: ${placed} pool unit(s) placed; section ${have}/${sec.questionCount} questions`,
    )
    const ok = await publishPaper(page, info, p!.id)
    saveState(info, { [key]: { ...p!, published: ok } })
    expect(ok, 'the filled paper is Terbit (UI button)').toBe(true)
  }

  test('S3f API-assisted: fill the S3b K1 paper from the builder pool, then Terbitkan in the UI', async ({
    page,
  }, info) => {
    await fillFromPoolAndPublish(page, info, 'paper')
  })

  test('S4a pupil T4 sits the admin paper (admin MCQs with a stem picture) in Bijak SPM and submits', async ({
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
    test.skip(
      !(st.publishedM04 || st.approvedM04 || st.approvedViaApi),
      'Blocked: no admin question is servable (approved S2a/S2c, or published S2d on BASE-1)',
    )
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

  test('S3g API-assisted: fill the S3d control paper from the builder pool, then Terbitkan in the UI', async ({
    page,
  }, info) => {
    await fillFromPoolAndPublish(page, info, 'controlPaper')
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

  /**
   * API-ASSISTED (REQ-B-003, team A answer): the bank has no honest structured Kertas 2 pool (3 structured questions; every
   * K2 blueprint needs >= 5), and Pembina Kertas cannot publish a paper short of its blueprint on BASE-27. So this step makes,
   * over the same admin API the screens use (as the H-A9 chain spec does), the questions a Matematik Kertas 2 paper needs:
   * one structured question per slot with one written ("working") part, marks = the section budget per answered question, the
   * DSKP tags of the S1f Studio question (unit, SP, TP 3) and Aras pemikiran per leaf (T33); review -> approved; then a
   * 1449/2 paper is created, every section filled with placements and Terbit. NOT a UI pass for any of these steps: it only
   * gives S4b a published admin paper with a written part, so the pupil-side self-mark can be exercised in the UI.
   */
  test('S3e API-assisted: structured Kertas 2 paper (1449/2) for the self-mark check', async ({
    page,
  }, info) => {
    const st = readState(info)
    const src = st.studioSingle?.id ?? st.studioGroup?.questionIds[0]
    test.skip(!src, 'Blocked: no DSKP-complete Studio question to copy the tags from (S1d/S1f)')
    await login(page, ADMIN)
    const csrf = await csrfOf(page)
    const post = (path: string, data: unknown) =>
      page.request.post(path, { headers: { 'x-csrf-token': csrf }, data })
    const getData = async <T>(path: string): Promise<T> => {
      const r = await page.request.get(path)
      expect(r.status(), `GET ${path}`).toBe(200)
      return ((await r.json()) as { data: T }).data
    }
    const q = await getData<{
      subjectId: string
      educationLevelId: string
      tag: { unitId: string; spIds: string[]; tp: number }
      questionImage: string | null
    }>(`/api/questions/${src}`)
    const title = `${st.tag} kertas 2 berstruktur`
    const created = await post('/api/admin/papers', { subject: 'MAT', kertas: 2, title })
    expect(created.status(), `POST /api/admin/papers ${await created.text()}`).toBe(201)
    const paperId = String(((await created.json()) as { data: { id: string } }).data.id)
    type Sec = {
      id: string
      label: string
      markBudget: number
      questionCount: number
      rule: { type: string; n?: number }
    }
    const sections = (await getData<{ paper: { sections: Sec[] } }>(`/api/admin/papers/${paperId}`))
      .paper.sections
    const made: string[] = []
    const plan: { section: string; ids: string[] }[] = []
    // The approved PDF intake questions (S1c > S2b > S2g > S2a): one D90 group with a shared passage. It goes at the
    // end of Bahagian A (placing one member places the group), so the pupil sitting shows a real shared passage.
    const intake = (await runQuestions(page, `${st.tag} pdf`)).filter(
      (x) => x.status === 'approved',
    )
    let intakeMarks = 0
    for (const x of intake)
      intakeMarks +=
        (await getData<{ pointsValue?: number }>(`/api/questions/${x.id}`)).pointsValue ?? 1
    observe(info, `intake questions placed in Bahagian A: ${intake.length} (${intakeMarks} markah)`)
    for (const [si, s] of sections.entries()) {
      const withIntake = si === 0 && intake.length > 0 && intake.length < s.questionCount
      const count = s.questionCount - (withIntake ? intake.length : 0)
      const budget = s.markBudget - (withIntake ? intakeMarks : 0)
      const answered = s.rule.type === 'choose' ? (s.rule.n ?? 1) : count
      const base = Math.floor(budget / answered)
      const ids: string[] = []
      for (let i = 0; i < count; i++) {
        // choose-N: every question carries the full per-answer mark; "all": the budget split, one extra mark on the first ones.
        const marks =
          s.rule.type === 'choose' ? base : base + (i < budget - base * answered ? 1 : 0)
        const res = await post('/api/questions', {
          subjectId: q.subjectId,
          educationLevelId: q.educationLevelId,
          difficultyLevel: 3,
          questionType: 'essay',
          questionText: `${st.tag} k2 ${s.label} ${i + 1}: Selesaikan persamaan kuadratik dan tunjukkan langkah kerja.`,
          // R1E2E-05b / H-C7: the first question carries the S1f stem picture (its own stimulus, no group).
          ...(made.length === 0 && q.questionImage ? { questionImageFileId: q.questionImage } : {}),
          kertas: '2',
          tag: { unitId: q.tag.unitId, spIds: q.tag.spIds, tp: 3 },
          parts: [
            {
              label: 'a',
              mode: 'working',
              prompt: { ms: 'Tunjukkan langkah kerja anda.' },
              marks,
              cognitiveLevel: 'mengaplikasi',
              difficultyTp: 3,
              key: {
                kind: 'points',
                marks,
                points: Array.from({ length: marks }, (_, k) => ({
                  id: `p${k + 1}`,
                  code: k === marks - 1 ? 'N' : 'M',
                  label: `Langkah ${k + 1}`,
                  marks: 1,
                  text: { ms: `langkah ${k + 1}` },
                })),
              },
            },
          ],
        })
        expect(res.status(), `POST /api/questions ${(await res.text()).slice(0, 300)}`).toBe(201)
        const id = String(((await res.json()) as { data: { id: string } }).data.id)
        ids.push(id)
        made.push(id)
      }
      if (withIntake) ids.push(intake[0]!.id)
      plan.push({ section: s.id, ids })
    }
    for (const action of ['review', 'approved']) {
      const res = await post('/api/questions/bulk-action', { action, ids: made })
      const body = (await res.json().catch(() => ({}))) as {
        data?: { affected?: number; failed?: { message: string }[] }
      }
      observe(
        info,
        `${action}: HTTP ${res.status()} affected ${body.data?.affected ?? '?'} of ${made.length}${body.data?.failed?.length ? ` refused: ${[...new Set(body.data.failed.map((f) => f.message))].join(' / ')}` : ''}`,
      )
      expect(body.data?.affected, `${action} on every structured question`).toBe(made.length)
    }
    for (const p of plan)
      for (const id of p.ids) {
        const res = await post(`/api/admin/papers/${paperId}/placements`, {
          sectionId: p.section,
          questionId: id,
        })
        expect(res.status(), `placement ${id}: ${(await res.text()).slice(0, 200)}`).toBe(201)
      }
    const pub = await post(`/api/admin/papers/${paperId}/publish`, {})
    const pubBody = await pub.text()
    observe(
      info,
      `API-assisted: ${made.length} structured questions (${sections.map((s) => `${s.label} ${s.questionCount}q/${s.markBudget}m`).join(', ')}); paper ${paperId}; publish -> HTTP ${pub.status()} ${pubBody.slice(0, 300)}`,
    )
    let ok = pub.status() === 200 && /"ok":true/.test(pubBody)
    // T34: the 1449/2 blueprint is Spec (not Disahkan) too, so the plain publish is refused; use the same audited override as S3c.
    // (Harness fix, BASE-102: this step still assumed the pre-T34 gate.)
    if (!ok && T34 && /BLUEPRINT_NOT_VERIFIED|belum Disahkan/.test(pubBody)) {
      const ov = await publishPaperWithOverride(page, paperId, 'E2E: Kontrak 1449/2 belum Disahkan (ujian)')
      observe(info, `publish override (API-assisted, 1449/2) -> HTTP ${ov.status} ${JSON.stringify(ov.data).slice(0, 160)}`)
      ok = ov.status < 300 && (ov.data.ok === true || ov.data.overridden === true)
    }
    saveState(info, {
      writtenPaper: { id: paperId, title, published: ok, hasAdminQuestion: true },
      intakeInPaper: intake.length,
    })
    expect(ok, 'the structured Kertas 2 paper is Terbit').toBe(true)
    await page.goto(`/admin/spm/kertas/${paperId}`)
    await expect(page.getByTestId('paper-editor-page')).toBeVisible()
    await expectNoHScroll(page)
  })

  test('S4b pupil self-marks a written part of an admin paper (Simpan markah)', async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(
      !st.writtenPaper?.published,
      'Blocked: no published admin paper with a written part (S3e API-assisted K2 paper not published; the MCQ papers of S3b/S3d have no written part)',
    )
    // The sitting, the answers, Hantar and the self-mark are all UI; only the paper came from the API (S3e).
    await login(page, PUPIL_T4)
    await page.goto('/spm/bijak')
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    const card = page.locator('[data-testid^=paper-]', { hasText: st.writtenPaper!.title }).first()
    await expect(card, 'the structured admin paper on the hub').toBeVisible()
    await expectNoHScroll(page)
    await card.locator('[data-testid^=open-]').click()
    await expect(page.getByTestId('bijak-cover')).toBeVisible()
    await page.locator('[data-ds=hero-cta]').click()
    await expect(page.getByTestId('attempt-shell'), 'the sitting starts').toBeVisible()
    await expect(page.getByTestId('attempt-loading')).toHaveCount(0)
    await expect(page.getByTestId('next').or(page.getByTestId('submit')).first()).toBeVisible()
    await expectNoHScroll(page)
    // H-C7: question 1 carries its own picture: shown once, above the stem, in the sitting.
    const own = page.locator('[data-testid=own-stimuli]:visible')
    const ownImgs = await own.locator('img').count()
    observe(
      info,
      `sitting Q1: own-stimuli blocks ${await own.count()}, pictures inside ${ownImgs}, all pictures on screen ${await page.locator('[data-testid=attempt-shell] img:visible').count()}`,
    )
    expect(await own.count(), 'own stimulus block shown once in the sitting').toBe(1)
    expect(ownImgs, 'the own picture shown once').toBe(1)
    expect(
      await own.first().evaluate(ABOVE, 'k2 Bahagian A 1:'),
      'the own picture is above the stem',
    ).toBe(true)
    // D90 shared passage of the intake group (S1c), if S3e placed it: shown once on each member's screen.
    const PASSAGE = 'Harga sebatang pensel RM1'
    const passageSeen: string[] = []
    let written = 0
    for (let guard = 0; guard < 40; guard++) {
      const shown = page.locator('[data-stimulus]:visible').filter({ hasText: PASSAGE })
      const member = await page
        .getByText(/pensel\?|paling murah\?/)
        .first()
        .isVisible()
        .catch(() => false)
      if (member || (await shown.count()) > 0) {
        let seen = `${member ? 'member' : 'other'} screen: passage ${await shown.count()}x`
        // Below lg the shared Rajah sits behind the sticky chip ("stimulus-chip") and opens in a drawer.
        const chip = page.getByTestId('stimulus-chip')
        if ((await shown.count()) === 0 && (await chip.isVisible().catch(() => false))) {
          await chip.click()
          const inDrawer = page
            .locator('[role=dialog] [data-stimulus]:visible')
            .filter({ hasText: PASSAGE })
          await inDrawer
            .first()
            .waitFor({ state: 'visible', timeout: 5_000 })
            .catch(() => undefined)
          seen = `${member ? 'member' : 'other'} screen: chip -> drawer, passage ${await inDrawer.count()}x`
          await page.keyboard.press('Escape')
          await page
            .locator('[role=dialog]')
            .first()
            .waitFor({ state: 'hidden', timeout: 5_000 })
            .catch(() => undefined)
        }
        passageSeen.push(seen)
      }
      const mcq = page.locator(
        '[data-testid^=option-]:visible, [data-testid^=mcq-option-]:not([data-testid=mcq-option-image]):visible',
      )
      if ((await mcq.count()) > 0) await mcq.first().click()
      // A "working" part: "Jalan kerja" steps and "Jawapan akhir" (MathField inputs).
      const steps = page.locator('[data-testid=math-input]:visible')
      if ((await steps.count()) > 0) {
        await steps.first().fill('(x - 2)(x - 3) = 0')
        await steps.last().fill('x = 2 atau x = 3')
        written++
      }
      if (!(await page.getByTestId('next').isVisible())) break
      await page.getByTestId('next').click()
    }
    observe(info, `written answers entered: ${written}`)
    if (st.intakeInPaper) {
      observe(
        info,
        `shared passage (intake D90 group) in the sitting: ${passageSeen.join('; ') || 'never shown'}`,
      )
      const members = passageSeen.filter((x) => x.startsWith('member'))
      expect(members.length, 'both group members were sat').toBe(2)
      expect(
        members.every((x) => x.endsWith(' 1x')),
        'the shared passage shows once on each member screen',
      ).toBe(true)
    }
    await page.getByTestId('submit').click()
    await page.getByTestId('confirm-submit').click()
    await expect(page.getByTestId('win-screen')).toBeVisible()
    const headline = async () =>
      (await page.getByTestId('win-screen').innerText())
        .split('\n')
        .filter(Boolean)
        .slice(0, 3)
        .join(' / ')
    observe(info, `result before self-mark: ${await headline()}`)
    saveState(info, { writtenAttempt: /percubaan\/([^/?#]+)/.exec(page.url())?.[1] ?? '' })
    await selfMarkOne(page, info)
    await page.reload()
    await expect(page.getByTestId('win-screen')).toBeVisible()
    observe(info, `result after self-mark + reload: ${await headline()}`)
    // H-C7 on the result: the own picture of question 1 once, above its stem.
    const rOwn = page.locator('[data-testid=own-stimuli]')
    observe(
      info,
      `result: own-stimuli blocks ${await rOwn.count()}, pictures inside ${await rOwn.locator('img').count()}`,
    )
    if (st.intakeInPaper) {
      const rPassage = page
        .locator('[data-stimulus]:visible')
        .filter({ hasText: 'Harga sebatang pensel RM1' })
      let rCount = await rPassage.count()
      let how = 'inline (split pane)'
      // Stacked layout (below the wide breakpoint): the group's chip opens the passage in a drawer.
      const rChip = page.getByTestId('result-group').getByTestId('stimulus-chip')
      if (
        rCount === 0 &&
        (await rChip
          .first()
          .isVisible()
          .catch(() => false))
      ) {
        await rChip.first().click()
        const inDrawer = page
          .locator('[role=dialog] [data-stimulus]:visible')
          .filter({ hasText: 'Harga sebatang pensel RM1' })
        await inDrawer
          .first()
          .waitFor({ state: 'visible', timeout: 5_000 })
          .catch(() => undefined)
        rCount = await inDrawer.count()
        how = 'chip -> drawer'
        await page.keyboard.press('Escape')
      }
      observe(
        info,
        `result: shared passage ${how} ${rCount}x; members under the group: ${await page.getByTestId('result-group-members').locator('[data-testid^=result-q-]').count()}`,
      )
      expect(rCount, 'the shared passage once on the result').toBe(1)
    }
    expect(await rOwn.count(), 'own stimulus block once on the result').toBe(1)
    expect(await rOwn.locator('img').count(), 'the own picture once on the result').toBe(1)
    expect(
      await rOwn.first().evaluate(ABOVE, 'k2 Bahagian A 1:'),
      'the own picture is above the stem on the result',
    ).toBe(true)
    await expectNoHScroll(page)
  })

  test('S4c pupil sees the result (score / max, per Bahagian)', async ({ page }, info) => {
    const st = readState(info)
    // S4a/S4a2 MCQ sittings first; else the UI sitting of the API-assisted structured paper (S3e/S4b), labelled as such.
    const att = st.attempt?.submitted ? st.attempt.id : st.writtenAttempt
    test.skip(!att, 'Blocked: no submitted attempt of an admin paper (S4a, S4a2, S4b)')
    observe(
      info,
      st.attempt?.submitted
        ? `sitting of the admin MCQ paper (S4a/S4a2)`
        : 'sitting of the API-assisted structured K2 paper (S3e), sat in the UI (S4b)',
    )
    await login(page, PUPIL_T4)
    await page.goto(`/spm/bijak/percubaan/${att!}/keputusan`)
    await expect(page.getByTestId('win-screen')).toBeVisible()
    await expect(page.getByTestId('section-score').first()).toBeVisible()
    observe(
      info,
      `attempt ${att!}; headline: ${(await page.getByTestId('win-screen').innerText()).split('\n').filter(Boolean).slice(0, 2).join(' / ')}; sections: ${(await page.getByTestId('section-score').allInnerTexts()).join(', ')}; questions listed: ${await page.locator('[data-testid^=result-q-]').count()}`,
    )
    await expectNoHScroll(page)
  })

  test('S4d pupil presses Cuba Lagi: a new blank attempt of the same paper', async ({
    page,
  }, info) => {
    const st = readState(info)
    // S4a/S4a2 MCQ sittings first; else the UI sitting of the API-assisted structured paper (S3e/S4b), labelled as such.
    const att = st.attempt?.submitted ? st.attempt.id : st.writtenAttempt
    test.skip(!att, 'Blocked: no submitted attempt of an admin paper (S4a, S4a2, S4b)')
    observe(
      info,
      st.attempt?.submitted
        ? `sitting of the admin MCQ paper (S4a/S4a2)`
        : 'sitting of the API-assisted structured K2 paper (S3e), sat in the UI (S4b)',
    )
    await login(page, PUPIL_T4)
    await page.goto(`/spm/bijak/percubaan/${att!}/keputusan`)
    await expect(page.getByTestId('retry'), 'Cuba Lagi on the result').toBeVisible()
    await page.getByTestId('retry').click()
    await expect(page).toHaveURL(/\/spm\/bijak\/percubaan\/[^/]+$/)
    expect(page.url(), 'a different attempt id').not.toContain(att!)
    await expect(page.getByTestId('attempt-shell')).toBeVisible()
    observe(info, `old ${att!} -> new ${new URL(page.url()).pathname}`)
    await expectNoHScroll(page)
  })

  test('S4e pupil T5 sees the admin paper on the Bijak SPM hub', async ({ page }, info) => {
    const st = readState(info)
    const paper = st.paper?.published
      ? st.paper
      : st.controlPaper?.published
        ? st.controlPaper
        : st.writtenPaper
    test.skip(!paper?.published, 'Blocked: no admin-built paper was published (S3c, S3d, S3e)')
    observe(
      info,
      paper === st.writtenPaper
        ? 'paper: the API-assisted structured K2 paper (S3e)'
        : 'paper: built in Pembina Kertas',
    )
    await login(page, PUPIL_T5)
    await page.goto('/spm/bijak')
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    await expect(
      page.locator('[data-testid^=paper-]', { hasText: paper!.title }).first(),
    ).toBeVisible()
    await expectNoHScroll(page)
  })

  test('S4f pupil sits the T26c structured K2 fixture paper (seeded, no API assist) and self-marks a written part', async ({
    page,
  }, info) => {
    await login(page, PUPIL_T4)
    await page.goto('/spm/bijak')
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    const card = page
      .locator('[data-testid^=paper-]', {
        hasText: 'E2E fixture: Percubaan Matematik Tambahan Kertas 2',
      })
      .first()
    await expect(card, 'the T26c K2 fixture paper on the T4 hub').toBeVisible()
    observe(info, `hub card: ${(await card.innerText()).replace(/\s+/g, ' ').slice(0, 140)}`)
    await expectNoHScroll(page)
    await card.locator('[data-testid^=open-]').click()
    await expect(page.getByTestId('bijak-cover')).toBeVisible()
    await expectNoHScroll(page)
    const started = page
      .waitForResponse((r) => isApi(r, 'POST', /\/api\/bijak\/attempts$/), { timeout: 20_000 })
      .catch(() => null)
    if (
      await page
        .getByTestId('resume-choice')
        .isVisible()
        .catch(() => false)
    ) {
      await page.getByTestId('restart').click()
      await page.getByTestId('confirm-restart').click()
    } else await page.locator('[data-ds=hero-cta]').click()
    const sr = await started
    observe(
      info,
      `Mula -> ${sr ? `HTTP ${sr.status()} ${sr.ok() ? '' : (await sr.text()).slice(0, 200)}` : 'no request seen'}`,
    )
    await expect(page.getByTestId('attempt-shell'), 'the sitting starts').toBeVisible()
    await expect(page.getByTestId('attempt-loading')).toHaveCount(0)
    await expectNoHScroll(page)
    let screens = 0
    let filled = 0
    for (let guard = 0; guard < 40; guard++) {
      screens++
      for (const box of await page.locator('[data-testid=math-input]:visible').all()) {
        await box.fill('x = 2')
        filled++
      }
      for (const t of await page.locator('[data-testid=attempt-shell] textarea:visible').all()) {
        await t.fill('Jawapan bertulis murid.')
        filled++
      }
      const opt = page.locator(
        '[data-testid^=option-]:visible, [data-testid^=mcq-option-]:not([data-testid=mcq-option-image]):visible',
      )
      if ((await opt.count()) > 0) await opt.first().click()
      if (!(await page.getByTestId('next').isVisible())) break
      await page.getByTestId('next').click()
    }
    observe(info, `screens ${screens}, answer fields filled ${filled}`)
    await page.getByTestId('submit').click()
    await page.getByTestId('confirm-submit').click()
    await expect(page.getByTestId('win-screen')).toBeVisible()
    const headline = async () =>
      (await page.getByTestId('win-screen').innerText())
        .split('\n')
        .filter(Boolean)
        .slice(0, 3)
        .join(' / ')
    observe(info, `result before self-mark: ${await headline()}`)
    await selfMarkOne(page, info)
    await page.reload()
    await expect(page.getByTestId('win-screen')).toBeVisible()
    observe(info, `result after self-mark + reload: ${await headline()}`)
    await expectNoHScroll(page)
  })

  test('S6 pupil T4 Jana Kertas: Matematik Tambahan Kertas 2 (blueprint 3472/2, T26 seed)', async ({
    page,
  }, info) => {
    // T26 moves 3472/2 to Disahkan with serves_students. The pupil generates a paper from the bank; 201 (cover opens) or
    // 422 SHORTAGE (the shortage alert lists what is missing) are both the documented outcomes (docs/ops/e2e-seed.md).
    await login(page, PUPIL_T4)
    await page.goto('/spm/bijak?tab=jana')
    await expect(page.getByTestId('tab-jana')).toBeVisible()
    await expectNoHScroll(page)
    await page.getByTestId('jana-subject').click()
    await page.getByRole('option', { name: 'Matematik Tambahan', exact: true }).click()
    await page.getByTestId('jana-kertas').click()
    await page.getByRole('option', { name: 'Kertas 2', exact: true }).click()
    const contract = page.getByTestId('contract')
    await expect(contract, 'the 3472/2 contract is offered to the pupil').toBeVisible()
    observe(info, `contract: ${(await contract.innerText()).replace(/\s+/g, ' ').slice(0, 200)}`)
    await expect(page.getByTestId('no-contract')).toHaveCount(0)
    const posted = page.waitForResponse(
      (r) => isApi(r, 'POST', /\/api\/bijak\/papers\/generate$/),
      {
        timeout: 60_000,
      },
    )
    await page.getByTestId('generate').click()
    const res = await posted
    const body = await res.text().catch(() => '')
    observe(info, `POST /api/bijak/papers/generate -> HTTP ${res.status()} ${body.slice(0, 400)}`)
    if (res.status() === 422 && /"SHORTAGE"/.test(body)) {
      const alert = page.getByTestId('shortage')
      await expect(alert, 'the shortage is explained to the pupil').toBeVisible()
      observe(info, `shown: ${(await alert.innerText()).replace(/\s+/g, ' ').slice(0, 300)}`)
    } else {
      expect(res.status(), 'Jana Kertas created a paper').toBe(201)
      await expect(
        page.getByTestId('bijak-cover'),
        'the generated paper opens on its cover',
      ).toBeVisible()
      observe(
        info,
        `cover: ${(await page.getByTestId('bijak-cover').innerText()).split('\n').filter(Boolean).slice(0, 3).join(' / ')}`,
      )
    }
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
    // R1E2E-14: which papers the hub lists (PoC papers with BIJAK_POC_QUESTIONS=false).
    observe(
      info,
      `hub cards: ${(await page.locator('[data-testid^=paper-]').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').slice(0, 70)).join(' | ')}`,
    )
    // Sains K2 (structured, short text): the smoke doc's reproduction paper.
    const card = page.locator('[data-testid^=paper-]', { hasText: 'Sains' }).first()
    await page
      .locator('[data-testid^=paper-]')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 })
      .catch(() => undefined)
    // BASE-79: the hub no longer lists the PoC papers to a pupil without a past sitting (R1E2E-14), so the smoke doc's
    // reproduction paper is gone; self-mark itself is covered by S4b on an admin paper.
    test.skip(
      !(await card.isVisible().catch(() => false)),
      'Blocked: no Sains Kertas 2 paper on the hub (PoC papers no longer listed); self-mark is covered by S4b',
    )
    await card.locator('[data-testid^=open-]').click()
    await expect(page.getByTestId('bijak-cover')).toBeVisible()
    if (await page.getByTestId('resume-choice').isVisible()) {
      await page.getByTestId('restart').click()
      await page.getByTestId('confirm-restart').click()
    } else {
      await page.locator('[data-ds=hero-cta]').click()
    }
    const refused = page.getByTestId('start-failure')
    await expect(page.getByTestId('attempt-shell').or(refused).first()).toBeVisible()
    if (await refused.isVisible()) {
      const inView = await refused.evaluate((el) => {
        const r = el.getBoundingClientRect()
        return r.top >= 0 && r.bottom <= window.innerHeight
      })
      observe(
        info,
        `Mula refused; cover shows: "${(await refused.innerText()).trim()}"; visible without scrolling: ${inView}`,
      )
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

  test('B-04 Simulasi Kuiz in the UI: hub entry, answer, Semak, Tamat, result', async ({
    page,
  }, info) => {
    await login(page, PUPIL_T4)
    await page.goto('/spm/bijak')
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    const entry = page.getByTestId('kuiz-link')
    await expect(entry, '"Simulasi — Kuiz" on the Bijak SPM hub').toBeVisible()
    await entry.click()
    await expect(page, 'the quiz opens at /simulasi/kuiz').toHaveURL(/\/simulasi\/kuiz(\?|$)/)
    await expect(page.getByTestId('kuiz-page')).toBeVisible()
    await expect(page.getByTestId('kuiz-loading')).toHaveCount(0, { timeout: 20_000 })
    await expect(page.getByTestId('kuiz-empty'), 'the quiz has questions').toHaveCount(0)
    observe(
      info,
      `header: ${(await page.getByTestId('kuiz-header').innerText()).replace(/\s+/g, ' ').slice(0, 120)}`,
    )
    await expectNoHScroll(page)
    let answered = 0
    for (let guard = 0; guard < 45; guard++) {
      if (
        await page
          .getByTestId('kuiz-done')
          .isVisible()
          .catch(() => false)
      )
        break
      const option = page
        .locator('[data-testid^=mcq-option-]:not([data-testid=mcq-option-image]):visible')
        .first()
      await option.click()
      await page.getByTestId('kuiz-semak').click()
      const verdict = page.getByTestId('kuiz-verdict')
      await expect(verdict, 'the verdict after "Semak"').toBeVisible()
      if (answered === 0) {
        observe(
          info,
          `first verdict: ${(await verdict.innerText()).replace(/\s+/g, ' ').slice(0, 160)}`,
        )
        await expectNoHScroll(page)
      }
      answered++
      const before = await page.getByTestId('kuiz-counter').innerText()
      await page.getByTestId('kuiz-next').click()
      // Wait for the next question (or the result) before picking an option again.
      await expect
        .poll(
          async () =>
            (await page
              .getByTestId('kuiz-done')
              .isVisible()
              .catch(() => false)) ||
            (await page
              .getByTestId('kuiz-counter')
              .innerText()
              .catch(() => before)) !== before,
          { timeout: 15_000 },
        )
        .toBe(true)
    }
    await expect(page.getByTestId('kuiz-done'), 'the result after the last question').toBeVisible({
      timeout: 20_000,
    })
    observe(
      info,
      `answered ${answered}; result: Markah ${(await page.getByTestId('kuiz-score').innerText()).replace(/\s+/g, ' ')}, Ketepatan ${(await page.getByTestId('kuiz-accuracy').innerText()).replace(/\s+/g, ' ')}`,
    )
    await expectNoHScroll(page)
    expect(answered, 'every question answered and checked').toBeGreaterThan(0)
  })

  test('B-04c per-paper Kuiz from the paper cover (DEMO/1): answer, Semak, pages', async ({
    page,
  }, info) => {
    await login(page, PUPIL_T4)
    const papers =
      (
        (await (await page.request.get('/api/bijak/papers')).json()) as {
          data?: { id: string; code: string }[]
        }
      ).data ?? []
    const demo = papers.find((p) => p.code === 'DEMO/1')
    test.skip(!demo, 'Blocked: the DEMO/1 bank paper is not on the hub')
    await page.goto(`/spm/bijak/kertas/${demo!.id}`)
    await expect(page.getByTestId('bijak-cover')).toBeVisible()
    await page.getByTestId('paper-kuiz-link').click()
    await expect(page, 'per-paper quiz route').toHaveURL(new RegExp(`/simulasi/${demo!.id}/kuiz`))
    await expect(page.getByTestId('paper-quiz-page')).toBeVisible()
    await expect(page.getByTestId('paper-quiz-header')).toBeVisible({ timeout: 20_000 })
    await expectNoHScroll(page)
    let checked = 0
    for (let pageNo = 0; pageNo < 10; pageNo++) {
      const semak = page.locator('[data-testid=kuiz-semak]:visible')
      for (let guard = 0; guard < 20 && (await semak.count()) > 0; guard++) {
        const cardId = await page
          .locator('[data-testid^=kuiz-item-]')
          .filter({ has: page.locator('[data-testid=kuiz-semak]:visible') })
          .first()
          .getAttribute('data-testid')
        // Pin the card by its id: once checked, it no longer matches the "has Semak" filter.
        const card = page.getByTestId(cardId ?? '')
        await card
          .locator('[data-testid^=mcq-option-]:not([data-testid=mcq-option-image]):visible')
          .first()
          .click()
        await card.getByTestId('kuiz-semak').click()
        await expect(card.getByTestId('kuiz-verdict')).toBeVisible()
        checked++
      }
      const next = page.getByTestId('paper-quiz-next')
      if (!(await next.isVisible().catch(() => false)) || !(await next.isEnabled())) break
      await next.click()
    }
    observe(
      info,
      `checked ${checked} item(s); ${(
        await page
          .getByTestId('paper-quiz-score')
          .innerText()
          .catch(() => '')
      ).replace(/\s+/g, ' ')}`,
    )
    await expectNoHScroll(page)
    expect(checked, 'the per-paper quiz checks its MCQs').toBeGreaterThan(0)
  })

  test('B-04b Simulasi Kuiz backend (T11): API check as the T4 pupil, NOT a UI pass', async ({
    page,
  }, info) => {
    // T11 (BASE-49) is in base, T12 (the screens) is not. This only tells whether the backend is ready for T12.
    await login(page, PUPIL_T4)
    const csrf = await csrfOf(page)
    const post = (path: string, data: unknown) =>
      page.request.post(path, { headers: { 'x-csrf-token': csrf }, data })
    const start = await post('/api/bijak/kuiz/sessions', { subject: 'MATH', count: 5 })
    const sBody = await start.text()
    const session = (
      JSON.parse(sBody || '{}') as {
        data?: {
          sessionId: string
          count: number
          items: { id: string; kind: string; options: unknown[]; stimuli: unknown[] }[]
        }
      }
    ).data
    observe(
      info,
      `API: POST /api/bijak/kuiz/sessions {MATH, 5} -> HTTP ${start.status()}; count ${session?.count ?? '-'}, items ${session?.items.length ?? '-'} (${[...new Set((session?.items ?? []).map((i) => i.kind))].join('/')}), key exposed before check: ${/"correct/.test(sBody)}`,
    )
    expect(start.status(), 'Kuiz session starts').toBe(201)
    expect(session?.items.length ?? 0, 'the session has questions').toBeGreaterThan(0)
    const first = session!.items.find((i) => i.kind === 'mcq')
    if (first) {
      const chk = await post(`/api/bijak/kuiz/sessions/${session!.sessionId}/check`, {
        itemId: first.id,
        optionId: 'A',
      })
      observe(
        info,
        `API: check item ${first.id} with A -> HTTP ${chk.status()} ${(await chk.text()).slice(0, 160)}`,
      )
      expect(chk.status(), 'check answers 200').toBe(200)
    }
    const fin = await post(`/api/bijak/kuiz/sessions/${session!.sessionId}/finish`, {
      timeSpent: 30,
    })
    observe(info, `API: finish -> HTTP ${fin.status()} ${(await fin.text()).slice(0, 200)}`)
    expect(fin.status(), 'finish answers 200').toBe(200)
    // Per-paper quiz on the bank paper of the hub (DEMO/1).
    const papers =
      (
        (await (await page.request.get('/api/bijak/papers')).json()) as {
          data?: { id: string; code: string }[]
        }
      ).data ?? []
    const demo = papers.find((p) => p.code === 'DEMO/1')
    if (demo) {
      const pr = await page.request.get(`/api/bijak/kuiz/papers/${demo.id}`)
      observe(
        info,
        `API: GET /api/bijak/kuiz/papers/${demo.id} (DEMO/1) -> HTTP ${pr.status()} ${(await pr.text()).slice(0, 160)}`,
      )
    }
    // UI today: no Kuiz entry on the paper cover (modes offered) and /simulasi/kuiz is checked by B-04.
    if (demo) {
      await page.goto(`/spm/bijak/kertas/${demo.id}`)
      const modes = await page
        .getByTestId('mode-choice')
        .innerText()
        .catch(() => '(no mode choice)')
      observe(info, `UI: cover of DEMO/1, "Pilih mod": ${modes.replace(/\s+/g, ' ').slice(0, 160)}`)
    }
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
    // B-02 sits a PoC paper; with BIJAK_POC_QUESTIONS=false that sitting cannot start, so fall back to the S4b sitting.
    if (!attemptId) attemptId = readState(info).writtenAttempt ?? ''
    observe(info, `attempt used: ${attemptId || 'none'}`)
    test.skip(!attemptId, 'Blocked: neither B-02 nor S4b produced a submitted attempt')
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
