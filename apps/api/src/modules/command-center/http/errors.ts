import { ApiError, DEFAULT_ERROR_MESSAGES } from '../../../common/errors/api-error'

/** 422 VALIDATION_ERROR with `fields` and a chosen top-level message (the contract wants the BM text). */
export function invalid(fields: Record<string, string>, message?: string): ApiError {
  const first = Object.values(fields)[0]
  return ApiError.of('VALIDATION_ERROR', { fields, message: message ?? first ?? DEFAULT_ERROR_MESSAGES.VALIDATION_ERROR })
}

export const notFound = (message?: string): ApiError => ApiError.of('NOT_FOUND', message ? { message } : {})
