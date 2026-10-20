import { QuestionPartSchema } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import {
  gradePart,
  leavesOf,
  type PartAnswer,
  type PartDef,
  type SchemeDef,
} from '../../src/modules/bijak/attempts/exam-core.adapter'
import { leavesOfBundle, questionMarks } from '../../src/modules/bijak/attempts/marking'
import {
  type CurriculumLabels,
  infoOf,
  mapBe09Question,
  UnsupportedQuestionError,
} from '../../src/modules/bijak/question-bridge/be09-mapping'
import type {
  QuestionRecord,
  StimulusGroupRecord,
  StimulusRecord,
} from '../../src/modules/questions/types'

/* ------------------------------------------------------------------------------ builders */

const LABELS: CurriculumLabels = { subjectCode: 'MAT', unitLabel: 'Algebra', unitCode: '2' }
const rt = (ms: string) => ({ ms })

function record(
  parts: unknown[],
  overrides: { id?: string; groupId?: string | null; version?: Record<string, unknown> } = {},
): QuestionRecord {
  const now = new Date('2026-01-01T00:00:00Z')
  const base = {
    id: 'v1',
    versionNo: 3,
    status: 'published',
    archiveReason: null,
    publishedAt: now,
    type: 'structured',
    stemMs: 'Stem text',
    stemEn: null,
    numberLabel: null,
    language: 'ms',
    explanationMs: 'Because.',
    explanationEn: null,
    subjectId: null,
    educationLevelId: null,
    unitId: null,
    chapterId: null,
    topicId: null,
    formOrigin: 't4',
    cognitiveLevel: null,
    difficultyTp: 3,
    sourcePage: null,
    setLabel: null,
    sourceFile: null,
    spIds: ['11', '12'],
    stimulusIds: [],
    parts: parts.map((p) => QuestionPartSchema.parse(p)),
    createdAt: now,
    updatedAt: now,
  }
  return {
    id: overrides.id ?? '501',
    isActive: true,
    sourceType: 'manual',
    createdById: null,
    latestVersionNo: 3,
    liveVersionNo: 3,
    groupId: overrides.groupId ?? null,
    groupPosition: null,
    spmPool: true,
    createdAt: now,
    updatedAt: now,
    version: { ...base, ...(overrides.version ?? {}) },
  } as unknown as QuestionRecord
}

const stimulus = (over: Partial<StimulusRecord> = {}): StimulusRecord => ({
  id: '70',
  kind: 'passage',
  label: 'Petikan A',
  bodyMs: 'Passage body',
  bodyEn: null,
  assetFileId: null,
  alt: null,
  ...over,
})

const group = (over: Partial<StimulusGroupRecord> = {}): StimulusGroupRecord => ({
  id: '9',
  stimuli: [stimulus()],
  optionBank: [],
  questionIds: ['501'],
  ...over,
})

const leaf = (mode: string, key: unknown, extra: Record<string, unknown> = {}) => ({
  label: '(a)',
  prompt: rt('Prompt'),
  marks: 2,
  mode,
  key,
  ...extra,
})

const point = (id: string, code: string, marks: number, extra: Record<string, unknown> = {}) => ({
  id,
  code,
  label: `Point ${id}`,
  marks,
  ...extra,
})

const pointsKey = (points: unknown[], extra: Record<string, unknown> = {}) => ({
  kind: 'points',
  marks: (points as { marks: number }[]).reduce((n, p) => n + p.marks, 0),
  points,
  ...extra,
})

const mcqPart = (extra: Record<string, unknown> = {}) =>
  leaf(
    'mcq',
    { kind: 'option', correct: 'B' },
    {
      label: '',
      marks: 1,
      prompt: rt('Which one?'),
      options: [
        { label: 'A', body: rt('One') },
        { label: 'B', body: rt('Two') },
        { label: 'C', body: rt('Three') },
        { label: 'D', body: rt('Four') },
      ],
      ...extra,
    },
  )

const branch = (label: string, children: unknown[]) => ({
  label,
  prompt: rt(`Branch ${label}`),
  children,
})

const map = (
  parts: unknown[],
  over: Parameters<typeof record>[1] = {},
  g: StimulusGroupRecord | null = null,
) => mapBe09Question(record(parts, over), g, LABELS)

const partOf = (b: ReturnType<typeof map>, id: string): PartDef => {
  const found = leavesOf(b.question.parts ?? []).find((l) => l.id === id)
  if (!found) throw new Error(`no leaf ${id}`)
  return {
    id: found.id,
    label: found.label,
    prompt: found.prompt,
    marks: found.marks,
    answer: { kind: found.kind },
  }
}

const grade = (
  b: ReturnType<typeof map>,
  id: string,
  kind: string,
  answer: PartAnswer,
  finals: Record<string, number | null> = {},
) => {
  const p = partOf(b, id)
  return gradePart({
    part: {
      id: p.id,
      label: p.label,
      prompt: p.prompt,
      marks: p.marks,
      kind: kind as 'short_text',
    },
    scheme: b.schemes[id] as SchemeDef,
    answer,
    ctx: { previousFinals: finals },
  })
}

function refusal(
  parts: unknown[],
  over: Parameters<typeof record>[1] = {},
  g: StimulusGroupRecord | null = null,
): UnsupportedQuestionError {
  try {
    map(parts, over, g)
  } catch (e) {
    expect(e).toBeInstanceOf(UnsupportedQuestionError)
    return e as UnsupportedQuestionError
  }
  throw new Error('expected an UnsupportedQuestionError')
}

