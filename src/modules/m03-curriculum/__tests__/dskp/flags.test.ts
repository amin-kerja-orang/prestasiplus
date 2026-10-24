/**
 * DSKP-T01: flags and the structural exceptions carried in the generated data (design §2.3, §3.3
 * `flags.test.ts` data part, AC-01.8, AC-03.2 to AC-03.4). The runtime (`effectiveFlags`, `tpFor`)
 * is DSKP-T02; here the flags are read from the committed files.
 */

import { describe, expect, it } from 'vitest'

import { FLAG_TABLE } from '../../../../../scripts/fixtures/build-m03-dskp'
import {
  DSKP_FLAG_LABELS,
  DSKP_FLAG_ORDER,
  DSKP_NON_SELECTABLE_FLAGS,
  DSKP_REVIEW_BADGE_FLAGS,
  sortFlags,
} from '../../dskp/flags'
import { dskpKey } from '../../dskp/keys'
import { DSKP_FLAGS } from '../../dskp/types'
import type {
  DskpFlag,
  DskpSk,
  DskpSp,
  DskpSubjectCode,
  DskpSubjectData,
  DskpTingkatan,
  DskpUnit,
  TpTable,
} from '../../dskp/types'

import { loadIndex, loadSubjects } from './helpers'

const subjects = loadSubjects()
const index = loadIndex()

function subject(code: DskpSubjectCode): DskpSubjectData {
  return subjects.find((s) => s.code === code) as DskpSubjectData
}

function unitOf(code: DskpSubjectCode, t: DskpTingkatan, unit: string): DskpUnit {
  const u = subject(code).units.find((x) => x.tingkatan === t && x.code === unit)
  if (!u) throw new Error(`no unit ${code} ${t} ${unit}`)
  return u
}

interface Flagged {
  key: string
  flags: DskpFlag[]
  node: DskpUnit | DskpSk | DskpSp
  kind: 'u' | 'sk' | 'sp'
}

/** Every node that carries a node-level flag, with its key. */
function flaggedNodes(): Flagged[] {
  const out: Flagged[] = []
  for (const data of subjects) {
    for (const u of data.units) {
      if (u.flags) {
        out.push({
          key: dskpKey(data.code, u.tingkatan, 'u', u.code),
          flags: u.flags,
          node: u,
          kind: 'u',
        })
      }
      for (const s of u.sks) {
        if (s.flags) {
          out.push({
            key: dskpKey(data.code, u.tingkatan, 'sk', s.code),
            flags: s.flags,
            node: s,
            kind: 'sk',
          })
        }
        for (const p of s.sps) {
          if (p.flags) {
            out.push({
              key: dskpKey(data.code, u.tingkatan, 'sp', p.code),
              flags: p.flags,
              node: p,
              kind: 'sp',
            })
          }
        }
      }
    }
  }
  return out
}

function keysWith(flag: DskpFlag): string[] {
  return flaggedNodes()
    .filter((f) => f.flags.includes(flag))
    .map((f) => f.key)
}

