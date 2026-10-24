/**
 * DSKP-T01: the generated catalogue holds exactly what the extracts hold (design §3.3 counts,
 * AC-01.1, AC-01.4). The expected table is committed here on purpose: it is the README table of
 * `docs/reference/dskp` (selectable SP per tingkatan) plus the unit and SK counts of the notes
 * files. A difference is printed as a table, not hidden.
 */

import { describe, expect, it } from 'vitest'

import { DSKP_SUBJECTS } from '../../dskp/subjects'
import type { DskpSubjectCode, DskpSubjectData, DskpTingkatan } from '../../dskp/types'

import { loadIndex, loadSubjects } from './helpers'

interface Expected {
  units: [number, number]
  sk: [number, number]
  sp: [number, number]
  slots: [number, number]
}

/** [T4, T5]. `sp` = README "T4 SP" / "T5 SP" columns; `slots` = BI "No learning standard". */
const EXPECTED: Record<DskpSubjectCode, Expected> = {
  MAT: { units: [10, 8], sk: [19, 16], sp: [70, 57], slots: [0, 0] },
  MTM: { units: [10, 8], sk: [30, 29], sp: [94, 77], slots: [0, 0] },
  FIZ: { units: [6, 7], sk: [30, 25], sp: [108, 97], slots: [0, 0] },
  SN: { units: [12, 9], sk: [44, 27], sp: [121, 85], slots: [0, 0] },
  BM: { units: [5, 5], sk: [25, 25], sp: [54, 48], slots: [0, 0] },
  BI: { units: [5, 5], sk: [14, 14], sp: [35, 34], slots: [2, 3] },
  SEJ: { units: [3, 4], sk: [12, 11], sp: [102, 96], slots: [0, 0] },
  PI: { units: [6, 6], sk: [25, 21], sp: [133, 106], slots: [0, 0] },
  TI: { units: [3, 3], sk: [13, 6], sp: [64, 31], slots: [0, 0] },
  PM: { units: [12, 12], sk: [12, 12], sp: [72, 72], slots: [0, 0] },
  PSV: { units: [9, 8], sk: [36, 32], sp: [65, 56], slots: [0, 0] },
  LNS: { units: [4, 3], sk: [9, 10], sp: [72, 68], slots: [0, 0] },
  KPJ: { units: [4, 4], sk: [18, 13], sp: [140, 100], slots: [0, 0] },
}

const TINGKATAN: readonly DskpTingkatan[] = ['T4', 'T5']

/** Counts recomputed from the tree, independent of the generator's own tally. */
function tally(data: DskpSubjectData, t: DskpTingkatan) {
  const units = data.units.filter((u) => u.tingkatan === t)
  const sps = units.flatMap((u) => u.sks.flatMap((s) => s.sps))
  const slots = sps.filter((p) => p.flags?.includes('noStandard')).length
  return {
    units: units.length,
    sk: units.reduce((n, u) => n + u.sks.length, 0),
    sp: sps.length - slots,
    slots,
  }
}

describe('DSKP catalogue counts (DSKP-T01)', () => {
  const subjects = loadSubjects()
  const index = loadIndex()

  it('holds the 13 subjects of docs/reference/dskp, in the configured order', () => {
    expect(index.map((s) => s.code)).toEqual(DSKP_SUBJECTS.map((s) => s.code))
    expect(subjects.map((s) => s.code)).toEqual(DSKP_SUBJECTS.map((s) => s.code))
    expect(index).toHaveLength(13)
  })

  it('matches the expected units, SK, selectable SP and slots per subject and tingkatan', () => {
    const rows = subjects.map((data) => {
      const actual = TINGKATAN.map((t) => tally(data, t))
      const exp = EXPECTED[data.code]
      return {
        subject: data.code,
        units: `${actual.map((a) => a.units).join('/')} (exp ${exp.units.join('/')})`,
        sk: `${actual.map((a) => a.sk).join('/')} (exp ${exp.sk.join('/')})`,
        sp: `${actual.map((a) => a.sp).join('/')} (exp ${exp.sp.join('/')})`,
        slots: `${actual.map((a) => a.slots).join('/')} (exp ${exp.slots.join('/')})`,
        ok:
          JSON.stringify(actual.map((a) => [a.units, a.sk, a.sp, a.slots])) ===
          JSON.stringify([0, 1].map((i) => [exp.units[i], exp.sk[i], exp.sp[i], exp.slots[i]])),
      }
    })
    const bad = rows.filter((r) => !r.ok)
    expect(bad, `count differences:\n${JSON.stringify(bad, null, 2)}`).toEqual([])
  })

  it('has index counts equal to the counts recomputed from each tree', () => {
    for (const data of subjects) {
      const info = index.find((s) => s.code === data.code)
      expect(info, data.code).toBeDefined()
      for (const t of TINGKATAN) {
        expect(info?.counts[t], `${data.code} ${t}`).toEqual(tally(data, t))
      }
    }
  })

  it('totals 171 units, 528 SK, 2,057 selectable SP (T4 1,130, T5 927) and 5 slots', () => {
    const sum = (key: 'units' | 'sk' | 'sp' | 'slots', t?: DskpTingkatan) =>
      subjects.reduce(
        (n, data) =>
          n + TINGKATAN.filter((x) => !t || x === t).reduce((m, x) => m + tally(data, x)[key], 0),
        0,
      )
    expect(sum('units')).toBe(171)
    expect(sum('sk')).toBe(528)
    expect(sum('sp')).toBe(2057)
    expect(sum('sp', 'T4')).toBe(1130)
    expect(sum('sp', 'T5')).toBe(927)
    expect(sum('slots')).toBe(5)
    // 2,062 SP rows in the extracts = 2,057 selectable + 5 slots.
    expect(sum('sp') + sum('slots')).toBe(2062)
  })

  it('keeps tingkatan 4 units before tingkatan 5 units in every file', () => {
    for (const data of subjects) {
      const levels = data.units.map((u) => u.tingkatan)
      expect(levels, data.code).toEqual([...levels].sort())
    }
  })

  it('holds a unit, SK and SP under every node (no empty branches)', () => {
    for (const data of subjects) {
      for (const u of data.units) {
        expect(u.sks.length, `${data.code} ${u.tingkatan} ${u.code}`).toBeGreaterThan(0)
        for (const s of u.sks) expect(s.sps.length, `${data.code} ${s.code}`).toBeGreaterThan(0)
      }
    }
  })
})
