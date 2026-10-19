import type { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Logger } from 'nestjs-pino'

import { requestIdMiddleware } from './common/request/request-id'

/** `TRUST_PROXY_HOPS`: number of reverse proxies in front of the API (integer 0..10, default 0). */
export function trustProxyHops(raw: unknown): number {
  const n = Number.parseInt(String(raw ?? ''), 10)
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : 0
}

/**
 * JSON body limit. The bulk-import contract allows 1,048,576 characters of text plus the JSON
 * envelope, so 1100kb. Express applies one JSON parser before routing, so the limit is global (a
 * per-route limit is not possible); the rest of the API stays small by schema (strict bodies).
 */
export const JSON_BODY_LIMIT = '1100kb'

/** Cross-cutting setup shared by `main.ts` and the tests: prefix, request id, logger, proxy trust. */
export function configureApp(app: INestApplication): void {
  // With 0 hops X-Forwarded-For is ignored and `req.ip` is the socket address, so a client cannot
  // choose the address the login throttle and the audit log see.
  const hops = trustProxyHops(app.get(ConfigService).get('TRUST_PROXY_HOPS'))
  ;(app.getHttpAdapter().getInstance() as { set(key: string, value: unknown): void }).set('trust proxy', hops)
  app.setGlobalPrefix('api')
  app.use(requestIdMiddleware) // before pino-http, so `req.id` is set when it logs
  ;(app as unknown as { useBodyParser(type: string, options: object): void }).useBodyParser('json', { limit: JSON_BODY_LIMIT })
  app.useLogger(app.get(Logger))
}
