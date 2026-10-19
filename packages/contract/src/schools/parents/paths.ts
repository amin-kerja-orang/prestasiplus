import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../../zod'
import { envelopeOf, listEnvelopeOf } from '../../common/envelope'
import { ErrorBodySchema } from '../../common/error'
import { NoStoreHeaderSchema, RateLimitedBodySchema, RetryAfterHeaderSchema } from '../subscriptions/validation'
import {
  ParentEmailMaskedSchema,
  ParentInviteAcceptRequestSchema,
  ParentInviteAcceptResultSchema,
  ParentInviteGeneratedSchema,
  ParentInviteLinkedParentSchema,
  ParentInvitePreviewSchema,
  ParentInviteTokenParamSchema,
  ParentInviteTokenSchema,
  ParentInviteStatusSchema,
  ParentInviteViewerSchema,
  ParentLinkIdParamSchema,
  ParentLinkListQuerySchema,
  ParentLinkSchema,
  ParentRelationshipSchema,
} from './schema'

/** Components contributed by BE-25 (parent invites and links); appended to COMPONENT_SCHEMAS in openapi.ts. */
export const PARENT_INVITE_COMPONENT_SCHEMAS = {
  ParentInviteToken: ParentInviteTokenSchema,
  ParentRelationship: ParentRelationshipSchema,
  ParentEmailMasked: ParentEmailMaskedSchema,
  ParentInviteLinkedParent: ParentInviteLinkedParentSchema,
  ParentInviteStatus: ParentInviteStatusSchema,
  ParentInviteGenerated: ParentInviteGeneratedSchema,
  ParentInviteTokenParam: ParentInviteTokenParamSchema,
  ParentInviteViewer: ParentInviteViewerSchema,
  ParentInvitePreview: ParentInvitePreviewSchema,
  ParentInviteAcceptRequest: ParentInviteAcceptRequestSchema,
  ParentInviteAcceptResult: ParentInviteAcceptResultSchema,
  ParentLink: ParentLinkSchema,
  ParentLinkIdParam: ParentLinkIdParamSchema,
  ParentLinkListQuery: ParentLinkListQuerySchema,
} as const

const json = (schema: z.ZodType, description: string, headers?: z.ZodObject) => ({
  description,
  content: { 'application/json': { schema } },
  ...(headers ? { headers } : {}),
})
const err = (description: string) => json(ErrorBodySchema, description)
const noStore = NoStoreHeaderSchema
const csrfHeader = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on authenticated mutating requests.' }),
})

/** Registers the L45 invite endpoints and the link list and unlink endpoints. */
export function registerParentInvitePaths(registry: OpenAPIRegistry): void {
  const tags = ['parent-invites']
  const unauthorized = err('UNAUTHORIZED: no valid session.')
  const forbidden = err('FORBIDDEN (wrong role) or CSRF_INVALID on mutations.')
  const notFound = err('NOT_FOUND: unknown, used or expired token, or its student is not an active student (one indistinguishable 404).')
  const limited = json(RateLimitedBodySchema, 'RATE_LIMITED, with retryAfter and the Retry-After header.', RetryAfterHeaderSchema)

  registry.registerPath({
    method: 'get',
    path: '/me/parent-invite',
    tags,
    summary: 'Invite status and my linked parents (student only)',
    description:
      'Returns only whether a live token exists and its expiresAt; it never returns a token (the server keeps only a hash). Linked parents show a masked e-mail. Cache-Control: no-store.',
    responses: {
      200: json(envelopeOf(ParentInviteStatusSchema), 'The status.', noStore),
      401: unauthorized,
      403: forbidden,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/me/parent-invite',
    tags,
    summary: 'Issue a new invite token (student only); replaces the former /generate route',
    description:
      'Issues a new single-use token and invalidates the old one at once. The clear token appears only in this response. data.status is "Link jemputan baru telah dijana!". The token expires after at most 7 days. Needs X-CSRF-Token. Cache-Control: no-store. Rate limited (token churn).',
    request: { headers: [csrfHeader] },
    responses: {
      200: json(envelopeOf(ParentInviteGeneratedSchema), 'New token.', noStore),
      401: unauthorized,
      403: forbidden,
      429: limited,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/parent-invites/{token}',
    tags,
    summary: 'Preview an invite (public; session optional)',
    description:
      'Minimal disclosure: the child first name and school only. `viewer` is derived from the session role. Cache-Control: no-store. Rate limited per IP; the raw path is never logged.',
    request: { params: ParentInviteTokenParamSchema },
    responses: { 200: json(envelopeOf(ParentInvitePreviewSchema), 'The minimal child info.', noStore), 404: notFound, 429: limited },
  })

  registry.registerPath({
    method: 'post',
    path: '/parent-invites/{token}/accept',
    tags,
    summary: 'Accept an invite and link to the student (parent only)',
    description:
      'Consumes the token (single use): a replay is 404. Creates the link, or answers `created: false` when the pair already exists (the token is still consumed). The server notifies the student and the school. 401/403 are decided before the token is looked up. Cache-Control: no-store. Rate limited.',
    request: {
      params: ParentInviteTokenParamSchema,
      body: { required: false, content: { 'application/json': { schema: ParentInviteAcceptRequestSchema } } },
    },
    responses: {
      200: json(envelopeOf(ParentInviteAcceptResultSchema), 'Linked.', noStore),
      401: unauthorized,
      403: forbidden,
      404: notFound,
      422: err('VALIDATION_ERROR with `fields.relationship`.'),
      429: limited,
    },
  })

  const linkTags = ['parent-links']
  registry.registerPath({
    method: 'get',
    path: '/me/parent-links',
    tags: linkTags,
    summary: 'My parent-child links (student: my parents; parent: my children)',
    description: 'Student view masks the parent e-mail. Cache-Control: no-store.',
    responses: { 200: json(envelopeOf(z.array(ParentLinkSchema)), 'Own links.', noStore), 401: unauthorized, 403: forbidden },
  })

  registry.registerPath({
    method: 'delete',
    path: '/me/parent-links/{linkId}',
    tags: linkTags,
    summary: 'Unlink: the student or the parent removes their own link',
    description: 'The link must belong to the caller, else 404. Audited (actor, link). Rate limited.',
    request: { params: ParentLinkIdParamSchema },
    responses: { 204: { description: 'Removed. No body.' }, 401: unauthorized, 403: forbidden, 404: err('NOT_FOUND.'), 429: limited },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/parent-links',
    tags: linkTags,
    summary: 'Parent-child links (admin: all; school_admin: students of the own school)',
    request: { query: ParentLinkListQuerySchema },
    responses: { 200: json(listEnvelopeOf(ParentLinkSchema), 'A page.', noStore), 401: unauthorized, 403: forbidden },
  })

  registry.registerPath({
    method: 'delete',
    path: '/admin/parent-links/{linkId}',
    tags: linkTags,
    summary: 'Unlink as admin or school_admin',
    description: 'A school_admin may remove only links of students of the own school; any other id is 404 (never 403). Audited (actor, role, link). Rate limited.',
    request: { params: ParentLinkIdParamSchema },
    responses: { 204: { description: 'Removed. No body.' }, 401: unauthorized, 403: forbidden, 404: err('NOT_FOUND.'), 429: limited },
  })
}
