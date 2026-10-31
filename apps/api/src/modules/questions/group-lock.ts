import { STIMULUS_LIMITS, STIMULUS_MESSAGES } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import type { TxClient } from '../../db/client'
import { idFromString, isIdString } from '../../db/ids'
import { SERVABLE_STATUS } from './learner-visibility'

export const GROUP_LOCKED_MESSAGE = 'Kumpulan ini mempunyai soalan yang sedang diterbitkan. Arkibkan soalan itu dahulu sebelum mengubah kumpulan.'
export const QUESTION_SERVED_MESSAGE = 'Soalan ini sedang diterbitkan. Gunakan "Edit sebagai draf" dan jangan ubah kumpulannya sehingga ia diarkibkan.'

const taken = (): ApiError => ApiError.of('VALIDATION_ERROR', { fields: { stimulusGroupId: STIMULUS_MESSAGES.memberTaken } })
const conflict = (message: string): ApiError => ApiError.of('CONFLICT', { message })

type Served = { liveVersionNo: number | null; versions: { versionNo: number; status: string }[] }
const isServed = (q: Served): boolean => q.liveVersionNo !== null && q.versions.some((v) => v.versionNo === q.liveVersionNo && v.status === SERVABLE_STATUS)

/**
 * R1-T13 (B2 review): the group a question joins or leaves through `POST/PUT /questions` follows the rules of the stimulus API
 * (T32) and one more: a served group is read-only. Call it inside the write transaction, after the question row is locked.
 *  - the same group as now is a no-op (returns false: do not move the question);
 *  - a served question (live version approved) is never moved, added or taken out: pupils would see it change;
 *  - a question in a group may not jump to another one (remove, then add: one group per question);
 *  - a group with a served member is closed to new members; a group holds at most `STIMULUS_LIMITS.groupQuestions`.
 * @returns true when the caller should write the new group and position.
 */
export async function checkGroupChange(tx: TxClient, questionId: bigint | null, groupId: string | null): Promise<boolean> {
  const current =
    questionId === null
      ? null
      : await tx.question.findUnique({ where: { id: questionId }, select: { groupId: true, liveVersionNo: true, versions: { select: { versionNo: true, status: true } } } })
  const currentGroup = current?.groupId == null ? null : current.groupId.toString()
  if (currentGroup === groupId) return false
  if (current && isServed(current)) throw conflict(QUESTION_SERVED_MESSAGE)
  if (groupId === null) return true
  if (currentGroup !== null) throw taken()
  if (!isIdString(groupId)) throw ApiError.of('VALIDATION_ERROR', { fields: { stimulusGroupId: 'Kumpulan stimulus tidak sah.' } })
  const members = await tx.question.findMany({
    where: { groupId: idFromString(groupId) },
    select: { liveVersionNo: true, versions: { select: { versionNo: true, status: true } } },
  })
  if (members.some(isServed)) throw conflict(GROUP_LOCKED_MESSAGE)
  if (members.length >= STIMULUS_LIMITS.groupQuestions) {
    throw ApiError.of('VALIDATION_ERROR', { fields: { stimulusGroupId: `Satu kumpulan boleh mempunyai paling banyak ${String(STIMULUS_LIMITS.groupQuestions)} soalan.` } })
  }
  return true
}
