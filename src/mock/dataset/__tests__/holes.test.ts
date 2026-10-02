import { describe, expect, it } from 'vitest'

import { floor } from '../../db/id-strategies'
import { defineVirtualDataset } from '../dataset'
import { questionCells, anchor, type Q, type QFacet, Q_FACETS } from './fixtures'

/** M04-shaped: ids up to 564161, anchors 564157–564161 at the very top of the range. */
function build(absentIds?: number[], extraAnchors: Q[] = []) {
  const total = 20_000
  return defineVirtualDataset<Q, QFacet>({
    name: 'holes.questions',
    total,
    idRange: { min: 540_001, max: 564_161 },
    runtimeIds: floor({ start: 9_000_001 }),
    facets: Q_FACETS,
    distribution: questionCells(total),
    derive: (id, f, rng) => ({
      text: `Soalan ${String(id)} ${String(f.subjectId)}`,
      score: rng.int(0, 100),
      createdAt: id,
    }),
    anchors: [564_157, 564_158, 564_159, 564_160, 564_161]
      .map((id) => anchor({ id, subjectId: 1, levelId: 5, difficulty: 2 }))
      .concat(extraAnchors),
    absentIds,
  })
}

describe('holes (absentIds)', () => {
  const plain = build()
  const holed = build([541_527, 564_156])

  it('the absent ids do not exist; totals and every cell count are unchanged', () => {
    expect(plain.has(541_527) || plain.has(564_156)).toBe(true) // the ids are generated without holes
    expect(holed.get(541_527)).toBeUndefined()
    expect(holed.get(564_156)).toBeUndefined()
    expect(holed.count()).toBe(plain.count())
    for (const cell of plain.cells()) expect(holed.count(cell.facets)).toBe(cell.count)
    const ids = holed.query().rows.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain(541_527)
    expect(ids.every((id) => id >= 540_001 && id <= 564_161)).toBe(true)
  })

  it('564156 does not appear between 564158 and 564155 (the top of the range is anchors)', () => {
    const top = holed.query({ where: { id: { gte: 564_150 } } }).rows.map((r) => r.id)
    expect(top).not.toContain(564_156)
    const i = top.indexOf(564_157)
    expect(top.slice(i)).toEqual([564_157, 564_158, 564_159, 564_160, 564_161])
    expect(top[i - 1]).toBeLessThanOrEqual(564_155)
  })

  it('a hole moves its slot to the next free id: only the moved row changes', () => {
    const a = new Map(plain.query().rows.map((r) => [r.id, JSON.stringify(r)]))
    const b = new Map(
      build([541_527])
        .query()
        .rows.map((r) => [r.id, JSON.stringify(r)]),
    )
    const changed = [...new Set([...a.keys(), ...b.keys()])].filter((id) => a.get(id) !== b.get(id))
    // The removed id, and the free id the slot moved to (above it).
    expect(changed).toHaveLength(2)
    expect(changed).toContain(541_527)
    expect(Math.max(...changed)).toBeGreaterThan(541_527)
  })

  it('is part of specHash; bad holes fail the feasibility check', () => {
    expect(holed.specHash()).not.toBe(plain.specHash())
    expect(build([541_527, 564_156]).specHash()).toBe(build([564_156, 541_527]).specHash())
    expect(
      build([539_000])
        .feasibility()
        .issues.map((i) => i.code),
    ).toEqual(['RANGE'])
    expect(
      build([564_160])
        .feasibility()
        .issues.map((i) => i.code),
    ).toEqual(['ANCHOR_ID'])
  })
})
