import { describe, expect, it } from 'vitest'

import { DuplicateDetector } from '../../src/modules/intake/workflow/duplicate-detector'

/** A bank of `total` questions with ids total..1 (newest first), served like `QuestionsRepository.listIdsKeyset` (no totals). */
function detectorOver(total: number, limit: number) {
  const calls: Array<{ pageSize: number; idBelow?: string }> = []
  const questions = {
    async listIdsKeyset(_filter: unknown, idBelow: string | undefined, limit: number) {
      calls.push({ pageSize: limit, ...(idBelow === undefined ? {} : { idBelow }) })
      const below = idBelow === undefined ? total + 1 : Number(idBelow)
      const ids: string[] = []
      for (let id = below - 1; id >= 1 && ids.length < limit; id--) ids.push(String(id))
      return ids
    },
    async getMany(ids: string[]) {
      return ids.map((id) => ({ id, version: { status: 'draft', parts: [], stemMs: `Soalan ${id}` } }))
    },
  }
  const curriculum = { subjectByCode: async () => ({ id: 1n }) }
  const detector = new DuplicateDetector(questions as never, curriculum as never, { duplicateScanLimit: limit } as never)
  return { detector, calls }
}

describe('duplicate scan limit', () => {
  it('reads exactly the limit of newest bank rows (no overshoot) with keyset paging', async () => {
    const { detector, calls } = detectorOver(1000, 250)
    const bank = await detector.bank('MATH')
    expect(bank).toHaveLength(250)
    expect(bank[0]!.id).toBe('1000')
    expect(bank[249]!.id).toBe('751')
    expect(calls).toEqual([{ pageSize: 200 }, { pageSize: 50, idBelow: '801' }])
  })

  it('reads the whole bank when it is smaller than the limit', async () => {
    const { detector } = detectorOver(130, 5000)
    expect(await detector.bank('MATH')).toHaveLength(130)
  })
})
