import {
  BATTLE_MESSAGES,
  BATTLE_TOURNAMENT_ACTIONS,
  BATTLE_TOURNAMENT_FORMATS,
  BATTLE_TOURNAMENT_LEVELS,
  BATTLE_TOURNAMENT_QUESTION_MODES,
  battleLocalDateTimeKey,
} from '@pp/contract'

import { ApiError } from '../../../common/errors/api-error'

/** MYT is a fixed UTC+8 (no daylight saving). */
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000

export interface TournamentInput {
  title: string
  description: string
  educationLevelId: (typeof BATTLE_TOURNAMENT_LEVELS)[number]
  format: (typeof BATTLE_TOURNAMENT_FORMATS)[number]
  groupsCount: number | null
  questionMode: (typeof BATTLE_TOURNAMENT_QUESTION_MODES)[number]
  /** Decimal id string of an active battle subject (mode `subject`). */
  subjectId: string | null
  /** Distinct decimal id strings of active battle subjects (mode `random_mix`). */
  mixedSubjectIds: string[]
  totalQuestions: number
  timeWindowMinutes: number
  topNScoring: number
  minParticipants: number
  registrationOpensAt: Date | null
  registrationClosesAt: Date | null
  action: (typeof BATTLE_TOURNAMENT_ACTIONS)[number]
}

/** A number, or a numeric string, as the mock reads it; null otherwise. */
const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v)
    ? v
    : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))
      ? Number(v)
      : null

const inRange = (v: unknown, lo: number, hi: number): boolean => {
  const n = num(v)
  return n !== null && Number.isInteger(n) && n >= lo && n <= hi
}

/** A subject id as a canonical decimal string, or null. */
const idText = (v: unknown): string | null => {
  const n = num(v)
  return n !== null && Number.isInteger(n) && n >= 1 ? String(n) : null
}

/** Local `YYYY-MM-DDTHH:mm` (Asia/Kuala_Lumpur) to an instant; NaN when invalid. */
function localToInstant(value: string): number {
  const key = battleLocalDateTimeKey(value)
  return Number.isNaN(key) ? Number.NaN : key - MYT_OFFSET_MS
}

/**
 * Deviation from the mock: the close date must be strictly after the open date (the table CHECK
 * `ck_tournaments_registration_window` is strict; the mock accepted equal dates).
 *
 * Validates the M16-44 body exactly as the mock does (SRS V-M16-07..12): every failing field is collected, the
 * top-level message is the first one. `activeSubjectIds` = ids of the active battle subjects.
 */
export function parseTournamentBody(body: unknown, activeSubjectIds: ReadonlySet<string>): TournamentInput {
  const b = (typeof body === 'object' && body !== null && !Array.isArray(body) ? body : {}) as Record<string, unknown>
  const f: Record<string, string> = {}

  const title = typeof b.title === 'string' ? b.title.trim() : ''
  if (title === '' || title.length > 255) f.title = BATTLE_MESSAGES.titleRequired

  const level = b.education_level_id
  if (!(BATTLE_TOURNAMENT_LEVELS as readonly unknown[]).includes(level)) f.education_level_id = BATTLE_MESSAGES.levelRequired

  const format = b.format
  if (!(BATTLE_TOURNAMENT_FORMATS as readonly unknown[]).includes(format)) f.format = BATTLE_MESSAGES.formatInvalid

  let groups: number | null = null
  if (format === 'league' || format === 'hybrid') {
    if (inRange(b.groups_count, 2, 8)) groups = Number(b.groups_count)
    else f.groups_count = BATTLE_MESSAGES.groupsRange
  }

  const mode = b.question_mode
  let subjectId: string | null = null
  let mixed: string[] = []
  if (!(BATTLE_TOURNAMENT_QUESTION_MODES as readonly unknown[]).includes(mode)) {
    f.question_mode = BATTLE_MESSAGES.sourceRequired
  } else if (mode === 'subject') {
    const s = idText(b.subject_id)
    if (s !== null && activeSubjectIds.has(s)) subjectId = s
    else f.subject_id = BATTLE_MESSAGES.sourceRequired
  } else if (mode === 'exam_paper') {
    // No exam paper exists: any value is refused.
    f.exam_paper_id = BATTLE_MESSAGES.sourceRequired
  } else {
    const raw = Array.isArray(b.mixed_subject_ids) ? b.mixed_subject_ids : []
    const ids = raw.map(idText).filter((x): x is string => x !== null && activeSubjectIds.has(x))
    mixed = [...new Set(ids)]
    if (mixed.length === 0) f.mixed_subject_ids = BATTLE_MESSAGES.sourceRequired
  }

  const ranges: [string, number, number][] = [
    ['total_questions', 5, 100],
    ['time_window_minutes', 10, 180],
    ['top_n_scoring', 1, 50],
    ['min_participants', 1, 100],
  ]
  for (const [key, lo, hi] of ranges) if (!inRange(b[key], lo, hi)) f[key] = BATTLE_MESSAGES.outOfRange

  const text = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
  const opensText = text(b.registration_opens_at)
  const closesText = text(b.registration_closes_at)
  const opens = opensText === null ? null : localToInstant(opensText)
  const closes = closesText === null ? null : localToInstant(closesText)
  if (opens !== null && Number.isNaN(opens)) f.registration_opens_at = BATTLE_MESSAGES.dateInvalid
  if (closes !== null && Number.isNaN(closes)) f.registration_closes_at = BATTLE_MESSAGES.dateInvalid
  if (opens !== null && closes !== null && !Number.isNaN(opens) && !Number.isNaN(closes) && closes <= opens) {
    f.registration_closes_at = BATTLE_MESSAGES.closeBeforeOpen
  }

  const action = b.action
  if (!(BATTLE_TOURNAMENT_ACTIONS as readonly unknown[]).includes(action)) f.action = BATTLE_MESSAGES.actionInvalid

  const first = Object.values(f)[0]
  if (first !== undefined) throw ApiError.of('VALIDATION_ERROR', { message: first, fields: f })

  return {
    title,
    description: typeof b.description === 'string' ? b.description : '',
    educationLevelId: level as TournamentInput['educationLevelId'],
    format: format as TournamentInput['format'],
    groupsCount: groups,
    questionMode: mode as TournamentInput['questionMode'],
    subjectId,
    mixedSubjectIds: mixed,
    totalQuestions: Number(b.total_questions),
    timeWindowMinutes: Number(b.time_window_minutes),
    topNScoring: Number(b.top_n_scoring),
    minParticipants: Number(b.min_participants),
    registrationOpensAt: opens === null ? null : new Date(opens),
    registrationClosesAt: closes === null ? null : new Date(closes),
    action: action as TournamentInput['action'],
  }
}
