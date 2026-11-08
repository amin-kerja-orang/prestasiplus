import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { featureKeyForApiPath } from '@pp/contract'
import type { Request } from 'express'

import { ApiError } from '../errors/api-error'
import { FeatureFlagsService } from './feature-flags.service'

/** The path as the router sees it: no query, no repeated slashes, lower case (Express routes are case-insensitive). */
export function normalisePath(url: string): string {
  let path = url.split('?')[0] ?? ''
  try {
    path = decodeURI(path)
  } catch {
    // keep the raw path
  }
  return path.replace(/\/{2,}/g, '/').toLowerCase()
}

/**
 * API-AUTH-16: a global guard that runs BEFORE `AuthGuard`. A path under the api prefix of an OFF (or locked) flag answers the
 * standard `404 NOT_FOUND` for every caller, anonymous included (never 403, never a "feature off" message). A key with no row
 * is ON. Paths no flag covers cost nothing (no read).
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(@Inject(FeatureFlagsService) private readonly flags: FeatureFlagsService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true
    const req = ctx.switchToHttp().getRequest<Request>()
    const key = featureKeyForApiPath(normalisePath(req.originalUrl ?? req.url))
    if (key === null) return true
    if (await this.flags.isEnabled(key)) return true
    throw ApiError.of('NOT_FOUND')
  }
}
