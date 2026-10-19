import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { envelopeOf } from '../common/envelope'
import { IdSchema } from '../common/ids'
import { DutaCardSchema, DutaRecommendationQuerySchema, DutaRecommendationSchema, DutaTierSchema } from './duta'
import {
  SpmBahasaSubjectSchema,
  SpmCountOptionSchema,
  SpmDatabankSubjectSchema,
  SpmDifficultyCountsSchema,
  SpmLatihTubiCardSchema,
  SpmLatihTubiConfigSchema,
  SpmLatihTubiListSchema,
  SpmLockedSetSchema,
  SpmOpenSubjectCardSchema,
  SpmOverviewSchema,
  SpmReadinessSchema,
  SpmReadinessTileSchema,
  SpmSubjektifOverviewSchema,
  SpmSubjektifSubjectSchema,
  SpmTrackingAHubSchema,
  SpmTrackingARedirectSchema,
  SpmTrackingASetSchema,
  SpmTrackingASubjectResultSchema,
  SpmTrackingASubjectSchema,
} from './hub'
import {
  SpmMockAnswerInputSchema,
  SpmMockCreateRequestSchema,
  SpmMockCreatedSchema,
  SpmMockExamItemSchema,
  SpmMockExamViewSchema,
  SpmMockItemSchema,
  SpmMockListItemSchema,
  SpmMockResultSchema,
  SpmMockSubmitRequestSchema,
  SpmMockWeakTopicSchema,
} from './mocks'
import {
  SpmErrorCodeSchema,
  SpmHeroClassSchema,
  SpmMockGradeSchema,
  SpmMockPaperNumberSchema,
  SpmMockStatusSchema,
  SpmMockSubjectSchema,
  SpmSetStatusSchema,
  SpmSubjectGroupSchema,
  SpmTargetTypeSchema,
  SpmWalkthroughSubjectSchema,
} from './shared'
import {
  SpmWalkthroughRefusedSchema,
  SpmWalkthroughRequestSchema,
  SpmWalkthroughResponseSchema,
  SpmWalkthroughSolvedSchema,
} from './walkthrough'

/**
 * Components contributed by BE-41 (appended to COMPONENT_SCHEMAS in openapi.ts). Ids are prefixed
 * `Spm` (hub, mock exams, walkthrough) and `Duta` (ambassador card), so none can clash with the
 * practice (`Practice...`, `StartSession...`) or question (`Question...`) contracts.
 */
export const SPM_COMPONENT_SCHEMAS = {
  // shared enums
  SpmErrorCode: SpmErrorCodeSchema,
  SpmTargetType: SpmTargetTypeSchema,
  SpmSetStatus: SpmSetStatusSchema,
  SpmSubjectGroup: SpmSubjectGroupSchema,
  SpmMockStatus: SpmMockStatusSchema,
  SpmMockGrade: SpmMockGradeSchema,
  SpmHeroClass: SpmHeroClassSchema,
  SpmMockPaperNumber: SpmMockPaperNumberSchema,
  SpmMockSubject: SpmMockSubjectSchema,
  SpmWalkthroughSubject: SpmWalkthroughSubjectSchema,
  // hub
  SpmOverview: SpmOverviewSchema,
  SpmDatabankSubject: SpmDatabankSubjectSchema,
  SpmLatihTubiCard: SpmLatihTubiCardSchema,
  SpmLatihTubiList: SpmLatihTubiListSchema,
  SpmDifficultyCounts: SpmDifficultyCountsSchema,
  SpmCountOption: SpmCountOptionSchema,
  SpmLatihTubiConfig: SpmLatihTubiConfigSchema,
  SpmOpenSubjectCard: SpmOpenSubjectCardSchema,
  SpmBahasaSubject: SpmBahasaSubjectSchema,
  SpmLockedSet: SpmLockedSetSchema,
  SpmReadinessTile: SpmReadinessTileSchema,
  SpmReadiness: SpmReadinessSchema,
  SpmTrackingAHub: SpmTrackingAHubSchema,
  SpmTrackingASet: SpmTrackingASetSchema,
  SpmTrackingASubject: SpmTrackingASubjectSchema,
  SpmTrackingARedirect: SpmTrackingARedirectSchema,
  SpmTrackingASubjectResult: SpmTrackingASubjectResultSchema,
  SpmSubjektifSubject: SpmSubjektifSubjectSchema,
  SpmSubjektifOverview: SpmSubjektifOverviewSchema,
  // mock exams
  SpmMockListItem: SpmMockListItemSchema,
  SpmMockCreateRequest: SpmMockCreateRequestSchema,
  SpmMockCreated: SpmMockCreatedSchema,
  SpmMockExamItem: SpmMockExamItemSchema,
  SpmMockExamView: SpmMockExamViewSchema,
  SpmMockAnswerInput: SpmMockAnswerInputSchema,
  SpmMockSubmitRequest: SpmMockSubmitRequestSchema,
  SpmMockItem: SpmMockItemSchema,
  SpmMockWeakTopic: SpmMockWeakTopicSchema,
  SpmMockResult: SpmMockResultSchema,
  // walkthrough
  SpmWalkthroughRequest: SpmWalkthroughRequestSchema,
  SpmWalkthroughSolved: SpmWalkthroughSolvedSchema,
  SpmWalkthroughRefused: SpmWalkthroughRefusedSchema,
  SpmWalkthroughResponse: SpmWalkthroughResponseSchema,
  // duta
  DutaTier: DutaTierSchema,
  DutaRecommendationQuery: DutaRecommendationQuerySchema,
  DutaCard: DutaCardSchema,
  DutaRecommendation: DutaRecommendationSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)

