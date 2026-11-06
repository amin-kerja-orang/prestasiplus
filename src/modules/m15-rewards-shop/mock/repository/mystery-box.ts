/**
 * `mysteryBox` repository (owner M15; primary store `hadiah.mysteryBoxOpenings`): the one active box with its seven
 * prizes (DATA-M15-03, S7-T07 P8), the openings (DATA-M15-04) and the opening rule, the same as the API:
 * Mod Pelajar is the API's; here the checks run in the order replay, box exists and is active, N5 (no prize can be
 * won), daily limit, syiling balance; then the cost is debited (`opening:{id}:cost`), one prize is drawn by weight
 * among the prizes that can be won, a limited stock drops by 1 and the prize is credited (`opening:{id}:prize`).
 *
 * Consumer contract (SRS M15 §6.8, XR-M15-12): `mysteryBox.openingsCount(userId)` for M14's
 * achievement "Ahli Kotak Misteri".
 */

import { formatDateKey, toIsoMyt } from '@/lib/time'
import { mulberry32 } from '@/mock/determinism'
import { fnv1a32 } from '@/mock/determinism/hash'
import { defineRepository } from '@/mock/repository'

import {
  MYSTERY_BOX_COST,
  MYSTERY_BOX_DAILY_MAX,
  MYSTERY_BOX_ID,
  MYSTERY_BOX_LABEL,
  MYSTERY_PRIZES,
  RETIRED_BOX_NAMES,
} from '../data/mystery-boxes'
import { nowMs } from './clock'
import { balanceOf, creditSyiling, creditTokens, debitSyiling } from './m14-seam'
import { openingsTable } from './tables'
import {
  M15Error,
  type MysteryBox,
  type MysteryBoxOpening,
  type MysteryBoxPrize,
} from './types'
import type { MysteryBoxesView } from '../../api/types'

/** The box the admin can edit (hook `m15SetMysteryBox`); reset on every boot. */
const state: { box: MysteryBox; dailyMax: number; prizes: MysteryBoxPrize[] } = freshState()
/** The label of the next drawn prize (hook `m15MysteryNext`); cleared on use and on every boot. */
let nextLabel: string | null = null

function freshState(): { box: MysteryBox; dailyMax: number; prizes: MysteryBoxPrize[] } {
  return {
    box: { id: MYSTERY_BOX_ID, label: MYSTERY_BOX_LABEL, costSyiling: MYSTERY_BOX_COST, isActive: true },
    dailyMax: MYSTERY_BOX_DAILY_MAX,
    prizes: MYSTERY_PRIZES.map((p) => ({ ...p })),
  }
}

/** Boot / reset: the seed box, the seed prizes, no forced prize. */
export function resetMysteryBox(): void {
  Object.assign(state, freshState())
  nextLabel = null
}

/** Hook `m15MysteryNext`: the next successful opening draws the prize with this label. */
export function setNextMysteryPrize(label: string | null): void {
  nextLabel = label
}

/** Hook `m15SetMysteryBox`: edits the box as the admin save would. */
export function patchMysteryBox(patch: {
  isActive?: boolean
  costSyiling?: number
  dailyMax?: number
  stocks?: Record<string, number | null>
}): void {
  if (patch.isActive !== undefined) state.box.isActive = patch.isActive
  if (patch.costSyiling !== undefined) state.box.costSyiling = patch.costSyiling
  if (patch.dailyMax !== undefined) state.dailyMax = patch.dailyMax
  for (const [label, stock] of Object.entries(patch.stocks ?? {})) {
    const prize = state.prizes.find((p) => p.label === label)
    if (!prize) throw new RangeError(`m15SetMysteryBox: no prize '${label}'`)
    prize.stock = stock
  }
}

/** A prize can be won when its stock is unlimited (null) or above 0 (AC-GM-23.6). */
const winnable = (p: MysteryBoxPrize): boolean => p.weight > 0 && (p.stock === null || p.stock > 0)

const boxName = (id: number): string =>
  id === MYSTERY_BOX_ID ? state.box.label : (RETIRED_BOX_NAMES[id] ?? '')

export interface OpeningResult {
  opening: MysteryBoxOpening
  boxName: string
  prize: { label: string; kind: 'syiling' | 'token'; amount: number }
  tokenBalance: number
  syilingBalance: number
}

