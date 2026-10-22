import { describe, expect, it, vi } from 'vitest'

import type { BattleDeps } from '../../src/modules/battle/battle.deps'
import { BattleEngine } from '../../src/modules/battle/engine'

describe('BattleEngine.botAccuracy', () => {
  it('does not cache a rejected read: the next call retries, a resolved one is cached', async () => {
    const platformAccuracy = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue(0.6)
    const engine = new BattleEngine({} as never, {} as never, { platformAccuracy } as unknown as BattleDeps, {} as never)
    await expect(engine.botAccuracy()).rejects.toThrow('down')
    await expect(engine.botAccuracy()).resolves.toBe(0.6)
    await expect(engine.botAccuracy()).resolves.toBe(0.6)
    expect(platformAccuracy).toHaveBeenCalledTimes(2)
  })
})
