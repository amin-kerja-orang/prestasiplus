import { z } from '../../zod'
import { IdSchema } from '../../common/ids'
import { TimestampInputSchema, TimestampSchema } from '../../common/time'
import { BijakPaperKindSchema } from '../papers/schema'

/**
 * Bijak SPM (M28) attempts: the write side of BE-16 (start, resume, autosave, server timer,
 * submit, per-question "Semak", marking, results, history, working photos). The mock `BijakServer`
 * (`src/modules/m28-bijak-spm/server/store.ts`, types in `domain/types.ts`) has no HTTP routes; the
 * ten routes of this contract are derived from its attempt methods (`findInProgress`,
 * `startAttempt`, `getAttemptView`, `saveAnswers`, `submit`, `abandon`, `checkQuestion`,
 * `getResult`, `history`) plus the card-only photo upload. `sweep()` is a scheduled job and
 * `serverNow()` is returned inside the attempt view; neither is a route.
 *
 * Differences from the mock, all forced by the wire conventions (see also `paths.ts`):
 * - instants are ISO 8601 `+08:00` strings (`common/time.ts`), not epoch milliseconds: `startedAt`,
 *   `deadline`, `submittedAt`, `savedAt`, and the new `serverNow`. Client-sent `savedAt` is a
 *   `TimestampInput` (any offset or Z). Durations stay integer seconds or minutes;
 * - ids (attempt, part, question, section, paper) are opaque `Id` strings (UD-1); the numeric
 *   `userId` of the mock attempt is not on the wire (every attempt is the caller's own);
 * - the mock `AttemptPaperView` gains `serverNow`;
 * - the mock `Attempt.sections` snapshot is the top-level `sections` of the view.
 *
 * Reveal rule (US-15, BE-16 AC 3): `BijakAttemptPaperView` carries no answer key, mark scheme,
 * accepted equivalent or explanation. Every object that is part of the served paper is a strict
 * object, so an extra key (for example `scheme` or `correctOption` on a question or part) fails
 * parsing. Keys and marking detail leave the server only in `BijakAttemptQuestionResult` (latihan
 * "Semak", per question, listed in `checks`) and in `BijakAttemptResultView` (after submit).
 */

/** BM messages kept verbatim from the mock (`BijakError`, `photo-store.ts`). */
export const BIJAK_ATTEMPTS_MESSAGES = {
  attemptNotFound: 'Percubaan tidak ditemui',
  paperNotFound: 'Kertas tidak ditemui',
  questionNotFound: 'Soalan tidak ditemui',
  forbidden: 'Akses ditolak',
  schemeAfterSubmit: 'Skema hanya didedahkan selepas Hantar',
  attemptClosed: 'Percubaan sudah tamat',
  photoType: 'Gambar mesti JPG atau PNG, maksimum 5 MB.',
  photoCount: 'Maksimum 3 gambar bagi setiap bahagian.',
  /** R1-B12: a self-mark is accepted only for a closed attempt (409 NOT_SUBMITTED + `schemeAfterSubmit` before that). */
  selfMarkPartUnknown: 'Bahagian ini tiada dalam kertas ini.',
  selfMarkNotSubjective: 'Bahagian ini ditanda automatik; markah kendiri tidak diperlukan.',
  selfMarkBandUnknown: 'Band tidak sah untuk bahagian ini.',
  selfMarkBandNotRubric: 'Bahagian ini tidak menggunakan band.',
  /** R1-B15: "Cuba Lagi" on a paper that is no longer offered (withdrawn or unpublished). */
  retryPaperGone: 'Kertas ini sudah tidak tersedia untuk dicuba semula.',
  /** R1-B15: "Cuba Lagi" from an attempt that is not closed yet. */
  retryNotClosed: 'Hantar percubaan ini dahulu sebelum mencuba semula.',
} as const

/** Constants of the mock server and `photo-store.ts`, kept so the backend and the docs share them. */
export const BIJAK_ATTEMPTS_LIMITS = {
  /** After the deadline the server closes an unattended exam attempt itself (AC-05.4). */
  graceSeconds: 300,
  /** Late sync window after the deadline (AC-05.4). */
  lateSyncWindowMs: 24 * 60 * 60 * 1000,
  /** Latihan: at most this many answer-changing "Semak" per question per attempt (NFR-05). */
  maxChecksPerQuestion: 3,
  /** A sitting younger than this resumes silently (AC-12.5). */
  freshSeconds: 60,
  maxPhotoBytes: 5 * 1024 * 1024,
  maxPhotosPerPart: 3,
} as const

