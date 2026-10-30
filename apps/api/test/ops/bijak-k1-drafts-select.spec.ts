import { describe, expect, it } from 'vitest'

import { parseArgs, UsageError } from '../../src/ops/bijak-k1-drafts/args'
import { compareLegacy, selectPapers, spreadPositions, type Candidate } from '../../src/ops/bijak-k1-drafts/select'

/** Synthetic stock: `n` questions of one stratum with numeric legacy ids starting at `from` (the v2 id is a different number). */
const stock = (stratum: string, n: number, from: number, idBase = 900000): Candidate[] =>
  Array.from({ length: n }, (_, i) => ({ id: String(idBase + from + i), legacyId: String(from + i), stratum, dedupeKey: `${stratum}-${String(from + i)}` }))

const ids = (papers: Candidate[][]): string[][] => papers.map((p) => p.map((c) => c.id))

describe('compareLegacy', () => {
  it('orders numeric ids by value, numeric before the others, the others by code point', () => {
    const sorted = ['10', '9', 'b7', '100', 'a1', '2'].sort(compareLegacy)
    expect(sorted).toEqual(['2', '9', '10', '100', 'a1', 'b7'])
  })
  it('does not lose precision on very large numeric ids', () => {
    expect(compareLegacy('9007199254740993', '9007199254740992')).toBe(1)
  })
})

describe('spreadPositions', () => {
  it('gives k distinct, increasing, centred positions', () => {
    expect(spreadPositions(10, 5)).toEqual([1, 3, 5, 7, 9])
    expect(spreadPositions(5, 5)).toEqual([0, 1, 2, 3, 4])
    for (const [m, k] of [[40, 7], [41, 40], [1000, 80], [3, 1]] as const) {
      const p = spreadPositions(m, k)
      expect(new Set(p).size).toBe(k)
      expect(p.every((x, i) => x >= 0 && x < m && (i === 0 || x > p[i - 1]!))).toBe(true)
    }
  })
})

