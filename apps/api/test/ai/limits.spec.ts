import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AiCancelledError } from '../../src/modules/ai-extraction/ai.errors'
import { AiRateLimiter } from '../../src/modules/ai-extraction/limits/rate-limiter'
import { Semaphore } from '../../src/modules/ai-extraction/limits/semaphore'
import { priceFor, costSenOf, parsePriceTable } from '../../src/modules/ai-extraction/pricing'
import { ProviderAttemptError } from '../../src/modules/ai-extraction/providers/provider-errors'
import { backoffMs, withRetry, type RetryPolicy } from '../../src/modules/ai-extraction/retry'

describe('Semaphore (AI_MAX_CONCURRENCY)', () => {
  it('never lets more than max run at once under a burst, and serves the rest in arrival order', async () => {
    const sem = new Semaphore(3)
    const order: number[] = []
    let running = 0
    let seenMax = 0
    await Promise.all(
      Array.from({ length: 25 }, async (_v, i) => {
        const release = await sem.acquire()
        order.push(i)
        running += 1
        seenMax = Math.max(seenMax, running)
        await new Promise((r) => setTimeout(r, 2))
        running -= 1
        release()
      }),
    )
    expect(seenMax).toBeLessThanOrEqual(3)
    expect(sem.peak).toBe(3)
    expect(sem.inFlight).toBe(0)
    expect(sem.waiting).toBe(0)
    expect(order).toEqual(Array.from({ length: 25 }, (_v, i) => i))
  })

  it('a double release does not free a second slot', async () => {
    const sem = new Semaphore(1)
    const release = await sem.acquire()
    release()
    release()
    const a = await sem.acquire()
    let second = false
    void sem.acquire().then(() => {
      second = true
    })
    await new Promise((r) => setTimeout(r, 5))
    expect(second).toBe(false)
    a()
  })

  it('a waiter that is cancelled leaves the queue and does not keep a slot', async () => {
    const sem = new Semaphore(1)
    const hold = await sem.acquire()
    const ctl = new AbortController()
    const waiting = sem.acquire(ctl.signal)
    ctl.abort()
    await expect(waiting).rejects.toBeInstanceOf(AiCancelledError)
    expect(sem.waiting).toBe(0)
    hold()
    const again = await sem.acquire()
    again()
    expect(sem.inFlight).toBe(0)
  })
})

describe('AiRateLimiter (AI_RATE_LIMIT_PER_MIN, per user, per school)', () => {
  let now = 1_000_000
  const limiter = () => new AiRateLimiter(() => now)
  beforeEach(() => {
    now = 1_000_000
  })

  it('allows the limit and then refuses with RATE_LIMITED and a retryAfter in seconds; the window then reopens', () => {
    const l = limiter()
    for (let i = 0; i < 5; i += 1) l.consume([{ key: 'global', limit: 5 }])
    now += 20_000
    expect(() => l.consume([{ key: 'global', limit: 5 }])).toThrowError(expect.objectContaining({ code: 'RATE_LIMITED', retryAfter: 40 }))
    now += 40_000
    expect(() => l.consume([{ key: 'global', limit: 5 }])).not.toThrow()
  })

  it('holds under a burst of 100 calls: exactly the limit gets through', () => {
    const l = limiter()
    let ok = 0
    let refused = 0
    for (let i = 0; i < 100; i += 1) {
      try {
        l.consume([{ key: 'global', limit: 30 }])
        ok += 1
      } catch {
        refused += 1
      }
    }
    expect([ok, refused]).toEqual([30, 70])
  })

  it('per-user limits are independent of each other and a refused call counts against nobody', () => {
    const l = limiter()
    const as = (user: string) => [{ key: 'global', limit: 100 }, { key: `user:${user}`, limit: 2 }]
    l.consume(as('1'))
    l.consume(as('1'))
    expect(() => l.consume(as('1'))).toThrowError(expect.objectContaining({ code: 'RATE_LIMITED' }))
    expect(() => l.consume(as('2'))).not.toThrow()
    // 2 + 1 consumed globally: the refused call of user 1 did not count.
    for (let i = 0; i < 97; i += 1) l.consume([{ key: 'global', limit: 100 }])
    expect(() => l.consume([{ key: 'global', limit: 100 }])).toThrowError(expect.objectContaining({ code: 'RATE_LIMITED' }))
  })

  it('per-school limits are shared by every user of the school', () => {
    const l = limiter()
    const as = (user: string) => [{ key: `user:${user}`, limit: 10 }, { key: 'school:7', limit: 3 }]
    l.consume(as('1'))
    l.consume(as('2'))
    l.consume(as('3'))
    expect(() => l.consume(as('4'))).toThrowError(expect.objectContaining({ code: 'RATE_LIMITED' }))
  })
})

