/**
 * S2-T02 against the real stack: an open duplicate blocks Terima until it is resolved (FR-QA-36, AC-QA-36).
 *
 * Writes: one batch per run and viewport, sent by Admin Pusat, with two questions of the same text.
 * Needs AI_PROVIDER=mock and the job worker on.
 */
import type { APIRequestContext } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { expectNoHorizontalScrollHttp, HTTP_MODE } from './bijak-flow'
import { demoCreds, NEEDS_PASSWORD } from './http-creds'

const { user: ADMIN_USER, pass: ADMIN_PASS } = demoCreds('adminPusat')

test.skip(!HTTP_MODE, 'needs BIJAK_API_BASE or BASE_URL (integration stack)')
test.skip(!ADMIN_USER || !ADMIN_PASS, NEEDS_PASSWORD)

function paperPdf(lines: string[]): Buffer {
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

async function login(request: APIRequestContext): Promise<string> {
  const res = await request.post('/api/auth/login', { data: { identifier: ADMIN_USER, password: ADMIN_PASS } })
  expect(res.ok()).toBe(true)
  return ((await (await request.get('/api/session')).json()) as { data: { csrf: string } }).data.csrf
}

test('an open duplicate blocks Terima until Diketepikan @api', async ({ page }) => {
  test.setTimeout(180_000)
  const csrf = await login(page.request)
  const token = `PENDUA${String(Date.now())}`
  const stem = `Soalan ${token} tentang fungsi jantung manusia [1 markah]`
  const lines = [token, `1. ${stem}`, 'A. Satu', 'B. Dua', 'C. Tiga', 'D. Empat', `2. ${stem}`, 'A. Satu', 'B. Dua', 'C. Tiga', 'D. Empat', 'Jawapan: 1-A 2-A']
  const sent = await page.request.post('/api/guru/question-papers', {
    headers: { 'x-csrf-token': csrf },
    multipart: {
      // QuestionSetPaperFields since #684 (S6-T06): OPT-JENIS-HANTARAN slug, levelId, year, preparedBy, and the confirmed answer scheme.
      paperType: 'trial',
      subject: 'Sains',
      levelId: '4',
      year: '2025',
      preparedBy: 'Pengarang Ujian',
      answerSchemeConfirmed: 'true',
      files: { name: `${token}.pdf`, mimeType: 'application/pdf', buffer: paperPdf(lines) },
    },
  })
  expect(sent.status(), await sent.text()).toBe(201)
  const batchId = ((await sent.json()) as { data: { id: string } }).data.id
  await expect
    .poll(async () => ((await (await page.request.get(`/api/intake/batches/${batchId}`)).json()) as { data: { status: string } }).data.status, { timeout: 60_000, intervals: [2_000] })
    .toBe('ready_for_review')
  const extract = await page.request.post(`/api/intake/batches/${batchId}/extract`, { headers: { 'x-csrf-token': csrf }, data: {} })
  expect(extract.status(), await extract.text()).toBeLessThan(300)
  await expect
    .poll(async () => ((await (await page.request.get(`/api/intake/items?batchId=${batchId}`)).json()) as { data: unknown[] }).data.length, { timeout: 90_000, intervals: [2_000] })
    .toBe(2)

  await page.goto(`/admin/spm/soalan/ekstrak/${batchId}`)
  await expect(page.getByTestId('item-provenance')).toContainText('Cadangan Provenans')
  await expect(page.getByTestId('item-provenance')).toContainText('Tahun 2025')
  // The second copy carries the finding; `Seterusnya` opens it.
  await page.getByTestId('item-next').click()
  await expect(page.getByTestId('item-counter')).toContainText('Item 2 / 2')
  const findings = page.getByTestId('item-duplicates')
  await expect(findings).toContainText('Sama')
  await expect(findings).toContainText('Terbuka')
  await expect(page.getByTestId('item-accept')).toBeDisabled()
  await expectNoHorizontalScrollHttp(page)
  await page.getByTestId('item-duplicate-dismiss').click()
  // The same item stays open after the decision.
  await expect(page.getByTestId('item-counter')).toContainText('Item 2 / 2')
  await expect(findings).toContainText('Diketepikan')
  await expect(page.getByTestId('item-duplicate-dismiss')).toHaveCount(0)
  await expect(page.getByTestId('item-accept')).toBeEnabled()
})
