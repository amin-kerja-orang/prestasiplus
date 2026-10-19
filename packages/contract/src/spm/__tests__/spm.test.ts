import { describe, expect, it } from 'vitest'

import { ErrorBodySchema } from '../../common/error'
import { buildOpenApiDocument } from '../../openapi'
import {
  DUTA_TIERS,
  DutaCardSchema,
  DutaRecommendationQuerySchema,
  DutaRecommendationSchema,
  SPM_COUNT_OPTIONS,
  SPM_ERROR_CODES,
  SPM_MESSAGES,
  SPM_MOCK_GRADES,
  SPM_MOCK_SUBJECTS,
  SPM_WALKTHROUGH_MAX_IMAGE_BYTES,
  SPM_WALKTHROUGH_SUBJECTS,
  SpmDatabankSubjectSchema,
  SpmLatihTubiConfigSchema,
  SpmLatihTubiListSchema,
  SpmMockCreateRequestSchema,
  SpmMockCreatedSchema,
  SpmMockExamViewSchema,
  SpmMockListItemSchema,
  SpmMockResultSchema,
  SpmMockSubmitRequestSchema,
  SpmOverviewSchema,
  SpmSubjektifOverviewSchema,
  SpmTrackingAHubSchema,
  SpmTrackingASubjectResultSchema,
  SpmWalkthroughRequestSchema,
  SpmWalkthroughResponseSchema,
} from '../schema'
import { SPM_COMPONENT_SCHEMAS } from '../paths'

const AT = '2026-10-16T09:30:00+08:00'
const MOCK_ID = '4b1f6c1e-2c4e-4d7e-9a3b-0f5e1c2d3a4b'

type Schema = { safeParse: (v: unknown) => { success: boolean } }
const ok = (schema: Schema, value: unknown) => schema.safeParse(value).success

/** All keys of a JSON value, recursively. */
const keysOf = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.flatMap(keysOf)
    : v && typeof v === 'object'
      ? Object.entries(v).flatMap(([k, x]) => [k, ...keysOf(x)])
      : []

const diff = { '1': 0, '2': 12, '3': 30, '4': 8, '5': 0 }

const overview = {
  stats: { totalQuestions: 20529, subjectCount: 19, yearsAvailable: 0, trackingAQuestions: 747 },
  modules: { databank: 14673, latihTubi: 14673, trackingA: 747, subjektifSets: 210 },
  me: { sessions: 4, avgAccuracy: 62.5, coins: 40, answered: 120 },
}

const card = {
  code: 'MATH',
  name: 'Matematik',
  nameEn: 'Mathematics',
  icon: '📐',
  color: '#2563EB',
  total: 1681,
  targetType: 'spm',
  targetSize: 40,
  locked: false,
}

const config = {
  code: 'MATH',
  name: 'Matematik',
  icon: null,
  color: '#2563EB',
  total: 50,
  targetType: 'spm',
  targetSize: 40,
  levelCounts: { '10': 30, '11': 20 },
  difficultyStats: diff,
  difficultyByLevel: { '10': diff, '11': diff },
  countOptions: [{ value: 40, label: '40 (Target SPM)', isTarget: true }],
  defaultCount: 40,
}

const openCard = {
  subjectId: '12',
  code: 'GEO',
  name: 'Geografi',
  nameEn: 'Geography',
  icon: null,
  color: '#16A34A',
  readyQuestions: 80,
  bankBesarSets: 1,
  bersihSets: 1,
  targetType: 'spm',
  targetSize: 40,
  bankSource: 67,
  startableSets: 2,
}

const tile = {
  code: 'GEO',
  name: 'Geografi',
  targetSize: 40,
  bersih: 1,
  bankBesar: 1,
  locked: 1,
  total: 3,
  readiness: 67,
  lockedSets: [{ setNo: 3, readyCount: 12, target: 40 }],
  hasBankBesar: true,
}

const hub = {
  objectiveLane: { subjects: 3, sets: 9, questions: 747 },
  bahasaLane: { subjects: 2, sets: 14 },
  readiness: null,
  bahasa: [
    { subjectId: '1', code: 'BM', name: 'Bahasa Melayu', nameEn: 'Malay', sets: 8 },
    { subjectId: '2', code: 'BI', name: 'Bahasa Inggeris', nameEn: 'English', sets: 6 },
  ],
  openSubjects: [openCard],
}

