/**
 * DATA-M15-03 (S7-T07 P8): the one active mystery box and its seven prizes, as migration 0222 seeds them (48 GAME-23:
 * cost 50 syiling, integer weights that total 100, unlimited stock, no XP). Ids 1 to 4 are the four old boxes: they
 * stay inactive without prizes, so an old opening keeps its box name.
 */

import type { MysteryBoxPrize } from '../repository/types'

/** The id of the one active box. */
export const MYSTERY_BOX_ID = 5

/** `mystery_boxes.cost_syiling` of the seed (the cost never comes from a setting). */
export const MYSTERY_BOX_COST = 50

/** Seed of `mystery_box_daily_max` (48 section 2). */
export const MYSTERY_BOX_DAILY_MAX = 5

export const MYSTERY_BOX_LABEL = 'Kotak Misteri'

/** Names of the retired boxes 1 to 4, for the history of openings made before P8. */
export const RETIRED_BOX_NAMES: Readonly<Record<number, string>> = {
  1: 'Kotak Gangsa',
  2: 'Kotak Perak',
  3: 'Kotak Emas',
  4: 'Kotak Legenda',
}

export const MYSTERY_PRIZES: readonly MysteryBoxPrize[] = [
  { label: '10 syiling', kind: 'syiling', amount: 10, weight: 40, stock: null },
  { label: '25 syiling', kind: 'syiling', amount: 25, weight: 25, stock: null },
  { label: '60 syiling', kind: 'syiling', amount: 60, weight: 15, stock: null },
  { label: '1 token', kind: 'token', amount: 1, weight: 10, stock: null },
  { label: '150 syiling', kind: 'syiling', amount: 150, weight: 6, stock: null },
  { label: '3 token', kind: 'token', amount: 3, weight: 3, stock: null },
  { label: '500 syiling — jackpot!', kind: 'syiling', amount: 500, weight: 1, stock: null },
]
