import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../openapi'
import { INTAKE_COMPONENT_SCHEMAS } from '../paths'
import { INTAKE_FILES_COMPONENT_SCHEMAS } from '../files-paths'
import {
  INTAKE_BATCH_STATUSES,
  INTAKE_BATCH_STATUS_LABELS,
  INTAKE_COPYRIGHT_CODES,
  INTAKE_FILE_ERROR_CODES,
  INTAKE_FILE_MESSAGES,
  INTAKE_PAPER_TYPE_CODES,
  IntakeBatchCreateSchema,
  IntakeBatchDetailSchema,
  IntakeBatchListQuerySchema,
  IntakeBatchSummarySchema,
  IntakePageInfoSchema,
  IntakePageListSchema,
  IntakeUploadResultSchema,
} from '../files'

const create = {
  paperType: 'trial',
  subject: 'MAT',
  kertas: 1,
  year: 2024,
  source: 'Sekolah Contoh',
  copyright: 'sendiri',
  declaration: true,
}
const file = {
  id: 'f1',
  originalName: 'kertas.pdf',
  sizeBytes: 1000,
  pageCount: 2,
  status: 'done',
  errorCode: null,
  progress: { total: 2, done: 2, failed: 0 },
}
const summary = {
  id: 'b1',
  status: 'processing',
  statusLabel: 'Sedang diproses',
  paperType: 'exam',
  subject: 'MAT',
  kertas: 2,
  year: 2023,
  source: 'LPM',
  copyright: 'rasmi',
  notes: null,
  adminNotes: null,
  fileCount: 1,
  pageCount: 2,
  owner: { id: 'u1', name: 'Guru Contoh' },
  createdAt: '2026-10-16T09:30:00+08:00',
  updatedAt: '2026-10-16T09:30:00+08:00',
  submittedAt: null,
}
const page = {
  pageNo: 1,
  width: 1240,
  height: 1754,
  textSource: 'text-layer',
  text: 'Soalan 1',
  ocrConfidence: null,
  ocrStatus: 'not_needed',
  errorCode: null,
  hasImage: true,
  blocks: [{ text: 'Soalan 1', bbox: { x: 0.1, y: 0.1, w: 0.5, h: 0.05 }, confidence: null }],
  figures: [{ id: 'g1', bbox: { x: 0, y: 0, w: 1, h: 1 }, altTextSuggestion: null }],
}

describe('BE-37 enums and messages', () => {
  it('has the five batch statuses with BM labels', () => {
    expect([...INTAKE_BATCH_STATUSES]).toEqual(['submitted', 'processing', 'ready_for_review', 'failed', 'cancelled'])
    expect(INTAKE_BATCH_STATUS_LABELS).toEqual({
      submitted: 'Dihantar',
      processing: 'Sedang diproses',
      ready_for_review: 'Sedia untuk semakan',
      failed: 'Gagal',
      cancelled: 'Dibatalkan',
    })
  })

  it('keeps the prototype paper type and copyright codes and the error codes', () => {
    expect([...INTAKE_PAPER_TYPE_CODES]).toEqual(['trial', 'general', 'exam', 'exercise_book', 'other'])
    expect([...INTAKE_COPYRIGHT_CODES]).toEqual(['sendiri', 'rasmi', 'pihak-ketiga'])
    expect(INTAKE_FILE_ERROR_CODES).toContain('OCR_UNAVAILABLE')
    expect(INTAKE_FILE_ERROR_CODES).toHaveLength(9)
  })

  it('carries the exact BM upload messages', () => {
    expect(INTAKE_FILE_MESSAGES.type).toBe('Jenis fail tidak disokong. Gunakan PDF.')
    expect(INTAKE_FILE_MESSAGES.size(20)).toBe('Fail melebihi had 20 MB.')
    expect(INTAKE_FILE_MESSAGES.pages(200)).toBe('Fail melebihi had 200 halaman.')
    expect(INTAKE_FILE_MESSAGES.encrypted).toBe('Fail PDF dilindungi kata laluan dan tidak boleh dibaca.')
    expect(INTAKE_FILE_MESSAGES.corrupt).toBe('Fail PDF rosak atau tidak boleh dibaca.')
    expect(INTAKE_FILE_MESSAGES.tooComplex).toBe('Fail PDF terlalu kompleks untuk diproses.')
    expect(INTAKE_FILE_MESSAGES.duplicate).toBe('Fail ini telah diimport dalam kelompok lain.')
    expect(INTAKE_FILE_MESSAGES.tooManyFiles(10)).toBe('Maksimum 10 fail bagi setiap kelompok.')
    expect(INTAKE_FILE_MESSAGES.quota).toBe('Had kuota muat naik harian telah dicapai. Cuba lagi esok.')
    expect(INTAKE_FILE_MESSAGES.batchClosed).toBe('Kelompok ini tidak lagi menerima fail.')
  })
})