export const mysteryBoxRepo = defineRepository({
  owner: 'M15',
  name: 'mysteryBox',
  store: openingsTable,
  methods: ({ store, transaction }) => {
    /** The viewer's openings of the current Malaysia day. */
    const openedOn = (userId: number, day: string): number =>
      store.query({ where: { userId }, page: 1, pageSize: 100_000 }).rows.filter(
        (o) => o.createdAt.slice(0, 10) === day,
      ).length

    /** Q-M15-OPENINGS(user): newest first, at most `limit` (10). */
    const openingsOf = (userId: number, limit = 10): MysteryBoxOpening[] =>
      store.query({
        where: { userId },
        sort: [
          { field: 'createdAt', dir: 'desc' },
          { field: 'id', dir: 'desc' },
        ],
        page: 1,
        pageSize: limit,
      }).rows

    return {
      /** Q-M15-OPENINGS-COUNT(user): the consumer contract of M14 (BR-M14-16). */
      openingsCount(userId: number): number {
        return store.count({ userId })
      },

      openingsOf,

      /** #10: never draws. Chances are one decimal, renormalised over the prizes that can be won. */
      view(userId: number): MysteryBoxesView {
        const box = state.box.isActive ? state.box : null
        const eligible = box ? state.prizes.filter(winnable) : []
        const total = eligible.reduce((sum, p) => sum + p.weight, 0)
        return {
          box: box
            ? {
                id: box.id,
                label: box.label,
                costSyiling: box.costSyiling,
                prizes: eligible.map((p) => ({
                  label: p.label,
                  kind: p.kind,
                  amount: p.amount,
                  chance: Math.round((p.weight / total) * 1000) / 10,
                })),
              }
            : null,
          available: eligible.length > 0,
          syilingBalance: balanceOf(userId).syilingBalance,
          dailyMax: state.dailyMax,
          openedToday: openedOn(userId, formatDateKey(nowMs())),
          history: openingsOf(userId, 10).map((o) => ({
            id: o.id,
            boxId: o.boxId,
            boxName: boxName(o.boxId),
            prizeLabel: o.prizeLabel,
            prizeKind: o.prizeKind,
            prizeAmount: o.prizeAmount,
            createdAt: o.createdAt,
          })),
        }
      },

      /**
       * #11, one atomic step. Refusals (nothing written): `NOT_FOUND` (unknown or inactive box), `BOX_UNAVAILABLE`
       * (N5), `MYSTERY_DAILY_LIMIT`, `INSUFFICIENT_BALANCE`. The same `clientUuid` answers the first opening.
       */
      open(userId: number, boxId: number, clientUuid: string): OpeningResult {
        return transaction(() => {
          const first = store
            .query({ where: { userId }, page: 1, pageSize: 100_000 })
            .rows.find((o) => o.clientUuid === clientUuid)
          if (first) {
            if (first.boxId !== boxId) throw new M15Error('NOT_FOUND', 'Kotak tidak dijumpai.')
            const after = balanceOf(userId)
            return {
              opening: first,
              boxName: boxName(first.boxId),
              prize: {
                label: first.prizeLabel ?? '',
                kind: first.prizeKind ?? 'syiling',
                amount: first.prizeAmount ?? 0,
              },
              tokenBalance: after.tokenBalance,
              syilingBalance: after.syilingBalance,
            }
          }
          if (boxId !== state.box.id || !state.box.isActive) {
            throw new M15Error('NOT_FOUND', 'Kotak tidak dijumpai.')
          }
          const eligible = state.prizes.filter(winnable)
          if (eligible.length === 0) {
            throw new M15Error('BOX_UNAVAILABLE', 'Kotak tidak tersedia buat masa ini.')
          }
          const ms = nowMs()
          const day = formatDateKey(ms)
          if (openedOn(userId, day) >= state.dailyMax) {
            throw new M15Error(
              'MYSTERY_DAILY_LIMIT',
              'Had kotak hari ini telah dicapai. Cuba lagi esok.',
            )
          }
          if (balanceOf(userId).syilingBalance < state.box.costSyiling) {
            throw new M15Error('INSUFFICIENT_BALANCE', 'Baki syiling tidak mencukupi.')
          }
          const forced = nextLabel === null ? undefined : eligible.find((p) => p.label === nextLabel)
          let prize: MysteryBoxPrize
          if (forced) {
            prize = forced
          } else {
            const rng = mulberry32(
              fnv1a32(`m15-mystery:${String(userId)}:${String(store.count({ userId }))}`),
            )
            const total = eligible.reduce((sum, p) => sum + p.weight, 0)
            let pick = rng.int(1, total)
            prize = eligible.find((p) => (pick -= p.weight) <= 0) ?? (eligible[eligible.length - 1] as MysteryBoxPrize)
          }
          const at = toIsoMyt(ms - (((ms % 1000) + 1000) % 1000))
          const opening = store.insert({
            userId,
            boxId,
            prizeLabel: prize.label,
            prizeKind: prize.kind,
            prizeAmount: prize.amount,
            clientUuid,
            createdAt: at,
          })
          const ref = `opening:${String(opening.id)}`
          debitSyiling(userId, state.box.costSyiling, {
            source: 'mystery_box',
            description: `Kotak Misteri: ${state.box.label}`,
            refId: `${ref}:cost`,
          })
          if (prize.kind === 'syiling') {
            creditSyiling(userId, prize.amount, {
              source: 'mystery_box',
              description: `Kotak Misteri: ${prize.label}`,
              refId: `${ref}:prize`,
            })
          } else {
            creditTokens(userId, prize.amount, 'mystery_box', `${ref}:prize`)
          }
          if (prize.stock !== null) prize.stock -= 1
          // A refused opening keeps the hook's prize for the next call.
          if (forced) nextLabel = null
          const after = balanceOf(userId)
          return {
            opening,
            boxName: state.box.label,
            prize: { label: prize.label, kind: prize.kind, amount: prize.amount },
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
    }
  },
})
