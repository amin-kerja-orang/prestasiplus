import type { AiCapabilities, AiExtractedPaper, AiExtractRequest, AiGenerateTextRequest, AiGenerateTextResult, AiProviderId, AiSuggestTagsRequest } from '@pp/contract'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type { AiTagSuggestion, ExtractedDraftPaper, ExtractionProvider, ProviderCallOptions, ProviderHealth, Tokens } from '../../src/modules/ai-extraction/ai.types'
import { MASK, Redactor } from '../../src/modules/ai-extraction/redaction/redactor'
import { bootWorkflowApp, draft, extractAndRun, loginAs, paper, readyBatch, type LoggedIn, type WorkflowTestApp } from './helpers'

/**
 * #189 (go-live P1, security): the intake workflow reaches the AI provider through the real path (`AI_EXTRACTOR` port →
 * BE-36's `AiExtractorAdapter` → `AiExtractionService` → provider adapter). These tests record what the provider ADAPTER
 * receives, the last step before the network, and prove that:
 *  - it is text only: no image bytes, no image reference and no URL, even for an adapter that says it accepts images;
 *  - it is redacted exactly once, by BE-36's redactor (no second redactor, no redaction of already-redacted text);
 *  - a provider that echoes a masked value gets it masked again before anything is stored.
 */

/** A provider adapter that records every call. It claims vision, so nothing but the service can keep images away from it. */
class RecordingProvider implements ExtractionProvider {
  readonly id: AiProviderId = 'mock'
  readonly model = 'recording-1'
  readonly capabilities: AiCapabilities = { vision: true, jsonMode: true, maxPagesPerCall: 200 }
  readonly calls: AiExtractRequest[] = []
  answer: (req: AiExtractRequest) => AiExtractedPaper = () => {
    throw new Error('RecordingProvider.answer not set')
  }

  isConfigured(): boolean {
    return true
  }

  extractPaper(input: AiExtractRequest, _options: ProviderCallOptions): Promise<{ paper: ExtractedDraftPaper } & Tokens> {
    void _options
    this.calls.push(structuredClone(input))
    // The provider part only: the service adds `usage` and `redaction`.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { usage, redaction, ...rest } = this.answer(input)
    return Promise.resolve({ paper: rest, tokensIn: 1, tokensOut: 1 })
  }

  suggestTags(_input: AiSuggestTagsRequest, _options: ProviderCallOptions): Promise<{ suggestions: AiTagSuggestion[] } & Tokens> {
    void _input
    void _options
    return Promise.reject(new Error('not used by the intake workflow'))
  }

  generateText(_input: AiGenerateTextRequest, _options: ProviderCallOptions): Promise<AiGenerateTextResult> {
    void _input
    void _options
    return Promise.reject(new Error('not used by the intake workflow'))
  }

  healthCheck(_options: ProviderCallOptions): Promise<ProviderHealth> {
    void _options
    return Promise.resolve({ ok: true, latencyMs: 0, tokensIn: 0, tokensOut: 0 })
  }
}

const provider = new RecordingProvider()
let t: WorkflowTestApp
let teacher: LoggedIn

beforeAll(async () => {
  t = await bootWorkflowApp({}, { provider })
  teacher = await loginAs(t, 'guru@demo.test')
}, 120_000)
afterAll(async () => {
  await t.close()
})
afterEach(() => {
  vi.restoreAllMocks()
})

const setPage = (batchId: string, pageNo: number, text: string | null, ocrStatus?: string) =>
  t.db.query(
    `update intake_pages set text = $3${ocrStatus ? `, ocr_status = '${ocrStatus}'` : ''}
     where intake_file_id in (select id from intake_files where batch_id = $1) and page_no = $2`,
    [batchId, pageNo, text],
  )

/** Runs one extraction and returns the one request the provider adapter received for it. */
async function runOne(batchId: string): Promise<AiExtractRequest> {
  const before = provider.calls.length
  await extractAndRun(t, teacher, batchId)
  expect(provider.calls.length - before).toBe(1)
  return provider.calls[before]!
}

