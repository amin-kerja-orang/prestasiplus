import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { envelopeOf, listEnvelopeOf } from '../common/envelope'
import { ErrorBodySchema } from '../common/error'
import { IdSchema } from '../common/ids'
import { QUESTION_STIMULUS_KINDS, QuestionRichTextSchema, QuestionStimulusGroupSchema, QuestionStimulusKindSchema, QuestionStimulusTableSchema } from './parts'
import { QuestionCreateRequestSchema, QuestionSchema, mutationEnvelopeOf } from './schema'

/**
 * R1-T32 (D90): admin HTTP API to author stimuli and stimulus groups for the Studio (V2 "Langkah 2 Rangsangan": `Jenis rangsangan`,
 * `Kapsyen (pilihan)`, editor body, image). A stimulus is one figure / passage / table; a group (1 to 3 stimuli) keeps the questions
 * that share it. A group carries no marks and is never a question; a shared stimulus is shown ONCE with all its member questions.
 *
 * All BM copy lives in `STIMULUS_MESSAGES`; failures are one 422 `VALIDATION_ERROR` with `fields` like the question routes.
 */

export const STIMULUS_MESSAGES = {
  created: 'Rangsangan berjaya ditambah.',
  updated: 'Rangsangan berjaya dikemaskini.',
  deleted: 'Rangsangan berjaya dipadam.',
  groupCreated: 'Kumpulan rangsangan berjaya dicipta.',
  groupUpdated: 'Kumpulan rangsangan berjaya dikemaskini.',
  groupDeleted: 'Kumpulan rangsangan berjaya dibubarkan. Soalan ahli kekal, tanpa rangsangan bersama.',
  memberAdded: 'Soalan berjaya ditambah ke dalam kumpulan.',
  memberRemoved: 'Soalan berjaya dikeluarkan daripada kumpulan.',
  membersReordered: 'Susunan soalan dalam kumpulan berjaya dikemaskini.',
  questionAdded: 'Soalan berjaya ditambah ke dalam kumpulan.',
  notFound: 'Rangsangan tidak dijumpai.',
  groupNotFound: 'Kumpulan rangsangan tidak dijumpai.',
  kind: 'Sila pilih jenis rangsangan.',
  bodyRequired: 'Petikan mesti mempunyai teks.',
  imageRequired: 'Sila muat naik imej untuk rangsangan ini.',
  tableRequired: 'Jadual mesti mempunyai kepala dan sekurang-kurangnya satu baris, atau imej.',
  image: 'Imej tidak sah. Muat naik semula.',
  noChange: 'Tiada perubahan untuk disimpan.',
  inUse: 'Rangsangan ini sedang digunakan oleh kumpulan atau soalan. Keluarkan daripada penggunaan dahulu.',
  stimuliCount: 'Satu kumpulan mesti mempunyai 1 hingga 3 rangsangan.',
  stimuliInvalid: 'Rangsangan tidak sah atau berulang.',
  /** The paper builder blocker for a group with fewer than 2 questions (D93). */
  builderBlocker: 'Kumpulan perlu sekurang-kurangnya 2 soalan.',
  membersTooMany: 'Satu kumpulan boleh mempunyai paling banyak 40 soalan.',
  memberMixed: 'Soalan dalam satu kumpulan mesti sama subjek.',
  /** Members of one group share the kertas when it is set (a question with no kertas is compatible with any). */
  memberKertas: 'Soalan dalam satu kumpulan mesti sama kertas.',
  /** `stimulusGroupId` names a group that does not exist (422 on the field). */
  groupInvalid: 'Kumpulan stimulus tidak sah.',
  /** List queries (R1-T49). */
  page: 'Halaman tidak sah.',
  pageSize: 'Saiz halaman mesti antara 1 dan 100.',
  filter: 'Nilai penapis tidak sah.',
  search: 'Carian tidak boleh melebihi 100 aksara.',
  memberInactive: 'Soalan yang diarkibkan atau dinyahaktifkan tidak boleh dimasukkan ke dalam kumpulan.',
  memberServed: 'Soalan ini sedang dipaparkan kepada murid. Sunting sebagai draf atau arkibkannya dahulu sebelum memasukkannya ke dalam kumpulan.',
  groupServed: 'Kumpulan ini mempunyai soalan yang sedang dipaparkan kepada murid. Soalan itu tidak boleh dikeluarkan atau disusun semula, dan kumpulan tidak boleh diubah rangsangannya atau dibubarkan. Sunting soalan sebagai draf atau arkibkannya dahulu.',
  stimulusServed: 'Rangsangan ini sedang dipaparkan kepada murid melalui soalan yang diterbitkan. Cipta rangsangan baharu dan gunakan pada draf soalan, atau arkibkan soalan itu dahulu.',
  membersInvalid: 'Soalan tidak sah, berulang atau tidak boleh dikumpulkan.',
  memberTaken: 'Soalan ini sudah berada dalam kumpulan rangsangan lain.',
  memberExists: 'Soalan ini sudah berada dalam kumpulan ini.',
  memberMissing: 'Soalan ini bukan ahli kumpulan ini.',
  orderInvalid: 'Susunan mesti menyenaraikan semua soalan kumpulan tepat sekali.',
  groupMismatch: 'Kumpulan dalam badan permintaan tidak sepadan dengan laluan.',
  /** A 200 `warning`, not an error: the removal went through. */
  smallGroup: (n: number): string =>
    n === 0
      ? 'Kumpulan ini kini kosong. Bubarkan kumpulan jika rangsangan ini tidak diperlukan lagi.'
      : `Kumpulan ini kini hanya mempunyai ${String(n)} soalan. Rangsangan bersama lazimnya untuk sekurang-kurangnya 2 soalan.`,
} as const

