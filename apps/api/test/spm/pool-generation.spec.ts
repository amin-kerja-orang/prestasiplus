import { describe, expect, it } from 'vitest'

import { databankFilter, latihTubiFilter, SpmPoolService } from '../../src/modules/spm/pool.service'
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

describe('Latih Tubi hub total scope (pure)', () => {
  it('[CI] AC-MUR-13-13 is the serving definition of the Latih Tubi draw, never the Mock single-leaf flag', () => {
    const f = latihTubiFilter('7')
    expect(f).toMatchObject({ subjectId: '7', type: 'mcq', spmPool: true, status: 'approved', active: true })
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

  it('[CI] AC-MUR-13-13 the Latih Tubi total is the sum of its cells: one statement, one cache', async () => {
    let cellCalls = 0
    const repo = {
      unitCount: () => Promise.resolve(99),
      unitCountsByLevelTp: () => {
        cellCalls++
        return Promise.resolve([{ levelId: '4', tp: 1, n: 2 }, { levelId: '5', tp: 3, n: 1 }])
      },
    }
    const cache = new OverviewCache({ now: () => new Date(0) } as never, {} as never)
    const pool = new SpmPoolService(repo as never, { get: () => '600' } as never, { now: () => new Date(0) } as never, cache)
    expect(await pool.latihTubiCount('1')).toBe(3)
    expect((await pool.latihTubiCells('1')).reduce((a, c) => a + c.n, 0)).toBe(3)
    expect(cellCalls).toBe(1)
    expect(await pool.databankCount('1')).toBe(99)
  })
})

describe('Latih Tubi cells (pure)', () => {
  it('[CI] AC-MUR-13-13 merges (level, TP) unit rows into level and difficulty cells, cached by generation', async () => {
    let calls = 0
    const repo = {
      unitCountsByLevelTp: () => {
        calls++
        return Promise.resolve([
          { levelId: '4', tp: 1, n: 2 },
          { levelId: '4', tp: null, n: 1 },
          { levelId: '4', tp: 6, n: 1 },
          { levelId: '4', tp: 5, n: 3 },
        ])
      },
    }
    const cache = new OverviewCache({ now: () => new Date(0) } as never, {} as never)
    const pool = new SpmPoolService(repo as never, { get: () => '600' } as never, { now: () => new Date(0) } as never, cache)
    const cells = await pool.latihTubiCells('1')
    // TP null and 1 are difficulty 1; TP 5 and 6 are difficulty 5.
    expect(cells).toEqual([
      { levelId: '4', difficulty: 1, n: 3 },
      { levelId: '4', difficulty: 5, n: 4 },
    ])
    await pool.latihTubiCells('1')
    expect(calls).toBe(1)
    cache.invalidate()
    await pool.latihTubiCells('1')
    expect(calls).toBe(2)
  })
})

describe('Latih Tubi cells after a question event (pure): stale value served, refresh behind', () => {
  const setup = () => {
    const pending: { resolve: (rows: { levelId: string; tp: number; n: number }[]) => void; reject: (e: Error) => void }[] = []
    const repo = {
      unitCountsByLevelTp: () =>
        new Promise<{ levelId: string; tp: number; n: number }[]>((resolve, reject) => {
          pending.push({ resolve, reject })
        }),
    }
    const cache = new OverviewCache({ now: () => new Date(0) } as never, {} as never)
    const pool = new SpmPoolService(repo as never, { get: () => '600' } as never, { now: () => new Date(0) } as never, cache)
    return { pending, cache, pool }
  }
  const tick = () => new Promise<void>((r) => setTimeout(r, 0))

  it('a cold read waits; after an event the old value is served at once and ONE refresh runs behind it', async () => {
    const { pending, cache, pool } = setup()
    const cold = pool.latihTubiCount('1')
    pending[0]?.resolve([{ levelId: '4', tp: 1, n: 2 }])
    expect(await cold).toBe(2)

    cache.invalidate()
    // Five readers after the event: none waits, all see the old count, and only one statement starts.
    const readers = await Promise.all([1, 2, 3, 4, 5].map(() => pool.latihTubiCount('1')))
    expect(readers).toEqual([2, 2, 2, 2, 2])
    expect(pending).toHaveLength(2)

    pending[1]?.resolve([{ levelId: '4', tp: 1, n: 9 }])
    await tick()
    expect(await pool.latihTubiCount('1')).toBe(9)
    expect(pending).toHaveLength(2) // the new value is current: no further statement
  })

  it('a failed refresh keeps the stale count and the next read tries again', async () => {
    const { pending, cache, pool } = setup()
    const cold = pool.latihTubiCount('1')
    pending[0]?.resolve([{ levelId: '4', tp: 1, n: 2 }])
    await cold
    cache.invalidate()
    expect(await pool.latihTubiCount('1')).toBe(2)
    pending[1]?.reject(new Error('db down'))
    await tick()
    expect(await pool.latihTubiCount('1')).toBe(2)
    expect(pending).toHaveLength(3) // retried
    pending[2]?.resolve([{ levelId: '4', tp: 1, n: 4 }])
    await tick()
    expect(await pool.latihTubiCount('1')).toBe(4)
  })

  it('events during a slow refresh do not discard it: it is stored (still marked old) and replaced by the next refresh', async () => {
    const { pending, cache, pool } = setup()
    const cold = pool.latihTubiCount('1')
    pending[0]?.resolve([{ levelId: '4', tp: 1, n: 2 }])
    await cold
    cache.invalidate()
    await pool.latihTubiCount('1') // starts refresh #1 (generation g+1)
    cache.invalidate() // another event while it runs
    pending[1]?.resolve([{ levelId: '4', tp: 1, n: 5 }])
    await tick()
    expect(await pool.latihTubiCount('1')).toBe(5) // the newer-than-before value is served (and a refresh for the latest generation starts)
    expect(pending).toHaveLength(3)
    pending[2]?.resolve([{ levelId: '4', tp: 1, n: 6 }])
    await tick()
    expect(await pool.latihTubiCount('1')).toBe(6)
  })
})
