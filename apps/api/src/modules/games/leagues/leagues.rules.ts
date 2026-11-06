import {
  GAMES_LEAGUE_LABELS,
  GAMES_MESSAGES,
  GamesLeagueCreateRequestSchema,
  GamesLeagueEnrolRequestSchema,
  gamesLevelIdToClassLevel,
  type GamesLeagueCreateRequest,
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
