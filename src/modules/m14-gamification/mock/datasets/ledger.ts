/**
 * The `coinLedger` virtual dataset (DATA-M14-02, D11; SRS M14 v1.7 §6.11.1).
 *
 * - Facets `type`, `source`, `tokens` (every §6.10 ledger figure is a sum of cells).
 * - Cheap fields `userId` (S17 per-user lists, S11 earned today / this week) and `createdAt`
 *   (newest first, S5 date filters); `amount`, `balanceAfter`, `description` are derived per source
 *   from the sample patterns (§6.11.1 "generated attributes"; INFERRED values).
 * - Anchors: the observed live-id rows and the rows of accounts 1, 2, 4 (reserved 140001–140299).
 * - Layout: game-source rows in ids 1–20,000 (dated ≤ 2026-05-25); the legacy `token_convert` row
 *   is the first generated slot from id 45 (so it is dated 27/02/2026 as sampled).
 * - Runtime rows from 9,000,001.
 */

import { toIsoMyt } from '@/lib/time'
import { defineVirtualDataset, hashKey } from '@/mock/dataset'
import { floor } from '@/mock/define'

import { OLD_CHALLENGE_REWARDS, SEED_CHALLENGES, SEED_TIERS } from '../data/catalogue'
import { ADMIN_LEDGER } from '../data/designed'
import { LIVE_LEDGER_ANCHORS } from '../data/ledger-anchors'
import { pctText } from '../repository/rules'
import type { LedgerCheapKey, LedgerFacetKey, LedgerRow } from '../repository/types'
import { DESIGNED_REPLAY } from '../seeds/replay'
import {
  EARLY_FROM,
  EARLY_ROWS,
  EARLY_TO,
  GAME_SOURCES,
  LEDGER_ID_MAX,
  LEDGER_RESERVED,
  LEDGER_TOTAL,
  MAIN_FROM,
  MAIN_TO,
  ledgerDistribution,
} from './ledger-spec'
import { requireLedgerPrime } from './prime'

export const LEDGER_RUNTIME_FLOOR = 9_000_001

/** The admin's rows 140001–140014 (§6.11.2) with running balances. */
function adminRows(): LedgerRow[] {
  let balance = 0
  return ADMIN_LEDGER.map(([createdAt, source, description, amount], i) => {
    balance += amount
    return {
      id: 140_001 + i,
      userId: 1,
      type: 'earn' as const,
      source,
      tokens: null,
      amount,
      balanceAfter: balance,
      description,
      refId: null,
      createdAt,
    }
  })
}

export const LEDGER_ANCHORS: readonly LedgerRow[] = Object.freeze(
  [...LIVE_LEDGER_ANCHORS, ...adminRows(), ...DESIGNED_REPLAY.flatMap((r) => r.ledger)].map((r) =>
    Object.freeze({ ...r }),
  ),
)

const CONVERSION_RATES: Readonly<Record<string, number>> = Object.fromEntries(
  SEED_TIERS.map((t) => [t.tierName, t.conversionRate]),
)

function rankOf(keys: Uint32Array, key: number): number {
  let lo = 0
  let hi = keys.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const k = keys[mid] as number
    if (k < key) lo = mid + 1
    else if (k > key) hi = mid - 1
    else return mid
  }
  return lo
}

/** Generated `createdAt` (ms) of the row at generated rank `r` of `n`. */
function timeOfRank(r: number, n: number): number {
  const minute = 60_000
  if (r < EARLY_ROWS) {
    const t = EARLY_FROM + Math.floor((r * (EARLY_TO - EARLY_FROM)) / (EARLY_ROWS - 1))
    return t - (t % minute)
  }
  const span = Math.max(1, n - EARLY_ROWS - 1)
  const t = MAIN_FROM + Math.floor(((r - EARLY_ROWS) * (MAIN_TO - MAIN_FROM)) / span)
  return Math.min(MAIN_TO, t - (t % minute))
}

interface Timeline {
  /** Generated rank per key (−1: not a generated key). */
  rankByKey: Int32Array
  msByRank: Float64Array
  isoByRank: string[]
}

/**
 * The generated timeline, built once per prime (the "newest first" scan reads it for every row, so
 * it must not format a date per row).
 */
const timelines = new WeakMap<Uint32Array, Timeline>()

