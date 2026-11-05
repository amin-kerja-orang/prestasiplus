import {
  GURU_SUBMISSION_STATUS_LABELS,
  QUESTION_COGNITIVE_LEVELS,
  type GuruSubmissionStatus,
  type IntakeQuestion,
} from '@pp/contract'
import { z } from 'zod'

import { Prisma } from '../../../db/generated/client'

/**
 * S6-T06 (API-GUR-18/19, R1 decision D113, L-6): a teacher's single MCQ (form or CSV row) is an intake item of a `source = 'guru'` batch.
 * Pure helpers: the snapshot of the submitted fields the item carries in `payload.guru` (S2-T02 reads it to pre-fill the Draf), the intake
 * payload built from a submission, and the teacher-facing status words over the stored states.
 */

/** `payload.guru`: the fields of 44-F1 that have no column of their own. Its presence marks an item as a teacher's question submission. */
export const GuruSubmissionSchema = z.strictObject({
  v: z.literal(1),
  questionType: z.literal('mcq'),
  subjectId: z.string().min(1).max(64),
  educationLevelId: z.string().min(1).max(64),
  chapterId: z.string().min(1).max(64).nullable(),
  spIds: z.array(z.string().min(1).max(64)).max(3),
  tp: z.number().int().min(1).max(6).nullable(),
  cognitiveLevel: z.enum(QUESTION_COGNITIVE_LEVELS).nullable(),
  /** The teacher's typed 1 to 5 Kesukaran (becomes `difficultyLevel` of the Draf). */
  difficultyLevel: z.number().int().min(1).max(5),
  /** 0..3 = A..D. */
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().max(2000).nullable(),
})
export type GuruSubmission = z.infer<typeof GuruSubmissionSchema>

/** What a validated submission is, before it is stored. */
export interface GuruSubmissionInput extends Omit<GuruSubmission, 'v' | 'questionType'> {
  questionText: string
  /** Exactly four option texts A to D. */
  options: readonly string[]
}

/** What the item payload needs from the curriculum: the tag codes (subject code, level code, SP codes). */
export interface GuruTagCodes {
  subjectCode: string
  levelCode: string
  spCodes: readonly string[]
}

export const GURU_PAPER_TYPE_QUESTION = 'umum'
export const GURU_QUESTION_SOURCE_TEXT = 'Kiriman guru'

const LETTERS = ['A', 'B', 'C', 'D'] as const

/** `T4`/`T5` tags keep their level; Tingkatan 1 to 3 read as the wide tag with the form of origin `T1-T3`. */
function tagLevel(levelCode: string): { level: 'T4' | 'T5' | 'T4+T5'; formOrigin: 'T1-T3' | 'T4' | 'T5' } {
  if (levelCode === 'T4') return { level: 'T4', formOrigin: 'T4' }
  if (levelCode === 'T5') return { level: 'T5', formOrigin: 'T5' }
  return { level: 'T4+T5', formOrigin: 'T1-T3' }
}

/** The stored `payload` (intake question content + `guru` snapshot) of a submission. */
export function guruPayloadOf(input: GuruSubmissionInput, codes: GuruTagCodes, origin?: { label: string; page: number }): Record<string, unknown> {
  const { level, formOrigin } = tagLevel(codes.levelCode)
  const guru: GuruSubmission = {
    v: 1,
    questionType: 'mcq',
    subjectId: input.subjectId,
    educationLevelId: input.educationLevelId,
    chapterId: input.chapterId,
    spIds: [...input.spIds],
    tp: input.tp,
    cognitiveLevel: input.cognitiveLevel,
    difficultyLevel: input.difficultyLevel,
    correctIndex: input.correctIndex,
    explanation: input.explanation,
  }
  return {
    stem: input.questionText,
    options: input.options.map((text, i) => ({ id: LETTERS[i] as string, text })),
    marks: 1,
    mode: 'short_text',
    ...(input.cognitiveLevel === null ? {} : { cognitiveLevel: input.cognitiveLevel }),
    parts: [],
    scheme: { kind: 'option', marks: 1, correct: LETTERS[input.correctIndex] as string, reason: input.explanation ?? '' },
    tag: {
      subject: codes.subjectCode.slice(0, 32),
      level,
      unit: null,
      unitLabel: '',
      sp: [...codes.spCodes],
      tp: input.tp ?? 3,
      formOrigin,
    },
    guru,
    ...(origin ? { origin } : {}),
  }
}

