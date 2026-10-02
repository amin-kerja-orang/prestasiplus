/**
 * The `wallets` spec (SRS M14 v1.7 §6.11.1, §6.10): 2,255 wallets, facet `tierKey` with the exact
 * cells bronze 1,889 · silver 292 · gold 41 · platinum 33, and the generated lifetime values.
 *
 * Generated `totalSyilingEarned` (§6.11.1): the 2,144 generated rows share **558,455** exactly
 * (3,124,192 − the anchors' 2,565,737), by a deterministic per-tier distribution with a
 * largest-remainder split and a repair pass, inside the per-tier bounds (gold [2,000, 2,884], silver
 * [500, 1,933], bronze [0, 497]). The per-tier shares and the curve are INFERRED (not observed):
 * gold 48,300, silver 244,800, bronze = the remainder (265,355), decreasing by rank (weights ((n − i) ÷ n)^p, p = 1
 * for gold, 2 otherwise). The build throws if a share is infeasible.
 */

import { exact, split, type CellSpec } from '@/mock/dataset'

import { ADMIN_WALLET } from '../data/designed'
import { WALLET_ANCHORS_4001 } from '../data/wallet-anchors'
import { DESIGNED_REPLAY } from '../seeds/replay'
import type { WalletRow } from '../repository/types'

export const WALLET_TOTAL = 2_255
export const WALLET_TIER_COUNTS = { bronze: 1_889, silver: 292, gold: 41, platinum: 33 } as const
export type SeedTier = keyof typeof WALLET_TIER_COUNTS

/** Q-SYILING-DIJANA at the seed (§6.10). */
export const SYILING_DIJANA = 3_124_192
/** Every wallet anchor: the admin, the designed accounts 2 and 4, and 4001–4108. */
export const WALLET_ANCHORS: readonly WalletRow[] = Object.freeze([
  Object.freeze({ ...ADMIN_WALLET }),
  ...DESIGNED_REPLAY.map((r) =>
    Object.freeze({ id: r.userId, userId: r.userId, ...r.wallet, createdAt: r.createdAt }),
  ),
  ...WALLET_ANCHORS_4001,
])

/**
 * Σ lifetime of the generated rows = Q-SYILING-DIJANA − Σ anchors (computed from the anchors, so a
 * changed anchor can never leave the total silently wrong): 3,124,192 − 2,565,737 = 558,455.
 */
export const GENERATED_LIFETIME_SUM =
  SYILING_DIJANA - WALLET_ANCHORS.reduce((sum, a) => sum + a.totalSyilingEarned, 0)

export const walletDistribution: readonly CellSpec<{ tierKey: string }>[] = exact(
  (Object.keys(WALLET_TIER_COUNTS) as SeedTier[]).map((tierKey) => ({
    facets: { tierKey },
    count: WALLET_TIER_COUNTS[tierKey],
  })),
)

interface TierCurve {
  lo: number
  hi: number
  share: number
  power: number
}

const GOLD_SHARE = 48_300
const SILVER_SHARE = 244_800

/**
 * INFERRED per-tier shares and curves (bounds §6.11.1). Bronze takes the remainder, so the three
 * shares always sum to `GENERATED_LIFETIME_SUM`; the curve check throws if it is infeasible.
 */
export const GENERATED_CURVES: Readonly<Record<SeedTier, TierCurve | null>> = {
  platinum: null, // every platinum wallet is an anchor (33)
  gold: { lo: 2_000, hi: 2_884, share: GOLD_SHARE, power: 1 },
  silver: { lo: 500, hi: 1_933, share: SILVER_SHARE, power: 2 },
  bronze: { lo: 0, hi: 497, share: GENERATED_LIFETIME_SUM - GOLD_SHARE - SILVER_SHARE, power: 2 },
}

/** §6.11.1: the anchors carry 2,565,737, so the generated rows share 558,455. */
export const DOCUMENTED_GENERATED_SUM = 558_455

// Load-time check (§6.11.1): the shares match the documented split of Q-SYILING-DIJANA.
{
  const shares = Object.values(GENERATED_CURVES).reduce((s, c) => s + (c?.share ?? 0), 0)
  if (shares !== GENERATED_LIFETIME_SUM || GENERATED_LIFETIME_SUM !== DOCUMENTED_GENERATED_SUM) {
    throw new Error(
      `M14 wallets: generated share ${String(GENERATED_LIFETIME_SUM)} (tiers ${String(shares)}) ≠ SYILING_DIJANA − Σ anchors = ${String(DOCUMENTED_GENERATED_SUM)} (§6.11.1)`,
    )
  }
}

/** Generated rows per tier = the cell count − the anchors of that tier. */
export function generatedCount(tier: SeedTier): number {
  return WALLET_TIER_COUNTS[tier] - WALLET_ANCHORS.filter((a) => a.tierKey === tier).length
}

/** Lifetime values of the generated rows of `tier`, by rank (0 = highest), Σ = the share. */
function curveValues(tier: SeedTier): number[] {
  const curve = GENERATED_CURVES[tier]
  const n = generatedCount(tier)
  if (!curve) {
    if (n !== 0)
      throw new Error(`M14 wallets: ${tier} has ${String(n)} generated rows and no curve`)
    return []
  }
  const extra = curve.share - n * curve.lo
  const room = n * (curve.hi - curve.lo)
  if (n <= 0 || extra < 0 || extra > room) {
    throw new Error(
      `M14 wallets: ${tier} share ${String(curve.share)} is infeasible for ${String(n)} rows`,
    )
  }
  const weights = Array.from({ length: n }, (_, i) => [i, ((n - i) / n) ** curve.power] as const)
  const parts = split(extra, weights).map(([, v]) => v)
  // Repair pass: clamp to the bound and hand the overflow to the next rows below the bound.
  let overflow = 0
  for (let i = 0; i < n; i++) {
    const cap = curve.hi - curve.lo
    if ((parts[i] as number) > cap) {
      overflow += (parts[i] as number) - cap
      parts[i] = cap
    }
  }
  for (let i = 0; overflow > 0 && i < n; i++) {
    const give = Math.min(overflow, curve.hi - curve.lo - (parts[i] as number))
    parts[i] = (parts[i] as number) + give
    overflow -= give
  }
  const values = parts.map((p) => curve.lo + p).sort((a, b) => b - a)
  const sum = values.reduce((a, b) => a + b, 0)
  if (sum !== curve.share) throw new Error(`M14 wallets: ${tier} values sum to ${String(sum)}`)
  return values
}

/** Generated lifetime values per tier, by rank (computed once, pure). */
export const GENERATED_LIFETIMES: Readonly<Record<SeedTier, readonly number[]>> = Object.freeze({
  platinum: curveValues('platinum'),
  gold: curveValues('gold'),
  silver: curveValues('silver'),
  bronze: curveValues('bronze'),
})

/** Level band of generated rows per tier (INFERRED from the anchors' levels). */
export const LEVEL_BANDS: Readonly<Record<string, readonly [number, number]>> = {
  bronze: [1, 5],
  silver: [5, 15],
  gold: [10, 14],
  platinum: [15, 22],
}

/** Generated `createdAt`: 2025-10-01 … 2026-09-20 (§6.11.1). */
export const GENERATED_CREATED_FROM = Date.parse('2025-10-01T08:00:00+08:00')
export const GENERATED_CREATED_DAYS = 355
