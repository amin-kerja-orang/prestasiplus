import { describe, expect, it } from 'vitest'

import { databankFilter, SpmPoolService } from '../../src/modules/spm/pool.service'
import { OverviewCache } from '../../src/modules/questions/serving/overview-cache'

describe('Databank count scope (pure)', () => {
  it('[CI] AC-MUR-13-13 is the serving definition of the Databank: SPM pool, MCQ, live approved, active', () => {
    const f = databankFilter('7')
    expect(f).toMatchObject({ subjectId: '7', type: 'mcq', spmPool: true, status: 'approved', active: true })
    // Whatever GROUP_SURFACES says, the shape is the draw's: whole groups or ungrouped, never the Mock's single-leaf flag.
    expect(f.singleMcqLeaf).toBeUndefined()
    expect(f.wholeGroups === true || f.ungrouped === true).toBe(true)
  })
})

describe('OverviewCache generation (pure)', () => {
  it('[CI] AC-MUR-13-10 moves on every invalidation so a reader can drop its derived counts', () => {
    const cache = new OverviewCache({ now: () => new Date(0) } as never, {} as never)
    const g = cache.generation
    cache.invalidate()
    cache.invalidate()
    expect(cache.generation).toBe(g + 2)
  })
})

describe('Databank count single-flight (pure)', () => {
  it('[CI] AC-MUR-13-10 a caller after an invalidation does not join a load started before it', async () => {
    const releases: (() => void)[] = []
    let calls = 0
    const repo = {
      unitCount: () => {
        const n = ++calls
        return new Promise<number>((resolve) => releases.push(() => resolve(n)))
      },
    }
    const cache = new OverviewCache({ now: () => new Date(0) } as never, {} as never)
    const pool = new SpmPoolService(repo as never, { get: () => '0' } as never, { now: () => new Date(0) } as never, cache)
    const before = pool.databankCount('1')
    cache.invalidate()
    const after = pool.databankCount('1')
    expect(calls).toBe(2)
    releases.forEach((r) => r())
    expect(await before).toBe(1)
    expect(await after).toBe(2)
  })
})
