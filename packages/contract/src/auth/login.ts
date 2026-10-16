import { z } from '../zod'
import { IdSchema } from '../common/ids'

/** Candidate school listed in `details.schools` of an AMBIGUOUS_USERNAME error. */
export const LoginSchoolCandidateSchema = z
  .object({ id: IdSchema, name: z.string().min(1) })
  .meta({ id: 'LoginSchoolCandidate' })
export type LoginSchoolCandidate = z.infer<typeof LoginSchoolCandidateSchema>

/**
 * POST /auth/login. `identifier` is an e-mail OR a username. A username that exists in several
 * schools needs `schoolId` (the .cloud /login school picker); e-mail logins ignore it. The body is
 * strict: unknown keys (a `role`, a `scope`) are rejected, never silently dropped.
 */
export const LoginRequestSchema = z
  .strictObject({
    identifier: z.string().trim().min(1).max(254).meta({ description: 'E-mail or username.' }),
    password: z.string().min(1).max(200),
    schoolId: IdSchema.optional().meta({
      description: 'Needed only when a username exists in more than one school.',
    }),
    remember: z.boolean().default(false),
  })
  .meta({ id: 'LoginRequest' })
export type LoginRequest = z.infer<typeof LoginRequestSchema>
