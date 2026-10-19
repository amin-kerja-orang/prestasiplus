import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { questionWorkflowListMetaOf } from './common'

/**
 * Master notes, S12 "Master Notes - Admin Review" (mock `handlers/master-notes.ts`, SRS BR-M04-23,
 * FR-M04-102 to 105). Routes: `GET /master-notes`, `POST /master-notes/{id}/{action}`. Admin only,
 * although the screen is rendered in the user shell (SEC-M04-09).
 *
 * `regen` picks the next canned note in the mock; the real regeneration calls the AI adapter
 * (BE-36), which is a stub in B1 (OD-7): no network call is made by this card.
 *
 * Difference from the mock: ids are strings (UD-1).
 */

export const MASTER_NOTE_PAGE_SIZE = 15

export const MASTER_NOTE_TABS = ['flagged', 'approved', 'all'] as const
export const MasterNoteTabSchema = z.enum(MASTER_NOTE_TABS).meta({ id: 'MasterNoteTab' })
export type MasterNoteTab = z.infer<typeof MasterNoteTabSchema>

export const MASTER_NOTE_ACTIONS = ['approve', 'regen', 'unflag'] as const
export const MasterNoteActionSchema = z
  .enum(MASTER_NOTE_ACTIONS)
  .meta({ id: 'MasterNoteAction', description: 'approve = teacherApproved true and flagged false; unflag = flagged false; regen = next note, flags kept. An unknown action does not match the route (404).' })
export type MasterNoteAction = z.infer<typeof MasterNoteActionSchema>

/** `tab` defaults to, and an unknown value falls back to, `flagged`. */
export const MasterNoteListQuerySchema = z
  .object({
    tab: z.string().optional().meta({ description: 'flagged | approved | all. Unknown falls back to flagged (reported in meta.activeTab).' }),
    page: z.coerce.number().int().min(1).optional(),
  })
  .meta({ id: 'MasterNoteListQuery' })

export const MasterNoteRowSchema = z
  .strictObject({
    id: IdSchema,
    questionId: IdSchema,
    /** `"—"` when the question or its subject is unknown. */
    subjectName: z.string(),
    /** `null` is shown as "-". */
    chapter: z.string().nullable(),
    model: z.string(),
    tokens: z.number().int().min(0),
    confidence: z.number().min(0),
    questionText: z.string(),
    noteText: z.string(),
    trapText: z.string(),
    flagged: z.boolean(),
    teacherApproved: z.boolean(),
    createdAt: TimestampSchema,
  })
  .meta({ id: 'MasterNoteRow' })
export type MasterNoteRow = z.infer<typeof MasterNoteRowSchema>

export const MasterNoteListMetaSchema = questionWorkflowListMetaOf({
  activeTab: MasterNoteTabSchema,
  summary: z.strictObject({
    flagged: z.number().int().min(0),
    teacherApproved: z.number().int().min(0),
    total: z.number().int().min(0),
  }),
}).meta({ id: 'MasterNoteListMeta' })

/** 15 per page, id descending. */
export const MasterNoteListResponseSchema = z
  .object({ data: z.array(MasterNoteRowSchema), meta: MasterNoteListMetaSchema })
  .meta({ id: 'MasterNoteListResponse' })

/** 200 body of an action, RAW and without a flash: the page judges success by the status only. */
export const MasterNoteActionResultSchema = z
  .strictObject({ ok: z.literal(true) })
  .meta({ id: 'MasterNoteActionResult' })
