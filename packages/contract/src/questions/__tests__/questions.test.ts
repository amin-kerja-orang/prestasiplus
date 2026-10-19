import { describe, expect, it } from 'vitest'

import {
  QUESTION_MESSAGES,
  QUESTION_STATUSES,
  QuestionBulkRequestSchema,
  QuestionCreateRequestSchema,
  QuestionDetailSchema,
  QuestionGuruCreateRequestSchema,
  QuestionGuruUpdateRequestSchema,
  QuestionListQuerySchema,
  QuestionPartSchema,
  QuestionPublicSchema,
  QuestionRowSchema,
  QuestionSchema,
  QuestionStatusSchema,
  QuestionStructuredDetailSchema,
  QuestionUpdateRequestSchema,
  mutationEnvelopeOf,
} from '../../index'
import { buildOpenApiDocument } from '../../openapi'
import { QUESTIONS_COMPONENT_SCHEMAS } from '../paths'

const T = '2026-10-16T09:30:00+08:00'
const rt = (ms: string) => ({ ms })
const optionsOf = (labels: string) => [...labels].map((label) => ({ label, body: rt(`Pilihan ${label}`) }))
const mcqLeaf = {
  label: '',
  prompt: rt('Soalan ujian fiksyen.'),
  marks: 1,
  mode: 'mcq',
  options: optionsOf('ABCD'),
  key: { kind: 'option', correct: 'B' },
}
const numericLeaf = {
  label: '(i)',
  prompt: rt('Hitung nilai.'),
  marks: 2,
  mode: 'numeric',
  key: { kind: 'accepted', values: [{ v: 5.3, tol: 0.01, unit: 'cm' }] },
}
const pointsKey = {
  kind: 'points',
  marks: 3,
  points: [
    { id: 'p1', code: 'K', label: 'K1', marks: 1, accept: ['x=2'], requires: [] },
    { id: 'p2', code: 'N', label: 'N1', marks: 2, requires: ['p1'], ecf: { fromPart: '(a)', rule: { op: 'sub_from', k: 10 } } },
  ],
  groups: [{ id: 'g1', anyN: 2, eachMarks: 1, pointIds: ['p1', 'p2'] }],
  final: { display: 'x=2', accept: ['2'], tolerance: 0.1 },
}

const question = {
  id: '101',
  subjectId: '3',
  educationLevelId: '10',
  difficultyLevel: 3,
  questionType: 'mcq',
  questionText: 'Soalan contoh fiksyen untuk ujian.',
  questionImage: null,
  options: ['A', 'B', 'C', 'D'],
  optionImages: [null, null, null, null],
  correctAnswer: 1,
  tfAnswer: null,
  correctAnswerText: null,
  altAnswers: [],
  modelAnswer: null,
  explanation: 'Penjelasan fiksyen.',
  aiExplanation: null,
  language: 'bm',
  pointsValue: 1,
  status: 'published',
  isActive: true,
  complianceStatus: 'verified',
  aiVerified: false,
  sourceType: 'textbook',
  sourceFile: null,
  sourcePage: null,
  sourceSet: null,
  qualityScore: null,
  needsDiagram: false,
  spmPool: false,
  dskpSpId: null,
  curriculumChapterId: null,
  curriculumTopicId: null,
  chapterLabel: null,
  scriptType: 'rumi',
  textDirection: 'ltr',
  createdBy: '7',
  createdAt: T,
  updatedAt: T,
  usage: { attempts: 0, correct: 0 },
}

