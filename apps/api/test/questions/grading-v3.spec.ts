import { TRUE_FALSE_OPTIONS } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { gradeCells, gradeLeaf, gradeMcqMulti, gradeNumericText, gradeQuestion, gradeShortText, isExampleLeaf, markRows, partStatusOf } from '../../src/modules/questions/grading'
import { gradeWorking } from '../../src/modules/questions/scheme-grading'
import { schemeTotal } from '../../src/modules/questions/publish-gate'

const rich = (ms: string) => ({ ms })
const opts = (n: number) => 'ABCDEFGH'.slice(0, n).split('').map((label) => ({ label, body: rich(`Pilihan ${label}`) }))
const leaf = (over: Record<string, unknown>) => ({ label: '(a)', prompt: rich('Soalan'), ...over }) as never
const pt = (id: string, over: Record<string, unknown> = {}) => ({ id, code: 'M', label: id, marks: 1, ...over })
const status = (r: Parameters<typeof partStatusOf>[0]) => partStatusOf(r)
const marksOf = (r: { kind: string; marks?: number }) => (r.kind === 'graded' ? r.marks : null)

describe('mcq and true_false (M-MCQ)', () => {
  const mcq = (key: object, options = opts(4)) => leaf({ mode: 'mcq', marks: 2, options, key })
  it.each([
    ['the correct label', 'B', 'betul', 2],
    ['a lower-case label with spaces', ' b ', 'betul', 2],
    ['a wrong label', 'C', 'salah', 0],
    ['a label listed in accepted (Terima pilihan lain)', 'D', 'betul', 2],
    ['a blank label', '', 'kosong', null],
  ])('single answer, %s', (_n, label, st, marks) => {
    const r = gradeLeaf(mcq({ kind: 'option', correct: 'B', accepted: ['B', 'D'] }), { kind: 'option', label })
    expect(status(r)).toBe(st)
    expect(marksOf(r)).toBe(marks)
  })
  it('true_false is an mcq leaf with the two fixed options Betul / Salah', () => {
    const tf = (correct: string) => leaf({ mode: 'mcq', marks: 1, options: TRUE_FALSE_OPTIONS.map((o) => ({ ...o })), key: { kind: 'option', correct } })
    expect(status(gradeLeaf(tf('A'), { kind: 'option', label: 'A' }))).toBe('betul')
    expect(status(gradeLeaf(tf('A'), { kind: 'option', label: 'B' }))).toBe('salah')
    expect(status(gradeLeaf(tf('B'), { kind: 'option', label: 'B' }))).toBe('betul')
  })
})