describe('BE-37 requests', () => {
  it('accepts a declaration and the optional notes', () => {
    expect(IntakeBatchCreateSchema.safeParse(create).success).toBe(true)
    expect(IntakeBatchCreateSchema.safeParse({ ...create, notes: 'Nota' }).success).toBe(true)
  })

  it('rejects unknown keys, a false declaration and out-of-range values', () => {
    expect(IntakeBatchCreateSchema.safeParse({ ...create, ownerId: '1' }).success).toBe(false)
    expect(IntakeBatchCreateSchema.safeParse({ ...create, declaration: false }).success).toBe(false)
    const missing: Record<string, unknown> = { ...create }
    delete missing.declaration
    expect(IntakeBatchCreateSchema.safeParse(missing).success).toBe(false)
    expect(IntakeBatchCreateSchema.safeParse({ ...create, kertas: 3 }).success).toBe(false)
    expect(IntakeBatchCreateSchema.safeParse({ ...create, year: 1989 }).success).toBe(false)
    expect(IntakeBatchCreateSchema.safeParse({ ...create, subject: 'mat' }).success).toBe(false)
    expect(IntakeBatchCreateSchema.safeParse({ ...create, paperType: 'mock' }).success).toBe(false)
    expect(IntakeBatchCreateSchema.safeParse({ ...create, copyright: 'own' }).success).toBe(false)
    expect(IntakeBatchCreateSchema.safeParse({ ...create, source: 'x'.repeat(201) }).success).toBe(false)
    expect(IntakeBatchCreateSchema.safeParse({ ...create, source: '   ' }).success).toBe(false)
    expect(IntakeBatchCreateSchema.safeParse({ ...create, notes: 'x'.repeat(1001) }).success).toBe(false)
  })

  it('coerces and caps the list query', () => {
    expect(IntakeBatchListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 })
    expect(IntakeBatchListQuerySchema.parse({ page: '2', pageSize: '100', status: 'failed' })).toEqual({ page: 2, pageSize: 100, status: 'failed' })
    expect(IntakeBatchListQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false)
    expect(IntakeBatchListQuerySchema.safeParse({ status: 'draf' }).success).toBe(false)
    expect(IntakeBatchListQuerySchema.safeParse({ owner: '1' }).success).toBe(false)
  })
})