function timeline(): Timeline {
  const { genKeys } = requireLedgerPrime()
  let t = timelines.get(genKeys)
  if (!t) {
    const n = genKeys.length
    const maxKey = n > 0 ? (genKeys[n - 1] as number) : 0
    const rankByKey = new Int32Array(maxKey + 1).fill(-1)
    const msByRank = new Float64Array(n)
    const isoByRank = new Array<string>(n)
    for (let r = 0; r < n; r++) {
      rankByKey[genKeys[r] as number] = r
      msByRank[r] = timeOfRank(r, n)
      isoByRank[r] = toIsoMyt(msByRank[r] as number)
    }
    t = { rankByKey, msByRank, isoByRank }
    timelines.set(genKeys, t)
  }
  return t
}

function rankOfKey(key: number): number {
  const t = timeline()
  const r = key < t.rankByKey.length ? (t.rankByKey[key] as number) : -1
  return r >= 0 ? r : rankOf(requireLedgerPrime().genKeys, key)
}

/** Generated `createdAt` (ms), non-decreasing in key (see `./prime.ts`). */
export function generatedLedgerTime(key: number): number {
  const r = rankOfKey(key)
  const t = timeline()
  return r < t.msByRank.length ? (t.msByRank[r] as number) : timeOfRank(r, t.msByRank.length)
}

/** Generated `createdAt` as stored (ISO `+08:00`). */
export function generatedLedgerIso(key: number): string {
  const r = rankOfKey(key)
  const t = timeline()
  return t.isoByRank[r] ?? toIsoMyt(generatedLedgerTime(key))
}

/** Tiers whose rate keeps `tokens × rate` within the tier's lifetime range (INFERRED). */
function tiersForTokens(tokens: number): readonly string[] {
  if (tokens <= 9) return ['bronze', 'silver', 'gold', 'platinum']
  if (tokens <= 48) return ['silver', 'gold', 'platinum']
  if (tokens <= 96) return ['gold', 'platinum']
  return ['platinum']
}

export function generatedLedgerUser(key: number, facets: Pick<LedgerRow, LedgerFacetKey>): number {
  const { pools } = requireLedgerPrime()
  const tiers =
    facets.type === 'convert' && facets.tokens !== null
      ? tiersForTokens(facets.tokens)
      : ['bronze', 'silver', 'gold', 'platinum']
  let total = 0
  for (const t of tiers) total += pools[t]?.length ?? 0
  if (total === 0) throw new Error('M14 coinLedger: no wallet user to hold a generated row')
  let i = hashKey(key, 21) % total
  for (const t of tiers) {
    const pool = pools[t] ?? []
    if (i < pool.length) return pool[i] as number
    i -= pool.length
  }
  throw new Error('unreachable')
}

const pick = <T>(list: readonly T[], h: number): T => list[h % list.length] as T
const PB = 'Jawab betul dalam Papan Bijak 🎲'

