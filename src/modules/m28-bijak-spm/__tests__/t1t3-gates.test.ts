// @vitest-environment jsdom
/**
 * FB-072: a T1-T3 question ("Tingkatan 1-3 (di luar DSKP)") is exempt from the DSKP unit and the SP,
 * and nobody is asked to confirm them. TP stays required. The intake gate, the revision gate and the
 * publish gate follow the same rule.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import QuestionEditor from '../admin/intake/components/QuestionEditor.vue'
import { fieldsToConfirm, validateBatch, validateRevision } from '../admin/intake/domain/validation'
import { emptyTag } from '../admin/intake/lib/dskp'
import type { IntakeQuestion } from '../admin/intake/types'
import type { CurriculumTag, QuestionDef, SchemeDef } from '../domain/types'
import { gateErrors } from '../server/admin'

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

const t13 = { formOrigin: 'T1-T3' as const, unit: null, unitLabel: '', sp: [] as string[] }
const t4 = { formOrigin: 'T4' as const, unit: null, unitLabel: '', sp: [] as string[] }
const batch = (q: IntakeQuestion) => ({
  questions: [q],
  stimuli: [],
  source: 'x',
  copyright: 'sendiri',
})
const messages = (q: IntakeQuestion) => validateBatch(batch(q)).map((i) => i.message)

describe('intake gate (validateBatch)', () => {
  it('T1-T3: no unit, no SP and no unit/SP confirmation needed', () => {
    const q = intakeQ(t13, { lowFields: ['tag.unit', 'tag.sp'], confirmed: [] })
    expect(messages(q)).toEqual([])
  })

  it('T1-T3: TP is still required', () => {
    expect(messages(intakeQ({ ...t13, tp: 0 }))).toEqual([
      'Tahap Penguasaan (TP) mesti antara 1 dan 6.',
    ])
    expect(messages(intakeQ({ ...t13, tp: 7 }))).toEqual([
      'Tahap Penguasaan (TP) mesti antara 1 dan 6.',
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
  it('T1-T3: passes with no unit and no SP, even for a question that is not legacy', () => {
    expect(validateRevision(intakeQ(t13, { lowFields: ['tag.sp'] }), undefined, false)).toEqual([])
  })

  it('T1-T3: TP is still required', () => {
    expect(validateRevision(intakeQ({ ...t13, tp: 0 }), undefined, false)).toHaveLength(1)
  })

  it('T4: unit and SP are still required (SP waived only for a legacy question)', () => {
    expect(validateRevision(intakeQ(t4), undefined, false)).toEqual([
      'Soalan: Unit DSKP belum dipilih.',
      'Soalan: Standard Pembelajaran (SP) belum dipilih.',
    ])
    expect(validateRevision(intakeQ(t4), undefined, true)).toEqual([
      'Soalan: Unit DSKP belum dipilih.',
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

  it('T1-T3 without a unit label and without SP can be published', () => {
    expect(gateErrors([def(t13)], scheme)).toEqual([])
  })

  it('T4 and T5 without a unit label are refused', () => {
    for (const formOrigin of ['T4', 'T5'] as const)
      expect(gateErrors([def({ ...t4, formOrigin })], scheme)).toEqual([
        'Soalan 1: topik DSKP belum dipilih',
      ])
  })

  it('the three gates agree on the same T1-T3 question', () => {
    const q = intakeQ(t13, { lowFields: ['tag.unit', 'tag.sp'] })
    expect(messages(q)).toEqual([])
    expect(validateRevision(q, undefined, false)).toEqual([])
    expect(gateErrors([def(t13)], scheme)).toEqual([])
  })
})

describe('QuestionEditor: unit confirmation', () => {
  const confirmBoxes = (q: IntakeQuestion) => {
    const w = mount(QuestionEditor, { props: { modelValue: q } })
    return {
      ids: w.findAll('[data-testid^="confirm-"]').map((n) => n.attributes('data-testid')),
      text: w.text(),
    }
  }

  it('hides "Saya sahkan unit DSKP" and "Saya sahkan SP" for T1-T3', () => {
    const r = confirmBoxes(intakeQ(t13, { lowFields: ['tag.unit', 'tag.sp'] }))
    expect(r.ids).toEqual([])
    expect(r.text).not.toContain('Saya sahkan')
  })

  it('still shows them for T4', () => {
    const r = confirmBoxes(intakeQ(t4, { lowFields: ['tag.unit', 'tag.sp'] }))
    expect(r.ids).toEqual(['confirm-tag.unit', 'confirm-tag.sp'])
    expect(r.text).toContain('Saya sahkan unit DSKP (keyakinan rendah)')
    expect(r.text).toContain('Saya sahkan SP (keyakinan rendah)')
  })
})
