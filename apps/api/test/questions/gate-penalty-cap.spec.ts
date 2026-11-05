import { describe, expect, it } from 'vitest'
import type { QuestionPart } from '@pp/contract'

import { checkKeysGate, checkSchemeRulesGate, SCHEME_MESSAGES, SCHEME_RULES_PENALTY_FIELD } from '../../src/modules/questions/publish-gate'
import { publishGate, submitGate } from '../../src/modules/questions/workflow/lifecycle'
import type { QuestionGateData } from '../../src/modules/questions/workflow'

/** S1-T09a part 6a (review m5 on #698): the question-level penalty cap reaches the submit, approve and publish gates. Pure: no database. */
const PENALTY = 'Jumlah penalti melebihi markah bahagian.'
const working = (marks: number): QuestionPart => ({ label: 'a', mode: 'working', marks, key: { kind: 'points', marks, points: [{ id: 'p1', code: 'M', marks }] } }) as unknown as QuestionPart
const v2 = (marks: number): QuestionPart =>
  ({ label: 'a', mode: 'working', marks, key: { kind: 'points', scheme_v: 2, marks, points: [{ id: 'p1', code: 'M', marks }] } }) as unknown as QuestionPart
const over = { deductions: [{ code: 'unit' as const, amount: 3, scope: 'question' as const }] }
const within = { deductions: [{ code: 'unit' as const, amount: 1, scope: 'question' as const }] }

const gateData = (parts: QuestionPart[], schemeRules?: QuestionGateData['schemeRules']): QuestionGateData => ({
  id: '1',
  parts,
  marks: 2,
  subjectId: '1',
  educationLevelId: '1',
  chapterId: null,
  unitId: '1',
  spIds: ['1'],
  tp: 3,
  unconfirmedLowConfidenceFields: [],
  hasOpenDuplicateFlag: false,
  mediaResolved: true,
  missingRequiredFields: [],
  lastEditedByAi: false,
  hasDskpNodes: false,
  difficultyLevel: 3,
  ...(schemeRules === undefined ? {} : { schemeRules }),
})

describe('question-level penalty cap in the gates (S1-T09a 6a)', () => {
  it('[CI] checkKeysGate without options is unchanged (additive signature)', () => {
    expect(checkKeysGate([working(2)])).toEqual({})
    expect(checkKeysGate([working(2)], {})).toEqual({})
  })

  it('[CI] checkKeysGate refuses question-scope deductions above the question marks with SCHEME_PENALTY text, on a v1 leaf too', () => {
    expect(checkKeysGate([working(2)], { schemeRules: over })).toEqual({ [SCHEME_RULES_PENALTY_FIELD]: PENALTY })
    expect(SCHEME_MESSAGES.penalty).toBe(PENALTY)
    expect(checkKeysGate([working(2)], { schemeRules: within })).toEqual({})
  })

  it('[CI] with a v2 leaf the refusal is carried by the leaf key field once, not repeated at question level', () => {
    expect(checkKeysGate([v2(2)], { schemeRules: over })).toEqual({ 'parts.a.key': PENALTY })
  })

  it('[CI] the cap counts the sum of the leaf marks of the whole question', () => {
    const two = [working(1), { ...working(1), label: 'b' } as QuestionPart]
    expect(checkKeysGate(two, { schemeRules: { deductions: [{ code: 'other', amount: 2, scope: 'question' }] } })).toEqual({})
    expect(checkKeysGate(two, { schemeRules: { deductions: [{ code: 'other', amount: 3, scope: 'question' }] } })).toEqual({ [SCHEME_RULES_PENALTY_FIELD]: PENALTY })
  })

  it('[CI] checkSchemeRulesGate: no rules means no refusal; a cap lowers the counted amount', () => {
    expect(checkSchemeRulesGate([working(2)], null)).toEqual({})
    expect(checkSchemeRulesGate([working(2)], undefined)).toEqual({})
    expect(checkSchemeRulesGate([working(2)], { deductions: [{ code: 'other', amount: 9, cap: 2, scope: 'question' }] })).toEqual({})
  })

  it('[CI] submit gate and publish (approve) gate refuse it; without schemeRules they pass as before', () => {
    expect(submitGate(gateData([working(2)], over))).toEqual({ [SCHEME_RULES_PENALTY_FIELD]: PENALTY })
    expect(publishGate(gateData([working(2)], over))[SCHEME_RULES_PENALTY_FIELD]).toBe(PENALTY)
    expect(submitGate(gateData([working(2)], within))).toEqual({})
    expect(publishGate(gateData([working(2)], within))[SCHEME_RULES_PENALTY_FIELD]).toBeUndefined()
    expect(submitGate(gateData([working(2)]))).toEqual({})
    expect(publishGate(gateData([working(2)]))[SCHEME_RULES_PENALTY_FIELD]).toBeUndefined()
  })
})
