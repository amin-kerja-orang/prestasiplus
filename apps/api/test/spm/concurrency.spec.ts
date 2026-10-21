import { describe, expect, it } from 'vitest'

import { mapBounded, POOL_LOAD_CONCURRENCY } from '../../src/modules/spm/hub.service'

describe('bounded concurrent pool loading', () => {
  it('keeps input order and results identical to a sequential loop, whatever the finish order', async () => {
    const items = Array.from({ length: 19 }, (_, i) => i)
    const slowFirst = async (n: number): Promise<number> => {
      await new Promise((r) => setTimeout(r, (19 - n) % 5))
      return n * 10
    }
    const sequential: number[] = []
    for (const n of items) sequential.push(await slowFirst(n))
    expect(await mapBounded(items, POOL_LOAD_CONCURRENCY, slowFirst)).toEqual(sequential)
  })

  it('never has more than the limit in flight, and does run in parallel', async () => {
    let inFlight = 0
    let peak = 0
    await mapBounded(Array.from({ length: 19 }, (_, i) => i), POOL_LOAD_CONCURRENCY, async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 2))
      inFlight--
    })
    expect(peak).toBe(POOL_LOAD_CONCURRENCY)
  })

  it('handles an empty list and a rejection', async () => {
    expect(await mapBounded([], 4, async () => 1)).toEqual([])
    await expect(mapBounded([1, 2], 4, async (n) => { if (n === 2) throw new Error('x'); return n })).rejects.toThrow('x')
  })
})
