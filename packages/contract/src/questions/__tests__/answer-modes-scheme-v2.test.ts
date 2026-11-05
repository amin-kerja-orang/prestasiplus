import { describe, expect, it } from 'vitest'

import {
  EXAMPLE_ANSWER_MESSAGE,
  FLAT_QUESTION_TYPES,
  ModeConfigSchema,
  QUESTION_TYPES,
  QUESTION_TYPE_DB_VALUES,
  QUESTION_TYPE_LEAF_MODES,
  QUESTION_LEAF_MODES,
  QuestionLeafPartSchema,
  QuestionLeafPartV3Schema,
  QuestionPartSchema,
  QuestionPartV3Schema,
  QuestionSchemeRulesSchema,
  QuestionTrueFalseLeafSchema,
  questionTypeFromDb,
  questionTypeToDb,
} from '../../index'

const rt = (ms: string) => ({ ms })
const opts = (n: number) => 'ABCDEFGHI'.slice(0, n).split('').map((label) => ({ label, body: rt(`Pilihan ${label}`) }))
const mcq = (n: number, key: unknown, over: Record<string, unknown> = {}) => ({
  label: '',
  prompt: rt('Soalan?'),
  marks: 1,
  mode: 'mcq',
  options: opts(n),
  key,
  ...over,
})
const multi = (n: number, ids: string[]) => mcq(n, { kind: 'options', correctOptionIds: ids }, { modeConfig: { multi: true } })
const msgs = (r: { error?: { issues: { message: string }[] } }) => r.error?.issues.map((i) => i.message) ?? []

describe('FR-ADM-QE3.2 question types', () => {
  it('lists the 11 OPT-JENIS-SOALAN types in order', () => {
    expect([...QUESTION_TYPES]).toEqual([
      'mcq', 'mcq_multi', 'true_false', 'match', 'short_answer', 'fill_blank', 'structured', 'working', 'essay', 'drawing', 'table_fill',
    ])
  })
  it.each([
    ['mcq', 'mcq', ['mcq']],
    ['mcq_multi', 'mcq_multi', ['mcq']],
    ['true_false', 'true_false', ['mcq']],
    ['match', 'match', ['match_letter']],
    ['short_answer', 'short', ['short_text', 'numeric']],
    ['fill_blank', 'fill_blank', ['short_text']],
    ['structured', 'structured', null],
    ['working', 'working', ['working']],
    ['essay', 'essay', ['essay', 'essay_choice']],
    ['drawing', 'drawing', ['drawing']],
    ['table_fill', 'table', ['table_fill']],
  ] as const)('maps %s <-> db %s and default leaf modes', (t, db, modes) => {
    expect(questionTypeToDb(t)).toBe(db)
    expect(questionTypeFromDb(db)).toBe(t)
    if (modes) expect([...QUESTION_TYPE_LEAF_MODES[t]]).toEqual(modes)
    for (const m of QUESTION_TYPE_LEAF_MODES[t]) expect(QUESTION_LEAF_MODES as readonly string[]).toContain(m)
  })
  it('only short and table differ from the API name; unknown db value maps to null', () => {
    const diff = QUESTION_TYPES.filter((t) => QUESTION_TYPE_DB_VALUES[t] !== t)
    expect(diff).toEqual(['short_answer', 'table_fill'])
    expect(questionTypeFromDb('poem')).toBeNull()
    expect(FLAT_QUESTION_TYPES.every((t) => (QUESTION_TYPES as readonly string[]).includes(t))).toBe(true)
  })
})

describe('FR-QA-27 / AC-QA-27 mcq options', () => {
  it.each([
    [2, true],
    [4, true],
    [8, true],
    [1, false],
    [9, false],
  ])('mcq with %i options valid=%s', (n, ok) => {
    const leaf = mcq(n, { kind: 'option', correct: 'A' })
    expect(QuestionLeafPartSchema.safeParse(leaf).success).toBe(ok)
    if (!ok && n === 1) expect(msgs(QuestionLeafPartSchema.safeParse(leaf))).toContain('Soalan aneka pilihan mesti ada 2 hingga 8 pilihan.')
    expect(QuestionLeafPartV3Schema.safeParse(leaf).success).toBe(ok)
  })
  it('OptionKey takes a second accepted option and a note', () => {
    const ok = mcq(4, { kind: 'option', correct: 'A', accepted: ['B'], note: 'B pun diterima' })
    expect(QuestionLeafPartSchema.safeParse(ok).success).toBe(true)
    expect(QuestionLeafPartSchema.safeParse(mcq(4, { kind: 'option', correct: 'A', accepted: ['E'] })).success).toBe(false)
    expect(QuestionLeafPartSchema.safeParse(mcq(4, { kind: 'option', correct: 'A', accepted: ['A', 'D'], note: 'n' })).success).toBe(true)
    expect(QuestionLeafPartSchema.safeParse(mcq(4, { kind: 'option', correct: 'A', accepted: [] })).success).toBe(false)
  })
})

