import { randomInt } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import {
  GAMES_LEAGUE_CLASS_LEVELS,
  type GamesLeagueCard,
  type GamesLeagueDetail,
  type GamesLeagueList,
  type GamesLeagueStandingRow,
  type GamesLeagueStatus,
  type GamesSekolahBersaingBoard,
} from '@pp/contract'

import { CLOCK, type Clock } from '../../../db/clock'
import { idFromString, isIdString } from '../../../db/ids'
import { CurriculumRepository } from '../../curriculum'
import { PracticeRepository } from '../../practice'
import { isPrimarySchoolType, SchoolsRepository } from '../../schools'
import { SEKOLAH_BERSAING_MIN_PUPILS, SEKOLAH_BERSAING_TOP_N } from '../games.constants'
import { leagueAlreadyIn, leagueEnded, leagueFull, leagueNotFound, leagueSchoolInvalid } from '../errors'
import { GameUsers } from '../core/game-users'
import { NamePrivacy } from '../core/name-privacy.service'
import type { GamesCaller } from '../caller'
import { type LeagueRecord, LeaguesRepository } from './leagues.repository'
import { dateOnly, INVITE_ALPHABET, LABELS, parseEnrolInput, parseLeagueInput, rankSekolahBersaing } from './leagues.rules'

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

  private cardOf(l: LeagueRecord, subjectName: string | null, schools: number): GamesLeagueCard {
    return {
      id: l.id,
      name: l.name,
      status: l.status as GamesLeagueStatus,
      statusLabel: LABELS.status[l.status as GamesLeagueStatus],
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
    const card = (l: LeagueRecord): GamesLeagueCard => this.cardOf(l, l.subjectId === null ? null : (names.get(l.subjectId) ?? null), counts.get(l.id) ?? 0)
    return { mine: all.filter((l) => mineIds.has(l.id)).map(card), open: all.filter((l) => l.status !== 'ended').map(card) }
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
    const { schools: _count, ...card } = this.cardOf(l, await this.subjectName(l.subjectId), schoolIds.length)
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
      if (now.getTime() > Date.parse(`${dateOnly(league.endDate)}T23:59:59.999+08:00`)) throw leagueEnded()
      const known = new Set((await this.schools.getMany([...new Set(schoolIds)])).map((s) => s.id)) // after the lock
      let count = await this.repo.membershipCount(league.id)
      const seen = new Set<string>()
      for (const schoolId of schoolIds) {
        if (!known.has(schoolId)) throw leagueSchoolInvalid()
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
}
