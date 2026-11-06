import { randomInt } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import {
  GAMES_LEAGUE_CLASS_LEVELS,
  GAMES_MESSAGES,
  type GamesLeagueCard,
  type GamesLeagueDetail,
  type GamesLeagueList,
  type GamesLeagueMe,
  type GamesLeagueStandingRow,
  type GamesLeagueStandings,
  type GamesLeagueStatus,
  type GamesSekolahBersaingBoard,
} from '@pp/contract'

import { CLOCK, type Clock } from '../../../db/clock'
import { idFromString, isIdString } from '../../../db/ids'
import { CurriculumRepository } from '../../curriculum'
import { PracticeRepository } from '../../practice'
import { isPrimarySchoolType, SchoolsRepository } from '../../schools'
import { SEKOLAH_BERSAING_MIN_PUPILS, SEKOLAH_BERSAING_TOP_N } from '../games.constants'
import { fieldError, leagueAlreadyIn, leagueEnded, leagueFull, leagueNotFound, leagueSchoolInvalid } from '../errors'
import { levelCodeOfGrade } from '../core/grades'
import { GameUsers } from '../core/game-users'
import { NamePrivacy } from '../core/name-privacy.service'
import type { GamesCaller } from '../caller'
import { type LeagueRecord, LeaguesRepository } from './leagues.repository'
import {
  buildStandings,
  CONTRIBUTORS_TOP_N,
  dateOnly,
  gradeOfLevel,
  hourStart,
  INVITE_ALPHABET,
  LABELS,
  leagueStatus,
  leagueWindow,
  parseEnrolInput,
  parseLeagueInput,
  parseLevelQuery,
  pupilPoints,
  type PupilFacts,
  rankSekolahBersaing,
} from './leagues.rules'

type GamesLeagueClassLevel = (typeof GAMES_LEAGUE_CLASS_LEVELS)[number]

/** Tries per create before giving up (a collision of 36^8 codes is vanishingly rare). */
const CODE_TRIES = 50

