import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../../zod'
import { envelopeOf } from '../../common/envelope'
import { ErrorBodySchema } from '../../common/error'
import { IdSchema } from '../../common/ids'
import {
  KIRKPATRICK_ERROR_MESSAGES as MSG,
  KIRKPATRICK_MESSAGES,
  KIRKPATRICK_PDF,
  KirkpatrickAlertTypeSchema,
  KirkpatrickBandCountSchema,
  KirkpatrickBandKeySchema,
  KirkpatrickBehaviorSchema,
  KirkpatrickChainSchema,
  KirkpatrickFeedbackConflictSchema,
  KirkpatrickFeedbackRequestSchema,
  KirkpatrickFeedbackResponseSchema,
  KirkpatrickFeedbackStatusSchema,
  KirkpatrickFilterOptionsSchema,
  KirkpatrickGradeSchema,
  KirkpatrickInterventionCreateRequestSchema,
  KirkpatrickInterventionInvalidDateSchema,
  KirkpatrickInterventionListSchema,
  KirkpatrickInterventionRefusalSchema,
  KirkpatrickInterventionRowSchema,
  KirkpatrickInterventionStatusSchema,
  KirkpatrickInterventionStudentNotFoundSchema,
  KirkpatrickLearningSchema,
  KirkpatrickMeSchema,
  KirkpatrickMoodSchema,
  KirkpatrickOverviewSchema,
  KirkpatrickReactionSchema,
  KirkpatrickResultsSchema,
  KirkpatrickSchoolQuerySchema,
  KirkpatrickScopeQuerySchema,
  KirkpatrickStudentSchema,
} from './schema'

/** Components contributed by BE-20 (M12), spread into COMPONENT_SCHEMAS in openapi.ts. */
export const KIRKPATRICK_COMPONENT_SCHEMAS = {
  KirkpatrickBandKey: KirkpatrickBandKeySchema,
  KirkpatrickGrade: KirkpatrickGradeSchema,
  KirkpatrickAlertType: KirkpatrickAlertTypeSchema,
  KirkpatrickMood: KirkpatrickMoodSchema,
  KirkpatrickInterventionStatus: KirkpatrickInterventionStatusSchema,
  KirkpatrickSchoolQuery: KirkpatrickSchoolQuerySchema,
  KirkpatrickScopeQuery: KirkpatrickScopeQuerySchema,
  KirkpatrickBandCount: KirkpatrickBandCountSchema,
  KirkpatrickOverview: KirkpatrickOverviewSchema,
  KirkpatrickReaction: KirkpatrickReactionSchema,
  KirkpatrickLearning: KirkpatrickLearningSchema,
  KirkpatrickBehavior: KirkpatrickBehaviorSchema,
  KirkpatrickResults: KirkpatrickResultsSchema,
  KirkpatrickChain: KirkpatrickChainSchema,
  KirkpatrickFilterOptions: KirkpatrickFilterOptionsSchema,
  KirkpatrickStudent: KirkpatrickStudentSchema,
  KirkpatrickMe: KirkpatrickMeSchema,
  KirkpatrickInterventionRow: KirkpatrickInterventionRowSchema,
  KirkpatrickInterventionList: KirkpatrickInterventionListSchema,
  KirkpatrickInterventionCreateRequest: KirkpatrickInterventionCreateRequestSchema,
  KirkpatrickInterventionStudentNotFound: KirkpatrickInterventionStudentNotFoundSchema,
  KirkpatrickInterventionInvalidDate: KirkpatrickInterventionInvalidDateSchema,
  KirkpatrickInterventionRefusal: KirkpatrickInterventionRefusalSchema,
  KirkpatrickFeedbackStatus: KirkpatrickFeedbackStatusSchema,
  KirkpatrickFeedbackRequest: KirkpatrickFeedbackRequestSchema,
  KirkpatrickFeedbackResponse: KirkpatrickFeedbackResponseSchema,
  KirkpatrickFeedbackConflict: KirkpatrickFeedbackConflictSchema,
} as const

