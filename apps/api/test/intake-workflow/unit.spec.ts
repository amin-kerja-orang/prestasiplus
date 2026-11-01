import { INTAKE_GATE_MESSAGES as G, type IntakeQuestion } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { compare, normalise, signatureOf } from '../../src/modules/intake/workflow/duplicates'
import { batchLevelIssues, itemIssues, schemeTotal } from '../../src/modules/intake/workflow/gate'
import { attachToStimulus, detachFromStimulus, gatherByRef, groupsOf } from '../../src/modules/intake/workflow/grouping'
import { ConvertError, toQuestionInput } from '../../src/modules/intake/workflow/to-question'
import { bandReaches } from '../../src/modules/intake/workflow/workflow.config'

const FACTS = { subjectKnown: true, levelKnown: true, unitKnown: true }

function question(over: Partial<IntakeQuestion> = {}): IntakeQuestion {
  return {
    id: '1',
    label: '1',
    type: 'mcq',
    stem: 'Hitung nilai bagi ungkapan algebra berikut dengan teliti.',
    options: [
      { id: 'A', text: '1' },
      { id: 'B', text: '2' },
      { id: 'C', text: '3' },
    ],
    marks: 1,
    mode: 'working',
    parts: [],
    scheme: { kind: 'option', marks: 1, correct: 'B', reason: 'Kerana.' },
    tag: { subject: 'MATH', level: 'T4', unit: '1.0', unitLabel: 'Unit', sp: ['1.1.1'], tp: 3, formOrigin: 'T4' },
    page: 1,
    lowFields: [],
    confirmed: [],
    ...over,
  } as IntakeQuestion
}

describe('gate (prototype validateBatch rules)', () => {
  it('a complete MCQ passes', () => {
    expect(itemIssues(question(), undefined, FACTS)).toEqual([])
  })

  it('reports every broken rule with the contract copy', () => {
    const issues = itemIssues(
      question({ stem: ' ', marks: 0, scheme: undefined, tag: { subject: 'MATH', level: 'T4', unit: null, unitLabel: '', sp: [], tp: 9, formOrigin: 'T4' } }),
      undefined,
      FACTS,
    ).map((i) => i.message)
    expect(issues).toContain(G.marksPositive)
    expect(issues).toContain(G.unitMissing)
    expect(issues).toContain(G.spMissing)
    expect(issues).toContain(G.tpRange)
  })

  it('an unconfirmed low field blocks; confirming it clears the issue', () => {
    const blocked = itemIssues(question({ lowFields: ['stem'] }), undefined, FACTS).map((i) => i.message)
    expect(blocked).toContain(G.lowFieldUnconfirmed('stem'))
    expect(itemIssues(question({ lowFields: ['stem'], confirmed: ['stem'] }), undefined, FACTS)).toEqual([])
  })

  it('the unit must be in the curriculum list; subject and level must resolve', () => {
    expect(itemIssues(question(), undefined, { ...FACTS, unitKnown: false }).map((i) => i.message)).toContain(G.unitNotInTaxonomy)
    expect(itemIssues(question(), undefined, { ...FACTS, subjectKnown: false }).map((i) => i.message)).toContain(G.subjectLevelMissing)
  })

  it('a stimulus needs alt text and a diagram needs a stored figure', () => {
    const q = question({ stimulusId: 's' })
    const base = { id: 's', kind: 'diagram' as const, label: 'Rajah 1', alt: '', figureId: null, region: null }
    const msgs = itemIssues(q, base, FACTS).map((i) => i.message)
    expect(msgs).toContain(G.stimulusAltMissing)
    expect(msgs).toContain(G.figureNotResolved)
    expect(itemIssues(q, { ...base, kind: 'passage', alt: 'Petikan' }, FACTS)).toEqual([])
    expect(itemIssues(q, undefined, FACTS).map((i) => i.message)).toContain(G.stimulusMissing)
  })

  it('scheme total: points with "any N of M" groups count N points', () => {
    expect(
      schemeTotal({
        kind: 'points',
        marks: 0,
        points: [
          { id: 'a', label: 'a', marks: 2, code: 'K' },
          { id: 'b', label: 'b', marks: 1, code: 'K' },
          { id: 'c', label: 'c', marks: 1, code: 'K' },
        ],
        groups: [{ id: 'g', label: 'g', anyN: 1, pointIds: ['b', 'c'] }],
      } as never),
    ).toBe(3)
  })

  it('batch-level rules do not block a single accept but are reported', () => {
    const msgs = batchLevelIssues({ itemCount: 0, source: ' ', copyright: null, groups: [{ stimulusId: 's', contiguous: false }], stimuli: [] }).map((i) => i.message)
    expect(msgs).toEqual([G.noQuestions, G.sourceRequired, G.copyrightRequired, G.groupNotContiguous])
  })
})