/** `exam` = timed sitting with the scheme after submit; `latihan` = untimed, "Semak" per question. */
export const BIJAK_ATTEMPT_MODES = ['exam', 'latihan'] as const
export const BijakAttemptModeSchema = z
  .enum(BIJAK_ATTEMPT_MODES)
  .meta({ id: 'BijakAttemptMode', description: 'exam = timed (deadline), latihan = untimed practice.' })
export type BijakAttemptMode = z.infer<typeof BijakAttemptModeSchema>

export const BIJAK_ATTEMPT_STATUSES = [
  'in_progress',
  'submitted',
  'auto_submitted',
  'abandoned',
] as const
export const BijakAttemptStatusSchema = z.enum(BIJAK_ATTEMPT_STATUSES).meta({
  id: 'BijakAttemptStatus',
  description:
    'in_progress = open; submitted = handed in by the student; auto_submitted = closed by the client at zero time or by the server sweeper after deadline + grace ("Dihantar automatik"); abandoned = discarded or replaced by a restart ("Ditinggalkan").',
})
export type BijakAttemptStatus = z.infer<typeof BijakAttemptStatusSchema>

const Kertas = z.number().int().min(1).meta({ description: 'Kertas number.', example: 2 })
const NonNegInt = z.number().int().min(0)

/* ----------------------------------------------------------------------------- answers (both ways) */

/** Metadata of one working photo, as kept in `PartAnswer.photos` and returned by the upload route. */
export const BijakAttemptPhotoSchema = z
  .strictObject({
    key: z.string().min(1).max(256).meta({
      description:
        'Opaque photo key issued by the upload route (the mock used a device-local IndexedDB key). The server only accepts keys it issued for this attempt and part.',
    }),
    name: z.string().min(1).meta({ description: 'Original file name.', example: 'jalan-kerja.jpg' }),
    size: z.number().int().min(0).max(BIJAK_ATTEMPTS_LIMITS.maxPhotoBytes).meta({ description: 'Bytes.' }),
  })
  .meta({ id: 'BijakAttemptPhoto' })
export type BijakAttemptPhoto = z.infer<typeof BijakAttemptPhotoSchema>

/**
 * What the student typed for one leaf part (`PartAnswer`). LaTeX is canonical; `plain` is the
 * derived plain-text form so marking and staff review can read either (AC-09.5). MCQ stores the
 * chosen option id in `choice`.
 */
export const BijakAttemptPartAnswerSchema = z
  .strictObject({
    choice: z.string().optional().meta({ description: 'MCQ option id, or a letter for match_letter.' }),
    steps: z.array(z.string()).optional().meta({ description: 'Working lines (LaTeX).' }),
    final: z.string().optional().meta({ description: 'Final answer (LaTeX).' }),
    unit: z.string().optional(),
    text: z.string().optional().meta({ description: 'Short text or essay.' }),
    photos: z.array(BijakAttemptPhotoSchema).optional(),
    plain: z
      .strictObject({ steps: z.array(z.string()), final: z.string() })
      .optional()
      .meta({ description: 'Plain-text forms of steps and final.' }),
  })
  .meta({ id: 'BijakAttemptPartAnswer' })
export type BijakAttemptPartAnswer = z.infer<typeof BijakAttemptPartAnswerSchema>

/** One saved part of an attempt (`StoredAnswer`). `savedAt` is capped at the server time of the write. */
export const BijakAttemptStoredAnswerSchema = z
  .strictObject({
    answer: BijakAttemptPartAnswerSchema,
    rev: NonNegInt.meta({
      description: 'Per-part revision: a save with a revision not above the stored one never overwrites.',
    }),
    savedAt: TimestampSchema,
  })
  .meta({ id: 'BijakAttemptStoredAnswer' })
export type BijakAttemptStoredAnswer = z.infer<typeof BijakAttemptStoredAnswerSchema>

const SavedAtInput = TimestampInputSchema.meta({
  description:
    'Device time of the last edit. Never trusted: the server stores min(savedAt, server now), and for a late sync a change counts only when that value is at or before the deadline.',
})

/** One autosave change (`SaveChange`). */
export const BijakAttemptSaveChangeSchema = z
  .strictObject({
    partId: IdSchema.meta({
      description:
        'Leaf part id (for an MCQ question the question id). A part that is not on the attempt, or is locked (latihan after the check cap), is ignored.',
    }),
    answer: BijakAttemptPartAnswerSchema,
    rev: NonNegInt,
    savedAt: SavedAtInput,
  })
  .meta({ id: 'BijakAttemptSaveChange' })
export type BijakAttemptSaveChange = z.infer<typeof BijakAttemptSaveChangeSchema>

