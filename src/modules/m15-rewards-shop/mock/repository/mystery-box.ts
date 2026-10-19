/**
 * `mysteryBox` repository (owner M15; primary store `hadiah.mysteryBoxOpenings`): the four boxes
 * (constants, DATA-M15-03), the openings (DATA-M15-04) and the opening rule (BR-M15-17/18).
 *
 * Consumer contract (SRS M15 §6.8, XR-M15-12): `mysteryBox.openingsCount(userId)` for M14's
 * achievement "Ahli Kotak Misteri".
 */

import { toIsoMyt } from '@/lib/time'
import { mulberry32 } from '@/mock/determinism'
import { fnv1a32 } from '@/mock/determinism/hash'
import { defineRepository } from '@/mock/repository'

import { MYSTERY_BOXES } from '../data/mystery-boxes'
import { nowMs } from './clock'
import { addXp, balanceOf, creditSyiling, debitTokens } from './m14-seam'
import { openingsTable } from './tables'
import { M15Error, type MysteryBox, type MysteryBoxOpening } from './types'

/** The next opening's fixed result (hook `m15MysteryNext`); cleared on use and on every boot. */
let nextResult: { coins: number; xp: number } | null = null

export function setNextMysteryResult(result: { coins: number; xp: number } | null): void {
  nextResult = result
}

export interface OpeningResult {
  opening: MysteryBoxOpening
  box: MysteryBox
  tokenBalance: number
  syilingBalance: number
}

export const mysteryBoxRepo = defineRepository({
  owner: 'M15',
  name: 'mysteryBox',
  store: openingsTable,
  methods: ({ store, transaction }) => ({
    /** DATA-M15-03. */
    boxes(): readonly MysteryBox[] {
      return MYSTERY_BOXES
    },

    box(id: number): MysteryBox | undefined {
      return MYSTERY_BOXES.find((b) => b.id === id)
    },

    /** Q-M15-OPENINGS-COUNT(user): the consumer contract of M14 (BR-M14-16). */
    openingsCount(userId: number): number {
      return store.count({ userId })
    },

    /** Q-M15-OPENINGS(user): newest first, at most `limit` (10). */
    openingsOf(userId: number, limit = 10): MysteryBoxOpening[] {
      return store.query({
        where: { userId },
        sort: [
          { field: 'createdAt', dir: 'desc' },
          { field: 'id', dir: 'desc' },
        ],
        page: 1,
        pageSize: limit,
      }).rows
    },

    /**
     * BR-M15-17/18 (#11), one atomic step: `INSUFFICIENT_TOKENS` below the cost; M14 debits the
     * tokens (`mystery_box`), credits the coins ("Kotak Misteri: {name}") and the XP; an opening row
     * is stored. Result mechanism (PROPOSED): uniform integers in the box ranges from a PRNG seeded
     * by (userId, opening count); `setNextMysteryResult` overrides the next draw.
     */
    open(userId: number, boxId: number): OpeningResult {
      const box = MYSTERY_BOXES.find((b) => b.id === boxId)
      if (!box) throw new M15Error('NOT_FOUND', 'Kotak tidak dijumpai.')
      return transaction(() => {
        if (balanceOf(userId).tokenBalance < box.costTokens) {
          throw new M15Error('INSUFFICIENT_TOKENS', 'Token tidak mencukupi.')
        }
        let coins: number
        let xp: number
        const forced = nextResult
        if (forced) {
          ;({ coins, xp } = forced)
        } else {
          const rng = mulberry32(
            fnv1a32(`m15-mystery:${String(userId)}:${String(store.count({ userId }))}`),
          )
          coins = rng.int(box.coinMin, box.coinMax)
          xp = rng.int(box.xpMin, box.xpMax)
        }
        const ms = nowMs()
        const at = toIsoMyt(ms - (((ms % 1000) + 1000) % 1000))
        const opening = store.insert({ userId, boxId, coins, xp, createdAt: at })
        const ref = `opening:${String(opening.id)}`
        debitTokens(userId, box.costTokens, 'mystery_box', ref)
        creditSyiling(userId, coins, {
          source: 'mystery_box',
          description: `Kotak Misteri: ${box.name}`,
          refId: ref,
        })
        if (xp > 0) addXp(userId, xp, 'mystery_box')
        const after = balanceOf(userId)
        // A refused opening keeps the hook's result for the next call.
        if (forced) nextResult = null
        return {
          opening,
          box,
          tokenBalance: after.tokenBalance,
          syilingBalance: after.syilingBalance,
        }
      })
    },

    /** Fixture / test support: rows with their fixed ids (15301–15399). */
    seedOpenings(rows: readonly MysteryBoxOpening[]): void {
      transaction(() => {
        for (const r of rows) {
          if (store.get(r.id)) store.remove(r.id)
          store.insert({ ...r })
        }
      })
    },
  }),
})