describe('mcq_multi (M-MULTI)', () => {
  const labels = ['A', 'B', 'C', 'D']
  // [marks, correct ids, ticked, awarded, status]
  it.each([
    // marks = 1: all or nothing
    [1, ['A', 'C'], ['A', 'C'], 1, 'betul'],
    [1, ['A', 'C'], ['A'], 0, 'salah'],
    [1, ['A', 'C'], ['A', 'C', 'B'], 0, 'salah'],
    // marks > 1: floor(marks * (c - w) / k)
    [4, ['A', 'C'], ['A', 'C'], 4, 'betul'],
    [4, ['A', 'C'], ['A'], 2, 'separa'],
    [3, ['A', 'C'], ['A'], 1, 'separa'],
    [3, ['A', 'C'], ['A', 'C', 'B'], 1, 'separa'],
    // w > c never goes below 0
    [4, ['A', 'C'], ['B', 'D', 'A'], 0, 'salah'],
    [4, ['A', 'C'], ['B', 'D'], 0, 'salah'],
    // ticking every option scores 0, even when the formula would be positive (k = 3: 4 x (3 - 1) / 3 = 2)
    [4, ['A', 'B', 'C'], ['A', 'B', 'C', 'D'], 0, 'salah'],
    [1, ['A', 'B', 'C'], ['A', 'B', 'C', 'D'], 0, 'salah'],
    // repeats and unknown labels are ignored
    [2, ['A'], ['A', 'A', 'Z'], 2, 'betul'],
  ])('marks %i, correct %j, ticked %j -> %i (%s)', (marks, correct, ticked, awarded, st) => {
    const r = gradeMcqMulti({ correctOptionIds: correct }, labels, ticked, marks)
    expect(marksOf(r)).toBe(awarded)
    expect(status(r)).toBe(st)
    expect(r).toMatchObject({ kind: 'graded', correct: st === 'betul' })
  })
  it('through gradeLeaf: the options key with the multi flag; nothing ticked is kosong', () => {
    const multi = leaf({ mode: 'mcq', marks: 4, options: opts(4), modeConfig: { multi: true }, key: { kind: 'options', correctOptionIds: ['A', 'C'] } })
    expect(marksOf(gradeLeaf(multi, { kind: 'options', labels: ['A'] }))).toBe(2)
    expect(status(gradeLeaf(multi, { kind: 'options', labels: [] }))).toBe('kosong')
    expect(status(gradeLeaf(multi, { kind: 'text', text: 'A' }))).toBe('salah')
  })
  it('PKSK pksk_choice keeps its label key (D115)', () => {
    const p = leaf({ mode: 'pksk_choice', marks: 1, options: opts(3), key: { kind: 'options', correct: ['B'] } })
    expect(status(gradeLeaf(p, { kind: 'option', label: 'B' }))).toBe('betul')
    expect(status(gradeLeaf(p, { kind: 'option', label: 'A' }))).toBe('salah')
  })
})

describe('short_text (M-SHORT)', () => {
  const key = (values: string[], over: object = {}) => ({ kind: 'accepted' as const, values, ...over })
  // [accepted, answer, status]
  it.each([
    [['Kuala Lumpur'], 'kuala   lumpur', 'betul'],
    [['Kuala Lumpur'], '  KUALA LUMPUR ', 'betul'],
    [['Kuala Lumpur'], 'Kuála Lumpur', 'betul'],
    [['U.S.A'], 'u s a', 'betul'],
    [['keluar-masuk'], 'keluar masuk', 'betul'],
    [['KL', 'Kuala Lumpur'], 'kl', 'betul'],
    // an exact phrase, not a substring
    [['Kuala Lumpur'], 'Lumpur', 'salah'],
    [['air'], 'airport', 'salah'],
    // a wrong answer of fewer than 3 words is salah; 3 or more is belum_dimarkah
    [['Kuala Lumpur'], 'Johor Bahru', 'salah'],
    [['Kuala Lumpur'], 'Johor Bahru Selatan', 'belum_dimarkah'],
    [['Kuala Lumpur'], 'Kuala Lumpur ialah ibu negara', 'belum_dimarkah'],
    [['Kuala Lumpur'], '   ', 'kosong'],
  ])('accepted %j, answer %j -> %s', (values, text, st) => {
    const l = leaf({ mode: 'short_text', marks: 1, key: key(values) })
    expect(status(gradeLeaf(l, { kind: 'text', text }))).toBe(st)
  })
  it('belum_dimarkah shows the accepted answers and awards nothing', () => {
    expect(gradeShortText(key(['Kuala Lumpur']), 'tidak tahu jawapan ini', 2)).toEqual({ kind: 'needs_review', maxMarks: 2, acceptedShown: ['Kuala Lumpur'] })
  })
  it('caseSensitive is trimmed only', () => {
    const cs = key(['NaCl'], { caseSensitive: true })
    expect(status(gradeShortText(cs, ' NaCl ', 1))).toBe('betul')
    expect(status(gradeShortText(cs, 'nacl', 1))).toBe('salah')
  })
  it('45 7.1 (a): two blanks, any order', () => {
    const k = key(['[jawapan i]', '[jawapan ii]'], { anyOrder: true })
    expect(status(gradeShortText(k, '[jawapan ii]; [jawapan i]', 2))).toBe('betul')
    expect(status(gradeShortText(k, 'jawapan i', 2))).toBe('salah')
  })
})

