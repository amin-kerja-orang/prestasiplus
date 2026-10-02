/**
 * The `wallets` virtual dataset (DATA-M14-01, D11; SRS M14 v1.7 §6.11.1). Key = the M02 user id.
 *
 * - 2,255 rows, facet `tierKey` (exact cells); anchors: admin 1, designed 2 and 4, fixtures
 *   4001–4108 (reserved keys 1,000,000 + userId); generated rows on generated M02 students (codec,
 *   `./prime.ts`).
 * - Cheap fields (S4 filters and sorts, S14 ranking): `userId`, `totalSyilingEarned`,
 *   `currentSyiling`, `tokenBalance`, `level`, `xp`, `createdAt`.
 * - A new wallet is an overlay insert with its user id (BR-M14-02, first credit).
 *
 * Bump the M14 plugin `version` whenever this spec, the curves or a cheap field changes (§6.9).
 */

import { toIsoMyt } from '@/lib/time'
import { defineVirtualDataset, hashKey, type IdCodec } from '@/mock/dataset'
import { floor, ID_RANGES } from '@/mock/define'

import type { WalletCheapKey, WalletFacetKey, WalletRow } from '../repository/types'
import { requireWalletPrime, walletPrimeOrNull, WALLET_KEY_BASE, WALLET_SLOTS } from './prime'
import {
  GENERATED_CREATED_DAYS,
  GENERATED_CREATED_FROM,
  LEVEL_BANDS,
  WALLET_ANCHORS,
  WALLET_TOTAL,
  walletDistribution,
} from './wallets-spec'

const ANCHOR_USERS = new Set(WALLET_ANCHORS.map((a) => a.id))

/** Anchors keep their user id (reserved keys); generated keys map to generated students. */
export const walletCodec: IdCodec<number> = {
  encode(key: number): number {
    if (key > WALLET_KEY_BASE) return key - WALLET_KEY_BASE
    const uid = requireWalletPrime().keyToUser[key]
    if (uid === undefined || uid === 0)
      throw new Error(`M14 wallets: no user for key ${String(key)}`)
    return uid
  },
  decode(id: number): number | undefined {
    if (ANCHOR_USERS.has(id)) return WALLET_KEY_BASE + id
    return walletPrimeOrNull()?.userToKey.get(id)
  },
}

const lifetimeOf = (key: number): number => {
  const v = requireWalletPrime().lifetimeByKey.get(key)
  if (v === undefined) throw new Error(`M14 wallets: key ${String(key)} has no primed lifetime`)
  return v
}

const levelOf = (key: number, tierKey: string): number => {
  const [lo, hi] = LEVEL_BANDS[tierKey] ?? [1, 1]
  return lo + (hashKey(key, 3) % (hi - lo + 1))
}

export const walletsDataset = defineVirtualDataset<WalletRow, WalletFacetKey, WalletCheapKey>({
  name: 'wallets',
  owner: 'M14',
  total: WALLET_TOTAL,
  idRange: { min: 1, max: WALLET_SLOTS },
  reservedAnchorRanges: [[WALLET_KEY_BASE + 1, WALLET_KEY_BASE + 9_999]],
  runtimeIds: floor({ start: ID_RANGES.usersRuntimeFloor }),
  idCodec: walletCodec,
  facets: ['tierKey'],
  distribution: walletDistribution,
  derive: () => ({}),
  fields: {
    userId: (key) => walletCodec.encode(key),
    totalSyilingEarned: (key) => lifetimeOf(key),
    currentSyiling: (key) =>
      requireWalletPrime().currentByKey.get(key) ??
      Math.floor((lifetimeOf(key) * (50 + (hashKey(key, 1) % 51))) / 100),
    tokenBalance: (key) => hashKey(key, 2) % 51,
    level: (key, f) => levelOf(key, f.tierKey),
    xp: (key, f) => levelOf(key, f.tierKey) * 40 + (hashKey(key, 4) % 100),
    createdAt: (key) =>
      toIsoMyt(
        GENERATED_CREATED_FROM +
          (hashKey(key, 5) % GENERATED_CREATED_DAYS) * 86_400_000 +
          (hashKey(key, 6) % 12) * 3_600_000,
      ),
  },
  anchors: WALLET_ANCHORS,
})
