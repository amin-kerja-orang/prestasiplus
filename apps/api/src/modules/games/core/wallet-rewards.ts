import { Inject, Injectable } from '@nestjs/common'

import type { TxClient } from '../../../db/client'
import { WalletService } from '../../wallet'
import type { GameResultInput, GameResultOutcome, GameRewardsPort } from './ports'

/** Static BM ledger wording of a game result (copy of the M14 mock `gameRow`; no personal data). */
export function gameRow(
  game: string,
  event: string,
  p: { correct?: number; total?: number; detail?: Record<string, unknown> },
): { source: string; description: string } {
  const d = p.detail ?? {}
  const n = (v: unknown, f = 0): number => (typeof v === 'number' ? v : f)
  const correct = String(p.correct ?? 0)
  switch (game) {
    case 'papan_bijak':
      return event === 'win'
        ? { source: 'papan_bijak_win', description: 'Menang Papan Bijak! 🏆🎲' }
        : { source: 'papan_bijak', description: 'Jawab betul dalam Papan Bijak 🎲' }
    case 'benteng':
    case 'benteng_ilmu':
      if (event === 'win') return { source: 'benteng_win', description: 'Juara Benteng Ilmu!' }
      if (event === 'forfeit_win') return { source: 'benteng_win', description: 'Menang Benteng Ilmu (lawan menyerah)' }
      return { source: 'benteng_play', description: 'Penyertaan Benteng Ilmu' }
    case 'perang_fakta':
      return { source: 'perang_fakta_win', description: 'Menang Perang Fakta (lawan menyerah)' }
    case 'mathrace':
      return { source: 'mathrace_play', description: `#${String(n(d['rank'], 1))} Perlumbaan Matematik` }
    case 'jutawan':
    case 'jutawan_ilmu':
      return {
        source: 'jutawan_ilmu',
        description: `Jutawan Ilmu (${typeof d['subject'] === 'string' ? d['subject'] : 'Bahasa Melayu'}): Level ${String(n(d['level'], 1))}`,
      }
    case 'cabaran_kilat':
      return { source: 'cabaran_kilat', description: `Cabaran Kilat: ${correct} betul, combo ${String(n(d['maxCombo'], 1))}x` }
    case 'betul_salah':
      return { source: 'betul_salah', description: `Betul/Salah: ${correct} betul, streak ${String(n(d['maxStreak'], 1))}` }
    default:
      return { source: game, description: `${game}: ${correct} betul` }
  }
}

const whole = (v: number): number => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)

/**
 * Default `GameRewardsPort` (until BE-23 merges): BE-23 semantics over `WalletService.credit`
 * (`sourceId = game:<key>`, ledger source and description from `gameRow`).
 *
 * `canEarnSyiling` is FALSE here: the `games_award_syiling` setting (seed value 0) lives in BE-23, so nothing is
 * credited by default. On the BE-23 merge the lead rebinds the port to `GamificationService` with
 * `GamesPorts.provideRewards`. Tests bind a double (or a subclass overriding `canEarnSyiling`).
 */
@Injectable()
export class WalletGameRewards implements GameRewardsPort {
  constructor(@Inject(WalletService) private readonly wallet: WalletService) {}

  async canEarnSyiling(): Promise<boolean> {
    return false
  }

  async tierRates(): Promise<{ correct: number; win: number }> {
    return { correct: 0, win: 0 }
  }

  async onGameResult(
    userId: string,
    input: GameResultInput,
    options: { tx?: TxClient; isTest: boolean },
  ): Promise<GameResultOutcome> {
    if (options.isTest) return { coinsCredited: 0, xpAdded: 0 } // Mod Pelajar never earns
    const tx = options.tx
    let coins = 0
    if (await (this as GameRewardsPort).canEarnSyiling(userId, tx ? { tx } : {})) {
      if (input.coins !== undefined) coins = whole(input.coins)
      else if (input.game === 'papan_bijak') {
        const rates = await (this as GameRewardsPort).tierRates(userId, tx ? { tx } : {})
        coins = whole(input.event === 'win' ? rates.win : rates.correct)
      }
    }
    let coinsCredited = 0
    if (coins >= 1) {
      const row = gameRow(input.game, input.event, input)
      const key = input.key === undefined ? { sourceId: null, noKeyReason: 'game result without an idempotency key' } : { sourceId: `game:${input.key}` }
      const out = await this.wallet.credit(
        { userId, amount: coins, source: row.source, description: row.description, isTest: false, ...key },
        tx ? { tx } : {},
      )
      coinsCredited = Math.abs(out.amount)
    }
    const xp = whole(input.xp)
    let xpAdded = 0
    if (xp > 0) {
      await this.wallet.addXp({ userId, amount: xp, isTest: false }, tx ? { tx } : {})
      xpAdded = xp
    }
    return { coinsCredited, xpAdded }
  }
}
