/**
 * The only file of M15 that imports M14 (D12): the wallet and draw contract of SRS M15 §6.10
 * (XR-M15-01/02/03). Every function used here exists in the M14 repository (F-26b), so this is a
 * thin typed adapter; if M14 changes a signature, only this file moves.
 *
 * Wallet writes run inside the caller's mock transaction (nested transactions join the outer one),
 * so an M14 refusal rolls back the M15 write too (BR-M15-21).
 */

import { draws, M14Error, wallet, type Draw } from '@/modules/m14-gamification/mock'

import { M15Error } from './types'

export interface BalanceView {
  tokenBalance: number
  syilingBalance: number
}

/** XR-M15-01 (`wallet.summary`): a user without a wallet row reads the BR-M14-02 defaults. */
export function balanceOf(userId: number): BalanceView {
  const s = wallet.summary(userId)
  return { tokenBalance: s.tokenBalance, syilingBalance: s.currentSyiling }
}

/** XR-M15-02: refuses with `INSUFFICIENT_TOKENS` (nothing written). */
export function debitTokens(userId: number, n: number, source: string, refId: string): number {
  try {
    return wallet.debitTokens(userId, n, { source, refId }).tokenBalance
  } catch (e) {
    if (e instanceof M14Error && e.code === 'INSUFFICIENT_BALANCE') {
      throw new M15Error('INSUFFICIENT_TOKENS', 'Token tidak mencukupi.')
    }
    throw e
  }
}

export function creditTokens(userId: number, n: number, source: string, refId: string): number {
  return wallet.creditTokens(userId, n, { source, refId }).tokenBalance
}

/** XR-M15-02: ledger description "Kotak Misteri: {name}" is the caller's. */
export function creditSyiling(
  userId: number,
  n: number,
  meta: { source: string; description: string; refId: string },
): number {
  return wallet.creditSyiling(userId, n, meta).currentSyiling
}

export function addXp(userId: number, n: number, source: string): void {
  wallet.addXp(userId, n, { source })
}

/** Test hook support (`setWallet`, XR-M15-08): the M14 repository owns it. */
export function setTokens(userId: number, tokens: number): void {
  wallet.setFields(userId, { tokens })
}

// --- draws (XR-M15-03) -------------------------------------------------------------------------

export type OpenDraw = Draw

export function listOpenDraws(today: string): Draw[] {
  return draws.listOpenDraws(today)
}

export function ticketsOwned(drawId: number, userId: number): number {
  return draws.ticketsOf(drawId, userId).length
}

/** M14 `draws.buyTicket` debits the syiling itself; its refusals map to the §7 #13 codes. */
export function buyTicket(drawId: number, userId: number): number {
  try {
    return draws.buyTicket(drawId, userId).currentSyiling
  } catch (e) {
    if (
      e instanceof M14Error &&
      (e.code === 'DRAW_CLOSED' || e.code === 'TICKET_LIMIT' || e.code === 'INSUFFICIENT_BALANCE')
    ) {
      throw new M15Error(e.code, e.message)
    }
    throw e
  }
}

/** Test fixture `draw` (XR-M15-08 `createDraw`). */
export function findOrCreateDraw(input: Parameters<typeof draws.create>[0]): Draw {
  const existing = draws.list().find((d) => d.title === input.title)
  return existing ?? draws.create(input)
}
