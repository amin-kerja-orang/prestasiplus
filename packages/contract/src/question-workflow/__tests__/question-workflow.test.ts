import { describe, expect, it } from 'vitest'

import { ErrorBodySchema } from '../../common/error'
import { buildOpenApiDocument } from '../../openapi'
import { QUESTION_WORKFLOW_COMPONENT_SCHEMAS } from '../paths'
import {
  DIAGRAM_AUDIT_MESSAGES,
  DiagramAuditImageRequestSchema,
  DiagramAuditKindSchema,
  DiagramAuditMutationSchema,
  DiagramAuditQuerySchema,
  DiagramAuditResponseSchema,
  GuruDskpBidangListSchema,
  GuruDskpBidangQuerySchema,
  GuruDskpSkListSchema,
  GuruDskpSpListSchema,
  MasterNoteActionResultSchema,
  MasterNoteActionSchema,
  MasterNoteListResponseSchema,
  QUESTION_IMPORT_HEADER,
  QUESTION_IMPORT_MESSAGES,
  QUESTION_IMPORT_REQUIRED_COLUMNS,
  QUESTION_IMPORT_ROW_MESSAGES,
  QUESTION_IMPORT_TEMPLATE_CSV,
  QUESTION_QUALITY_BANDS,
  QUESTION_REPORT_DISPLAY_LABELS,
  QUESTION_REPORT_MESSAGES,
  QUESTION_WORKFLOW_AI_MESSAGES,
  QUESTION_WORKFLOW_NEW_VERSION,
  QUESTION_WORKFLOW_STATUSES,
  QUESTION_WORKFLOW_STATUS_LABELS,
  QUESTION_WORKFLOW_TRANSITIONS,
  QuestionImportCreateRequestSchema,
  QuestionImportCreatedSchema,
  QuestionImportGuruResultSchema,
  QuestionImportRunSchema,
  QuestionQualityAuditedSchema,
  QuestionQualitySummarySchema,
  QuestionReportContextSchema,
  QuestionReportCreateRequestSchema,
  QuestionReportCreatedSchema,
  QuestionReportListResponseSchema,
  QuestionReportMineResponseSchema,
  QuestionReportUpdateRequestSchema,
  QuestionReportUpdatedSchema,
  QuestionWorkflowAiExplanationResultSchema,
  QuestionWorkflowStatusEventSchema,
  QuestionWorkflowStatusSchema,
  isQuestionWorkflowTransitionAllowed,
  neutraliseQuestionImportCsvCell,
  questionQualityBandOf,
  questionWorkflowTransitionRule,
  type QuestionWorkflowActor,
  type QuestionWorkflowStatus,
} from '../schema'

const AT = '2026-10-16T09:30:00+08:00'
const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) => schema.safeParse(value).success

/** First message of the issue on `path`, or undefined when that field is valid. */
function messageAt(schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, value: unknown, path: string): string | undefined {
  const r = schema.safeParse(value)
  return r.error?.issues.find((i) => i.path[0] === path)?.message
}

