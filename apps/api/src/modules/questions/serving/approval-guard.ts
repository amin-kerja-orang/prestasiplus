import { ApiError } from '../../../common/errors/api-error'
import { APPROVAL_UNSERVABLE_MESSAGE, approvalRefusalFields, unservableEverywhere } from './approval-check'
import type { ServabilityService } from './servability.service'

/** m-5: the BM refusal for a grouped question whose group holds no stimulus (same register as `GATE_MESSAGES.media`). */
export const GROUP_WITHOUT_STIMULUS_MESSAGE = 'Soalan ini dalam kumpulan stimulus yang belum mempunyai stimulus (rajah atau petikan). Tambah stimulus pada kumpulan sebelum diterbitkan.'

/**
 * m-5: a grouped member is shown with its group's stimulus (every member shows it), so a group with 0 stimuli cannot be approved: the
 * media rule alone counts "no stimulus" as resolved (nothing unshowable). Returns the extra approve-gate failure (`media`), or `{}` when it holds.
 */
export function groupStimulusGateFields(groupId: string | null, stimulusCount: number): Record<string, string> {
  return groupId !== null && stimulusCount === 0 ? { media: GROUP_WITHOUT_STIMULUS_MESSAGE } : {}
}

/**
 * AC-05.3 (R1-T45, B3 T45-L1): the ONE approve-time servability check. `QuestionsService` calls it from its shared approve point
 * (`setStatus` to approved, which the lifecycle Terbitkan, the bulk action and the filter action all use, and the create-as-approved
 * path), inside the transaction and after the version is live, so it sees what pupils would be served. A question no activity can
 * serve is refused (422, one BM line per activity) and the whole transition rolls back. A question the bank cannot report on (no
 * report) is not judged here.
 */
export async function assertServableSomewhere(servability: Pick<ServabilityService, 'report'>, questionId: string): Promise<void> {
  const report = await servability.report(questionId)
  if (report && unservableEverywhere(report)) {
    throw ApiError.of('VALIDATION_ERROR', {
      message: APPROVAL_UNSERVABLE_MESSAGE,
      fields: approvalRefusalFields(report),
      details: { gate: 'approve', servability: true },
    })
  }
}