const pointsScheme = (b: ReturnType<typeof map>, id: string) =>
  b.schemes[id] as Extract<SchemeDef, { kind: 'points' }>

/* ------------------------------------------------------------------------------ mcq */

describe('mapBe09Question: mcq', () => {
  it('maps a single root mcq leaf to a question-level mcq with an option scheme', () => {
    const b = map([mcqPart()], { version: { stemMs: 'Context.' } })
    expect(b.question.id).toBe('501')
    expect(b.question.mcq).toEqual({
      options: [
        { id: 'A', text: 'One' },
        { id: 'B', text: 'Two' },
        { id: 'C', text: 'Three' },
        { id: 'D', text: 'Four' },
      ],
    })
    expect(b.question.parts).toBeUndefined()
    expect(b.question.stem).toBe('Context.\n\nWhich one?')
    expect(b.schemes).toEqual({
      '501': { kind: 'option', marks: 1, correct: 'B', reason: 'Because.' },
    })
    expect(b.question.curriculum).toMatchObject({
      subject: 'MAT',
      level: 'T4',
      unit: '2',
      unitLabel: 'Algebra',
      sp: ['11', '12'],
      tp: 3,
      formOrigin: 'T4',
    })
    expect(b.versionNo).toBe(3)
  })

  it('uses the prompt alone when the stem is empty, and the stem alone when it equals the prompt', () => {
    expect(map([mcqPart()], { version: { stemMs: null } }).question.stem).toBe('Which one?')
    expect(map([mcqPart()], { version: { stemMs: 'Which one?' } }).question.stem).toBe('Which one?')
  })

  it('grades with the question id as the leaf id', () => {
    const b = map([mcqPart()])
    const part = { id: '501', label: '', prompt: b.question.stem, marks: 1, kind: 'mcq' as const }
    const scheme = b.schemes['501'] as SchemeDef
    expect(
      gradePart({ part, scheme, answer: { choice: 'B' }, ctx: { previousFinals: {} } }).awarded,
    ).toBe(1)
    expect(
      gradePart({ part, scheme, answer: { choice: 'C' }, ctx: { previousFinals: {} } }).awarded,
    ).toBe(0)
  })

  it('maps the curriculum levels', () => {
    expect(
      map([mcqPart()], { version: { formOrigin: 't1_t3' } }).question.curriculum,
    ).toMatchObject({ level: 'T4+T5', formOrigin: 'T1-T3' })
    expect(
      map([mcqPart()], { version: { formOrigin: 't5', difficultyTp: null } }).question.curriculum,
    ).toMatchObject({ level: 'T5', formOrigin: 'T5', tp: 0 })
  })
})

/* ------------------------------------------------------------------------------ short_text */

describe('mapBe09Question: short_text', () => {
  const parts = [
    leaf('short_text', { kind: 'accepted', values: ['Kuala Lumpur', 'KL'], caseSensitive: true }),
  ]

  it('maps accepted values and passes caseSensitive through', () => {
    const b = map(parts)
    expect(b.schemes['501.a']).toEqual({
      kind: 'accepted',
      marks: 2,
      values: [{ v: 'Kuala Lumpur' }, { v: 'KL' }],
      caseSensitive: true,
    })
    expect(b.question.parts?.[0]).toMatchObject({
      id: '501.a',
      label: '(a)',
      marks: 2,
      answer: { kind: 'short_text' },
    })
  })

  it('omits caseSensitive when not set', () => {
    const b = map([leaf('short_text', { kind: 'accepted', values: ['x'] })])
    expect(b.schemes['501.a']).toEqual({ kind: 'accepted', marks: 2, values: [{ v: 'x' }] })
  })

  it('grades a correct and a wrong text', () => {
    const b = map(parts)
    expect(grade(b, '501.a', 'short_text', { text: 'Kuala Lumpur' }).awarded).toBe(2)
    expect(grade(b, '501.a', 'short_text', { text: 'Ipoh' }).awarded).toBe(0)
  })
})

/* ------------------------------------------------------------------------------ numeric */

