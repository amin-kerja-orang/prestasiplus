/**
 * R1-B08: the Bijak bridge serves the question shapes V2 production uses (ADR-0030, D90).
 * Every stimulus kind, option images, stem pictures, groups of 1 to 3 stimuli with several member questions,
 * `essay_choice`, and the BM reason of every refusal. Pure: no database.
 */
import { BijakAttemptGroupSchema, BijakAttemptQuestionSchema, QuestionPartSchema } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { buildServedPaper } from '../../src/modules/bijak/attempts/marking'
import type { BijakQuestionBundle } from '../../src/modules/bijak/attempts/ports'
import {
  type BridgeMedia,
  type OutsideStimulus,
  type CurriculumLabels,
  infoOf,
  mapBe09Question,
  UnsupportedQuestionError,
} from '../../src/modules/bijak/question-bridge/be09-mapping'
import {
  BRIDGE_REFUSAL_REASONS_MS,
  refusalLineMs,
} from '../../src/modules/bijak/question-bridge/refusals'
import type {
  QuestionRecord,
  StimulusGroupRecord,
  StimulusRecord,
} from '../../src/modules/questions/types'

/* ------------------------------------------------------------------------------ builders */

const LABELS: CurriculumLabels = { subjectCode: 'SEJ', unitLabel: 'Bab 1', unitCode: '1' }
const rt = (ms: string) => ({ ms })

function record(
  parts: unknown[],
  over: { id?: string; groupId?: string | null; stimulusIds?: string[]; raw?: boolean } = {},
): QuestionRecord {
  const now = new Date('2026-01-01T00:00:00Z')
  return {
    id: over.id ?? '501',
    isActive: true,
    sourceType: 'manual',
    createdById: null,
    latestVersionNo: 2,
    liveVersionNo: 2,
    groupId: over.groupId ?? null,
    groupPosition: null,
    spmPool: true,
    createdAt: now,
    updatedAt: now,
    version: {
      id: 'v1',
      versionNo: 2,
      status: 'approved',
      archiveReason: null,
      publishedAt: now,
      type: 'structured',
      stemMs: 'Stem',
      stemEn: null,
      numberLabel: null,
      language: 'ms',
      explanationMs: 'Kerana.',
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
      spIds: [],
      stimulusIds: over.stimulusIds ?? [],
      parts: over.raw ? (parts as never) : parts.map((p) => QuestionPartSchema.parse(p)),
      createdAt: now,
      updatedAt: now,
    },
  } as unknown as QuestionRecord
}

type Wide = Omit<StimulusRecord, 'kind'> & {
  kind: string
  caption?: string | null
  tableData?: unknown
  sourceCitation?: string | null
}
const stim = (over: Partial<Wide> = {}): StimulusRecord =>
  ({
    id: '70',
    kind: 'passage',
    label: 'Petikan A',
    bodyMs: 'Isi petikan',
    bodyEn: null,
    assetFileId: null,
    alt: null,
    ...over,
  }) as unknown as StimulusRecord

const group = (stimuli: StimulusRecord[], ids = ['501']): StimulusGroupRecord => ({
  id: '9',
  stimuli,
  optionBank: [],
  questionIds: ids,
})

const media = (files: Record<string, string> = {}, outside: BridgeMedia['outside'] = new Map()): BridgeMedia => ({
  tokens: new Map(Object.entries(files)),
  outside,
})

const mcq = (extra: Record<string, unknown> = {}, optionExtra: Record<string, unknown>[] = []) => ({
  label: '',
  marks: 2,
  mode: 'mcq',
  key: { kind: 'option', correct: 'B' },
  prompt: rt('Pilih satu.'),
  options: [
    { label: 'A', body: rt('Satu'), ...(optionExtra[0] ?? {}) },
    { label: 'B', body: rt('Dua'), ...(optionExtra[1] ?? {}) },
    { label: 'C', body: rt('Tiga') },
  ],
  ...extra,
})

