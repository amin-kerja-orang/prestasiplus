/**
 * DSKP-T02: the runtime tree (design §3.3 `tree.test.ts`, §4.2, AC-01.2 to AC-01.5, AC-01.8,
 * AC-03.2, AC-03.4). The real catalogue is loaded through `dskpCatalog` and compared with the
 * committed data files and the index counts.
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

import { loadSubjects } from './helpers'

const TINGKATAN: readonly DskpTingkatan[] = ['T4', 'T5']
const raw = loadSubjects()
const views = new Map<string, DskpSubjectView>()

beforeAll(async () => {
  for (const cfg of DSKP_SUBJECTS) views.set(cfg.code, await dskpCatalog.load(cfg.code))
})

function view(code: DskpSubjectCode): DskpSubjectView {
  return views.get(code) as DskpSubjectView
}
const u = (code: DskpSubjectCode, t: DskpTingkatan, c: string) => dskpKey(code, t, 'u', c)
const sk = (code: DskpSubjectCode, t: DskpTingkatan, c: string) => dskpKey(code, t, 'sk', c)
const sp = (code: DskpSubjectCode, t: DskpTingkatan, c: string) => dskpKey(code, t, 'sp', c)

describe('subject index', () => {
  it('holds the 13 subjects in the configured order', () => {
    expect(dskpCatalog.subjects().map((s) => s.code)).toEqual(DSKP_SUBJECTS.map((s) => s.code))
    expect(dskpCatalog.subject('PI')?.name).toBe('Pendidikan Islam')
    expect(dskpCatalog.subject('XYZ')).toBeUndefined()
  })

  it('shows the same info object through the view', () => {
    for (const cfg of DSKP_SUBJECTS) {
      expect(view(cfg.code).info).toBe(dskpCatalog.subject(cfg.code))
    }
  })
})

describe('counts from the runtime tree equal the index and the data files (AC-01.4)', () => {
  it('per subject and tingkatan: units, SK, selectable SP', () => {
    const totals = { units: 0, sk: 0, sp: 0, t4: 0, t5: 0 }
    for (const cfg of DSKP_SUBJECTS) {
      const v = view(cfg.code)
      for (const t of TINGKATAN) {
        const units = v.units(t)
        const sks = units.flatMap((x) => v.sks(x.id))
        const sps = units.flatMap((x) => v.sps(x.id))
        const counts = v.info.counts[t]
        expect({ subject: cfg.code, t, units: units.length }).toEqual({
          subject: cfg.code,
          t,
          units: counts.units,
        })
        expect({ subject: cfg.code, t, sk: sks.length }).toEqual({
          subject: cfg.code,
          t,
          sk: counts.sk,
        })
        expect({ subject: cfg.code, t, sp: sps.length }).toEqual({
          subject: cfg.code,
          t,
          sp: counts.sp,
        })
        totals.units += units.length
        totals.sk += sks.length
        totals.sp += sps.length
        if (t === 'T4') totals.t4 += sps.length
        else totals.t5 += sps.length
      }
    }
    expect(totals).toEqual({ units: 171, sk: 528, sp: 2057, t4: 1130, t5: 927 })
  })

  it('every printed SP, including the five Bahasa Inggeris slots, is reachable by key', () => {
    let rows = 0
    let slots = 0
    for (const d of raw) {
      const v = view(d.code)
      for (const un of d.units) {
        for (const k of un.sks) {
          for (const p of k.sps) {
            rows += 1
            const node = v.sp(sp(d.code, un.tingkatan, p.code))
            expect(node?.text).toBe(p.text)
            expect(node?.code).toBe(p.code)
            if (p.flags?.includes('noStandard')) {
              slots += 1
              expect(node?.selectable).toBe(false)
            } else {
              expect(node?.selectable).toBe(true)
            }
          }
        }
      }
    }
    expect(rows).toBe(2062)
    expect(slots).toBe(5)
  })
})

describe('structure', () => {
  it('every SP has exactly one SK and every SK exactly one unit (AC-01.4)', () => {
    for (const cfg of DSKP_SUBJECTS) {
      const v = view(cfg.code)
      const seenSp = new Set<string>()
      const seenSk = new Set<string>()
      for (const t of TINGKATAN) {
        for (const un of v.units(t)) {
          for (const k of v.sks(un.id)) {
            expect(k.unitId).toBe(un.id)
            expect(v.sk(k.id)).toBe(k)
            expect(v.unitOf(k.id)).toBe(un)
            expect(seenSk.has(k.id)).toBe(false)
            seenSk.add(k.id)
          }
          for (const p of v.sps(un.id)) {
            const parent = v.skOf(p.id)
            expect(parent?.id).toBe(p.skId)
            expect(parent?.unitId).toBe(un.id)
            expect(v.unitOf(p.id)).toBe(un)
            expect(seenSp.has(p.id)).toBe(false)
            seenSp.add(p.id)
          }
        }
      }
    }
  })

  it('takes the SK from the tree, not from the SP code (Landskap SP 1.4.1 sits under SK 1.3)', () => {
    const v = view('LNS')
    const p = v.sp(sp('LNS', 'T4', '1.4.1'))
    expect(p).toBeDefined()
    const parent = v.skOf(p?.id as DskpSpId)
    expect(parent?.code).toBe('1.3')
    expect(parent?.id).toBe(sk('LNS', 'T4', '1.3'))
    expect(v.skOf(sp('LNS', 'T5', '7.3.1'))?.code).toBe('7.2')
  })

  it('keeps the Sejarah K-prefixed SP selectable under SK 11.1', () => {
    const v = view('SEJ')
    const id = sp('SEJ', 'T4', 'K11.1.6')
    const node = v.sp(id)
    expect(node?.selectable).toBe(true)
    expect(node?.citizenship).toBe(true)
    expect(v.skOf(id)?.code).toBe('11.1')
    expect(v.unitOf(id)?.code).toBe('Tajuk 11')
    expect(v.sps(node?.unitId as DskpUnitId)).toContain(node)
  })

  it('does not renumber Pendidikan Islam SK across forms (AC-03.4)', () => {
    const v = view('PI')
    const t4 = v.sk(sk('PI', 'T4', '1.26'))
    const t5 = v.sk(sk('PI', 'T5', '1.33'))
    expect(t4?.tingkatan).toBe('T4')
    expect(t5?.tingkatan).toBe('T5')
    expect(v.sk(sk('PI', 'T5', '1.26'))).toBeUndefined()
    expect(v.sk(sk('PI', 'T4', '1.33'))).toBeUndefined()
  })

  it('never confuses the same code in T4 and T5, or a unit and an SK of one code (AC-01.3)', () => {
    const v = view('MAT')
    const a = v.unit(u('MAT', 'T4', '1.0'))
    const b = v.unit(u('MAT', 'T5', '1.0'))
    expect(a && b && a !== b && a.title !== b.title).toBe(true)
    const pm = view('PM')
    expect(pm.unit(u('PM', 'T4', '5.1'))?.id).not.toBe(pm.sk(sk('PM', 'T4', '5.1'))?.id)
    expect(pm.unit(u('PM', 'T4', '5.1'))).toBeDefined()
    expect(pm.sk(sk('PM', 'T4', '5.1'))).toBeDefined()
  })

  it('keeps print order, never sorts codes', () => {
    for (const d of raw) {
      const v = view(d.code)
      for (const t of TINGKATAN) {
        expect(v.units(t).map((x) => x.code)).toEqual(
          d.units.filter((x) => x.tingkatan === t).map((x) => x.code),
        )
      }
      for (const un of d.units) {
        const id = u(d.code, un.tingkatan, un.code)
        expect(v.sks(id).map((x) => x.code)).toEqual(un.sks.map((x) => x.code))
        expect(v.sps(id).map((x) => x.code)).toEqual(
          un.sks.flatMap((k) =>
            k.sps.filter((p) => !p.flags?.includes('noStandard')).map((p) => p.code),
          ),
        )
      }
    }
    // The point of the rule: "10.0" does not sort before "2.0".
    const mat = view('MAT')
      .units('T4')
      .map((x) => x.code)
    expect(mat.indexOf('2.0')).toBeLessThan(mat.indexOf('10.0'))
  })

  it('joins units to their group, and only where the DSKP prints one', () => {
    const mat = view('MAT')
    const first = mat.units('T4')[0]
    expect(first?.groupId).toBeDefined()
    expect(mat.group(first?.groupId as never)?.tingkatan).toBe('T4')
    expect(mat.groups('T4').length).toBeGreaterThan(0)
    expect(view('LNS').groups('T4')).toEqual([])
    expect(
      view('LNS')
        .units('T4')
        .every((x) => x.groupId === undefined),
    ).toBe(true)
    expect(
      view('PM')
        .groups('T4')
        .some((g) => g.code === '5.0'),
    ).toBe(true)
    const groupIds = new Set<string>()
    for (const t of TINGKATAN) for (const g of mat.groups(t)) groupIds.add(g.id)
    for (const t of TINGKATAN) {
      for (const x of mat.units(t)) expect(groupIds.has(x.groupId as string)).toBe(true)
    }
  })

  it('hides the Bahasa Inggeris slots from sps() but keeps them in sp()', () => {
    const v = view('BI')
    const slot = v.sp(sp('BI', 'T4', '1.1.4'))
    expect(slot?.selectable).toBe(false)
    expect(slot?.flags).toContain('noStandard')
    expect(v.sps(slot?.unitId as DskpUnitId)).not.toContain(slot)
    expect(v.sps(slot?.unitId as DskpUnitId).every((p) => p.selectable)).toBe(true)
  })

  it('does not find a node of another subject, and returns empty lists for unknown ids', () => {
    const mat = view('MAT')
    expect(mat.unit(u('SN', 'T4', '1.0'))).toBeUndefined()
    expect(mat.sp(sp('SN', 'T4', '1.1.1'))).toBeUndefined()
    expect(mat.sks('nope' as DskpUnitId)).toEqual([])
    expect(mat.sps('nope' as DskpUnitId)).toEqual([])
    expect(mat.skOf('nope' as DskpSpId)).toBeUndefined()
    expect(mat.unitOf('nope' as DskpSpId)).toBeUndefined()
  })

  it('skIdsOf returns unique SK ids in print order whatever the input order', () => {
    const v = view('SEJ')
    const a = sp('SEJ', 'T4', '9.1.1')
    const b = sp('SEJ', 'T4', '9.2.1')
    const a2 = sp('SEJ', 'T4', '9.1.2')
    const expected = [sk('SEJ', 'T4', '9.1'), sk('SEJ', 'T4', '9.2')]
    expect(v.skIdsOf([b, a, a2])).toEqual(expected)
    expect(v.skIdsOf([a, a2, b, b])).toEqual(expected)
    expect(v.skIdsOf(['nope' as DskpSpId, a])).toEqual([sk('SEJ', 'T4', '9.1')])
    expect(v.skIdsOf([])).toEqual([])
  })
})

describe('effectiveFlags (AC-01.8, AC-03.2, AC-03.3)', () => {
  it('reports the subject-wide Pendidikan Islam flag on every node', () => {
    const v = view('PI')
    let n = 0
    for (const t of TINGKATAN) {
      for (const un of v.units(t)) {
        expect(v.effectiveFlags(un)).toContain('perluSemakanEjaan')
        for (const k of v.sks(un.id)) {
          expect(v.effectiveFlags(k)).toContain('perluSemakanEjaan')
          n += 1
        }
        for (const p of v.sps(un.id)) {
          expect(v.effectiveFlags(p)).toContain('perluSemakanEjaan')
          expect(p.selectable).toBe(true) // the flag never blocks use
          n += 1
        }
      }
    }
    expect(n).toBeGreaterThan(200)
  })

  it('reports the tingkatan-wide draft flag on Bahasa Inggeris T4 only', () => {
    const v = view('BI')
    const t4 = v.units('T4')[0]
    const t5 = v.units('T5')[0]
    expect(v.effectiveFlags(t4 as never)).toContain('draftEdition')
    expect(v.effectiveFlags(v.sps((t4 as { id: DskpUnitId }).id)[0] as never)).toContain(
      'draftEdition',
    )
    expect(v.effectiveFlags(t5 as never)).not.toContain('draftEdition')
  })

  it('carries node flags and keeps them in canonical order', () => {
    const sains = view('SN').sp(sp('SN', 'T4', '4.3.1'))
    expect(sains && view('SN').effectiveFlags(sains)).toContain('reconstructed')
    const mtm = view('MTM')
    const inferred = mtm.units('T4').filter((x) => x.flags.includes('inferred'))
    expect(inferred.map((x) => x.code)).toEqual(['9.0', '10.0'])
    const lns = view('LNS').sp(sp('LNS', 'T4', '1.4.4'))
    expect(lns?.flags).toContain('textDefect')
    expect(view('LNS').skOf(lns?.id as DskpSpId)?.flags).toContain('codeQuirk')
  })
})

describe('read-only contract (AC-01.5)', () => {
  it('freezes the lists and the nodes', () => {
    const v = view('MAT')
    const units = v.units('T4')
    const first = units[0]
    expect(Object.isFrozen(units)).toBe(true)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first?.flags)).toBe(true)
    expect(Object.isFrozen(v.sks(first?.id as DskpUnitId))).toBe(true)
    expect(Object.isFrozen(v.sps(first?.id as DskpUnitId))).toBe(true)
    expect(Object.isFrozen(first?.tp)).toBe(true)
    expect(() => (units as unknown as unknown[]).push(1)).toThrow(TypeError)
    expect(() => {
      ;(first as unknown as { title: string }).title = 'x'
    }).toThrow(TypeError)
    expect(Object.isFrozen(dskpCatalog.subjects())).toBe(true)
    expect(Object.isFrozen(dskpCatalog.subject('MAT'))).toBe(true)
    expect(Object.isFrozen(dskpCatalog.subject('MAT')?.counts.T4)).toBe(true)
  })
})
