import { Controller, Get, Inject, Req, Res } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ModuleRef } from '@nestjs/core'
import type { Request, Response } from 'express'

import type { Env } from '../config/env.schema'
import { ApiError } from '../errors/api-error'
import { Public } from '../guards/decorators'
import { SESSION_RESOLVER, type SessionResolver } from '../guards/session-resolver'
import { parseCidrList } from './cidr'
import { type InternalPolicy, isInternalRequest } from './internal-network'
import { MetricsService } from './metrics.service'

/**
 * Public at the guard level (the internal scrape has no session); the controller itself allows the call when
 * (a) it comes straight from the internal network, or (b) the caller has a valid session whose ACTIVE role is admin.
 * Anything else is 403 FORBIDDEN. `METRICS_ENABLED=false` makes the route 404.
 */
@Public()
@Controller('metrics')
export class MetricsController {
  constructor(
    @Inject(MetricsService) private readonly metrics: MetricsService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
  ) {}

  /** METRICS_INTERNAL_CIDRS set: only those peers. Unset: production = off (admin only), otherwise loopback/private. */
  private policy(): InternalPolicy {
    const raw = this.config.get('METRICS_INTERNAL_CIDRS', { infer: true })
    if (raw) return { cidrs: parseCidrList(raw) }
    return this.config.get('NODE_ENV', { infer: true }) === 'production' ? 'off' : 'private'
  }

  @Get()
  async get(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (this.config.get('METRICS_ENABLED', { infer: true }) === 'false') throw ApiError.of('NOT_FOUND')
    if (!isInternalRequest(req, this.policy())) {
      // Looked up lazily across modules: importing AuthModule here would install its global guards in every app that has health/metrics.
      let resolver: SessionResolver | undefined
      try {
        resolver = this.moduleRef.get<SessionResolver>(SESSION_RESOLVER, { strict: false })
      } catch {
        resolver = undefined // no auth module in this app: no admin session is possible
      }
      const auth = resolver ? await resolver.resolve(req) : null
      if (auth?.active.role !== 'admin') throw ApiError.of('FORBIDDEN')
    }
    // setHeader, not res.set: Express rewrites a Content-Type it sets with res.set (charset first).
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).end(this.metrics.render())
  }
}
