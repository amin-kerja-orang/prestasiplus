/**
 * Ranking, leaderboard and public-profile read models (S19, S20, S18; SRS M08 v1.11 §7 #20–#22;
 * BR-M08-25, -27, -28). The standings of the observed and generated learners are documented display
 * data (LeaderboardStanding, the D11 exception); the designed learners and the viewer are computed
 * from the M05 session log (Q-SESS-USER) at request time.
 */

import { weekRange, monthRange } from '@/lib/time'
import { users } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'
import { practice } from '@/modules/m05-practice/mock'

import type { Leaderboard, LeaderboardPeriod, Ranking, RankingScope } from '../../api/types'
import { capPercent, round } from './rules'
import { rankingsRepo, standingsRepo } from './stores'

/** The users whose standings are computed from the log: pelajar, pelajarmaju and the M08 pupils (BR-M08-28). */
export const DESIGNED_LEARNERS: readonly number[] = [
  2, 4, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008,
]

const SCOPES: readonly RankingScope[] = ['nasional', 'negeri', 'daerah', 'sekolah']
const isScope = (v: string | undefined): v is RankingScope =>
  v !== undefined && (SCOPES as readonly string[]).includes(v)

const SCOPE_LABEL: Readonly<Record<RankingScope, string>> = {
  nasional: 'Nasional',
  negeri: 'Negeri',
  daerah: 'Daerah',
  sekolah: 'Sekolah',
}

const TINGKATAN_LEVEL: Readonly<Record<string, number>> = { T4: 10, T5: 11 }

export interface RankingQuery {
  scope?: string
  subjectId?: number
  tingkatan?: string
  negeri?: string
}

/** BR-M08-27: rows are ordered by Betul ascending (observed, DV-26), ties by accuracy descending. */
export function rankingOf(query: RankingQuery, viewerSchoolId: number | null): Ranking {
  const scope = isScope(query.scope) ? query.scope : query.scope === undefined ? 'nasional' : null
  const viewerSchool = viewerSchoolId === null ? undefined : schools.get(viewerSchoolId)
  const figureKey = query.subjectId === undefined ? 'all' : String(query.subjectId)

  let entries = rankingsRepo.all()
  if (scope === 'negeri') {
    entries = query.negeri ? entries.filter((e) => e.state === query.negeri) : []
  } else if (scope === 'daerah') {
    entries = viewerSchool ? entries.filter((e) => e.district === viewerSchool.district) : []
  } else if (scope === 'sekolah') {
    entries = viewerSchool ? entries.filter((e) => e.schoolName === viewerSchool.name) : []
  }
  const level = query.tingkatan ? TINGKATAN_LEVEL[query.tingkatan] : undefined
  if (level !== undefined) entries = entries.filter((e) => e.levelId === level)

  const rows = entries
    .flatMap((e) => {
      const f = e.figures[figureKey]
      return f ? [{ e, f }] : []
    })
    .sort((a, b) => a.f.correct - b.f.correct || b.f.accuracy - a.f.accuracy || a.e.id - b.e.id)
    .map(({ e, f }, i) => ({
      rank: i + 1,
      userId: e.userId,
      name: e.name,
      schoolName: e.schoolName,
      tahap: f.tahap,
      correct: f.correct,
      accuracy: round(capPercent(f.accuracy), 2),
    }))

  const label =
    scope === 'negeri' && query.negeri
      ? query.negeri
      : scope === null
        ? 'Nasional'
        : SCOPE_LABEL[scope]
  return {
    scope,
    title: `Kedudukan ${label}`,
    showFooter: scope === 'nasional',
    states: [...new Set(rankingsRepo.all().map((e) => e.state))].sort(),
    rows,
    total: rows.length,
  }
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
