import { ApiError } from '../../../common/errors/api-error'
import { APPROVAL_UNSERVABLE_MESSAGE, approvalRefusalFields, unservableEverywhere } from './approval-check'
import type { ServabilityService } from './servability.service'

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