const flagsShape = {
  flags: z.array(IdSchema).optional().meta({ description: 'Flagged question ids; replaces the stored list when present.' }),
  picks: z
    .record(z.string(), z.array(IdSchema))
    .optional()
    .meta({ description: 'Choose-N picks per section id (ticked question ids); replaces the stored map when present.' }),
  position: NonNegInt.optional().meta({ description: 'Last viewed question position; replaces the stored value when present.' }),
}

/** `PUT /bijak/attempts/{id}/answers` body and optional body of the check route (`SavePayload`). */
export const BijakAttemptSavePayloadSchema = z
  .strictObject({ changes: z.array(BijakAttemptSaveChangeSchema), ...flagsShape })
  .meta({ id: 'BijakAttemptSavePayload' })
export type BijakAttemptSavePayload = z.infer<typeof BijakAttemptSavePayloadSchema>

/** One entry of the device's full answer set carried by a submit. */
export const BijakAttemptCarriedAnswerSchema = z
  .strictObject({ answer: BijakAttemptPartAnswerSchema, rev: NonNegInt, savedAt: SavedAtInput })
  .meta({ id: 'BijakAttemptCarriedAnswer' })

/** `POST /bijak/attempts/{id}/submit` body (`SubmitPayload`). */
export const BijakAttemptSubmitPayloadSchema = z
  .strictObject({
    idempotencyKey: z.string().min(1).max(64).meta({
      description:
        'Client key of this submit; a replay with the same key returns the same result. The mock page sends "<attemptId>-hantar".',
      example: 'att-1-hantar',
    }),
    changes: z.array(BijakAttemptSaveChangeSchema),
    answers: z
      .record(z.string(), BijakAttemptCarriedAnswerSchema)
      .optional()
      .meta({
        description:
          'The device full answer set per part id (AC-13.2); merged with `changes`, and the server grades the union of what it saved and what the request carries.',
      }),
    auto: z.boolean().optional().meta({ description: 'True when the client submits at zero time (status auto_submitted).' }),
    ...flagsShape,
  })
  .meta({ id: 'BijakAttemptSubmitPayload' })
export type BijakAttemptSubmitPayload = z.infer<typeof BijakAttemptSubmitPayloadSchema>

/* ----------------------------------------------------------------------------- start and resume */

/** `POST /bijak/attempts` body. */
export const BijakAttemptStartRequestSchema = z
  .strictObject({
    paperId: IdSchema,
    mode: BijakAttemptModeSchema,
    restart: z.boolean().optional().meta({
      description:
        'True: every open attempt of the caller on this paper becomes abandoned and a new one starts (AC-12.2). Absent or false: the most recent open attempt is returned.',
    }),
  })
  .meta({ id: 'BijakAttemptStartRequest' })
export type BijakAttemptStartRequest = z.infer<typeof BijakAttemptStartRequestSchema>

/** `201` (new attempt) or `200` (the existing open attempt) result. */
export const BijakAttemptStartResultSchema = z
  .strictObject({ attemptId: IdSchema })
  .meta({ id: 'BijakAttemptStartResult' })
export type BijakAttemptStartResult = z.infer<typeof BijakAttemptStartResultSchema>

/** `InProgressInfo` of `findInProgress`. */
export const BijakAttemptInProgressSchema = z
  .strictObject({
    attemptId: IdSchema,
    title: z.string().min(1),
    mode: BijakAttemptModeSchema,
    elapsedSeconds: NonNegInt.meta({ description: 'Server now minus startedAt, in whole seconds.' }),
    fresh: z.boolean().meta({ description: 'elapsedSeconds <= 60: resume silently (AC-12.5).' }),
  })
  .meta({ id: 'BijakAttemptInProgress' })
export type BijakAttemptInProgress = z.infer<typeof BijakAttemptInProgressSchema>

/* ----------------------------------------------------------------------------- the served paper */