function deriveLedger(
  key: number,
  f: Pick<LedgerRow, LedgerFacetKey>,
): Pick<LedgerRow, 'amount' | 'balanceAfter' | 'description' | 'refId'> {
  const h = hashKey(key, 22)
  const h2 = hashKey(key, 23)
  const bal = (amount: number) => ({ amount, balanceAfter: amount + (h2 % 2_000) })
  switch (f.source) {
    case 'daily_login':
      return { ...bal(2), description: 'Streak activity (daily_login)', refId: null }
    case 'spm':
      return { ...bal(7), description: 'Streak activity (spm)', refId: null }
    case 'quiz_spm': {
      const past = h % 127 < 96
      const total = past ? pick([5, 10, 20, 40], h2) : pick([34, 40], h2)
      const correct = 1 + (hashKey(key, 24) % total)
      const prefix = past ? 'SPM Tahun Lepas' : 'Latih Tubi SPM'
      return {
        ...bal(correct),
        description: `${prefix}: ${String(correct)} betul — ${pctText(correct, total)}`,
        refId: null,
      }
    }
    case 'quiz_practice': {
      const total = pick([10, 20, 20, 20], h)
      const correct = 1 + (hashKey(key, 24) % total)
      return {
        ...bal(correct),
        description: `Latih Tubi: ${String(correct)} betul — ${pctText(correct, total)}`,
        refId: null,
      }
    }
    case 'daily_challenge': {
      const ch = pick(SEED_CHALLENGES, h)
      const old = OLD_CHALLENGE_REWARDS[ch.title]
      if (old !== undefined && generatedLedgerTime(key) < Date.parse('2026-03-01T00:00:00+08:00')) {
        return { ...bal(old), description: `Cabaran: ${ch.title}`, refId: null }
      }
      return { ...bal(ch.rewardSyiling), description: `Cabaran selesai: ${ch.title}`, refId: null }
    }
    case 'jutawan_ilmu': {
      const big = h % 14 < 11
      return {
        ...bal(big ? 1_000 : 50),
        description: `Jutawan Ilmu (Bahasa Melayu): Level ${String(big ? 15 : 1 + (h2 % 5))}`,
        refId: null,
      }
    }
    case 'mystery_box':
      return {
        ...bal(pick([119, 237, 285, 292, 392, 479], h)),
        description: 'Kotak Misteri: Kotak Legenda',
        refId: null,
      }
    case 'quiz_complete': {
      const subject = pick(['Matematik', 'Sains', 'Bahasa Melayu'], h)
      return {
        ...bal(pick([10, 12, 15], h2)),
        description: `Latihan ${subject} Darjah ${String(1 + (h % 6))}`,
        refId: null,
      }
    }
    case 'mathrace_play':
      return { ...bal(5), description: `#${String(1 + (h % 3))} Perlumbaan Matematik`, refId: null }
    case 'structured_question':
      return { ...bal(5), description: 'Soalan Berstruktur: 5/10 markah (50%)', refId: null }
    case 'papan_bijak':
      return { ...bal(5), description: PB, refId: null }
    case 'papan_bijak_win':
      return { ...bal(25), description: 'Menang Papan Bijak! 🏆🎲', refId: null }
    case 'benteng_win':
      return h % 2 === 0
        ? { ...bal(35), description: 'Juara Benteng Ilmu!', refId: null }
        : { ...bal(15), description: 'Menang Benteng Ilmu (lawan menyerah)', refId: null }
    case 'benteng_play':
      return { ...bal(8), description: 'Penyertaan Benteng Ilmu', refId: null }
    case 'perang_fakta_win':
      return { ...bal(10), description: 'Menang Perang Fakta (lawan menyerah)', refId: null }
    case 'token_conversion':
    case 'token_convert': {
      const tokens = f.tokens ?? 1
      const tier = requireLedgerPrime().tierOfUser.get(generatedLedgerUser(key, f)) ?? 'bronze'
      const rate = f.source === 'token_convert' ? 50 : (CONVERSION_RATES[tier] ?? 50)
      const s = tokens * rate
      return {
        amount: -s,
        balanceAfter: h2 % 500,
        description: `Tukar ${String(s)} syiling → ${String(tokens)} token`,
        refId: null,
      }
    }
    default:
      return { ...bal(1), description: f.source, refId: null }
  }
}

export const ledgerDataset = defineVirtualDataset<LedgerRow, LedgerFacetKey, LedgerCheapKey>({
  name: 'coinLedger',
  owner: 'M14',
  total: LEDGER_TOTAL,
  idRange: { min: 1, max: LEDGER_ID_MAX },
  reservedAnchorRanges: [LEDGER_RESERVED],
  runtimeIds: floor({ start: LEDGER_RUNTIME_FLOOR }),
  facets: ['type', 'source', 'tokens'],
  distribution: ledgerDistribution,
  derive: (id, facets) => deriveLedger(id, facets),
  fields: {
    userId: (key, f) => generatedLedgerUser(key, f),
    createdAt: (key) => generatedLedgerIso(key),
  },
  anchors: LEDGER_ANCHORS,
  order: { field: 'createdAt', generated: (key) => generatedLedgerIso(key) },
  layout: {
    blocks: [
      {
        label: 'game sources (≤ 2026-05-25)',
        cells: (f) => GAME_SOURCES.includes(f.source),
        fromId: 1,
        toId: 20_000,
      },
      {
        label: 'legacy token_convert (27/02/2026)',
        cells: (f) => f.source === 'token_convert',
        fromId: 45,
        contiguous: true,
      },
    ],
  },
})
