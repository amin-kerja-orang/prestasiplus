/**
 * The `coinLedger` spec (SRS M14 v1.7 §6.11.1, §6.10).
 *
 * - 52,964 rows: earn 52,426 · convert 535 · spend 1 · bonus 2 · refund 0.
 * - earn by source: the 400-row sample weights (largest remainder) over 52,420 rows, plus two exact
 *   cells the sample does not cover but the anchors need: `legacy` 3 (the admin's February rows)
 *   and `achievement` 3 (pelajarmaju's designed unlocks). **INFERRED** (§6.11.1 names neither cell;
 *   carving them from the earn total keeps every observed total).
 * - convert: `token_conversion` 534 split by the facet `tokens` so that Σ tokens = 7,801 (the 25
 *   anchors carry 80: 8, 25 × 2, 1 × 22; the 509 generated rows 7,721 over the INFERRED values
 *   1 / 5 / 10 / 25 / 60 / 150); `token_convert` 1 (the legacy row, 500 → 10 tokens).
 * - ids 1–53,668 (live range; 757 unused), anchors of accounts 1, 2, 4 in 140001–140299.
 */

import { exact, split, type CellSpec } from '@/mock/dataset'

import type { LedgerFacetKey, LedgerRow } from '../repository/types'

export const LEDGER_TOTAL = 52_964
export const LEDGER_TYPE_TOTALS = {
  earn: 52_426,
  convert: 535,
  spend: 1,
  bonus: 2,
  refund: 0,
} as const
export const LEDGER_ID_MAX = 53_668
export const LEDGER_RESERVED: readonly [number, number] = [140_001, 140_299]
export const Q_CONVERSIONS = 534
export const Q_TOKENS_CONVERTED = 7_801

/** Earn-source weights of the 400-row ledger sample (§6.11.1). */
export const EARN_WEIGHTS: readonly (readonly [string, number])[] = [
  ['daily_login', 90],
  ['quiz_spm', 127],
  ['quiz_practice', 86],
  ['daily_challenge', 51],
  ['jutawan_ilmu', 14],
  ['mystery_box', 6],
  ['spm', 4],
  ['quiz_complete', 4],
  ['mathrace_play', 3],
  ['structured_question', 2],
  ['papan_bijak', 2],
  ['benteng_win', 2],
  ['papan_bijak_win', 1],
  ['benteng_play', 1],
  ['perang_fakta_win', 1],
]

/** Exact earn cells outside the sample (INFERRED, see the header). */
export const EARN_EXACT: readonly (readonly [string, number])[] = [
  ['legacy', 3],
  ['achievement', 3],
]

/** Game sources (M16), dated ≤ 2026-05-25 (§6.11.1). */
export const GAME_SOURCES: readonly string[] = [
  'papan_bijak',
  'papan_bijak_win',
  'benteng_play',
  'benteng_win',
  'perang_fakta_win',
  'mathrace_play',
  'jutawan_ilmu',
]

/** `token_conversion` cells by tokens (anchors included). */
export const TOKEN_CELLS: readonly (readonly [number, number])[] = [
  [1, 253],
  [5, 98],
  [8, 1],
  [10, 70],
  [25, 62],
  [60, 30],
  [150, 20],
]

type Facets = Pick<LedgerRow, LedgerFacetKey>

export function ledgerDistribution(): CellSpec<Facets>[] {
  const exactEarn = EARN_EXACT.reduce((a, [, n]) => a + n, 0)
  const earn = split(LEDGER_TYPE_TOTALS.earn - exactEarn, EARN_WEIGHTS).map(([source, count]) => ({
    facets: { type: 'earn' as const, source, tokens: null },
    count,
  }))
  return exact<Facets>([
    ...earn,
    ...EARN_EXACT.map(([source, count]) => ({
      facets: { type: 'earn' as const, source, tokens: null },
      count,
    })),
    ...TOKEN_CELLS.map(([tokens, count]) => ({
      facets: { type: 'convert' as const, source: 'token_conversion', tokens },
      count,
    })),
    { facets: { type: 'convert', source: 'token_convert', tokens: 10 }, count: 1 },
    { facets: { type: 'spend', source: 'reward_claim', tokens: null }, count: 1 },
    { facets: { type: 'bonus', source: 'streak_bonus', tokens: null }, count: 2 },
  ])
}

/** Timeline of generated rows (see `./prime.ts`). */
export const EARLY_ROWS = 11
export const EARLY_FROM = Date.parse('2026-02-11T06:00:00+08:00')
export const EARLY_TO = Date.parse('2026-02-26T12:00:00+08:00')
export const MAIN_FROM = Date.parse('2026-02-27T09:05:00+08:00')
export const MAIN_TO = Date.parse('2026-09-25T12:19:00+08:00')