describe('mapBe09Question: numeric', () => {
  it('maps an absolute tolerance and grades it', () => {
    const b = map([
      leaf('numeric', { kind: 'accepted', values: [{ v: 12.5, tol: 0.1, tolKind: 'abs' }] }),
    ])
    expect(b.schemes['501.a']).toEqual({
      kind: 'accepted',
      marks: 2,
      values: [{ v: '12.5', tol: 0.1 }],
    })
    expect(grade(b, '501.a', 'numeric', { final: '12.55' }).awarded).toBe(2)
    expect(grade(b, '501.a', 'numeric', { final: '13' }).awarded).toBe(0)
  })

  it('converts a relative tolerance to an absolute one', () => {
    const b = map([
      leaf('numeric', { kind: 'accepted', values: [{ v: -200, tol: 0.05, tolKind: 'rel' }] }),
    ])
    expect(b.schemes['501.a']).toEqual({
      kind: 'accepted',
      marks: 2,
      values: [{ v: '-200', tol: 10 }],
    })
  })

  it('expands unit and unitAlt into several accepted values and keeps the first unit on the part', () => {
    const b = map([
      leaf('numeric', {
        kind: 'accepted',
        values: [{ v: 5, unit: 'm', unitAlt: ['meter', 'metre'] }],
      }),
    ])
    expect(b.schemes['501.a']).toEqual({
      kind: 'accepted',
      marks: 2,
      values: [
        { v: '5', unit: 'm' },
        { v: '5', unit: 'meter' },
        { v: '5', unit: 'metre' },
      ],
    })
    expect(b.question.parts?.[0]?.answer).toEqual({ kind: 'numeric', unit: 'm' })
    expect(grade(b, '501.a', 'numeric', { final: '5', unit: 'm' }).awarded).toBe(2)
    expect(grade(b, '501.a', 'numeric', { final: '5', unit: 'metre' }).awarded).toBe(2)
    expect(grade(b, '501.a', 'numeric', { final: '6', unit: 'm' }).awarded).toBe(0)
  })

  it('has no part unit when the key has none', () => {
    const b = map([leaf('numeric', { kind: 'accepted', values: [{ v: 3 }] })])
    expect(b.question.parts?.[0]?.answer).toEqual({ kind: 'numeric' })
    expect(b.schemes['501.a']).toEqual({ kind: 'accepted', marks: 2, values: [{ v: '3' }] })
  })
})

/* ------------------------------------------------------------------------------ match_letter */

describe('mapBe09Question: match_letter in a stimulus group', () => {
  const g = group({
    id: '9',
    stimuli: [
      stimulus({ id: '70', kind: 'diagram', label: 'Rajah 1', bodyMs: '<svg/>', alt: 'A diagram' }),
    ],
    optionBank: [
      { label: 'A', bodyMs: 'Alpha', bodyEn: null },
      { label: 'B', bodyMs: null, bodyEn: null },
    ],
  })
  const parts = [leaf('match_letter', { kind: 'mapping', map: { '1': 'B' } }, { stimulusId: '70' })]

  it('maps the group, option bank, stimulus and a mapping scheme keyed by the leaf id', () => {
    const b = map(parts, { groupId: '9', version: { stimulusIds: ['70'] } }, g)
    expect(b.question.groupId).toBe('qb-g9')
    expect(b.group).toEqual({
      id: 'qb-g9',
      stimulus: {
        id: 'qb-s70',
        kind: 'diagram',
        label: 'Rajah 1',
        alt: 'A diagram',
        text: '<svg/>',
      },
      optionBank: [
        { id: 'A', text: 'Alpha' },
        { id: 'B', text: 'B' },
      ],
    })
    expect(b.schemes['501.a']).toEqual({ kind: 'mapping', marks: 2, map: { '501.a': 'B' } })
  })

  it('defaults the stimulus alt to its label, omits text when the body is empty, omits an empty option bank', () => {
    const b = map(
      parts,
      { groupId: '9', version: { stimulusIds: ['70'] } },
      group({ stimuli: [stimulus({ bodyMs: null, alt: null })] }),
    )
    expect(b.group?.stimulus).toEqual({
      id: 'qb-s70',
      kind: 'passage',
      label: 'Petikan A',
      alt: 'Petikan A',
    })
    expect(b.group).not.toHaveProperty('optionBank')
  })

  it('grades with answer.choice', () => {
    const b = map(parts, { groupId: '9' }, g)
    expect(grade(b, '501.a', 'match_letter', { choice: 'B' }).awarded).toBe(2)
    expect(grade(b, '501.a', 'match_letter', { choice: 'A' }).awarded).toBe(0)
  })

  it('a question without a group carries no group fields', () => {
    const b = map([leaf('match_letter', { kind: 'mapping', map: { '1': 'B' } })])
    expect(b.group).toBeUndefined()
    expect(b.question.groupId).toBeUndefined()
  })
})

/* ------------------------------------------------------------------------------ working */