describe('lifecycle codes (D54a)', () => {
  it('accepts exactly the five v2 codes and refuses the mock values', () => {
    expect(QUESTION_STATUSES).toEqual(['draft', 'review', 'approved', 'published', 'archived'])
    for (const s of QUESTION_STATUSES) expect(QuestionStatusSchema.safeParse(s).success).toBe(true)
    for (const s of ['pending_review', 'rejected', 'pending', 'Draf'])
      expect(QuestionStatusSchema.safeParse(s).success).toBe(false)
  })
  it('refuses a mock status in the list filter, the row and the bulk action', () => {
    expect(QuestionListQuerySchema.safeParse({ status: 'pending_review' }).success).toBe(false)
    expect(QuestionListQuerySchema.parse({ status: 'review' })).toMatchObject({ status: 'review', page: 1, pageSize: 20 })
    expect(QuestionBulkRequestSchema.safeParse({ action: 'approve', ids: ['1'] }).success).toBe(false)
    expect(QuestionBulkRequestSchema.safeParse({ action: 'published', ids: ['1'] }).success).toBe(true)
    expect(QuestionBulkRequestSchema.safeParse({ action: 'delete', ids: [] }).success).toBe(false)
  })
})

describe('admin list, detail and mutation shapes', () => {
  it('parses a row, a question and a detail', () => {
    const row = {
      id: '101',
      questionText: question.questionText,
      subject: { id: '3', name: 'Matematik' },
      level: null,
      difficultyLevel: 3,
      status: 'draft',
      isActive: true,
      complianceStatus: 'draft',
      aiVerified: false,
      dskpTagged: false,
      sourceType: null,
      sourceFile: null,
    }
    expect(QuestionRowSchema.safeParse(row).success).toBe(true)
    expect(QuestionRowSchema.safeParse({ ...row, id: 101 }).success).toBe(false)
    expect(QuestionRowSchema.safeParse({ ...row, status: 'pending_review' }).success).toBe(false)
    expect(QuestionSchema.safeParse(question).success).toBe(true)
    const { createdBy: _c, ...rest } = question
    void _c
    const detail = { ...rest, subject: null, level: null, dskp: null, createdBy: { id: '7', name: null } }
    expect(QuestionDetailSchema.safeParse(detail).success).toBe(true)
    expect(mutationEnvelopeOf(QuestionSchema).safeParse({ data: question, status: QUESTION_MESSAGES.added }).success).toBe(true)
  })
  it('rejects non-+08:00 timestamps and PKSK status', () => {
    expect(QuestionSchema.safeParse({ ...question, createdAt: '2026-10-16T01:30:00Z' }).success).toBe(false)
    expect(QuestionSchema.safeParse({ ...question, status: 'pending' }).success).toBe(false)
  })
})

describe('create and update requests (mock validation copy)', () => {
  const base = { subjectId: '3', educationLevelId: '10', difficultyLevel: '3', questionText: 'Soalan contoh fiksyen.' }
  it('accepts an MCQ and coerces digit strings', () => {
    const r = QuestionCreateRequestSchema.parse({ ...base, questionType: 'mcq', options: ['a', 'b', 'c', 'd'], correctAnswer: '2' })
    expect(r.difficultyLevel).toBe(3)
    expect(r.correctAnswer).toBe(2)
  })
  it('reports mock messages per field', () => {
    const r = QuestionCreateRequestSchema.safeParse({ ...base, questionText: 'pendek', difficultyLevel: 9, questionType: 'mcq' })
    expect(r.success).toBe(false)
    const msgs = Object.fromEntries((r.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]))
    expect(msgs.questionText).toBe(QUESTION_MESSAGES.text)
    expect(msgs.options).toBe(QUESTION_MESSAGES.options)
    expect(msgs.correctAnswer).toBe(QUESTION_MESSAGES.correctAnswer)
    expect(QuestionCreateRequestSchema.safeParse({ ...base, questionType: 'short_answer' }).error?.issues[0]?.message).toBe(
      QUESTION_MESSAGES.answerText,
    )
    expect(QuestionCreateRequestSchema.safeParse({ ...base, questionType: 'poem' }).success).toBe(false)
  })
  it('lets create carry a v2 lifecycle status and rejects a mock one', () => {
    const b = { ...base, questionType: 'true_false' }
    expect(QuestionCreateRequestSchema.safeParse({ ...b, status: 'published' }).success).toBe(true)
    expect(QuestionCreateRequestSchema.safeParse({ ...b, status: 'rejected' }).success).toBe(false)
    expect(QuestionUpdateRequestSchema.safeParse(base).success).toBe(true)
    expect(QuestionUpdateRequestSchema.safeParse({ difficultyLevel: 2 }).success).toBe(false)
  })
})