@Injectable()
export class LeaguesService {
  constructor(
    @Inject(LeaguesRepository) private readonly repo: LeaguesRepository,
    @Inject(GameUsers) private readonly users: GameUsers,
    @Inject(NamePrivacy) private readonly privacy: NamePrivacy,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(PracticeRepository) private readonly practice: PracticeRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private async subjectName(subjectId: string | null): Promise<string | null> {
    if (subjectId === null) return null
    return (await this.curriculum.subject(idFromString(subjectId)))?.name ?? null
  }

  private async schoolIdOf(userId: string): Promise<string | null> {
    return (await this.users.get(userId))?.schoolId ?? null
  }

  /** The creator is an Admin Pusat (only the admin creates a league): children's names rule, name only (the response has no id). */
  private async creatorName(caller: GamesCaller, creatorId: string | null): Promise<string> {
    if (creatorId === null) return ''
    const creator = await this.users.get(creatorId)
    return creator ? (await this.privacy.resolver(caller)).name(creator) : ''
  }

  /** The status by date and clock; the stored `leagues.status` column is not read (S7-T06 part 3). */
  private statusOf(l: LeagueRecord, now: Date): GamesLeagueStatus {
    return leagueStatus(dateOnly(l.startDate), dateOnly(l.endDate), now)
  }

  private cardOf(l: LeagueRecord, subjectName: string | null, schools: number, now: Date): GamesLeagueCard {
    const status = this.statusOf(l, now)
    return {
      id: l.id,
      name: l.name,
      status,
      statusLabel: LABELS.status[status],
      scopeLabel: LABELS.scope[l.scope as keyof typeof LABELS.scope],
      typeLabel: LABELS.type[l.type as keyof typeof LABELS.type],
      subjectName,
      startDate: dateOnly(l.startDate),
      endDate: dateOnly(l.endDate),
      schools,
    }
  }

  /** M16-46: `mine` = leagues with the caller's school, `open` = every league that is not ended. */
  async list(caller: GamesCaller): Promise<GamesLeagueList> {
    const schoolId = await this.schoolIdOf(caller.userId)
    const all = await this.repo.leagues(caller.isTest)
    const counts = await this.repo.schoolCounts(
      all.map((l) => l.id),
      caller.isTest,
    )
    const mineIds = schoolId === null ? new Set<string>() : await this.repo.leagueIdsOfSchool(schoolId, caller.isTest)
    const names = new Map<string, string | null>()
    for (const l of all) if (l.subjectId !== null && !names.has(l.subjectId)) names.set(l.subjectId, await this.subjectName(l.subjectId))
    const now = this.clock.now()
    const card = (l: LeagueRecord): GamesLeagueCard => this.cardOf(l, l.subjectId === null ? null : (names.get(l.subjectId) ?? null), counts.get(l.id) ?? 0, now)
    return { mine: all.filter((l) => mineIds.has(l.id)).map(card), open: all.filter((l) => this.statusOf(l, now) !== 'ended').map(card) }
  }

  /** M16-49. A malformed id is "not found", never a 500. */
  async detail(caller: GamesCaller, id: string): Promise<GamesLeagueDetail> {
    if (!isIdString(id)) throw leagueNotFound()
    const l = await this.repo.league(id, caller.isTest)
    if (!l) throw leagueNotFound()
    const allSchoolIds = await this.repo.schoolIds(l.id, caller.isTest)
    const levels = await this.repo.classLevels(l.id)
    const storedAll = await this.repo.standings(l.id)
    const standingSchools = storedAll.map((s) => s.schoolId)
    const rows = await this.schools.getMany([...new Set([...allSchoolIds, ...standingSchools])])
    const byId = new Map(rows.map((s) => [s.id, s]))
    // Secondary-only (2026-10-29): primary schools are left out of the member list and the standings.
    const visible = (sid: string): boolean => !isPrimarySchoolType(byId.get(sid)?.type)
    const schoolIds = allSchoolIds.filter(visible)
    const stored = storedAll.filter((s) => visible(s.schoolId))
    const standings: Partial<Record<GamesLeagueClassLevel, GamesLeagueStandingRow[]>> = {}
    for (const level of levels as GamesLeagueClassLevel[]) {
      const lvl = stored.filter((s) => s.level === level)
      if (lvl.length === 0) continue
      standings[level] = lvl.map((s, i) => {
        const school = byId.get(s.schoolId)
        return {
          rank: i + 1,
          schoolId: s.schoolId,
          name: school?.name ?? '',
          ppdState: [school?.district, school?.state].filter(Boolean).join(', '),
          peserta: s.peserta,
          skor: s.skor,
          purata: s.purata,
        }
      })
    }
    const { schools: _count, ...card } = this.cardOf(l, await this.subjectName(l.subjectId), schoolIds.length, this.clock.now())
    void _count
    return {
      ...card,
      scoringLabel: LABELS.scoring[l.scoringMethod as keyof typeof LABELS.scoring],
      creatorName: await this.creatorName(caller, l.creatorId),
      classLevels: levels as GamesLeagueClassLevel[],
      schools: schoolIds.map((sid) => ({ id: sid, name: byId.get(sid)?.name ?? '' })),
      standings,
    }
  }

  /**
   * M16-47 (API-ADM-25, Admin Pusat): league `upcoming`, an 8-character invite code (retried on collision; the column
   * is NOT NULL). No school joins on create: Admin Pusat enrols schools afterwards (FR-GM-15.1).
   */
  async create(caller: GamesCaller, body: unknown): Promise<GamesLeagueDetail> {
    const input = await parseLeagueInput(body, async (sid) => (await this.curriculum.subject(idFromString(sid))) !== null)
    const subjectId = input.subjectId
    const now = this.clock.now()
    const id = await this.repo.transaction(async () => {
      for (let n = 0; n < CODE_TRIES; n++) {
        // Invite codes are unguessable: CSPRNG, not the seeded stream (security M3).
        const code = Array.from({ length: 8 }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]).join('')
        const id = await this.repo.insertLeague(
          {
            name: input.name,
            type: input.type,
            scope: input.scope,
            subjectId,
            gameMode: input.gameMode,
            scoringMethod: input.scoringMethod,
            startDate: input.startDate,
            endDate: input.endDate,
            maxSchools: input.maxSchools,
            creatorId: caller.userId,
            isTest: caller.isTest,
            createdAt: now,
          },
          code,
        )
        if (id === null) continue
        await this.repo.addClassLevels(id, input.classLevels)
        return id
      }
      throw new Error('league invite code: no free code after retries')
    })
    return this.detail(caller, id)
  }