const shortText = (extra: Record<string, unknown> = {}) => ({
  label: '(a)',
  marks: 2,
  mode: 'short_text',
  key: { kind: 'accepted', values: ['x'] },
  prompt: rt('Jawab.'),
  ...extra,
})

const map = (
  parts: unknown[],
  over: Parameters<typeof record>[1] = {},
  g: StimulusGroupRecord | null = null,
  m: BridgeMedia = media(),
) => mapBe09Question(record(parts, over), g, LABELS, m)

function refusal(fn: () => unknown): UnsupportedQuestionError {
  try {
    fn()
  } catch (e) {
    expect(e).toBeInstanceOf(UnsupportedQuestionError)
    return e as UnsupportedQuestionError
  }
  throw new Error('expected a refusal')
}

/* ------------------------------------------------------------------------------ the seven kinds */

describe('stimulus kinds: image, diagram, map, infographic, graph carry a file token URL', () => {
  for (const kind of ['image', 'diagram', 'map', 'infographic', 'graph']) {
    it(`${kind} with a stored file -> image.url /api/files/<token>, label, caption and alt`, () => {
      const g = group([
        stim({
          kind,
          id: '71',
          label: 'Rajah 1',
          bodyMs: null,
          assetFileId: '88',
          alt: 'Peta Tanah Melayu',
          caption: 'Sumber: Arkib',
        }),
      ])
      const b = map([mcq()], { groupId: '9' }, g, media({ '88': 'tok88' }))
      expect(b.group?.stimulus).toEqual({
        id: 'qb-s71',
        kind,
        label: 'Rajah 1',
        alt: 'Peta Tanah Melayu',
        caption: 'Sumber: Arkib',
        image: { url: '/api/files/tok88' },
      })
    })
  }

  it('passage -> text with the source line; no image', () => {
    const g = group([stim({ sourceCitation: 'Buku Teks' })])
    const s = map([mcq()], { groupId: '9' }, g).group?.stimulus
    expect(s).toMatchObject({ kind: 'passage', text: 'Isi petikan', source: 'Buku Teks' })
    expect(s).not.toHaveProperty('image')
  })

  it('table -> a real table from tableData ({head, rows}, {headers, rows}, rows of rows)', () => {
    const want = { head: ['Tahun', 'Peristiwa'], rows: [['1957', 'Merdeka']] }
    for (const tableData of [
      want,
      { headers: want.head, rows: want.rows },
      [want.head, ...want.rows],
    ]) {
      const g = group([stim({ kind: 'table', bodyMs: null, tableData })])
      expect(map([mcq()], { groupId: '9' }, g).group?.stimulus.table).toEqual(want)
    }
  })

  it('table -> a pipe table written in the body becomes a table (the raw pipes are not shown as text)', () => {
    const g = group([stim({ kind: 'table', bodyMs: 'Tahun | Peristiwa\n--- | ---\n1957 | Merdeka' })])
    const s = map([mcq()], { groupId: '9' }, g).group?.stimulus
    expect(s?.table).toEqual({ head: ['Tahun', 'Peristiwa'], rows: [['1957', 'Merdeka']] })
    expect(s).not.toHaveProperty('text')
  })

  it('table without a grid keeps its body as text; an image-only table is a picture', () => {
    const plain = group([stim({ kind: 'table', bodyMs: 'Jadual berikut' })])
    expect(map([mcq()], { groupId: '9' }, plain).group?.stimulus).toMatchObject({
      kind: 'table',
      text: 'Jadual berikut',
    })
    const pic = group([stim({ kind: 'table', bodyMs: null, assetFileId: '5' })])
    expect(map([mcq()], { groupId: '9' }, pic, media({ '5': 't5' })).group?.stimulus).toMatchObject({
      kind: 'table',
      image: { url: '/api/files/t5' },
    })
  })
})

