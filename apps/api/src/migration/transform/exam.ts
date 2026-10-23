/**
 * Exam attempt transform of `migrate:activity` (BE-29; v2-data-migration.md 4.x "M06 mock exams", LEAD Q4).
 * Pure functions, no I/O. A migrated attempt is a HEADER plus its score: the paper, the answers and the
 * composition are not migrated, so the v2 NOT NULL columns that have no .cloud source carry documented sentinels
 * and the attempt is flagged `historical`.
 *
 * Sentinels (Perlu pengesahan, approved by the lead as Q4):
 *   paper_kind 'pilihan', kertas 1, duration_min 1, subject 'legacy', subject_name 'Tidak diketahui',
 *   paper_code 'LEGACY', composition [], picks {}, flags ['historical'], paper_id null,
 *   title = the archived paper title (plus its source year) or EXAM_FALLBACK_TITLE,
 *   started_at = the row's created_at, submitted_at = its updated_at (submitted / auto_submitted only).
 * The result keeps score, max_score and section_scores; `graded` is an empty { sections, questions } object (the
 * shape the attempts repository reads), provisional is false, pending_review 0, coins and points null.
 * Free-text answers, AI grading and the served composition are never read.
 */
import { enumMapper, invalid, orphan } from './activity-common'
import { ok, stamps, text, type Outcome, type Staged } from './common'

export const EXAM_MODE_MAP = {
  exam: 'exam',
  peperiksaan: 'exam',
  latihan: 'latihan',
  practice: 'latihan',
} as const

/**
 * `exam_attempts.status` -> v2 status. `selesai` is the value in the BE-35 fixture. An attempt still in progress
 * has no v2 equivalent without a deadline and is UNKNOWN_ENUM (Perlu pengesahan against the real profile).
 */
export const EXAM_STATUS_MAP = {
  submitted: 'submitted',
  selesai: 'submitted',
  completed: 'submitted',
  auto_submitted: 'auto_submitted',
  tamat_masa: 'auto_submitted',
  abandoned: 'abandoned',
  ditinggalkan: 'abandoned',
} as const

export const EXAM_FALLBACK_TITLE = 'Percubaan peperiksaan lama'
const SCORE = /^\d{1,5}(\.\d+)?$/
const SCORE_MAX = 99_999.99

const mapMode = enumMapper('mode', EXAM_MODE_MAP)
const mapStatus = enumMapper('status', EXAM_STATUS_MAP)

export interface ExamRefs {
  userId: string | undefined
  /** Title of the archived paper (and its source year); null when the paper is unknown. */
  paperTitle: string | null
}

export interface ExamAttemptValues {
  user_id: string
  paper_id: null
  paper_kind: 'pilihan'
  title: string
  subject: 'legacy'
  subject_name: 'Tidak diketahui'
  kertas: 1
  paper_code: 'LEGACY'
  mode: string
  status: string
  started_at: string
  duration_min: 1
  composition: never[]
  flags: ['historical']
  picks: Record<string, never>
  position: 0
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export interface ExamResultValues {
  score: string
  max_score: string
  section_scores: unknown
}

export const EXAM_ATTEMPT_COLUMNS = [
  'user_id', 'paper_id', 'paper_kind', 'title', 'subject', 'subject_name', 'kertas', 'paper_code', 'mode', 'status',
  'started_at', 'duration_min', 'composition', 'flags', 'picks', 'position', 'submitted_at', 'created_at', 'updated_at',
] as const

/** A score as a two-decimal string (numeric(7,2)), or `invalid`; blank is null. */
export function parseScore(raw: string | null | undefined): string | null | 'invalid' {
  const t = text(raw)
  if (t === null) return null
  if (!SCORE.test(t)) return 'invalid'
  const n = Number(t)
  return n > SCORE_MAX ? 'invalid' : n.toFixed(2)
}

/**
 * Keeps the numeric leaves of a parsed JSON value (keys kept; text, booleans and nulls are dropped, an array
 * element that is dropped becomes null). Returns undefined when nothing numeric is left.
 */
function numericLeaves(value: unknown): unknown {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (Array.isArray(value)) {
    // An array keeps its positions: a dropped element becomes null so the scores do not shift.
    const kept = value.map((v) => numericLeaves(v) ?? null)
    return kept.some((v) => v !== null) ? kept : undefined
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      const leaf = numericLeaves(v)
      if (leaf !== undefined) out[k] = leaf
    }
    return Object.keys(out).length > 0 ? out : undefined
  }
  return undefined
}

/**
 * The JSON of `section_scores`: scores only (AC2). An object or array keeps its numeric leaves under their keys; any
 * text leaf is dropped (it is free text, not a score) and so is a numeric string. Blank, unparsable or without a
 * numeric leaf is null.
 */
export function parseSectionScores(raw: string | null | undefined): unknown {
  const t = text(raw)
  if (t === null) return null
  try {
    const v: unknown = JSON.parse(t)
    return v !== null && typeof v === 'object' ? (numericLeaves(v) ?? null) : null
  } catch {
    return null
  }
}

/** Title of the snapshot: the archived paper title, plus the source year when it is not in the title already. */
export function snapshotTitle(title: string | null | undefined, year: string | null | undefined): string {
  const t = text(title)
  if (t === null) return EXAM_FALLBACK_TITLE
  const y = text(year)
  const full = y !== null && /^\d{4}$/.test(y) && !t.includes(y) ? `${t} (${y})` : t
  return full.slice(0, 200)
}

export interface ExamOutput {
  attempt: ExamAttemptValues
  /** Null when the row has no score or no maximum: the attempt is loaded without a result. */
  result: ExamResultValues | null
}

export function transformExamAttempt(row: Staged, refs: ExamRefs): Outcome<ExamOutput> {
  if (refs.userId === undefined) return orphan('user_id')
  const mode = mapMode(row.mode)
  if (!mode.ok) return mode
  const status = mapStatus(row.status)
  if (!status.ok) return status
  if (mode.value === null || status.value === null) return invalid('status')
  const score = parseScore(row.score)
  if (score === 'invalid') return invalid('score')
  const max = parseScore(row.max_score)
  if (max === 'invalid') return invalid('max_score')
  // A score above its maximum, or a zero / negative maximum, is a contradiction: reject, never clamp.
  if (score !== null && max !== null && (Number(max) <= 0 || Number(score) < 0 || Number(score) > Number(max))) return invalid('score')
  const { created_at, updated_at } = stamps(row)
  const submitted = status.value === 'abandoned' ? null : updated_at
  return ok({
    attempt: {
      user_id: refs.userId,
      paper_id: null,
      paper_kind: 'pilihan',
      title: refs.paperTitle ?? EXAM_FALLBACK_TITLE,
      subject: 'legacy',
      subject_name: 'Tidak diketahui',
      kertas: 1,
      paper_code: 'LEGACY',
      mode: mode.value,
      status: status.value,
      started_at: created_at,
      duration_min: 1,
      composition: [],
      flags: ['historical'],
      picks: {},
      position: 0,
      submitted_at: submitted,
      created_at,
      updated_at,
    },
    result: score === null || max === null ? null : { score, max_score: max, section_scores: parseSectionScores(row.section_scores) },
  })
}
