import { SPM_MESSAGES } from '@pp/contract'

import { ApiError, DEFAULT_ERROR_MESSAGES } from '../../common/errors/api-error'

/** 422 with the first field message as the summary, like the mock's `validationError`. */
export function fieldError(fields: Record<string, string>): ApiError {
  return ApiError.of('VALIDATION_ERROR', { message: Object.values(fields)[0] ?? DEFAULT_ERROR_MESSAGES.VALIDATION_ERROR, fields })
}

/** 404 NOT_FOUND, generic BM default (unknown code, unknown mock, someone else's mock). */
export const notFound = (): ApiError => ApiError.of('NOT_FOUND', { message: SPM_MESSAGES.notFound })
