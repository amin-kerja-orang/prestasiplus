/**
 * DSKP-T02: TP descriptor resolution (design §2.4 and §3.3 `tp.test.ts`, AC-02.1 to AC-02.5).
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { dskpCatalog } from '../../dskp'
import type {
  DskpSpId,
  DskpSubjectCode,
  DskpSubjectView,
  DskpTingkatan,
  DskpUnitId,
} from '../../dskp'
import { dskpKey } from '../../dskp/keys'
import { DSKP_SUBJECTS } from '../../dskp/subjects'
import { matchTpRow, pickTpTable } from '../../dskp/tp'
import type { TpDescriptor, TpTable } from '../../dskp/types'

const TINGKATAN: readonly DskpTingkatan[] = ['T4', 'T5']
const TPS = [1, 2, 3, 4, 5, 6] as const
const views = new Map<string, DskpSubjectView>()

beforeAll(async () => {
  for (const cfg of DSKP_SUBJECTS) views.set(cfg.code, await dskpCatalog.load(cfg.code))
})

const view = (code: DskpSubjectCode) => views.get(code) as DskpSubjectView
const unitId = (code: DskpSubjectCode, t: DskpTingkatan, c: string) => dskpKey(code, t, 'u', c)
const spId = (code: DskpSubjectCode, t: DskpTingkatan, c: string) => dskpKey(code, t, 'sp', c)

/** Units where the DSKP prints no TP table of its own (the general table or nothing applies). */
const NO_UNIT_TABLE = new Set(['BM:T4:u:4.0', 'BM:T5:u:4.0', 'BM:T4:u:5.0', 'BM:T5:u:5.0'])
const UNALIGNED = new Set(['LNS:T4:u:1.0', 'LNS:T4:u:3.0', 'LNS:T4:u:4.0', 'LNS:T5:u:7.0'])

describe('every TP 1 to 6 resolves to its own descriptor (AC-02.1, AC-02.5)', () => {
  it('unit-level subjects: one unit descriptor per TP, except the documented exceptions', () => {
    const exceptions: string[] = []
    for (const cfg of DSKP_SUBJECTS.filter((c) => c.tpLevel === 'unit')) {
      const v = view(cfg.code)
      for (const t of TINGKATAN) {
        for (const un of v.units(t)) {
          if (NO_UNIT_TABLE.has(un.id) || un.id === 'BI:T4:u:5.0' || un.id === 'BI:T5:u:5.0')
            continue
          // Resolve against each SK's first SP (Katering Modul 1.0 has one table per SK group).
          const sps = v.sks(un.id).map((k) => v.sps(un.id).find((p) => p.skId === k.id))
          const targets = sps.filter((p) => p !== undefined).map((p) => [p?.id])
          for (const spIds of targets.length > 0 ? targets : [[]]) {
            for (const tp of TPS) {
              const got = v.tpFor({ unitId: un.id, spIds }, tp)
              const ok =
                got.length === 1 &&
                got[0]?.source === 'unit' &&
                got[0].nodeId === un.id &&
                (got[0].descriptor.tp === tp ||
                  (got[0].descriptor.range !== undefined &&
                    tp >= got[0].descriptor.range[0] &&
                    tp <= got[0].descriptor.range[1]))
              if (!ok) exceptions.push(`${un.id} TP${String(tp)}`)
            }
          }
        }
      }
    }
    // Only the Landskap units whose rows the DSKP prints pooled (no TP number) have no per-TP
    // descriptor. T5 7.0 prints "1-4", 5 and 6, so every TP resolves there.
    expect([...new Set(exceptions.map((e) => e.replace(/ TP\d$/, '')))].sort()).toEqual([
      'LNS:T4:u:1.0',
      'LNS:T4:u:3.0',
      'LNS:T4:u:4.0',
    ])
    expect(UNALIGNED.has('LNS:T5:u:7.0')).toBe(true)
  })

  it('SK-level subjects: one SK descriptor per TP for every SK that has an SP', () => {
    for (const cfg of DSKP_SUBJECTS.filter((c) => c.tpLevel === 'sk')) {
      const v = view(cfg.code)
      for (const t of TINGKATAN) {
        for (const un of v.units(t)) {
          for (const k of v.sks(un.id)) {
            const first = v.sps(un.id).find((p) => p.skId === k.id)
            if (!first) continue
            for (const tp of TPS) {
              const got = v.tpFor({ unitId: un.id, spIds: [first.id] }, tp)
              expect(got.map((r) => [r.source, r.nodeId, r.descriptor.tp])).toEqual([
                ['sk', k.id, tp],
              ])
            }
          }
        }
      }
    }
  })
})

