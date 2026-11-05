import { describe, expect, it } from 'vitest'

import type { PartDef, PartView } from '../src/types'

/** FR-QA-09: a leaf may carry the optional id of the stimulus it cites; absent stays absent. */
describe('part stimulusId (FR-QA-09)', () => {
  it('PartDef and PartView carry the optional stimulusId, nested too', () => {
    const def: PartDef = {
      id: 'q1',
      label: '',
      prompt: '',
      marks: 0,
      children: [{ id: 'q1.a', label: '(a)', prompt: 'p', marks: 1, stimulusId: 's2' }],
    }
    const view: PartView = { ...def, children: def.children?.map((c) => ({ ...c })) }
    expect(view.children?.[0]?.stimulusId).toBe('s2')
    expect(view.stimulusId).toBeUndefined()
  })
})
