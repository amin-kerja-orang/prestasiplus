/**
 * S2-T02 against the real stack: `Kiriman Guru` reads the intake items of teacher papers
 * (R1-ADM-Q-12, FR-ADM-Q12.1, FR-ADM-Q12.5), at 375 / 768 / 1280.
 *
 *   BASE_URL=http://localhost:5192 E2E_DEMO_PASSWORD=<demo password> \
 *     npx playwright test -c playwright.http.config.ts e2e/m04-question-bank/t7-submissions.spec.ts
 *
 * Writes: one `source=guru` batch per run and viewport, sent by Admin Pusat, because the stack keeps
 * INTAKE_TEACHER_ENABLED off for teachers. One of its items is rejected; there is no delete route.
 * Needs AI_PROVIDER=mock and the job worker on.
 */
import type { APIRequestContext, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { expectNoHorizontalScrollHttp, HTTP_MODE } from '../bijak/bijak-flow'
import { demoCreds, NEEDS_PASSWORD } from '../bijak/http-creds'

const { user: ADMIN_USER, pass: ADMIN_PASS } = demoCreds('adminPusat')

test.skip(!HTTP_MODE, 'needs BIJAK_API_BASE or BASE_URL (integration stack)')
test.skip(!ADMIN_USER || !ADMIN_PASS, NEEDS_PASSWORD)

const PATH = '/admin/question-submissions'
const INTRO =
  'Kertas yang dihantar guru diproses melalui aliran import Studio (DOCX/OCR → semakan → terbit).'

/** A one-page text-layer PDF the mock extractor reads as `count` questions. */
function paperPdf(token: string, count: number): Buffer {
  const lines = [token]
  for (let n = 1; n <= count; n += 1) {
    lines.push(`${String(n)}. Soalan ${token} nombor ${String(n)} berkaitan sains [1 markah]`)
    lines.push('A. Satu', 'B. Dua', 'C. Tiga', 'D. Empat')
  }
  lines.push(`Jawapan: ${Array.from({ length: count }, (_, i) => `${String(i + 1)}-A`).join(' ')}`)
  const content = `BT /F1 11 Tf 40 780 Td 14 TL ${lines.map((l) => `(${l}) Tj T*`).join(' ')} ET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${String(content.length)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${String(i + 1)} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${String(objs.length + 1)}\n0000000000 65535 f \n`
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${String(objs.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`
  return Buffer.from(out)
}

interface Sent {
  token: string
  batchId: string
  itemIds: string[]
  fileName: string
}

async function loginTo(request: APIRequestContext): Promise<string> {
  const login = await request.post('/api/auth/login', {
    data: { identifier: ADMIN_USER, password: ADMIN_PASS },
  })
  expect(login.ok()).toBe(true)
  const session = (await (await request.get('/api/session')).json()) as { data: { csrf: string } }
  return session.data.csrf
}

/** Sends a teacher paper and waits until the server has read its items. */
async function sendPaper(request: APIRequestContext, csrf: string): Promise<Sent> {
  const token = `KIRIMAN${String(Date.now())}`
  const fileName = `${token}.pdf`
  const sent = await request.post('/api/guru/question-papers', {
    headers: { 'x-csrf-token': csrf },
    multipart: {
      jenisSoalan: 'Trial Paper',
      subject: 'Sains',
      tingkatan: '4',
      tahun: '2025',
      disediakanOleh: 'Pengarang Ujian',
      files: { name: fileName, mimeType: 'application/pdf', buffer: paperPdf(token, 2) },
    },
  })
  expect(sent.status(), await sent.text()).toBe(201)
  const batchId = ((await sent.json()) as { data: { id: string } }).data.id
  // The PDF is read first; the extract route has a small limit per minute, so it is called once.
  await expect
    .poll(
      async () => {
        const res = await request.get(`/api/intake/batches/${batchId}`)
        return ((await res.json()) as { data: { status: string } }).data.status
      },
      { timeout: 60_000, intervals: [2_000] },
    )
    .toBe('ready_for_review')
  const extract = await request.post(`/api/intake/batches/${batchId}/extract`, {
    headers: { 'x-csrf-token': csrf },
    data: {},
  })
  expect(extract.status(), await extract.text()).toBeLessThan(300)
  let itemIds: string[] = []
  await expect
    .poll(
      async () => {
        const res = await request.get(`/api/intake/items?batchId=${batchId}&source=guru`)
        itemIds = ((await res.json()) as { data: { id: string }[] }).data.map((r) => r.id)
        return itemIds.length
      },
      { timeout: 90_000, intervals: [2_000] },
    )
    .toBe(2)
  return { token, batchId, itemIds, fileName }
}

const table = (page: Page) => page.getByTestId('submissions-table')

/** Below 768 px the filter sits in a sheet behind `filter-open`. */
async function openFilter(page: Page): Promise<void> {
  if ((page.viewportSize()?.width ?? 0) >= 768) return
  await page.locator('[data-ds="filter-open"]').click()
  await expect(page.locator('[data-ds="filter-sheet"]')).toBeVisible()
}

async function applyFilter(page: Page, status: string): Promise<void> {
  await openFilter(page)
  await page.getByTestId('submissions-status').selectOption(status)
  await page.getByRole('button', { name: 'Tapis' }).click()
  await expect(page).toHaveURL(new RegExp(`status=${status}`))
}

test.describe('R1-ADM-Q-12 Kiriman Guru @api', () => {
  // One paper per viewport: the tests only read it, except the rejection of its first item.
  test.describe.configure({ mode: 'serial' })
  let sent: Sent

  test.beforeAll(async ({ playwright, baseURL }) => {
    test.setTimeout(180_000)
    const request = await playwright.request.newContext({ baseURL: baseURL ?? '' })
    sent = await sendPaper(request, await loginTo(request))
    await request.dispose()
  })

  test.beforeEach(async ({ page }) => {
    await loginTo(page.request)
    await page.goto(PATH)
    await expect(table(page)).toContainText(sent.token)
  })

  test('header, tiles, filter and rows by role label, with no page scroll @api', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kertas Soalan Guru')
    await expect(page.getByTestId('pentadbiran-subtitle')).toHaveText(INTRO)
    await expect(page.locator('[data-testid^="submissions-count-"]')).toHaveCount(4)
    for (const [key, label] of [
      ['all', 'Jumlah'],
      ['pending', 'Pending'],
      ['processing', 'Processing'],
      ['done', 'Selesai'],
    ] as const) {
      await expect(page.getByTestId(`submissions-count-${key}`)).toContainText(label)
    }
    await openFilter(page)
    await expect(page.getByTestId('submissions-status').locator('option')).toHaveText([
      'Semua Status',
      'Pending',
      'Processing',
      'Selesai',
      'Ditolak',
    ])
    await page.keyboard.press('Escape')
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      await expect(page.locator('thead th')).toHaveText([
        'Guru / Sekolah',
        'Tajuk',
        'Fail',
        'Status',
        'Tarikh',
        'Tindakan',
      ])
    }
    await expect(table(page)).not.toContainText('@')
    await expect(table(page)).not.toContainText('Fungsi ini belum tersedia')
    await expect(page.getByTestId('submission-file').first()).toContainText(sent.fileName)
    await expectNoHorizontalScrollHttp(page)
  })

  test('filtering by Pending keeps the item, Selesai drops it, and Reset brings it back @api', async ({
    page,
  }) => {
    await applyFilter(page, 'Pending')
    await expect(table(page)).toContainText(sent.token)

    await applyFilter(page, 'Selesai')
    await expect(table(page)).not.toContainText(sent.token)

    await openFilter(page)
    await page.getByRole('button', { name: 'Reset' }).click()
    await expect(page).not.toHaveURL(/status=/)
    await expect(table(page)).toContainText(sent.token)
    await expectNoHorizontalScrollHttp(page)
  })

  test('a status outside OPT-KIRIMAN-STATUS is named, not a blank list @api', async ({ page }) => {
    await page.goto(`${PATH}?status=done`)
    await expect(page.getByTestId('submissions-error')).toContainText('Nilai penapis tidak sah.')
    await expectNoHorizontalScrollHttp(page)
  })

  test('Semak opens the review screen of the batch @api', async ({ page }) => {
    await page.getByTestId('submission-semak').first().click()
    await expect(page).toHaveURL(new RegExp(`/admin/spm/soalan/ekstrak/${sent.batchId}$`))
  })

  test('a rejected item moves to Ditolak through the intake route @api', async ({ page }) => {
    const res = await page.request.post(`/api/intake/items/${sent.itemIds[0] ?? ''}/reject`, {
      headers: { 'x-csrf-token': await loginTo(page.request) },
      data: { reason: 'Tidak sesuai untuk ujian.' },
    })
    expect(res.status(), await res.text()).toBe(200)
    await page.goto(`${PATH}?status=Ditolak`)
    await expect(table(page)).toContainText(sent.token)
    await expect(table(page)).toContainText('Ditolak')
  })

  test('a file link downloads the original @api', async ({ page }) => {
    const link = page.getByTestId('submission-file').first()
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()])
    expect(download.suggestedFilename()).toContain(sent.token)
  })
})
