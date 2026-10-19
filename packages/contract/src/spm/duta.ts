import { z } from '../zod'

/**
 * Duta (ambassador) recommendation card (M06-14). Provisional hosting of an M24 endpoint: the same
 * path and body move to M24 unchanged. Only active `bintang` ambassadors are ever returned.
 */

export const DUTA_TIERS = ['bintang', 'inspirasi', 'tetamu'] as const
export const DutaTierSchema = z.enum(DUTA_TIERS).meta({ id: 'DutaTier' })
export type DutaTier = z.infer<typeof DutaTierSchema>

/**
 * `GET /duta/recommendations` query. With `seed` the pick is deterministic. With `subject` an
 * active `bintang` of that subject is preferred when one exists, otherwise any active `bintang`.
 * (The mock ignores a `seed` that is not an integer instead of refusing it.)
 */
export const DutaRecommendationQuerySchema = z
  .object({
    subject: z.string().optional().meta({ description: 'Subject name as on the card (e.g. "Matematik"); trimmed.' }),
    seed: z.coerce.number().int().optional(),
  })
  .meta({ id: 'DutaRecommendationQuery' })
export type DutaRecommendationQuery = z.infer<typeof DutaRecommendationQuerySchema>

export const DutaCardSchema = z
  .strictObject({
    slug: z.string().min(1),
    name: z.string().min(1),
    initials: z.string().min(1),
    tier: DutaTierSchema,
    tagline: z.string(),
    subject: z.string(),
    state: z.string(),
    rating: z.number().min(0).max(5),
    active: z.boolean(),
  })
  .meta({ id: 'DutaCard' })
export type DutaCard = z.infer<typeof DutaCardSchema>

/** `data` of `GET /duta/recommendations`: one card, or `null` when no `bintang` is active. */
export const DutaRecommendationSchema = DutaCardSchema.nullable().meta({ id: 'DutaRecommendation' })
export type DutaRecommendation = z.infer<typeof DutaRecommendationSchema>
