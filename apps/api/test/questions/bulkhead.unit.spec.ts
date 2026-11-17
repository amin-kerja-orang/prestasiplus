import { describe, expect, it } from 'vitest'

import { Bulkhead } from '../../src/common/concurrency/bulkhead'
import { bankScanConcurrency, DEFAULT_BANK_SCAN_CONCURRENCY } from '../../src/common/concurrency/bank-scan-gate'

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

/** A job that stays running until `finish()` is called. */
function gated() {
  let finish!: (v?: unknown) => void
  let fail!: (e: Error) => void
  const started: string[] = []
  const job = (name: string) => () => {
    started.push(name)
    return new Promise<string>((resolve, reject) => {
      finish = () => resolve(name)
      fail = reject
    })
  }
  return { job, finish: () => finish(), fail: (e: Error) => fail(e), started }
}

describe('Bulkhead', () => {
  it('runs at most `limit` jobs at once and starts the others in arrival order', async () => {
    const b = new Bulkhead(() => 2)
    let running = 0
    let peak = 0
    const order: number[] = []
    const jobs = Array.from({ length: 6 }, (_, i) =>
      b.run(async () => {
        order.push(i)
        peak = Math.max(peak, ++running)
        await tick()
        running--
        return i
      }),
    )
    expect(await Promise.all(jobs)).toEqual([0, 1, 2, 3, 4, 5])
    expect(peak).toBe(2)
    expect(order).toEqual([0, 1, 2, 3, 4, 5])
    expect(b.running).toBe(0)
    expect(b.queued).toBe(0)
  })

  it('a waiting job only waits: it starts when a slot frees', async () => {
    const b = new Bulkhead(() => 1)
    const a = gated()
    const c = gated()
    const first = b.run(a.job('a'))
    const second = b.run(c.job('c'))
    await tick()
    expect(a.started).toEqual(['a'])
    expect(c.started).toEqual([])
    expect(b.queued).toBe(1)
    a.finish()
    expect(await first).toBe('a')
    await tick()
    expect(c.started).toEqual(['c'])
    c.finish()
    expect(await second).toBe('c')
  })

  it('a job that throws frees its slot', async () => {
    const b = new Bulkhead(() => 1)
    const a = gated()
    const failing = b.run(a.job('a'))
    const next = b.run(async () => 'next')
    await tick()
    a.fail(new Error('boom'))
    await expect(failing).rejects.toThrow('boom')
    expect(await next).toBe('next')
    expect(b.running).toBe(0)
  })

  it('reads the limit at each acquisition (a lowered limit is honoured as jobs finish)', async () => {
    let limit = 3
    const b = new Bulkhead(() => limit)
    const gates = [gated(), gated(), gated()]
    const runs = gates.map((g, i) => b.run(g.job(String(i))))
    await tick()
    expect(b.running).toBe(3)
    limit = 1
    const late = gated()
    const lateRun = b.run(late.job('late'))
    gates[0]?.finish()
    await runs[0]
    await tick()
    expect(late.started).toEqual([]) // 2 still running, the limit is 1
    gates[1]?.finish()
    gates[2]?.finish()
    await Promise.all(runs)
    await tick()
    expect(late.started).toEqual(['late'])
    late.finish()
    await lateRun
    expect(b.running).toBe(0)
  })
})

describe('bankScanConcurrency', () => {
  it('defaults to 3; takes a positive integer from the setting; ignores blank or invalid values', () => {
    expect(DEFAULT_BANK_SCAN_CONCURRENCY).toBe(3)
    expect(bankScanConcurrency(undefined)).toBe(3)
    expect(bankScanConcurrency('')).toBe(3)
    expect(bankScanConcurrency('abc')).toBe(3)
    expect(bankScanConcurrency('0')).toBe(3)
    expect(bankScanConcurrency('-2')).toBe(3)
    expect(bankScanConcurrency('5')).toBe(5)
    expect(bankScanConcurrency(' 2 ')).toBe(2)
  })
})
