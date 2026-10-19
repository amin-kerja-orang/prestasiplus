/**
 * Primed lookup tables of the two M14 datasets, built once per seed at the M14 plugin's
 * `finalise` (after every dataset has compiled, before the baseline and before a persisted overlay
 * is loaded), so they depend on the **baseline** only:
 *
 * - **Wallet codec** (§6.11.1 "generated rows take the userIds of M02 generated `student` users"):
 *   internal keys 1–2,255 are laid out by the dataset; key k maps to the eligible student at
 *   position ⌊(k − 1) × E ÷ 2,255⌋ of the ascending list of E eligible users (generated students of
 *   the M01 users store: role `student`, the generated e-mail `pelajar{000000}@demo.test`, and not an
 *   anchor of another module). Anchors keep their user id (keys 1,000,000 + userId).
 * - **Wallet ranks:** the generated rows of each tier by ascending key take the §6.11.1 lifetime
 *   values by rank, so their sum is exact.
 * - **Ledger timeline:** generated `createdAt` by rank among the generated keys: the first 11 before
 *   #15 (2026-02-11 06:00 … 2026-02-26 12:00, page 2119), the rest from 2026-02-27 09:05 to
 *   2026-09-25 12:19 (§6.11.1), non-decreasing in key.
 * - **Pinned owner:** generated student `LEDGER_PINNED_OWNER` takes the first generated bronze
 *   key with its balance pinned to the observed conversion chain #53662 / #53663 (SRS M14 v1.7
 *   §6.11.1; review MINOR-7).
 * - **Ledger users:** generated rows belong to wallet users other than 1, 2, 4 and the owners of
 *   the observed rows (their balances match those rows); conversion rows go to a tier whose rate
 *   keeps `tokens × rate` plausible.
 *
 * The tables read the users store through the M01 repository only (D12).
 */

import { users } from '@/modules/m01-authentication/mock'

import { isOtherModuleAnchor } from '../data/wallet-anchors'

export const WALLET_KEY_BASE = 1_000_000
export const WALLET_SLOTS = 2_255

export interface WalletPrime {
  keyToUser: Int32Array
  userToKey: Map<number, number>
  /** key → lifetime of generated rows. */
  lifetimeByKey: Map<number, number>
  /** key → pinned currentSyiling of a generated row (owner of an observed ledger row). */
  currentByKey: Map<number, number>
  eligible: number
}

export interface LedgerPrime {
  genKeys: Uint32Array
  /** Wallet user ids per tier (baseline; anchors 4001–4108 included; 1, 2, 4 excluded). */
  pools: Readonly<Record<string, readonly number[]>>
  tierOfUser: Map<number, string>
}

let walletPrime: WalletPrime | null = null
let ledgerPrime: LedgerPrime | null = null

/** Drops the primed tables (every seed / reset). */
export function resetPrimes(): void {
  walletPrime = null
  ledgerPrime = null
}

export function walletPrimeOrNull(): WalletPrime | null {
  return walletPrime
}

export function requireWalletPrime(): WalletPrime {
  if (!walletPrime) {
    throw new Error(
      'M14 wallets: not primed (the M14 finalise primes the dataset; tests call primeM14Datasets())',
    )
  }
  return walletPrime
}

export function requireLedgerPrime(): LedgerPrime {
  if (!ledgerPrime) {
    throw new Error(
      'M14 coinLedger: not primed (the M14 finalise primes the dataset; tests call primeM14Datasets())',
    )
  }
  return ledgerPrime
}

const pad6 = (n: number) => String(n).padStart(6, '0')

/**
 * The generated-student e-mail pattern of M01 (`users-derive.ts`: "pelajar{000000}@demo.test").
 * M14 tells generated students from anchors by it (plus the copied anchor list) until M01 exposes
 * `users.isAnchor(id)` (XR logged with M01).
 */
export const GENERATED_STUDENT_EMAIL = (id: number) => `pelajar${pad6(id)}@demo.test`

/** Generated students of the M01 users store, ascending (see the file header). */
export function eligibleStudentIds(): number[] {
  const { rows } = users.query('U-ROLE', { sort: 'id' }, 'student')
  const candidates = rows.filter((u) => !isOtherModuleAnchor(u.id))
  const eligible = candidates.filter((u) => u.email === GENERATED_STUDENT_EMAIL(u.id))
  if (eligible.length < WALLET_SLOTS) {
    throw new Error(
      `M14 wallets: only ${String(eligible.length)} of ${String(candidates.length)} non-anchor students match the M01 generated-student e-mail pattern "pelajar{000000}@demo.test"; ${String(WALLET_SLOTS)} are needed for the generated wallets (§6.11.1). If M01 changed its generated e-mails, update GENERATED_STUDENT_EMAIL (or use users.isAnchor once M01 exposes it).`,
    )
  }
  return eligible.map((u) => u.id)
}

/** Codec part of the wallet prime (needs the users store only). */
export function primeWalletCodec(): void {
  const eligible = eligibleStudentIds()
  const e = eligible.length
  const keyToUser = new Int32Array(WALLET_SLOTS + 1)
  const userToKey = new Map<number, number>()
  for (let k = 1; k <= WALLET_SLOTS; k++) {
    const uid = eligible[Math.floor(((k - 1) * e) / WALLET_SLOTS)] as number
    keyToUser[k] = uid
    userToKey.set(uid, k)
  }
  walletPrime = {
    keyToUser,
    userToKey,
    lifetimeByKey: new Map(),
    currentByKey: new Map(),
    eligible: e,
  }
}

/**
 * Places generated student `userId` on generated wallet key `key` (swapping with the user who had
 * it) and pins that wallet's `currentSyiling` (§6.11.1 "gen." values; review MINOR-7).
 */
export function pinGeneratedWallet(userId: number, key: number, currentSyiling: number): void {
  const p = requireWalletPrime()
  if (!eligibleSet(p).has(userId)) {
    throw new Error(
      `M14 wallets: pinned ledger owner ${String(userId)} is not a generated M01 student (pattern "pelajar{000000}@demo.test", not an anchor); pick another id in data/ledger-anchors.ts`,
    )
  }
  const oldKey = p.userToKey.get(userId)
  const displaced = p.keyToUser[key] as number
  p.keyToUser[key] = userId
  p.userToKey.set(userId, key)
  if (oldKey !== undefined && oldKey !== key) {
    p.keyToUser[oldKey] = displaced
    p.userToKey.set(displaced, oldKey)
  } else if (oldKey === undefined) {
    p.userToKey.delete(displaced)
  }
  p.currentByKey.set(key, currentSyiling)
}

let eligibleCache: { prime: WalletPrime; ids: Set<number> } | null = null
function eligibleSet(p: WalletPrime): Set<number> {
  if (eligibleCache?.prime !== p) eligibleCache = { prime: p, ids: new Set(eligibleStudentIds()) }
  return eligibleCache.ids
}

export function setWalletLifetimes(lifetimeByKey: Map<number, number>): void {
  requireWalletPrime().lifetimeByKey = lifetimeByKey
}

export function setLedgerPrime(prime: LedgerPrime): void {
  ledgerPrime = prime
}

export function ledgerPrimeOrNull(): LedgerPrime | null {
  return ledgerPrime
}