describe('lifecycle (D54a codes, v2-question-bank 4.1)', () => {
  it('has exactly the four D54 codes (ADR-0027) and the BM labels', () => {
    expect([...QUESTION_WORKFLOW_STATUSES]).toEqual(['draft', 'review', 'approved', 'archived'])
    expect(QUESTION_WORKFLOW_STATUS_LABELS).toEqual({
      draft: 'Draf',
      review: 'Semakan',
      approved: 'Diterbitkan',
      archived: 'Diarkib',
    })
  })

  it('rejects the mock status values', () => {
    for (const v of ['pending_review', 'rejected', 'pending', 'Draf', '']) expect(ok(QuestionWorkflowStatusSchema, v)).toBe(false)
  })

  it('allows exactly the six pairs of the table, walked over all 4x4 pairs per actor', () => {
    const allowed = new Set(['draft>review', 'draft>archived', 'review>approved', 'review>draft', 'approved>archived', 'archived>draft'])
    expect(QUESTION_WORKFLOW_TRANSITIONS).toHaveLength(6)
    const adminOnly = new Set(['review>approved', 'review>draft', 'approved>archived', 'archived>draft'])
    let seen = 0
    for (const actor of ['admin', 'owner_teacher'] as QuestionWorkflowActor[]) {
      for (const from of QUESTION_WORKFLOW_STATUSES) {
        for (const to of QUESTION_WORKFLOW_STATUSES) {
          const key = `${from}>${to}`
          const expected = allowed.has(key) && (actor === 'admin' || !adminOnly.has(key))
          expect(isQuestionWorkflowTransitionAllowed(from, to, actor), `${actor} ${key}`).toBe(expected)
          seen += 1
        }
      }
    }
    expect(seen).toBe(32)
  })

  it('no status moves to itself, and approved never goes back to draft as a pair (an edit makes version n+1)', () => {
    for (const s of QUESTION_WORKFLOW_STATUSES) expect(questionWorkflowTransitionRule(s, s)).toBeUndefined()
    expect(questionWorkflowTransitionRule('approved', 'draft')).toBeUndefined()
    expect(QUESTION_WORKFLOW_NEW_VERSION).toMatchObject({ from: 'approved', creates: 'draft', supersededLabel: 'Diarkib (digantikan)' })
  })

  it('names the gates and the mandatory reasons', () => {
    const gate = (a: QuestionWorkflowStatus, b: QuestionWorkflowStatus) => questionWorkflowTransitionRule(a, b)?.gate
    expect(gate('draft', 'review')).toBe('submit')
    expect(gate('review', 'approved')).toBe('approve')
    expect(gate('approved', 'archived')).toBeNull()
    const reasonPairs = QUESTION_WORKFLOW_TRANSITIONS.filter((t) => t.reasonRequired).map((t) => `${t.from}>${t.to}`)
    expect(reasonPairs.sort()).toEqual(['approved>archived', 'review>draft'])
  })

  it('parses a status event row', () => {
    const row = { id: '9', questionId: '41', from: 'review', to: 'draft', actorId: '3', actorRole: 'admin', reason: 'Jawapan tidak jelas.', at: AT }
    expect(ok(QuestionWorkflowStatusEventSchema, row)).toBe(true)
    expect(ok(QuestionWorkflowStatusEventSchema, { ...row, to: 'rejected' })).toBe(false)
    expect(ok(QuestionWorkflowStatusEventSchema, { ...row, at: '2026-10-16T01:30:00Z' })).toBe(false)
  })
})

