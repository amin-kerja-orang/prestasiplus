/** AttemptSweeper.sweep(): the expired-attempt sweep and the Kuiz idle sweep run independently (S3-T04). No DB needed. */
import { describe, expect, it, vi } from 'vitest'

import { AttemptSweeper } from '../../src/modules/bijak/attempts/attempt-sweeper'

const make = (sweepExpired: () => Promise<number>, sweepIdle: () => Promise<number>) => {
  const attempts = { sweepExpired: vi.fn(sweepExpired) }
  const kuiz = { sweepIdle: vi.fn(sweepIdle) }
  const sweeper = new AttemptSweeper(attempts as never, kuiz as never, { get: () => undefined } as never)
  return { sweeper, attempts, kuiz }
}

describe('AttemptSweeper.sweep', () => {
  it('adds up both sweeps', async () => {
    const { sweeper } = make(async () => 2, async () => 3)
    expect(await sweeper.sweep()).toBe(5)
  })

  it('still runs the idle sweep when the expired sweep throws', async () => {
    const { sweeper, kuiz } = make(async () => { throw new Error('boom') }, async () => 3)
    expect(await sweeper.sweep()).toBe(3)
    expect(kuiz.sweepIdle).toHaveBeenCalledTimes(1)
  })

  it('still counts the expired sweep when the idle sweep throws, and never throws', async () => {
    const { sweeper, attempts } = make(async () => 2, async () => { throw new Error('boom') })
    expect(await sweeper.sweep()).toBe(2)
    expect(attempts.sweepExpired).toHaveBeenCalledTimes(1)
  })
})