describe('BE-37 responses', () => {
  it('parses a batch summary and detail, and rejects extra keys (no storage key, no sha256)', () => {
    expect(IntakeBatchSummarySchema.safeParse(summary).success).toBe(true)
    expect(IntakeBatchSummarySchema.safeParse({ ...summary, owner: null }).success).toBe(true)
    expect(IntakeBatchDetailSchema.safeParse({ ...summary, files: [file] }).success).toBe(true)
    expect(IntakeBatchSummarySchema.safeParse({ ...summary, isTest: false }).success).toBe(false)
    expect(IntakeBatchDetailSchema.safeParse({ ...summary, files: [{ ...file, sha256: 'a'.repeat(64) }] }).success).toBe(false)
    expect(IntakeBatchDetailSchema.safeParse({ ...summary, files: [{ ...file, storageKey: 'k' }] }).success).toBe(false)
    expect(IntakeBatchSummarySchema.safeParse({ ...summary, createdAt: '2026-10-16T01:30:00Z' }).success).toBe(false)
  })

  it('parses the upload result and rejects an unknown file status or error code', () => {
    expect(IntakeUploadResultSchema.safeParse({ files: [file] }).success).toBe(true)
    expect(IntakeUploadResultSchema.safeParse({ files: [{ ...file, status: 'queued' }] }).success).toBe(false)
    expect(IntakeUploadResultSchema.safeParse({ files: [{ ...file, errorCode: 'BOOM' }] }).success).toBe(false)
    expect(IntakeUploadResultSchema.safeParse({ files: [file], extra: 1 }).success).toBe(false)
  })

  it('parses a page list; bboxes are fractions and confidence is 0..100 or null', () => {
    expect(IntakePageListSchema.safeParse({ fileId: 'f1', pages: [page] }).success).toBe(true)
    expect(IntakePageInfoSchema.safeParse({ ...page, textSource: 'ocr', ocrConfidence: 87.5, ocrStatus: 'done' }).success).toBe(true)
    expect(IntakePageInfoSchema.safeParse({ ...page, textSource: 'text_layer' }).success).toBe(false)
    expect(IntakePageInfoSchema.safeParse({ ...page, ocrConfidence: 101 }).success).toBe(false)
    expect(IntakePageInfoSchema.safeParse({ ...page, blocks: [{ text: 'a', bbox: { x: 1.2, y: 0, w: 1, h: 1 }, confidence: null }] }).success).toBe(false)
    expect(IntakePageInfoSchema.safeParse({ ...page, imageFileId: '1' }).success).toBe(false)
  })
})

describe('BE-37 OpenAPI', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, { responses: Record<string, unknown> }>>
    components: { schemas: Record<string, unknown> }
  }

  it('registers the ten routes', () => {
    const routes: [string, string][] = [
      ['/intake/batches', 'post'],
      ['/intake/batches', 'get'],
      ['/intake/batches/{id}', 'get'],
      ['/intake/batches/{id}/files', 'post'],
      ['/intake/batches/{id}/cancel', 'post'],
      ['/intake/files/{id}/pages', 'get'],
      ['/intake/files/{id}/pages/{n}/image', 'get'],
      ['/intake/files/{id}/pages/{n}/thumb', 'get'],
      ['/intake/figures/{id}/image', 'get'],
      ['/intake/files/{id}/original', 'get'],
    ]
    for (const [path, method] of routes) {
      const op = doc.paths[path]?.[method]
      expect(op, `${method} ${path}`).toBeDefined()
      expect(Object.keys(op!.responses)).toEqual(expect.arrayContaining(['401', '403']))
      const limited = method !== 'get' || /image|thumb|original/.test(path)
      if (limited) expect(Object.keys(op!.responses)).toContain('429')
    }
    expect(Object.keys(doc.paths['/intake/batches/{id}/files']!.post!.responses)).toEqual(expect.arrayContaining(['201', '404', '409', '413', '422']))
  })

  it('uploads as multipart/form-data and serves images and the PDF as binary', () => {
    const upload = doc.paths['/intake/batches/{id}/files']!.post as unknown as { requestBody: { content: Record<string, unknown> } }
    expect(Object.keys(upload.requestBody.content)).toEqual(['multipart/form-data'])
    const image = doc.paths['/intake/files/{id}/pages/{n}/image']!.get!.responses['200'] as { content: Record<string, unknown> }
    expect(Object.keys(image.content)).toEqual(['image/webp', 'image/png', 'image/jpeg'])
    const original = doc.paths['/intake/files/{id}/original']!.get!.responses['200'] as { content: Record<string, unknown> }
    expect(Object.keys(original.content)).toEqual(['application/pdf'])
  })

  it('has unique Intake component ids that do not clash with BE-38', () => {
    for (const key of Object.keys(INTAKE_FILES_COMPONENT_SCHEMAS)) {
      expect(key.startsWith('Intake')).toBe(true)
      expect(Object.keys(INTAKE_COMPONENT_SCHEMAS)).not.toContain(key)
      expect(doc.components.schemas[key], key).toBeDefined()
    }
  })

  it('leaks no storage key, hash or internal path in any BE-37 schema', () => {
    const text = JSON.stringify(Object.fromEntries(Object.keys(INTAKE_FILES_COMPONENT_SCHEMAS).map((k) => [k, doc.components.schemas[k]])))
    expect(text).not.toMatch(/storageKey|storage_key|sha256|imageFileId|cropFileId/)
  })
})
