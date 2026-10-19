import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../openapi'
import { CIKGU_COMPONENT_SCHEMAS } from '../paths'
import {
  CIKGU_AI_UNAVAILABLE_MESSAGE,
  CIKGU_CHAT_FAILED_TEXT,
  CIKGU_GENERAL_REPLY,
  CIKGU_HANDOFF_PREFIX,
  CIKGU_LEVELS,
  CIKGU_PBD_CSV_HEADER,
  CIKGU_PRACTICE_REPLY,
  CIKGU_RATE_LIMITED_MESSAGE,
  CIKGU_RPH_FOLLOW_UP,
  CIKGU_RUBRICS,
  CIKGU_TIERS,
  CIKGU_VALIDATION_MESSAGES as MSG,
  CikguBulkApproveRequestSchema,
  CikguBulkApproveResultSchema,
  CikguChatEmptyBodySchema,
  CikguChatErrorBodySchema,
  CikguChatQuotaBodySchema,
  CikguEssayListItemSchema,
  CikguEssayMarkingSchema,
  CikguPbdQueueItemSchema,
  CikguRollupRequestSchema,
  CikguRollupResultSchema,
  CikguRphCreateRequestSchema,
  CikguRphListItemSchema,
  CikguRphSchema,
  CikguSendRequestSchema,
  CikguSendResponseSchema,
  cikguCannedMarks,
  cikguCsvCell,
  cikguMarkingReply,
  cikguRphConfirmation,
  cikguRphFieldErrors,
  cikguSkorOf,
  cikguSummarizeFieldErrors,
  cikguTierOf,
  cikguTokensIn,
  cikguTokensOut,
  cikguTpOf,
} from '../schema'