describe('part tree (D1 to D4)', () => {
  it('round-trips a single MCQ part and a 3-level tree', () => {
    expect(QuestionPartSchema.safeParse(mcqLeaf).success).toBe(true)
    const tree = {
      label: '(a)',
      prompt: rt('Bahagian a.'),
      children: [
        { label: '(i)', prompt: rt('Bahagian i.'), children: [{ ...numericLeaf, label: '(A)' }] },
        { ...numericLeaf, key: { kind: 'accepted', values: [{ v: 1 }] } },
      ],
    }
    expect(QuestionPartSchema.safeParse(tree).success).toBe(true)
  })
  it('rejects marks or a key on a branch part and a 4th level', () => {
    const branch = { label: '(a)', prompt: rt('x'), children: [numericLeaf] }
    expect(QuestionPartSchema.safeParse({ ...branch, marks: 2 }).success).toBe(false)
    expect(QuestionPartSchema.safeParse({ ...branch, key: numericLeaf.key }).success).toBe(false)
    const deep = { label: '(a)', prompt: rt('x'), children: [{ label: '(i)', prompt: rt('x'), children: [{ label: '(A)', prompt: rt('x'), children: [numericLeaf] }] }] }
    expect(QuestionPartSchema.safeParse(deep).success).toBe(false)
  })
  it('rejects a key of the wrong kind for the mode and a correct option that does not exist', () => {
    expect(QuestionPartSchema.safeParse({ ...mcqLeaf, key: { kind: 'rubric', marks: 1, criteria: [{ id: 'c', name: 'n' }], bands: [{ name: 'b', range: [0, 1] }] } }).success).toBe(false)
    expect(QuestionPartSchema.safeParse({ ...mcqLeaf, key: { kind: 'option', correct: 'H' } }).success).toBe(false)
    expect(QuestionPartSchema.safeParse({ ...mcqLeaf, options: optionsOf('AB') }).success).toBe(false)
  })
  it('validates the five key kinds and mark-point features', () => {
    const leaf = (mode: string, key: unknown, extra = {}) => ({ label: '', prompt: rt('x'), marks: 3, mode, key, ...extra })
    expect(QuestionPartSchema.safeParse(leaf('working', pointsKey)).success).toBe(true)
    expect(QuestionPartSchema.safeParse(leaf('match_letter', { kind: 'mapping', map: { '27': 'E' }, bankUnique: true })).success).toBe(true)
    expect(QuestionPartSchema.safeParse(leaf('short_text', { kind: 'accepted', values: ['jawapan'] })).success).toBe(true)
    expect(QuestionPartSchema.safeParse(leaf('table_fill', { kind: 'mapping', cells: { r1c2: ['A', 'a'] } })).success).toBe(true)
    expect(
      QuestionPartSchema.safeParse(
        leaf('essay', { kind: 'rubric', marks: 30, criteria: [{ id: 'c1', name: 'Idea' }], bands: [{ name: 'Cemerlang', range: [28, 30] }] }, { wordRange: { min: 150, max: 200 } }),
      ).success,
    ).toBe(true)
    expect(QuestionPartSchema.safeParse(leaf('working', { ...pointsKey, points: [{ ...pointsKey.points[0], code: 'Z' }] })).success).toBe(false)
    expect(QuestionPartSchema.safeParse(leaf('numeric', { kind: 'accepted', values: ['abc'] })).success).toBe(false)
  })
})

describe('student-facing projection', () => {
  it('strips the answer key, explanation and model answer from a full admin question', () => {
    const out = QuestionPublicSchema.parse({ ...question, parts: [mcqLeaf, numericLeaf] }) as Record<string, unknown>
    for (const k of ['correctAnswer', 'tfAnswer', 'correctAnswerText', 'altAnswers', 'modelAnswer', 'explanation', 'sourceFile', 'status'])
      expect(k in out).toBe(false)
    const parts = out.parts as Record<string, unknown>[]
    expect(parts.every((p) => !('key' in p))).toBe(true)
    expect(JSON.stringify(out)).not.toContain('"correct"')
  })
})