const subjectSets = {
  code: 'GEO',
  name: 'Geografi',
  icon: null,
  color: '#16A34A',
  targetType: 'spm',
  targetSize: 40,
  summary: { bersih: 1, bankBesar: 1, readyQuestions: 119, belumCukup: 1 },
  sets: [
    { setNo: 1, status: 'bersih', readyCount: 40, bankSource: null, dskpTagged: 12, dskpTotal: 40 },
    { setNo: 2, status: 'bank_besar', readyCount: 40, bankSource: 67, dskpTagged: 0, dskpTotal: 40 },
    { setNo: 3, status: 'belum_cukup', readyCount: 12, bankSource: null, dskpTagged: 0, dskpTotal: 12 },
  ],
}

const subjektif = {
  stats: { setsAnswered: 2, subjectsTried: 1, bestScore: 75, bestSetsSaved: 2 },
  subjects: [
    { subjectId: '1', name: 'Bahasa Melayu', nameEn: 'Malay', group: 'teras', icon: null, color: '#DC2626', sets: 12 },
    { subjectId: '11', name: 'Biologi', nameEn: 'Biology', group: 'elektif', icon: null, color: '#16A34A', sets: 5 },
  ],
}

const listItem = {
  id: MOCK_ID,
  subject: 'Matematik',
  paperNumber: 1,
  status: 'in_progress',
  createdAt: AT,
  score: null,
  maxScore: 30,
  percent: null,
  grade: null,
}

const paper1 = {
  id: MOCK_ID,
  subject: 'Matematik',
  paperNumber: 1,
  status: 'in_progress',
  createdAt: AT,
  items: [{ no: 1, text: 'Nilai bagi 2 + 3 ialah', options: ['A. 4', 'B. 5', 'C. 6', 'D. 7'], maxMarks: 1 }],
}
const paper2 = {
  ...paper1,
  paperNumber: 2,
  items: [{ no: 1, text: 'Terangkan kitaran air.', maxMarks: 10 }],
}

const result = {
  id: MOCK_ID,
  subject: 'Matematik',
  paperNumber: 1,
  score: 1,
  maxScore: 2,
  percent: 50,
  grade: 'C',
  heroClass: 'mid',
  weakTopics: [{ topic: 'Algebra', wrongCount: 1 }],
  items: [
    {
      no: 1,
      questionId: '301',
      text: 'Nilai bagi 2 + 3 ialah',
      options: ['A. 4', 'B. 5'],
      modelAnswer: 'B',
      studentAnswer: 'B',
      marks: 1,
      maxMarks: 1,
      feedback: 'Tahniah, jawapan anda betul.',
      topic: 'Nombor',
    },
    {
      no: 2,
      questionId: '302',
      text: 'Selesaikan x + 1 = 3',
      modelAnswer: 'A',
      studentAnswer: null,
      marks: 0,
      maxMarks: 1,
      feedback: 'Jawapan yang betul ialah A.',
      topic: 'Algebra',
    },
  ],
}

const duta = {
  slug: 'cikgu-contoh-matematik',
  name: 'Cikgu Contoh Matematik',
  initials: 'CC',
  tier: 'bintang',
  tagline: 'Pakar Matematik.',
  subject: 'Matematik',
  state: 'Johor',
  rating: 4.9,
  active: true,
}

