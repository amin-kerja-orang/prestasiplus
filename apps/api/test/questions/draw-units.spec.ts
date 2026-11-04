import { describe, expect, it } from 'vitest'

import { mulberry32 } from '../../src/db/prng'
import { drawUnits, type DrawCandidate } from '../../src/modules/questions/serving'

/** S1-T06 (FR-MUR-QP-6, DM-27): the unit draw takes whole groups or nothing, never splits, keeps group order, count <= n. */
describe('drawUnits (S1-T06)', () => {
  it('takes a whole group contiguous in group order, or skips it when it would exceed n', () => {
    const c: DrawCandidate[] = [
      { id: '12', groupId: 'g', groupPosition: 2, groupSize: 3 },
      { id: '10', groupId: 'g', groupPosition: 1, groupSize: 3 },
      { id: '11', groupId: 'g', groupPosition: 3, groupSize: 3 },
      { id: '20', groupId: null, groupPosition: null },
    ]
    const four = drawUnits(c, 4, mulberry32(1))
    expect([...four].sort()).toEqual(['10', '11', '12', '20'])
    expect(four.filter((id) => id !== '20')).toEqual(['10', '12', '11']) // group order (positions 1, 2, 3), contiguous
    expect([['10', '12', '11'], ['20']]).toContainEqual(drawUnits(c, 3, mulberry32(1))) // whole group or the single, never a part
    expect(drawUnits(c, 2, mulberry32(1))).toEqual(['20']) // the group of three never fits in 2
    expect(drawUnits(c, 0, mulberry32(1))).toEqual([])
  })

  it('skips a group a member of which is not among the servable candidates (incomplete group)', () => {
    const c: DrawCandidate[] = [
      { id: '1', groupId: 'g', groupPosition: 1, groupSize: 2 },
      { id: '2', groupId: null, groupPosition: null },
    ]
    expect(drawUnits(c, 5, mulberry32(3))).toEqual(['2'])
  })

  it('property: 1000 random draws never return a member without its group, never split a group, and stay within n', () => {
    const rng = mulberry32(2026)
    const rnd = (k: number) => Math.floor(rng.next() * k)
    for (let round = 0; round < 1000; round += 1) {
      const cands: DrawCandidate[] = []
      const size = new Map<string, number>()
      let id = 1
      const groups = rnd(6)
      for (let g = 0; g < groups; g += 1) {
        const total = 2 + rnd(4)
        const missing = rnd(4) === 0 ? 1 : 0 // a quarter of the groups have a member that is not servable
        const gid = `g${String(g)}`
        size.set(gid, total)
        const positions = Array.from({ length: total }, (_, i) => i + 1).sort(() => rng.next() - 0.5)
        for (const p of positions.slice(0, total - missing)) cands.push({ id: String(id++), groupId: gid, groupPosition: p, groupSize: total })
      }
      for (let s = rnd(8); s > 0; s -= 1) cands.push({ id: String(id++), groupId: null, groupPosition: null })
      const n = rnd(12)
      const out = drawUnits(cands, n, rng)
      expect(out.length).toBeLessThanOrEqual(n)
      expect(new Set(out).size).toBe(out.length)
      const byId = new Map(cands.map((c) => [c.id, c]))
      const seen = new Map<string, number[]>() // group -> positions in served order
      const indexOf = new Map<string, number[]>()
      out.forEach((oid, i) => {
        const c = byId.get(oid)!
        if (c.groupId === null) return
        seen.set(c.groupId, [...(seen.get(c.groupId) ?? []), c.groupPosition!])
        indexOf.set(c.groupId, [...(indexOf.get(c.groupId) ?? []), i])
      })
      for (const [gid, positions] of seen) {
        expect(positions.length, `group ${gid} whole`).toBe(size.get(gid))
        expect(positions, `group ${gid} in order`).toEqual([...positions].sort((a, b) => a - b))
        const idx = indexOf.get(gid)!
        expect(idx[idx.length - 1]! - idx[0]! + 1, `group ${gid} contiguous`).toBe(idx.length)
      }
    }
  })
})
