import { randomInt } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  GAMES_LEAGUE_CLASS_LEVELS,
  GAMES_MESSAGES,
  type GamesLeagueCard,
  type GamesLeagueDetail,
  type GamesLeagueIdResult,
  type GamesLeagueList,
  type GamesLeagueStandingRow,
  type GamesLeagueStatus,
  type GamesSekolahBersaing,
} from '@pp/contract'

import type { Env } from '../../../common/config/env.schema'
import { publicBaseUrl } from '../../../common/config/public-base-url'
import { CLOCK, type Clock } from '../../../db/clock'
import { idFromString, isIdString } from '../../../db/ids'
import { CurriculumRepository } from '../../curriculum'
import { isPrimarySchoolType, SchoolsRepository } from '../../schools'
import { fieldError, leagueAlreadyIn, leagueEnded, leagueFull, leagueInviteInvalid, leagueNeedsSchool, leagueNotFound } from '../errors'
import { GameUsers } from '../core/game-users'
import { NamePrivacy } from '../core/name-privacy.service'
import { mytDateOf, startOfMytWeek } from '../core/time'
import type { GamesCaller } from '../caller'
import { type LeagueRecord, LeaguesRepository } from './leagues.repository'
import { dateOnly, INVITE_ALPHABET, LABELS, type LeagueInput, shareUrl } from './leagues.rules'

const M = GAMES_MESSAGES
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
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  private async subjectName(subjectId: string | null): Promise<string | null> {
    if (subjectId === null) return null
    return (await this.curriculum.subject(idFromString(subjectId)))?.name ?? null
  }

  private async schoolIdOf(userId: string): Promise<string | null> {
    return (await this.users.get(userId))?.schoolId ?? null
  }

  /** The creator may be a pupil (any role creates a league): children's names rule, name only (the response has no id). */
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
    const viewerSchool = await this.schoolIdOf(caller.userId)
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
    const total = await this.repo.membershipCount(l.id)
    const { schools: _count, ...card } = this.cardOf(l, await this.subjectName(l.subjectId), schoolIds.length)
    void _count
    return {
      ...card,
      scoringLabel: LABELS.scoring[l.scoringMethod as keyof typeof LABELS.scoring],
      creatorName: await this.creatorName(caller, l.creatorId),
      classLevels: levels as GamesLeagueClassLevel[],
      inviteCode: l.inviteCode,
      shareUrl: shareUrl(l.name, l.inviteCode, publicBaseUrl(this.config)),
      canJoin: l.status !== 'ended' && (viewerSchool === null || !schoolIds.includes(viewerSchool)) && (l.maxSchools === null || total < l.maxSchools),
      schools: schoolIds.map((sid) => ({ id: sid, name: byId.get(sid)?.name ?? '' })),
      standings,
    }
  }

  /** M16-47: league `upcoming`, an 8-character invite code (retried on collision), the creator's school joins. */
  async create(caller: GamesCaller, input: LeagueInput): Promise<GamesLeagueIdResult> {
    let subjectId: string | null = null
    if (input.subjectId !== null) {
      const subject = isIdString(input.subjectId) ? await this.curriculum.subject(idFromString(input.subjectId)) : null
      if (!subject) throw fieldError('subject_id', M.leagueSubject)
      subjectId = input.subjectId
    }
    const schoolId = await this.schoolIdOf(caller.userId)
    const now = this.clock.now()
    return this.repo.transaction(async () => {
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
        if (schoolId !== null) await this.repo.addSchool(id, schoolId, caller.isTest, now)
        return { id }
      }
      throw new Error('league invite code: no free code after retries')
    })
  }

  /** M16-48: the caller's school joins by invite code. The league row is locked, so joins never exceed `max_schools`. */
  async join(caller: GamesCaller, rawCode: unknown): Promise<GamesLeagueIdResult> {
    const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : ''
    const found = code === '' ? null : await this.repo.leagueByCode(code, caller.isTest)
    if (!found) throw leagueInviteInvalid()
    const schoolId = await this.schoolIdOf(caller.userId)
    const now = this.clock.now()
    return this.repo.transaction(async () => {
      const league = await this.repo.lockLeague(found.id)
      if (!league) throw leagueInviteInvalid()
      if (league.status === 'ended') throw leagueEnded()
      if (schoolId === null) throw leagueNeedsSchool()
      if (await this.repo.hasSchool(league.id, schoolId)) throw leagueAlreadyIn()
      if (league.maxSchools !== null && (await this.repo.membershipCount(league.id)) >= league.maxSchools) throw leagueFull()
      await this.repo.addSchool(league.id, schoolId, caller.isTest, now)
      return { id: league.id }
    })
  }

  /** M16-50: the stored weekly snapshot. `week`: a valid YYYY-MM-DD gives its Monday, anything else the current week. */
  async sekolahBersaing(week: unknown): Promise<GamesSekolahBersaing> {
    const weekStart = weekStartOf(week, this.clock.now())
    const allRows = await this.repo.sekolahBersaing(weekStart)
    const schools = await this.schools.getMany([...new Set(allRows.map((r) => r.schoolId))])
    const byId = new Map(schools.map((s) => [s.id, s]))
    const rows = allRows.filter((r) => !isPrimarySchoolType(byId.get(r.schoolId)?.type)) // secondary-only (2026-10-29)
    return {
      weekStart,
      count: rows.length,
      rows: rows.map((r) => ({
        rank: r.rank,
        schoolName: r.isAnonymous ? M.sekolahAnonymous : (byId.get(r.schoolId)?.name ?? ''),
        state: byId.get(r.schoolId)?.state ?? '',
        aktifPct: r.aktifPct,
        streakAvg: r.streakAvg,
        notaPer10: r.notaPer10,
        anonymous: r.isAnonymous,
      })),
    }
  }
}

/**
 * Monday (`YYYY-MM-DD`, Malaysia) of the week named by `value`: a valid calendar date gives its week, anything
 * else (missing, repeated, malformed, impossible date, out of range) the week of `now`. Never throws.
 */
export function weekStartOf(value: unknown, now: Date): string {
  if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (m) {
      const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
      const at = new Date(Date.UTC(y, mo - 1, d))
      if (y >= 1 && at.getUTCFullYear() === y && at.getUTCMonth() === mo - 1 && at.getUTCDate() === d) {
        const dow = at.getUTCDay() // 0 = Sunday
        return dateOnlyUtc(new Date(at.getTime() - ((dow + 6) % 7) * 86_400_000))
      }
    }
  }
  return mytDateOf(startOfMytWeek(now))
}

const dateOnlyUtc = (d: Date): string => d.toISOString().slice(0, 10)

