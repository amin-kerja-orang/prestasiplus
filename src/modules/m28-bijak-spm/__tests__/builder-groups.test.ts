// R1-F08 / D90: a stimulus group is ONE unit in the Set Builder. Placed, moved and removed whole,
// never as a standalone question. Runs against the in-browser mock (same addUnit / removeUnit rules
// as the real placements endpoint).
import { describe, expect, it } from 'vitest'

import { movedOrder, sectionUnits } from '../admin/builder/domain/units'
import { MockBuilderServer } from '../admin/builder/server/memory'

async function findGroup(api: MockBuilderServer, id: string, sectionId: string) {
  const pool = await api.pool(id, sectionId, { pageSize: 500 })
  return pool.units.find((u) => u.groupId && u.questionIds.length > 1)
}

describe('movedOrder', () => {
  const units = [{ ids: ['a'] }, { ids: ['g1', 'g2', 'g3'], groupId: 'g' }, { ids: ['b'] }]
  it('moves one id per unit, a group counts once', () => {
    expect(movedOrder(units, 1, -1)).toEqual(['g1', 'a', 'b'])
    expect(movedOrder(units, 1, 1)).toEqual(['a', 'b', 'g1'])
  })
  it('is null out of range', () => {
    expect(movedOrder(units, 0, -1)).toBeNull()
    expect(movedOrder(units, 2, 1)).toBeNull()
  })
})

describe('Set Builder group units (D90)', () => {
  it('places, moves and removes a stimulus group as one unit', async () => {
    const api = new MockBuilderServer()
    const subjects = await api.builderSubjects()
    let found: { id: string; sectionId: string; group: NonNullable<Awaited<ReturnType<typeof findGroup>>> } | null = null
    for (const s of subjects) {
      for (const k of s.kertas) {
        const id = await api.create({ subject: s.code, kertas: k, title: 'Ujian D90' })
        const ed = await api.getEditor(id)
        for (const sec of ed.paper.sections) {
          const group = await findGroup(api, id, sec.id)
          if (group) {
            found = { id, sectionId: sec.id, group }
            break
          }
        }
        if (found) break
      }
      if (found) break
    }
    expect(found, 'the seed has a stimulus group with several members').not.toBeNull()
    const { id, sectionId, group } = found!
    const members = group.questionIds

    // Place ONE member: the whole group arrives, contiguous, as one unit.
    const added = await api.addPlacement(id, sectionId, members[1]!)
    expect([...added.changed].sort()).toEqual([...members].sort())
    let ed = added.editor
    let units = sectionUnits(ed, sectionId)
    const unit = units.find((u) => u.groupId === group.groupId)!
    expect(unit.ids).toEqual(expect.arrayContaining(members))
    expect(unit.ids).toHaveLength(members.length)
    expect(units.filter((u) => u.groupId === group.groupId)).toHaveLength(1)
    // Contiguous in the section order.
    const order = ed.paper.sections.find((s) => s.id === sectionId)!.questionIds
    const at = order.indexOf(unit.ids[0]!)
    expect(order.slice(at, at + members.length).sort()).toEqual([...members].sort())

    // The pool now reports the unit as placed (one unit, not N loose questions).
    const pool = await api.pool(id, sectionId, { pageSize: 500 })
    expect(pool.units.find((u) => u.groupId === group.groupId)?.placed).toBe(true)

    // Place a single question after it so the group can move.
    const single = pool.units.find((u) => !u.groupId && !u.placed)
    expect(single).toBeDefined()
    ed = (await api.addPlacement(id, sectionId, single!.questionIds[0]!)).editor
    units = sectionUnits(ed, sectionId)
    const gi = units.findIndex((u) => u.groupId === group.groupId)
    const next = movedOrder(units, gi, gi === 0 ? 1 : -1)!
    expect(next).toHaveLength(units.length)
    ed = await api.reorder(id, sectionId, next)
    const moved = sectionUnits(ed, sectionId)
    // Still one contiguous group unit with all members, now at the other position.
    const mg = moved.find((u) => u.groupId === group.groupId)!
    expect(mg.ids).toHaveLength(members.length)
    expect(moved.findIndex((u) => u.groupId === group.groupId)).not.toBe(gi)

    // Removing ONE member removes the whole group.
    const removed = await api.removePlacement(id, members[0]!)
    expect([...removed.changed].sort()).toEqual([...members].sort())
    const left = removed.editor.paper.sections.flatMap((s) => s.questionIds)
    for (const m of members) expect(left).not.toContain(m)
    expect(sectionUnits(removed.editor, sectionId).some((u) => u.groupId === group.groupId)).toBe(false)
  })
})
