import type { PipeTransform } from '@nestjs/common'
import type { z } from 'zod'

import { ApiError } from '../../common/errors/api-error'

type Obj = z.ZodObject<z.ZodRawShape>

/** First message plus "(and N more errors)", as the mock's `summarizeFields`. */
function summarize(fields: Record<string, string>): string | undefined {
  const messages = Object.values(fields)
  const first = messages[0]
  if (first === undefined) return undefined
  const more = messages.length - 1
  return more <= 0 ? first : `${first} (and ${more} more error${more === 1 ? '' : 's'})`
}

/** 422 VALIDATION_ERROR with `fields`; the message is the first field message. */
export function invalid(fields: Record<string, string>): ApiError {
  const message = summarize(fields)
  return ApiError.of('VALIDATION_ERROR', { fields, ...(message ? { message } : {}) })
}

/**
 * Parses a request part with a contract object schema in STRICT mode (BE-NFR-05): an unknown key is a
 * 422 with `fields[key] = "The <key> field is not allowed."`, never bound and never ignored. Other
 * failures give the contract's own message, first issue per path. An absent body is read as `{}`.
 */
export function parseStrict<T extends Obj>(schema: T, value: unknown): z.output<T> {
  const input = value === undefined || value === null ? {} : value
  const result = schema.strict().safeParse(input)
  if (result.success) return result.data as z.output<T>
  const fields: Record<string, string> = {}
  for (const issue of result.error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) fields[key] ??= `The ${key} field is not allowed.`
      continue
    }
    fields[issue.path.length ? issue.path.map(String).join('.') : '_'] ??= issue.message
  }
  throw invalid(fields)
}

export class StrictPipe<T extends Obj> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    return parseStrict(this.schema, value)
  }
}

/** Like `parseStrict` but returns the failing `fields` instead of throwing, so a service can add its own rule failures to them. */
export function tryParseStrict<T extends Obj>(
  schema: T,
  value: unknown,
): { data: z.output<T>; fields?: undefined } | { data?: undefined; fields: Record<string, string> } {
  try {
    return { data: parseStrict(schema, value) }
  } catch (err) {
    if (err instanceof ApiError && err.fields) return { fields: err.fields }
    throw err
  }
}