const ok = (s: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => s.safeParse(v).success

const validRph = { subjectName: 'Matematik', level: 'T4', tajuk: 'Bab 3' }

describe('chat turn: raw wire shapes', () => {
  it('accepts the mock request and rejects a blank or non-string message', () => {
    expect(ok(CikguSendRequestSchema, { message: 'Terangkan konsep mol', thread_id: null })).toBe(true)
    expect(ok(CikguSendRequestSchema, { message: 'hai', thread_id: '9000001' })).toBe(true)
    expect(ok(CikguSendRequestSchema, { message: 'hai' })).toBe(true)
    for (const message of ['', '   \n', undefined, 42, null]) {
      expect(ok(CikguSendRequestSchema, { message, thread_id: null })).toBe(false)
    }
  })

  it('parses the 200 body (snake_case, no envelope) and rejects a wrapped or malformed one', () => {
    const good = {
      thread_id: '9000001',
      reply: CIKGU_GENERAL_REPLY,
      tier: 'pelajar',
      turns_remaining: 9,
      tool_hops: 0,
      tokens: { in: 126, out: 58 },
    }
    expect(CikguSendResponseSchema.parse(good)).toEqual(good)
    expect(ok(CikguSendResponseSchema, { data: good })).toBe(false)
    expect(ok(CikguSendResponseSchema, { ...good, tier: 'student' })).toBe(false)
    expect(ok(CikguSendResponseSchema, { ...good, tool_hops: 2 })).toBe(false)
    expect(ok(CikguSendResponseSchema, { ...good, turns_remaining: -1 })).toBe(false)
    expect(ok(CikguSendResponseSchema, { ...good, thread_id: '' })).toBe(false)
  })

  it('401 and 422 are exactly {} and 429 quota is exactly {"quota_exhausted": true}', () => {
    expect(ok(CikguChatEmptyBodySchema, {})).toBe(true)
    expect(ok(CikguChatEmptyBodySchema, { error: { code: 'UNAUTHORIZED' } })).toBe(false)
    expect(ok(CikguChatQuotaBodySchema, { quota_exhausted: true })).toBe(true)
    expect(ok(CikguChatQuotaBodySchema, { quota_exhausted: false })).toBe(false)
    expect(ok(CikguChatQuotaBodySchema, { quota_exhausted: true, error: 'x' })).toBe(false)
  })

  it('[PROPOSED] rate-limit and AI-unavailable bodies carry a BM string error', () => {
    expect(ok(CikguChatErrorBodySchema, { error: CIKGU_RATE_LIMITED_MESSAGE, code: 'RATE_LIMITED', retryAfter: 30 })).toBe(true)
    expect(ok(CikguChatErrorBodySchema, { error: CIKGU_AI_UNAVAILABLE_MESSAGE, code: 'AI_UNAVAILABLE' })).toBe(true)
    expect(ok(CikguChatErrorBodySchema, { error: 'AI_UNAVAILABLE', code: 'OTHER' })).toBe(false)
    expect(ok(CikguChatErrorBodySchema, { error: { code: 'RATE_LIMITED' }, code: 'RATE_LIMITED' })).toBe(false)
    expect(CIKGU_AI_UNAVAILABLE_MESSAGE).toBe(CIKGU_CHAT_FAILED_TEXT)
  })
})

describe('constants and pure rules (exact copy of the mock)', () => {
  it('keeps rubrics, levels and tiers verbatim', () => {
    expect(CIKGU_RUBRICS.map((r) => [r.key, r.max])).toEqual([
      ['spm_bm_karangan', 50],
      ['spm_bi_continuous_writing', 50],
      ['pt3_bm_karangan', 30],
      ['pt3_bi_essay', 30],
      ['sejarah_essay', 20],
      ['general', 100],
    ])
    expect(CIKGU_RUBRICS[0]?.label).toBe('SPM Bahasa Melayu — Karangan (Bahagian B) (50 markah)')
    expect(CIKGU_RUBRICS[5]?.label).toBe('Rubric Am (default) (100 markah)')
    expect(CIKGU_LEVELS).toHaveLength(11)
    expect(CIKGU_LEVELS[0]).toEqual({ code: 'D1', label: 'Darjah 1' })
    expect(CIKGU_LEVELS[10]).toEqual({ code: 'T5', label: 'Tingkatan 5' })
    expect(CIKGU_TIERS.admin.dailyTurns).toBe(100)
    expect(CIKGU_TIERS.teacher).toEqual({ tier: 'guru', dailyTurns: 30 })
    expect(CIKGU_TIERS.other).toEqual({ tier: 'pelajar', dailyTurns: 10 })
    expect(CIKGU_HANDOFF_PREFIX).toBe('Tolong mark karangan ini menggunakan rubric ')
  })

  it('resolves the tier by role', () => {
    expect(cikguTierOf('admin')).toEqual({ tier: 'admin', dailyTurns: 100 })
    expect(cikguTierOf('teacher')).toEqual({ tier: 'guru', dailyTurns: 30 })
    for (const role of ['student', 'parent', 'school_admin', 'ppd_officer']) {
      expect(cikguTierOf(role)).toEqual({ tier: 'pelajar', dailyTurns: 10 })
    }
  })

  it('keeps the canned texts character for character', () => {
    expect(CIKGU_GENERAL_REPLY.split('\n')).toHaveLength(5)
    expect(CIKGU_GENERAL_REPLY.startsWith('Soalan yang baik! Ini penerangan ringkas:\n')).toBe(true)
    expect(CIKGU_GENERAL_REPLY.endsWith('Nak saya sediakan latihan soalan untuk topik ini?')).toBe(true)
    expect(CIKGU_PRACTICE_REPLY.startsWith('Ini 3 soalan latihan ringkas:\n')).toBe(true)
    expect(CIKGU_RPH_FOLLOW_UP).toBe(
      'Boleh nyatakan subjek, tingkatan/tahun dan tajuk? Contoh: "Tolong jana RPH untuk Matematik T4 Bab 3 esok".',
    )
    expect(cikguRphConfirmation('Bab 3', 'Matematik', 'T4', '20/10/2026')).toBe(
      'Siap! RPH "Bab 3" (Matematik, Tingkatan 4) untuk 20/10/2026 telah dijana dan disimpan dalam senarai RPH.',
    )
    const rubric = CIKGU_RUBRICS[0]!
    expect(cikguMarkingReply(rubric, 35)).toBe(
      'Markah: 35/50\nRubric: SPM Bahasa Melayu — Karangan (Bahagian B) (50 markah)\nKomen membina:\n' +
        '1. Isi: idea utama jelas; tambah satu contoh untuk setiap isi.\n' +
        '2. Bahasa: ayat gramatis; kurangkan pengulangan perkataan.\n' +
        '3. Cadangan: kukuhkan penutup dengan rumusan yang merujuk tajuk.',
    )
  })

  it('canned marks are round(0.7 x max) for all six rubrics', () => {
    expect(CIKGU_RUBRICS.map((r) => cikguCannedMarks(r.max))).toEqual([35, 35, 21, 21, 14, 70])
  })

  it('counts tokens in Unicode code points', () => {
    expect(cikguTokensIn('Terangkan konsep mol')).toBe(120 + 5)
    expect(cikguTokensIn('😀😀😀😀')).toBe(121) // 4 code points, not 8 UTF-16 units
    expect(cikguTokensOut('😀')).toBe(1)
    expect(cikguTokensOut(CIKGU_GENERAL_REPLY)).toBe(Math.ceil([...CIKGU_GENERAL_REPLY].length / 4))
  })

  it('maps skor to the TP bands', () => {
    expect([0, 19.9, 20, 39.9, 40, 59.9, 60, 74.9, 75, 89.9, 90, 100].map(cikguTpOf)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6])
    expect(cikguSkorOf(2, 3)).toBe(66.7)
    expect(cikguSkorOf(1, 1)).toBe(100)
  })

  it('guards CSV cells against formulas and quotes them when needed', () => {
    expect(cikguCsvCell('=SUM(1)')).toBe("'=SUM(1)")
    expect(cikguCsvCell('+1')).toBe("'+1")
    expect(cikguCsvCell('@x')).toBe("'@x")
    expect(cikguCsvCell('-x')).toBe("'-x")
    expect(cikguCsvCell('Ali, Abu')).toBe('"Ali, Abu"')
    expect(cikguCsvCell('A "B"')).toBe('"A ""B"""')
    expect(cikguCsvCell(5)).toBe('5')
    expect(CIKGU_PBD_CSV_HEADER).toBe('pelajar,kelas,sp,skor,tp,tarikh_lulus')
  })
})