describe('D7 mcq_multi and PKSK keys', () => {
  it.each([
    [4, ['A'], true],
    [4, ['A', 'C', 'D'], true],
    [2, ['A'], true],
    [4, ['A', 'B', 'C', 'D'], false],
    [4, [], false],
    [4, ['A', 'A'], false],
    [4, ['E'], false],
  ])('mcq_multi n=%i correct=%j valid=%s', (n, ids, ok) => {
    expect(QuestionLeafPartV3Schema.safeParse(multi(n, ids)).success).toBe(ok)
  })
  it('mcq_multi needs modeConfig.multi', () => {
    expect(QuestionLeafPartV3Schema.safeParse(mcq(4, { kind: 'options', correctOptionIds: ['A'] })).success).toBe(false)
  })
  it('the narrow (service) schema keeps the v1 key types and rejects correctOptionIds', () => {
    expect(QuestionLeafPartSchema.safeParse(multi(4, ['A'])).success).toBe(false)
  })
  it('PKSK correct: label[] still parses', () => {
    const leaf = { label: '', prompt: rt('?'), marks: 1, mode: 'pksk_choice', options: opts(3), key: { kind: 'options', correct: ['A', 'C'] } }
    expect(QuestionLeafPartSchema.safeParse(leaf).success).toBe(true)
    expect(QuestionLeafPartV3Schema.safeParse(leaf).success).toBe(true)
  })
})

describe('D8 true_false', () => {
  const tf = (options: unknown) => ({ ...mcq(2, { kind: 'option', correct: 'A' }), options })
  it('accepts the two fixed BM options only', () => {
    expect(QuestionTrueFalseLeafSchema.safeParse(tf([{ label: 'A', body: rt('Betul') }, { label: 'B', body: rt('Salah') }])).success).toBe(true)
    expect(QuestionTrueFalseLeafSchema.safeParse(tf([{ label: 'A', body: rt('Salah') }, { label: 'B', body: rt('Betul') }])).success).toBe(false)
    expect(QuestionTrueFalseLeafSchema.safeParse(mcq(3, { kind: 'option', correct: 'A' })).success).toBe(false)
  })
})

describe('AC-ADM-QE3.17/18 example leaf marks', () => {
  const short = (marks: number, modeConfig?: unknown) => ({
    label: '(a)', prompt: rt('?'), marks, mode: 'short_text', key: { kind: 'accepted', values: ['x'] }, ...(modeConfig ? { modeConfig } : {}),
  })
  it('marks 0 without example is invalid; 101 is invalid; 1 and 100 are valid', () => {
    expect(msgs(QuestionLeafPartSchema.safeParse(short(0)))).toContain('Nilai mata mesti sekurang-kurangnya 1.')
    expect(msgs(QuestionLeafPartSchema.safeParse(short(101)))).toContain('Markah bahagian tidak boleh melebihi 100.')
    expect(QuestionLeafPartSchema.safeParse(short(0)).success).toBe(false)
    expect(QuestionLeafPartSchema.safeParse(short(101)).success).toBe(false)
    expect(QuestionLeafPartSchema.safeParse(short(1)).success).toBe(true)
    expect(QuestionLeafPartSchema.safeParse(short(100)).success).toBe(true)
  })
  it('marks 0 with example and an answer is valid', () => {
    expect(QuestionLeafPartSchema.safeParse(short(0, { example: { answer: 'Contoh' } })).success).toBe(true)
  })
  it('example without an answer gives "Jawapan contoh diperlukan."', () => {
    expect(msgs(QuestionLeafPartSchema.safeParse(short(0, { example: { answer: '  ' } })))).toContain(EXAMPLE_ANSWER_MESSAGE)
    expect(EXAMPLE_ANSWER_MESSAGE).toBe('Jawapan contoh diperlukan.')
  })
  it('example with marks > 0 is invalid', () => {
    expect(QuestionLeafPartSchema.safeParse(short(2, { example: { answer: 'c' } })).success).toBe(false)
  })
})

