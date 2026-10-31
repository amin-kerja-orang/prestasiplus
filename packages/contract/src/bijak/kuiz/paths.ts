import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../../zod'
import { envelopeOf } from '../../common/envelope'
import { ErrorBodySchema } from '../../common/error'
import {
  BijakKuizCheckRequestSchema,
  BijakKuizCheckResultSchema,
  BijakKuizFinishRequestSchema,
  BijakKuizItemSchema,
  BijakKuizOptionSchema,
  BijakKuizPaperPageSchema,
  BijakKuizPaperQuerySchema,
  BijakKuizResultSchema,
  BijakKuizSessionSchema,
  BijakKuizStartRequestSchema,
  BijakKuizStimulusSchema,
} from './schema'

/** Components of R1-B16 (appended to COMPONENT_SCHEMAS in openapi.ts). */
export const BIJAK_KUIZ_COMPONENT_SCHEMAS = {
  BijakKuizStartRequest: BijakKuizStartRequestSchema,
  BijakKuizOption: BijakKuizOptionSchema,
  BijakKuizStimulus: BijakKuizStimulusSchema,
  BijakKuizItem: BijakKuizItemSchema,
  BijakKuizSession: BijakKuizSessionSchema,
  BijakKuizCheckRequest: BijakKuizCheckRequestSchema,
  BijakKuizCheckResult: BijakKuizCheckResultSchema,
  BijakKuizFinishRequest: BijakKuizFinishRequestSchema,
  BijakKuizResult: BijakKuizResultSchema,
  BijakKuizPaperPage: BijakKuizPaperPageSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({ description, content: { 'application/json': { schema } } })
const err = (description: string) => json(ErrorBodySchema, description)
const csrf = z.object({ 'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }) })

const UNAUTHORIZED = err('UNAUTHORIZED (no valid session).')
const FORBIDDEN = err('FORBIDDEN (the active role may not use Bijak SPM, or CSRF_INVALID on a write). Student role; admin and school_admin only inside Mod Pelajar.')
const ROLE_NOTE =
  'Student role (admin and school_admin only inside Mod Pelajar, where what is written is test data). No answer key ever reaches the client before the check; every response is no-store.'

const SessionParams = z.object({ id: z.uuid().meta({ description: 'Quiz session id (a practice session).' }) })
const PaperParams = z.object({ id: z.string().min(1).meta({ description: 'Paper id.' }) })

/** The five Simulasi Kuiz routes of R1-B16. */
export function registerBijakKuizPaths(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'post',
    path: '/bijak/kuiz/sessions',
    tags: ['bijak-kuiz'],
    summary: 'Simulasi Kuiz (random): start a quiz of 5, 10, 20 or 40 objective questions',
    description: `V2 ExamQuizController::index. Draws published, active, learner-visible questions that are a single objective (MCQ) part with a correct option, optionally of one subject; options are shuffled; fewer than count may be served when the bank is short (V2 limit). The quiz is stored as a practice session (mode latih_tubi, decision U8) so wrong answers feed Soalan Aku Salah. 422 NO_QUESTIONS "Belum ada soalan objektif" when nothing matches. ${ROLE_NOTE}`,
    request: { headers: [csrf], body: { required: true, content: { 'application/json': { schema: BijakKuizStartRequestSchema } } } },
    responses: {
      201: json(envelopeOf(BijakKuizSessionSchema), 'The session and its items (no key).'),
      401: UNAUTHORIZED,
      403: FORBIDDEN,
      422: err('NO_QUESTIONS, or VALIDATION_ERROR with fields (subject, count).'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/bijak/kuiz/sessions/{id}/check',
    tags: ['bijak-kuiz'],
    summary: 'Simulasi Kuiz (random): mark one answer on the server ("Semak")',
    description: `V2 ExamQuizController::check. The first check of an item is stored; a repeat returns the stored verdict and never changes it. 422 "Jawapan tidak sah." when the item is not in the session or the option is not one of its options. ${ROLE_NOTE}`,
    request: { headers: [csrf], params: SessionParams, body: { required: true, content: { 'application/json': { schema: BijakKuizCheckRequestSchema } } } },
    responses: {
      200: json(envelopeOf(BijakKuizCheckResultSchema), 'The verdict, the right option and the explanation.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN,
      404: err('NOT_FOUND "Kuiz tidak ditemui" (unknown, malformed or another user session).'),
      409: err('ALREADY_SUBMITTED "Kuiz ini sudah selesai."'),
      422: err('VALIDATION_ERROR "Jawapan tidak sah." on itemId or optionId.'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/bijak/kuiz/sessions/{id}/finish',
    tags: ['bijak-kuiz'],
    summary: 'Simulasi Kuiz (random): finish and store the result',
    description: `Completes the practice session: answers are stored, the revision queue and mastery move, and the reward port credits the session (ledger source follows the stored mode latih_tubi: quiz_spm). Unchecked items are not counted as answered. ${ROLE_NOTE}`,
    request: { headers: [csrf], params: SessionParams, body: { required: false, content: { 'application/json': { schema: BijakKuizFinishRequestSchema } } } },
    responses: {
      200: json(envelopeOf(BijakKuizResultSchema), 'Score and reward.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN,
      404: err('NOT_FOUND "Kuiz tidak ditemui".'),
      409: err('ALREADY_SUBMITTED "Kuiz ini sudah selesai."'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/bijak/kuiz/papers/{id}',
    tags: ['bijak-kuiz'],
    summary: 'Simulasi Kuiz (per paper): one Bahagian of a published paper',
    description: `V2 ExamQuizController::paper + PaperViewBuilder. Pages follow the paper sections in order; a section without a question is not a page. A page carries every objective part of the section (with stimulus) and the non-objective parts as kind open (an unsaved textarea in the client). NOT stored (decision U8). Option order is shuffled on each read. ${ROLE_NOTE}`,
    request: { params: PaperParams, query: BijakKuizPaperQuerySchema },
    responses: {
      200: json(envelopeOf(BijakKuizPaperPageSchema), 'One Bahagian.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN,
      404: err('NOT_FOUND "Kertas tidak ditemui" (unknown, unpublished, or another user generated paper).'),
      422: err('VALIDATION_ERROR on page.'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/bijak/kuiz/papers/{id}/check',
    tags: ['bijak-kuiz'],
    summary: 'Simulasi Kuiz (per paper): mark one answer on the server ("Semak")',
    description: `V2 ExamQuizController::check. Nothing is stored (decision U8). The option must belong to the part it claims. ${ROLE_NOTE}`,
    request: { headers: [csrf], params: PaperParams, body: { required: true, content: { 'application/json': { schema: BijakKuizCheckRequestSchema } } } },
    responses: {
      200: json(envelopeOf(BijakKuizCheckResultSchema), 'The verdict and the right option.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN,
      404: err('NOT_FOUND "Kertas tidak ditemui".'),
      422: err('VALIDATION_ERROR "Jawapan tidak sah." (unknown part, non-objective part, or option not of the part).'),
    },
  })
}
