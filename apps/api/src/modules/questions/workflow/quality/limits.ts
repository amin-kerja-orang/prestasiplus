import type { RateLimitSpec } from '../../../../common/throttle'

/** Writes of the admin tools of this card (quality, diagram audit, master notes, AI stub): per user. */
export const WORKFLOW_ADMIN_WRITE_LIMIT = {
  bucket: 'questions.workflow.admin.write',
  env: 'THROTTLE_ADMIN_WRITE_PER_MINUTE',
  default: 30,
  per: 'user',
} as const satisfies RateLimitSpec

/** Lookups (DSKP picking lists, D57): per user, shared with the admin read bucket env. */
export const WORKFLOW_LOOKUP_LIMIT = {
  bucket: 'questions.workflow.lookup',
  env: 'THROTTLE_ADMIN_READ_PER_MINUTE',
  default: 120,
  per: 'user',
} as const satisfies RateLimitSpec

/** Diagram image size limit: 2 MB (contract `QUESTION_WORKFLOW_IMAGE_MAX_BYTES`, which the contract barrel does not export). */
export const QUESTION_WORKFLOW_IMAGE_MAX_BYTES = 2 * 1024 * 1024
