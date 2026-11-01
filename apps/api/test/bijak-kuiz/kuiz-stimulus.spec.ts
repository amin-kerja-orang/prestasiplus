import { describe, expect, it } from 'vitest'

import { resolveStimuli, toKuizStimulus, type OwnStimulus } from '../../src/modules/bijak/kuiz/kuiz.mapper'
import type { QuestionRecord } from '../../src/modules/questions/types'

const own = (over: Partial<OwnStimulus> = {}): OwnStimulus => ({ kind: 'passage', label: 'P', bodyMs: 'Teks', alt: null, caption: null, sourceCitation: null, tableData: null, assetFileId: null, sharedBy: 1, ...over })
const record = (stimulusIds: string[]): QuestionRecord => ({ id: '1', groupId: null, version: { stimulusIds, parts: [] } }) as unknown as QuestionRecord

describe('kuiz stimulus mapping (H-C8)', () => {
  it('keeps all seven kinds and never collapses a picture kind', () => {
    for (const kind of ['passage', 'table', 'diagram', 'image', 'map', 'infographic', 'graph']) {
      const w = toKuizStimulus({ kind, label: 'L', bodyMs: kind === 'passage' ? 'x' : null, alt: null, assetFileId: kind === 'passage' ? null : '9', tableData: kind === 'table' ? { head: ['a'], rows: [['1']] } : null })
      expect(w?.kind, kind).toBe(kind)
    }
    expect(toKuizStimulus({ kind: 'audio', label: 'L', bodyMs: 'x', alt: null, assetFileId: '1' })).toBeNull()
    expect(toKuizStimulus({ kind: 'passage', label: 'L', bodyMs: null, alt: null, assetFileId: null })).toBeNull()
  })
  it('reads a pipe table written in the body and drops the body text', () => {
    const w = toKuizStimulus({ kind: 'table', label: 'J', bodyMs: 'a | b\n1 | 2', alt: null, assetFileId: null })
    expect(w).toMatchObject({ body: null, table: { head: ['a', 'b'], rows: [['1', '2']] } })
  })
  it('own stimuli in link order; unknown, empty or shared ones make the question incomplete', () => {
    const map = new Map([['a', own({ label: 'A' })], ['b', own({ kind: 'map', label: 'B', bodyMs: null, assetFileId: '5' })]])
    const ok = resolveStimuli(record(['a', 'b']), null, map)
    expect(ok.complete).toBe(true)
    expect(ok.entries.map((e) => e.stimulus.label)).toEqual(['A', 'B'])
    expect(resolveStimuli(record(['zzz']), null, map).complete).toBe(false)
    expect(resolveStimuli(record(['a']), null, new Map([['a', own({ sharedBy: 2 })]])).complete).toBe(false)
    expect(resolveStimuli(record(['a']), null, new Map([['a', own({ bodyMs: null })]])).complete).toBe(false)
  })
  it('a whitespace-only body is empty; an unlabelled own picture gets the default alt', () => {
    expect(toKuizStimulus({ kind: 'passage', label: 'L', bodyMs: '   ', alt: null, assetFileId: null })).toBeNull()
    expect(toKuizStimulus({ kind: 'image', label: '', bodyMs: null, alt: null, assetFileId: '3' })?.alt).toBe('Gambar untuk soalan ini')
    expect(toKuizStimulus({ kind: 'image', label: 'Rajah 1', bodyMs: null, alt: null, assetFileId: '3' })?.alt).toBeNull()
  })
  it('a labelled own stimulus that reuses the group picture is kept; an unlabelled duplicate is dropped', () => {
    const group = { id: 'g', stimuli: [{ id: 's1', kind: 'image', label: 'Rajah 1', bodyMs: null, bodyEn: null, assetFileId: '7', alt: null }], optionBank: [], questionIds: [] }
    const labelled = resolveStimuli({ id: '1', groupId: 'g', version: { stimulusIds: ['s1', 'a'], parts: [] } } as unknown as QuestionRecord, group as never, new Map([['a', own({ kind: 'image', label: 'Rajah 2', bodyMs: null, assetFileId: '7' })]]))
    expect(labelled.entries.map((e) => e.stimulus.label)).toEqual(['Rajah 1', 'Rajah 2'])
    const bare = resolveStimuli({ id: '1', groupId: 'g', version: { stimulusIds: ['s1', 'a'], parts: [] } } as unknown as QuestionRecord, group as never, new Map([['a', own({ kind: 'image', label: '', bodyMs: null, assetFileId: '7' })]]))
    expect(bare.entries).toHaveLength(1)
  })
})