/** Bounds (BE-NFR-25): every free text field is capped. */
export const STIMULUS_LIMITS = { label: 100, caption: 300, alt: 1000, source: 300, body: 20_000, cell: 500, columns: 12, rows: 60, groupQuestions: 40, optionBank: 8 } as const

/** Kinds that show a picture: the file is the content (inline SVG is never writable, stored-XSS rule). */
export const IMAGE_STIMULUS_KINDS = ['image', 'diagram', 'map', 'infographic', 'graph'] as const

const Label = z.string().trim().max(STIMULUS_LIMITS.label)
const Caption = z.string().trim().max(STIMULUS_LIMITS.caption)
const Alt = z.string().trim().max(STIMULUS_LIMITS.alt)
const Source = z.string().trim().max(STIMULUS_LIMITS.source)
const Body = z.object({ ms: z.string().min(1).max(STIMULUS_LIMITS.body), en: z.string().max(STIMULUS_LIMITS.body).optional() })
const Table = z.object({
  head: z.array(z.string().max(STIMULUS_LIMITS.cell)).min(1).max(STIMULUS_LIMITS.columns),
  rows: z.array(z.array(z.string().max(STIMULUS_LIMITS.cell)).max(STIMULUS_LIMITS.columns)).min(1).max(STIMULUS_LIMITS.rows),
})

const imageFile = z.string().min(1).max(64).meta({ description: 'Public token (or id) of a file uploaded with `POST /files?purpose=question_image`.' })

/** `POST /stimuli`. Strict: an unknown key (for example `svg`) is a 422. */
export const StimulusCreateRequestSchema = z
  .strictObject({
    kind: z.enum(QUESTION_STIMULUS_KINDS, { error: STIMULUS_MESSAGES.kind }).meta({ description: 'V2 `Jenis rangsangan` (default passage in the Studio).' }),
    label: Label.nullish(),
    caption: Caption.nullish().meta({ description: 'V2 `Kapsyen (pilihan)`.' }),
    body: Body.nullish(),
    alt: Alt.nullish(),
    sourceCitation: Source.nullish(),
    tableData: Table.nullish(),
    imageFileId: imageFile.nullish(),
  })
  .superRefine((v, ctx) => {
    const bad = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (v.kind === 'passage' && !v.body) bad('body', STIMULUS_MESSAGES.bodyRequired)
    if (v.kind === 'table' && !v.tableData && !v.imageFileId) bad('tableData', STIMULUS_MESSAGES.tableRequired)
    if ((IMAGE_STIMULUS_KINDS as readonly string[]).includes(v.kind) && !v.imageFileId) bad('imageFileId', STIMULUS_MESSAGES.imageRequired)
  })
  .meta({ id: 'StimulusCreateRequest' })
export type StimulusCreateRequest = z.infer<typeof StimulusCreateRequestSchema>

