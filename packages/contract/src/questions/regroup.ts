import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { envelopeOf } from '../common/envelope'
import { ErrorBodySchema } from '../common/error'
import { IdSchema } from '../common/ids'
import { ListMetaSchema } from '../common/envelope'
import { QuestionStimulusKindSchema, QuestionStimulusTableSchema } from './parts'
import { STIMULUS_FLAGS, StimulusFlagSchema } from './schema'
import { STIMULUS_LIMITS, STIMULUS_MESSAGES, StimulusGroupDetailSchema } from './stimuli'

/**
 * S1-T07 (60 section 2.17.4: API-Q-12 flags, API-Q-13 work-list, API-Q-24 regroup, API-Q-36 undo). Admin Pusat only.
 * Error texts: the generic ERR-REQ-01 / ERR-CON-01 texts of `STIMULUS_MESSAGES` (lead decision D10 on #424) and the one undo text of 60.
 */

export const REGROUP_MESSAGES = {
  /** 60 line 775, 45 section 6.6.3 (R1 copy, D113). */
  undoConflict: 'Kumpulan telah diubah selepas kumpul semula; tidak boleh dibuat asal.',
} as const


/** `POST /api/admin/questions/{id}/flags/dismiss` ("Bukan masalah"). */
export const FlagDismissRequestSchema = z.strictObject({ flag: z.enum(STIMULUS_FLAGS, STIMULUS_MESSAGES.requestInvalid) }).meta({ id: 'FlagDismissRequest' })
export type FlagDismissRequest = z.infer<typeof FlagDismissRequestSchema>
export const FlagDismissResultSchema = z.object({ id: IdSchema, flags: z.array(StimulusFlagSchema) }).meta({ id: 'FlagDismissResult' })

const Text = (max: number) => z.string().trim().max(max, STIMULUS_MESSAGES.requestInvalid)

/**
 * The stimulus of a regroup. With `figureQuestionId` it only completes the figure row's own stimulus (label, alt, caption); alone it is a full
 * `StimulusCreateRequest` (the service validates it with that schema).
 */
export const RegroupStimulusSchema = z
  .strictObject({
    kind: QuestionStimulusKindSchema.optional(),
    label: Text(STIMULUS_LIMITS.label).nullish(),
    caption: Text(STIMULUS_LIMITS.caption).nullish(),
    body: z.object({ ms: z.string().min(1).max(STIMULUS_LIMITS.body), en: z.string().max(STIMULUS_LIMITS.body).optional() }).nullish(),
    alt: Text(STIMULUS_LIMITS.alt).nullish(),
    sourceCitation: Text(STIMULUS_LIMITS.source).nullish(),
    tableData: QuestionStimulusTableSchema.nullish(),
    imageFileId: z.string().min(1).max(64).nullish(),
  })
  .meta({ id: 'RegroupStimulus' })

/** `POST /api/admin/questions/regroup` (strict). Exactly one stimulus source: `stimulusId`, or `figureQuestionId` (+ optional `stimulus`), or `stimulus`. */
export const RegroupRequestSchema = z
  .strictObject({
    figureQuestionId: IdSchema.optional(),
    stimulusId: IdSchema.optional(),
    stimulus: RegroupStimulusSchema.optional(),
    memberQuestionIds: z.array(IdSchema, STIMULUS_MESSAGES.requestInvalid).min(1, STIMULUS_MESSAGES.requestInvalid).max(STIMULUS_LIMITS.groupQuestions, STIMULUS_MESSAGES.membersTooMany),
    label: Text(STIMULUS_LIMITS.label).nullish(),
  })
  .superRefine((v, ctx) => {
    const sources = (v.stimulusId !== undefined ? 1 : 0) + (v.figureQuestionId !== undefined ? 1 : 0) + (v.figureQuestionId === undefined && v.stimulus !== undefined ? 1 : 0)
    if (sources !== 1) ctx.addIssue({ code: 'custom', path: ['stimulusId'], message: STIMULUS_MESSAGES.requestInvalid })
    if (v.stimulusId !== undefined && v.stimulus !== undefined) ctx.addIssue({ code: 'custom', path: ['stimulus'], message: STIMULUS_MESSAGES.requestInvalid })
    if (new Set(v.memberQuestionIds).size !== v.memberQuestionIds.length) ctx.addIssue({ code: 'custom', path: ['memberQuestionIds'], message: STIMULUS_MESSAGES.membersInvalid })
  })
  .meta({ id: 'RegroupRequest' })
export type RegroupRequest = z.infer<typeof RegroupRequestSchema>

/** 200 of the regroup: the new group and, in `meta`, the audit id the undo route takes. */
export const RegroupResultSchema = z
  .object({ data: StimulusGroupDetailSchema, meta: z.object({ auditId: IdSchema }) })
  .meta({ id: 'RegroupResult' })
export const RegroupUndoResultSchema = z.object({ restored: z.number().int().min(0) }).meta({ id: 'RegroupUndoResult' })

/** `GET /api/admin/questions/regroup-worklist`. `levelId` is an alias of `educationLevelId`. */
export const RegroupWorklistQuerySchema = z
  .object({
    subjectId: IdSchema.optional(),
    educationLevelId: IdSchema.optional(),
    levelId: IdSchema.optional(),
    flag: StimulusFlagSchema.optional(),
    page: z.coerce.number().int().min(1, STIMULUS_MESSAGES.page).default(1),
    pageSize: z.coerce.number().int().min(1, STIMULUS_MESSAGES.pageSize).max(100, STIMULUS_MESSAGES.pageSize).default(20),
  })
  .meta({ id: 'RegroupWorklistQuery' })

