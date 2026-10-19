import { z } from '../../zod'
import { IdSchema } from '../../common/ids'
import { DateOnlySchema, TimestampSchema } from '../../common/time'

/**
 * M12 Kirkpatrick read models, intervention log and monthly feedback (BE-20). The frontend mock
 * (`src/modules/m12-kirkpatrick`) is the wire spec. Ids are opaque strings (`Id`, the mock sends
 * numbers); timestamps are `Timestamp` (+08:00); day keys are `DateOnly`; percentages are numbers
 * rounded half-up to one decimal; `null` means "no data". Figures are computed from tables
 * (`kirkpatrick_school_scores` is not persisted: working assumption of the card).
 *
 * Access (role access matrix row 11, catalogue M12-01..14):
 * - Every level, `filter-options`, export-pdf and the pupil view: admin (all schools), teacher and
 *   school_admin (both forced to the own school from the session, whatever `schoolId` or `state` the
 *   request carries; a caller without a school gets the empty view). Every other role gets 403. This
 *   follows the role access matrix (row 11, D-RAM-4) and the LEAD decisions, not the mock (the mock
 *   gives a teacher all schools and refuses school_admin on levels 2 to 6, interventions and the pupil
 *   view). Reaction and chain are platform-wide in the mock; for teacher and school_admin they are
 *   computed over the own school.
 * - Interventions (GET and POST): admin all; school_admin the own school; teacher the pupils of the
 *   own classes. Anything else is out of scope (see the path descriptions).
 * - `me`, `feedback/status`, `feedback`: any signed-in role, own data only.
 * - Intervention notes are sensitive personal data of minors: never logged; staff roles only.
 *   Wellbeing, psychometric and faith data are not modelled (v2-data-migration Q7).
 */

const count = z.number().int()
const pct = z.number()

export const KIRKPATRICK_ERROR_MESSAGES = {
  unauthorized: 'Unauthenticated.',
  forbidden: 'This action is unauthorized.',
  notFound: 'Not Found.',
} as const

/** Exact 422 / 409 copy of the mock. */
export const KIRKPATRICK_MESSAGES = {
  required: 'Medan ini diperlukan.',
  invalid: 'Medan ini tidak sah.',
  studentNotFound: 'Pelajar tidak dijumpai.',
  invalidDate: 'Tarikh tidak sah.',
  feedbackConflict: 'Anda sudah mengisi maklum balas untuk bulan ini.',
} as const
const M = KIRKPATRICK_MESSAGES

/** Missing, null or '' is "required"; every other bad value is "invalid" (mock `blank` rule). */
const requiredOrInvalid = (iss: { input?: unknown }) =>
  iss.input === undefined || iss.input === null || iss.input === '' ? M.required : M.invalid

// --- Enums -----------------------------------------------------------------------------------

export const KIRKPATRICK_BANDS = ['champion', 'konsisten', 'berkembang', 'minimum', 'tidakTerlibat'] as const
export const KirkpatrickBandKeySchema = z.enum(KIRKPATRICK_BANDS).meta({
  id: 'KirkpatrickBandKey',
  description: 'By answers: >= 50 champion, 20-49 konsisten, 5-19 berkembang, 1-4 minimum, 0 tidakTerlibat.',
})
export const KIRKPATRICK_GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G'] as const
export const KirkpatrickGradeSchema = z.enum(KIRKPATRICK_GRADES).meta({ id: 'KirkpatrickGrade' })
export const KIRKPATRICK_ALERT_TYPES = ['mood', 'inactive', 'declining'] as const
export const KirkpatrickAlertTypeSchema = z.enum(KIRKPATRICK_ALERT_TYPES).meta({ id: 'KirkpatrickAlertType' })
export const KIRKPATRICK_MOODS = ['happy', 'okay', 'sad', 'stressed'] as const
export const KirkpatrickMoodSchema = z.enum(KIRKPATRICK_MOODS).meta({ id: 'KirkpatrickMood' })
export const KirkpatrickInterventionStatusSchema = z
  .enum(['Menunggu Semakan', 'Meningkat', 'Menurun'])
  .meta({ id: 'KirkpatrickInterventionStatus', description: 'Derived on read, never stored. null when before is missing or equal.' })

// --- Queries ----------------------------------------------------------------------------------

