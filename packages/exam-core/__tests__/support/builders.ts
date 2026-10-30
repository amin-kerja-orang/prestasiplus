/** Small builders for the standard tests (fictitious data only). */
import type { LeafFact, QuestionFacts, UnitFact } from '../../src/eligibility'
import type { StandardBlueprint, StandardSection } from '../../src/standard-model'

export const unit = (nodeId: string, level: 'T4' | 'T5' = 'T4', code = `${nodeId}.0`): UnitFact => ({
  nodeId,
  level,
  code,
})

export const leaf = (over: Partial<LeafFact> = {}): LeafFact => ({
  marks: 4,
  mode: 'working',
  tp: 3,
  cognitiveLevel: 3,
  hasKey: true,
  ...over,
})

export function facts(id: string, over: Partial<QuestionFacts> = {}): QuestionFacts {
  return {
    id,
    groupId: null,
    groupPosition: null,
    versionNo: 1,
    unit: unit('1'),
    formOrigin: 't4',
    pools: [],
    leaves: [leaf()],
    ...over,
  }
}

export function section(over: Partial<StandardSection> = {}): StandardSection {
  return {
    position: 1,
    label: 'Bahagian A',
    rule: { type: 'all' },
    questionCount: 2,
    markBudget: 8,
    allowedModes: [],
    profile: null,
    quota: null,
    kbatMarks: null,
    ...over,
  }
}

export function blueprint(sections: StandardSection[], over: Partial<StandardBlueprint> = {}): StandardBlueprint {
  return { subject: 'MAT', kertas: 2, code: '1449/2', version: 1, durationMin: 150, sections, ...over }
}