describe('mapBe09Question: working points', () => {
  const finalDef = { display: '5', accept: ['5'] }

  it('derives the match type of each point', () => {
    const b = map([
      leaf(
        'working',
        pointsKey(
          [
            point('p1', 'K', 1, { accept: ['2x=10'] }),
            point('p2', 'F', 1, { accept: ['fact', ' '] }),
            point('p3', 'M', 1, { accept: ['method'] }),
            point('p4', 'C', 1, { accept: ['content'] }),
            point('p5', 'P', 1, { allOf: ['a', 'b'] }),
            point('p6', 'N', 1),
            point('p7', 'B', 1),
            point('p8', 'P', 1),
            point('p9', 'K', 1, { accept: ['  '] }),
          ],
          { final: finalDef },
        ),
        { marks: 9 },
      ),
    ])
    const types = pointsScheme(b, '501.a').points.map((p) => p.match)
    expect(types).toEqual([
      { type: 'step', accept: ['2x=10'] },
      { type: 'keywords', anyOf: ['fact'] },
      { type: 'keywords', anyOf: ['method'] },
      { type: 'keywords', anyOf: ['content'] },
      { type: 'all_of', items: ['a', 'b'] },
      { type: 'final' },
      { type: 'manual' },
      { type: 'manual' },
      { type: 'manual' },
    ])
  })

  it('maps a mandatory-unit-only point to unit and defaults the final unit to it', () => {
    const b = map([
      leaf(
        'working',
        pointsKey([point('p1', 'P', 1, { unit: { value: 'cm', mandatory: true } })], {
          final: finalDef,
        }),
        { marks: 1 },
      ),
    ])
    const s = pointsScheme(b, '501.a')
    expect(s.points[0]?.match).toEqual({ type: 'unit' })
    expect(s.final).toEqual({ accept: ['5'], display: '5', unit: 'cm' })
  })

  it('without a final, an N point is manual', () => {
    const b = map([
      leaf('working', pointsKey([point('p1', 'N', 1), point('p2', 'B', 1)]), { marks: 2 }),
    ])
    expect(pointsScheme(b, '501.a').points.map((p) => p.match.type)).toEqual(['manual', 'manual'])
    expect(pointsScheme(b, '501.a').final).toBeUndefined()
  })

  it('moves an absolute point tolerance to the final, copies requires, groups and model', () => {
    const b = map([
      leaf(
        'working',
        pointsKey(
          [
            point('p1', 'K', 1, { accept: ['x'] }),
            point('p2', 'N', 1, { tolerance: { kind: 'abs', value: 0.2 }, requires: ['p1'] }),
          ],
          {
            final: finalDef,
            groups: [{ id: 'g1', anyN: 1, pointIds: ['p1', 'p2'] }],
            modelText: 'Model.',
          },
        ),
      ),
    ])
    const s = pointsScheme(b, '501.a')
    expect(s.final).toEqual({ accept: ['5'], display: '5', tolerance: 0.2 })
    expect(s.points[1]).toMatchObject({ id: 'p2', code: 'N', marks: 1, requires: ['p1'] })
    expect(s.points[0]).not.toHaveProperty('requires')
    expect(s.groups).toEqual([{ id: 'g1', anyN: 1, pointIds: ['p1', 'p2'] }])
    expect(s.model).toBe('Model.')
  })

  it('keeps explicit final fields (tolerance, unit, mustContain)', () => {
    const b = map([
      leaf(
        'working',
        pointsKey([point('p1', 'N', 1)], {
          final: { display: '5', accept: ['5'], tolerance: 0.5, unit: 'kg', mustContain: 'kg' },
        }),
        { marks: 1 },
      ),
    ])
    expect(pointsScheme(b, '501.a').final).toEqual({
      accept: ['5'],
      display: '5',
      tolerance: 0.5,
      unit: 'kg',
      mustContain: 'kg',
    })
  })

  it('maps an ECF point to final with fromPart set to the mapped leaf id (by label)', () => {
    const b = map([
      branch('1', [
        leaf('numeric', { kind: 'accepted', values: [{ v: 4 }] }, { label: '(a)' }),
        leaf(
          'working',
          pointsKey(
            [
              point('p1', 'N', 2, {
                ecf: { fromPart: '(a)', rule: { op: 'mul', k: 2 } },
                note: 'Carry forward',
              }),
            ],
            { final: { display: '8', accept: ['8'] } },
          ),
          { label: '(b)', marks: 2 },
        ),
      ]),
    ])
    const s = pointsScheme(b, '501.1.b')
    expect(s.points[0]).toMatchObject({
      match: { type: 'final' },
      ecf: { fromPart: '501.1.a', rule: { op: 'mul', k: 2 }, note: 'Carry forward' },
    })
    // own-figure carried forward: a (a) answer of 4 makes 8 the expected value of (b)
    const res = grade(b, '501.1.b', 'working', { final: '8' }, { '501.1.a': 4 })
    expect(res.awarded).toBe(2)
  })

  it('resolves an ECF reference by full label path too, and uses the default note', () => {
    const b = map([
      branch('(a)', [
        leaf('numeric', { kind: 'accepted', values: [{ v: 4 }] }, { label: '(i)' }),
        branch('(ii)', [
          leaf(
            'working',
            pointsKey(
              [point('p1', 'N', 1, { ecf: { fromPart: '(a).(i)', rule: { op: 'same' } } })],
              { final: { display: '4', accept: ['4'] } },
            ),
            {
              label: '(A)',
              marks: 1,
            },
          ),
        ]),
      ]),
    ])
    const s = pointsScheme(b, '501.a.ii.A')
    expect(s.points[0]?.ecf).toMatchObject({
      fromPart: '501.a.i',
      note: expect.stringContaining(''),
    })
    expect(s.points[0]?.ecf?.note.length).toBeGreaterThan(0)
  })

  it('an ECF point without a final is manual and has no ecf', () => {
    const b = map([
      branch('1', [
        leaf('numeric', { kind: 'accepted', values: [{ v: 4 }] }, { label: '(a)' }),
        leaf(
          'working',
          pointsKey([point('p1', 'N', 1, { ecf: { fromPart: '(a)', rule: { op: 'same' } } })]),
          { label: '(b)', marks: 1 },
        ),
      ]),
    ])
    const p = pointsScheme(b, '501.1.b').points[0]
    expect(p?.match).toEqual({ type: 'manual' })
    expect(p).not.toHaveProperty('ecf')
  })

  it('accepts alternative paths that cover the same points (any order, duplicates)', () => {
    const b = map([
      leaf(
        'working',
        pointsKey([point('p1', 'K', 1, { accept: ['x'] }), point('p2', 'N', 1)], {
          final: finalDef,
          paths: [
            { id: 'A', pointIds: ['p1', 'p2'] },
            { id: 'B', pointIds: ['p2', 'p1', 'p1'] },
          ],
        }),
      ),
    ])
    expect(pointsScheme(b, '501.a').points).toHaveLength(2)
  })

  it('grades a working answer against steps and final', () => {
    const b = map([
      leaf(
        'working',
        pointsKey([point('p1', 'K', 1, { accept: ['2x=10'] }), point('p2', 'N', 1)], {
          final: finalDef,
        }),
        { marks: 2 },
      ),
    ])
    expect(grade(b, '501.a', 'working', { steps: ['2x=10'], final: '5' }).awarded).toBe(2)
    expect(grade(b, '501.a', 'working', { steps: ['3x=10'], final: '7' }).awarded).toBe(0)
  })
})

