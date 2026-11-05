import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../../openapi'
import { QUESTION_SETS_COMPONENT_SCHEMAS } from '../paths'
import {
  DSKP_MESSAGES,
  DskpBidangCreateRequestSchema,
  DskpBidangInlineErrorSchema,
  DskpBidangSchema,
  DskpSkCreateRequestSchema,
  DskpSpCreateRequestSchema,
  DskpSpSchema,
  QUESTION_SET_AUDIO_KBAT_CSV_TEXT,
  QUESTION_SET_AUDIO_KBAT_TEMPLATE,
  QUESTION_SET_PAPER_MAX_FILE_BYTES,
  QUESTION_SET_PAPER_MESSAGES,
  QuestionSetPaperFieldErrorSchema,
  QuestionSetPaperRequestSchema,
  QuestionSetPaperSchema,
  QuestionSetStudentListSchema,
} from '../schema'

const meta = (n: number) => ({
  page: 1,
  pageSize: Math.max(1, n),
  totalItems: n,
  totalPages: 1,
  from: n > 0 ? 1 : null,
  to: n > 0 ? n : null,
})

function fieldMessages(result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  const out: Record<string, string> = {}
  for (const i of result.error?.issues ?? []) out[String(i.path[0])] ??= i.message
  return out
}

describe('set-soalan-saya (student list)', () => {
  const item = { id: '9001', title: 'Set Contoh 1', teacherName: 'Cikgu Contoh', questionCount: 10, timeLimitMinutes: 30, attemptsLeft: 2 }
  it('parses limited, unlimited and header-only sets', () => {
    const body = {
      data: [item, { ...item, id: '9002', timeLimitMinutes: null, attemptsLeft: null, teacherName: null }, { ...item, id: '9003', questionCount: 0 }],
      meta: meta(3),
    }
    expect(QuestionSetStudentListSchema.safeParse(body).success).toBe(true)
    expect(QuestionSetStudentListSchema.safeParse({ data: [], meta: meta(0) }).success).toBe(true)
  })
  it('never exposes question content', () => {
    const keys = Object.keys(QUESTION_SETS_COMPONENT_SCHEMAS.QuestionSetStudentItem.shape)
    expect(keys.sort()).toEqual(['attemptsLeft', 'id', 'questionCount', 'teacherName', 'timeLimitMinutes', 'title'])
  })
})

