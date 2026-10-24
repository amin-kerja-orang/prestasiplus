import { Logger as NestLogger, type INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { json, type NextFunction, type Request, type Response } from 'express'
import { Logger } from 'nestjs-pino'

import { publicBaseUrlBootWarning } from './common/config/public-base-url'
import { clientIpBootWarning, clientIpMiddleware } from './common/net/client-ip'
import { MetricsService } from './common/metrics/metrics.service'
import { securityHeaders } from './common/security/security-headers'
import { requestIdMiddleware } from './common/request/request-id'
import { DEFAULT_COOKIE_NAME } from './modules/auth/auth.constants'
import { readCookie } from './modules/auth/cookies'
import { SESSION_TOKEN_SHAPE } from './modules/auth/tokens'

/** `TRUST_PROXY_HOPS`: number of reverse proxies in front of the API (integer 0..10, default 0). */
export function trustProxyHops(raw: unknown): number {
  const n = Number.parseInt(String(raw ?? ''), 10)
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : 0
}

/**
 * JSON limit of the two import routes (bulk user import and DELIMa student import) only; 2200kb because a 1,000,000-character text full of newlines or quotes doubles when JSON-escaped. The contract allows 1,048,576 characters of text plus the
 * JSON envelope, so 2200kb (see above). Every other route keeps Nest's default JSON limit (100kb).
 */
export const IMPORT_JSON_LIMIT = '2200kb'
export const IMPORT_JSON_PATH = '/api/admin/users/bulk-import'
/** The DELIMa student import (BE-25) takes the same large JSON body. */
export const STUDENT_IMPORT_JSON_PATH = '/api/admin/students/import'

/**
 * JSON limit of the article and note write routes (BE-24): the contract allows 200,000 characters of HTML, and
 * JSON escaping can grow that to 6 bytes per character in the worst case (control characters as \u00XX), so 1300kb.
 */
export const CONTENT_JSON_LIMIT = '1300kb'
export const CONTENT_JSON_PATHS = ['/api/admin/articles', '/api/admin/notes']

/**
 * Cheap gate in front of a large JSON parser (it runs before the guards). The large parser is used only when the
 * request carries a session cookie of the right shape AND a `Content-Length` within the limit; everything else (no
 * cookie, a bigger or unknown length) falls through to the default 100kb parser, so an anonymous oversize body is a
 * cheap 413 and never parsed. The cookie is not verified here (the guards do that), so this limits cost, it is not auth.
 */
export function largeJsonGate(parser: (req: Request, res: Response, next: NextFunction) => void, methods: readonly string[], limitKb: number, cookieName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!methods.includes(req.method)) return next()
    const length = Number(req.headers['content-length'])
    const cookie = readCookie(req, cookieName)
    if (!Number.isFinite(length) || length > limitKb * 1024 || !cookie || !SESSION_TOKEN_SHAPE.test(cookie)) return next()
    parser(req, res, next)
  }
}

/** Cross-cutting setup shared by `main.ts` and the tests: prefix, request id, logger, proxy trust. */
export function configureApp(app: INestApplication): void {
  // With 0 hops X-Forwarded-For is ignored and `req.ip` is the socket address, so a client cannot
  // choose the address the login throttle and the audit log see.
  const hops = trustProxyHops(app.get(ConfigService).get('TRUST_PROXY_HOPS'))
  ;(app.getHttpAdapter().getInstance() as { set(key: string, value: unknown): void }).set('trust proxy', hops)
  // The single place the client address is derived (CLIENT_IP_HEADER / EDGE_PROXY_SECRET); first, so guards, logs and throttles see it.
  const config = app.get(ConfigService)
  const ipWarning = clientIpBootWarning({
    NODE_ENV: config.get('NODE_ENV'),
    TRUST_PROXY_HOPS: hops,
    CLIENT_IP_HEADER: config.get('CLIENT_IP_HEADER'),
    EDGE_PROXY_SECRET: config.get('EDGE_PROXY_SECRET'),
  })
  if (ipWarning) new NestLogger('ClientIp').warn(ipWarning)
  const urlWarning = publicBaseUrlBootWarning({ NODE_ENV: config.get('NODE_ENV'), PUBLIC_BASE_URL: config.get('PUBLIC_BASE_URL') })
  if (urlWarning) new NestLogger('PublicBaseUrl').warn(urlWarning)
  app.use(clientIpMiddleware({ header: config.get<string>('CLIENT_IP_HEADER'), secret: config.get<string>('EDGE_PROXY_SECRET') }))
  app.setGlobalPrefix('api')
  app.use(securityHeaders({ production: app.get(ConfigService).get('NODE_ENV') === 'production' }))
  // Before everything else that can answer, so 4xx from guards and 404s are counted too.
  if (app.get(ConfigService).get('METRICS_ENABLED') !== 'false') app.use(app.get(MetricsService).middleware)
  app.use(requestIdMiddleware) // before pino-http, so `req.id` is set when it logs
  // A larger JSON parser for the import route ONLY. `app.use` runs now, before Nest registers its own
  // parsers at init; a parser that has read the body sets `req._body`, so the later (100kb) parser skips it.
  const cookieName = app.get(ConfigService).get<string>('SESSION_COOKIE_NAME') || DEFAULT_COOKIE_NAME
  const largeJson = largeJsonGate(json({ limit: IMPORT_JSON_LIMIT }), ['POST'], 2200, cookieName)
  for (const path of [IMPORT_JSON_PATH, STUDENT_IMPORT_JSON_PATH]) app.use(path, largeJson)
  const contentJson = largeJsonGate(json({ limit: CONTENT_JSON_LIMIT }), ['POST', 'PUT'], 1300, cookieName)
  for (const path of CONTENT_JSON_PATHS) app.use(path, contentJson)
  app.useLogger(app.get(Logger))
}
