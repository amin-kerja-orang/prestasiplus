import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../../zod'
import { envelopeOf } from '../../common/envelope'
import { ErrorBodySchema } from '../../common/error'
import { IdSchema } from '../../common/ids'
import {
  BijakBlueprintContractSchema,
  BijakBlueprintSectionSchema,
  BijakGenerateErrorCodeSchema,
  BijakGenerateLimitErrorSchema,
  BijakGenerateNoBlueprintErrorSchema,
  BijakGenerateShortageErrorSchema,
  BijakGenerateShortageSchema,
  BijakShortageKindSchema,
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
  BijakGenerateShortage: BijakGenerateShortageSchema,
  BijakGenerateErrorCode: BijakGenerateErrorCodeSchema,
  BijakGenerateNoBlueprintError: BijakGenerateNoBlueprintErrorSchema,
  BijakGenerateShortageError: BijakGenerateShortageErrorSchema,
  BijakShortageKind: BijakShortageKindSchema,
  BijakGenerateLimitError: BijakGenerateLimitErrorSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)

const IdParams = z.object({
  id: IdSchema.meta({
    description: 'Paper id (a curated paper or one of the caller generated papers).',
  }),
})

const UNAUTHORIZED = err('UNAUTHORIZED (no valid session).')
const FORBIDDEN_ROLE = err(
  'FORBIDDEN (the active role may not use Bijak SPM). Allowed: student, and admin or school_admin inside Mod Pelajar (working assumption of BE-15, see open question 1).',
)
const ROLE_NOTE =
  'Student role (admin and school_admin only inside Mod Pelajar, where the session acts as a student). No answer key, mark scheme, accepted equivalent, explanation or question id is ever returned (US-15).'

/**
 * Registers the four Bijak SPM read-side routes of BE-15 (`listPapers`, `getCover`,
 * `listContracts`, `subjects`). The pupil `POST /bijak/papers/generate` is removed (S3-T07, FR-MUR-13-20):
 * it answers the framework 404; only the admin `POST /admin/papers/generate` generates. Every response body is `{ data }` or `{ error }`.
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
    description: `Mock method getCover(userId, paperId). A curated paper resolves for any permitted caller; a generated paper (kind jana) only for its creator. Section instruction defaults to "Jawab semua soalan." or "Jawab {n} soalan sahaja.". ${ROLE_NOTE}`,
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
    description: `Mock method listContracts(), S3-T01 (D76, PRD45 section 5.2): only the serving (Disahkan) version of each subject and kertas; a Spec or Draf contract is never listed, and a Spec head being edited over a Disahkan version shows that Disahkan version. Sections carry label and take only; the internal pool tag is not exposed. BJS-01: each row carries canGenerate, true for every listed row. A subject and kertas with no row: the UI shows "Belum ada kontrak untuk subjek dan kertas ini" (AC-03.6). ${ROLE_NOTE}`,
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
}