describe('question paper upload: request copy per field', () => {
  const file = { name: 'kertas-contoh.pdf', size: 1024, type: 'application/pdf' }
  const good = { paperType: 'trial', subject: 'Kimia', answerSchemeConfirmed: true, files: [file] }

  it('accepts the minimal form and every coercion', () => {
    expect(QuestionSetPaperRequestSchema.safeParse(good).success).toBe(true)
    for (const levelId of [undefined, null, '', 4, '4', 'T4', 't5', ' 3 ']) {
      expect(QuestionSetPaperRequestSchema.safeParse({ ...good, levelId }).success).toBe(true)
    }
    for (const year of [undefined, null, '', 2000, '2099', ' 2026 ']) {
      expect(QuestionSetPaperRequestSchema.safeParse({ ...good, year }).success).toBe(true)
    }
    for (const answerSchemeConfirmed of [true, 'true', 'on', '1']) {
      expect(QuestionSetPaperRequestSchema.safeParse({ ...good, answerSchemeConfirmed }).success).toBe(true)
    }
    expect(QuestionSetPaperRequestSchema.parse({ ...good, paperType: '  trial ', subject: '  Kimia ' }).subject).toBe('Kimia')
  })

  it('wires the exact message of each field', () => {
    expect(fieldMessages(QuestionSetPaperRequestSchema.safeParse({ ...good, paperType: 'Lain' }))).toEqual({ paperType: 'Sila pilih jenis soalan.' })
    expect(fieldMessages(QuestionSetPaperRequestSchema.safeParse({ ...good, paperType: undefined }))).toEqual({ paperType: 'Sila pilih jenis soalan.' })
    expect(fieldMessages(QuestionSetPaperRequestSchema.safeParse({ ...good, subject: '  ' }))).toEqual({ subject: 'Sila isi matapelajaran.' })
    expect(fieldMessages(QuestionSetPaperRequestSchema.safeParse({ ...good, subject: 'a'.repeat(101) }))).toEqual({ subject: 'Matapelajaran tidak boleh melebihi 100 aksara.' })
    expect(QuestionSetPaperRequestSchema.safeParse({ ...good, subject: 'a'.repeat(100) }).success).toBe(true)
    for (const levelId of [0, 6, '6', 'T0', 'T', 'abc', 2.5, true, '-1']) {
      expect(fieldMessages(QuestionSetPaperRequestSchema.safeParse({ ...good, levelId }))).toEqual({ levelId: 'Tingkatan tidak sah.' })
    }
    for (const year of [1999, 2100, 'abc', 2026.5, true]) {
      expect(fieldMessages(QuestionSetPaperRequestSchema.safeParse({ ...good, year }))).toEqual({ year: 'Tahun mesti antara 2000 dan 2099.' })
    }
    expect(fieldMessages(QuestionSetPaperRequestSchema.safeParse({ ...good, preparedBy: 'a'.repeat(201) }))).toEqual({
      preparedBy: 'Disediakan oleh tidak boleh melebihi 200 aksara.',
    })
    expect(fieldMessages(QuestionSetPaperRequestSchema.safeParse({ ...good, note: 'a'.repeat(1001) }))).toEqual({
      note: 'Catatan tambahan tidak boleh melebihi 1000 aksara.',
    })
    expect(QuestionSetPaperRequestSchema.safeParse({ ...good, preparedBy: 'a'.repeat(200), note: 'b'.repeat(1000) }).success).toBe(true)
    for (const answerSchemeConfirmed of [false, 'false', '', undefined, 'no']) {
      expect(fieldMessages(QuestionSetPaperRequestSchema.safeParse({ ...good, answerSchemeConfirmed }))).toEqual({
        answerSchemeConfirmed: 'Sila sahkan skema jawapan disertakan.',
      })
    }
  })

  it('counts characters by code point', () => {
    expect(QuestionSetPaperRequestSchema.safeParse({ ...good, subject: '\u{1F600}'.repeat(100) }).success).toBe(true)
  })

  it('checks the files: none, more than 5, a bad type (pdf, docx, xlsx only), too large', () => {
    const files = (f: unknown) => fieldMessages(QuestionSetPaperRequestSchema.safeParse({ ...good, files: f }))
    const type = 'Jenis fail tidak disokong. Format dibenarkan: PDF, DOCX, XLSX.'
    expect(files(undefined)).toEqual({ files: 'Sila pilih fail.' })
    expect(files([])).toEqual({ files: 'Sila pilih fail.' })
    expect(files(Array.from({ length: 6 }, () => file))).toEqual({ files: 'Maksimum 5 fail, saiz maksimum 20MB setiap fail' })
    expect(files(Array.from({ length: 5 }, () => file))).toEqual({})
    expect(files([file, { ...file, name: 'gambar.png' }, { ...file, name: 'lain.exe' }])).toEqual({ files: type })
    expect(files([{ ...file, size: QUESTION_SET_PAPER_MAX_FILE_BYTES + 1 }])).toEqual({ files: 'Fail melebihi saiz maksimum 20 MB.' })
    expect(files([{ ...file, size: QUESTION_SET_PAPER_MAX_FILE_BYTES }])).toEqual({})
    for (const name of ['a.PDF', 'a.DOCX', 'a.xlsx']) expect(files([{ ...file, name }])).toEqual({})
    for (const name of ['a.doc', 'a.xls', 'a.jpg', 'a.jpeg']) expect(files([{ ...file, name }]), name).toEqual({ files: type })
  })

  it('exports the PRD 44-F4 copy verbatim', () => {
    expect(QUESTION_SET_PAPER_MESSAGES).toEqual({
      type: 'Sila pilih jenis soalan.',
      subject: 'Sila isi matapelajaran.',
      subjectLong: 'Matapelajaran tidak boleh melebihi 100 aksara.',
      level: 'Tingkatan tidak sah.',
      year: 'Tahun mesti antara 2000 dan 2099.',
      author: 'Disediakan oleh tidak boleh melebihi 200 aksara.',
      note: 'Catatan tambahan tidak boleh melebihi 1000 aksara.',
      confirm: 'Sila sahkan skema jawapan disertakan.',
      files: 'Sila pilih fail.',
      tooMany: 'Maksimum 5 fail, saiz maksimum 20MB setiap fail',
      fileType: 'Jenis fail tidak disokong. Format dibenarkan: PDF, DOCX, XLSX.',
      fileSize: 'Fail melebihi saiz maksimum 20 MB.',
      scanned: 'PDF imbasan imej tidak diterima — teks mesti boleh disalin.',
    })
  })

  it('parses the 201 {batchId} and the 422 body', () => {
    expect(QuestionSetPaperSchema.safeParse({ batchId: '4001' }).success).toBe(true)
    expect(QuestionSetPaperSchema.safeParse({ id: '4001' }).success).toBe(false)
    const body = { error: { code: 'VALIDATION_ERROR', message: 'Tahun mesti antara 2000 dan 2099.', fields: { year: 'Tahun mesti antara 2000 dan 2099.' } } }
    expect(QuestionSetPaperFieldErrorSchema.safeParse(body).success).toBe(true)
    expect(QuestionSetPaperFieldErrorSchema.safeParse({ error: { ...body.error, fields: { year: 'Lain.' } } }).success).toBe(false)
  })
})