describe('the real path is wired (sanity)', () => {
  it('the extraction reaches the provider adapter, not the scripted port mock, and its items are stored', async () => {
    provider.answer = () => paper([draft(t.codes, '1')])
    const { batchId } = await readyBatch(t, teacher)
    await runOne(batchId)
    expect(t.ai.calls).toHaveLength(0)
    const rows = await t.db.query<{ n: string }>(`select count(*)::text n from intake_items where batch_id = $1`, [batchId])
    expect(rows[0]?.n).toBe('1')
  })
})

describe('text only (AC-8, #189): no page image reaches the provider adapter', () => {
  it('a scanned, OCR-ed paper: the adapter gets OCR text, no image bytes, no image reference and no URL', async () => {
    provider.answer = () => paper([draft(t.codes, '1')])
    const { batchId } = await readyBatch(t, teacher, { pages: 5 })
    const rows = await t.db.query<{ id: string; image_file_id: string | null }>(
      `select p.id::text, p.image_file_id::text from intake_pages p join intake_files f on f.id = p.intake_file_id where f.batch_id = $1 order by p.page_no`,
      [batchId],
    )
    expect(rows).toHaveLength(5)
    // Give every page a stored image and OCR text, as a scanned paper has; page 2's OCR failed.
    const img = await t.db.query<{ id: string }>(`select id::text from files order by id limit 1`)
    for (const r of rows) {
      await t.db.query(
        `update intake_pages set image_file_id = coalesce(image_file_id, $2::bigint), width = 1240, height = 1754, text_source = 'ocr', ocr_status = 'done', ocr_confidence = 90
         where id = $1`,
        [r.id, img[0]!.id],
      )
    }
    await setPage(batchId, 2, null, 'failed')
    await setPage(batchId, 4, 'Nama: Contoh Penuh Calon\nSoalan 2. Hitung 4 + 5.')

    const req = await runOne(batchId)
    expect(Object.keys(req).sort()).toEqual(['kertas', 'pages', 'subject', 'taxonomy'])
    expect(req.images).toBeUndefined()
    // Each page is text and its OCR facts only; no page carries a file id, a size or a link.
    for (const p of req.pages) expect(Object.keys(p).sort()).toEqual(['confidence', 'page', 'source', 'text'])
    expect(req.pages.every((p) => p.source === 'ocr')).toBe(true)
    expect(req.pages.map((p) => p.page)).not.toContain(2)
    const sent = JSON.stringify(req)
    expect(sent).not.toMatch(/"images"|"fileId"|"width"|"height"|data:image|base64|imageKey|storageKey|https?:\/\/|\/api\/files/)
    expect(sent).not.toContain('Contoh Penuh Calon')
    expect(sent).toContain('Hitung 4 + 5')
  })

  it('images added to the request before the service are dropped by it (fail closed)', async () => {
    provider.answer = () => paper([draft(t.codes, '1')])
    const { batchId } = await readyBatch(t, teacher)
    // A future caller that puts image references on the port request: the service still sends text only.
    const { AiExtractionService } = await import('../../src/modules/ai-extraction/ai-extraction.service')
    const svc = t.app.get(AiExtractionService)
    const original = svc.extractPaper.bind(svc)
    vi.spyOn(svc, 'extractPaper').mockImplementation((req, ctx, signal) =>
      original({ ...req, images: [{ page: 1, fileId: '987654321', width: 10, height: 10 }] }, ctx, signal),
    )
    const req = await runOne(batchId)
    expect(req.images).toBeUndefined()
    expect(JSON.stringify(req)).not.toContain('987654321')
  })
})