/** The attempt record without result and without the section snapshot (`Omit<Attempt, 'result' | 'sections'>`). */
export const BijakAttemptMetaSchema = z
  .strictObject({
    id: IdSchema,
    paperId: IdSchema,
    paperKind: BijakPaperKindSchema,
    title: z.string().min(1),
    subject: z.string().min(1).meta({ example: 'MAT' }),
    kertas: Kertas,
    code: z.string().min(1).meta({ example: '1449/2' }),
    mode: BijakAttemptModeSchema,
    status: BijakAttemptStatusSchema,
    startedAt: TimestampSchema.meta({ description: 'Server time of the start.' }),
    deadline: TimestampSchema.nullable().meta({
      description:
        'startedAt + durationMin, computed from the server clock at start (AC-05.1); null in latihan. The client clock never moves it.',
    }),
    durationMin: z.number().int().min(1),
    answers: z
      .record(z.string(), BijakAttemptStoredAnswerSchema)
      .meta({ description: 'The caller own saved answers per part id.' }),
    flags: z.array(IdSchema),
    picks: z.record(z.string(), z.array(IdSchema)),
    position: NonNegInt,
    checked: z.array(IdSchema).meta({ description: 'Latihan: question ids already checked with "Semak".' }),
    checkCounts: z
      .record(z.string(), NonNegInt)
      .optional()
      .meta({ description: 'Latihan: "Semak" count per question id, capped at 3.' }),
    submittedAt: TimestampSchema.optional(),
    lateBySeconds: NonNegInt.optional().meta({
      description: 'Seconds past the deadline at submit (a sweep close is capped at 300). Absent when on time.',
    }),
    idempotencyKey: z.string().optional(),
  })
  .meta({ id: 'BijakAttemptMeta' })
export type BijakAttemptMeta = z.infer<typeof BijakAttemptMetaSchema>

export const BijakAttemptSectionRuleSchema = z
  .discriminatedUnion('type', [
    z.strictObject({ type: z.literal('all') }),
    z.strictObject({ type: z.literal('choose'), n: z.number().int().min(1) }),
  ])
  .meta({ id: 'BijakAttemptSectionRule', description: 'all = answer every question; choose = answer n questions.' })
export type BijakAttemptSectionRule = z.infer<typeof BijakAttemptSectionRuleSchema>

/** `SectionView`: the frozen section snapshot plus printed and effective marks. */
export const BijakAttemptSectionSchema = z
  .strictObject({
    id: IdSchema,
    label: z.string().min(1).meta({ example: 'Bahagian C' }),
    compulsory: z.boolean().optional().meta({ description: '"Soalan ini mesti dijawab"; present only when true.' }),
    instruction: z.string().optional().meta({ description: 'Authored instruction; absent means derived from the rule.' }),
    rule: BijakAttemptSectionRuleSchema,
    questionIds: z.array(IdSchema).meta({ description: 'Question ids in the frozen order of this attempt.' }),
    marks: NonNegInt.meta({ description: 'Sum of the question marks.' }),
    effectiveMarks: NonNegInt.meta({ description: 'Marks after choose-N (the N largest).' }),
  })
  .meta({ id: 'BijakAttemptSection' })
export type BijakAttemptSection = z.infer<typeof BijakAttemptSectionSchema>

export const BIJAK_ATTEMPT_LEAF_KINDS = [
  'working',
  'numeric',
  'short_text',
  'match_letter',
  'essay',
  'drawing',
  'table_fill',
] as const
export const BijakAttemptLeafKindSchema = z.enum(BIJAK_ATTEMPT_LEAF_KINDS).meta({
  id: 'BijakAttemptLeafKind',
  description:
    'Answer mode of a leaf part (exam schema D2). A photo can only be attached to working or drawing.',
})
export type BijakAttemptLeafKind = z.infer<typeof BijakAttemptLeafKindSchema>

/** `PartView`: a part of a structured question; no marks scheme. Recursive through `children`. */
export const BijakAttemptPartViewSchema = z
  .strictObject({
    id: IdSchema,
    label: z.string().meta({ example: '(a)' }),
    prompt: z.string(),
    marks: NonNegInt.meta({ description: 'Marks of a leaf part; 0 on a part that only holds children.' }),
    answer: z
      .strictObject({
        kind: BijakAttemptLeafKindSchema,
        unit: z.string().optional(),
        wordRange: z.strictObject({ min: NonNegInt, max: NonNegInt }).optional(),
      })
      .optional()
      .meta({ description: 'Answer mode of a leaf; absent on a part that only holds children.' }),
    get children() {
      return z.array(BijakAttemptPartViewSchema).optional()
    },
  })
  .meta({ id: 'BijakAttemptPartView' })
export type BijakAttemptPartView = {
  id: string
  label: string
  prompt: string
  marks: number
  answer?: { kind: BijakAttemptLeafKind; unit?: string; wordRange?: { min: number; max: number } }
  children?: BijakAttemptPartView[]
}

/** An option of an MCQ question or of a shared lettered bank (`McqOption`); may contain `$latex$` spans. */
export const BijakAttemptOptionSchema = z
  .strictObject({ id: IdSchema, text: z.string() })
  .meta({ id: 'BijakAttemptOption' })
export type BijakAttemptOption = z.infer<typeof BijakAttemptOptionSchema>