describe('selectPapers', () => {
  const quota = { t1_t3: 17, t4: 13, t5: 10 }
  const rich = [...stock('t1_t3', 300, 1000), ...stock('t4', 300, 2000), ...stock('t5', 300, 3000)]

  it('builds the requested papers, each with the full count and the level quota', () => {
    const r = selectPapers({ candidates: rich, perPaper: 40, sets: 2, quota })
    expect(r.papers).toHaveLength(2)
    for (const p of r.papers) {
      expect(p).toHaveLength(40)
      expect(p.filter((c) => c.stratum === 't1_t3')).toHaveLength(17)
      expect(p.filter((c) => c.stratum === 't4')).toHaveLength(13)
      expect(p.filter((c) => c.stratum === 't5')).toHaveLength(10)
    }
    expect(r.pickedByStratum).toEqual({ t1_t3: 34, t4: 26, t5: 20 })
  })

  it('never puts one question in two papers, and never twice in one paper', () => {
    const r = selectPapers({ candidates: rich, perPaper: 40, sets: 2, quota })
    const all = r.papers.flat().map((c) => c.id)
    expect(new Set(all).size).toBe(80)
  })

  it('is deterministic: the same stock in any order gives the same papers', () => {
    const a = selectPapers({ candidates: rich, perPaper: 40, sets: 2, quota })
    const shuffled = [...rich].sort((x, y) => (Number(x.id) * 7919) % 1013 - (Number(y.id) * 7919) % 1013)
    const b = selectPapers({ candidates: shuffled, perPaper: 40, sets: 2, quota })
    expect(ids(b.papers)).toEqual(ids(a.papers))
    expect(ids(selectPapers({ candidates: rich, perPaper: 40, sets: 2, quota }).papers)).toEqual(ids(a.papers))
  })

  it('orders each paper by legacy id and spreads the picks over the whole range', () => {
    const r = selectPapers({ candidates: stock('t4', 400, 1), perPaper: 40, sets: 1, quota: { t4: 40 } })
    const legacy = r.papers[0]!.map((c) => Number(c.legacyId))
    expect(legacy).toEqual([...legacy].sort((x, y) => x - y))
    expect(legacy[0]).toBeLessThan(20)
    expect(legacy[39]).toBeGreaterThan(380)
  })

  it('gives the other paper a spread over the whole range too (the picks are dealt in turn)', () => {
    const r = selectPapers({ candidates: stock('t4', 400, 1), perPaper: 40, sets: 2, quota: { t4: 40 } })
    for (const p of r.papers) {
      const legacy = p.map((c) => Number(c.legacyId))
      expect(Math.min(...legacy)).toBeLessThan(30)
      expect(Math.max(...legacy)).toBeGreaterThan(370)
    }
  })

  it('builds fewer papers, never a short paper, when the stock is small', () => {
    const r = selectPapers({ candidates: stock('t4', 70, 1), perPaper: 40, sets: 2, quota: { t4: 40 } })
    expect(r.papers).toHaveLength(1)
    expect(r.papers[0]).toHaveLength(40)
    const none = selectPapers({ candidates: stock('t4', 39, 1), perPaper: 40, sets: 2, quota: { t4: 40 } })
    expect(none.papers).toHaveLength(0)
    expect(none.stock).toBe(39)
  })

  it('passes a level shortfall to the levels that still have stock', () => {
    const lean = [...stock('t4', 100, 1), ...stock('t5', 6, 500)]
    const r = selectPapers({ candidates: lean, perPaper: 40, sets: 2, quota: { t4: 20, t5: 20 } })
    expect(r.papers).toHaveLength(2)
    expect(r.papers.every((p) => p.length === 40)).toBe(true)
    expect(r.pickedByStratum).toEqual({ t4: 74, t5: 6 })
  })

  it('ignores the levels that are not in the quota', () => {
    const r = selectPapers({ candidates: [...stock('t4', 50, 1), ...stock('d6', 500, 5000)], perPaper: 40, sets: 1, quota: { t4: 40 } })
    expect(r.stock).toBe(50)
    expect(r.papers[0]!.every((c) => c.stratum === 't4')).toBe(true)
  })

  it('drops a repeated stem (the first in legacy order is kept) and reports how many', () => {
    const dupes = stock('t4', 60, 1).map((c, i) => ({ ...c, dedupeKey: i < 30 ? 'same' : (c.dedupeKey as string) }))
    const r = selectPapers({ candidates: dupes, perPaper: 30, sets: 1, quota: { t4: 30 } })
    expect(r.duplicatesDropped).toBe(29)
    expect(r.stock).toBe(31)
    expect(r.papers[0]!.filter((c) => c.dedupeKey === 'same')).toHaveLength(1)
  })

  it('drops the same question id seen twice', () => {
    const c = stock('t4', 50, 1)
    const r = selectPapers({ candidates: [...c, ...c], perPaper: 40, sets: 1, quota: { t4: 40 } })
    expect(r.stock).toBe(50)
    expect(r.duplicatesDropped).toBe(50)
  })

  it('refuses a quota that does not add up, or a bad count', () => {
    expect(() => selectPapers({ candidates: [], perPaper: 40, sets: 2, quota: { t4: 30 } })).toThrow(RangeError)
    expect(() => selectPapers({ candidates: [], perPaper: 0, sets: 2, quota: { t4: 0 } })).toThrow(RangeError)
    expect(() => selectPapers({ candidates: [], perPaper: 40, sets: 0, quota: { t4: 40 } })).toThrow(RangeError)
  })
})

describe('parseArgs', () => {
  it('defaults to a dry-run of two papers for every subject', () => {
    expect(parseArgs([])).toEqual({ apply: false, sets: 2, subjects: ['MAT', 'SEJ', 'PHY', 'SN'], snCode: undefined, actorId: undefined, replaceBlueprints: false })
  })
  it('reads the flags', () => {
    expect(parseArgs(['--apply', '--sets=1', '--subjects=MAT,PHY', '--sn-code=1511/1', '--replace-blueprints', '--actor-id=12'])).toEqual({
      apply: true,
      sets: 1,
      subjects: ['MAT', 'PHY'],
      snCode: '1511/1',
      actorId: '12',
      replaceBlueprints: true,
    })
    expect(parseArgs(['--help'])).toBe('help')
  })
  it.each([
    ['--password=abc'],
    ['--token=abc'],
    ['--email=abcdef'],
    ['--cookie=x'],
    ['--sets=3'],
    ['--subjects=XYZ'],
    ['--subjects=MAT,MAT'],
    ['--sn-code=abc'],
    ['--actor-id=x'],
    ['--apply=yes'],
    ['--unknown'],
    ['apply'],
    ['--apply', '--apply'],
  ])('refuses %s without echoing its value', (...args) => {
    const arg = args[0] as string
    let message = ''
    try {
      parseArgs(args.filter((a): a is string => typeof a === 'string' && a.startsWith('--') || a === 'apply'))
    } catch (e) {
      expect(e).toBeInstanceOf(UsageError)
      message = (e as Error).message
    }
    expect(message).not.toBe('')
    const value = arg.split('=')[1]
    if (value !== undefined && value.length > 2) expect(message).not.toContain(value)
  })
})
