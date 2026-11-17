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

describe('Bulkhead bounds', () => {
  const overloaded = (reason: string) => new Error(`overloaded:${reason}`)

  it('a waiter that waited past maxWaitMs is rejected with the overload error and leaves the queue', async () => {
    const b = new Bulkhead(() => 1, { maxWaitMs: () => 20, overloaded })
    const a = gated()
    const running = b.run(a.job('a'))
    const waiter = b.run(async () => 'late')
    await tick()
    expect(b.queued).toBe(1)
    await expect(waiter).rejects.toThrow('overloaded:wait_timeout')
    expect(b.queued).toBe(0)
    expect(b.running).toBe(1) // the running job is untouched
    a.finish()
    await running
    expect(b.running).toBe(0)
  })

  it('a full queue rejects a newcomer at once; the waiters already queued are not affected', async () => {
    const b = new Bulkhead(() => 1, { maxQueue: () => 2, overloaded })
    const a = gated()
    const first = b.run(a.job('a'))
    const w1 = b.run(async () => 'w1')
    const w2 = b.run(async () => 'w2')
    await expect(b.run(async () => 'w3')).rejects.toThrow('overloaded:queue_full')
    expect(b.queued).toBe(2)
    a.finish()
    expect(await first).toBe('a')
    expect(await Promise.all([w1, w2])).toEqual(['w1', 'w2'])
    expect(b.running).toBe(0)
  })

  it('a rejected waiter takes no slot and a timeout does not break the order of the others', async () => {
    const b = new Bulkhead(() => 1, { maxWaitMs: () => 1000, overloaded })
    const a = gated()
    const started: string[] = []
    const first = b.run(a.job('a'))
    const w1 = b.run(async () => started.push('w1'))
    const w2 = b.run(async () => started.push('w2'))
    const w3 = b.run(async () => started.push('w3'))
    await tick()
    expect(b.queued).toBe(3)
    a.finish()
    await Promise.all([first, w1, w2, w3])
    expect(started).toEqual(['w1', 'w2', 'w3'])
    expect(b.running).toBe(0)
    expect(b.queued).toBe(0)
  })

  it('a waiter in the middle that times out is skipped; the ones before and after keep their order and the slot count stays right', async () => {
    let wait = 1000
    const b = new Bulkhead(() => 1, { maxWaitMs: () => wait, overloaded })
    const a = gated()
    const started: string[] = []
    const first = b.run(a.job('a'))
    const w1 = b.run(async () => started.push('w1'))
    wait = 15
    const mid = b.run(async () => started.push('mid'))
    wait = 1000
    const w3 = b.run(async () => started.push('w3'))
    await expect(mid).rejects.toThrow('overloaded:wait_timeout')
    expect(b.queued).toBe(2)
    a.finish()
    await Promise.all([first, w1, w3])
    expect(started).toEqual(['w1', 'w3'])
    expect(b.running).toBe(0)
    // the gate still works afterwards
    expect(await b.run(async () => 'after')).toBe('after')
  })

  it('a job that throws after a wait timeout elsewhere still frees its slot for the next waiter', async () => {
    const b = new Bulkhead(() => 1, { maxWaitMs: () => 1000, overloaded })
    const a = gated()
    const first = b.run(a.job('a'))
    const next = b.run(async () => 'next')
    await tick()
    a.fail(new Error('boom'))
    await expect(first).rejects.toThrow('boom')
    expect(await next).toBe('next')
    expect(b.running).toBe(0)
  })
})