describe('stimulus refusals', () => {
  it('a stimulus with nothing to show (no text, table or picture)', () => {
    const e = refusal(() => map([mcq()], { groupId: '9' }, group([stim({ bodyMs: null })])))
    expect(e.code).toBe('stimulus_empty')
  })

  it('a kind outside the seven (audio, video ...)', () => {
    const e = refusal(() =>
      map([mcq()], { groupId: '9' }, group([stim({ kind: 'audio', assetFileId: '3' })]), media({ '3': 't' })),
    )
    expect(e.code).toBe('stimulus_kind_unsupported')
  })

  it('a stimulus file that has no token', () => {
    const e = refusal(() =>
      map([mcq()], { groupId: '9' }, group([stim({ kind: 'image', bodyMs: null, assetFileId: '88' })])),
    )
    expect(e.code).toBe('file_missing')
  })

  it('a group with no stimulus left to show', () => {
    expect(refusal(() => map([mcq()], { groupId: '9' }, group([]))).code).toBe('group_no_stimulus')
  })
})

/* ------------------------------------------------------------------------------ option and stem images */

describe('option images and the stem picture', () => {
  it('maps option images to option.image with a token URL and the option text as alt', () => {
    const b = map([mcq({}, [{ imageId: '55' }, { imageId: '56' }])], {}, null, media({ '55': 'tA', '56': 'tB' }))
    expect(b.question.mcq?.options).toEqual([
      { id: 'A', text: 'Satu', image: { url: '/api/files/tA', alt: 'Satu' } },
      { id: 'B', text: 'Dua', image: { url: '/api/files/tB', alt: 'Dua' } },
      { id: 'C', text: 'Tiga' },
    ])
  })

  it('an option image whose file is gone is refused with file_missing', () => {
    const e = refusal(() => map([mcq({}, [{ imageId: '55' }])]))
    expect(e.code).toBe('file_missing')
    expect(e.path).toBe('')
  })

  it('an image stimulus linked to the version but not to a group is the question stemImage', () => {
    const m = media({ '90': 'tS' }, new Map<string, OutsideStimulus>([['300', { kind: 'image', assetFileId: '90' }]]))
    const b = map([mcq()], { stimulusIds: ['300'] }, null, m)
    expect(b.question.stemImage).toMatchObject({
      id: 'qb-s300',
      kind: 'image',
      image: { url: '/api/files/tS' },
    })
    expect(b.question.stimuli).toEqual([b.question.stemImage])
    expect(b.group).toBeUndefined()
  })

  it('a stem image that is also a stimulus of the group is the group one, not a second picture', () => {
    const g = group([stim({ id: '300', kind: 'image', bodyMs: null, assetFileId: '90' })])
    const b = map([mcq()], { groupId: '9', stimulusIds: ['300'] }, g, media({ '90': 'tS' }))
    expect(b.question).not.toHaveProperty('stemImage')
    expect(b.group?.stimuli).toHaveLength(1)
  })

  it('R1E2E-05b: own stimuli of any kind are served in link order, each with its caption, source, table and picture', () => {
    const grid = { head: ['Bulan', 'Jumlah'], rows: [['Jan', '10']] }
    const m = media(
      { '90': 'tA', '91': 'tB' },
      new Map<string, OutsideStimulus>([
        ['301', { kind: 'passage', assetFileId: null, label: 'Petikan', bodyMs: 'Isi petikan', caption: 'Cap', sourceCitation: 'Sumber A' }],
        ['302', { kind: 'table', assetFileId: null, label: 'Jadual 1', tableData: grid }],
        ['303', { kind: 'map', assetFileId: '90', label: 'Peta 1', alt: 'Peta Malaysia' }],
        ['304', { kind: 'graph', assetFileId: '91' }],
      ]),
    )
    const b = map([mcq()], { stimulusIds: ['303', '301', '302', '304'] }, null, m)
    const own = b.question.stimuli ?? []
    expect(own.map((x) => x.id)).toEqual(['qb-s303', 'qb-s301', 'qb-s302', 'qb-s304'])
    expect(own[0]).toMatchObject({ kind: 'map', label: 'Peta 1', alt: 'Peta Malaysia', image: { url: '/api/files/tA' } })
    expect(own[1]).toMatchObject({ kind: 'passage', text: 'Isi petikan', caption: 'Cap', source: 'Sumber A' })
    expect(own[2]).toMatchObject({ kind: 'table', table: grid })
    expect(own[3]).toMatchObject({ kind: 'graph', alt: 'Gambar untuk soalan ini', image: { url: '/api/files/tB' } })
    // Several own stimuli: no single-picture slot.
    expect(b.question).not.toHaveProperty('stemImage')
    expect(b.group).toBeUndefined()
  })

  it('the served question carries its own stimuli (and no group) on the wire', () => {
    const m = media({ '90': 'tA' }, new Map<string, OutsideStimulus>([
      ['301', { kind: 'passage', assetFileId: null, label: 'Petikan', bodyMs: 'Isi petikan' }],
      ['303', { kind: 'diagram', assetFileId: '90', label: 'Rajah 1' }],
    ]))
    const bundle = map([mcq()], { stimulusIds: ['301', '303'] }, null, m)
    const served = buildServedPaper(
      [{ id: 's', label: 'A', rule: { type: 'all' }, questionIds: ['501'] }],
      new Map([['501', bundle]]),
    )
    const q = BijakAttemptQuestionSchema.parse(served.questions[0])
    expect(q.stimuli?.map((x) => [x.kind, x.label])).toEqual([['passage', 'Petikan'], ['diagram', 'Rajah 1']])
    expect(q.stimuli?.[1]?.image?.url).toBe('/api/files/tA')
    expect(served.groups).toEqual([])
  })

  it('a table written as a pipe table in the body of an own stimulus is read by the shared helper', () => {
    const m = media({}, new Map<string, OutsideStimulus>([['310', { kind: 'table', assetFileId: null, bodyMs: 'A | B\n--- | ---\n1 | 2' }]]))
    const own = map([mcq()], { stimulusIds: ['310'] }, null, m).question.stimuli ?? []
    expect(own[0]?.table).toEqual({ head: ['A', 'B'], rows: [['1', '2']] })
  })

  it('an own stimulus that is shared by several questions but is not a group is refused (D90)', () => {
    const m = media({}, new Map<string, OutsideStimulus>([['320', { kind: 'passage', assetFileId: null, bodyMs: 'Petikan', sharedBy: 2 }]]))
    const e = refusal(() => map([mcq()], { stimulusIds: ['320'] }, null, m))
    expect(e.code).toBe('stimulus_shared_ungrouped')
  })

  it('an unknown or audio outside stimulus, and an own stimulus with nothing to show, are refused', () => {
    expect(refusal(() => map([mcq()], { stimulusIds: ['999'] }, null, media())).code).toBe('stimulus_outside_group')
    const empty = media({}, new Map<string, OutsideStimulus>([['330', { kind: 'passage', assetFileId: null }]]))
    expect(refusal(() => map([mcq()], { stimulusIds: ['330'] }, null, empty)).code).toBe('stimulus_empty')
    const gone = media({}, new Map<string, OutsideStimulus>([['331', { kind: 'image', assetFileId: '77' }]]))
    expect(refusal(() => map([mcq()], { stimulusIds: ['331'] }, null, gone)).code).toBe('file_missing')
  })
})