/** `QuestionView`: a question as served; never carries a key, scheme or accepted value. */
export const BijakAttemptQuestionSchema = z
  .strictObject({
    id: IdSchema,
    number: z.number().int().min(1).meta({ description: 'Question number 1..n across the sections in order.' }),
    sectionId: IdSchema,
    topic: z.string().meta({ description: 'Display name of the curriculum unit.' }),
    formOrigin: z.enum(['T1-T3', 'T4', 'T5']),
    optionBank: z.array(BijakAttemptOptionSchema).optional().meta({
      description: 'Shared lettered bank of the question group (match_letter items).',
    }),
    groupId: IdSchema.optional(),
    stem: z.string(),
    marks: NonNegInt,
    mcq: z.strictObject({ options: z.array(BijakAttemptOptionSchema).min(2) }).optional(),
    parts: z.array(BijakAttemptPartViewSchema).optional(),
  })
  .meta({ id: 'BijakAttemptQuestion' })
export type BijakAttemptQuestion = z.infer<typeof BijakAttemptQuestionSchema>

/** A shared stimulus (Rajah, petikan or jadual) pinned while its group is answered (`StimulusDef`). */
export const BijakAttemptStimulusSchema = z
  .strictObject({
    id: IdSchema,
    kind: z.enum(['diagram', 'passage', 'table']),
    label: z.string().meta({ example: 'Rajah 2' }),
    caption: z.string().optional(),
    alt: z.string().meta({ description: 'Accessible description of the diagram.' }),
    svg: z.string().optional().meta({ description: 'Inline SVG markup (trusted, bundled).' }),
    text: z.string().optional(),
    table: z.strictObject({ head: z.array(z.string()), rows: z.array(z.array(z.string())) }).optional(),
  })
  .meta({ id: 'BijakAttemptStimulus' })
export type BijakAttemptStimulus = z.infer<typeof BijakAttemptStimulusSchema>

/** `GroupView`. */
export const BijakAttemptGroupSchema = z
  .strictObject({
    id: IdSchema,
    stimulus: BijakAttemptStimulusSchema,
    from: z.number().int().min(1).meta({ description: 'First question number covered.' }),
    to: z.number().int().min(1).meta({ description: 'Last question number covered.' }),
    questionIds: z.array(IdSchema),
  })
  .meta({ id: 'BijakAttemptGroup' })
export type BijakAttemptGroup = z.infer<typeof BijakAttemptGroupSchema>

/* ----------------------------------------------------------------------------- marking and results */

export const BIJAK_ATTEMPT_PART_STATUSES = [
  'betul',
  'separa',
  'salah',
  'kosong',
  'belum_dimarkah',
] as const
export const BijakAttemptPartStatusSchema = z.enum(BIJAK_ATTEMPT_PART_STATUSES).meta({
  id: 'BijakAttemptPartStatus',
  description:
    'betul = full marks, separa = partial, salah = wrong, kosong = blank, belum_dimarkah = waiting for a human (manual point, drawing).',
})
export type BijakAttemptPartStatus = z.infer<typeof BijakAttemptPartStatusSchema>

export const BIJAK_ATTEMPT_POINT_CODES = ['K', 'N', 'P', 'B', 'M', 'F', 'C'] as const

/** `PointResult`: one mark point of a part. */
export const BijakAttemptPointResultSchema = z
  .strictObject({
    id: IdSchema,
    code: z.enum(BIJAK_ATTEMPT_POINT_CODES),
    tag: z.string().min(1).meta({ description: 'Letter plus sequence in the part.', example: 'K1' }),
    manual: z.boolean().optional().meta({ description: 'A teacher still has to check this point.' }),
    label: z.string(),
    marks: NonNegInt,
    awarded: NonNegInt,
    hit: z.boolean(),
    reason: z.string(),
  })
  .meta({ id: 'BijakAttemptPointResult' })
export type BijakAttemptPointResult = z.infer<typeof BijakAttemptPointResultSchema>

/** One band of a rubric scheme. */
export const BijakAttemptRubricBandSchema = z
  .strictObject({
    name: z.string(),
    range: z.tuple([NonNegInt, NonNegInt]).meta({ description: 'Inclusive [from, to] marks.' }),
    descriptor: z.string(),
  })
  .meta({ id: 'BijakAttemptRubricBand' })

/**
 * `SchemeReveal`: the revealed mark scheme of one part. Only ever returned inside a graded result:
 * after submit, or per question after "Semak" in latihan.
 */
