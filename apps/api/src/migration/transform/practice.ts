/**
 * Practice session and answer transforms of `migrate:activity` (BE-29; v2-data-migration.md 3.3 and 4.4).
 * Pure functions, no I/O. A staged row is text; the result is the v2 column values or a reason-coded reject.
 *
 * Sessions
 *  - `mode` goes through an explicit map to the `ck_practice_sessions_mode` list. `spm` and `battle` (modes that
 *    have no v2 practice mode, LEAD Q5) are UNKNOWN_ENUM and counted by the loader; nothing is defaulted.
 *  - `completed_at` is `started_at + duration_seconds` (.cloud keeps no completion time; Perlu pengesahan). The
 *    loader computes it in SQL; this file leaves the field null.
 *  - an invalid `client_uuid` becomes null (counted); `correct > total` is INVALID_VALUE.
 * Answers
 *  - a migrated answer is a historical snapshot: `question_id` is null, `historical` is true, and the curriculum
 *    dimensions come from the snapshot join (`snapshot-dims`), never from the live bank.
 */
import { enumMapper, invalid, nonNegativeInt, orphan } from './activity-common'
import { flag, integer, ok, stamps, text, type Outcome, type Staged } from './common'
import { boundedCount } from './wallet'
import type { ResolvedDims } from '../snapshot-dims/dims'

// ---------------------------------------------------------------- sessions

export const SESSION_MODE_MAP = {
  random: 'random',
  chapter: 'chapter',
  revision: 'revision',
  past_year: 'past_year',
  latih_tubi: 'latih_tubi',
  ramalan: 'ramalan',
  mission: 'mission',
  remedial: 'remedial',
  question_set: 'question_set',
  pksk: 'pksk',
} as const

/** Modes the .cloud sessions may carry that have no v2 practice mode (LEAD Q5): rejected and counted by name. */
export const SESSION_MODES_DEFERRED: readonly string[] = ['spm', 'battle']

export const transformSessionMode = enumMapper('mode', SESSION_MODE_MAP)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SMALLINT_MAX = 32_767

export interface ClientUuid {
  /** Lower-case uuid, or null when blank or invalid. */
  value: string | null
  /** The source value was present but is not a uuid. */
  invalid: boolean
}

export function parseClientUuid(raw: string | null | undefined): ClientUuid {
  const t = text(raw)
  if (t === null) return { value: null, invalid: false }
  return UUID.test(t) ? { value: t.toLowerCase(), invalid: false } : { value: null, invalid: true }
}

export interface SessionRefs {
  userId: string | undefined
  /** The v2 subject; null = none given; undefined = set but not loaded. */
  subjectId: string | null | undefined
}

export interface SessionValues {
  user_id: string
  client_uuid: string | null
  mode: string
  subject_id: string | null
  question_count: number
  status: 'completed'
  correct_count: number
  time_spent_sec: number
  coins_earned: number
  points_earned: 0
  started_at: string
  /** Filled by the loader (`started_at + time_spent_sec`, in SQL). */
  completed_at: string | null
  legacy_paper: string | null
  question_set_id: null
  created_at: string
  updated_at: string
}

export const SESSION_COLUMNS = [
  'user_id', 'client_uuid', 'mode', 'subject_id', 'question_count', 'status', 'correct_count', 'time_spent_sec',
  'coins_earned', 'points_earned', 'started_at', 'completed_at', 'legacy_paper', 'question_set_id', 'created_at', 'updated_at',
] as const

