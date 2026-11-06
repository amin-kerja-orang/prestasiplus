import {
  GAMES_LEAGUE_LABELS,
  GAMES_MESSAGES,
  GamesLeagueCreateRequestSchema,
  GamesLeagueEnrolRequestSchema,
  gamesLevelIdToClassLevel,
  type GamesLeagueCreateRequest,
  type GamesLeagueStatus,
  type GamesSekolahBersaingBoard,
} from '@pp/contract'

import { ApiError } from '../../../common/errors/api-error'
import { isIdString } from '../../../db/ids'
import { leagueSchoolInvalid, leagueSchoolsMissing } from '../errors'

const M = GAMES_MESSAGES

/** Form order of P14-09..14 (the first failing field gives the top-level message). */
const FIELD_ORDER = ['name', 'type', 'scope', 'mode', 'scoring', 'schoolLimit', 'subjectId', 'levelIds', 'start', 'end'] as const

/** A validated create body; `subjectId` still needs the owner's existence check. */
export interface LeagueInput {
  name: string
  type: GamesLeagueCreateRequest['type']
  scope: GamesLeagueCreateRequest['scope']
  gameMode: GamesLeagueCreateRequest['mode']
  scoringMethod: GamesLeagueCreateRequest['scoring']
  startDate: string
  endDate: string
  maxSchools: number
  subjectId: string | null
  classLevels: string[]
}

/** Maps a contract issue path to a body field of FIELD_ORDER (`levelIds.2` -> `levelIds`). */
const fieldOf = (path: readonly PropertyKey[]): string => String(path[0] ?? 'name')

/** The 422 of the league routes: top-level message = the first field message, every field carries its own. */
export function leagueValidation(fields: Record<string, string>): ApiError {
  const first = FIELD_ORDER.find((f) => fields[f] !== undefined) ?? Object.keys(fields)[0]
  return ApiError.of('VALIDATION_ERROR', { message: first ? (fields[first] as string) : M.leagueRequired, fields })
}

/**
 * Create-body validation in form order (name, type, scope, mode, scoring, schoolLimit, subjectId, levelIds, start,
 * end), with the contract schema's own messages. An `end` before `start` is reported only when both dates are valid.
 */
export async function parseLeagueInput(body: unknown, subjectExists: (id: string) => Promise<boolean>): Promise<LeagueInput> {
  const raw = typeof body === 'object' && body !== null && !Array.isArray(body) ? body : {}
  const parsed = GamesLeagueCreateRequestSchema.safeParse(raw)
  const fields: Record<string, string> = {}
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = fieldOf(issue.path)
      if (fields[field] !== undefined) continue
      fields[field] = field === 'subjectId' ? M.leagueSubject : issue.message
    }
  }
  // An unknown subject joins the same field-error set, so the form order decides the top-level message.
  const rawSubject = (raw as Record<string, unknown>).subjectId
  if (fields.subjectId === undefined && rawSubject !== undefined && rawSubject !== null && (typeof rawSubject !== 'string' || !isIdString(rawSubject) || !(await subjectExists(rawSubject)))) {
    fields.subjectId = M.leagueSubject
  }
  if (!parsed.success || Object.keys(fields).length > 0) {
    // The cross-field rule is skipped by the schema while another field fails: apply it when both dates are valid.
    const b = raw as Record<string, unknown>
    if (!fields.start && !fields.end && typeof b.start === 'string' && typeof b.end === 'string' && b.end < b.start) {
      fields.end = M.leagueEndBeforeStart
    }
    throw leagueValidation(fields)
  }
  const v = (parsed as { data: GamesLeagueCreateRequest }).data
  return {
    name: v.name,
    type: v.type,
    scope: v.scope,
    gameMode: v.mode,
    scoringMethod: v.scoring,
    startDate: v.start,
    endDate: v.end,
    maxSchools: v.schoolLimit,
    subjectId: v.subjectId ?? null,
    // One shared mapper (1..5 = T1..T5), stored in Tingkatan order.
    classLevels: [...new Set(v.levelIds)].sort((x, y) => x - y).map(gamesLevelIdToClassLevel),
  }
}