/* ------------------------------------------------------------------------------ essay / drawing */

describe('mapBe09Question: essay and drawing', () => {
  it('maps an essay rubric: bands, joined descriptors, floor band, notes and word range', () => {
    const b = map([
      leaf(
        'essay',
        {
          kind: 'rubric',
          marks: 10,
          criteria: [
            { id: 'c1', name: 'Content' },
            { id: 'c2', name: 'Language' },
          ],
          bands: [
            {
              name: 'Band 1',
              range: [6, 10],
              descriptors: { Content: 'Strong', Language: 'Clear' },
            },
            { name: 'Band 2', range: [1, 5] },
          ],
          floorBand: { name: 'Band 0', range: [0, 0] },
          notes: ['Note one'],
        },
        { marks: 10, wordRange: { min: 80, max: 120 } },
      ),
    ])
    expect(b.schemes['501.a']).toEqual({
      kind: 'rubric',
      marks: 10,
      criteria: [
        { id: 'c1', name: 'Content' },
        { id: 'c2', name: 'Language' },
      ],
      bands: [
        { name: 'Band 1', range: [6, 10], descriptor: 'Content: Strong\nLanguage: Clear' },
        { name: 'Band 2', range: [1, 5], descriptor: '' },
        { name: 'Band 0', range: [0, 0], descriptor: '' },
      ],
      notes: ['Note one'],
    })
    expect(b.question.parts?.[0]?.answer).toEqual({
      kind: 'essay',
      wordRange: { min: 80, max: 120 },
    })
  })

  it('maps an essay with points and groups (anyN) to a points scheme', () => {
    const b = map([
      leaf(
        'essay',
        pointsKey(
          [
            point('p1', 'F', 1, { accept: ['a'] }),
            point('p2', 'F', 1, { accept: ['b'] }),
            point('p3', 'F', 1, { accept: ['c'] }),
          ],
          { groups: [{ id: 'g1', anyN: 2, eachMarks: 1, pointIds: ['p1', 'p2', 'p3'] }] },
        ),
        { marks: 3 },
      ),
    ])
    const s = pointsScheme(b, '501.a')
    expect(s.groups).toEqual([{ id: 'g1', anyN: 2, pointIds: ['p1', 'p2', 'p3'] }])
    expect(s.points.map((p) => p.match.type)).toEqual(['keywords', 'keywords', 'keywords'])
    expect(b.question.parts?.[0]?.answer).toEqual({ kind: 'essay' })
  })

  it('maps a drawing with points to manual checks', () => {
    const b = map([
      leaf('drawing', pointsKey([point('p1', 'B', 1), point('p2', 'B', 1)]), { marks: 2 }),
    ])
    expect(b.question.parts?.[0]?.answer).toEqual({ kind: 'drawing' })
    expect(pointsScheme(b, '501.a').points.map((p) => p.match)).toEqual([
      { type: 'manual' },
      { type: 'manual' },
    ])
  })
})

/* ------------------------------------------------------------------------------ nested parts */

describe('mapBe09Question: nested parts', () => {
  const nested = [
    branch('(a)', [
      leaf('short_text', { kind: 'accepted', values: ['x'] }, { label: '(i)', marks: 1 }),
      branch('(ii)', [
        leaf('short_text', { kind: 'accepted', values: ['y'] }, { label: '(A)', marks: 2 }),
      ]),
    ]),
    leaf('numeric', { kind: 'accepted', values: [{ v: 1 }] }, { label: '(b)', marks: 3 }),
  ]

  it('builds ids from the stripped label path; branches carry no marks and no scheme', () => {
    const b = map(nested)
    const root = b.question.parts?.[0]
    expect(root).toMatchObject({ id: '501.a', label: '(a)', marks: 0 })
    expect(Object.keys(b.schemes).sort()).toEqual(['501.a.i', '501.a.ii.A', '501.b'])
    const ids = leavesOf(b.question.parts ?? []).map((l) => l.id)
    expect(ids).toEqual(['501.a.i', '501.a.ii.A', '501.b'])
  })

  it('a (a)(i)(A) tree gives 501.a.i.A', () => {
    const b = map([
      branch('(a)', [
        branch('(i)', [
          leaf('short_text', { kind: 'accepted', values: ['x'] }, { label: '(A)', marks: 1 }),
        ]),
      ]),
    ])
    expect(Object.keys(b.schemes)).toEqual(['501.a.i.A'])
  })

  it('sums marks over leaves only (marking.ts) and infoOf agrees', () => {
    const b = map(nested, { groupId: '9' }, group())
    expect(questionMarks(b)).toBe(6)
    expect(leavesOfBundle(b).map((l) => l.marks)).toEqual([1, 2, 3])
    expect(infoOf(b, '9')).toEqual({ id: '501', marks: 6, groupId: '9', versionNo: 3 })
  })

  it('falls back to the position when a label strips to nothing', () => {
    const b = map([leaf('short_text', { kind: 'accepted', values: ['x'] }, { label: '' })])
    expect(Object.keys(b.schemes)).toEqual(['501.p1'])
  })

  it('infoOf of an mcq carries the scheme marks; groupId may be null', () => {
    const b = map([mcqPart({ marks: 4 })])
    expect(infoOf(b, null)).toEqual({ id: '501', marks: 4, groupId: null, versionNo: 3 })
  })
})