const schoolIdQuery = z
  .string()
  .trim()
  .refine((v) => v === '' || (/^\d+$/.test(v) && Number.isSafeInteger(Number(v))), { error: M.invalid })
  .optional()
  .meta({ description: "School id; '' means all schools. A malformed value gives 422 fields.schoolId; an unknown school gives the zero state (empty lists, zero counts)." })

export const KirkpatrickSchoolQuerySchema = z.object({ schoolId: schoolIdQuery }).meta({ id: 'KirkpatrickSchoolQuery' })
export const KirkpatrickScopeQuerySchema = z
  .object({
    schoolId: schoolIdQuery,
    state: z.string().optional().meta({ description: 'Exact state name (overview only); an unknown state gives the zero state.' }),
  })
  .meta({ id: 'KirkpatrickScopeQuery' })

// --- Level read models --------------------------------------------------------------------------

export const KirkpatrickBandCountSchema = z
  .object({ key: KirkpatrickBandKeySchema, count, pct })
  .meta({ id: 'KirkpatrickBandCount' })

const comparisonPanel = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  from: DateOnlySchema,
  to: DateOnlySchema,
  active: count,
  accuracy: pct,
  answers: count,
  champions: count,
})

export const KirkpatrickOverviewSchema = z
  .object({
    scope: z.object({ schoolId: IdSchema.nullable(), state: z.string().nullable() }),
    t4: z.object({ gps: z.number().nullable(), gpsYear: count.nullable(), recordsLabel: count }),
    t3: z.object({ active: count, t4t5: count, sessions: count, accuracy: pct }),
    t2: z.object({ accuracy: pct, answers: count }),
    t1: z.object({ satisfaction: z.number(), responses: count }),
    comparison: z.object({
      subtitle: z.string(),
      before: comparisonPanel.nullable(),
      after: comparisonPanel.nullable(),
      delta: z.object({ active: z.number(), accuracy: z.number(), answers: z.number(), champions: z.number() }).nullable(),
      sentences: z.array(z.string()),
    }),
    kpi: z.object({ t4t5: count, answers: count, teachersLoggedIn: count, teachers: count, accuracy: pct }),
    bands: z.array(KirkpatrickBandCountSchema),
  })
  .meta({ id: 'KirkpatrickOverview' })

export const KirkpatrickReactionSchema = z
  .object({ npsStudent: z.number(), npsTeacher: z.number(), npsAdmin: z.number(), satisfaction: z.number() })
  .meta({ id: 'KirkpatrickReaction', description: 'Means over all feedback responses; global, ignores the scope.' })

export const KirkpatrickLearningSchema = z
  .object({
    kpi: z.object({ answers: count, accuracy: pct, avgScore: z.number(), sessionsCompleted: count, sessions: count, completionPct: pct }),
    subjects: z.array(z.object({ subjectId: IdSchema, name: z.string(), answers: count, accuracy: pct, status: z.enum(['Mastered', 'Developing', 'Beginning']) })),
    schools: z.array(z.object({ schoolId: IdSchema, name: z.string(), students: count, answers: count, accuracy: pct, avgScore: z.number(), subjects: count })),
  })
  .meta({ id: 'KirkpatrickLearning' })

export const KirkpatrickBehaviorSchema = z
  .object({
    kpi: z.object({ t4t5: count, active: count, sessions: count, answers: count, accuracy: pct, teacherPct: pct, teachersLoggedIn: count, teachers: count }),
    bands: z.array(KirkpatrickBandCountSchema),
    schools: z.array(
      z.object({
        schoolId: IdSchema,
        name: z.string(),
        code: z.string().nullable(),
        students: count,
        active: count,
        answers: count,
        sessions: count,
        perActive: z.number(),
        score: z.number(),
        tahap: KirkpatrickBandKeySchema,
      }),
    ),
    heat: z.object({ max: count, cells: z.array(z.array(count)) }).meta({ description: '7 rows (Isnin to Ahad) of 18 cells (06:00 to 23:00).' }),
    alerts: z.array(
      z.object({
        list: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        schoolId: IdSchema,
        name: z.string(),
        kind: z.enum(['never', 'teacher', 'good']),
        n: count.optional(),
        pct: pct.optional(),
      }),
    ),
    moodCount: count.meta({ description: 'Always 0 (the mood store is not built; wellbeing data is not modelled).' }),
  })
  .meta({ id: 'KirkpatrickBehavior' })

