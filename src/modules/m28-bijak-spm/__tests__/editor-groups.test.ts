// @vitest-environment jsdom
// REQ-A-008 (D90): a group with no displayable stimulus is still a unit; stimuli[] (0 to 3) is consumed.
import type { BijakBuilderEditor } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { editorGroupLabel, editorStimuliOf } from '../lib/stimulus-data'
import { editorFromWire } from '../server/http-admin'

const st = (id: string, label: string, extra: object = {}) => ({ id, kind: 'diagram', label, alt: label, ...extra })

function wire(groups: unknown[]): BijakBuilderEditor {
  return {
    paper: {
      id: 'p', title: 'T', subject: 'MAT', kertas: 2, year: 2026, code: '1449/2', durationMin: 150, instructions: [],
      status: 'draf', createdAt: '2026-10-20T09:00:00.000+08:00', updatedAt: '2026-10-20T09:00:00.000+08:00', sections: [],
    },
    blueprint: null,
    questions: [],
    groups,
  } as unknown as BijakBuilderEditor
}

describe('editorFromWire groups', () => {
  it('keeps a stimulus-less group (never filtered) and a 3-stimulus group with its stimuli', () => {
    const ed = editorFromWire(
      wire([
        { id: 'g0', stimuli: [], questionIds: ['a', 'b'] },
        { id: 'g3', stimulus: st('s1', 'Rajah 1'), stimuli: [st('s1', 'Rajah 1'), st('s2', 'Petikan A', { kind: 'passage', text: 'x' }), st('s3', 'Jadual 1', { kind: 'table' })], questionIds: ['c'] },
        { id: 'g1', stimulus: st('s9', 'Rajah 9', { image: { url: '/api/files/tok', width: 4, height: 3 } }), questionIds: ['d'] },
      ]),
    )
    expect(ed.groups.map((g) => g.id)).toEqual(['g0', 'g3', 'g1'])
    expect(ed.groups[0]!.stimulus).toBeUndefined()
    expect(editorStimuliOf(ed.groups[0]!)).toEqual([])
    expect(editorStimuliOf(ed.groups[1]!).map((s) => s.id)).toEqual(['s1', 's2', 's3'])
    expect(editorStimuliOf(ed.groups[2]!).map((s) => s.id)).toEqual(['s9']) // older server: only `stimulus`
    expect(ed.groups[2]!.stimulus?.image?.url).toBe('/api/files/tok')
  })

  it('labels: joined for several stimuli, empty for none (the unit still shows)', () => {
    expect(editorGroupLabel({})).toBe('')
    expect(editorGroupLabel({ stimulus: st('s', ' ') as never })).toBe('')
    expect(editorGroupLabel({ stimuli: [st('a', 'Rajah 1'), st('b', 'Petikan A')] as never })).toBe('Rajah 1 dan Petikan A')
  })
})
