import {
  GAMES_LEAGUE_CLASS_LEVELS,
  GAMES_LEAGUE_LABELS,
  GAMES_MESSAGES,
  GamesLeagueCreateRequestSchema,
  type GamesLeagueCreateRequest,
} from '@pp/contract'

import { ApiError } from '../../../common/errors/api-error'
import { isIdString } from '../../../db/ids'

const M = GAMES_MESSAGES

/** Field order of the mock's create validation (the first message is the top-level message). */
const FIELD_ORDER = [
  'name',
  'type',
  'scope',
  'game_mode',
  'scoring_method',
  'start_date',
  'end_date',
  'max_schools',
  'subject_id',
  'class_levels',
] as const

/** A validated create body; `subjectId` still needs the owner's existence check. */
export interface LeagueInput {
  name: string
  type: GamesLeagueCreateRequest['type']
  scope: GamesLeagueCreateRequest['scope']
  gameMode: GamesLeagueCreateRequest['game_mode']
  scoringMethod: GamesLeagueCreateRequest['scoring_method']
  startDate: string
  endDate: string
  maxSchools: number | null
  subjectId: string | null
  classLevels: string[]
}

/** Maps a contract issue path to a body field of FIELD_ORDER (`class_levels.2` -> `class_levels`). */
const fieldOf = (path: readonly PropertyKey[]): string => String(path[0] ?? 'name')

/** The 422 of the league routes: top-level message = the first field message, every field carries its own. */
export function leagueValidation(fields: Record<string, string>): ApiError {
  const first = FIELD_ORDER.find((f) => fields[f] !== undefined) ?? Object.keys(fields)[0]
  return ApiError.of('VALIDATION_ERROR', { message: first ? (fields[first] as string) : M.leagueRequired, fields })
}

/**
 * Create-body validation in the mock's order (name, type, scope, game_mode, scoring_method, start_date,
 * end_date, max_schools, subject_id, class_levels), with the contract schema's own messages. An `end_date`
 * before `start_date` is reported only when both dates are valid.
 */
export function parseLeagueInput(body: unknown): LeagueInput {
  const raw = typeof body === 'object' && body !== null && !Array.isArray(body) ? body : {}
  const parsed = GamesLeagueCreateRequestSchema.safeParse(raw)
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = fieldOf(issue.path)
      if (fields[field] !== undefined) continue
      fields[field] = field === 'subject_id' ? M.leagueSubject : field === 'class_levels' ? M.leagueClassLevels : issue.message
    }
    // The cross-field rule is skipped by the schema while another field fails: apply it when both dates are valid.
    const b = raw as Record<string, unknown>
    if (!fields.start_date && !fields.end_date && typeof b.start_date === 'string' && typeof b.end_date === 'string' && b.end_date < b.start_date) {
      fields.end_date = M.leagueEndBeforeStart
    }
    throw leagueValidation(fields)
  }
  const v = parsed.data
  const levels = new Set(v.class_levels ?? [])
  const subjectId = v.subject_id === undefined || v.subject_id === null ? null : v.subject_id
  return {
    name: v.name,
    type: v.type,
    scope: v.scope,
    gameMode: v.game_mode,
    scoringMethod: v.scoring_method,
    startDate: v.start_date,
    endDate: v.end_date,
    maxSchools: v.max_schools ?? null,
    subjectId,
    classLevels: GAMES_LEAGUE_CLASS_LEVELS.filter((l) => levels.has(l)),
  }
}

/** Decimal string of a subject id, or null when it is not a valid id. */
export const subjectIdOrNull = (value: string): string | null => (isIdString(value) ? value : null)

/** WhatsApp share link (`+` for spaces and `%21` for "!", as live). */
export function shareUrl(name: string, code: string): string {
  const enc = (s: string): string =>
    encodeURIComponent(s)
      .replace(/%20/g, '+')
      .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  const text = `Jom sertai Liga Pertandingan "${name}" di PrestasiPlus! Kod Jemputan: ${code} — prestasiplus.my/liga 🏆`
  return `https://wa.me/?text=${enc(text)}`
}

export const LABELS = GAMES_LEAGUE_LABELS

/** `YYYY-MM-DD` of a date column read as UTC midnight. */
export const dateOnly = (d: Date): string => d.toISOString().slice(0, 10)

const INVITE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
export { INVITE_ALPHABET }