describe('structured and Guru shapes', () => {
  it('parses a structured detail and refuses a mock status', () => {
    const d = {
      id: '5', subjectId: '4', educationLevelId: '11', subject: null, level: null, kbatLevel: 3, status: 'published', isActive: true,
      needsDiagram: false, estimatedMinutes: 10, isTrial: false, topic: null, questionNumber: null, stimulus: 'Petikan fiksyen.',
      stimulusImage: null, totalMarks: 4, visibility: 'public', complianceStatus: 'verified', sourceFile: null, sourcePage: null,
      sourceSet: null, curriculumChapterId: null, curriculumTopicId: null, dskpSpId: null, scriptType: 'rumi', textDirection: 'ltr',
      questionTemplate: null,
      subQuestions: [{ id: '9', structuredQuestionId: '5', partLabel: '(a)', questionText: 'Terangkan.', marks: 4, answerType: 'text', expectedNumeric: null, numericTolerance: null, rubrics: [{ konstruk: 'Fakta', keyword: 'contoh', marks: 2 }], modelAnswer: 'Jawapan.', parentSubId: null, order: 1 }],
      createdBy: { id: '7', name: null }, createdAt: T, updatedAt: T,
    }
    expect(QuestionStructuredDetailSchema.safeParse(d).success).toBe(true)
    expect(QuestionStructuredDetailSchema.safeParse({ ...d, status: 'pending_review' }).success).toBe(false)
  })
  it('validates the Guru create and update bodies with the Guru copy', () => {
    const b = { educationLevelId: '10', subjectId: '3', questionType: 'mcq', difficultyLevel: 'easy', questionText: 'Soalan?', options: ['a', { text: 'b' }, { optionText: 'c' }, 'd'], correctAnswer: 'B' }
    expect(QuestionGuruCreateRequestSchema.safeParse(b).success).toBe(true)
    const bad = QuestionGuruCreateRequestSchema.safeParse({ ...b, questionText: '' })
    expect(bad.error?.issues[0]?.message).toBe(QUESTION_MESSAGES.guruText)
    expect(QuestionGuruCreateRequestSchema.safeParse({ ...b, questionText: 'x'.repeat(2001) }).error?.issues[0]?.message).toBe(QUESTION_MESSAGES.guruTextLong)
    expect(QuestionGuruCreateRequestSchema.safeParse({ ...b, difficultyLevel: 'extreme' }).success).toBe(false)
    expect(QuestionGuruUpdateRequestSchema.safeParse({ questionText: 'Baru', options: [0, 1, 2, 3].map((id) => ({ id, optionText: `o${String(id)}` })), correctOptionId: 'C' }).success).toBe(true)
  })
})

describe('OpenAPI', () => {
  const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>>; components: { schemas: Record<string, unknown> } }
  it('contains every BE-09 path and method', () => {
    const expected: [string, string[]][] = [
      ['/questions', ['get', 'post']],
      ['/questions/summary', ['get']],
      ['/questions/bulk-action', ['post']],
      ['/questions/{id}', ['get', 'put', 'delete']],
      ['/structured-questions', ['get']],
      ['/structured-questions/{id}', ['get']],
      ['/guru/questions', ['get', 'post']],
      ['/guru/questions/{id}', ['get', 'put', 'delete']],
    ]
    for (const [path, methods] of expected) for (const m of methods) expect(doc.paths[path]?.[m], `${m} ${path}`).toBeDefined()
  })
  it('contains every BE-09 component and no legacy field', () => {
    for (const name of Object.keys(QUESTIONS_COMPONENT_SCHEMAS)) expect(doc.components.schemas[name], name).toBeDefined()
    expect(JSON.stringify(doc.components.schemas)).not.toMatch(/legacy_|pkskDomainId/)
  })
})
