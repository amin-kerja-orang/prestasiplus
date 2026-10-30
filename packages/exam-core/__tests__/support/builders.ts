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
  kbat: true,
  hasKey: true,
  ...over,
})

export function facts(id: string, over: Partial<QuestionFacts> = {}): QuestionFacts {
  return {
    id,
    groupId: null,
    groupPosition: null,
    versionNo: 1,
    tagReview: false,
    unit: unit('1'),
    formOrigin: 't4',
    pools: [],
    leaves: [leaf()],
    ...over,
  }
}

/**
 * A question with one unit, a top TP, total marks and `kbat` KBAT marks (split over two leaves when
 * 0 < kbat < marks). Handy for solver tests.
 */
export function q(
  id: string,
  nodeId: string | null,
  tp: number,
  marks: number,
  kbat = 0,
  over: Partial<QuestionFacts> = {},
): QuestionFacts {
  const leaves = [] as ReturnType<typeof leaf>[]
  if (kbat > 0) leaves.push(leaf({ marks: kbat, tp, kbat: true }))
  if (marks - kbat > 0) leaves.push(leaf({ marks: marks - kbat, tp: kbat > 0 ? Math.max(1, tp - 1) : tp, kbat: false }))
  return facts(id, {
    unit: nodeId ? unit(nodeId, Number(nodeId) >= 20 ? 'T5' : 'T4') : null,
    formOrigin: nodeId ? (Number(nodeId) >= 20 ? 't5' : 't4') : 't1_t3',
    leaves,
    ...over,
  })
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