describe('M06 read models', () => {
  it('parses the overview and rejects negative or missing figures', () => {
    expect(ok(SpmOverviewSchema, overview)).toBe(true)
    expect(ok(SpmOverviewSchema, { ...overview, me: { ...overview.me, answered: -1 } })).toBe(false)
    expect(ok(SpmOverviewSchema, { ...overview, modules: { databank: 1 } })).toBe(false)
  })

  it('parses databank rows and Latih Tubi cards', () => {
    expect(ok(SpmDatabankSubjectSchema, { code: 'BM', name: 'Bahasa Melayu', nameEn: 'Malay', icon: null, color: '#DC2626', databankCount: 0 })).toBe(true)
    expect(ok(SpmLatihTubiListSchema, { teras: [card], elektif: [{ ...card, targetType: null, targetSize: null }] })).toBe(true)
    expect(ok(SpmLatihTubiListSchema, { teras: [{ ...card, targetType: 'other' }], elektif: [] })).toBe(false)
    expect(ok(SpmLatihTubiListSchema, { teras: [card] })).toBe(false)
  })

  it('parses the Latih Tubi setup: five difficulty keys, target and free options', () => {
    expect(ok(SpmLatihTubiConfigSchema, config)).toBe(true)
    const free = {
      ...config,
      targetType: null,
      targetSize: null,
      countOptions: SPM_COUNT_OPTIONS.map((n) => ({ value: n, label: String(n), isTarget: false })),
      defaultCount: 10,
    }
    expect(ok(SpmLatihTubiConfigSchema, free)).toBe(true)
    const missing = { '1': 0, '2': 0, '3': 0, '4': 0 }
    expect(ok(SpmLatihTubiConfigSchema, { ...config, difficultyStats: missing })).toBe(false)
    expect(ok(SpmLatihTubiConfigSchema, { ...config, countOptions: [] })).toBe(false)
  })

  it('parses the Tracking A hub for a student (readiness null) and an admin', () => {
    expect(ok(SpmTrackingAHubSchema, hub)).toBe(true)
    expect(ok(SpmTrackingAHubSchema, { ...hub, readiness: { summary: { bersih: 1, bankBesar: 1, locked: 1 }, tiles: [tile] } })).toBe(true)
    expect(ok(SpmTrackingAHubSchema, { ...hub, readiness: undefined })).toBe(false)
    expect(ok(SpmTrackingAHubSchema, { ...hub, bahasaLane: { subjects: 3, sets: 1 } })).toBe(false)
    const tooMany = Array.from({ length: 7 }, (_, i) => ({ setNo: i + 1, readyCount: 0, target: 40 }))
    expect(ok(SpmTrackingAHubSchema, { ...hub, readiness: { summary: { bersih: 0, bankBesar: 0, locked: 7 }, tiles: [{ ...tile, lockedSets: tooMany }] } })).toBe(false)
    expect(ok(SpmTrackingAHubSchema, { ...hub, readiness: { summary: { bersih: 0, bankBesar: 0, locked: 0 }, tiles: [{ ...tile, readiness: 101 }] } })).toBe(false)
  })

  it('parses the Tracking A subject, the BM/BI redirect and rejects an unknown status', () => {
    expect(ok(SpmTrackingASubjectResultSchema, subjectSets)).toBe(true)
    expect(ok(SpmTrackingASubjectResultSchema, { redirect: '/latihan-berstruktur?subject_id=1&scope=spm&track=bahasa' })).toBe(true)
    expect(ok(SpmTrackingASubjectResultSchema, { redirect: '/somewhere-else' })).toBe(false)
    const bad = { ...subjectSets, sets: [{ ...subjectSets.sets[0], status: 'ready' }] }
    expect(ok(SpmTrackingASubjectResultSchema, bad)).toBe(false)
  })

  it('parses Subjektif with and without attempts', () => {
    expect(ok(SpmSubjektifOverviewSchema, subjektif)).toBe(true)
    expect(ok(SpmSubjektifOverviewSchema, { ...subjektif, stats: { setsAnswered: 0, subjectsTried: 0, bestScore: null, bestSetsSaved: 0 } })).toBe(true)
    expect(ok(SpmSubjektifOverviewSchema, { ...subjektif, subjects: [{ ...subjektif.subjects[0], group: 'wajib' }] })).toBe(false)
    expect(ok(SpmSubjektifOverviewSchema, { ...subjektif, stats: { ...subjektif.stats, bestScore: 101 } })).toBe(false)
  })
})