describe('reports', () => {
  const create = { questionId: '41', reasons: ['wrong_answer'] }

  it('the report context is a strict uuid attempt with an optional paper id (R1-T42)', () => {
    const attemptId = '3f6c1f2a-8f3e-4c53-9a53-2d3f2f6f1a11'
    expect(ok(QuestionReportContextSchema, { attemptId })).toBe(true)
    expect(ok(QuestionReportContextSchema, { attemptId, paperId: '12' })).toBe(true)
    expect(ok(QuestionReportContextSchema, { attemptId: 'abc' })).toBe(false)
    expect(ok(QuestionReportContextSchema, { attemptId, paper: 'palsu' })).toBe(false) // strict: no other key
    expect(ok(QuestionReportContextSchema, { paperId: '12' })).toBe(false)
    expect(ok(QuestionReportCreateRequestSchema, { ...create, attemptId, paperId: '12' })).toBe(true)
  })

  it('accepts a minimal and a full create body', () => {
    expect(ok(QuestionReportCreateRequestSchema, create)).toBe(true)
    expect(
      ok(QuestionReportCreateRequestSchema, {
        questionId: '41',
        questionType: 'structured',
        reasons: ['wrong_answer', 'typo'],
        comment: 'x'.repeat(500),
        source: 'structured_attempt',
        quizSessionId: 'sesi-1',
        roomCode: '',
      }),
    ).toBe(true)
  })

  it('returns the mock field messages', () => {
    expect(messageAt(QuestionReportCreateRequestSchema, { ...create, reasons: [] }, 'reasons')).toBe('Sila pilih sekurang-kurangnya satu sebab laporan.')
    expect(messageAt(QuestionReportCreateRequestSchema, { ...create, reasons: ['nonsense'] }, 'reasons')).toBe('Sebab laporan tidak sah.')
    expect(messageAt(QuestionReportCreateRequestSchema, { ...create, source: 'quiz' }, 'source')).toBe('Sumber laporan tidak sah.')
    expect(messageAt(QuestionReportCreateRequestSchema, { ...create, source: 'papan_bijak' }, 'source')).toBe('Sumber laporan tidak sah.')
    expect(messageAt(QuestionReportCreateRequestSchema, { ...create, questionType: 'essay' }, 'questionType')).toBe('Jenis soalan tidak sah.')
    expect(messageAt(QuestionReportCreateRequestSchema, { ...create, comment: 'x'.repeat(501) }, 'comment')).toBe('Komen tidak boleh melebihi 500 aksara.')
    expect(messageAt(QuestionReportCreateRequestSchema, { ...create, quizSessionId: 'bad id!' }, 'quizSessionId')).toBe('Rujukan sesi atau bilik tidak sah.')
    expect(messageAt(QuestionReportCreateRequestSchema, { ...create, roomCode: 'a'.repeat(65) }, 'roomCode')).toBe('Rujukan sesi atau bilik tidak sah.')
    expect(ok(QuestionReportCreateRequestSchema, { reasons: ['typo'] })).toBe(false)
    expect(ok(QuestionReportCreateRequestSchema, { ...create, questionId: '' })).toBe(false)
  })

  it('checks the reason against the set of the question type', () => {
    // missing_options, duplicate and outdated exist for mcq only
    expect(ok(QuestionReportCreateRequestSchema, { ...create, reasons: ['missing_options', 'duplicate', 'outdated'] })).toBe(true)
    for (const reason of ['missing_options', 'duplicate', 'outdated']) {
      const body = { ...create, questionType: 'structured', reasons: [reason] }
      expect(messageAt(QuestionReportCreateRequestSchema, body, 'reasons')).toBe('Sebab laporan tidak sah.')
    }
  })

  it('accepts the same body twice (the mock has no duplicate check)', () => {
    expect(ok(QuestionReportCreateRequestSchema, create)).toBe(true)
    expect(ok(QuestionReportCreateRequestSchema, create)).toBe(true)
    expect(ok(QuestionReportCreatedSchema, { success: true, message: 'Laporan berjaya dihantar.' })).toBe(true)
    expect(ok(QuestionReportCreatedSchema, { success: true, message: 'lain' })).toBe(false)
  })

  const question = { exists: true, type: 'mcq', id: '41', text: 'Apakah ibu negara Malaysia?', options: ['A', 'B', 'C', 'D'], correctAnswer: 0, subjectName: 'Geografi', levelName: 'Tingkatan 1', complianceStatus: 'verified', isActive: false, practiceUrl: null }
  const row = {
    id: '5',
    questionType: 'mcq',
    questionId: '41',
    reasons: ['wrong_answer'],
    reasonLabels: ['Jawapan tidak tepat'],
    category: 'Jawapan Salah',
    comment: null,
    source: 'spm',
    quizSessionId: null,
    roomCode: null,
    sourceSet: null,
    status: 'fixed',
    displayStatus: 'removed',
    adminNotes: 'Dinyahaktifkan segera oleh admin',
    createdAt: AT,
    updatedAt: AT,
    question,
    reporter: { id: '12', name: 'Aina Pelapor' },
  }
  const counts = { pending: 0, reviewed: 0, fixed: 1, dismissed: 0, all: 1 }
  const meta = { page: 1, pageSize: 1, totalItems: 1, totalPages: 1, from: 1, to: 1, activeTab: 'fixed', counts }

  it('parses the admin list, including activeTab null and the question version', () => {
    expect(ok(QuestionReportListResponseSchema, { data: [row], meta })).toBe(true)
    expect(ok(QuestionReportListResponseSchema, { data: [{ ...row, questionVersion: 2 }], meta: { ...meta, activeTab: null } })).toBe(true)
    expect(ok(QuestionReportListResponseSchema, { data: [{ ...row, status: 'pending', displayStatus: 'pending' }], meta })).toBe(true)
    expect(ok(QuestionReportListResponseSchema, { data: [{ ...row, displayStatus: 'Dikeluarkan' }], meta })).toBe(false)
    expect(ok(QuestionReportListResponseSchema, { data: [{ ...row, category: 'Lain' }], meta })).toBe(false)
    expect(ok(QuestionReportListResponseSchema, { data: [row], meta: { ...meta, counts: { pending: 1 } } })).toBe(false)
  })

  it('shows the BM display labels', () => {
    expect(QUESTION_REPORT_DISPLAY_LABELS).toEqual({ pending: 'Menunggu', reviewed: 'Disemak', fixed: 'Diperbaiki', removed: 'Dikeluarkan', dismissed: 'Ditolak' })
  })

  it('"mine" rows never carry question text or the answer', () => {
    const parsed = QuestionReportMineResponseSchema.parse({ data: [row], meta: { page: 1, pageSize: 1, totalItems: 1, totalPages: 1, from: 1, to: 1, counts } })
    const q = parsed.data[0]?.question as Record<string, unknown>
    expect(q).toEqual({ exists: true, type: 'mcq', id: '41' })
    expect(q).not.toHaveProperty('correctAnswer')
    expect(q).not.toHaveProperty('text')
  })

  it('validates the update body and its messages', () => {
    expect(ok(QuestionReportUpdateRequestSchema, { status: 'fixed' })).toBe(true)
    expect(ok(QuestionReportUpdateRequestSchema, { status: 'dismissed', adminNotes: null, reactivate: '1', forceDeactivate: false })).toBe(true)
    expect(messageAt(QuestionReportUpdateRequestSchema, { status: 'pending' }, 'status')).toBe('Status tidak sah.')
    expect(messageAt(QuestionReportUpdateRequestSchema, {}, 'status')).toBe('Status tidak sah.')
    expect(messageAt(QuestionReportUpdateRequestSchema, { status: 'fixed', adminNotes: 'x'.repeat(1001) }, 'adminNotes')).toBe('Nota admin tidak boleh melebihi 1000 aksara.')
    expect(ok(QuestionReportUpdateRequestSchema, { status: 'fixed', adminNotes: 'x'.repeat(1000) })).toBe(true)
    expect(ok(QuestionReportUpdatedSchema, { data: { id: '5', status: 'fixed', adminNotes: null, updatedAt: AT }, status: 'Laporan berjaya dikemaskini.' })).toBe(true)
  })

  it('keeps the exact BM copy', () => {
    expect(QUESTION_REPORT_MESSAGES.question).toBe('Sila pilih soalan.')
    expect(QUESTION_REPORT_MESSAGES.reference).toBe('Rujukan sesi atau bilik tidak sah.')
    expect(QUESTION_REPORT_MESSAGES.updated).toBe('Laporan berjaya dikemaskini.')
  })
})

