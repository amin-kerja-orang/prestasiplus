import type { RateLimitSpec } from '../../../common/throttle'

/** The extraction job. Filed under the batch so a batch can be found by its jobs (the BE-37 jobs are filed under the file). */
export const WORKFLOW_JOB_TYPE = 'intake.extract'
export const WORKFLOW_JOB_ENTITY = 'intake_batch'

/** Rate limits per signed-in user (variables documented in .env.api.example, PC-5 block). */
export const REVIEW_LIMITS = {
  write: { bucket: 'intake-review-write', env: 'INTAKE_REVIEW_WRITES_PER_MINUTE', default: 120, per: 'user' },
  read: { bucket: 'intake-review-read', env: 'INTAKE_REVIEW_READS_PER_MINUTE', default: 600, per: 'user' },
  /** Starting an extraction can cost money (a provider call), so it has its own, much lower ceiling. */
  extract: { bucket: 'intake-extract', env: 'INTAKE_EXTRACTS_PER_MINUTE', default: 10, per: 'user' },
  bulk: { bucket: 'intake-review-bulk', env: 'INTAKE_BULK_PER_MINUTE', default: 20, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

/** Audit actions (`audit_events.action`). Item history with the previous text is in `intake_item_events`. */
export const INTAKE_AUDIT = {
  extractionRequested: 'intake.extraction_requested',
  itemAccepted: 'intake.item_accepted',
  itemAdded: 'intake.item_added',
  itemEdited: 'intake.item_edited',
  itemRejected: 'intake.item_rejected',
  itemDuplicate: 'intake.item_duplicate_decided',
  itemsBulk: 'intake.items_bulk',
  stimulusRemoved: 'intake.stimulus_removed',
} as const

/** Upper bounds that keep one batch (and one request) from growing without limit. */
export const MAX_ITEMS_PER_BATCH = 500
export const MAX_STIMULI_PER_BATCH = 200
export const MAX_DUPLICATE_ENTRIES_PER_ITEM = 50

export const WORKFLOW_MESSAGES = {
  tooManyItems: 'Terlalu banyak soalan dalam kumpulan ini.',
  pageTooLarge: 'Nombor halaman terlalu besar.',
  tooManyStimuli: 'Terlalu banyak rajah atau petikan dalam kumpulan ini.',
  stimulusInvalid: 'Rajah / petikan yang dirujuk tidak wujud.',
  confirmedNotLow: 'Hanya medan keyakinan rendah boleh disahkan.',
  userDeleted: 'Pengguna telah dipadam',
} as const
