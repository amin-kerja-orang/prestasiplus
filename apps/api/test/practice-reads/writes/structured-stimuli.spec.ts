import { describe, expect, it } from 'vitest'

import { practiceMediaOf } from '../../../src/modules/practice/question-bridge/practice-media'
import { structuredStimuliOf } from '../../../src/modules/practice/reads/writes/structured-stimuli'
import type { QuestionRecord, StimulusGroupRecord } from '../../../src/modules/questions'

/**
 * KP-15 on the structured detail, DB-free: a stimulus that cannot be shown is replaced by the "Gambar tiada" placeholder in its own place and every
 * other stimulus stays (group first, then the set's own). The drills and the quiz still refuse the whole question (`practiceMediaOf` is null).
 */
function record(id: string, over: { groupId?: string | null; stimulusIds?: string[] } = {}): QuestionRecord {
  return {
    id,
    groupId: over.groupId ?? null,
    version: { id: `v${id}`, stimulusIds: over.stimulusIds ?? [], parts: [] },
  } as unknown as QuestionRecord
}
const own = (entries: Array<[string, Record<string, unknown>]>) => new Map(entries) as never
const pic = (over: Record<string, unknown> = {}) => ({ kind: 'image', label: 'Rajah', assetFileId: 'f1', bodyMs: null, alt: null, sharedBy: 1, ...over })
const passage = (over: Record<string, unknown> = {}) => ({ kind: 'passage', label: 'Petikan', assetFileId: null, bodyMs: 'Petikan zz.', alt: null, sharedBy: 1, ...over })
const tokens = new Map([['f1', 'TOKENf1AAAAAAAAAAAA']])

describe('structuredStimuliOf: per-item placeholder (KP-15)', () => {
  it('an unshowable picture and a passage: the placeholder and the passage, in link order', () => {
    const r = record('7', { stimulusIds: ['p', 's'] })
    const o = own([
      ['p', pic()],
      ['s', passage()],
    ])
    expect(practiceMediaOf(r, null, o, new Map())).toBeNull() // the shared reader refuses the whole question: unchanged
    const out = structuredStimuliOf(r, null, o, new Map())
    expect(out.map((s) => [s.kind, s.label, s.text])).toEqual([
      ['passage', 'Gambar tiada', expect.any(String)],
      ['passage', 'Petikan', 'Petikan zz.'],
    ])
    expect(out[0]?.image).toBeUndefined()
  })

  it('order is kept when the unshowable picture is the second one: passage, then placeholder', () => {
    const r = record('7', { stimulusIds: ['s', 'p'] })
    const out = structuredStimuliOf(r, null, own([['s', passage()], ['p', pic()]]), new Map())
    expect(out.map((s) => s.label)).toEqual(['Petikan', 'Gambar tiada'])
  })

  it('group stimulus first, then own; an unshowable group stimulus is replaced in place, an own picture with a token is shown', () => {
    const group = {
      id: 'G1',
      label: 'G',
      stimuli: [
        { id: 'g1', kind: 'diagram', label: 'Rajah G', bodyMs: null, assetFileId: 'fMissing', alt: null },
        { id: 'g2', kind: 'table', label: 'Jadual G', bodyMs: null, assetFileId: null, alt: null, tableData: { head: ['x'], rows: [['1']] } },
      ],
      optionBank: [],
      questionIds: ['7'],
    } as unknown as StimulusGroupRecord
    const r = record('7', { groupId: 'G1', stimulusIds: ['p'] })
    const out = structuredStimuliOf(r, group, own([['p', pic()]]), tokens)
    expect(out.map((s) => s.label)).toEqual(['Gambar tiada', 'Jadual G', 'Rajah'])
    expect(out[1]?.table).toEqual({ head: ['x'], rows: [['1']] })
    expect(out[2]?.image?.url).toBe('/api/files/TOKENf1AAAAAAAAAAAA')
    expect(new Set(out.map((s) => s.id)).size).toBe(3)
  })

  it('an unknown or shared-not-grouped or missing stimulus is the placeholder, with distinct ids', () => {
    const r = record('7', { stimulusIds: ['a', 'b', 'c'] })
    const out = structuredStimuliOf(r, null, own([['a', pic({ kind: 'audio' })], ['b', passage({ sharedBy: 2 })]]), tokens)
    expect(out.map((s) => s.label)).toEqual(['Gambar tiada', 'Gambar tiada', 'Gambar tiada'])
    expect(new Set(out.map((s) => s.id)).size).toBe(3)
  })

  it('everything showable gives the same list as the shared reader, and no stimulus gives none', () => {
    const r = record('7', { stimulusIds: ['p', 's'] })
    const o = own([['p', pic()], ['s', passage()]])
    expect(structuredStimuliOf(r, null, o, tokens)).toEqual(practiceMediaOf(r, null, o, tokens)?.stimuli)
    expect(structuredStimuliOf(record('8'), null, new Map(), new Map())).toEqual([])
  })
})
