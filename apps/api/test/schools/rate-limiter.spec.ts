import type { ConfigService } from '@nestjs/config'
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../src/common/errors/api-error'
import { MAX_KEYS, PURGE_INTERVAL_MS, type RateLimitSpec, RateLimiter } from '../../src/common/throttle'
import { FixedClock } from '../../src/db/clock'

const config = { get: () => undefined } as unknown as ConfigService
const spec = (windowSeconds?: number): RateLimitSpec => ({
  bucket: 'unit',
  env: 'UNIT_NOT_SET',
  default: 3,
  per: 'ip',
  ...(windowSeconds ? { windowSeconds } : {}),
})

function make() {
  const clock = new FixedClock('2026-10-19T09:00:00+08:00')
  return { clock, limiter: new RateLimiter(config, clock) }
}

describe('RateLimiter memory bounds', () => {
  it('keeps at most MAX_KEYS keys however many distinct subjects arrive, evicting the oldest first', () => {
    const { limiter } = make()
    for (let i = 0; i < MAX_KEYS + 500; i++) limiter.consume(spec(), `ip-${String(i)}`)
    expect(limiter.size).toBeLessThanOrEqual(MAX_KEYS)
    // The oldest were evicted (a fresh window for them), the newest are still counted.
    for (let i = 0; i < 2; i++) limiter.consume(spec(), `ip-${String(MAX_KEYS + 499)}`)
    expect(() => limiter.consume(spec(), `ip-${String(MAX_KEYS + 499)}`)).toThrow(ApiError)
    for (let i = 0; i < 3; i++) limiter.consume(spec(), 'ip-0')
  })

  it('sweeps expired windows at most once per interval, not on every request', () => {
    const { clock, limiter } = make()
    limiter.consume(spec(5), 'first') // sets the sweep time
    for (let i = 0; i < 100; i++) limiter.consume(spec(5), `k${String(i)}`)
    expect(limiter.size).toBe(101)
    clock.advance(10_000) // every window (5 s) has expired, but the sweep interval has not
    limiter.consume(spec(5), 'later')
    expect(limiter.size).toBe(102)
    clock.advance(PURGE_INTERVAL_MS) // interval passed: the next request sweeps
    limiter.consume(spec(5), 'after')
    expect(limiter.size).toBe(1)
  })

  it('still counts per key and answers 429 with retryAfter', () => {
    const { clock, limiter } = make()
    for (let i = 0; i < 3; i++) limiter.consume(spec(), 'a')
    try {
      limiter.consume(spec(), 'a')
      expect.unreachable()
    } catch (e) {
      expect((e as ApiError).retryAfter).toBe(60)
    }
    clock.advance(61_000)
    limiter.consume(spec(), 'a')
  })
})