/** The item's submission as the teacher edits it, from the stored payload (`null` when the item is not a teacher question submission). */
export function readGuruSubmission(payload: unknown): { guru: GuruSubmission; stem: string; options: string[]; correctIndex: number; explanation: string | null } | null {
  if (typeof payload !== 'object' || payload === null) return null
  const p = payload as { guru?: unknown; stem?: unknown; options?: unknown; scheme?: unknown }
  const g = GuruSubmissionSchema.safeParse(p.guru)
  if (!g.success) return null
  const options = Array.isArray(p.options) ? p.options.map((o) => (typeof o === 'object' && o !== null && typeof (o as { text?: unknown }).text === 'string' ? (o as { text: string }).text : '')) : []
  // An admin edit of the key in the review screen wins over the snapshot taken at submit.
  const scheme = p.scheme as Partial<Extract<NonNullable<IntakeQuestion['scheme']>, { kind: 'option' }>> | undefined
  const letter = scheme?.kind === 'option' ? LETTERS.indexOf(scheme.correct as (typeof LETTERS)[number]) : -1
  return {
    guru: g.data,
    stem: typeof p.stem === 'string' ? p.stem : '',
    options,
    correctIndex: letter >= 0 ? letter : g.data.correctIndex,
    explanation: scheme?.kind === 'option' ? (scheme.reason === '' || scheme.reason === undefined ? null : scheme.reason) : g.data.explanation,
  }
}

/** Prisma filter for "the item is a teacher question submission" (not an AI-extracted or hand-added item of a paper batch). */
export const GURU_SUBMISSION_ITEM: Prisma.IntakeItemWhereInput = { payload: { path: ['guru', 'v'], equals: 1 } }

/** The item states a teacher may still edit or delete: not accepted by the admin (including one returned with a reason). */
export const GURU_EDITABLE_STATES: readonly string[] = ['generated', 'needs_review', 'rejected']

export interface GuruStatusFacts {
  reviewState: string
  rejectReason: string | null
  /** The linked question, when the item was accepted and the question still exists. */
  question: { liveVersionNo: number | null; latestStatus: string | null; latestRejectionReason: string | null } | null
}

/**
 * FR-GUR-44-10: `pending` ("Menunggu Semakan") = the item awaits review, or it was accepted and the question is not published yet;
 * `approved` ("Diluluskan") = the question made from it is published (a live version); `rejected` ("Ditolak") = the admin rejected the item,
 * or sent the accepted question back to Draf with a reason (shown as "Sebab: {reason}").
 * The SQL twin `GURU_STATUS_SQL` must give the same answer.
 */
export function guruStatusOf(f: GuruStatusFacts): { status: GuruSubmissionStatus; label: string; reason: string | null } {
  let status: GuruSubmissionStatus = 'pending'
  let reason: string | null = null
  if (f.reviewState === 'rejected') {
    status = 'rejected'
    reason = f.rejectReason
  } else if (f.reviewState === 'accepted' && f.question !== null) {
    if (f.question.liveVersionNo !== null) status = 'approved'
    else if (f.question.latestStatus === 'draft' && f.question.latestRejectionReason !== null) {
      status = 'rejected'
      reason = f.question.latestRejectionReason
    }
  }
  return { status, label: GURU_SUBMISSION_STATUS_LABELS[status], reason }
}

/**
 * SQL twin of `guruStatusOf` over `i` (intake_items), `q` (questions, LEFT) and `v` (the latest question_versions row, LEFT):
 * 'approved' | 'rejected' | 'pending'.
 */
export const GURU_STATUS_SQL = Prisma.sql`CASE
    WHEN i.review_state = 'rejected' THEN 'rejected'
    WHEN i.review_state = 'accepted' AND q.id IS NOT NULL AND q.live_version_no IS NOT NULL THEN 'approved'
    WHEN i.review_state = 'accepted' AND q.id IS NOT NULL AND v.status = 'draft' AND v.rejection_reason IS NOT NULL THEN 'rejected'
    ELSE 'pending' END`

/** SQL twin of `GURU_SUBMISSION_ITEM` plus the ownership of the batch, over `i` and `b` (intake_batches). */
export const guruOwnItemsSql = (owner: bigint): Prisma.Sql =>
  Prisma.sql`b.owner_user_id = ${owner} AND b.source = 'guru' AND (i.payload -> 'guru' ->> 'v') = '1'`
