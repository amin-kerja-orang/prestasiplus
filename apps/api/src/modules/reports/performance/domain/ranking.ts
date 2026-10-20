import { mytDay, startOfMytDay } from '../../../../db/clock'
import { round } from './rules'

/** Rankings and leaderboard rules (S19, S20; BR-M08-25, -27, -28). Pure: no store access, no clock. */
export type RankingScope = 'nasional' | 'negeri' | 'daerah' | 'sekolah'
export type LeaderboardPeriod = 'all' | 'week' | 'month'

const SCOPES: readonly RankingScope[] = ['nasional', 'negeri', 'daerah', 'sekolah']
const SCOPE_LABEL: Readonly<Record<RankingScope, string>> = {
  nasional: 'Nasional',
  negeri: 'Negeri',
  daerah: 'Daerah',
  sekolah: 'Sekolah',
}

/** Missing scope is nasional; an unknown one is null (the rows are then unfiltered, as the mock). */
export function parseScope(raw: string | undefined): RankingScope | null {
  if (raw === undefined) return 'nasional'
  return (SCOPES as readonly string[]).includes(raw) ? (raw as RankingScope) : null
}

/** T4 / T5 to the level code of the answer rows; anything else is no filter. */
export function levelCodeOf(tingkatan: string | undefined): 't4' | 't5' | undefined {
  if (tingkatan === 'T4') return 't4'
  if (tingkatan === 'T5') return 't5'
  return undefined
}

export function rankingTitle(scope: RankingScope | null, negeri: string | undefined): string {
  const label = scope === 'negeri' && negeri ? negeri : scope === null ? SCOPE_LABEL.nasional : SCOPE_LABEL[scope]
  return `Kedudukan ${label}`
}

/** Accuracy of the ranking table: 2 decimals, capped at 100 (DV-07). */
export function rankingAccuracy(correct: number, answered: number): number {
  return answered === 0 ? 0 : round(Math.min((correct / answered) * 100, 100), 2)
}

/** An unknown period is the week (FR-M08-114). */
export function parsePeriod(raw: string | undefined): LeaderboardPeriod {
  return raw === 'all' || raw === 'month' || raw === 'week' ? raw : 'week'
}

/** BR-M08-28 window in MYT: the week starts on Monday 00:00, the month on the 1st; `all` has no start. */
export function periodWindow(period: LeaderboardPeriod, now: Date): { from?: Date; to: Date } {
  const to = new Date(now.getTime() + 1)
  if (period === 'all') return { to }
  const dayStart = startOfMytDay(now)
  if (period === 'month') {
    const first = `${mytDay(now).slice(0, 8)}01`
    return { from: new Date(`${first}T00:00:00+08:00`), to }
  }
  const dow = new Date(`${mytDay(now)}T00:00:00Z`).getUTCDay() // 0 = Sunday
  const sinceMonday = (dow + 6) % 7
  return { from: new Date(dayStart.getTime() - sinceMonday * 86_400_000), to }
}

/** The first name plus the initial of the last name ("Siti N."); a single word stays as it is. */
export function shortName(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean)
  const first = tokens[0] ?? ''
  const last = tokens.length > 1 ? tokens[tokens.length - 1] : undefined
  const initial = last === undefined ? undefined : Array.from(last)[0]
  return initial === undefined ? first : `${first} ${initial.toUpperCase()}.`
}

/** The first word of the name. */
export const firstNameOf = (name: string): string => name.trim().split(/\s+/)[0] ?? ''