describe('M06 mock exams', () => {
  it('parses list items in progress and graded', () => {
    expect(ok(SpmMockListItemSchema, listItem)).toBe(true)
    expect(ok(SpmMockListItemSchema, { ...listItem, status: 'submitted', score: 24, maxScore: 30, percent: 80, grade: 'A' })).toBe(true)
    expect(ok(SpmMockListItemSchema, { ...listItem, paperNumber: 3 })).toBe(false)
    expect(ok(SpmMockListItemSchema, { ...listItem, grade: 'F' })).toBe(false)
    expect(ok(SpmMockListItemSchema, { ...listItem, createdAt: '2026-10-16T09:30:00Z' })).toBe(false)
  })

  it('create request: ten subjects, paperNumber optional/null/1/2', () => {
    expect(ok(SpmMockCreateRequestSchema, { subject: 'Matematik' })).toBe(true)
    expect(ok(SpmMockCreateRequestSchema, { subject: 'Sejarah', paperNumber: null })).toBe(true)
    expect(ok(SpmMockCreateRequestSchema, { subject: 'Sejarah', paperNumber: 2 })).toBe(true)
    expect(ok(SpmMockCreateRequestSchema, { subject: 'Geografi' })).toBe(false)
    expect(ok(SpmMockCreateRequestSchema, { subject: 'Matematik', paperNumber: 3 })).toBe(false)
    expect(ok(SpmMockCreateRequestSchema, {})).toBe(false)
    expect(SPM_MOCK_SUBJECTS).toHaveLength(10)
  })

  it('create result is just the id (the 201 data)', () => {
    expect(ok(SpmMockCreatedSchema, { id: MOCK_ID })).toBe(true)
    expect(ok(SpmMockCreatedSchema, { id: '' })).toBe(false)
    expect(ok(SpmMockCreatedSchema, { id: MOCK_ID, extra: 1 })).toBe(false)
  })

  it('the exam paper parses for both papers and never carries answer keys', () => {
    expect(ok(SpmMockExamViewSchema, paper1)).toBe(true)
    expect(ok(SpmMockExamViewSchema, paper2)).toBe(true)
    // Every key a key-leaking implementation might add is refused by the strict schemas.
    for (const leak of ['modelAnswer', 'studentAnswer', 'marks', 'feedback', 'topic', 'questionId', 'answer', 'correctOption']) {
      const item = { ...paper1.items[0], [leak]: 'B' }
      expect(ok(SpmMockExamViewSchema, { ...paper1, items: [item] }), leak).toBe(false)
      expect(ok(SpmMockExamViewSchema, { ...paper1, [leak]: 'B' }), leak).toBe(false)
    }
    // And the registered shape has none of those keys.
    const doc = buildOpenApiDocument() as { components: { schemas: Record<string, unknown> } }
    const keys = keysOf({ view: doc.components.schemas.SpmMockExamView, item: doc.components.schemas.SpmMockExamItem })
    for (const leak of ['modelAnswer', 'studentAnswer', 'marks', 'feedback', 'questionId']) expect(keys).not.toContain(leak)
    expect(keysOf(paper1)).not.toContain('modelAnswer')
  })

  it('submit request: answers with a positive integer no and a string, null or missing answer', () => {
    expect(ok(SpmMockSubmitRequestSchema, { answers: [{ no: 1, answer: 'B' }, { no: 2, answer: null }, { no: 3 }] })).toBe(true)
    expect(ok(SpmMockSubmitRequestSchema, { answers: [] })).toBe(true)
    expect(ok(SpmMockSubmitRequestSchema, { answers: [{ no: 0, answer: 'B' }] })).toBe(false)
    expect(ok(SpmMockSubmitRequestSchema, { answers: [{ no: 1.5, answer: 'B' }] })).toBe(false)
    expect(ok(SpmMockSubmitRequestSchema, { answers: [{ no: 1, answer: 5 }] })).toBe(false)
    expect(ok(SpmMockSubmitRequestSchema, { answers: 'B' })).toBe(false)
    expect(ok(SpmMockSubmitRequestSchema, {})).toBe(false)
  })

  it('result parses (Paper 1 and Paper 2 items) and rejects out-of-range grade/hero values', () => {
    expect(ok(SpmMockResultSchema, result)).toBe(true)
    expect(ok(SpmMockResultSchema, { ...result, paperNumber: 2 })).toBe(true)
    expect(ok(SpmMockResultSchema, { ...result, grade: 'F' })).toBe(false)
    expect(ok(SpmMockResultSchema, { ...result, heroClass: 'great' })).toBe(false)
    expect(ok(SpmMockResultSchema, { ...result, percent: 120 })).toBe(false)
    expect(ok(SpmMockResultSchema, { ...result, score: null })).toBe(false)
    expect(ok(SpmMockResultSchema, { ...result, weakTopics: [{ topic: 'Algebra', wrongCount: 0 }] })).toBe(false)
    expect(SPM_MOCK_GRADES).toEqual(['A+', 'A', 'B+', 'B', 'C', 'D', 'E', 'G'])
  })

  it('module error code and messages match the mock copy', () => {
    expect(SPM_ERROR_CODES).toEqual(['NOT_SUBMITTED'])
    expect(SPM_MESSAGES.mockNotSubmitted).toBe('Mock belum dihantar.')
    expect(SPM_MESSAGES.mockAlreadySubmitted).toBe('Mock ini sudah dihantar.')
    expect(SPM_MESSAGES.subjectInvalid).toBe('Sila pilih subjek.')
    expect(SPM_MESSAGES.paperInvalid).toBe('Paper mesti 1 atau 2.')
    expect(SPM_MESSAGES.answersInvalid).toBe('Jawapan tidak sah.')
    const body = { error: { code: 'NOT_SUBMITTED', message: SPM_MESSAGES.mockNotSubmitted } }
    expect(ok(ErrorBodySchema, body)).toBe(true)
  })
})

