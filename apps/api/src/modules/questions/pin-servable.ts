import type { QuestionVersionRecord } from './types'

/**
 * REQ-B-058: may a NEW sitting (or a Kuiz page) be served from the version a placement PINNED?
 *
 * The pinned read of REQ-B-032 serves `approved` and `archived` versions alike (the SQL served rule `QUESTION_SERVED` /
 * `VERSION_SERVED` in `stimuli.repository.ts` and the image read rule do the same), because a RUNNING sitting must keep its version
 * whatever happens to the question afterwards. That left a content-safety gap for a NEW sitting: a pinned version that was taken
 * down (archived "withdrawn" or "source_takedown") was still served while a later version was live.
 *
 * A pinned version is servable to a new sitting only when it is `approved`, or `archived` because a newer version replaced it
 * (`superseded`). An archive with any other reason, or none recorded, is a takedown. A draft or in-review version is not servable
 * either. Running sittings do not use this rule: they read the pin directly, unchanged.
 */
export function pinServableForNewSitting(version: Pick<QuestionVersionRecord, 'status' | 'archiveReason'>): boolean {
  if (version.status === 'approved') return true
  return version.status === 'archived' && version.archiveReason === 'superseded'
}