export const BijakAttemptSchemeSchema = z
  .strictObject({
    marks: NonNegInt,
    correctOption: z.string().optional().meta({ description: 'MCQ: the correct option id.' }),
    correctLetter: z.string().optional().meta({ description: 'match_letter: the correct letter.' }),
    acceptedText: z.array(z.string()).optional().meta({ description: 'accepted: the accepted answers as text.' }),
    rubric: z
      .strictObject({
        criteria: z.array(z.string()),
        bands: z.array(BijakAttemptRubricBandSchema),
        notes: z.array(z.string()).optional(),
      })
      .optional(),
    explanation: z.string().optional(),
    finalDisplay: z.string().optional().meta({ description: 'LaTeX of the model final answer.' }),
    unit: z.string().optional(),
    model: z.string().optional(),
  })
  .meta({ id: 'BijakAttemptScheme' })
export type BijakAttemptScheme = z.infer<typeof BijakAttemptSchemeSchema>

/**
 * R1-B13: keyword suggestion for a mark-scheme-points part that waits for a person (V2
 * `RubricKeywordMarker`). A SUGGESTION only: it is never added to `awarded` or to the score; the pupil
 * confirms it with a self-mark. Absent for band_rubric parts and for automatically marked parts.
 */
export const BijakAttemptSuggestionSchema = z
  .strictObject({
    suggestedMark: NonNegInt.meta({
      description: 'Sum of the matched points marks (proportional share when the points carry no marks), 0..part marks.',
    }),
    matched: NonNegInt.meta({ description: 'Points whose keywords were found in the answer ("{x}/{y} isi dikesan").' }),
    total: NonNegInt,
    points: z.array(z.strictObject({ id: IdSchema, label: z.string(), marks: NonNegInt, matched: z.boolean() })),
  })
  .meta({ id: 'BijakAttemptSuggestion' })
export type BijakAttemptSuggestion = z.infer<typeof BijakAttemptSuggestionSchema>

/** `PartResult`: marking of one leaf part with its revealed scheme. */
export const BijakAttemptPartResultSchema = z
  .strictObject({
    partId: IdSchema,
    label: z.string(),
    prompt: z.string(),
    marks: NonNegInt,
    awarded: NonNegInt,
    status: BijakAttemptPartStatusSchema,
    confidence: z.enum(['high', 'low']),
    points: z.array(BijakAttemptPointResultSchema),
    ecf: z.string().optional().meta({ description: 'Set when an own-figure-carried-forward mark was given.' }),
    selfMarked: z.literal(true).optional().meta({
      description: 'R1-B12: `awarded` is the pupil own mark (Markah kendiri). Absent for an automatic mark.',
    }),
    band: z.string().optional().meta({ description: 'R1-B12: the rubric band the pupil chose with the self-mark.' }),
    selfMarkable: z.literal(true).optional().meta({
      description: 'R1-B12: the pupil may set a self-mark on this part (scheme kind points or rubric).',
    }),
    suggestion: BijakAttemptSuggestionSchema.optional(),
    answer: BijakAttemptPartAnswerSchema,
    scheme: BijakAttemptSchemeSchema,
  })
  .meta({ id: 'BijakAttemptPartResult' })
export type BijakAttemptPartResult = z.infer<typeof BijakAttemptPartResultSchema>

/** `QuestionResult`: a graded question (the result of a "Semak" check, or one row of the final result). */
export const BijakAttemptQuestionResultSchema = z
  .strictObject({
    questionId: IdSchema,
    number: z.number().int().min(1),
    sectionId: IdSchema,
    marks: NonNegInt,
    awarded: NonNegInt,
    counted: z.boolean().meta({ description: 'False when a choose-N section dropped this question from the total.' }),
    attempted: z.boolean(),
    parts: z.array(BijakAttemptPartResultSchema),
  })
  .meta({ id: 'BijakAttemptQuestionResult' })
export type BijakAttemptQuestionResult = z.infer<typeof BijakAttemptQuestionResultSchema>

/** `SectionResult`. */
export const BijakAttemptSectionResultSchema = z
  .strictObject({
    sectionId: IdSchema,
    label: z.string(),
    marks: NonNegInt.meta({ description: 'Effective marks after choose-N.' }),
    awarded: NonNegInt,
    chooseN: z.number().int().min(1).optional(),
    counted: z.array(IdSchema).meta({ description: 'Question ids that count toward the section.' }),
  })
  .meta({ id: 'BijakAttemptSectionResult' })
export type BijakAttemptSectionResult = z.infer<typeof BijakAttemptSectionResultSchema>