/** `PUT /stimuli/{id}`: only the keys sent change; `null` clears an optional field. The kind never changes. */
export const StimulusUpdateRequestSchema = z
  .strictObject({
    label: Label.nullable().optional(),
    caption: Caption.nullable().optional(),
    body: Body.nullable().optional().meta({ description: 'Replaces the whole text (ms and en): send both languages to keep both; null clears (only allowed when the kind does not need it).' }),
    alt: Alt.nullable().optional(),
    sourceCitation: Source.nullable().optional(),
    tableData: Table.nullable().optional(),
    imageFileId: imageFile.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: STIMULUS_MESSAGES.noChange, path: ['_'] })
  .meta({ id: 'StimulusUpdateRequest' })
export type StimulusUpdateRequest = z.infer<typeof StimulusUpdateRequestSchema>

/** A stimulus as the Studio reads it. `imageId` is the public file token (download at `/api/files/<token>`). */
export const StimulusSchema = z
  .object({
    id: IdSchema,
    kind: QuestionStimulusKindSchema,
    label: z.string(),
    caption: z.string().nullable(),
    body: QuestionRichTextSchema.nullable(),
    alt: z.string().nullable(),
    sourceCitation: z.string().nullable(),
    tableData: QuestionStimulusTableSchema.nullable(),
    imageId: z.string().nullable(),
    groupCount: z.number().int().min(0).meta({ description: 'Groups that show this stimulus. A stimulus in use cannot be deleted.' }),
  })
  .meta({ id: 'Stimulus' })
export type Stimulus = z.infer<typeof StimulusSchema>

export const StimulusDeleteResultSchema = z.object({ deleted: z.literal(1) }).meta({ id: 'StimulusDeleteResult' })

const GroupLabel = z.string().trim().max(STIMULUS_LIMITS.label)
const OptionBank = z
  .array(z.object({ label: z.string().regex(/^[A-H]$/), body: QuestionRichTextSchema }))
  .max(STIMULUS_LIMITS.optionBank)

/** `POST /stimulus-groups`: 1 to 3 existing stimuli and 0 to 40 existing questions (D90, D93: the Studio makes the group first, then adds the questions). No marks anywhere. */
export const StimulusGroupCreateRequestSchema = z
  .strictObject({
    label: GroupLabel.nullish(),
    scope: z.enum(['section', 'paper']).optional(),
    stimulusIds: z.array(IdSchema).min(1, STIMULUS_MESSAGES.stimuliCount).max(3, STIMULUS_MESSAGES.stimuliCount),
    questionIds: z.array(IdSchema).max(STIMULUS_LIMITS.groupQuestions, STIMULUS_MESSAGES.membersTooMany).default([]).meta({
      description: 'D93: 0 or more existing questions (a group with fewer than 2 is a draft group; every write answers with `warning` until it has 2).',
    }),
    optionBank: OptionBank.optional(),
  })
  .meta({ id: 'StimulusGroupCreateRequest' })
export type StimulusGroupCreateRequest = z.infer<typeof StimulusGroupCreateRequestSchema>

/** `PUT /stimulus-groups/{id}`: relabel and/or replace the ordered stimuli (1 to 3). Members are changed by the member routes. */
export const StimulusGroupUpdateRequestSchema = z
  .strictObject({
    label: GroupLabel.nullable().optional(),
    stimulusIds: z.array(IdSchema).min(1, STIMULUS_MESSAGES.stimuliCount).max(3, STIMULUS_MESSAGES.stimuliCount).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: STIMULUS_MESSAGES.noChange, path: ['_'] })
  .meta({ id: 'StimulusGroupUpdateRequest' })
export type StimulusGroupUpdateRequest = z.infer<typeof StimulusGroupUpdateRequestSchema>

export const StimulusGroupMemberRequestSchema = z.strictObject({ questionId: IdSchema }).meta({ id: 'StimulusGroupMemberRequest' })
export const StimulusGroupReorderRequestSchema = z
  .strictObject({ questionIds: z.array(IdSchema).min(1).max(STIMULUS_LIMITS.groupQuestions) })
  .meta({ id: 'StimulusGroupReorderRequest' })
/** `PUT /stimulus-groups/{id}/members`: the complete ordered member list after the change (adds, removals and reordering in one atomic call). */
export const StimulusGroupMembersSetRequestSchema = z
  .strictObject({ questionIds: z.array(IdSchema).max(STIMULUS_LIMITS.groupQuestions, STIMULUS_MESSAGES.membersTooMany) })
  .meta({ id: 'StimulusGroupMembersSetRequest' })

