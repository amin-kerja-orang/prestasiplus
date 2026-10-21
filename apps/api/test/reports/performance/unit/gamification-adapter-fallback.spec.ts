import { Logger } from '@nestjs/common'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PerformanceGamificationAdapter } from '../../../../src/modules/gamification/performance-gamification.adapter'
import type { GamificationRepository } from '../../../../src/modules/gamification/gamification.repository'

/** BE-19 review Minor 6: a database error in the gamification reads falls back, it never becomes a 500. */
const failing = (): GamificationRepository => {
  const boom = Object.assign(new Error('relation "x" has value Aina Contoh'), { code: 'P2010' })
  return {
    handle: () => ({}),
    tiers: async () => {
      throw boom
    },
    levelsOf: async () => {
      throw boom
    },
    streaksOf: async () => {
      throw boom
    },
    badgesOf: async () => {
      throw boom
    },
  } as unknown as GamificationRepository
}

afterEach(() => vi.restoreAllMocks())

describe('PerformanceGamificationAdapter fallback', () => {
  it('profiles answer syiling 0, ordinal 1 and no streak for every requested user, and log without the error message', async () => {
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    const adapter = new PerformanceGamificationAdapter(failing())
    const all = await adapter.profiles(['1', '2'])
    expect([...all.keys()]).toEqual(['1', '2'])
    expect(all.get('1')).toMatchObject({ userId: '1', syiling: 0, level: 1, streak: { current: 0, best: 0 }, tier: { ordinal: 1 } })
    expect((await adapter.profile('2'))?.syiling).toBe(0)
    expect(log).toHaveBeenCalled()
    for (const call of log.mock.calls) expect(String(call[0])).not.toContain('Aina')
  })

  it('badges answer an empty list', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    expect(await new PerformanceGamificationAdapter(failing()).badges('1')).toEqual([])
  })
})
