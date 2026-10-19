/**
 * S14 `/gamification/leaderboard` helpers (SRS M14 FR-M14-40..43, FN-M14-5.1.*): copy, the podium
 * order (silver, gold, bronze) and the tier label of a podium entry.
 */

import type { PodiumEntry } from '../../api'

export const LEADERBOARD_COPY = {
  title: '🏆 Papan Pendahulu',
  subtitle: 'Siapa paling rajin belajar?',
  syiling: 'syiling',
  loadError: 'Maaf, berlaku ralat. Sila cuba semula.',
  retry: 'Cuba Semula',
} as const

export interface PodiumSlot {
  entry: PodiumEntry
  medal: string
  /** The gold card is raised. */
  raised: boolean
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

/** Podium order silver (#2), gold (#1, raised), bronze (#3); missing ranks are left out. */
export function podiumSlots(podium: readonly PodiumEntry[]): PodiumSlot[] {
  const byRank = new Map(podium.map((e) => [e.rank, e]))
  return [2, 1, 3].flatMap((rank) => {
    const entry = byRank.get(rank)
    return entry ? [{ entry, medal: MEDALS[rank] ?? '', raised: rank === 1 }] : []
  })
}

export const PODIUM_CARD_CLASS: Record<number, string> = {
  1: 'bg-linear-to-b from-yellow-100 to-yellow-200',
  2: 'bg-linear-to-b from-slate-100 to-slate-200',
  3: 'bg-linear-to-b from-orange-100 to-amber-200',
}
