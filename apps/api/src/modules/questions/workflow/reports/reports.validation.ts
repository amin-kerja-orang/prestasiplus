import {
  QUESTION_REPORT_COMMENT_MAX,
  QuestionReportContextSchema,
  QUESTION_REPORT_MCQ_REASONS,
  QUESTION_REPORT_MESSAGES as M,
  QUESTION_REPORT_NOTES_MAX,
  QUESTION_REPORT_REF_PATTERN,
  QUESTION_REPORT_SOURCES,
  QUESTION_REPORT_STRUCTURED_REASONS,
  QUESTION_REPORT_UPDATE_STATUSES,
} from '@pp/contract'

import { ApiError } from '../../../../common/errors/api-error'
import { idFromString } from '../../../../db/ids'

export interface ValidCreate {
  questionId: bigint
  questionType: 'mcq' | 'structured'
  reasons: string[]
  comment: string | null
  source: string
  quizSessionRef: string | null
  roomCode: string | null
  /** R1-T42: the attempt the pupil reported from (checked by the service) and the paper they claim; null = none given. */
  context: { attemptId: string; paperId: string | null } | null
}

export interface ValidUpdate {
  status: 'reviewed' | 'fixed' | 'dismissed'
  adminNotes: string | null | undefined
  reactivate: boolean
  forceDeactivate: boolean
  /** R1-B17: archive the question through the lifecycle. */
  archive: boolean
}

const asRecord = (raw: unknown): Record<string, unknown> =>
  typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}

const flag = (v: unknown): boolean => v === true || v === 1 || v === '1' || v === 'true'

function questionIdOf(v: unknown): bigint | null {
  try {
    if (typeof v === 'string') return idFromString(v)
    if (typeof v === 'number' && Number.isSafeInteger(v) && v > 0) return BigInt(v)
  } catch {
    return null
  }
  return null
}

/** POST body, in the order and with the messages of the mock handler; every failing field is reported. */
export function validateCreate(raw: unknown): ValidCreate {
  const b = asRecord(raw)
  const fields: Record<string, string> = {}

  const type: 'mcq' | 'structured' = b.questionType === 'structured' ? 'structured' : 'mcq'
  if (b.questionType !== undefined && b.questionType !== 'mcq' && b.questionType !== 'structured') fields.questionType = M.type

  const questionId = questionIdOf(b.questionId)
  if (questionId === null) fields.questionId = M.question

  const reasons = Array.isArray(b.reasons) ? b.reasons.filter((x): x is string => typeof x === 'string') : []
  const allowed: readonly string[] = type === 'mcq' ? QUESTION_REPORT_MCQ_REASONS : QUESTION_REPORT_STRUCTURED_REASONS
  if (reasons.length === 0) fields.reasons = M.reasonsRequired
  else if (reasons.some((x) => !allowed.includes(x))) fields.reasons = M.reasonInvalid

  const source = b.source === undefined ? (type === 'mcq' ? 'spm' : 'structured_attempt') : b.source
  if (typeof source !== 'string' || !(QUESTION_REPORT_SOURCES as readonly string[]).includes(source)) fields.source = M.source

  const comment = typeof b.comment === 'string' ? b.comment : null
  if (comment !== null && comment.length > QUESTION_REPORT_COMMENT_MAX) fields.comment = M.comment

  for (const key of ['quizSessionId', 'roomCode'] as const) {
    const v = b[key]
    if (v !== undefined && v !== null && v !== '' && (typeof v !== 'string' || !QUESTION_REPORT_REF_PATTERN.test(v))) fields[key] = M.reference
  }
  // R1-T42: the report context, parsed by the strict schema (a paper without an attempt proves nothing, so it is refused).
  let context: ValidCreate['context'] = null
  const given = (v: unknown): boolean => v !== undefined && v !== null && v !== ''
  if (given(b.attemptId) || given(b.paperId)) {
    const parsed = QuestionReportContextSchema.safeParse({ attemptId: given(b.attemptId) ? b.attemptId : undefined, ...(given(b.paperId) ? { paperId: b.paperId } : {}) })
    if (parsed.success) context = { attemptId: parsed.data.attemptId.toLowerCase(), paperId: parsed.data.paperId ?? null }
    else for (const issue of parsed.error.issues) fields[String(issue.path[0] ?? 'attemptId')] ??= issue.path[0] === 'paperId' ? M.paper : M.attempt
  }
  if (Object.keys(fields).length > 0 || questionId === null) throw ApiError.of('VALIDATION_ERROR', { fields })

  return {
    questionId,
    questionType: type,
    reasons,
    comment: comment === null || comment.trim() === '' ? null : comment,
    source: source as string,
    quizSessionRef: typeof b.quizSessionId === 'string' && b.quizSessionId !== '' ? b.quizSessionId : null,
    roomCode: typeof b.roomCode === 'string' && b.roomCode !== '' ? b.roomCode : null,
    context,
  }
}

/** PATCH body (the report exists already: a missing report is 404 before a bad body is 422, like the mock). */
export function validateUpdate(raw: unknown): ValidUpdate {
  const b = asRecord(raw)
  const fields: Record<string, string> = {}
  const status = typeof b.status === 'string' ? b.status.trim() : ''
  if (!(QUESTION_REPORT_UPDATE_STATUSES as readonly string[]).includes(status)) fields.status = M.status
  let adminNotes: string | null | undefined
  if (b.adminNotes !== undefined && b.adminNotes !== null) {
    if (typeof b.adminNotes !== 'string' || b.adminNotes.length > QUESTION_REPORT_NOTES_MAX) fields.adminNotes = M.adminNotes
    else adminNotes = b.adminNotes.trim() === '' ? null : b.adminNotes
  } else if (b.adminNotes === null) adminNotes = null
  if (Object.keys(fields).length > 0) throw ApiError.of('VALIDATION_ERROR', { fields })
  return { status: status as ValidUpdate['status'], adminNotes, reactivate: flag(b.reactivate), forceDeactivate: flag(b.forceDeactivate), archive: flag(b.archive) }
}
