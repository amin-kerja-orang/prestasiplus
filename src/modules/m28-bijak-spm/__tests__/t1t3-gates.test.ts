// @vitest-environment jsdom
/**
 * FB-072: a T1-T3 question ("Tingkatan 1-3 (di luar DSKP)") is exempt from the DSKP unit and the SP,
 * and nobody is asked to confirm them. TP stays required. The intake gate, the revision gate and the
 * publish gate follow the same rule.
 */
import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import QuestionEditor from '../admin/intake/components/QuestionEditor.vue'
import { batchToSeeds } from '../admin/intake/domain/convert'
import {
  fieldsToConfirm,
  lowToConfirm,
  validateBatch,
  validateRevision,
} from '../admin/intake/domain/validation'
import { demoBatch } from '../admin/intake/lib/seed'
import type { IntakeQuestion } from '../admin/intake/types'
import { emptyTag } from '../domain/tag-edit'
import type { TagLookup } from '../domain/tag-rule'
import type { CurriculumTag, QuestionDef, SchemeDef, TpLevel } from '../domain/types'
import { gateErrors } from '../server/admin'
import { BijakServer, MemoryStorage } from '../server/store'
import { MAT_T4_SP, MAT_T4_UNIT, loadTagLookup, loadedState } from './tag-fixtures'

let lookup: TagLookup
beforeAll(async () => {
  lookup = await loadTagLookup()
})

function intakeQ(
  over: Partial<IntakeQuestion['tag']>,
  extra: Partial<IntakeQuestion> = {},
): IntakeQuestion {
  return {
    id: 'q1',
    label: '1',
    type: 'mcq',
    stem: 'Hitung $2 + 3$.',
    options: [
      { id: 'A', text: '5' },
      { id: 'B', text: '6' },
    ],
    marks: 1,
    mode: 'short_text',
    parts: [],
    scheme: { kind: 'option', marks: 1, correct: 'A', reason: 'Kunci' },
    tag: { ...emptyTag('MAT'), ...over },
    page: 1,
    lowFields: [],
    confirmed: [],
    ...extra,
  }
}

const t13 = { formOrigin: 'T1-T3' as const, unitId: null, spIds: [], tp: 3 as TpLevel }
const t4 = { formOrigin: 'T4' as const, unitId: null, spIds: [], tp: 3 as TpLevel }
const badTp = (n: number): TpLevel => n as TpLevel
const batch = (q: IntakeQuestion) => ({
  questions: [q],
  stimuli: [],
  source: 'x',
  copyright: 'sendiri',
})
const messages = (q: IntakeQuestion) => validateBatch(batch(q), lookup).map((i) => i.message)

describe('intake gate (validateBatch)', () => {
  it('T1-T3: no unit, no SP and no unit/SP confirmation needed', () => {
    const q = intakeQ(t13, { lowFields: ['tag.unit', 'tag.sp'], confirmed: [] })
    expect(messages(q)).toEqual([])
  })

  it('T1-T3: TP is still required', () => {
    expect(messages(intakeQ({ ...t13, tp: badTp(0) }))).toEqual([
      'Tahap Penguasaan (TP) mesti antara 1 dan 6.',
    ])
    expect(messages(intakeQ({ ...t13, tp: badTp(7) }))).toEqual([
      'Tahap Penguasaan (TP) mesti antara 1 dan 6.',
    ])
    expect(messages(intakeQ({ ...t13, tp: null }))).toEqual([
      'Tahap Penguasaan (TP) belum dipilih.',
    ])
  })

  it('T1-T3: another low-confidence field is still asked for', () => {
    const q = intakeQ(t13, { lowFields: ['tag.unit', 'marks'] })
    expect(messages(q)).toEqual(['Medan keyakinan rendah belum disahkan: markah.'])
  })

  it('T4 and T5: unit, SP and the confirmations are still required', () => {
    for (const formOrigin of ['T4', 'T5'] as const) {
      const q = intakeQ({ ...t4, formOrigin }, { lowFields: ['tag.unit', 'tag.sp'] })
      expect(messages(q)).toEqual([
        'Unit DSKP belum dipilih.',
        'Standard Pembelajaran (SP) belum dipilih.',
        'Medan keyakinan rendah belum disahkan: unit DSKP.',
        'Medan keyakinan rendah belum disahkan: SP.',
      ])
    }
  })

  it('fieldsToConfirm drops the unit and SP only for T1-T3', () => {
    const low = ['tag.unit', 'tag.sp', 'marks']
    expect(fieldsToConfirm(intakeQ(t13, { lowFields: low }))).toEqual(['marks'])
    expect(fieldsToConfirm(intakeQ(t4, { lowFields: low }))).toEqual(low)
  })
})

describe('revision gate (validateRevision)', () => {
  it('T1-T3: passes with no unit and no SP', () => {
    expect(validateRevision(intakeQ(t13, { lowFields: ['tag.sp'] }), undefined, lookup)).toEqual([])
  })

  it('T1-T3: TP is still required', () => {
    expect(validateRevision(intakeQ({ ...t13, tp: badTp(0) }), undefined, lookup)).toHaveLength(1)
  })

  it('T4: unit and SP are required, and nothing is waived for a question without SP (AC-07.5)', () => {
    expect(validateRevision(intakeQ(t4), undefined, lookup)).toEqual([
      'Soalan: Unit DSKP belum dipilih.',
      'Soalan: Standard Pembelajaran (SP) belum dipilih.',
    ])
  })
})

