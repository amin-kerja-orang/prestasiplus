/**
 * M04 business rules used by the repositories (SRS v1.10 §4): eligibility (BR-M04-03), the runtime
 * SPM pool rule (BR-M04-32), answer letters, S1 filter mapping (BR-M04-04…07) and the report reason
 * sets (BR-M04-15).
 */

import type { Where } from '@/mock/define'

import { SPM_POOL_SUBJECTS } from '../data/tables'
import type { ComplianceStatus, Question, QuestionStatus, SourceType } from './types'

/** BR-M04-03: served to practice only when approved and active. */
export function isEligible(q: Pick<Question, 'status' | 'isActive'>): boolean {
  return q.status === 'approved' && q.isActive
}

/** BR-M04-03 + MCQ practice: eligible, objective (not PKSK) and `mcq`. */
export function isPracticeEligible(
  q: Pick<Question, 'status' | 'isActive' | 'questionType' | 'pkskDomainId'>,
): boolean {
  return isEligible(q) && q.questionType === 'mcq' && q.pkskDomainId === null
}

/** BR-M04-32 runtime rule: T4/T5 rows of the 19 SPM (Latih Tubi) subjects join the pool. */
export function runtimeSpmPool(subjectId: number | null, levelId: number | null): boolean {
  return (
    subjectId !== null &&
    (levelId === 10 || levelId === 11) &&
    SPM_POOL_SUBJECTS.includes(subjectId)
  )
}

/** "A"–"D" (any case) or 0–3 → 0–3; anything else → null. */
export function answerIndex(answer: unknown): number | null {
  if (typeof answer === 'number' && Number.isInteger(answer) && answer >= 0 && answer <= 3) {
    return answer
  }
  if (typeof answer === 'string') {
    const t = answer.trim().toUpperCase()
    if (/^[A-D]$/.test(t)) return t.charCodeAt(0) - 65
    if (/^[0-3]$/.test(t)) return Number(t)
  }
  return null
}

export const LETTERS = ['A', 'B', 'C', 'D'] as const

/** S1 filters (§7 #1 query, BR-M04-04…07). Unknown values match nothing (as live). */
export interface AdminListFilter {
  subjectId?: number
  educationLevelId?: number
  difficultyLevel?: number
  status?: string
  dskpFilter?: string
  complianceFilter?: string
  sourceFilter?: string
  search?: string
}

const STATUSES: readonly QuestionStatus[] = [
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'archived',
]
const COMPLIANCE: readonly ComplianceStatus[] = [
  'verified',
  'pending_mapping',
  'quarantined',
  'rejected',
  'draft',
]
const SOURCES: readonly SourceType[] = ['textbook', 'dskp', 'trial', 'marking_scheme']

/** A condition no row satisfies (an unknown filter value). */
const NOTHING = { id: -1 } as const

export function adminWhere(filter: AdminListFilter): Where<Question> {
  const w: Record<string, unknown> = { pkskDomainId: null }
  if (filter.subjectId !== undefined) w.subjectId = filter.subjectId
  if (filter.educationLevelId !== undefined) w.educationLevelId = filter.educationLevelId
  if (filter.difficultyLevel !== undefined) w.difficultyLevel = filter.difficultyLevel
  if (filter.status) {
    if (!STATUSES.includes(filter.status as QuestionStatus)) return NOTHING
    w.status = filter.status
  }
  if (filter.dskpFilter) {
    if (filter.dskpFilter === 'tagged') w.dskpTagged = true
    else if (filter.dskpFilter === 'untagged') w.dskpTagged = false
    else return NOTHING
  }
  if (filter.complianceFilter) {
    const c = filter.complianceFilter
    if (c === 'missing_source') w.hasSourceFile = false
    else if (c === 'verified_generated') w.aiVerified = true
    else if (COMPLIANCE.includes(c as ComplianceStatus)) w.complianceStatus = c
    else return NOTHING
  }
  if (filter.sourceFilter) {
    if (!SOURCES.includes(filter.sourceFilter as SourceType)) return NOTHING
    w.sourceType = filter.sourceFilter
  }
  return w
}

/** M10 S28 `source_type` families (INFERRED mapping; M10 BR-M10-27). */
export const SOURCE_FAMILIES: Readonly<Record<string, readonly (SourceType | null)[]>> = {
  past_year: ['trial', 'marking_scheme'],
  practice: ['textbook', 'dskp'],
  prediction: ['ai_generated'],
}

/** BR-M04-15 reason codes accepted per variant (`outdated` from the M10 teacher databank). */
export const MCQ_REASONS = [
  'wrong_answer',
  'confusing_question',
  'wrong_options',
  'missing_options',
  'duplicate',
  'typo',
  'other',
  'outdated',
] as const
export const STRUCTURED_REASONS = [
  'wrong_answer',
  'confusing_question',
  'wrong_options',
  'typo',
  'other',
] as const

export const REPORT_SOURCES = [
  'spm',
  'structured_attempt',
  'latihan',
  'revision',
  'teacher_databank',
] as const

/** #15 success copy. */
export const REPORT_SUCCESS_MESSAGE = 'Laporan berjaya dihantar.'