describe('imports', () => {
  it('keeps the mock template header, required columns and sample file', () => {
    expect(QUESTION_IMPORT_HEADER.join(',')).toBe('question_text,option_a,option_b,option_c,option_d,correct_answer,subject_id,education_level_id,difficulty_level,marks,explanation,kertas')
    expect([...QUESTION_IMPORT_REQUIRED_COLUMNS]).toEqual(['question_text', 'option_a', 'option_b', 'correct_answer'])
    const lines = QUESTION_IMPORT_TEMPLATE_CSV.split('\r\n')
    expect(lines).toHaveLength(4)
    expect(lines[0]).toBe(QUESTION_IMPORT_HEADER.join(','))
    expect(lines[3]).toBe('')
  })

  it('keeps the exact BM copy of the file and row messages', () => {
    expect(QUESTION_IMPORT_MESSAGES.fileRequired).toBe('Sila pilih fail CSV.')
    expect(QUESTION_IMPORT_MESSAGES.fileType).toBe('Fail mesti jenis CSV atau TXT dan tidak melebihi 5MB.')
    expect(QUESTION_IMPORT_MESSAGES.noData).toBe('Fail CSV tiada baris data.')
    expect(QUESTION_IMPORT_MESSAGES.missingColumns(QUESTION_IMPORT_REQUIRED_COLUMNS)).toBe('Fail CSV mesti mempunyai kolum question_text, option_a, option_b, correct_answer.')
    expect(QUESTION_IMPORT_MESSAGES.imported(3, 1)).toBe('Import selesai: 3 soalan diimport, 1 gagal.')
    expect(QUESTION_IMPORT_ROW_MESSAGES).toMatchObject({
      incomplete: 'Baris tidak lengkap.',
      answer: 'Jawapan betul mesti A, B, C atau D.',
      subject: 'Subjek tidak sah.',
      difficulty: 'Tahap kesukaran mesti 1 hingga 5.',
      marks: 'Markah mesti nombor bulat sekurang-kurangnya 1.',
    })
  })

  it('neutralises spreadsheet formulas in generated cells', () => {
    for (const v of ['=SUM(A1)', '+1', '-1', '@cmd']) expect(neutraliseQuestionImportCsvCell(v)).toBe(`'${v}`)
    expect(neutraliseQuestionImportCsvCell('Apakah ibu negara?')).toBe('Apakah ibu negara?')
    expect(neutraliseQuestionImportCsvCell('')).toBe('')
  })

  const run = {
    id: '3',
    fileName: 'soalan.csv',
    importedCount: 2,
    failedCount: 1,
    failures: [{ row: 4, message: 'Baris tidak lengkap.' }],
    defaults: { subjectId: '1', educationLevelId: null, difficultyLevel: 2 },
    createdBy: '1',
    createdAt: AT,
    createdMonth: '2026-10',
  }

  it('parses a run and the 201 body', () => {
    expect(ok(QuestionImportRunSchema, run)).toBe(true)
    expect(ok(QuestionImportCreatedSchema, { data: run, status: 'Import selesai: 2 soalan diimport, 1 gagal.' })).toBe(true)
    expect(ok(QuestionImportRunSchema, { ...run, createdMonth: '2026-13' })).toBe(false)
    expect(ok(QuestionImportRunSchema, { ...run, failures: [{ row: 0, message: 'x' }] })).toBe(false)
  })

  it('validates the multipart body: file part and defaults', () => {
    const file = new File(['question_text,option_a\n'], 'soalan.csv', { type: 'text/csv' })
    expect(ok(QuestionImportCreateRequestSchema, { csvFile: file })).toBe(true)
    expect(ok(QuestionImportCreateRequestSchema, { csvFile: file, defaultSubjectId: '1', defaultEducationLevelId: '4', defaultDifficultyLevel: '2' })).toBe(true)
    expect(ok(QuestionImportCreateRequestSchema, { csvFile: new File(['x'], 'soalan.txt', { type: '' }) })).toBe(true)
    expect(ok(QuestionImportCreateRequestSchema, { csvFile: new File(['x'], 'soalan.pdf', { type: 'application/pdf' }) })).toBe(false)
    expect(ok(QuestionImportCreateRequestSchema, { csvFile: new File(['x'], 'soalan.csv', { type: 'image/png' }) })).toBe(false)
    expect(ok(QuestionImportCreateRequestSchema, { csvFile: new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'besar.csv', { type: 'text/csv' }) })).toBe(false)
    expect(ok(QuestionImportCreateRequestSchema, { csvFile: 'plain text' })).toBe(false)
    expect(ok(QuestionImportCreateRequestSchema, {})).toBe(false)
    expect(messageAt(QuestionImportCreateRequestSchema, { csvFile: file, defaultDifficultyLevel: '6' }, 'defaultDifficultyLevel')).toBe('Sila pilih tahap kesukaran.')
  })

  it('parses the Guru result (200, no flash)', () => {
    expect(ok(QuestionImportGuruResultSchema, { imported: 2, failed: [{ row: 3, message: 'Soalan tidak boleh melebihi 2000 aksara.' }] })).toBe(true)
    expect(ok(QuestionImportGuruResultSchema, { imported: 2 })).toBe(false)
  })
})