describe('M06 walkthrough', () => {
  it('request: 15 subjects, optional text and image', () => {
    expect(SPM_WALKTHROUGH_SUBJECTS).toHaveLength(15)
    expect(ok(SpmWalkthroughRequestSchema, { subject: 'Prinsip Akaun', question_text: 'Apakah debit?' })).toBe(true)
    expect(ok(SpmWalkthroughRequestSchema, { subject: 'Fizik', image: new Blob(['x'], { type: 'image/png' }) })).toBe(true)
    expect(ok(SpmWalkthroughRequestSchema, { subject: 'Fizik' })).toBe(true)
    expect(ok(SpmWalkthroughRequestSchema, { subject: 'Seni' })).toBe(false)
    expect(ok(SpmWalkthroughRequestSchema, { subject: 'Fizik', image: 'not-a-file' })).toBe(false)
    expect(SPM_WALKTHROUGH_MAX_IMAGE_BYTES).toBe(5 * 1024 * 1024)
  })

  it('raw response: ok true with text, ok false with one of the two business errors', () => {
    expect(ok(SpmWalkthroughResponseSchema, { ok: true, walkthrough: 'Soalan: (gambar)\n\nLangkah 1' })).toBe(true)
    expect(ok(SpmWalkthroughResponseSchema, { ok: false, error: 'Gambar tidak sah.' })).toBe(true)
    expect(ok(SpmWalkthroughResponseSchema, { ok: false, error: 'Sila masukkan soalan atau muat naik gambar soalan.' })).toBe(true)
    expect(ok(SpmWalkthroughResponseSchema, { ok: false, error: 'lain' })).toBe(false)
    expect(ok(SpmWalkthroughResponseSchema, { ok: true })).toBe(false)
    expect(ok(SpmWalkthroughResponseSchema, { data: { ok: true, walkthrough: 'x' } })).toBe(false)
  })
})

describe('M06 Duta', () => {
  it('card parses, tiers are the three known ones, null is a valid recommendation', () => {
    expect(ok(DutaCardSchema, duta)).toBe(true)
    expect(ok(DutaRecommendationSchema, duta)).toBe(true)
    expect(ok(DutaRecommendationSchema, null)).toBe(true)
    expect(ok(DutaCardSchema, { ...duta, tier: 'emas' })).toBe(false)
    expect(ok(DutaCardSchema, { ...duta, rating: 6 })).toBe(false)
    expect(DUTA_TIERS).toEqual(['bintang', 'inspirasi', 'tetamu'])
  })

  it('query: subject and integer seed are optional', () => {
    expect(ok(DutaRecommendationQuerySchema, {})).toBe(true)
    expect(ok(DutaRecommendationQuerySchema, { subject: 'Matematik', seed: '7' })).toBe(true)
    expect(ok(DutaRecommendationQuerySchema, { seed: '1.5' })).toBe(false)
  })
})