const csrf = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})
const CodeParams = z.object({
  code: z.string().min(1).meta({ description: 'Curriculum subject code (BM, MATH, ...), case-insensitive. An unknown code is 404 "Not Found.".' }),
})
const MockParams = z.object({
  id: IdSchema.meta({ description: 'Mock exam id. An unknown id or another user\'s mock is 404 "Not Found." (BR-M06-26).' }),
})

const UNAUTHORIZED = err('UNAUTHORIZED "Unauthenticated." (no valid session).')
const FORBIDDEN_CSRF = err('FORBIDDEN with code CSRF_INVALID (missing or wrong X-CSRF-Token).')
const NOT_FOUND = err('NOT_FOUND "Not Found."')
const NOT_FOUND_MOCK = err('NOT_FOUND "Not Found." (unknown id, or a mock that belongs to another user).')

/**
 * Registers the 14 M06 routes of BE-41 (SPM hub). All routes need a signed-in user of any role;
 * the only role-dependent field is `readiness` of `GET /spm/tracking-a` (active role `admin`).
 * The quiz routes (Q1 to Q3 sessions, S10 history, structured answers) are the practice routes
 * (BE-12, BE-13) and the Bijak SPM routes belong to BE-15, BE-16 and BE-39: none is here.
 * Paths are relative to the `/api` server.
 */