/** Decimal string of a subject id, or null when it is not a valid id. */
export const subjectIdOrNull = (value: string): string | null => (isIdString(value) ? value : null)

/** A validated enrol body: school ids in the given order. Empty or missing list: ERR-REQ-11; a bad id: ERR-REQ-14. */
export function parseEnrolInput(body: unknown): string[] {
  const raw = typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>).schoolIds : undefined
  if (raw === undefined || (Array.isArray(raw) && raw.length === 0)) throw leagueSchoolsMissing()
  const parsed = GamesLeagueEnrolRequestSchema.safeParse({ schoolIds: raw })
  if (!parsed.success) throw leagueSchoolInvalid()
  return parsed.data.schoolIds
}

export const LABELS = GAMES_LEAGUE_LABELS

/** `YYYY-MM-DD` of a date column read as UTC midnight. */
export const dateOnly = (d: Date): string => d.toISOString().slice(0, 10)

const INVITE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
export { INVITE_ALPHABET }

/**
 * The Sekolah Bersaing board (FR-AS-45-1, FR-AS-45-6, FR-GM-16.4): schools listed in `schools` with at least `minPupils`
 * pupils, by accuracy desc, pupils desc, sessions desc, school name asc (Malay collation), cut to `topN`. The order uses
 * the unrounded accuracy; the wire carries one decimal.
 */
export function rankSekolahBersaing(
  facts: readonly { schoolId: string; accuracy: number; pupils: number; sessions: number }[],
  schools: readonly { id: string; name: string; state: string | null }[],
  options: { minPupils: number; topN: number },
): GamesSekolahBersaingBoard {
  const byId = new Map(schools.map((s) => [s.id, s]))
  return facts
    .flatMap((f) => {
      const school = byId.get(f.schoolId)
      return school && f.pupils >= options.minPupils ? [{ ...f, school: school.name, state: school.state ?? '' }] : []
    })
    .sort((a, b) => b.accuracy - a.accuracy || b.pupils - a.pupils || b.sessions - a.sessions || a.school.localeCompare(b.school, 'ms'))
    .slice(0, options.topN)
    .map((r, i) => ({ rank: i + 1, school: r.school, state: r.state, accuracy: Math.min(100, Math.round(r.accuracy * 10) / 10), pupils: r.pupils }))
}

// --- derived status, window and standings rules (S7-T06 part 3, FR-GM-15.3, AC-GM-15.1/3/4) --------------------------------

/** Minimum answers of a school (at one Tingkatan) to be ranked under `avg_accuracy` (AC-GM-15.3). */
export const MIN_ACCURACY_ANSWERS = 30
/** Contributors returned by `GET /leagues/:id/me`. */
export const CONTRIBUTORS_TOP_N = 10

const DAY_MS = 24 * 60 * 60 * 1000
const startMs = (start: string): number => Date.parse(`${start}T00:00:00+08:00`)

/** The league window: `from` = start date 00:00 MYT (inclusive), `to` = the midnight after the end date, MYT (exclusive). */
export function leagueWindow(start: string, end: string): { from: Date; to: Date } {
  return { from: new Date(startMs(start)), to: new Date(startMs(end) + DAY_MS) }
}

/**
 * Status by date and clock, never stored: `upcoming` before the start date 00:00 MYT, `active` from then through the end
 * date 23:59:59 MYT, `ended` after. Dates are `YYYY-MM-DD`.
 */
export function leagueStatus(start: string, end: string, now: Date): GamesLeagueStatus {
  const { from, to } = leagueWindow(start, end)
  if (now.getTime() < from.getTime()) return 'upcoming'
  return now.getTime() < to.getTime() ? 'active' : 'ended'
}

/** Start of the clock hour (a whole-hour offset, so the same hour in MYT and UTC). */
export const hourStart = (d: Date): Date => new Date(Math.floor(d.getTime() / 3_600_000) * 3_600_000)

/** One decimal, half up (the wire and the stored columns carry one decimal). */
export const round1 = (n: number): number => Math.round(n * 10) / 10

