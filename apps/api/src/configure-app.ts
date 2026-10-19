import type { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { json, type NextFunction, type Request, type Response } from 'express'
import { Logger } from 'nestjs-pino'

import { requestIdMiddleware } from './common/request/request-id'

/** `TRUST_PROXY_HOPS`: number of reverse proxies in front of the API (integer 0..10, default 0). */
export function trustProxyHops(raw: unknown): number {
  const n = Number.parseInt(String(raw ?? ''), 10)
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : 0
}

/**
 * JSON limit of the bulk user import only. The contract allows 1,048,576 characters of text plus the
 * JSON envelope, so 1100kb. Every other route keeps Nest's default JSON limit (100kb).
 */
export const IMPORT_JSON_LIMIT = '1100kb'
export const IMPORT_JSON_PATH = '/api/admin/users/bulk-import'

/** Cross-cutting setup shared by `main.ts` and the tests: prefix, request id, logger, proxy trust. */
export function configureApp(app: INestApplication): void {
  // With 0 hops X-Forwarded-For is ignored and `req.ip` is the socket address, so a client cannot
  // choose the address the login throttle and the audit log see.
  const hops = trustProxyHops(app.get(ConfigService).get('TRUST_PROXY_HOPS'))
  ;(app.getHttpAdapter().getInstance() as { set(key: string, value: unknown): void }).set('trust proxy', hops)
  app.setGlobalPrefix('api')
  app.use(requestIdMiddleware) // before pino-http, so `req.id` is set when it logs
  // A larger JSON parser for the import route ONLY. `app.use` runs now, before Nest registers its own
  // parsers at init; a parser that has read the body sets `req._body`, so the later (100kb) parser skips it.
  const largeJson = json({ limit: IMPORT_JSON_LIMIT })
  app.use(IMPORT_JSON_PATH, (req: Request, res: Response, next: NextFunction) => (req.method === 'POST' ? largeJson(req, res, next) : next()))
  app.useLogger(app.get(Logger))
}
