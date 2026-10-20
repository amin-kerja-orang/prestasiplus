import { Injectable, type PipeTransform } from '@nestjs/common'
import type { Request } from 'express'
import type { z } from 'zod'

import { ApiError } from '../../../../common/errors/api-error'
import type { RequestWithAuth } from '../../../../common/scope'
import { AUTH_CONTEXT_KEY } from '../../../../common/scope/auth-context'
import { isIdString } from '../../../../db/ids'
import { isOverloadError, rateLimited } from '../../../auth/auth.errors'
import type { Ctx } from '../services/scope'

/** Longest query-string value read; a longer one is cut (the M11 filters are tolerant: nothing is rejected). */
export const QUERY_VALUE_MAX = 64
/** Seconds a client is told to wait after an overload answer. */
export const OVERLOAD_RETRY_AFTER = 5

type Req = Request & RequestWithAuth

/** An overloaded database or pool is retryable: 429 with Retry-After, never a 500. */
export async function overloadTo429<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (isOverloadError(err)) throw rateLimited(OVERLOAD_RETRY_AFTER)
    throw err
  }
}

/**
 * The M11 filters are tolerated, never rejected (contract): the pipe keeps only the named keys, takes the first value
 * of a repeated key, drops anything that is not text and cuts long values. Only `format` of the export is validated,
 * afterwards, by the contract schema.
 */
export class TolerantQueryPipe implements PipeTransform<unknown, Record<string, string>> {
  constructor(private readonly keys: readonly string[]) {}

  transform(value: unknown): Record<string, string> {
    const out: Record<string, string> = {}
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return out
    const source = value as Record<string, unknown>
    for (const key of this.keys) {
      const raw = Array.isArray(source[key]) ? (source[key] as unknown[])[0] : source[key]
      if (typeof raw === 'string') out[key] = raw.slice(0, QUERY_VALUE_MAX)
    }
    return out
  }
}

/** Parses the (already tolerant) query with a contract schema; a failure is a 422 with `fields` (first message per key). */
export class FieldsZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value ?? {})
    if (result.success) return result.data
    const fields: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.length ? issue.path.map(String).join('.') : '_'
      fields[key] ??= issue.message
    }
    throw ApiError.of('VALIDATION_ERROR', { fields, message: Object.values(fields)[0] ?? '' })
  }
}

/**
 * An id in the path: a non-numeric id has no route (404 "Not Found."); a numeric one that can never be an id (a leading
 * zero, past bigint) becomes `0`, which no row has, so it answers like any unknown id.
 */
@Injectable()
export class PathIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) throw ApiError.of('NOT_FOUND')
    return isIdString(value) ? value : '0'
  }
}

/** The caller from the session only: the active role and the school of a school-scoped role. Nothing is read from the query or body. */
export function ctxOf(req: Req): Ctx {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  const { role, scope } = auth.active
  const schoolId = (scope.level === 'school' || scope.level === 'class') && scope.schoolId ? scope.schoolId : null
  return { userId: auth.userId, role, schoolId }
}
