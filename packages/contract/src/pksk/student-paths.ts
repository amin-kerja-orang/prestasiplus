import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { ErrorBodySchema } from '../common/error'
import { envelopeOf } from '../common/envelope'
import { z } from '../zod'
import {
  PkskAccessSchema,
  PkskAnswersRequestSchema,
  PkskDashboardSchema,
  PkskDomainParamsSchema,
  PkskDomainSectionsSchema,
  PkskExamAttemptSchema,
  PkskExamSchema,
  PkskLevelParamsSchema,
  PkskPracticeResultSchema,
  PkskPracticeSchema,
  PKSK_STUDENT_SCHEMAS,
} from './student'
import { PkskDomainSchema } from './shared'

/**
 * Components of the PKSK student half, keyed by `.meta({ id })`. The shared ones (`PkskLevel`,
 * `PkskDomain`, ...) are in `PKSK_SHARED_COMPONENT_SCHEMAS` (shared.ts).
 */
export const PKSK_STUDENT_COMPONENT_SCHEMAS = PKSK_STUDENT_SCHEMAS

const json = (schema: z.ZodType, description: string, headers?: z.ZodObject) => ({
  description,
  content: { 'application/json': { schema } },
  ...(headers ? { headers } : {}),
})
const err = (description: string) => json(ErrorBodySchema, description)
const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })

/** Personal data of minors (D57): never cached by a browser, proxy or service worker. */
const NO_STORE = z.object({
  'Cache-Control': z.literal('no-store').meta({ description: 'no-store' }),
})
const csrf = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})

const UNAUTHORIZED = err('UNAUTHORIZED "Unauthenticated." (no valid session).')
const GATE_403 = err('FORBIDDEN "This action is unauthorized." (the caller has no access to this level).')
const GATE_404 = err('NOT_FOUND "Not Found." (the level is not exactly T1 or T4; checked before the access test).')
const RATE_LIMITED = {
  description:
    'RATE_LIMITED with retryAfter (seconds). The Retry-After header carries the same value. Limited per user.',
  headers: z.object({
    'Retry-After': z.number().int().min(0).meta({ description: 'Seconds until a retry is allowed.' }),
  }),
  content: { 'application/json': { schema: ErrorBodySchema } },
}
const WHO =
  'Who: any signed-in role (student, parent, teacher, admin ...), then the level gate: unknown level 404 first, then 403 unless the caller has access to the level (an active unexpired grant of a package for that level or ALL, the PKSK subscription flag, or role admin). Scope: own data only.'

/**
 * Registers the nine PKSK student routes (M07-01 to M07-09). Bodies are `{ data }` or `{ error }`.
 * Responses carry no correctness flag before submit (SEC-M07-07). The admin routes
 * (`/admin/pksk-*`, `/pksk-packages`) are in `registerPkskAdminPaths`.
 */