describe('publish gate (gateErrors)', () => {
  const scheme = (id: string): SchemeDef | undefined =>
    id === 'q1' ? { kind: 'option', marks: 1, correct: 'A', reason: 'Kunci' } : undefined
  const def = (c: Partial<CurriculumTag>): QuestionDef => ({
    id: 'q1',
    curriculum: { ...emptyTag('MAT'), ...c },
    stem: 'x',
    mcq: {
      options: [
        { id: 'A', text: '5' },
        { id: 'B', text: '6' },
      ],
    },
  })

  it('T1-T3 without a unit and without SP can be published', () => {
    expect(gateErrors([def(t13)], scheme, lookup)).toEqual([])
  })

  it('T4 and T5 without a unit are refused', () => {
    for (const formOrigin of ['T4', 'T5'] as const)
      expect(gateErrors([def({ ...t4, formOrigin })], scheme, lookup)).toEqual([
        'Soalan 1: Unit DSKP belum dipilih.',
        'Soalan 1: Standard Pembelajaran (SP) belum dipilih.',
      ])
  })

  it('the three gates agree on the same T1-T3 question', () => {
    const q = intakeQ(t13, { lowFields: ['tag.unit', 'tag.sp'] })
    expect(messages(q)).toEqual([])
    expect(validateRevision(q, undefined, lookup)).toEqual([])
    expect(gateErrors([def(t13)], scheme, lookup)).toEqual([])
  })
})

describe('"Perlu disahkan" count and review confidence (lowToConfirm)', () => {
  it('counts only what can be confirmed: T1-T3 unit/SP are never counted', () => {
    expect(lowToConfirm(intakeQ(t13, { lowFields: ['tag.unit', 'tag.sp'] }))).toEqual([])
    expect(lowToConfirm(intakeQ(t13, { lowFields: ['tag.unit', 'marks'] }))).toEqual(['marks'])
    expect(lowToConfirm(intakeQ(t4, { lowFields: ['tag.unit', 'tag.sp'] }))).toEqual([
      'tag.unit',
      'tag.sp',
    ])
    expect(
      lowToConfirm(intakeQ(t4, { lowFields: ['tag.unit', 'tag.sp'], confirmed: ['tag.unit'] })),
    ).toEqual(['tag.sp'])
  })

  const withLow = (formOrigin: 'T1-T3' | 'T4') => {
    const b = demoBatch(1)
    b.questions = b.questions.map((q) => ({
      ...q,
      tag: { ...q.tag, formOrigin },
      lowFields: ['tag.unit', 'tag.sp'],
      confirmed: [],
    }))
    return b
  }

  it('a T1-T3 batch with only unit/SP low fields has lowCount 0 and confidence tinggi', async () => {
    const batch = withLow('T1-T3')
    expect(new Set(batchToSeeds(batch).map((s) => s.confidence))).toEqual(new Set(['tinggi']))
    const server = new BijakServer({ storage: new MemoryStorage() })
    await server.saveExtracted(batch.id, { questions: batch.questions, stimuli: batch.stimuli })
    const row = (await server.listIntakeBatches()).find((b) => b.id === batch.id)!
    expect(row.lowCount).toBe(0)
  })

  it('a T4 batch with the same low fields still counts them and is sederhana', async () => {
    const batch = withLow('T4')
    expect(new Set(batchToSeeds(batch).map((s) => s.confidence))).toEqual(new Set(['sederhana']))
    const server = new BijakServer({ storage: new MemoryStorage() })
    await server.saveExtracted(batch.id, { questions: batch.questions, stimuli: batch.stimuli })
    const row = (await server.listIntakeBatches()).find((b) => b.id === batch.id)!
    expect(row.lowCount).toBe(batch.questions.length * 2)
  })
})

describe('QuestionEditor: unit confirmation', () => {
  const confirmBoxes = async (q: IntakeQuestion) => {
    const w = mount(QuestionEditor, { props: { modelValue: q, dskp: await loadedState() } })
    return {
      ids: w.findAll('[data-testid^="confirm-"]').map((n) => n.attributes('data-testid')),
      text: w.text(),
    }
  }
  const suggested = (tag: Partial<IntakeQuestion['tag']>): Partial<IntakeQuestion> => ({
    lowFields: ['tag.unit', 'tag.sp'],
    tagSuggestion: {
      providerId: 'mock',
      model: 'mock',
      unitId: tag.unitId ?? undefined,
      spIds: tag.spIds,
      confidence: { unit: 'rendah', sp: 'rendah' },
    },
  })
  const withUnit = { ...t4, unitId: MAT_T4_UNIT, spIds: [MAT_T4_SP] }

  it('hides "Saya sahkan unit DSKP" and "Saya sahkan SP" for T1-T3', async () => {
    const r = await confirmBoxes(intakeQ(t13, { lowFields: ['tag.unit', 'tag.sp'] }))
    expect(r.ids).toEqual([])
    expect(r.text).not.toContain('Saya sahkan')
  })

  it('still shows them for T4 while the unit and SP are the AI suggestion', async () => {
    const r = await confirmBoxes(intakeQ(withUnit, suggested(withUnit)))
    expect(r.ids).toEqual(['confirm-tag.unit', 'confirm-tag.sp'])
    expect(r.text).toContain('Saya sahkan unit DSKP (keyakinan rendah)')
    expect(r.text).toContain('Saya sahkan SP (keyakinan rendah)')
  })

  it('asks for nothing when there is no value to confirm', async () => {
    const r = await confirmBoxes(intakeQ(t4, { lowFields: ['tag.unit', 'tag.sp'] }))
    expect(r.ids).toEqual([])
  })
})
