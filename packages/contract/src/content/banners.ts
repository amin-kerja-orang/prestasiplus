import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { DateOnlySchema, TimestampSchema } from '../common/time'
import { listEnvelopeOf } from '../common/envelope'
import { httpUrl, optionalText, requiredText } from './common'

/**
 * M09 banners (admin #15-#19, dashboard carousel #20). Mock: `handlers/admin-banners.ts`,
 * `handlers/support.ts`. Codes are stored upper case (BR-M09-12).
 */

/** Form values of `bannerType` (FN-M09-4.2.4). A stored legacy code (`FEATURE`, `PROMOTIONAL`) can still exist. */
export const BANNER_TYPES = ['HERO', 'PROMO', 'ANNOUNCEMENT', 'EVENT'] as const
export const BANNER_LINK_TYPES = ['NONE', 'SUBJECT', 'QUIZ', 'ARTICLE', 'EXTERNAL'] as const
export const BANNER_AUDIENCES = ['ALL', 'STUDENT', 'TEACHER', 'ADMIN'] as const

export const BannerTypeSchema = z.enum(BANNER_TYPES).meta({ id: 'BannerType' })
export const BannerLinkTypeSchema = z.enum(BANNER_LINK_TYPES).meta({ id: 'BannerLinkType' })
export const BannerAudienceSchema = z.enum(BANNER_AUDIENCES).meta({ id: 'BannerAudience' })
export type BannerType = z.infer<typeof BannerTypeSchema>

/** Maximum banner description length (INFERRED hardening of the mock). */
export const BANNER_DESCRIPTION_MAX = 5_000

/** Item of `GET /banners/active` (#20); the dashboard maps `description` to its `body`. */
export const ActiveBannerSchema = z
  .strictObject({
    type: z.string().min(1).meta({ description: 'The banner type code (a form value or a stored legacy code).' }),
    title: z.string(),
    description: z.string().nullable(),
  })
  .meta({ id: 'BannerActive' })

/** A banner as the admin sees it (#15, #16 and the `data` of #17/#18). */
export const AdminBannerSchema = z
  .strictObject({
    id: IdSchema,
    title: z.string(),
    description: z.string().nullable(),
    imageUrl: z.string().nullable(),
    bannerType: z.string().min(1).meta({ description: 'Upper-case code; one of BANNER_TYPES or a stored legacy code (FEATURE, PROMOTIONAL).' }),
    linkType: z.string().min(1).meta({ description: 'Upper-case code; normally one of BANNER_LINK_TYPES.' }),
    externalUrl: z.string().nullable().meta({ description: 'Only kept when linkType is EXTERNAL.' }),
    targetAudience: z.string().min(1).meta({ description: 'Upper-case code; normally one of BANNER_AUDIENCES.' }),
    displayOrder: z.number().int().min(0),
    startDate: DateOnlySchema.nullable(),
    endDate: DateOnlySchema.nullable(),
    isActive: z.boolean(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .meta({ id: 'AdminBanner' })
export type AdminBanner = z.infer<typeof AdminBannerSchema>

const endNotBeforeStart = (b: { startDate?: string | null; endDate?: string | null }) =>
  b.startDate == null || b.endDate == null || b.endDate >= b.startDate

const bannerBaseShape = {
  title: requiredText(255),
  description: optionalText(BANNER_DESCRIPTION_MAX),
  imageUrl: httpUrl().nullable().optional().meta({ description: 'Absolute http(s) URL. Blank or null clears it.' }),
  bannerType: BannerTypeSchema,
  linkType: BannerLinkTypeSchema.optional().meta({ description: 'Default NONE on create.' }),
  externalUrl: httpUrl().nullable().optional().meta({ description: 'Required (absolute http(s) URL) when linkType is EXTERNAL; ignored otherwise.' }),
  targetAudience: BannerAudienceSchema.optional().meta({ description: 'Default ALL on create.' }),
  displayOrder: z.number().int().min(0).nullable().optional().meta({ description: 'Default 0 on create.' }),
  startDate: DateOnlySchema.nullable().optional(),
  endDate: DateOnlySchema.nullable().optional().meta({ description: 'Not before startDate.' }),
  isActive: z.boolean().optional().meta({ description: 'Default true on create.' }),
}

/**
 * Create body (#17). The mock upper-cases the three codes before checking them; the contract
 * documents the canonical upper-case values.
 */
export const AdminBannerCreateRequestSchema = z
  .object(bannerBaseShape)
  .refine(endNotBeforeStart, { error: 'Medan ini tidak sah.', path: ['endDate'] })
  .refine((b) => b.linkType !== 'EXTERNAL' || (b.externalUrl != null && b.externalUrl !== ''), {
    error: 'Medan ini diperlukan.',
    path: ['externalUrl'],
  })
  .meta({ id: 'AdminBannerCreateRequest' })

/** Code of an update body: a form value or the banner's own stored code (BR-M09-13, DV-M09-07). */
const storedCode = (values: readonly string[]) =>
  z
    .string()
    .min(1)
    .max(32)
    .meta({ description: `A form value (${values.join(', ')}) or the banner's own stored code (so a legacy FEATURE / PROMOTIONAL banner can be saved unchanged). Checked by the server.` })

/**
 * Update body (#18): every field optional (an absent field keeps its value). The three codes accept
 * the banner's own stored code besides the form values, so they are plain strings here.
 */
export const AdminBannerUpdateRequestSchema = z
  .object({
    ...bannerBaseShape,
    bannerType: storedCode(BANNER_TYPES),
    linkType: storedCode(BANNER_LINK_TYPES).optional(),
    targetAudience: storedCode(BANNER_AUDIENCES).optional(),
  })
  .partial()
  .refine(endNotBeforeStart, { error: 'Medan ini tidak sah.', path: ['endDate'] })
  .meta({ id: 'AdminBannerUpdateRequest' })

export const ActiveBannerListResponseSchema = listEnvelopeOf(ActiveBannerSchema)
export const AdminBannerListResponseSchema = listEnvelopeOf(AdminBannerSchema)