describe('Audio KBAT templates', () => {
  it('has the fixed CSV body of the mock (BOM, headings, quoted example)', () => {
    expect(QUESTION_SET_AUDIO_KBAT_CSV_TEXT).toBe(
      '﻿tajuk,kod_subjek,kod_tingkatan,nama_fail_audio\n"Contoh: KBAT Sains Bab 1",SCI,T4,kbat-sains-1.mp3\n',
    )
    expect(QUESTION_SET_AUDIO_KBAT_TEMPLATE.csv.contentType).toBe('text/csv; charset=UTF-8')
    expect(QUESTION_SET_AUDIO_KBAT_TEMPLATE.word.contentType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(QUESTION_SET_AUDIO_KBAT_TEMPLATE.word.headings).toEqual(['Tajuk', 'Kod Subjek', 'Kod Tingkatan', 'Nama Fail Audio'])
  })
})

describe('DSKP picks: copy per field and inline refusals', () => {
  it('bidang: accepts numbers and digit strings, blank code', () => {
    expect(DskpBidangCreateRequestSchema.safeParse({ name: ' Bidang 1 ', subjectId: 3, educationLevelId: '10', code: '' }).success).toBe(true)
    expect(DskpBidangCreateRequestSchema.safeParse({ name: 'x', subjectId: 'sub-9', educationLevelId: 'lvl-4' }).success).toBe(true)
  })
  it('bidang: exact message per field (name and code share the name text)', () => {
    const ids = { subjectId: 3, educationLevelId: 10 }
    expect(fieldMessages(DskpBidangCreateRequestSchema.safeParse({ ...ids, name: '  ' }))).toEqual({ name: 'Nama bidang diperlukan.' })
    expect(fieldMessages(DskpBidangCreateRequestSchema.safeParse({ ...ids, name: 'a'.repeat(256) }))).toEqual({ name: 'Nama bidang diperlukan.' })
    expect(DskpBidangCreateRequestSchema.safeParse({ ...ids, name: 'a'.repeat(255) }).success).toBe(true)
    expect(fieldMessages(DskpBidangCreateRequestSchema.safeParse({ ...ids, name: 'x', code: 'c'.repeat(51) }))).toEqual({ code: 'Nama bidang diperlukan.' })
    expect(fieldMessages(DskpBidangCreateRequestSchema.safeParse({ name: 'x', subjectId: 0, educationLevelId: '' }))).toEqual({
      subjectId: 'Subjek atau tahap tidak sah.',
      educationLevelId: 'Subjek atau tahap tidak sah.',
    })
  })
  it('sk and sp: exact messages and bounds (code 50, description 2000)', () => {
    expect(fieldMessages(DskpSkCreateRequestSchema.safeParse({ bidangId: 1, code: '', description: 'd' }))).toEqual({ code: 'Kod dan keterangan SK diperlukan.' })
    expect(fieldMessages(DskpSkCreateRequestSchema.safeParse({ bidangId: 1, code: 'c', description: 'd'.repeat(2001) }))).toEqual({ description: 'Kod dan keterangan SK diperlukan.' })
    expect(fieldMessages(DskpSkCreateRequestSchema.safeParse({ code: 'c', description: 'd' }))).toEqual({ bidangId: 'Bidang tidak sah.' })
    expect(DskpSkCreateRequestSchema.safeParse({ bidangId: '8', code: 'c'.repeat(50), description: 'd'.repeat(2000) }).success).toBe(true)
    expect(fieldMessages(DskpSpCreateRequestSchema.safeParse({ skId: 1, code: 'c'.repeat(51), description: 'd' }))).toEqual({ code: 'Kod dan keterangan SP diperlukan.' })
    expect(fieldMessages(DskpSpCreateRequestSchema.safeParse({ skId: '', code: 'c', description: 'd' }))).toEqual({ skId: 'SK tidak sah.' })
  })
  it('exports the mock copy verbatim', () => {
    expect(DSKP_MESSAGES).toEqual({
      bidangName: 'Nama bidang diperlukan.',
      bidangParent: 'Subjek atau tahap tidak sah.',
      skFields: 'Kod dan keterangan SK diperlukan.',
      skParent: 'Bidang tidak sah.',
      spFields: 'Kod dan keterangan SP diperlukan.',
      spParent: 'SK tidak sah.',
    })
  })
  it('201 bodies are bare and the refusal is 200 { error } with the pinned text', () => {
    expect(DskpBidangSchema.safeParse({ id: '9000001', code: null, name: 'Bidang Contoh' }).success).toBe(true)
    expect(DskpSpSchema.safeParse({ id: '9000002', code: 'SP 1.1', description: 'Huraian contoh' }).success).toBe(true)
    expect(DskpBidangInlineErrorSchema.safeParse({ error: 'Subjek atau tahap tidak sah.' }).success).toBe(true)
    expect(DskpBidangInlineErrorSchema.safeParse({ error: 'SK tidak sah.' }).success).toBe(false)
    expect(DskpBidangInlineErrorSchema.safeParse({ error: { code: 'X', message: 'Y' } }).success).toBe(false)
  })
})

describe('OpenAPI registration', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, { responses: Record<string, { content?: Record<string, unknown>; headers?: Record<string, unknown> }>; requestBody?: { content: Record<string, unknown> } }>>
    components: { schemas: Record<string, unknown> }
  }

  it('contains the BE-18 question set, paper, template and DSKP paths', () => {
    expect(Object.keys(doc.paths['/set-soalan-saya'] ?? {})).toEqual(['get'])
    // GET /guru/dskp/* belongs to BE-10 (question-workflow); this card adds the POSTs to the same path items
    expect(Object.keys(doc.paths['/guru/question-papers'] ?? {})).toEqual(['post'])
    expect(Object.keys(doc.paths['/guru/dskp/bidang'] ?? {})).toContain('post')
    expect(Object.keys(doc.paths['/guru/dskp/sk'] ?? {})).toContain('post')
    expect(Object.keys(doc.paths['/guru/dskp/sp'] ?? {})).toContain('post')
    expect(Object.keys(doc.paths['/guru/question-papers']?.post?.requestBody?.content ?? {})).toEqual(['multipart/form-data'])
    expect(Object.keys(doc.paths['/guru/dskp/sk']?.post?.responses ?? {}).sort()).toEqual(['200', '201', '401', '403', '429'])
  })

  it('serves the templates as attachments with the right content types', () => {
    const csv = doc.paths['/guru/audio-kbat/template']?.get?.responses['200']
    expect(Object.keys(csv?.content ?? {})).toEqual(['text/csv'])
    expect(csv?.headers?.['Content-Disposition']).toBeDefined()
    const word = doc.paths['/guru/audio-kbat/template-word']?.get?.responses['200']
    expect(Object.keys(word?.content ?? {})).toEqual([QUESTION_SET_AUDIO_KBAT_TEMPLATE.word.contentType])
    expect(word?.headers?.['Content-Disposition']).toBeDefined()
  })

  it('registers every component and no legacy column', () => {
    for (const name of Object.keys(QUESTION_SETS_COMPONENT_SCHEMAS)) expect(doc.components.schemas[name]).toBeDefined()
    expect(JSON.stringify(doc)).not.toMatch(/legacy_/)
  })
})

describe('D57 rate limit', () => {
  const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, { responses: Record<string, { headers?: Record<string, unknown> }> }>> }
  it('declares 429 with a Retry-After header on question-papers and the DSKP POSTs', () => {
    for (const p of ['/guru/question-papers', '/guru/dskp/bidang', '/guru/dskp/sk', '/guru/dskp/sp']) {
      expect(doc.paths[p]?.post?.responses['429']?.headers?.['Retry-After']).toBeDefined()
    }
  })
})
