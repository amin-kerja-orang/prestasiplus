/**
 * Http twin of the intake review flow (AZ-20): Admin Pusat uploads a generated text-layer PDF, asks
 * the server to extract it (AI_PROVIDER=mock, job worker on), edits and confirms the extracted
 * questions, reviews them in the queue, accepts one (creates a Draf question) and finds it in the
 * Bijak bank. Runs against the real API (BE-37 files, BE-38 items, BE-09 questions).
 *
 * WRITES REAL DATA (a batch, items and one Draf question per run). Every run and every viewport
 * project builds its own PDF (the backend refuses a file hash that another batch already imported)
 * and a token in the source text, the stem and the file name. The accepted question is deleted at
 * the end (the batch and its items stay, there is no delete route).
 *
 * Runs only with BIJAK_API_BASE / BASE_URL and credentials from the environment (see http-creds):
 *   BIJAK_ADMIN_PUSAT_USER / BIJAK_ADMIN_PUSAT_PASS (or E2E_DEMO_PASSWORD)
 * The API must run with AI_PROVIDER=mock and the job worker on (JOBS_WORKER_ENABLED=true), and the
 * subject must exist in the curriculum: Sejarah (SEJ) is the Bijak subject whose code matches it.
 */
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { expectNoHorizontalScrollHttp, HTTP_MODE } from './bijak-flow'
import { demoCreds, NEEDS_PASSWORD } from './http-creds'

const { user: ADMIN_USER, pass: ADMIN_PASS } = demoCreds('adminPusat')

test.skip(!HTTP_MODE, 'needs BIJAK_API_BASE or BASE_URL (integration stack)')
test.skip(!ADMIN_USER || !ADMIN_PASS, NEEDS_PASSWORD)

/**
 * pdf.js (the browser-side page reader of the upload screen) calls `Map.prototype.getOrInsertComputed`,
 * which only the newest Chromium has. Older test browsers get the standard behaviour (tc39
 * upsert proposal) so the upload runs; a current browser is untouched.
 */
const UPSERT_SHIM = `
for (const C of [Map, WeakMap]) {
  if (!C.prototype.getOrInsertComputed) {
    C.prototype.getOrInsertComputed = function (key, fn) {
      if (this.has(key)) return this.get(key)
      const v = fn(key)
      this.set(key, v)
      return v
    }
  }
  if (!C.prototype.getOrInsert) {
    C.prototype.getOrInsert = function (key, v) {
      if (this.has(key)) return this.get(key)
      this.set(key, v)
      return v
    }
  }
}
`

async function login(page: Page): Promise<void> {
  await page.addInitScript(UPSERT_SHIM)
  await page.goto('/login')
  await page.getByTestId('login-email').fill(ADMIN_USER)
  await page.getByTestId('login-password').fill(ADMIN_PASS ?? '')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))
}

/** A one-page text-layer PDF (plain Helvetica text, ASCII only), no dependency. */
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

/**
 * The mock extractor reads "N. stem [M markah]", "A. option" and "Jawapan: 1-B 2-A"; the words in
 * the stems make it pick a Sejarah unit of the server curriculum ("kemerdekaan persekutuan tanah
 * melayu", "perjuangan rakyat ke arah kemerdekaan tanah air").
 */
function paperLines(token: string): string[] {
  return [
    `Kertas percubaan ${token}`,
    '1. Pada tahun berapakah kemerdekaan persekutuan tanah melayu dicapai? [1 markah]',
    'A. 1945',
    'B. 1957',
    'C. 1963',
    'D. 1971',
    '2. Apakah perjuangan rakyat ke arah kemerdekaan tanah air yang utama? [1 markah]',
    'A. Rundingan',
    'B. Peperangan',
    'C. Pembelian',
    'D. Pindaan',
    'Jawapan: 1-B 2-A',
  ]
}

/** Sets the bank filter: the inline form from 768 px, the filter sheet below it. */
async function filterBank(page: Page, status: string, search: string): Promise<void> {
  await page.getByTestId('bank-search').fill(search)
  const open = page.locator('[data-ds=filter-open]')
  if (await open.isVisible()) {
    await open.click()
    await page.getByTestId('bank-status').selectOption(status)
    await page.locator('[data-ds=filter-sheet] button').first().click() // "Gunakan"
  } else {
    await page.getByTestId('bank-status').selectOption(status)
    await page.getByTestId('bank-search').press('Enter')
  }
}

