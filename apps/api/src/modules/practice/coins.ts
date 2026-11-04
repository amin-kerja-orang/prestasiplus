/**
 * Coin rate per correct answer (S5-T15, S-18, DM-48): `reward_settings.coins_per_correct` (row id 1), read on EVERY call
 * so an admin change applies to the next credit. Only the presence of the table is cached (60 s) so the migration that
 * creates it (S7-T05, 0223) is picked up without a restart. Table or row absent: 1. The value is clamped to 0..20.
 */
import { Logger } from '@nestjs/common'

import type { TxClient } from '../../db/client'

export const DEFAULT_COINS_PER_CORRECT = 1
export const MAX_COINS_PER_CORRECT = 20
const PRESENCE_TTL_MS = 60_000

type Db = Pick<TxClient, '$queryRaw'>

const logger = new Logger('coinsPerCorrect')

let presence: { present: boolean; at: number } | undefined

/** Forgets the cached table-presence answer (tests). */
export function resetCoinsPresenceCache(): void {
  presence = undefined
}

async function tablePresent(db: Db, now: number): Promise<boolean> {
  if (presence && now - presence.at < PRESENCE_TTL_MS) return presence.present
  const rows = await db.$queryRaw<{ present: boolean }[]>`SELECT to_regclass('reward_settings') IS NOT NULL AS present`
  const present = rows[0]?.present === true
  presence = { present, at: now }
  return present
}

/** Coins credited per correct answer: an integer from 0 to 20 (1 until the settings table and row exist, and on any read error). */
export async function coinsPerCorrect(db: Db, now: number = Date.now()): Promise<number> {
  try {
    if (!(await tablePresent(db, now))) return DEFAULT_COINS_PER_CORRECT
    const rows = await db.$queryRaw<{ coins_per_correct: number | null }[]>`SELECT coins_per_correct FROM reward_settings WHERE id = 1`
    const raw = rows[0]?.coins_per_correct
    if (raw === null || raw === undefined || !Number.isFinite(Number(raw))) return DEFAULT_COINS_PER_CORRECT
    return Math.min(MAX_COINS_PER_CORRECT, Math.max(0, Math.trunc(Number(raw))))
  } catch (err) {
    // The table may have been dropped or renamed after the presence answer was cached: forget it and use the default.
    logger.warn(`reward_settings read failed, using ${String(DEFAULT_COINS_PER_CORRECT)}: ${err instanceof Error ? err.message : String(err)}`)
    resetCoinsPresenceCache()
    return DEFAULT_COINS_PER_CORRECT
  }
}