export function registerSpmPaths(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/spm/overview',
    tags: ['spm'],
    summary: 'SPM hub (M06-01): totals, module chips and the caller practice stats',
    description:
      '`me` is the caller own history over the modes past_year, latih_tubi and ramalan. `yearsAvailable` is 0. The mock keeps `totalQuestions` and the two pool chips as display constants; the real backend computes them (open question 1).',
    responses: { 200: json(envelopeOf(SpmOverviewSchema), 'Hub figures.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'get',
    path: '/spm/databank',
    tags: ['spm'],
    summary: 'Tahun Lepas databank subjects (M06-02)',
    description: 'The subjects that have a databank position, in that order (18 in the mock); `databankCount` is the SPM pool size.',
    responses: { 200: json(envelopeOf(z.array(SpmDatabankSubjectSchema)), 'Subjects with pool size.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'get',
    path: '/spm/latih-tubi',
    tags: ['spm'],
    summary: 'Latih Tubi subject cards (M06-03)',
    description: 'Grouped into teras and elektif, each ordered by display order. `locked` = targetSize set and total < targetSize.',
    responses: { 200: json(envelopeOf(SpmLatihTubiListSchema), 'Cards by group.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'get',
    path: '/spm/latih-tubi/{code}',
    tags: ['spm'],
    summary: 'Latih Tubi setup for one subject (M06-04)',
    request: { params: CodeParams },
    responses: {
      200: json(envelopeOf(SpmLatihTubiConfigSchema), 'Setup data.'),
      401: UNAUTHORIZED,
      404: NOT_FOUND,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/spm/tracking-a',
    tags: ['spm'],
    summary: 'Tracking A hub (M06-05)',
    description:
      '`readiness` is non-null only when the active role is `admin` (BR-M06-30), otherwise null. `openSubjects` lists non-bahasa subjects with at least one startable set (teras before elektif). Set status is computed on read: readyCount < size is belum_cukup, bankSource > size is bank_besar, otherwise bersih.',
    responses: { 200: json(envelopeOf(SpmTrackingAHubSchema), 'The hub.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'get',
    path: '/spm/tracking-a/{code}',
    tags: ['spm'],
    summary: 'Tracking A sets of one subject (M06-06)',
    description:
      'BM and BI answer `{ redirect }` to the bahasa structured track (subject_id = the id of that subject). Other subjects list the sets of the Tracking year, startable first, then locked, each by set number.',
    request: { params: CodeParams },
    responses: {
      200: json(envelopeOf(SpmTrackingASubjectResultSchema), 'Sets, or the redirect for BM and BI.'),
      401: UNAUTHORIZED,
      404: NOT_FOUND,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/spm/subjektif',
    tags: ['spm'],
    summary: 'Subjektif SPM overview (M06-07)',
    description: 'The 15 Subjektif subjects (teras first, then by name) and the stats of the caller own structured attempts with scope spm.',
    responses: { 200: json(envelopeOf(SpmSubjektifOverviewSchema), 'Subjects and stats.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'get',
    path: '/spm-mocks',
    tags: ['spm'],
    summary: 'My mock exams, newest first (M06-08)',
    description: 'Only the caller\'s mocks. A bare `{ data: [...] }`: there is no `meta`.',
    responses: { 200: json(z.object({ data: z.array(SpmMockListItemSchema) }), 'Mocks.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'post',
    path: '/spm-mocks',
    tags: ['spm'],
    summary: 'Generate a mock exam (M06-09)',
    description:
      'Paper 1: 30 objective items (1 mark each) sampled from the SPM pool of the subject. Paper 2: 6 structured items of 10 marks from visible structured questions, shuffled. Writes nothing to practice, mastery, the revision queue or the wallet.',
    request: {
      headers: [csrf],
      body: { required: true, content: { 'application/json': { schema: SpmMockCreateRequestSchema } } },
    },
    responses: {
      201: json(envelopeOf(SpmMockCreatedSchema), 'The new mock id.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_CSRF,
      422: err('VALIDATION_ERROR with fields.subject "Sila pilih subjek." (not one of the ten options) or fields.paperNumber "Paper mesti 1 atau 2.".'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/spm-mocks/{id}',
    tags: ['spm'],
    summary: 'Exam paper to sit, without answer keys (M06-10)',
    description: 'Owner only. Items carry no model answer, student answer, marks, feedback, topic or question id.',
    request: { params: MockParams },
    responses: {
      200: json(envelopeOf(SpmMockExamViewSchema), 'The paper.'),
      401: UNAUTHORIZED,
      404: NOT_FOUND_MOCK,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/spm-mocks/{id}/submit',
    tags: ['spm'],
    summary: 'Submit answers and grade the mock (M06-11)',
    description:
      'Owner only. Paper 1: correct iff the trimmed, upper-cased answer equals the model letter (1 or 0 marks). Paper 2 (simulated marker): 0 marks for an empty answer, otherwise round(max x min(1, words / 60)). Grade bands: >= 90 A+, 80 A, 70 B+, 60 B, 50 C, 45 D, 40 E, else G. Writes only the mock rows.',
    request: {
      params: MockParams,
      headers: [csrf],
      body: { required: true, content: { 'application/json': { schema: SpmMockSubmitRequestSchema } } },
    },
    responses: {
      200: json(envelopeOf(SpmMockResultSchema), 'The graded result.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_CSRF,
      404: NOT_FOUND_MOCK,
      409: err('CONFLICT "Mock ini sudah dihantar." (second submit).'),
      422: err('VALIDATION_ERROR with fields.answers "Jawapan tidak sah." (not an array, or an entry whose `no` is not an integer from 1 to the item count, or whose `answer` is neither a string nor null).'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/spm-mocks/{id}/result',
    tags: ['spm'],
    summary: 'Result of a submitted mock (M06-12)',
    description: 'Owner only.',
    request: { params: MockParams },
    responses: {
      200: json(envelopeOf(SpmMockResultSchema), 'The result.'),
      401: UNAUTHORIZED,
      404: NOT_FOUND_MOCK,
      409: err('Code NOT_SUBMITTED, message "Mock belum dihantar." (the mock is still in_progress).'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/spm-walkthrough/solve',
    tags: ['spm'],
    summary: 'Simulated step-by-step walkthrough (M06-13)',
    description:
      'Simulated (no external call, the image is never stored). The body is RAW `{ ok, walkthrough | error }`, not enveloped, and every business error is HTTP 200: an image that is not image/* or is over 5 MB gives `{ ok: false, error: "Gambar tidak sah." }`; no text and no image gives `{ ok: false, error: "Sila masukkan soalan atau muat naik gambar soalan." }`. Only an unlisted subject is 422.',
    request: {
      headers: [csrf],
      body: { required: true, content: { 'multipart/form-data': { schema: SpmWalkthroughRequestSchema } } },
    },
    responses: {
      200: json(SpmWalkthroughResponseSchema, 'Walkthrough text, or a business error with ok false.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_CSRF,
      422: err('VALIDATION_ERROR with fields.subject "Sila pilih subjek." (not one of the 15 listed subjects).'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/duta/recommendations',
    tags: ['spm', 'duta'],
    summary: 'One Duta recommendation card (M06-14, provisional M24 endpoint)',
    description:
      'Picks an active `bintang` ambassador (inspirasi, tetamu and inactive rows are never returned); `data` is null when none is active. M24 takes the route over with the same path and body.',
    request: { query: DutaRecommendationQuerySchema },
    responses: { 200: json(envelopeOf(DutaRecommendationSchema), 'A card or null.'), 401: UNAUTHORIZED },
  })
}
