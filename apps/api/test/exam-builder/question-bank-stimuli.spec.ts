import { describe, expect, it } from 'vitest'

import {
  MAX_GROUP_STIMULI,
  reviewQuestion,
  stimuliOf,
  stimulusOf,
  type Curriculum,
  type StimulusSource,
} from '../../src/modules/exam/builder/question-bank.mapping'

const source = (over: Partial<StimulusSource> & { id: bigint; kind: string }): StimulusSource => ({
  label: null,
  bodyMs: null,
  caption: null,
  altText: null,
  tableData: null,
  ...over,
})

/** Unit (no DB): the builder carries a whole stimulus group (D90), not only its first stimulus. */
describe('builder stimulus mapping (R1-T07)', () => {
  it('maps the seven kinds as they are (no collapse to diagram, R1-T31); audio is dropped', () => {
    const kinds = ['passage', 'image', 'diagram', 'table', 'map', 'infographic', 'graph']
    const wire = kinds.map((kind, i) => stimulusOf(source({ id: BigInt(i + 1), kind, label: `S${String(i)}` }))?.kind)
    expect(wire).toEqual(kinds)
    expect(stimulusOf(source({ id: 9n, kind: 'audio' }))).toBeUndefined()
    expect(stimulusOf(source({ id: 9n, kind: 'video' }))).toBeUndefined()
  })

  it('carries label, caption, alt (falls back to the label), passage text and the table grid', () => {
    const grid = { head: ['A', 'B'], rows: [['1', '2']] }
    expect(stimulusOf(source({ id: 1n, kind: 'passage', label: 'Petikan', bodyMs: 'Teks petikan', caption: 'Cap' }))).toEqual({
      id: '1', kind: 'passage', label: 'Petikan', caption: 'Cap', alt: 'Petikan', text: 'Teks petikan',
    })
    expect(stimulusOf(source({ id: 2n, kind: 'table', label: 'Jadual', altText: 'Jadual jualan', tableData: grid }))).toEqual({
      id: '2', kind: 'table', label: 'Jadual', alt: 'Jadual jualan', table: grid,
    })
    // A malformed grid is dropped, never passed through.
    expect(stimulusOf(source({ id: 3n, kind: 'table', tableData: { head: 'x', rows: [] } }))?.table).toBeUndefined()
  })

  it('a picture carries its public file token URL, the source line and the caption; a missing file leaves the picture out', () => {
    const tokens = new Map([['77', 'Zk3x9QmT1bVnR0aYc7LpDw']])
    for (const kind of ['image', 'diagram', 'map', 'infographic', 'graph']) {
      expect(stimulusOf(source({ id: 5n, kind, label: 'Rajah 1', caption: 'Cap', altText: 'Huraian', sourceCitation: 'Sumber: JPN', assetFileId: 77n }), tokens)).toEqual({
        id: '5', kind, label: 'Rajah 1', caption: 'Cap', alt: 'Huraian', source: 'Sumber: JPN', image: { url: '/api/files/Zk3x9QmT1bVnR0aYc7LpDw' },
      })
    }
    // the internal file id never leaves; an unknown id gives no picture
    expect(stimulusOf(source({ id: 6n, kind: 'image', label: 'R', assetFileId: 78n }), tokens)).toEqual({ id: '6', kind: 'image', label: 'R', alt: 'R' })
    expect(JSON.stringify(stimulusOf(source({ id: 5n, kind: 'image', assetFileId: 77n }), tokens))).not.toContain('77"')
  })

  it('a table keeps the caption and the grid; a pipe table in the body becomes the grid and not the text', () => {
    const t = stimulusOf(source({ id: 7n, kind: 'table', label: 'Jadual 1', caption: 'Jualan', bodyMs: 'Bulan | Jumlah\n--- | ---\nJan | 10' }))
    expect(t).toMatchObject({ kind: 'table', caption: 'Jualan', table: { head: ['Bulan', 'Jumlah'], rows: [['Jan', '10']] } })
    expect(t?.text).toBeUndefined()
  })

  it('stimuliOf keeps every displayable stimulus of a group in order (1 to 3) and skips audio', () => {
    const list = [
      source({ id: 1n, kind: 'passage', label: 'P' }),
      source({ id: 2n, kind: 'audio', label: 'Bunyi' }),
      source({ id: 3n, kind: 'table', label: 'T' }),
      source({ id: 4n, kind: 'image', label: 'G' }),
    ]
    expect(stimuliOf(list).map((s) => s.label)).toEqual(['P', 'T', 'G'])
    expect(stimuliOf([list[0] as StimulusSource]).map((s) => s.id)).toEqual(['1'])
    expect(stimuliOf([list[1] as StimulusSource])).toEqual([])
  })

  it('never exceeds the contract maximum of three stimuli per group', () => {
    const four = [1n, 2n, 3n, 4n].map((id) => source({ id, kind: 'passage', label: `P${id.toString()}` }))
    expect(MAX_GROUP_STIMULI).toBe(3)
    expect(stimuliOf(four)).toHaveLength(3)
  })
})

describe('builder review of an essay_choice leaf (R1-T07)', () => {
  const curriculum: Curriculum = { subject: 'BM', level: 'T4', unit: null, unitLabel: '', sp: [], tp: 3, formOrigin: 'T4' }

  it('is shown as an essay with its word range and rubric lines; the topics are not on the review wire yet', () => {
    const q = reviewQuestion({
      id: '5',
      stem: 'Karangan',
      curriculum,
      parts: [
        {
          label: '',
          prompt: { ms: 'Pilih satu tajuk.' },
          mode: 'essay_choice',
          marks: 30,
          key: { kind: 'rubric', marks: 30, criteria: [{ id: 'c', name: 'Isi' }], bands: [{ name: 'Cemerlang', range: [25, 30] }] },
          topics: [{ id: 'a', label: 'Satu' }, { id: 'b', label: 'Dua' }],
          wordRange: { min: 150, max: 200 },
        },
      ],
    })
    expect(q.marks).toBe(30)
    expect(q.parts?.[0]?.answer).toEqual({ kind: 'essay', wordRange: { min: 150, max: 200 } })
    expect(q.scheme['']?.lines[0]?.text).toContain('Cemerlang')
  })
})