type Headers = Record<string, { description: string; schema: { type: 'string'; example?: string } }>
const NO_STORE: Headers = {
  'Cache-Control': { description: 'no-store: the body holds personal data.', schema: { type: 'string', example: 'no-store' } },
}
const json = (schema: z.ZodType, description: string, headers?: Headers) => ({
  description,
  ...(headers ? { headers } : {}),
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)

const E401 = err(`UNAUTHORIZED "${MSG.unauthorized}": no valid session.`)
const E403 = (what: string) => err(`FORBIDDEN "${MSG.forbidden}": ${what}`)
const E429 = (what: string) =>
  json(ErrorBodySchema, `RATE_LIMITED with retryAfter and a Retry-After header: ${what}`, {
    'Retry-After': { description: 'Seconds until a retry is allowed.', schema: { type: 'string' } },
  })
const E403CSRF = err(`FORBIDDEN "${MSG.forbidden}", or CSRF_INVALID on a missing or invalid X-CSRF-Token.`)

const STAFF = 'role not admin or teacher (school_admin included)'
const SCOPED = 'role not admin, teacher or school_admin'
const SCOPE_NOTE =
  'school_admin is forced to the own school from the session whatever schoolId or state is sent; admin and teacher choose any school or state.'
const BAD_SCHOOL = err(`VALIDATION_ERROR: fields.schoolId "${KIRKPATRICK_MESSAGES.invalid}" (not a whole-number id).`)

const csrf = z.object({ 'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf.' }) })
const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })

