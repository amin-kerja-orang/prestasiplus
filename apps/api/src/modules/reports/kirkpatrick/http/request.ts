import { Injectable, type PipeTransform } from '@nestjs/common'
import type { Request } from 'express'
import type { z } from 'zod'

import { ApiError } from '../../../../common/errors/api-error'
import { requestIdOf } from '../../../../common/request/request-id'
import type { RequestWithAuth } from '../../../../common/scope'
import { AUTH_CONTEXT_KEY } from '../../../../common/scope/auth-context'
import { isIdString } from '../../../../db/ids'
import { isOverloadError, rateLimited } from '../../../auth/auth.errors'
import type { Ctx } from '../services/scope'
import type { WriteCtx } from '../services/interventions.service'

/** Longest query-string value read (BE-NFR-25); a longer one is a 422 on that key. */
export const QUERY_VALUE_MAX = 64
/** Most distinct query keys read; more is a 422. */
export const QUERY_KEYS_MAX = 20
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

/** Laravel `ValidationException::summarize`: the first message, plus "(and N more error(s))". */
export function summarizeFields(fields: Record<string, string>): string {
  const messages = Object.values(fields)
  const first = messages[0] ?? ''
  const more = messages.length - 1
  return more <= 0 ? first : `${first} (and ${String(more)} more error${more === 1 ? '' : 's'})`
}

/** Parses a body or query with a contract schema; a failure is a 422 with `fields` and the summary message. */
export class SummaryZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value ?? {})
    if (result.success) return result.data
    const fields: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.length ? issue.path.map(String).join('.') : '_'
      fields[key] ??= issue.message
    }
    throw ApiError.of('VALIDATION_ERROR', { fields, message: summarizeFields(fields) })
  }
}

/** Caps every query-string value (and repeated values) before the contract schema reads it. */
@Injectable()
export class BoundedQueryPipe implements PipeTransform<unknown, unknown> {
  transform(value: unknown): unknown {
    const fields: Record<string, string> = Object.create(null) as Record<string, string>
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const entries = Object.entries(value as Record<string, unknown>)
      if (entries.length > QUERY_KEYS_MAX) fields._ = `The query must not have more than ${QUERY_KEYS_MAX} keys.`
      for (const [key, raw] of entries) {
        const shown = key.slice(0, QUERY_VALUE_MAX)
        if (Array.isArray(raw)) {
          fields[shown] = `The ${shown} field must not be repeated.`
          continue
        }
        if (typeof raw === 'string' && raw.length > QUERY_VALUE_MAX) {
          fields[shown] = `The ${shown} field must not be greater than ${QUERY_VALUE_MAX} characters.`
        }
      }
    }
    if (Object.keys(fields).length > 0) throw ApiError.of('VALIDATION_ERROR', { fields })
    return value
  }
}

/**
 * A pupil id in the path: a non-numeric id has no route (404 "Not Found."); a numeric one that can never be an id
 * (a leading zero, past bigint) becomes `0`, which no row has, so it answers like any unknown id.
 */
@Injectable()
export class PupilIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) throw ApiError.of('NOT_FOUND')
    return isIdString(value) ? value : '0'
  }
}

/**
 * The caller from the session only: the active role, the school of a school-scoped role, and (for a student, whose
 * session scope is `self`) nothing else. Nothing is read from the query or body.
 */
export function ctxOf(req: Req): Ctx {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  const { role, scope } = auth.active
  const schoolId = (scope.level === 'school' || scope.level === 'class') && scope.schoolId ? scope.schoolId : null
  return { userId: auth.userId, role, schoolId, isTest: auth.mode !== null }
}

export function writeCtxOf(req: Req): WriteCtx {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  return {
    ...ctxOf(req),
    requestId: requestIdOf(req) ?? null,
    ip: req.ip ?? req.socket.remoteAddress ?? null,
    sessionRowId: auth.sessionRowId,
    scopeLevel: auth.active.scope.level,
  }
}