/** `AttemptResult`: the stored result of a closed attempt. */
export const BijakAttemptResultSchema = z
  .strictObject({
    score: NonNegInt,
    max: NonNegInt,
    percent: z.number().min(0).meta({ description: 'score / max in percent, one decimal place; 0 when max is 0.' }),
    provisional: z.boolean().meta({ description: 'True while any part waits for a human (the total is provisional).' }),
    pendingReview: NonNegInt,
    sections: z.array(BijakAttemptSectionResultSchema),
    questions: z.array(BijakAttemptQuestionResultSchema),
    coins: NonNegInt.meta({
      description: 'Display value score * 2 of the mock. The mock does not credit the wallet (open question 2).',
    }),
    points: NonNegInt.meta({
      description: 'Display value score * 10 of the mock. The mock does not credit the wallet (open question 2).',
    }),
  })
  .meta({ id: 'BijakAttemptResult' })
export type BijakAttemptResult = z.infer<typeof BijakAttemptResultSchema>

/* ----------------------------------------------------------------------------- route payloads */

/** R1-B12 `POST /bijak/attempts/{id}/self-mark` body. */
export const BijakAttemptSelfMarkRequestSchema = z
  .strictObject({
    partId: IdSchema.meta({ description: 'A selfMarkable leaf part of the attempt (scheme kind points or rubric).' }),
    mark: z.number().int().safe().meta({
      description: 'Markah kendiri. The server clamps it to 0..part marks (and to the band range when `band` is sent).',
      example: 2,
    }),
    band: z.string().min(1).max(100).optional().meta({
      description: 'Rubric parts only: the band name the pupil chose; the mark is then kept inside that band range.',
    }),
  })
  .meta({ id: 'BijakAttemptSelfMarkRequest' })
export type BijakAttemptSelfMarkRequest = z.infer<typeof BijakAttemptSelfMarkRequestSchema>

/** R1-B12 result: the clamped mark and the recomputed totals (best-N applied). */
export const BijakAttemptSelfMarkResultSchema = z
  .strictObject({
    partId: IdSchema,
    awarded: NonNegInt.meta({ description: 'The stored (clamped) self-mark.' }),
    max: NonNegInt.meta({ description: 'Marks of the part.' }),
    band: z.string().optional(),
    status: BijakAttemptPartStatusSchema,
    attemptScore: NonNegInt.meta({ description: 'Recomputed attempt score.' }),
    attemptMax: NonNegInt,
    provisional: z.boolean(),
    pendingReview: NonNegInt,
    result: BijakAttemptResultSchema.meta({ description: 'The recomputed result, the same shape as GET /result.' }),
  })
  .meta({ id: 'BijakAttemptSelfMarkResult' })
export type BijakAttemptSelfMarkResult = z.infer<typeof BijakAttemptSelfMarkResultSchema>

/** R1-B15 `GET /bijak/papers/{paperId}/attempts` ("Lihat semakan lepas"): one past closed sitting. */
export const BijakAttemptPastSittingSchema = z
  .strictObject({
    attemptId: IdSchema,
    mode: BijakAttemptModeSchema,
    status: z.enum(['submitted', 'auto_submitted']),
    startedAt: TimestampSchema,
    submittedAt: TimestampSchema,
    score: NonNegInt,
    max: NonNegInt,
    provisional: z.boolean(),
  })
  .meta({ id: 'BijakAttemptPastSitting' })
export type BijakAttemptPastSitting = z.infer<typeof BijakAttemptPastSittingSchema>

export const BijakAttemptPastSittingsSchema = z
  .strictObject({
    lastSubmittedAttemptId: IdSchema.nullable().meta({
      description: 'The latest closed sitting (target of "Lihat semakan lepas"); null when there is none.',
    }),
    sittings: z.array(BijakAttemptPastSittingSchema).meta({ description: 'The caller closed sittings of this paper, newest first (at most 20).' }),
  })
  .meta({ id: 'BijakAttemptPastSittings' })
export type BijakAttemptPastSittings = z.infer<typeof BijakAttemptPastSittingsSchema>

/**
 * `AttemptPaperView`: the paper as served to an attempt with the saved-answers state. No answer
 * keys and no schemes, except inside `checks` (latihan: questions already checked with "Semak").
 */
export const BijakAttemptPaperViewSchema = z
  .strictObject({
    serverNow: TimestampSchema.meta({
      description:
        'Server clock at the time of the response, so the UI can correct the offset of the exam countdown (AC-05.1).',
    }),
    attempt: BijakAttemptMetaSchema,
    sections: z.array(BijakAttemptSectionSchema).min(1),
    questions: z.array(BijakAttemptQuestionSchema),
    groups: z.array(BijakAttemptGroupSchema),
    checks: z.array(BijakAttemptQuestionResultSchema).meta({
      description:
        'Latihan, in progress: the per-question results (scheme revealed) of the questions already checked. Always empty in exam mode and for a closed attempt.',
    }),
  })
  .meta({ id: 'BijakAttemptPaperView' })