describe('fallbacks and exceptions (AC-02.3, AC-02.4)', () => {
  it('Bahasa Melayu 4.0 and 5.0 print no TP and fall back to the general table', () => {
    const v = view('BM')
    for (const code of ['4.0', '5.0']) {
      for (const tp of TPS) {
        const got = v.tpFor({ unitId: unitId('BM', 'T4', code) }, tp)
        expect(got).toHaveLength(1)
        expect(got[0]?.source).toBe('general')
        expect(got[0]?.nodeId).toBeNull()
        expect(got[0]?.descriptor.tp).toBe(tp)
        expect(got[0]?.descriptor.text).toBeTruthy()
      }
    }
    // 1.0 to 3.0 keep their own table.
    expect(v.tpFor({ unitId: unitId('BM', 'T4', '1.0') }, 3)[0]?.source).toBe('unit')
  })

  it('Bahasa Inggeris 5.0 has no unit table and no general table: nothing to show', () => {
    const v = view('BI')
    for (const t of TINGKATAN) {
      for (const tp of TPS) expect(v.tpFor({ unitId: unitId('BI', t, '5.0') }, tp)).toEqual([])
    }
    expect(v.tpFor({ unitId: unitId('BI', 'T4', '1.0') }, 2)[0]?.source).toBe('unit')
  })

  it('Sejarah SP of two SK gives two descriptors; one SK gives one', () => {
    const v = view('SEJ')
    const un = unitId('SEJ', 'T4', 'Tajuk 9')
    const one = v.tpFor({ unitId: un, spIds: [spId('SEJ', 'T4', '9.1.1')] }, 3)
    expect(one).toHaveLength(1)
    const two = v.tpFor(
      { unitId: un, spIds: [spId('SEJ', 'T4', '9.1.1'), spId('SEJ', 'T4', '9.2.1')] },
      3,
    )
    expect(two.map((r) => r.nodeId)).toEqual([
      dskpKey('SEJ', 'T4', 'sk', '9.1'),
      dskpKey('SEJ', 'T4', 'sk', '9.2'),
    ])
    expect(two[0]?.descriptor.text).not.toBe(two[1]?.descriptor.text)
    // Two SPs of the same SK are still one descriptor.
    expect(
      v.tpFor({ unitId: un, spIds: [spId('SEJ', 'T4', '9.1.1'), spId('SEJ', 'T4', '9.1.2')] }, 3),
    ).toHaveLength(1)
  })

  it('SK-level subjects show nothing until an SP is chosen, even though a general table exists', () => {
    const v = view('PI')
    const un = v.units('T4')[0]
    expect(un && v.tpFor({ unitId: un.id }, 2)).toEqual([])
    expect(un && v.tpFor({ unitId: un.id, spIds: [] }, 2)).toEqual([])
  })

  it('Katering Modul 1.0: an SP of SK 1.1 and an SP of SK 1.2 pick different tables', () => {
    const v = view('KPJ')
    const un = unitId('KPJ', 'T4', '1.0')
    const a = v.tpFor(
      { unitId: un, spIds: [v.sps(un).find((p) => p.code.startsWith('1.1.'))?.id as DskpSpId] },
      2,
    )
    const b = v.tpFor(
      { unitId: un, spIds: [v.sps(un).find((p) => p.code.startsWith('1.2.'))?.id as DskpSpId] },
      2,
    )
    const c = v.tpFor(
      { unitId: un, spIds: [v.sps(un).find((p) => p.code.startsWith('1.3.'))?.id as DskpSpId] },
      2,
    )
    expect(a).toHaveLength(1)
    expect(b).toHaveLength(1)
    expect(a[0]?.descriptor.text).not.toBe(b[0]?.descriptor.text)
    expect(c[0]?.descriptor.text).toBe(b[0]?.descriptor.text) // SK 1.2 and 1.3 share a table
    // One SP from each table: two descriptors.
    const both = v.tpFor(
      {
        unitId: un,
        spIds: [
          v.sps(un).find((p) => p.code.startsWith('1.1.'))?.id as DskpSpId,
          v.sps(un).find((p) => p.code.startsWith('1.2.'))?.id as DskpSpId,
        ],
      },
      2,
    )
    expect(both).toHaveLength(2)
  })

  it('Landskap: T5 7.0 TP 3 matches the "1-4" row; the pooled T4 rows have no per-TP descriptor', () => {
    const v = view('LNS')
    const t5 = v.tpFor({ unitId: unitId('LNS', 'T5', '7.0') }, 3)
    expect(t5).toHaveLength(1)
    expect(t5[0]?.descriptor.range).toEqual([1, 4])
    expect(t5[0]?.descriptor.tp).toBeNull()
    expect(v.tpFor({ unitId: unitId('LNS', 'T5', '7.0') }, 5)[0]?.descriptor.tp).toBe(5)
    for (const tp of TPS) {
      expect(v.tpFor({ unitId: unitId('LNS', 'T4', '1.0') }, tp)).toEqual([])
    }
  })

  it('returns an empty list for a TP outside 1 to 6 or a unit that does not exist', () => {
    const v = view('MAT')
    const un = unitId('MAT', 'T4', '1.0')
    for (const tp of [0, 7, -1, 2.5, Number.NaN]) expect(v.tpFor({ unitId: un }, tp)).toEqual([])
    expect(v.tpFor({ unitId: 'MAT:T4:u:99.0' as DskpUnitId }, 2)).toEqual([])
  })

  it('ignores an SP that belongs to another unit', () => {
    const v = view('SEJ')
    const un = unitId('SEJ', 'T4', 'Tajuk 9')
    const other = v.units('T4').find((x) => x.id !== un)
    const foreign = v.sps(other?.id as DskpUnitId)[0]
    const got = v.tpFor({ unitId: un, spIds: [foreign?.id as DskpSpId] }, 3)
    expect(got).toEqual([]) // SK-level subject, no SP of this unit chosen
  })

  it('is help text only: resolving does not change the node or the TP', () => {
    const v = view('MAT')
    const un = unitId('MAT', 'T4', '1.0')
    const before = JSON.stringify(v.unit(un))
    v.tpFor({ unitId: un }, 3)
    expect(JSON.stringify(v.unit(un))).toBe(before)
  })
})