export const KirkpatrickAlesaRowSchema = z.object({
  userId: IdSchema,
  name: z.string(),
  schoolName: z.string(),
  accuracy: pct,
  grade: KirkpatrickGradeSchema,
  confidence: z.enum(['rendah', 'sederhana', 'tinggi']),
  cadanganBand: z.enum(['A', 'B', 'C', 'D/E']),
  observed: z.boolean(),
})

export const KirkpatrickResultsSchema = z
  .object({
    kpi: z.object({
      gps: z.number().nullable(),
      gpsYear: count.nullable(),
      recordsLabel: count,
      passPct: pct.nullable(),
      pass: count.nullable(),
      candidates: count,
      gradeA: count.nullable(),
      gradeAPct: pct.nullable(),
      accuracy: pct,
      answers: count,
      active: count,
      activePct: pct,
      t4t5: count,
      records: count,
    }),
    distribution: z.object({ year: count, candidates: count, rows: z.array(z.object({ grade: KirkpatrickGradeSchema, n: count, pct })) }).nullable(),
    subjectGps: z.object({
      year: count,
      rows: z.array(z.object({ name: z.string(), gps: z.number(), grade: KirkpatrickGradeSchema, candidates: count, prev: z.number().nullable() })),
    }),
    trend: z.object({ years: z.array(count), rows: z.array(z.object({ name: z.string(), values: z.array(z.number().nullable()) })) }),
    schools: z.array(
      z.object({
        schoolId: IdSchema,
        name: z.string(),
        students: count,
        active: count,
        accuracy: pct.nullable(),
        answers: count.nullable(),
        engagement: z.number().nullable(),
        tahap: KirkpatrickBandKeySchema,
        faded: z.boolean(),
      }),
    ),
    predictions: z.array(z.object({ userId: IdSchema, name: z.string(), schoolId: IdSchema, schoolName: z.string(), answers: count, accuracy: pct, grade: KirkpatrickGradeSchema })),
    alesa: z.object({ lulus: count, gagal: count, intervensi: count, rows: z.array(KirkpatrickAlesaRowSchema) }),
    roi: z.object({ active: count, perStudent: z.number(), accuracy: pct, gps: z.number().nullable() }),
    insights: z.object({ active: count, t4t5: count, pct, accuracy: pct, grade: KirkpatrickGradeSchema, year: count.nullable(), gps: z.number().nullable() }),
  })
  .meta({
    id: 'KirkpatrickResults',
    description: 'One response holds every prediction row (about 946 in the mock); pagination is an open question. ALESA prediction rows (M13 AI) are served from the mock store until the AI adapter exists.',
  })

export const KirkpatrickChainSchema = z
  .object({
    t1: z.object({ nps: z.number(), satisfaction: z.number(), responses: count }),
    t2: z.object({ accuracy: pct, answers: count, avgScore: z.number() }),
    t3: z.object({ active: count, t4t5: count, pct, sessions: count, bands: z.array(KirkpatrickBandCountSchema) }),
    t4: z.object({ gps: z.number().nullable(), r: z.number(), strength: z.enum(['Lemah', 'Sederhana', 'Kuat']) }),
    correlation: z.object({ bands: z.array(z.object({ label: z.string(), n: count, acc: pct })), r: z.number() }),
  })
  .meta({ id: 'KirkpatrickChain', description: 'Platform-wide, ignores the scope. The correlation r and bands are documented constants in the mock (OQ-API-B3-8).' })

export const KirkpatrickFilterOptionsSchema = z
  .object({ schools: z.array(z.object({ id: IdSchema, name: z.string() })), states: z.array(z.string()) })
  .meta({ id: 'KirkpatrickFilterOptions' })

// --- Pupil views ---------------------------------------------------------------------------------

const headcount = z.object({ year: count, rows: z.array(z.object({ subjectName: z.string(), tov: z.number().nullable() })) })

export const KirkpatrickStudentSchema = z
  .object({
    student: z.object({ id: IdSchema, name: z.string(), schoolName: z.string(), grade: count.nullable() }),
    activeDays: count,
    answers: count,
    accuracy: pct,
    konsistensi: z.number(),
    streak: count,
    strongest: z.object({ subjectName: z.string(), accuracy: pct }).nullable(),
    weakest: z.object({ subjectName: z.string(), accuracy: pct }).nullable(),
    headcount,
    platform: z.array(z.object({ subjectName: z.string(), accuracy: pct, answers: count })),
  })
  .meta({ id: 'KirkpatrickStudent' })