describe('POST /cikgu/rph request (BR-M13-12)', () => {
  it('accepts the minimal body, the full body and trims', () => {
    expect(ok(CikguRphCreateRequestSchema, validRph)).toBe(true)
    const full = CikguRphCreateRequestSchema.parse({
      ...validRph,
      subjectName: '  Matematik  ',
      className: ' 4 Bestari ',
      lessonDate: '2026-10-20',
      durationMinutes: 45,
      timeSlot: ' 8.00 - 9.00 ',
      tema: '',
      pengajaranKeperluan: '   ',
    })
    expect(full.subjectName).toBe('Matematik')
    expect(full.className).toBe('4 Bestari')
    expect(full.tema).toBeNull()
    expect(full.pengajaranKeperluan).toBeNull()
    expect(full.timeSlot).toBe('8.00 - 9.00')
  })

  it('has one rejection per field with the exact BM message', () => {
    expect(cikguRphFieldErrors({ ...validRph, subjectName: '' }).subjectName).toBe(MSG.required)
    expect(cikguRphFieldErrors({ ...validRph, subjectName: 5 }).subjectName).toBe(MSG.required)
    expect(cikguRphFieldErrors({ ...validRph, subjectName: 'x'.repeat(101) }).subjectName).toBe('Medan ini tidak boleh melebihi 100 aksara.')
    expect(cikguRphFieldErrors({ ...validRph, level: '' }).level).toBe(MSG.required)
    expect(cikguRphFieldErrors({ ...validRph, level: 'T6' }).level).toBe('Medan ini tidak sah.')
    expect(cikguRphFieldErrors({ ...validRph, tajuk: '   ' }).tajuk).toBe('Medan ini diperlukan.')
    expect(cikguRphFieldErrors({ ...validRph, tajuk: 'x'.repeat(201) }).tajuk).toBe('Medan ini tidak boleh melebihi 200 aksara.')
    for (const durationMinutes of [14, 241, 60.5, '60']) {
      expect(cikguRphFieldErrors({ ...validRph, durationMinutes }).durationMinutes).toBe('Tempoh mesti antara 15 dan 240 minit.')
    }
    for (const lessonDate of ['2026-02-30', '20/10/2026', '2026-13-01']) {
      expect(cikguRphFieldErrors({ ...validRph, lessonDate }).lessonDate).toBe('Tarikh tidak sah.')
    }
    expect(cikguRphFieldErrors({ ...validRph, pengajaranKeperluan: 'x'.repeat(501) }).pengajaranKeperluan).toBe('Medan ini tidak boleh melebihi 500 aksara.')
    for (const f of ['className', 'timeSlot', 'tema'] as const) {
      expect(cikguRphFieldErrors({ ...validRph, [f]: 'x'.repeat(101) })[f]).toBe('Medan ini tidak boleh melebihi 100 aksara.')
    }
  })

  it('accepts the boundaries and counts code points, not UTF-16 units', () => {
    expect(ok(CikguRphCreateRequestSchema, { ...validRph, durationMinutes: 15 })).toBe(true)
    expect(ok(CikguRphCreateRequestSchema, { ...validRph, durationMinutes: 240 })).toBe(true)
    expect(ok(CikguRphCreateRequestSchema, { ...validRph, durationMinutes: null, lessonDate: '' })).toBe(true)
    expect(ok(CikguRphCreateRequestSchema, { ...validRph, lessonDate: '2028-02-29' })).toBe(true)
    expect(ok(CikguRphCreateRequestSchema, { ...validRph, tajuk: '😀'.repeat(200) })).toBe(true)
    expect(ok(CikguRphCreateRequestSchema, { ...validRph, tajuk: '😀'.repeat(201) })).toBe(false)
    for (const level of ['D1', 'D6', 'T1', 'T5']) expect(ok(CikguRphCreateRequestSchema, { ...validRph, level })).toBe(true)
  })

  it('collects every error in the insertion order and summarises like Laravel', () => {
    const fields = cikguRphFieldErrors({ subjectName: '', level: 'X', tajuk: '', durationMinutes: 5, lessonDate: 'bad', tema: 'x'.repeat(101) })
    expect(Object.keys(fields)).toEqual(['subjectName', 'level', 'tajuk', 'durationMinutes', 'lessonDate', 'tema'])
    expect(cikguSummarizeFieldErrors(fields)).toBe('Medan ini diperlukan. (and 5 more errors)')
    expect(cikguSummarizeFieldErrors({ level: 'Medan ini tidak sah.' })).toBe('Medan ini tidak sah.')
    expect(cikguSummarizeFieldErrors({ a: 'A', b: 'B' })).toBe('A (and 1 more error)')
    expect(cikguRphFieldErrors({})).toEqual({
      subjectName: 'Medan ini diperlukan.',
      level: 'Medan ini diperlukan.',
      tajuk: 'Medan ini diperlukan.',
    })
  })
})