describe('quality', () => {
  it('maps scores to the SRS bands on every boundary', () => {
    expect(QUESTION_QUALITY_BANDS.map((b) => [b.band, b.min, b.max])).toEqual([
      ['cemerlang', 76, 100],
      ['baik', 51, 75],
      ['lemah', 26, 50],
      ['kritikal', 0, 25],
    ])
    const cases: [number, string][] = [[100, 'cemerlang'], [76, 'cemerlang'], [75, 'baik'], [51, 'baik'], [50, 'lemah'], [26, 'lemah'], [25, 'kritikal'], [0, 'kritikal']]
    for (const [score, band] of cases) expect(questionQualityBandOf(score), String(score)).toBe(band)
  })

  const summary = {
    total: 120,
    average: 71.4,
    scoredCount: 100,
    excellentCount: 40,
    activeActionCount: 8,
    buckets: { baik: 30, lemahKritikal: 8, legacyGeneric: 5 },
    distribution: { cemerlang: 40, baik: 30, lemah: 20, kritikal: 10 },
    bySubject: [{ subjectId: '2', name: 'Matematik', count: 20, average: 80.5, excellentPct: 55 }],
    byLevel: [{ levelId: '1', name: 'Tingkatan 1', count: 0, average: 0 }],
    actionList: [{ id: '41', questionText: 'Apakah ibu negara Malaysia?', subject: { id: '2', name: 'Geografi' }, level: null, sourceSet: null, qualityScore: 35 }],
    lastAuditAt: null,
  }

  it('parses the summary and the audit result', () => {
    expect(ok(QuestionQualitySummarySchema, summary)).toBe(true)
    expect(ok(QuestionQualitySummarySchema, { ...summary, lastAuditAt: AT })).toBe(true)
    expect(ok(QuestionQualitySummarySchema, { ...summary, average: 101 })).toBe(false)
    expect(ok(QuestionQualitySummarySchema, { ...summary, actionList: [{ ...summary.actionList[0], qualityScore: 101 }] })).toBe(false)
    expect(ok(QuestionQualityAuditedSchema, { data: { lastAuditAt: AT }, status: 'Audit kualiti selesai.' })).toBe(true)
    expect(ok(QuestionQualityAuditedSchema, { data: { lastAuditAt: null }, status: 'x' })).toBe(false)
  })
})

