/**
 * DSKP-T03: the one tag rule (`tagIssues`, `partitionByTagRule`), the pure edit helpers and the
 * dskp-source seam. Reads the real catalogue through `dskp-source`; the rule itself only sees the
 * narrow `TagLookup`.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { beforeAll, describe, expect, it } from 'vitest'

import { emptyTag, normaliseTag, setFormOrigin, setUnit, toggleSp, willClearOnFormOrigin } from '../domain/tag-edit'
import { TAG_MESSAGES, partitionByTagRule, tagIssues } from '../domain/tag-rule'
import type { TagLookup } from '../domain/tag-rule'
import type { CurriculumTag, KbatLevel, TpLevel } from '../domain/types'
import { catalogueVersion, tagLookup, tagLookupFor } from '../lib/dskp-source'
import {
  BI_T4_SLOT,
  MAT_T4_OTHER_SP,
  MAT_T4_OTHER_UNIT,
  MAT_T4_SP,
  MAT_T4_SP2,
  MAT_T4_UNIT,
  MAT_T5_SP,
  MAT_T5_UNIT,
  SN_T4_UNIT,
  loadTagLookup,
  matTag,
  t13Tag,
} from './tag-fixtures'

let lookup: TagLookup
beforeAll(async () => {
  lookup = await loadTagLookup()
})

const messages = (t: CurriculumTag): string[] => tagIssues(t, lookup).map((i) => i.message)
const fields = (t: CurriculumTag): string[] => tagIssues(t, lookup).map((i) => i.field)
const badTp = (n: unknown): TpLevel => n as TpLevel

describe('tagIssues: Tingkatan 4 and 5', () => {
  it('a complete T4 tag and a complete T5 tag pass', () => {
    expect(messages(matTag())).toEqual([])
    expect(messages(matTag({ formOrigin: 'T5', unitId: MAT_T5_UNIT, spIds: [MAT_T5_SP] }))).toEqual([])
  })

  it('several SP of one unit pass (no cap, Q-D6)', () => {
    expect(messages(matTag({ spIds: [MAT_T4_SP, MAT_T4_SP2] }))).toEqual([])
  })

  it('the existing messages, in the existing order, for an empty T4 tag', () => {
    expect(messages(matTag({ unitId: null, spIds: [], tp: null }))).toEqual([
      'Unit DSKP belum dipilih.',
      'Standard Pembelajaran (SP) belum dipilih.',
      'Tahap Penguasaan (TP) belum dipilih.',
    ])
  })

  it('tingkatan not chosen: one message, whatever else is set', () => {
    expect(messages(emptyTag('MAT'))).toEqual([
      'Subjek dan tingkatan perlu ditetapkan.',
      'Tahap Penguasaan (TP) belum dipilih.',
    ])
    expect(fields(matTag({ formOrigin: null }))).toEqual(['formOrigin'])
  })

  it('an unknown subject is refused with the same message', () => {
    expect(fields(matTag({ subject: 'XYZ' }))).toEqual(['subject', 'unit'])
    expect(messages(matTag({ subject: '' }))[0]).toBe('Subjek dan tingkatan perlu ditetapkan.')
  })

  it('a unit that is not in the catalogue is refused (AC-07.7)', () => {
    expect(messages(matTag({ unitId: 'MAT:T4:u:99.0' as never }))).toEqual([
      'Unit DSKP tidak wujud dalam katalog.',
    ])
    // the old prototype codes are not catalogue ids
    expect(messages(matTag({ unitId: 'MAT-T4-02' as never }))).toEqual([
      'Unit DSKP tidak wujud dalam katalog.',
    ])
  })

  it('a unit of another tingkatan or another subject is refused', () => {
    expect(messages(matTag({ unitId: MAT_T5_UNIT, spIds: [MAT_T5_SP] }))).toEqual([
      'Unit DSKP tidak wujud dalam katalog.',
    ])
    expect(messages(matTag({ unitId: SN_T4_UNIT }))).toEqual(['Unit DSKP tidak wujud dalam katalog.'])
  })

  it('an SP outside the chosen unit, unknown, or a non-selectable slot is refused', () => {
    const bad = 'SP tidak wujud dalam unit yang dipilih.'
    expect(messages(matTag({ spIds: [MAT_T4_OTHER_SP] }))).toEqual([bad])
    expect(messages(matTag({ spIds: [MAT_T4_SP, MAT_T4_OTHER_SP] }))).toEqual([bad])
    expect(messages(matTag({ spIds: ['MAT:T4:sp:9.9.9' as never] }))).toEqual([bad])
    // the Bahasa Inggeris slot exists in the catalogue but is not a learning standard
    expect(lookup.sp(BI_T4_SLOT)).toMatchObject({ selectable: false })
    expect(
      messages(
        matTag({ subject: 'BI', unitId: 'BI:T4:u:1.0' as never, spIds: [BI_T4_SLOT] }),
      ),
    ).toEqual([bad])
  })

  it('TP: not chosen, out of range, not a whole number', () => {
    expect(messages(matTag({ tp: null }))).toEqual(['Tahap Penguasaan (TP) belum dipilih.'])
    for (const tp of [0, 7, -1, 2.5, Number.NaN, '3'])
      expect(messages(matTag({ tp: badTp(tp) }))).toEqual(['Tahap Penguasaan (TP) mesti antara 1 dan 6.'])
    for (const tp of [1, 2, 3, 4, 5, 6] as const) expect(messages(matTag({ tp }))).toEqual([])
  })

  it('a flagged tag (perlu semakan, no tingkatan) never passes', () => {
    const flagged: CurriculumTag = { ...emptyTag('MAT'), tp: 2, review: 'perlu-semakan' }
    expect(messages(flagged)).toEqual(['Subjek dan tingkatan perlu ditetapkan.'])
  })
})

describe('tagIssues: Tingkatan 1-3 (outside DSKP)', () => {
  it('passes with no unit and no SP, and TP is still required', () => {
    expect(messages(t13Tag())).toEqual([])
    expect(messages(t13Tag({ tp: null }))).toEqual(['Tahap Penguasaan (TP) belum dipilih.'])
    expect(messages(t13Tag({ tp: badTp(0) }))).toEqual(['Tahap Penguasaan (TP) mesti antara 1 dan 6.'])
  })

  it('a unit or an SP on a T1-T3 tag is refused with one message', () => {
    const m = 'Tingkatan 1-3 (di luar DSKP) tidak mempunyai unit atau SP.'
    expect(messages(t13Tag({ unitId: MAT_T4_UNIT }))).toEqual([m])
    expect(messages(t13Tag({ spIds: [MAT_T4_SP] }))).toEqual([m])
    expect(messages(t13Tag({ unitId: MAT_T4_UNIT, spIds: [MAT_T4_SP] }))).toEqual([m])
  })
})

describe('tagIssues: KBAT is optional and separate', () => {
  it('null, and each of the four levels, pass; anything else is refused', () => {
    for (const k of [null, 'mengaplikasi', 'menganalisis', 'menilai', 'mencipta'] as (KbatLevel | null)[])
      expect(messages(matTag({ kbat: k }))).toEqual([])
    expect(messages(matTag({ kbat: 'Menilai' as never }))).toEqual(['Aras KBAT tidak sah.'])
    expect(messages(matTag({ kbat: 'tinggi' as never }))).toEqual(['Aras KBAT tidak sah.'])
  })

  it('KBAT never changes the other checks', () => {
    expect(messages(matTag({ unitId: null, spIds: [], kbat: 'menilai' }))).toEqual([
      'Unit DSKP belum dipilih.',
      'Standard Pembelajaran (SP) belum dipilih.',
    ])
  })
})

describe('tagIssues: a subject that is not loaded', () => {
  it('reports the unit as missing instead of guessing (the caller loads subjects first)', async () => {
    const unloaded: TagLookup = { ...tagLookup(), unit: () => undefined, sp: () => undefined }
    expect(tagIssues(matTag(), unloaded).map((i) => i.message)).toEqual([
      'Unit DSKP tidak wujud dalam katalog.',
    ])
    // tagLookupFor loads what it is asked for
    const l = await tagLookupFor(['PI'])
    expect(l.unit('PI:T4:u:1')).toMatchObject({ subject: 'PI', tingkatan: 'T4' })
  })
})

describe('partitionByTagRule (AC-07.6)', () => {
  it('reports the failing questions, skips them, and lets the rest proceed', () => {
    const items = [
      { id: 'a', tag: matTag() },
      { id: 'b', tag: matTag({ unitId: null, spIds: [] }) },
      { id: 'c', tag: t13Tag() },
      { id: 'd', tag: matTag({ tp: null }) },
    ]
    const r = partitionByTagRule(items, lookup)
    expect(r.pass.map((x) => x.id)).toEqual(['a', 'c'])
    expect(r.skipped.map((s) => s.item.id)).toEqual(['b', 'd'])
    expect(r.skipped[0]!.issues.map((i) => i.message)).toEqual([
      'Unit DSKP belum dipilih.',
      'Standard Pembelajaran (SP) belum dipilih.',
    ])
    expect(r.skipped[1]!.issues).toEqual([{ field: 'tp', message: TAG_MESSAGES.noTp }])
  })

  it('an empty list and an all-pass list', () => {
    expect(partitionByTagRule([], lookup)).toEqual({ pass: [], skipped: [] })
    const r = partitionByTagRule([{ tag: matTag() }], lookup)
    expect(r.skipped).toEqual([])
    expect(r.pass).toHaveLength(1)
  })
})

describe('tag-edit helpers', () => {
  it('emptyTag has no default for anything (AC-04.1)', () => {
    expect(emptyTag('SN')).toEqual({
      subject: 'SN',
      formOrigin: null,
      unitId: null,
      spIds: [],
      tp: null,
      kbat: null,
      catalogueVersion: null,
    })
  })

  it('a different tingkatan clears unit and SP and keeps TP and KBAT', () => {
    const t = matTag({ tp: 4, kbat: 'menilai' })
    expect(willClearOnFormOrigin(t, 'T5')).toBe(true)
    expect(willClearOnFormOrigin(t, 'T4')).toBe(false)
    expect(willClearOnFormOrigin(emptyTag('MAT'), 'T4')).toBe(false)
    expect(setFormOrigin(t, 'T5')).toMatchObject({
      formOrigin: 'T5',
      unitId: null,
      spIds: [],
      catalogueVersion: null,
      tp: 4,
      kbat: 'menilai',
    })
    expect(setFormOrigin(t, 'T4')).toBe(t)
  })

  it('a different unit keeps only the SP that belong to it', () => {
    const t = matTag({ spIds: [MAT_T4_SP, MAT_T4_SP2] })
    expect(setUnit(t, MAT_T4_OTHER_UNIT, lookup).spIds).toEqual([])
    expect(setUnit(t, MAT_T4_UNIT, lookup)).toBe(t)
    expect(setUnit(t, null, lookup)).toMatchObject({ unitId: null, spIds: [] })
  })

  it('toggleSp adds, removes and ignores a repeat', () => {
    const t = matTag({ spIds: [] })
    const a = toggleSp(t, MAT_T4_SP)
    expect(a.spIds).toEqual([MAT_T4_SP])
    expect(toggleSp(a, MAT_T4_SP2).spIds).toEqual([MAT_T4_SP, MAT_T4_SP2])
    expect(toggleSp(a, MAT_T4_SP)).toMatchObject({ spIds: [] })
    expect(toggleSp(a, MAT_T4_SP, true)).toBe(a)
    expect(toggleSp(t, MAT_T4_SP, false)).toBe(t)
  })

  it('normaliseTag: T1-T3 clears unit and SP and the version', () => {
    const t = normaliseTag(t13Tag({ unitId: MAT_T4_UNIT, spIds: [MAT_T4_SP], catalogueVersion: 'x' }), lookup, 'v1')
    expect(t).toMatchObject({ unitId: null, spIds: [], catalogueVersion: null })
  })

  it('normaliseTag: drops SP outside the unit and repeated SP, and stamps the version', () => {
    const t = normaliseTag(
      matTag({ spIds: [MAT_T4_SP, MAT_T4_OTHER_SP, MAT_T4_SP], catalogueVersion: null }),
      lookup,
      'dskp-test',
    )
    expect(t.spIds).toEqual([MAT_T4_SP])
    expect(t.catalogueVersion).toBe('dskp-test')
    // an existing stamp is kept: normalising an untouched tag does not re-date it
    expect(normaliseTag(matTag({ catalogueVersion: 'old' }), lookup, 'new').catalogueVersion).toBe('old')
    expect(catalogueVersion()).toMatch(/^dskp-/)
  })

  it('normaliseTag: no unit means no SP and no version', () => {
    expect(normaliseTag(matTag({ unitId: null, catalogueVersion: 'x' }), lookup, 'v1')).toMatchObject({
      unitId: null,
      spIds: [],
      catalogueVersion: null,
    })
  })

  it('normaliseTag clears the perlu-semakan marker only once the tag passes the rule', () => {
    const flagged: CurriculumTag = { ...emptyTag('MAT'), tp: 2, review: 'perlu-semakan' }
    expect(normaliseTag(flagged, lookup, 'v1').review).toBe('perlu-semakan')
    const part = { ...flagged, formOrigin: 'T4' as const, unitId: MAT_T4_UNIT }
    expect(normaliseTag(part, lookup, 'v1').review).toBe('perlu-semakan')
    const done = { ...part, spIds: [MAT_T4_SP] }
    expect('review' in normaliseTag(done, lookup, 'v1')).toBe(false)
    expect('review' in normaliseTag({ ...flagged, formOrigin: 'T1-T3' }, lookup, 'v1')).toBe(false)
  })

  it('the helpers do not mutate their input', () => {
    const t = Object.freeze(matTag({ spIds: [MAT_T4_SP] }))
    expect(() => {
      setFormOrigin(t, 'T5')
      setUnit(t, MAT_T4_OTHER_UNIT, lookup)
      toggleSp(t, MAT_T4_SP2)
      normaliseTag(t, lookup, 'v')
    }).not.toThrow()
  })
})

describe('the tag domain is movable to exam-core (ADR-0021)', () => {
  const read = (rel: string): string =>
    readFileSync(fileURLToPath(new URL(`../domain/${rel}`, import.meta.url)), 'utf8')

  it('tag-rule.ts, tag-edit.ts and types.ts import only relative modules (no src/**, vue, node:)', () => {
    for (const f of ['tag-rule.ts', 'tag-edit.ts', 'types.ts']) {
      const imports = [...read(f).matchAll(/^\s*(?:import|export)\b[^'"\n]*from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]!)
      for (const spec of imports) expect(spec, `${f} imports ${spec}`).toMatch(/^\.\.?\//)
    }
  })
})
