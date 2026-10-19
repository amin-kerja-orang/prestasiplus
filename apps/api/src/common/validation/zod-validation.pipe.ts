import type { PipeTransform } from '@nestjs/common'
import type { z } from 'zod'

import { ApiError } from '../errors/api-error'

/**
 * Parses a request part (body or query) with a contract schema. Failure gives 422 VALIDATION_ERROR
 * with `fields` (dotted path to message; first issue per path). Usage:
 * `@Body(new ZodValidationPipe(LoginRequestSchema)) body: LoginRequest`.
 */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value)
    if (result.success) return result.data
    const fields: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.length ? issue.path.map(String).join('.') : '_'
      fields[key] ??= issue.message
    }
    throw ApiError.of('VALIDATION_ERROR', { fields })
  }
}
