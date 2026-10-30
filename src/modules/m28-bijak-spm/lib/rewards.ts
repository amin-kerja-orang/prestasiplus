/**
 * The reward line of the result screen, behind one adapter so the source of the figures is a one-line
 * switch. Today it reads `result.points` / `result.coins` of the result the page FIRST loaded (the
 * credited amount). The result recomputed after a self-mark is deliberately not fed in: its coins can
 * exceed what was credited at submit, and a line that grows after Hantar would be wrong.
 */
import type { AttemptResult } from '../domain/types'

export interface RewardItem {
  id: 'mata' | 'koin'
  value: string
  unit: string
  art: 'bolt' | 'coin'
}

export function rewardItems(credited: Pick<AttemptResult, 'points' | 'coins'> | undefined): RewardItem[] {
  return [
    { id: 'mata', value: `+${credited?.points ?? 0}`, unit: 'Mata', art: 'bolt' },
    { id: 'koin', value: `+${credited?.coins ?? 0}`, unit: 'Koin', art: 'coin' },
  ]
}
