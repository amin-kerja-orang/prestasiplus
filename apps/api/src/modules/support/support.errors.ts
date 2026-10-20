import { ApiError } from '../../common/errors/api-error'

/** Laravel `ValidationException::summarize`, as the mock: the first message plus "(and N more error(s))". */
export function summarize(fields: Record<string, string>): string {
  const messages = Object.values(fields)
  const [first] = messages
  if (first === undefined) return 'The given data was invalid.'
  const more = messages.length - 1
  return more === 0 ? first : `${first} (and ${String(more)} more error${more === 1 ? '' : 's'})`
}

/** 422 with `fields`; the top-level message is the summary of the field messages. */
export function invalid(fields: Record<string, string>): ApiError {
  return ApiError.of('VALIDATION_ERROR', { fields, message: summarize(fields) })
}