export const KirkpatrickMeSchema = z
  .object({
    headcount: headcount.nullable().meta({ description: 'null when the viewer has no headcount TOV in the current year.' }),
    days: z.array(z.object({ date: z.string(), answers: count })).meta({ description: '30 days ending today; date is dd/mm.' }),
  })
  .meta({ id: 'KirkpatrickMe' })

// --- Interventions (sensitive: staff only, never logged) ---------------------------------------------

export const KirkpatrickInterventionRowSchema = z
  .object({
    id: IdSchema,
    studentId: IdSchema,
    alertType: KirkpatrickAlertTypeSchema,
    actionDate: DateOnlySchema,
    alertDescription: z.string(),
    actionTaken: z.string(),
    beforeAccuracy: z.number().nullable(),
    afterAccuracy: z.number().nullable(),
    beforeMood: KirkpatrickMoodSchema.nullable(),
    afterMood: KirkpatrickMoodSchema.nullable(),
    createdBy: IdSchema,
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    status: KirkpatrickInterventionStatusSchema.nullable(),
    studentName: z.string().nullable(),
  })
  .meta({ id: 'KirkpatrickInterventionRow' })

export const KirkpatrickInterventionListSchema = z
  .object({
    kpi: z.object({ total: count, pending: count, up: count, down: count }),
    rows: z.array(KirkpatrickInterventionRowSchema).meta({ description: 'Newest first (createdAt, then id, descending).' }),
  })
  .meta({ id: 'KirkpatrickInterventionList' })

const accuracyInput = z
  .union([z.number(), z.literal(''), z.string().regex(/^\s*-?\d+(\.\d+)?\s*$/, { error: M.invalid })], { error: M.invalid })
  .nullish()
  .refine((v) => v === null || v === undefined || v === '' || (Number(typeof v === 'string' ? v.trim() : v) >= 0 && Number(typeof v === 'string' ? v.trim() : v) <= 100), { error: M.invalid })
  .meta({ description: "0 to 100 as a number or numeric text; null or '' means not set. Stored with one decimal." })
const moodInput = z
  .union([KirkpatrickMoodSchema, z.literal('')], { error: M.invalid })
  .nullish()
  .meta({ description: "null or '' means not set." })
const longText = z
  .string({ error: requiredOrInvalid })
  .trim()
  .min(1, M.required)
  .max(2000, M.invalid)

const interventionBody = z
  .object({
    studentId: z
      .union([z.string().refine((v) => v.trim() !== '', { error: requiredOrInvalid }), z.number().int()], { error: requiredOrInvalid })
      .meta({ description: 'Id of a user with role student; otherwise 422 fields.studentId "Pelajar tidak dijumpai." (KirkpatrickInterventionRefusalSchema). A number is accepted as the mock does.' }),
    alertType: z.enum(KIRKPATRICK_ALERT_TYPES, { error: requiredOrInvalid }),
    actionDate: z
      .string({ error: requiredOrInvalid })
      .min(1, M.required)
      .meta({ description: 'YYYY-MM-DD. A string that is not a valid calendar day gives 422 fields.actionDate "Tarikh tidak sah." after the student check (service rule; see kirkpatrickIsCalendarDay).' }),
    alertDescription: longText.meta({ description: 'Trimmed, 1 to 2000 characters.' }),
    actionTaken: longText.meta({ description: 'Trimmed, 1 to 2000 characters.' }),
    beforeAccuracy: accuracyInput.optional(),
    afterAccuracy: accuracyInput.optional(),
    beforeMood: moodInput.optional(),
    afterMood: moodInput.optional(),
  })

/** The mock's legacy form names, mapped to the camelCase fields before parsing. */
export const KIRKPATRICK_INTERVENTION_ALIASES = {
  student_id: 'studentId',
  alert_type: 'alertType',
  action_date: 'actionDate',
  alert_description: 'alertDescription',
  action_taken: 'actionTaken',
  before_accuracy: 'beforeAccuracy',
  after_accuracy: 'afterAccuracy',
  before_mood: 'beforeMood',
  after_mood: 'afterMood',
} as const