describe('numeric (M-NUM), 45 7.3 (a): 4.2 +/- 0.1 m s^-1 (alt m/s)', () => {
  const k = { kind: 'accepted' as const, values: [{ v: 4.2, tol: 0.1, tolKind: 'abs' as const, unit: 'm s^-1', unitAlt: ['m/s'] }] }
  const l = leaf({ mode: 'numeric', marks: 2, key: k })
  it.each([
    ['number and unit field', { kind: 'number', value: 4.25, unit: 'm/s' }, 'betul', undefined],
    ['unit written as in the key', { kind: 'number', value: 4.2, unit: 'm s^-1' }, 'betul', undefined],
    ['unit case and spacing ignored', { kind: 'number', value: 4.2, unit: 'M / S' }, 'betul', undefined],
    ['no unit', { kind: 'number', value: 4.2 }, 'salah', 'Unit tidak ditulis.'],
    ['wrong unit', { kind: 'number', value: 4.2, unit: 'cm' }, 'salah', 'Unit tidak betul.'],
    ['outside the tolerance', { kind: 'number', value: 4.4, unit: 'm/s' }, 'salah', undefined],
    ['typed text with the unit', { kind: 'text', text: '4.3 m/s' }, 'betul', undefined],
    ['typed text without the unit', { kind: 'text', text: '4.2' }, 'salah', 'Unit tidak ditulis.'],
    ['text that cannot be parsed', { kind: 'text', text: 'lebih kurang empat' }, 'belum_dimarkah', undefined],
    ['a number that is not finite', { kind: 'number', value: Number.NaN }, 'belum_dimarkah', undefined],
    ['blank text', { kind: 'text', text: '' }, 'kosong', undefined],
  ])('%s -> %s', (_n, answer, st, reason) => {
    const r = gradeLeaf(l, answer as never)
    expect(status(r)).toBe(st)
    if (reason !== undefined) expect(r).toMatchObject({ reasons: [reason] })
  })
  it('default tolerance 0: 0.50, 0.5 and 1/2 are equal; a comma decimal reads as a point', () => {
    const half = { kind: 'accepted' as const, values: [{ v: 0.5 }] }
    for (const text of ['0.50', '0.5', '1/2', '0,5']) expect(status(gradeNumericText(half, text, undefined, 1))).toBe('betul')
    expect(status(gradeNumericText(half, '0.51', undefined, 1))).toBe('salah')
  })
  it('relative tolerance is a fraction of the value', () => {
    const rel = { kind: 'accepted' as const, values: [{ v: 100, tol: 0.05, tolKind: 'rel' as const }] }
    expect(status(gradeNumericText(rel, '104', undefined, 1))).toBe('betul')
    expect(status(gradeNumericText(rel, '106', undefined, 1))).toBe('salah')
  })
})

