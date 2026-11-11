/**
 * Ranking, leaderboard and public-profile read models (S19, S20, S18; SRS M08 v1.11 §7 #20–#22;
 * BR-M08-25, -27, -28). The standings of the observed and generated learners are documented display
 * data (LeaderboardStanding, the D11 exception); the designed learners and the viewer are computed
 * from the M05 session log (Q-SESS-USER) at request time.
 */

import { weekRange, monthRange } from '@/lib/time'
import { users } from '@/modules/m01-authentication/mock'
import { practice } from '@/modules/m05-practice/mock'
import { wallet } from '@/modules/m14-gamification/mock'

import type { Leaderboard, LeaderboardPeriod, Ranking } from '../../api/types'
import { capPercent, round } from './rules'
import { standingsRepo } from './stores'

/** The users whose standings are computed from the log: pelajar, pelajarmaju and the M08 pupils (BR-M08-28). */
export const DESIGNED_LEARNERS: readonly number[] = [
  2, 4, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008,
]

const FIRST_NAME = (name: string): string => name.trim().split(/\s+/)[0] ?? ''

/** "Sekitar anda": up to this many pupils on each side. */
const NEARBY = 2

/**
 * S19 Kedudukan (R1-MUR-18): the rank of a pupil among the designed learners and the pupil, by the current wallet
 * syiling (then the id, so positions are distinct). Mock scopes: sekolah (same school) and kebangsaan; negeri has no
 * state data in the mock, so it is "Belum tersedia". Other roles have no standing.
 */
export function kedudukanOf(viewer: {
  id: number
  role: string
  schoolId: number | null
  name: string
}): Ranking {
  if (viewer.role !== 'student') return { syiling: 0, scopes: [] }
  const pupils = [...new Set([...DESIGNED_LEARNERS, viewer.id])].flatMap((id) => {
    const user = users.get(id)
    if (!user) return []
    return [
      {
        id,
        schoolId: user.schoolId,
        name: id === viewer.id ? viewer.name : user.name,
        syiling: wallet.summary(id).currentSyiling,
      },
    ]
  })
  const own = pupils.find((p) => p.id === viewer.id)
  if (!own) return { syiling: 0, scopes: [] }
  const standing = (scope: 'sekolah' | 'kebangsaan') => {
    const pool = (scope === 'sekolah' ? pupils.filter((p) => p.schoolId === own.schoolId) : pupils).sort(
      (a, b) => b.syiling - a.syiling || a.id - b.id,
    )
    const at = pool.findIndex((p) => p.id === viewer.id)
    const from = Math.max(0, at - NEARBY)
    const total = pool.length
    const rank = at + 1
    return {
      scope,
      rank,
      total,
      percentile: Math.max(1, Math.floor((200 * rank + total) / (2 * total))),
      nearby: pool.slice(from, at + NEARBY + 1).map((p, i) => ({
        rank: from + i + 1,
        name: p.id === viewer.id ? p.name : FIRST_NAME(p.name),
        syiling: p.syiling,
        me: p.id === viewer.id,
      })),
    }
  }
  const scopes: Ranking['scopes'] = []
  if (own.schoolId !== null) scopes.push(standing('sekolah'))
  scopes.push({ scope: 'negeri', rank: null, total: null, percentile: null, nearby: [] })
  scopes.push(standing('kebangsaan'))
  return { syiling: own.syiling, scopes }
}

// ---------------------------------------------------------------------------------------------
// S20 leaderboard
// ---------------------------------------------------------------------------------------------

export const PERIODS: readonly LeaderboardPeriod[] = ['all', 'week', 'month']

/** BR-M08-28 window (MYT): week from Monday 00:00, month from the 1st, all = everything. */
function windowOf(period: LeaderboardPeriod, now: number): { from?: number; to?: number } {
  if (period === 'week') return { from: weekRange(now).start, to: now + 1 }
  if (period === 'month') return { from: monthRange(now).start, to: now + 1 }
  return {}
}

interface Standing {
  userId: number | null
  name: string
  coins: number
  sessions: number
  accuracy: number
  order: number
}

export function leaderboardOf(
  period: LeaderboardPeriod,
  viewerId: number,
  now: number,
): Leaderboard {
  const window = windowOf(period, now)
  const list: Standing[] = standingsRepo.forPeriod(period).map((r) => ({
    userId: r.userId,
    name: r.name,
    coins: r.coins,
    sessions: r.sessions,
    accuracy: r.accuracy,
    order: 1_000_000_000 + r.seq,
  }))
  const computed = new Set<number>([...DESIGNED_LEARNERS, viewerId])
  for (const id of computed) {
    const sessions = practice.history(id, window)
    if (sessions.length === 0) continue
    const withQ = sessions.filter((s) => s.questionCount > 0)
    list.push({
      userId: id,
      name: users.get(id)?.name ?? `Murid ${String(id)}`,
      coins: sessions.reduce((a, s) => a + s.coinsEarned, 0),
      sessions: sessions.length,
      accuracy:
        withQ.length === 0
          ? 0
          : (withQ.reduce((a, s) => a + s.correctCount / s.questionCount, 0) / withQ.length) * 100,
      order: id,
    })
  }
  list.sort((a, b) => b.coins - a.coins || b.accuracy - a.accuracy || a.order - b.order)
  const mineIdx = list.findIndex((s) => s.userId === viewerId)
  const mine = mineIdx === -1 ? null : (list[mineIdx] as Standing)
  const rows = list.slice(0, 50).map((s, i) => ({
    rank: i + 1,
    userId: s.userId,
    name: s.name,
    avatarUrl: null,
    coins: s.coins,
    sessions: s.sessions,
    accuracy: round(capPercent(s.accuracy), 1),
  }))
  return {
    period,
    me: {
      rank: mineIdx === -1 ? null : mineIdx + 1,
      coins: mine?.coins ?? 0,
      sessions: mine?.sessions ?? 0,
      accuracy: mine ? round(capPercent(mine.accuracy), 1) : 0,
    },
    rows,
    participants: rows.length,
  }
}