/** R1-T49: the short form of a group member, so the Studio does not fetch members one by one. */
export const STIMULUS_MEMBER_STEM_MAX = 120
export const StimulusGroupMemberSchema = z
  .object({
    id: IdSchema,
    numberLabel: z.string().nullable().meta({ description: 'Printed number label of the latest version, or null.' }),
    stem: z.string().meta({ description: `Plain text of the stem (markup stripped, whitespace collapsed), cut to ${String(STIMULUS_MEMBER_STEM_MAX)} characters with an ellipsis.` }),
    status: z.enum(['draft', 'review', 'approved', 'archived']).meta({ description: 'Status of the latest version.' }),
    servable: z.boolean().meta({ description: 'Shown to pupils now: active with an approved live version, or pinned by a published paper.' }),
  })
  .meta({ id: 'StimulusGroupMember' })
export type StimulusGroupMember = z.infer<typeof StimulusGroupMemberSchema>

/** The group with the read model of the question side (stimuli in order, member ids in published order) plus label and scope. */
export const StimulusGroupDetailSchema = z
  .object({
    id: IdSchema,
    label: z.string().nullable(),
    scope: z.enum(['section', 'paper']),
    stimuli: QuestionStimulusGroupSchema.shape.stimuli,
    optionBank: QuestionStimulusGroupSchema.shape.optionBank,
    questionIds: z.array(IdSchema),
    members: z.array(StimulusGroupMemberSchema).meta({ description: 'The members in published order (same order as `questionIds`), one short form each.' }),
    warning: z.string().nullable().optional().meta({ description: 'BM warning while the group has fewer than 2 questions (a draft group, D93); null otherwise. The write went through.' }),
  })
  .meta({ id: 'StimulusGroupDetail' })
export type StimulusGroupDetail = z.infer<typeof StimulusGroupDetailSchema>

export const StimulusGroupRemovedResultSchema = z
  .object({
    group: StimulusGroupDetailSchema,
    warning: z.string().nullable().meta({ description: 'BM warning when fewer than 2 members remain; the removal went through.' }),
  })
  .meta({ id: 'StimulusGroupMemberRemoved' })

export const StimulusGroupDeleteResultSchema = z.object({ deleted: z.literal(1), releasedQuestionIds: z.array(IdSchema) }).meta({ id: 'StimulusGroupDeleteResult' })


/* ------------------------------------------------------------------------------------- lists (R1-T49) */

export const STIMULUS_LIST_STATUSES = ['draft', 'served'] as const
export const STIMULUS_LIST_MAX_PAGE = 100_000
export const STIMULUS_LIST_SEARCH_MAX = 100
const listPage = z.coerce.number(STIMULUS_MESSAGES.page).int(STIMULUS_MESSAGES.page).min(1, STIMULUS_MESSAGES.page).max(STIMULUS_LIST_MAX_PAGE, STIMULUS_MESSAGES.page)
const listPageSize = z.coerce.number(STIMULUS_MESSAGES.pageSize).int(STIMULUS_MESSAGES.pageSize).min(1, STIMULUS_MESSAGES.pageSize).max(100, STIMULUS_MESSAGES.pageSize)
const listFilters = {
  page: listPage.default(1),
  pageSize: listPageSize.default(20),
  subjectId: IdSchema.optional().meta({ description: 'Subject of the members (the latest version).' }),
  educationLevelId: IdSchema.optional().meta({ description: 'Any member of this level.' }),
  status: z.enum(STIMULUS_LIST_STATUSES, STIMULUS_MESSAGES.filter).optional().meta({
    description: '`served` = a member (group) or a linked question version (stimulus) is shown to pupils now; `draft` = none is. Empty groups are `draft`.',
  }),
  q: z.string().max(STIMULUS_LIST_SEARCH_MAX, STIMULUS_MESSAGES.search).optional().meta({ description: 'Case-insensitive text in the label or body (a group: its own label or any of its stimuli). `%` and `_` are literal.' }),
}
/** `GET /stimulus-groups`: strict; unknown keys are 422. Empty values count as absent. */
export const StimulusGroupListQuerySchema = z.strictObject(listFilters).meta({ id: 'StimulusGroupListQuery' })
/** `GET /stimuli`: the same filters plus the kind. */
export const StimulusListQuerySchema = z
  .strictObject({ ...listFilters, kind: QuestionStimulusKindSchema.optional() })
  .meta({ id: 'StimulusListQuery' })