describe('diagram audit', () => {
  const pager = { page: 1, pageSize: 20, totalItems: 1, totalPages: 1, from: 1, to: 1 }
  const list = {
    data: {
      mcq: { items: [{ id: '41', questionText: 'Rajah menunjukkan sebuah litar.', subject: { id: '2', name: 'Sains' }, createdBy: { id: '7', name: null }, sourceFile: 'kertas.pdf', sourcePage: 3 }], meta: pager },
      structured: { items: [], meta: { ...pager, totalItems: 0, from: null, to: null } },
    },
    meta: { stats: { mcq: 1, structured: 0, total: 1 }, bySubject: [{ name: 'Sains', count: 1 }], unfilteredMcq: 1 },
  }

  it('parses the two lists with aggregates', () => {
    expect(ok(DiagramAuditResponseSchema, list)).toBe(true)
    expect(ok(DiagramAuditResponseSchema, { ...list, meta: { ...list.meta, bySubject: Array.from({ length: 11 }, (_, i) => ({ name: `S${String(i)}`, count: 1 })) } })).toBe(false)
    expect(ok(DiagramAuditResponseSchema, { data: list.data })).toBe(false)
  })

  it('knows the two kinds only', () => {
    expect(ok(DiagramAuditKindSchema, 'mcq')).toBe(true)
    expect(ok(DiagramAuditKindSchema, 'structured')).toBe(true)
    expect(ok(DiagramAuditKindSchema, 'pksk')).toBe(false)
    expect(ok(DiagramAuditQuerySchema, { subjectId: '2', schoolId: '9', mcqPage: '2', strPage: '1' })).toBe(true)
  })

  it('validates the image part', () => {
    expect(ok(DiagramAuditImageRequestSchema, { image: new File(['x'], 'rajah.png', { type: 'image/png' }) })).toBe(true)
    expect(ok(DiagramAuditImageRequestSchema, { image: new File(['x'], 'rajah.gif', { type: 'image/gif' }) })).toBe(true)
    expect(ok(DiagramAuditImageRequestSchema, { image: new File(['<svg/>'], 'rajah.svg', { type: 'image/svg+xml' }) })).toBe(false)
    expect(ok(DiagramAuditImageRequestSchema, { image: new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'besar.png', { type: 'image/png' }) })).toBe(false)
    expect(ok(DiagramAuditImageRequestSchema, {})).toBe(false)
    expect(DIAGRAM_AUDIT_MESSAGES.fileType).toBe('Gambar mesti jenis JPG, PNG, WebP atau GIF dan tidak melebihi 2MB.')
  })

  it('answers image and dismiss with needsDiagram false and the flash', () => {
    expect(ok(DiagramAuditMutationSchema, { data: { id: '41', needsDiagram: false }, status: DIAGRAM_AUDIT_MESSAGES.uploaded })).toBe(true)
    expect(ok(DiagramAuditMutationSchema, { data: { id: '41', needsDiagram: true }, status: 'x' })).toBe(false)
    expect(DIAGRAM_AUDIT_MESSAGES.dismissed).toBe('Soalan telah dikeluarkan daripada senarai audit.')
  })
})

describe('DSKP lookups (bare arrays)', () => {
  it('parses bare arrays and refuses an envelope', () => {
    expect(ok(GuruDskpBidangListSchema, [{ id: '1', code: null, name: 'Bidang Pembelajaran' }, { id: '2', code: 'B1', name: 'Nombor' }])).toBe(true)
    expect(ok(GuruDskpBidangListSchema, [])).toBe(true)
    expect(ok(GuruDskpBidangListSchema, { data: [] })).toBe(false)
    expect(ok(GuruDskpSkListSchema, [{ id: '5', code: '1.1', description: 'Menyatakan nilai.' }])).toBe(true)
    expect(ok(GuruDskpSpListSchema, [{ id: '6', code: '1.1.1', description: 'Menyebut nombor.' }])).toBe(true)
    expect(ok(GuruDskpSpListSchema, [{ id: '6', code: null, description: 'x' }])).toBe(false)
  })

  it('does not require the query values (a missing value answers [])', () => {
    expect(ok(GuruDskpBidangQuerySchema, {})).toBe(true)
    expect(ok(GuruDskpBidangQuerySchema, { subjectId: '1', educationLevelId: '4' })).toBe(true)
  })
})

