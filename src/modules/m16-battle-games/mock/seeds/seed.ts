/**
 * M16 seed (SRS M16 v1.6 §6.11), written through the M16 repositories (overview §3 rule 3a):
 *
 * - `seedM16(ctx)` (seed phase): the 47 observed battles, the 97 `abandoned` battles, the stored
 *   standing figures (DC-M16-03), the 47 submitted game results, the two leagues; and the M11 port
 *   (`registerM16Reads`).
 * - `finaliseM16(ctx)` (after every dataset has compiled): the 24 generated older battles (they need
 *   real M02 pupils), the Sekolah Bersaing snapshots (their schools are register placements), and
 *   the build check — every documented M16 figure must equal the computed count.
 */

import { checkNamedQueries } from '@/mock/dataset'
import type { SeedContext } from '@/mock/define'
import { isAnchorUser, users } from '@/modules/m01-authentication/mock'
import { registerM16Reads } from '@/modules/m11-teacher-analytics/mock'

import {
  abandonedBattleRows,
  generatedBattleRows,
  observedBattleRows,
  seedGameSessions,
  STORED_STANDINGS,
} from '../data/battles'
import { SEED_ROOM_PLAYERS, standingUserIds } from '../data/games'
import {
  battleQueries,
  battleStandingsRepo,
  battlesRepo,
  bindM16Clock,
  bindM16Prng,
  gameResultQueries,
  gameResultsRepo,
  leagueQueries,
  leaguesRepo,
  resetBotAccuracy,
  roomQueries,
  roomsRepo,
  sekolahBersaingQueries,
  standingQueries,
  sekolahBersaingRepo,
  setPendingSim,
  tournamentQueries,
} from '../repository'

export function seedM16(ctx: SeedContext): void {
  bindM16Clock(ctx.clock)
  bindM16Prng(ctx.prng)
  resetBotAccuracy()
  setPendingSim(null)
  roomsRepo.resetSim()
  gameResultsRepo.setSpinNext(null)
  roomsRepo.seedStandings()
  battlesRepo.seed([
    ...observedBattleRows(),
    ...abandonedBattleRows(ctx.prng.fresh('m16:seed-abandoned')),
  ])
  battleStandingsRepo.seed(STORED_STANDINGS)
  gameResultsRepo.seed(seedGameSessions(ctx.prng.fresh('m16:seed-games')))
  leaguesRepo.seed()
  // The M11 reader port (XR-M16-05): re-registered on every seed, so a reset keeps it.
  registerM16Reads({
    battles: { countFor: (ids, range) => battlesRepo.countFor(ids, range) },
    gameResults: { countFor: (ids, range) => gameResultsRepo.countFor(ids, range) },
  })
}

function pupilsOf(
  schoolId: number,
  n: number,
  rng: ReturnType<SeedContext['prng']['fresh']>,
): number[] {
  const ids = users
    .query('U-SCHOOL', { sort: 'id', page: 1, pageSize: 2000 }, schoolId)
    .rows.filter((u) => u.role === 'student' && u.isActive && !isAnchorUser(u.id))
    .map((u) => u.id)
  if (ids.length < n) {
    throw new Error(
      `M16 seed: school ${String(schoolId)} has ${String(ids.length)} generated pupils, need ${String(n)}`,
    )
  }
  return rng.shuffle(ids).slice(0, n)
}

/** Throws when a documented M16 figure differs from the computed count (stops the boot). */
export function finaliseM16(ctx: SeedContext): void {
  const rng = ctx.prng.fresh('m16:seed-battles')
  const noSchool = users.selection('attendanceMirror')
  battlesRepo.seed(
    generatedBattleRows(
      {
        p8106: pupilsOf(8106, 5, rng),
        p8078: pupilsOf(8078, 8, rng),
        p8080: pupilsOf(8080, 6, rng),
        noSchool,
      },
      rng,
    ),
  )
  sekolahBersaingRepo.seedWeeks()
  // The 160 closed rooms: 189 distinct users = the 38 standing users + 151 generated students (§6.11.0).
  const standing = new Set(standingUserIds())
  const generated = users
    .sample('U-ROLE-ACTIVE', 800, ctx.prng.fresh('m16:seed-rooms:users'), 'student', true)
    .filter((u) => !isAnchorUser(u.id) && !standing.has(u.id))
    .map((u) => u.id)
    .slice(0, SEED_ROOM_PLAYERS - standing.size)
  roomsRepo.seedRooms(ctx.prng.fresh('m16:seed-rooms'), generated)
  const roomUsers = roomsRepo.distinctPlayers()
  if (roomUsers !== SEED_ROOM_PLAYERS) {
    throw new Error(
      `M16 build check failed: ${String(roomUsers)} room players, need ${String(SEED_ROOM_PLAYERS)}`,
    )
  }
  const issues = [
    ...checkNamedQueries(roomQueries),
    ...checkNamedQueries(standingQueries),
    ...checkNamedQueries(battleQueries),
    ...checkNamedQueries(gameResultQueries),
    ...checkNamedQueries(tournamentQueries),
    ...checkNamedQueries(leagueQueries),
    ...checkNamedQueries(sekolahBersaingQueries),
  ]
  if (issues.length > 0) {
    throw new Error(`M16 build check failed:\n${issues.map((i) => `- ${i.message}`).join('\n')}`)
  }
}
