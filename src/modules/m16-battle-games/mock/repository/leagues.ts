/**
 * The `leagues` repository (owner M16; SRS M16 v1.6 DATA-M16-12, BR-M16-33/34, §5 V-M16-13…15, §7
 * #46-#49). Standings are the stored hourly-job output and are never recomputed (OQ-M16-09); the
 * status is stored and never changed by dates (DV-M16-11).
 */

import { gamesLevelIdToClassLevel } from '@pp/contract'

import type { PrngRegistry } from '@/mock/determinism'
import { defineNamedQueries } from '@/mock/dataset'
import { defineRepository } from '@/mock/repository'
import { users } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'

import {
  LEAGUE_SCOPE_LABELS,
  LEAGUE_SCORING_LABELS,
  LEAGUE_STATUS_LABELS,
  LEAGUE_TYPE_LABELS,
  SEED_LEAGUE_SCHOOLS,
  SEED_LEAGUE_STANDINGS,
  SEED_LEAGUES,
} from '../data/leagues'
import { leagueSchoolsTable, leaguesTable, leagueStandingsTable } from '../tables/tables'
import type { LeagueGameMode, LeagueRow, LeagueScope, LeagueScoring, LeagueType } from '../types'
import { M16Error, nowIso } from './common'

export const leagueQueries = defineNamedQueries(leaguesTable, {
  'Q-LEAGUE-OPEN': {
    where: { status: ['upcoming', 'ongoing'] },
    expected: 1,
    source: 'M16 §6.10 (S25 "Liga Terbuka")',
  },
})

export interface LeagueCard {
  id: number
  name: string
  status: LeagueRow['status']
  statusLabel: string
  scopeLabel: string
  typeLabel: string
  subjectName: string | null
  startDate: string
  endDate: string
  schools: number
}

export interface LeagueStandingView {
  rank: number
  schoolId: number
  name: string
  ppdState: string
  peserta: number
  skor: number
  purata: number
}

export interface LeagueDetail extends Omit<LeagueCard, 'schools'> {
  scoringLabel: string
  creatorName: string
  classLevels: string[]
  schools: { id: number; name: string }[]
  standings: Record<string, LeagueStandingView[]>
}

export interface LeagueInput {
  name: string
  type: LeagueType
  scope: LeagueScope
  subjectId: number | null
  gameMode: LeagueGameMode
  classLevels: string[]
  scoringMethod: LeagueScoring
  startDate: string
  endDate: string
  maxSchools: number
}

const TYPES = ['friendly', 'league'] // the create form offers these two (API-ADM-25)
const SCOPES = Object.keys(LEAGUE_SCOPE_LABELS)
const SCORINGS = Object.keys(LEAGUE_SCORING_LABELS)
const GAME_MODES = ['mixed', 'quiz', 'multiplayer']
const DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * API-ADM-25 create body (60 section 2.17.9) to a typed input, 422 `fields` keyed by the body names; the top-level
 * message is the first failing field in form order (P14-09..14).
 */