export type BijakAttemptPaperView = z.infer<typeof BijakAttemptPaperViewSchema>

/** `PUT /answers` result (`SaveResult`). */
export const BijakAttemptSaveResultSchema = z
  .strictObject({
    savedAt: TimestampSchema.meta({ description: 'Server time of the save.' }),
    closed: z.literal(true).optional().meta({
      description: 'The attempt is already closed; the device keeps its local copy and nothing was stored (unless regraded).',
    }),
    regraded: z.literal(true).optional().meta({
      description: 'Late-synced changes (savedAt at or before the deadline, within 24 h) were accepted and the attempt was graded again.',
    }),
  })
  .meta({ id: 'BijakAttemptSaveResult' })
export type BijakAttemptSaveResult = z.infer<typeof BijakAttemptSaveResultSchema>

/** `POST /submit` result (`SubmitResult`). */
export const BijakAttemptSubmitResultSchema = z
  .strictObject({
    attemptId: IdSchema,
    late: NonNegInt.meta({ description: 'Seconds past the deadline; 0 when none; a sweep close is capped at 300.' }),
    closed: z.literal(true).optional().meta({
      description: 'The attempt was already closed (a replay or a later submit); the stored result is not recomputed.',
    }),
    regraded: z.literal(true).optional(),
  })
  .meta({ id: 'BijakAttemptSubmitResult' })
export type BijakAttemptSubmitResult = z.infer<typeof BijakAttemptSubmitResultSchema>

/** `ResultView`: the result page after submit, with the paper (checks always empty). */
export const BijakAttemptResultViewSchema = z
  .strictObject({
    attempt: BijakAttemptMetaSchema,
    result: BijakAttemptResultSchema,
    paper: BijakAttemptPaperViewSchema,
  })
  .meta({ id: 'BijakAttemptResultView' })
export type BijakAttemptResultView = z.infer<typeof BijakAttemptResultViewSchema>

/** `HistoryRow`: one of the caller attempts, newest first. */
export const BijakAttemptHistoryRowSchema = z
  .strictObject({
    attemptId: IdSchema,
    title: z.string().min(1),
    subject: z.string().min(1),
    subjectName: z.string().min(1),
    kertas: Kertas,
    kind: BijakPaperKindSchema,
    mode: BijakAttemptModeSchema,
    status: BijakAttemptStatusSchema,
    startedAt: TimestampSchema,
    durationSeconds: NonNegInt.meta({
      description: 'max(0, round((submittedAt ?? server now) - startedAt)) in seconds.',
    }),
    score: NonNegInt.optional().meta({ description: 'Present when the attempt has a result.' }),
    max: NonNegInt.optional(),
  })
  .meta({ id: 'BijakAttemptHistoryRow' })
export type BijakAttemptHistoryRow = z.infer<typeof BijakAttemptHistoryRowSchema>

/** 409 NOT_SUBMITTED of `GET /result`. */
export const BijakAttemptNotSubmittedErrorSchema = z
  .object({
    error: z.object({
      code: z.literal('NOT_SUBMITTED'),
      message: z.literal(BIJAK_ATTEMPTS_MESSAGES.schemeAfterSubmit),
      requestId: z.string().optional(),
    }),
  })
  .meta({ id: 'BijakAttemptNotSubmittedError' })

/** MIME types accepted for a working photo. */
export const BIJAK_ATTEMPT_PHOTO_MIMES = ['image/jpeg', 'image/png'] as const

/**
 * Multipart body of `POST /bijak/attempts/{id}/photos`: `partId` and the `file` part (JPEG or PNG,
 * at most 5 MB). Storage is the BE-04 files service (`purpose = bijak_photo`).
 */
export const BijakAttemptPhotoUploadSchema = z
  .object({
    partId: IdSchema.meta({ description: 'A part of the attempt that accepts working or drawing.' }),
    file: z
      .custom<Blob>((value) => {
        if (!(value instanceof Blob)) return false
        if (value.size > BIJAK_ATTEMPTS_LIMITS.maxPhotoBytes) return false
        return (BIJAK_ATTEMPT_PHOTO_MIMES as readonly string[]).includes(value.type)
      })
      .meta({
        type: 'string',
        format: 'binary',
        description: 'JPEG or PNG, up to 5 MB (MAX_PHOTO_BYTES).',
      }),
  })
  .meta({ id: 'BijakAttemptPhotoUpload' })
