/**
 * DSKP-T02: search (design §4.2 and §3.3 `search.test.ts`): token-AND over normalised code + text,
 * scored code-exact > code-prefix > fraction of tokens, no fuzzy matching, deterministic.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { dskpCatalog, normaliseDskpText } from '../../dskp'
import type { DskpSubjectView } from '../../dskp'
import { dskpKey } from '../../dskp/keys'

let mat: DskpSubjectView
let pi: DskpSubjectView
let bi: DskpSubjectView

beforeAll(async () => {
  ;[mat, pi, bi] = await Promise.all([
    dskpCatalog.load('MAT'),
    dskpCatalog.load('PI'),
    dskpCatalog.load('BI'),
  ])
})

const ids = (hits: { node: { id: string } }[]) => hits.map((h) => h.node.id)

describe('by code', () => {
  it('finds an SP by its printed code, exact match first', () => {
    const hits = mat.search('1.1.6', { tingkatan: 'T4' })
    expect(hits[0]?.kind).toBe('sp')
    expect(hits[0]?.node.id).toBe(dskpKey('MAT', 'T4', 'sp', '1.1.6'))
    expect(hits[0]?.score).toBe(3000)
  })

  it('keeps T4 and T5 apart when the tingkatan is given, and finds both when it is not', () => {
    const t4 = mat.search('1.1.1', { tingkatan: 'T4' })
    const t5 = mat.search('1.1.1', { tingkatan: 'T5' })
    expect(t4.every((h) => h.node.tingkatan === 'T4')).toBe(true)
    expect(t5.every((h) => h.node.tingkatan === 'T5')).toBe(true)
    const both = mat.search('1.1.1')
    expect(ids(both)).toContain(dskpKey('MAT', 'T4', 'sp', '1.1.1'))
    expect(ids(both)).toContain(dskpKey('MAT', 'T5', 'sp', '1.1.1'))
  })

  it('ranks exact code above code prefix above a text match', () => {
    const hits = mat.search('1.1', { tingkatan: 'T4' })
    const scores = hits.map((h) => h.score)
    expect(hits[0]?.node.id).toBe(dskpKey('MAT', 'T4', 'sk', '1.1')) // SK 1.1 is the exact code
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
    const prefix = hits.filter((h) => h.score === 2000)
    expect(prefix.length).toBeGreaterThan(0)
    expect(prefix.every((h) => h.node.code.startsWith('1.1'))).toBe(true)
  })
})

describe('by word', () => {
  it('is case-insensitive', () => {
    const lower = mat.search('pemfaktoran')
    expect(lower.length).toBeGreaterThan(0)
    expect(ids(mat.search('PEMFAKTORAN'))).toEqual(ids(lower))
    expect(ids(mat.search('PemFaktoran'))).toEqual(ids(lower))
  })

  it('ignores accents', () => {
    expect(ids(mat.search('pemfaktóran'))).toEqual(ids(mat.search('pemfaktoran')))
    expect(normaliseDskpText('Éàü')).toBe('eau')
  })

  it('requires every token (token-AND) and does no fuzzy matching', () => {
    const one = mat.search('punca persamaan kuadratik', { tingkatan: 'T4' })
    expect(ids(one)).toContain(dskpKey('MAT', 'T4', 'sp', '1.1.6'))
    expect(mat.search('punca persamaan kuadratik zzzxqj')).toEqual([])
    expect(mat.search('pemfaktorann')).toEqual([])
  })

  it('returns nothing for an empty or blank query', () => {
    expect(mat.search('')).toEqual([])
    expect(mat.search('   ')).toEqual([])
  })

  it('finds units and SK by title as well as SP by text, and can be limited to a kind', () => {
    const all = mat.search('persamaan kuadratik', { tingkatan: 'T4' })
    expect(new Set(all.map((h) => h.kind)).size).toBeGreaterThan(1)
    const onlySp = mat.search('persamaan kuadratik', { tingkatan: 'T4', kinds: ['sp'] })
    expect(onlySp.length).toBeGreaterThan(0)
    expect(onlySp.every((h) => h.kind === 'sp')).toBe(true)
    const onlyUnits = mat.search('persamaan kuadratik', { kinds: ['u'] })
    expect(onlyUnits.every((h) => h.kind === 'u')).toBe(true)
  })
})

describe('Jawi', () => {
  it('finds Pendidikan Islam text by substring', () => {
    const hits = pi.search('سورة الأنعام', { tingkatan: 'T4' })
    expect(ids(hits)).toContain(dskpKey('PI', 'T4', 'sp', '1.26.1'))
  })

  it('ignores Arabic tashkil and tatweel', () => {
    const plain = pi.search('سورة', { tingkatan: 'T4', kinds: ['sp'] })
    expect(plain.length).toBeGreaterThan(0)
    const withMarks = pi.search('سُورَة', { tingkatan: 'T4', kinds: ['sp'] })
    expect(ids(withMarks)).toEqual(ids(plain))
    const tatweel = pi.search('سـورة', { tingkatan: 'T4', kinds: ['sp'] })
    expect(ids(tatweel)).toEqual(ids(plain))
  })
})

describe('scope and limit', () => {
  const unit = dskpKey('MAT', 'T4', 'u', '1.0')

  it('is scoped to one unit', () => {
    const hits = mat.search('persamaan', { unitId: unit })
    expect(hits.length).toBeGreaterThan(0)
    for (const h of hits) {
      const u = h.kind === 'u' ? h.node.id : h.node.unitId
      expect(u).toBe(unit)
    }
    // The same query without scope reaches other units.
    expect(mat.search('persamaan').length).toBeGreaterThan(hits.length)
  })

  it('is scoped to a unit and kind for an SP pick list', () => {
    const hits = mat.search('1.1', { unitId: unit, kinds: ['sp'] })
    expect(ids(hits).every((id) => mat.sps(unit).some((p) => p.id === id))).toBe(true)
  })

  it('honours the limit and keeps the best hits', () => {
    const all = mat.search('dan')
    expect(all.length).toBeGreaterThan(5)
    const three = mat.search('dan', { limit: 3 })
    expect(three).toHaveLength(3)
    expect(ids(three)).toEqual(ids(all).slice(0, 3))
    expect(mat.search('dan', { limit: 0 })).toEqual([])
    expect(mat.search('dan').length).toBeLessThanOrEqual(50) // default limit
  })

  it('is deterministic: same query, same order', () => {
    expect(ids(mat.search('dan', { limit: 20 }))).toEqual(ids(mat.search('dan', { limit: 20 })))
  })

  it('breaks ties in print order', () => {
    const hits = mat.search('1.1.1')
    const tied = hits.filter((h) => h.score === hits[0]?.score)
    expect(tied.map((h) => h.node.tingkatan)).toEqual(['T4', 'T5'])
  })
})

describe('non-selectable slots', () => {
  it('never returns a "No learning standard" slot', () => {
    const slot = bi.sp(dskpKey('BI', 'T4', 'sp', '1.1.4'))
    expect(slot?.selectable).toBe(false)
    expect(bi.search('No learning standard')).toEqual([])
    expect(ids(bi.search('1.1.4', { tingkatan: 'T4' }))).not.toContain(slot?.id)
  })
})
