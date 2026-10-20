import type { PipeTransform } from '@nestjs/common'
import type { z } from 'zod'

import { invalid } from './subscriptions.errors'

type Obj = z.ZodObject<z.ZodRawShape>

/**
 * Parses a request body with a contract object schema in STRICT mode (D58d, BE-NFR-05): an unknown
 * key is a 422 with `fields[key] = "The <key> field is not allowed."` (the copy BE-05 uses), never
 * bound and never ignored. Other failures give the contract's own message, first issue per path.
 * An absent body (`undefined`) is read as `{}`.
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

export class StrictBodyPipe<T extends Obj> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    return parseStrict(this.schema, value)
  }
}
