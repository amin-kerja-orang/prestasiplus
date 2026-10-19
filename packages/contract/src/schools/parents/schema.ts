import { z } from '../../zod'
import { IdSchema } from '../../common/ids'
import { TimestampSchema } from '../../common/time'

/**
 * L45 "Jemput Ibu Bapa" wire contract (BE-25, contract-only). Source: the mock handler
 * `m02-users-schools/mock/handlers/parent-invites.ts` and `api/parent-invite.ts`, realigned with
 * `v2-data-model.md` and decisions D57(a), D57(b) and D57(f) (security defaults, PDPA for minors).
 * Ids are opaque strings; timestamps are `+08:00`. The token hash and `legacy_*` never appear.
 *
 * Token model (server-enforced, D57f): the invite token is random (256 bits), stored only as a hash,
 * single-use and expiring after at most PARENT_INVITE_TTL_DAYS. The clear token appears only in the
 * response that issues it (`Cache-Control: no-store`). Accepting consumes the token; a second parent
 * (for example the other parent) needs a newly issued token. Unknown, used, expired and
 * inactive-student tokens are one indistinguishable 404.
 */

/** Exact BM copy of the mock. */
export const PARENT_INVITE_MESSAGES = {
  regenerated: 'Link jemputan baru telah dijana!',
} as const

/** Maximum lifetime of an invite token (the server may use a shorter one). */
export const PARENT_INVITE_TTL_DAYS = 7
/** `parent_links.relationship` is free text without a CHECK (OQ-DM-15). */
export const PARENT_RELATIONSHIP_MAX = 50
export const PARENT_LINKS_PAGE_SIZE = 50

/** 64 lowercase hex characters (the mock token). The server stores only its hash. */
export const ParentInviteTokenSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, 'Token must be 64 lowercase hex characters')
  .meta({
    id: 'ParentInviteToken',
    description: 'Random single-use invite token. Returned in clear only by the response that issues it; the server stores a hash.',
  })

export const ParentRelationshipSchema = z
  .string()
  .trim()
  .min(1)
  .max(PARENT_RELATIONSHIP_MAX)
  .meta({ id: 'ParentRelationship', description: 'Free text (for example "Ibu"); value set undecided (OQ-DM-15).' })

/** Masked e-mail, for example `a***@example.test`: first character, `***`, then the domain. */
export const ParentEmailMaskedSchema = z
  .string()
  .regex(/^.\*{3}@.+$/, 'E-mail must be masked as x***@domain')
  .meta({ id: 'ParentEmailMasked', example: 'i***@example.test', description: 'The parent e-mail is never shown in clear to the student.' })

/** A parent linked to the student, as the student sees it (no clear e-mail). */
export const ParentInviteLinkedParentSchema = z
  .object({
    linkId: IdSchema.meta({ description: 'Id of the link; used to unlink.' }),
    id: IdSchema.meta({ description: 'Id of the parent user.' }),
    name: z.string().min(1),
    emailMasked: ParentEmailMaskedSchema,
    relationship: z.string().nullable().meta({ description: 'Added in v2; null for links created without one.' }),
    linkedAt: TimestampSchema,
  })
  .meta({ id: 'ParentInviteLinkedParent' })

/**
 * GET /me/parent-invite (D58): the invite status only. It never carries a token (strict object: a
 * `token` key is rejected), because the server keeps only a hash. `Cache-Control: no-store`.
 */
export const ParentInviteStatusSchema = z
  .strictObject({
    hasToken: z.boolean().meta({ description: 'True while a live (unused, unexpired) token exists.' }),
    createdAt: TimestampSchema.nullable(),
    expiresAt: TimestampSchema.nullable().meta({ description: `At most ${String(PARENT_INVITE_TTL_DAYS)} days after createdAt; null without a token.` }),
    parents: z.array(ParentInviteLinkedParentSchema),
  })
  .meta({ id: 'ParentInviteStatus' })

