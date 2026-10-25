// @vitest-environment jsdom
/**
 * DSKP-T03: the interim wiring of the Tag DSKP block over the catalogue (DSKP-T07 rewrites the
 * block). Checks that the v2 tag is edited only through the pure helpers and the catalogue.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import QuestionEditor from '../admin/intake/components/QuestionEditor.vue'
import type { IntakeQuestion } from '../admin/intake/types'
import { emptyTag } from '../domain/tag-edit'
import { dskpSource } from '../lib/dskp-source'
import { MAT_T4_SP, MAT_T4_UNIT } from './tag-fixtures'

function intakeQ(tag = emptyTag('MAT')): IntakeQuestion {
  return {
    id: 'q1',
    label: '1',
    type: 'short',
    stem: 'Hitung.',
    options: [],
    marks: 1,
    mode: 'short_text',
    parts: [],
    tag,
    page: 1,
    lowFields: [],
    confirmed: [],
  }
}

const last = (w: ReturnType<typeof mount>): IntakeQuestion =>
  w.emitted('update:modelValue')!.at(-1)![0] as IntakeQuestion

describe('QuestionEditor tag block (interim)', () => {
  it('starts with nothing chosen and no default tingkatan or TP', async () => {
    const w = mount(QuestionEditor, { props: { modelValue: intakeQ() } })
    await flushPromises()
    expect((w.get('[data-testid="q-form"]').element as HTMLSelectElement).value).toBe('')
    expect((w.get('[data-testid="q-unit"]').element as HTMLSelectElement).disabled).toBe(true)
    expect((w.get('[data-testid="q-tp"]').element as HTMLInputElement).value).toBe('')
  })

  it('choosing a tingkatan lists the catalogue units of that tingkatan only', async () => {
    const w = mount(QuestionEditor, { props: { modelValue: intakeQ() } })
    await w.get('[data-testid="q-form"]').setValue('T4')
    expect(last(w).tag).toMatchObject({ formOrigin: 'T4', unitId: null, spIds: [] })
    await w.setProps({ modelValue: last(w) })
    await flushPromises()
    const view = dskpSource().loaded('MAT')!
    const opts = w.get('[data-testid="q-unit"]').findAll('option')
    expect(opts).toHaveLength(view.units('T4').length + 1)
    expect(opts[1]!.attributes('value')).toBe(MAT_T4_UNIT)
  })

  it('choosing a unit and an SP stores catalogue ids and stamps the version; a new unit drops the SP', async () => {
    const w = mount(QuestionEditor, {
      props: { modelValue: intakeQ({ ...emptyTag('MAT'), formOrigin: 'T4' }) },
    })
    await flushPromises()
    await w.get('[data-testid="q-unit"]').setValue(MAT_T4_UNIT)
    const withUnit = last(w).tag
    expect(withUnit).toMatchObject({ unitId: MAT_T4_UNIT, spIds: [] })
    expect(withUnit.catalogueVersion).toBe(dskpSource().version)

    await w.setProps({ modelValue: last(w) })
    await w.get('[data-testid="q-sp-1.1.6"]').trigger('click')
    expect(last(w).tag.spIds).toEqual([MAT_T4_SP])

    await w.setProps({ modelValue: last(w) })
    await w.get('[data-testid="q-unit"]').setValue('MAT:T4:u:2.0')
    expect(last(w).tag).toMatchObject({ unitId: 'MAT:T4:u:2.0', spIds: [] })
  })

  it('changing the tingkatan clears the unit and SP; T1-T3 hides the SP list', async () => {
    const tag = { ...emptyTag('MAT'), formOrigin: 'T4' as const, unitId: MAT_T4_UNIT, spIds: [MAT_T4_SP] }
    const w = mount(QuestionEditor, { props: { modelValue: intakeQ(tag) } })
    await flushPromises()
    await w.get('[data-testid="q-form"]').setValue('T1-T3')
    expect(last(w).tag).toMatchObject({ formOrigin: 'T1-T3', unitId: null, spIds: [], catalogueVersion: null })
    await w.setProps({ modelValue: last(w) })
    expect(w.find('[data-testid="q-sp"]').exists()).toBe(false)
  })

  it('TP is stored as a number, or null when emptied', async () => {
    const w = mount(QuestionEditor, { props: { modelValue: intakeQ() } })
    await w.get('[data-testid="q-tp"]').setValue('4')
    expect(last(w).tag.tp).toBe(4)
    await w.setProps({ modelValue: last(w) })
    await w.get('[data-testid="q-tp"]').setValue('')
    expect(last(w).tag.tp).toBeNull()
  })
})