export const RegroupWorklistRowSchema = z
  .object({
    questionId: IdSchema,
    numberLabel: z.string().nullable(),
    stemExcerpt: z.string(),
    subject: z.string(),
    level: z.string(),
    flag: StimulusFlagSchema,
    reference: z.enum(['numbered', 'unnumbered']).nullable(),
    paper: z.object({ id: IdSchema, paperCode: z.string().nullable(), year: z.number().int().nullable(), examType: z.string().nullable() }).nullable(),
  })
  .meta({ id: 'RegroupWorklistRow' })

export const RegroupWorklistMetaSchema = ListMetaSchema.extend({
  counts: z.object({
    bySubject: z.record(z.string(), z.number()),
    byLevel: z.record(z.string(), z.number()),
    byFlag: z.object({ stimulus_missing: z.number(), figure_only: z.number(), stem_duplicated: z.number() }),
    open: z.number().meta({ description: 'Open `stimulus_missing` and `figure_only` rows ("perlu tindakan"); the count of the Latih Tubi lane Perhatian.' }),
    done: z.number().meta({ description: '"selesai": rows whose flag was dismissed with "Bukan masalah".' }),
  }),
}).meta({ id: 'RegroupWorklistMeta' })

export const REGROUP_COMPONENT_SCHEMAS = {
  StimulusFlag: StimulusFlagSchema,
  FlagDismissRequest: FlagDismissRequestSchema,
  FlagDismissResult: FlagDismissResultSchema,
  RegroupStimulus: RegroupStimulusSchema,
  RegroupRequest: RegroupRequestSchema,
  RegroupUndoResult: RegroupUndoResultSchema,
  RegroupWorklistRow: RegroupWorklistRowSchema,
  RegroupWorklistMeta: RegroupWorklistMetaSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({ description, content: { 'application/json': { schema } } })
const err = (description: string) => json(ErrorBodySchema, description)
const csrf = z.object({ 'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }) })
const unauthorized = err('UNAUTHORIZED: no valid session.')
const forbidden = err('FORBIDDEN (Admin Pusat only), or CSRF_INVALID when X-CSRF-Token is missing or wrong.')
const invalid = err('VALIDATION_ERROR: `fields` keyed by input name (BM messages).')
const tags = ['questions', 'regroup']

export function registerRegroupPaths(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'post',
    path: '/admin/questions/{id}/flags/dismiss',
    tags,
    summary: '"Bukan masalah": dismiss the stimulus flag of a question (API-Q-12)',
    description:
      'Sets `flag_dismissed_at/by` on the live version (and on the latest version when it is another row with the same flag); the flag stays stored and stops excluding. `flag` must equal the stored flag, else 409. Dismissing again answers 200. Audited (`question.flag_dismissed`).',
    request: { params: z.object({ id: IdSchema }), headers: [csrf], body: { required: true, content: { 'application/json': { schema: FlagDismissRequestSchema } } } },
    responses: { 200: json(envelopeOf(FlagDismissResultSchema), 'The flags still open on the question.'), 401: unauthorized, 403: forbidden, 404: err('NOT_FOUND'), 409: err('CONFLICT: `flag` is not the stored flag.'), 422: invalid },
  })
  registry.registerPath({
    method: 'get',
    path: '/admin/questions/regroup-worklist',
    tags,
    summary: 'The regroup work-list: questions with an open stimulus flag (API-Q-13)',
    description:
      'Rows are questions whose LIVE approved version carries an open flag (not dismissed). Without `flag` only `stimulus_missing` and `figure_only` are listed (the excluded ones); `flag=stem_duplicated` lists those. `meta.counts` covers the whole filter without paging.',
    request: { query: RegroupWorklistQuerySchema },
    responses: { 200: json(z.object({ data: z.array(RegroupWorklistRowSchema), meta: RegroupWorklistMetaSchema }), 'One page.'), 401: unauthorized, 403: forbidden, 422: invalid },
  })
  registry.registerPath({
    method: 'post',
    path: '/admin/questions/regroup',
    tags,
    summary: 'Regroup: members under one stimulus, in one audited transaction (API-Q-24)',
    description:
      'Creates the group, attaches 1 to 40 members (served and flagged members are accepted; no new version, no status change, no DSKP gate), removes the members\' own copy of the stimulus image, archives a `figure_only` question with `archive_reason=regrouped`, refreshes the flags and writes the audit row whose id is `meta.auditId`. 404 unknown id; 409 a member is in another group or the figure question sits on a published paper; 422 fields.',
    request: { headers: [csrf], body: { required: true, content: { 'application/json': { schema: RegroupRequestSchema } } } },
    responses: { 200: json(RegroupResultSchema, 'The new group.'), 401: unauthorized, 403: forbidden, 404: err('NOT_FOUND'), 409: err('CONFLICT'), 422: invalid },
  })
  registry.registerPath({
    method: 'post',
    path: '/admin/questions/regroup/{auditId}/undo',
    tags,
    summary: 'Undo a regroup (API-Q-36)',
    description: `Body none. Restores membership, images, the archived figure question and the flags. 409 "${REGROUP_MESSAGES.undoConflict}" after a later edit of the group or its members, a draft copy of the group, or a second undo; 404 unknown audit id.`,
    request: { params: z.object({ auditId: IdSchema }), headers: [csrf] },
    responses: { 200: json(envelopeOf(RegroupUndoResultSchema), 'Restored.'), 401: unauthorized, 403: forbidden, 404: err('NOT_FOUND'), 409: err(`CONFLICT: ${REGROUP_MESSAGES.undoConflict}`) },
  })
}
