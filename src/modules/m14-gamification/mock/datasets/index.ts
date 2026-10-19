/**
 * Priming of the M14 datasets (see `./prime.ts`): called by the M14 plugin's `finalise` and by
 * tests that compile the datasets themselves. Idempotent per seed.
 */

import {
  LEDGER_PINNED_BALANCE,
  LEDGER_PINNED_OWNER,
  LIVE_LEDGER_ANCHORS,
  OBSERVED_ROW_OWNERS,
} from '../data/ledger-anchors'
import type { LedgerRow, WalletRow } from '../repository/types'
import { generatedLedgerIso, ledgerDataset } from './ledger'
import {
  ledgerPrimeOrNull,
  pinGeneratedWallet,
  primeWalletCodec,
  requireWalletPrime,
  setLedgerPrime,
  setWalletLifetimes,
  walletPrimeOrNull,
  WALLET_KEY_BASE,
} from './prime'
import { walletsDataset } from './wallets'
import { GENERATED_LIFETIMES, type SeedTier, WALLET_TIER_COUNTS } from './wallets-spec'

/** Ids of the rows matching `where`, without deriving any row (id-only partial rows). */
function idsOf<R extends { id: number }>(
  count: (where: object, match: (row: R) => boolean, options: object) => number,
  where: object,
): number[] {
  const ids: number[] = []
  count(
    where,
    (row) => {
      ids.push(row.id)
      return false
    },
    { matchFields: ['id'] },
  )
  return ids
}

const walletCount = (where: object, match: (row: WalletRow) => boolean, options: object) =>
  walletsDataset.count(where, match, options)
const ledgerCount = (where: object, match: (row: LedgerRow) => boolean, options: object) =>
  ledgerDataset.count(where, match, options)

const OBSERVED_OWNER_SET = new Set(OBSERVED_ROW_OWNERS)

/**
 * The bronze conversion chain #53662 / #53663 (Baki 401, then 1) belongs to a generated student
 * whose wallet is the first generated bronze key (the highest bronze lifetime, ≥ 401), balance
 * pinned to 1 (review MINOR-7; see `../data/ledger-anchors.ts`).
 */
function pinLedgerOwner(
  bronzeKeys: readonly number[],
  lifetimes: ReadonlyMap<number, number>,
): void {
  const key = bronzeKeys[0]
  const need = Math.max(
    ...LIVE_LEDGER_ANCHORS.filter((r) => r.userId === LEDGER_PINNED_OWNER).map(
      (r) => r.balanceAfter,
    ),
  )
  if (key === undefined || (lifetimes.get(key) ?? 0) < need) {
    throw new Error(
      `M14 wallets: no generated bronze wallet with a lifetime ≥ ${String(need)} for the pinned ledger owner`,
    )
  }
  pinGeneratedWallet(LEDGER_PINNED_OWNER, key, LEDGER_PINNED_BALANCE)
}

export function primeM14Datasets(): void {
  if (!walletPrimeOrNull()) {
    primeWalletCodec()
    const lifetimes = new Map<number, number>()
    const bronzeKeys: number[] = []
    for (const tier of Object.keys(WALLET_TIER_COUNTS) as SeedTier[]) {
      const keys = idsOf(walletCount, { tierKey: tier })
        .filter((id) => !walletsDataset.isAnchor(id))
        .map((id) => {
          const key = requireWalletPrime().userToKey.get(id)
          if (key === undefined) throw new Error(`M14 wallets: no key for user ${String(id)}`)
          return key
        })
        .sort((a, b) => a - b)
      const values = GENERATED_LIFETIMES[tier]
      if (keys.length !== values.length) {
        throw new Error(
          `M14 wallets: ${tier} has ${String(keys.length)} generated rows, the curve ${String(values.length)}`,
        )
      }
      keys.forEach((key, i) => lifetimes.set(key, values[i] as number))
      if (tier === 'bronze') bronzeKeys.push(...keys)
    }
    setWalletLifetimes(lifetimes)
    pinLedgerOwner(bronzeKeys, lifetimes)
  }
  if (!ledgerPrimeOrNull()) {
    const pools: Record<string, number[]> = {}
    const tierOfUser = new Map<number, string>()
    for (const tier of Object.keys(WALLET_TIER_COUNTS)) {
      const ids = idsOf(walletCount, { tierKey: tier })
        .filter((id) => id !== 1 && id !== 2 && id !== 4 && !OBSERVED_OWNER_SET.has(id))
        .sort((a, b) => a - b)
      pools[tier] = ids
      for (const id of ids) tierOfUser.set(id, tier)
    }
    const genKeys = Uint32Array.from(
      idsOf(ledgerCount, {})
        .filter((id) => !ledgerDataset.isAnchor(id))
        .sort((a, b) => a - b),
    )
    setLedgerPrime({ genKeys, pools, tierOfUser })
    // Build the generated timeline now (boot), not on the first S5 read.
    if (genKeys.length > 0) generatedLedgerIso(genKeys[0] as number)
  }
}

export { WALLET_KEY_BASE }
export { walletsDataset } from './wallets'
export { ledgerDataset } from './ledger'
