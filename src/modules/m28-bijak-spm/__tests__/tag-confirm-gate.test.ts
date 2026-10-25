/**
 * DSKP-T07: the AI confirmation part of the submit and revision gates (UX spec 3.6 and 4). A tag field
 * waits for a person until it is ticked or changed away from the AI suggestion; TP and KBAT are named
 * "Cadangan AI belum disahkan", unit and SP "Medan keyakinan rendah belum disahkan". `skipTag` leaves
 * every tag message out while the subject catalogue is not loaded (DSKP-T03 review F6).
 */
import { beforeAll, describe, expect, it } from 'vitest'

import { aiFieldState } from '../admin/intake/domain/tag-view'
import { lowToConfirm, validateBatch, validateRevision } from '../admin/intake/domain/validation'
import type { IntakeQuestion } from '../admin/intake/types'
import type { TagLookup } from '../domain/tag-rule'
import type { TpLevel } from '../domain/types'
import { MAT_T4_OTHER_UNIT, MAT_T4_SP, MAT_T4_UNIT, loadTagLookup, matTag } from './tag-fixtures'

let lookup: TagLookup
beforeAll(async () => {
  lookup = await loadTagLookup()
})

function q(extra: Partial<IntakeQuestion> = {}, tag = matTag({ tp: 3 })): IntakeQuestion {
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
    tag,
    page: 1,
    lowFields: ['tag.unit', 'tag.sp', 'tag.tp', 'tag.kbat'],
    confirmed: [],
    tagSuggestion: {
      providerId: 'mock',
      model: 'mock',
      unitId: MAT_T4_UNIT,
      spIds: [MAT_T4_SP],
      tp: 3 as TpLevel,
      kbat: 'menilai',
      confidence: { unit: 'rendah', sp: 'rendah', tp: 'rendah', kbat: 'sederhana' },
    },
    ...extra,
  }
}
const batch = (x: IntakeQuestion) => ({ questions: [x], stimuli: [], source: 'x', copyright: 'sendiri' })
const messages = (x: IntakeQuestion, skipTag = false) =>
  validateBatch(batch(x), lookup, { skipTag }).map((i) => i.message)

describe('AI confirmation gate', () => {
  it('names each unresolved suggestion; TP and KBAT use the "Cadangan AI" words', () => {
    expect(messages(q({}, matTag({ tp: 3, kbat: 'menilai' })))).toEqual([
      'Medan keyakinan rendah belum disahkan: unit DSKP.',
      'Medan keyakinan rendah belum disahkan: SP.',
      'Cadangan AI belum disahkan: TP.',
      'Cadangan AI belum disahkan: Aras KBAT.',
    ])
  })

  it('a ticked field is resolved', () => {
    const x = q({ confirmed: ['tag.unit', 'tag.sp', 'tag.tp', 'tag.kbat'] }, matTag({ tp: 3, kbat: 'menilai' }))
    expect(lowToConfirm(x)).toEqual([])
    expect(messages(x)).toEqual([])
  })

  it('a field changed away from the suggestion is resolved without a tick', () => {
    const x = q(
      { lowFields: ['tag.unit', 'tag.tp'] },
      matTag({ unitId: MAT_T4_OTHER_UNIT, spIds: [], tp: 5 }),
    )
    expect(lowToConfirm(x)).toEqual([])
    // the unit and SP are still checked by the shared tag rule, not by the confirmation
    expect(messages(x)).toEqual(['Standard Pembelajaran (SP) belum dipilih.'])
  })

  it('a value that still equals the suggestion stays unresolved after an unrelated change', () => {
    const x = q({ lowFields: ['tag.tp'], confirmed: [] }, matTag({ tp: 3 }))
    expect(lowToConfirm(x)).toEqual(['tag.tp'])
  })

  it('T1-T3 never asks for unit or SP confirmation', () => {
    const x = q(
      { lowFields: ['tag.unit', 'tag.sp', 'tag.tp'] },
      matTag({ formOrigin: 'T1-T3', unitId: null, spIds: [], tp: 3 }),
    )
    expect(lowToConfirm(x)).toEqual(['tag.tp'])
  })

  it('a field that is not a tag field still needs its tick', () => {
    const x = q({ lowFields: ['marks'], confirmed: [] }, matTag({ tp: 3 }))
    expect(lowToConfirm(x)).toEqual(['marks'])
    expect(messages(x)).toContain('Medan keyakinan rendah belum disahkan: markah.')
  })
})

describe('an empty unit has nothing to confirm (lead decision, DSKP G5)', () => {
  const empty = matTag({ formOrigin: 'T4', unitId: null, spIds: [], tp: 3 })

  it('asks for the unit by name only, never for a confirmation', () => {
    const x = q({ lowFields: ['tag.unit'], tagSuggestion: undefined }, empty)
    expect(lowToConfirm(x)).toEqual([])
    const all = messages(x)
    expect(all).toContain('Unit DSKP belum dipilih.')
    expect(all).not.toContain('Medan keyakinan rendah belum disahkan: unit DSKP.')
  })

  it('a pre-filled unit in lowFields is still confirmed', () => {
    expect(lowToConfirm(q({ lowFields: ['tag.unit'] }))).toEqual(['tag.unit'])
  })

  it('shows the no-match caption when the AI made no suggestion at all', () => {
    const x = q({ lowFields: ['tag.unit'], tagSuggestion: undefined }, empty)
    expect(aiFieldState(x, 'unit', true).noMatch).toBe(true)
    expect(aiFieldState(x, 'sp', false).noMatch).toBe(false)
    // Nothing in lowFields (a manual question): no caption; a chosen unit: no caption.
    expect(aiFieldState({ ...x, lowFields: [] }, 'unit', false).noMatch).toBe(false)
    expect(aiFieldState({ ...x, tag: matTag({ tp: 3 }) }, 'unit', true).noMatch).toBe(false)
  })
})

describe('skipTag (catalogue not loaded)', () => {
  const unitless = q({ lowFields: ['tag.tp'] }, matTag({ unitId: null, spIds: [], tp: 3 }))

  it('lists no tag message and no tag confirmation, but every other problem', () => {
    const bad = { ...unitless, stem: '' }
    const all = messages(bad)
    expect(all).toContain('Unit DSKP belum dipilih.')
    expect(all).toContain('Cadangan AI belum disahkan: TP.')
    const skipped = messages(bad, true)
    expect(skipped).toEqual(['Teks soalan kosong.'])
  })

  it('validateRevision passes the option through', () => {
    expect(validateRevision(unitless, undefined, lookup)).toContain('Soalan: Unit DSKP belum dipilih.')
    expect(validateRevision(unitless, undefined, lookup, { skipTag: true })).toEqual([])
  })
})