describe('master notes and the AI stub', () => {
  const note = { id: '4', questionId: '41', subjectName: '—', chapter: null, model: 'canned-v1', tokens: 900, confidence: 85, questionText: 'Apakah ibu negara Malaysia?', noteText: 'Nota ringkas.', trapText: 'Perangkap.', flagged: true, teacherApproved: false, createdAt: AT }
  const meta = { page: 1, pageSize: 15, totalItems: 1, totalPages: 1, from: 1, to: 1, activeTab: 'flagged', summary: { flagged: 1, teacherApproved: 0, total: 1 } }

  it('parses a page of notes', () => {
    expect(ok(MasterNoteListResponseSchema, { data: [note], meta })).toBe(true)
    expect(ok(MasterNoteListResponseSchema, { data: [note], meta: { ...meta, activeTab: 'bogus' } })).toBe(false)
    expect(ok(MasterNoteListResponseSchema, { data: [{ ...note, flagged: 'yes' }], meta })).toBe(false)
  })

  it('knows the three actions and answers { ok: true }', () => {
    for (const a of ['approve', 'regen', 'unflag']) expect(ok(MasterNoteActionSchema, a)).toBe(true)
    expect(ok(MasterNoteActionSchema, 'delete')).toBe(false)
    expect(ok(MasterNoteActionResultSchema, { ok: true })).toBe(true)
    expect(ok(MasterNoteActionResultSchema, { ok: false })).toBe(false)
  })

  it('marks the AI explanation response as a stub', () => {
    expect(ok(QuestionWorkflowAiExplanationResultSchema, { ok: true, message: QUESTION_WORKFLOW_AI_MESSAGES.generated, stub: true })).toBe(true)
    expect(ok(QuestionWorkflowAiExplanationResultSchema, { ok: true, message: QUESTION_WORKFLOW_AI_MESSAGES.kept, stub: true })).toBe(true)
    expect(ok(QuestionWorkflowAiExplanationResultSchema, { ok: true, message: QUESTION_WORKFLOW_AI_MESSAGES.generated })).toBe(false)
    expect(ok(QuestionWorkflowAiExplanationResultSchema, { ok: true, message: 'lain', stub: true })).toBe(false)
    expect(QUESTION_WORKFLOW_AI_MESSAGES.generated).toBe('Penjelasan AI berjaya dijana.')
    expect(QUESTION_WORKFLOW_AI_MESSAGES.kept).toBe('Penjelasan AI sudah wujud.')
  })

  it('error bodies carry field messages', () => {
    const body = { error: { code: 'VALIDATION_ERROR', message: 'Sila pilih fail CSV.', fields: { csvFile: 'Sila pilih fail CSV.' } } }
    expect(ok(ErrorBodySchema, body)).toBe(true)
  })
})