describe('response bodies', () => {
  const rph = {
    id: '3',
    userId: '12',
    subjectName: 'Matematik',
    level: 'T4',
    tajuk: 'Bab 3',
    className: null,
    lessonDate: '2026-10-20',
    durationMinutes: 60,
    timeSlot: null,
    tema: null,
    pengajaranKeperluan: null,
    status: 'generated',
    source: 'chat',
    content: 'Matematik · Tingkatan 4\nTarikh: 20/10/2026',
    threadId: '9000001',
    createdAt: '2026-10-19T09:30:00+08:00',
  }

  it('parses Rph and RphListItem; ids are strings, not integers', () => {
    expect(CikguRphSchema.parse(rph)).toEqual(rph)
    expect(ok(CikguRphSchema, { ...rph, id: 3 })).toBe(false)
    expect(ok(CikguRphSchema, { ...rph, threadId: null, source: 'form' })).toBe(true)
    expect(ok(CikguRphSchema, { ...rph, source: 'voice' })).toBe(false)
    expect(ok(CikguRphSchema, { ...rph, level: 'T6' })).toBe(false)
    expect(ok(CikguRphSchema, { ...rph, durationMinutes: 10 })).toBe(false)
    expect(ok(CikguRphSchema, { ...rph, createdAt: '2026-10-19T01:30:00Z' })).toBe(false)
    expect(ok(CikguRphListItemSchema, { id: '3', lessonDate: '2026-10-20', subjectName: 'Matematik', level: 'T4', tajuk: 'Bab 3', status: 'generated' })).toBe(true)
    expect(ok(CikguRphListItemSchema, { id: '3', lessonDate: '20/10/2026', subjectName: 'Matematik', level: 'T4', tajuk: 'Bab 3', status: 'generated' })).toBe(false)
  })

  it('parses EssayMarking and EssayListItem with nullable free text', () => {
    const essay = {
      id: '5',
      userId: '12',
      rubricKey: 'pt3_bm_karangan',
      subjectName: null,
      level: null,
      studentName: 'Murid Contoh',
      essayTitle: null,
      essayText: 'Teks karangan contoh.',
      marks: 21,
      maxMarks: 30,
      comment: 'Markah: 21/30',
      threadId: '9000002',
      createdAt: '2026-10-19T09:30:00+08:00',
    }
    expect(CikguEssayMarkingSchema.parse(essay)).toEqual(essay)
    expect(ok(CikguEssayMarkingSchema, { ...essay, rubricKey: 'unknown' })).toBe(false)
    expect(ok(CikguEssayMarkingSchema, { ...essay, threadId: null })).toBe(false)
    const { id, studentName, subjectName, rubricKey, essayTitle, marks, maxMarks, createdAt } = essay
    expect(ok(CikguEssayListItemSchema, { id, studentName, subjectName, rubricKey, essayTitle, marks, maxMarks, createdAt })).toBe(true)
    expect(ok(CikguEssayListItemSchema, { id, studentName, subjectName, rubricKey, essayTitle, marks: 1.5, maxMarks, createdAt })).toBe(false)
  })

  it('parses PbdQueueItem and the roll-up and approve results', () => {
    const row = { id: '7', studentId: '40', studentName: 'Murid Contoh', classroomId: '3', sp: '5.1.1', skor: 66.7, tp: 4 }
    expect(CikguPbdQueueItemSchema.parse(row)).toEqual(row)
    expect(ok(CikguPbdQueueItemSchema, { ...row, tp: 7 })).toBe(false)
    expect(ok(CikguPbdQueueItemSchema, { ...row, tp: 0 })).toBe(false)
    expect(ok(CikguPbdQueueItemSchema, { ...row, studentId: 40 })).toBe(false)
    expect(ok(CikguRollupResultSchema, { created: 1, updated: 2, skipped: 0 })).toBe(true)
    expect(ok(CikguRollupResultSchema, { created: -1, updated: 0, skipped: 0 })).toBe(false)
    expect(ok(CikguBulkApproveResultSchema, { approved: 3 })).toBe(true)
    expect(ok(CikguBulkApproveResultSchema, { approved: '3' })).toBe(false)
  })

  it('accepts the tolerant roll-up and bulk-approve bodies (the server never answers 422 there)', () => {
    for (const classroomId of ['3', 3, null]) expect(ok(CikguRollupRequestSchema, { classroomId })).toBe(true)
    expect(ok(CikguRollupRequestSchema, {})).toBe(true)
    expect(ok(CikguBulkApproveRequestSchema, { ids: ['1', 2, '3'] })).toBe(true)
    expect(ok(CikguBulkApproveRequestSchema, { ids: [] })).toBe(true)
    expect(ok(CikguBulkApproveRequestSchema, {})).toBe(true)
  })
})