/** `clientUuid` is the loader's final decision (invalid or clashing keys already turned into null). */
export function transformSession(row: Staged, refs: SessionRefs, clientUuid: string | null): Outcome<SessionValues> {
  if (refs.userId === undefined) return orphan('user_id')
  if (refs.subjectId === undefined) return orphan('subject_id')
  const mode = transformSessionMode(row.mode)
  if (!mode.ok) return mode
  if (mode.value === null) return invalid('mode')
  const startedAt = text(row.started_at)
  if (startedAt === null) return invalid('started_at')
  const total = boundedCount(row.total_questions)
  if (total === null || total === 'invalid' || total > SMALLINT_MAX) return invalid('total_questions')
  const correct = boundedCount(row.correct)
  if (correct === 'invalid' || (correct !== null && correct > SMALLINT_MAX)) return invalid('correct')
  if ((correct ?? 0) > total) return invalid('correct')
  const seconds = boundedCount(row.duration_seconds)
  if (seconds === 'invalid') return invalid('duration_seconds')
  const coins = boundedCount(row.syiling_earned)
  if (coins === 'invalid') return invalid('syiling_earned')
  return ok({
    user_id: refs.userId,
    client_uuid: clientUuid,
    mode: mode.value,
    subject_id: refs.subjectId,
    question_count: total,
    status: 'completed',
    correct_count: correct ?? 0,
    time_spent_sec: seconds ?? 0,
    coins_earned: coins ?? 0,
    points_earned: 0,
    started_at: startedAt,
    completed_at: null,
    legacy_paper: text(row.paper),
    question_set_id: null,
    ...stamps(row),
  })
}

// ---------------------------------------------------------------- answers

export interface AnswerRefs {
  userId: string | undefined
  /** The v2 session id; null = the attempt has no session; undefined = a session is named but was not loaded. */
  sessionId: string | null | undefined
  /** The session's client key (copied onto the answer), when the session is known. */
  clientUuid: string | null
  /** The session's start, used when the attempt has no timestamp of its own. */
  sessionStartedAt: string | null
  /** The snapshot join result (reject = an unknown dimension). */
  dims: Outcome<ResolvedDims>
}

export interface AnswerValues {
  session_id: string | null
  user_id: string
  question_id: null
  subject_id: string
  education_level_id: string | null
  chapter_id: string | null
  topic_id: string | null
  difficulty: number | null
  question_type: string | null
  selected_label: string | null
  is_correct: boolean
  time_seconds: number | null
  answered_at: string
  historical: true
  client_uuid: string | null
  legacy_question_ref: string | null
  legacy_content_hash: string | null
  source_natural_key: string | null
  number_label: string | null
  created_at: string
}

export const ANSWER_COLUMNS = [
  'session_id', 'user_id', 'question_id', 'subject_id', 'education_level_id', 'chapter_id', 'topic_id', 'difficulty',
  'question_type', 'selected_label', 'is_correct', 'time_seconds', 'answered_at', 'historical', 'client_uuid',
  'legacy_question_ref', 'legacy_content_hash', 'source_natural_key', 'number_label', 'created_at',
] as const

const LABEL = /^[A-H]$/

export function transformAnswer(row: Staged, refs: AnswerRefs): Outcome<AnswerValues> {
  if (refs.userId === undefined) return orphan('user_id')
  if (refs.sessionId === undefined) return orphan('practice_session_id')
  if (!refs.dims.ok) return refs.dims
  const dims = refs.dims.value
  const correct = text(row.is_correct) === null ? 'invalid' : flag(row.is_correct, false)
  if (correct === 'invalid') return invalid('is_correct')
  const rawLabel = text(row.selected_option)
  const label = rawLabel === null ? null : rawLabel.toUpperCase()
  if (label !== null && !LABEL.test(label)) return invalid('selected_option')
  const seconds = integer(row.time_seconds)
  if (seconds === 'invalid' || (seconds !== null && (seconds < 0 || seconds > 2_147_483_647))) return invalid('time_seconds')
  const created = text(row.created_at) ?? refs.sessionStartedAt
  if (created === null) return invalid('created_at')
  const questionRef = nonNegativeInt(row.question_id)
  return ok({
    session_id: refs.sessionId,
    user_id: refs.userId,
    question_id: null,
    subject_id: dims.subject_id,
    education_level_id: dims.education_level_id,
    chapter_id: dims.chapter_id,
    topic_id: dims.topic_id,
    difficulty: dims.difficulty,
    question_type: dims.question_type,
    selected_label: label,
    is_correct: correct,
    time_seconds: seconds,
    answered_at: created,
    historical: true,
    client_uuid: refs.clientUuid,
    legacy_question_ref: questionRef === null || questionRef === 'invalid' ? null : String(questionRef),
    legacy_content_hash: dims.legacy_content_hash,
    source_natural_key: dims.source_natural_key,
    number_label: dims.number_label,
    created_at: created,
  })
}