describe('working with a scheme v2 points key (M-WORK)', () => {
  const key = (marks: number, rest: object) => ({ kind: 'points', scheme_v: 2, marks, ...rest })
  const work = (k: object, marks: number) => leaf({ mode: 'working', marks, key: k })
  const answer = (over: object) => ({ kind: 'working' as const, ...over })

  it('step: an equivalent expression matches (2x+6 = 2(x+3)), also one side of a chain', () => {
    const l = work(key(2, { points: [pt('m1', { accept: ['2x+6'] }), pt('m2', { accept: ['x^2'] })] }), 2)
    const r = gradeLeaf(l, answer({ steps: ['2(x+3)', 'y = x*x = z'] }))
    expect(r).toMatchObject({ kind: 'graded', marks: 2, correct: true })
  })
  it('step: a notAccepted value is never matched', () => {
    const l = work(key(1, { points: [pt('m1', { accept: ['2'], notAccepted: ['2.0'] })] }), 1)
    expect(status(gradeLeaf(l, answer({ steps: ['2.0'] })))).toBe('salah')
    expect(status(gradeLeaf(l, answer({ steps: ['2'] })))).toBe('betul')
  })
  it('all_of needs every item; keywords (Dilihat) match whole words only', () => {
    const l = work(key(2, { points: [pt('a1', { allOf: ['2x', '6'] }), pt('k1', { seen: true, accept: ['air'] })] }), 2)
    expect(gradeLeaf(l, answer({ steps: ['2x', '6'], text: 'ada air di sini' }))).toMatchObject({ marks: 2 })
    expect(gradeLeaf(l, answer({ steps: ['2x'], text: 'airport' }))).toMatchObject({ kind: 'graded', marks: 0 })
  })
  it('requires: a point counts only when the points it requires count, with the PRD reason', () => {
    const k = key(3, {
      points: [pt('m1', { accept: ['F=ma'] }), pt('m2', { accept: ['12'], requires: ['m1'] }), pt('n1', { accept: ['60'], requires: ['m2'] })],
    })
    const r = gradeLeaf(work(k, 3), answer({ steps: ['12', '60'] }))
    expect(r).toMatchObject({ kind: 'graded', marks: 0 })
    expect(r).toMatchObject({ reasons: ['Tidak diberi: m1 tidak diperoleh.', 'Tidak diberi: m2 tidak diperoleh.'] })
    expect(gradeLeaf(work(k, 3), answer({ steps: ['F=ma', '12', '60'] }))).toMatchObject({ marks: 3 })
  })
  it('45 7.1 (b): mana-mana 3 daripada 4 fakta counts only the first 3 hit points', () => {
    const k = key(3, {
      points: ['f1', 'f2', 'f3', 'f4'].map((id) => pt(id, { code: 'F', accept: [id] })),
      groups: [{ id: 'g1', anyN: 3, eachMarks: 1, pointIds: ['f1', 'f2', 'f3', 'f4'] }],
    })
    expect(gradeLeaf(work(k, 3), answer({ steps: ['f1', 'f2', 'f3', 'f4'] }))).toMatchObject({ marks: 3, correct: true })
    expect(gradeLeaf(work(k, 3), answer({ steps: ['f2', 'f4'] }))).toMatchObject({ marks: 2, correct: false })
    expect(status(gradeLeaf(work(k, 3), answer({ steps: ['f2', 'f4'] })))).toBe('separa')
  })
  it('45 7.3 (c): pair groups (the reason only with the feature), cap and bonus', () => {
    const points = ['c1', 'r1', 'c2', 'r2', 'c3', 'r3'].map((id) => pt(id, { accept: [id] }))
    const k = key(8, {
      points,
      groups: [
        { id: 'p1', type: 'pair', pointIds: ['c1', 'r1'] },
        { id: 'p2', type: 'pair', pointIds: ['c2', 'r2'] },
        { id: 'p3', type: 'pair', pointIds: ['c3', 'r3'], cap: 1 },
      ],
      bonus: { ifAllCorrect: true, marks: 2, label: '[Semua betul]' },
    })
    // a reason without its feature scores nothing
    expect(gradeLeaf(work(k, 8), answer({ steps: ['r1', 'r2'] }))).toMatchObject({ marks: 0 })
    // feature + reason pairs (2 + 2), the third pair capped at 1, plus the bonus of 2
    expect(gradeLeaf(work(k, 8), answer({ steps: ['c1', 'r1', 'c2', 'r2', 'c3', 'r3'] }))).toMatchObject({ marks: 7 })
    expect(gradeLeaf(work(k, 8), answer({ steps: ['c1', 'r1', 'c2'] }))).toMatchObject({ marks: 3 })
  })
  it('alternatives: the best single alternative counts, never their sum', () => {
    const k = key(3, {
      points: [pt('a1', { accept: ['a1'] }), pt('a2', { accept: ['a2'] }), pt('b1', { accept: ['b1'] }), pt('b2', { accept: ['b2'] }), pt('b3', { accept: ['b3'] })],
      alternatives: [{ id: 'A', name: 'Kaedah A', pointIds: ['a1', 'a2'] }, { id: 'B', name: 'Kaedah B', pointIds: ['b1', 'b2', 'b3'] }],
    })
    expect(gradeLeaf(work(k, 3), answer({ steps: ['a1', 'a2', 'b1', 'b2'] }))).toMatchObject({ marks: 2 })
    expect(gradeLeaf(work(k, 3), answer({ steps: ['a1', 'a2', 'b1', 'b2', 'b3'] }))).toMatchObject({ marks: 3 })
  })
  it('countMarks (P2,1,0): the mark for the number of hit points', () => {
    const k = key(2, { points: [pt('p1', { accept: ['p1'] }), pt('p2', { accept: ['p2'] })], countMarks: { items: 2, marks: [2, 1, 0] } })
    expect(gradeLeaf(work(k, 2), answer({ steps: ['p1', 'p2'] }))).toMatchObject({ marks: 2 })
    expect(gradeLeaf(work(k, 2), answer({ steps: ['p2'] }))).toMatchObject({ marks: 1 })
    expect(gradeLeaf(work(k, 2), answer({ steps: ['zzz'] }))).toMatchObject({ marks: 0 })
  })
  it('the sum is capped at the part marks', () => {
    const k = key(1, { points: [pt('p1', { accept: ['a'], marks: 3 })] })
    expect(gradeLeaf(work(k, 1), answer({ steps: ['a'] }))).toMatchObject({ marks: 1, correct: true })
  })
  it('final: the final box with tolerance and unit; a unit point carries the reasons', () => {
    const k = key(3, {
      points: [pt('n1', { code: 'N', tol: 0.5, tolKind: 'abs' }), pt('u1', { code: 'B', unit: { value: 'cm', mandatory: true } }), pt('m1', { accept: ['2x'] })],
      finalAnswer: { display: '12 cm', accepted: ['12'], unit: 'cm' },
    })
    expect(gradeLeaf(work(k, 3), answer({ steps: ['2x'], final: '12', unit: 'cm' }))).toMatchObject({ marks: 3 })
    expect(gradeLeaf(work(k, 3), answer({ steps: ['2x'], final: '12.3 cm' }))).toMatchObject({ marks: 3 })
    expect(gradeLeaf(work(k, 3), answer({ steps: ['2x'], final: '12' }))).toMatchObject({ marks: 2, reasons: ['Unit tidak ditulis.'] })
    expect(gradeLeaf(work(k, 3), answer({ steps: ['2x'], final: '12', unit: 'm' }))).toMatchObject({ marks: 2, reasons: ['Unit tidak betul.'] })
  })
  it('final: an unparseable final box is belum_dimarkah with the hits as the suggestion', () => {
    const k = key(2, { points: [pt('m1', { accept: ['2x'] }), pt('n1', { code: 'N', tol: 0 })], finalAnswer: { display: '12', accepted: ['12'] } })
    const r = gradeLeaf(work(k, 2), answer({ steps: ['2x'], final: 'kira-kira dua belas' }))
    expect(r).toMatchObject({ kind: 'needs_review', suggestion: { marks: 1 } })
    expect(status(r)).toBe('belum_dimarkah')
  })
  it('45 7.3 (b): a manual point makes the leaf belum_dimarkah, the suggestion is the sum of the matched points', () => {
    const k = key(3, {
      points: [pt('m1', { accept: ['F=ma'] }), pt('m2', { requires: ['m1'] }), pt('n1', { code: 'N', requires: ['m2'], unit: { value: 'J', mandatory: true } })],
    })
    const r = gradeLeaf(work(k, 3), answer({ steps: ['F=ma'], final: '60 J' }))
    expect(r).toMatchObject({ kind: 'needs_review', maxMarks: 3, suggestion: { marks: 1 } })
  })
  it('a scheme without any machine-readable point has no suggestion', () => {
    const k = key(2, { points: [pt('k1'), pt('n1')] })
    expect(gradeLeaf(work(k, 2), answer({ steps: ['apa-apa'] }))).toEqual({ kind: 'needs_review', maxMarks: 2 })
  })
  it('ECF: the own earlier final carried forward (45 7.3 (b), op same)', () => {
    const parts = [
      leaf({ label: '(a)', mode: 'numeric', marks: 2, key: { kind: 'accepted', values: [{ v: 4.2, tol: 0.1 }] } }),
      leaf({ label: '(b)', mode: 'working', marks: 1, key: key(1, { points: [pt('n1', { code: 'N', ecf: { fromPart: '(a)', rule: { op: 'same' } } })], finalAnswer: { display: '9', accepted: ['9'] } }) }),
    ] as never[]
    const wrongA = gradeQuestion('1', parts, [{ path: '(a)', value: { kind: 'number', value: 7 } }, { path: '(b)', value: { kind: 'working', final: '7' } }])
    expect(wrongA.parts.map((p) => p.status)).toEqual(['salah', 'betul'])
    const noEcf = gradeQuestion('1', parts, [{ path: '(a)', value: { kind: 'number', value: 7 } }, { path: '(b)', value: { kind: 'working', final: '8' } }])
    expect(noEcf.parts[1]!.status).toBe('salah')
  })
  it('deductions: the unit deduction is applied, never below 0; spelling and zeroIf need a person', () => {
    const base = { points: [pt('m1', { accept: ['2x'] }), pt('n1', { code: 'N', tol: 0 })], finalAnswer: { display: '12 cm', accepted: ['12'], unit: 'cm' } }
    const withUnit = key(2, { ...base, deductions: [{ code: 'unit', amount: 1, scope: 'part' }] })
    expect(gradeLeaf(work(withUnit, 2), answer({ steps: ['2x'], final: '12' }))).toMatchObject({ kind: 'graded', marks: 1 })
    expect(gradeLeaf(work(withUnit, 2), answer({ steps: ['2x'], final: '12 cm' }))).toMatchObject({ kind: 'graded', marks: 2 })
    const floor = key(1, { points: [pt('n1', { code: 'N', tol: 0 })], finalAnswer: { display: '12 cm', accepted: ['12'], unit: 'cm' }, deductions: [{ code: 'unit', amount: 5, scope: 'part' }] })
    expect(gradeLeaf(work(floor, 1), answer({ final: '12' }))).toMatchObject({ kind: 'graded', marks: 0 })
    const spelling = key(2, { ...base, deductions: [{ code: 'spelling', amount: 1, scope: 'part' }] })
    expect(gradeLeaf(work(spelling, 2), answer({ steps: ['2x'], final: '12 cm' }))).toMatchObject({ kind: 'needs_review', suggestion: { marks: 2 } })
    const zero = key(2, { ...base, zeroIf: [{ code: 'copy', label: '[menyalin]' }] })
    expect(status(gradeLeaf(work(zero, 2), answer({ steps: ['2x'], final: '12 cm' })))).toBe('belum_dimarkah')
  })
  it('question-level schemeRules (part-scope deductions, zeroIf) reach the leaf through gradeQuestion', () => {
    const parts = [work(key(1, { points: [pt('m1', { accept: ['2x'] })] }), 1)]
    const plain = gradeQuestion('1', parts, [{ value: { kind: 'working', steps: ['2x'] } }])
    expect(plain.parts[0]!.status).toBe('betul')
    const ruled = gradeQuestion('1', parts, [{ value: { kind: 'working', steps: ['2x'] } }], { schemeRules: { zeroIf: [{ code: 'copy', label: '[menyalin]' }] } })
    expect(ruled.parts[0]!.status).toBe('belum_dimarkah')
  })
  it('only a photo, more than 80 words, nothing: belum_dimarkah, belum_dimarkah, kosong', () => {
    const l = work(key(1, { points: [pt('m1', { accept: ['2x'] })] }), 1)
    expect(gradeLeaf(l, answer({ photos: 1 }))).toEqual({ kind: 'needs_review', maxMarks: 1 })
    const long = Array.from({ length: 81 }, (_, i) => `kata${String(i)}`).join(' ')
    expect(gradeLeaf(l, answer({ steps: ['2x'], text: long }))).toMatchObject({ kind: 'needs_review', suggestion: { marks: 1 } })
    expect(status(gradeLeaf(l, answer({ steps: ['  '], photos: 0 })))).toBe('kosong')
  })
  it('a v1 working key is not evaluated: belum_dimarkah', () => {
    const l = leaf({ mode: 'working', marks: 3, key: { kind: 'points', marks: 3, points: [{ id: 'p1', code: 'K', label: 'k', marks: 3, accept: ['x'] }] } })
    expect(gradeLeaf(l, { kind: 'text', text: 'x' })).toEqual({ kind: 'needs_review', maxMarks: 3 })
  })
  it('the engine shared with the gate: best reachable equals the total when every point hits', () => {
    const k = key(3, {
      points: ['f1', 'f2', 'f3', 'f4'].map((id) => pt(id, { accept: [id] })),
      groups: [{ id: 'g1', anyN: 3, eachMarks: 1, pointIds: ['f1', 'f2', 'f3', 'f4'] }],
    })
    expect(schemeTotal(k as never)).toBe(3)
    expect(gradeWorking(k as never, { steps: ['f1', 'f2', 'f3', 'f4'] }, 3)).toMatchObject({ marks: 3 })
  })
})

