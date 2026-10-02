/**
 * Materialised M16-T1 tables (SRS M16 v1.6 §6.2–§6.9, §6.11.0). Seed battles keep fixed uuids
 * (`00000000-0000-4000-8000-…nn`); runtime battles, invitations and tournaments take deterministic
 * uuids; queues, leagues and the rest count up from the highest seeded id (`maxPlusOne`: league
 * ids 1 and 2 are observed, runtime leagues start at 3).
 */

import { defineTable, maxPlusOne, opaque, uuid } from '@/mock/define'

import type {
  BattleAnswerRow,
  BattleInvitationRow,
  BattleQueueRow,
  BattleRow,
  GameSessionRow,
  LeagueRow,
  LeagueSchoolRow,
  LeagueStandingRow,
  SekolahBersaingRow,
  StoredStandingRow,
  TournamentRow,
} from '../types'

export const battlesTable = defineTable<BattleRow>({
  name: 'm16.battles',
  ids: uuid('m16:battle'),
  indexes: ['playerA', 'playerB', 'status'],
})
export const battleQueuesTable = defineTable<BattleQueueRow>({
  name: 'm16.battleQueues',
  ids: maxPlusOne(),
  indexes: ['ownerId'],
})
export const battleInvitationsTable = defineTable<BattleInvitationRow>({
  name: 'm16.battleInvitations',
  ids: uuid('m16:invitation'),
  indexes: ['receiverId'],
})
export const battleAnswersTable = defineTable<BattleAnswerRow>({
  name: 'm16.battleAnswers',
  ids: maxPlusOne(),
  indexes: ['battleUuid'],
})
export const storedStandingsTable = defineTable<StoredStandingRow>({
  name: 'm16.storedStandings',
  ids: maxPlusOne(),
})
export const tournamentsTable = defineTable<TournamentRow>({
  name: 'm16.tournaments',
  ids: uuid('m16:tournament'),
  indexes: ['status'],
})
export const leaguesTable = defineTable<LeagueRow>({
  name: 'm16.leagues',
  ids: maxPlusOne(),
  indexes: ['inviteCode'],
})
export const leagueSchoolsTable = defineTable<LeagueSchoolRow>({
  name: 'm16.leagueSchools',
  ids: maxPlusOne(),
  indexes: ['leagueId', 'schoolId'],
})
export const leagueStandingsTable = defineTable<LeagueStandingRow>({
  name: 'm16.leagueStandings',
  ids: maxPlusOne(),
  indexes: ['leagueId'],
})
export const sekolahBersaingTable = defineTable<SekolahBersaingRow>({
  name: 'm16.sekolahBersaing',
  ids: maxPlusOne(),
  indexes: ['weekStart'],
})
export const gameSessionsTable = defineTable<GameSessionRow>({
  name: 'm16.gameSessions',
  ids: opaque('gs_', 'm16:game-session', 13),
  indexes: ['userId'],
})

/** Every M16-T1 table, for the plugin's `tables`. */
export const M16_TABLES = {
  battles: battlesTable,
  battleQueues: battleQueuesTable,
  battleInvitations: battleInvitationsTable,
  battleAnswers: battleAnswersTable,
  storedStandings: storedStandingsTable,
  tournaments: tournamentsTable,
  leagues: leaguesTable,
  leagueSchools: leagueSchoolsTable,
  leagueStandings: leagueStandingsTable,
  sekolahBersaing: sekolahBersaingTable,
  gameSessions: gameSessionsTable,
} as const