/* ------------------------------------------------------------------------------ refusals */

describe('mapBe09Question: refusals', () => {
  const finalDef = { display: '5', accept: ['5'] }
  const expectRefusal = (
    e: UnsupportedQuestionError,
    questionId: string,
    path: string,
    reason: RegExp,
  ) => {
    expect(e.name).toBe('UnsupportedQuestionError')
    expect(e.questionId).toBe(questionId)
    expect(e.path).toBe(path)
    expect(e.reason).toMatch(reason)
    expect(e.message).toContain(questionId)
  }

  it('a question without parts', () => {
    expectRefusal(refusal([]), '501', '', /no parts/)
  })

  it('table_fill', () => {
    const e = refusal([leaf('table_fill', { kind: 'mapping', cells: { r1c1: ['x'] } })])
    expectRefusal(e, '501', '(a)', /table_fill/)
  })

  it('an mcq nested in a structured question, with the full label path', () => {
    const e = refusal([branch('1', [mcqPart({ label: '(a)' })])])
    expectRefusal(e, '501', '1.(a)', /MCQ/)
  })

  it('an mcq next to another part is not the only part', () => {
    const e = refusal([
      mcqPart({ label: '(a)' }),
      leaf('short_text', { kind: 'accepted', values: ['x'] }, { label: '(b)' }),
    ])
    expectRefusal(e, '501', '(a)', /MCQ/)
  })

  it('an mcq option with an image', () => {
    const p = mcqPart({
      options: [
        { label: 'A', body: rt('One'), imageId: '55' },
        { label: 'B', body: rt('Two') },
        { label: 'C', body: rt('Three') },
      ],
    })
    expectRefusal(refusal([p]), '501', '', /image/)
  })

  it('short_text anyOrder', () => {
    const e = refusal([
      leaf('short_text', { kind: 'accepted', values: ['a', 'b'], anyOrder: true }),
    ])
    expectRefusal(e, '501', '(a)', /anyOrder/)
  })

  it('short_text with more than one blank', () => {
    const e = refusal([leaf('short_text', { kind: 'accepted', values: ['a'] }, { blankCount: 2 })])
    expectRefusal(e, '501', '(a)', /blank/)
    expect(() =>
      map([leaf('short_text', { kind: 'accepted', values: ['a'] }, { blankCount: 1 })]),
    ).not.toThrow()
  })

  it('numeric sigFigs (and decimals)', () => {
    expectRefusal(
      refusal([leaf('numeric', { kind: 'accepted', values: [{ v: 1.2, sigFigs: 2 }] })]),
      '501',
      '(a)',
      /significant/,
    )
    expectRefusal(
      refusal([leaf('numeric', { kind: 'accepted', values: [{ v: 1.2, decimals: 1 }] })]),
      '501',
      '(a)',
      /decimal/,
    )
    expect(() =>
      map([
        leaf('numeric', { kind: 'accepted', values: [{ v: 1.2, sigFigs: null, decimals: null }] }),
      ]),
    ).not.toThrow()
  })

  it('match_letter with 2 items', () => {
    const e = refusal([leaf('match_letter', { kind: 'mapping', map: { '1': 'A', '2': 'B' } })])
    expectRefusal(e, '501', '(a)', /2 items/)
  })

  it('alternative paths that differ', () => {
    const e = refusal([
      leaf(
        'working',
        pointsKey([point('p1', 'K', 1, { accept: ['x'] }), point('p2', 'N', 1)], {
          final: finalDef,
          paths: [
            { id: 'A', pointIds: ['p1', 'p2'] },
            { id: 'B', pointIds: ['p1'] },
          ],
        }),
      ),
    ])
    expectRefusal(e, '501', '(a)', /alternative/i)
  })

  it('deductions', () => {
    const e = refusal([
      leaf(
        'working',
        pointsKey([point('p1', 'K', 1)], { deductions: [{ code: 'unit', amount: 1 }] }),
      ),
    ])
    expectRefusal(e, '501', '(a)', /deduction/)
    expect(() =>
      map([leaf('working', pointsKey([point('p1', 'K', 1)], { deductions: [] }))]),
    ).not.toThrow()
  })

  it('point sigFigs', () => {
    const e = refusal([
      leaf('working', pointsKey([point('p1', 'N', 1, { sigFigs: 3 })], { final: finalDef })),
    ])
    expectRefusal(e, '501', '(a)', /significant/)
  })

  it('eachMarks that differs from the marks of its points', () => {
    const e = refusal([
      leaf(
        'essay',
        pointsKey([point('p1', 'F', 1), point('p2', 'F', 2)], {
          groups: [{ id: 'g1', anyN: 1, eachMarks: 1, pointIds: ['p1', 'p2'] }],
        }),
      ),
    ])
    expectRefusal(e, '501', '(a)', /eachMarks/)
  })

  it('ECF to an unknown part', () => {
    const e = refusal([
      leaf(
        'working',
        pointsKey([point('p1', 'N', 1, { ecf: { fromPart: '(z)', rule: { op: 'same' } } })], {
          final: finalDef,
        }),
      ),
    ])
    expectRefusal(e, '501', '(a)', /ECF/)
  })

  it('ECF to a label that names two leaves', () => {
    const e = refusal([
      branch('1', [
        leaf('numeric', { kind: 'accepted', values: [{ v: 1 }] }, { label: '(a)' }),
        leaf(
          'working',
          pointsKey([point('p1', 'N', 1, { ecf: { fromPart: '(a)', rule: { op: 'same' } } })], {
            final: finalDef,
          }),
          { label: '(b)' },
        ),
      ]),
      branch('2', [leaf('numeric', { kind: 'accepted', values: [{ v: 1 }] }, { label: '(a)' })]),
    ])
    expectRefusal(e, '501', '1.(b)', /ECF/)
  })

  it("reveal 'never'", () => {
    expectRefusal(
      refusal([leaf('short_text', { kind: 'accepted', values: ['x'] }, { reveal: 'never' })]),
      '501',
      '(a)',
      /reveal 'never'/,
    )
    expectRefusal(refusal([mcqPart({ reveal: 'never' })]), '501', '', /reveal 'never'/)
    expect(() =>
      map([leaf('short_text', { kind: 'accepted', values: ['x'] }, { reveal: 'after_submit' })]),
    ).not.toThrow()
  })

  it('a group with 2 stimuli', () => {
    const g = group({ stimuli: [stimulus({ id: '70' }), stimulus({ id: '71' })] })
    expectRefusal(refusal([mcqPart()], { groupId: '9' }, g), '501', '', /2 stimuli/)
  })

  it('an image stimulus (assetFileId)', () => {
    const g = group({ stimuli: [stimulus({ assetFileId: '88' })] })
    expectRefusal(refusal([mcqPart()], { groupId: '9' }, g), '501', '', /image stimulus/)
  })

  it('a version stimulus outside the group', () => {
    expectRefusal(
      refusal([mcqPart()], { groupId: '9', version: { stimulusIds: ['99'] } }, group()),
      '501',
      '',
      /outside the question group/,
    )
    expectRefusal(
      refusal([mcqPart()], { version: { stimulusIds: ['70'] } }, null),
      '501',
      '',
      /outside the question group/,
    )
  })

  it('a leaf stimulus outside the group', () => {
    const e = refusal(
      [leaf('short_text', { kind: 'accepted', values: ['x'] }, { stimulusId: '99' })],
      { groupId: '9' },
      group(),
    )
    expectRefusal(e, '501', '(a)', /stimulus outside/)
    expectRefusal(
      refusal([mcqPart({ stimulusId: '99' })], { groupId: '9' }, group()),
      '501',
      '',
      /stimulus outside/,
    )
    expect(() =>
      map(
        [leaf('short_text', { kind: 'accepted', values: ['x'] }, { stimulusId: '70' })],
        { groupId: '9' },
        group(),
      ),
    ).not.toThrow()
  })

  it('duplicate sibling label ids', () => {
    const e = refusal([
      branch('1', [
        leaf('short_text', { kind: 'accepted', values: ['x'] }, { label: '(a)' }),
        leaf('short_text', { kind: 'accepted', values: ['y'] }, { label: 'a' }),
      ]),
    ])
    expectRefusal(e, '501', '1.a', /share the id "a"/)
  })

  it('reports the question id of the record', () => {
    const e = refusal([leaf('table_fill', { kind: 'mapping', cells: { r: ['x'] } })], { id: '777' })
    expect(e.questionId).toBe('777')
  })
})

