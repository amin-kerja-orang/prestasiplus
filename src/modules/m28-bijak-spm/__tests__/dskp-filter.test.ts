/**
 * DSKP-T08: the pure parts of the bank and queue DSKP filters, row badges and tag history lines
 * (UX spec 6.1, 6.2, 7.2). They read the real catalogue through `dskp-source`; nothing is copied.
 */
import { beforeAll, describe, expect, it } from 'vitest'

import type { DskpSubjectView } from '@/modules/m03-curriculum'

import {
  appliedDskp,
  clearOnForm,
  clearOnSubject,
  clearOnUnit,
  dskpChips,
  dskpServerFilter,
  emptyDskpFilter,
  formatTagValue,
  removeDskpChip,
  spBadgeText,
  spOptions,
  tagLines,
  tpCardText,
  unitBelongs,
  unitGroups,
} from '../admin/papers/dskp-filter'
import type { HistoryEntry } from '../domain/admin-types'
import { dskpSource } from '../lib/dskp-source'
import { MAT_T4_OTHER_UNIT, MAT_T4_SP, MAT_T4_SP2, MAT_T4_UNIT, MAT_T5_UNIT } from './tag-fixtures'

let mat: DskpSubjectView
beforeAll(async () => {
  mat = await dskpSource().load('MAT')
})

const entry = (tag: HistoryEntry['tag']): HistoryEntry => ({
  at: 0,
  by: 'Admin Pusat',
  version: 1,
  action: 'Dihantar untuk semakan',
  tag,
})

describe('dependency rules (6.1)', () => {
  it('unitBelongs reads the tingkatan from the unit id', () => {
    expect(unitBelongs(MAT_T4_UNIT, 'T4')).toBe(true)
    expect(unitBelongs(MAT_T4_UNIT, 'T5')).toBe(false)
    expect(unitBelongs(MAT_T4_UNIT, '')).toBe(true)
    expect(unitBelongs('', 'T5')).toBe(true)
  })

  it('a new Subjek clears Unit and SP and keeps Tingkatan, TP and KBAT', () => {
    const d = {
      ...emptyDskpFilter(),
      formOrigin: 'T4' as const,
      unitId: MAT_T4_UNIT,
      spId: MAT_T4_SP,
      tp: '3',
      kbat: 'menilai',
    }
    clearOnSubject(d)
    expect(d).toMatchObject({ formOrigin: 'T4', unitId: '', spId: '', tp: '3', kbat: 'menilai' })
  })

  it('a new Tingkatan clears Unit and SP only when the Unit belongs to the other tingkatan', () => {
    const keep = {
      ...emptyDskpFilter(),
      formOrigin: 'T4' as const,
      unitId: MAT_T4_UNIT,
      spId: MAT_T4_SP,
    }
    clearOnForm(keep)
    expect(keep).toMatchObject({ unitId: MAT_T4_UNIT, spId: MAT_T4_SP })

    const drop = {
      ...emptyDskpFilter(),
      formOrigin: 'T5' as const,
      unitId: MAT_T4_UNIT,
      spId: MAT_T4_SP,
    }
    clearOnForm(drop)
    expect(drop).toMatchObject({ unitId: '', spId: '' })

    const exempt = {
      ...emptyDskpFilter(),
      formOrigin: 'T1-T3' as const,
      unitId: MAT_T4_UNIT,
      spId: MAT_T4_SP,
    }
    clearOnForm(exempt)
    expect(exempt).toMatchObject({ unitId: '', spId: '' })
  })

  it('a new Unit clears the SP', () => {
    const d = { ...emptyDskpFilter(), unitId: MAT_T4_OTHER_UNIT, spId: MAT_T4_SP }
    clearOnUnit(d)
    expect(d.spId).toBe('')
  })
})

