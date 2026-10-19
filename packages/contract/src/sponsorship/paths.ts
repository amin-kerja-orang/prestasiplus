import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { envelopeOf } from '../common/envelope'
import {
  FosterApplicationCreatedSchema,
  FosterApplicationInputSchema,
  KeluargaAngkatCategorySchema,
  KeluargaAngkatIncomeRangeSchema,
} from './schema'

/** Components contributed by BE-47 (M21 student side); appended to COMPONENT_SCHEMAS in openapi.ts. */
export const SPONSORSHIP_COMPONENT_SCHEMAS = {
  KeluargaAngkatCategory: KeluargaAngkatCategorySchema,
  KeluargaAngkatIncomeRange: KeluargaAngkatIncomeRangeSchema,
  KeluargaAngkatApplicationInput: FosterApplicationInputSchema,
  KeluargaAngkatApplicationCreated: FosterApplicationCreatedSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)

/** Registers the one student-side M21 endpoint. Bodies are `{ data }` or `{ error }`. */
export function registerSponsorshipPaths(registry: OpenAPIRegistry): void {
  const csrf = z.object({
    'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
  })

  registry.registerPath({
    method: 'post',
    path: '/mohon-keluarga-angkat',
    tags: ['sponsorship'],
    summary: 'Apply for a foster family (Mohon Keluarga Angkat)',
    description:
      'Any signed-in role (student, parent, teacher, admin). The applicant user id and role come from the session; applicantUserId or applicantRole in the body are ignored. ' +
      'The studentEmail must be the e-mail of an existing user with role student (surrounding spaces trimmed; letter case as the user lookup treats it). ' +
      'Inserts one application with status `pending` and createdAt = now. No duplicate check (the same student and applicant may apply again), no notification, no e-mail. ' +
      'Write-only: the category, income range and reason of a minor are never returned by any route and never logged. ' +
      'The success text "Permohonan anda telah dihantar. Admin akan menyemak permohonan dalam 1-3 hari bekerja." is shown by the client, not returned. ' +
      'Security note (OQ-API-B4-20): the studentEmail 422 tells a signed-in caller whether an e-mail belongs to a student, so the route is to be rate limited (RATE_LIMITED 429, BE-33).',
    request: {
      headers: [csrf],
      body: { required: true, content: { 'application/json': { schema: FosterApplicationInputSchema } } },
    },
    responses: {
      201: json(envelopeOf(FosterApplicationCreatedSchema), 'Application stored as pending. Only the new id is returned.'),
      401: err('UNAUTHORIZED "Unauthenticated." (no valid session).'),
      403: err('CSRF_INVALID (missing or wrong X-CSRF-Token).'),
      422: err(
        'VALIDATION_ERROR with `fields`, collected for all fields and returned together, inserted in the order studentEmail, studentCategory, familyIncomeRange, reason. ' +
          'studentEmail: "Sila isi ruangan ini." (blank or not a string), "Format e-mel tidak sah.", "Email pelajar tidak dijumpai dalam PrestasiPlus." (no existing user with that e-mail and role student; the same text for a teacher, a parent or an unknown e-mail). ' +
          'studentCategory: "Sila isi ruangan ini." (empty or not a string), "Pilihan tidak sah." (not one of the five values). ' +
          'familyIncomeRange: "Pilihan tidak sah." (a non-empty string outside the four values; missing, null, "" or a non-string is "not given", no error). ' +
          'reason: "Sila isi ruangan ini." (blank after trim or not a string). ' +
          'Top-level message = the first field message plus " (and N more error(s))" when several fields fail.',
      ),
      429: err('RATE_LIMITED, with retryAfter (planned, BE-33; the mock has no limit).'),
      500: err('SERVER_ERROR. The client shows its own line "Ralat berlaku. Sila cuba lagi." for any non-field failure.'),
    },
  })
}