  /**
   * API-ADM-25 (Admin Pusat only, FR-GM-15.1): enrols the given schools, all or nothing. The league row is locked, so
   * enrolments never exceed `max_schools`. Ended is judged by `end_date` (through 23:59:59 MYT) against the clock, not
   * by the stored status (an `upcoming` league can be enrolled). A school already in, or repeated in the body, is
   * "already in"; unknown ids and empty lists are field errors. The first failing school in the given order decides the 422 (`fields.schoolIds`).
   */
  async enrolSchools(caller: GamesCaller, id: string, body: unknown): Promise<GamesLeagueDetail> {
    if (!isIdString(id) || !(await this.repo.league(id, caller.isTest))) throw leagueNotFound()
    const schoolIds = parseEnrolInput(body) // after the 404, before the ended check
    const now = this.clock.now()
    await this.repo.transaction(async () => {
      const league = await this.repo.lockLeague(id)
      if (!league) throw leagueNotFound()
      // Body validation, step 2: an unknown school id is "Format sekolah tidak sah.", before "ended" and the per-school checks.
      const known = new Set((await this.schools.getMany([...new Set(schoolIds)])).map((s) => s.id))
      if (schoolIds.some((sid) => !known.has(sid))) throw leagueSchoolInvalid()
      if (now.getTime() > Date.parse(`${dateOnly(league.endDate)}T23:59:59.999+08:00`)) throw leagueEnded()
      let count = await this.repo.membershipCount(league.id)
      const seen = new Set<string>()
      for (const schoolId of schoolIds) {
        if (seen.has(schoolId) || (await this.repo.hasSchool(league.id, schoolId))) throw leagueAlreadyIn()
        seen.add(schoolId)
        if (league.maxSchools !== null && count >= league.maxSchools) throw leagueFull()
        await this.repo.addSchool(league.id, schoolId, caller.isTest, now)
        count++
      }
    })
    return this.detail(caller, id)
  }

  /** API-AS-14: the live board, computed on request from M05 sessions and the M02 register (FR-AS-45-4, DM-31). */
  async sekolahBersaing(): Promise<GamesSekolahBersaingBoard> {
    const facts = await this.practice.sessionAccuracyBySchool()
    const schools = await this.schools.getMany(facts.map((f) => f.schoolId))
    const secondary = schools.filter((s) => !isPrimarySchoolType(s.type)) // secondary-only (2026-10-29)
    return rankSekolahBersaing(facts, secondary, { minPupils: SEKOLAH_BERSAING_MIN_PUPILS, topN: SEKOLAH_BERSAING_TOP_N })
  }

  /**
   * The hourly job (FR-GM-15.3, AC-GM-15.1/15.4): recomputes the stored standings and contributions of every league that
   * is active, and once more after the end date, then sets `frozen_at`. A frozen league is skipped. Within one clock hour
   * a league is written once (the league row lock serialises API instances; the second one sees `recomputed_at`).
   * An upcoming league has nothing to count. Returns how many leagues were rewritten and how many were frozen.
   */
  async recomputeStandings(now: Date = this.clock.now()): Promise<{ recomputed: number; frozen: number }> {
    let recomputed = 0
    let frozen = 0
    const hour = hourStart(now)
    for (const candidate of await this.repo.unfrozenLeagues()) {
      const status = this.statusOf(candidate, now)
      if (status === 'upcoming') continue
      await this.repo.transaction(async () => {
        const l = await this.repo.lockLeague(candidate.id)
        if (!l || l.frozenAt !== null) return
        if (status === 'active') {
          const last = await this.repo.lastRecomputedAt(l.id)
          if (last !== null && last.getTime() >= hour.getTime()) return
        }
        const levels = await this.repo.classLevels(l.id)
        const schoolRows = await this.schools.getMany(await this.repo.schoolIds(l.id, true))
        const window = leagueWindow(dateOnly(l.startDate), dateOnly(l.endDate))
        const facts = await this.repo.pupilFacts(l.id, window, levels.flatMap((x) => gradeOfLevel(x) ?? []), l.subjectId)
        const pupils: (PupilFacts & { userId: string })[] = []
        for (const f of facts) {
          const level = levelCodeOfGrade(f.grade)
          if (level === null) continue
          const earned = pupilPoints(l.gameMode, f)
          pupils.push({ userId: f.userId, schoolId: f.schoolId, level, points: earned.points, wins: earned.wins, answered: f.answered, correct: f.correct })
        }
        const rows = buildStandings(l.scoringMethod, levels, schoolRows.map((r) => ({ id: r.id, name: r.name })), pupils)
        const contributions = pupils.filter((p) => p.points > 0).map((p) => ({ userId: p.userId, schoolId: p.schoolId, points: p.points }))
        await this.repo.replaceStandings(l.id, rows, contributions, now)
        recomputed++
        if (status === 'ended') {
          await this.repo.freeze(l.id, now)
          frozen++
        }
      })
    }
    return { recomputed, frozen }
  }