export function registerPkskStudentPaths(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/pksk/me/access',
    tags: ['pksk'],
    summary: 'Which PKSK levels the caller can use',
    description:
      'Who: any signed-in role, own access only. T1 and T4 are true for role admin, for the PKSK subscription flag, or for an active unexpired grant of a package for that level or ALL (Kombo). An expiry date is valid through the end of that day (Asia/Kuala_Lumpur).',
    responses: { 200: json(envelopeOf(PkskAccessSchema), 'Access flags.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'get',
    path: '/pksk-domains',
    tags: ['pksk'],
    summary: 'The 15 PKSK domains',
    description: 'Who: any signed-in role. Reference data ordered by `order`; no meta.',
    responses: { 200: json(envelopeOf(z.array(PkskDomainSchema).length(15)), 'The domains.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'get',
    path: '/pksk/levels/{level}/dashboard',
    tags: ['pksk'],
    summary: 'Readiness and Bahagian B mastery for a level',
    description: `${WHO} Mean of no attempts is 0. Own attempts only.`,
    request: { params: PkskLevelParamsSchema },
    responses: {
      200: json(envelopeOf(PkskDashboardSchema), 'The dashboard.', NO_STORE),
      401: UNAUTHORIZED,
      403: GATE_403,
      404: GATE_404,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/pksk/levels/{level}/domains',
    tags: ['pksk'],
    summary: 'The three Bahagian sections with question counts and mastery',
    description: `${WHO} Sections A, B, C in that order; questionCount counts approved questions of the domain at this level.`,
    request: { params: PkskLevelParamsSchema },
    responses: {
      200: json(envelopeOf(PkskDomainSectionsSchema), 'The sections.', NO_STORE),
      401: UNAUTHORIZED,
      403: GATE_403,
      404: GATE_404,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/pksk/levels/{level}/domains/{code}',
    tags: ['pksk'],
    summary: 'A practice set for one domain (up to 10 random approved questions)',
    description: `${WHO} Side effect on a GET: records a "practice loaded" time for the caller, level and domain, used as the session start on submit. Questions are shuffled; options are empty for Bahagian C; no correctness flag is ever sent.`,
    request: { params: PkskDomainParamsSchema },
    responses: {
      200: json(envelopeOf(PkskPracticeSchema), 'The practice set.', NO_STORE),
      401: UNAUTHORIZED,
      403: GATE_403,
      404: err(
        'NOT_FOUND "Not Found." (bad level, checked first; or an unknown domain code).',
      ),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/pksk/levels/{level}/exam-attempts',
    tags: ['pksk'],
    summary: 'Own exam attempts at the level, newest first',
    description: `${WHO} Another user attempts are never returned.`,
    request: { params: PkskLevelParamsSchema },
    responses: {
      200: json(envelopeOf(z.array(PkskExamAttemptSchema)), 'The attempts.', NO_STORE),
      401: UNAUTHORIZED,
      403: GATE_403,
      404: GATE_404,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/pksk/levels/{level}/domains/{code}/practice-sessions',
    tags: ['pksk'],
    summary: 'Submit a domain practice set',
    description: `${WHO} Scored on the server (A and B: the chosen option must be flagged correct; C: a trimmed text of at least 50 characters, simulated marker). Recorded as one completed M05 practice session with mode pksk; mastery of the domain is stored; wallet and streak are credited by M05/M14. Contract is stricter than the mock (D57): unknown keys are rejected, at most 101 answers, text at most 10000 characters, optionIndex 0 to 5. Every body problem is 422 fields.answers "Jawapan tidak sah.".`,
    request: { params: PkskDomainParamsSchema, headers: [csrf], body: body(PkskAnswersRequestSchema) },
    responses: {
      201: json(envelopeOf(PkskPracticeResultSchema), 'Scored and recorded.', NO_STORE),
      401: UNAUTHORIZED,
      403: err('FORBIDDEN "This action is unauthorized." (no access to the level), or CSRF_INVALID (missing or wrong X-CSRF-Token).'),
      404: err('NOT_FOUND "Not Found." (bad level, checked first; or an unknown domain code).'),
      422: err(
        'VALIDATION_ERROR "Jawapan tidak sah." with fields.answers "Jawapan tidak sah." (empty list, duplicate questionId, mistyped field, unknown key, or any question that is not an approved PKSK question of this domain and level). Nothing is written.',
      ),
      429: RATE_LIMITED,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/pksk/levels/{level}/exam',
    tags: ['pksk'],
    summary: 'A full exam paper (30 A, 70 B, 1 C question)',
    description: `${WHO} Weights 20, 70, 10; fewer questions when the pool is short; shuffled; no correctness flag. Nothing is stored.`,
    request: { params: PkskLevelParamsSchema },
    responses: {
      200: json(envelopeOf(PkskExamSchema), 'The exam.', NO_STORE),
      401: UNAUTHORIZED,
      403: GATE_403,
      404: GATE_404,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/pksk/levels/{level}/exam-attempts',
    tags: ['pksk'],
    summary: 'Submit an exam; scored and stored',
    description: `${WHO} Every answered question must be an approved PKSK question of this level (any domain), at most 30 A, 70 B and 1 C answers. Bahagian % = correct / planned count (30, 70, 1) x 100 to one decimal; scorePct = round1(0.2 A + 0.7 B + 0.1 C). No M05 session, wallet or streak change. Same body rules as the practice submit.`,
    request: { params: PkskLevelParamsSchema, headers: [csrf], body: body(PkskAnswersRequestSchema) },
    responses: {
      201: json(envelopeOf(PkskExamAttemptSchema), 'The stored attempt.', NO_STORE),
      401: UNAUTHORIZED,
      403: err('FORBIDDEN "This action is unauthorized." (no access to the level), or CSRF_INVALID (missing or wrong X-CSRF-Token).'),
      404: GATE_404,
      422: err(
        'VALIDATION_ERROR "Jawapan tidak sah." with fields.answers "Jawapan tidak sah." (invalid list, unknown / unapproved / other-level question, or more answers in a Bahagian than 30 / 70 / 1). Nothing is written.',
      ),
      429: RATE_LIMITED,
    },
  })
}