describe('essay, drawing and table_fill (never auto-awarded)', () => {
  const rubric = { kind: 'rubric', scheme_v: 2, marks: 5, scoring: 'overall', criteria: [{ id: 'k', name: 'Kandungan' }], bands: [{ name: 'Aras 1', range: [1, 5] }] }
  it.each([
    ['essay with text', leaf({ mode: 'essay', marks: 5, key: rubric }), { kind: 'text', text: 'Karangan murid.' }, 'belum_dimarkah'],
    ['essay blank', leaf({ mode: 'essay', marks: 5, key: rubric }), { kind: 'text', text: '  ' }, 'kosong'],
    ['essay_choice with text', leaf({ mode: 'essay_choice', marks: 5, topics: [], key: rubric }), { kind: 'text', text: 'Esei.' }, 'belum_dimarkah'],
    ['drawing with a photo', leaf({ mode: 'drawing', marks: 2, key: { kind: 'points', scheme_v: 2, marks: 2, points: [pt('k1', { marks: 2 })] } }), { kind: 'photo', count: 1 }, 'belum_dimarkah'],
    ['drawing with no file', leaf({ mode: 'drawing', marks: 2, key: { kind: 'points', scheme_v: 2, marks: 2, points: [pt('k1', { marks: 2 })] } }), { kind: 'photo', count: 0 }, 'kosong'],
  ])('%s -> %s', (_n, l, a, st) => {
    const r = gradeLeaf(l, a as never)
    expect(status(r)).toBe(st)
    expect(r.kind === 'graded').toBe(false)
  })
  // [marks, keyed cells, cells given, k of n, suggested mark]
  it.each([
    [2, 4, 4, 2],
    [2, 4, 1, 1], // 0.5 rounds half up
    [3, 2, 1, 2], // 1.5 rounds half up
    [3, 3, 2, 2],
    [4, 4, 0, 0],
  ])('table_fill, marks %i, %i keyed cells, %i matching -> suggestion %i', (marks, n, k, suggested) => {
    const cells: Record<string, string[]> = {}
    for (let i = 0; i < n; i++) cells[`r${String(i + 2)}c2`] = [String(i + 10)]
    const given: Record<string, string> = {}
    for (let i = 0; i < n; i++) given[`r${String(i + 2)}c2`] = i < k ? String(i + 10) : 'salah'
    const r = gradeCells({ kind: 'mapping', cells }, given, marks)
    expect(r).toEqual({ kind: 'needs_review', maxMarks: marks, suggestion: { marks: suggested, message: `Cadangan automatik: ${String(k)} daripada ${String(n)} sel sepadan` } })
    expect(status(r)).toBe('belum_dimarkah')
  })
  it('table_fill: M-NUM equality for numeric cells (10.0 = 10), blank grid is kosong', () => {
    const l = leaf({ mode: 'table_fill', marks: 2, key: { kind: 'mapping', cells: { r2c2: ['10'], r3c2: ['Pa'] } } })
    expect(gradeLeaf(l, { kind: 'cells', cells: { r2c2: '10.0', r3c2: 'pa' } })).toMatchObject({ suggestion: { marks: 2 } })
    expect(status(gradeLeaf(l, { kind: 'cells', cells: { r2c2: ' ', r3c2: '' } }))).toBe('kosong')
  })
})