/* ------------------------------------------------------------------------------ D90: groups */

describe('D90: a stimulus group is ONE stimulus shown once, with its member questions under it', () => {
  const img = stim({ id: '71', kind: 'image', label: 'Rajah 1', bodyMs: null, assetFileId: '88', alt: 'Rajah satu' })
  const g = group([img], ['501', '502'])
  const m = media({ '88': 'tok88' })
  const q1 = () => map([mcq({ marks: 2 })], { id: '501', groupId: '9' }, g, m)
  const q2 = () => map([mcq({ marks: 3 })], { id: '502', groupId: '9' }, g, m)
  const bundles = (...bs: ReturnType<typeof q1>[]) =>
    new Map<string, BijakQuestionBundle>(bs.map((b) => [b.question.id, b]))
  const composition = (ids: string[]) => [
    { id: 's1', label: 'Bahagian A', rule: { type: 'all' as const }, questionIds: ids },
  ]

  it('both members reference the same group and the same stimulus id', () => {
    const [a, b] = [q1(), q2()]
    expect(a.question.groupId).toBe('qb-g9')
    expect(b.question.groupId).toBe('qb-g9')
    expect(a.group?.stimulus.id).toBe('qb-s71')
    expect(b.group?.stimulus.id).toBe('qb-s71')
    expect(a.group?.stimuli?.map((s) => s.id)).toEqual(['qb-s71'])
    expect(b.group).toEqual(a.group)
  })

  it('the served paper holds ONE group with the image once and the two questions under it, in order', () => {
    const served = buildServedPaper(composition(['501', '502']), bundles(q1(), q2()))
    expect(served.groups).toHaveLength(1)
    const grp = BijakAttemptGroupSchema.parse(served.groups[0])
    expect(grp.stimuli).toHaveLength(1)
    expect(grp.stimulus.image?.url).toBe('/api/files/tok88')
    expect(grp.questionIds).toEqual(['501', '502'])
    expect([grp.from, grp.to]).toEqual([1, 2])
    expect(served.questions.map((q) => q.groupId)).toEqual(['qb-g9', 'qb-g9'])
    // The image is not an item: exactly the two questions, none of them is the stimulus.
    expect(served.questions.map((q) => q.id)).toEqual(['501', '502'])
    expect(JSON.stringify(served.questions)).not.toContain('qb-s71')
  })

  it('the image is not counted as a question and carries no marks; marks are on the members only', () => {
    const [a, b] = [q1(), q2()]
    expect(infoOf(a, 'qb-g9').marks).toBe(2)
    expect(infoOf(b, 'qb-g9').marks).toBe(3)
    expect(a.schemes['501']?.marks).toBe(2)
    expect(Object.keys(a.schemes)).toEqual(['501'])
    expect(a.group?.stimulus).not.toHaveProperty('marks')
    const served = buildServedPaper(composition(['501', '502']), bundles(a, b))
    expect(served.sections[0]).toMatchObject({ marks: 5, effectiveMarks: 5 })
    expect(served.questions).toHaveLength(2)
    expect(served.groups[0]?.stimulus).not.toHaveProperty('marks')
  })

  it('a member served alone (a quiz) still carries the group stimulus above it', () => {
    const served = buildServedPaper(composition(['502']), bundles(q2()))
    expect(served.groups).toHaveLength(1)
    expect(served.groups[0]?.questionIds).toEqual(['502'])
    expect(served.groups[0]?.stimulus.image?.url).toBe('/api/files/tok88')
    expect(BijakAttemptQuestionSchema.parse(served.questions[0]).groupId).toBe('qb-g9')
  })

  it('a group of several stimuli keeps their order; the first is also `stimulus`', () => {
    const three = group([
      stim({ id: '1', kind: 'image', label: 'Rajah 1', bodyMs: null, assetFileId: '88' }),
      stim({ id: '2', kind: 'passage', label: 'Petikan A' }),
      stim({ id: '3', kind: 'table', label: 'Jadual 1', bodyMs: null, tableData: { head: ['a'], rows: [['1']] } }),
    ])
    const b = map([mcq()], { groupId: '9' }, three, m)
    expect(b.group?.stimuli?.map((s) => s.id)).toEqual(['qb-s1', 'qb-s2', 'qb-s3'])
    expect(b.group?.stimulus.id).toBe('qb-s1')
    const served = buildServedPaper(composition(['501']), bundles(b))
    expect(served.groups[0]?.stimuli?.map((s) => s.kind)).toEqual(['image', 'passage', 'table'])
    expect(served.groups).toHaveLength(1)
  })
})