export type StimulusListQuery = z.infer<typeof StimulusListQuerySchema>
export type StimulusGroupListQuery = z.infer<typeof StimulusGroupListQuerySchema>

export const StimulusListRowSchema = z
  .object({
    id: IdSchema,
    kind: QuestionStimulusKindSchema,
    label: z.string(),
    caption: z.string().nullable(),
    excerpt: z.string().nullable().meta({ description: 'Plain text of the body, cut to 120 characters; null for a picture or a table with no text.' }),
    imageId: z.string().nullable(),
    groupCount: z.number().int().min(0),
    status: z.enum(STIMULUS_LIST_STATUSES),
  })
  .meta({ id: 'StimulusListRow' })
export type StimulusListRow = z.infer<typeof StimulusListRowSchema>

export const StimulusGroupListRowSchema = z
  .object({
    id: IdSchema,
    label: z.string().nullable(),
    scope: z.enum(['section', 'paper']),
    stimuli: z.array(z.object({ id: IdSchema, kind: QuestionStimulusKindSchema, label: z.string(), imageId: z.string().nullable() })),
    memberCount: z.number().int().min(0),
    members: z.array(StimulusGroupMemberSchema),
    status: z.enum(STIMULUS_LIST_STATUSES),
    warning: z.string().nullable(),
  })
  .meta({ id: 'StimulusGroupListRow' })
export type StimulusGroupListRow = z.infer<typeof StimulusGroupListRowSchema>

