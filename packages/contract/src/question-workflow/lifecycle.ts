import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'

/**
 * Question lifecycle used by BE-09 (`QuestionsService.setStatus`, `bulk-action`) and owned here
 * (BE-10): `docs/requirements/v2-question-bank.md` 4.1 and 4.8, `v2-exam-schema.md` D12.
 *
 * D54(a) as amended by ADR-0027 (R1-B01): statuses cross the wire as the lifecycle codes `draft`,
 * `review`, `approved`, `archived` (BM Draf, Semakan, Diterbitkan, Diarkib). `approved` is the only
 * servable status; there is no separate publish hop (the former `published` was folded into it). The mock's
 * `pending_review` / `rejected` values are not replicated: a request that carries one is a 422.
 *
 * This file is deliberately self-contained (BE-09 is not merged, so nothing is imported from
 * `questions/`); the code list is identical to BE-09's `QuestionStatus`.
 */

export const QUESTION_WORKFLOW_STATUSES = ['draft', 'review', 'approved', 'archived'] as const
export const QuestionWorkflowStatusSchema = z
  .enum(QUESTION_WORKFLOW_STATUSES)
  .meta({
    id: 'QuestionWorkflowStatus',
    description:
      'Question lifecycle code (D54a, ADR-0027): draft = Draf, review = Semakan, approved = Diterbitkan (the only status served to pupils), archived = Diarkib.',
  })
export type QuestionWorkflowStatus = z.infer<typeof QuestionWorkflowStatusSchema>

/** BM label shown in the UI for each code (v2-question-bank 4.1, D54a). */
export const QUESTION_WORKFLOW_STATUS_LABELS = {
  draft: 'Draf',
  review: 'Semakan',
  approved: 'Diterbitkan',
  archived: 'Diarkib',
} as const satisfies Record<QuestionWorkflowStatus, string>

/** Label of a version that a newer approved version replaced (v2-question-bank 4.6). */
export const QUESTION_WORKFLOW_SUPERSEDED_LABEL = 'Diarkib (digantikan)'

/**
 * Who may perform a transition. `owner_teacher` = Guru acting on a question they created (a Guru on
 * another Guru's question gets 404, BE-10 AC 2); `admin` = Admin Pusat. Admin Sekolah and every
 * other role have no access (403).
 */
export const QUESTION_WORKFLOW_ACTORS = ['admin', 'owner_teacher'] as const
export const QuestionWorkflowActorSchema = z.enum(QUESTION_WORKFLOW_ACTORS).meta({
  id: 'QuestionWorkflowActor',
  description: 'admin = Admin Pusat; owner_teacher = the Guru who created the question.',
})
export type QuestionWorkflowActor = z.infer<typeof QuestionWorkflowActorSchema>

/** Quality gates of v2-question-bank 4.8, by name. "No bypass" applies the same gate to every path. */
export const QUESTION_WORKFLOW_GATES = ['submit', 'approve'] as const
export const QuestionWorkflowGateSchema = z.enum(QUESTION_WORKFLOW_GATES).meta({
  id: 'QuestionWorkflowGate',
  description:
    'Gate that must pass for a transition: submit (draft to review), approve (review to approved: the merged approve and publish gate of ADR-0027).',
})
export type QuestionWorkflowGate = z.infer<typeof QuestionWorkflowGateSchema>

/** Rules of each gate (v2-question-bank 4.8), for tests, docs and the error `details`. */
export const QUESTION_WORKFLOW_GATE_RULES = {
  submit: [
    'Required fields present for the question type.',
    'Every low-confidence field has been confirmed or edited by a person.',
    'Subject, level and chapter are set.',
    'Duplicate flag resolved or marked "Bukan pendua".',
    'Source declaration present.',
  ],
  // ADR-0027: the former approve and publish gates are one gate (review to approved = "Terbitkan").
  approve: [
    'The reviewer is not the AI service.',
    'Tags are valid against the controlled taxonomy.',
    'The marks total equals the sum of the part marks.',
    'Stimulus and figure references resolve to uploaded media.',
    'Answer key (or mark scheme for every part) present.',
    'Difficulty set from the controlled scale.',
    'DSKP topic chosen from the curriculum list (not free text).',
    'Copyright declaration is not "belum jelas".',
    'No open duplicate flag.',
  ],
} as const satisfies Record<QuestionWorkflowGate, readonly string[]>

