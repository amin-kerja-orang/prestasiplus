import { NotImplementedException } from '@nestjs/common'

import { ApiError } from '../../../common/errors/api-error'

/** 422 VALIDATION_ERROR with `fields` and a chosen top-level message (the contract wants the BM text, not "The given data was invalid."). */
export function invalid(fields: Record<string, string>, message?: string): ApiError {
  const first = Object.values(fields)[0]
  return ApiError.of('VALIDATION_ERROR', { fields, message: message ?? first ?? 'The given data was invalid.' })
}

export const notFound = (message?: string): ApiError => ApiError.of('NOT_FOUND', message ? { message } : {})

/** Placeholder body of a route whose implementer has not landed yet (501). Remove the call when the route is built. */
export function notImplemented(route: string): never {
  throw new NotImplementedException(`${route} is not implemented yet.`)
}