/* ------------------------------------------------------------------------------ essay_choice */

describe('essay_choice', () => {
  const rubric = {
    kind: 'rubric',
    marks: 10,
    criteria: [{ id: 'c1', name: 'Isi' }],
    bands: [{ name: 'Baik', range: [6, 10] }],
  }
  const choicePart = (topics: unknown) => ({
    label: '(a)',
    marks: 10,
    mode: 'essay_choice',
    key: rubric,
    prompt: rt('Pilih satu tajuk.'),
    wordRange: { min: 100, max: 200 },
    topics,
  })

  it('is a leaf of kind essay_choice with its topics, marked by the rubric', () => {
    const b = mapBe09Question(
      record([choicePart(['Tajuk satu', { id: 'T2', label: 'Tajuk dua' }])], { raw: true }),
      null,
      LABELS,
      media(),
    )
    expect(b.question.parts?.[0]?.answer).toEqual({
      kind: 'essay_choice',
      wordRange: { min: 100, max: 200 },
      topics: [
        { id: 'A', label: 'Tajuk satu' },
        { id: 'T2', label: 'Tajuk dua' },
      ],
    })
    expect(b.schemes['501.a']?.kind).toBe('rubric')
    const served = buildServedPaper(
      [{ id: 's', label: 'B', rule: { type: 'all' }, questionIds: ['501'] }],
      new Map([['501', b]]),
    )
    expect(served.questions[0]?.parts?.[0]?.answer?.topics).toHaveLength(2)
    expect(JSON.stringify(served)).not.toContain('Baik')
  })

  it('without topics there is nothing to choose: refused', () => {
    const e = refusal(() => mapBe09Question(record([choicePart([])], { raw: true }), null, LABELS, media()))
    expect(e.code).toBe('essay_choice_no_topics')
  })
})