describe('withRetry (429 and 5xx with backoff, then a clear code)', () => {
  const policy = (over: Partial<RetryPolicy> = {}): RetryPolicy & { slept: number[] } => {
    const slept: number[] = []
    return { maxRetries: 3, baseMs: 1000, maxMs: 30_000, timeoutMs: 60_000, sleep: (ms) => (slept.push(ms), Promise.resolve()), random: () => 0.5, slept, ...over }
  }

  it('retries transient failures with exponential backoff and succeeds', async () => {
    const p = policy()
    let n = 0
    const r = await withRetry(() => {
      n += 1
      return n < 3 ? Promise.reject(new ProviderAttemptError('transient', 429)) : Promise.resolve('done')
    }, p)
    expect(r).toEqual({ value: 'done', attempts: 3 })
    expect(p.slept).toEqual([1000, 2000])
  })

  it('doubles each time and is capped; a provider Retry-After is a floor', () => {
    const p = { baseMs: 1000, maxMs: 30_000, random: () => 0.5 }
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => backoffMs(n, p))).toEqual([1000, 2000, 4000, 8000, 16_000, 30_000, 30_000])
    expect(backoffMs(1, p, 5000)).toBe(5000)
    expect(backoffMs(1, p, 90_000)).toBe(30_000)
    expect(backoffMs(1, { ...p, random: () => 0 })).toBe(800)
    expect(backoffMs(1, { ...p, random: () => 1 })).toBe(1200)
  })

  it('after the retries it fails with AI_PROVIDER_ERROR and the attempt count, retryable for 429/5xx', async () => {
    const p = policy()
    let n = 0
    const err = await withRetry(() => {
      n += 1
      return Promise.reject(new ProviderAttemptError('transient', 503))
    }, p).catch((e: unknown) => e)
    expect(n).toBe(4)
    expect(err).toMatchObject({ code: 'AI_PROVIDER_ERROR', attempts: 4, retryable: true, providerStatus: 503 })
    expect(p.slept).toEqual([1000, 2000, 4000])
  })

  it('does not retry a fatal failure (a 4xx other than 429, an unusable reply, an unsafe URL)', async () => {
    const p = policy()
    let n = 0
    const err = await withRetry(() => {
      n += 1
      return Promise.reject(new ProviderAttemptError('fatal', 401))
    }, p).catch((e: unknown) => e)
    expect(n).toBe(1)
    expect(err).toMatchObject({ code: 'AI_PROVIDER_ERROR', attempts: 1, retryable: false })
    expect(p.slept).toEqual([])
  })

  it('an unexpected defect inside an adapter is fatal and its message is dropped', async () => {
    const err = await withRetry(() => Promise.reject(new Error('CANARY-DEFECT with the prompt text')), policy()).catch((e: unknown) => e)
    expect(err).toMatchObject({ code: 'AI_PROVIDER_ERROR', retryable: false })
    expect(String((err as Error).message)).not.toContain('CANARY')
  })

  it('a caller abort stops at once with AiCancelledError, also during the backoff sleep', async () => {
    const ctl = new AbortController()
    const p = policy({ signal: ctl.signal, sleep: () => Promise.reject(new Error('aborted')) })
    const err = await withRetry(() => Promise.reject(new ProviderAttemptError('transient', 500)), p).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AiCancelledError)
    ctl.abort()
    await expect(withRetry(() => Promise.resolve(1), policy({ signal: ctl.signal }))).rejects.toBeInstanceOf(AiCancelledError)
  })
})

