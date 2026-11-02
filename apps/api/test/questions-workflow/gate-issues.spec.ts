import { describe, expect, it } from 'vitest'

import { GATE_MESSAGES, gateIssuesOf } from '../../src/modules/questions/workflow/lifecycle'

describe('gateIssuesOf: the stable code and wizard step of each gate failure (R1-H-A18)', () => {
  it('missing question text and missing parts are REQUIRED_FIELD on their own steps', () => {
    expect(gateIssuesOf({ questionText: GATE_MESSAGES.requiredField, parts: GATE_MESSAGES.requiredField })).toEqual([
      { path: 'questionText', message: GATE_MESSAGES.requiredField, code: 'REQUIRED_FIELD', step: 1 },
      { path: 'parts', message: GATE_MESSAGES.requiredField, code: 'REQUIRED_FIELD', step: 3 },
    ])
  })

  it('an unconfirmed low-confidence field is LOW_CONFIDENCE, on the step of its field', () => {
    expect(gateIssuesOf({ stem: GATE_MESSAGES.lowConfidence, options: GATE_MESSAGES.lowConfidence, year: GATE_MESSAGES.lowConfidence })).toEqual([
      { path: 'stem', message: GATE_MESSAGES.lowConfidence, code: 'LOW_CONFIDENCE', step: 1 },
      { path: 'options', message: GATE_MESSAGES.lowConfidence, code: 'LOW_CONFIDENCE', step: 3 },
      { path: 'year', message: GATE_MESSAGES.lowConfidence, code: 'LOW_CONFIDENCE', step: 4 },
    ])
  })

  it('a low-confidence field with no known step still gets LOW_CONFIDENCE, not GATE_FAILED', () => {
    expect(gateIssuesOf({ somethingElse: GATE_MESSAGES.lowConfidence })[0]).toMatchObject({ code: 'LOW_CONFIDENCE' })
  })
})
