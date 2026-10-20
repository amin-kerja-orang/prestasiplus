import { Inject, Injectable, type PipeTransform } from '@nestjs/common'
import type { Request } from 'express'

import { ApiError } from '../../../../common/errors/api-error'
import type { RequestWithAuth } from '../../../../common/scope'
import { ScopeContext } from '../../../../common/scope'
import { isIdString } from '../../../../db/ids'
import { isOverloadError, rateLimited } from '../../../auth/auth.errors'
import { DIRECTORY_PORT, type DirectoryPort } from '../ports'
import type { Ctx } from '../services'

/** Longest query-string value read (BE-NFR-25); a longer one is a 422 on that key. */
export const QUERY_VALUE_MAX = 64
/** Most distinct query keys read; more is a 422. */
export const QUERY_KEYS_MAX = 20
/** Seconds a client is told to wait after an overload answer. */
export const OVERLOAD_RETRY_AFTER = 5

/** The caller as the services see them: from the session only, never from the query or body. */
export function ctxOf(req: Request & RequestWithAuth): Ctx {
  const scope = ScopeContext.fromRequest(req)
  return { userId: scope.userId, role: scope.role, scope: scope.scope, isTest: scope.isTest }
}

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
 * A path id that is not a canonical decimal id can never exist. It is replaced by `0` (no row has
 * id 0), so the route answers exactly as it does for any unknown id (404, 403 or an empty payload,
 * per the contract) and no raw client text reaches a repository.
 */
@Injectable()
export class SafeIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    return typeof value === 'string' && isIdString(value) ? value : '0'
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
        const values = [raw]
        if (values.some((v) => typeof v === 'string' && v.length > QUERY_VALUE_MAX)) {
          fields[shown] = `The ${shown} field must not be greater than ${QUERY_VALUE_MAX} characters.`
        }
      }
    }
    if (Object.keys(fields).length > 0) throw ApiError.of('VALIDATION_ERROR', { fields })
    return value
  }
}

/**
 * Builds the `Ctx` of a request. A student's session scope is `self` (ADR-0017), which carries no
 * school, yet the school screens the access matrix grants to students are scoped to the pupil's own
 * school. So for a student the school comes from the account (the directory) and is put into the
 * scope. Mod Pelajar (an admin acting as student) has no school and stays `self`. Everything else
 * is exactly the session scope; nothing is read from the query or body.
 */
@Injectable()
export class CtxFactory {
  constructor(@Inject(DIRECTORY_PORT) private readonly directory: DirectoryPort) {}

  async of(req: Request & RequestWithAuth): Promise<Ctx> {
    const ctx = ctxOf(req)
    if (ctx.role !== 'student' || ctx.scope.level !== 'self') return ctx
    const me = (await this.directory.users([ctx.userId])).get(ctx.userId)
    const schoolId = me?.schoolId ?? null
    if (schoolId === null) return ctx
    const school = await this.directory.school(schoolId)
    return { ...ctx, scope: { level: 'school', schoolId, label: school?.name ?? ctx.scope.label } }
  }
}
