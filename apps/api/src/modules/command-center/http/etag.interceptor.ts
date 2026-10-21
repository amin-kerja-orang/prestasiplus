import { createHash } from 'node:crypto'

import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common'
import type { Response } from 'express'
import { map, type Observable } from 'rxjs'

import { VOLATILE_KEYS } from '../command-center.constants'

/** The weak validator of a body: a hash of its JSON with the volatile keys (`generatedAt`) left out. */
export function etagOf(body: unknown): string {
  const stable = JSON.stringify(body, (key, value: unknown) => (VOLATILE_KEYS.includes(key) ? undefined : value)) ?? ''
  return `W/"${createHash('sha1').update(stable).digest('base64url')}"`
}

/**
 * Conditional GET for the polling routes. Sets a weak `ETag` computed from the body without `generatedAt`; Express then answers
 * 304 (empty body, headers kept) when `If-None-Match` matches. The handler still runs, so this saves bandwidth, not queries.
 * Errors are not hashed. List it AFTER `NoStoreInterceptor`.
 */
@Injectable()
export class ConditionalGetInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = ctx.switchToHttp().getResponse<Response>()
    return next.handle().pipe(
      map((body) => {
        res.setHeader('ETag', etagOf(body))
        return body
      }),
    )
  }
}
