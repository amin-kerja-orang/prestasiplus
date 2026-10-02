import { ApiError } from '@/api'

import { KELAS_COPY } from './copy'

/**
 * The text shown for a refused join (FR-M10-39): the response `message` of 404 / 409, the field
 * message of a 422, the network copy when the request never arrived.
 */
export function joinErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return KELAS_COPY.network
    const field = err.fields?.classCode
    if (field) return field
    if (err.message) return err.message
  }
  return KELAS_COPY.joinFailed
}