describe('DM-55 modeConfig', () => {
  it('accepts the 45 fields', () => {
    const ok = ModeConfigSchema.safeParse({
      maxWords: 50, wordRange: { min: 1, max: 120 }, hardLimit: true, answerSpace: 'medium', preFill: 'To: …', dependsOnPart: '(a)',
      multi: false, drawingKind: 'graf', answerTemplate: { grid: { xMin: 0, xMax: 10, yMin: 0, yMax: 20, step: 1, scale: '2 cm' } },
      alternatives: [{ prompt: rt('a') }, { id: 'b', prompt: rt('b'), stimulusId: '9' }],
    })
    expect(ok.success).toBe(true)
  })
  it.each([
    [{ answerSpace: 'huge' }],
    [{ wordRange: { min: 9, max: 3 } }],
    [{ maxWords: 0 }],
    [{ alternatives: [{ prompt: rt('a') }] }],
    [{ alternatives: Array.from({ length: 7 }, () => ({ prompt: rt('a') })) }],
    [{ answerTemplate: { imageId: '1', grid: {} } }],
    [{ unknownField: 1 }],
  ])('rejects %j', (cfg) => {
    expect(ModeConfigSchema.safeParse(cfg).success).toBe(false)
  })
})

describe('scheme v2 (D1, D2)', () => {
  const pt = (id: string, code: string, label: string, over: Record<string, unknown> = {}) => ({ id, code, label, marks: 1, ...over })
  const essay = (key: unknown, marks = 3) => ({ label: '', prompt: rt('?'), marks, mode: 'essay', key })

  it('v1 shapes parse unchanged on both schemas; scheme_v 2 selects the 45 names', () => {
    const v1 = essay({ kind: 'points', marks: 1, points: [{ id: 'a', code: 'K', label: 'x', marks: 1, impliedOk: true }], final: { display: '1', accept: ['1'] } }, 1)
    expect(QuestionLeafPartSchema.safeParse(v1).success).toBe(true)
    expect(QuestionLeafPartV3Schema.safeParse(v1).success).toBe(true)
    const v2 = essay({ kind: 'points', scheme_v: 2, marks: 1, points: [pt('a', 'K', 'x', { implied: true })], finalAnswer: { display: '1', accepted: ['1'] } }, 1)
    expect(QuestionLeafPartV3Schema.safeParse(v2).success).toBe(true)
    // v1 spellings are rejected under scheme_v 2, v2 names are not read as v1
    expect(QuestionLeafPartV3Schema.safeParse(essay({ kind: 'points', scheme_v: 2, marks: 1, points: [pt('a', 'K', 'x', { impliedOk: true })] }, 1)).success).toBe(false)
    expect(QuestionLeafPartV3Schema.safeParse(essay({ kind: 'points', scheme_v: 2, marks: 1, points: [pt('a', 'K', 'x')], final: { display: '1', accept: ['1'] } }, 1)).success).toBe(false)
    expect(QuestionLeafPartV3Schema.safeParse(essay({ kind: 'points', scheme_v: 3, marks: 1, points: [pt('a', 'K', 'x')] }, 1)).success).toBe(false)
  })
  it('ecf accepts same and scale(factor) in v2; label is required for deduction code other', () => {
    const key = (ecf: unknown) => essay({ kind: 'points', scheme_v: 2, marks: 1, points: [pt('a', 'N', 'x', { ecf })] }, 1)
    expect(QuestionLeafPartV3Schema.safeParse(key({ fromPart: '(a)', rule: { op: 'scale', factor: 2 } })).success).toBe(true)
    expect(QuestionLeafPartV3Schema.safeParse(key({ fromPart: '(a)', rule: { op: 'add', k: 1 } })).success).toBe(false)
    const rules = (d: unknown) => QuestionSchemeRulesSchema.safeParse({ deductions: [d] })
    expect(rules({ code: 'other', amount: 1, scope: 'part' }).success).toBe(false)
    expect(rules({ code: 'other', amount: 1, scope: 'part', label: 'Lain' }).success).toBe(true)
    expect(QuestionSchemeRulesSchema.safeParse({ zeroIf: [{ code: 'bogus', label: 'x' }] }).success).toBe(false)
  })
  it('perCriterion rubric needs every criterion max; scoring defaults to overall', () => {
    const rub = (scoring: string | undefined, max?: number) =>
      essay({ kind: 'rubric', scheme_v: 2, marks: 5, ...(scoring ? { scoring } : {}), criteria: [{ id: 'c', name: 'C', ...(max ? { max } : {}) }], bands: [{ name: '5', range: [5, 5] }] }, 5)
    expect(QuestionLeafPartV3Schema.safeParse(rub('perCriterion')).success).toBe(false)
    expect(QuestionLeafPartV3Schema.safeParse(rub('perCriterion', 5)).success).toBe(true)
    const r = QuestionLeafPartV3Schema.parse(rub(undefined))
    expect((r as { key: { scoring?: string } }).key.scoring).toBe('overall')
  })

  describe('45 section 7 worked examples (fixtures, scheme_v: 2 added, dependsOnPart moved into modeConfig, ids filled)', () => {
    const b = (parts: unknown[]) => parts
    const p71 = b([
      { label: '(a)', mode: 'short_text', marks: 2, prompt: rt('[soalan (a)]'), cognitiveLevel: 'memahami', difficultyTp: 2, blankCount: 2,
        key: { kind: 'accepted', values: ['[jawapan i]', '[jawapan ii]'], anyOrder: true } },
      { label: '(b)', mode: 'essay', marks: 3, prompt: rt('[soalan (b)]'), cognitiveLevel: 'menganalisis', difficultyTp: 3,
        key: { kind: 'points', scheme_v: 2, marks: 3,
          points: ['f1', 'f2', 'f3', 'f4'].map((id, i) => pt(id, 'F', `Fakta ${i + 1}`)),
          groups: [{ id: 'g1', anyN: 3, eachMarks: 1, pointIds: ['f1', 'f2', 'f3', 'f4'] }] } },
      { label: '(c)', mode: 'essay', marks: 5, stimulusId: '7', prompt: rt('[soalan (c)]'), cognitiveLevel: 'menilai', difficultyTp: 4,
        modeConfig: { wordRange: { min: 0, max: 100 } },
        key: { kind: 'rubric', scheme_v: 2, marks: 5, criteria: [{ id: 'k', name: 'Kandungan' }],
          bands: [{ name: 'Aras 1', range: [1, 2] }, { name: 'Aras 2', range: [3, 4] }, { name: 'Aras 3', range: [5, 5] }] } },
    ])
    const cell = (type: string, t?: string) => ({ type, ...(t ? { text: rt(t) } : {}) })
    const p72 = b([
      { label: '(a)', mode: 'table_fill', marks: 2, prompt: { ms: '[lengkapkan jadual]', en: '[complete the table]' },
        modeConfig: { grid: { rows: 3, cols: 4, cells: [
          ['[t1]', '[t2]', '[t3]', '[t4]'].map((t) => cell('tajuk', t)),
          [cell('diberi', '[n]'), cell('diberi', '[n]'), cell('kosong'), cell('kosong')],
          [cell('diberi', '[n]'), cell('kosong'), cell('diberi', '[n]'), cell('kosong')] ] } },
        key: { kind: 'mapping', cells: { r2c3: ['[nilai]'], r2c4: ['[nilai]'], r3c2: ['[nilai]'], r3c4: ['[nilai]'] } } },
      { label: '(b)', mode: 'drawing', marks: 2, prompt: { ms: '[lukis garis lurus]', en: '[draw]' },
        modeConfig: { drawingKind: 'graf', answerTemplate: { imageId: '12' } },
        key: { kind: 'points', scheme_v: 2, marks: 2, points: [pt('k1', 'K', 'Garis melalui dua titik betul'), pt('n1', 'N', 'Garis lengkap dan lurus')] } },
    ])
    const p73 = b([
      { label: '(a)', mode: 'numeric', marks: 2, prompt: { ms: '[...]', en: '[...]' }, difficultyTp: 3, cognitiveLevel: 'mengaplikasi',
        key: { kind: 'accepted', values: [{ v: 4.2, tol: 0.1, tolKind: 'abs', unit: 'm s^-1', unitAlt: ['m/s'] }] } },
      { label: '(b)', mode: 'working', marks: 3, prompt: { ms: '[...]', en: '[...]' }, modeConfig: { dependsOnPart: '(a)' },
        key: { kind: 'points', scheme_v: 2, marks: 3, points: [
          pt('m1', 'M', 'Formula betul'), pt('m2', 'M', 'Gantian betul', { requires: ['m1'] }),
          pt('n1', 'N', 'Jawapan dengan unit betul', { requires: ['m2'], ecf: { fromPart: '(a)', rule: { op: 'same' } }, unit: { value: 'J', mandatory: true } }) ] } },
      { label: '(c)', mode: 'essay', marks: 10, prompt: { ms: '[...]', en: '[...]' },
        key: { kind: 'points', scheme_v: 2, marks: 10, points: [pt('c1', 'M', 'Ciri 1'), pt('r1', 'M', 'Sebab 1')],
          groups: [{ id: 'p1', type: 'pair', pointIds: ['c1', 'r1'], cap: 8 }],
          bonus: { ifAllCorrect: true, marks: 2, label: '[Semua ciri dinyatakan betul]' } } },
    ])
    const p74 = b([
      { label: '(a)', mode: 'essay', marks: 15, prompt: rt('[arahan rumusan]'),
        modeConfig: { wordRange: { min: 1, max: 120 }, hardLimit: true, answerSpace: 'medium' },
        key: { kind: 'rubric', scheme_v: 2, marks: 15, scoring: 'overall',
          criteria: [{ id: 'isi', name: 'Isi' }, { id: 'bahasa', name: 'Bahasa' }],
          bands: [[1, 5], [6, 10], [11, 15]].map((range, i) => ({ name: `Peringkat ${i + 1}`, range, descriptors: { isi: '[...]', bahasa: '[...]' } })),
          floorBand: { name: 'Sifar', range: [0, 0] } } },
    ])
    const p75 = b([
      { label: '1', mode: 'essay', marks: 20, prompt: { ms: '[email task]', en: '[email task]' },
        modeConfig: { wordRange: { min: 70, max: 90 }, preFill: 'To: …  Subject: …' },
        key: { kind: 'rubric', scheme_v: 2, marks: 20, scoring: 'perCriterion',
          criteria: [{ id: 'C', name: 'Content', max: 5 }, { id: 'CA', name: 'Communicative Achievement', max: 5 }, { id: 'O', name: 'Organisation', max: 5 }, { id: 'L', name: 'Language', max: 5 }],
          bands: [{ name: '5', range: [5, 5], descriptors: { C: '[...]', CA: '[...]', O: '[...]', L: '[...]' } }] } },
    ])
    const p76 = b([
      { label: '(a)', mode: 'table_fill', marks: 2, prompt: { ms: '[...]', en: '[...]' }, key: { kind: 'mapping', cells: { r2c2: ['[n]'], r3c2: ['[n]'] } } },
      { label: '(b)', mode: 'drawing', marks: 3, prompt: { ms: '[...]', en: '[...]' },
        modeConfig: { drawingKind: 'graf', answerTemplate: { grid: { xMin: 0, xMax: 10, yMin: 0, yMax: 20, step: 1, scale: '[2 cm kepada 1 unit]' } } },
        key: { kind: 'points', scheme_v: 2, marks: 3, points: [pt('k1', 'K', 'Skala betul'), pt('n1', 'N', 'Semua titik betul'), pt('p1', 'P', 'Paksi berlabel')] } },
      { label: '(c)', mode: 'drawing', marks: 1, prompt: { ms: '[...]', en: '[...]' }, modeConfig: { dependsOnPart: '(b)' },
        key: { kind: 'points', scheme_v: 2, marks: 1, points: [pt('n1', 'N', 'Garis penyuaian terbaik')] } },
      { label: '(d)', mode: 'numeric', marks: 4, prompt: { ms: '[...]', en: '[...]' }, modeConfig: { dependsOnPart: '(c)' },
        key: { kind: 'accepted', values: [{ v: 0, tol: 0.5, tolKind: 'abs' }] } },
    ])
    it.each([
      ['7.1 Sejarah', p71],
      ['7.2 Matematik', p72],
      ['7.3 Fizik', p73],
      ['7.4 Bahasa Melayu', p74],
      ['7.5 English', p75],
      ['7.6 Matematik Tambahan', p76],
    ])('%s parses as every leaf', (_n, parts) => {
      for (const part of parts) {
        const r = QuestionLeafPartV3Schema.safeParse(part)
        expect(r.error?.issues ?? []).toEqual([])
      }
      expect(QuestionPartV3Schema.safeParse(parts[0]).success).toBe(true)
    })
    it('7.4 schemeRules (question level) parse', () => {
      expect(
        QuestionSchemeRulesSchema.safeParse({
          deductions: [{ code: 'spelling', amount: 1, cap: 5, scope: 'question' }, { code: 'punctuation', amount: 1, cap: 5, scope: 'question' }],
          zeroIf: [{ code: 'copy', label: '[menyalin teks petikan]' }],
        }).success,
      ).toBe(true)
    })
    it('the narrow service schema still rejects scheme_v 2 keys (consumers not switched yet)', () => {
      expect(QuestionPartSchema.safeParse(p71[1]).success).toBe(false)
    })
  })
})