test.describe('Intake review over HTTP @bijak @api', () => {
  test('upload, extract, edit, review, accept and find the Draf question in the bank @bijak @api', async ({
    page,
  }, testInfo) => {
    test.setTimeout(240_000)
    const token = `E2E${Date.now().toString(36)}${testInfo.project.name}`.replace(/[^A-Za-z0-9]/g, '')
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await login(page)
    try {
      /* ---- upload */
      await page.goto('/admin/spm/soalan/muat-naik')
      await expect(page.getByTestId('intake-upload-page')).toBeVisible()
      await expectNoHorizontalScrollHttp(page)
      const subject = await page
        .getByTestId('intake-subject')
        .locator('option', { hasText: /^Sejarah$/ })
        .first()
        .getAttribute('value')
      expect(subject, 'a "Sejarah" subject option').toBeTruthy()
      await page.getByTestId('intake-subject').selectOption(subject ?? '')
      await page.getByTestId('intake-kertas').selectOption('2')
      await page.getByTestId('intake-source').fill(`Sekolah Contoh ${token}`)
      await page.getByTestId('intake-copyright').selectOption('sendiri')
      await page.getByTestId('intake-file').setInputFiles({
        name: `kertas-${token}.pdf`,
        mimeType: 'application/pdf',
        buffer: makePdf(paperLines(token)),
      })
      await expect(page.getByTestId('intake-submit')).toBeEnabled()
      await page.getByTestId('intake-submit').click()
      await page.waitForURL(/\/admin\/spm\/soalan\/ekstrak\/[^/]+$/, { timeout: 60_000 })
      const batchId = new URL(page.url()).pathname.split('/').pop() ?? ''
      await expect(page.getByTestId('intake-review-page')).toBeVisible()
      await expectNoHorizontalScrollHttp(page)

      /* ---- extraction (server side, mock provider) */
      const panel = page.getByTestId('extract-panel')
      await expect(panel).toBeVisible()
      const start = page.getByTestId('extract-start')
      await expect(start).toBeEnabled({ timeout: 60_000 }) // the PDF is read first
      await start.click()
      await expect(page.getByTestId('question-card')).toHaveCount(2, { timeout: 90_000 })
      await expect(panel).toHaveCount(0)
      await expect(page.getByText('Pengekstrak: mock')).toBeVisible()
      await expectNoHorizontalScrollHttp(page)

      /* ---- edit the first question, confirm the low SP of both, wait for the autosave */
      const cards = page.getByTestId('question-card')
      const stem = page.getByTestId('q-stem').first()
      await expect(stem).toBeVisible()
      await stem.fill(`Pada tahun berapakah Persekutuan Tanah Melayu merdeka? ${token}`)
      await page.getByTestId('confirm-tag.sp').first().click()
      await cards.nth(1).getByRole('button').first().click()
      await page.getByTestId('confirm-tag.sp').last().click()
      await expect(page.getByTestId('save-state')).toHaveText('Semua perubahan disimpan', {
        timeout: 20_000,
      })

      // The edit is on the server: a fresh load shows it.
      await page.reload()
      await expect(page.getByTestId('question-card')).toHaveCount(2)
      await expect(page.getByTestId('q-stem').first()).toHaveValue(new RegExp(token))
      await expect(page.getByTestId('issues-toggle')).toContainText('Sedia dihantar')

      /* ---- the gate passes: "Hantar untuk semakan" goes to the queue */
      await page.getByTestId('submit-review').click()
      await expect(page.getByTestId('submitted-note')).toBeVisible()
      await page.getByTestId('goto-queue').click()

      /* ---- review queue */
      await expect(page.getByTestId('review-queue-page')).toBeVisible()
      await expectNoHorizontalScrollHttp(page)
      const table = page.getByTestId('queue-table')
      const mine = table.getByText(token).first()
      await expect(mine).toBeVisible({ timeout: 30_000 })
      await mine.click()
      await expect(page.getByTestId('review-item-page')).toBeVisible()
      await expect(page.getByTestId('review-gate')).toContainText('Semua syarat dipenuhi')
      await expect(page.getByTestId('action-correct')).toHaveCount(0) // no route for corrections
      await expectNoHorizontalScrollHttp(page)
      await page.getByTestId('action-publish').click() // "Terima (Draf)"
      await expect(page.getByTestId('review-queue-page')).toBeVisible()

      // The accepted item moved to "Diterima (Draf)".
      await page.getByTestId('queue-stat-draf').click()
      await expect(page.getByTestId('queue-table').getByText(token).first()).toBeVisible({
        timeout: 30_000,
      })

      /* ---- the Draf question is in the Bijak bank */
      await page.goto('/admin/spm/soalan')
      await expect(page.getByTestId('bank-page')).toBeVisible()
      await filterBank(page, 'draf', token)
      const row = page.getByTestId('bank-table').getByText(token).first()
      await expect(row).toBeVisible({ timeout: 30_000 })
      await expectNoHorizontalScrollHttp(page)
      await row.click() // a row (a card below 768 px) opens the preview drawer
      await expect(page.getByTestId('bank-drawer')).toBeVisible()
      await expect(page.getByTestId('bank-drawer')).toContainText('Draf')

      // The batch shows only the question that is still to decide.
      await page.goto(`/admin/spm/soalan/ekstrak/${batchId}`)
      await expect(page.getByTestId('question-card')).toHaveCount(1)
      expect(errors).toEqual([])
    } finally {
      // Cleanup: the Draf question (the batch and its items have no delete route).
      const csrf = ((await (await page.request.get('/api/session')).json()) as { data: { csrf: string } })
        .data.csrf
      const found = await page.request.get(`/api/questions?search=${token}`)
      const rows = ((await found.json()) as { data?: { id: string }[] }).data ?? []
      for (const q of rows) {
        await page.request.delete(`/api/questions/${q.id}`, { headers: { 'x-csrf-token': csrf } })
      }
    }
  })

  test('the queue, the bank and the intake list load for Admin Pusat @bijak @api', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await login(page)
    for (const [route, testId] of [
      ['/admin/spm/semakan', 'review-queue-page'],
      ['/admin/spm/soalan', 'bank-page'],
      ['/admin/spm/soalan/ekstrak', 'intake-list-page'],
    ] as const) {
      await page.goto(route)
      await expect(page.getByTestId(testId)).toBeVisible()
      await expect(page.getByTestId('unavailable-state')).toHaveCount(0)
      await expect(page.getByText(/^Tidak dapat memuatkan/)).toHaveCount(0)
      await expectNoHorizontalScrollHttp(page)
    }
    expect(errors).toEqual([])
  })
})
