import { SPM_MESSAGES } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'

/** 422 with the first field message as the summary, like the mock's `validationError`. */
export function fieldError(fields: Record<string, string>): ApiError {
  return ApiError.of('VALIDATION_ERROR', { message: Object.values(fields)[0] ?? 'The given data was invalid.', fields })
}

/** 404 "Not Found." (unknown code, unknown mock, someone else's mock). */
export const notFound = (): ApiError => ApiError.of('NOT_FOUND', { message: SPM_MESSAGES.notFound })