/** Mock precedence (its pick helper): the camelCase key wins when it is present, even with a null value. */
function kirkpatrickAliasKeys(input: unknown): unknown {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return input
  const out: Record<string, unknown> = { ...(input as Record<string, unknown>) }
  for (const [snake, camel] of Object.entries(KIRKPATRICK_INTERVENTION_ALIASES)) {
    if (!(camel in out) && snake in out) out[camel] = out[snake]
  }
  return out
}

export const KirkpatrickInterventionCreateRequestSchema = z
  .preprocess(kirkpatrickAliasKeys, interventionBody)
  .meta({
    id: 'KirkpatrickInterventionCreateRequest',
    description: 'camelCase fields. The legacy snake_case form names of the mock (student_id, alert_type, action_date, alert_description, action_taken, before_accuracy, after_accuracy, before_mood, after_mood) are accepted too and mapped before validation; if both forms are sent the camelCase one wins (mock precedence). 422 fields are always keyed camelCase. createdBy comes from the session, never from the body. Unknown keys are ignored.',
  })

/** Service rule behind `KirkpatrickInterventionCreateRequest.actionDate`: a real calendar day, YYYY-MM-DD. */
export function kirkpatrickIsCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

const validationBody = <F extends string>(field: F, message: string) =>
  z.object({
    error: z.object({
      code: z.literal('VALIDATION_ERROR'),
      message: z.literal(message),
      fields: z.object({ [field]: z.literal(message) } as Record<F, z.ZodLiteral<string>>),
    }),
  })

/** State-dependent 422 refusals of POST /kirkpatrick/interventions (code, message and field pinned). */
export const KirkpatrickInterventionStudentNotFoundSchema = validationBody('studentId', M.studentNotFound).meta({ id: 'KirkpatrickInterventionStudentNotFound' })
export const KirkpatrickInterventionInvalidDateSchema = validationBody('actionDate', M.invalidDate).meta({ id: 'KirkpatrickInterventionInvalidDate' })
export const KirkpatrickInterventionRefusalSchema = z
  .union([KirkpatrickInterventionStudentNotFoundSchema, KirkpatrickInterventionInvalidDateSchema])
  .meta({ id: 'KirkpatrickInterventionRefusal' })

// --- Feedback (monthly NPS and satisfaction; any signed-in role) -------------------------------------------

export const KirkpatrickFeedbackStatusSchema = z
  .object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), answered: z.boolean() })
  .meta({ id: 'KirkpatrickFeedbackStatus', description: 'Calendar month in Malaysia time; one response per user per month.' })

const wholeInput = (min: number, max: number, what: string) =>
  z
    .union([z.number().int(), z.string().regex(/^\s*-?\d+\s*$/, { error: requiredOrInvalid })], { error: requiredOrInvalid })
    .refine((v) => {
      const n = typeof v === 'string' ? Number(v.trim()) : v
      return n >= min && n <= max
    }, { error: M.invalid })
    .meta({ description: `Whole number ${String(min)} to ${String(max)} (${what}); numeric text is accepted.` })

export const KirkpatrickFeedbackRequestSchema = z
  .object({ nps: wholeInput(0, 10, 'NPS'), satisfaction: wholeInput(1, 5, 'satisfaction') })
  .meta({ id: 'KirkpatrickFeedbackRequest', description: 'The responder role and school come from the session, never from the body. Unknown keys are ignored.' })

export const KirkpatrickFeedbackResponseSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    role: z.string(),
    schoolId: IdSchema.nullable().meta({ description: 'The respondent school at response time.' }),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    nps: count,
    satisfaction: count,
    createdAt: TimestampSchema,
  })
  .meta({ id: 'KirkpatrickFeedbackResponse' })

/** 409 of a second response in the month. */
export const KirkpatrickFeedbackConflictSchema = z
  .object({ error: z.object({ code: z.literal('CONFLICT'), message: z.literal(M.feedbackConflict) }) })
  .meta({ id: 'KirkpatrickFeedbackConflict' })

/** Mock PDF layout contract: file name and content type of GET /kirkpatrick/export-pdf. */
export const KIRKPATRICK_PDF = { filename: 'laporan-kirkpatrick.pdf', contentType: 'application/pdf', title: 'Model Kirkpatrick - Rantaian Impak' } as const
