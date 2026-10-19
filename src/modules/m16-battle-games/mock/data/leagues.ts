/**
 * The two observed leagues (SRS M16 v1.6 §6.11.5; ids and invite codes kept). `gameMode` and
 * `maxSchools` are not shown anywhere on live: PROPOSED `mixed` and null. League 2 is created by the
 * admin (user 1); league 1 by the teacher anchor 4401.
 */

import type { LeagueRow, LeagueSchoolRow, LeagueStandingRow } from '../types'

export const SEED_LEAGUES: readonly Omit<LeagueRow, 'createdAt'>[] = [
  {
    id: 1,
    name: 'Liga Sejarah 2026 5ST',
    type: 'friendly',
    scope: 'school',
    subjectId: 5,
    gameMode: 'mixed',
    classLevels: ['T5'],
    scoringMethod: 'total_score',
    startDate: '2026-03-31',
    endDate: '2026-04-01',
    maxSchools: null,
    inviteCode: 'RMU4VCBS',
    creatorId: 4401,
    status: 'upcoming',
  },
  {
    id: 2,
    name: 'Liga Matematik Sprint Test',
    type: 'friendly',
    scope: 'school',
    subjectId: 1,
    gameMode: 'mixed',
    classLevels: ['T4', 'T5'],
    scoringMethod: 'total_score',
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    maxSchools: null,
    inviteCode: 'TEST2026',
    creatorId: 1,
    status: 'ended',
  },
]

/** League 1: 8080, 8082, 8106; league 2: 8078, 8090 (Q-LEAGUE-SCHOOLS 3 / 2). */
export const SEED_LEAGUE_SCHOOLS: readonly Omit<LeagueSchoolRow, 'id' | 'joinedAt'>[] = [
  { leagueId: 1, schoolId: 8080 },
  { leagueId: 1, schoolId: 8082 },
  { leagueId: 1, schoolId: 8106 },
  { leagueId: 2, schoolId: 8078 },
  { leagueId: 2, schoolId: 8090 },
]

/** Stored hourly-job output of league 2 (league 1 has none, as live). */
export const SEED_LEAGUE_STANDINGS: readonly Omit<LeagueStandingRow, 'id'>[] = [
  { leagueId: 2, level: 'T4', schoolId: 8090, peserta: 8, skor: 2935.0, purata: 77.2, order: 1 },
  { leagueId: 2, level: 'T4', schoolId: 8078, peserta: 0, skor: 0, purata: 0, order: 2 },
  { leagueId: 2, level: 'T5', schoolId: 8090, peserta: 0, skor: 0, purata: 0, order: 1 },
  { leagueId: 2, level: 'T5', schoolId: 8078, peserta: 0, skor: 0, purata: 0, order: 2 },
]

export const LEAGUE_TYPE_LABELS = {
  friendly: 'Persahabatan',
  tournament: 'Kejohanan',
  league: 'Liga',
} as const

export const LEAGUE_SCOPE_LABELS = {
  school: 'Sekolah',
  district: 'Daerah',
  state: 'Negeri',
  national: 'Kebangsaan',
} as const

export const LEAGUE_SCORING_LABELS = {
  total_score: 'Jumlah Markah',
  avg_accuracy: 'Purata Ketepatan',
  wins: 'Bilangan Kemenangan',
} as const

export const LEAGUE_STATUS_LABELS = {
  upcoming: 'Akan Datang',
  ongoing: 'Sedang Berlangsung',
  ended: 'Tamat',
} as const

export const CLASS_LEVELS = [
  'D1',
  'D2',
  'D3',
  'D4',
  'D5',
  'D6',
  'T1',
  'T2',
  'T3',
  'T4',
  'T5',
] as const
