import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../../zod'
import { envelopeOf } from '../../common/envelope'
import { ErrorBodySchema } from '../../common/error'
import { IdSchema } from '../../common/ids'
import {
  BijakBlueprintContractSchema,
  BijakBlueprintSectionSchema,
  BijakGenerateErrorCodeSchema,
  BijakGenerateNoBlueprintErrorSchema,
  BijakGenerateRequestSchema,
  BijakGenerateResultSchema,
  BijakGenerateShortageErrorSchema,
  BijakGenerateShortageSchema,
  BijakPaperCoverSchema,
  BijakPaperCoverSectionSchema,
  BijakPaperReferencePanelSchema,
  BijakPaperSummarySchema,
  BijakSubjectSchema,
} from './schema'

/**
 * Components contributed by BE-15 (appended to COMPONENT_SCHEMAS in openapi.ts). The key of each
 * entry is the schema `.meta({ id })`; ids are prefixed `BijakSubject`, `BijakPaper`,
 * `BijakBlueprint` and `BijakGenerate` so they cannot clash with other Bijak cards (attempts,
 * admin) or with the question bank.
 */
export const BIJAK_PAPERS_COMPONENT_SCHEMAS = {
  BijakSubject: BijakSubjectSchema,
  BijakPaperSummary: BijakPaperSummarySchema,
  BijakPaperCoverSection: BijakPaperCoverSectionSchema,
  BijakPaperReferencePanel: BijakPaperReferencePanelSchema,
  BijakPaperCover: BijakPaperCoverSchema,
  BijakBlueprintSection: BijakBlueprintSectionSchema,
  BijakBlueprintContract: BijakBlueprintContractSchema,
  BijakGenerateRequest: BijakGenerateRequestSchema,
  BijakGenerateResult: BijakGenerateResultSchema,
  BijakGenerateShortage: BijakGenerateShortageSchema,
  BijakGenerateErrorCode: BijakGenerateErrorCodeSchema,
  BijakGenerateNoBlueprintError: BijakGenerateNoBlueprintErrorSchema,
  BijakGenerateShortageError: BijakGenerateShortageErrorSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)

const csrf = z.object({
  'X-CSRF-Token': z
    .string()
    .min(1)
    .meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})
const IdParams = z.object({
  id: IdSchema.meta({
    description: 'Paper id (a curated paper or one of the caller generated papers).',
  }),
})

const UNAUTHORIZED = err('UNAUTHORIZED (no valid session).')
const FORBIDDEN_ROLE = err(
  'FORBIDDEN (the active role may not use Bijak SPM). Allowed: student, and admin or school_admin inside Mod Pelajar (working assumption of BE-15, see open question 1).',
)
const FORBIDDEN_ROLE_OR_CSRF = err(
  'FORBIDDEN (the active role may not use Bijak SPM) or CSRF_INVALID (missing or wrong X-CSRF-Token).',
)

const ROLE_NOTE =
  'Student role (admin and school_admin only inside Mod Pelajar, where the session acts as a student). No answer key, mark scheme, accepted equivalent, explanation or question id is ever returned (US-15).'

/**
 * Registers the five Bijak SPM read-side routes of BE-15. The mock `BijakServer` has no HTTP
 * routes; these paths are new and map one to one to `listPapers`, `getCover`, `listContracts`,
 * `subjects` and `generatePaper`. Every response body is `{ data }` or `{ error }`.
 */
export function registerBijakPapersPaths(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/bijak/papers',
    tags: ['bijak-papers'],
    summary: 'Kertas Pilihan: published curated papers with the caller progress',
    description: `Mock method listPapers(userId). Only published curated papers (kind pilihan); never generated papers. The mock has no server filters (the UI filters by subject and kertas). Per paper: status belum, sedang (attemptId set) or selesai (lastScore of the latest submitted attempt). ${ROLE_NOTE}`,
    responses: {
      200: json(
        envelopeOf(z.array(BijakPaperSummarySchema)),
        'Published papers with the caller progress.',
      ),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ROLE,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/bijak/papers/{id}',
    tags: ['bijak-papers'],
    summary: 'Paper cover: instructions, reference sheet, sections, marks and duration',
    description: `Mock method getCover(userId, paperId). A curated paper resolves for any permitted caller; a generated paper (kind jana) only for its creator. Section instruction defaults to "Jawab semua soalan." or "Jawab {n} daripada {count} soalan.". ${ROLE_NOTE}`,
    request: { params: IdParams },
    responses: {
      200: json(envelopeOf(BijakPaperCoverSchema), 'The paper cover.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ROLE,
      404: err(
        'NOT_FOUND "Kertas tidak ditemui" (unknown id, unpublished paper, or another user generated paper).',
      ),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/bijak/contracts',
    tags: ['bijak-papers'],
    summary: 'Kontrak Blueprint list for Jana Kertas',
    description: `Mock method listContracts(). Every blueprint including those with source Draf (those cannot generate). Sections carry label and take only; the internal pool tag is not exposed. ${ROLE_NOTE}`,
    responses: {
      200: json(envelopeOf(z.array(BijakBlueprintContractSchema)), 'Blueprint contracts.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ROLE,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/bijak/subjects',
    tags: ['bijak-papers'],
    summary: 'Subject dictionary of the Bijak hub',
    description: `Mock method subjects(): the open subject dictionary (exam schema D9) used by the hub filters and Jana Kertas. ${ROLE_NOTE}`,
    responses: {
      200: json(envelopeOf(z.array(BijakSubjectSchema)), 'Subjects.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ROLE,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/bijak/papers/generate',
    tags: ['bijak-papers'],
    summary: 'Jana Kertas: generate a private paper from a Kontrak Blueprint',
    description: `Mock method generatePaper(userId, subject, kertas). Composes from the blueprint: stimulus groups are taken whole, no question repeats inside one paper, questions the caller has not been served are preferred. Every call creates a new paper id; the paper is private to the caller. 422 NO_BLUEPRINT when there is no blueprint for the pair or its source is Draf (no paper is created). 422 SHORTAGE with error.details.shortages when the pool cannot fill a section: a shortage list instead of a short paper. ${ROLE_NOTE}`,
    request: {
      headers: [csrf],
      body: {
        required: true,
        content: { 'application/json': { schema: BijakGenerateRequestSchema } },
      },
    },
    responses: {
      201: json(envelopeOf(BijakGenerateResultSchema), 'The generated paper id.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ROLE_OR_CSRF,
      422: {
        description:
          'NO_BLUEPRINT "Belum ada kontrak untuk subjek dan kertas ini"; SHORTAGE "Kertas tidak dapat dijana kerana soalan tidak mencukupi." with error.details.shortages [{ section, need, have }]; or VALIDATION_ERROR with fields (subject, kertas) for an invalid body.',
        content: {
          'application/json': {
            schema: z.union([
              BijakGenerateNoBlueprintErrorSchema,
              BijakGenerateShortageErrorSchema,
              ErrorBodySchema,
            ]),
          },
        },
      },
    },
  })
}
