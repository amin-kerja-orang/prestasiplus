import type { PipeTransform } from '@nestjs/common'
import type { z } from 'zod'

import { ApiError } from '../errors/api-error'

type Obj = z.ZodObject<z.ZodRawShape>
type Fields = Record<string, string>
type Issue = z.ZodError['issues'][number]

/** The message of an unknown body key (the copy BE-05, BE-12 classes and BE-20 subscriptions already use). */
export const notAllowed = (key: string): string => `The ${key} field is not allowed.`

/**
 * Sets `fields[key]` unless the key is already there (first message wins). It is written as an own property,
 * so an unknown key such as `__proto__` or `constructor` is named in `fields` like any other key.
 */
export function setFieldOnce(fields: Fields, key: string, message: string): void {
  if (Object.prototype.hasOwnProperty.call(fields, key)) return
  Object.defineProperty(fields, key, { value: message, enumerable: true, writable: true, configurable: true })
}

/**
 * Field errors of a failed zod parse, first issue per dotted path (`_` for the root). An unknown key of a
 * strict schema (`unrecognized_keys`) is named itself, with {@link notAllowed}, never as `_` (BE-NFR-05).
 */
export function strictFieldsOf(issues: readonly Issue[], into: Fields = {}): Fields {
  for (const issue of issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) setFieldOnce(into, [...issue.path.map(String), key].join('.'), notAllowed(key))
      continue
    }
    setFieldOnce(into, issue.path.length ? issue.path.map(String).join('.') : '_', issue.message)
  }
  return into
}

/** The keys of a body object that are not in `allowed` (own enumerable keys, `__proto__` included). */
export function unknownKeysOf(body: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(body).filter((key) => !allowed.includes(key))
}

/**
 * `ZodValidationPipe` in STRICT mode (BE-33 AC1c, #97 to #99): the contract object schema is made `.strict()` here,
 * so an unknown key is a 422 `VALIDATION_ERROR` with `fields[key] = "The <key> field is not allowed."`, never bound
 * and never ignored. Other failures are as the plain pipe: the contract message, first issue per path.
 */
export class StrictZodValidationPipe<T extends Obj> implements PipeTransform<unknown, z.output<T>> {
  private readonly strict: z.ZodType

  constructor(schema: T) {
    this.strict = schema.strict()
  }

  transform(value: unknown): z.output<T> {
    const result = this.strict.safeParse(value)
    if (result.success) return result.data as z.output<T>
    throw ApiError.of('VALIDATION_ERROR', { fields: strictFieldsOf(result.error.issues) })
  }
}