export function parseLeagueBody(body: unknown): LeagueInput {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  const required = 'Sila lengkapkan semua medan wajib.'
  const format = 'Format tidak sah.'
  const f: Record<string, string> = {}
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  if (name === '' || name.length > 100) f.name = required
  const pick = (field: string, allowed: string[]): void => {
    const v = b[field]
    if (v === undefined || v === null || v === '') f[field] = required
    else if (!allowed.includes(v as string)) f[field] = format
  }
  pick('type', TYPES)
  pick('scope', SCOPES)
  pick('mode', GAME_MODES)
  pick('scoring', SCORINGS)
  let maxSchools = 0
  if (b.schoolLimit === undefined) f.schoolLimit = required
  else {
    const n = b.schoolLimit
    if (typeof n === 'number' && Number.isInteger(n) && n >= 2 && n <= 500) maxSchools = n
    else f.schoolLimit = 'Had sekolah mesti antara 2 dan 500.'
  }
  let subjectId: number | null = null
  if (b.subjectId !== undefined && b.subjectId !== null && b.subjectId !== '') {
    const n = Number(b.subjectId)
    if (Number.isInteger(n) && curriculum.subject(n)) subjectId = n
    else f.subjectId = 'Mata pelajaran tidak sah.'
  }
  const levels = b.levelIds
  let classLevels: string[] = []
  if (levels === undefined || (Array.isArray(levels) && levels.length === 0)) f.levelIds = required
  else if (
    !Array.isArray(levels) ||
    levels.some((l) => !(typeof l === 'number' && Number.isInteger(l) && l >= 1 && l <= 5))
  ) {
    f.levelIds = 'Tingkatan tidak sah.'
  } else {
    // One shared mapper: 1..5 = T1..T5, stored in Tingkatan order.
    classLevels = [...new Set(levels as number[])].sort((x, y) => x - y).map(gamesLevelIdToClassLevel)
  }
  const start = typeof b.start === 'string' ? b.start : ''
  const end = typeof b.end === 'string' ? b.end : ''
  if (!DATE.test(start) || Number.isNaN(Date.parse(start))) f.start = required
  if (!DATE.test(end) || Number.isNaN(Date.parse(end))) f.end = required
  if (!f.start && !f.end && end < start) f.end = 'Tarikh tamat mesti selepas tarikh mula.'
  if (Object.keys(f).length > 0) {
    const order = ['name', 'type', 'scope', 'mode', 'scoring', 'schoolLimit', 'subjectId', 'levelIds', 'start', 'end']
    const first = order.find((k) => f[k] !== undefined) as string
    throw new M16Error('VALIDATION_ERROR', f[first] as string, undefined, f)
  }
  return {
    name,
    type: b.type as LeagueType,
    scope: b.scope as LeagueScope,
    subjectId,
    gameMode: b.mode as LeagueGameMode,
    classLevels,
    scoringMethod: b.scoring as LeagueScoring,
    startDate: start,
    endDate: end,
    maxSchools,
  }
}

const subjectNameOf = (id: number | null): string | null =>
  id === null ? null : (curriculum.subject(id)?.name ?? null)

