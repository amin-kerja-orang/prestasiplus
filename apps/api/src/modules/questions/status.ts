import { QUESTION_STATUSES, type QuestionStatus } from '@pp/contract'

export { QUESTION_STATUSES }

/** AC 11: the mock status values mapped to the v2 codes. `rejected` has no v2 status. */
export const MOCK_STATUS_TO_V2: Readonly<Record<string, QuestionStatus | undefined>> = {
  draft: 'draft',
  pending_review: 'review',
  approved: 'published',
  archived: 'archived',
  rejected: undefined,
}

export function mockStatusToV2(mock: string): QuestionStatus | undefined {
  return Object.hasOwn(MOCK_STATUS_TO_V2, mock) ? MOCK_STATUS_TO_V2[mock] : undefined
}

export const isQuestionStatus = (v: unknown): v is QuestionStatus =>
  typeof v === 'string' && (QUESTION_STATUSES as readonly string[]).includes(v)
