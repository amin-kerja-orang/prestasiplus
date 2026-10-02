import { describe, expect, it } from 'vitest'

import { formatCaps, suggestCaps } from '../testing/perf-caps'

describe('suggestCaps (perf ratio-cap tuning rule)', () => {
  it('stable cases: cap = max(1.5 × median, 1.2 × worst), no slack; honest when cap < 2 × min', () => {
    const caps = suggestCaps([{ a: '0.10' }, { a: '0.11' }, { a: 0.12 }])
    expect(caps.a).toMatchObject({
      cap: 0.17,
      median: 0.11,
      min: 0.1,
      max: 0.12,
      runs: 3,
      noisy: false,
      slackMs: 0,
    })
    expect(caps.a?.cap).toBeLessThan(2 * 0.1)
  })

  it('a fast outlier run makes a case noisy (cap ≥ 2 × min), even with a tight median', () => {
    const caps = suggestCaps([{ w: 0.11 }, { w: 0.25 }, { w: 0.24 }, { w: 0.25 }, { w: 0.26 }])
    expect(caps.w).toMatchObject({ min: 0.11, noisy: true, slackMs: 1 })
    expect(caps.w?.cap).toBeLessThan(2 * (caps.w?.median ?? 0))
  })

  it('honest window [1.2 × worst, 1.9 × min): the where case measured alone and in the full file', () => {
    // Full-file runs ≈ 0.23; the same case run alone (-t) ≈ 0.17 (both contexts are calibrated).
    const runs = [0.2296, 0.2341, 0.2357, 0.2331, 0.2347, 0.1699, 0.1779, 0.1767, 0.182].map(
      (w) => ({ w }),
    )
    const c = suggestCaps(runs).w
    expect(c).toMatchObject({ min: 0.1699, max: 0.2357, noisy: false, slackMs: 0 })
    expect(c?.cap).toBeGreaterThanOrEqual(1.2 * 0.2357) // every run seen passes with margin
    expect(c?.cap).toBeLessThan(2 * 0.1699) // a real 2× of the fastest run fails
  })

  it('wide spreads are noisy, with slack', () => {
    const caps = suggestCaps([{ b: 1 }, { b: 1.1 }, { b: 3 }])
    expect(caps.b).toMatchObject({ cap: 3.6, noisy: true, slackMs: 1 })
  })

  it('property: honest ⇔ cap < 2 × min; honest implies no slack and cap × ref < 2 × median × ref', () => {
    let seed = 7
    const rnd = () => (seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648
    const runs = Array.from({ length: 5 }, () =>
      Object.fromEntries(
        Array.from({ length: 300 }, (_, k) => [
          `c${String(k)}`,
          0.01 + rnd() * (k % 3 === 0 ? 2 : k % 3 === 1 ? 0.3 : 0.02),
        ]),
      ),
    )
    const caps = Object.values(suggestCaps(runs))
    expect(caps.some((c) => c.noisy)).toBe(true)
    expect(caps.some((c) => !c.noisy)).toBe(true)
    for (const c of caps) {
      expect(c.min).toBeLessThanOrEqual(c.median)
      expect(c.noisy).toBe(!(c.cap < 2 * c.min))
      if (!c.noisy) {
        expect(c.slackMs).toBe(0)
        for (const ref of [9, 30, 45])
          expect(c.cap * ref + c.slackMs).toBeLessThan(2 * c.median * ref)
      } else {
        expect(c.slackMs).toBeGreaterThan(0)
      }
      // Whenever cap × ref + slack ≥ 2 × median × ref, the case is flagged noisy.
      for (const ref of [9, 30, 45]) {
        if (c.cap * ref + c.slackMs >= 2 * c.median * ref) expect(c.noisy).toBe(true)
      }
    }
  })

  it('applies ceilings, but never below 1.2 × the worst run', () => {
    expect(
      suggestCaps([{ s: 0.4 }, { s: 0.45 }, { s: 0.5 }], { ceilings: { s: 0.65 } }).s?.cap,
    ).toBe(0.65)
    expect(
      suggestCaps([{ s: 0.4 }, { s: 0.45 }, { s: 0.5 }], { ceilings: { s: 0.5 } }).s?.cap,
    ).toBe(0.6)
  })

  it('formats paste-ready lines (numbers for honest caps, objects for noisy ones)', () => {
    const text = formatCaps(
      suggestCaps([
        { 'q "x"': 0.1, n: 1 },
        { 'q "x"': 0.1, n: 1.1 },
        { 'q "x"': 0.1, n: 3 },
      ]),
    )
    expect(text).toContain('"q \\"x\\"": 0.15, // min 0.10000, median 0.10000, max 0.10000, 3 runs')
    expect(text).toContain('"n": { cap: 3.6, noisy: true, slackMs: 1 }')
  })
})