describe('Unit and SP options come from the catalogue', () => {
  it('one tingkatan: that tingkatan units in print order, one option per unit', () => {
    const groups = unitGroups(mat, 'T4')
    const values = groups.flatMap((g) => g.units.map((u) => u.value))
    expect(values).toEqual(mat.units('T4').map((u) => u.id))
    expect(groups[0]!.units[0]!.label).toBe(
      `${mat.units('T4')[0]!.code} - ${mat.units('T4')[0]!.title}`,
    )
  })

  it('no tingkatan: two groups, Tingkatan 4 then Tingkatan 5; T1-T3 and no subject: none', () => {
    const groups = unitGroups(mat, '')
    expect(groups.map((g) => g.label)).toEqual(['Tingkatan 4', 'Tingkatan 5'])
    expect(groups[1]!.units.map((u) => u.value)).toContain(MAT_T5_UNIT)
    expect(unitGroups(mat, 'T1-T3')).toEqual([])
    expect(unitGroups(undefined, 'T4')).toEqual([])
  })

  it('a subject that prints groups (Bidang / Tema) shows them as option groups', async () => {
    for (const s of dskpSource().subjects()) await dskpSource().load(s.code)
    const view = dskpSource()
      .subjects()
      .map((s) => dskpSource().loaded(s.code)!)
      .find((v) => v.groups('T4').length > 0)
    expect(view).toBeDefined()
    const groups = unitGroups(view, 'T4')
    expect(groups.some((g) => g.label !== null)).toBe(true)
    expect(groups.flatMap((g) => g.units)).toHaveLength(view!.units('T4').length)
  })

  it('SP options are the selectable SP of the unit, "kod - teks", ids as values', () => {
    const opts = spOptions(mat, MAT_T4_UNIT)
    expect(opts.map((o) => o.value)).toEqual(mat.sps(MAT_T4_UNIT).map((s) => s.id))
    expect(opts.map((o) => o.value)).toContain(MAT_T4_SP)
    expect(opts.find((o) => o.value === MAT_T4_SP)!.label.startsWith('1.1.6 - ')).toBe(true)
    expect(spOptions(mat, '')).toEqual([])
    expect(spOptions(undefined, MAT_T4_UNIT)).toEqual([])
  })
})

describe('chips and the server filter (6.1)', () => {
  it('chip labels are the values; the unit chip carries code and title', () => {
    const d = {
      ...emptyDskpFilter(),
      formOrigin: 'T4' as const,
      unitId: MAT_T4_UNIT,
      spId: MAT_T4_SP,
      tp: '3',
      kbat: 'menilai',
      tagReview: true,
    }
    const chips = dskpChips(appliedDskp(d, mat))
    expect(chips.map((c) => c.key)).toEqual([
      'formOrigin',
      'unitId',
      'spId',
      'tp',
      'kbat',
      'tagReview',
    ])
    expect(chips.map((c) => c.label)).toEqual([
      'Tingkatan 4',
      `Unit ${mat.unit(MAT_T4_UNIT)!.code} ${mat.unit(MAT_T4_UNIT)!.title}`,
      'SP 1.1.6',
      'TP 3',
      'KBAT: Menilai',
      'Perlu semakan tag',
    ])
    expect(dskpChips(appliedDskp({ ...emptyDskpFilter(), kbat: 'ya' }, mat))[0]!.label).toBe(
      'KBAT: Ya',
    )
    expect(dskpChips(appliedDskp({ ...emptyDskpFilter(), kbat: 'tidak' }, mat))[0]!.label).toBe(
      'KBAT: Tidak',
    )
    expect(dskpChips(appliedDskp(emptyDskpFilter(), mat))).toEqual([])
  })

  it('removing the Unit chip also removes the SP; removing others touches one field', () => {
    const d = { ...emptyDskpFilter(), unitId: MAT_T4_UNIT, spId: MAT_T4_SP, tp: '3' }
    removeDskpChip(d, 'unitId')
    expect(d).toMatchObject({ unitId: '', spId: '', tp: '3' })
    removeDskpChip(d, 'tp')
    expect(d.tp).toBe('')
  })

  it('the server filter leaves empty fields out and converts TP to a number', () => {
    expect(dskpServerFilter(emptyDskpFilter())).toEqual({})
    expect(
      dskpServerFilter({
        formOrigin: 'T5',
        unitId: MAT_T5_UNIT,
        spId: '',
        tp: '4',
        kbat: 'ya',
        tagReview: true,
      }),
    ).toEqual({ formOrigin: 'T5', unitId: MAT_T5_UNIT, tp: 4, kbat: 'ya', tagReview: true })
  })
})

