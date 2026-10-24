/**
 * DSKP-T01: composite keys (design A5, §2.2, AC-01.3). The runtime indexer is DSKP-T02; here the
 * keys are built straight from the generated tree with the shared `keys.ts` helpers.
 */

import { describe, expect, it } from 'vitest'

import { dskpKey, groupCode, parseDskpKey } from '../../dskp/keys'
import type { DskpKeyKind, DskpSubjectData, DskpTingkatan } from '../../dskp/types'

import { loadSubjects } from './helpers'

interface Entry {
  key: string
  subject: string
  tingkatan: DskpTingkatan
  kind: DskpKeyKind
  code: string
}

function entriesOf(data: DskpSubjectData): Entry[] {
  const out: Entry[] = []
  const add = (tingkatan: DskpTingkatan, kind: DskpKeyKind, code: string) =>
    out.push({
      key: dskpKey(data.code, tingkatan, kind, code),
      subject: data.code,
      tingkatan,
      kind,
      code,
    })
  for (const g of data.groups) add(g.tingkatan, 'g', groupCode(g.title))
  for (const u of data.units) {
    add(u.tingkatan, 'u', u.code)
    for (const s of u.sks) {
      add(u.tingkatan, 'sk', s.code)
      for (const p of s.sps) add(u.tingkatan, 'sp', p.code)
    }
  }
  return out
}

describe('DSKP keys (DSKP-T01)', () => {
  const subjects = loadSubjects()
  const all = subjects.flatMap(entriesOf)

  it('builds a unique key for every group, unit, SK and SP in the catalogue', () => {
    expect(all.length).toBeGreaterThan(2700)
    const seen = new Map<string, number>()
    for (const e of all) seen.set(e.key, (seen.get(e.key) ?? 0) + 1)
    const duplicates = [...seen].filter(([, n]) => n > 1).map(([k]) => k)
    expect(duplicates).toEqual([])
  })

  it('never has a ":" in a printed code, a subject code or a group slug', () => {
    for (const e of all) {
      expect(e.code, e.key).not.toContain(':')
      expect(e.code, e.key).not.toBe('')
    }
  })

  it('round-trips every key through parseDskpKey', () => {
    for (const e of all) {
      expect(parseDskpKey(e.key), e.key).toEqual({
        subject: e.subject,
        tingkatan: e.tingkatan,
        kind: e.kind,
        code: e.code,
      })
    }
  })

  it('rejects malformed keys', () => {
    for (const bad of [
      '',
      'MAT',
      'MAT:T4:u',
      'MAT:T6:u:1.0',
      'MAT:T4:x:1.0',
      'MAT:T4:u:',
      ':T4:u:1.0',
    ]) {
      expect(parseDskpKey(bad), bad).toBeNull()
    }
    expect(() => dskpKey('MAT', 'T4', 'u', 'a:b')).toThrow()
  })

  it('gives the same printed code in T4 and T5 two different keys (AC-01.3)', () => {
    const mat = subjects.find((s) => s.code === 'MAT') as DskpSubjectData
    const t4 = mat.units.find((u) => u.tingkatan === 'T4' && u.code === '1.0')
    const t5 = mat.units.find((u) => u.tingkatan === 'T5' && u.code === '1.0')
    expect(t4).toBeDefined()
    expect(t5).toBeDefined()
    expect(dskpKey('MAT', 'T4', 'u', '1.0')).toBe('MAT:T4:u:1.0')
    expect(dskpKey('MAT', 'T5', 'u', '1.0')).toBe('MAT:T5:u:1.0')
    expect(t4?.title).not.toBe(t5?.title)
  })

  it('separates a Pendidikan Moral unit from its SK of the same code by kind', () => {
    const pm = subjects.find((s) => s.code === 'PM') as DskpSubjectData
    const unit = pm.units.find((u) => u.tingkatan === 'T4' && u.code === '5.1')
    expect(unit?.sks.map((s) => s.code)).toEqual(['5.1'])
    expect(dskpKey('PM', 'T4', 'u', '5.1')).not.toBe(dskpKey('PM', 'T4', 'sk', '5.1'))
    expect(dskpKey('PM', 'T4', 'u', '5.1')).toBe('PM:T4:u:5.1')
    expect(dskpKey('PM', 'T4', 'sk', '5.1')).toBe('PM:T4:sk:5.1')
  })

  it('keeps printed codes such as "Tajuk 9", "K11.1.6" and "1.26" as they are', () => {
    expect(dskpKey('SEJ', 'T4', 'u', 'Tajuk 9')).toBe('SEJ:T4:u:Tajuk 9')
    expect(parseDskpKey('SEJ:T4:sp:K11.1.6')).toEqual({
      subject: 'SEJ',
      tingkatan: 'T4',
      kind: 'sp',
      code: 'K11.1.6',
    })
    const codes = new Set(all.filter((e) => e.kind === 'sk').map((e) => e.key))
    expect(codes.has('PI:T4:sk:1.26')).toBe(true)
    expect(codes.has('PI:T5:sk:1.33')).toBe(true)
  })

  it('makes group slugs from the title (diacritics and punctuation folded)', () => {
    expect(groupCode('PERKAITAN DAN ALGEBRA')).toBe('perkaitan-dan-algebra')
    expect(groupCode('WAVES, LIGHT AND OPTICS')).toBe('waves-light-and-optics')
    expect(groupCode('Sejarah dan Apresiasi Seni Visual')).toBe('sejarah-dan-apresiasi-seni-visual')
  })

  it('points every unit group index at a group of the same tingkatan', () => {
    for (const data of subjects) {
      for (const u of data.units) {
        if (u.group === undefined) continue
        const g = data.groups[u.group]
        expect(g, `${data.code} ${u.tingkatan} ${u.code}`).toBeDefined()
        expect(g?.tingkatan).toBe(u.tingkatan)
      }
    }
  })
})