describe('openapi registration', () => {
  type Op = {
    tags?: string[]
    parameters?: { name: string; in: string }[]
    requestBody?: { content: Record<string, unknown> }
    responses: Record<string, { headers?: Record<string, unknown>; content?: Record<string, unknown> }>
    'x-envelope'?: string
    description?: string
  }
  const doc = buildOpenApiDocument() as unknown as {
    paths: Record<string, Record<string, Op>>
    components: { schemas: Record<string, unknown> }
  }
  const ops = Object.entries(doc.paths).flatMap(([path, item]) =>
    Object.entries(item)
      .filter(([, op]) => op.tags?.includes('cikgu'))
      .map(([method, op]) => ({ method, path, op })),
  )

  it('registers exactly the ten M13 routes under the cikgu tag', () => {
    expect(ops.map((o) => `${o.method.toUpperCase()} ${o.path}`).sort()).toEqual(
      [
        'POST /cikgu/send',
        'GET /cikgu/rph',
        'POST /cikgu/rph',
        'GET /cikgu/rph/{id}',
        'GET /cikgu/essays',
        'GET /cikgu/essays/{id}',
        'GET /cikgu/pbd',
        'POST /cikgu/pbd/rollup',
        'POST /cikgu/pbd/bulk-approve',
        'GET /cikgu/pbd/export.csv',
      ].sort(),
    )
  })

  it('registers every component under a unique Cikgu-prefixed id', () => {
    const names = Object.keys(CIKGU_COMPONENT_SCHEMAS)
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) {
      expect(name.startsWith('Cikgu')).toBe(true)
      expect(doc.components.schemas[name], name).toBeDefined()
    }
    expect(new Set(names).size).toBe(names.length)
  })

  it('answers 429 on every write (D57a) with the Retry-After header', () => {
    const writes = ops.filter((o) => o.method === 'post')
    expect(writes).toHaveLength(4)
    for (const { path, op } of writes) {
      expect(op.responses['429'], path).toBeDefined()
      expect(JSON.stringify(op.responses['429']?.headers), path).toContain('Retry-After')
    }
  })

  it('answers 401 and 403 on every teacher route and 401 on send', () => {
    for (const { path, op } of ops) {
      expect(op.responses['401'], path).toBeDefined()
      expect(op.responses['403'], path).toBeDefined()
    }
  })

  it('marks send and the CSV export as non-{data} responses', () => {
    const send = doc.paths['/cikgu/send']?.post
    const csv = doc.paths['/cikgu/pbd/export.csv']?.get
    expect(send?.['x-envelope']).toBe('none')
    expect(csv?.['x-envelope']).toBe('none')
    expect(Object.keys(csv?.responses['200']?.content ?? {})).toEqual(['text/csv'])
    expect(JSON.stringify(csv?.responses['200']?.headers)).toContain('pbd-approved.csv')
    expect(JSON.stringify(csv?.responses['429']?.headers)).toContain('Retry-After')
    expect(send?.requestBody?.content).toHaveProperty('application/json')
    expect(JSON.stringify(send?.responses['200'])).toContain('CikguSendResponse')
    expect(JSON.stringify(send?.responses['200'])).not.toContain('"data"')
    expect(JSON.stringify(send?.responses['401'])).toContain('CikguChatEmptyBody')
    expect(JSON.stringify(send?.responses['422'])).toContain('CikguChatEmptyBody')
    expect(JSON.stringify(send?.responses['429'])).toContain('CikguChatQuotaBody')
  })

  it('sends no-store on responses that carry personal data of minors', () => {
    const refs: [string, string][] = [
      ['/cikgu/send', 'post'],
      ['/cikgu/essays', 'get'],
      ['/cikgu/essays/{id}', 'get'],
      ['/cikgu/pbd', 'get'],
      ['/cikgu/pbd/export.csv', 'get'],
    ]
    for (const [path, method] of refs) {
      expect(JSON.stringify(doc.paths[path]?.[method]?.responses['200']?.headers), path).toContain('no-store')
    }
  })

  it('uses string ids on the wire (UD-1)', () => {
    const rph = doc.components.schemas.CikguRph as { properties: Record<string, { $ref?: string; type?: string | string[] }> }
    expect(JSON.stringify(rph.properties.id)).toContain('Id')
    expect(JSON.stringify(rph.properties.userId)).toContain('Id')
    expect(rph.properties.threadId?.type).toEqual(['string', 'null'])
    const send = doc.components.schemas.CikguSendResponse as { properties: Record<string, { type?: string }> }
    expect(JSON.stringify(send.properties.thread_id)).toMatch(/Id|"string"/)
  })
})