/** Correct / answered as a percent with one decimal; 0 without answers. */
export const accuracyPct = (correct: number, answered: number): number => (answered === 0 ? 0 : Math.min(100, round1((correct / answered) * 100)))

/** What a pupil earns in a league: `quiz` correct answers, `multiplayer` Battle points, `mixed` both. Wins count only where Battles count. */
export function pupilPoints(mode: string, f: { correct: number; battlePoints: number; wins: number }): { points: number; wins: number } {
  const quiz = mode === 'quiz' || mode === 'mixed'
  const battle = mode === 'multiplayer' || mode === 'mixed'
  return { points: (quiz ? f.correct : 0) + (battle ? f.battlePoints : 0), wins: battle ? f.wins : 0 }
}

export interface PupilFacts {
  userId: string
  schoolId: string
  /** Class level code of the pupil (`T1`..`T5`, `D1`..`D6`). */
  level: string
  points: number
  wins: number
  answered: number
  correct: number
}

export interface StandingOut {
  level: string
  schoolId: string
  peserta: number
  skor: number
  purata: number
}

/** Row order of a league board (48 GAME-15): score desc, participants desc, school name asc (Malay collation). */
export const compareStanding = (a: { skor: number; peserta: number; name: string }, b: { skor: number; peserta: number; name: string }): number =>
  b.skor - a.skor || b.peserta - a.peserta || a.name.localeCompare(b.name, 'ms')

/**
 * One row per (level, enrolled school). `peserta` = distinct pupils with points; `skor` = the scoring method value
 * (`total_score` the sum of points, `avg_accuracy` the accuracy percent, `wins` the won Battles); `purata` = accuracy
 * percent. Under `avg_accuracy` a (level, school) with fewer than 30 answers gets no row (not ranked). Rows come back
 * in stored order: level, then rank (skor desc, peserta desc, school name asc).
 */
export function buildStandings(
  scoring: string,
  levels: readonly string[],
  schools: readonly { id: string; name: string }[],
  pupils: readonly PupilFacts[],
): StandingOut[] {
  const out: StandingOut[] = []
  for (const level of levels) {
    const rows: (StandingOut & { name: string })[] = []
    for (const school of schools) {
      const mine = pupils.filter((p) => p.schoolId === school.id && p.level === level)
      const answered = mine.reduce((a, p) => a + p.answered, 0)
      const correct = mine.reduce((a, p) => a + p.correct, 0)
      if (scoring === 'avg_accuracy' && answered < MIN_ACCURACY_ANSWERS) continue
      const purata = accuracyPct(correct, answered)
      const skor = scoring === 'avg_accuracy' ? purata : scoring === 'wins' ? mine.reduce((a, p) => a + p.wins, 0) : mine.reduce((a, p) => a + p.points, 0)
      rows.push({ level, schoolId: school.id, peserta: mine.filter((p) => p.points > 0).length, skor: round1(skor), purata, name: school.name })
    }
    rows.sort(compareStanding)
    out.push(...rows.map((r) => ({ level: r.level, schoolId: r.schoolId, peserta: r.peserta, skor: r.skor, purata: r.purata })))
  }
  return out
}

/** `level` query of API-GAME-13: absent = null (default), `1`..`5` = `T1`..`T5`; anything else = undefined (invalid). */
export function parseLevelQuery(raw: unknown): string | null | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v === undefined || v === '') return null
  if (typeof v !== 'string' || !/^[1-5]$/.test(v)) return undefined
  return gamesLevelIdToClassLevel(Number(v))
}

/** Inverse of `levelCodeOfGrade`: `D1`..`D6` = grade 1..6, `T1`..`T5` = grade 7..11; null for anything else. */
export function gradeOfLevel(level: string): number | null {
  const n = Number(level.slice(1))
  if (!Number.isInteger(n)) return null
  if (level[0] === 'D' && n >= 1 && n <= 6) return n
  if (level[0] === 'T' && n >= 1 && n <= 5) return n + 6
  return null
}