describe('the question grade: example leaf, rows and status mapping', () => {
  const parts = [
    leaf({ label: '(a)', mode: 'short_text', marks: 0, modeConfig: { example: { answer: 'Contoh' } }, key: { kind: 'accepted', values: ['Contoh'] } }),
    leaf({ label: '(b)', mode: 'short_text', marks: 2, key: { kind: 'accepted', values: ['betul'] } }),
    leaf({ label: '(c)', mode: 'short_text', marks: 2, key: { kind: 'accepted', values: ['betul'] } }),
    leaf({ label: '(d)', mode: 'essay', marks: 3, key: { kind: 'rubric', marks: 3, criteria: [{ id: 'k', name: 'K' }], bands: [{ name: 'B', range: [1, 3] }] } }),
    leaf({ label: '(e)', mode: 'short_text', marks: 2, key: { kind: 'accepted', values: ['betul'] } }),
  ] as never[]
  const grade = gradeQuestion('7', parts, [
    { path: '(b)', value: { kind: 'text', text: 'betul' } },
    { path: '(c)', value: { kind: 'text', text: 'salah' } },
    { path: '(d)', value: { kind: 'text', text: 'Karangan.' } },
  ])
  it('an example leaf has no entry and is not counted', () => {
    expect(isExampleLeaf((parts[0] as unknown as { modeConfig: object }))).toBe(true)
    expect(grade.parts.map((p) => p.path)).toEqual(['(b)', '(c)', '(d)', '(e)'])
    expect(grade.maxMarks).toBe(2 + 2 + 3 + 2)
  })
  it('the status of every part', () => {
    expect(grade.parts.map((p) => p.status)).toEqual(['betul', 'salah', 'belum_dimarkah', 'kosong'])
    expect(grade).toMatchObject({ marks: 2, needsReview: true })
  })
  it('one row per answered leaf: kosong and the example write none; belum_dimarkah writes the suggestion (0 when none)', () => {
    expect(markRows(grade)).toEqual([
      { path: '(b)', status: 'betul', marks: 2, isCorrect: true },
      { path: '(c)', status: 'salah', marks: 0, isCorrect: false },
      { path: '(d)', status: 'belum_dimarkah', marks: 0, isCorrect: false },
    ])
  })
  it('an example leaf next to one marked leaf: the answer needs no path', () => {
    const g = gradeQuestion('8', parts.slice(0, 2), [{ value: { kind: 'text', text: 'betul' } }])
    expect(g.parts).toEqual([expect.objectContaining({ path: '(b)', status: 'betul' })])
  })
  // [result, status]
  it.each([
    [{ kind: 'graded', correct: true, marks: 3, maxMarks: 3 }, 'betul'],
    [{ kind: 'graded', correct: false, marks: 1, maxMarks: 3 }, 'separa'],
    [{ kind: 'graded', correct: false, marks: 0, maxMarks: 3 }, 'salah'],
    [{ kind: 'blank', maxMarks: 3 }, 'kosong'],
    [{ kind: 'needs_review', maxMarks: 3 }, 'belum_dimarkah'],
    [{ kind: 'needs_review', maxMarks: 3, suggestion: { marks: 3 } }, 'belum_dimarkah'],
  ])('%j -> %s', (result, st) => {
    expect(partStatusOf(result as never)).toBe(st)
  })
  it('separa is 0 < awarded < marks (mcq_multi partial credit)', () => {
    const r = gradeMcqMulti({ correctOptionIds: ['A', 'B'] }, ['A', 'B', 'C'], ['A'], 4)
    expect(r).toMatchObject({ marks: 2 })
    expect(partStatusOf(r)).toBe('separa')
  })
})