describe('duplicate rule (D11)', () => {
  const sig = (s: string) => signatureOf(s)
  it('normalises case, punctuation and spacing', () => {
    expect(normalise('  Hitung,  NILAI $x$ !')).toBe('hitung nilai x')
  })
  it('exact: identical normalised text', () => {
    expect(compare(sig('Hitung nilai bagi x apabila x ialah 3.'), sig('hitung NILAI bagi x apabila x ialah 3'))).toMatchObject({ kind: 'exact', similarity: 1 })
  })
  it('variant: identical once numbers are masked', () => {
    expect(compare(sig('Hitung nilai bagi 3 tambah 4 dalam kotak'), sig('Hitung nilai bagi 8 tambah 9 dalam kotak'))?.kind).toBe('variant')
  })
  it('near: Jaccard at least 0.85, not exact', () => {
    const a = 'a b c d e f g h i j k l m n o p q r s t'
    const b = 'a b c d e f g h i j k l m n o p q r s z'
    expect(compare(sig(a), sig(b))?.kind).toBe('near')
    expect(compare(sig(a), sig('a b c d e f g h i j z y x w v u t s r q p o'))).toBeNull()
  })
  it('unrelated or too short texts are not compared', () => {
    expect(compare(sig('Pilih'), sig('Pilih'))).toBeNull()
    expect(compare(sig('Hitung luas segi empat tepat itu'), sig('Nyatakan ibu negara Malaysia sekarang'))).toBeNull()
  })
})

describe('grouping (D6)', () => {
  const list = (...pairs: Array<[string, string | null]>) => pairs.map(([id, stimulusId]) => ({ id, stimulusId }))
  it('detects non-contiguous groups', () => {
    expect(groupsOf(list(['a', 's'], ['b', null], ['c', 's']))).toEqual([{ stimulusId: 's', itemIds: ['a', 'c'], contiguous: false }])
  })
  it('attach gathers the group at its earliest member and reports the move', () => {
    const r = attachToStimulus(list(['a', 's'], ['b', null], ['c', null]), ['c'], 's')
    expect(r.items.map((i) => i.id)).toEqual(['a', 'c', 'b'])
    expect(r.moved).toBe(true)
    expect(attachToStimulus(list(['a', null], ['b', null]), ['a'], 's').moved).toBe(false)
  })
  it('extraction gathers each figure into one block at its first question and keeps the rest in place', () => {
    const pairs: Array<[string, string | null]> = [['q1', 'f1'], ['q2', null], ['q3', 'f2'], ['q4', null], ['q5', 'f1'], ['q6', 'f2']]
    const items = pairs.map(([id, stimulusRef]) => ({ id, stimulusRef }))
    expect(gatherByRef(items).map((i) => i.id)).toEqual(['q1', 'q5', 'q2', 'q3', 'q6', 'q4'])
    expect(gatherByRef<{ stimulusRef: string | null }>([])).toEqual([])
  })
  it('detach clears the link', () => {
    expect(detachFromStimulus(list(['a', 's']), ['a'])[0]?.stimulusId).toBeNull()
  })
})

describe('conversion to a Draf question', () => {
  const ids = { subjectId: '1', educationLevelId: '2', unitId: '3', spIds: ['4'], tp: 3 }
  it('an MCQ becomes one mcq leaf with the key and the tag', () => {
    const input = toQuestionInput(question(), ids, null)
    expect(input.questionType).toBe('mcq')
    expect(input.status).toBe('draft')
    expect(input.tag).toEqual({ unitId: '3', spIds: ['4'], tp: 3 })
    expect(JSON.stringify(input.parts)).toContain('"B"')
  })
  it('a short question without parts becomes a single leaf labelled 1', () => {
    const input = toQuestionInput(
      question({ type: 'short', options: [], mode: 'short_text', scheme: { kind: 'accepted', marks: 1, values: [{ v: 'ya' }] } as never }),
      ids,
      'g1',
    )
    expect(input.parts).toHaveLength(1)
    expect(input.stimulusGroupId).toBe('g1')
  })
  it('a scheme the bank cannot hold is a ConvertError with the place', () => {
    expect(() => toQuestionInput(question({ type: 'mcq', options: [] }), ids, null)).toThrow(ConvertError)
  })
})

describe('bulk threshold', () => {
  it('bands reach a floor in order', () => {
    expect(bandReaches('high', 'high')).toBe(true)
    expect(bandReaches('medium', 'high')).toBe(false)
    expect(bandReaches('medium', 'medium')).toBe(true)
    expect(bandReaches('low', 'medium')).toBe(false)
  })
})