/* ------------------------------------------------------------------------------ refusal reasons */

describe('every refusal carries a code and a BM reason', () => {
  const cases: [string, () => unknown, string][] = [
    ['table_fill', () => map([{ label: '(a)', marks: 1, mode: 'table_fill', key: { kind: 'mapping', cells: { r: ['x'] } }, prompt: rt('p') }]), 'table_fill'],
    ['multi-blank short_text', () => map([shortText({ blankCount: 2 })]), 'short_text_multi_blank'],
    ['anyOrder', () => map([shortText({ key: { kind: 'accepted', values: ['x'], anyOrder: true } })]), 'short_text_any_order'],
    ['numeric sig figs', () => map([{ label: '(a)', marks: 1, mode: 'numeric', key: { kind: 'accepted', values: [{ v: 3.14, sigFigs: 3 }] }, prompt: rt('p') }]), 'numeric_precision'],
    ['reveal never', () => map([shortText({ reveal: 'never' })]), 'reveal_never'],
    ['match_letter with 2 items', () => map([{ label: '(a)', marks: 2, mode: 'match_letter', key: { kind: 'mapping', map: { '1': 'A', '2': 'B' } }, prompt: rt('p') }]), 'match_letter_multi'],
    ['stimulus outside the group', () => map([mcq()], { groupId: '9', stimulusIds: ['99'] }, group([stim()])), 'stimulus_outside_group'],
    ['empty parts', () => map([]), 'no_parts'],
  ]
  for (const [name, fn, code] of cases) {
    it(`${name} -> ${code}`, () => {
      const e = refusal(fn)
      expect(e.code).toBe(code)
      expect(e.reasonCode).toBe(`shape_unsupported:${code}`)
      expect(e.reasonMs).toBe(BRIDGE_REFUSAL_REASONS_MS[e.code])
      expect(e.reasonMs.length).toBeGreaterThan(10)
      expect(refusalLineMs(e.code)).toBe(`Tidak dihidangkan kerana ${e.reasonMs}.`)
    })
  }

  it('the table_fill reason names the mode and says it is not supported yet', () => {
    expect(BRIDGE_REFUSAL_REASONS_MS.table_fill).toMatch(/table_fill.*belum disokong/)
  })

  it('all reasons are BM phrases that continue "kerana" (lowercase start, no trailing full stop)', () => {
    for (const [code, ms] of Object.entries(BRIDGE_REFUSAL_REASONS_MS)) {
      expect(ms, code).toMatch(/^[a-z]/)
      expect(ms, code).not.toMatch(/\.$/)
    }
  })
})
