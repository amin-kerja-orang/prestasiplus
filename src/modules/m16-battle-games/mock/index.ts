/**
 * M16 mock plugin (M16-T1: battle, tournament and league stores, seeds and handlers; SRS M16 v1.6 §6, §7;
 * overview §6.7, D11/D12). Owner of the battle stores (`battles`, queues, invitations, arena answers),
 * the stored school-standing figures, tournaments, leagues, the Sekolah Bersaing snapshots and the
 * single-player `gameResults` (the 47 seeded results; the game flows are M16-T2).
 *
 * PUBLIC exports (the only M16 mock code other modules may import, `@/modules/m16-battle-games/mock`, SRS §7.2):
 * - `battles` — `countFor(userIds, {from, to})` → `Map<userId, {count, correct, answered}>` (M11, `to` exclusive,
 *   finished and forfeited battles, both sides), `m17Counts()` → `{total, active, finished}` (168 / 0 / 66) and
 *   `windowCounts(days)` → `{battles, games}` (M17; 7 d 0 · 0, 30 d 4 · 5, 90 d 23 · 47);
 * - `gameResults.countFor(userIds, {from, to})` → `Map<userId, {count}>` (M11);
 * - `rooms` (the room games, standings, quick match and settings) and the single-player `gameResults`;
 * - `tournaments.active()` (banner, BR-M16-38);
 * - `standings.school(schoolId, period)` — the computed school standing of `weekly`, `monthly` or `all_time`
 *   (the repository behind it is named `battleStandings`, because `standings` is M08's);
 * - the other repositories `leagues`, `sekolahBersaing`, `battleStandings`, and the error class `M16Error`.
 *
 * M11's reader port (`registerM16Reads`) is registered from the seed.
 *
 * Routes (`handlers/`): §7 #1-#52 (T1: #1-#21, #42-#50; T2: the game endpoints #22-#41 and #51-#52). Client
 * functions and types: `../api`. Test hooks: `./hooks`.
 *
 * Bump `version` whenever the seed, a spec, `derive` or a cheap field changes (overview §6.9, §14 rule 4b).
 */

import { defineMockModule } from '@/mock/define'

import { m16Routes } from './handlers'
import { m16Hooks } from './hooks'
import {
  battleStandingsRepo,
  battlesRepo,
  gameResultsRepo,
  leaguesRepo,
  roomsRepo,
  sekolahBersaingRepo,
  tournamentsRepo,
  type StandingPeriod,
} from './repository'
import { finaliseM16, seedM16 } from './seeds/seed'
import { M16_TABLES } from './tables/tables'

const plugin = defineMockModule({
  id: 'M16',
  dependsOn: ['core', 'M01', 'M02', 'M03', 'M04', 'M05', 'M07', 'M14'],
  version: 2,
  tables: M16_TABLES,
  repositories: {
    battles: battlesRepo,
    battleStandings: battleStandingsRepo,
    gameResults: gameResultsRepo,
    rooms: roomsRepo,
    tournaments: tournamentsRepo,
    leagues: leaguesRepo,
    sekolahBersaing: sekolahBersaingRepo,
  },
  seed: seedM16,
  finalise: finaliseM16,
  routes: m16Routes,
  hooks: m16Hooks,
})

export default plugin

export const {
  battles,
  battleStandings,
  gameResults,
  rooms,
  tournaments,
  leagues,
  sekolahBersaing,
} = plugin.repositories

/** SRS §7.2 `standings.school(schoolId, period)` (M17, if it ever shows battles). */
export const standings = {
  school: (schoolId: number, period: StandingPeriod) => battleStandings.school(schoolId, period),
}

export { M16Error, type M16ErrorCode } from './repository'
export type {
  BattleListRow,
  LeagueCard,
  LeagueDetail,
  SchoolStanding,
  SekolahBersaingView,
  StandingPeriod,
  StudentStanding,
  TournamentActive,
} from './repository'
export type * from './types'
