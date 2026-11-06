import { describe, expect, it, vi } from 'vitest'

import { BattleEngine } from '../../src/modules/battle/engine'
import type { GamesPorts } from '../../src/modules/games'

describe('BattleEngine.botAccuracy', () => {
  it('reads on each call, so a saved `battle_bot_accuracy_pct` applies to the next answer and a failed read is not kept', async () => {
    const accuracy = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(0.6).mockResolvedValue(0.3)
    const ports = { platformAccuracy: { accuracy } } as unknown as GamesPorts
    const engine = new BattleEngine({} as never, {} as never, {} as never, ports, {} as never)
    await expect(engine.botAccuracy()).rejects.toThrow('down')
    await expect(engine.botAccuracy()).resolves.toBe(0.6)
    await expect(engine.botAccuracy()).resolves.toBe(0.3)
    expect(accuracy).toHaveBeenCalledTimes(3)
  })
})