describe('openapi registration', () => {
  type Operation = {
    tags?: string[]
    parameters?: { name: string; in: string }[]
    requestBody?: { content: Record<string, unknown> }
    responses: Record<string, { content?: Record<string, unknown>; headers?: Record<string, unknown> }>
  }
  const doc = buildOpenApiDocument() as unknown as {
    paths: Record<string, Record<string, Operation>>
    components: { schemas: Record<string, unknown> }
  }

  const ROUTES: readonly [string, string][] = [
    ['get', '/question-reports'], ['post', '/question-reports'], ['get', '/question-reports/mine'], ['patch', '/question-reports/{id}'],
    ['get', '/question-imports'], ['post', '/question-imports'], ['get', '/question-imports/template'],
    ['get', '/guru/questions/template'], ['post', '/guru/questions/import'],
    ['get', '/question-quality'], ['post', '/question-quality/audit'],
    ['get', '/diagram-audit'], ['post', '/diagram-audit/{kind}/{id}/image'], ['post', '/diagram-audit/{kind}/{id}/dismiss'],
    ['get', '/guru/dskp/bidang'], ['get', '/guru/dskp/sk'], ['get', '/guru/dskp/sp'],
    ['get', '/master-notes'], ['post', '/master-notes/{id}/{action}'],
    ['post', '/questions/{id}/ai-explanation'],
  ]
  const operations = (): [string, string, Operation][] =>
    Object.entries(doc.paths).flatMap(([path, item]) =>
      Object.entries(item)
        .filter(([, op]) => op.tags?.includes('question-workflow'))
        .map(([method, op]): [string, string, Operation] => [method, path, op]),
    )

  it('registers the 20 routes, and only those, under the question-workflow tag', () => {
    expect(ROUTES).toHaveLength(20)
    expect(operations()).toHaveLength(20)
    for (const [method, path] of ROUTES) {
      const op = doc.paths[path]?.[method]
      expect(op, `${method} ${path}`).toBeDefined()
      expect(op?.tags).toContain('question-workflow')
    }
  })

  it('does not port the question-submissions routes (D53/OWN-1)', () => {
    expect(Object.keys(doc.paths).filter((p) => p.startsWith('/question-submissions'))).toEqual([])
  })

  it('contains every component, with unique prefixed ids that cannot clash with BE-09', () => {
    const ids = Object.keys(QUESTION_WORKFLOW_COMPONENT_SCHEMAS)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(doc.components.schemas, id).toHaveProperty(id)
      expect(id).toMatch(/^(QuestionWorkflow|QuestionReport|QuestionImport|QuestionQuality|DiagramAudit|MasterNote|GuruDskp)/)
    }
    const be09 = ['Question', 'QuestionStatus', 'QuestionType', 'QuestionSummary', 'QuestionRow', 'QuestionDetail', 'QuestionNamedRef', 'QuestionPart', 'QuestionPublic', 'QuestionGuruSummary', 'QuestionGuruDetail', 'QuestionBulkRequest']
    for (const id of be09) expect(ids).not.toContain(id)
  })

  it('exposes the lifecycle enum with exactly the D54 codes', () => {
    expect((doc.components.schemas.QuestionWorkflowStatus as { enum: string[] }).enum).toEqual(['draft', 'review', 'approved', 'archived'])
  })

  it('requires X-CSRF-Token and describes CSRF_INVALID on every mutation, and none on reads', () => {
    for (const [method, path, op] of operations()) {
      const csrf = (op.parameters ?? []).some((p) => p.in === 'header' && p.name === 'X-CSRF-Token')
      const mutating = method !== 'get'
      expect(csrf, `${method} ${path}`).toBe(mutating)
      if (mutating) {
        const forbidden = JSON.stringify(op.responses['403'])
        expect(forbidden, `${method} ${path}`).toContain('CSRF_INVALID')
      }
    }
  })

  it('declares 401 on every route and 403 on every route but the two report routes open to any user', () => {
    const open = new Set(['post /question-reports', 'get /question-reports/mine'])
    for (const [method, path, op] of operations()) {
      expect(op.responses['401'], `${method} ${path}`).toBeDefined()
      if (!open.has(`${method} ${path}`) || method !== 'get') expect(op.responses['403'], `${method} ${path}`).toBeDefined()
      else expect(op.responses['403']).toBeUndefined()
    }
  })

  it('describes the file routes as multipart/form-data', () => {
    for (const path of ['/question-imports', '/guru/questions/import', '/diagram-audit/{kind}/{id}/image']) {
      expect(Object.keys(doc.paths[path]?.post?.requestBody?.content ?? {})).toEqual(['multipart/form-data'])
    }
  })

  it('serves the templates as text/csv with a Content-Disposition header', () => {
    for (const path of ['/question-imports/template', '/guru/questions/template']) {
      const ok200 = doc.paths[path]?.get?.responses['200']
      expect(Object.keys(ok200?.content ?? {})).toEqual(['text/csv'])
      expect(JSON.stringify(ok200?.headers)).toContain('template-import-soalan.csv')
    }
  })

  it('answers the DSKP lookups with bare arrays and the stub marker in the AI response', () => {
    const sk = JSON.stringify(doc.paths['/guru/dskp/sk']?.get?.responses['200'])
    expect(sk).toContain('GuruDskpSkList')
    const stub = doc.components.schemas.QuestionWorkflowAiExplanationResult as { required: string[] }
    expect(stub.required).toContain('stub')
    const ai = doc.paths['/questions/{id}/ai-explanation']?.post as unknown as { description: string }
    expect(ai.description).toContain('STUB')
  })
})