describe('withRetry with fake timers', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('waits the backoff in (fake) time between attempts and gives up with AI_TIMEOUT when every attempt times out', async () => {
    const started = Date.now()
    const attempts: number[] = []
    const sleep: RetryPolicy['sleep'] = (ms) => new Promise((r) => setTimeout(r, ms))
    const run = withRetry(
      ({ signal }) => {
        attempts.push(Date.now() - started)
        return new Promise((_res, rej) => signal.addEventListener('abort', () => rej(new ProviderAttemptError('timeout'))))
      },
      { maxRetries: 2, baseMs: 1000, maxMs: 30_000, timeoutMs: 5000, sleep, random: () => 0.5 },
    ).catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(5000 + 1000 + 5000 + 2000 + 5000 + 10)
    const err = await run
    expect(err).toMatchObject({ code: 'AI_TIMEOUT', attempts: 3, retryable: true })
    expect(attempts).toEqual([0, 6000, 13_000])
  })

  it('a 429 followed by success waits exactly the first backoff', async () => {
    const started = Date.now()
    let n = 0
    const sleep: RetryPolicy['sleep'] = (ms) => new Promise((r) => setTimeout(r, ms))
    let doneAt = -1
    const run = withRetry(
      () => {
        n += 1
        return n === 1 ? Promise.reject(new ProviderAttemptError('transient', 429)) : Promise.resolve('ok')
      },
      { maxRetries: 3, baseMs: 1000, maxMs: 30_000, timeoutMs: 60_000, sleep, random: () => 0.5 },
    ).then((r) => {
      doneAt = Date.now() - started
      return r
    })
    await vi.advanceTimersByTimeAsync(999)
    expect(doneAt).toBe(-1)
    await vi.advanceTimersByTimeAsync(1)
    expect((await run).value).toBe('ok')
    expect(doneAt).toBe(1000)
  })
})

describe('price table (AI_PRICE_TABLE_JSON)', () => {
  const raw = JSON.stringify({ anthropic: { 'model-x': { inSenPerMTok: 300, outSenPerMTok: 1500 } }, 'openai-compatible': { '*': { inSenPerMTok: 10, outSenPerMTok: 20, perPageSen: 1 } } })

  it('prices tokens and pages in whole sen, rounding up, with an exact model before the wildcard', () => {
    const { table, problem } = parsePriceTable(raw)
    expect(problem).toBeNull()
    const e = priceFor(table, 'anthropic', 'model-x')
    expect(e).toBeDefined()
    expect(costSenOf(e!, { tokensIn: 1_000_000, tokensOut: 1_000_000, pages: 0 })).toBe(1800)
    expect(costSenOf(e!, { tokensIn: 1000, tokensOut: 1000, pages: 0 })).toBe(2) // 0.3 + 1.5 = 1.8 -> 2
    expect(costSenOf(e!, { tokensIn: 0, tokensOut: 0, pages: 5 })).toBe(0)
    const w = priceFor(table, 'openai-compatible', 'anything')
    expect(costSenOf(w!, { tokensIn: 0, tokensOut: 0, pages: 4 })).toBe(4)
    expect(priceFor(table, 'anthropic', 'other')).toBeUndefined()
    expect(priceFor(table, 'gemini', 'model-x')).toBeUndefined()
  })

  it('an empty, malformed or wrongly shaped table gives no prices (and says why), never a throw', () => {
    expect(parsePriceTable(undefined)).toEqual({ table: {}, problem: null })
    expect(parsePriceTable('')).toEqual({ table: {}, problem: null })
    expect(parsePriceTable('{nope').problem).toMatch(/not valid JSON/)
    expect(parsePriceTable('{"anthropic":{"m":{"inSenPerMTok":-1,"outSenPerMTok":1}}}').problem).toMatch(/shape/)
    expect(parsePriceTable('{"unknown-provider":{}}').problem).toMatch(/shape/)
  })
})