describe("redaction (AC-8, #189): applied once, by BE-36's redactor", () => {
  const cover = [
    'PEPERIKSAAN PERCUBAAN',
    'Nama: Contoh Penuh Pelajar',
    'Guru: Contoh Guru Kelas',
    'Sekolah: SMK TAMAN CONTOH',
    'No. KP: 080808-10-1234',
    'Tel: 012-3456789',
    'E-mel: pelajar.contoh@sekolah.test',
    'Alamat: 1 Jalan Contoh, Taman Contoh',
    'Soalan 1. Hitung 2 + 3.',
  ].join('\n')

  it('cover-page identifiers never reach the provider adapter, and what it returns is scrubbed before it is stored', async () => {
    const { batchId } = await readyBatch(t, teacher)
    await setPage(batchId, 1, cover)
    provider.answer = () => paper([draft(t.codes, '1', { stem: 'Hubungi guru.rahsia@sekolah.test atau 013-9876543 untuk soalan ini tentang pecahan.' })])
    const sent = JSON.stringify(await runOne(batchId))
    for (const secret of ['Contoh Penuh Pelajar', 'Contoh Guru Kelas', 'TAMAN CONTOH', '080808', '3456789', 'pelajar.contoh', 'Jalan Contoh']) {
      expect(sent, secret).not.toContain(secret)
    }
    expect(sent).toContain('Hitung 2 + 3')
    const stored = JSON.stringify(await t.db.query(`select payload from intake_items where batch_id = $1`, [batchId]))
    expect(stored).not.toContain('guru.rahsia')
    expect(stored).not.toContain('9876543')
  })

  it("every page text the adapter receives is one output of BE-36's Redactor, and no text is redacted twice", async () => {
    const { batchId } = await readyBatch(t, teacher)
    await setPage(batchId, 1, cover)
    provider.answer = () => paper([draft(t.codes, '1')])
    const redact = vi.spyOn(Redactor.prototype, 'redact')
    const summary = vi.spyOn(Redactor.prototype, 'summary')
    const req = await runOne(batchId)

    const inputs = redact.mock.calls.map((c) => c[0])
    const outputs = redact.mock.results.map((r) => r.value as string)
    expect(req.pages.length).toBeGreaterThan(0)
    // Each page text on the wire is an output of BE-36's Redactor.
    for (const p of req.pages) expect(outputs, `page ${p.page}`).toContain(p.text)
    // The raw cover page went in exactly once ...
    expect(inputs.filter((i) => i === cover)).toHaveLength(1)
    // ... and nothing the redactor produced was fed back into it (a second redaction pass would do exactly that).
    const masked = outputs.filter((o) => Object.values(MASK).some((m) => o.includes(m)))
    expect(masked.length).toBeGreaterThan(0)
    for (const o of masked) expect(inputs).not.toContain(o)
    expect(inputs.some((i) => Object.values(MASK).some((m) => i.includes(m)))).toBe(false)
    // One redaction of the request (one Redactor, one summary) for one provider call.
    expect(summary).toHaveBeenCalledTimes(1)
    // BE-36's mask tokens are on the wire; the removed workflow redactor's token is not.
    const sent = JSON.stringify(req)
    for (const token of [MASK.person_name, MASK.school_name, MASK.ic_number]) expect(sent).toContain(token)
    expect(sent).not.toContain('[DIRAHSIAKAN]')
    expect(sent).toContain('Hitung 2 + 3')
  })

  it('a name masked in the input is masked again if the provider echoes it, before it is stored', async () => {
    const { batchId } = await readyBatch(t, teacher)
    await setPage(batchId, 1, 'Nama: Zulkarnain Bin Contohan\nSekolah: SMK TAMAN CONTOHAN\nSoalan 1. Hitung 2 + 3.')
    provider.answer = () =>
      paper([draft(t.codes, '1', { stem: 'Soalan ini disediakan untuk Zulkarnain dari SMK TAMAN CONTOHAN tentang pecahan sahaja.' })], {
        warnings: ['Nama Zulkarnain Bin Contohan dikesan'],
      })
    const sent = JSON.stringify(await runOne(batchId))
    expect(sent).not.toMatch(/Zulkarnain|CONTOHAN/i)
    const text =
      JSON.stringify(await t.db.query(`select payload from intake_items where batch_id = $1`, [batchId])) +
      JSON.stringify(await t.db.query(`select warnings from intake_extraction_runs where batch_id = $1`, [batchId]))
    expect(text).not.toMatch(/Zulkarnain|CONTOHAN/i)
  })
})