/**
 * POST /me/parent-invite (D58): issues a NEW token and invalidates the old one. The clear token
 * appears only in this response. `status` is inside `data` (mock shape). `Cache-Control: no-store`.
 */
export const ParentInviteGeneratedSchema = z
  .object({
    token: ParentInviteTokenSchema,
    createdAt: TimestampSchema,
    expiresAt: TimestampSchema,
    status: z.literal(PARENT_INVITE_MESSAGES.regenerated),
  })
  .meta({ id: 'ParentInviteGenerated' })

export const ParentInviteTokenParamSchema = z
  .object({
    token: z
      .string()
      .min(1)
      .max(200)
      .meta({ description: 'Any non-empty string is routed; an unknown, used or expired token, or an inactive student, is one 404.' }),
  })
  .meta({ id: 'ParentInviteTokenParam' })

export const PARENT_INVITE_VIEWERS = ['guest', 'parent', 'other'] as const
export const ParentInviteViewerSchema = z.enum(PARENT_INVITE_VIEWERS).meta({ id: 'ParentInviteViewer' })

/**
 * GET /parent-invites/{token} (public). Minimal disclosure (D57f): the child's first name and the
 * school only. The mock also returned the full name and initials; those are dropped.
 * `Cache-Control: no-store`, rate limited (429).
 */
export const ParentInvitePreviewSchema = z
  .object({
    valid: z.literal(true),
    student: z.object({
      firstName: z.string().min(1).meta({ description: 'First given name only.' }),
      schoolName: z.string().nullable(),
    }),
    viewer: ParentInviteViewerSchema,
  })
  .meta({ id: 'ParentInvitePreview' })

/** POST /parent-invites/{token}/accept body. The mock has no body; `relationship` is added in v2. */
export const ParentInviteAcceptRequestSchema = z
  .object({ relationship: ParentRelationshipSchema.optional() })
  .meta({ id: 'ParentInviteAcceptRequest' })

/**
 * Accepting consumes the token, creates the link and notifies the student and the school (BE-06
 * notifications; the server does it, not the client). `created` is false when the pair was already
 * linked: the token is still consumed. Consent: the parent is the logged-in `parent` account and
 * `acceptedAt` is the consent record (undecided rule, see the open question on parent consent).
 */
export const ParentInviteAcceptResultSchema = z
  .object({
    linked: z.literal(true),
    created: z.boolean(),
    linkId: IdSchema,
    student: z.object({ id: IdSchema, name: z.string().min(1), schoolName: z.string().nullable() }),
    parent: z.object({ name: z.string().min(1) }),
    relationship: z.string().nullable(),
    acceptedAt: TimestampSchema,
  })
  .meta({ id: 'ParentInviteAcceptResult' })

/**
 * A parent-child link (PDPA for minors, D57f). Own links: the student sees the parents (e-mail
 * masked), the parent sees the children. The school admin sees links of students of the own school
 * (out of scope is 404); `admin` sees all.
 */
export const ParentLinkSchema = z
  .object({
    linkId: IdSchema,
    parent: z.object({ id: IdSchema, name: z.string().min(1), emailMasked: ParentEmailMaskedSchema }),
    student: z.object({ id: IdSchema, name: z.string().min(1), schoolName: z.string().nullable() }),
    relationship: z.string().nullable(),
    linkedAt: TimestampSchema,
  })
  .meta({ id: 'ParentLink' })

export const ParentLinkIdParamSchema = z
  .object({ linkId: IdSchema })
  .meta({ id: 'ParentLinkIdParam' })

export const ParentLinkListQuerySchema = z
  .object({
    studentId: z.string().max(64).optional(),
    parentId: z.string().max(64).optional(),
    page: z.string().optional().meta({ description: 'Never rejected: a bad value is page 1. Fixed page size 50.' }),
  })
  .meta({ id: 'ParentLinkListQuery' })

