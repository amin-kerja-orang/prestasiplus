// @vitest-environment jsdom
/**
 * DSKP-T07: the Tag DSKP block of `QuestionEditor` (UX spec 3): field order, no defaults, the clearing
 * notices, T1-T3, the TP descriptor, the KBAT select, the AI badges and confirmations, the catalogue
 * loading and error states and the Jawi blocks. Reads the real catalogue through `dskp-source`.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import QuestionEditor from '../admin/intake/components/QuestionEditor.vue'
import type { IntakeQuestion } from '../admin/intake/types'
import { emptyTag } from '../domain/tag-edit'
import type { CurriculumTag, DskpUnitId, TpLevel } from '../domain/types'
import { dskpSource } from '../lib/dskp-source'
import type { DskpSubjectState } from '../lib/dskp-source'
import {
  MAT_T4_OTHER_UNIT,
  MAT_T4_SP,
  MAT_T4_UNIT,
  errorState,
  loadedState,
  loadingState,
  matTag,
} from './tag-fixtures'

function intakeQ(tag: CurriculumTag = emptyTag('MAT'), extra: Partial<IntakeQuestion> = {}): IntakeQuestion {
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
    ...extra,
  }
}

async function mountBlock(
  q: IntakeQuestion,
  state?: DskpSubjectState,
  props: Record<string, unknown> = {},
) {
  const dskp = state ?? (await loadedState(q.tag.subject))
  const w = mount(QuestionEditor, { props: { modelValue: q, dskp, ...props }, attachTo: document.body })
  await flushPromises()
  return w
}
const last = (w: Awaited<ReturnType<typeof mountBlock>>): IntakeQuestion =>
  w.emitted('update:modelValue')!.at(-1)![0] as IntakeQuestion
/** Apply the last emitted question, as the page does (v-model). */
async function sync(w: Awaited<ReturnType<typeof mountBlock>>): Promise<void> {
  await w.setProps({ modelValue: last(w) })
  await flushPromises()
}
const sel = (w: Awaited<ReturnType<typeof mountBlock>>, id: string) =>
  w.get(`[data-testid="${id}"]`).element as HTMLSelectElement
const text = (w: Awaited<ReturnType<typeof mountBlock>>, id: string): string =>
  w.get(`[data-testid="${id}"]`).text()

describe('Tag DSKP block: structure and defaults', () => {
  it('has the legend, the fixed subject and nothing chosen or defaulted', async () => {
    const w = await mountBlock(intakeQ())
    expect(w.get('legend').text()).toBe('Tag DSKP')
    expect(text(w, 'tag-subject')).toBe('Subjek: Matematik')
    expect(sel(w, 'q-form').value).toBe('')
    expect(sel(w, 'q-unit').value).toBe('')
    expect(sel(w, 'q-unit').disabled).toBe(true)
    expect(sel(w, 'q-tp').value).toBe('')
    expect(sel(w, 'q-kbat').value).toBe('')
    expect(w.findAll('[data-testid="q-form"] option').map((o) => o.text())).toEqual([
      'Pilih tingkatan',
      'Tingkatan 4',
      'Tingkatan 5',
      'Tingkatan 1-3 (di luar DSKP)',
    ])
  })

  it('keeps the field order of the spec in the DOM (tab order)', async () => {
    const w = await mountBlock(intakeQ(matTag()))
    const ids = ['q-form', 'q-unit', 'sp-search', 'q-tp', 'q-kbat']
    const found = w.findAll('[data-testid="tag-block"] select, [data-testid="tag-block"] input[type="search"]')
    expect(found.map((n) => n.attributes('data-testid'))).toEqual(ids)
  })

  it('TP is a select "Pilih TP" with TP 1 to TP 6 and stores a number, or null when emptied', async () => {
    const w = await mountBlock(intakeQ())
    expect(w.findAll('[data-testid="q-tp"] option').map((o) => o.text())).toEqual([
      'Pilih TP',
      'TP 1',
      'TP 2',
      'TP 3',
      'TP 4',
      'TP 5',
      'TP 6',
    ])
    await w.get('[data-testid="q-tp"]').setValue('4')
    expect(last(w).tag.tp).toBe(4)
    await sync(w)
    await w.get('[data-testid="q-tp"]').setValue('')
    expect(last(w).tag.tp).toBeNull()
  })

  it('KBAT is the optional level select, independent of TP', async () => {
    const w = await mountBlock(intakeQ())
    expect(w.findAll('[data-testid="q-kbat"] option').map((o) => o.text())).toEqual([
      'Bukan KBAT',
      'Mengaplikasi',
      'Menganalisis',
      'Menilai',
      'Mencipta',
    ])
    expect(w.text()).toContain('Aras KBAT (pilihan)')
    expect(w.text()).toContain('Tidak ditentukan oleh TP.')
    await w.get('[data-testid="q-kbat"]').setValue('menilai')
    expect(last(w).tag).toMatchObject({ kbat: 'menilai', tp: null })
    await sync(w)
    await w.get('[data-testid="q-kbat"]').setValue('')
    expect(last(w).tag.kbat).toBeNull()
  })

  it('marks the required fields (Tingkatan, TP; Unit and SP only for T4/T5)', async () => {
    const w = await mountBlock(intakeQ())
    const stars = (id: string) =>
      w.get(`label[for="${w.get(`[data-testid="${id}"]`).attributes('id')}"]`).text().includes('*')
    expect(stars('q-form')).toBe(true)
    expect(stars('q-tp')).toBe(true)
    expect(stars('q-kbat')).toBe(false)
    expect(stars('q-unit')).toBe(false)
    await w.get('[data-testid="q-form"]').setValue('T4')
    await sync(w)
    expect(stars('q-unit')).toBe(true)
    expect(text(w, 'q-sp')).toContain('*')
  })
})