describe('row badges and card text (6.2)', () => {
  it('SP: up to two codes are listed, more show the first and how many follow', () => {
    expect(spBadgeText(['1.1.6'])).toBe('SP 1.1.6')
    expect(spBadgeText(['1.1.6', '1.1.7'])).toBe('SP 1.1.6, 1.1.7')
    expect(spBadgeText(['1.1.6', '1.1.7', '1.1.8'])).toBe('SP 1.1.6 +2')
  })

  it('the card TP value appends KBAT when set', () => {
    expect(tpCardText({ tp: 3, kbat: null })).toBe('TP 3')
    expect(tpCardText({ tp: 3, kbat: 'menilai' })).toBe('TP 3 · KBAT Menilai')
    expect(tpCardText({ tp: null, kbat: null })).toBe('')
  })
})

describe('tag history lines (7.2)', () => {
  it('first tagging: one line per field in the order Tingkatan, Unit, SP, TP, Aras KBAT', () => {
    const lines = tagLines(
      entry([
        { field: 'kbat', after: 'menilai' },
        { field: 'tp', after: 3 },
        { field: 'sp', after: [MAT_T4_SP, MAT_T4_SP2] },
        { field: 'unit', after: MAT_T4_UNIT },
        { field: 'formOrigin', after: 'T4' },
      ]),
      mat,
    )
    expect(lines.map((l) => l.field)).toEqual(['formOrigin', 'unit', 'sp', 'tp', 'kbat'])
    expect(lines.map((l) => `Tag: ${l.label}: ${l.after}${l.suffix}`)).toEqual([
      'Tag: Tingkatan: Tingkatan 4',
      `Tag: Unit: ${mat.unit(MAT_T4_UNIT)!.code} - ${mat.unit(MAT_T4_UNIT)!.title}`,
      'Tag: SP: 1.1.6, 1.1.5',
      'Tag: TP: 3',
      'Tag: Aras KBAT: Menilai',
    ])
    for (const l of lines) expect(l.before).toBeUndefined()
  })

  it('a change keeps before and after; empty sides read "(kosong)" and "(bukan KBAT)"', () => {
    const lines = tagLines(
      entry([
        { field: 'tp', before: 2, after: 4 },
        { field: 'kbat', before: 'menilai', after: null },
        { field: 'unit', before: null, after: MAT_T4_UNIT },
      ]),
      mat,
    )
    const by = Object.fromEntries(lines.map((l) => [l.field, l]))
    expect(by.unit!.before).toBe('(kosong)')
    expect(by.tp).toMatchObject({ before: '2', after: '4', suffix: '' })
    expect(by.kbat).toMatchObject({ before: 'Menilai', after: '(bukan KBAT)' })
  })

  it('T1-T3 prints the exempt copy', () => {
    const [l] = tagLines(entry([{ field: 'formOrigin', after: 'T1-T3' }]), mat)
    expect(l!.after).toBe('Tingkatan 1-3 (di luar DSKP)')
  })

  it('AI suffix: rejected suggestion, accepted suggestion, and none (typed by the person)', () => {
    const lines = tagLines(
      entry([
        { field: 'tp', before: 2, after: 4, ai: 3, confidence: 'sederhana' },
        { field: 'kbat', after: 'menilai', ai: 'menilai', confidence: 'rendah' },
        { field: 'sp', after: [MAT_T4_SP] },
      ]),
      mat,
    )
    const by = Object.fromEntries(lines.map((l) => [l.field, l.suffix]))
    expect(by.tp).toBe(' (cadangan AI: 3, keyakinan sederhana)')
    expect(by.kbat).toBe(' (cadangan AI diterima, keyakinan rendah)')
    expect(by.sp).toBe('')
  })

  it('a catalogue node that is gone reads "{id} (tidak dijumpai dalam katalog)"; SP shows codes only', () => {
    expect(formatTagValue('unit', 'MAT:T4:u:99.0', mat)).toBe(
      'MAT:T4:u:99.0 (tidak dijumpai dalam katalog)',
    )
    expect(formatTagValue('sp', ['MAT:T4:sp:99.9.9', MAT_T4_SP], mat)).toBe(
      'MAT:T4:sp:99.9.9 (tidak dijumpai dalam katalog), 1.1.6',
    )
    // no view (the catalogue did not load): the printed code, never a false "not found"
    expect(formatTagValue('unit', MAT_T4_UNIT, undefined)).toBe('1.0')
    expect(formatTagValue('sp', [MAT_T4_SP], undefined)).toBe('1.1.6')
  })

  it('an entry without tag changes has no lines', () => {
    expect(tagLines(entry(undefined), mat)).toEqual([])
  })
})
