/**
 * Operations transforms of `migrate:activity` (BE-29 Part B): support tickets, timeline posts and feedback.
 * Pure functions; the loader resolves users, the Malaysia month and the newest-feedback decision in SQL.
 *
 * Free text (ticket subject and reply, timeline title and story, feedback comment) is only moved from one
 * table to the other; a reject carries a reason code and a column name, never the text.
 */
import { enumMapper, invalid, orphan, duplicate } from './activity-common'
import { enumKey, ok, squash, stamps, text, type Outcome, type Staged } from './activity-common'
import { ROLE_MAP } from './enums'

const len = (s: string): number => Array.from(s).length

// ---------------------------------------------------------------- support tickets

/**
 * .cloud ticket status -> the five BM codes of v2. The BM codes map to themselves; the English words are the
 * obvious twins (Perlu pengesahan until the BE-27 profile lists the real values). Anything else is UNKNOWN_ENUM.
 */
export const TICKET_STATUS_MAP: Readonly<Record<string, string>> = {
  dibuka: 'dibuka',
  open: 'dibuka',
  dalam_proses: 'dalam_proses',
  in_progress: 'dalam_proses',
  menunggu_balas: 'menunggu_balas',
  selesai: 'selesai',
  resolved: 'selesai',
  ditutup: 'ditutup',
  closed: 'ditutup',
}
const ticketStatus = enumMapper('status', TICKET_STATUS_MAP)

export interface TicketValues {
  user_id: string
  subject: string
  body: string
  status: string
  admin_reply: string | null
  is_test: boolean
  created_at: string
  updated_at: string
}

/**
 * A subject over 255 characters is INVALID_VALUE (no truncation). `body` is NOT NULL in v2 and has no staged
 * column (LEAD Q6): INVALID_VALUE naming `body`, unless the staging spec carries it.
 */
export function transformTicket(row: Staged, parents: { userId: string | undefined }): Outcome<TicketValues> {
  if (parents.userId === undefined) return orphan('user_id')
  const subject = squash(row.subject)
  if (subject === null || len(subject) > 255) return invalid('subject')
  const status = ticketStatus(row.status)
  if (!status.ok) return status
  if (status.value === null) return invalid('status')
  const body = text(row.body)
  if (body === null) return invalid('body')
  return ok({
    user_id: parents.userId,
    subject,
    body,
    status: status.value,
    admin_reply: text(row.admin_reply),
    is_test: false,
    ...stamps(row),
  })
}

// ---------------------------------------------------------------- timeline

/** T-02: the .cloud timeline has no category; migrated posts take the fixed `lain` (the mock word for "other"). */
export const TIMELINE_CATEGORY = 'lain'
export const TIMELINE_TITLE_MAX = 150
export const TIMELINE_STORY_MAX = 2000

export interface TimelineValues {
  user_id: string
  title: string
  category: string
  event_date: string | null
  story: string | null
  is_test: boolean
  created_at: string
  updated_at: string
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** `happened_on` is a date column and is kept as a date; a title over 150 or a story over 2000 characters is rejected (no truncation). */
export function transformTimeline(row: Staged, parents: { userId: string | undefined }): Outcome<TimelineValues> {
  if (parents.userId === undefined) return orphan('user_id')
  const title = squash(row.title)
  if (title === null || len(title) > TIMELINE_TITLE_MAX) return invalid('title')
  const story = text(row.body)
  if (story !== null && len(story) > TIMELINE_STORY_MAX) return invalid('body')
  const day = text(row.happened_on)
  if (day !== null && !ISO_DAY.test(day)) return invalid('happened_on')
  return ok({
    user_id: parents.userId,
    title,
    category: TIMELINE_CATEGORY,
    event_date: day,
    story,
    is_test: false,
    ...stamps(row),
  })
}

// ---------------------------------------------------------------- feedback

export interface FeedbackValues {
  user_id: string
  role: string
  school_id: string | null
  month: string
  nps: number | null
  satisfaction: number
  usability: number | null
  relevance: number | null
  score: number | null
  comment: string | null
  is_test: boolean
  created_at: string
  updated_at: string
}

const SCORE = /^[1-5]$/
/** The 0 to 10 scale of `nps` (the v2 check `ck_feedback_nps`). */
const NPS = /^(?:[0-9]|10)$/

/** The v2 role code of the answering user's staged role (T-01). */
export function feedbackRole(role: string | null | undefined): Outcome<string> {
  const k = enumKey(role)
  const mapped = k === null ? undefined : ROLE_MAP[k]
  return mapped === undefined ? { ok: false, reject: { reason: 'UNKNOWN_ENUM', column: 'role', allowedCodes: Object.keys(ROLE_MAP) } } : ok(mapped)
}

function score(value: string | null | undefined, column: string, required: boolean): Outcome<number | null> {
  const t = text(value)
  if (t === null) return required ? invalid(column) : ok(null)
  return SCORE.test(t) ? ok(Number(t)) : invalid(column)
}

/**
 * The .cloud `score` (D4, LEAD 29 Oct): 1 to 5 stays `score` (`nps` null); 0 or 6 to 10 (the 0 to 10 NPS scale) goes to
 * `nps` with `score` null; anything else (blank is no score) is INVALID_VALUE on `score`. Nothing is rescaled.
 */
export function overallScore(value: string | null | undefined): Outcome<{ score: number | null; nps: number | null }> {
  const t = text(value)
  if (t === null) return ok({ score: null, nps: null })
  if (SCORE.test(t)) return ok({ score: Number(t), nps: null })
  if (NPS.test(t)) return ok({ score: null, nps: Number(t) })
  return invalid('score')
}

export interface FeedbackContext {
  userId: string | undefined
  /** The answering user's staged role. */
  role: string | null | undefined
  /** The user's v2 school (null = none). */
  schoolId: string | null
  /** First day of the Malaysia month of `created_at` (computed in SQL), or null when there is no `created_at`. */
  month: string | null
  /** The newest row of its (user, month): the others are DUPLICATE_KEY. */
  newest: boolean
}

/**
 * The four scores are kept. `satisfaction`, `usability` and `relevance` must be 1 to 5 (the v2 checks); `score` follows
 * `overallScore` (D4: a 0 to 10 value outside 1 to 5 becomes `nps`). The satisfaction is required (v2 NOT NULL): a row
 * without one is INVALID_VALUE on `satisfaction`, never filled in. More than one row per (user, month): the newest stays,
 * the rest are DUPLICATE_KEY.
 */
export function transformFeedback(row: Staged, c: FeedbackContext): Outcome<FeedbackValues> {
  if (c.userId === undefined) return orphan('user_id')
  const role = feedbackRole(c.role)
  if (!role.ok) return role
  if (c.month === null) return invalid('created_at')
  const satisfaction = score(row.satisfaction, 'satisfaction', true)
  if (!satisfaction.ok) return satisfaction
  const usability = score(row.usability, 'usability', false)
  if (!usability.ok) return usability
  const relevance = score(row.relevance, 'relevance', false)
  if (!relevance.ok) return relevance
  const overall = overallScore(row.score)
  if (!overall.ok) return overall
  if (!c.newest) return duplicate('month')
  return ok({
    user_id: c.userId,
    role: role.value,
    school_id: c.schoolId,
    month: c.month,
    nps: overall.value.nps,
    satisfaction: satisfaction.value as number,
    usability: usability.value,
    relevance: relevance.value,
    score: overall.value.score,
    comment: text(row.comment),
    is_test: false,
    ...stamps(row),
  })
}
