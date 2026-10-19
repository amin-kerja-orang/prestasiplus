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
  GameRoomRow,
  GameSessionRow,
  GameSettingsRow,
  GameStandingRow,
  JutawanStatsRow,
  LeagueRow,
  LeagueSchoolRow,
  LeagueStandingRow,
  PbSearchRow,
  PersonalBestRow,
  RoomPlayerRow,
  SekolahBersaingRow,
  SpinRow,
  SpinStatsRow,
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

export const gameRoomsTable = defineTable<GameRoomRow>({
  name: 'm16.gameRooms',
  // Codes are drawn by the repository from the stream `m16:room-code` (BR-M16-18) and stored explicitly.
  ids: opaque('', 'm16:room-code-unused', 8),
  indexes: ['status', 'game', 'hostId'],
})
export const roomPlayersTable = defineTable<RoomPlayerRow>({
  name: 'm16.roomPlayers',
  ids: maxPlusOne(),
  indexes: ['roomCode', 'userId'],
})
export const gameStandingsTable = defineTable<GameStandingRow>({
  name: 'm16.gameStandings',
  ids: maxPlusOne(),
  indexes: ['game', 'userId'],
})
export const personalBestsTable = defineTable<PersonalBestRow>({
  name: 'm16.personalBests',
  ids: maxPlusOne(),
  indexes: ['userId'],
})
export const jutawanStatsTable = defineTable<JutawanStatsRow>({
  name: 'm16.jutawanStats',
  ids: maxPlusOne(),
  indexes: ['userId'],
})
export const spinsTable = defineTable<SpinRow>({
  name: 'm16.spins',
  ids: maxPlusOne(),
  indexes: ['userId'],
})
export const spinStatsTable = defineTable<SpinStatsRow>({
  name: 'm16.spinStats',
  ids: maxPlusOne(),
  indexes: ['userId'],
})
export const pbSearchesTable = defineTable<PbSearchRow>({
  name: 'm16.pbSearches',
  ids: maxPlusOne(),
  indexes: ['userId'],
})
export const gameSettingsTable = defineTable<GameSettingsRow>({
  name: 'm16.gameSettings',
  ids: maxPlusOne(),
})

/** Every M16 table, for the plugin's `tables`. */
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
  gameRooms: gameRoomsTable,
  roomPlayers: roomPlayersTable,
  gameStandings: gameStandingsTable,
  personalBests: personalBestsTable,
  jutawanStats: jutawanStatsTable,
  spins: spinsTable,
  spinStats: spinStatsTable,
  pbSearches: pbSearchesTable,
  gameSettings: gameSettingsTable,
} as const
