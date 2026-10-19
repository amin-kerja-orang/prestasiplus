import { ApiError } from '../../common/errors/api-error'

export const notFound = (): ApiError => ApiError.of('NOT_FOUND')

/** Laravel `ValidationException::summarize`, as the mock: the first message plus "(and N more error(s))". */
export function summarize(fields: Record<string, string>): string | undefined {
  const messages = Object.values(fields)
  const [first] = messages
  if (first === undefined) return undefined
  const more = messages.length - 1
  return more === 0 ? first : `${first} (and ${String(more)} more error${more === 1 ? '' : 's'})`
}

/** 422 VALIDATION_ERROR with `fields`; the message is the mock summary. */
export function invalid(fields: Record<string, string>): ApiError {
  const message = summarize(fields)
  return ApiError.of('VALIDATION_ERROR', { fields, ...(message ? { message } : {}) })
}

/** The contract 413 of the imports. */
export const tooLarge = (message: string): ApiError => new ApiError({ code: 'PAYLOAD_TOO_LARGE', status: 413, message })