describe('Tag DSKP block: unit, SP and SK', () => {
  it('choosing a tingkatan lists the units of that tingkatan only, grouped as printed', async () => {
    const w = await mountBlock(intakeQ())
    await w.get('[data-testid="q-form"]').setValue('T4')
    expect(last(w).tag).toMatchObject({ formOrigin: 'T4', unitId: null, spIds: [] })
    await sync(w)
    const view = dskpSource().loaded('MAT')!
    const unitOptions = w.findAll('[data-testid="q-unit"] option')
    // blank option + one per T4 unit
    expect(unitOptions).toHaveLength(view.units('T4').length + 1)
    expect(unitOptions[1]!.attributes('value')).toBe(MAT_T4_UNIT)
    expect(unitOptions[1]!.text()).toBe('1.0 - Fungsi dan Persamaan Kuadratik dalam Satu Pemboleh Ubah')
    const groups = w.findAll('[data-testid="q-unit"] optgroup')
    expect(groups.map((g) => g.attributes('label'))[0]).toBe('PERKAITAN DAN ALGEBRA')
    expect(w.text()).toContain('Mengikut Tajuk dalam DSKP')
    expect(sel(w, 'q-unit').disabled).toBe(false)
  })

  it('a stored unit that the catalogue no longer lists is shown as a disabled option, not cleared', async () => {
    const gone = 'MAT:T4:u:99.0' as DskpUnitId
    const w = await mountBlock(intakeQ({ ...emptyTag('MAT'), formOrigin: 'T4', unitId: gone }))
    const opt = w.get(`[data-testid="q-unit"] option[value="${gone}"]`)
    expect(opt.text()).toBe('MAT:T4:u:99.0 (tidak dijumpai dalam katalog)')
    expect(opt.attributes('disabled')).toBeDefined()
  })

  it('choosing a unit stamps the catalogue version; the SP list is that unit only', async () => {
    const w = await mountBlock(intakeQ({ ...emptyTag('MAT'), formOrigin: 'T4' }))
    expect(text(w, 'q-sp')).toContain('Pilih unit dahulu untuk melihat SP.')
    await w.get('[data-testid="q-unit"]').setValue(MAT_T4_UNIT)
    expect(last(w).tag).toMatchObject({ unitId: MAT_T4_UNIT, spIds: [] })
    expect(last(w).tag.catalogueVersion).toBe(dskpSource().version)
    await sync(w)
    expect(w.findAll('[data-testid^="sp-option-"]')).toHaveLength(8)
  })

  it('picking SP keeps catalogue print order, derives the SK and drops it again on untick', async () => {
    const w = await mountBlock(intakeQ({ ...emptyTag('MAT'), formOrigin: 'T4', unitId: MAT_T4_UNIT }))
    expect(text(w, 'q-sk')).toContain('Dipaparkan selepas SP dipilih.')
    await w.get('[data-testid="sp-option-1.1.6"]').trigger('click')
    await sync(w)
    await w.get('[data-testid="sp-option-1.1.2"]').trigger('click')
    expect(last(w).tag.spIds.map((id) => id.split(':').pop())).toEqual(['1.1.2', '1.1.6'])
    await sync(w)
    const rows = w.findAll('[data-testid="sk-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('1.1')
    expect(rows[0]!.text()).toContain('Fungsi dan Persamaan Kuadratik')
    await w.get('[data-testid="sp-option-1.1.2"]').trigger('click')
    expect(last(w).tag.spIds).toEqual([MAT_T4_SP])
  })

  it('changing the unit clears the SP and says so under the unit; the next change removes the notice', async () => {
    const w = await mountBlock(intakeQ(matTag()))
    await w.get('[data-testid="q-unit"]').setValue(MAT_T4_OTHER_UNIT)
    expect(last(w).tag).toMatchObject({ unitId: MAT_T4_OTHER_UNIT, spIds: [] })
    await sync(w)
    expect(w.get('[data-testid="tag-notice"]').text()).toBe('SP dikosongkan kerana unit berubah.')
    expect(w.get('[data-testid="tag-notice"]').attributes('role')).toBe('status')
    await w.get('[data-testid="q-tp"]').setValue('2')
    await sync(w)
    expect(w.find('[data-testid="tag-notice"]').exists()).toBe(false)
  })

  it('changing the tingkatan clears unit and SP and tells the reviewer; no notice when nothing was set', async () => {
    const w = await mountBlock(intakeQ(matTag()))
    await w.get('[data-testid="q-form"]').setValue('T5')
    expect(last(w).tag).toMatchObject({ formOrigin: 'T5', unitId: null, spIds: [], catalogueVersion: null })
    await sync(w)
    expect(w.get('[data-testid="tag-notice"]').text()).toBe(
      'Unit dan SP dikosongkan kerana tingkatan berubah.',
    )

    const fresh = await mountBlock(intakeQ())
    await fresh.get('[data-testid="q-form"]').setValue('T4')
    await sync(fresh)
    expect(fresh.find('[data-testid="tag-notice"]').exists()).toBe(false)
  })

  it('keeps TP and KBAT when the tingkatan changes', async () => {
    const w = await mountBlock(intakeQ(matTag({ tp: 5, kbat: 'menilai' })))
    await w.get('[data-testid="q-form"]').setValue('T5')
    expect(last(w).tag).toMatchObject({ tp: 5, kbat: 'menilai' })
  })
})

describe('Tag DSKP block: T1-T3 (outside DSKP)', () => {
  it('shows unit, SP and SK disabled and empty with one caption; TP stays required', async () => {
    const w = await mountBlock(intakeQ(matTag()))
    await w.get('[data-testid="q-form"]').setValue('T1-T3')
    await sync(w)
    expect(last(w).tag).toMatchObject({ formOrigin: 'T1-T3', unitId: null, spIds: [] })
    expect(sel(w, 'q-unit').disabled).toBe(true)
    expect(sel(w, 'q-unit').value).toBe('')
    expect((w.get('[data-testid="sp-search"]').element as HTMLInputElement).disabled).toBe(true)
    expect(w.findAll('[data-testid^="sp-option-"]')).toHaveLength(0)
    expect(w.get('[data-testid="q-sk"]').attributes('aria-disabled')).toBe('true')
    expect(text(w, 'tag-outside')).toBe(
      'Tingkatan 1-3 berada di luar DSKP. Unit dan SP tidak diperlukan; TP masih wajib.',
    )
    expect(text(w, 'tp-descriptor')).toBe('Tiada penerangan TP DSKP untuk Tingkatan 1-3.')
    const tpLabel = w.get(`label[for="${w.get('[data-testid="q-tp"]').attributes('id')}"]`)
    expect(tpLabel.text()).toContain('*')
  })

  it('switching back to T4 renders unit and SP empty', async () => {
    const w = await mountBlock(intakeQ(matTag({ formOrigin: 'T1-T3', unitId: null, spIds: [] })))
    await w.get('[data-testid="q-form"]').setValue('T4')
    await sync(w)
    expect(sel(w, 'q-unit').disabled).toBe(false)
    expect(sel(w, 'q-unit').value).toBe('')
    expect(w.find('[data-testid="tag-outside"]').exists()).toBe(false)
  })
})

describe('Tag DSKP block: TP descriptor', () => {
  it('shows the printed level descriptor at the unit level, with its source and as help text only', async () => {
    const w = await mountBlock(intakeQ(matTag({ tp: 3 })))
    const d = w.get('[data-testid="tp-descriptor"]')
    expect(d.text()).toContain('TP 3')
    expect(d.text()).toContain('Mengaplikasikan kefahaman tentang fungsi')
    expect(d.text()).toContain('Mengikut Tajuk 1.0')
    expect(sel(w, 'q-tp').getAttribute('aria-describedby')).toContain(d.attributes('id')!)
    expect(last_or_none(w)).toBeUndefined()
  })

  it('asks for a TP, or for a unit and SP, before it can show one', async () => {
    const w = await mountBlock(intakeQ(matTag({ tp: null })))
    expect(text(w, 'tp-descriptor')).toBe('Pilih TP untuk melihat penerangannya mengikut DSKP.')
    const bare = await mountBlock(intakeQ({ ...emptyTag('MAT'), formOrigin: 'T4' }))
    expect(text(bare, 'tp-descriptor')).toBe('Pilih unit dan SP untuk melihat penerangan TP.')
  })

  it('an SK-level subject (Sejarah) needs the SP before it shows the descriptor', async () => {
    const view = await dskpSource().load('SEJ')
    const unit = view.units('T4')[0]!
    const sp = view.sps(unit.id)[0]!
    const base = { ...emptyTag('SEJ'), formOrigin: 'T4' as const, unitId: unit.id, tp: 2 as TpLevel }
    const noSp = await mountBlock(intakeQ(base), await loadedState('SEJ'))
    expect(text(noSp, 'tp-descriptor')).toBe('Pilih unit dan SP untuk melihat penerangan TP.')
    const withSp = await mountBlock(
      intakeQ({ ...base, spIds: [sp.id], catalogueVersion: 'x' }),
      await loadedState('SEJ'),
    )
    expect(text(withSp, 'tp-descriptor')).toMatch(/Mengikut SK |Mengikut jadual TP am/)
  })

  it('falls back to the subject table, and says so when the DSKP prints none (Bahasa Inggeris 5.0)', async () => {
    const bm = await dskpSource().load('BM')
    const unit = bm.units('T4').find((u) => u.code === '4.0')!
    const sp = bm.sps(unit.id)[0]!
    const w = await mountBlock(
      intakeQ({
        ...emptyTag('BM'),
        formOrigin: 'T4',
        unitId: unit.id,
        spIds: [sp.id],
        tp: 3,
        catalogueVersion: 'x',
      }),
      await loadedState('BM'),
    )
    expect(text(w, 'tp-descriptor')).toContain('Mengikut jadual TP am subjek ini')

    const bi = await dskpSource().load('BI')
    const biUnit = bi.units('T4').find((u) => u.code === '5.0')!
    const none = await mountBlock(
      intakeQ({
        ...emptyTag('BI'),
        formOrigin: 'T4',
        unitId: biUnit.id,
        spIds: [bi.sps(biUnit.id)[0]!.id],
        tp: 3,
        catalogueVersion: 'x',
      }),
      await loadedState('BI'),
    )
    expect(text(none, 'tp-descriptor')).toBe('Tiada penerangan TP dalam DSKP untuk unit ini.')
  })

  it('Pendidikan Islam: the descriptor, SK and SP text are right-to-left Jawi with lang ms-Arab', async () => {
    const view = await dskpSource().load('PI')
    const unit = view.units('T4')[0]!
    const sp = view.sps(unit.id)[0]!
    const w = await mountBlock(
      intakeQ({
        ...emptyTag('PI'),
        formOrigin: 'T4',
        unitId: unit.id,
        spIds: [sp.id],
        tp: 1,
        catalogueVersion: 'x',
      }),
      await loadedState('PI'),
    )
    const rtlIn = (id: string) => w.get(`[data-testid="${id}"] [dir="rtl"]`)
    expect(rtlIn('tp-descriptor').attributes('lang')).toBe('ms-Arab')
    expect(rtlIn('q-sk').attributes('lang')).toBe('ms-Arab')
    expect(rtlIn('q-sp').attributes('lang')).toBe('ms-Arab')
    // the unit title and the labels stay left-to-right
    expect(w.get('[data-testid="q-unit"]').attributes('dir')).toBeUndefined()
    expect(text(w, 'q-sk')).toContain('perlu semakan ejaan')
  })
})

/** The descriptor never changes the chosen TP: nothing was emitted by merely showing it. */
function last_or_none(w: Awaited<ReturnType<typeof mountBlock>>): unknown {
  return w.emitted('update:modelValue')?.at(-1)
}

describe('Tag DSKP block: AI suggestions and confirmations', () => {
  const suggestion = (over: Partial<NonNullable<IntakeQuestion['tagSuggestion']>> = {}) => ({
    providerId: 'mock',
    model: 'mock',
    unitId: MAT_T4_UNIT,
    spIds: [MAT_T4_SP],
    tp: 3 as TpLevel,
    confidence: { unit: 'rendah', sp: 'rendah', tp: 'rendah' } as const,
    ...over,
  })
  const suggestedQ = (extra: Partial<IntakeQuestion> = {}) =>
    intakeQ(matTag({ tp: 3 }), {
      tagSuggestion: suggestion(),
      lowFields: ['tag.unit', 'tag.sp', 'tag.tp'],
      ...extra,
    })

  it('shows the AI badge and a confirmation per suggested field that needs one', async () => {
    const w = await mountBlock(suggestedQ())
    expect(w.findAll('[data-testid="ai-badge"]').map((b) => b.text())).toEqual([
      'Cadangan AI · Keyakinan rendah',
      'Cadangan AI · Keyakinan rendah',
      'Cadangan AI · Keyakinan rendah',
    ])
    expect(w.findAll('[data-testid^="confirm-tag."]').map((c) => c.attributes('data-testid'))).toEqual([
      'confirm-tag.unit',
      'confirm-tag.sp',
      'confirm-tag.tp',
    ])
    const t = w.text()
    expect(t).toContain('Saya sahkan unit DSKP (keyakinan rendah)')
    expect(t).toContain('Saya sahkan SP (keyakinan rendah)')
    expect(t).toContain('Saya sahkan TP (cadangan AI)')
  })

  it('ticking turns the badge into "Disahkan" and keeps the box visible', async () => {
    const w = await mountBlock(suggestedQ())
    await w.get('[data-testid="confirm-tag.tp"]').trigger('click')
    expect(last(w).confirmed).toEqual(['tag.tp'])
    await sync(w)
    expect(w.findAll('[data-testid="ai-badge"]').map((b) => b.text())).toContain('Disahkan')
    expect(w.find('[data-testid="confirm-tag.tp"]').exists()).toBe(true)
  })

  it('a field that needs no confirmation (high confidence) has the badge but no box', async () => {
    const w = await mountBlock(
      suggestedQ({
        lowFields: ['tag.tp'],
        tagSuggestion: suggestion({ confidence: { unit: 'tinggi', sp: 'tinggi', tp: 'rendah' } }),
      }),
    )
    expect(w.findAll('[data-testid="ai-badge"]')).toHaveLength(3)
    expect(w.findAll('[data-testid^="confirm-tag."]').map((c) => c.attributes('data-testid'))).toEqual([
      'confirm-tag.tp',
    ])
  })

  it('changing the value removes the badge and the box, drops a stale tick and names the AI value', async () => {
    const w = await mountBlock(suggestedQ({ confirmed: ['tag.tp'] }))
    await w.get('[data-testid="q-tp"]').setValue('5')
    expect(last(w).tag.tp).toBe(5)
    expect(last(w).confirmed).toEqual([])
    await sync(w)
    expect(w.find('[data-testid="confirm-tag.tp"]').exists()).toBe(false)
    expect(w.get('[data-testid="ai-changed"]').text()).toBe('Diubah daripada cadangan AI: 3')
    expect(w.findAll('[data-testid="ai-badge"]')).toHaveLength(2)
    // picking the AI value again returns to the suggested state, unconfirmed
    await w.get('[data-testid="q-tp"]').setValue('3')
    await sync(w)
    expect(w.find('[data-testid="ai-changed"]').exists()).toBe(false)
    expect(w.find('[data-testid="confirm-tag.tp"]').exists()).toBe(true)
  })

  it('changing the unit away from the suggestion names the suggested unit and drops its box', async () => {
    const w = await mountBlock(suggestedQ())
    await w.get('[data-testid="q-unit"]').setValue(MAT_T4_OTHER_UNIT)
    await sync(w)
    expect(w.find('[data-testid="confirm-tag.unit"]').exists()).toBe(false)
    expect(text(w, 'q-unit')).toBeDefined()
    expect(w.text()).toContain(
      'Diubah daripada cadangan AI: 1.0 - Fungsi dan Persamaan Kuadratik dalam Satu Pemboleh Ubah',
    )
  })

  it('asks for no confirmation of an empty field; says when the AI found no unit', async () => {
    const w = await mountBlock(
      intakeQ({ ...emptyTag('MAT'), tp: null }, {
        tagSuggestion: { providerId: 'mock', model: 'mock', confidence: {} },
        lowFields: ['tag.unit'],
      }),
    )
    expect(w.findAll('[data-testid^="confirm-tag."]')).toHaveLength(0)
    expect(w.get('[data-testid="ai-no-match"]').text()).toBe(
      'AI tidak menjumpai unit yang sepadan. Pilih secara manual.',
    )
  })

  it('says when the AI suggested a unit but no SP', async () => {
    const w = await mountBlock(
      intakeQ(matTag({ spIds: [], tp: 3 }), {
        tagSuggestion: suggestion({ spIds: [] }),
        lowFields: ['tag.unit'],
      }),
    )
    expect(w.get('[data-testid="ai-no-match"]').text()).toBe(
      'AI tidak menjumpai SP yang sepadan. Pilih secara manual.',
    )
  })

  it('a KBAT suggestion needs confirming at any confidence', async () => {
    const w = await mountBlock(
      intakeQ(matTag({ kbat: 'menganalisis' }), {
        tagSuggestion: suggestion({ kbat: 'menganalisis', confidence: { kbat: 'tinggi' } }),
        lowFields: ['tag.kbat'],
      }),
    )
    expect(w.text()).toContain('Saya sahkan Aras KBAT (cadangan AI)')
  })

  it('T1-T3 asks for no unit or SP confirmation, but still for TP', async () => {
    const w = await mountBlock(
      intakeQ(matTag({ formOrigin: 'T1-T3', unitId: null, spIds: [], tp: 3 }), {
        tagSuggestion: suggestion(),
        lowFields: ['tag.unit', 'tag.sp', 'tag.tp'],
      }),
    )
    expect(w.findAll('[data-testid^="confirm-tag."]').map((c) => c.attributes('data-testid'))).toEqual([
      'confirm-tag.tp',
    ])
    expect(w.findAll('[data-testid="ai-badge"]')).toHaveLength(1)
  })
})

describe('Tag DSKP block: question flag, errors and page lock', () => {
  it('shows "Perlu semakan tag" for a flagged question and removes it once the tag is complete', async () => {
    const flagged = intakeQ({ ...emptyTag('MAT'), tp: 2, review: 'perlu-semakan' })
    const w = await mountBlock(flagged)
    expect(w.get('[data-testid="tag-review-alert"]').text()).toContain('Perlu semakan tag')
    expect(w.text()).toContain('Tag soalan ini belum disahkan.')
    // tingkatan T1-T3 with TP completes the tag: the data layer clears the marker
    await w.get('[data-testid="q-form"]').setValue('T1-T3')
    expect(last(w).tag.review).toBeUndefined()
    await sync(w)
    expect(w.find('[data-testid="tag-review-alert"]').exists()).toBe(false)
  })

  it('shows the gate message under each empty required control once the page shows its issues', async () => {
    const q = intakeQ({ ...emptyTag('MAT'), formOrigin: 'T4' })
    const quiet = await mountBlock(q)
    expect(quiet.findAll('[data-testid="field-error"]')).toHaveLength(0)
    const w = await mountBlock(q, undefined, { showErrors: true })
    expect(w.findAll('[data-testid="field-error"]').map((e) => e.text())).toEqual([
      'Unit DSKP belum dipilih.',
      'Standard Pembelajaran (SP) belum dipilih.',
      'Tahap Penguasaan (TP) belum dipilih.',
    ])
    expect(sel(w, 'q-unit').getAttribute('aria-invalid')).toBe('true')
  })

  it('shows no gate message while the catalogue is loading', async () => {
    const w = await mountBlock(intakeQ({ ...emptyTag('MAT'), formOrigin: 'T4' }), loadingState(), {
      showErrors: true,
    })
    expect(w.text()).not.toContain('Unit DSKP belum dipilih.')
  })

  it('a locked page disables the controls and the chips lose their remove buttons', async () => {
    const w = await mountBlock(intakeQ(matTag()), undefined, { disabled: true })
    expect(sel(w, 'q-form').disabled).toBe(true)
    expect(sel(w, 'q-unit').disabled).toBe(true)
    expect(sel(w, 'q-tp').disabled).toBe(true)
    expect(sel(w, 'q-kbat').disabled).toBe(true)
    expect(w.find('[data-testid^="sp-remove-"]').exists()).toBe(false)
    expect(w.find('[data-testid="sp-chip-1.1.6"]').exists()).toBe(true)
    expect(text(w, 'tp-descriptor')).toContain('TP 3')
  })
})

describe('Tag DSKP block: catalogue loading and error', () => {
  it('while loading, unit, SP, SK and the descriptor are skeletons; tingkatan, TP and KBAT stay usable', async () => {
    const w = await mountBlock(intakeQ(matTag()), loadingState())
    expect(w.findAll('[aria-busy="true"]').length).toBeGreaterThanOrEqual(2)
    expect(w.find('[data-testid="q-unit"]').exists()).toBe(false)
    expect(w.find('[data-testid="sp-search"]').exists()).toBe(false)
    expect(w.findAll('[data-testid="sk-row"]')).toHaveLength(0)
    // each skeleton carries the accessible loading text (spec 3.10): unit, SK and the descriptor
    expect(text(w, 'q-sk')).toContain('Memuatkan...')
    expect(text(w, 'tp-descriptor')).toContain('Memuatkan...')
    expect(w.findAll('.sr-only').filter((n) => n.text() === 'Memuatkan...').length).toBeGreaterThanOrEqual(4)
    expect(sel(w, 'q-form').disabled).toBe(false)
    await w.get('[data-testid="q-tp"]').setValue('4')
    // the stored unit and SP are not touched while the catalogue is unknown
    expect(last(w).tag).toMatchObject({ tp: 4, unitId: MAT_T4_UNIT, spIds: [MAT_T4_SP] })
  })

  it('on a load error it shows one inline error with "Cuba Semula"; T1-T3 and TP still work', async () => {
    const w = await mountBlock(intakeQ(matTag()), errorState())
    const err = w.get('[data-testid="tag-load-error"]')
    expect(err.text()).toContain('Tidak dapat memuatkan senarai DSKP bagi subjek ini. Sila cuba semula.')
    expect(w.find('[data-testid="q-unit"]').exists()).toBe(false)
    expect(w.find('[data-testid="q-sp"]').exists()).toBe(false)
    // the load error carries the message: no "Pilih unit dan SP" under the TP
    expect(text(w, 'tp-descriptor')).toBe('')
    await err.get('button').trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
    await w.get('[data-testid="q-form"]').setValue('T1-T3')
    expect(last(w).tag).toMatchObject({ formOrigin: 'T1-T3', unitId: null, spIds: [] })
  })
})