  /** The league as the caller sees it (test rows hidden), or "not found". */
  private async visibleLeague(caller: GamesCaller, id: string): Promise<LeagueRecord> {
    if (!isIdString(id)) throw leagueNotFound()
    const l = await this.repo.league(id, caller.isTest)
    if (!l) throw leagueNotFound()
    return l
  }

  /** Stored rows of the league without primary schools (secondary-only), with the school names. */
  private async visibleStandings(leagueId: string) {
    const stored = await this.repo.standings(leagueId)
    const schools = await this.schools.getMany([...new Set(stored.map((s) => s.schoolId))])
    const byId = new Map(schools.map((s) => [s.id, s]))
    return { rows: stored.filter((s) => !isPrimarySchoolType(byId.get(s.schoolId)?.type)), byId, all: stored }
  }

  private frozenOf(l: LeagueRecord, now: Date): boolean {
    return l.frozenAt !== null || this.statusOf(l, now) === 'ended'
  }

  /** API-GAME-13: the stored standings of one Tingkatan (`level` 1..5; default the lowest level of the league). */
  async standings(caller: GamesCaller, id: string, rawLevel: unknown): Promise<GamesLeagueStandings> {
    const l = await this.visibleLeague(caller, id)
    const parsed = parseLevelQuery(rawLevel)
    const levels = await this.repo.classLevels(l.id)
    if (parsed === undefined || (parsed !== null && !levels.includes(parsed))) throw fieldError('level', GAMES_MESSAGES.leagueClassLevels)
    const level = parsed ?? levels[0] ?? null
    const { rows, byId, all } = await this.visibleStandings(l.id)
    const stamps = all.flatMap((r) => (r.recomputedAt ? [r.recomputedAt.getTime()] : []))
    return {
      rows: rows
        .filter((r) => r.level === level)
        .map((r, i) => ({ rank: i + 1, schoolName: byId.get(r.schoolId)?.name ?? '', score: r.skor, participants: r.peserta, avgAccuracy: r.purata })),
      recomputedAt: stamps.length === 0 ? null : new Date(Math.max(...stamps)).toISOString(),
      frozen: this.frozenOf(l, this.clock.now()),
    }
  }

  /** API-GAME-13: the caller's school at the caller's own Tingkatan, the caller's points and the school's top contributors. */
  async me(caller: GamesCaller, id: string): Promise<GamesLeagueMe> {
    const l = await this.visibleLeague(caller, id)
    const user = await this.users.get(caller.userId)
    const schoolId = user?.schoolId ?? null
    const mine = { points: await this.repo.pointsOf(l.id, caller.userId) }
    if (schoolId === null || !(await this.repo.hasSchool(l.id, schoolId))) return { school: null, mine, contributors: [] }
    const level = user?.grade == null ? null : levelCodeOfGrade(user.grade)
    const { rows } = await this.visibleStandings(l.id)
    const ranked = rows.filter((r) => r.level === level)
    const at = ranked.findIndex((r) => r.schoolId === schoolId)
    const own = at < 0 ? undefined : ranked[at]
    const contributions = await this.repo.contributionsOfSchool(l.id, schoolId)
    const named = await this.users.getMany(contributions.map((c) => c.userId))
    const resolver = await this.privacy.resolver(caller)
    const contributors = contributions
      .flatMap((c) => {
        const u = named.get(c.userId)
        return u ? [{ name: resolver.name(u), points: c.points }] : []
      })
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'ms'))
      .slice(0, CONTRIBUTORS_TOP_N)
    return { school: own ? { rank: at + 1, score: own.skor, participants: own.peserta } : null, mine, contributors }
  }
}
