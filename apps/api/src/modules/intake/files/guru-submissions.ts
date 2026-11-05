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
export const GuruMcqSubmissionSchema = z.strictObject({
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
export type GuruMcqSubmission = z.infer<typeof GuruMcqSubmissionSchema>
/**
 * S6-T17 (API-GUR-17 structured variant, ADD-13): the same marker for a teacher's structured question. The stimulus is the item `stem` (once) and the
 * parts are `payload.parts`; only the fields without a column of their own are here.
 */
export const GuruStructuredSubmissionSchema = z.strictObject({
  v: z.literal(1),
  questionType: z.literal('structured'),
  subjectId: z.string().min(1).max(64),
  educationLevelId: z.string().min(1).max(64),
  chapterId: z.string().min(1).max(64).nullable(),
  spIds: z.array(z.string().min(1).max(64)).max(3),
  tp: z.number().int().min(1).max(6).nullable(),
  cognitiveLevel: z.enum(QUESTION_COGNITIVE_LEVELS).nullable(),
  difficultyLevel: z.number().int().min(1).max(5),
  /** Public token of the stimulus image (`question_image` upload), or null. */
  stimulusImageId: z.string().min(1).max(64).nullable(),
})
export type GuruStructuredSubmission = z.infer<typeof GuruStructuredSubmissionSchema>
export const GuruSubmissionSchema = z.union([GuruMcqSubmissionSchema, GuruStructuredSubmissionSchema])
export type GuruSubmission = z.infer<typeof GuruSubmissionSchema>

/** What a validated submission is, before it is stored. */
export interface GuruSubmissionInput extends Omit<GuruMcqSubmission, 'v' | 'questionType'> {
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

/**
 * The intake tag (`IntakeCurriculumTagSchema`) is strict and has no absent form: `level` is T4, T5 or T4+T5, `tp` is 1..6 and `formOrigin`
 * is required. `T4`/`T5` keep their level; Tingkatan 1 to 3 take the wide level `T4+T5` with the form of origin `T1-T3` (the same pair a blank
 * hand-added item gets). These tag values are only the minimum the schema needs: the teacher's real Subjek, Tingkatan, Bab, SP, TP and Aras
 * are in `payload.guru`, and S2-T02 must pre-fill the Draf from `payload.guru`, not from `payload.tag`.
 */
function tagLevel(levelCode: string): { level: 'T4' | 'T5' | 'T4+T5'; formOrigin: 'T1-T3' | 'T4' | 'T5' } {
  if (levelCode === 'T4') return { level: 'T4', formOrigin: 'T4' }
  if (levelCode === 'T5') return { level: 'T5', formOrigin: 'T5' }
  return { level: 'T4+T5', formOrigin: 'T1-T3' }
}

/**
 * `intake_items.low_fields` of a submission: the tag fields the teacher did not supply (TP, SP) are listed as low-confidence, so they show as
 * unconfirmed in the review and the admin completes them (D112, AC-GUR-44-11) instead of reading a value nobody chose.
 */
export function guruLowFields(input: Pick<GuruSubmissionInput, 'tp' | 'spIds'>): string[] {
  return [...(input.tp === null ? ['tag.tp'] : []), ...(input.spIds.length === 0 ? ['tag.sp'] : [])]
}

/** The stored `payload` (intake question content + `guru` snapshot) of a submission. */
export function guruPayloadOf(input: GuruSubmissionInput, codes: GuruTagCodes, origin?: { label: string; page: number }): Record<string, unknown> {
  const { level, formOrigin } = tagLevel(codes.levelCode)
  const guru: GuruMcqSubmission = {
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
      // Placeholder when the teacher chose no TP (the schema needs 1..6): `guruLowFields` marks it, so the admin sees it as missing (AC-GUR-44-11).
      tp: input.tp ?? 3,
      formOrigin,
    },
    guru,
    ...(origin ? { origin } : {}),
  }
}

/** A validated structured submission, before it is stored. */
export interface GuruStructuredInput extends Omit<GuruStructuredSubmission, 'v' | 'questionType'> {
  /** The stimulus text, once for the whole group ('' when none). */
  stimulus: string
  parts: readonly { text: string; marks: number; scheme: string; cognitiveLevel: GuruMcqSubmission['cognitiveLevel'] }[]
}

const PART_LABELS = 'abcdefghij'

/** Total marks of a structured submission: the sum of the part marks (never sent by the client). */
export const guruStructuredTotal = (parts: readonly { marks: number }[]): number => parts.reduce((n, p) => n + p.marks, 0)

/**
 * The stored `payload` of a structured submission: an intake `structured` question whose `stem` is the stimulus (attached ONCE to the group) and
 * whose `parts` are the sub-questions; the model answer of a part is its `scheme.model`. A part without its own Aras takes the question's.
 */
export function guruStructuredPayloadOf(input: GuruStructuredInput, codes: GuruTagCodes, origin?: { label: string; page: number }): Record<string, unknown> {
  const { level, formOrigin } = tagLevel(codes.levelCode)
  const guru: GuruStructuredSubmission = {
    v: 1,
    questionType: 'structured',
    subjectId: input.subjectId,
    educationLevelId: input.educationLevelId,
    chapterId: input.chapterId,
    spIds: [...input.spIds],
    tp: input.tp,
    cognitiveLevel: input.cognitiveLevel,
    difficultyLevel: input.difficultyLevel,
    stimulusImageId: input.stimulusImageId,
  }
  return {
    stem: input.stimulus,
    options: [],
    marks: guruStructuredTotal(input.parts),
    mode: 'short_text',
    parts: input.parts.map((p, i) => {
      const cognitiveLevel = p.cognitiveLevel ?? input.cognitiveLevel
      return {
        id: `p${String(i + 1)}`,
        label: `(${PART_LABELS[i] as string})`,
        prompt: p.text,
        marks: p.marks,
        mode: 'short_text',
        scheme: { kind: 'points', marks: p.marks, points: [], model: p.scheme },
        ...(cognitiveLevel === null ? {} : { cognitiveLevel }),
      }
    }),
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

/** The structured submission as the teacher edits it, from the stored payload (`null` when the item is not one). */
export function readGuruStructured(payload: unknown): { guru: GuruStructuredSubmission; stimulus: string; parts: { text: string; marks: number; scheme: string; cognitiveLevel: GuruMcqSubmission['cognitiveLevel'] }[] } | null {
  if (typeof payload !== 'object' || payload === null) return null
  const p = payload as { guru?: unknown; stem?: unknown; parts?: unknown }
  const g = GuruStructuredSubmissionSchema.safeParse(p.guru)
  if (!g.success) return null
  const parts = Array.isArray(p.parts)
    ? p.parts.map((raw) => {
        const x = (typeof raw === 'object' && raw !== null ? raw : {}) as { prompt?: unknown; marks?: unknown; scheme?: { model?: unknown }; cognitiveLevel?: unknown }
        const level = QUESTION_COGNITIVE_LEVELS.find((l) => l === x.cognitiveLevel) ?? null
        return {
          text: typeof x.prompt === 'string' ? x.prompt : '',
          marks: typeof x.marks === 'number' ? x.marks : 0,
          scheme: typeof x.scheme?.model === 'string' ? x.scheme.model : '',
          cognitiveLevel: level,
        }
      })
    : []
  return { guru: g.data, stimulus: typeof p.stem === 'string' ? p.stem : '', parts }
}

/** The item's submission as the teacher edits it, from the stored payload (`null` when the item is not a teacher question submission). */
export function readGuruSubmission(payload: unknown): { guru: GuruMcqSubmission; stem: string; options: string[]; correctIndex: number; explanation: string | null } | null {
  if (typeof payload !== 'object' || payload === null) return null
  const p = payload as { guru?: unknown; stem?: unknown; options?: unknown; scheme?: unknown }
  const g = GuruMcqSubmissionSchema.safeParse(p.guru)
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

/** Prisma filter for "the item is a teacher's single-MCQ submission" (not an AI-extracted or hand-added item, and not a structured submission). */
export const GURU_SUBMISSION_ITEM: Prisma.IntakeItemWhereInput = {
  AND: [{ payload: { path: ['guru', 'v'], equals: 1 } }, { payload: { path: ['guru', 'questionType'], equals: 'mcq' } }],
}

/** Prisma filter for "the item is a teacher's structured submission" (S6-T17). */
export const GURU_STRUCTURED_ITEM: Prisma.IntakeItemWhereInput = {
  AND: [{ payload: { path: ['guru', 'v'], equals: 1 } }, { payload: { path: ['guru', 'questionType'], equals: 'structured' } }],
}

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
  Prisma.sql`b.owner_user_id = ${owner} AND b.source = 'guru' AND (i.payload -> 'guru' ->> 'v') = '1' AND (i.payload -> 'guru' ->> 'questionType') = 'mcq'`