export const QuestionWorkflowTransitionRuleSchema = z
  .strictObject({
    from: QuestionWorkflowStatusSchema,
    to: QuestionWorkflowStatusSchema,
    actors: z.array(QuestionWorkflowActorSchema).min(1),
    gate: QuestionWorkflowGateSchema.nullable(),
    reasonRequired: z.boolean(),
  })
  .meta({ id: 'QuestionWorkflowTransitionRule', description: 'One allowed status change of the lifecycle table.' })
export type QuestionWorkflowTransitionRule = z.infer<typeof QuestionWorkflowTransitionRuleSchema>

/**
 * The allowed status pairs, exactly the table of v2-question-bank 4.1 (BE-10 AC 1). Every other
 * (from, to) pair, including from = to, answers 409 CONFLICT. ADR-0027 removed `approved` to `draft`
 * and the combined "Lulus & Terbit": review to approved is the one approving step. A status code outside
 * `QUESTION_WORKFLOW_STATUSES` is a 422 VALIDATION_ERROR, never a transition.
 */
export const QUESTION_WORKFLOW_TRANSITIONS: readonly QuestionWorkflowTransitionRule[] = [
  { from: 'draft', to: 'review', actors: ['owner_teacher', 'admin'], gate: 'submit', reasonRequired: false },
  { from: 'draft', to: 'archived', actors: ['owner_teacher', 'admin'], gate: null, reasonRequired: false },
  { from: 'review', to: 'approved', actors: ['admin'], gate: 'approve', reasonRequired: false },
  { from: 'review', to: 'draft', actors: ['admin'], gate: null, reasonRequired: true },
  { from: 'approved', to: 'archived', actors: ['admin'], gate: null, reasonRequired: true },
  { from: 'archived', to: 'draft', actors: ['admin'], gate: null, reasonRequired: false },
]

/**
 * "Sunting" on an approved question creates version n+1 as `draft`; the live version keeps serving
 * (v2-question-bank 4.6). It is an action on an approved question, not a status pair: `approved`
 * to `draft` is NOT in the table above. When version n+1 is approved, version n becomes
 * `archived` ("Diarkib (digantikan)") in the same transaction.
 */
export const QUESTION_WORKFLOW_NEW_VERSION = {
  from: 'approved',
  creates: 'draft',
  actors: ['admin'],
  supersededLabel: QUESTION_WORKFLOW_SUPERSEDED_LABEL,
} as const

/** True when `actor` may move a question from `from` to `to` (gates are checked by the service). */
export function isQuestionWorkflowTransitionAllowed(
  from: QuestionWorkflowStatus,
  to: QuestionWorkflowStatus,
  actor: QuestionWorkflowActor,
): boolean {
  return QUESTION_WORKFLOW_TRANSITIONS.some((t) => t.from === from && t.to === to && t.actors.includes(actor))
}

/** The rule of a (from, to) pair, or `undefined` when the pair is not allowed for anyone. */
export function questionWorkflowTransitionRule(
  from: QuestionWorkflowStatus,
  to: QuestionWorkflowStatus,
): QuestionWorkflowTransitionRule | undefined {
  return QUESTION_WORKFLOW_TRANSITIONS.find((t) => t.from === from && t.to === to)
}

/**
 * Audit row written for every transition (BE-10 AC 1, table `question_status_events`): actor, role,
 * time, from, to and reason. Not returned by a route of this card; it is the shape the workflow
 * service hands to BE-09 callers and the version history of a later card.
 */
export const QuestionWorkflowStatusEventSchema = z
  .strictObject({
    id: IdSchema,
    questionId: IdSchema,
    from: QuestionWorkflowStatusSchema,
    to: QuestionWorkflowStatusSchema,
    actorId: IdSchema,
    actorRole: z.string().min(1).meta({ description: 'Role code of the actor (RoleCode), kept as text in the audit row.' }),
    reason: z.string().nullable(),
    at: TimestampSchema,
  })
  .meta({ id: 'QuestionWorkflowStatusEvent', description: 'Audit row of one status transition.' })
export type QuestionWorkflowStatusEvent = z.infer<typeof QuestionWorkflowStatusEventSchema>