describe('DSKP flags in the generated data (DSKP-T01)', () => {
  it('uses only known flags, unique and in the canonical order, on every node', () => {
    for (const f of flaggedNodes()) {
      for (const flag of f.flags) expect(DSKP_FLAGS, f.key).toContain(flag)
      expect(f.flags, f.key).toEqual(sortFlags(f.flags))
    }
    for (const info of index) {
      for (const list of [info.flags, ...Object.values(info.tingkatanFlags ?? {})]) {
        if (list) expect(list, info.code).toEqual(sortFlags(list))
      }
    }
  })

  it('has a Bahasa Melayu label for every flag and a defined badge or info role', () => {
    for (const flag of DSKP_FLAGS) {
      expect(DSKP_FLAG_LABELS[flag], flag).toMatch(/\S/)
      expect(DSKP_FLAG_ORDER).toContain(flag)
    }
    expect(DSKP_NON_SELECTABLE_FLAGS).toEqual(['noStandard'])
    expect(DSKP_REVIEW_BADGE_FLAGS).not.toContain('noStandard')
    expect(DSKP_REVIEW_BADGE_FLAGS).not.toContain('codeQuirk')
  })

  it('references only existing nodes in the flag table, each with a source', () => {
    for (const e of FLAG_TABLE) {
      expect(e.source, `${e.subject} ${e.flag}`).toMatch(/\S/)
      expect(DSKP_FLAGS).toContain(e.flag)
      const info = index.find((s) => s.code === e.subject)
      expect(info, e.subject).toBeDefined()
      if (e.target.kind === 'subject') {
        expect(info?.flags, e.subject).toContain(e.flag)
      } else if (e.target.kind === 'tingkatan') {
        expect(info?.tingkatanFlags?.[e.target.tingkatan], e.subject).toContain(e.flag)
      } else {
        const key = dskpKey(e.subject, e.target.tingkatan, e.target.kind, e.target.code)
        const found = flaggedNodes().find((f) => f.key === key)
        expect(found, `flag table node ${key}`).toBeDefined()
        expect(found?.flags, key).toContain(e.flag)
      }
    }
    // And nothing is flagged that the table does not list.
    const listed = new Set(
      FLAG_TABLE.flatMap((e) =>
        e.target.kind === 'subject' || e.target.kind === 'tingkatan'
          ? []
          : [dskpKey(e.subject, e.target.tingkatan, e.target.kind, e.target.code)],
      ),
    )
    expect(flaggedNodes().filter((f) => !listed.has(f.key))).toEqual([])
  })

  describe('Pendidikan Islam (AC-03.2 to AC-03.4)', () => {
    const pi = subject('PI')
    const info = index.find((s) => s.code === 'PI')

    it('carries perluSemakanEjaan subject-wide (the indexer expands it onto every node)', () => {
      expect(info?.flags).toEqual(['perluSemakanEjaan'])
      expect(
        index.filter((s) => s.flags?.includes('perluSemakanEjaan')).map((s) => s.code),
      ).toEqual(['PI'])
    })

    it('has Arabic-script text in SK and SP, Latin unit titles, and rtlFields set', () => {
      expect(info?.language).toBe('ms-Arab')
      expect(info?.rtlFields).toEqual(['sk', 'sp', 'tp'])
      const arabic = /\p{Script=Arabic}/u
      const sks = pi.units.flatMap((u) => u.sks)
      const sps = sks.flatMap((s) => s.sps)
      expect(sks.every((s) => arabic.test(s.title))).toBe(true)
      expect(sps.filter((p) => arabic.test(p.text)).length).toBeGreaterThan(sps.length * 0.9)
      for (const u of pi.units) expect(u.title).not.toMatch(arabic)
    })

    it('keeps the SK numbering across forms as printed, no renumbering', () => {
      const t4 = pi.units
        .filter((u) => u.tingkatan === 'T4')
        .flatMap((u) => u.sks.map((s) => s.code))
      const t5 = pi.units
        .filter((u) => u.tingkatan === 'T5')
        .flatMap((u) => u.sks.map((s) => s.code))
      expect(t4).toContain('1.26')
      expect(t4).toContain('1.32')
      expect(t5).toContain('1.33')
      expect(t4).not.toContain('1.33')
      expect(t5).not.toContain('1.26')
    })
  })

  describe('Bahasa Inggeris slots and draft edition (AC-01.8)', () => {
    it('flags the five "No learning standard" slots noStandard and nothing else', () => {
      expect(keysWith('noStandard').sort()).toEqual(
        [
          'BI:T4:sp:1.1.4',
          'BI:T4:sp:2.3.2',
          'BI:T5:sp:1.1.4',
          'BI:T5:sp:1.1.5',
          'BI:T5:sp:2.3.2',
        ].sort(),
      )
      for (const f of flaggedNodes().filter((x) => x.flags.includes('noStandard'))) {
        expect((f.node as DskpSp).text).toBe('No learning standard')
      }
      const slots = subject('BI')
        .units.flatMap((u) => u.sks.flatMap((s) => s.sps))
        .filter((p) => /no learning standard/i.test(p.text))
      expect(slots).toHaveLength(5)
      expect(slots.every((p) => p.flags?.includes('noStandard'))).toBe(true)
    })

    it('marks Bahasa Inggeris T4 (only) as a draft edition at tingkatan level', () => {
      const bi = index.find((s) => s.code === 'BI')
      expect(bi?.tingkatanFlags).toEqual({ T4: ['draftEdition'] })
      expect(bi?.edition.T4).toContain('DRAF 1/2018')
      expect(bi?.edition.T5).not.toContain('DRAF')
      expect(index.filter((s) => s.tingkatanFlags).map((s) => s.code)).toEqual(['BI'])
    })
  })

  it('flags exactly the five reconstructed SP', () => {
    expect(keysWith('reconstructed').sort()).toEqual(
      [
        'SN:T4:sp:4.3.1',
        'SN:T5:sp:5.5.5',
        'SN:T5:sp:5.5.6',
        'SN:T5:sp:5.5.7',
        'PM:T5:sp:7.1.6',
      ].sort(),
    )
  })

  it('flags exactly the four Matematik Tambahan units that carry an elective package', () => {
    expect(keysWith('inferred').sort()).toEqual(
      ['MTM:T4:u:9.0', 'MTM:T4:u:10.0', 'MTM:T5:u:7.0', 'MTM:T5:u:8.0'].sort(),
    )
    const packaged = subject('MTM').units.filter((u) => u.pkg !== undefined)
    expect(packaged.map((u) => `${u.tingkatan} ${u.code}`).sort()).toEqual(
      ['T4 9.0', 'T4 10.0', 'T5 7.0', 'T5 8.0'].sort(),
    )
    expect(packaged.every((u) => u.flags?.includes('inferred'))).toBe(true)
  })

  it('flags the two data defects found in the extracts as textDefect', () => {
    expect(keysWith('textDefect').sort()).toEqual(['LNS:T4:sp:1.4.4', 'SN:T5:sk:4.2'].sort())
    const sk = unitOf('SN', 'T5', '4.0').sks.find((s) => s.code === '4.2')
    expect(sk?.title).toMatch(/OC-1x/)
    const sp = unitOf('LNS', 'T4', '1.0')
      .sks.flatMap((s) => s.sps)
      .find((p) => p.code === '1.4.4')
    expect(sp?.text).toBe('Menjelaskan punca berlakunya kemalangan dan')
  })

  it('flags the numbering quirks of Landskap and Sains as codeQuirk (informational)', () => {
    expect(keysWith('codeQuirk').sort()).toEqual(
      ['LNS:T4:sk:1.3', 'LNS:T5:sk:7.2', 'SN:T5:u:6.0'].sort(),
    )
    // Landskap SK 1.3 prints SP 1.4.x: the parent is the node, not the code text.
    const sk13 = unitOf('LNS', 'T4', '1.0').sks.find((s) => s.code === '1.3')
    expect(sk13?.sps.map((p) => p.code)).toEqual(['1.4.1', '1.4.2', '1.4.3', '1.4.4', '1.4.5'])
    const sk72 = unitOf('LNS', 'T5', '7.0').sks.find((s) => s.code === '7.2')
    expect(sk72?.sps.map((p) => p.code)[0]).toBe('7.3.1')
  })

  describe('TP structure carried in the data (AC-02.1, AC-02.3)', () => {
    function tablesOf(): { key: string; tables: TpTable[] }[] {
      const out: { key: string; tables: TpTable[] }[] = []
      for (const data of subjects) {
        for (const u of data.units) {
          if (u.tp) out.push({ key: dskpKey(data.code, u.tingkatan, 'u', u.code), tables: u.tp })
          for (const s of u.sks) {
            if (s.tp) out.push({ key: dskpKey(data.code, u.tingkatan, 'sk', s.code), tables: s.tp })
          }
        }
      }
      return out
    }

    it('puts the TP table on the unit or on the SK as the subject prints it', () => {
      for (const info of index) {
        const data = subject(info.code)
        const unitTp = data.units.filter((u) => u.tp).length
        const skTp = data.units.flatMap((u) => u.sks).filter((s) => s.tp).length
        if (info.tpLevel === 'unit') expect(skTp, info.code).toBe(0)
        else expect(unitTp, info.code).toBe(0)
      }
    })

    it('has TP 1 to 6 in order in every table, except the Landskap tpUnaligned units', () => {
      const unaligned = new Set(keysWith('tpUnaligned'))
      expect([...unaligned].sort()).toEqual(
        ['LNS:T4:u:1.0', 'LNS:T4:u:3.0', 'LNS:T4:u:4.0', 'LNS:T5:u:7.0'].sort(),
      )
      for (const { key, tables } of tablesOf()) {
        const aligned = tables.every(
          (t) =>
            t.rows.length === 6 && t.rows.every((r, i) => r.tp === i + 1 && r.range === undefined),
        )
        expect(aligned, key).toBe(!unaligned.has(key))
      }
    })

    it('keeps Landskap T4 1.0 as one pooled row (tp null) and T5 7.0 as the 1-4 range, then 5 and 6', () => {
      const pooled = unitOf('LNS', 'T4', '1.0').tp
      expect(pooled).toHaveLength(1)
      expect(pooled?.[0]?.rows).toHaveLength(1)
      expect(pooled?.[0]?.rows[0]?.tp).toBeNull()
      const seven = unitOf('LNS', 'T5', '7.0').tp?.[0]?.rows
      expect(seven?.map((r) => r.tp)).toEqual([null, 5, 6])
      expect(seven?.[0]?.range).toEqual([1, 4])
    })

    it('splits Katering Modul 1.0 into two tables (SK 1.1; SK 1.2 and 1.3), all others one', () => {
      const tp = unitOf('KPJ', 'T4', '1.0').tp
      expect(tp?.map((t) => t.appliesToSk)).toEqual([['1.1'], ['1.2', '1.3']])
      for (const u of subject('KPJ').units.filter((x) => x.code !== '1.0')) {
        expect(u.tp, u.code).toHaveLength(1)
        expect(u.tp?.[0]?.appliesToSk).toBeUndefined()
      }
    })

    it('has no TP table exactly where the DSKP prints none (BM 4.0, 5.0; BI 5.0)', () => {
      const none: string[] = []
      for (const data of subjects) {
        if (index.find((s) => s.code === data.code)?.tpLevel !== 'unit') continue
        for (const u of data.units)
          if (!u.tp) none.push(dskpKey(data.code, u.tingkatan, 'u', u.code))
      }
      expect(none.sort()).toEqual(
        [
          'BM:T4:u:4.0',
          'BM:T4:u:5.0',
          'BM:T5:u:4.0',
          'BM:T5:u:5.0',
          'BI:T4:u:5.0',
          'BI:T5:u:5.0',
        ].sort(),
      )
    })

    it('carries the Bahasa Melayu level labels on the unit rows', () => {
      const rows = unitOf('BM', 'T4', '1.0').tp?.[0]?.rows
      expect(rows?.map((r) => r.label)).toEqual([
        'Sangat Terhad',
        'Terhad',
        'Memuaskan',
        'Baik',
        'Sangat Baik',
        'Cemerlang',
      ])
    })

    it('stores the general TP table (six rows) for the seven subjects that print one', () => {
      const withGeneral = subjects.filter((s) => s.generalTp).map((s) => s.code)
      expect(withGeneral.sort()).toEqual(['BM', 'FIZ', 'MAT', 'MTM', 'PI', 'SEJ', 'SN'].sort())
      for (const s of subjects.filter((x) => x.generalTp)) {
        expect(
          s.generalTp?.map((r) => r.tp),
          s.code,
        ).toEqual([1, 2, 3, 4, 5, 6])
      }
    })
  })

  it('keeps the Sejarah K items as selectable citizenship SP under their SK', () => {
    const sk = unitOf('SEJ', 'T4', 'Tajuk 11').sks.find((s) => s.code === '11.1')
    const k = sk?.sps.find((p) => p.code === 'K11.1.6')
    expect(k).toBeDefined()
    expect(k?.citizenship).toBe(true)
    expect(k?.flags).toBeUndefined()
    for (const p of subject('SEJ').units.flatMap((u) => u.sks.flatMap((s) => s.sps))) {
      expect(p.citizenship === true, p.code).toBe(p.code.startsWith('K'))
    }
  })

  it('has the Pendidikan Moral group code and title split, one SK per unit', () => {
    const pm = subject('PM')
    expect(pm.groups.filter((g) => g.tingkatan === 'T4')).toEqual([
      { tingkatan: 'T4', code: '5.0', title: 'INSAN BERMORAL' },
      { tingkatan: 'T4', code: '6.0', title: 'JATI DIRI MORAL' },
      { tingkatan: 'T4', code: '7.0', title: 'MORAL DAN KENEGARAAN' },
    ])
    expect(pm.units.every((u) => u.sks.length === 1 && u.sks[0]?.code === u.code)).toBe(true)
  })
})