/** Registers the 14 BE-20 (M12) endpoints. Success bodies are `{ data }`; errors are `{ error }`. */
export function registerKirkpatrickPaths(registry: OpenAPIRegistry): void {
  const get = (
    path: string,
    summary: string,
    schema: z.ZodType,
    errors: Partial<Record<number, ReturnType<typeof err>>>,
    request: { params?: z.ZodObject; query?: z.ZodObject },
    description: string,
    personal = false,
  ) =>
    registry.registerPath({
      method: 'get',
      path,
      tags: ['kirkpatrick'],
      summary,
      description,
      request,
      responses: { 200: json(envelopeOf(schema), summary, personal ? NO_STORE : undefined), 401: E401, ...errors },
    })

  // Levels
  get('/kirkpatrick/overview', 'Four-level summary with before and after comparison (S1)', KirkpatrickOverviewSchema, { 403: E403(SCOPED), 422: BAD_SCHOOL }, { query: KirkpatrickScopeQuerySchema }, `Admin, teacher, school_admin. ${SCOPE_NOTE}`)
  get('/kirkpatrick/reaction', 'Level 1 reaction (S2)', KirkpatrickReactionSchema, { 403: E403(STAFF) }, {}, 'Admin and teacher. Global: ignores the scope and every query.')
  get('/kirkpatrick/learning', 'Level 2 learning (S3)', KirkpatrickLearningSchema, { 403: E403(STAFF), 422: BAD_SCHOOL }, { query: KirkpatrickSchoolQuerySchema }, 'Admin and teacher. state is ignored.')
  get('/kirkpatrick/behavior', 'Level 3 behaviour (S4)', KirkpatrickBehaviorSchema, { 403: E403(STAFF), 422: BAD_SCHOOL }, { query: KirkpatrickSchoolQuerySchema }, 'Admin and teacher.')
  get('/kirkpatrick/results', 'Level 4 results (S5)', KirkpatrickResultsSchema, { 403: E403(STAFF), 422: BAD_SCHOOL }, { query: KirkpatrickSchoolQuerySchema }, 'Admin and teacher. Lists pupils by name (predictions, ALESA rows): personal data of minors.', true)
  get('/kirkpatrick/chain', 'Impact chain (S6)', KirkpatrickChainSchema, { 403: E403(STAFF) }, {}, 'Admin and teacher. Platform-wide: ignores the scope.')
  get('/kirkpatrick/filter-options', 'School and state options of the filters', KirkpatrickFilterOptionsSchema, { 403: E403(SCOPED) }, {}, 'Admin, teacher, school_admin. school_admin gets only the own school (empty lists when it has none).')

  // Pupil views
  get(
    '/kirkpatrick/students/{id}',
    'Kirkpatrick view of one pupil (S8)',
    KirkpatrickStudentSchema,
    { 403: E403('role not admin or teacher, or an id that is not a pupil: one uniform 403 for an unknown id and a non-pupil, so ids cannot be probed') },
    { params: z.object({ id: IdSchema }) },
    'Admin and teacher; no school scope beyond the role (provisional). A non-numeric id is 404 NOT_FOUND "Not Found." (no route). A pupil with no sessions gets the zero state.',
    true,
  )
  get('/kirkpatrick/me', 'Own headcount and last 30 days (S9)', KirkpatrickMeSchema, {}, {}, 'Any signed-in role; own data only.', true)

  // Export
  registry.registerPath({
    method: 'get',
    path: '/kirkpatrick/export-pdf',
    tags: ['kirkpatrick'],
    summary: 'Impact chain report as PDF (S6 "Muat Turun Laporan")',
    description: `Admin and teacher. One A4 page "${KIRKPATRICK_PDF.title}" built from the chain figures; the body starts with %PDF. File name ${KIRKPATRICK_PDF.filename} (layout contract: mock pdf.ts).`,
    responses: {
      200: {
        description: 'The PDF file.',
        headers: { 'Content-Disposition': { description: `attachment; filename="${KIRKPATRICK_PDF.filename}"`, schema: { type: 'string' } } },
        content: { [KIRKPATRICK_PDF.contentType]: { schema: z.string().meta({ type: 'string', format: 'binary' }) } },
      },
      401: E401,
      403: E403(STAFF),
    },
  })

  // Interventions (sensitive)
  get(
    '/kirkpatrick/interventions',
    'Intervention log and KPIs (S7)',
    KirkpatrickInterventionListSchema,
    { 403: E403(STAFF) },
    {},
    'Admin and teacher. The mock returns every intervention to any admin or teacher (no own-student or school limit, OQ-API-B3-9). Notes are sensitive personal data of minors: never logged.',
    true,
  )
  registry.registerPath({
    method: 'post',
    path: '/kirkpatrick/interventions',
    tags: ['kirkpatrick'],
    summary: 'Record an intervention',
    description:
      'Admin and teacher. Needs X-CSRF-Token. 422 fields use the copy "Medan ini diperlukan." (blank) and "Medan ini tidak sah." (invalid); the top-level message is the Laravel-style summary of the first field message. Stage order of the mock: field checks first, then the student check, then the calendar date. Notes are sensitive personal data of minors: never logged.',
    request: { headers: csrf, body: body(KirkpatrickInterventionCreateRequestSchema) },
    responses: {
      201: json(envelopeOf(KirkpatrickInterventionRowSchema), 'The recorded intervention.', NO_STORE),
      401: E401,
      403: E403CSRF,
      422: json(ErrorBodySchema, 'VALIDATION_ERROR with fields; the student and date refusals are pinned by KirkpatrickInterventionRefusal.'),
      429: E429('writes are rate limited'),
    },
  })

  // Feedback
  get('/feedback/status', 'Has the viewer answered this month?', KirkpatrickFeedbackStatusSchema, {}, {}, 'Any signed-in role; own data only.')
  registry.registerPath({
    method: 'post',
    path: '/feedback',
    tags: ['kirkpatrick'],
    summary: 'Submit the monthly feedback',
    description:
      'Any signed-in role. Needs X-CSRF-Token. One response per user per calendar month (Malaysia time); a second gives 409 CONFLICT. nps is a whole number 0 to 10 and satisfaction 1 to 5; blank gives "Medan ini diperlukan.", anything else invalid "Medan ini tidak sah.". Role and school come from the session, never from the body.',
    request: { headers: csrf, body: body(KirkpatrickFeedbackRequestSchema) },
    responses: {
      201: json(envelopeOf(KirkpatrickFeedbackResponseSchema), 'The stored response.', NO_STORE),
      401: E401,
      403: E403CSRF,
      409: json(KirkpatrickFeedbackConflictSchema, `CONFLICT "${KIRKPATRICK_MESSAGES.feedbackConflict}".`),
      422: json(ErrorBodySchema, 'VALIDATION_ERROR with fields.nps and/or fields.satisfaction.'),
      429: E429('writes are rate limited'),
    },
  })
}
