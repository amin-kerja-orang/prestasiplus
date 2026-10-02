/**
 * The `leagues` repository (owner M16; SRS M16 v1.6 DATA-M16-12, BR-M16-33/34, §5 V-M16-13…15, §7
 * #46-#49). Standings are the stored hourly-job output and are never recomputed (OQ-M16-09); the
 * status is stored and never changed by dates (DV-M16-11).
 */

import type { PrngRegistry } from '@/mock/determinism'
import { defineNamedQueries } from '@/mock/dataset'
import { defineRepository } from '@/mock/repository'
import { users } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'

import {
  CLASS_LEVELS,
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
  inviteCode: string
  shareUrl: string
  canJoin: boolean
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
  maxSchools: number | null
}

const TYPES = Object.keys(LEAGUE_TYPE_LABELS)
const SCOPES = Object.keys(LEAGUE_SCOPE_LABELS)
const SCORINGS = Object.keys(LEAGUE_SCORING_LABELS)
const GAME_MODES = ['mixed', 'quiz', 'multiplayer']
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** S26 body to a typed input (V-M16-14/15; PROPOSED messages). */
export function parseLeagueBody(body: unknown): LeagueInput {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  const required = 'Sila lengkapkan semua medan wajib.'
  const f: Record<string, string> = {}
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  if (name === '' || name.length > 255) f.name = required
  if (!TYPES.includes(b.type as string)) f.type = required
  if (!SCOPES.includes(b.scope as string)) f.scope = required
  if (!GAME_MODES.includes(b.game_mode as string)) f.game_mode = required
  if (!SCORINGS.includes(b.scoring_method as string)) f.scoring_method = required
  const start = typeof b.start_date === 'string' ? b.start_date : ''
  const end = typeof b.end_date === 'string' ? b.end_date : ''
  if (!DATE.test(start) || Number.isNaN(Date.parse(start))) f.start_date = required
  if (!DATE.test(end) || Number.isNaN(Date.parse(end))) f.end_date = required
  if (!f.start_date && !f.end_date && end < start)
    f.end_date = 'Tarikh tamat mesti selepas tarikh mula.'
  let maxSchools: number | null = null
  if (b.max_schools !== undefined && b.max_schools !== null && b.max_schools !== '') {
    const n = Number(b.max_schools)
    if (Number.isInteger(n) && n >= 2 && n <= 500) maxSchools = n
    else f.max_schools = 'Had sekolah mesti antara 2 dan 500.'
  }
  let subjectId: number | null = null
  if (b.subject_id !== undefined && b.subject_id !== null && b.subject_id !== '') {
    const n = Number(b.subject_id)
    if (Number.isInteger(n) && curriculum.subject(n)) subjectId = n
    else f.subject_id = 'Mata pelajaran tidak sah.'
  }
  const levels = Array.isArray(b.class_levels) ? b.class_levels : []
  const classLevels = CLASS_LEVELS.filter((l) => levels.includes(l)) as string[]
  if (levels.some((l) => !CLASS_LEVELS.includes(l as (typeof CLASS_LEVELS)[number]))) {
    f.class_levels = 'Tingkatan tidak sah.'
  }
  if (Object.keys(f).length > 0) {
    throw new M16Error('VALIDATION_ERROR', Object.values(f)[0] as string, undefined, f)
  }
  return {
    name,
    type: b.type as LeagueType,
    scope: b.scope as LeagueScope,
    subjectId,
    gameMode: b.game_mode as LeagueGameMode,
    classLevels,
    scoringMethod: b.scoring_method as LeagueScoring,
    startDate: start,
    endDate: end,
    maxSchools,
  }
}

/** WhatsApp share link of FN-M16-9.3.2 (`+` for spaces and `%21` for "!", as live). */
export function shareUrl(name: string, code: string): string {
  const enc = (s: string) =>
    encodeURIComponent(s)
      .replace(/%20/g, '+')
      .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  const text = `Jom sertai Liga Pertandingan "${name}" di PrestasiPlus! Kod Jemputan: ${code} — prestasiplus.my/liga 🏆`
  return `https://wa.me/?text=${enc(text)}`
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

      /** #49: the detail (invite code visible to non-members, as live). */
      get(id: number, viewerSchoolId: number | null): LeagueDetail | undefined {
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
          inviteCode: l.inviteCode,
          shareUrl: shareUrl(l.name, l.inviteCode),
          canJoin:
            l.status !== 'ended' && (viewerSchoolId === null || !ids.includes(viewerSchoolId)),
          schools: ids.map((sid) => ({ id: sid, name: schools.get(sid)?.name ?? '' })),
          standings: byLevel,
        }
      },

      /** #47 (BR-M16-33): creates a league, `upcoming`, 8-character invite code, the creator's school joins. */
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
          const schoolId = users.get(creatorId)?.schoolId ?? null
          if (schoolId !== null)
            leagueSchools.insert({ leagueId: league.id, schoolId, joinedAt: nowIso() })
          return league
        })
      },

      /** #48 (BR-M16-33, V-M16-13): the viewer's school joins by invite code. Returns the league id. */
      join(code: unknown, viewerId: number): number {
        return transaction(() => {
          const text = typeof code === 'string' ? code.trim().toUpperCase() : ''
          const league =
            text === '' ? undefined : store.query({ where: { inviteCode: text } }).rows[0]
          if (!league)
            throw new M16Error('VALIDATION_ERROR', 'Kod jemputan tidak sah.', 'invite_code')
          if (league.status === 'ended') {
            throw new M16Error('VALIDATION_ERROR', 'Liga ini sudah tamat.', 'invite_code')
          }
          const schoolId = users.get(viewerId)?.schoolId ?? null
          if (schoolId === null) {
            throw new M16Error(
              'VALIDATION_ERROR',
              'Anda perlu mempunyai sekolah untuk menyertai liga ini.',
              'invite_code',
            )
          }
          if (leagueSchools.count({ leagueId: league.id, schoolId }) > 0) {
            throw new M16Error(
              'VALIDATION_ERROR',
              'Sekolah anda sudah menyertai liga ini.',
              'invite_code',
            )
          }
          if (
            league.maxSchools !== null &&
            leagueSchools.count({ leagueId: league.id }) >= league.maxSchools
          ) {
            throw new M16Error('VALIDATION_ERROR', 'Liga ini sudah penuh.', 'invite_code')
          }
          leagueSchools.insert({ leagueId: league.id, schoolId, joinedAt: nowIso() })
          return league.id
        })
      },

      /** Q-LEAGUE-SCHOOLS(id). */
      schoolCount(id: number): number {
        return leagueSchools.count({ leagueId: id })
      },
    }
  },
})
