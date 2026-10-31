/**
 * R1 end-to-end acceptance, BASELINE (T23; CLOUD-HANDOFF §7(i); v3-bijak-spm-scope R1-20).
 * Real stack only (VITE_API_MODE=http SPA + API + Postgres). Config: playwright.r1-e2e.config.ts.
 *
 * Journey, one named test per step, at 375 / 768 / 1280 (no horizontal page scroll):
 *   0  pupil baseline counts (Databank, Latih Tubi SPM, Soalan by Chapter)
 *   1  Admin Pusat enters questions: form + image (Bank Soalan), CSV (Import & Semakan),
 *      PDF (Muat Naik Kertas), one D90 group (one shared stimulus, >= 2 member questions)
 *   2  approves them (approved = servable, D80/D85)
 *   3  builds a paper (Set Builder; a group moves as a unit), review, Terbit
 *   4  pupil (T4, T5) sits it in Bijak SPM, self-marks, sees the result, Cuba Lagi
 *   5  Databank, Latih Tubi SPM and Soalan by Chapter (Bab) receive the admin's approved question
 *   B  re-tests of B-01, B-02, B-04, B-05 (docs/qa/r1-student-smoke-2026-10-31.md)
 *
 * BASELINE: many steps are expected to fail on BASE-1 (Set Builder UI, Studio groups and the
 * lifecycle are not merged). Each step asserts the target behaviour and fails with the observed
 * reason; a step whose input an earlier step did not produce is skipped as "Blocked: ...".
 * Nothing is faked. Fictitious demo accounts only (seed, public password of the local stack).
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
  baseline?: { databankMath?: number; latihTubiMath?: number; chapterSubjects?: number }
  formQuestion?: { text: string; id?: string; chapter?: string }
  csvQuestions?: string[]
  pdfBatch?: { id: string; submitted: boolean; groups: number; questions: number }
  manualBatch?: { id: string; submitted: boolean; groups: number; questions: number }
  approvedM04?: number
  approvedViaApi?: number
  approvedIntake?: number
  paper?: { id: string; title: string; published: boolean; hasAdminQuestion: boolean }
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
 * and Edge ship but the pre-installed Chromium 141 of the cloud container lacks (bug R1E2E-01). This
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
  if (!native)
    observe(info, 'browser lacks Map.prototype.getOrInsertComputed: shim applied (bug R1E2E-01)')
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

// ---------------------------------------------------------------- the journey

test.describe('R1 E2E baseline @api @r1e2e', () => {
  test.afterEach(async ({ page }, info) => {
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
    saveState(info, { baseline: { databankMath, latihTubiMath, chapterSubjects } })
    observe(
      info,
      `Databank MATH ${databankMath}, Latih Tubi SPM MATH ${latihTubiMath}, chapter subjects ${chapterSubjects}`,
    )
    expect(Number.isNaN(databankMath), 'Databank Matematik count is readable').toBe(false)
  })

  test('S1a admin creates a T4 MCQ with an image and a Bab via the form (Bank Soalan)', async ({
    page,
  }, info) => {
    const st = readState(info)
    const text = `${st.tag} borang: Berapakah hasil tambah 12 dan 30?`
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
    await page
      .getByTestId('q-image-input')
      .setInputFiles({ name: 'rajah.png', mimeType: 'image/png', buffer: PNG })
    await expect(
      page.getByTestId('q-image-preview').first(),
      'stem image preview after upload',
    ).toBeAttached()
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
    saveState(info, { formQuestion: { text, id, chapter: chapterLabel } })
    observe(
      info,
      `created question id ${id ?? '?'}; response status field: ${String(body.data?.status ?? '-')}`,
    )
    await page.getByTestId('questions-search').fill(st.tag)
    await page.getByRole('button', { name: 'Cari', exact: true }).click()
    await expect(page.getByTestId('questions-table')).toContainText('borang')
    await expectNoHScroll(page)
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
    const table = page.getByTestId('questions-table')
    await expect(table).toBeVisible()
    const rows = table.locator('tbody tr', { hasText: tag })
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
    await page.goto(`/admin/questions?search=${encodeURIComponent(tag)}`)
    await expect(rows.first()).toBeVisible()
    observe(
      info,
      `statuses now: ${(await rows.getByTestId('question-status').allInnerTexts()).join(', ')}`,
    )
    return out
  }

  test('S2a admin approves the Bank Soalan questions (Luluskan)', async ({ page }, info) => {
    const st = readState(info)
    test.skip(!st.formQuestion && !st.csvQuestions, 'Blocked: S1a/S1b created no question')
    await login(page, ADMIN)
    const n = 1 + (st.csvQuestions?.length ?? 0)
    // V3 lifecycle: Draf -> "Hantar untuk Semakan" (question detail) -> "Luluskan" (bulk bar).
    await page.goto(`/admin/questions?search=${encodeURIComponent(st.tag)}`)
    const rows = page.getByTestId('questions-table').locator('tbody tr', { hasText: st.tag })
    await expect(rows.first(), 'run questions listed').toBeVisible()
    const hrefs: string[] = []
    for (let i = 0; i < (await rows.count()); i++) {
      const href = await rows
        .nth(i)
        .getByTestId('question-view')
        .getAttribute('href')
        .catch(() => null)
      if (href) hrefs.push(href)
    }
    observe(info, `${hrefs.length} run question(s) found`)
    let sent = 0
    for (const href of hrefs) {
      await page.goto(href)
      const btn = page.getByTestId('status-pending-review')
      if (
        !(await btn.waitFor({ state: 'visible', timeout: 10_000 }).then(
          () => true,
          () => false,
        ))
      )
        continue
      const r = page
        .waitForResponse(
          (x) => x.request().method() !== 'GET' && /\/api\/.*questions/.test(x.url()),
          { timeout: 15_000 },
        )
        .catch(() => null)
      await btn.click()
      if ((await r)?.ok()) sent++
    }
    observe(info, `Hantar untuk Semakan succeeded on ${sent} question(s)`)
    await expectNoHScroll(page)
    const res = await bulkOnRun(page, st.tag, 'Luluskan', info)
    saveState(info, { approvedM04: res.affected })
    await expectNoHScroll(page)
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
    // (the detail page sends numeric ids and gets 422, bug R1E2E-05). Only "approved" is applied,
    // the R1 target state (D80/D85); whether approved is servable is what S5 then shows.
    await login(page, ADMIN)
    await page.goto(`/admin/questions?search=${encodeURIComponent(st.tag)}`)
    const rows = page.getByTestId('questions-table').locator('tbody tr', { hasText: st.tag })
    await expect(rows.first(), 'run questions listed').toBeVisible()
    const ids: string[] = []
    for (let i = 0; i < (await rows.count()); i++) {
      const href = await rows.nth(i).getByTestId('question-view').getAttribute('href')
      const id = /\/(\d+)$/.exec(href ?? '')?.[1]
      if (id) ids.push(id)
    }
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
    await page.reload()
    observe(
      info,
      `statuses now: ${(await rows.getByTestId('question-status').allInnerTexts()).join(', ')}`,
    )
    saveState(info, { approvedViaApi: approved })
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
    const rows = page.getByTestId('queue-table').locator('tbody tr')
    const before = await rows.count()
    observe(info, `queue rows: ${before}`)
    expect(before, 'the submitted batches are queued').toBeGreaterThanOrEqual(1)
    let approved = 0
    for (let guard = 0; guard < 10; guard++) {
      const row = page.getByTestId('queue-table').locator('tbody tr', { hasText: 'E2E' }).first()
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

  test('S3a Set Builder: build a paper from the approved questions (group moves as a unit)', async ({
    page,
  }, info) => {
    await login(page, ADMIN)
    // R1-16 / R1-21 P6: Set Builder at /admin/studio/sets(/:paper/builder).
    await expectRouteExists(page, '/admin/studio/sets')
    await expectNoHScroll(page)
    observe(info, 'Set Builder route exists')
  })

  test('S3b paper review: admin question placed (Pembina Kertas), group as one unit', async ({
    page,
  }, info) => {
    const st = readState(info)
    const title = `${st.tag} kertas`
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
    await page.getByTestId('new-kertas').selectOption({ label: 'Kertas 2' })
    await page.getByTestId('new-title').fill(title)
    await page.getByRole('button', { name: 'Cipta Kertas' }).click()
    await expect(page.getByTestId('paper-editor-page')).toBeVisible()
    const id = new URL(page.url()).pathname.split('/').pop() ?? ''
    saveState(info, { paper: { id, title, published: false, hasAdminQuestion: false } })
    await expectNoHScroll(page)
    // Find the run's approved questions in the picker of section 0.
    const add = page.getByTestId('add-0')
    if (await add.isVisible()) await add.click()
    const search = page.getByTestId('picker-search')
    await expect(search, 'question picker').toBeVisible()
    await search
      .locator('input')
      .first()
      .fill(st.tag)
      .catch(() => search.fill(st.tag))
    const picks = page.locator('[data-testid^=pick-add-]')
    await page.waitForTimeout(1500)
    const found = await picks.count()
    observe(info, `picker candidates for the run tag: ${found}`)
    expect(
      found,
      "the admin's approved questions are offered in the paper picker",
    ).toBeGreaterThanOrEqual(1)
    await picks.first().click()
    const groupUnit = page.locator('[data-testid^=unit-group-]')
    observe(info, `group units in the paper: ${await groupUnit.count()}`)
    saveState(info, { paper: { id, title, published: false, hasAdminQuestion: true } })
    await expect(groupUnit.first(), 'a D90 group placed as one unit').toBeVisible()
  })

  test('S3c Terbit: the paper publishes (review shows no blockers)', async ({ page }, info) => {
    const st = readState(info)
    test.skip(!st.paper?.id, 'Blocked: S3b created no paper')
    await login(page, ADMIN)
    await page.goto(`/admin/spm/kertas/${st.paper!.id}`)
    await expect(page.getByTestId('paper-editor-page')).toBeVisible()
    const check = await page.getByTestId('budget-check').innerText()
    observe(info, `budget check: ${check.replace(/\s+/g, ' ').slice(0, 240)}`)
    test.skip(
      !st.paper?.hasAdminQuestion,
      "Blocked: S3b placed none of the admin's questions in the paper",
    )
    const publish = page.getByTestId('paper-publish')
    await expect(publish, 'Terbitkan enabled').toBeEnabled()
    await publish.click()
    await page
      .getByRole('button', { name: /^(Ya|Terbitkan|Terbit)/ })
      .last()
      .click()
      .catch(() => undefined)
    await expect(
      page.getByTestId('paper-unpublish'),
      'published paper offers Tarik balik',
    ).toBeVisible({ timeout: 20_000 })
    saveState(info, { paper: { ...st.paper!, published: true } })
    await expectNoHScroll(page)
  })

  test('S4a pupil T4 sits the admin paper in Bijak SPM and submits (Hantar)', async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(!st.paper?.published, 'Blocked: no admin-built paper was published (S3)')
    await login(page, PUPIL_T4)
    await page.goto('/spm/bijak')
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    const card = page.locator('[data-testid^=paper-]', { hasText: st.paper!.title }).first()
    await expect(card, 'admin paper on the hub').toBeVisible()
    await card.locator('[data-testid^=open-]').click()
    await expect(page.getByTestId('bijak-cover')).toBeVisible()
    await page.locator('[data-ds=hero-cta]').click()
    await expect(page.getByTestId('attempt-shell')).toBeVisible()
    await expect(page.getByTestId('attempt-loading')).toHaveCount(0)
    await expect(page.getByTestId('next').or(page.getByTestId('submit')).first()).toBeVisible()
    const id = /percubaan\/([^/?#]+)/.exec(page.url())?.[1] ?? ''
    await expectNoHScroll(page)
    while (await page.getByTestId('next').isVisible()) await page.getByTestId('next').click()
    await expect(page.getByTestId('submit')).toBeVisible()
    await page.getByTestId('submit').click()
    await page.getByTestId('confirm-submit').click()
    await expect(page.getByTestId('win-screen')).toBeVisible()
    saveState(info, { attempt: { id, submitted: true } })
    await expectNoHScroll(page)
  })

  test('S4b pupil self-marks a written part (Simpan markah)', async ({ page }, info) => {
    const st = readState(info)
    test.skip(!st.attempt?.submitted, 'Blocked: no submitted attempt of the admin paper (S4a)')
    await login(page, PUPIL_T4)
    await page.goto(`/spm/bijak/percubaan/${st.attempt!.id}/keputusan`)
    await selfMarkOne(page, info)
    await expectNoHScroll(page)
  })

  test('S4c pupil sees the result (score / max, per Bahagian)', async ({ page }, info) => {
    const st = readState(info)
    test.skip(!st.attempt?.submitted, 'Blocked: no submitted attempt of the admin paper (S4a)')
    await login(page, PUPIL_T4)
    await page.goto(`/spm/bijak/percubaan/${st.attempt!.id}/keputusan`)
    await expect(page.getByTestId('win-screen')).toBeVisible()
    await expect(page.getByTestId('section-score').first()).toBeVisible()
    await expectNoHScroll(page)
  })

  test('S4d pupil presses Cuba Lagi: a new blank attempt of the same paper', async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(!st.attempt?.submitted, 'Blocked: no submitted attempt of the admin paper (S4a)')
    await login(page, PUPIL_T4)
    await page.goto(`/spm/bijak/percubaan/${st.attempt!.id}/keputusan`)
    await page
      .getByRole('button', { name: /Cuba lagi/i })
      .first()
      .click()
    await expect(page).toHaveURL(/\/spm\/bijak\/percubaan\/[^/]+$/)
    expect(page.url()).not.toContain(st.attempt!.id)
    await expect(page.getByTestId('attempt-shell')).toBeVisible()
  })

  test('S4e pupil T5 sees the admin paper on the Bijak SPM hub', async ({ page }, info) => {
    const st = readState(info)
    test.skip(!st.paper?.published, 'Blocked: no admin-built paper was published (S3)')
    await login(page, PUPIL_T5)
    await page.goto('/spm/bijak')
    await expect(
      page.locator('[data-testid^=paper-]', { hasText: st.paper!.title }).first(),
    ).toBeVisible()
    await expectNoHScroll(page)
  })

  test("S5a Databank Soalan SPM receives the admin's approved MCQs (count rises)", async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(st.baseline?.databankMath === undefined, 'Blocked: S0 baseline missing')
    const served = st.approvedM04 || st.approvedViaApi || 0
    test.skip(!served, 'Blocked: no Bank Soalan question reached Diluluskan (S2a UI, S2c API)')
    await login(page, PUPIL_T4)
    const now = await cardCount(page, '/spm/tahun-lepas', 'databank-card-MATH', 'databank-count')
    observe(
      info,
      `path: ${st.approvedM04 ? 'approved via UI (S2a)' : 'approved via API (S2c)'}; Databank MATH ${st.baseline!.databankMath} -> ${now}; MCQs this run: ${served}`,
    )
    await expectNoHScroll(page)
    expect(now, 'Databank Matematik count rose by the admin MCQs').toBe(
      (st.baseline!.databankMath ?? 0) + served,
    )
  })

  test("S5b Latih Tubi SPM receives the admin's approved MCQs (count rises)", async ({
    page,
  }, info) => {
    const st = readState(info)
    test.skip(st.baseline?.latihTubiMath === undefined, 'Blocked: S0 baseline missing')
    const served = st.approvedM04 || st.approvedViaApi || 0
    test.skip(!served, 'Blocked: no Bank Soalan question reached Diluluskan (S2a UI, S2c API)')
    await login(page, PUPIL_T4)
    const now = await cardCount(page, '/spm/latih-tubi', 'latih-tubi-card-MATH', 'latih-tubi-count')
    observe(
      info,
      `path: ${st.approvedM04 ? 'approved via UI (S2a)' : 'approved via API (S2c)'}; Latih Tubi SPM MATH ${st.baseline!.latihTubiMath} -> ${now}; MCQs this run: ${served}`,
    )
    await expectNoHScroll(page)
    expect(now, 'Latih Tubi SPM Matematik count rose by the admin MCQs').toBe(
      (st.baseline!.latihTubiMath ?? 0) + served,
    )
  })

  test("S5c Soalan by Chapter lists the admin question's Bab", async ({ page }, info) => {
    const st = readState(info)
    test.skip(!st.formQuestion?.chapter, 'Blocked: S1a could not choose a Bab (empty Bab list)')
    test.skip(
      !(st.approvedM04 || st.approvedViaApi),
      'Blocked: no Bank Soalan question reached Diluluskan (S2a UI, S2c API)',
    )
    await login(page, PUPIL_T4)
    observe(
      info,
      `path: ${st.approvedM04 ? 'approved via UI (S2a)' : 'approved via API (S2c)'}; Bab ${st.formQuestion!.chapter}`,
    )
    await page.goto('/practice/chapter')
    const grid = page.getByTestId('chapter-subject-grid')
    await expect(
      grid.getByText('Matematik').first(),
      'Matematik listed in Soalan by Chapter',
    ).toBeVisible()
    await grid.getByText('Matematik').first().click()
    const name = st.formQuestion!.chapter!.replace(/^Bab \d+:\s*/, '')
    await expect(page.getByText(name).first(), `Bab "${name}" listed`).toBeVisible()
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
    saveState(info, { attempt: readState(info).attempt ?? { id: attemptId, submitted: true } })
    writeFileSync(join(STATE_DIR, `${RUN}-${info.project.name}-b02.txt`), attemptId)
    observe(
      info,
      `result headline: ${(await page.getByTestId('win-screen').innerText()).split('\n').slice(0, 3).join(' / ')}`,
    )
    await selfMarkOne(page, info)
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
    const retry = page
      .getByRole('button', { name: /Cuba lagi/i })
      .or(page.getByRole('link', { name: /Cuba lagi/i }))
      .first()
    await expect(retry, '"Cuba lagi" on the result').toBeVisible()
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