/* ------------------------------------------------------------------------------ points rules (review fixes) */

describe('mapBe09Question: unit, tolerance and id rules of points', () => {
  const finalDef = { display: '12', accept: ['12'] }
  const unitCm = { value: 'cm', mandatory: true }
  const refused = (parts: unknown[], reason: RegExp, path = '(a)') => {
    const e = refusal(parts)
    expect(e.questionId).toBe('501')
    expect(e.path).toBe(path)
    expect(e.reason).toMatch(reason)
  }
  const working = (points: unknown[], extra: Record<string, unknown> = {}, marks = 2) =>
    leaf('working', pointsKey(points, { final: finalDef, ...extra }), { marks })

  it('a B point without a criterion is manual even when the key has a final', () => {
    const b = map([working([point('p1', 'B', 1)], {}, 1)])
    expect(pointsScheme(b, '501.a').points[0]?.match).toEqual({ type: 'manual' })
  })

  it('a unit-only point is refused when the key has no final', () => {
    refused(
      [leaf('working', pointsKey([point('p1', 'P', 1, { unit: unitCm })]), { marks: 1 })],
      /needs the key's final/,
    )
  })

  it('a unit-only point is refused when final.unit differs, or the unit has alternatives', () => {
    refused(
      [working([point('p1', 'P', 1, { unit: unitCm })], { final: { ...finalDef, unit: 'm' } }, 1)],
      /unit differs/,
    )
    refused(
      [working([point('p1', 'P', 1, { unit: { ...unitCm, alt: ['centimetre'] } })], {}, 1)],
      /alternative units/,
    )
  })

  it('a unit-only point agrees with an equal final.unit', () => {
    const b = map([
      working([point('p1', 'P', 1, { unit: unitCm })], { final: { ...finalDef, unit: 'cm' } }, 1),
    ])
    expect(pointsScheme(b, '501.a').final?.unit).toBe('cm')
  })

  it('a non-mandatory unit is ignored', () => {
    const b = map([
      working([point('p1', 'P', 1, { unit: { value: 'cm', mandatory: false } })], {}, 1),
    ])
    expect(pointsScheme(b, '501.a').points[0]?.match).toEqual({ type: 'manual' })
  })

  it('a mandatory unit on a step, keywords, all_of or ecf point is refused', () => {
    refused(
      [working([point('p1', 'K', 1, { accept: ['x'], unit: unitCm })], {}, 1)],
      /mandatory unit/,
    )
    refused(
      [working([point('p1', 'F', 1, { accept: ['x'], unit: unitCm })], {}, 1)],
      /mandatory unit/,
    )
    refused(
      [working([point('p1', 'P', 1, { allOf: ['x'], unit: unitCm })], {}, 1)],
      /mandatory unit/,
    )
    refused(
      [
        branch('1', [
          leaf('numeric', { kind: 'accepted', values: [{ v: 1 }] }, { label: '(a)' }),
          leaf(
            'working',
            pointsKey(
              [
                point('p1', 'N', 1, {
                  ecf: { fromPart: '(a)', rule: { op: 'same' } },
                  unit: unitCm,
                }),
              ],
              { final: finalDef },
            ),
            { label: '(b)', marks: 1 },
          ),
        ]),
      ],
      /mandatory unit/,
      '1.(b)',
    )
  })

  it('an absolute point tolerance sets the final tolerance; a relative one is scaled by |final|', () => {
    const abs = map([
      working([point('p1', 'N', 1, { tolerance: { kind: 'abs', value: 0.3 } })], {}, 1),
    ])
    expect(pointsScheme(abs, '501.a').final?.tolerance).toBe(0.3)
    const rel = map([
      working([point('p1', 'N', 1, { tolerance: { kind: 'rel', value: 0.1 } })], {}, 1),
    ])
    expect(pointsScheme(rel, '501.a').final?.tolerance).toBeCloseTo(1.2)
    const neg = map([
      working(
        [point('p1', 'N', 1, { tolerance: { kind: 'rel', value: 0.5 } })],
        {
          final: { display: '-4', accept: ['-4'] },
        },
        1,
      ),
    ])
    expect(pointsScheme(neg, '501.a').final?.tolerance).toBe(2)
  })

  it('a key-level final tolerance wins over a point tolerance', () => {
    const b = map([
      working(
        [point('p1', 'N', 1, { tolerance: { kind: 'abs', value: 9 } })],
        {
          final: { ...finalDef, tolerance: 0.5 },
        },
        1,
      ),
    ])
    expect(pointsScheme(b, '501.a').final?.tolerance).toBe(0.5)
  })

  it('a relative tolerance with a non-numeric final is refused', () => {
    refused(
      [
        working(
          [point('p1', 'N', 1, { tolerance: { kind: 'rel', value: 0.1 } })],
          {
            final: { display: 'x', accept: ['x+1'] },
          },
          1,
        ),
      ],
      /numeric final/,
    )
  })

  it('a tolerance on a non-final point is refused', () => {
    refused(
      [
        working(
          [point('p1', 'K', 1, { accept: ['x'], tolerance: { kind: 'abs', value: 1 } })],
          {},
          1,
        ),
      ],
      /tolerance on a non-final/,
    )
    refused(
      [
        leaf(
          'drawing',
          pointsKey([point('p1', 'B', 1, { tolerance: { kind: 'abs', value: 1 } })]),
          {
            marks: 1,
          },
        ),
      ],
      /tolerance on a non-final/,
    )
  })

  it('a point id longer than 64 characters is refused (64 is fine)', () => {
    refused([working([point('p'.repeat(65), 'N', 1)], {}, 1)], /longer than 64/)
    expect(() => map([working([point('p'.repeat(64), 'N', 1)], {}, 1)])).not.toThrow()
  })

  it('a numeric value in exponent form is refused', () => {
    refused([leaf('numeric', { kind: 'accepted', values: [{ v: 1e21 }] })], /exponent form/)
    refused([leaf('numeric', { kind: 'accepted', values: [{ v: 1e-7 }] })], /exponent form/)
    expect(() =>
      map([leaf('numeric', { kind: 'accepted', values: [{ v: 0.000001 }] })]),
    ).not.toThrow()
  })

  it('grades N (final) plus a mandatory-unit point: "12" without a unit earns only the N mark', () => {
    const b = map([working([point('p1', 'N', 1), point('p2', 'P', 1, { unit: unitCm })], {}, 2)])
    const s = pointsScheme(b, '501.a')
    expect(s.points.map((p) => p.match.type)).toEqual(['final', 'unit'])
    expect(s.final?.unit).toBe('cm')
    expect(grade(b, '501.a', 'working', { final: '12' }).awarded).toBe(1)
    expect(grade(b, '501.a', 'working', { final: '12', unit: 'cm' }).awarded).toBe(2)
  })
})