/** Components contributed by R1-T32 (appended to COMPONENT_SCHEMAS in openapi.ts). */
export const STIMULI_COMPONENT_SCHEMAS = {
  StimulusCreateRequest: StimulusCreateRequestSchema,
  StimulusUpdateRequest: StimulusUpdateRequestSchema,
  Stimulus: StimulusSchema,
  StimulusDeleteResult: StimulusDeleteResultSchema,
  StimulusGroupCreateRequest: StimulusGroupCreateRequestSchema,
  StimulusGroupUpdateRequest: StimulusGroupUpdateRequestSchema,
  StimulusGroupMemberRequest: StimulusGroupMemberRequestSchema,
  StimulusGroupReorderRequest: StimulusGroupReorderRequestSchema,
  StimulusGroupMembersSetRequest: StimulusGroupMembersSetRequestSchema,
  StimulusGroupDetail: StimulusGroupDetailSchema,
  StimulusGroupMember: StimulusGroupMemberSchema,
  StimulusListRow: StimulusListRowSchema,
  StimulusGroupListRow: StimulusGroupListRowSchema,
  StimulusGroupMemberRemoved: StimulusGroupRemovedResultSchema,
  StimulusGroupDeleteResult: StimulusGroupDeleteResultSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({ description, content: { 'application/json': { schema } } })
const err = (description: string) => json(ErrorBodySchema, description)
const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })
const idParams = z.object({ id: IdSchema })
const memberParams = z.object({ id: IdSchema, questionId: IdSchema })
const csrf = z.object({ 'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }) })
const unauthorized = err('UNAUTHORIZED: no valid session.')
const forbidden = err('FORBIDDEN (Admin Pusat only), or CSRF_INVALID when X-CSRF-Token is missing or wrong.')
const notFound = err('NOT_FOUND: unknown id.')
const conflict = err('CONFLICT: the stimulus is still used by a group or a question, or the change touches a question or stimulus that is shown to pupils (lifecycle first).')
const invalid = err('VALIDATION_ERROR: one response, `fields` keyed by input name (BM messages).')
const tags = ['questions', 'stimuli']

/** Registers the R1-T32 endpoints. Admin Pusat only (the question bank admin guard), writes rate limited with the question writes. */
export function registerStimuliPaths(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'post',
    path: '/stimuli',
    tags,
    summary: 'Create a stimulus (passage, image, diagram, table, map, infographic, graph)',
    description:
      'Pictures are ids of files already uploaded with `POST /files?purpose=question_image` (JPG/PNG/WebP up to 2MB); the file must have that purpose (422 `imageFileId` otherwise). Inline SVG / HTML is never written. `passage` needs `body`, `table` needs `tableData` or an image, the picture kinds need `imageFileId`. Flash: "Rangsangan berjaya ditambah."',
    request: { headers: [csrf], body: body(StimulusCreateRequestSchema) },
    responses: { 201: json(mutationEnvelopeOf(StimulusSchema), 'Created.'), 401: unauthorized, 403: forbidden, 422: invalid },
  })
  registry.registerPath({
    method: 'get',
    path: '/stimuli',
    tags,
    summary: 'List stimuli (paged)',
    description:
      'Admin Pusat only, no-store. Filters: `subjectId` / `educationLevelId` (of the questions that use the stimulus through a group or a version link), `status` (`served` or `draft`, see the query), `kind`, `q` (label / body, case-insensitive). `pageSize` 1 to 100 (101 is 422). Newest first.',
    request: { query: StimulusListQuerySchema },
    responses: { 200: json(listEnvelopeOf(StimulusListRowSchema), 'One page.'), 401: unauthorized, 403: forbidden, 422: invalid },
  })
  registry.registerPath({
    method: 'get',
    path: '/stimulus-groups',
    tags,
    summary: 'List stimulus groups with their members (paged)',
    description:
      'Admin Pusat only, no-store. Filters: `subjectId`, `educationLevelId` (any member), `status` (`served` = a member is shown to pupils, else `draft`), `q` (the group label or any of its stimuli). Each row carries the short form of its members, read with one query per page. `pageSize` 1 to 100 (101 is 422).',
    request: { query: StimulusGroupListQuerySchema },
    responses: { 200: json(listEnvelopeOf(StimulusGroupListRowSchema), 'One page.'), 401: unauthorized, 403: forbidden, 422: invalid },
  })
  registry.registerPath({
    method: 'get',
    path: '/stimuli/{id}',
    tags,
    summary: 'Read a stimulus',
    request: { params: idParams },
    responses: { 200: json(envelopeOf(StimulusSchema), 'The stimulus.'), 401: unauthorized, 403: forbidden, 404: notFound },
  })
  registry.registerPath({
    method: 'put',
    path: '/stimuli/{id}',
    tags,
    summary: 'Edit a stimulus (only the keys sent change; the kind never changes)',
    description: 'The result must still satisfy the kind rules of the create body. A stimulus that is shown to pupils (by a group with a served member, or linked to a served question) is refused with 409: follow the lifecycle (edit the question as a draft, or archive it) first.',
    request: { params: idParams, headers: [csrf], body: body(StimulusUpdateRequestSchema) },
    responses: { 200: json(mutationEnvelopeOf(StimulusSchema), 'Updated.'), 401: unauthorized, 403: forbidden, 404: notFound, 409: conflict, 422: invalid },
  })
  registry.registerPath({
    method: 'delete',
    path: '/stimuli/{id}',
    tags,
    summary: 'Delete a stimulus that nothing uses',
    description: 'A stimulus shown by a group, linked to a question version or used by a part is refused with 409 and the BM message.',
    request: { params: idParams, headers: [csrf] },
    responses: { 200: json(mutationEnvelopeOf(StimulusDeleteResultSchema), 'Deleted.'), 401: unauthorized, 403: forbidden, 404: notFound, 409: conflict },
  })

  registry.registerPath({
    method: 'post',
    path: '/stimulus-groups',
    tags,
    summary: 'Create a group: 1 to 3 stimuli and 0 to 40 member questions (D93: a group with fewer than 2 is a draft group)',
    description:
      'D90: the shared stimulus is one group shown once with all its member questions. A group carries no marks and is never a question. A question already in another group, a PKSK, archived or inactive question, a question of another subject or level, and a question that is already shown to pupils (live approved) are refused. While the group has fewer than 2 members every write answers with `warning`; such a group cannot be placed in a paper (builder blocker "Kumpulan perlu sekurang-kurangnya 2 soalan."). Members get positions 1..n in the order sent. Flash: "Kumpulan rangsangan berjaya dicipta."',
    request: { headers: [csrf], body: body(StimulusGroupCreateRequestSchema) },
    responses: { 201: json(mutationEnvelopeOf(StimulusGroupDetailSchema), 'Created.'), 401: unauthorized, 403: forbidden, 422: invalid },
  })
  registry.registerPath({
    method: 'get',
    path: '/stimulus-groups/{id}',
    tags,
    summary: 'Read a group (stimuli in order, member question ids in published order)',
    request: { params: idParams },
    responses: { 200: json(envelopeOf(StimulusGroupDetailSchema), 'The group.'), 401: unauthorized, 403: forbidden, 404: notFound },
  })
  registry.registerPath({
    method: 'put',
    path: '/stimulus-groups/{id}',
    tags,
    summary: 'Relabel a group and/or replace its ordered stimuli (1 to 3)',
    request: { params: idParams, headers: [csrf], body: body(StimulusGroupUpdateRequestSchema) },
    responses: { 200: json(mutationEnvelopeOf(StimulusGroupDetailSchema), 'Updated.'), 401: unauthorized, 403: forbidden, 404: notFound, 409: conflict, 422: invalid },
  })
  registry.registerPath({
    method: 'delete',
    path: '/stimulus-groups/{id}',
    tags,
    summary: 'Dissolve a group',
    description: 'The member questions stay, without the shared stimulus; the stimuli stay in the library.',
    request: { params: idParams, headers: [csrf] },
    responses: { 200: json(mutationEnvelopeOf(StimulusGroupDeleteResultSchema), 'Dissolved.'), 401: unauthorized, 403: forbidden, 404: notFound, 409: conflict },
  })
  registry.registerPath({
    method: 'post',
    path: '/stimulus-groups/{id}/members',
    tags,
    summary: 'Add a question to a group (appended at the end)',
    description: 'A question already in another group is refused with 422 `questionId` ("Soalan ini sudah berada dalam kumpulan rangsangan lain."). Moving a question between groups is remove, then add.',
    request: { params: idParams, headers: [csrf], body: body(StimulusGroupMemberRequestSchema) },
    responses: { 200: json(mutationEnvelopeOf(StimulusGroupDetailSchema), 'The group after the change.'), 401: unauthorized, 403: forbidden, 404: notFound, 409: conflict, 422: invalid },
  })
  registry.registerPath({
    method: 'delete',
    path: '/stimulus-groups/{id}/members/{questionId}',
    tags,
    summary: 'Remove a question from a group',
    description: 'Positions of the others close up. When fewer than 2 members remain the removal still succeeds and `warning` carries a BM message ("Kumpulan ini kini hanya mempunyai 1 soalan. ...").',
    request: { params: memberParams, headers: [csrf] },
    responses: { 200: json(mutationEnvelopeOf(StimulusGroupRemovedResultSchema), 'The group after the change, with an optional warning.'), 401: unauthorized, 403: forbidden, 404: notFound, 409: conflict },
  })
  registry.registerPath({
    method: 'put',
    path: '/stimulus-groups/{id}/members',
    tags,
    summary: 'Set the complete ordered member list of a group (atomic)',
    description:
      'Adds, removals and reordering in one call. A question that is already shown to pupils (live version approved, active) cannot be added, removed or have its relative order changed; new draft or review questions can still be appended to a group that has served members (409 `groupServed` / `memberServed` otherwise). A question of another group, a PKSK, archived or inactive question, a question of another subject, and more than 40 members are 422.',
    request: { params: idParams, headers: [csrf], body: body(StimulusGroupMembersSetRequestSchema) },
    responses: { 200: json(mutationEnvelopeOf(StimulusGroupDetailSchema), 'The group after the change.'), 401: unauthorized, 403: forbidden, 404: notFound, 409: conflict, 422: invalid },
  })
  registry.registerPath({
    method: 'put',
    path: '/stimulus-groups/{id}/members/order',
    tags,
    summary: 'Reorder the members of a group',
    description: '`questionIds` must list every current member exactly once (422 `questionIds` otherwise).',
    request: { params: idParams, headers: [csrf], body: body(StimulusGroupReorderRequestSchema) },
    responses: { 200: json(mutationEnvelopeOf(StimulusGroupDetailSchema), 'The group after the change.'), 401: unauthorized, 403: forbidden, 404: notFound, 409: conflict, 422: invalid },
  })
  registry.registerPath({
    method: 'post',
    path: '/stimulus-groups/{id}/questions',
    tags,
    summary: 'Create a question directly inside a group',
    description: 'Same body as `POST /questions` (a `stimulusGroupId` in the body must equal the path id). The question is appended at the end of the group. Flash: "Soalan berjaya ditambah ke dalam kumpulan."',
    request: { params: idParams, headers: [csrf], body: body(QuestionCreateRequestSchema) },
    responses: { 201: json(mutationEnvelopeOf(QuestionSchema), 'Created.'), 401: unauthorized, 403: forbidden, 404: notFound, 409: conflict, 422: invalid },
  })
}
