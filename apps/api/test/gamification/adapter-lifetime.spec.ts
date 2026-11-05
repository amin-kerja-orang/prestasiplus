import { describe, expect, it } from 'vitest'

import type { GamificationRepository } from '../../src/modules/gamification/gamification.repository'
import { PerformanceGamificationAdapter } from '../../src/modules/gamification/performance-gamification.adapter'

const tier = (id: string, tierName: string, labelMs: string, minSyiling: number) => ({ id, tierName, labelMs, icon: '', minSyiling, sortOrder: Number(id), isActive: true })
const TIERS = [tier('1', 'bronze', 'Gangsa', 0), tier('2', 'silver', 'Perak', 500), tier('3', 'gold', 'Emas', 2000)]

const adapterOver = (wallet: { level: number; syiling: number; lifetime: number; tierId: string | null }) =>
  new PerformanceGamificationAdapter({
    handle: () => ({}),
    tiers: async () => TIERS,
    levelsOf: async () => new Map([['7', wallet]]),
    streaksOf: async () => new Map(),
  } as unknown as GamificationRepository)

/** FR-GM-17.2: the public profile and the rankings read the tier and the progress the pupil's own hub shows. */
describe('PerformanceGamificationAdapter on lifetime syiling', () => {
  it('spending does not move the progress: 374 lifetime with a balance of 74 is Gangsa, 126 from Perak; `syiling` stays the balance', async () => {
    const p = await adapterOver({ level: 1, syiling: 74, lifetime: 374, tierId: '1' }).profile('7')
    expect(p).toMatchObject({ syiling: 74, tier: { key: 'bronze', progressPct: 74.8, toNext: 126, nextKey: 'silver' } })
  })

  it('a stored tier that lags reads the lifetime tier; a stored tier above it is never lowered', async () => {
    expect((await adapterOver({ level: 1, syiling: 100, lifetime: 700, tierId: '1' }).profile('7'))?.tier).toMatchObject({ key: 'silver', ordinal: 2, progressPct: 35, toNext: 1300, nextKey: 'gold' })
    expect((await adapterOver({ level: 1, syiling: 10, lifetime: 100, tierId: '3' }).profile('7'))?.tier).toMatchObject({ key: 'gold', ordinal: 3, toNext: null })
  })
})