describe('table and row selection helpers', () => {
  const t1: TpTable = { appliesToSk: ['1.1'], rows: [{ tp: 1, text: 'a' }] }
  const t2: TpTable = { appliesToSk: ['1.2', '1.3'], rows: [{ tp: 1, text: 'b' }] }
  const open: TpTable = { rows: [{ tp: 1, text: 'c' }] }

  it('pickTpTable', () => {
    expect(pickTpTable(undefined)).toBeUndefined()
    expect(pickTpTable([])).toBeUndefined()
    expect(pickTpTable([open])).toBe(open)
    expect(pickTpTable([t1, t2], '1.3')).toBe(t2)
    expect(pickTpTable([t1, t2], '1.1')).toBe(t1)
    expect(pickTpTable([t1, t2, open], '2.1')).toBe(open)
    expect(pickTpTable([t1, t2], '2.1')).toBeUndefined()
    expect(pickTpTable([t1, t2])).toBeUndefined()
    expect(pickTpTable([t1, t2, open])).toBe(open)
  })

  it('matchTpRow prefers an exact TP over a range', () => {
    const rows: TpDescriptor[] = [
      { tp: null, range: [1, 4], text: 'range' },
      { tp: 3, text: 'three' },
    ]
    expect(matchTpRow(rows, 3)?.text).toBe('three')
    expect(matchTpRow(rows, 2)?.text).toBe('range')
    expect(matchTpRow(rows, 5)).toBeUndefined()
    expect(matchTpRow(undefined, 1)).toBeUndefined()
  })
})

describe('resolved descriptors are read-only', () => {
  it('freezes the descriptor for the general, unit and sk sources', () => {
    const general = view('BM').tpFor({ unitId: unitId('BM', 'T4', '4.0') }, 2)
    const unit = view('MAT').tpFor({ unitId: unitId('MAT', 'T4', '1.0') }, 2)
    const sk = view('SEJ').tpFor(
      { unitId: unitId('SEJ', 'T4', 'Tajuk 9'), spIds: [spId('SEJ', 'T4', '9.1.1')] },
      2,
    )
    expect(general.map((r) => r.source)).toEqual(['general'])
    expect(unit.map((r) => r.source)).toEqual(['unit'])
    expect(sk.map((r) => r.source)).toEqual(['sk'])
    for (const r of [...general, ...unit, ...sk]) {
      expect(Object.isFrozen(r.descriptor)).toBe(true)
      expect(() => {
        ;(r.descriptor as { text: string }).text = 'x'
      }).toThrow(TypeError)
    }
  })
})