describe('M06 OpenAPI document', () => {
  type Op = { tags?: string[]; requestBody?: { content: Record<string, unknown> }; responses: Record<string, { content?: Record<string, { schema: unknown }> }>; parameters?: { name: string; in: string }[] }
  const doc = buildOpenApiDocument() as unknown as {
    paths: Record<string, Record<string, Op>>
    components: { schemas: Record<string, unknown> }
  }

  const opOf = (path: string, method: string): Op => {
    const op = doc.paths[path]?.[method]
    if (!op) throw new Error(`missing ${method} ${path}`)
    return op
  }

  const ROUTES: [string, string][] = [
    ['get', '/spm/overview'],
    ['get', '/spm/databank'],
    ['get', '/spm/latih-tubi'],
    ['get', '/spm/latih-tubi/{code}'],
    ['get', '/spm/tracking-a'],
    ['get', '/spm/tracking-a/{code}'],
    ['get', '/spm/subjektif'],
    ['get', '/spm-mocks'],
    ['post', '/spm-mocks'],
    ['get', '/spm-mocks/{id}'],
    ['post', '/spm-mocks/{id}/submit'],
    ['get', '/spm-mocks/{id}/result'],
    ['post', '/spm-walkthrough/solve'],
    ['get', '/duta/recommendations'],
  ]

  it('registers exactly the 14 M06 operations (counted by the spm tag)', () => {
    const tagged = Object.entries(doc.paths).flatMap(([path, ops]) =>
      Object.entries(ops)
        .filter(([, op]) => op.tags?.includes('spm'))
        .map(([method]) => `${method} ${path}`),
    )
    expect(tagged.sort()).toEqual(ROUTES.map(([m, p]) => `${m} ${p}`).sort())
    expect(tagged).toHaveLength(14)
    for (const [method, path] of ROUTES) expect(doc.paths[path], `${method} ${path}`).toHaveProperty(method)
  })

  it('contains every spm component, with unique ids carrying the Spm or Duta prefix', () => {
    const ids = Object.keys(SPM_COMPONENT_SCHEMAS)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(doc.components.schemas).toHaveProperty(id)
    for (const id of ids) expect(id).toMatch(/^(Spm|Duta)/)
    // Every `.meta({ id })` matches its registry key.
    for (const [key, schema] of Object.entries(SPM_COMPONENT_SCHEMAS)) {
      expect((schema as { meta: () => { id?: string } | undefined }).meta()?.id, key).toBe(key)
    }
  })

  it('does not reuse ids or paths of the practice and question contracts', () => {
    const reserved = ['Subject', 'Mock', 'Result', 'Question', 'PracticeMode', 'SessionListStats', 'StartSessionRequest', 'QuestionStructuredRow']
    for (const id of reserved) expect(Object.keys(SPM_COMPONENT_SCHEMAS)).not.toContain(id)
    for (const path of Object.keys(doc.paths)) {
      if (path.startsWith('/spm') || path.startsWith('/duta')) {
        expect(path).not.toMatch(/^\/(practice|questions|structured-questions)/)
      }
    }
  })

  it('mutating routes require X-CSRF-Token and answer 403', () => {
    for (const [method, path] of ROUTES.filter(([m]) => m === 'post')) {
      const op = opOf(path, method)
      expect(op.parameters?.some((p) => p.name === 'X-CSRF-Token' && p.in === 'header'), path).toBe(true)
      expect(op.responses, path).toHaveProperty('403')
    }
  })

  it('every route has a 401, and only the id/code routes have a 404', () => {
    for (const [method, path] of ROUTES) expect(opOf(path, method).responses, path).toHaveProperty('401')
    const with404 = ROUTES.filter(([m, p]) => '404' in opOf(p, m).responses).map(([, p]) => p)
    expect(with404.sort()).toEqual(
      ['/spm/latih-tubi/{code}', '/spm/tracking-a/{code}', '/spm-mocks/{id}', '/spm-mocks/{id}/submit', '/spm-mocks/{id}/result'].sort(),
    )
  })

  it('status codes: create is 201, result has a 409, the walkthrough is multipart with a raw 200 body', () => {
    expect(opOf('/spm-mocks', 'post').responses).toHaveProperty('201')
    expect(opOf('/spm-mocks', 'post').responses).toHaveProperty('422')
    expect(opOf('/spm-mocks/{id}/result', 'get').responses).toHaveProperty('409')
    expect(opOf('/spm-mocks/{id}/submit', 'post').responses).toHaveProperty('409')
    const solve = opOf('/spm-walkthrough/solve', 'post')
    expect(Object.keys(solve.requestBody?.content ?? {})).toEqual(['multipart/form-data'])
    expect(Object.keys(solve.responses)).not.toContain('201')
    expect(JSON.stringify(solve.responses['200'])).toContain('SpmWalkthroughResponse')
    expect(JSON.stringify(solve.responses['200'])).not.toContain('"data"')
  })

  it('the mock list is a bare data array without meta', () => {
    const schema = JSON.stringify(opOf('/spm-mocks', 'get').responses['200']?.content?.['application/json'])
    expect(schema).toContain('SpmMockListItem')
    expect(schema).not.toContain('meta')
  })
})
