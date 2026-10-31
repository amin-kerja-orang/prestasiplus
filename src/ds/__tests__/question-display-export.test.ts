import { describe, expect, it } from 'vitest'

import * as ds from '..'

describe('@/ds re-exports the shared question display (REQ-C-007)', () => {
  it('exposes StimulusFigure and StimulusGroup', () => {
    expect(ds.StimulusFigure).toBeDefined()
    expect(ds.StimulusGroup).toBeDefined()
  })
})