export const leaguesRepo = defineRepository({
  owner: 'M16',
  name: 'leagues',
  store: leaguesTable,
  stores: { leagueSchools: leagueSchoolsTable, standings: leagueStandingsTable },
  queries: leagueQueries,
  methods: ({ store, stores, transaction }) => {
    const { leagueSchools, standings } = stores
    const schoolIds = (leagueId: number): number[] =>
      leagueSchools.query({ where: { leagueId }, sort: 'id' }).rows.map((r) => r.schoolId)

    const card = (l: LeagueRow): LeagueCard => ({
      id: l.id,
      name: l.name,
      status: l.status,
      statusLabel: LEAGUE_STATUS_LABELS[l.status],
      scopeLabel: LEAGUE_SCOPE_LABELS[l.scope],
      typeLabel: LEAGUE_TYPE_LABELS[l.type],
      subjectName: subjectNameOf(l.subjectId),
      startDate: l.startDate,
      endDate: l.endDate,
      schools: leagueSchools.count({ leagueId: l.id }),
    })

    return {
      /** Seed phase: the two observed leagues, their 5 schools and the 4 stored standing rows. */
      seed(): void {
        transaction(() => {
          const created = ['2026-03-20T10:00:00+08:00', '2026-03-31T09:00:00+08:00']
          SEED_LEAGUES.forEach((l, i) => store.insert({ ...l, createdAt: created[i] as string }))
          for (const s of SEED_LEAGUE_SCHOOLS) {
            leagueSchools.insert({ ...s, joinedAt: '2026-03-31T09:00:00+08:00' })
          }
          for (const s of SEED_LEAGUE_STANDINGS) standings.insert({ ...s })
        })
      },

      /** #46: `mine` = leagues with the viewer's school, `open` = status not `ended` (BR-M16-33). */
      list(viewerSchoolId: number | null): { mine: LeagueCard[]; open: LeagueCard[] } {
        const all = store.query({ sort: 'id' }).rows
        const mine =
          viewerSchoolId === null
            ? []
            : all.filter(
                (l) => leagueSchools.count({ leagueId: l.id, schoolId: viewerSchoolId }) > 0,
              )
        return { mine: mine.map(card), open: all.filter((l) => l.status !== 'ended').map(card) }
      },

      /** #49: the detail (no invite code, share link or join flag: Admin Pusat enrols schools, FR-GM-15.1). */
      get(id: number): LeagueDetail | undefined {
        const l = store.get(id)
        if (!l) return undefined
        const ids = schoolIds(id)
        const byLevel: Record<string, LeagueStandingView[]> = {}
        for (const level of l.classLevels) {
          const rows = standings.query({ where: { leagueId: id, level }, sort: 'order' }).rows
          if (rows.length === 0) continue
          byLevel[level] = rows.map((r, i) => {
            const school = schools.get(r.schoolId)
            return {
              rank: i + 1,
              schoolId: r.schoolId,
              name: school?.name ?? '',
              ppdState: [school?.district, school?.state].filter(Boolean).join(', '),
              peserta: r.peserta,
              skor: r.skor,
              purata: r.purata,
            }
          })
        }
        const { schools: _count, ...rest } = card(l)
        void _count
        return {
          ...rest,
          scoringLabel: LEAGUE_SCORING_LABELS[l.scoringMethod],
          creatorName: users.get(l.creatorId)?.name ?? '',
          classLevels: l.classLevels,
          schools: ids.map((sid) => ({ id: sid, name: schools.get(sid)?.name ?? '' })),
          standings: byLevel,
        }
      },

      /** #47 (API-ADM-25): creates a league, `upcoming`, internal 8-character code; no school joins on create. */
      create(input: LeagueInput, creatorId: number, prng: PrngRegistry): LeagueRow {
        return transaction(() => {
          let code = ''
          for (let n = 0; ; n++) {
            const rng = prng.fresh(`m16:league-code#${String(n)}`)
            code = Array.from(
              { length: 8 },
              () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(rng.next() * 36)],
            ).join('')
            if (store.count({ inviteCode: code }) === 0) break
          }
          const league = store.insert({
            ...input,
            inviteCode: code,
            creatorId,
            status: 'upcoming',
            createdAt: nowIso(),
          })
          return league
        })
      },

      /**
       * API-ADM-25 `POST /leagues/:id/schools`: all or nothing. 404, then ended (by `endDate` at 23:59:59 MYT against
       * the clock), then each school in order: already in or repeated, or over the limit.
       */
      enrol(id: number, ids: unknown): void {
        transaction(() => {
          const league = store.get(id)
          if (!league) throw new M16Error('NOT_FOUND', 'Liga tidak dijumpai.')
          const fail = (message: string): never => {
            throw new M16Error('VALIDATION_ERROR', message, 'schoolIds')
          }
          if (!Array.isArray(ids) || ids.length === 0) fail('Sila pilih sekolah.')
          const list = ids as unknown[]
          if (list.some((x) => typeof x !== 'number' || !schools.get(x))) fail('Format sekolah tidak sah.')
          if (Date.parse(`${league.endDate}T23:59:59.999+08:00`) < Date.parse(nowIso())) {
            fail('Liga ini sudah tamat.')
          }
          const seen = new Set<number>()
          let count = leagueSchools.count({ leagueId: id })
          for (const schoolId of list as number[]) {
            if (seen.has(schoolId) || leagueSchools.count({ leagueId: id, schoolId }) > 0) {
              fail('Sekolah ini sudah menyertai liga ini.')
            }
            if (league.maxSchools !== null && count >= league.maxSchools) fail('Liga ini sudah penuh.')
            seen.add(schoolId)
            count++
          }
          for (const schoolId of seen) leagueSchools.insert({ leagueId: id, schoolId, joinedAt: nowIso() })
        })
      },

      /** Q-LEAGUE-SCHOOLS(id). */
      schoolCount(id: number): number {
        return leagueSchools.count({ leagueId: id })
      },
    }
  },
})
